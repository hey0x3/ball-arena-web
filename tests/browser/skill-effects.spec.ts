import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('each skill has visible activation feedback that animates on simulation time and freezes on pause', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
  const results = await page.evaluate(async () => {
    const paths = ['/src/rendering/arena.ts', '/src/simulation/engine.ts', '/src/content/catalog.ts', '/src/simulation/geometry.ts'];
    const [{ ArenaView }, { Simulation }, { catalog, builtinMedia }, { buildBeamPath }] = await Promise.all(paths.map(path => import(path)));
    const host = document.createElement('div'); document.body.appendChild(host);
    const view = new ArenaView(); await view.init(host);
    const media: Record<string, string> = {};
    for (const [id, files] of Object.entries(builtinMedia)) for (const [path, url] of Object.entries(files as Record<string, string>)) media[id + '/' + path] = url;
    await view.setMedia(media);
    const definition = (name: string) => structuredClone(catalog.find((c: { id: string }) => c.id === 'core:' + name));
    const sample = document.createElement('canvas'); sample.width = sample.height = 720; const ctx = sample.getContext('2d')!;
    const pixels = () => { ctx.drawImage(view.canvas, 0, 0); return ctx.getImageData(0, 0, 720, 720).data; };
    const changed = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
      let count = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 12) count++;
      return count;
    };
    const results: { name: string; visible: number; animated: number; frozen: boolean; readOnly: boolean; frame: string }[] = [];
    for (const name of ['bumper', 'sawblade', 'dartling', 'bulwark', 'magnetron', 'prism', 'meteorion', 'mallet']) {
      const opponent = definition('bumper'); opponent.skills = [];
      const sim = new Simulation([definition(name), opponent], { seed: 'skill-fx', shrink: false, timeout: 180 });
      sim.start(); sim.pause(); sim.elapsed = 4;
      const f = sim.fighters[0], target = sim.fighters[1], state = f.skills[0], skill = f.definition.skills[0];
      f.body.setPosition({ x: -.5, y: 0 }); f.previous = { x: -.5, y: 0 }; f.body.setLinearVelocity({ x: 11, y: 0 });
      target.body.setPosition({ x: 1.5, y: 1.25 }); target.previous = { x: 1.5, y: 1.25 };
      view.render(sim, 'dark', 1, true); const idle = pixels();
      switch (name) {
        case 'bumper': state.charges = 3; break;
        case 'sawblade': state.flash = .14; break;
        case 'dartling': state.flash = .16; state.aim = { x: 1, y: 0 }; break;
        case 'bulwark': state.capacity = 25; f.shield = 25; state.active = 2.8; state.flash = .15; break;
        case 'magnetron': state.active = 1; state.lastForce = 8; break;
        case 'prism': state.flash = .17; state.path = buildBeamPath(f.body.getPosition(), { x: 1, y: .3 }, 16, 2, sim.half); sim.beam(f, skill, { x: 1, y: .3 }); break;
        case 'meteorion': state.active = .5; state.aim = { x: 1, y: 0 }; break;
        case 'mallet': state.cooldown = 0; break;
      }
      const stateBefore = JSON.stringify({ skills: f.skills, hp: f.hp, v: f.body.getLinearVelocity() });
      view.render(sim, 'dark', 1, true); const active = pixels(), frame = view.canvas.toDataURL();
      await new Promise(resolve => setTimeout(resolve, 50)); view.render(sim, 'dark', 1, true);
      // Ignore sub-visible WebGL edge quantization while checking paused motion.
      const frozen = changed(active, pixels()) <= 8;
      const readOnly = JSON.stringify({ skills: f.skills, hp: f.hp, v: f.body.getLinearVelocity() }) === stateBefore;
      sim.elapsed += .08; view.render(sim, 'dark', 1, true);
      results.push({ name, visible: changed(idle, active), animated: changed(active, pixels()), frozen, readOnly, frame });
    }
    view.dispose(); host.remove(); return results;
  });
  for (const result of results) {
    if (['meteorion', 'magnetron', 'bulwark'].includes(result.name)) writeFileSync(`test-results/${result.name}-skill-fx.png`, Buffer.from(result.frame.split(',')[1], 'base64'));
    expect(result.visible, result.name + ' activation feedback').toBeGreaterThan(100);
    expect(result.animated, result.name + ' animated feedback').toBeGreaterThan(5);
    expect(result.frozen, result.name + ' pause').toBe(true);
    expect(result.readOnly, result.name + ' renderer leaves combat untouched').toBe(true);
  }
  expect(errors).toEqual([]);
});
