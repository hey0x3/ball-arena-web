import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';

test('three icon cooldowns fit one compact health strip with mouse and keyboard details', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Assign Ahri to A', exact: true }).click();
  await page.locator('.slot-selector').getByRole('button', { name: 'B Sawblade', exact: true }).click(); await page.getByRole('button', { name: 'Assign Fizz to B', exact: true }).click();
  for (const index of [0, 1]) {
    const panel = page.locator(`[data-contender="${index}"]`); expect((await panel.boundingBox())!.height).toBeLessThan(85);
    await expect(panel.locator('.skill-art')).toHaveCount(3); await expect(panel.locator('.contender-select button')).toHaveCount(0);
    expect(await panel.locator('.skill-art').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    const tiles = await panel.locator('.skill-tile').all(); const boxes = await Promise.all(tiles.map(tile => tile.boundingBox())); expect(boxes[0]!.y).toBe(boxes[2]!.y);
  }
  const panel = page.locator('[data-contender="0"]'), q = panel.getByRole('button', { name: 'Inspect Q · Orb of Deception', exact: true });
  await q.hover(); await expect(panel.getByRole('tooltip')).toContainText('Orb of Deception'); await expect(panel.getByRole('tooltip')).toContainText('one hit per pass');
  await q.focus(); await page.keyboard.press('Escape'); await expect(panel.getByRole('tooltip')).toHaveCount(0);
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  const readiness = panel.getByRole('progressbar', { name: 'Q · Orb of Deception readiness for A', exact: true }); const initial = Number(await readiness.getAttribute('aria-valuenow'));
  await expect.poll(async () => Number(await readiness.getAttribute('aria-valuenow'))).toBeGreaterThan(initial + 5);
  await page.getByRole('button', { name: 'Pause', exact: true }).click(); await page.waitForTimeout(150); const text = await panel.locator('.skill-countdown').allTextContents(); await page.waitForTimeout(200); expect(await panel.locator('.skill-countdown').allTextContents()).toEqual(text);
  await page.locator('.sidebar-scroll').evaluate(element => { element.scrollTop = 0; }); await page.screenshot({ path: 'test-results/compact-hud-dark.png', fullPage: true });
  await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click(); await page.screenshot({ path: 'test-results/compact-hud-light.png', fullPage: true });
  for (const width of [1024, 820]) { await page.setViewportSize({ width, height: 800 }); const box = (await panel.boundingBox())!; expect(box.height).toBeLessThan(85); for (const tile of await panel.locator('.skill-tile').all()) { const bounds = (await tile.boundingBox())!; expect(bounds.x + bounds.width).toBeLessThanOrEqual(box.x + box.width); } }
  expect(errors).toEqual([]);
});

test('custom skill icons survive body replacement, storage, export and ZIP import', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Assign Ahri to A', exact: true }).click(); await page.getByRole('button', { name: 'Customize', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Icon Keeper');
  const replacement = readFileSync('content/characters/fizz/assets/body.png'), skill = readFileSync('content/characters/caitlyn/assets/skill-q.png');
  await page.locator('.character-editor > .upload-art input').setInputFiles({ name: 'body.png', mimeType: 'image/png', buffer: replacement });
  await page.getByLabel('Skill 1 icon', { exact: true }).setInputFiles({ name: 'skill.png', mimeType: 'image/png', buffer: skill });
  await page.getByRole('button', { name: 'Save & use ball', exact: true }).click();
  await expect(page.locator('.character-editor')).toHaveCount(0);
  await expect(page.locator('[data-contender="0"] .contender-name strong')).toHaveText('Icon Keeper');
  await expect(page.getByRole('button', { name: 'My creations 1', exact: true })).toBeVisible();
  await page.reload(); await page.getByRole('button', { name: 'My creations 1', exact: true }).click(); await page.getByRole('button', { name: 'Assign Icon Keeper to A', exact: true }).click();
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export ball', exact: true }).click(); const path = (await (await downloadPromise).path())!, files = unzipSync(readFileSync(path)), character = JSON.parse(strFromU8(files['character.json']));
  expect(Buffer.from(files[character.appearance.body]).equals(replacement)).toBe(true); expect(Buffer.from(files[character.skills[0].icon]).equals(skill)).toBe(true);
  expect(files[character.skills[1].icon].length).toBeGreaterThan(100); expect(files[character.skills[2].icon].length).toBeGreaterThan(100);
  await page.getByLabel('Import character pack').setInputFiles(path); await page.getByRole('button', { name: 'Keep both', exact: true }).click(); await expect(page.getByRole('button', { name: 'My creations 2', exact: true })).toBeVisible();
  expect(await page.locator('[data-contender="0"] .skill-art').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
});

test('square and portrait videos contain the center watermark and compact icon HUD', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
  const results = await page.evaluate(async () => {
    const paths = ['/src/rendering/arena.ts', '/src/simulation/engine.ts', '/src/content/catalog.ts', '/src/recording/portrait.ts', '/tests/browser/mp4-fixture.ts'];
    const [{ ArenaView }, { Simulation }, { catalog, builtinMedia }, { PortraitRecording }, { recordFixture, decodeFixture }] = await Promise.all(paths.map(path => import(path)));
    const host = document.createElement('div'); document.body.appendChild(host); const view = new ArenaView(); await view.init(host);
    const media: Record<string, string> = {}; for (const [id, files] of Object.entries(builtinMedia)) for (const [path, url] of Object.entries(files as Record<string, string>)) media[id + '/' + path] = url; await view.setMedia(media);
    const characters = ['ahri', 'fizz'].map(name => structuredClone(catalog.find((c: { id: string }) => c.id === 'core:' + name))), sim = new Simulation(characters, { seed: 'compact-capture', shrink: false, timeout: 60 }), portrait = new PortraitRecording(); sim.start(); sim.pause();
    const results: { width: number; height: number; ink: number; frame: string }[] = [];
    for (const index of [0, 1]) {
      const blob = await recordFixture(view, sim, index ? portrait : undefined);
      const { canvas, width, height, frame } = await decodeFixture(blob, .08), ctx = canvas.getContext('2d')!;
      const pixels = ctx.getImageData(190, index ? 624 : 330, 340, 60).data; let ink = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 40 && pixels[i] < 90 && pixels[i + 1] > 38) ink++;
      results.push({ width, height, ink, frame });
    }
    view.dispose(); host.remove(); return results;
  });
  for (const [index, result] of results.entries()) { expect(result.width).toBe(720); expect(result.height).toBe(index ? 1280 : 720); expect(result.ink).toBeGreaterThan(250); writeFileSync(`test-results/compact-recording-${index}.png`, Buffer.from(result.frame.split(',')[1], 'base64')); }
});
