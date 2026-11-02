import type { SkillType } from '../content/schema';
import { effectiveRadius, storedImpulse, type SkillContext } from '../simulation/engine';
import { bladePoints, buildBeamPath, direction, length, polygonTouchesCircle } from '../simulation/geometry';
import { championBehaviors } from './champions';
import { pudgeBehaviors } from './pudge';
import { leagueBehaviors } from './league';

type Behavior = { tick?: (c: SkillContext) => void; wall?: (c: SkillContext, impact: number) => void; contact?: (c: SkillContext) => void };
const expires = (remaining: number) => remaining <= .0002;
export const behaviors: Record<SkillType, Behavior> = {
  ...championBehaviors,
  ...pudgeBehaviors,
  ...leagueBehaviors,
  'wall-charge': {
    tick: ({ state, skill }) => {
      if (state.pendingBounce) { state.pendingBounce = false; state.charges = Math.min(skill.maxCharges ?? 3, state.charges + 1); }
    },
    wall: ({ engine, state, skill }, impact) => {
      if (impact < (skill.minimumImpact ?? 1) || engine.elapsed < state.lastWall + skill.cooldown - .000001) return;
      state.lastWall = engine.elapsed; state.pendingBounce = true;
    },
    contact: ({ engine, self, target, state, skill, direction: d }) => {
      if (!state.charges) return;
      const impulse = storedImpulse(skill, state); state.lastDamage = engine.nextContactDamage(self);
      engine.applyImpulse(target, { x: d.x * impulse, y: d.y * impulse }); state.charges = 0; state.flash = .45;
    },
  },
  'rotating-blade': {
    tick: ({ engine, self, target, state, skill }) => {
      const a = self.body.getPosition(), b = target.body.getPosition();
      const vertices = bladePoints(self.definition.stats.radius, skill.range, engine.elapsed * (skill.rotationSpeed ?? 180) * Math.PI / 180);
      if (polygonTouchesCircle(vertices, { x: b.x - a.x, y: b.y - a.y }, target.definition.stats.radius)) engine.reserveWeapon(self, target, skill, state);
    },
    contact: ({ state, skill }) => { state.flash = .16; state.lastDamage = skill.damage; },
  },
  projectile: {
    tick: ({ engine, self, skill, state, direction: d }) => {
      state.cooldown = Math.max(0, state.cooldown - .02);
      if (!expires(state.cooldown) || !engine.canAct(self)) return;
      state.cooldown = skill.cooldown;
      if (engine.projectile(self, skill, d)) { state.activations++; state.flash = .18; state.aim = { ...d }; }
    },
  },
  shield: {
    tick: ({ engine, self, skill, state, dt }) => {
      if (state.capacity > 0) { state.active = Math.max(0, state.active - dt); if (expires(state.active)) { state.capacity = 0; state.active = 0; } }
      state.cooldown = Math.max(0, state.cooldown - dt);
      if (expires(state.cooldown) && engine.canAct(self)) { state.capacity = skill.damage; state.active = skill.duration; state.cooldown = skill.cooldown; state.activations++; state.flash = .18; }
    },
  },
  magnet: {
    tick: ({ engine, self, target, skill, state, direction: d, dt }) => {
      state.lastForce = 0;
      if (state.pendingBounce) {
        state.pendingBounce = false;
        if (state.active <= 0 && ++state.charges >= (skill.maxCharges ?? 3)) {
          state.charges = 0; state.active = skill.duration; state.activations++;
          engine.effect('pulse', self.body.getPosition(), '#e06bff', skill.duration);
        }
      }
      if (state.active <= 0) return;
      const a = self.body.getPosition(), b = target.body.getPosition(), distance = Math.hypot(a.x - b.x, a.y - b.y);
      const gap = distance - effectiveRadius(self) - effectiveRadius(target), step = Math.min(state.active, dt);
      if (distance <= skill.range && gap > .12 && distance >= .001) {
        state.lastForce = skill.power * Math.min(1, (gap - .12) / .65);
        engine.applyForce(target, { x: -d.x * state.lastForce * step / dt, y: -d.y * state.lastForce * step / dt });
      }
      state.active = Math.max(0, state.active - step); if (!state.active) state.lastForce = 0;
    },
    wall: ({ engine, state, skill }, impact) => {
      if (state.active > 0 || impact < (skill.minimumImpact ?? 1) || engine.elapsed < state.lastWall + (skill.bounceInterval ?? .15) - .000001) return;
      state.lastWall = engine.elapsed; state.pendingBounce = true;
    },
  },
  trail: { tick: ({ engine, self, skill, state }) => engine.emitTrail(self, skill, state) },
  beam: {
    tick: ({ engine, self, skill, state, dt }) => {
      state.cooldown = Math.max(0, state.cooldown - dt);
      if (!engine.canAct(self)) { state.targeting = false; return; }
      if (!state.targeting && state.cooldown <= skill.duration + .000001) {
        state.aim = direction({ x: 0, y: 0 }, self.body.getLinearVelocity()); state.targeting = true;
      }
      if (state.targeting) state.path = buildBeamPath(self.body.getPosition(), state.aim, skill.range, skill.reflections ?? 2, engine.half);
      if (state.cooldown <= .0001) {
        state.path = engine.beam(self, skill, state.aim); state.cooldown = skill.cooldown;
        state.targeting = false; state.flash = .2; state.activations++;
      }
    },
  },
  dash: {
    tick: ({ engine, self, skill, state, direction: d, dt }) => {
      state.active = Math.max(0, state.active - dt); state.cooldown = Math.max(0, state.cooldown - dt);
      if (!engine.canAct(self)) { state.targeting = false; state.active = 0; return; }
      if (!state.targeting && state.cooldown <= (skill.windup ?? .7) + .000001) { state.aim = { ...d }; state.targeting = true; }
      if (state.cooldown <= .0001) {
        const v = self.body.getLinearVelocity(), mass = self.body.getMass();
        engine.applyImpulse(self, { x: (state.aim.x * skill.range - v.x) * mass, y: (state.aim.y * skill.range - v.y) * mass });
        state.active = skill.duration; state.cooldown = skill.cooldown; state.targeting = false; state.activations++;
        engine.effect('dash', self.body.getPosition(), self.definition.appearance.color, skill.duration);
      }
    },
    contact: ({ engine, target, skill, state, direction: d }) => {
      if (state.active <= 0) return;
      state.active = 0; state.flash = .2; engine.applyImpulse(target, { x: d.x * skill.power, y: d.y * skill.power });
    },
  },
  puck: { tick: ({ state, dt }) => { state.cooldown = Math.max(0, state.cooldown - dt); } },
};
