import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Vec2 } from 'planck';
import { Simulation, STEP } from '../src/simulation/engine';
import { characterSchema, defaultSkill, validateCharacter, type Character } from '../src/content/schema';
import { z } from 'zod';

function character(name = 'bumper'): Character { return validateCharacter(JSON.parse(readFileSync(new URL(`../content/characters/${name}/character.json`, import.meta.url), 'utf8'))); }
function bare(): Character { const c = character(); c.skills = []; c.stats.contactDamage = 10; return c; }
const options = { seed: 'test-001', shrink: true, timeout: 180 };
function collide(sim: Simulation) {
  sim.fighters[0].body.setPosition(Vec2(-.395, 0)); sim.fighters[1].body.setPosition(Vec2(.395, 0));
  sim.fighters[0].body.setLinearVelocity(Vec2(2, 0)); sim.fighters[1].body.setLinearVelocity(Vec2(-2, 0));
  sim.step();
}
describe('combat invariants', () => {
  it('waits for an explicit start without advancing movement, skill clocks, or the puck', () => {
    const sim = new Simulation([character('mallet'), character('dartling')], { ...options, launchAngles: [0, 180] });
    const before = sim.fighters.map(f => ({ position: { ...f.body.getPosition() }, cooldown: f.skills[0].cooldown }));
    for (let i = 0; i < 250; i++) sim.step();
    expect(sim.phase).toBe('ready'); expect(sim.elapsed).toBe(0); expect(sim.totalHits).toBe(0);
    expect(sim.fighters.map(f => ({ position: { ...f.body.getPosition() }, cooldown: f.skills[0].cooldown }))).toEqual(before);
    expect(sim.puck!.body.getLinearVelocity()).toEqual(Vec2(0, 0)); expect(sim.projectiles).toHaveLength(0);
  });
  it('launches each ball in its chosen world direction at its own cruise speed', () => {
    const sim = new Simulation([character('bumper'), character('dartling')], { ...options, launchAngles: [0, 270] });
    sim.start();
    expect(sim.fighters[0].body.getLinearVelocity().x).toBeCloseTo(4); expect(sim.fighters[0].body.getLinearVelocity().y).toBeCloseTo(0);
    expect(sim.fighters[1].body.getLinearVelocity().x).toBeCloseTo(0); expect(sim.fighters[1].body.getLinearVelocity().y).toBeCloseTo(-4.2);
    expect(sim.launchDirections[1].y).toBeCloseTo(-1);
  });
  it('resumes current velocity after pause rather than reapplying the initial direction', () => {
    const sim = new Simulation([bare(), bare()], { ...options, launchAngles: [0, 180] }); sim.start();
    sim.fighters[0].body.setLinearVelocity(Vec2(-2, 3)); sim.pause(); sim.start();
    expect(sim.fighters[0].body.getLinearVelocity()).toEqual(Vec2(-2, 3));
  });
  it('validates and snapshots launch settings without retaining a mutable caller array', () => {
    const launchAngles: [number, number] = [90, 180];
    const sim = new Simulation([bare(), bare()], { ...options, launchAngles }); launchAngles[0] = 0; sim.start();
    expect(sim.fighters[0].body.getLinearVelocity().y).toBeCloseTo(4); expect(sim.options.launchAngles).toEqual([90, 180]);
    for (const angles of [[NaN, 0], [Infinity, 0], [-1, 0], [360, 0], [0], [0, 0, 0]]) expect(() => new Simulation([bare(), bare()], { ...options, launchAngles: angles as [number, number] })).toThrow('launch angles');
  });
  it('settles reciprocal lethal hits and resolves a simultaneous knockout once', () => {
    const c = bare(); c.stats.maxHp = 10;
    const sim = new Simulation([c, c], options); sim.start(); collide(sim);
    expect(sim.fighters.map(f => f.hp)).toEqual([0, 0]);
    expect(sim.result).toContain('draw'); expect(sim.resolutionCount).toBe(1);
    for (let i = 0; i < 30; i++) sim.step();
    expect(sim.resolutionCount).toBe(1);
  });
  it('does not duplicate body damage while contacts persist inside the hit interval', () => {
    const c = bare(); const sim = new Simulation([c, c], options); sim.start();
    for (let i = 0; i < 20; i++) collide(sim);
    expect(sim.fighters.map(f => f.hp)).toEqual([90, 90]);
    for (let i = 0; i < 7; i++) collide(sim);
    expect(sim.fighters.map(f => f.hp)).toEqual([80, 80]);
  });
  it('uses independent runtime state for mirror matches and never mutates definitions', () => {
    const c = character(); const before = structuredClone(c); const sim = new Simulation([c, c], options);
    sim.fighters[0].skills[0].charges = 3; sim.fighters[0].hp = 7;
    expect(sim.fighters[1].skills[0].charges).toBe(0); expect(sim.fighters[1].hp).toBe(100); expect(c).toEqual(before);
  });
  it('repeats seeded trajectories and damage for the same pinned build', () => {
    const chars = [character('magnetron'), character('dartling')];
    const a = new Simulation(chars, options), b = new Simulation(chars, options); a.start(); b.start();
    for (let i = 0; i < 2000; i++) { a.step(); b.step(); }
    expect(a.fighters.map(f => [f.hp, f.body.getPosition().x, f.body.getPosition().y])).toEqual(b.fighters.map(f => [f.hp, f.body.getPosition().x, f.body.getPosition().y]));
  });
  it('freezes time, damage, and cooldowns when paused', () => {
    const sim = new Simulation([character('prism'), character()], options); sim.start(); sim.step(); sim.pause();
    const elapsed = sim.elapsed, cooldown = sim.fighters[0].skills[0].cooldown;
    for (let i = 0; i < 50; i++) sim.step();
    expect(sim.elapsed).toBe(elapsed); expect(sim.fighters[0].skills[0].cooldown).toBe(cooldown);
  });
  it('keeps multiple shield skills independent and does not replenish absorbed capacity each tick', () => {
    const c = bare(); c.skills = [{ ...defaultSkill('shield'), id: 'first', damage: 10 }, { ...defaultSkill('shield'), id: 'second', damage: 15 }];
    const sim = new Simulation([c, bare()], options); sim.start();
    for (let i = 0; i < 250; i++) { sim.fighters[0].body.setPosition(Vec2(-1.5, 0)); sim.fighters[1].body.setPosition(Vec2(1.5, 0)); sim.step(); }
    expect(sim.fighters[0].shield).toBe(25);
    sim.queueHit(sim.fighters[1], sim.fighters[0], 20); sim.resolveHits();
    expect(sim.fighters[0].hp).toBe(100); sim.step(); expect(sim.fighters[0].shield).toBe(5);
    sim.queueHit(sim.fighters[1], sim.fighters[0], 10); sim.resolveHits(); expect(sim.fighters[0].hp).toBe(95);
  });
  it('a new round drops old effects, attacks, cooldowns, and puck ownership', () => {
    const chars = [character('mallet'), character('embertrail')]; const old = new Simulation(chars, options); old.start();
    for (let i = 0; i < 100; i++) old.step();
    const fresh = new Simulation(chars, options);
    expect(fresh.elapsed).toBe(0); expect(fresh.zones).toHaveLength(0); expect(fresh.projectiles).toHaveLength(0);
    expect(fresh.puck?.owner).toBeNull(); expect(fresh.fighters.every(f => f.hp === 100 && f.skills.every((s, i) => s.cooldown === (['projectile', 'shield', 'beam', 'dash', 'puck'].includes(f.definition.skills[i].type) ? f.definition.skills[i].cooldown : 0)))).toBe(true);
  });
  it('honors mass once when applying knockback', () => {
    const light = bare(), heavy = bare(); light.stats.mass = 1; heavy.stats.mass = 2;
    const sim = new Simulation([light, heavy], options); sim.start();
    sim.fighters.forEach(f => f.body.setLinearVelocity(Vec2(0, 0)));
    sim.queueHit(sim.fighters[1], sim.fighters[0], 0, { x: 4, y: 0 });
    sim.queueHit(sim.fighters[0], sim.fighters[1], 0, { x: 4, y: 0 }); sim.resolveHits();
    expect(sim.fighters[0].body.getLinearVelocity().x).toBeCloseTo(sim.fighters[1].body.getLinearVelocity().x * 2, 5);
  });
  it('contains balls as sudden-death walls move inward and reaches a timeout', () => {
    const c = bare(); c.stats.maxHp = 2000; c.stats.contactDamage = 0;
    const sim = new Simulation([c, c], options); sim.start();
    for (let i = 0; i < 9000; i++) {
      sim.step();
      for (const f of sim.fighters) { const p = f.body.getPosition(); expect(Math.abs(p.x)).toBeLessThanOrEqual(sim.half + .02); expect(Math.abs(p.y)).toBeLessThanOrEqual(sim.half + .02); }
    }
    expect(sim.half).toBeCloseTo(.8); expect(sim.phase).toBe('finished'); expect(sim.result).toContain('Time limit');
  });
  it.each(['bumper', 'sawblade', 'dartling', 'bulwark', 'magnetron', 'embertrail', 'prism', 'meteorion', 'mallet'])('%s completes a bounded automatic battle with finite state', name => {
    const sim = new Simulation([character(name), character('sawblade')], { ...options, timeout: 30 }); sim.start();
    for (let i = 0; i < 30 / STEP; i++) sim.step();
    expect(sim.phase).toBe('finished'); expect(sim.fighters.every(f => Number.isFinite(f.hp) && Number.isFinite(f.body.getPosition().x))).toBe(true);
    expect(sim.projectiles.length).toBeLessThanOrEqual(120); expect(sim.zones.length).toBeLessThanOrEqual(200);
  });
});
describe('character content contract', () => {
  it('rejects a fourth skill in loading and publishes the same schema limit', () => {
    const c = character(); c.skills = ['projectile', 'shield', 'trail', 'beam'].map((s, i) => ({ ...defaultSkill(s as 'projectile'), id: String(i) }));
    expect(() => validateCharacter(c)).toThrow();
    const schema = z.toJSONSchema(characterSchema); expect((schema.properties?.skills as { maxItems: number }).maxItems).toBe(3);
    expect(() => new Simulation([c, character()], options)).toThrow();
  });
  it('rejects duplicate slots, unsafe assets, unknown mechanics, and inconsistent speed bounds', () => {
    const c = character();
    expect(() => validateCharacter({ ...c, skills: [c.skills[0], c.skills[0]] })).toThrow('unique');
    expect(() => validateCharacter({ ...c, appearance: { ...c.appearance, body: 'https://other-site/image.png' } })).toThrow();
    expect(() => validateCharacter({ ...c, skills: [{ ...c.skills[0], type: 'execute-js' }] })).toThrow();
    expect(() => validateCharacter({ ...c, stats: { ...c.stats, maxSpeed: 1 } })).toThrow('cruiseSpeed');
  });
});
