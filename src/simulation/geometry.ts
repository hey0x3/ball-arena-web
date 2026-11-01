export type Point = { x: number; y: number };
export const length = (v: Point) => Math.hypot(v.x, v.y);
export function direction(a: Point, b: Point): Point {
  const d = { x: b.x - a.x, y: b.y - a.y }, n = length(d);
  return n > .0001 ? { x: d.x / n, y: d.y / n } : { x: 0, y: 1 };
}
export function pointDistanceSquared(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2;
}
export function segmentDistanceSquared(a: Point, b: Point, c: Point, d: Point) {
  const ux = b.x - a.x, uy = b.y - a.y, vx = d.x - c.x, vy = d.y - c.y;
  const denominator = ux * vy - uy * vx;
  if (Math.abs(denominator) > .000001) {
    const ox = c.x - a.x, oy = c.y - a.y;
    const t = (ox * vy - oy * vx) / denominator, s = (ox * uy - oy * ux) / denominator;
    if (t >= 0 && t <= 1 && s >= 0 && s <= 1) return 0;
  }
  return Math.min(pointDistanceSquared(a, c, d), pointDistanceSquared(b, c, d), pointDistanceSquared(c, a, b), pointDistanceSquared(d, a, b));
}
export function clipSegment(a: Point, b: Point, half: number, margin: number): [Point, Point] | null {
  let from = 0, to = 1;
  for (const key of ['x', 'y'] as const) {
    const origin = a[key], delta = b[key] - origin, min = -half + margin, max = half - margin;
    if (max < min) return null;
    if (Math.abs(delta) < .000001) { if (origin < min || origin > max) return null; }
    else { const x = (min - origin) / delta, y = (max - origin) / delta; from = Math.max(from, Math.min(x, y)); to = Math.min(to, Math.max(x, y)); if (from > to) return null; }
  }
  return [{ x: a.x + (b.x - a.x) * from, y: a.y + (b.y - a.y) * from }, { x: a.x + (b.x - a.x) * to, y: a.y + (b.y - a.y) * to }];
}
export function buildBeamPath(origin: Point, aim: Point, range: number, reflections: number, half: number): Point[] {
  let p = { x: Math.max(-half + .001, Math.min(half - .001, origin.x)), y: Math.max(-half + .001, Math.min(half - .001, origin.y)) };
  const d = direction({ x: 0, y: 0 }, aim), points = [{ ...p }]; let remaining = Math.min(30, range);
  for (let i = 0; i <= reflections && remaining > .001; i++) {
    const tx = Math.abs(d.x) < .00001 ? Infinity : ((d.x > 0 ? half : -half) - p.x) / d.x;
    const ty = Math.abs(d.y) < .00001 ? Infinity : ((d.y > 0 ? half : -half) - p.y) / d.y;
    const hit = Math.min(tx, ty), step = Math.min(remaining, hit);
    const end = { x: p.x + d.x * Math.max(0, step), y: p.y + d.y * Math.max(0, step) }; points.push(end); remaining -= step;
    if (step < hit || i === reflections) break;
    if (Math.abs(tx - hit) < .0001) d.x *= -1;
    if (Math.abs(ty - hit) < .0001) d.y *= -1;
    p = { x: end.x + d.x * .001, y: end.y + d.y * .001 }; remaining -= .001;
  }
  return points;
}
export function bladePoints(radius: number, ratio: number, angle: number): Point[] {
  return Array.from({ length: 48 }, (_, i) => {
    const a = i * Math.PI * 2 / 48 + angle, r = radius * ratio * (i % 4 < 2 ? 1 : .91);
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  });
}
export function polygonTouchesCircle(vertices: Point[], center: Point, radius: number) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i], b = vertices[j];
    if ((a.y > center.y) !== (b.y > center.y) && center.x < (b.x - a.x) * (center.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    if (pointDistanceSquared(center, a, b) <= radius * radius) return true;
  }
  return inside;
}
