import { downloadBlob } from '../content/packs';

export type RecordingStatus = 'idle' | 'recording' | 'finalizing' | 'ready' | 'failed';
export class ArenaRecorder {
  status: RecordingStatus = 'idle';
  seconds = 0;
  bytes = 0;
  reason = '';
  blob: Blob | null = null;
  filename = '';
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private started = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  constructor(private changed: () => void) {}
  static supported() { return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function'; }
  start(canvas: HTMLCanvasElement, seed: string, audio?: MediaStream) {
    if (!ArenaRecorder.supported()) throw new Error('This browser cannot record the arena. Try a current desktop browser.');
    if (this.status === 'recording' || this.status === 'finalizing') throw new Error('A recording is already in progress.');
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/mp4', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error('No supported video recording format was found.');
    this.stream = canvas.captureStream(30);
    if (audio) audio.getAudioTracks().forEach(track => this.stream!.addTrack(track.clone()));
    try { this.recorder = new MediaRecorder(this.stream, { mimeType, videoBitsPerSecond: 5_000_000 }); }
    catch (error) { this.cleanup(); throw error; }
    this.chunks = []; this.bytes = 0; this.seconds = 0; this.reason = ''; this.blob = null;
    this.filename = `ball-arena-${seed.replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'round'}-${canvas.width}x${canvas.height}-${Date.now()}.${this.recorder.mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
    this.recorder.ondataavailable = e => {
      if (e.data.size) { this.chunks.push(e.data); this.bytes += e.data.size; }
      if (this.bytes >= 256 * 1024 * 1024) this.stop('Size limit reached');
    };
    this.recorder.onerror = () => { this.status = 'failed'; this.reason = 'The video encoder stopped unexpectedly.'; this.cleanup(); this.changed(); };
    this.recorder.onstop = () => {
      if (this.status === 'failed') return;
      this.blob = new Blob(this.chunks, { type: this.recorder?.mimeType || mimeType });
      this.chunks = []; this.status = this.blob.size ? 'ready' : 'failed';
      if (this.status === 'failed') this.reason = 'The recording was empty.';
      this.cleanup(); this.changed();
      if (this.blob.size) this.download();
    };
    this.recorder.start(1000); this.started = performance.now(); this.status = 'recording';
    this.timer = setInterval(() => {
      this.seconds = (performance.now() - this.started) / 1000;
      if (this.seconds >= 240) this.stop('Duration limit reached');
      this.changed();
    }, 250);
    this.changed();
  }
  stop(reason = '') {
    if (this.status !== 'recording') return;
    this.reason = reason; this.status = 'finalizing'; this.changed();
    if (this.timer) clearInterval(this.timer);
    this.recorder?.stop();
  }
  download() { if (this.blob) downloadBlob(this.blob, this.filename); }
  private cleanup() {
    if (this.timer) clearInterval(this.timer);
    this.stream?.getTracks().forEach(t => t.stop()); this.stream = null;
  }
  dispose() { if (this.recorder) { this.recorder.onstop = null; this.recorder.ondataavailable = null; this.recorder.onerror = null; if (this.recorder.state !== 'inactive') this.recorder.stop(); } this.cleanup(); this.chunks = []; this.blob = null; }
}
