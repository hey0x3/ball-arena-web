import type { Skill } from '../content/schema';
import { storedImpulse, type Fighter, type Simulation, type SkillState } from '../simulation/engine';

export type SkillStatus = { id: string; name: string; phase: 'charging' | 'cooldown' | 'ready' | 'triggered'; label: string; detail: string; progress: number; color: string };
const seconds = (n: number) => Math.max(0, n).toFixed(1) + 's';
export function skillStatus(sim: Simulation, fighter: Fighter, skill: Skill, state: SkillState): SkillStatus {
  const colors = { 'wall-charge': '#36e0cf', 'rotating-blade': '#d4e6ff', projectile: '#ffd452', shield: '#59bfff', magnet: '#e06bff', trail: '#ff7a1f', beam: '#c780ff', dash: '#ffa633', puck: '#66ebff' };
  const base: SkillStatus = { id: skill.id, name: skill.name, phase: 'cooldown', label: seconds(state.cooldown), detail: '', progress: Math.max(0, Math.min(1, 1 - state.cooldown / skill.cooldown)), color: colors[skill.type] };
  switch (skill.type) {
    case 'wall-charge': {
      const maximum = skill.maxCharges ?? 3;
      const amount = state.flash > 0 ? 1 : state.charges / maximum;
      const color = amount <= 0 ? base.color : '#ff' + Math.round((.84 - .52 * amount) * 255).toString(16).padStart(2, '0') + Math.round((.23 - .11 * amount) * 255).toString(16).padStart(2, '0');
      return { ...base, color, phase: state.flash > 0 ? 'triggered' : state.charges >= maximum ? 'ready' : 'charging',
        label: state.flash > 0 ? 'POWER HIT · ' + state.lastDamage : state.charges + '/' + maximum + ' WALL BOUNCES' + (state.charges >= maximum ? ' · READY' : ''),
        detail: 'Next hit ' + sim.nextContactDamage(fighter) + ' · push +' + storedImpulse(skill, state).toFixed(1), progress: state.charges / maximum };
    }
    case 'rotating-blade': {
      const remaining = Math.max(0, (fighter.contactHits.get(sim.opponent(fighter).id) ?? 0) - sim.elapsed);
      return { ...base, phase: state.flash > 0 ? 'triggered' : remaining > .001 ? 'cooldown' : 'ready',
        label: state.flash > 0 ? 'BLADE HIT · ' + skill.damage : remaining > .001 ? seconds(remaining) + ' to hit' : 'READY',
        detail: 'Blade ' + skill.damage + ' · shared ' + skill.cooldown + 's hit interval', progress: 1 - remaining / skill.cooldown };
    }
    case 'projectile': return { ...base, phase: state.flash > 0 ? 'triggered' : 'cooldown', label: state.flash > 0 ? 'SHOT FIRED' : seconds(state.cooldown) + ' to shot', detail: 'Dart ' + skill.damage + ' · every ' + skill.cooldown + 's' };
    case 'shield': return { ...base, phase: state.capacity > 0 ? 'ready' : state.flash > 0 ? 'triggered' : 'cooldown',
      label: state.capacity > 0 ? 'SHIELD ' + state.capacity + '/' + skill.damage : state.flash > 0 ? 'SHIELD BROKEN' : seconds(state.cooldown) + ' to shield',
      detail: state.capacity > 0 ? seconds(state.active) + ' left · next in ' + seconds(state.cooldown) : 'Absorbs ' + skill.damage + ' · lasts ' + skill.duration + 's', progress: state.capacity > 0 ? state.capacity / Math.max(1, skill.damage) : base.progress };
    case 'magnet': return { ...base, phase: state.active > 0 ? 'triggered' : 'charging',
      label: state.active > 0 ? 'PULL · ' + seconds(state.active) : state.charges + '/' + (skill.maxCharges ?? 3) + ' WALL BOUNCES',
      detail: state.active > 0 ? state.lastForce > 0 ? 'Pulling opponent' : 'Out of range / close range eased' : 'Next: ' + skill.duration + 's pull · range ' + skill.range,
      progress: state.active > 0 ? state.active / skill.duration : state.charges / (skill.maxCharges ?? 3) };
    case 'trail': {
      const segments = sim.zones.filter(z => z.owner === fighter.id && z.skillId === skill.id).length;
      return { ...base, phase: state.flash > 0 ? 'triggered' : 'ready', label: state.flash > 0 ? 'BURN CONTACT' : 'FIRE · ' + segments + ' segments',
        detail: 'Burn ' + skill.damage + '/' + skill.cooldown + 's · fire lasts ' + skill.duration + 's', progress: Math.min(1, segments / Math.min(skill.poolSize ?? 32, Math.ceil(skill.duration / (skill.emitInterval ?? .1)))) };
    }
    case 'beam': return { ...base, phase: state.flash > 0 ? 'triggered' : state.targeting ? 'charging' : 'cooldown',
      label: state.flash > 0 ? 'BEAM FIRED' : state.targeting ? 'AIM LOCKED · ' + seconds(state.cooldown) : seconds(state.cooldown) + ' to beam',
      detail: 'Beam ' + skill.damage + ' · ' + (skill.reflections ?? 2) + ' reflections · travel direction' };
    case 'dash': return { ...base, phase: state.active > 0 ? 'ready' : state.targeting ? 'charging' : 'cooldown',
      label: state.active > 0 ? 'METEOR RUSH · ' + seconds(state.active) : state.targeting ? 'WINDUP · ' + seconds(state.cooldown) : seconds(state.cooldown) + ' to rush',
      detail: 'Rush hit ' + (fighter.definition.stats.contactDamage + skill.damage) + ' · one hit', progress: state.active > 0 ? state.active / skill.duration : base.progress };
    case 'puck': return { ...base, phase: state.flash > 0 ? 'triggered' : state.cooldown <= .0001 ? 'ready' : 'charging',
      label: state.flash > 0 ? 'POWER SHOT' : state.cooldown <= .0001 ? 'POWER READY' : seconds(state.cooldown) + ' to power',
      detail: state.cooldown <= .0001 ? 'Next physical puck hit: ' + (skill.powerDamage ?? 24) + ' damage' : 'Puck ' + skill.damage + ' · power ' + (skill.powerDamage ?? 24) };
  }
}
export function fighterSkillStatuses(sim: Simulation, fighter: Fighter) { return fighter.definition.skills.map((skill, i) => skillStatus(sim, fighter, skill, fighter.skills[i])); }
