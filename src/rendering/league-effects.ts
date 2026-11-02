import type { Graphics } from 'pixi.js';
import type { Fighter, Point, Simulation } from '../simulation/engine';
import { buildBeamPath, direction } from '../simulation/geometry';
import { presentedPosition } from './presentation';
import { sharkMultiplier } from '../skills/league';

type Surface = { under: Graphics; over: Graphics; point: (p: Point) => Point; scale: number; alpha: number };
const tau = Math.PI * 2;
const offset = (p: Point, d: Point, along: number, across = 0): Point => ({ x: p.x + d.x * along - d.y * across, y: p.y + d.y * along + d.x * across });
function line(g: Graphics, a: Point, b: Point, color: number, width: number, alpha = 1) { g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color, width, alpha, cap: 'round' }); }
function glow(g: Graphics, p: Point, radius: number, color: number) { g.circle(p.x, p.y, radius * 2.4).fill({ color, alpha: .07 }); g.circle(p.x, p.y, radius * 1.5).fill({ color, alpha: .2 }); g.circle(p.x, p.y, radius).fill({ color, alpha: .85 }); g.circle(p.x - radius * .2, p.y - radius * .2, radius * .45).fill(0xffffff); }
function heart(g: Graphics, p: Point, r: number, alpha = 1) {
  g.circle(p.x, p.y, r * 1.5).fill({ color: 0xfb6db6, alpha: alpha * .12 });
  g.moveTo(p.x, p.y + r).bezierCurveTo(p.x - r * 2, p.y - r * .2, p.x - r, p.y - r * 1.8, p.x, p.y - r * .5).bezierCurveTo(p.x + r, p.y - r * 1.8, p.x + r * 2, p.y - r * .2, p.x, p.y + r).fill({ color: 0xff82c1, alpha }).stroke({ color: 0xffd8ed, width: 1.6, alpha });
}
function crosshair(g: Graphics, p: Point, r: number, time: number, color = 0xee91af) {
  g.circle(p.x, p.y, r).stroke({ color, width: 2, alpha: .75 });
  for (let j = 0; j < 4; j++) { const a = j * tau / 4 + time * .7, d = { x: Math.cos(a), y: Math.sin(a) }; line(g, offset(p, d, r * .7), offset(p, d, r * 1.3), color, 2.5); }
}
function trident(g: Graphics, at: Point, aim: Point, reach: number) {
  const start = offset(at, aim, -reach * .35), end = offset(at, aim, reach);
  line(g, start, end, 0x426e91, 6); line(g, start, end, 0xc0eeff, 2);
  for (const side of [-1, 1]) {
    const a = offset(at, aim, reach * .65, side * 10), b = offset(at, aim, reach * 1.05, side * 10);
    line(g, offset(at, aim, reach * .55), a, 0x67dbf4, 4); line(g, a, b, 0x67dbf4, 4);
  }
  const tip = offset(at, aim, reach * 1.2), left = offset(at, aim, reach * .95, 5), right = offset(at, aim, reach * .95, -5);
  g.poly([tip.x, tip.y, left.x, left.y, right.x, right.y]).fill(0xd6fbff);
}
function splash(g: Graphics, at: Point, radius: number, progress: number, time: number) {
  const fade = 1 - progress;
  for (let j = 0; j < 3; j++) g.ellipse(at.x, at.y, radius * (.3 + progress * .7) + j * 8, radius * (.2 + progress * .65) + j * 5).stroke({ color: j % 2 ? 0xb2ffff : 0x65dce9, width: 3 - j * .6, alpha: fade * .8 });
  for (let j = 0; j < 14; j++) {
    const a = j * tau / 14 + time * .15, reach = radius * (.35 + progress * .9), x = at.x + Math.cos(a) * reach, y = at.y + Math.sin(a) * reach - Math.sin(progress * Math.PI) * 20;
    g.ellipse(x, y, 2.3, 5).fill({ color: 0xa4edfa, alpha: fade });
  }
}
export function leagueLift(fighter: Fighter) {
  const index = fighter.definition.skills.findIndex(s => s.type === 'playful-trickster'), state = fighter.skills[index];
  if (index < 0 || state.league?.mode !== 'airborne') return 0;
  return Math.sin(Math.PI * (1 - state.league.timer / fighter.definition.skills[index].duration)) * 35;
}
export function drawLeagueEffects(sim: Simulation, { under, over, point, scale, alpha }: Surface) {
  if (sim.phase === 'ready' || sim.phase === 'finished') return;
  const time = sim.elapsed;
  for (const self of sim.fighters) {
    const at = point(presentedPosition(self, alpha)), target = sim.opponent(self), prey = point(presentedPosition(target, alpha)), bodyRadius = self.definition.stats.radius * scale;
    self.definition.skills.forEach((skill, i) => {
      const state = self.skills[i], d = state.league; if (!d) return;
      const tip = point({ x: d.previous.x + (d.at.x - d.previous.x) * alpha, y: d.previous.y + (d.at.y - d.previous.y) * alpha });
      const aim = { x: d.aim.x, y: -d.aim.y };
      if (skill.type === 'orb-of-deception' && ['outbound', 'returning'].includes(d.mode)) {
        const color = d.mode === 'returning' ? 0x76edff : 0xe395fa;
        for (let j = 1; j < d.trail.length; j++) line(under, point(d.trail[j - 1]), point(d.trail[j]), color, 3 + j * .6, j / d.trail.length * .5);
        glow(over, tip, 9 + Math.sin(time * 17) * 1.4, color);
        for (let j = 0; j < 3; j++) { const a = time * 7 + j * tau / 3; over.circle(tip.x + Math.cos(a) * 15, tip.y + Math.sin(a) * 9, 2).fill(0xe8e0ff); }
      }
      if (skill.type === 'charm') {
        if (d.mode === 'windup') heart(over, offset(at, aim, bodyRadius + 12), 8 + Math.sin(time * 20) * 2);
        if (d.mode === 'outbound') { for (let j = 0; j < d.trail.length; j += 2) heart(under, point(d.trail[j]), 3, j / d.trail.length * .35); heart(over, tip, 12); }
        if (d.mode === 'charmed') {
          for (let j = 0; j < 4; j++) { const a = time * 2 + j * tau / 4; heart(over, { x: prey.x + Math.cos(a) * 37, y: prey.y - 28 + Math.sin(a) * 12 }, 5 + j % 2); }
          for (let j = 0; j < 5; j++) { const t = (time * .7 + j / 5) % 1; under.circle(prey.x + (at.x - prey.x) * t, prey.y + (at.y - prey.y) * t, 2).fill({ color: 0xffa0d3, alpha: .6 }); }
        }
      }
      if (skill.type === 'spirit-rush') {
        if (d.mode === 'dash' || state.flash > 0) {
          const opacity = d.mode === 'dash' ? .6 : state.flash * 2;
          const origin = point(d.origin); line(under, origin, at, 0xa4ddf8, bodyRadius * 1.3, opacity * .2);
          for (let j = 0; j < 9; j++) {
            const a = Math.atan2(-aim.y, -aim.x) + (j - 4) * .2 + Math.sin(time * 14 + j) * .07, tailAim = { x: Math.cos(a), y: Math.sin(a) };
            const start = offset(at, tailAim, bodyRadius * .35), end = offset(at, tailAim, bodyRadius + 57 + j % 3 * 10);
            const left = offset(at, tailAim, bodyRadius + 25, 15), right = offset(at, tailAim, bodyRadius + 25, -10);
            under.moveTo(start.x, start.y).quadraticCurveTo(left.x, left.y, end.x, end.y).quadraticCurveTo(right.x, right.y, start.x, start.y).fill({ color: j % 2 ? 0xeab7fc : 0x92def1, alpha: opacity });
            line(under, offset(at, tailAim, bodyRadius + 12), end, 0xe7f7ff, 1.2, opacity * .7);
          }
        }
        for (const bolt of d.bolts) { const b = point(bolt.at); line(under, point(bolt.previous), b, 0xffcfef, 4, .8); glow(over, b, 5 + Math.sin(time * 18) * .7, 0xffc7ee); }
      }
      if (skill.type === 'piltover-peacemaker') {
        if (d.mode === 'windup') {
          const path = buildBeamPath(self.body.getPosition(), d.aim, skill.range, 0, sim.half), end = point(path[path.length - 1]);
          line(under, at, end, 0xebc984, 2, .35); glow(over, offset(at, aim, bodyRadius + 8), 4 + (1 - d.timer / (skill.windup ?? .55)) * 7, 0xf5cc7d);
          const p1 = offset(at, aim, bodyRadius + 14, 8), p2 = offset(at, aim, bodyRadius + 30), p3 = offset(at, aim, bodyRadius + 14, -8); over.poly([p1.x, p1.y, p2.x, p2.y, p3.x, p3.y]).stroke({ color: 0xe1addd, width: 2 });
        }
        if (d.mode === 'outbound') { line(over, offset(tip, aim, -37), offset(tip, aim, 15), 0xbd88d4, 13, .16); line(over, offset(tip, aim, -29), offset(tip, aim, 13), 0xe8c286, 5, .9); line(over, offset(tip, aim, -20), offset(tip, aim, 15), 0xfff7dd, 2.3); }
      }
      if (skill.type === 'yordle-snap-trap') {
        for (const trap of d.traps) {
          const p = point(trap.at), armed = trap.arm <= .0002, r = .2 * scale;
          under.ellipse(p.x, p.y + 3, r * 1.25, r * .8).fill({ color: 0x15141d, alpha: .8 }).stroke({ color: armed ? 0xad95c8 : 0x71637d, width: 2 });
          for (let j = 0; j < 10; j++) { const a = j * tau / 10, d = { x: Math.cos(a), y: Math.sin(a) }, left = offset(p, d, r, -4), right = offset(p, d, r, 4), tip = offset(p, d, r * .6); under.poly([left.x, left.y, right.x, right.y, tip.x, tip.y]).fill(armed ? 0xe0cebc : 0x887f86); }
          under.roundRect(p.x - 6, p.y - 4, 12, 10, 2).fill(0x9973b9); under.circle(p.x, p.y - 5, 5).fill(0xefb6cb); under.circle(p.x + 1, p.y - 9, 2.5).fill(0xcb5e87);
          if (!armed) under.circle(p.x, p.y, r + 5 + Math.sin(time * 8) * 1.5).stroke({ color: 0xc5a4ed, width: 1, alpha: .4 });
        }
        if (d.mode === 'headshot') crosshair(over, prey, target.definition.stats.radius * scale + 9, time, 0xc99eef);
        if (d.mode === 'outbound') { line(over, point(d.previous), tip, 0xdd9fe9, 6, .5); glow(over, tip, 5, 0xfbd1ec); }
        if (state.flash > 0 && d.anchor) { const p = point(d.anchor); under.circle(p.x, p.y, .25 * scale + (1 - state.flash / .35) * 12).stroke({ color: 0xdba9e6, width: 3, alpha: state.flash * 2 }); }
      }
      if (skill.type === 'ace-in-the-hole') {
        if (d.mode === 'windup') {
          const charge = 1 - d.timer / (skill.windup ?? 1), r = target.definition.stats.radius * scale + 16;
          line(under, at, prey, 0xe492b4, 1.5 + charge, .35 + charge * .4); crosshair(over, prey, r, time);
          over.moveTo(prey.x + r + 6, prey.y).arc(prey.x, prey.y, r + 6, 0, tau * Math.max(.01, charge)).stroke({ color: 0xffd4bd, width: 3, alpha: .8 });
          glow(over, offset(at, direction(at, prey), bodyRadius + 7), 4 + charge * 5, 0xffcfb4);
        }
        if (d.mode === 'outbound') { const aim = direction(point(d.previous), tip); line(over, offset(tip, aim, -32), tip, 0xe092bc, 10, .25); line(over, offset(tip, aim, -22), tip, 0xffdb9d, 4); glow(over, tip, 6, 0xffe5b9); }
      }
      if (skill.type === 'urchin-strike' && (d.mode === 'dash' || state.flash > 0)) {
        for (let j = 1; j < d.trail.length; j++) line(under, point(d.trail[j - 1]), point(d.trail[j]), 0x68d4ec, 3 + j * .7, j / d.trail.length * .55);
        trident(over, at, aim, bodyRadius + 16); for (let j = 0; j < 5; j++) { const p = offset(at, aim, -30 - j * 8, Math.sin(time * 18 + j) * 10); under.circle(p.x, p.y, 2).fill({ color: 0xa6f2ff, alpha: .5 }); }
      }
      if (skill.type === 'playful-trickster') {
        if (d.mode === 'airborne') {
          under.ellipse(at.x, at.y + 5, bodyRadius * .9, 12).fill({ color: 0x3ab8d3, alpha: .18 });
          trident(over, { x: at.x, y: at.y + 22 }, { x: 0, y: -1 }, 34);
          for (let j = 0; j < 8; j++) { const a = j * tau / 8 + time * 2, p = { x: at.x + Math.cos(a) * (bodyRadius + 15), y: at.y + Math.sin(a) * 14 }; over.circle(p.x, p.y, 2 + Math.sin(time * 6 + j)).fill({ color: 0xbaf4ff, alpha: .7 }); }
        }
        if (state.flash > 0 && d.anchor) splash(over, point(d.anchor), (skill.zoneRadius ?? 1.05) * scale, 1 - state.flash / .55, time);
      }
      if (skill.type === 'chum-the-waters') {
        if (d.mode === 'outbound' || d.mode === 'bait') {
          const fish = d.mode === 'bait' ? point(d.at) : tip, p1 = offset(fish, aim, -10, -7), p2 = offset(fish, aim, -21), p3 = offset(fish, aim, -10, 7);
          over.poly([p1.x, p1.y, p2.x, p2.y, p3.x, p3.y]).fill(0x72c6e6); over.ellipse(fish.x, fish.y, 12, 6).fill(0xc3e5ec); over.circle(fish.x + 6, fish.y - 1, 2).fill(0x1e475f);
          if (d.mode === 'bait') {
            const progress = 1 - d.timer / skill.duration, radius = (skill.zoneRadius ?? 1.1) * scale * sharkMultiplier(skill, d);
            under.circle(fish.x, fish.y, radius).fill({ color: 0x245976, alpha: .1 + progress * .1 }).stroke({ color: 0x68cce9, width: 1.5, alpha: .5 });
            under.circle(fish.x, fish.y, radius * (.2 + progress * .7)).stroke({ color: 0xb2ecf5, width: 2, alpha: .6 });
            const a = time * 3, fin = { x: fish.x + Math.cos(a) * radius * .7, y: fish.y + Math.sin(a) * radius * .5 };
            over.poly([fin.x - 12, fin.y + 3, fin.x + 5, fin.y - 15, fin.x + 10, fin.y + 3]).fill({ color: 0x729dad, alpha: .8 });
          }
        }
        if (state.flash > 0 && d.anchor) {
          const p = point(d.anchor), progress = 1 - state.flash / .8, rise = Math.sin(progress * Math.PI), r = (skill.zoneRadius ?? 1.1) * scale * sharkMultiplier(skill, d);
          splash(under, p, r, progress, time); const top = p.y - 20 - rise * r * .8, width = 26 + rise * 18;
          over.moveTo(p.x - width, p.y + 20).quadraticCurveTo(p.x - width * 1.1, top + 20, p.x, top - 14).quadraticCurveTo(p.x + width * 1.1, top + 20, p.x + width, p.y + 20).closePath().fill({ color: 0x729baa, alpha: 1 - progress * .6 }).stroke({ color: 0xa4d4dc, width: 2, alpha: 1 - progress });
          over.poly([p.x - width, p.y + 2, p.x - width - 25, p.y - 5, p.x - width + 4, p.y - 19]).fill(0x487387);
          over.ellipse(p.x, top + 39, width * .7, 23).fill(0x203c4c);
          for (let j = 0; j < 6; j++) { const x = p.x + (j - 2.5) * 8; over.poly([x - 4, top + 23, x + 4, top + 23, x, top + 35]).fill(0xe0eff0); over.poly([x - 4, top + 54, x + 4, top + 54, x, top + 43]).fill(0xe0eff0); }
          over.circle(p.x - width * .6, top + 15, 3).fill(0x142a34); over.circle(p.x + width * .6, top + 15, 3).fill(0x142a34);
        }
      }
    });
  }
}
