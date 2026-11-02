import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Vec2 } from 'planck';
import { defaultSkill, validateCharacter, type SkillType } from '../src/content/schema';
import { Simulation } from '../src/simulation/engine';
import { fighterSkillStatuses } from '../src/skills/status';

const load = (name: string) => validateCharacter(JSON.parse(readFileSync(`content/characters/${name}/character.json`, 'utf8')));
function duel(types: SkillType[], separation = 1.4, enemyTypes: SkillType[] = []) {
  const a = load('pudge'), b = load('ekko'); a.skills = types.map(defaultSkill); b.skills = enemyTypes.map(defaultSkill);
  a.stats.maxHp = b.stats.maxHp = 2000; a.stats.contactDamage = b.stats.contactDamage = 0;
  const sim = new Simulation([a, b], { seed: 'pudge', shrink: false, timeout: 60, launchAngles: [0, 180] });
  sim.start(); sim.fighters.forEach((f, i) => { const p = { x: i ? separation : 0, y: 0 }; f.body.setPosition(Vec2(p.x, p.y)); f.previous = { ...p }; f.body.setLinearVelocity(Vec2(0, 0)); sim.hold(f, 60); });
  return sim;
}
const advance = (sim: Simulation, count: number) => { for (let i = 0; i < count; i++) sim.step(); };

describe('Pudge automatic three-skill adaptation', () => {
  it('has exactly Hook, Rot, Dismember with Valve credits and editable parameters', () => {
    const p = load('pudge'); expect(p.skills.map(s => s.type)).toEqual(['meat-hook', 'rot', 'dismember']);
    expect(p.assets.license).toContain('Valve'); expect(p.skills).toHaveLength(3);
    for (const skill of p.skills) expect(validateCharacter({ ...p, skills: [defaultSkill(skill.type)] }).skills).toHaveLength(1);
  });
  it('waits for Run and the first hook/channel cooldowns', () => {
    const sim = new Simulation([load('pudge'), load('ekko')], { seed: 'ready', shrink: false, timeout: 60 });
    advance(sim, 500); expect(sim.elapsed).toBe(0); expect(sim.fighters[0].skills.every(s => s.activations === 0)).toBe(true);
    sim.start(); advance(sim, 100); expect(sim.fighters[0].skills[0].activations).toBe(0); expect(sim.fighters[0].skills[2].activations).toBe(0);
  });
  it('locks hook aim, damages once and physically reels the opponent to a body-safe gap', () => {
    const sim = duel(['meat-hook'], 2), [self, target] = sim.fighters, state = self.skills[0]; state.cooldown = 0;
    let sawFlying = false, sawReeling = false;
    for (let i = 0; i < 100; i++) { sim.step(); sawFlying ||= state.pudge?.mode === 'outbound'; sawReeling ||= state.pudge?.mode === 'reeling'; }
    expect(sawFlying && sawReeling).toBe(true); expect(target.hp).toBe(1982); expect(state.activations).toBe(1);
    expect(target.body.getPosition().x).toBeCloseTo(self.definition.stats.radius + target.definition.stats.radius + .035, 2);
    expect(self.channeling).toBeNull(); expect(self.controls.size + target.controls.size).toBe(0);
  });
  it('misses a target that dodges the locked aim and retracts without trapping the caster', () => {
    const sim = duel(['meat-hook'], 1.8), [self, target] = sim.fighters, state = self.skills[0]; state.cooldown = 0; sim.step();
    target.body.setPosition(Vec2(1.8, 1.8)); target.previous = { x: 1.8, y: 1.8 }; advance(sim, 100);
    expect(state.aim).toEqual({ x: 1, y: 0 }); expect(target.hp).toBe(2000); expect(state.pudge!.mode).toBe('idle'); expect(self.channeling).toBeNull();
  });
  it('releases a hooked target that becomes untargetable, and interrupts enemy channeling', () => {
    const sim = duel(['meat-hook'], 1.8), [self, target] = sim.fighters; self.skills[0].cooldown = 0;
    for (let i = 0; i < 50 && self.skills[0].pudge?.mode !== 'reeling'; i++) sim.step();
    expect(target.interruptions).toBe(1); expect(sim.disabled(target)).toBe(true);
    sim.setPhasing(target, 1); sim.step(); expect(sim.disabled(target)).toBe(false); advance(sim, 50); expect(self.channeling).toBeNull();
  });
  it('Rot ticks at simulation-time intervals, slows in range, and pauses with the simulation', () => {
    const sim = duel(['rot']), [self, target] = sim.fighters; advance(sim, 9); expect(target.hp).toBe(2000);
    sim.step(); expect(target.hp).toBe(1998); expect(self.hp).toBe(1998); expect(target.slowFactor).toBe(.75);
    sim.pause(); advance(sim, 100); expect(target.hp).toBe(1998); sim.start(); advance(sim, 10); expect(target.hp).toBe(1996);
    target.body.setPosition(Vec2(2.1, 0)); target.previous = { x: 2.1, y: 0 }; advance(sim, 30); expect(target.hp).toBe(1996); expect(self.skills[0].active).toBe(0);
  });
  it('Rot self-damage cannot kill, while enemy damage can still finish Pudge in the same batch', () => {
    const sim = duel(['rot']), [self, target] = sim.fighters; self.hp = 2; advance(sim, 30);
    expect(self.hp).toBe(1); expect(target.hp).toBe(1994); expect(sim.phase).toBe('running');
    sim.queueSelfDamage(self, 200); sim.queueHit(target, self, 1); sim.resolveHits(); expect(self.hp).toBe(0); expect(sim.phase).toBe('finished');
  });
  it('Dismember waits for close range, channels five ticks, pulls and heals from actual damage', () => {
    const sim = duel(['dismember'], 2), [self, target] = sim.fighters, state = self.skills[0]; self.hp = 100; state.cooldown = 0;
    advance(sim, 20); expect(state.activations).toBe(0); expect(fighterSkillStatuses(sim, self)[0].label).toContain('NEED CLOSE TARGET');
    target.body.setPosition(Vec2(1.3, 0)); target.previous = { x: 1.3, y: 0 }; advance(sim, 139);
    expect(state.activations).toBe(1); expect(target.hp).toBe(1975); expect(self.hp).toBe(125); expect(state.active).toBe(0);
    expect(target.body.getPosition().x).toBeLessThan(1); expect(self.controls.size + target.controls.size).toBe(0); expect(self.channeling).toBeNull();
  });
  it('a full shield gives no Dismember healing, and healing cannot exceed max HP', () => {
    const sim = duel(['dismember'], 1.2, ['shield']), [self, target] = sim.fighters; self.hp = 1999; self.skills[0].cooldown = 0;
    target.skills[0].capacity = target.shield = 25; target.skills[0].active = 10;
    advance(sim, 27); expect(self.hp).toBe(1999); expect(target.hp).toBe(2000); expect(target.shield).toBe(20);
    target.skills[0].capacity = target.shield = 0; advance(sim, 25); expect(self.hp).toBe(2000); expect(target.hp).toBe(1995);
  });
  it('disables enemy casting and contact attacks while Rot continues during the channel', () => {
    const sim = duel(['rot', 'dismember'], 1.2, ['projectile']), [self, target] = sim.fighters; self.skills[1].cooldown = 0; target.skills[0].cooldown = .1;
    advance(sim, 70); expect(self.skills[1].pudge!.mode).toBe('channel'); expect(target.skills[0].activations).toBe(0);
    expect(self.skills[0].activations).toBe(1); expect(target.hp).toBeLessThan(1980);
    advance(sim, 80); expect(target.skills[0].activations).toBeGreaterThan(0);
  });
  it('interrupting the caster releases only that channel’s locks and stops future drain ticks', () => {
    const sim = duel(['dismember'], 1.2), [self, target] = sim.fighters; self.skills[0].cooldown = 0; advance(sim, 27);
    sim.control(target, 'other-effect', 1); sim.control(self, 'enemy-stun', .5); sim.step();
    expect(self.skills[0].pudge!.mode).toBe('interrupted'); expect(self.channeling).toBeNull(); expect(target.controls.has('other-effect')).toBe(true);
    expect(target.controls.has('pudge:0:dismember')).toBe(false); const hp = target.hp; advance(sim, 40); expect(target.hp).toBe(hp);
  });
  it('untargetability breaks the channel and fresh simulations have no shared runtime', () => {
    const sim = duel(['dismember'], 1.2), [self, target] = sim.fighters; self.skills[0].cooldown = 0; advance(sim, 10);
    sim.setPhasing(target, 1); sim.step(); expect(self.skills[0].active).toBe(0); expect(self.controls.size + target.controls.size).toBe(0);
    const fresh = duel(['dismember'], 1.2); expect(fresh.fighters[0].skills[0].pudge).toBeUndefined(); expect(fresh.fighters[0].interruptions).toBe(0);
  });
});
