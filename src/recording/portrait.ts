import type { Fighter, Simulation } from '../simulation/engine';
import type { Skill } from '../content/schema';
import { fallbackSkillIcons } from '../content/skill-icons';
import { compactSkillStatus } from '../skills/compact-status';
import { fighterSkillStatuses, type SkillStatus } from '../skills/status';

/** A fixed portrait composition independent of the browser viewport and sidebar. */
export class PortraitRecording {
  readonly canvas = document.createElement('canvas');
  private context: CanvasRenderingContext2D;
  private tinted = new WeakMap<CanvasImageSource, Map<string, HTMLCanvasElement>>();
  private skillImages = new Map<string, HTMLImageElement>();
  constructor() {
    this.canvas.width = 720; this.canvas.height = 1280;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('This browser could not create a portrait recording surface.');
    this.context = context;
    for (const url of Object.values(fallbackSkillIcons)) { const image = new Image(); image.src = url; this.skillImages.set(url, image); }
  }

  draw(arena: HTMLCanvasElement, sim: Simulation, theme: 'light' | 'dark', artwork?: (fighter: Fighter) => CanvasImageSource | undefined, skillArtwork?: (fighter: Fighter, skill: Skill) => CanvasImageSource | undefined) {
    const ctx = this.context, light = theme === 'light';
    ctx.fillStyle = light ? '#eeebf1' : '#14121b'; ctx.fillRect(0, 0, 720, 1280);
    ctx.fillStyle = light ? '#31273d' : '#e5dfed'; ctx.font = '600 30px "Segoe UI", Arial, sans-serif';
    ctx.fillText('ball arena.', 48, 88);
    ctx.font = '12px "Segoe UI", Arial, sans-serif'; ctx.fillStyle = light ? '#80728f' : '#91869f';
    ctx.fillText('CLASSIC ARENA  /  1 vs 1', 48, 121);
    ctx.textAlign = 'right'; ctx.fillText(`${Math.floor(sim.elapsed / 60).toString().padStart(2, '0')}:${Math.floor(sim.elapsed % 60).toString().padStart(2, '0')}`, 672, 121); ctx.textAlign = 'left';
    const upper = fighterSkillStatuses(sim, sim.fighters[1]), lower = fighterSkillStatuses(sim, sim.fighters[0]);
    const upperHeight = 100, lowerHeight = 100, lowerY = 1142 - lowerHeight;
    const top = 164 + upperHeight + 14, bottom = lowerY - 14, side = Math.min(720, bottom - top);
    this.health(sim.fighters[1], upper, 164, light, artwork?.(sim.fighters[1]), skillArtwork);
    ctx.drawImage(arena, (720 - side) / 2, top + (bottom - top - side) / 2, side, side);
    this.health(sim.fighters[0], lower, lowerY, light, artwork?.(sim.fighters[0]), skillArtwork);
    ctx.textAlign = 'center'; ctx.fillStyle = light ? '#736080' : '#b8a0e5';
    ctx.font = '500 17px "Segoe UI", Arial, sans-serif';
    ctx.fillText(this.fit(sim.phase === 'finished' ? sim.result : 'AUTONOMOUS COMBAT', 624), 360, 1178);
    ctx.font = '12px "Segoe UI", Arial, sans-serif'; ctx.fillStyle = light ? '#80728f' : '#91869f';
    ctx.fillText(this.fit(`Seed · ${sim.options.seed}`, 624), 360, 1211); ctx.textAlign = 'left';
  }

  private health(fighter: Fighter, skills: SkillStatus[], y: number, light: boolean, artwork?: CanvasImageSource, skillArtwork?: (fighter: Fighter, skill: Skill) => CanvasImageSource | undefined) {
    const ctx = this.context, color = fighter.definition.appearance.color;
    ctx.fillStyle = light ? '#f9f7fb' : '#1b1822'; ctx.strokeStyle = light ? '#ddd4e7' : '#312a3c'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(40, y, 640, 100, 12); ctx.fill(); ctx.stroke();
    if (artwork) {
      ctx.save();
      if (!fighter.definition.appearance.bodyScale) { ctx.beginPath(); ctx.arc(83, y + 50, 26, 0, Math.PI * 2); ctx.clip(); }
      const icon = this.icon(artwork, fighter.definition.appearance.bodyTint ?? '#ffffff');
      const aspect = !fighter.definition.appearance.bodyScale && icon instanceof HTMLImageElement ? icon.naturalWidth / icon.naturalHeight : 1;
      const width = 52 * Math.max(1, aspect), height = 52 * Math.max(1, 1 / aspect);
      ctx.drawImage(icon, 83 - width / 2, y + 50 - height / 2, width, height); ctx.restore();
    }
    else { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(83, y + 50, 22, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#ffffff66'; ctx.beginPath(); ctx.arc(83, y + 50, 16, 0, Math.PI * 2); ctx.stroke(); }
    ctx.font = '600 11px "Segoe UI", Arial, sans-serif'; ctx.fillStyle = light ? '#80728f' : '#91869f';
    ctx.fillText(fighter.id === '0' ? 'A' : 'B', 47, y + 17);
    ctx.font = '600 19px "Segoe UI", Arial, sans-serif'; ctx.fillStyle = light ? '#31273d' : '#e5dfed';
    ctx.fillText(this.fit(fighter.definition.name, 324), 126, y + 35);
    ctx.fillStyle = color; ctx.font = '600 16px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`${Math.ceil(fighter.hp)} HP${fighter.shield > 0 ? '  +' + fighter.shield + ' shield' : ''}`, 126, y + 58);
    const trackWidth = skills.length ? 324 : 529;
    ctx.fillStyle = light ? '#e9e2f1' : '#2a2434'; ctx.beginPath(); ctx.roundRect(126, y + 71, trackWidth, 5, 2.5); ctx.fill();
    const width = trackWidth * Math.max(0, Math.min(1, fighter.hp / fighter.definition.stats.maxHp));
    if (width > 0) { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(126, y + 71, width, 5, Math.min(2.5, width / 2)); ctx.fill(); }
    skills.forEach((skill, index) => {
      const definition = fighter.definition.skills[index], compact = compactSkillStatus(skill), x = 490 + index * 58, top = y + 18, side = 48;
      const source = skillArtwork?.(fighter, definition) ?? this.skillImages.get(fallbackSkillIcons[definition.type]);
      ctx.save(); ctx.beginPath(); ctx.roundRect(x, top, side, side, 5); ctx.clip(); ctx.fillStyle = '#252333'; ctx.fillRect(x, top, side, side);
      if (source && (!(source instanceof HTMLImageElement) || source.complete && source.naturalWidth)) ctx.drawImage(source, x, top, side, side);
      if (compact.progress < 1) { ctx.beginPath(); ctx.moveTo(x + side / 2, top + side / 2); ctx.arc(x + side / 2, top + side / 2, side, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - compact.progress)); ctx.closePath(); ctx.fillStyle = '#080911bb'; ctx.fill(); }
      ctx.font = '700 18px "Segoe UI", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = '#090910'; ctx.lineWidth = 3; ctx.strokeText(compact.value, x + side / 2, top + 31); ctx.fillStyle = '#ffffff'; ctx.fillText(compact.value, x + side / 2, top + 31);
      ctx.fillStyle = '#0b0b13dd'; ctx.fillRect(x, top + side - 13, 13, 13); ctx.fillStyle = '#eee7f7'; ctx.font = '700 9px "Segoe UI", Arial, sans-serif'; ctx.fillText(/^[qwer]$/i.test(definition.id) ? definition.id.toUpperCase() : String(index + 1), x + 6, top + side - 3); ctx.restore();
      ctx.strokeStyle = skill.color; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x, top, side, side, 5); ctx.stroke();
      ctx.fillStyle = light ? '#ddd4e7' : '#2a2434'; ctx.fillRect(x, top + side + 5, side, 2); ctx.fillStyle = skill.color; ctx.fillRect(x, top + side + 5, side * compact.progress, 2);
      ctx.textAlign = 'center'; ctx.font = '600 8px "Segoe UI", Arial, sans-serif'; ctx.fillStyle = light ? '#736080' : '#b6a9c8'; ctx.fillText(compact.caption, x + side / 2, top + side + 19); ctx.textAlign = 'left';
    });
    if (!skills.length) { ctx.font = '11px "Segoe UI", Arial, sans-serif'; ctx.fillStyle = light ? '#80728f' : '#91869f'; ctx.fillText('Pure physics', 490, y + 44); }
  }
  private icon(artwork: CanvasImageSource, tint: string): CanvasImageSource {
    if (tint === '#ffffff') return artwork;
    let entries = this.tinted.get(artwork); if (!entries) { entries = new Map(); this.tinted.set(artwork, entries); }
    const cached = entries.get(tint); if (cached) return cached;
    const image = document.createElement('canvas'); image.width = image.height = 104;
    const ctx = image.getContext('2d')!; ctx.drawImage(artwork, 0, 0, 104, 104);
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = tint; ctx.fillRect(0, 0, 104, 104);
    ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(artwork, 0, 0, 104, 104);
    entries.set(tint, image); return image;
  }
  private fit(value: string, width: number) {
    if (this.context.measureText(value).width <= width) return value;
    let shortened = value;
    while (shortened && this.context.measureText(`${shortened}…`).width > width) shortened = shortened.slice(0, -1);
    return `${shortened}…`;
  }
}
