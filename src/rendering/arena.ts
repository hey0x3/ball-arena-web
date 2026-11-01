import { Application, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import type { Fighter, Simulation, Point } from '../simulation/engine';
import type { Character, MediaFiles } from '../content/schema';
import { direction } from '../simulation/geometry';
import { ARENA_CANVAS_SIZE, ARENA_PADDING, ARENA_SCALE, arenaPoint, artworkRotation, dartlingAim, fireOpacity, presentedPosition } from './presentation';
import { drawSkillEffects } from './skill-effects';
import flameUrl from './assets/flame.png?url';

const SIZE = ARENA_CANVAS_SIZE, PAD = ARENA_PADDING, SCALE = ARENA_SCALE, point = arenaPoint;
const numberColor = (color: string) => parseInt(color.slice(1), 16);
type BallView = { root: Container; art: Graphics; overlay: Graphics; weapon: Sprite; hp: Text; shield: Text; image: Sprite; mask: Graphics };
export class ArenaView {
  app = new Application();
  private floor = new Graphics();
  private effects = new Graphics();
  private skillUnder = new Graphics();
  private skillOver = new Graphics();
  private skillMask = new Graphics();
  private launchGuide = new Graphics();
  private fire = new Container();
  private flames: Sprite[] = [];
  private flameTexture?: Texture;
  private boundary = new Graphics();
  private balls: BallView[] = [];
  private labels: Text[] = [];
  private resultLabel = new Text({ text: '', style: { fontFamily: 'Arial, sans-serif', fontSize: 20, fontWeight: '600', fill: '#e7dff5', letterSpacing: 1 } });
  private theme = '';
  private textures = new Map<string, Texture>();
  private pendingTextures = new Map<string, Promise<void>>();
  private images = new Map<string, HTMLImageElement>();
  private media: MediaFiles = {};
  private disposed = false;
  async init(host: HTMLElement) {
    await this.app.init({ width: SIZE, height: SIZE, resolution: 1, antialias: true, backgroundAlpha: 0, preference: 'webgl', preserveDrawingBuffer: true, autoStart: false });
    if (this.disposed) { this.app.destroy(true, { children: true }); return; }
    this.app.canvas.setAttribute('aria-label', 'Live ball arena');
    host.appendChild(this.app.canvas);
    await this.setMedia({ 'effects/flame': flameUrl });
    if (this.disposed) return;
    const flame = this.textures.get(flameUrl);
    // Match Flame_0's Unity sprite rectangle (bottom-left import coordinates).
    if (flame) this.flameTexture = new Texture({ source: flame.source, frame: new Rectangle(51, 2, 180, 236) });
    this.app.stage.addChild(this.floor, this.effects, this.fire, this.skillUnder, this.boundary);
    for (let i = 0; i < 2; i++) {
      const root = new Container(), art = new Graphics(), overlay = new Graphics();
      const hp = new Text({ text: '100', style: { fontFamily: 'Arial, sans-serif', fontSize: 31, fontWeight: '700', fill: '#ffffff', stroke: { color: '#18202b', width: 3 } } });
      hp.anchor.set(.5);
      const image = new Sprite(), mask = new Graphics(), weapon = new Sprite(); image.anchor.set(.5); weapon.anchor.set(.5);
      const shield = new Text({ text: '', style: { fontFamily: 'Arial, sans-serif', fontSize: 15, fontWeight: '700', fill: '#a9d9ff', stroke: { color: '#18202b', width: 3 } } }); shield.anchor.set(.5);
      root.addChild(art, weapon, image, mask, overlay, hp, shield); this.app.stage.addChild(root);
      this.balls.push({ root, art, overlay, weapon, hp, shield, image, mask });
    }
    this.app.stage.addChild(this.skillOver, this.launchGuide, this.skillMask);
    this.skillUnder.mask = this.skillMask; this.skillOver.mask = this.skillMask; this.launchGuide.mask = this.skillMask;
    for (let i = 0; i < 24; i++) {
      const t = new Text({ text: '', style: { fontFamily: 'Arial, sans-serif', fontSize: 24, fontWeight: 'bold', fill: '#ffffff' } });
      t.anchor.set(.5); t.visible = false; this.app.stage.addChild(t); this.labels.push(t);
    }
    this.resultLabel.anchor.set(.5); this.resultLabel.position.set(360, 95); this.app.stage.addChild(this.resultLabel);
  }
  get canvas() { return this.app.canvas as HTMLCanvasElement; }
  async setMedia(media: MediaFiles) {
    this.media = media;
    await Promise.all(Object.values(media).map(data => {
      if (this.textures.has(data)) return Promise.resolve();
      const pending = this.pendingTextures.get(data); if (pending) return pending;
      const task = new Promise<void>(resolve => {
        const image = new Image();
        image.onload = () => { this.pendingTextures.delete(data); if (!this.disposed) { this.textures.set(data, Texture.from(image)); this.images.set(data, image); } resolve(); };
        image.onerror = () => { this.pendingTextures.delete(data); resolve(); }; image.src = data;
      });
      this.pendingTextures.set(data, task); return task;
    }));
  }
  artwork(character: Character) { const path = character.appearance.body; return path ? this.images.get(this.media[character.id + '/' + path]) : undefined; }
  private drawFloor(light: boolean) {
    const g = this.floor; g.clear();
    const plate = light ? 0xd7d0e0 : 0x30283d, ground = light ? 0xf0ecf5 : 0x1b1928;
    const engraving = light ? 0xccc3d8 : 0x383149;
    g.poly([24, 12, 696, 12, 708, 24, 708, 696, 696, 708, 24, 708, 12, 696, 12, 24]).fill(plate).stroke({ color: light ? 0xbfb0ce : 0x51435f, width: 1 });
    g.rect(30, 30, 660, 660).fill(light ? 0xe2dbe9 : 0x211d30);
    g.rect(PAD, PAD, 640, 640).fill(ground);
    for (let x = 65; x < 680; x += 26) for (let y = 65; y < 680; y += 26) {
      if (Math.hypot(x - 360, y - 360) > 120) g.circle(x, y, .65).fill({ color: engraving, alpha: .8 });
    }
    [83, 96, 114].forEach((r, i) => g.circle(360, 360, r).stroke({ color: engraving, width: i === 2 ? .6 : 1, alpha: .7 }));
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      g.moveTo(360 + Math.cos(a) * 100, 360 + Math.sin(a) * 100).lineTo(360 + Math.cos(a) * 110, 360 + Math.sin(a) * 110).stroke({ color: engraving, width: 1 });
    }
    g.poly([330, 365, 354, 335, 388, 356, 365, 387]).stroke({ color: engraving, width: 2 });
    for (let side = 0; side < 2; side++) for (let i = 1; i < 12; i++) {
      const x = side ? 696 : 24, y = 40 + i * 640 / 12;
      g.moveTo(x, y).lineTo(x + (side ? -1 : 1) * (i % 3 ? 4 : 8), y).stroke({ color: 0xa595bf, alpha: .45, width: 1 });
    }
    [[40, 40], [680, 40], [680, 680], [40, 680]].forEach(([x, y], i) => {
      const dx = i === 1 || i === 2 ? -1 : 1, dy = i > 1 ? -1 : 1;
      g.circle(x - dx * 11, y - dy * 11, 3).fill(light ? 0xb6a4c9 : 0x51455f);
    });
  }
  render(sim: Simulation, theme: 'dark' | 'light', alpha = 1, showCharacterHealth = true) {
    if (this.disposed || !this.app.renderer) return;
    const light = theme === 'light';
    if (this.theme !== theme) { this.drawFloor(light); this.theme = theme; }
    const g = this.effects, edge = this.boundary; g.clear(); edge.clear();
    const h = sim.half * SCALE, low = 360 - h, width = h * 2;
    this.skillMask.clear().rect(low + 2, low + 2, width - 4, width - 4).fill(0xffffff);
    if (sim.half < 2.59) {
      g.rect(PAD, PAD, 640, low - PAD).rect(PAD, 720 - low, 640, low - PAD).rect(PAD, low, low - PAD, width).rect(720 - low, low, low - PAD, width).fill({ color: light ? 0xbcb1c7 : 0x0b0d16, alpha: .7 });
    }
    edge.rect(low, low, width, width).stroke({ color: sim.elapsed >= 120 && sim.options.shrink ? 0xf0a66f : 0xa48acb, alpha: .1, width: 10 });
    edge.rect(low, low, width, width).stroke({ color: 0xb39ad6, alpha: .7, width: 1.5 });
    const corners = [[low, low, 1, 1], [720 - low, low, -1, 1], [low, 720 - low, 1, -1], [720 - low, 720 - low, -1, -1]];
    corners.forEach(([x, y, dx, dy], i) => {
      const c = i % 2 ? 0x77c6d2 : 0xc2a3ed;
      edge.moveTo(x, y + dy * 40).lineTo(x, y).lineTo(x + dx * 40, y).stroke({ color: c, width: 3, alpha: .9 });
      edge.moveTo(x + dx * 7, y + dy * 17).lineTo(x + dx * 7, y + dy * 7).lineTo(x + dx * 17, y + dy * 7).stroke({ color: c, width: 1, alpha: .4 });
    });
    let flameIndex = 0;
    for (const z of sim.zones) {
      const a = point(z.start), b = point(z.end), opacity = fireOpacity(z.life), color = numberColor(z.color);
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color, alpha: opacity * .16, width: z.radius * 3 * SCALE, cap: 'round' });
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color, alpha: opacity, width: z.radius * 2 * SCALE, cap: 'round' });
      if (this.flameTexture) {
        let sprite = this.flames[flameIndex++];
        if (!sprite) { sprite = new Sprite(this.flameTexture); sprite.anchor.set(.5); this.fire.addChild(sprite); this.flames.push(sprite); }
        const at = point({ x: z.x, y: z.y + .02 }), age = z.duration - z.life;
        sprite.position.set(at.x, at.y); sprite.width = .18 * 180 / 256 * SCALE;
        sprite.height = (.20 + Math.sin(age * 18) * .02) * 236 / 256 * SCALE;
        sprite.tint = 0xff0000 | (Math.round(((color >> 8 & 255) + 217) / 2) << 8) | Math.round(((color & 255) + 77) / 2);
        sprite.alpha = opacity; sprite.visible = true;
      }
    }
    this.flames.forEach((sprite, index) => { if (index >= flameIndex) sprite.visible = false; });
    for (const p of sim.projectiles) {
      const at = point({ x: p.previous.x + (p.x - p.previous.x) * alpha, y: p.previous.y + (p.y - p.previous.y) * alpha });
      const d = direction({ x: 0, y: 0 }, { x: p.vx, y: p.vy });
      g.moveTo(at.x - d.x * .08 * SCALE, at.y + d.y * .08 * SCALE).lineTo(at.x + d.x * .08 * SCALE, at.y - d.y * .08 * SCALE).stroke({ color: 0xffd454, width: .1 * SCALE, cap: 'round' });
    }
    if (sim.puck?.present) {
      const p = point(sim.puck.body.getPosition());
      g.circle(p.x + 2, p.y + 6, 22).fill({ color: 0x000000, alpha: .15 });
      g.circle(p.x, p.y, 20).fill(0x222232).stroke({ color: numberColor(sim.puck.color), width: 3 });
      g.circle(p.x, p.y, 11).stroke({ color: numberColor(sim.puck.color), width: 1, alpha: .6 });
    }
    let label = 0;
    for (const e of sim.particles) {
      const at = point(e), t = e.life / e.duration, color = numberColor(e.color);
      if (e.kind === 'beam' && e.end) {
        const end = point(e.end);
        g.moveTo(at.x, at.y).lineTo(end.x, end.y).stroke({ color: 0xa760ff, width: 22 * t, alpha: .2 });
        g.moveTo(at.x, at.y).lineTo(end.x, end.y).stroke({ color, width: 8 * t, alpha: .9 });
        g.moveTo(at.x, at.y).lineTo(end.x, end.y).stroke({ color: 0xfff5ff, width: 3 * t, alpha: .95 });
      } else if (e.kind === 'pulse' || e.kind === 'dash') g.circle(at.x, at.y, 40 + (1 - t) * 110).stroke({ color, width: 1.5, alpha: t * .4 });
      else if (e.kind === 'wall') g.circle(at.x, at.y, 30 + (1 - t) * 35).stroke({ color, width: 3 * t, alpha: t * .4 });
      else if (e.text && label < this.labels.length) {
        const text = this.labels[label++]; text.visible = true; text.text = e.text;
        text.position.set(at.x, at.y - 58 - (1 - t) * 35); text.alpha = t; text.style.fill = light ? '#77608b' : '#e7dff5';
      }
    }
    this.labels.forEach((text, i) => { if (i >= label) text.visible = false; });
    for (const fighter of sim.fighters) fighter.definition.skills.forEach((skill, i) => {
      const state = fighter.skills[i];
      if (skill.type === 'beam' && state.targeting) for (let j = 1; j < state.path.length; j++) {
        const a = point(state.path[j - 1]), b = point(state.path[j]);
        g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: 0xc180ff, width: 2, alpha: .35 });
      }
    });
    drawSkillEffects(sim, { under: this.skillUnder, over: this.skillOver, point, scale: SCALE, alpha });
    sim.fighters.forEach((fighter, i) => {
      this.balls[i].hp.visible = showCharacterHealth;
      this.drawBall(fighter, this.balls[i], sim, alpha);
    });
    const guide = this.launchGuide; guide.clear();
    if (sim.phase === 'ready') sim.fighters.forEach((f, index) => {
      const at = point(f.body.getPosition()), d = sim.launchDirections[index], color = numberColor(f.definition.appearance.color);
      const start = (f.definition.stats.radius + .12) * SCALE, end = start + .46 * SCALE;
      const a = { x: at.x + d.x * start, y: at.y - d.y * start }, b = { x: at.x + d.x * end, y: at.y - d.y * end };
      guide.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color, width: 3.5, alpha: .9 });
      guide.poly([b.x, b.y, b.x - d.x * 13 + d.y * 7, b.y + d.y * 13 + d.x * 7, b.x - d.x * 13 - d.y * 7, b.y + d.y * 13 - d.x * 7]).fill({ color, alpha: .95 });
    });
    this.resultLabel.text = sim.phase === 'finished' ? sim.result : sim.phase === 'paused' ? 'PAUSED' : sim.phase === 'ready' ? 'READY · PRESS RUN' : '';
    this.resultLabel.style.fill = light ? '#736080' : '#e7dff5';
    this.app.render();
  }
  private drawBall(f: Fighter, view: BallView, sim: Simulation, alpha: number) {
    const p = point(presentedPosition(f, alpha)), aim = dartlingAim(sim, f, alpha);
    const { appearance, stats } = f.definition, r = stats.radius * SCALE, color = numberColor(appearance.color);
    const data = appearance.body ? this.media[f.definition.id + '/' + appearance.body] : undefined;
    const texture = data ? this.textures.get(data) : undefined;
    const weaponData = appearance.weapon ? this.media[f.definition.id + '/' + appearance.weapon] : undefined;
    const weaponTexture = weaponData ? this.textures.get(weaponData) : undefined;
    const blade = f.definition.skills.find(s => s.type === 'rotating-blade');
    const g = view.art, overlay = view.overlay; g.clear(); overlay.clear();
    view.root.position.set(p.x, p.y); view.root.alpha = f.hp <= 0 ? .35 : 1;
    g.circle(3, 8, r + 2).fill({ color: 0x000000, alpha: .15 });
    if (!texture) {
      g.circle(0, 0, r).fill({ color: f.hitFlash > 0 ? 0xffffff : color, alpha: .8 });
      const a = Math.PI * 1.05;
      g.moveTo(Math.cos(a) * (r - 2), Math.sin(a) * (r - 2)).arc(0, 0, r - 2, a, Math.PI * 1.65).stroke({ color: 0xffffff, width: 3, alpha: .65 });
      if (aim) {
        const x = aim.x, y = -aim.y;
        g.poly([x * (r + 12), y * (r + 12), x * (r - 3) - y * 6, y * (r - 3) + x * 6, x * (r - 3) + y * 6, y * (r - 3) - x * 6]).fill(f.skills.find((_, index) => f.definition.skills[index].type === 'projectile')!.flash > 0 ? 0xffffff : 0xffd454);
      }
    }
    view.weapon.visible = !!blade && !!weaponTexture;
    if (blade) {
      const angle = -sim.elapsed * (blade.rotationSpeed ?? 180) * Math.PI / 180;
      if (weaponTexture) {
        view.weapon.texture = weaponTexture; view.weapon.width = view.weapon.height = r * 2 * blade.range;
        view.weapon.rotation = angle; view.weapon.tint = 0xd1e0f7;
      } else {
        const vertices: number[] = [];
        for (let i = 0; i < 48; i++) {
          const a = i * Math.PI * 2 / 48 + angle, reach = r * blade.range * (i % 4 < 2 ? 1 : .91);
          vertices.push(Math.cos(a) * reach, Math.sin(a) * reach);
        }
        g.poly(vertices).fill({ color: 0xd1e0f7, alpha: .85 }).stroke({ color: 0xffffff, width: 1 });
      }
    }
    view.image.visible = !!texture;
    if (texture) {
      view.image.texture = texture; const size = r * 2 * (appearance.bodyScale ?? 1);
      view.image.width = view.image.height = size;
      view.image.anchor.set(appearance.pivot?.x ?? .5, 1 - (appearance.pivot?.y ?? .5));
      view.image.tint = f.hitFlash > 0 ? 0xffffff : numberColor(appearance.bodyTint ?? '#ffffff');
      view.image.rotation = aim ? artworkRotation(aim) : 0;
      if (appearance.bodyScale) view.image.mask = null;
      else { view.mask.clear().circle(0, 0, r - 2).fill(0xffffff); view.image.mask = view.mask; }
    }
    f.definition.skills.forEach((skill, i) => {
      const state = f.skills[i];
      if (skill.type === 'wall-charge') {
        const maximum = skill.maxCharges ?? 3;
        for (let j = 0; j < maximum; j++) {
          let x = (j - (maximum - 1) / 2) * 12, y = r + 10;
          if (texture && maximum === 3) {
            const windows = [[54, 43], [67, 46], [80, 50]], size = r * 2 * (appearance.bodyScale ?? 1);
            x = (windows[j][0] / 128 - (appearance.pivot?.x ?? .5)) * size;
            y = ((appearance.pivot?.y ?? .5) - windows[j][1] / 128) * size;
          }
          overlay.circle(x, y, 2.5).fill({ color: j < state.charges || state.flash > 0 ? 0xffcf50 : 0x291608, alpha: 1 });
        }
      }
      if (skill.type === 'magnet') {
        const maximum = skill.maxCharges ?? 3;
        for (let j = 0; j < maximum; j++) overlay.circle((j - (maximum - 1) / 2) * 11, r + 8, 3).fill({ color: j < state.charges || state.active > 0 ? 0xe06cff : 0x33253e });
      }
    });
    view.shield.text = f.shield > 0 ? '+' + f.shield : ''; view.shield.position.set(0, -r * .64); view.shield.visible = view.hp.visible && f.shield > 0;
    view.hp.text = String(Math.ceil(f.hp)); view.hp.style.fontSize = Math.min(34, r * .7); view.hp.y = f.shield > 0 ? r * .15 : 0;
  }
  dispose() {
    this.disposed = true;
    if (this.app.renderer) this.app.destroy(true, { children: true });
    this.flameTexture?.destroy();
    this.textures.forEach(t => t.destroy(true)); this.textures.clear();
  }
}
