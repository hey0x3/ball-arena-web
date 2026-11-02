import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { unzipSync, zipSync, strToU8 } from 'fflate';
import { PNG } from './png-reader';
import type { Fighter } from '../../src/simulation/engine';

test('renders an advancing arena and keeps the desktop workspace in narrow windows', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); const canvas = page.getByLabel('Live ball arena'); await expect(canvas).toBeVisible();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  // Wait for the paused presentation to render before comparing frozen frames.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  let first = await canvas.screenshot();
  let stableFrames = 0;
  await expect.poll(async () => {
    const frame = await canvas.screenshot();
    stableFrames = frame.equals(first) ? stableFrames + 1 : 0;
    first = frame;
    return stableFrames;
  }, { intervals: [100, 150, 200], timeout: 5000 }).toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(250);
  expect((await canvas.screenshot()).equals(first)).toBe(true);
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.waitForTimeout(400);
  expect((await canvas.screenshot()).equals(first)).toBe(false);
  await page.getByRole('button', { name: 'Assign Prism to A', exact: true }).click();
  await expect(page.locator('[data-contender="0"] .contender-name')).toContainText('Prism');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: 'test-results/arena-light.png', fullPage: true });
  for (const width of [1440, 1024, 900, 820, 390]) {
    await page.setViewportSize({ width, height: 800 });
    const arena = await canvas.boundingBox(), sidebar = await page.getByRole('complementary', { name: 'Character and simulation controls' }).boundingBox();
    expect(sidebar!.x).toBeGreaterThanOrEqual(arena!.x + arena!.width);
    expect(sidebar!.y).toBeLessThan(arena!.y);
    expect(sidebar!.y + sidebar!.height).toBeGreaterThan(arena!.y + arena!.height);
  }
  await page.setViewportSize({ width: 820, height: 800 });
  // A narrow preview can scroll to the right-side controls without switching to a phone layout.
  await page.getByRole('button', { name: 'Simulation settings', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Show health on characters' })).toBeVisible();
  await page.getByRole('button', { name: 'Simulation settings', exact: true }).click();
  await page.reload();
  await expect(canvas).toBeVisible();
  await page.screenshot({ path: 'test-results/arena-compact-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('creates a three-skill character, persists it, and exports/imports a pack', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Create a new ball', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Test Comet');
  await page.getByLabel('Character ID', { exact: false }).fill('test:comet');
  await page.getByRole('button', { name: 'Add a skill', exact: true }).click();
  await page.getByLabel('Skill 2 type').selectOption('wall-charge');
  await page.getByRole('button', { name: 'Add a skill', exact: true }).click();
  await expect(page.getByRole('button', { name: 'All three skill slots filled' })).toBeDisabled();
  await page.getByRole('button', { name: 'Save & use ball' }).click();
  await expect(page.getByRole('status')).toContainText('Test Comet saved');
  await page.reload();
  await page.getByRole('button', { name: 'My creations 1' }).click();
  await expect(page.getByRole('button', { name: 'Assign Test Comet to A' })).toBeVisible();
  await page.getByRole('button', { name: 'Assign Test Comet to A' }).click();
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export ball', exact: true }).click();
  const download = await downloadPromise; const packPath = await download.path(); expect(packPath).toBeTruthy();
  await page.getByLabel('Import character pack').setInputFiles(packPath!);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Keep both', exact: true }).click();
  await expect(page.getByRole('button', { name: 'My creations 2' })).toBeVisible();
});

test('rejects a fourth skill through the browser importer', async ({ page }) => {
  const character = JSON.parse(readFileSync('templates/character/character.json', 'utf8'));
  character.skills = Array.from({ length: 4 }, (_, i) => ({ ...character.skills[0], id: String(i) }));
  await page.goto('/');
  await page.getByLabel('Import character pack').setInputFiles({ name: 'invalid.zip', mimeType: 'application/zip', buffer: Buffer.from(zipSync({ 'character.json': strToU8(JSON.stringify(character)) })) });
  await expect(page.getByRole('alert')).toContainText('skills');
  await expect(page.getByRole('button', { name: 'My creations 0' })).toBeVisible();
});

test('round-trips local PNG artwork through storage, customization, and ZIP export', async ({ page }) => {
  await page.goto('/'); await expect(page.getByLabel('Live ball arena')).toBeVisible();
  const artwork = await page.getByLabel('Live ball arena').screenshot();
  const character = JSON.parse(readFileSync('templates/character/character.json', 'utf8'));
  character.id = 'test:artwork'; character.name = 'Artwork Ball'; character.appearance.body = 'assets/body.png';
  await page.getByLabel('Import character pack').setInputFiles({ name: 'artwork.zip', mimeType: 'application/zip', buffer: Buffer.from(zipSync({ 'character.json': strToU8(JSON.stringify(character)), 'assets/body.png': artwork })) });
  await expect(page.getByRole('status')).toContainText('Artwork Ball saved');
  await page.getByRole('button', { name: 'Customize', exact: true }).click();
  await expect(page.locator('.editor-preview img')).toBeVisible();
  await page.getByRole('button', { name: 'Save & use ball' }).click();
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export ball', exact: true }).click();
  const download = await downloadPromise; const exported = unzipSync(readFileSync((await download.path())!));
  expect(Buffer.from(exported['assets/body.png']).equals(artwork)).toBe(true);
  await page.reload(); await page.getByRole('button', { name: 'My creations 1' }).click();
  await expect(page.getByRole('button', { name: 'Assign Artwork Ball to A' }).locator('img')).toBeVisible();
});

test('records advancing 720px frames with sound and downloads a playable arena video', async ({ page }) => {
  await page.goto('/'); await expect(page.getByLabel('Live ball arena')).toBeVisible();
  await page.getByRole('button', { name: 'Enable arena sound' }).click();
  await page.getByRole('button', { name: 'Record round', exact: true }).click();
  await expect(page.locator('.record-note')).toContainText('press Run');
  await expect(page.locator('.simulation-status')).toHaveText('Ready to collide');
  await page.waitForTimeout(250);
  await expect(page.getByRole('button', { name: 'Stop recording', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByRole('button', { name: /Stop recording/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Create a new ball', exact: true })).toBeDisabled();
  await page.waitForTimeout(2200);
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: /Stop recording/ }).click();
  const download = await downloadPromise; const path = await download.path(); expect(path).toBeTruthy();
  const bytes = readFileSync(path!); expect(bytes.length).toBeGreaterThan(5000);
  // Decode the actual exported file, inspect two frames, and verify an audio track.
  const videoData = `data:video/webm;base64,${bytes.toString('base64')}`;
  const result = await page.evaluate(async data => {
    const video = document.createElement('video'); video.muted = true; video.src = data;
    await new Promise<void>((resolve, reject) => { video.onloadeddata = () => resolve(); video.onerror = () => reject(new Error('Downloaded video did not decode')); });
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 720; const ctx = canvas.getContext('2d')!;
    const frame = async (t: number) => { video.currentTime = t; await new Promise<void>(resolve => { video.onseeked = () => resolve(); }); ctx.drawImage(video, 0, 0); return canvas.toDataURL(); };
    const first = await frame(.2), later = await frame(1.2);
    return { width: video.videoWidth, height: video.videoHeight, first, later };
  }, videoData);
  expect(result.width).toBe(720); expect(result.height).toBe(720); expect(result.first).not.toBe(result.later);
  const png = PNG(Buffer.from(result.later.split(',')[1], 'base64'));
  expect(png.uniqueColors).toBeGreaterThan(100);
  // EBML contains the Opus codec identifier when the synthesized audio track is muxed.
  expect(bytes.includes(Buffer.from('A_OPUS'))).toBe(true);
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await page.getByRole('button', { name: 'Reset arena' }).click();
  await page.screenshot({ path: 'test-results/arena-desktop.png', fullPage: true });
});

test('automatically downloads a silent completed round with a result tail', async ({ page }) => {
  const character = JSON.parse(readFileSync('templates/character/character.json', 'utf8'));
  character.id = 'test:glass'; character.name = 'Glass'; character.stats.maxHp = 1; character.stats.contactDamage = 200; character.skills = [];
  await page.goto('/'); await expect(page.getByLabel('Live ball arena')).toBeVisible();
  await page.getByLabel('Import character pack').setInputFiles({ name: 'glass.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(character)) });
  await expect(page.getByRole('status')).toContainText('Glass saved');
  const downloadPromise = page.waitForEvent('download', { timeout: 40_000 });
  await page.getByRole('button', { name: 'Record round', exact: true }).click();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  const download = await downloadPromise; const bytes = readFileSync((await download.path())!);
  expect(bytes.length).toBeGreaterThan(5000); expect(bytes.includes(Buffer.from('A_OPUS'))).toBe(false);
  await expect(page.getByRole('button', { name: 'Download last recording', exact: true })).toBeVisible();
  await expect(page.locator('.simulation-status')).toHaveText('Round complete');
});

test('places health above and below the arena and persists the on-character health toggle', async ({ page }) => {
  await page.goto('/'); const canvas = page.getByLabel('Live ball arena');
  await expect(canvas).toBeVisible();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const bounds = await canvas.boundingBox();
  const above = await page.locator('[data-contender="1"]').boundingBox();
  const below = await page.locator('[data-contender="0"]').boundingBox();
  expect(above!.y + above!.height).toBeLessThan(bounds!.y);
  expect(below!.y).toBeGreaterThan(bounds!.y + bounds!.height);
  const numbersOn = await canvas.screenshot();
  await page.getByRole('button', { name: 'Simulation settings', exact: true }).click();
  const toggle = page.getByRole('checkbox', { name: 'Show health on characters' });
  await expect(toggle).toBeChecked(); await toggle.uncheck();
  await expect.poll(async () => (await canvas.screenshot()).equals(numbersOn)).toBe(false);
  await expect(page.getByRole('progressbar', { name: 'Contender A health' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Contender B health' })).toBeVisible();
  await toggle.check();
  await expect.poll(async () => (await canvas.screenshot()).equals(numbersOn)).toBe(true);
  await toggle.uncheck(); await page.reload();
  await page.getByRole('button', { name: 'Simulation settings', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Show health on characters' })).not.toBeChecked();
  await page.getByRole('button', { name: 'Simulation settings', exact: true }).click();
  await page.screenshot({ path: 'test-results/arena-health-layout.png', fullPage: true });
  await page.setViewportSize({ width: 820, height: 844 });
  const compactCanvas = await canvas.boundingBox(), compactAbove = await page.locator('[data-contender="1"]').boundingBox(), compactBelow = await page.locator('[data-contender="0"]').boundingBox();
  expect(compactAbove!.y + compactAbove!.height).toBeLessThan(compactCanvas!.y);
  expect(compactBelow!.y).toBeGreaterThan(compactCanvas!.y + compactCanvas!.height);
  const sidebar = await page.getByRole('complementary', { name: 'Character and simulation controls' }).boundingBox();
  expect(sidebar!.x).toBeGreaterThanOrEqual(compactCanvas!.x + compactCanvas!.width);
  await page.screenshot({ path: 'test-results/arena-health-compact.png', fullPage: true });
});

test('records a fixed 9:16 composition with health panels across a viewport resize', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.getByLabel('Live ball arena')).toBeVisible();
  await page.getByRole('button', { name: 'Simulation settings', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Show health on characters' }).uncheck();
  await page.getByRole('button', { name: 'Simulation settings', exact: true }).click();
  await page.getByRole('combobox', { name: 'Recording format', exact: true }).selectOption('portrait');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Recording format', exact: true })).toHaveValue('portrait');
  await page.getByRole('button', { name: 'Assign Meteorion to A', exact: true }).click();
  await page.getByRole('button', { name: /B Sawblade/ }).click();
  await page.getByRole('button', { name: 'Assign Prism to B', exact: true }).click();
  await expect(page.locator('[data-contender="0"] .contender-name')).toContainText('Meteorion');
  await expect(page.locator('[data-contender="1"] .contender-name')).toContainText('Prism');
  await page.getByRole('button', { name: 'Record round', exact: true }).click();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Recording format', exact: true })).toBeDisabled();
  await page.waitForTimeout(4200);
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(1700);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Stop recording/ }).click();
  const download = await downloadPromise; expect(download.suggestedFilename()).toContain('720x1280');
  const bytes = readFileSync((await download.path())!);
  const decoded = await page.evaluate(async data => {
    const video = document.createElement('video'); video.muted = true; video.src = data;
    await new Promise<void>((resolve, reject) => { video.onloadeddata = () => resolve(); video.onerror = () => reject(new Error('Portrait video did not decode')); });
    const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 1280; const ctx = canvas.getContext('2d')!;
    const frame = async (time: number) => { video.currentTime = time; await new Promise<void>(resolve => video.onseeked = () => resolve()); ctx.drawImage(video, 0, 0); return canvas.toDataURL(); };
    const first = await frame(.2), later = await frame(4.65);
    const pixel = (x: number, y: number) => Array.from(ctx.getImageData(x, y, 1, 1).data);
    return { width: video.videoWidth, height: video.videoHeight, first, later, topHealth: pixel(150, 237), bottomHealth: pixel(150, 1115) };
  }, `data:video/webm;base64,${bytes.toString('base64')}`);
  expect(decoded.width).toBe(720); expect(decoded.height).toBe(1280); expect(decoded.first).not.toBe(decoded.later);
  // Both colored health bars remain in the portrait, even with ball numbers hidden.
  expect(decoded.topHealth[0]).toBeGreaterThan(130); expect(decoded.topHealth[1]).toBeGreaterThan(80);
  expect(decoded.bottomHealth[1]).toBeGreaterThan(130); expect(decoded.bottomHealth[2]).toBeGreaterThan(100);
  expect(PNG(Buffer.from(decoded.later.split(',')[1], 'base64')).uniqueColors).toBeGreaterThan(100);
  writeFileSync('test-results/portrait-frame.png', Buffer.from(decoded.later.split(',')[1], 'base64'));
  await page.screenshot({ path: 'test-results/arena-recording-narrow-window.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('health panels show simulation-driven skill cooldowns, pause, and bounce requirements', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
  await expect(page.locator('.roster-card img')).toHaveCount(15);
  await page.getByRole('button', { name: 'Assign Dartling to A', exact: true }).click();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  const panel = page.locator('[data-contender="0"]');
  await expect(panel.locator('.skill-live-heading')).toContainText('to shot');
  const progress = panel.getByRole('progressbar', { name: 'Dart Shot readiness for A' });
  const initial = Number(await progress.getAttribute('aria-valuenow'));
  await expect.poll(async () => Number(await progress.getAttribute('aria-valuenow'))).toBeGreaterThan(initial + 5);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.locator('.simulation-status')).toHaveText('Paused');
  await page.waitForTimeout(120); const pausedText = await panel.locator('.live-skills').innerText();
  await page.waitForTimeout(300); expect(await panel.locator('.live-skills').innerText()).toBe(pausedText);
  await page.screenshot({ path: 'test-results/unity-skill-hud.png', fullPage: true });
  await page.getByRole('button', { name: 'Assign Magnetron to A', exact: true }).click();
  await expect(panel.locator('.skill-live-heading')).toContainText('WALL BOUNCES');
  await page.getByRole('button', { name: 'Assign Mallet to A', exact: true }).click();
  await expect(panel.locator('.skill-live-heading')).toContainText('to power');
  await expect(panel.locator('.skill-live-detail')).toContainText('Puck 8 · power 24');
});

test('all three skill indicators fit around the arena and remain visible', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.getByRole('button', { name: 'Create a new ball', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Three Skills');
  await page.getByRole('button', { name: 'Add a skill', exact: true }).click();
  await page.getByLabel('Skill 2 type').selectOption('shield');
  await page.getByRole('button', { name: 'Add a skill', exact: true }).click();
  await page.getByLabel('Skill 3 type').selectOption('beam');
  await page.getByRole('button', { name: 'Save & use ball', exact: true }).click();
  await expect(page.locator('[data-contender="0"] .live-skill')).toHaveCount(3);
  await expect(page.getByRole('progressbar', { name: 'Dart Shot readiness for A' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Aegis readiness for A' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Refraction readiness for A' })).toBeVisible();
  const canvas = await page.getByLabel('Live ball arena').boundingBox(), lower = await page.locator('[data-contender="0"]').boundingBox();
  expect(lower!.y).toBeGreaterThan(canvas!.y + canvas!.height);
  expect(lower!.y + lower!.height).toBeLessThan(800);
  expect(errors).toEqual([]);
});

test('Dartling artwork faces its target and Embertrail renders visible Unity flames', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
  const result = await page.evaluate(async () => {
    const arenaModule = '/src/rendering/arena.ts', engineModule = '/src/simulation/engine.ts', catalogModule = '/src/content/catalog.ts';
    const [{ ArenaView }, { Simulation }, { catalog, builtinMedia }] = await Promise.all([import(arenaModule), import(engineModule), import(catalogModule)]);
    const host = document.createElement('div'); document.body.appendChild(host);
    const view = new ArenaView(); await view.init(host);
    const media: Record<string, string> = {};
    for (const [id, files] of Object.entries(builtinMedia)) for (const [path, url] of Object.entries(files as Record<string, string>)) media[id + '/' + path] = url;
    await view.setMedia(media);
    const definition = (name: string) => catalog.find((c: { id: string }) => c.id === 'core:' + name);
    const sim = new Simulation([definition('dartling'), definition('bumper')], { seed: 'visual-aim', shrink: false, timeout: 180 });
    const [dart, target] = sim.fighters;
    const place = (fighter: Fighter, x: number, y: number) => { fighter.body.setPosition({ x, y }); fighter.previous = { x, y }; };
    place(dart, 0, 0);
    const sample = document.createElement('canvas'); sample.width = sample.height = 720; const ctx = sample.getContext('2d')!;
    const pixels = () => { ctx.drawImage(view.canvas, 0, 0); return ctx.getImageData(0, 0, 720, 720).data; };
    // The gold muzzle tip extends beyond the round shell. Sample the actual
    // rendered tip in all four directions, including through the firing lock.
    const muzzle = (dx: number, dy: number) => {
      const data = pixels(); let bright = 0;
      for (let r = 52; r <= 56; r++) for (let offset = -2; offset <= 2; offset++) {
        const x = Math.round(360 + dx * r + dy * offset), y = Math.round(360 - dy * r + dx * offset), i = (y * 720 + x) * 4;
        if (data[i] > 120 && data[i + 1] > 65 && data[i] > data[i + 2] * 1.1) bright++;
      }
      return bright;
    };
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]], tips: number[] = [];
    for (const [x, y] of directions) { place(target, x * 1.6, y * 1.6); view.render(sim, 'dark', 1, false); tips.push(muzzle(x, y)); }
    dart.skills[0].flash = .18; dart.skills[0].aim = { x: 1, y: 0 }; place(target, -1.6, 0);
    view.render(sim, 'dark', 1, false); const held = muzzle(1, 0);
    dart.skills[0].flash = 0; view.render(sim, 'dark', 1, false); const tracking = muzzle(-1, 0);
    const floatingLabels = view.app.stage.children.flatMap((child: { children?: { text?: string }[] }) => child.children?.map(c => c.text).filter(t => t === 'A' || t === 'B') ?? []);

    const fire = new Simulation([definition('embertrail'), definition('dartling')], { seed: 'visible-fire', shrink: false, timeout: 180 });
    const ember = fire.fighters[0]; fire.start();
    for (let tick = 0; tick < 60; tick++) {
      place(ember, -1.9 + tick * .06, -.7); ember.body.setLinearVelocity({ x: 0, y: 0 });
      place(fire.fighters[1], .8, 1.2); fire.fighters[1].body.setLinearVelocity({ x: 0, y: 0 }); fire.step();
    }
    fire.pause(); view.render(fire, 'dark', 1, false);
    const data = pixels(); let brightFire = 0;
    for (let y = 425; y < 462; y++) for (let x = 135; x < 500; x++) {
      const i = (y * 720 + x) * 4;
      if (data[i] > 170 && data[i + 1] > 35 && data[i + 1] < 195 && data[i + 2] < 95) brightFire++;
    }
    const before = pixels(); await new Promise(resolve => setTimeout(resolve, 100)); view.render(fire, 'dark', 1, false);
    const after = pixels(); let movingPixels = 0;
    // Repeated WebGL rasterization can quantize a few antialiased edge pixels
    // by up to four channel levels. Detect actual movement, not PNG equality.
    for (let i = 0; i < before.length; i += 4) if (Math.max(Math.abs(before[i] - after[i]), Math.abs(before[i + 1] - after[i + 1]), Math.abs(before[i + 2] - after[i + 2])) > 5) movingPixels++;
    const paused = movingPixels <= 8, frame = view.canvas.toDataURL();
    view.render(fire, 'light', 1, false); const light = view.canvas.toDataURL();
    const segments = fire.zones.length; view.dispose(); host.remove();
    return { tips, held, tracking, floatingLabels, brightFire, paused, segments, frame, light };
  });
  for (const tip of [...result.tips, result.held, result.tracking]) expect(tip).toBeGreaterThan(3);
  expect(result.floatingLabels).toEqual([]); expect(result.segments).toBeGreaterThan(5);
  expect(result.brightFire).toBeGreaterThan(2000); expect(result.paused).toBe(true);
  writeFileSync('test-results/embertrail-unity-dark.png', Buffer.from(result.frame.split(',')[1], 'base64'));
  writeFileSync('test-results/embertrail-unity-light.png', Buffer.from(result.light.split(',')[1], 'base64'));
  expect(errors).toEqual([]);
});
