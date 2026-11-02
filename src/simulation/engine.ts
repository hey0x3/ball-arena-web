import { World, Vec2, Circle, Box, Polygon, type Body, type Contact } from 'planck';
import { validateCharacter, type Character, type Skill } from '../content/schema';
import { behaviors } from '../skills/registry';
import { worldEnder, type ChampionState } from '../skills/champions';
import type { PudgeState } from '../skills/pudge';
import type { LeagueState } from '../skills/league';
import { isLaunchAngles, type LaunchAngles } from './launch';
import { bladePoints, buildBeamPath, clipSegment, direction, length, pointDistanceSquared, segmentDistanceSquared, type Point } from './geometry';
export { direction } from './geometry';
export type { Point } from './geometry';

export const STEP = .02;
export const ARENA_SIZE = 5.2;
export type SkillState = {
  cooldown: number; active: number; capacity: number; charges: number; lastWall: number; lastEmit: number;
  hits: Map<string, number>; pendingBounce: boolean; flash: number; targeting: boolean;
  aim: Point; path: Point[]; emitOrigin: Point | null; emitClock: number;
  activations: number; lastForce: number; lastDamage: number;
  champion?: ChampionState;
  pudge?: PudgeState;
  league?: LeagueState;
};
export type Fighter = {
  id: string; definition: Character; body: Body; previous: Point; hp: number; shield: number;
  hitFlash: number; recovery: number; skills: SkillState[]; contactHits: Map<string, number>;
  pendingImpulse: Point; pendingForce: Point; lastDirection: Point; stalled: number;
  rootUntil: number; heldVelocity: Point | null; slowUntil: number; slowFactor: number; untargetableUntil: number; phasing: boolean; ghostUntil: number;
  damageTaken: number; history: { time: number; position: Point; velocity: Point; damageTaken: number }[];
  controls: Map<string, { until: number; disable: boolean }>; channeling: string | null; interruptions: number;
};
export type Particle = { kind: 'hit' | 'wall' | 'beam' | 'pulse' | 'dash'; x: number; y: number; end?: Point; color: string; life: number; duration: number; text?: string };
export type Projectile = { id: number; owner: string; skillId: string; x: number; y: number; previous: Point; vx: number; vy: number; radius: number; damage: number; life: number; color: string };
export type Zone = { owner: string; skillId: string; x: number; y: number; start: Point; end: Point; radius: number; damage: number; interval: number; life: number; duration: number; color: string; hits: Map<string, number> };
export type Hit = { source: string; target: string; damage: number; impulse: Point; leech: number; nonlethal?: boolean };
export type Puck = { body: Body; owner: string | null; damage: number; previous: Point; hits: Map<string, number>; lastStrike: number; power: number; color: string; armed: boolean; powered: boolean; strokeSpeed: number; strikes: number; hitsDealt: number; present: boolean };
export type SimOptions = { seed: string; shrink: boolean; timeout: number; launchAngles?: LaunchAngles };
export type SkillContext = { engine: Simulation; self: Fighter; target: Fighter; skill: Skill; state: SkillState; dt: number; direction: Point };
export function seededRandom(seed: string): () => number {
  let a = 2166136261;
  for (let i = 0; i < seed.length; i++) a = Math.imul(a ^ seed.charCodeAt(i), 16777619);
  return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function initialSkillState(skill: Skill): SkillState {
  return { cooldown: !['wall-charge', 'rotating-blade', 'magnet', 'trail'].includes(skill.type) ? skill.cooldown : 0,
    active: 0, capacity: 0, charges: 0, lastWall: -Infinity, lastEmit: 0, hits: new Map(), pendingBounce: false,
    flash: 0, targeting: false, aim: { x: 0, y: 1 }, path: [], emitOrigin: null, emitClock: 0,
    activations: 0, lastForce: 0, lastDamage: 0 };
}
export function effectiveRadius(f: Fighter) {
  return f.definition.stats.radius * Math.max(1, ...f.definition.skills.filter(s => s.type === 'rotating-blade').map(s => s.range));
}
export function storedImpulse(skill: Skill, state: SkillState) { return Math.min(skill.impulseCap ?? 6, state.charges * skill.power); }
export function wallBonus(skill: Skill, state: SkillState) {
  return Math.round(storedImpulse(skill, state) * (skill.damagePerImpulse ?? (skill.power > 0 ? skill.damage / skill.power : 0)));
}
export class Simulation {
  world = new World({ gravity: Vec2(0, 0) });
  fighters: Fighter[] = []; particles: Particle[] = []; projectiles: Projectile[] = []; zones: Zone[] = [];
  puck: Puck | null = null;
  elapsed = 0; ticks = 0; half = ARENA_SIZE / 2;
  phase: 'ready' | 'running' | 'paused' | 'finished' = 'ready'; result = '';
  options: SimOptions; totalHits = 0; resolutionCount = 0;
  readonly launchDirections: Point[];
  private walls: Body[] = []; private pending: Hit[] = [];
  private contacts: { a: Fighter; b: Fighter }[] = [];
  private wallContacts: { fighter: Fighter; impact: number; wall: number }[] = [];
  private puckContacts: Fighter[] = [];
  private nextProjectile = 0;
  constructor(definitions: Character[], options: SimOptions) {
    if (definitions.length !== 2) throw new Error('A duel needs exactly two balls.');
    if (options.launchAngles !== undefined && !isLaunchAngles(options.launchAngles)) throw new Error('Choose two finite launch angles from 0 to less than 360 degrees.');
    this.options = { ...options, ...(options.launchAngles ? { launchAngles: [...options.launchAngles] as LaunchAngles } : {}) };
    const random = seededRandom(options.seed);
    this.launchDirections = definitions.map((_, index) => {
      const a = this.options.launchAngles ? this.options.launchAngles[index] * Math.PI / 180 : (random() * .85 + .35) * Math.PI + (index ? Math.PI : 0);
      return { x: Math.cos(a), y: Math.sin(a) };
    });
    this.createWalls();
    definitions.forEach((data, index) => {
      const definition = validateCharacter(structuredClone(data));
      const position = Vec2(index ? .85 : -.85, index ? 1.15 : -1.15);
      const body = this.world.createDynamicBody({ position, bullet: true, fixedRotation: true, linearDamping: 0, allowSleep: false });
      body.createFixture(Circle(definition.stats.radius), {
        density: definition.stats.mass / (Math.PI * definition.stats.radius ** 2), restitution: 1, friction: 0,
        filterCategoryBits: 2, filterMaskBits: 1 | 2 | 4,
      });
      // Unity's rotating 48-point weapon is physical against walls only, not ball bodies.
      for (const skill of definition.skills.filter(s => s.type === 'rotating-blade')) {
        const points = bladePoints(definition.stats.radius, skill.range, 0);
        for (let i = 0; i < points.length; i++) body.createFixture(Polygon([Vec2(0, 0), Vec2(points[i].x, points[i].y), Vec2(points[(i + 1) % points.length].x, points[(i + 1) % points.length].y)]), {
          density: 0, friction: 0, restitution: 1, filterCategoryBits: 8, filterMaskBits: 1,
        });
      }
      const fighter: Fighter = { id: String(index), definition, body, previous: { ...position }, hp: definition.stats.maxHp,
        shield: 0, hitFlash: 0, recovery: 0, contactHits: new Map(), skills: definition.skills.map(initialSkillState),
        pendingImpulse: { x: 0, y: 0 }, pendingForce: { x: 0, y: 0 }, lastDirection: { x: 0, y: 1 }, stalled: 0,
        rootUntil: 0, heldVelocity: null, slowUntil: 0, slowFactor: 1, untargetableUntil: 0, phasing: false, ghostUntil: 0, damageTaken: 0,
        controls: new Map(), channeling: null, interruptions: 0,
        history: [{ time: 0, position: { ...position }, velocity: { x: 0, y: 0 }, damageTaken: 0 }] };
      body.setUserData(fighter); this.fighters.push(fighter);
    });
    if (definitions.some(c => c.skills.some(s => s.type === 'puck'))) {
      const body = this.world.createDynamicBody({ position: Vec2(0, 0), bullet: true, linearDamping: 0, fixedRotation: true });
      body.createFixture(Circle(.16), { density: .25 / (Math.PI * .16 ** 2), friction: 0, restitution: 1, filterCategoryBits: 4, filterMaskBits: 1 | 2 });
      this.puck = { body, owner: null, damage: 0, previous: { x: 0, y: 0 }, hits: new Map(), lastStrike: -Infinity,
        power: 0, color: '#a6c4e6', armed: false, powered: false, strokeSpeed: 7, strikes: 0, hitsDealt: 0, present: true };
      body.setUserData('puck');
    }
    this.world.on('begin-contact', contact => this.onContact(contact));
    this.world.on('pre-solve', contact => {
      const a = contact.getFixtureA().getBody().getUserData(), b = contact.getFixtureB().getBody().getUserData();
      if (this.isFighter(a) && this.isFighter(b)) this.contacts.push({ a, b });
    });
  }
  private isFighter(value: unknown): value is Fighter { return typeof value === 'object' && value !== null && 'definition' in value; }
  private createWalls() {
    for (let i = 0; i < 4; i++) {
      const body = this.world.createBody(); body.setUserData('wall:' + i);
      body.createFixture(Box(i < 2 ? .5 : this.half + 1, i < 2 ? this.half + 1 : .5), {
        restitution: 1, friction: 0, filterCategoryBits: 1, filterMaskBits: 2 | 4 | 8,
      }); this.walls.push(body);
    }
    this.moveWalls();
  }
  private moveWalls() {
    const h = this.half;
    [Vec2(-h - .5, 0), Vec2(h + .5, 0), Vec2(0, -h - .5), Vec2(0, h + .5)].forEach((p, i) => this.walls[i].setPosition(p));
  }
  private onContact(contact: Contact) {
    const a = contact.getFixtureA().getBody().getUserData(), b = contact.getFixtureB().getBody().getUserData();
    if (this.isFighter(a) && this.isFighter(b)) { a.recovery = Math.max(a.recovery, .1); b.recovery = Math.max(b.recovery, .1); return; }
    const f = this.isFighter(a) ? a : this.isFighter(b) ? b : null;
    const wall = typeof a === 'string' && a.startsWith('wall:') ? a : typeof b === 'string' && b.startsWith('wall:') ? b : null;
    if (f && wall) {
      const normal = contact.getWorldManifold(null)?.normal ?? Vec2(1, 0), v = f.body.getLinearVelocity();
      this.wallContacts.push({ fighter: f, wall: Number(wall.slice(5)), impact: Math.abs(v.x * normal.x + v.y * normal.y) });
      f.recovery = Math.max(f.recovery, .1);
    }
    if (f && (a === 'puck' || b === 'puck')) this.puckContacts.push(f);
  }
  opponent(f: Fighter) { return this.fighters.find(other => other.id !== f.id)!; }
  context(self: Fighter, index: number): SkillContext {
    const target = this.opponent(self);
    return { engine: this, self, target, skill: self.definition.skills[index], state: self.skills[index], dt: STEP, direction: direction(self.body.getPosition(), target.body.getPosition()) };
  }
  start() {
    if (this.phase === 'ready') {
      this.fighters.forEach((f, i) => {
        const d = this.launchDirections[i], s = f.definition.stats.cruiseSpeed;
        f.lastDirection = { ...d }; f.body.setLinearVelocity(Vec2(d.x * s, d.y * s));
      });
      if (this.puck) {
        const y = this.fighters[0].definition.skills.some(s => s.type === 'puck') ? -1 : 1, n = Math.hypot(.37, y);
        this.puck.body.setLinearVelocity(Vec2(.37 / n * 3.2, y / n * 3.2));
      }
    }
    if (this.phase !== 'finished') this.phase = 'running';
  }
  pause() { if (this.phase === 'running') this.phase = 'paused'; }
  applyImpulse(f: Fighter, p: Point) { f.pendingImpulse.x += p.x; f.pendingImpulse.y += p.y; }
  applyForce(f: Fighter, p: Point) { f.pendingForce.x += p.x; f.pendingForce.y += p.y; }
  hold(f: Fighter, seconds: number) {
    if (seconds <= 0) return;
    f.heldVelocity ??= { ...f.body.getLinearVelocity() }; f.rootUntil = Math.max(f.rootUntil, this.elapsed + seconds);
  }
  disabled(f: Fighter) { return [...f.controls.values()].some(c => c.disable && c.until > this.elapsed); }
  canAct(f: Fighter) { return f.untargetableUntil <= this.elapsed && !this.disabled(f) && !f.channeling; }
  control(f: Fighter, key: string, seconds: number, disable = true) {
    if (seconds <= 0) return;
    if (disable && (f.controls.get(key)?.until ?? 0) <= this.elapsed) f.interruptions++;
    f.heldVelocity ??= { ...f.body.getLinearVelocity() };
    f.controls.set(key, { until: this.elapsed + seconds, disable });
  }
  release(f: Fighter, key: string) { f.controls.delete(key); }
  slow(f: Fighter, amount: number, seconds: number) {
    if (f.slowUntil <= this.elapsed) f.slowFactor = 1;
    f.slowFactor = Math.min(f.slowFactor, 1 - amount); f.slowUntil = Math.max(f.slowUntil, this.elapsed + seconds);
  }
  setPhasing(f: Fighter, seconds: number) {
    f.untargetableUntil = seconds > 0 ? this.elapsed + seconds : 0; f.phasing = seconds > 0;
    for (let fixture = f.body.getFixtureList(); fixture; fixture = fixture.getNext()) fixture.setSensor(f.phasing || f.ghostUntil > this.elapsed);
  }
  setGhosting(f: Fighter, seconds: number) {
    f.ghostUntil = seconds > 0 ? this.elapsed + seconds : 0;
    for (let fixture = f.body.getFixtureList(); fixture; fixture = fixture.getNext()) fixture.setSensor(f.phasing || f.ghostUntil > this.elapsed);
  }
  teleport(f: Fighter, position: Point, velocity?: Point) {
    const limit = Math.max(0, this.half - effectiveRadius(f));
    const at = { x: Math.max(-limit, Math.min(limit, position.x)), y: Math.max(-limit, Math.min(limit, position.y)) };
    f.body.setPosition(Vec2(at.x, at.y)); f.previous = { ...at };
    if (velocity) { f.body.setLinearVelocity(Vec2(velocity.x, velocity.y)); f.heldVelocity = null; }
    f.recovery = .25;
  }
  heal(f: Fighter, amount: number) {
    const healing = Math.min(f.definition.stats.maxHp - f.hp, Math.max(0, Math.round(amount * worldEnder(f).healing)));
    if (healing) { f.hp += healing; this.effect('hit', f.body.getPosition(), '#83ffd1', .65, undefined, '+' + healing); }
    return healing;
  }
  queueHit(source: Fighter, target: Fighter, damage: number, impulse: Point = { x: 0, y: 0 }, drain = 0) {
    if (target.untargetableUntil > this.elapsed) return;
    const buff = worldEnder(source);
    if (damage >= 0) this.pending.push({ source: source.id, target: target.id, damage: damage * buff.damage, impulse, leech: buff.leech + drain });
  }
  queueSelfDamage(f: Fighter, damage: number) {
    if (damage > 0) this.pending.push({ source: f.id, target: f.id, damage, impulse: { x: 0, y: 0 }, leech: 0, nonlethal: true });
  }
  reserveWeapon(self: Fighter, target: Fighter, skill: Skill, state: SkillState) {
    if (!this.canAct(self)) return false;
    if (!skill.damage || this.elapsed < (self.contactHits.get(target.id) ?? -Infinity) - .000001) return false;
    self.contactHits.set(target.id, this.elapsed + skill.cooldown); state.flash = .16; state.lastDamage = skill.damage;
    this.queueHit(self, target, skill.damage); return true;
  }
  nextContactDamage(f: Fighter) {
    const blade = f.definition.skills.find(s => s.type === 'rotating-blade');
    if (blade) return blade.damage;
    return f.definition.stats.contactDamage + f.definition.skills.reduce((sum, skill, i) => sum + (skill.type === 'wall-charge' ? wallBonus(skill, f.skills[i]) : skill.type === 'dash' && f.skills[i].active > 0 ? skill.damage : 0), 0);
  }
  effect(kind: Particle['kind'], at: Point, color: string, duration = .4, end?: Point, text?: string) {
    if (this.particles.length >= 160) this.particles.shift();
    this.particles.push({ kind, ...at, color, duration, life: duration, end, text });
  }
  projectile(self: Fighter, skill: Skill, d: Point) {
    if (this.projectiles.filter(p => p.owner === self.id && p.skillId === skill.id).length >= (skill.poolSize ?? 4)) return false;
    const at = self.body.getPosition(), p: Projectile = { id: this.nextProjectile++, owner: self.id, skillId: skill.id,
      x: at.x, y: at.y, previous: { ...at }, vx: d.x * skill.power, vy: d.y * skill.power, radius: .05, damage: skill.damage, life: skill.duration, color: self.definition.appearance.color };
    this.advanceDart(p, self.definition.stats.radius + .15, d);
    if (p.life > 0) { p.previous = { x: p.x, y: p.y }; this.projectiles.push(p); }
    return true;
  }
  private advanceDart(p: Projectile, distance: number, aim?: Point) {
    const d = aim ?? direction({ x: 0, y: 0 }, { x: p.vx, y: p.vy }), target = this.fighters.find(f => f.id !== p.owner)!;
    const at = target.body.getPosition(), ox = at.x - p.x, oy = at.y - p.y, along = ox * d.x + oy * d.y;
    const perpendicular = ox * ox + oy * oy - along * along, radius = target.definition.stats.radius + .05;
    let targetAt = Infinity;
    if (perpendicular <= radius * radius) {
      const near = along - Math.sqrt(Math.max(0, radius * radius - perpendicular)) - .08;
      const far = along + Math.sqrt(Math.max(0, radius * radius - perpendicular)) + .08;
      if (far >= 0) targetAt = Math.max(0, near);
    }
    const tx = Math.abs(d.x) < .000001 ? Infinity : ((d.x > 0 ? this.half - .05 - .08 * Math.abs(d.x) : -this.half + .05 + .08 * Math.abs(d.x)) - p.x) / d.x;
    const ty = Math.abs(d.y) < .000001 ? Infinity : ((d.y > 0 ? this.half - .05 - .08 * Math.abs(d.y) : -this.half + .05 + .08 * Math.abs(d.y)) - p.y) / d.y;
    const wallAt = Math.max(0, Math.min(tx, ty));
    if (targetAt <= distance && targetAt < wallAt - .000001) {
      this.queueHit(this.fighters.find(f => f.id === p.owner)!, target, p.damage); p.life = 0;
    } else if (wallAt <= distance) p.life = 0;
    else { p.x += d.x * distance; p.y += d.y * distance; }
  }
  beam(self: Fighter, skill: Skill, aim: Point) {
    const path = buildBeamPath(self.body.getPosition(), aim, skill.range, skill.reflections ?? 2, this.half);
    const target = this.opponent(self), r = target.definition.stats.radius + .035;
    let hit = false;
    for (let i = 1; i < path.length; i++) {
      if (!hit && pointDistanceSquared(target.body.getPosition(), path[i - 1], path[i]) <= r * r) { this.queueHit(self, target, skill.damage); hit = true; }
      this.effect('beam', path[i - 1], '#ebc7ff', .2, path[i]);
    }
    return path;
  }
  emitTrail(self: Fighter, skill: Skill, state: SkillState) {
    const at = self.body.getPosition(); state.emitOrigin ??= { ...at }; state.emitClock += STEP;
    if (state.emitClock + .0002 < (skill.emitInterval ?? .1)) return;
    state.emitClock = Math.max(0, state.emitClock - (skill.emitInterval ?? .1));
    if (length({ x: at.x - state.emitOrigin.x, y: at.y - state.emitOrigin.y }) >= .05 && this.zones.filter(z => z.owner === self.id && z.skillId === skill.id).length < (skill.poolSize ?? 32)) {
      const clipped = clipSegment(state.emitOrigin, at, this.half, Math.max(skill.range / 2, .14));
      if (clipped) {
        const [a, b] = clipped;
        this.zones.push({ owner: self.id, skillId: skill.id, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, start: a, end: b,
            radius: skill.range / 2, damage: skill.damage, interval: skill.cooldown, life: skill.duration, duration: skill.duration, color: self.id === '0' ? '#ff660a' : '#ff1f14', hits: state.hits });
        state.activations++;
      }
    }
    state.emitOrigin = { ...at };
  }
  private burn() {
    for (const zone of this.zones) {
      const target = this.fighters.find(f => f.id !== zone.owner)!, radius = target.definition.stats.radius + zone.radius;
      if (this.elapsed >= (zone.hits.get(target.id) ?? -Infinity) - .000001 && segmentDistanceSquared(target.previous, target.body.getPosition(), zone.start, zone.end) <= radius * radius) {
        const owner = this.fighters.find(f => f.id === zone.owner)!;
        this.queueHit(owner, target, zone.damage); zone.hits.set(target.id, this.elapsed + zone.interval);
        const index = owner.definition.skills.findIndex(s => s.id === zone.skillId); owner.skills[index].flash = .25;
      }
    }
  }
  resolveHits() {
    const healing = new Map<string, number>();
    for (const hit of this.pending.splice(0)) {
      const target = this.fighters.find(f => f.id === hit.target)!; let damage = Math.max(0, Math.round(hit.damage));
      if (target.untargetableUntil > this.elapsed) continue;
      const absorbed = Math.min(target.shield, damage); target.shield -= absorbed; damage -= absorbed;
      let remaining = absorbed;
      for (const state of target.skills) {
        const used = Math.min(state.capacity, remaining); state.capacity -= used; remaining -= used;
        if (used > 0) { state.flash = .22; if (!state.capacity) state.active = 0; }
      }
      const applied = Math.min(Math.max(0, target.hp - (hit.nonlethal ? 1 : 0)), damage); target.hp -= applied;
      target.damageTaken += applied;
      if (applied && hit.leech) healing.set(hit.source, (healing.get(hit.source) ?? 0) + applied * hit.leech);
      if (applied || absorbed) {
        target.hitFlash = .18; this.totalHits++;
        this.effect('hit', target.body.getPosition(), target.definition.appearance.color, .65, undefined, absorbed && !applied ? 'BLOCK' : '−' + applied);
      }
      target.body.applyLinearImpulse(Vec2(hit.impulse.x, hit.impulse.y), target.body.getWorldCenter(), true);
      if (length(hit.impulse)) target.recovery = .25;
    }
    for (const [id, amount] of healing) this.heal(this.fighters.find(f => f.id === id)!, amount);
    const dead = this.fighters.filter(f => f.hp <= 0);
    if (dead.length && this.phase !== 'finished') this.finish(dead.length === 2 ? 'Simultaneous knockout · draw' : this.fighters.find(f => f.hp > 0)!.definition.name + ' wins');
  }
  private finish(result: string) {
    this.result = result; this.phase = 'finished'; this.resolutionCount++; this.projectiles = []; this.zones = [];
    for (const f of this.fighters) { f.shield = 0; f.controls.clear(); f.channeling = null; this.setGhosting(f, 0); this.setPhasing(f, 0); for (const s of f.skills) { s.capacity = 0; s.active = 0; s.targeting = false; s.pendingBounce = false; s.champion = undefined; s.pudge = undefined; s.league = undefined; } }
    if (this.puck) { this.puck.owner = null; this.puck.armed = false; this.puck.present = false; this.puck.body.setLinearVelocity(Vec2(0, 0)); }
  }
  private move(f: Fighter) {
    if (f.rootUntil > this.elapsed + .000001 || [...f.controls.values()].some(c => c.until > this.elapsed)) {
      f.body.setLinearVelocity(Vec2(0, 0)); f.pendingImpulse = { x: 0, y: 0 }; f.pendingForce = { x: 0, y: 0 }; return;
    }
    if (f.heldVelocity) { f.body.setLinearVelocity(Vec2(f.heldVelocity.x, f.heldVelocity.y)); f.heldVelocity = null; }
    const slow = f.slowUntil > this.elapsed ? f.slowFactor : 1;
    const cruise = f.definition.stats.cruiseSpeed * worldEnder(f).speed * slow;
    let v = { ...f.body.getLinearVelocity() };
    const external = length(f.pendingImpulse) > 0 || length(f.pendingForce) > 0;
    if (external) { v.x += (f.pendingImpulse.x + f.pendingForce.x * STEP) / f.body.getMass(); v.y += (f.pendingImpulse.y + f.pendingForce.y * STEP) / f.body.getMass(); f.recovery = .25; }
    f.pendingImpulse = { x: 0, y: 0 }; f.pendingForce = { x: 0, y: 0 };
    let speed = length(v);
    if (!Number.isFinite(speed)) { v = { ...f.lastDirection }; speed = 1; }
    if (speed > .01) {
      f.lastDirection = { x: v.x / speed, y: v.y / speed }; f.stalled = 0;
      speed = Math.min(speed, f.definition.stats.maxSpeed);
      if (!external && f.recovery <= 0) speed += Math.sign(cruise - speed) * Math.min(Math.abs(cruise - speed), 3 * STEP);
      if (slow < 1 && !external) speed = Math.min(speed, cruise);
      v = { x: f.lastDirection.x * speed, y: f.lastDirection.y * speed };
    } else {
      f.stalled += STEP;
      if (f.stalled >= .15) { const s = Math.max(.75, f.definition.stats.cruiseSpeed * .5); v = { x: f.lastDirection.x * s, y: f.lastDirection.y * s }; f.stalled = 0; }
    }
    f.recovery = Math.max(0, f.recovery - STEP); f.body.setLinearVelocity(Vec2(v.x, v.y));
    const blade = f.definition.skills.find(s => s.type === 'rotating-blade');
    const angle = blade ? this.elapsed * (blade.rotationSpeed ?? 180) * Math.PI / 180 : 0;
    const p = f.body.getPosition(), limit = Math.max(0, this.half - effectiveRadius(f));
    f.body.setTransform(Vec2(Math.max(-limit, Math.min(limit, p.x)), Math.max(-limit, Math.min(limit, p.y))), angle);
  }
  private stepPuck() {
    if (!this.puck) return;
    const puck = this.puck, p = { ...puck.body.getPosition() }, v = { ...puck.body.getLinearVelocity() }, limit = this.half - .168;
    if (p.x < -limit) { p.x = -limit; v.x = Math.abs(v.x); } else if (p.x > limit) { p.x = limit; v.x = -Math.abs(v.x); }
    if (p.y < -limit) { p.y = -limit; v.y = Math.abs(v.y); } else if (p.y > limit) { p.y = limit; v.y = -Math.abs(v.y); }
    const speed = Math.max(2.4, Math.min(Math.min(12, puck.strokeSpeed), length(v)));
    const d = length(v) < .1 ? direction({ x: 0, y: 0 }, { x: .6, y: 1 }) : direction({ x: 0, y: 0 }, v);
    if (Math.abs(d.x) < .16) d.x = (d.x < 0 ? -1 : 1) * .16;
    if (Math.abs(d.y) < .16) d.y = (d.y < 0 ? -1 : 1) * .16;
    const n = length(d); puck.previous = { ...p }; puck.body.setPosition(Vec2(p.x, p.y)); puck.body.setLinearVelocity(Vec2(d.x / n * speed, d.y / n * speed));
  }
  /** Only a real physical contact can arm/return the shared neutral puck. */
  strikePuck(hitter: Fighter) {
    const puck = this.puck;
    if (!puck || !puck.present || this.elapsed < (puck.hits.get(hitter.id) ?? -Infinity) - .000001) return;
    puck.hits.set(hitter.id, this.elapsed + .18);
    if (puck.armed && puck.owner !== null && puck.owner !== hitter.id) {
      this.queueHit(this.fighters.find(f => f.id === puck.owner)!, hitter, puck.damage); puck.hitsDealt++;
    }
    let normalDamage = 8, speed = 7, powered = false;
    const index = hitter.definition.skills.findIndex(s => s.type === 'puck');
    if (index >= 0) {
      const skill = hitter.definition.skills[index], state = hitter.skills[index]; powered = state.cooldown <= .000001;
      normalDamage = powered ? (skill.powerDamage ?? 24) : skill.damage; speed = powered ? skill.power : skill.range;
      if (powered) { state.cooldown = skill.cooldown; state.flash = .25; state.activations++; }
    }
    const delta = { x: puck.body.getPosition().x - hitter.body.getPosition().x, y: puck.body.getPosition().y - hitter.body.getPosition().y };
    const d = delta.x * delta.x + delta.y * delta.y < .001 ? { x: 0, y: hitter.id === '0' ? 1 : -1 } : direction({ x: 0, y: 0 }, delta);
    puck.owner = hitter.id; puck.armed = true; puck.powered = powered; puck.power = powered ? 1 : 0; puck.damage = normalDamage;
    puck.strokeSpeed = speed; puck.lastStrike = this.elapsed; puck.strikes++; puck.color = hitter.definition.appearance.color;
    puck.body.setLinearVelocity(Vec2(d.x * speed, d.y * speed));
  }
  step() {
    if (this.phase !== 'running') return;
    this.ticks++; this.elapsed = this.ticks * STEP;
    this.contacts = []; this.wallContacts = []; this.puckContacts = [];
    this.particles.forEach(p => p.life -= STEP); this.particles = this.particles.filter(p => p.life > 0);
    if (this.options.shrink && this.elapsed >= 120) {
      const minimum = Math.min(ARENA_SIZE / 2, Math.max(...this.fighters.map(effectiveRadius)) * 2);
      this.half = Math.max(minimum, ARENA_SIZE / 2 - (ARENA_SIZE / 2 - minimum) * Math.min(1, (this.elapsed - 120) / 60)); this.moveWalls();
    }
    for (const p of this.projectiles) {
      const seconds = Math.min(STEP, p.life); p.previous = { x: p.x, y: p.y };
      this.advanceDart(p, length({ x: p.vx, y: p.vy }) * seconds); p.life -= seconds;
    }
    this.projectiles = this.projectiles.filter(p => p.life > 0);
    for (const z of this.zones) {
      z.life -= STEP; const clipped = clipSegment(z.start, z.end, this.half, Math.max(z.radius, .14));
      if (!clipped) z.life = 0; else { [z.start, z.end] = clipped; z.x = (z.start.x + z.end.x) / 2; z.y = (z.start.y + z.end.y) / 2; }
    }
    this.zones = this.zones.filter(z => z.life > .0002);
    for (const f of this.fighters) {
      for (const [key, control] of f.controls) if (control.until <= this.elapsed) f.controls.delete(key);
      if (f.phasing && f.untargetableUntil <= this.elapsed) this.setPhasing(f, 0);
      if (f.ghostUntil > 0 && f.ghostUntil <= this.elapsed) this.setGhosting(f, 0);
      f.hitFlash = Math.max(0, f.hitFlash - STEP);
      f.definition.skills.forEach((skill, i) => { f.skills[i].flash = Math.max(0, f.skills[i].flash - STEP); behaviors[skill.type].tick?.(this.context(f, i)); });
      f.shield = f.skills.reduce((sum, state) => sum + state.capacity, 0);
    }
    this.burn();
    for (const f of this.fighters) { f.previous = { ...f.body.getPosition() }; this.move(f); }
    this.stepPuck(); this.world.step(STEP, 8, 3);
    const pairs = new Set<string>();
    for (const { a, b } of this.contacts) {
      const key = [a.id, b.id].sort().join(':'); if (pairs.has(key)) continue; pairs.add(key);
      this.reserveContact(a, b); this.reserveContact(b, a);
    }
    const walls = new Map<string, (typeof this.wallContacts)[number]>();
    for (const contact of this.wallContacts) { const key = contact.fighter.id + ':' + contact.wall; if ((walls.get(key)?.impact ?? -1) < contact.impact) walls.set(key, contact); }
    for (const { fighter: f, impact, wall } of walls.values()) {
      this.effect('wall', f.body.getPosition(), f.definition.appearance.color, .3);
      f.definition.skills.forEach((skill, i) => behaviors[skill.type].wall?.(this.context(f, i), impact));
      const velocity = { ...f.body.getLinearVelocity() }, speed = Math.min(length(velocity), f.definition.stats.maxSpeed);
      if (speed > .01) {
        const min = speed * Math.sin(Math.PI / 12), vertical = wall < 2;
        if (Math.abs(vertical ? velocity.y : velocity.x) < min) {
          const tangent = (vertical ? f.body.getPosition().y : f.body.getPosition().x) > 0 ? -1 : 1;
          const normal = Math.sqrt(Math.max(0, speed * speed - min * min));
          if (vertical) { velocity.y = tangent * min; velocity.x = (wall === 0 ? 1 : -1) * normal; }
          else { velocity.x = tangent * min; velocity.y = (wall === 2 ? 1 : -1) * normal; }
        }
        const n = length(velocity); f.body.setLinearVelocity(Vec2(velocity.x / n * speed, velocity.y / n * speed));
      }
    }
    for (const hitter of this.puckContacts) this.strikePuck(hitter);
    for (const f of this.fighters) {
      const v = f.body.getLinearVelocity(), n = length(v); if (n > f.definition.stats.maxSpeed) f.body.setLinearVelocity(Vec2(v.x / n * f.definition.stats.maxSpeed, v.y / n * f.definition.stats.maxSpeed));
    }
    this.resolveHits();
    for (const f of this.fighters) {
      f.history.push({ time: this.elapsed, position: { ...f.body.getPosition() }, velocity: { ...f.body.getLinearVelocity() }, damageTaken: f.damageTaken });
      while (f.history.length > 1 && f.history[1].time < this.elapsed - 4.2) f.history.shift();
    }
    if (this.elapsed >= this.options.timeout && (this.phase as Simulation['phase']) !== 'finished') this.finish('Time limit · draw');
  }
  private reserveContact(self: Fighter, target: Fighter) {
    if (!this.canAct(self) || target.untargetableUntil > this.elapsed) return;
    const blade = self.definition.skills.find(s => s.type === 'rotating-blade'), damage = this.nextContactDamage(self);
    if (damage <= 0 || this.elapsed < (self.contactHits.get(target.id) ?? -Infinity) - .000001) return;
    self.contactHits.set(target.id, this.elapsed + (blade?.cooldown ?? self.definition.stats.contactInterval));
    this.queueHit(self, target, damage);
    self.definition.skills.forEach((skill, i) => behaviors[skill.type].contact?.(this.context(self, i)));
  }
}
