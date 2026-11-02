import type { Graphics } from 'pixi.js';
import type { Point, Simulation } from '../simulation/engine';
import { direction } from '../simulation/geometry';
import { presentedPosition } from './presentation';

type Surface = { under: Graphics; over: Graphics; point: (p: Point) => Point; scale: number; alpha: number };
const tau = Math.PI * 2;
const offset = (p: Point, d: Point, x: number, y = 0): Point => ({ x: p.x + d.x * x - d.y * y, y: p.y + d.y * x + d.x * y });
function line(g: Graphics, a: Point, b: Point, color: number, width: number, alpha = 1) { g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color, width, alpha, cap: 'round' }); }
function chain(g: Graphics, a: Point, b: Point, time: number) {
  const d = direction(a, b), length = Math.hypot(b.x - a.x, b.y - a.y);
  line(g, a, b, 0x252b1c, 7); line(g, a, b, 0xb4b59a, 2, .6);
  const count = Math.ceil(length / 14);
  for (let i = 0; i < count; i++) {
    const at = offset(a, d, Math.min(length, i * 14 + (time * 26 % 14))), width = i % 2 ? 2 : 4;
    const p1 = offset(at, d, -5, -width), p2 = offset(at, d, 5, -width), p3 = offset(at, d, 5, width), p4 = offset(at, d, -5, width);
    g.poly([p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y]).stroke({ color: i % 2 ? 0xd0d4b9 : 0x818c78, width: 2, alpha: .95 });
  }
}
function hook(g: Graphics, at: Point, aim: Point, scale: number) {
  const p = (x: number, y: number) => offset(at, aim, x * scale, y * scale);
  const start = p(-.25, 0), neck = p(.12, 0), bend = p(.35, .21), end = p(-.02, .26), barb = p(.06, .10);
  g.moveTo(start.x, start.y).lineTo(neck.x, neck.y).bezierCurveTo(bend.x, bend.y, bend.x, bend.y, end.x, end.y).lineTo(barb.x, barb.y).stroke({ color: 0x25291f, width: 12, cap: 'round', join: 'round' });
  g.moveTo(start.x, start.y).lineTo(neck.x, neck.y).bezierCurveTo(bend.x, bend.y, bend.x, bend.y, end.x, end.y).lineTo(barb.x, barb.y).stroke({ color: 0xadb8a5, width: 7, cap: 'round', join: 'round' });
  line(g, start, neck, 0xedf2dc, 2.5);
  const edge = p(.15, .18); g.poly([barb.x, barb.y, edge.x, edge.y, end.x, end.y]).fill(0xe7edcd);
}
export function drawPudgeEffects(sim: Simulation, { under, over, point, scale, alpha }: Surface) {
  if (sim.phase === 'ready' || sim.phase === 'finished') return;
  const time = sim.elapsed;
  for (const self of sim.fighters) {
    const at = point(presentedPosition(self, alpha)), target = sim.opponent(self), prey = point(presentedPosition(target, alpha));
    self.definition.skills.forEach((skill, i) => {
      const state = self.skills[i], data = state.pudge;
      if (skill.type === 'rot' && state.active > 0) {
        const radius = skill.range * scale;
        under.circle(at.x, at.y, radius).fill({ color: 0x779524, alpha: .10 });
        under.circle(at.x, at.y, radius * .74).fill({ color: 0xafd43a, alpha: .12 });
        for (let j = 0; j < 24; j++) {
          const phase = (time * .55 + j * .618) % 1, angle = j * 2.4 + time * (j % 2 ? .6 : -.45);
          const reach = radius * (.2 + .65 * phase), x = at.x + Math.cos(angle) * reach, y = at.y + Math.sin(angle) * reach;
          const size = radius * (.08 + .12 * phase), opacity = Math.sin(phase * Math.PI);
          under.circle(x, y, size).fill({ color: j % 3 ? 0x99ba33 : 0xd0df53, alpha: opacity * .19 });
          over.circle(x, y, 1.5 + phase * 2.3).fill({ color: 0xd4ee70, alpha: opacity * .8 });
          if (j % 3 === 0) over.circle(x - size * .2, y - size * .4, size * .35).stroke({ color: 0xc4df65, width: 1.5, alpha: opacity * .4 });
        }
        for (let j = 0; j < 3; j++) {
          const angle = time * .8 + j * tau / 3;
          under.moveTo(at.x + Math.cos(angle) * radius * .92, at.y + Math.sin(angle) * radius * .92).arc(at.x, at.y, radius * .92, angle, angle + 1.05).stroke({ color: 0xa0c94e, width: 3, alpha: .32 });
        }
      }
      if (skill.type === 'meat-hook' && data) {
        if (data.mode === 'windup') {
          const angle = Math.atan2(data.aim.y, data.aim.x) + Math.sin(time * 24) * .6, aim = { x: Math.cos(angle), y: Math.sin(angle) };
          const held = offset(at, aim, (self.definition.stats.radius + .2) * scale);
          chain(over, at, held, time); hook(over, held, aim, scale);
        } else if (['outbound', 'reeling', 'miss'].includes(data.mode)) {
          const tip = data.mode === 'reeling' ? prey : point({ x: data.previous.x + (data.at.x - data.previous.x) * alpha, y: data.previous.y + (data.at.y - data.previous.y) * alpha });
          chain(over, at, tip, data.mode === 'outbound' ? time : -time);
          hook(over, tip, data.aim, scale);
          if (data.mode === 'reeling') over.circle(tip.x, tip.y, target.definition.stats.radius * scale + 8).stroke({ color: 0xc7cc90, width: 2, alpha: .45 + .2 * Math.sin(time * 18) });
        }
      }
      if (skill.type === 'dismember' && data?.mode === 'channel') {
        line(under, at, prey, 0x683c2b, 25, .25); line(under, at, prey, 0xba7859, 9, .55);
        const radius = target.definition.stats.radius * scale + 15, opening = .12 + (1 + Math.cos(time * 19)) * .11;
        for (const side of [-1, 1]) {
          const jawY = prey.y + side * radius * (.44 + opening);
          over.ellipse(prey.x, jawY, radius * .82, radius * .28).fill({ color: 0x663e31, alpha: .82 }).stroke({ color: 0xb98664, width: 4, alpha: .95 });
          for (let j = 0; j < 6; j++) {
            const x = prey.x + (j - 2.5) * radius * .23, y = jawY - side * radius * .1;
            over.poly([x - 5, y, x + 5, y, x + 1, y - side * (12 + j % 2 * 4)]).fill(0xe6dfad);
          }
        }
        for (let j = 0; j < 8; j++) {
          const t = (time * 1.2 + j / 8) % 1, x = prey.x + (at.x - prey.x) * t, y = prey.y + (at.y - prey.y) * t + Math.sin(t * Math.PI) * 20;
          over.circle(x, y, 2 + Math.sin(t * Math.PI) * 3).fill({ color: 0xc4e372, alpha: .85 });
        }
        if (state.flash > 0) under.circle(prey.x, prey.y, radius * (1 + (.25 - state.flash) * 2)).stroke({ color: 0xf2c292, width: 3, alpha: state.flash * 2 });
      }
    });
  }
}
