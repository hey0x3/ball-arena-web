import { Graphics } from 'pixi.js';
import type { Point, Simulation } from '../simulation/engine';
import { direction } from '../simulation/geometry';
import { presentedPosition } from './presentation';
import { drawChampionEffects } from './champion-effects';
import { drawPudgeEffects } from './pudge-effects';
import { drawLeagueEffects } from './league-effects';

type Surface = { under: Graphics; over: Graphics; point: (p: Point) => Point; scale: number; alpha: number };
const tau = Math.PI * 2;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const fract = (v: number) => v - Math.floor(v);
const offset = (p: Point, d: Point, along: number, across = 0): Point => ({ x: p.x + d.x * along - d.y * across, y: p.y + d.y * along + d.x * across });
function line(g: Graphics, a: Point, b: Point, color: number, width: number, alpha: number) {
  g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color, width, alpha, cap: 'round' });
}
function star(g: Graphics, p: Point, radius: number, color: number, alpha: number, rotation = 0) {
  const points: number[] = [];
  for (let i = 0; i < 8; i++) { const a = i * tau / 8 + rotation, r = i % 2 ? radius * .22 : radius; points.push(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); }
  g.poly(points).fill({ color, alpha });
}
function burst(g: Graphics, p: Point, radius: number, life: number, color: number, count = 9) {
  const t = clamp(life), age = 1 - t;
  for (let i = 0; i < count; i++) {
    const a = i * tau / count + .19, d = { x: Math.cos(a), y: Math.sin(a) }, travel = radius * (.8 + age * .9 + (i % 3) * .08);
    line(g, offset(p, d, travel), offset(p, d, travel + (5 + i % 3 * 3) * t), color, 2.3 * t + .4, t * .9);
  }
}
function motes(g: Graphics, p: Point, radius: number, time: number, color: number, count = 7) {
  for (let i = 0; i < count; i++) {
    const phase = fract(time * 1.7 + i * .618), a = i * 2.4 + time * .7;
    const at = { x: p.x + Math.cos(a) * radius * (1.65 - phase * .7), y: p.y + Math.sin(a) * radius * (1.65 - phase * .7) };
    star(g, at, 2 + phase * 3, color, Math.sin(phase * Math.PI) * .85, a);
  }
}
function wake(g: Graphics, p: Point, d: Point, radius: number, length: number, time: number, color: number, strength: number) {
  const tail = offset(p, d, -radius - length), left = offset(p, d, -radius * .25, radius * .65), right = offset(p, d, -radius * .25, -radius * .65);
  g.poly([left.x, left.y, tail.x, tail.y, right.x, right.y]).fill({ color, alpha: .18 * strength });
  line(g, offset(p, d, -radius * .65), tail, color, radius * .5, .22 * strength);
  line(g, offset(p, d, -radius * .7), offset(p, d, -radius - length * .8), 0xffebae, 4, .6 * strength);
  for (let i = 0; i < 9; i++) {
    const phase = fract(time * 3 + i * .618), across = Math.sin(i * 7.1) * radius * .72;
    const a = offset(p, d, -radius - phase * length, across * (1 - phase * .5));
    line(g, a, offset(a, d, -8 - phase * 17), i % 3 ? color : 0xfff2ca, 1.5 + (1 - phase) * 2, (1 - phase) * .8 * strength);
  }
}

/** Presentation only: all phases, motion and clocks come from the fixed-step world. */
export function drawSkillEffects(sim: Simulation, { under, over, point, scale, alpha }: Surface) {
  under.clear(); over.clear();
  if (sim.phase === 'finished') return;
  const time = sim.elapsed;
  for (const f of sim.fighters) {
    if (f.hp <= 0) continue;
    const at = point(presentedPosition(f, alpha)), target = sim.opponent(f), to = point(presentedPosition(target, alpha));
    const toward = direction(at, to), radius = f.definition.stats.radius * scale, velocity = f.body.getLinearVelocity();
    const moving = Math.hypot(velocity.x, velocity.y) > .05, travel = direction({ x: 0, y: 0 }, { x: velocity.x, y: -velocity.y });
    f.definition.skills.forEach((skill, index) => {
      const state = f.skills[index];
      switch (skill.type) {
        case 'dash': {
          if (state.targeting) {
            const aim = { x: state.aim.x, y: -state.aim.y }, progress = clamp(1 - state.cooldown / (skill.windup ?? .7));
            const end = Math.min(1.1 * scale, Math.hypot(to.x - at.x, to.y - at.y) - target.definition.stats.radius * scale - .07 * scale);
            const start = radius + .07 * scale;
            if (end > start + .03 * scale) {
              const tip = offset(at, aim, end), a = offset(at, aim, start);
              line(under, a, tip, 0xff5d1f, 13, .12 + progress * .1);
              line(over, a, tip, 0xffa844, 2.5 + progress * 2, .65 + progress * .3);
              const left = offset(tip, aim, -13, 7), right = offset(tip, aim, -13, -7);
              over.poly([left.x, left.y, tip.x, tip.y, right.x, right.y]).fill({ color: 0xffdd9a, alpha: .9 });
            }
            motes(over, at, radius, time * 1.5, 0xffb443, 9);
          }
          if (state.active > 0) {
            if (moving) wake(under, at, travel, radius, scale * 1.25, time, 0xff6c20, 1);
            motes(over, at, radius * .8, time * 2, 0xffe7ae, 7);
            star(over, offset(at, travel, radius * .85), 10 + Math.sin(time * 28) * 3, 0xfff1cd, .9, time);
          }
          if (state.flash > 0) burst(over, at, radius, state.flash / .2, 0xffd09a, 14);
          break;
        }
        case 'wall-charge': {
          const charge = state.charges / (skill.maxCharges ?? 3), color = 0xffbd3b;
          if (charge > 0 && moving) wake(under, at, travel, radius * .8, scale * (.2 + charge * .5), time, color, charge * .75);
          if (charge > 0 && time - state.lastWall < .2) burst(over, at, radius, 1 - (time - state.lastWall) / .2, color, 6);
          if (state.flash > 0) burst(over, at, radius, state.flash / .45, 0xffe5a1, 12);
          break;
        }
        case 'rotating-blade': {
          if (state.flash > 0) {
            const edge = offset(at, toward, radius * skill.range);
            star(over, edge, 15 * clamp(state.flash / .16), 0xffffff, .95, time * 4);
            burst(over, edge, 8, state.flash / .16, 0xc8e7ff, 7);
          }
          break;
        }
        case 'projectile': {
          if (state.flash > 0) {
            const aim = { x: state.aim.x, y: -state.aim.y }, muzzle = offset(at, aim, radius + .1 * scale), t = clamp(state.flash / .18);
            star(over, muzzle, 19 * t + 3, 0xffdb68, t, time);
            star(over, muzzle, 10 * t + 2, 0xfff7dd, t, time + .3);
          }
          break;
        }
        case 'shield': {
          if (state.capacity > 0) {
            const count = Math.max(1, Math.ceil(3 * state.capacity / Math.max(1, skill.damage))), facing = Math.atan2(toward.y, toward.x);
            const pulse = .5 + .5 * Math.sin(time * 5);
            for (let i = 0; i < count; i++) {
              const a = facing + (i - (count - 1) / 2) * .48, d = { x: Math.cos(a), y: Math.sin(a) };
              const p = offset(at, d, radius + 6 + Math.sin(time * 7 + i * .9) * 3), vertices: number[] = [];
              for (let j = 0; j < 6; j++) { const angle = j * tau / 6 + a; vertices.push(p.x + Math.cos(angle) * 10, p.y + Math.sin(angle) * 14); }
              over.poly(vertices).fill({ color: 0x63d7ff, alpha: .18 + pulse * .28 });
              line(over, { x: vertices[0], y: vertices[1] }, { x: vertices[2], y: vertices[3] }, 0xc0f7ff, 2, .8);
            }
          }
          if (state.flash > 0) burst(over, at, radius, state.flash / .22, state.capacity > 0 ? 0xbffaff : 0x67cfff, 10);
          break;
        }
        case 'magnet': {
          if (state.active <= 0) break;
          motes(over, at, radius, time, 0xeaadff, 7);
          if (state.lastForce <= 0) break;
          const from = offset(to, toward, -target.definition.stats.radius * scale - 4), end = offset(at, toward, radius + 4);
          for (const side of [-1, 1]) {
            under.moveTo(from.x, from.y);
            for (let i = 1; i <= 18; i++) {
              const t = i / 18, across = Math.sin(t * Math.PI) * Math.sin(t * tau * 2 - time * 13) * 8 * side;
              const p = offset({ x: from.x + (end.x - from.x) * t, y: from.y + (end.y - from.y) * t }, toward, 0, across);
              under.lineTo(p.x, p.y);
            }
            under.stroke({ color: 0xd17bff, width: 2, alpha: .5 });
          }
          for (let i = 0; i < 5; i++) {
            const t = fract(time * 1.8 + i / 5), p = { x: from.x + (end.x - from.x) * t, y: from.y + (end.y - from.y) * t };
            const tip = offset(p, toward, -5), left = offset(p, toward, 4, 5), right = offset(p, toward, 4, -5);
            over.moveTo(left.x, left.y).lineTo(tip.x, tip.y).lineTo(right.x, right.y).stroke({ color: 0xf2c9ff, width: 2.8, alpha: .95 });
          }
          break;
        }
        case 'beam': {
          if (state.targeting) {
            motes(over, at, radius, time * 1.3, 0xdca2ff, 6);
            for (let i = 1; i < state.path.length; i++) star(over, point(state.path[i]), 5 + Math.sin(time * 18) * 1.5, 0xd49aff, .65, time);
          }
          if (state.flash > 0) {
            star(over, at, radius * 1.25 * clamp(state.flash / .2), 0xe9c8ff, .6, time);
            for (let i = 1; i < state.path.length; i++) star(over, point(state.path[i]), 18 * clamp(state.flash / .2), 0xf4e7ff, .9, time);
          }
          break;
        }
        case 'trail': {
          if (state.flash > 0) burst(over, to, target.definition.stats.radius * scale, state.flash / .25, 0xffbc55, 8);
          break;
        }
        case 'puck': {
          if (state.cooldown <= .0001 && sim.puck?.present) {
            for (let i = 0; i < 3; i++) {
              const a = time * 2 + i * tau / 3, p = { x: at.x + Math.cos(a) * (radius + 10), y: at.y + Math.sin(a) * (radius + 10) };
              star(over, p, 9 + Math.sin(time * 9 + i) * 2, 0x9cffff, .95, a);
              star(over, p, 4, 0xf2ffff, .95, a);
            }
          }
          if (state.flash > 0) burst(over, at, radius, state.flash / .25, 0xb8ffff, 10);
          break;
        }
      }
    });
  }
  for (const projectile of sim.projectiles) {
    const at = point({ x: projectile.previous.x + (projectile.x - projectile.previous.x) * alpha, y: projectile.previous.y + (projectile.y - projectile.previous.y) * alpha });
    const d = direction({ x: 0, y: 0 }, { x: projectile.vx, y: -projectile.vy });
    line(under, at, offset(at, d, -.32 * scale), 0xffbe45, 5, .3);
  }
  if (sim.puck?.present) {
    const puck = sim.puck, at = point(puck.body.getPosition()), v = puck.body.getLinearVelocity();
    if (puck.armed) wake(under, at, direction({ x: 0, y: 0 }, { x: v.x, y: -v.y }), .16 * scale, scale * (puck.powered ? .65 : .25), time, puck.powered ? 0x7bffff : 0x7aaac9, puck.powered ? .85 : .4);
    if (time - puck.lastStrike < .2) star(over, at, 29 * (1 - (time - puck.lastStrike) / .2), 0xdcffff, .9, time);
  }
  for (const hit of sim.particles) if (hit.kind === 'hit' && hit.life > hit.duration - .22) {
    burst(over, point(hit), 10, (hit.life - hit.duration + .22) / .22, hit.text === 'BLOCK' ? 0xa9eaff : 0xffdfb3, 8);
  }
  drawChampionEffects(sim, { under, over, point, scale, alpha });
  drawPudgeEffects(sim, { under, over, point, scale, alpha });
  drawLeagueEffects(sim, { under, over, point, scale, alpha });
}
