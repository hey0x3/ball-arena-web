import type { Graphics } from 'pixi.js';
import type { Point, Simulation } from '../simulation/engine';
import { darkinShape, historyAt, type StrikeShape } from '../skills/champions';
import { direction } from '../simulation/geometry';
import { presentedPosition } from './presentation';

type Surface = { under: Graphics; over: Graphics; point: (point: Point) => Point; scale: number; alpha: number };
const tau = Math.PI * 2;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
function segment(g: Graphics, a: Point, b: Point, color: number, width: number, alpha: number) {
  g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color, width, alpha, cap: 'round' });
}
function star(g: Graphics, at: Point, r: number, color: number, alpha: number, angle = 0) {
  const points: number[] = [];
  for (let i = 0; i < 8; i++) { const a = i * tau / 8 + angle, reach = i % 2 ? r * .25 : r; points.push(at.x + Math.cos(a) * reach, at.y + Math.sin(a) * reach); }
  g.poly(points).fill({ color, alpha });
}
function burst(g: Graphics, at: Point, radius: number, progress: number, color: number, count = 14) {
  for (let i = 0; i < count; i++) {
    const a = i * tau / count, r = radius * (.5 + progress * .8), length = 10 * (1 - progress) + 3;
    segment(g, { x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r }, { x: at.x + Math.cos(a) * (r + length), y: at.y + Math.sin(a) * (r + length) }, color, 2.3, 1 - progress);
  }
}
function strike(g: Graphics, shape: StrikeShape, surface: Surface, alpha: number, impact: boolean) {
  const color = impact ? 0xff934f : 0xe8454f;
  if (shape.stage === 3) {
    const p = surface.point(shape.center);
    g.circle(p.x, p.y, shape.radius * surface.scale).fill({ color, alpha: alpha * .18 }).stroke({ color, alpha: alpha * .8, width: impact ? 4 : 2 });
    g.circle(p.x, p.y, shape.sweetRadius * surface.scale).fill({ color: 0xffad64, alpha: alpha * .28 }).stroke({ color: 0xffb680, alpha, width: 2 });
  } else {
    const poly = (points: Point[]) => points.flatMap(p => { const at = surface.point(p); return [at.x, at.y]; });
    g.poly(poly(shape.polygon)).fill({ color, alpha: alpha * .14 }).stroke({ color, width: impact ? 4 : 2, alpha: alpha * .85 });
    g.poly(poly(shape.sweet)).fill({ color: 0xffb363, alpha: alpha * .28 }).stroke({ color: 0xffbd8b, width: 2, alpha });
  }
}
export function drawChampionEffects(sim: Simulation, surface: Surface) {
  if (sim.phase === 'ready' || sim.phase === 'finished') return;
  const { under, over, point, scale, alpha } = surface, time = sim.elapsed;
  for (const self of sim.fighters) {
    const position = presentedPosition(self, alpha), at = point(position), radius = self.definition.stats.radius * scale;
    const target = sim.opponent(self), to = point(presentedPosition(target, alpha));
    self.definition.skills.forEach((skill, index) => {
      const state = self.skills[index], data = state.champion;
      if (skill.type === 'darkin-blade' && data) {
        if (state.targeting) {
          strike(under, darkinShape(position, state.aim, data.stage, skill.range), surface, .7 + Math.sin(time * 20) * .15, false);
          const progress = 1 - data.timer / (skill.windup ?? .45), facing = -Math.atan2(state.aim.y, state.aim.x);
          const angle = facing - 1.8 + progress * 2.1, d = { x: Math.cos(angle), y: Math.sin(angle) };
          const hilt = { x: at.x - d.x * radius * .2, y: at.y - d.y * radius * .2 }, tip = { x: at.x + d.x * scale * 1.35, y: at.y + d.y * scale * 1.35 };
          const profile = [[-.12, -.07], [.2, -.09], [.35, -.19], [.98, -.13], [1.35, 0], [.98, .13], [.35, .19], [.2, .09], [-.12, .07]];
          const blade = profile.flatMap(([x, y]) => [at.x + (d.x * x - d.y * y) * scale, at.y + (d.y * x + d.x * y) * scale]);
          over.poly(blade).fill({ color: 0x491827, alpha: .96 }).stroke({ color: 0xff895e, width: 2.5, alpha: .95 });
          segment(over, hilt, tip, 0xff4555, 4, .85); segment(over, hilt, tip, 0xffd0b0, 1.2, .9);
          segment(over, { x: hilt.x - d.y * 17, y: hilt.y + d.x * 17 }, { x: hilt.x + d.y * 17, y: hilt.y - d.x * 17 }, 0x9c7280, 6, 1);
        }
        if (state.flash > 0 && data.strike) {
          const t = clamp(state.flash / .32); strike(under, data.strike, surface, t, true);
          const center = data.strike.stage === 3 ? data.strike.center : { x: data.strike.origin.x + data.strike.aim.x * 1.25, y: data.strike.origin.y + data.strike.aim.y * 1.25 };
          burst(over, point(center), .65 * scale, 1 - t, 0xffa06d, 16);
          if (data.strike.stage !== 3) {
            const c = point(center), facing = -Math.atan2(data.strike.aim.y, data.strike.aim.x);
            const start = facing - Math.PI * .65, reach = .6 * scale;
            over.moveTo(c.x + Math.cos(start) * reach, c.y + Math.sin(start) * reach).arc(c.x, c.y, reach, start, facing + Math.PI * .65).stroke({ color: 0xffd8bf, width: 8 * t, alpha: t * .8 });
          }
        }
      }
      if (skill.type === 'infernal-chains' && data) {
        const device = data.device, endpoint = device ? point(device.at) : to;
        if (device || data.mode === 'tether' || data.mode === 'pull') {
          const length = Math.hypot(endpoint.x - at.x, endpoint.y - at.y), count = Math.max(1, Math.ceil(length / 10));
          for (let i = 0; i < count; i++) {
            const t = (i + (time * 5 % 1)) / count, x = at.x + (endpoint.x - at.x) * t, y = at.y + (endpoint.y - at.y) * t;
            under.ellipse(x, y, 5, 2.5).stroke({ color: i % 2 ? 0xffad62 : 0x9c4546, width: 1.6, alpha: .85 });
          }
          if (device) star(over, endpoint, 13, 0xffbb79, .95, time * 8);
        }
        if (data.anchor && (['tether', 'pull'].includes(data.mode) || state.flash > 0)) {
          const zone = skill.zoneRadius ?? 1, d = state.aim, c = data.anchor;
          const vertices = [[zone, 0], [0, zone * .75], [-zone, 0], [0, -zone * .75]].flatMap(([x, y]) => { const p = point({ x: c.x + d.x * x - d.y * y, y: c.y + d.y * x + d.x * y }); return [p.x, p.y]; });
          const opacity = ['tether', 'pull'].includes(data.mode) ? 1 : clamp(state.flash / .4);
          under.poly(vertices).fill({ color: 0xa52a32, alpha: opacity * .12 }).stroke({ color: data.mode === 'escaped' ? 0x9b8489 : 0xff8862, width: 2.5, alpha: opacity * .8 });
          const center = point(c);
          if (data.mode === 'pull') burst(over, center, zone * scale * .55, 1 - data.timer / .24, 0xffb573);
          if (state.flash > 0 && data.mode === 'pulled') burst(over, center, .5 * scale, 1 - state.flash / .4, 0xffd3ab);
        }
      }
      if (skill.type === 'world-ender' && state.active > 0) {
        const flap = .85 + Math.sin(time * 6) * .15;
        for (const side of [-1, 1]) {
          const points = [[.35, -.15], [.85, -.65], [2.15 * flap, -1.25], [1.65, -.05], [1.95 * flap, .45], [1.0, .3], [.65, .85]].flatMap(([x, y]) => [at.x + side * x * radius, at.y + y * radius]);
          under.poly(points).fill({ color: 0x852238, alpha: .7 }).stroke({ color: 0xff6264, width: 2, alpha: .8 });
          segment(under, { x: at.x + side * radius * .3, y: at.y }, { x: at.x + side * radius * 2.05 * flap, y: at.y - radius * 1.15 }, 0xffa57a, 2, .8);
        }
        for (let i = 0; i < 7; i++) {
          const phase = (time * 1.5 + i / 7) % 1, a = i * 2.4;
          star(over, { x: at.x + Math.cos(a) * radius * (1.6 - phase * .5), y: at.y + Math.sin(a) * radius * (1.6 - phase * .5) }, 3 + phase * 3, 0xff987b, Math.sin(phase * Math.PI) * .8, a);
        }
        if (state.flash > 0) burst(over, at, radius * 1.5, 1 - state.flash / .65, 0xff696d, 18);
      }
      if (skill.type === 'timewinder' && data?.device) {
        const device = data.device, p = point({ x: device.previous.x + (device.at.x - device.previous.x) * alpha, y: device.previous.y + (device.at.y - device.previous.y) * alpha });
        const color = device.phase === 'returning' ? 0xb0fff0 : 0x68dbca;
        if (device.phase === 'field') {
          const r = .55 * scale, pulse = 1 + Math.sin(time * 13) * .05;
          under.circle(p.x, p.y, r * pulse).fill({ color: 0x3cc7b0, alpha: .1 }).stroke({ color, width: 2.5, alpha: .7 });
          for (let i = 0; i < 8; i++) { const a = i * tau / 8 + time; star(over, { x: p.x + Math.cos(a) * r * .8, y: p.y + Math.sin(a) * r * .8 }, 5, 0xb5ffe6, .75, a); }
        } else {
          const aim = device.phase === 'returning' ? direction(point(device.at), at) : { x: device.aim.x, y: -device.aim.y };
          segment(under, p, { x: p.x - aim.x * 42, y: p.y - aim.y * 42 }, color, 12, .2);
          segment(under, p, { x: p.x - aim.x * 27, y: p.y - aim.y * 27 }, 0xe2fff7, 3, .8);
        }
        const a = time * 12, r = 14;
        over.circle(p.x, p.y, r).fill({ color: 0x244c59, alpha: .85 }).stroke({ color, width: 3, alpha: 1 });
        const vertices = [[-r, -r * .7], [r, -r * .7], [-r, r * .7], [r, r * .7]].map(([x, y]) => ({ x: p.x + Math.cos(a) * x - Math.sin(a) * y, y: p.y + Math.sin(a) * x + Math.cos(a) * y }));
        over.poly(vertices.flatMap(v => [v.x, v.y])).stroke({ color: 0xd1fff1, width: 2, alpha: .95 });
        star(over, p, 6, 0xb7ffda, .9, -a);
      }
      if (skill.type === 'phase-dive' && data) {
        if (data.mode === 'dash') {
          const start = point(data.origin);
          segment(under, start, at, 0x57d6c8, 25, .15); segment(under, start, at, 0xc6fff1, 3, .7);
          for (let i = 1; i <= 3; i++) { const t = i / 4; under.circle(start.x + (at.x - start.x) * t, start.y + (at.y - start.y) * t, radius * .75).fill({ color: 0x72f2cf, alpha: .1 }); }
        }
        if (data.mode === 'armed') for (let i = 0; i < 3; i++) { const a = time * 4 + i * tau / 3; star(over, { x: at.x + Math.cos(a) * (radius + 6), y: at.y + Math.sin(a) * (radius + 6) }, 6, 0xafffe3, .85, a); }
        if (state.flash > 0 && data.anchor) {
          const t = clamp(state.flash / .35), from = point(data.origin), end = point(data.anchor);
          segment(under, from, end, 0x4fd6b8, 20 * t, t * .2); segment(over, from, end, 0xd4fff4, 2.5 * t, t * .7);
          burst(over, to, target.definition.stats.radius * scale, 1 - t, 0xb6ffe5, 12);
        }
      }
      if (skill.type === 'chronobreak') {
        if (time >= (skill.rewindSeconds ?? 4)) {
          const old = historyAt(self, time - (skill.rewindSeconds ?? 4)), ghost = point(old.position);
          for (let i = 1; i < self.history.length; i += 10) {
            const a = point(self.history[i - 1].position), b = point(self.history[i].position);
            segment(under, a, b, 0x5fd6be, 1.5, .17);
          }
          if (!data || data.mode !== 'rewind') star(under, ghost, 9, 0xb1ffe9, .5, time);
        }
        if (data?.anchor && (data.mode === 'rewind' || state.flash > 0)) {
          const p = point(data.anchor), t = data.mode === 'rewind' ? 1 - data.timer / skill.duration : 1 - state.flash / .65;
          const opacity = data.mode === 'rewind' ? .8 : 1 - t, r = skill.range * scale * (data.mode === 'rewind' ? .7 + t * .3 : .8 + t * .3);
          if (data.trace.length > 1) {
            const first = point(data.trace[0]); under.moveTo(first.x, first.y);
            data.trace.slice(1).forEach(at => { const p = point(at); under.lineTo(p.x, p.y); }); under.stroke({ color: 0x75ffda, width: 5 * opacity, alpha: opacity * .55 });
          }
          under.circle(p.x, p.y, r).fill({ color: 0x4bc8ac, alpha: opacity * .13 }).stroke({ color: 0xb4ffe8, width: 4 * opacity, alpha: opacity });
          for (let i = 0; i < 12; i++) {
            const a = i * tau / 12 - time * .6;
            segment(over, { x: p.x + Math.cos(a) * r * .8, y: p.y + Math.sin(a) * r * .8 }, { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r }, 0xc0ffe9, 3, opacity);
          }
          if (state.flash > 0) burst(over, p, r, t, 0xc5ffe8, 20);
        }
      }
    });
  }
}
