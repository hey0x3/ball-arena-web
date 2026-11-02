import { downloadBlob } from '../content/packs';
import { HitSoundtrack } from './soundtrack';
import type { AudioSampleSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output } from 'mediabunny';

export const RECORDING_FPS = 60;
export const RECORDING_STEP = 1 / RECORDING_FPS;
export type RecordingStatus = 'idle' | 'preparing' | 'recording' | 'finalizing' | 'ready' | 'failed';
export class ArenaRecorder {
  status: RecordingStatus = 'idle';
  seconds = 0;
  frames = 0;
  bytes = 0;
  reason = '';
  blob: Blob | null = null;
  filename = '';
  private output: Output<Mp4OutputFormat, BufferTarget> | null = null;
  private video: CanvasSource | null = null;
  private audio: AudioSampleSource | null = null;
  private library: typeof import('mediabunny') | null = null;
  private inFlight: Promise<void> | null = null;
  private soundtrack = new HitSoundtrack();
  private epoch = 0;
  private disposed = false;
  constructor(private changed: () => void) {}
  static supported() { return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined'; }
  async start(canvas: HTMLCanvasElement, seed: string, sound = false) {
    if (!ArenaRecorder.supported()) throw new Error('MP4 recording needs a browser with H.264 encoding. Use current desktop Chrome or Edge.');
    if (this.disposed || ['preparing', 'recording', 'finalizing'].includes(this.status)) throw new Error('A recording is already in progress.');
    const epoch = ++this.epoch;
    this.status = 'preparing'; this.blob = null; this.frames = 0; this.seconds = 0; this.bytes = 0; this.reason = ''; this.soundtrack = new HitSoundtrack(); this.changed();
    const current = () => { if (this.disposed || epoch !== this.epoch) throw new Error('Recording preparation was interrupted.'); };
    try {
      const lib = await import('mediabunny'); current(); this.library = lib;
      const quality = new lib.Quality({ bitrate: canvas.height > 720 ? 8_000_000 : 6_000_000 });
      if (!await lib.canEncodeVideo('avc', { width: canvas.width, height: canvas.height, frameRate: RECORDING_FPS, quality })) throw new Error('This browser cannot encode H.264 MP4 at the arena size. Use current desktop Chrome or Edge.');
      current();
      if (sound && !await lib.canEncodeAudio('aac', { numberOfChannels: 1, sampleRate: 48000 })) throw new Error('This browser cannot encode AAC sound. Mute arena sound and retry, or use current desktop Chrome or Edge.');
      current();
      this.output = new lib.Output({ format: new lib.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new lib.BufferTarget() });
      const countBytes = (packet: { byteLength: number }) => { this.bytes += packet.byteLength; };
      this.video = new lib.CanvasSource(canvas, { codec: 'avc', quality, latencyMode: 'quality', keyFrameInterval: 1, onEncodedPacket: countBytes });
      this.output.addVideoTrack(this.video, { frameRate: RECORDING_FPS });
      this.audio = sound ? new lib.AudioSampleSource({ codec: 'aac', quality: new lib.Quality({ bitrate: 128_000 }), onEncodedPacket: countBytes }) : null;
      if (this.audio) this.output.addAudioTrack(this.audio);
      await this.output.start(); current();
      this.filename = `ball-arena-${seed.replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'round'}-${canvas.width}x${canvas.height}-${Date.now()}.mp4`;
      this.status = 'recording'; this.changed();
    } catch (error) { if (!this.disposed) this.fail(error); throw error; }
  }
  hit(at: number) { if (this.status === 'recording' && this.audio) this.soundtrack.hit(at); }
  /** One immutable canvas frame per timestamp; awaiting this prevents dropped frames. */
  async captureFrame() {
    if (this.status !== 'recording') return;
    if (this.inFlight) throw new Error('Wait for the previous video frame before advancing the simulation.');
    const index = this.frames, timestamp = index / RECORDING_FPS, epoch = this.epoch;
    const encode = async () => {
      await this.video!.add(timestamp, RECORDING_STEP, { keyFrame: index % RECORDING_FPS === 0 });
      if (this.audio && this.library) {
        const sample = new this.library.AudioSample({ data: this.soundtrack.samples(timestamp, 800), format: 'f32', numberOfChannels: 1, sampleRate: 48000, timestamp });
        try { await this.audio.add(sample); } finally { sample.close(); }
      }
      if (this.disposed || epoch !== this.epoch) return;
      this.frames++; this.seconds = this.frames / RECORDING_FPS;
      if (this.frames % 15 === 0) this.changed();
    };
    this.inFlight = encode();
    try { await this.inFlight; }
    catch (error) { if (!this.disposed && epoch === this.epoch) this.fail(error); }
    finally { this.inFlight = null; }
    if (this.status === 'recording' && this.seconds >= 240) this.stop('Duration limit reached');
    if (this.status === 'recording' && this.bytes >= 256 * 1024 * 1024) this.stop('Size limit reached');
  }
  stop(reason = '') {
    if (this.status === 'preparing') { this.fail(new Error(reason || 'Recording preparation was interrupted.')); return; }
    if (this.status !== 'recording') return;
    this.reason = reason; this.status = 'finalizing'; this.changed();
    const output = this.output!, epoch = this.epoch;
    void (async () => {
      try {
        await this.inFlight;
        if (this.disposed || epoch !== this.epoch) return;
        if (!this.frames) throw new Error('No video frames were captured.');
        this.video?.close(); this.audio?.close(); await output.finalize();
        if (this.disposed || epoch !== this.epoch) return;
        const buffer = output.target.buffer;
        if (!buffer?.byteLength) throw new Error('The MP4 recording was empty.');
        this.blob = new Blob([buffer], { type: 'video/mp4' }); this.bytes = this.blob.size;
        this.status = 'ready'; this.output = null; this.video = null; this.audio = null; this.soundtrack = new HitSoundtrack(); this.changed(); this.download();
      } catch (error) { if (!this.disposed && epoch === this.epoch) this.fail(error); }
    })();
  }
  download() { if (this.blob) downloadBlob(this.blob, this.filename); }
  private fail(error: unknown) {
    this.epoch++; this.status = 'failed'; this.reason = error instanceof Error ? error.message : 'MP4 encoding failed.';
    const output = this.output; this.output = null; this.video = null; this.audio = null;
    if (output) void output.cancel().catch(() => {});
    this.changed();
  }
  dispose() {
    this.disposed = true; this.epoch++;
    const output = this.output; this.output = null;
    if (output) void output.cancel().catch(() => {});
    this.video = null; this.audio = null; this.blob = null;
  }
}
