import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Vec2 } from 'planck';
import { defaultSkill, validateCharacter, type SkillType } from '../src/content/schema';
import { Simulation } from '../src/simulation/engine';
import { leagueState } from '../src/skills/league';
import { fighterSkillStatuses } from '../src/skills/status';

const load = (name: string) => validateCharacter(JSON.parse(readFileSync(`content/characters/${name}/character.json`, 'utf8')));
function duel(type: SkillType, separation = 1.4, enemy: SkillType[] = []) {
  const self = load('ahri'), other = load('fizz'); self.skills = [defaultSkill(type)]; other.skills = enemy.map(defaultSkill);
  self.stats.maxHp = other.stats.maxHp = 2000; self.stats.contactDamage = other.stats.contactDamage = 0;
  const sim = new Simulation([self, other], { seed: 'league-expansion', shrink: false, timeout: 60 }); sim.start();
  sim.fighters.forEach((f, i) => { f.body.setPosition(Vec2(i ? separation : 0, 0)); f.previous = { ...f.body.getPosition() }; f.body.setLinearVelocity(Vec2(0, 0)); sim.hold(f, 60); });
  return sim;
}
const tick = (sim: Simulation, n: number) => { for (let i = 0; i < n; i++) sim.step(); };

describe('Ahri, Caitlyn and Fizz three-skill adaptations', () => {
  it('loads three distinct, editable, attributed skills and League origins for each champion', () => {
    const expected = { ahri: ['orb-of-deception', 'charm', 'spirit-rush'], caitlyn: ['piltover-peacemaker', 'yordle-snap-trap', 'ace-in-the-hole'], fizz: ['urchin-strike', 'playful-trickster', 'chum-the-waters'] };
    for (const [name, types] of Object.entries(expected)) {
      const hero = load(name); expect(hero.skills.map(s => s.type)).toEqual(types); expect(hero.origin).toBe('League of Legends'); expect(hero.assets.license).toContain('Riot');
      expect(readFileSync(`content/characters/${name}/assets/body.png`).length).toBeGreaterThan(10000);
      expect(validateCharacter({ ...hero, skills: hero.skills.map(s => defaultSkill(s.type)) }).skills).toHaveLength(3);
    }
  });
  it('does not advance any new kit before Run or skip its first cooldown', () => {
    for (const name of ['ahri', 'caitlyn', 'fizz']) {
      const sim = new Simulation([load(name), load('bumper')], { seed: 'waiting', shrink: false, timeout: 60 }); tick(sim, 500); expect(sim.elapsed).toBe(0);
      sim.start(); tick(sim, 100); expect(sim.fighters[0].skills.map(s => s.activations)).toEqual([0, 0, 0]);
    }
  });
  it('Ahri orb pierces once on each leg and the return homes toward the current owner', () => {
    const sim = duel('orb-of-deception'), [self, target] = sim.fighters, state = self.skills[0]; state.cooldown = 0; tick(sim, 60);
    expect(target.hp).toBe(1984); expect(state.activations).toBe(1); expect(state.league!.mode).toBe('idle');
    state.cooldown = 0; tick(sim, 25); self.body.setPosition(Vec2(-1.5, .7)); self.previous = { x: -1.5, y: .7 }; tick(sim, 90);
    expect(state.league!.mode).toBe('idle'); expect(Math.hypot(state.league!.at.x + 1.5, state.league!.at.y - .7)).toBeLessThan(.55);
  });
  it('Charm locks its shot, damages once, disables casts, and draws its target toward Ahri', () => {
    const sim = duel('charm', 1.4, ['projectile']), [self, target] = sim.fighters; self.skills[0].cooldown = 0; target.skills[0].cooldown = .5;
    tick(sim, 25); const x = target.body.getPosition().x; expect(sim.disabled(target)).toBe(true); expect(target.hp).toBe(1994);
    tick(sim, 25); expect(target.body.getPosition().x).toBeLessThan(x); expect(target.skills[0].activations).toBe(0);
    tick(sim, 40); expect(sim.disabled(target)).toBe(false); expect(target.skills[0].activations).toBe(1); expect(target.hp).toBe(1994);
  });
  it('Charm dodges and untargetability release its own control without clearing other effects', () => {
    const miss = duel('charm'), target = miss.fighters[1]; miss.fighters[0].skills[0].cooldown = 0; miss.step(); target.body.setPosition(Vec2(1.4, 1.7)); target.previous = { x: 1.4, y: 1.7 }; tick(miss, 60); expect(target.hp).toBe(2000);
    const sim = duel('charm'), [self, victim] = sim.fighters; self.skills[0].cooldown = 0; tick(sim, 25); sim.control(victim, 'other', 1); sim.setPhasing(victim, .5); sim.step();
    expect(self.skills[0].active).toBe(0); expect(victim.controls.has('other')).toBe(true); expect(victim.controls.has('league:0:charm')).toBe(false);
  });
  it('Spirit Rush uses exactly three separately aimed dashes and one nearby bolt per dash', () => {
    const sim = duel('spirit-rush'), [self, target] = sim.fighters, state = self.skills[0]; state.cooldown = 0; tick(sim, 130);
    expect(state.activations).toBe(3); expect(state.charges).toBe(0); expect(state.league!.stage).toBe(3); expect(state.league!.mode).toBe('idle');
    expect(target.hp).toBe(1979); expect(self.channeling).toBeNull(); expect(state.league!.bolts).toHaveLength(0);
  });
  it('a disabled Spirit Rush stops its dash, keeps remaining recasts, and releases casting locks', () => {
    const sim = duel('spirit-rush'), self = sim.fighters[0]; self.skills[0].cooldown = 0; sim.step(); sim.control(self, 'stun', .4); sim.step();
    expect(self.skills[0].league!.mode).toBe('recast'); expect(self.channeling).toBeNull(); tick(sim, 130); expect(self.skills[0].activations).toBe(3); expect(self.controls.size).toBe(0);
  });
  it('Peacemaker waits for the locked rifle windup and damages a target only once', () => {
    const sim = duel('piltover-peacemaker'), [self, target] = sim.fighters; self.skills[0].cooldown = 0; tick(sim, 25); expect(target.hp).toBe(2000); expect(self.skills[0].targeting).toBe(true);
    tick(sim, 40); expect(target.hp).toBe(1984); expect(self.channeling).toBeNull();
    const miss = duel('piltover-peacemaker'); miss.fighters[0].skills[0].cooldown = 0; miss.step(); miss.fighters[1].body.setPosition(Vec2(1.4, 1.7)); miss.fighters[1].previous = { x: 1.4, y: 1.7 }; tick(miss, 65); expect(miss.fighters[1].hp).toBe(2000);
  });
  it('traps must arm, root without immediate damage, then grant one follow-up headshot', () => {
    const sim = duel('yordle-snap-trap'), [self, target] = sim.fighters; self.skills[0].cooldown = 0; tick(sim, 29);
    expect(target.hp).toBe(2000); expect(self.skills[0].league!.traps).toHaveLength(1); sim.step(); sim.step();
    expect(self.skills[0].league!.mode).toBe('headshot'); expect(target.hp).toBe(2000); expect(target.rootUntil).toBeGreaterThan(sim.elapsed);
    tick(sim, 30); expect(target.hp).toBe(1986); expect(self.skills[0].league!.traps).toHaveLength(0);
  });
  it('unused traps expire and the per-slot pool stays bounded', () => {
    const sim = duel('yordle-snap-trap'), self = sim.fighters[0], d = leagueState(self.skills[0]);
    d.traps = [{ at: { x: -1.8, y: 1.8 }, arm: 0, life: .03 }]; tick(sim, 2); expect(d.traps).toHaveLength(0);
    self.definition.skills[0].cooldown = .1; self.definition.skills[0].range = .1; self.definition.skills[0].duration = 10; self.skills[0].cooldown = 0; tick(sim, 100); expect(d.traps).toHaveLength(3);
  });
  it('Ace in the Hole tracks during its channel and its bullet follows a moving target', () => {
    const sim = duel('ace-in-the-hole'), [self, target] = sim.fighters; self.skills[0].cooldown = 0; tick(sim, 45); expect(target.hp).toBe(2000);
    target.body.setPosition(Vec2(0, 1.8)); target.previous = { x: 0, y: 1.8 }; tick(sim, 30); expect(target.hp).toBe(1974); expect(self.channeling).toBeNull();
  });
  it('stuns and untargetability interrupt Ace instead of granting an invisible free hit', () => {
    for (const stun of [true, false]) { const sim = duel('ace-in-the-hole'), [self, target] = sim.fighters; self.skills[0].cooldown = 0; tick(sim, 10);
      if (stun) sim.control(self, 'stun', .5); else sim.setPhasing(target, .5); tick(sim, 70);
      expect(target.hp).toBe(2000); expect(self.channeling).toBeNull(); expect(self.skills[0].league!.mode).toBe('interrupted');
    }
  });
  it('Urchin Strike passes through, applies one on-hit strike, and remains targetable', () => {
    const sim = duel('urchin-strike'), [self, target] = sim.fighters; self.skills[0].cooldown = 0; tick(sim, 3);
    expect(self.untargetableUntil).toBe(0); expect(self.ghostUntil).toBeGreaterThan(sim.elapsed); sim.queueHit(target, self, 9); sim.resolveHits(); expect(self.hp).toBe(1991);
    tick(sim, 30); expect(target.hp).toBe(1988); expect(self.body.getPosition().x).toBeGreaterThan(target.body.getPosition().x); expect(self.ghostUntil).toBe(0); expect(self.body.getFixtureList()!.isSensor()).toBe(false);
  });
  it('Playful is untargetable in flight and lands with exactly one splash and slow', () => {
    const sim = duel('playful-trickster'), [self, target] = sim.fighters; self.skills[0].cooldown = 0; sim.step(); sim.queueHit(target, self, 50); sim.resolveHits(); expect(self.hp).toBe(2000);
    tick(sim, 25); expect(target.hp).toBe(2000); expect(self.phasing).toBe(true); tick(sim, 10);
    expect(target.hp).toBe(1986); expect(self.phasing).toBe(false); expect(target.slowFactor).toBe(.65); expect(self.channeling).toBeNull();
  });
  it('Chum the Waters attaches, waits, then produces a single damage/knock-up event', () => {
    const sim = duel('chum-the-waters'), [self, target] = sim.fighters; self.skills[0].cooldown = 0; tick(sim, 20); expect(self.skills[0].league!.mode).toBe('bait'); expect(target.hp).toBe(2000);
    target.body.setPosition(Vec2(1.6, .4)); target.previous = { x: 1.6, y: .4 }; tick(sim, 65); expect(target.hp).toBeLessThan(2000); expect(sim.disabled(target)).toBe(true);
    const hp = target.hp; tick(sim, 40); expect(target.hp).toBe(hp); expect(self.skills[0].league!.anchor).toEqual({ x: 1.6, y: .4 });
  });
  it('shark misses remain a ground lure and an untargetable victim avoids eruption damage', () => {
    const sim = duel('chum-the-waters'), [self, target] = sim.fighters; self.skills[0].cooldown = 0; sim.step(); target.body.setPosition(Vec2(0, 2)); target.previous = { x: 0, y: 2 }; tick(sim, 110); expect(target.hp).toBe(2000);
    const evade = duel('chum-the-waters'); evade.fighters[0].skills[0].cooldown = 0; tick(evade, 20); evade.setPhasing(evade.fighters[1], 3); tick(evade, 90); expect(evade.fighters[1].hp).toBe(2000);
  });
  it('shark damage and the renderer’s shared radius multiplier scale with lure travel', () => {
    for (const [travel, damage] of [[0, 22], [4, 33]]) {
      const sim = duel('chum-the-waters'), state = sim.fighters[0].skills[0], d = leagueState(state);
      d.mode = 'bait'; d.attached = true; d.timer = .02; d.travel = travel; sim.step();
      expect(sim.fighters[1].hp).toBe(2000 - damage); expect(sim.disabled(sim.fighters[1])).toBe(true);
    }
  });
  it('new timers freeze on pause and fresh mirror matches have independent bounded state', () => {
    for (const type of load('ahri').skills.concat(load('caitlyn').skills, load('fizz').skills).map(s => s.type)) {
      const sim = duel(type), self = sim.fighters[0]; self.skills[0].cooldown = 0; tick(sim, 3); sim.pause(); const before = JSON.stringify(self.skills[0].league); tick(sim, 80);
      expect(JSON.stringify(self.skills[0].league)).toBe(before); expect(fighterSkillStatuses(sim, self)[0].label).toBeTruthy();
      const fresh = duel(type); expect(fresh.fighters[0].skills[0].league).toBeUndefined(); expect(self.skills[0].league!.trail.length).toBeLessThanOrEqual(10);
    }
    const hero = load('ahri'), mirror = new Simulation([hero, hero], { seed: 'mirror', shrink: false, timeout: 60 }); expect(leagueState(mirror.fighters[0].skills[0])).not.toBe(leagueState(mirror.fighters[1].skills[0]));
  });
});
