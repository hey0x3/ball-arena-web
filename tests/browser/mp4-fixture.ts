import { ArenaRecorder, RECORDING_STEP } from '../../src/recording/recorder';
import { STEP, type Simulation } from '../../src/simulation/engine';
import type { ArenaView } from '../../src/rendering/arena';
import type { PortraitRecording } from '../../src/recording/portrait';

/** Short real MP4 fixture; simulation setup can fast-forward without rendering hundreds of idle frames. */
export async function recordFixture(view: ArenaView, sim: Simulation, portrait?: PortraitRecording) {
  const recorder = new ArenaRecorder(() => {});
  const draw = () => {
    view.render(sim, 'dark', 1, false);
    portrait?.draw(view.canvas, sim, 'dark', f => view.artwork(f.definition), (f, skill) => view.skillArtwork(f.definition, skill));
  };
  draw(); await recorder.start(portrait?.canvas ?? view.canvas, 'browser-fixture');
  let accumulator = 0;
  try {
    for (let frame = 0; frame < 60; frame++) {
      if (sim.phase === 'running') {
        accumulator += RECORDING_STEP;
        while (accumulator >= STEP) { sim.step(); accumulator -= STEP; }
      }
      draw(); await recorder.captureFrame();
    }
    recorder.stop();
    while (recorder.status === 'finalizing') await new Promise(resolve => setTimeout(resolve, 10));
    if (recorder.status !== 'ready' || !recorder.blob) throw new Error(recorder.reason || 'MP4 fixture did not finalize');
    return recorder.blob;
  } finally { recorder.dispose(); }
}

export async function decodeFixture(blob: Blob, at = .5) {
  const video = document.createElement('video'), url = URL.createObjectURL(blob); video.muted = true;
  const wait = (event: 'loadeddata' | 'seeked') => new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error(`MP4 fixture timed out waiting for ${event}`)); }, 10_000);
    const done = () => { cleanup(); resolve(); };
    const error = () => { cleanup(); reject(new Error(`MP4 fixture failed to decode (${video.error?.message})`)); };
    const cleanup = () => { clearTimeout(timer); video.removeEventListener(event, done); video.removeEventListener('error', error); };
    video.addEventListener(event, done, { once: true }); video.addEventListener('error', error, { once: true });
  });
  try {
    const loaded = wait('loadeddata'); video.src = url; await loaded;
    const sought = wait('seeked'); video.currentTime = at; await sought;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext('2d')!.drawImage(video, 0, 0);
    return { canvas, frame: canvas.toDataURL(), width: video.videoWidth, height: video.videoHeight, bytes: blob.size };
  } finally { URL.revokeObjectURL(url); video.removeAttribute('src'); video.load(); }
}
