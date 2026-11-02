import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('Pudge appears in the roster with three editable skills and waits for Run', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Assign Pudge to A', exact: true }).click();
  await expect(page.locator('[data-contender="0"] .skill-live-heading')).toContainText(['Q · Meat Hook', 'W · Rot', 'R · Dismember']);
  await expect(page.locator('[data-contender="0"] .contender-select img')).toHaveAttribute('src', /pudge\/assets\/body/);
  await expect(page.locator('.simulation-status')).toHaveText('Ready to collide');
  await page.getByRole('button', { name: 'Customize', exact: true }).click();
  await expect(page.getByLabel('Skill 1 type')).toHaveValue('meat-hook'); await expect(page.getByLabel('Skill 2 type')).toHaveValue('rot'); await expect(page.getByLabel('Skill 3 type')).toHaveValue('dismember');
  await expect(page.getByLabel('Self-damage per tick (non-lethal)')).toHaveValue('2');
  await expect(page.getByRole('button', { name: 'All three skill slots filled' })).toBeDisabled(); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.screenshot({ path: 'test-results/pudge-roster.png', fullPage: true });
  await page.getByRole('button', { name: 'Run', exact: true }).click(); await page.waitForTimeout(500); await page.getByRole('button', { name: 'Pause', exact: true }).click(); expect(errors).toEqual([]);
});

test('Pudge hook, cloud and jaws have visible animated effects that freeze on pause', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
  const result = await page.evaluate(async () => {
    const paths = ['/src/rendering/arena.ts', '/src/simulation/engine.ts', '/src/content/catalog.ts', '/src/skills/pudge.ts'];
    const [{ ArenaView }, { Simulation }, { catalog, builtinMedia }, { pudgeState }] = await Promise.all(paths.map(path => import(path)));
    const host = document.createElement('div'); document.body.appendChild(host); const view = new ArenaView(); await view.init(host);
    const media: Record<string, string> = {}; for (const [id, files] of Object.entries(builtinMedia)) for (const [path, url] of Object.entries(files as Record<string, string>)) media[id + '/' + path] = url;
    await view.setMedia(media);
    const load = (name: string) => structuredClone(catalog.find((c: { id: string }) => c.id === 'core:' + name));
    const sample = document.createElement('canvas'); sample.width = sample.height = 720; const ctx = sample.getContext('2d')!;
    const pixels = () => { ctx.drawImage(view.canvas, 0, 0); return ctx.getImageData(0, 0, 720, 720).data; };
    const changed = (a: Uint8ClampedArray, b: Uint8ClampedArray) => { let count = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 15) count++; return count; };
    const gallery = document.createElement('canvas'); gallery.width = 1080; gallery.height = 720; const board = gallery.getContext('2d')!; board.fillStyle = '#14121b'; board.fillRect(0, 0, gallery.width, gallery.height);
    const cases = ['Hook windup', 'Flying hook + chain', 'Reeling the target', 'Rot cloud', 'Dismember jaws', 'Rot + Dismember'];
    const checks: { name: string; visible: number; animated: number; frozen: boolean }[] = [];
    for (const [i, name] of cases.entries()) {
      const p = load('pudge'), enemy = load('ekko'); enemy.skills = []; const types = i < 3 ? ['meat-hook'] : i === 3 ? ['rot'] : i === 4 ? ['dismember'] : ['rot', 'dismember']; p.skills = p.skills.filter((s: { type: string }) => types.includes(s.type));
      const sim = new Simulation([p, enemy], { seed: 'pudge-effects', shrink: false, timeout: 60 }); sim.start(); sim.pause(); sim.elapsed = 9.5;
      const [self, target] = sim.fighters; self.body.setPosition({ x: -1.2, y: 0 }); self.previous = { x: -1.2, y: 0 }; target.body.setPosition({ x: i < 3 ? 1.1 : -.1, y: .15 }); target.previous = { ...target.body.getPosition() };
      view.render(sim, 'dark', 1, false); const idle = pixels();
      self.definition.skills.forEach((skill: { type: string }, index: number) => {
        const state = self.skills[index], data = pudgeState(state); data.aim = { x: 1, y: 0 }; data.origin = { ...self.body.getPosition() };
        if (skill.type === 'meat-hook') { data.mode = i === 0 ? 'windup' : i === 1 ? 'outbound' : 'reeling'; data.at = { x: .65, y: 0 }; data.previous = { ...data.at }; data.timer = .1; }
        if (skill.type === 'rot') state.active = 1;
        if (skill.type === 'dismember') { data.mode = 'channel'; state.active = 2; state.flash = .2; }
      });
      view.render(sim, 'dark', 1, false); const active = pixels(); await new Promise(resolve => setTimeout(resolve, 40)); view.render(sim, 'dark', 1, false); const frozen = changed(active, pixels()) <= 8;
      const x = i % 3 * 360, y = Math.floor(i / 3) * 360; board.drawImage(view.canvas, x + 20, y + 28, 320, 320); board.fillStyle = '#e9e2f2'; board.font = '14px Arial'; board.fillText(name, x + 28, y + 21);
      sim.elapsed += .12; view.render(sim, 'dark', 1, false); checks.push({ name, visible: changed(idle, active), animated: changed(active, pixels()), frozen });
    }
    const frame = gallery.toDataURL(); view.dispose(); host.remove(); return { checks, frame };
  });
  writeFileSync('test-results/pudge-abilities.png', Buffer.from(result.frame.split(',')[1], 'base64'));
  for (const check of result.checks) { expect(check.visible, check.name).toBeGreaterThan(150); expect(check.animated, check.name).toBeGreaterThan(20); expect(check.frozen, check.name).toBe(true); }
});

test('all three Pudge skills and portrait HUD survive encoding and video playback', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
  const result = await page.evaluate(async () => {
    const paths = ['/src/rendering/arena.ts', '/src/simulation/engine.ts', '/src/content/catalog.ts', '/src/recording/portrait.ts', '/tests/browser/mp4-fixture.ts'];
    const [{ ArenaView }, { Simulation }, { catalog, builtinMedia }, { PortraitRecording }, { recordFixture, decodeFixture }] = await Promise.all(paths.map(path => import(path)));
    const host = document.createElement('div'); document.body.appendChild(host); const view = new ArenaView(); await view.init(host);
    const media: Record<string, string> = {}; for (const [id, files] of Object.entries(builtinMedia)) for (const [path, url] of Object.entries(files as Record<string, string>)) media[id + '/' + path] = url; await view.setMedia(media);
    const characters = ['pudge', 'aatrox'].map(name => structuredClone(catalog.find((c: { id: string }) => c.id === 'core:' + name))); characters[1].skills = []; characters[1].stats.contactDamage = 0;
    const sim = new Simulation(characters, { seed: 'pudge-recording', shrink: false, timeout: 60 }), portrait = new PortraitRecording(); sim.start();
    sim.fighters.forEach((f: { body: { setPosition: (p: { x: number; y: number }) => void; setLinearVelocity: (p: { x: number; y: number }) => void }; previous: { x: number; y: number } }, i: number) => { const at = { x: i ? 1.4 : -1.4, y: 0 }; f.body.setPosition(at); f.previous = { ...at }; f.body.setLinearVelocity({ x: 0, y: 0 }); sim.hold(f, 60); });
    for (let tick = 0; tick < 490; tick++) sim.step();
    const blob = await recordFixture(view, sim, portrait), { frame, width, height, bytes } = await decodeFixture(blob);
    const activations = sim.fighters[0].skills.map((s: { activations: number }) => s.activations);
    view.dispose(); host.remove(); return { frame, width, height, bytes, activations };
  });
  expect(result.width).toBe(720); expect(result.height).toBe(1280); expect(result.bytes).toBeGreaterThan(10000); for (const count of result.activations) expect(count).toBeGreaterThan(0);
  writeFileSync('test-results/pudge-portrait.png', Buffer.from(result.frame.split(',')[1], 'base64')); expect(errors).toEqual([]);
});
