import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('supplied champion portraits, exactly three skills, customization and manual launch work in the app', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Assign Aatrox to A', exact: true }).click();
  await page.getByRole('button', { name: /B Sawblade/ }).click(); await page.getByRole('button', { name: 'Assign Ekko to B', exact: true }).click();
  for (const index of [0, 1]) await expect(page.locator(`[data-contender="${index}"] .live-skill`)).toHaveCount(3);
  await expect(page.locator('[data-contender="0"] .contender-select img')).toHaveAttribute('src', /aatrox\/assets\/body/);
  await expect(page.locator('[data-contender="1"] .contender-select img')).toHaveAttribute('src', /ekko\/assets\/body/);
  await expect(page.locator('[data-contender="0"] .skill-live-heading')).toContainText(['Q · The Darkin Blade', 'W · Infernal Chains', 'R · World Ender']);
  await expect(page.locator('[data-contender="1"] .skill-live-heading')).toContainText(['Q · Timewinder', 'E · Phase Dive', 'R · Chronobreak']);
  for (const index of [0, 1]) {
    const panel = page.locator(`[data-contender="${index}"]`);
    expect((await panel.boundingBox())!.width).toBeGreaterThanOrEqual(340);
  }
  await expect(page.locator('.simulation-status')).toHaveText('Ready to collide');
  await page.getByRole('button', { name: /A Aatrox/ }).click(); await page.getByRole('button', { name: 'Customize', exact: true }).click();
  await expect(page.getByLabel('Skill 1 type')).toHaveValue('darkin-blade'); await expect(page.getByLabel('Skill 3 type')).toHaveValue('world-ender');
  await expect(page.getByRole('button', { name: 'All three skill slots filled' })).toBeDisabled(); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.screenshot({ path: 'test-results/league-roster.png', fullPage: true });
  await page.getByRole('button', { name: 'Run', exact: true }).click(); await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
  await page.waitForTimeout(800); await page.getByRole('button', { name: 'Pause', exact: true }).click();
  expect(errors).toEqual([]);
});

test('all six abilities have distinct animated canvas effects and stay frozen when paused', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
  const results = await page.evaluate(async () => {
    const paths = ['/src/rendering/arena.ts', '/src/simulation/engine.ts', '/src/content/catalog.ts', '/src/skills/champions.ts'];
    const [{ ArenaView }, { Simulation }, { catalog, builtinMedia }, { championState, darkinShape }] = await Promise.all(paths.map(path => import(path)));
    const host = document.createElement('div'); document.body.appendChild(host); const view = new ArenaView(); await view.init(host);
    const media: Record<string, string> = {}; for (const [id, files] of Object.entries(builtinMedia)) for (const [path, url] of Object.entries(files as Record<string, string>)) media[id + '/' + path] = url;
    await view.setMedia(media);
    const load = (name: string) => structuredClone(catalog.find((c: { id: string }) => c.id === 'core:' + name));
    const sample = document.createElement('canvas'); sample.width = sample.height = 720; const ctx = sample.getContext('2d')!;
    const pixels = () => { ctx.drawImage(view.canvas, 0, 0); return ctx.getImageData(0, 0, 720, 720).data; };
    const changed = (a: Uint8ClampedArray, b: Uint8ClampedArray) => { let count = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 15) count++; return count; };
    const gallery = document.createElement('canvas'); gallery.width = 1080; gallery.height = 1040; const board = gallery.getContext('2d')!; board.fillStyle = '#14121b'; board.fillRect(0, 0, 1080, 1040);
    const cases = ['Q1 windup', 'Q2 windup', 'Q3 slam', 'W chain trap', 'R World Ender', 'Q Timewinder', 'Q slowing field', 'E Phase Dive', 'R Chronobreak'];
    const results: { name: string; visible: number; animated: number; frozen: boolean }[] = [];
    for (const [index, name] of cases.entries()) {
      const aatrox = index < 5, actor = load(aatrox ? 'aatrox' : 'ekko'), other = load(aatrox ? 'ekko' : 'aatrox');
      const type = index < 3 ? 'darkin-blade' : index === 3 ? 'infernal-chains' : index === 4 ? 'world-ender' : index < 7 ? 'timewinder' : index === 7 ? 'phase-dive' : 'chronobreak';
      actor.skills = actor.skills.filter((s: { type: string }) => s.type === type); other.skills = [];
      const sim = new Simulation([actor, other], { seed: 'champion-visual', shrink: false, timeout: 60 }); sim.start(); sim.pause(); sim.elapsed = 5;
      const [self, target] = sim.fighters; self.body.setPosition({ x: -.7, y: 0 }); self.previous = { x: -.7, y: 0 }; target.body.setPosition({ x: 1.1, y: .15 }); target.previous = { x: 1.1, y: .15 };
      view.render(sim, 'dark', 1, true); const idle = pixels(), state = self.skills[0], data = championState(state);
      state.aim = { x: 1, y: 0 };
      if (index < 2) { state.targeting = true; data.mode = 'windup'; data.stage = index + 1; data.timer = .22; }
      if (index === 2) { data.stage = 3; data.strike = darkinShape(self.body.getPosition(), state.aim, 3, actor.skills[0].range); state.flash = .25; }
      if (index === 3) { data.mode = 'tether'; data.anchor = { x: 1.1, y: .15 }; state.active = 1; }
      if (index === 4) { state.active = 5; state.flash = .3; }
      if (index === 5 || index === 6) data.device = { at: { x: .35, y: .5 }, previous: { x: .35, y: .5 }, aim: { x: 1, y: 0 }, travel: 1, phase: index === 5 ? 'outbound' : 'field', timer: .3, outboundHit: false, returnHit: false };
      if (index === 7) { data.mode = 'dash'; data.origin = { x: -1.8, y: -.6 }; data.timer = .12; }
      if (index === 8) { data.anchor = { x: -.7, y: 0 }; data.trace = [{ x: -1.7, y: -.8 }, { x: -.6, y: -.5 }, { x: .3, y: .6 }, { x: -.7, y: 0 }]; state.flash = .5; }
      view.render(sim, 'dark', 1, true); const active = pixels(); await new Promise(resolve => setTimeout(resolve, 50)); view.render(sim, 'dark', 1, true); const frozen = changed(active, pixels()) <= 8;
      const x = index % 3 * 360, y = Math.floor(index / 3) * 346; board.drawImage(view.canvas, x + 20, y + 25, 320, 320); board.fillStyle = '#e9e2f2'; board.font = '14px Arial'; board.fillText(name, x + 28, y + 20);
      sim.elapsed += .08; state.flash = Math.max(0, state.flash - .08); data.timer = Math.max(0, data.timer - .08);
      if (index === 7) { data.origin.x += .15; }
      view.render(sim, 'dark', 1, true); results.push({ name, visible: changed(idle, active), animated: changed(active, pixels()), frozen });
    }
    const galleryImage = gallery.toDataURL(); view.dispose(); host.remove(); return { results, galleryImage };
  });
  writeFileSync('test-results/league-ability-gallery.png', Buffer.from(results.galleryImage.split(',')[1], 'base64'));
  for (const result of results.results) { expect(result.visible, result.name).toBeGreaterThan(100); expect(result.animated, result.name).toBeGreaterThan(5); expect(result.frozen, result.name).toBe(true); }
});

test('both full kits and all six HUD rows survive an actual portrait video recording', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
  const result = await page.evaluate(async () => {
    const paths = ['/src/rendering/arena.ts', '/src/simulation/engine.ts', '/src/content/catalog.ts', '/src/recording/portrait.ts', '/tests/browser/mp4-fixture.ts'];
    const [{ ArenaView }, { Simulation }, { catalog, builtinMedia }, { PortraitRecording }, { recordFixture, decodeFixture }] = await Promise.all(paths.map(path => import(path)));
    const host = document.createElement('div'); document.body.appendChild(host); const view = new ArenaView(); await view.init(host);
    const media: Record<string, string> = {}; for (const [id, files] of Object.entries(builtinMedia)) for (const [path, url] of Object.entries(files as Record<string, string>)) media[id + '/' + path] = url;
    await view.setMedia(media);
    const characters = ['aatrox', 'ekko'].map(name => { const c = structuredClone(catalog.find((c: { id: string }) => c.id === 'core:' + name)); c.stats.maxHp = 2000; return c; });
    const sim = new Simulation(characters, { seed: 'league-recording', shrink: false, timeout: 60, launchAngles: [45, 225] }), portrait = new PortraitRecording(); sim.start();
    for (let tick = 0; tick < 520; tick++) sim.step();
    const blob = await recordFixture(view, sim, portrait), { frame, width, height, bytes } = await decodeFixture(blob);
    const activations = sim.fighters.map((f: { skills: { activations: number }[] }) => f.skills.map(s => s.activations));
    view.dispose(); host.remove(); return { frame, width, height, bytes, activations };
  });
  expect(result.width).toBe(720); expect(result.height).toBe(1280); expect(result.bytes).toBeGreaterThan(10000);
  for (const skills of result.activations) for (const count of skills) expect(count).toBeGreaterThan(0);
  writeFileSync('test-results/league-portrait.png', Buffer.from(result.frame.split(',')[1], 'base64')); expect(errors).toEqual([]);
});
