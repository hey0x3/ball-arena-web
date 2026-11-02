import type { Skill } from '../content/schema';
import type { Fighter, Point, Simulation, SkillContext, SkillState } from '../simulation/engine';
import { direction, length, polygonTouchesCircle, segmentDistanceSquared } from '../simulation/geometry';

export type ChampionType = 'darkin-blade' | 'infernal-chains' | 'world-ender' | 'timewinder' | 'phase-dive' | 'chronobreak';
export type StrikeShape = { stage: number; origin: Point; aim: Point; polygon: Point[]; sweet: Point[]; center: Point; radius: number; sweetRadius: number };
export type Device = { at: Point; previous: Point; aim: Point; travel: number; phase: 'outbound' | 'field' | 'returning'; timer: number; outboundHit: boolean; returnHit: boolean };
export type ChampionState = {
  mode: string; timer: number; stage: number; anchor: Point | null; origin: Point; velocity: Point;
  damageAtAnchor: number; trace: Point[]; device: Device | null; strike: StrikeShape | null;
};
export function championState(state: SkillState): ChampionState {
  return state.champion ??= { mode: '', timer: 0, stage: 0, anchor: null, origin: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, damageAtAnchor: 0, trace: [], device: null, strike: null };
}
const point = (origin: Point, aim: Point, x: number, y: number): Point => ({ x: origin.x + aim.x * x - aim.y * y, y: origin.y + aim.y * x + aim.x * y });
const ready = (time: number) => time <= .0002;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const canCast = (engine: Simulation, self: Fighter) => engine.canAct(self);
export function darkinShape(origin: Point, aim: Point, stage: number, range: number): StrikeShape {
  const r = range / 1.8, transform = (vertices: number[][]) => vertices.map(([x, y]) => point(origin, aim, x * r, y * r));
  const polygon = stage === 1 ? transform([[.2, -.30], [1.8, -.30], [1.8, .30], [.2, .30]]) : stage === 2 ? transform([[.2, -.4], [1.45, -.85], [1.45, .85], [.2, .4]]) : [];
  const sweet = stage === 1 ? transform([[1.42, -.30], [1.8, -.30], [1.8, .30], [1.42, .30]]) : stage === 2 ? transform([[1.12, -.73], [1.45, -.85], [1.45, .85], [1.12, .73]]) : [];
  return { stage, origin: { ...origin }, aim: { ...aim }, polygon, sweet, center: point(origin, aim, .63 * r, 0), radius: .83 * r, sweetRadius: .33 * r };
}
export function strikeHit(shape: StrikeShape, at: Point, radius: number) {
  if (shape.stage === 3) return { hit: distance(at, shape.center) <= shape.radius + radius, sweet: distance(at, shape.center) <= shape.sweetRadius + radius * .35 };
  const relative = (vertices: Point[]) => vertices.map(p => ({ x: p.x - at.x, y: p.y - at.y }));
  return { hit: polygonTouchesCircle(relative(shape.polygon), { x: 0, y: 0 }, radius), sweet: polygonTouchesCircle(relative(shape.sweet), { x: 0, y: 0 }, radius * .35) };
}
export function historyAt(fighter: Fighter, at: number) {
  let sample = fighter.history[0];
  for (const entry of fighter.history) { if (entry.time > at + .000001) break; sample = entry; }
  return sample;
}
export function worldEnder(f: Fighter) {
  let damage = 1, speed = 1, healing = 1, leech = 0;
  f.definition.skills.forEach((skill, index) => { if (skill.type === 'world-ender' && f.skills[index].active > 0) {
    damage = Math.max(damage, skill.damageMultiplier ?? 1.25); speed = Math.max(speed, skill.speedMultiplier ?? 1.2);
    healing = Math.max(healing, skill.healMultiplier ?? 1.5); leech = Math.max(leech, skill.healRatio ?? .18);
  } });
  return { damage, speed, healing, leech };
}
function newDevice(self: Fighter, aim: Point): Device {
  const at = { ...self.body.getPosition() };
  return { at, previous: { ...at }, aim: { ...aim }, travel: 0, phase: 'outbound', timer: 0, outboundHit: false, returnHit: false };
}
function advanceDevice(c: SkillContext, device: Device, speed: number, aim = device.aim) {
  device.previous = { ...device.at };
  const limit = c.engine.half - .12, travel = speed * c.dt;
  const next = { x: device.at.x + aim.x * travel, y: device.at.y + aim.y * travel };
  device.at = { x: Math.max(-limit, Math.min(limit, next.x)), y: Math.max(-limit, Math.min(limit, next.y)) };
  device.travel += distance(device.previous, device.at);
  const target = c.target;
  const hit = target.untargetableUntil <= c.engine.elapsed && segmentDistanceSquared(device.previous, device.at, target.previous, target.body.getPosition()) <= (target.definition.stats.radius + .13) ** 2;
  return { hit, wall: next.x !== device.at.x || next.y !== device.at.y };
}
function swing(c: SkillContext, runtime: ChampionState) {
  runtime.mode = 'windup'; runtime.timer = c.skill.windup ?? .45;
  c.state.aim = direction(c.self.body.getPosition(), c.target.body.getPosition()); c.state.targeting = true;
  c.engine.hold(c.self, runtime.timer);
}
type Behavior = { tick?: (context: SkillContext) => void };
export const championBehaviors: Record<ChampionType, Behavior> = {
  'darkin-blade': { tick: c => {
    const { engine, self, target, state, skill, dt } = c, runtime = championState(state);
    if (engine.disabled(self) && ['windup', 'recast'].includes(runtime.mode)) { runtime.mode = ''; state.targeting = false; state.cooldown = skill.cooldown; return; }
    if (runtime.mode === 'windup') {
      runtime.timer = Math.max(0, runtime.timer - dt);
      if (!ready(runtime.timer)) return;
      runtime.strike = darkinShape(self.body.getPosition(), state.aim, runtime.stage, skill.range);
      const hit = strikeHit(runtime.strike, target.body.getPosition(), target.definition.stats.radius);
      if (hit.hit) {
        const damage = skill.damage * (1 + (runtime.stage - 1) * .25) * (hit.sweet ? skill.sweetSpotMultiplier ?? 1.6 : 1);
        engine.queueHit(self, target, damage); state.lastDamage = Math.round(damage);
        if (hit.sweet) engine.hold(target, skill.controlDuration ?? .22);
      }
      state.activations++; state.flash = .32; state.targeting = false;
      if (runtime.stage < 3) { runtime.mode = 'recast'; runtime.timer = skill.recastInterval ?? .35; }
      else { runtime.mode = ''; state.cooldown = skill.cooldown; }
      return;
    }
    if (runtime.mode === 'recast') { runtime.timer = Math.max(0, runtime.timer - dt); if (ready(runtime.timer) && canCast(engine, self)) { runtime.stage++; swing(c, runtime); } return; }
    state.cooldown = Math.max(0, state.cooldown - dt);
    if (ready(state.cooldown) && canCast(engine, self)) { runtime.stage = 1; swing(c, runtime); }
  } },
  'infernal-chains': { tick: c => {
    const { engine, self, target, skill, state, dt } = c, runtime = championState(state);
    state.cooldown = Math.max(0, state.cooldown - dt);
    if (runtime.device) {
      const result = advanceDevice(c, runtime.device, skill.power);
      if (result.hit) {
        engine.queueHit(self, target, skill.damage); engine.slow(target, skill.slow ?? .25, skill.duration);
        runtime.anchor = { ...target.body.getPosition() }; runtime.device = null; runtime.mode = 'tether'; state.active = skill.duration; state.flash = .2;
      } else if (result.wall || runtime.device.travel >= skill.range) { runtime.device = null; runtime.mode = ''; }
    } else if (runtime.mode === 'tether' && runtime.anchor) {
      const delta = { x: target.body.getPosition().x - runtime.anchor.x, y: target.body.getPosition().y - runtime.anchor.y };
      const zone = skill.zoneRadius ?? 1, along = delta.x * state.aim.x + delta.y * state.aim.y, across = delta.y * state.aim.x - delta.x * state.aim.y;
      if (Math.abs(along) / zone + Math.abs(across) / (zone * .75) > 1 || target.untargetableUntil > engine.elapsed) { runtime.mode = 'escaped'; state.active = 0; state.flash = .3; }
      else {
        state.active = Math.max(0, state.active - dt);
        if (ready(state.active)) { runtime.mode = 'pull'; runtime.timer = .24; }
      }
    } else if (runtime.mode === 'pull' && runtime.anchor) {
      const d = direction(target.body.getPosition(), runtime.anchor), speed = Math.min(10, distance(target.body.getPosition(), runtime.anchor) / Math.max(dt, runtime.timer));
      const velocity = target.body.getLinearVelocity(), mass = target.body.getMass();
      engine.applyImpulse(target, { x: (d.x * speed - velocity.x) * mass, y: (d.y * speed - velocity.y) * mass });
      runtime.timer = Math.max(0, runtime.timer - dt);
      if (ready(runtime.timer)) { engine.teleport(target, runtime.anchor, { x: 0, y: 0 }); engine.hold(target, .12); engine.queueHit(self, target, skill.damage); runtime.mode = 'pulled'; state.flash = .4; }
    }
    if (!runtime.device && !['tether', 'pull'].includes(runtime.mode) && ready(state.cooldown) && canCast(engine, self)) {
      state.aim = direction(self.body.getPosition(), target.body.getPosition()); runtime.device = newDevice(self, state.aim);
      runtime.mode = 'projectile'; runtime.anchor = null; state.cooldown = skill.cooldown; state.activations++;
    }
  } },
  'world-ender': { tick: ({ engine, self, skill, state, dt }) => {
    state.active = Math.max(0, state.active - dt); state.cooldown = Math.max(0, state.cooldown - dt);
    if (ready(state.cooldown) && canCast(engine, self)) { state.active = skill.duration; state.cooldown = skill.cooldown; state.flash = .65; state.activations++; }
  } },
  timewinder: { tick: c => {
    const { engine, self, target, state, skill, dt } = c, runtime = championState(state);
    state.cooldown = Math.max(0, state.cooldown - dt);
    const device = runtime.device;
    if (device?.phase === 'outbound') {
      const result = advanceDevice(c, device, skill.power);
      if (result.hit && !device.outboundHit) { device.outboundHit = true; engine.queueHit(self, target, skill.damage); engine.slow(target, skill.slow ?? .35, skill.slowDuration ?? .75); }
      if (result.hit || result.wall || device.travel >= skill.range) { device.phase = 'field'; device.timer = skill.duration; }
    } else if (device?.phase === 'field') {
      device.previous = { ...device.at }; device.timer = Math.max(0, device.timer - dt);
      if (distance(device.at, target.body.getPosition()) <= .55 + target.definition.stats.radius) engine.slow(target, skill.slow ?? .35, skill.slowDuration ?? .75);
      if (ready(device.timer)) device.phase = 'returning';
    } else if (device?.phase === 'returning') {
      const aim = direction(device.at, self.body.getPosition()), result = advanceDevice(c, device, skill.power * 1.35, aim);
      if (result.hit && !device.returnHit) { device.returnHit = true; engine.queueHit(self, target, skill.returnDamage ?? skill.damage * 1.5); }
      if (distance(device.at, self.body.getPosition()) < self.definition.stats.radius + .2) { runtime.device = null; state.flash = .18; }
    }
    if (!runtime.device && ready(state.cooldown) && canCast(engine, self)) {
      state.aim = direction(self.body.getPosition(), target.body.getPosition()); runtime.device = newDevice(self, state.aim);
      state.cooldown = skill.cooldown; state.activations++;
    }
  } },
  'phase-dive': { tick: c => {
    const { engine, self, target, skill, state, dt } = c, runtime = championState(state);
    state.cooldown = Math.max(0, state.cooldown - dt);
    if (runtime.mode === 'dash') {
      runtime.timer = Math.max(0, runtime.timer - dt);
      if (ready(runtime.timer)) { runtime.mode = 'armed'; state.active = skill.duration; }
    } else if (runtime.mode === 'armed') {
      state.active = Math.max(0, state.active - dt);
      if (ready(state.active)) runtime.mode = '';
      else if (canCast(engine, self) && target.untargetableUntil <= engine.elapsed && distance(self.body.getPosition(), target.body.getPosition()) <= skill.range + target.definition.stats.radius) {
        const aim = direction(self.body.getPosition(), target.body.getPosition()), gap = self.definition.stats.radius + target.definition.stats.radius + .025;
        runtime.origin = { ...self.body.getPosition() }; runtime.anchor = point(target.body.getPosition(), aim, -gap, 0);
        engine.teleport(self, runtime.anchor, { x: aim.x * self.definition.stats.cruiseSpeed, y: aim.y * self.definition.stats.cruiseSpeed });
        engine.queueHit(self, target, skill.damage + self.definition.stats.contactDamage); self.contactHits.set(target.id, engine.elapsed + self.definition.stats.contactInterval);
        state.active = 0; state.flash = .35; state.lastDamage = skill.damage + self.definition.stats.contactDamage; runtime.mode = '';
      }
    }
    if (!runtime.mode && ready(state.cooldown) && canCast(engine, self)) {
      state.aim = direction(self.body.getPosition(), target.body.getPosition()); runtime.origin = { ...self.body.getPosition() }; runtime.anchor = null;
      const v = self.body.getLinearVelocity(), mass = self.body.getMass();
      engine.applyImpulse(self, { x: (state.aim.x * skill.power - v.x) * mass, y: (state.aim.y * skill.power - v.y) * mass });
      runtime.mode = 'dash'; runtime.timer = skill.windup ?? .16; state.cooldown = skill.cooldown; state.activations++;
    }
  } },
  chronobreak: { tick: ({ engine, self, target, skill, state, dt }) => {
    const runtime = championState(state), rewind = skill.rewindSeconds ?? 4;
    state.cooldown = Math.max(0, state.cooldown - dt);
    if (runtime.mode === 'rewind' && runtime.anchor) {
      runtime.timer = Math.max(0, runtime.timer - dt);
      if (ready(runtime.timer)) {
        engine.teleport(self, runtime.anchor, runtime.velocity); engine.setPhasing(self, 0);
        state.lastDamage = engine.heal(self, (skill.heal ?? 10) + Math.max(0, self.damageTaken - runtime.damageAtAnchor) * (skill.healRatio ?? .35));
        runtime.anchor = { ...self.body.getPosition() };
        if (distance(runtime.anchor, target.body.getPosition()) <= skill.range + target.definition.stats.radius) engine.queueHit(self, target, skill.damage);
        runtime.mode = ''; state.flash = .65; state.activations++;
      }
      return;
    }
    if (ready(state.cooldown) && engine.elapsed >= rewind && canCast(engine, self)) {
      const old = historyAt(self, engine.elapsed - rewind);
      runtime.origin = { ...self.body.getPosition() }; runtime.anchor = { ...old.position }; runtime.velocity = { ...old.velocity }; runtime.damageAtAnchor = old.damageTaken;
      runtime.trace = self.history.filter((entry, i) => entry.time >= old.time && i % 5 === 0).map(entry => ({ ...entry.position }));
      runtime.mode = 'rewind'; runtime.timer = skill.duration; state.cooldown = skill.cooldown;
      engine.setPhasing(self, skill.duration); engine.hold(self, skill.duration);
    }
  } },
};
