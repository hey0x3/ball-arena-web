import { z } from 'zod';

const bounded = (min: number, max: number) => z.number().min(min).max(max);
export const skillTypes = ['wall-charge', 'rotating-blade', 'projectile', 'shield', 'magnet', 'trail', 'beam', 'dash', 'puck', 'darkin-blade', 'infernal-chains', 'world-ender', 'timewinder', 'phase-dive', 'chronobreak', 'meat-hook', 'rot', 'dismember', 'orb-of-deception', 'charm', 'spirit-rush', 'piltover-peacemaker', 'yordle-snap-trap', 'ace-in-the-hole', 'urchin-strike', 'playful-trickster', 'chum-the-waters'] as const;
export const skillLabels: Record<SkillType, string> = {
  'wall-charge': 'Wall Charge', 'rotating-blade': 'Rotating Blade', projectile: 'Dart Shot',
  shield: 'Aegis', magnet: 'Polar Pull', trail: 'Fire Wake', beam: 'Refraction', dash: 'Meteor Rush', puck: 'Power Shot',
  'darkin-blade': 'The Darkin Blade', 'infernal-chains': 'Infernal Chains', 'world-ender': 'World Ender',
  timewinder: 'Timewinder', 'phase-dive': 'Phase Dive', chronobreak: 'Chronobreak',
  'meat-hook': 'Meat Hook', rot: 'Rot', dismember: 'Dismember',
  'orb-of-deception': 'Orb of Deception', charm: 'Charm', 'spirit-rush': 'Spirit Rush',
  'piltover-peacemaker': 'Piltover Peacemaker', 'yordle-snap-trap': 'Yordle Snap Trap', 'ace-in-the-hole': 'Ace in the Hole',
  'urchin-strike': 'Urchin Strike', 'playful-trickster': 'Playful / Trickster', 'chum-the-waters': 'Chum the Waters',
};
export const skillSchema = z.object({
  id: z.string().min(1).max(60), type: z.enum(skillTypes), name: z.string().min(1).max(40),
  icon: z.string().max(150).optional(),
  damage: bounded(0, 200), cooldown: bounded(0.1, 30), duration: bounded(0.1, 10),
  power: bounded(0, 20), range: bounded(0.1, 20),
  windup: bounded(0, 5).optional(), maxCharges: bounded(1, 5).int().optional(),
  impulseCap: bounded(0, 30).optional(), minimumImpact: bounded(0, 10).optional(),
  damagePerImpulse: bounded(0, 50).optional(), bounceInterval: bounded(.02, 5).optional(),
  rotationSpeed: bounded(0, 720).optional(), reflections: bounded(0, 4).int().optional(),
  emitInterval: bounded(.02, 2).optional(), poolSize: bounded(1, 64).int().optional(),
  powerDamage: bounded(0, 200).int().optional(),
  recastInterval: bounded(.1, 3).optional(), sweetSpotMultiplier: bounded(1, 3).optional(),
  controlDuration: bounded(0, 2).optional(), zoneRadius: bounded(.2, 3).optional(),
  slow: bounded(0, .9).optional(), slowDuration: bounded(.1, 5).optional(),
  damageMultiplier: bounded(1, 3).optional(), speedMultiplier: bounded(1, 2).optional(),
  healMultiplier: bounded(1, 3).optional(), healRatio: bounded(0, 1).optional(),
  heal: bounded(0, 200).optional(), rewindSeconds: bounded(1, 4).optional(), returnDamage: bounded(0, 200).optional(),
  tickInterval: bounded(.1, 2).optional(), selfDamage: bounded(0, 200).optional(),
}).strict();
export const characterSchema = z.object({
  schemaVersion: z.literal(1), id: z.string().regex(/^[a-z0-9-]+:[a-z0-9-]+$/).max(100),
  name: z.string().min(1).max(32), description: z.string().max(300),
  origin: z.string().trim().min(1).max(60).optional(),
  author: z.string().min(1).max(80), version: z.string().regex(/^\d+\.\d+\.\d+$/),
  appearance: z.object({ color: z.string().regex(/^#[\da-fA-F]{6}$/), style: z.enum(['core', 'blade', 'dart', 'shield', 'magnet', 'flame', 'prism', 'meteor', 'mallet']), body: z.string().max(150).optional(),
    bodyScale: bounded(.5, 2).optional(), pivot: z.object({ x: bounded(0, 1), y: bounded(0, 1) }).strict().optional(),
    bodyTint: z.string().regex(/^#[\da-fA-F]{6}$/).optional(), weapon: z.string().max(150).optional(),
  }).strict(),
  stats: z.object({
    maxHp: bounded(1, 2000).int(), radius: bounded(0.15, 0.65), mass: bounded(0.1, 10),
    cruiseSpeed: bounded(0.5, 12), maxSpeed: bounded(1, 20), contactDamage: bounded(0, 200).int(), contactInterval: bounded(0.1, 10),
  }).strict(),
  skills: z.array(skillSchema).max(3),
  assets: z.object({ license: z.string().min(1).max(100), source: z.string().min(1).max(300) }).strict(),
}).strict();
export type Character = z.infer<typeof characterSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type SkillType = typeof skillTypes[number];
export const skillParameters: Record<SkillType, (keyof Omit<Skill, 'id' | 'type' | 'name' | 'icon'>)[]> = {
  'wall-charge': ['damagePerImpulse', 'cooldown', 'power', 'maxCharges', 'impulseCap', 'minimumImpact'], 'rotating-blade': ['damage', 'cooldown', 'range', 'rotationSpeed'],
  projectile: ['damage', 'cooldown', 'duration', 'power', 'poolSize'], shield: ['damage', 'cooldown', 'duration'],
  magnet: ['maxCharges', 'duration', 'power', 'range'], trail: ['damage', 'cooldown', 'duration', 'range', 'emitInterval', 'poolSize'],
  beam: ['damage', 'cooldown', 'duration', 'range', 'reflections'], dash: ['damage', 'cooldown', 'duration', 'power', 'range', 'windup'],
  puck: ['damage', 'cooldown', 'powerDamage', 'power', 'range'],
  'darkin-blade': ['damage', 'cooldown', 'range', 'windup', 'recastInterval', 'sweetSpotMultiplier', 'controlDuration'],
  'infernal-chains': ['damage', 'cooldown', 'power', 'range', 'duration', 'zoneRadius', 'slow'],
  'world-ender': ['cooldown', 'duration', 'damageMultiplier', 'speedMultiplier', 'healRatio', 'healMultiplier'],
  timewinder: ['damage', 'returnDamage', 'cooldown', 'power', 'range', 'duration', 'slow', 'slowDuration'],
  'phase-dive': ['damage', 'cooldown', 'power', 'range', 'duration', 'windup'],
  chronobreak: ['damage', 'cooldown', 'range', 'duration', 'rewindSeconds', 'heal', 'healRatio'],
  'meat-hook': ['damage', 'cooldown', 'power', 'range', 'windup'],
  rot: ['damage', 'selfDamage', 'tickInterval', 'range', 'slow'],
  dismember: ['damage', 'cooldown', 'duration', 'tickInterval', 'range', 'power', 'healRatio'],
  'orb-of-deception': ['damage', 'returnDamage', 'cooldown', 'power', 'range'],
  charm: ['damage', 'cooldown', 'power', 'range', 'duration', 'windup'],
  'spirit-rush': ['damage', 'cooldown', 'power', 'range', 'duration', 'maxCharges', 'recastInterval'],
  'piltover-peacemaker': ['damage', 'cooldown', 'power', 'range', 'windup'],
  'yordle-snap-trap': ['damage', 'cooldown', 'duration', 'range', 'windup', 'controlDuration', 'poolSize'],
  'ace-in-the-hole': ['damage', 'cooldown', 'power', 'range', 'windup'],
  'urchin-strike': ['damage', 'cooldown', 'power', 'range'],
  'playful-trickster': ['damage', 'cooldown', 'duration', 'range', 'zoneRadius', 'slow', 'slowDuration'],
  'chum-the-waters': ['damage', 'cooldown', 'power', 'range', 'duration', 'zoneRadius', 'slow', 'controlDuration', 'damageMultiplier'],
};
export function parameterLabel(type: SkillType, key: string) {
  if (key === 'maxCharges' && type === 'spirit-rush') return 'Dashes per cast';
  if (key === 'recastInterval' && type === 'spirit-rush') return 'Between dashes (s)';
  if (key === 'duration' && type === 'spirit-rush') return 'Dash time (s)';
  if (key === 'range' && type === 'spirit-rush') return 'Essence bolt range';
  if (key === 'damage' && type === 'yordle-snap-trap') return 'Follow-up headshot damage';
  if (key === 'windup' && type === 'yordle-snap-trap') return 'Trap arming time (s)';
  if (key === 'duration' && type === 'yordle-snap-trap') return 'Trap lifetime (s)';
  if (key === 'controlDuration' && type === 'yordle-snap-trap') return 'Root time (s)';
  if (key === 'duration' && type === 'charm') return 'Charm time (s)';
  if (key === 'duration' && type === 'playful-trickster') return 'Untargetable hop time (s)';
  if (key === 'duration' && type === 'chum-the-waters') return 'Shark delay (s)';
  if (key === 'damage' && ['rot', 'dismember'].includes(type)) return 'Damage per tick';
  if (key === 'selfDamage') return 'Self-damage per tick (non-lethal)';
  if (key === 'tickInterval') return 'Damage interval (s)';
  if (key === 'power' && type === 'meat-hook') return 'Hook / reel speed';
  if (key === 'power' && type === 'dismember') return 'Pull speed';
  if (key === 'range' && type === 'rot') return 'Cloud radius';
  if (key === 'range' && type === 'dismember') return 'Cast reach beyond body';
  if (key === 'healRatio' && type === 'dismember') return 'Damage healed fraction';
  if (key === 'damage' && type === 'shield') return 'Shield capacity';
  if (key === 'damage' && type === 'wall-charge') return 'Damage per charge';
  if (key === 'cooldown' && type === 'wall-charge') return 'Bounce interval (s)';
  if (key === 'cooldown' && (type === 'trail' || type === 'rotating-blade')) return 'Hit interval (s)';
  if (key === 'range' && type === 'dash') return 'Rush speed';
  if (key === 'range' && type === 'rotating-blade') return 'Reach multiplier';
  if (key === 'range' && type === 'trail') return 'Trail width';
  if (key === 'range' && type === 'puck') return 'Normal puck speed';
  if (key === 'power' && type === 'puck') return 'Power puck speed';
  if (key === 'power' && type === 'projectile') return 'Dart speed';
  if (key === 'duration' && type === 'beam') return 'Aim-lock windup (s)';
  if (key === 'duration' && type === 'infernal-chains') return 'Escape time (s)';
  if (key === 'duration' && type === 'timewinder') return 'Time field duration (s)';
  if (key === 'duration' && type === 'chronobreak') return 'Rewind cast time (s)';
  if (key === 'range' && type === 'phase-dive') return 'Blink attack range';
  const championLabels: Record<string, string> = { recastInterval: 'Between swings (s)', sweetSpotMultiplier: 'Sweet spot damage ×', controlDuration: 'Knock-up (s)', zoneRadius: 'Trap radius', slow: 'Slow fraction', slowDuration: 'Slow duration (s)', damageMultiplier: 'Damage ×', speedMultiplier: 'Move speed ×', healMultiplier: 'Healing ×', healRatio: type === 'chronobreak' ? 'Recent damage recovered' : 'Damage leech fraction', heal: 'Base healing', rewindSeconds: 'Rewind history (s)', returnDamage: 'Return damage' };
  if (championLabels[key]) return championLabels[key];
  const labels: Record<string, string> = { maxCharges: 'Wall bounces', impulseCap: 'Impulse cap', minimumImpact: 'Minimum impact', damagePerImpulse: 'Damage / impulse', rotationSpeed: 'Rotation (°/s)', emitInterval: 'Emit interval (s)', poolSize: 'Pool size', powerDamage: 'Power damage', windup: 'Windup (s)' };
  if (labels[key]) return labels[key];
  return key === 'cooldown' || key === 'duration' ? `${key} (s)` : key;
}
export type MediaFiles = Record<string, string>;
export type SavedCharacter = { character: Character; media: MediaFiles };

export function validateCharacter(value: unknown): Character {
  const result = characterSchema.safeParse(value);
  if (!result.success) throw new Error(result.error.issues.map(issue => `${issue.path.join('.') || 'character'}: ${issue.message}`).join('\n'));
  const c = result.data;
  if (c.stats.maxSpeed < c.stats.cruiseSpeed) throw new Error('stats.maxSpeed must be at least cruiseSpeed.');
  if (new Set(c.skills.map(s => s.id)).size !== c.skills.length) throw new Error('Skill IDs must be unique.');
  for (const path of characterAssetPaths(c)) {
    if (path && !/^assets\/[a-zA-Z0-9_\-/]+\.(png|webp)$/.test(path)) throw new Error('Artwork must use a relative assets/*.png or *.webp path.');
    if (path?.split('/').includes('..')) throw new Error('Artwork paths cannot traverse directories.');
  }
  for (const s of c.skills) if ((['dash', 'darkin-blade', 'phase-dive'].includes(s.type) && (s.windup ?? .45) > s.cooldown) || (s.type === 'beam' && s.duration > s.cooldown)) throw new Error('Windup must not exceed the skill interval.');
  return c;
}

export function characterAssetPaths(character: Character): string[] {
  return [...new Set([character.appearance.body, character.appearance.weapon, ...character.skills.map(skill => skill.icon)].filter((path): path is string => !!path))];
}

export function defaultSkill(type: SkillType): Skill {
  const values: Record<SkillType, [number, number, number, number, number]> = {
    'wall-charge': [5, 0.15, 1, 2, 1], 'rotating-blade': [12, 0.6, 1, 0, 1.3],
    projectile: [14, 2.5, 1.5, 8, 8], shield: [25, 5, 3, 0, 1],
    magnet: [0, 3, 1.25, 8, 3], trail: [4, 0.5, 2.5, 0, 0.22],
    beam: [18, 3, 0.45, 0, 16], dash: [20, 4.5, 0.6, 6, 11], puck: [8, 4, 1, 12, 7],
    'darkin-blade': [8, 3.2, .45, 0, 1.8], 'infernal-chains': [6, 6.5, 1.5, 6, 3],
    'world-ender': [0, 10, 6, 0, 1], timewinder: [7, 3.8, .45, 6, 2.8],
    'phase-dive': [12, 4.2, 2.5, 8, 1.6], chronobreak: [24, 10, .3, 0, 1.2],
    'meat-hook': [18, 5.5, .2, 7, 4.5], rot: [2, .2, .2, 0, 1.15], dismember: [5, 9, 2.75, 1.5, .55],
    'orb-of-deception': [8, 3.5, .2, 6, 2.7], charm: [6, 5.8, 1, 6, 3.5], 'spirit-rush': [7, 9, .16, 9, 2.2],
    'piltover-peacemaker': [16, 4, .55, 9, 5], 'yordle-snap-trap': [14, 4, 7, 10, 2.5], 'ace-in-the-hole': [26, 10, 1, 12, 10],
    'urchin-strike': [12, 4.2, .3, 10, 1.35], 'playful-trickster': [14, 6.5, .65, 0, 1.4], 'chum-the-waters': [22, 9.5, 1.5, 5, 4],
  };
  const [damage, cooldown, duration, power, range] = values[type];
  const extra: Partial<Record<SkillType, Partial<Skill>>> = {
    'wall-charge': { maxCharges: 3, impulseCap: 6, minimumImpact: 1, damagePerImpulse: 2.5 }, 'rotating-blade': { rotationSpeed: 180 },
    projectile: { poolSize: 4 }, magnet: { maxCharges: 3, bounceInterval: .15, minimumImpact: 1 },
    trail: { emitInterval: .1, poolSize: 32 }, beam: { reflections: 2 }, dash: { windup: .7 }, puck: { powerDamage: 24 },
    'darkin-blade': { windup: .45, recastInterval: .35, sweetSpotMultiplier: 1.6, controlDuration: .22 },
    'infernal-chains': { zoneRadius: 1, slow: .25 },
    'world-ender': { damageMultiplier: 1.25, speedMultiplier: 1.2, healRatio: .18, healMultiplier: 1.5 },
    timewinder: { returnDamage: 11, slow: .35, slowDuration: .75 },
    'phase-dive': { windup: .16 }, chronobreak: { rewindSeconds: 4, heal: 10, healRatio: .35 },
    'meat-hook': { windup: .18 }, rot: { tickInterval: .2, selfDamage: 2, slow: .25 },
    dismember: { tickInterval: .5, healRatio: 1 },
    'orb-of-deception': { returnDamage: 8 }, charm: { windup: .15 }, 'spirit-rush': { maxCharges: 3, recastInterval: .55 },
    'piltover-peacemaker': { windup: .55 }, 'yordle-snap-trap': { windup: .6, controlDuration: .9, poolSize: 3 }, 'ace-in-the-hole': { windup: 1 },
    'playful-trickster': { zoneRadius: 1.05, slow: .35, slowDuration: .8 }, 'chum-the-waters': { zoneRadius: 1.1, slow: .35, controlDuration: .5, damageMultiplier: 1.5 },
  };
  return { id: type, type, name: skillLabels[type], damage, cooldown, duration, power, range, ...extra[type] };
}
