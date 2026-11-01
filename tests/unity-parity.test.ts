import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Vec2 } from 'planck';
import { defaultSkill, validateCharacter, type Character } from '../src/content/schema';
import { Simulation, STEP } from '../src/simulation/engine';
import { behaviors } from '../src/skills/registry';
import { fighterSkillStatuses } from '../src/skills/status';
import { buildBeamPath, length } from '../src/simulation/geometry';

function character(name: string): Character { return validateCharacter(JSON.parse(readFileSync('content/characters/' + name + '/character.json', 'utf8'))); }
function bare() { const c = character('bumper'); c.skills = []; c.stats.maxHp = 2000; c.stats.contactDamage = 0; return c; }
function duel(name: string) {
  const c = character(name); c.stats.maxHp = 2000;
  const sim = new Simulation([c, bare()], { seed: 'unity-parity', shrink: false, timeout: 180 }); sim.start(); return sim;
}
function hold(sim: Simulation, count: number) {
  for (let i = 0; i < count; i++) {
    sim.fighters[0].body.setPosition(Vec2(-1.5, 1)); sim.fighters[1].body.setPosition(Vec2(1.5, -1));
    sim.fighters.forEach(f => f.body.setLinearVelocity(Vec2(0, 0)));
    if (sim.puck) { sim.puck.body.setPosition(Vec2(0, 0)); sim.puck.body.setLinearVelocity(Vec2(0, 0)); }
    sim.step();
  }
}
function collide(sim: Simulation) {
  sim.fighters[0].body.setPosition(Vec2(-.395, 0)); sim.fighters[1].body.setPosition(Vec2(.395, 0));
  sim.fighters[0].body.setLinearVelocity(Vec2(2, 0)); sim.fighters[1].body.setLinearVelocity(Vec2(-2, 0)); sim.step();
}

describe('Unity character rules — audited base loadouts', () => {
  it('matches every audited Unity base stat and skill setting', () => {
    const audit = JSON.parse(readFileSync('docs/unity-audit.json', 'utf8'));
    expect(audit.characters).toHaveLength(9);
    for (const fixture of audit.characters) {
      const c = character(fixture.character.toLowerCase()); expect(c.stats).toEqual(fixture.stats); expect(c.skills[0]).toEqual(fixture.skill);
    }
    expect(character('mallet').skills[0]).toMatchObject({ cooldown: 4, damage: 8, powerDamage: 24, power: 12, range: 7 });
  });
  it('Dartling waits 2.5 seconds for its first shot and reloads on simulation time', () => {
    const sim = duel('dartling'); hold(sim, 124); expect(sim.fighters[0].skills[0].activations).toBe(0);
    hold(sim, 1); expect(sim.elapsed).toBe(2.5); expect(sim.fighters[0].skills[0].activations).toBe(1);
    expect(sim.fighters[0].skills[0].cooldown).toBe(2.5);
    sim.pause(); hold(sim, 100); expect(sim.fighters[0].skills[0].cooldown).toBe(2.5);
  });
  it('bundles the approved source artwork without changing its bytes', () => {
    const audit = JSON.parse(readFileSync('docs/unity-audit.json', 'utf8'));
    for (const fixture of audit.characters) {
      const bytes = readFileSync('content/characters/' + fixture.character.toLowerCase() + '/assets/body.png');
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(fixture.artworkHash);
    }
  });
  it('Dartling sweeps the muzzle segment and respects the four-dart pool', () => {
    const sim = duel('dartling'), self = sim.fighters[0], target = sim.fighters[1], skill = self.definition.skills[0];
    self.body.setPosition(Vec2(0, 0)); target.body.setPosition(Vec2(.82, 0));
    sim.projectile(self, skill, { x: 1, y: 0 }); sim.resolveHits(); expect(target.hp).toBe(1986);
    target.body.setPosition(Vec2(0, 2));
    for (let i = 0; i < 10; i++) sim.projectile(self, skill, { x: 1, y: 0 });
    expect(sim.projectiles).toHaveLength(4);
  });
  it('Dartling retires against a nearer wall instead of hitting through it', () => {
    const sim = duel('dartling'), self = sim.fighters[0], target = sim.fighters[1];
    self.body.setPosition(Vec2(2.15, 0)); target.body.setPosition(Vec2(3.2, 0));
    sim.projectile(self, self.definition.skills[0], { x: 1, y: 0 }); sim.resolveHits();
    expect(target.hp).toBe(2000); expect(sim.projectiles).toHaveLength(0);
  });
  it('Bulwark starts empty, activates at 5s, expires at 8s and refreshes at 10s', () => {
    const sim = duel('bulwark'), f = sim.fighters[0];
    hold(sim, 249); expect(f.shield).toBe(0); hold(sim, 1); expect(f.shield).toBe(25); expect(f.skills[0].active).toBe(3);
    sim.queueHit(sim.fighters[1], f, 20); sim.resolveHits(); expect(f.shield).toBe(5); expect(f.hp).toBe(2000);
    hold(sim, 150); expect(f.shield).toBe(0); hold(sim, 100); expect(f.shield).toBe(25); expect(f.hp).toBe(2000);
  });
  it('Bulwark absorbs overflow correctly without healing or recharging when broken', () => {
    const sim = duel('bulwark'), f = sim.fighters[0]; hold(sim, 250);
    sim.queueHit(sim.fighters[1], f, 30); sim.resolveHits(); expect(f.hp).toBe(1995); expect(f.shield).toBe(0);
    hold(sim, 1); expect(f.shield).toBe(0); expect(f.skills[0].cooldown).toBeCloseTo(4.98);
  });
  it('Sawblade hits with its entire toothed rim and shares body/weapon cooldown', () => {
    const sim = duel('sawblade'), self = sim.fighters[0], target = sim.fighters[1];
    self.body.setPosition(Vec2(0, 0)); target.body.setPosition(Vec2(0, .85));
    self.body.setLinearVelocity(Vec2(0, 0)); target.body.setLinearVelocity(Vec2(0, 0)); sim.step();
    expect(target.hp).toBe(1988);
    for (let i = 0; i < 29; i++) collide(sim);
    expect(target.hp).toBe(1988); collide(sim); expect(target.hp).toBe(1976);
    expect(self.contactHits.get(target.id)).toBeCloseTo(1.22);
  });
  it('Sawblade reserves one 12-damage hit rather than adding body damage', () => {
    const sim = duel('sawblade'); collide(sim); expect(sim.fighters[1].hp).toBe(1988);
  });
  it('Bumper commits one corner credit on the following tick', () => {
    const sim = duel('bumper'), f = sim.fighters[0], state = f.skills[0];
    f.body.setPosition(Vec2(2.19, 2.19)); f.body.setLinearVelocity(Vec2(4, 4)); sim.fighters[1].body.setPosition(Vec2(-1, -1));
    sim.step(); expect(state.charges).toBe(0); expect(state.pendingBounce).toBe(true);
    sim.step(); expect(state.charges).toBe(1); expect(sim.nextContactDamage(f)).toBe(15);
  });
  it('Bumper applies the impulse cap to damage and spends charges only on an eligible hit', () => {
    const sim = duel('bumper'), f = sim.fighters[0]; f.definition.skills[0].impulseCap = 4; f.skills[0].charges = 3;
    expect(sim.nextContactDamage(f)).toBe(20); collide(sim); expect(sim.fighters[1].hp).toBe(1980); expect(f.skills[0].charges).toBe(0);
    f.skills[0].charges = 2; collide(sim); expect(f.skills[0].charges).toBe(2); expect(sim.fighters[1].hp).toBe(1980);
  });
  it('Bumper rejects gentle wall impacts and duplicate corner notifications', () => {
    const sim = duel('bumper'), c = sim.context(sim.fighters[0], 0), wall = behaviors['wall-charge'].wall!;
    wall(c, .9); expect(c.state.pendingBounce).toBe(false); wall(c, 2); wall(c, 2);
    behaviors['wall-charge'].tick!(c); expect(c.state.charges).toBe(1);
  });
  it('Magnetron never triggers from time alone and requires three qualifying bounces', () => {
    const sim = duel('magnetron'), f = sim.fighters[0]; hold(sim, 250); expect(f.skills[0].activations).toBe(0);
    for (let i = 0; i < 3; i++) {
      const c = sim.context(f, 0); behaviors.magnet.wall!(c, 4); behaviors.magnet.wall!(c, 4); hold(sim, 10);
      expect(f.skills[0].activations).toBe(i === 2 ? 1 : 0);
    }
    expect(f.skills[0].charges).toBe(0); expect(f.skills[0].active).toBeGreaterThan(0);
  });
  it('Magnetron eases attraction before contact and never extends an active pull with bounces', () => {
    const sim = duel('magnetron'), f = sim.fighters[0], target = sim.fighters[1], state = f.skills[0]; state.active = 1.25;
    f.body.setPosition(Vec2(0, 0)); target.body.setPosition(Vec2(.9, 0)); sim.step(); expect(state.lastForce).toBe(0);
    f.body.setPosition(Vec2(0, 0)); target.body.setPosition(Vec2(1.5, 0)); sim.step(); expect(state.lastForce).toBeCloseTo(8 * (.7 - .12) / .65);
    const before = state.active; behaviors.magnet.wall!(sim.context(f, 0), 10); expect(state.pendingBounce).toBe(false); expect(state.active).toBe(before);
  });
  it('Embertrail emits clipped line segments and burns a swept crossing once per shared interval', () => {
    const sim = duel('embertrail'), f = sim.fighters[0], target = sim.fighters[1];
    for (let i = 0; i < 5; i++) { f.body.setPosition(Vec2(i === 4 ? .4 : 0, 0)); f.body.setLinearVelocity(Vec2(0, 0)); target.body.setPosition(Vec2(.2, -1)); sim.step(); }
    expect(sim.zones).toHaveLength(1); expect(sim.zones[0].start.x).toBeCloseTo(0); expect(sim.zones[0].end.x).toBeCloseTo(.4);
    target.body.setPosition(Vec2(.2, 1)); target.body.setLinearVelocity(Vec2(0, 0)); sim.step(); expect(target.hp).toBe(1996);
    target.body.setPosition(Vec2(.2, -1)); sim.step(); expect(target.hp).toBe(1996);
  });
  it('Embertrail skips emission when its pool is full without extending existing fire', () => {
    const sim = duel('embertrail'), f = sim.fighters[0], skill = f.definition.skills[0]; skill.poolSize = 2; skill.emitInterval = .02;
    for (let i = 0; i < 8; i++) { f.body.setPosition(Vec2(-1 + i * .1, 0)); f.body.setLinearVelocity(Vec2(0, 0)); sim.fighters[1].body.setPosition(Vec2(1, 2)); sim.step(); }
    expect(sim.zones).toHaveLength(2); expect(f.skills[0].activations).toBe(2); expect(sim.zones[0].life).toBeLessThan(skill.duration);
  });
  it('Prism locks its travel direction during the last .45s rather than tracking the target', () => {
    const sim = duel('prism'), f = sim.fighters[0], state = f.skills[0];
    for (let i = 0; i < 128; i++) { f.body.setPosition(Vec2(0, 0)); f.body.setLinearVelocity(Vec2(4.2, 0)); sim.fighters[1].body.setPosition(Vec2(0, 2)); sim.step(); }
    expect(state.targeting).toBe(true); expect(state.aim).toEqual({ x: 1, y: 0 }); expect(state.activations).toBe(0);
    for (let i = 128; i < 150; i++) { f.body.setPosition(Vec2(0, 0)); f.body.setLinearVelocity(Vec2(0, 4.2)); sim.fighters[1].body.setPosition(Vec2(-1, -2)); sim.step(); }
    expect(state.activations).toBe(1); expect(state.path[1].y).toBeCloseTo(state.path[0].y); expect(state.cooldown).toBe(3);
  });
  it('Prism reflects both axes at corners and reserves only one hit over a complete pulse', () => {
    const path = buildBeamPath({ x: 0, y: 0 }, { x: 1, y: 1 }, 16, 2, 2.6);
    expect(path).toHaveLength(4); expect(path[2].x).toBeLessThan(0); expect(path[2].y).toBeLessThan(0);
    const sim = duel('prism'); sim.fighters[0].body.setPosition(Vec2(0, 0)); sim.fighters[1].body.setPosition(Vec2(1, 0));
    sim.beam(sim.fighters[0], sim.fighters[0].definition.skills[0], { x: 1, y: 0 }); sim.resolveHits(); expect(sim.fighters[1].hp).toBe(1982);
  });
  it('Meteorion waits 4.5s, locks aim .7s before launch and applies one rush impulse', () => {
    const sim = duel('meteorion'), f = sim.fighters[0], state = f.skills[0]; hold(sim, 189); expect(state.targeting).toBe(false);
    f.body.setPosition(Vec2(0, 0)); sim.fighters[1].body.setPosition(Vec2(2, 0)); f.body.setLinearVelocity(Vec2(0, 0)); sim.step();
    expect(state.targeting).toBe(true); expect(state.aim).toEqual({ x: 1, y: 0 });
    for (let i = 190; i < 225; i++) { f.body.setPosition(Vec2(0, 0)); f.body.setLinearVelocity(Vec2(0, 0)); sim.fighters[1].body.setPosition(Vec2(0, 2)); sim.step(); }
    expect(state.activations).toBe(1); expect(f.body.getLinearVelocity().x).toBeCloseTo(11); expect(f.body.getLinearVelocity().y).toBeCloseTo(0);
    f.body.setPosition(Vec2(2.19, 0)); sim.fighters[1].body.setPosition(Vec2(-1, 1)); sim.step(); expect(f.body.getLinearVelocity().x).toBeLessThan(0);
    sim.step(); expect(f.body.getLinearVelocity().x).toBeLessThan(0);
  });
  it('Meteorion consumes its empowered hit once and reverts to ordinary contact damage', () => {
    const sim = duel('meteorion'), f = sim.fighters[0]; f.skills[0].active = .6;
    collide(sim); expect(sim.fighters[1].hp).toBe(1970); expect(f.skills[0].active).toBe(0);
    hold(sim, 25); collide(sim); expect(sim.fighters[1].hp).toBe(1960);
  });
  it('Mallet charges for 4s without remotely moving, arming, or owning the neutral puck', () => {
    const sim = duel('mallet'); hold(sim, 200);
    expect(sim.fighters[0].skills[0].cooldown).toBe(0); expect(sim.puck?.owner).toBeNull(); expect(sim.puck?.armed).toBe(false); expect(sim.puck?.strikes).toBe(0);
    expect(length(sim.puck!.body.getLinearVelocity())).toBeLessThanOrEqual(7);
  });
  it('Mallet powers a physical strike and an ordinary opponent can return it and damage Mallet', () => {
    const sim = duel('mallet'), a = sim.fighters[0], b = sim.fighters[1]; hold(sim, 200);
    const strike = (hitter: number) => {
      sim.fighters[hitter].body.setPosition(Vec2(0, 0)); sim.fighters[1 - hitter].body.setPosition(Vec2(-1.5, 1.5));
      sim.fighters.forEach(f => f.body.setLinearVelocity(Vec2(0, 0)));
      sim.puck!.body.setPosition(Vec2(.54, 0)); sim.puck!.body.setLinearVelocity(Vec2(-7, 0)); sim.step();
    };
    strike(0); expect(sim.puck?.owner).toBe('0'); expect(sim.puck?.damage).toBe(24); expect(sim.puck?.powered).toBe(true); expect(length(sim.puck!.body.getLinearVelocity())).toBeCloseTo(12);
    hold(sim, 10); strike(1); expect(b.hp).toBe(1976); expect(sim.puck?.owner).toBe('1'); expect(sim.puck?.damage).toBe(8); expect(sim.puck?.powered).toBe(false);
    hold(sim, 10); strike(0); expect(a.hp).toBe(1992); expect(sim.puck?.hitsDealt).toBe(2);
  });
  it('skill indicators expose truthful first cooldowns and wall-based requirements', () => {
    const dart = duel('dartling'); expect(fighterSkillStatuses(dart, dart.fighters[0])[0].label).toBe('2.5s to shot');
    const magnet = duel('magnetron'); expect(fighterSkillStatuses(magnet, magnet.fighters[0])[0].label).toBe('0/3 WALL BOUNCES');
    const puck = duel('mallet'); hold(puck, 200); expect(fighterSkillStatuses(puck, puck.fighters[0])[0].label).toBe('POWER READY');
  });
  it('pausing freezes every character skill readout', () => {
    for (const name of ['bumper', 'sawblade', 'dartling', 'bulwark', 'magnetron', 'embertrail', 'prism', 'meteorion', 'mallet']) {
      const sim = duel(name); hold(sim, 50); sim.pause(); const status = fighterSkillStatuses(sim, sim.fighters[0]);
      hold(sim, 50); expect(fighterSkillStatuses(sim, sim.fighters[0])).toEqual(status);
    }
  });
});
