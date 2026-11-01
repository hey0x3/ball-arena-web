import type { Fighter, Point, Simulation } from '../simulation/engine';
import { direction } from '../simulation/geometry';

export const ARENA_CANVAS_SIZE = 720;
export const ARENA_PADDING = 40;
export const ARENA_SCALE = (ARENA_CANVAS_SIZE - ARENA_PADDING * 2) / 5.2;
export const arenaPoint = (p: Point): Point => ({ x: ARENA_CANVAS_SIZE / 2 + p.x * ARENA_SCALE, y: ARENA_CANVAS_SIZE / 2 - p.y * ARENA_SCALE });

export function presentedPosition(fighter: Fighter, alpha: number): Point {
  const at = fighter.body.getPosition();
  return { x: fighter.previous.x + (at.x - fighter.previous.x) * alpha, y: fighter.previous.y + (at.y - fighter.previous.y) * alpha };
}

// Unity's approved Dartling artwork faces up. Track the displayed target until
// firing, then hold the sampled shot direction for the 0.18-second muzzle flash.
export function dartlingAim(sim: Simulation, fighter: Fighter, alpha: number): Point | undefined {
  const index = fighter.definition.skills.findIndex(skill => skill.type === 'projectile');
  if (index < 0) return;
  const state = fighter.skills[index];
  return state.flash > 0 ? state.aim : direction(presentedPosition(fighter, alpha), presentedPosition(sim.opponent(fighter), alpha));
}

export const artworkRotation = (aim: Point) => Math.atan2(aim.x, aim.y);
export const fireOpacity = (remaining: number) => .22 + .78 * Math.max(0, Math.min(1, remaining / .5));
