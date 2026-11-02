import type { Fighter, Point, SkillContext, SkillState } from '../simulation/engine';
import { direction, segmentDistanceSquared } from '../simulation/geometry';

export type PudgeState = {
  mode: 'idle' | 'windup' | 'outbound' | 'reeling' | 'miss' | 'channel' | 'interrupted';
  at: Point; previous: Point; origin: Point; aim: Point; timer: number; tick: number; travel: number; revision: number;
};
export function pudgeState(state: SkillState): PudgeState {
  return state.pudge ??= { mode: 'idle', at: { x: 0, y: 0 }, previous: { x: 0, y: 0 }, origin: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, timer: 0, tick: 0, travel: 0, revision: 0 };
}
const ready = (n: number) => n <= .0002;
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const keyFor = (c: SkillContext) => `pudge:${c.self.id}:${c.skill.id}`;
function release(c: SkillContext, mode: PudgeState['mode'] = 'idle') {
  const key = keyFor(c);
  c.engine.release(c.self, key); c.engine.release(c.target, key);
  if (c.self.channeling === key) c.self.channeling = null;
  c.state.active = 0; c.state.targeting = false; pudgeState(c.state).mode = mode;
}
function lock(c: SkillContext, fighter: Fighter, disable = true) { c.engine.control(fighter, keyFor(c), c.dt * 3, disable); }
function begin(c: SkillContext, mode: PudgeState['mode']) {
  const data = pudgeState(c.state);
  data.mode = mode; data.origin = { ...c.self.body.getPosition() }; data.at = { ...data.origin }; data.previous = { ...data.at };
  data.aim = direction(data.origin, c.target.body.getPosition()); data.travel = 0; data.revision = c.self.interruptions;
  c.state.aim = { ...data.aim }; c.state.activations++; c.state.cooldown = c.skill.cooldown;
  c.self.channeling = keyFor(c); lock(c, c.self, false);
}
export const pudgeBehaviors = {
  'meat-hook': { tick: (c: SkillContext) => {
    const { engine, self, target, state, skill, dt } = c, data = pudgeState(state);
    state.cooldown = Math.max(0, state.cooldown - dt);
    if (data.mode === 'windup') {
      if (engine.disabled(self) || self.untargetableUntil > engine.elapsed) { release(c, 'interrupted'); state.flash = .25; return; }
      lock(c, self, false); data.timer = Math.max(0, data.timer - dt);
      if (ready(data.timer)) { data.mode = 'outbound'; state.targeting = false; }
    } else if (data.mode === 'outbound') {
      lock(c, self, false); data.previous = { ...data.at };
      const travel = Math.min(Math.max(.1, skill.power) * dt, skill.range - data.travel), limit = engine.half - .12;
      const next = { x: data.at.x + data.aim.x * travel, y: data.at.y + data.aim.y * travel };
      data.at = { x: Math.max(-limit, Math.min(limit, next.x)), y: Math.max(-limit, Math.min(limit, next.y)) }; data.travel += travel;
      if (target.untargetableUntil <= engine.elapsed && segmentDistanceSquared(data.previous, data.at, target.previous, target.body.getPosition()) <= (target.definition.stats.radius + .12) ** 2) {
        data.mode = 'reeling'; engine.queueHit(self, target, skill.damage); state.lastDamage = skill.damage; state.flash = .3;
        lock(c, target); data.at = { ...target.body.getPosition() };
      } else if (data.travel >= skill.range - .0001 || data.at.x !== next.x || data.at.y !== next.y) data.mode = 'miss';
    } else if (data.mode === 'reeling' || data.mode === 'miss') {
      lock(c, self, false); data.previous = { ...data.at };
      if (data.mode === 'reeling' && target.untargetableUntil > engine.elapsed) { engine.release(target, keyFor(c)); data.mode = 'miss'; }
      const origin = self.body.getPosition(), hooked = data.mode === 'reeling';
      if (hooked) { lock(c, target); data.at = { ...target.body.getPosition() }; }
      const aim = direction(data.at, origin), gap = hooked ? self.definition.stats.radius + target.definition.stats.radius + .035 : .1;
      const remaining = Math.max(0, distance(data.at, origin) - gap), travel = Math.min(Math.max(.1, skill.power) * dt, remaining);
      data.at = { x: data.at.x + aim.x * travel, y: data.at.y + aim.y * travel };
      if (hooked) engine.teleport(target, data.at);
      if (remaining <= travel + .0001) { release(c); state.flash = .3; }
    } else if (ready(state.cooldown) && engine.canAct(self) && target.untargetableUntil <= engine.elapsed) {
      begin(c, 'windup'); data.timer = skill.windup ?? .18; state.targeting = true;
    }
  } },
  rot: { tick: (c: SkillContext) => {
    const { engine, self, target, state, skill, dt } = c;
    const active = self.untargetableUntil <= engine.elapsed && target.untargetableUntil <= engine.elapsed && distance(self.body.getPosition(), target.body.getPosition()) <= skill.range + target.definition.stats.radius;
    const interval = skill.tickInterval ?? .2;
    if (!active) { state.active = 0; state.cooldown = interval; return; }
    if (!state.active) { state.activations++; state.cooldown = interval; }
    state.active = 1; engine.slow(target, skill.slow ?? .25, dt * 2);
    state.cooldown = Math.max(0, state.cooldown - dt);
    if (ready(state.cooldown)) {
      engine.queueHit(self, target, skill.damage); engine.queueSelfDamage(self, skill.selfDamage ?? skill.damage);
      state.cooldown = interval; state.flash = .15; state.lastDamage = skill.damage;
    }
  } },
  dismember: { tick: (c: SkillContext) => {
    const { engine, self, target, state, skill, dt } = c, data = pudgeState(state);
    state.cooldown = Math.max(0, state.cooldown - dt);
    const gap = self.definition.stats.radius + target.definition.stats.radius, reach = gap + skill.range;
    if (data.mode === 'channel') {
      if (self.interruptions !== data.revision || engine.disabled(self) || self.untargetableUntil > engine.elapsed || target.untargetableUntil > engine.elapsed || distance(self.body.getPosition(), target.body.getPosition()) > reach + .35) {
        release(c, 'interrupted'); state.flash = .35; return;
      }
      lock(c, self, false); lock(c, target);
      const remaining = Math.max(0, distance(self.body.getPosition(), target.body.getPosition()) - gap - .035), aim = direction(target.body.getPosition(), self.body.getPosition());
      const travel = Math.min(skill.power * dt, remaining), at = target.body.getPosition();
      if (travel > 0) engine.teleport(target, { x: at.x + aim.x * travel, y: at.y + aim.y * travel });
      const step = Math.min(dt, state.active); state.active = Math.max(0, state.active - step); data.tick -= step;
      if (ready(data.tick)) {
        engine.queueHit(self, target, skill.damage, { x: 0, y: 0 }, skill.healRatio ?? 1);
        data.tick += skill.tickInterval ?? .5; state.flash = .25; state.lastDamage = skill.damage;
      }
      if (ready(state.active)) release(c);
    } else if (ready(state.cooldown) && engine.canAct(self) && target.untargetableUntil <= engine.elapsed && distance(self.body.getPosition(), target.body.getPosition()) <= reach) {
      begin(c, 'channel'); state.active = skill.duration; data.tick = skill.tickInterval ?? .5; lock(c, target); state.flash = .25;
    }
  } },
};
