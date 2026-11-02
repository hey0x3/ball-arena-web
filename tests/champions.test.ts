import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Vec2 } from 'planck';
import { defaultSkill, validateCharacter, type SkillType } from '../src/content/schema';
import { Simulation, STEP } from '../src/simulation/engine';
import { championState, darkinShape, historyAt, strikeHit, worldEnder } from '../src/skills/champions';
import { fighterSkillStatuses } from '../src/skills/status';

function load(name: string) { return validateCharacter(JSON.parse(readFileSync(`content/characters/${name}/character.json`, 'utf8'))); }
function duel(type: SkillType) {
  const self = load('ekko'), target = load('bumper'); self.skills = [defaultSkill(type)]; target.skills = [];
  self.stats.maxHp = target.stats.maxHp = 2000; self.stats.contactDamage = target.stats.contactDamage = 0;
  const sim = new Simulation([self, target], { seed: 'champion-check', shrink: false, timeout: 60, launchAngles: [0, 180] }); sim.start(); return sim;
}
function place(sim: Simulation, a = { x: 0, y: 0 }, b = { x: 1.65, y: 0 }) {
  sim.fighters.forEach((f, i) => { const p = i ? b : a; f.body.setPosition(Vec2(p.x, p.y)); f.previous = { ...p }; f.body.setLinearVelocity(Vec2(0, 0)); });
}
function tick(sim: Simulation, count: number, a = { x: 0, y: 0 }, b = { x: 1.65, y: 0 }) { for (let i = 0; i < count; i++) { place(sim, a, b); sim.step(); } }

describe('Aatrox and Ekko automatic ability adaptations', () => {
  it('loads exactly the requested three abilities per champion and uses their separate portraits', () => {
    expect(load('aatrox').skills.map(s => [s.id, s.type])).toEqual([['q', 'darkin-blade'], ['w', 'infernal-chains'], ['r', 'world-ender']]);
    expect(load('ekko').skills.map(s => [s.id, s.type])).toEqual([['q', 'timewinder'], ['e', 'phase-dive'], ['r', 'chronobreak']]);
    expect(readFileSync('content/characters/aatrox/assets/body.png').equals(readFileSync('content/characters/ekko/assets/body.png'))).toBe(false);
  });
  it('uses three distinct Q geometries with sweet spots, not three identical generic hits', () => {
    const q1 = darkinShape({ x: 0, y: 0 }, { x: 1, y: 0 }, 1, 1.8), q2 = darkinShape(q1.origin, q1.aim, 2, 1.8), q3 = darkinShape(q1.origin, q1.aim, 3, 1.8);
    expect(strikeHit(q1, { x: 1.65, y: 0 }, .1)).toEqual({ hit: true, sweet: true });
    expect(strikeHit(q1, { x: .95, y: 0 }, .1)).toEqual({ hit: true, sweet: false });
    expect(strikeHit(q1, { x: 1.3, y: .65 }, .1).hit).toBe(false);
    expect(strikeHit(q2, { x: 1.3, y: .65 }, .1)).toEqual({ hit: true, sweet: true });
    expect(strikeHit(q3, q3.center, .1)).toEqual({ hit: true, sweet: true });
    expect(strikeHit(q3, { x: 1.3, y: 0 }, .1)).toEqual({ hit: true, sweet: false });
    expect(strikeHit(q1, { x: -1, y: 0 }, .4).hit).toBe(false);
  });
  it('locks each sword windup and retargets between all three swings', () => {
    const sim = duel('darkin-blade'), f = sim.fighters[0], state = f.skills[0]; state.cooldown = 0;
    tick(sim, 1); expect(state.aim).toEqual({ x: 1, y: 0 });
    tick(sim, 23, { x: 0, y: 0 }, { x: 0, y: 1.65 });
    expect(state.activations).toBe(1); expect(state.champion!.strike!.aim).toEqual({ x: 1, y: 0 }); expect(sim.fighters[1].hp).toBe(2000);
    tick(sim, 18, { x: 0, y: 0 }, { x: 0, y: 1.65 }); expect(state.targeting).toBe(true); expect(state.aim.y).toBeCloseTo(1);
    for (let i = 0; i < 90 && state.activations < 3; i++) tick(sim, 1, { x: 0, y: 0 }, { x: 0, y: 1.65 });
    expect(state.activations).toBe(3); expect(state.champion!.strike!.stage).toBe(3); expect(state.cooldown).toBeGreaterThan(0);
  });
  it('reserves one sweet-spot damage hit and briefly stops movement', () => {
    const sim = duel('darkin-blade'), state = sim.fighters[0].skills[0], data = championState(state);
    data.mode = 'windup'; data.stage = 1; data.timer = STEP; state.aim = { x: 1, y: 0 };
    tick(sim, 1); expect(sim.fighters[1].hp).toBe(1987); expect(sim.fighters[1].rootUntil).toBeGreaterThan(sim.elapsed);
    tick(sim, 2); expect(sim.fighters[1].hp).toBe(1987);
  });
  it('Infernal Chains hits once, waits for escape, then pulls and applies its second hit', () => {
    const sim = duel('infernal-chains'), state = sim.fighters[0].skills[0]; state.cooldown = 0;
    for (let i = 0; i < 150 && state.champion?.mode !== 'pulled'; i++) tick(sim, 1, { x: 0, y: 0 }, { x: 1.4, y: 0 });
    expect(state.champion!.mode).toBe('pulled'); expect(sim.fighters[1].hp).toBe(1988); expect(sim.fighters[1].body.getPosition().x).toBeCloseTo(state.champion!.anchor!.x, 2);
  });
  it('escaping the W diamond breaks the tether without the pull or second damage', () => {
    const sim = duel('infernal-chains'), state = sim.fighters[0].skills[0]; state.cooldown = 0;
    for (let i = 0; i < 40 && state.champion?.mode !== 'tether'; i++) tick(sim, 1, { x: 0, y: 0 }, { x: 1.4, y: 0 });
    expect(state.champion!.mode).toBe('tether'); expect(sim.fighters[1].hp).toBe(1994);
    tick(sim, 100, { x: 0, y: 0 }, { x: -1.6, y: 0 }); expect(state.champion!.mode).toBe('escaped'); expect(sim.fighters[1].hp).toBe(1994);
  });
  it('World Ender amplifies damage and healing only during its active window', () => {
    const sim = duel('world-ender'), [self, target] = sim.fighters; self.skills[0].cooldown = 0; self.hp = 80; tick(sim, 1);
    expect(worldEnder(self)).toEqual({ damage: 1.25, speed: 1.2, healing: 1.5, leech: .18 });
    sim.queueHit(self, target, 20); sim.resolveHits(); expect(target.hp).toBe(1975); expect(self.hp).toBe(87);
    self.skills[0].active = STEP; tick(sim, 1); expect(worldEnder(self).damage).toBe(1);
    sim.queueHit(self, target, 20); sim.resolveHits(); expect(target.hp).toBe(1955); expect(self.hp).toBe(87);
  });
  it('Timewinder damages at most once per leg and creates a slowing time field', () => {
    const sim = duel('timewinder'), state = sim.fighters[0].skills[0]; state.cooldown = 0; let sawField = false, sawReturn = false;
    for (let i = 0; i < 100; i++) { tick(sim, 1, { x: 0, y: 0 }, { x: 1.4, y: 0 }); sawField ||= state.champion?.device?.phase === 'field'; sawReturn ||= state.champion?.device?.phase === 'returning'; }
    expect(sawField && sawReturn).toBe(true); expect(sim.fighters[1].hp).toBe(1982); expect(sim.fighters[1].slowFactor).toBe(.65); expect(state.champion!.device).toBeNull();
  });
  it('Timewinder returns to its moving owner rather than the original cast position', () => {
    const sim = duel('timewinder'), state = sim.fighters[0].skills[0]; state.cooldown = 0;
    for (let i = 0; i < 40 && state.champion?.device?.phase !== 'field'; i++) tick(sim, 1, { x: 0, y: 0 }, { x: 1.4, y: 0 });
    for (let i = 0; i < 120 && state.champion?.device; i++) tick(sim, 1, { x: -1.4, y: 1 }, { x: 1.4, y: 0 });
    expect(state.champion!.device).toBeNull(); expect(state.activations).toBe(1);
  });
  it('Phase Dive dashes, arms a blink attack, and consumes one empowered strike', () => {
    const sim = duel('phase-dive'), [self, target] = sim.fighters, state = self.skills[0]; self.definition.stats.contactDamage = 6; state.cooldown = 0;
    tick(sim, 12, { x: -2, y: 0 }, { x: 2, y: 0 }); expect(state.champion!.mode).toBe('armed'); expect(target.hp).toBe(2000);
    tick(sim, 1, { x: -2, y: 0 }, { x: -.5, y: 0 }); expect(state.champion!.mode).toBe(''); expect(target.hp).toBe(1982); expect(state.flash).toBeGreaterThan(0);
    expect(self.body.getPosition().x).toBeGreaterThan(-1.5); const hp = target.hp;
    for (let i = 0; i < 10; i++) sim.step(); expect(target.hp).toBe(hp);
  });
  it('Chronobreak rewinds four seconds, avoids damage during the cast, heals recent damage and blasts at arrival', () => {
    const sim = duel('chronobreak'), [self, target] = sim.fighters, state = self.skills[0];
    for (let i = 0; i < 300; i++) { tick(sim, 1, { x: -1.6 + i * .005, y: 0 }, { x: 1.8, y: -1.8 }); if (i === 250) { sim.queueHit(target, self, 60); sim.resolveHits(); } }
    self.hp = 100; const anchor = historyAt(self, sim.elapsed + STEP - 4); state.cooldown = 0; sim.step();
    expect(self.phasing).toBe(true); sim.queueHit(target, self, 100); sim.resolveHits(); expect(self.hp).toBe(100);
    target.body.setPosition(Vec2(anchor.position.x + 1.35, anchor.position.y)); target.body.setLinearVelocity(Vec2(0, 0));
    for (let i = 0; i < 15; i++) sim.step();
    expect(self.phasing).toBe(false); expect(self.body.getPosition().x).toBeCloseTo(anchor.position.x, 2); expect(self.hp).toBe(131); expect(target.hp).toBe(1976);
    expect(state.activations).toBe(1); expect(state.flash).toBeGreaterThan(0);
  });
  it('caps healing and clamps rewinds to the live arena', () => {
    const sim = duel('chronobreak'), f = sim.fighters[0]; f.hp = 1998; expect(sim.heal(f, 100)).toBe(2);
    sim.half = 1.2; sim.teleport(f, { x: 2.2, y: -2.2 }); expect(f.body.getPosition().x).toBeCloseTo(.8); expect(f.body.getPosition().y).toBeCloseTo(-.8);
  });
  it('freezes all six skills and history on pause, with independent mirror state and bounded history', () => {
    for (const name of ['aatrox', 'ekko']) {
      const c = load(name); c.stats.maxHp = 2000;
      const sim = new Simulation([c, c], { seed: 'fan-mirror', shrink: false, timeout: 30 }); sim.start();
      for (let i = 0; i < 700; i++) sim.step();
      expect(sim.fighters[0].history.length).toBeLessThanOrEqual(213); sim.pause();
      const before = JSON.stringify({ status: sim.fighters.map(f => fighterSkillStatuses(sim, f)), history: sim.fighters.map(f => f.history), skills: sim.fighters.map(f => f.skills) });
      for (let i = 0; i < 100; i++) sim.step();
      expect(JSON.stringify({ status: sim.fighters.map(f => fighterSkillStatuses(sim, f)), history: sim.fighters.map(f => f.history), skills: sim.fighters.map(f => f.skills) })).toBe(before);
      expect(sim.fighters[0].skills[0].champion).not.toBe(sim.fighters[1].skills[0].champion);
      const fresh = new Simulation([c, c], sim.options); expect(fresh.fighters[0].history).toHaveLength(1); expect(fresh.fighters[0].skills.every(s => !s.champion)).toBe(true);
    }
  });
});
