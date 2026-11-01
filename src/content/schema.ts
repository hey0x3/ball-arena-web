import { z } from 'zod';

const bounded = (min: number, max: number) => z.number().min(min).max(max);
export const skillTypes = ['wall-charge', 'rotating-blade', 'projectile', 'shield', 'magnet', 'trail', 'beam', 'dash', 'puck'] as const;
export const skillLabels: Record<SkillType, string> = {
  'wall-charge': 'Wall Charge', 'rotating-blade': 'Rotating Blade', projectile: 'Dart Shot',
  shield: 'Aegis', magnet: 'Polar Pull', trail: 'Fire Wake', beam: 'Refraction', dash: 'Meteor Rush', puck: 'Power Shot',
};
export const skillSchema = z.object({
  id: z.string().min(1).max(60), type: z.enum(skillTypes), name: z.string().min(1).max(40),
  damage: bounded(0, 200), cooldown: bounded(0.1, 30), duration: bounded(0.1, 10),
  power: bounded(0, 20), range: bounded(0.1, 20),
  windup: bounded(0, 5).optional(), maxCharges: bounded(1, 5).int().optional(),
  impulseCap: bounded(0, 30).optional(), minimumImpact: bounded(0, 10).optional(),
  damagePerImpulse: bounded(0, 50).optional(), bounceInterval: bounded(.02, 5).optional(),
  rotationSpeed: bounded(0, 720).optional(), reflections: bounded(0, 4).int().optional(),
  emitInterval: bounded(.02, 2).optional(), poolSize: bounded(1, 64).int().optional(),
  powerDamage: bounded(0, 200).int().optional(),
}).strict();
export const characterSchema = z.object({
  schemaVersion: z.literal(1), id: z.string().regex(/^[a-z0-9-]+:[a-z0-9-]+$/).max(100),
  name: z.string().min(1).max(32), description: z.string().max(300),
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
export const skillParameters: Record<SkillType, (keyof Omit<Skill, 'id' | 'type' | 'name'>)[]> = {
  'wall-charge': ['damagePerImpulse', 'cooldown', 'power', 'maxCharges', 'impulseCap', 'minimumImpact'], 'rotating-blade': ['damage', 'cooldown', 'range', 'rotationSpeed'],
  projectile: ['damage', 'cooldown', 'duration', 'power', 'poolSize'], shield: ['damage', 'cooldown', 'duration'],
  magnet: ['maxCharges', 'duration', 'power', 'range'], trail: ['damage', 'cooldown', 'duration', 'range', 'emitInterval', 'poolSize'],
  beam: ['damage', 'cooldown', 'duration', 'range', 'reflections'], dash: ['damage', 'cooldown', 'duration', 'power', 'range', 'windup'],
  puck: ['damage', 'cooldown', 'powerDamage', 'power', 'range'],
};
export function parameterLabel(type: SkillType, key: string) {
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
  for (const path of [c.appearance.body, c.appearance.weapon]) {
    if (path && !/^assets\/[a-zA-Z0-9_\-/]+\.(png|webp)$/.test(path)) throw new Error('Artwork must use a relative assets/*.png or *.webp path.');
    if (path?.split('/').includes('..')) throw new Error('Artwork paths cannot traverse directories.');
  }
  for (const s of c.skills) if ((s.type === 'dash' && (s.windup ?? .7) > s.cooldown) || (s.type === 'beam' && s.duration > s.cooldown)) throw new Error('Windup must not exceed the skill interval.');
  return c;
}

export function defaultSkill(type: SkillType): Skill {
  const values: Record<SkillType, [number, number, number, number, number]> = {
    'wall-charge': [5, 0.15, 1, 2, 1], 'rotating-blade': [12, 0.6, 1, 0, 1.3],
    projectile: [14, 2.5, 1.5, 8, 8], shield: [25, 5, 3, 0, 1],
    magnet: [0, 3, 1.25, 8, 3], trail: [4, 0.5, 2.5, 0, 0.22],
    beam: [18, 3, 0.45, 0, 16], dash: [20, 4.5, 0.6, 6, 11], puck: [8, 4, 1, 12, 7],
  };
  const [damage, cooldown, duration, power, range] = values[type];
  const extra: Partial<Record<SkillType, Partial<Skill>>> = {
    'wall-charge': { maxCharges: 3, impulseCap: 6, minimumImpact: 1, damagePerImpulse: 2.5 }, 'rotating-blade': { rotationSpeed: 180 },
    projectile: { poolSize: 4 }, magnet: { maxCharges: 3, bounceInterval: .15, minimumImpact: 1 },
    trail: { emitInterval: .1, poolSize: 32 }, beam: { reflections: 2 }, dash: { windup: .7 }, puck: { powerDamage: 24 },
  };
  return { id: type, type, name: skillLabels[type], damage, cooldown, duration, power, range, ...extra[type] };
}
