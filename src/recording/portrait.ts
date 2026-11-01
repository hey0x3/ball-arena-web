import type { Fighter, Simulation } from '../simulation/engine';
import { fighterSkillStatuses, type SkillStatus } from '../skills/status';

/** A fixed portrait composition independent of the browser viewport and sidebar. */
export class PortraitRecording {
  readonly canvas = document.createElement('canvas');
  private context: CanvasRenderingContext2D;
  private tinted = new WeakMap<CanvasImageSource, Map<string, HTMLCanvasElement>>();
  constructor() {
    this.canvas.width = 720; this.canvas.height = 1280;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('This browser could not create a portrait recording surface.');
    this.context = context;
  }

  draw(arena: HTMLCanvasElement, sim: Simulation, theme: 'light' | 'dark', artwork?: (fighter: Fighter) => CanvasImageSource | undefined) {
    const ctx = this.context, light = theme === 'light';
    ctx.fillStyle = light ? '#eeebf1' : '#14121b'; ctx.fillRect(0, 0, 720, 1280);
    ctx.fillStyle = light ? '#31273d' : '#e5dfed'; ctx.font = '600 30px "Segoe UI", Arial, sans-serif';
    ctx.fillText('ball arena.', 48, 88);
    ctx.font = '12px "Segoe UI", Arial, sans-serif'; ctx.fillStyle = light ? '#80728f' : '#91869f';
    ctx.fillText('CLASSIC ARENA  /  1 vs 1', 48, 121);
    ctx.textAlign = 'right'; ctx.fillText(`${Math.floor(sim.elapsed / 60).toString().padStart(2, '0')}:${Math.floor(sim.elapsed % 60).toString().padStart(2, '0')}`, 672, 121); ctx.textAlign = 'left';
    const upper = fighterSkillStatuses(sim, sim.fighters[1]), lower = fighterSkillStatuses(sim, sim.fighters[0]);
    const upperHeight = this.healthHeight(upper), lowerHeight = this.healthHeight(lower), lowerY = 1142 - lowerHeight;
    const top = 164 + upperHeight + 14, bottom = lowerY - 14, side = Math.min(720, bottom - top);
    this.health(sim.fighters[1], upper, 164, light, artwork?.(sim.fighters[1]));
    ctx.drawImage(arena, (720 - side) / 2, top + (bottom - top - side) / 2, side, side);
    this.health(sim.fighters[0], lower, lowerY, light, artwork?.(sim.fighters[0]));
    ctx.textAlign = 'center'; ctx.fillStyle = light ? '#736080' : '#b8a0e5';
    ctx.font = '500 17px "Segoe UI", Arial, sans-serif';
    ctx.fillText(this.fit(sim.phase === 'finished' ? sim.result : 'AUTONOMOUS COMBAT', 624), 360, 1178);
    ctx.font = '12px "Segoe UI", Arial, sans-serif'; ctx.fillStyle = light ? '#80728f' : '#91869f';
    ctx.fillText(this.fit(`Seed · ${sim.options.seed}`, 624), 360, 1211); ctx.textAlign = 'left';
  }

  private healthHeight(skills: SkillStatus[]) { return skills.length ? 118 + (skills.length - 1) * 34 : 94; }
  private health(fighter: Fighter, skills: SkillStatus[], y: number, light: boolean, artwork?: CanvasImageSource) {
    const ctx = this.context, color = fighter.definition.appearance.color;
    ctx.fillStyle = light ? '#f9f7fb' : '#1b1822'; ctx.strokeStyle = light ? '#ddd4e7' : '#312a3c'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(40, y, 640, this.healthHeight(skills), 12); ctx.fill(); ctx.stroke();
    if (artwork) ctx.drawImage(this.icon(artwork, fighter.definition.appearance.bodyTint ?? '#ffffff'), 57, y + 17, 52, 52);
    else { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(83, y + 43, 22, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#ffffff66'; ctx.beginPath(); ctx.arc(83, y + 43, 16, 0, Math.PI * 2); ctx.stroke(); }
    ctx.font = '600 11px "Segoe UI", Arial, sans-serif'; ctx.fillStyle = light ? '#80728f' : '#91869f';
    ctx.fillText(fighter.id === '0' ? 'A' : 'B', 47, y + 17);
    ctx.font = '600 19px "Segoe UI", Arial, sans-serif'; ctx.fillStyle = light ? '#31273d' : '#e5dfed';
    ctx.fillText(this.fit(fighter.definition.name, 360), 126, y + 33);
    ctx.textAlign = 'right'; ctx.fillStyle = color; ctx.font = '600 18px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`${Math.ceil(fighter.hp)} HP${fighter.shield > 0 ? ' +' + fighter.shield : ''}`, 655, y + 33); ctx.textAlign = 'left';
    ctx.fillStyle = light ? '#e9e2f1' : '#2a2434'; ctx.beginPath(); ctx.roundRect(126, y + 46, 529, 5, 2.5); ctx.fill();
    const width = 529 * Math.max(0, Math.min(1, fighter.hp / fighter.definition.stats.maxHp));
    if (width > 0) { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(126, y + 46, width, 5, Math.min(2.5, width / 2)); ctx.fill(); }
    skills.forEach((skill, index) => {
      const rowY = y + 70 + index * 34;
      ctx.font = '600 11px "Segoe UI", Arial, sans-serif'; ctx.fillStyle = light ? '#534262' : '#ddd1eb';
      ctx.fillText(this.fit(skill.name, 190), 126, rowY);
      ctx.textAlign = 'right'; ctx.fillStyle = skill.color; ctx.fillText(this.fit(skill.label, 325), 655, rowY); ctx.textAlign = 'left';
      ctx.font = '10px "Segoe UI", Arial, sans-serif'; ctx.fillStyle = light ? '#80728f' : '#91869f';
      ctx.fillText(this.fit(skill.detail, 529), 126, rowY + 14);
      ctx.fillStyle = light ? '#e9e2f1' : '#2a2434'; ctx.fillRect(126, rowY + 21, 529, 2);
      ctx.fillStyle = skill.color; ctx.fillRect(126, rowY + 21, 529 * Math.max(0, Math.min(1, skill.progress)), 2);
    });
    if (!skills.length) { ctx.font = '11px "Segoe UI", Arial, sans-serif'; ctx.fillStyle = light ? '#80728f' : '#91869f'; ctx.fillText('Pure physics', 126, y + 73); }
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
