import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

test('MP4 export retains every 60fps frame despite slow renders and writes synced AAC', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
  const downloadPromise = page.waitForEvent('download');
  const result = await page.evaluate(async () => {
    const paths = ['/src/recording/recorder.ts', '/tests/browser/media-inspection.ts'];
    const [{ ArenaRecorder, RECORDING_FPS }, { Input, BlobSource, MP4, EncodedPacketSink }] = await Promise.all(paths.map(path => import(path)));
    const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 1280; const ctx = canvas.getContext('2d')!;
    const recorder = new ArenaRecorder(() => {}); await recorder.start(canvas, 'frame-regression', true);
    const started = performance.now();
    for (let frame = 0; frame < 120; frame++) {
      ctx.fillStyle = '#14121b'; ctx.fillRect(0, 0, 720, 1280); ctx.fillStyle = '#ffffff'; ctx.fillRect(100 + frame * 3, 610, 20, 40);
      if (frame === 30) recorder.hit(.5);
      await recorder.captureFrame();
      if (frame === 40 || frame === 80) await new Promise(resolve => setTimeout(resolve, 220));
    }
    recorder.stop(); while (recorder.status === 'finalizing') await new Promise(resolve => setTimeout(resolve, 10));
    if (recorder.status !== 'ready') throw new Error(recorder.reason);
    const blob = recorder.blob!, input = new Input({ source: new BlobSource(blob), formats: [MP4] }), track = await input.getPrimaryVideoTrack(), audio = await input.getPrimaryAudioTrack();
    if (!track) throw new Error('MP4 has no video track');
    const packets: { timestamp: number; duration: number }[] = [];
    for await (const packet of new EncodedPacketSink(track).packets()) packets.push({ timestamp: packet.timestamp, duration: packet.duration });
    packets.sort((a, b) => a.timestamp - b.timestamp);
    const config = await track.getDecoderConfig(), duration = await track.computeDuration(), fileDuration = await input.computeDuration(); input.dispose();
    const video = document.createElement('video'), url = URL.createObjectURL(blob); video.src = url; video.muted = true;
    await new Promise<void>((resolve, reject) => { video.onloadeddata = () => resolve(); video.onerror = () => reject(new Error('MP4 did not play')); });
    const sample = document.createElement('canvas'); sample.width = 720; sample.height = 1280; const pixels = sample.getContext('2d')!;
    const positions: number[] = [];
    for (const frame of [1, 2, 3, 39, 40, 41, 79, 80, 81, 118]) {
      video.currentTime = (frame + .2) / RECORDING_FPS; await new Promise<void>(resolve => { video.onseeked = () => resolve(); }); pixels.drawImage(video, 0, 0);
      const row = pixels.getImageData(0, 630, 720, 1).data; let x = -1; for (let i = 0; i < 720; i++) if (row[i * 4] > 180) { x = i; break; } positions.push(x);
    }
    const frame = sample.toDataURL(); URL.revokeObjectURL(url);
    return { fps: RECORDING_FPS, frames: recorder.frames, duration, fileDuration, packets, codec: config.codec, audio: audio?.codec, filename: recorder.filename, type: blob.type, positions, frame, wall: performance.now() - started };
  });
  const download = await downloadPromise; expect(download.suggestedFilename()).toMatch(/\.mp4$/);
  expect(result.type).toBe('video/mp4'); expect(result.codec).toMatch(/^avc/); expect(result.audio).toBe('aac');
  expect(result.frames).toBe(120); expect(result.packets).toHaveLength(120); expect(result.duration).toBeCloseTo(2, 2);
  expect(result.fileDuration).toBeLessThan(2.03);
  for (const [index, packet] of result.packets.entries()) { expect(packet.timestamp).toBeCloseTo(index / 60, 5); expect(packet.duration).toBeCloseTo(1 / 60, 5); }
  for (const [index, frame] of [1, 2, 3, 39, 40, 41, 79, 80, 81, 118].entries()) expect(result.positions[index]).toBeCloseTo(100 + frame * 3, -0.5);
  writeFileSync('test-results/mp4-frame-regression.png', Buffer.from(result.frame.split(',')[1], 'base64'));
});

test('the website records smooth MP4 ball motion while the render thread stalls', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ball-arena-settings', JSON.stringify({ launchAngles: [0, 180], showCharacterHealth: false }));
    const request = window.requestAnimationFrame.bind(window); let frames = 0;
    window.requestAnimationFrame = callback => request(() => {
      if (++frames % 12 === 0) { const until = performance.now() + 100; while (performance.now() < until) { /* Simulate a busy frame. */ } }
      callback(performance.now());
    });
  });
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Record round', exact: true }).click(); await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect.poll(async () => Number(await page.locator('.workspace').getAttribute('data-record-frames')), { timeout: process.env.CI ? 90_000 : 30_000 }).toBeGreaterThanOrEqual(90);
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: /Stop recording/ }).click(); const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/\.mp4$/); const bytes = readFileSync((await download.path())!); expect(bytes.toString('ascii', 4, 8)).toBe('ftyp');
  writeFileSync('test-results/smooth-arena.mp4', bytes);
  const result = await page.evaluate(async data => {
    const path = '/tests/browser/media-inspection.ts', { Input, BlobSource, MP4, EncodedPacketSink } = await import(path);
    const blob = await (await fetch(data)).blob(), input = new Input({ source: new BlobSource(blob), formats: [MP4] }), track = await input.getPrimaryVideoTrack();
    const times: number[] = []; for await (const packet of new EncodedPacketSink(track).packets()) times.push(packet.timestamp); times.sort((a, b) => a - b); input.dispose();
    const video = document.createElement('video'); video.muted = true; video.src = data; await new Promise<void>((resolve, reject) => { video.onloadeddata = () => resolve(); video.onerror = () => reject(new Error('Website MP4 would not decode')); });
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 720; const ctx = canvas.getContext('2d')!, centers: number[] = [];
    for (let frame = 10; frame <= 20; frame++) {
      video.currentTime = (frame + .2) / 60; await new Promise<void>(resolve => { video.onseeked = () => resolve(); }); ctx.drawImage(video, 0, 0);
      const pixels = ctx.getImageData(0, 470, 720, 60).data; let x = 0, count = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 140 && pixels[i + 1] > 110 && pixels[i + 2] > 100) { x += i / 4 % 720; count++; }
      if (!count) throw new Error('Could not locate the turquoise ball in the decoded MP4'); centers.push(x / count);
    }
    return { times, centers };
  }, `data:video/mp4;base64,${bytes.toString('base64')}`);
  expect(result.times.length).toBeGreaterThanOrEqual(90);
  for (let i = 1; i < result.times.length; i++) expect(result.times[i] - result.times[i - 1]).toBeCloseTo(1 / 60, 5);
  for (let i = 1; i < result.centers.length; i++) { expect(result.centers[i] - result.centers[i - 1]).toBeGreaterThan(4); expect(result.centers[i] - result.centers[i - 1]).toBeLessThan(14); }
});

test('an unsupported MP4 encoder leaves the simulator usable and reports the reason', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'VideoEncoder', { value: undefined, configurable: true }));
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Record round', exact: true }).click(); await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('H.264'); await expect(page.getByRole('button', { name: /Stop recording/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel recording', exact: true }).click(); await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.locator('.simulation-status')).toHaveText('Simulation live');
});

test('disposing during MP4 finalization does not trigger a late download', async ({ page }) => {
  let downloads = 0; page.on('download', () => downloads++);
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
  await page.evaluate(async () => {
    const path = '/src/recording/recorder.ts', { ArenaRecorder } = await import(path), recorder = new ArenaRecorder(() => {});
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 720; canvas.getContext('2d')!.fillRect(0, 0, 720, 720);
    await recorder.start(canvas, 'dispose-regression'); for (let i = 0; i < 5; i++) await recorder.captureFrame();
    recorder.stop(); recorder.dispose(); await new Promise(resolve => setTimeout(resolve, 200));
  });
  expect(downloads).toBe(0);
});
