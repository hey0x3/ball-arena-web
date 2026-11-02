import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('Ahri, Caitlyn and Fizz join League with separate portraits and three editable skills each', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
  await page.getByRole('group', { name: 'Character origins' }).getByRole('button', { name: 'League of Legends 5', exact: true }).click();
  await expect(page.locator('.roster-card')).toHaveCount(5);
  const kits = { Ahri: ['orb-of-deception', 'charm', 'spirit-rush'], Caitlyn: ['piltover-peacemaker', 'yordle-snap-trap', 'ace-in-the-hole'], Fizz: ['urchin-strike', 'playful-trickster', 'chum-the-waters'] };
  for (const [name, types] of Object.entries(kits)) {
    await page.getByRole('button', { name: `Assign ${name} to A`, exact: true }).click();
    await expect(page.locator('[data-contender="0"] .live-skill')).toHaveCount(3); await expect(page.locator('[data-contender="0"] .contender-select img')).toHaveAttribute('src', new RegExp(name.toLowerCase() + '/assets/body'));
    await expect(page.locator('.simulation-status')).toHaveText('Ready to collide');
    await page.getByRole('button', { name: 'Customize', exact: true }).click(); await expect(page.getByLabel('Character origin', { exact: true })).toHaveValue('League of Legends');
    for (const [i, type] of types.entries()) await expect(page.getByLabel(`Skill ${i + 1} type`)).toHaveValue(type);
    await expect(page.getByRole('button', { name: 'All three skill slots filled' })).toBeDisabled(); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  await page.screenshot({ path: 'test-results/league-expansion-roster.png', fullPage: true }); expect(errors).toEqual([]);
});

test('all nine new abilities have visible, distinct animations that freeze when paused', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
  const result = await page.evaluate(async () => {
    const paths = ['/src/rendering/arena.ts', '/src/simulation/engine.ts', '/src/content/catalog.ts', '/src/skills/league.ts'];
    const [{ ArenaView }, { Simulation }, { catalog, builtinMedia }, { leagueState }] = await Promise.all(paths.map(path => import(path)));
    const host = document.createElement('div'); document.body.appendChild(host); const view = new ArenaView(); await view.init(host);
    const media: Record<string, string> = {}; for (const [id, files] of Object.entries(builtinMedia)) for (const [path, url] of Object.entries(files as Record<string, string>)) media[id + '/' + path] = url; await view.setMedia(media);
    const load = (name: string) => structuredClone(catalog.find((c: { id: string }) => c.id === 'core:' + name));
    const sample = document.createElement('canvas'); sample.width = sample.height = 720; const ctx = sample.getContext('2d')!;
    const pixels = () => { ctx.drawImage(view.canvas, 0, 0); return ctx.getImageData(0, 0, 720, 720).data; };
    const changed = (a: Uint8ClampedArray, b: Uint8ClampedArray) => { let count = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 15) count++; return count; };
    const cases = [
      ['ahri', 'orb-of-deception', 'outbound', 'Ahri Q · orb outbound'], ['ahri', 'orb-of-deception', 'returning', 'Ahri Q · returning orb'], ['ahri', 'charm', 'charmed', 'Ahri E · heart + charm'], ['ahri', 'spirit-rush', 'dash', 'Ahri R · spirit tails + bolt'],
      ['caitlyn', 'piltover-peacemaker', 'windup', 'Caitlyn Q · rifle charge'], ['caitlyn', 'piltover-peacemaker', 'outbound', 'Caitlyn Q · piercing shot'], ['caitlyn', 'yordle-snap-trap', 'headshot', 'Caitlyn W · traps + headshot'], ['caitlyn', 'ace-in-the-hole', 'windup', 'Caitlyn R · target lock'],
      ['fizz', 'urchin-strike', 'dash', 'Fizz Q · trident dash'], ['fizz', 'playful-trickster', 'airborne', 'Fizz E · untargetable vault'], ['fizz', 'playful-trickster', 'splash', 'Fizz E · landing splash'], ['fizz', 'chum-the-waters', 'shark', 'Fizz R · shark eruption'],
    ];
    const gallery = document.createElement('canvas'); gallery.width = 1440; gallery.height = 1080; const board = gallery.getContext('2d')!; board.fillStyle = '#14121b'; board.fillRect(0, 0, gallery.width, gallery.height);
    const checks: { name: string; visible: number; animated: number; frozen: boolean }[] = [];
    for (const [i, [hero, type, mode, name]] of cases.entries()) {
      const actor = load(hero), enemy = load(hero === 'ahri' ? 'caitlyn' : 'ahri'); actor.skills = actor.skills.filter((s: { type: string }) => s.type === type); enemy.skills = [];
      const sim = new Simulation([actor, enemy], { seed: 'league-expansion-gallery', shrink: false, timeout: 60 }); sim.start(); sim.pause(); sim.elapsed = 10;
      const [self, target] = sim.fighters; self.body.setPosition({ x: -.8, y: 0 }); self.previous = { x: -.8, y: 0 }; target.body.setPosition({ x: 1.1, y: .1 }); target.previous = { x: 1.1, y: .1 };
      view.render(sim, 'dark', 1, false); const idle = pixels(), state = self.skills[0], d = leagueState(state);
      d.mode = mode; d.aim = { x: 1, y: 0 }; state.aim = { x: 1, y: 0 }; d.at = { x: .4, y: .1 }; d.previous = { x: .3, y: .1 }; d.origin = { x: -1.8, y: -.4 }; d.timer = .3; d.stage = 2; d.anchor = { ...target.body.getPosition() };
      d.trail = [{ x: -.4, y: .1 }, { x: -.2, y: .1 }, { x: 0, y: .1 }, { x: .2, y: .1 }];
      if (type === 'charm') state.active = .7;
      if (type === 'spirit-rush') { d.bolts = [{ at: { x: .3, y: .3 }, previous: { x: .2, y: .3 }, life: .5 }]; d.timer = .1; }
      if (type === 'yordle-snap-trap') d.traps = [{ at: { x: .1, y: .5 }, arm: 0, life: 5 }, { at: { x: .8, y: -.7 }, arm: .3, life: 5 }];
      if (mode === 'splash') { d.mode = 'idle'; state.flash = .4; }
      if (mode === 'shark') { d.mode = 'idle'; state.flash = .55; }
      if (mode === 'airborne') { state.active = .3; sim.setPhasing(self, .3); }
      view.render(sim, 'dark', 1, false); const active = pixels(); await new Promise(resolve => setTimeout(resolve, 40)); view.render(sim, 'dark', 1, false); const frozen = changed(active, pixels()) <= 8;
      const x = i % 4 * 360, y = Math.floor(i / 4) * 360; board.drawImage(view.canvas, x + 20, y + 28, 320, 320); board.fillStyle = '#e9e2f2'; board.font = '13px Arial'; board.fillText(name, x + 25, y + 21);
      sim.elapsed += .12; d.timer = Math.max(0, d.timer - .12); state.flash = Math.max(0, state.flash - .12);
      if (mode === 'outbound' || mode === 'returning') { d.previous = { ...d.at }; d.at.x += .15; }
      view.render(sim, 'dark', 1, false); checks.push({ name, visible: changed(idle, active), animated: changed(active, pixels()), frozen });
    }
    const frame = gallery.toDataURL(); view.dispose(); host.remove(); return { checks, frame };
  });
  writeFileSync('test-results/league-expansion-abilities.png', Buffer.from(result.frame.split(',')[1], 'base64'));
  for (const check of result.checks) { expect(check.visible, check.name).toBeGreaterThan(150); expect(check.animated, check.name).toBeGreaterThan(10); expect(check.frozen, check.name).toBe(true); }
});

test('the three new full kits survive actual 9:16 video encoding and playback', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
  const results = await page.evaluate(async () => {
    const paths = ['/src/rendering/arena.ts', '/src/simulation/engine.ts', '/src/content/catalog.ts', '/src/recording/portrait.ts'];
    const [{ ArenaView }, { Simulation }, { catalog, builtinMedia }, { PortraitRecording }] = await Promise.all(paths.map(path => import(path)));
    const host = document.createElement('div'); document.body.appendChild(host); const view = new ArenaView(); await view.init(host);
    const media: Record<string, string> = {}; for (const [id, files] of Object.entries(builtinMedia)) for (const [path, url] of Object.entries(files as Record<string, string>)) media[id + '/' + path] = url; await view.setMedia(media);
    const results: { frame: string; width: number; height: number; bytes: number; activations: number[][] }[] = [];
    for (const [index, names] of [['ahri', 'caitlyn'], ['fizz', 'caitlyn']].entries()) {
      const characters = names.map(name => { const c = structuredClone(catalog.find((c: { id: string }) => c.id === 'core:' + name)); c.stats.maxHp = 2000; c.stats.contactDamage = 0; return c; }); if (index === 1) characters[1].skills = [];
      const sim = new Simulation(characters, { seed: 'expansion-recording', shrink: false, timeout: 60 }), portrait = new PortraitRecording(); sim.start();
      sim.fighters.forEach((f: { body: { setPosition: (p: { x: number; y: number }) => void; setLinearVelocity: (p: { x: number; y: number }) => void }; previous: { x: number; y: number } }, i: number) => { const at = { x: i ? .75 : -.75, y: 0 }; f.body.setPosition(at); f.previous = { ...at }; f.body.setLinearVelocity({ x: 0, y: 0 }); sim.hold(f, 60); });
      const stream: MediaStream = portrait.canvas.captureStream(30), recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' }), chunks: Blob[] = [];
      recorder.ondataavailable = event => chunks.push(event.data); recorder.start(); const started = performance.now(); let captureAt = 0;
      for (let tick = 0; tick < 640; tick++) {
        sim.step(); view.render(sim, 'dark', 1, false); portrait.draw(view.canvas, sim, 'dark', (f: { definition: unknown }) => view.artwork(f.definition), (f: { definition: unknown }, skill: unknown) => view.skillArtwork(f.definition, skill));
        if (tick === (index ? 565 : 520)) { captureAt = (performance.now() - started) / 1000 + .06; await new Promise(resolve => setTimeout(resolve, 140)); }
        await new Promise(requestAnimationFrame);
      }
      await new Promise<void>(resolve => { recorder.onstop = () => resolve(); recorder.stop(); }); stream.getTracks().forEach(track => track.stop());
      const blob = new Blob(chunks, { type: 'video/webm' }), url = URL.createObjectURL(blob), video = document.createElement('video'); video.muted = true; video.src = url;
      await new Promise<void>((resolve, reject) => { video.onloadeddata = () => resolve(); video.onerror = () => reject(new Error('Expansion recording failed to decode')); }); video.currentTime = captureAt; await new Promise<void>(resolve => { video.onseeked = () => resolve(); });
      const sample = document.createElement('canvas'); sample.width = video.videoWidth; sample.height = video.videoHeight; sample.getContext('2d')!.drawImage(video, 0, 0);
      results.push({ frame: sample.toDataURL(), width: video.videoWidth, height: video.videoHeight, bytes: blob.size, activations: sim.fighters.map((f: { skills: { activations: number }[] }) => f.skills.map(s => s.activations)) }); URL.revokeObjectURL(url);
    }
    view.dispose(); host.remove(); return results;
  });
  for (const [index, result] of results.entries()) {
    expect(result.width).toBe(720); expect(result.height).toBe(1280); expect(result.bytes).toBeGreaterThan(10000);
    for (const skills of result.activations) for (const count of skills) expect(count).toBeGreaterThan(0);
    writeFileSync(`test-results/league-expansion-portrait-${index}.png`, Buffer.from(result.frame.split(',')[1], 'base64'));
  }
  expect(errors).toEqual([]);
});
