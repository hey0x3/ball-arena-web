import type { Point, SkillContext, SkillState } from '../simulation/engine';
import type { Skill } from '../content/schema';
import { direction, segmentDistanceSquared } from '../simulation/geometry';

export type Trap = { at: Point; arm: number; life: number };
export type EssenceBolt = { at: Point; previous: Point; life: number };
export type LeagueState = {
  mode: string; timer: number; stage: number; revision: number; at: Point; previous: Point; origin: Point;
  aim: Point; anchor: Point | null; travel: number; hit: boolean; returnHit: boolean; attached: boolean;
  trail: Point[]; traps: Trap[]; bolts: EssenceBolt[];
};
export function leagueState(state: SkillState): LeagueState {
  return state.league ??= { mode: 'idle', timer: 0, stage: 0, revision: 0, at: { x: 0, y: 0 }, previous: { x: 0, y: 0 }, origin: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, anchor: null, travel: 0, hit: false, returnHit: false, attached: false, trail: [], traps: [], bolts: [] };
}
const ready = (n: number) => n <= .0002;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function sharkMultiplier(skill: Skill, state: LeagueState) { return 1 + Math.min(1, state.travel / skill.range) * ((skill.damageMultiplier ?? 1.5) - 1); }
const key = (c: SkillContext) => `league:${c.self.id}:${c.skill.id}`;
const targetable = (c: SkillContext) => c.target.untargetableUntil <= c.engine.elapsed;
function release(c: SkillContext) {
  c.engine.release(c.self, key(c)); if (c.self.channeling === key(c)) c.self.channeling = null; c.state.targeting = false;
}
function lock(c: SkillContext) { c.engine.control(c.self, key(c), c.dt * 3, false); c.self.channeling = key(c); }
function interrupted(c: SkillContext) { return c.engine.disabled(c.self) || c.self.untargetableUntil > c.engine.elapsed || leagueState(c.state).revision !== c.self.interruptions; }
function initialize(c: SkillContext, mode: string) {
  const d = leagueState(c.state), at = c.self.body.getPosition();
  d.mode = mode; d.origin = { ...at }; d.at = { ...at }; d.previous = { ...at }; d.travel = 0; d.hit = false; d.returnHit = false; d.attached = false;
  d.aim = direction(at, c.target.body.getPosition()); d.revision = c.self.interruptions; d.trail = [];
  c.state.aim = { ...d.aim }; c.state.cooldown = c.skill.cooldown; c.state.activations++;
}
function advance(c: SkillContext, d: LeagueState, speed: number, aim = d.aim, remaining = Infinity) {
  d.previous = { ...d.at }; const travel = Math.min(Math.max(.1, speed) * c.dt, Math.max(0, remaining)), limit = c.engine.half - .1;
  const at = { x: d.at.x + aim.x * travel, y: d.at.y + aim.y * travel };
  d.at = { x: Math.max(-limit, Math.min(limit, at.x)), y: Math.max(-limit, Math.min(limit, at.y)) }; d.travel += distance(d.previous, d.at);
  d.trail.push({ ...d.at }); if (d.trail.length > 10) d.trail.shift();
  return { wall: at.x !== d.at.x || at.y !== d.at.y, hit: targetable(c) && segmentDistanceSquared(d.previous, d.at, c.target.previous, c.target.body.getPosition()) <= (c.target.definition.stats.radius + .12) ** 2 };
}
function windup(c: SkillContext) {
  const d = leagueState(c.state);
  if (interrupted(c) || !targetable(c) && c.skill.type === 'ace-in-the-hole') { release(c); d.mode = 'interrupted'; c.state.flash = .3; return false; }
  lock(c); d.timer = Math.max(0, d.timer - c.dt);
  if (!ready(d.timer)) return false;
  release(c); d.mode = 'outbound'; d.at = { ...c.self.body.getPosition() }; d.previous = { ...d.at };
  if (c.skill.type === 'ace-in-the-hole') d.timer = 3;
  return true;
}
function castWindup(c: SkillContext) {
  initialize(c, 'windup'); const d = leagueState(c.state); d.timer = c.skill.windup ?? .2; c.state.targeting = true; lock(c);
}
function canFire(c: SkillContext) { return ready(c.state.cooldown) && c.engine.canAct(c.self) && targetable(c); }
function tickCooldown(c: SkillContext) { c.state.cooldown = Math.max(0, c.state.cooldown - c.dt); }
function boltTick(c: SkillContext) {
  const d = leagueState(c.state);
  for (const bolt of d.bolts) {
    bolt.previous = { ...bolt.at }; bolt.life -= c.dt;
    const aim = direction(bolt.at, c.target.body.getPosition()), travel = Math.min(11 * c.dt, distance(bolt.at, c.target.body.getPosition()));
    bolt.at = { x: bolt.at.x + aim.x * travel, y: bolt.at.y + aim.y * travel };
    if (targetable(c) && segmentDistanceSquared(bolt.previous, bolt.at, c.target.previous, c.target.body.getPosition()) <= (c.target.definition.stats.radius + .1) ** 2) { c.engine.queueHit(c.self, c.target, c.skill.damage); bolt.life = 0; c.state.flash = .18; }
  }
  d.bolts = d.bolts.filter(b => b.life > .0001);
}
function rush(c: SkillContext) {
  const d = leagueState(c.state); d.stage++; d.mode = 'dash'; d.timer = c.skill.duration; d.revision = c.self.interruptions; d.origin = { ...c.self.body.getPosition() };
  const aim = direction(d.origin, c.target.body.getPosition()), side = d.stage % 2 ? 1 : -1;
  const flank = { x: c.target.body.getPosition().x - aim.y * side * .85, y: c.target.body.getPosition().y + aim.x * side * .85 };
  d.aim = direction(d.origin, flank); c.state.aim = { ...d.aim }; c.state.charges = Math.max(0, (c.skill.maxCharges ?? 3) - d.stage); c.state.active = c.skill.duration; c.state.activations++; lock(c);
  if (distance(d.origin, c.target.body.getPosition()) <= c.skill.range + c.target.definition.stats.radius) d.bolts.push({ at: { ...d.origin }, previous: { ...d.origin }, life: .7 });
}
export const leagueBehaviors = {
  'orb-of-deception': { tick: (c: SkillContext) => {
    tickCooldown(c); const d = leagueState(c.state);
    if (d.mode === 'outbound') {
      const result = advance(c, d, c.skill.power, d.aim, c.skill.range - d.travel);
      if (result.hit && !d.hit) { d.hit = true; c.engine.queueHit(c.self, c.target, c.skill.damage); c.state.flash = .18; }
      if (result.wall || d.travel >= c.skill.range - .0001) { d.mode = 'returning'; d.timer = 3; }
    } else if (d.mode === 'returning') {
      d.timer -= c.dt; const aim = direction(d.at, c.self.body.getPosition()), result = advance(c, d, c.skill.power * 1.35, aim, distance(d.at, c.self.body.getPosition()));
      if (result.hit && !d.returnHit) { d.returnHit = true; c.engine.queueHit(c.self, c.target, c.skill.returnDamage ?? c.skill.damage); c.state.flash = .18; }
      if (distance(d.at, c.self.body.getPosition()) <= c.self.definition.stats.radius + .1 || ready(d.timer)) { d.mode = 'idle'; d.trail = []; }
    } else if (canFire(c)) initialize(c, 'outbound');
  } },
  charm: { tick: (c: SkillContext) => {
    tickCooldown(c); const d = leagueState(c.state);
    if (d.mode === 'windup') { windup(c); }
    else if (d.mode === 'outbound') {
      const result = advance(c, d, c.skill.power, d.aim, c.skill.range - d.travel);
      if (result.hit) {
        c.engine.queueHit(c.self, c.target, c.skill.damage); d.mode = 'charmed'; d.timer = c.skill.duration; c.state.active = d.timer; c.state.flash = .25;
        c.engine.control(c.target, key(c), c.dt * 3);
      } else if (result.wall || d.travel >= c.skill.range - .0001) d.mode = 'idle';
    } else if (d.mode === 'charmed') {
      d.timer = Math.max(0, d.timer - c.dt); c.state.active = d.timer;
      if (ready(d.timer) || !targetable(c)) { d.mode = 'idle'; c.state.active = 0; c.engine.release(c.target, key(c)); }
      else {
        c.engine.control(c.target, key(c), c.dt * 3);
        const aim = direction(c.target.body.getPosition(), c.self.body.getPosition()), gap = c.self.definition.stats.radius + c.target.definition.stats.radius + .035;
        const travel = Math.min(1.2 * c.dt, Math.max(0, distance(c.self.body.getPosition(), c.target.body.getPosition()) - gap)), at = c.target.body.getPosition();
        c.engine.teleport(c.target, { x: at.x + aim.x * travel, y: at.y + aim.y * travel });
      }
    } else if (canFire(c)) castWindup(c);
  } },
  'spirit-rush': { tick: (c: SkillContext) => {
    tickCooldown(c); boltTick(c); const d = leagueState(c.state);
    if (d.mode === 'dash') {
      const step = Math.min(c.dt, d.timer); d.timer = Math.max(0, d.timer - c.dt); c.state.active = d.timer;
      if (!interrupted(c)) { lock(c); const at = c.self.body.getPosition(); c.engine.teleport(c.self, { x: at.x + d.aim.x * c.skill.power * step, y: at.y + d.aim.y * c.skill.power * step }); }
      if (ready(d.timer) || interrupted(c)) {
        release(c); c.state.active = 0; c.state.flash = .25;
        if (d.stage >= (c.skill.maxCharges ?? 3)) { d.mode = 'idle'; c.state.cooldown = c.skill.cooldown; }
        else { d.mode = 'recast'; d.timer = c.skill.recastInterval ?? .55; }
      }
    } else if (d.mode === 'recast') { d.timer = Math.max(0, d.timer - c.dt); if (ready(d.timer) && c.engine.canAct(c.self) && targetable(c)) rush(c); }
    else if (canFire(c)) { d.stage = 0; rush(c); }
  } },
  'piltover-peacemaker': { tick: (c: SkillContext) => {
    tickCooldown(c); const d = leagueState(c.state);
    if (d.mode === 'windup') windup(c);
    else if (d.mode === 'outbound') {
      const result = advance(c, d, c.skill.power, d.aim, c.skill.range - d.travel);
      if (result.hit && !d.hit) { c.engine.queueHit(c.self, c.target, c.skill.damage); d.hit = true; c.state.flash = .3; }
      if (result.wall || d.travel >= c.skill.range - .0001) d.mode = 'idle';
    } else if (canFire(c)) castWindup(c);
  } },
  'yordle-snap-trap': { tick: (c: SkillContext) => {
    tickCooldown(c); const d = leagueState(c.state);
    for (const trap of d.traps) {
      trap.arm = Math.max(0, trap.arm - c.dt); trap.life -= c.dt;
      if (trap.life > 0 && ready(trap.arm) && targetable(c) && d.mode !== 'headshot' && d.mode !== 'outbound' && segmentDistanceSquared(trap.at, trap.at, c.target.previous, c.target.body.getPosition()) <= (c.target.definition.stats.radius + .18) ** 2) {
        trap.life = 0; d.mode = 'headshot'; d.timer = .22; d.anchor = { ...trap.at }; c.engine.hold(c.target, c.skill.controlDuration ?? .9); c.state.flash = .35;
      }
    }
    d.traps = d.traps.filter(trap => trap.life > .0001);
    if (d.mode === 'headshot') {
      d.timer = Math.max(0, d.timer - c.dt);
      if (ready(d.timer) && c.engine.canAct(c.self) && targetable(c)) { d.mode = 'outbound'; d.at = { ...c.self.body.getPosition() }; d.previous = { ...d.at }; d.timer = 2; }
      else if (!targetable(c)) d.mode = 'idle';
    } else if (d.mode === 'outbound') {
      d.timer -= c.dt; const result = advance(c, d, 10, direction(d.at, c.target.body.getPosition()), distance(d.at, c.target.body.getPosition()));
      if (result.hit) { c.engine.queueHit(c.self, c.target, c.skill.damage); c.state.flash = .3; d.mode = 'idle'; }
      else if (!targetable(c) || ready(d.timer)) d.mode = 'idle';
    }
    if (canFire(c) && d.traps.length < Math.min(6, c.skill.poolSize ?? 3)) {
      const at = c.self.body.getPosition(), enemy = c.target.body.getPosition(), velocity = c.target.body.getLinearVelocity();
      const limit = c.engine.half - .2, lead = c.skill.windup ?? .6;
      const predicted = { x: Math.max(-limit, Math.min(limit, enemy.x + velocity.x * lead)), y: Math.max(-limit, Math.min(limit, enemy.y + velocity.y * lead)) };
      const aim = direction(at, predicted), reach = Math.min(c.skill.range, distance(at, predicted)), p = { x: at.x + aim.x * reach, y: at.y + aim.y * reach };
      d.traps.push({ at: { x: Math.max(-limit, Math.min(limit, p.x)), y: Math.max(-limit, Math.min(limit, p.y)) }, arm: c.skill.windup ?? .6, life: c.skill.duration });
      c.state.cooldown = c.skill.cooldown; c.state.activations++;
    }
  } },
  'ace-in-the-hole': { tick: (c: SkillContext) => {
    tickCooldown(c); const d = leagueState(c.state);
    if (d.mode === 'windup') { c.state.aim = direction(c.self.body.getPosition(), c.target.body.getPosition()); windup(c); }
    else if (d.mode === 'outbound') {
      d.timer -= c.dt;
      const result = advance(c, d, c.skill.power, direction(d.at, c.target.body.getPosition()), distance(d.at, c.target.body.getPosition()));
      if (result.hit) { c.engine.queueHit(c.self, c.target, c.skill.damage); c.state.flash = .45; d.mode = 'idle'; }
      else if (!targetable(c) || ready(d.timer)) { d.mode = 'idle'; c.state.flash = .15; }
    } else if (canFire(c) && distance(c.self.body.getPosition(), c.target.body.getPosition()) <= c.skill.range) castWindup(c);
  } },
  'urchin-strike': { tick: (c: SkillContext) => {
    tickCooldown(c); const d = leagueState(c.state);
    if (d.mode === 'dash') {
      const before = { ...c.self.body.getPosition() };
      if (!interrupted(c) && d.anchor) {
        lock(c); const aim = direction(before, d.anchor), travel = Math.min(Math.max(.1, c.skill.power) * c.dt, distance(before, d.anchor));
        c.engine.teleport(c.self, { x: before.x + aim.x * travel, y: before.y + aim.y * travel }); d.trail.push(before); if (d.trail.length > 10) d.trail.shift();
        if (!d.hit && targetable(c) && segmentDistanceSquared(before, c.self.body.getPosition(), c.target.previous, c.target.body.getPosition()) <= (c.target.definition.stats.radius + c.self.definition.stats.radius) ** 2) {
          c.engine.queueHit(c.self, c.target, c.skill.damage + c.self.definition.stats.contactDamage); d.hit = true; c.state.flash = .3;
          c.self.contactHits.set(c.target.id, c.engine.elapsed + c.self.definition.stats.contactInterval);
        }
      }
      d.timer = Math.max(0, d.timer - c.dt);
      if (ready(d.timer) || interrupted(c) || d.anchor && distance(c.self.body.getPosition(), d.anchor) < .025) { release(c); c.engine.setGhosting(c.self, 0); d.mode = 'idle'; }
    } else if (canFire(c) && distance(c.self.body.getPosition(), c.target.body.getPosition()) <= c.skill.range + c.target.definition.stats.radius) {
      initialize(c, 'dash'); const enemy = c.target.body.getPosition(), limit = c.engine.half - c.self.definition.stats.radius;
      const gap = c.self.definition.stats.radius + c.target.definition.stats.radius + .08;
      d.anchor = { x: Math.max(-limit, Math.min(limit, enemy.x + d.aim.x * gap)), y: Math.max(-limit, Math.min(limit, enemy.y + d.aim.y * gap)) };
      d.timer = Math.min(3, distance(d.origin, d.anchor) / Math.max(.1, c.skill.power) + c.dt); lock(c); c.engine.setGhosting(c.self, d.timer + c.dt);
    }
  } },
  'playful-trickster': { tick: (c: SkillContext) => {
    tickCooldown(c); const d = leagueState(c.state);
    if (d.mode === 'airborne' && d.anchor) {
      lock(c); d.timer = Math.max(0, d.timer - c.dt); c.state.active = d.timer;
      const t = Math.min(1, 1 - d.timer / c.skill.duration); c.engine.teleport(c.self, { x: d.origin.x + (d.anchor.x - d.origin.x) * t, y: d.origin.y + (d.anchor.y - d.origin.y) * t });
      if (ready(d.timer)) {
        release(c); c.engine.setPhasing(c.self, 0); d.mode = 'idle'; d.anchor = { ...c.self.body.getPosition() }; c.state.flash = .55;
        if (targetable(c) && distance(d.anchor, c.target.body.getPosition()) <= (c.skill.zoneRadius ?? 1.05) + c.target.definition.stats.radius) { c.engine.queueHit(c.self, c.target, c.skill.damage); c.engine.slow(c.target, c.skill.slow ?? .35, c.skill.slowDuration ?? .8); }
      }
    } else if (canFire(c)) {
      initialize(c, 'airborne'); const reach = Math.min(c.skill.range, distance(d.origin, c.target.body.getPosition())), limit = c.engine.half - c.self.definition.stats.radius;
      d.anchor = { x: Math.max(-limit, Math.min(limit, d.origin.x + d.aim.x * reach)), y: Math.max(-limit, Math.min(limit, d.origin.y + d.aim.y * reach)) };
      d.timer = c.skill.duration; c.state.active = d.timer; lock(c); c.engine.setPhasing(c.self, c.skill.duration + c.dt);
    }
  } },
  'chum-the-waters': { tick: (c: SkillContext) => {
    tickCooldown(c); const d = leagueState(c.state);
    if (d.mode === 'outbound') {
      const result = advance(c, d, c.skill.power, d.aim, c.skill.range - d.travel);
      if (result.hit || result.wall || d.travel >= c.skill.range - .0001) { d.mode = 'bait'; d.attached = result.hit; d.timer = c.skill.duration; d.anchor = { ...d.at }; }
    } else if (d.mode === 'bait') {
      d.timer = Math.max(0, d.timer - c.dt); c.state.active = d.timer;
      if (!d.attached && targetable(c) && distance(d.at, c.target.body.getPosition()) <= c.target.definition.stats.radius + .15) d.attached = true;
      if (d.attached) { d.at = { ...c.target.body.getPosition() }; if (targetable(c)) c.engine.slow(c.target, c.skill.slow ?? .35, c.dt * 3); }
      d.anchor = { ...d.at };
      if (ready(d.timer)) {
        d.mode = 'idle'; c.state.flash = .8;
        const factor = sharkMultiplier(c.skill, d);
        if (targetable(c) && distance(d.at, c.target.body.getPosition()) <= (c.skill.zoneRadius ?? 1.1) * factor + c.target.definition.stats.radius) {
          c.engine.queueHit(c.self, c.target, c.skill.damage * factor); c.engine.control(c.target, key(c), c.skill.controlDuration ?? .5);
          c.engine.slow(c.target, c.skill.slow ?? .35, 1);
        }
      }
    } else if (canFire(c)) initialize(c, 'outbound');
  } },
};
