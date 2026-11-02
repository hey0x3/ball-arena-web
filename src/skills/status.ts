import type { Skill } from '../content/schema';
import { storedImpulse, type Fighter, type Simulation, type SkillState } from '../simulation/engine';
import { leagueColors, leagueSkillStatus } from './league-status';

export type SkillStatus = { id: string; name: string; phase: 'charging' | 'cooldown' | 'ready' | 'triggered'; label: string; detail: string; progress: number; color: string };
const seconds = (n: number) => Math.max(0, n).toFixed(1) + 's';
export function skillStatus(sim: Simulation, fighter: Fighter, skill: Skill, state: SkillState): SkillStatus {
  const colors = { ...leagueColors, 'wall-charge': '#36e0cf', 'rotating-blade': '#d4e6ff', projectile: '#ffd452', shield: '#59bfff', magnet: '#e06bff', trail: '#ff7a1f', beam: '#c780ff', dash: '#ffa633', puck: '#66ebff', 'darkin-blade': '#ff6868', 'infernal-chains': '#faab60', 'world-ender': '#ff424d', timewinder: '#60e9d1', 'phase-dive': '#9cdeff', chronobreak: '#73ffd0', 'meat-hook': '#c6c9ad', rot: '#b2d954', dismember: '#ee9980' };
  const base: SkillStatus = { id: skill.id, name: skill.name, phase: 'cooldown', label: seconds(state.cooldown), detail: '', progress: Math.max(0, Math.min(1, 1 - state.cooldown / skill.cooldown)), color: colors[skill.type] };
  switch (skill.type) {
    case 'orb-of-deception': case 'charm': case 'spirit-rush': case 'piltover-peacemaker': case 'yordle-snap-trap': case 'ace-in-the-hole': case 'urchin-strike': case 'playful-trickster': case 'chum-the-waters': return leagueSkillStatus(skill, state, base);
    case 'meat-hook': {
      const mode = state.pudge?.mode;
      return { ...base, phase: mode === 'windup' ? 'charging' : ['outbound', 'reeling', 'miss'].includes(mode ?? '') ? 'triggered' : 'cooldown',
        label: mode === 'windup' ? 'HOOK WINDUP · ' + seconds(state.pudge!.timer) : mode === 'outbound' ? 'HOOK FLYING' : mode === 'reeling' ? 'PREY HOOKED · REELING' : mode === 'miss' ? 'HOOK RETURNING' : mode === 'interrupted' && state.flash > 0 ? 'CAST INTERRUPTED' : seconds(state.cooldown) + ' to hook',
        detail: 'Hit ' + skill.damage + ' · first target · pull to Pudge' };
    }
    case 'rot': return { ...base, phase: state.active > 0 ? 'triggered' : 'ready',
      label: state.active > 0 ? 'ROT ACTIVE · TICK ' + seconds(state.cooldown) : 'ROT OFF · WAITING FOR PREY',
      detail: skill.damage + ' / ' + (skill.tickInterval ?? .2) + 's · self ' + (skill.selfDamage ?? skill.damage) + ' (non-lethal) · slow ' + Math.round((skill.slow ?? .25) * 100) + '%',
      progress: state.active > 0 ? 1 - state.cooldown / (skill.tickInterval ?? .2) : 0 };
    case 'dismember': return { ...base, phase: state.pudge?.mode === 'channel' ? 'triggered' : state.cooldown <= .0002 ? 'ready' : 'cooldown',
      label: state.pudge?.mode === 'channel' ? 'DEVOURING · ' + seconds(state.active) : state.pudge?.mode === 'interrupted' && state.flash > 0 ? 'CHANNEL INTERRUPTED' : state.cooldown <= .0002 ? 'READY · NEED CLOSE TARGET' : seconds(state.cooldown) + ' to devour',
      detail: 'Disable + pull · ' + skill.damage + ' / ' + (skill.tickInterval ?? .5) + 's · heal from damage', progress: state.active > 0 ? state.active / skill.duration : base.progress };
    case 'darkin-blade': {
      const data = state.champion, casting = data?.mode === 'windup', combo = casting || data?.mode === 'recast';
      return { ...base, phase: casting ? 'charging' : state.flash > 0 ? 'triggered' : 'cooldown',
        label: casting ? 'Q' + data.stage + ' WINDUP · ' + seconds(data.timer) : state.flash > 0 ? 'Q' + (data?.strike?.stage ?? 1) + ' SLASH' : combo ? 'NEXT SWING · ' + seconds(data!.timer) : seconds(state.cooldown) + ' to combo',
        detail: 'Three strikes · sweet spots ×' + (skill.sweetSpotMultiplier ?? 1.6) + ' + knock-up', progress: combo ? (data!.stage - (casting ? data!.timer / (skill.windup ?? .45) : 0)) / 3 : base.progress };
    }
    case 'infernal-chains': {
      const mode = state.champion?.mode;
      return { ...base, phase: mode === 'tether' || mode === 'pull' || state.flash > 0 ? 'triggered' : 'cooldown',
        label: mode === 'tether' ? 'ESCAPE ZONE · ' + seconds(state.active) : mode === 'pull' ? 'CHAIN PULL' : mode === 'projectile' ? 'CHAIN FLYING' : state.flash > 0 ? mode === 'escaped' ? 'CHAIN ESCAPED' : 'PULLED BACK' : seconds(state.cooldown) + ' to chain',
        detail: 'Hit ' + skill.damage + ' · leave diamond or take a second hit', progress: mode === 'tether' ? state.active / skill.duration : base.progress };
    }
    case 'world-ender': return { ...base, phase: state.active > 0 ? 'triggered' : 'cooldown', label: state.active > 0 ? 'WORLD ENDER · ' + seconds(state.active) : seconds(state.cooldown) + ' to transform',
      detail: 'Damage ×' + (skill.damageMultiplier ?? 1.25) + ' · speed ×' + (skill.speedMultiplier ?? 1.2) + ' · empowered healing', progress: state.active > 0 ? state.active / skill.duration : base.progress };
    case 'timewinder': {
      const device = state.champion?.device;
      return { ...base, phase: device ? 'triggered' : 'cooldown', label: device ? device.phase === 'field' ? 'TIME FIELD · ' + seconds(device.timer) : device.phase === 'returning' ? 'RETURNING' : 'OUTBOUND' : seconds(state.cooldown) + ' to throw',
        detail: 'Out ' + skill.damage + ' · return ' + (skill.returnDamage ?? skill.damage * 1.5) + ' · slowing field' };
    }
    case 'phase-dive': {
      const mode = state.champion?.mode;
      return { ...base, phase: mode === 'dash' || state.flash > 0 ? 'triggered' : mode === 'armed' ? 'ready' : 'cooldown',
        label: mode === 'dash' ? 'DASHING' : mode === 'armed' ? 'BLINK READY · ' + seconds(state.active) : state.flash > 0 ? 'BLINK STRIKE' : seconds(state.cooldown) + ' to dive',
        detail: 'Dash → blink attack · bonus ' + skill.damage + ' · one strike' };
    }
    case 'chronobreak': return { ...base, phase: state.champion?.mode === 'rewind' ? 'charging' : state.flash > 0 ? 'triggered' : 'cooldown',
      label: state.champion?.mode === 'rewind' ? 'REWINDING · ' + seconds(state.champion.timer) : state.flash > 0 ? 'TIME REVERSED · +' + state.lastDamage : seconds(state.cooldown) + ' to rewind',
      detail: (skill.rewindSeconds ?? 4) + 's rewind · heal recent damage · blast ' + skill.damage };
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
