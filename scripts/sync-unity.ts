// Explicit development utility: never imported by the app or run by the build.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { defaultSkill, validateCharacter, type SkillType } from '../src/content/schema';

const root = resolve(import.meta.dirname, '..'), unity = resolve(process.argv[2] || join(root, '..'));
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const names = ['Bumper', 'Sawblade', 'Dartling', 'Bulwark', 'Magnetron', 'Embertrail', 'Prism', 'Meteorion', 'Mallet'];
const types: SkillType[] = ['wall-charge', 'rotating-blade', 'projectile', 'shield', 'magnet', 'trail', 'beam', 'dash', 'puck'];
const sources = ['BallCombat2D', 'BallLevelingRules', 'BouncingBall2D', 'BumperCharge2D', 'Sawblade2D', 'Dartling2D', 'DartProjectile2D', 'BallBodyArtwork2D', 'Bulwark2D', 'Magnetron2D', 'Embertrail2D', 'EmbertrailSegment2D', 'PrismBeam2D', 'MeteorCharge2D', 'Mallet2D', 'AirHockeyPuck2D'];
const audited: unknown[] = [];
for (const [index, name] of names.entries()) {
  const relative = 'Assets/BallGame/Characters/' + name + '.asset', text = readFileSync(join(unity, relative), 'utf8');
  const scalar = (key: string, fallback?: number) => { const m = text.match(new RegExp('^  ' + key + ': ([^\\r\\n]+)', 'm')); if (!m && fallback === undefined) throw new Error('Missing ' + name + '.' + key); return m ? Number(m[1]) : fallback!; };
  const path = join(root, 'content/characters', name.toLowerCase(), 'character.json');
  const c = JSON.parse(readFileSync(path, 'utf8')); const s = defaultSkill(types[index]);
  c.stats = { maxHp: scalar('maximumHP'), radius: .4, mass: scalar('mass'), cruiseSpeed: scalar('movementSpeed'), maxSpeed: scalar('maximumSpeed'), contactDamage: scalar('contactDamage'), contactInterval: scalar('contactHitInterval') };
  if (s.type === 'wall-charge') Object.assign(s, { power: scalar('wallChargeImpulsePerStack'), damage: scalar('wallChargeImpulsePerStack') * scalar('wallChargeDamagePerImpulse'), damagePerImpulse: scalar('wallChargeDamagePerImpulse'), maxCharges: scalar('wallChargeMaximum'), impulseCap: scalar('wallChargeImpulseCap'), minimumImpact: scalar('wallChargeMinimumImpact'), cooldown: scalar('wallChargeBounceInterval') });
  if (s.type === 'rotating-blade') Object.assign(s, { damage: scalar('bladeDamage'), cooldown: scalar('bladeHitInterval'), range: scalar('bladeReachRatio'), rotationSpeed: scalar('bladeRotationSpeed') });
  if (s.type === 'projectile') Object.assign(s, { damage: scalar('dartDamage'), cooldown: scalar('dartInterval'), power: scalar('dartSpeed'), duration: scalar('dartLifetime'), poolSize: 4 });
  if (s.type === 'shield') Object.assign(s, { damage: scalar('shieldCapacity'), cooldown: scalar('shieldInterval'), duration: scalar('shieldDuration') });
  if (s.type === 'magnet') Object.assign(s, { maxCharges: scalar('magnetBounces'), duration: scalar('magnetDuration'), power: scalar('magnetForce'), range: scalar('magnetRange') });
  if (s.type === 'trail') Object.assign(s, { damage: scalar('trailDamage'), cooldown: scalar('trailHitInterval'), duration: scalar('trailLifetime'), emitInterval: scalar('trailEmitInterval'), range: scalar('trailWidth'), poolSize: 32 });
  if (s.type === 'beam') Object.assign(s, { damage: scalar('beamDamage'), cooldown: scalar('beamInterval'), duration: scalar('beamWindup'), reflections: scalar('beamReflections'), range: scalar('beamRange') });
  if (s.type === 'dash') Object.assign(s, { damage: scalar('meteorBonusDamage'), cooldown: scalar('meteorInterval'), windup: scalar('meteorWindup'), duration: scalar('meteorDuration'), range: scalar('meteorSpeed'), power: scalar('meteorKnockback') });
  if (s.type === 'puck') Object.assign(s, { damage: scalar('puckDamage'), cooldown: scalar('puckPowerInterval'), powerDamage: scalar('puckPowerDamage'), power: scalar('puckPowerSpeed'), range: 7 });
  c.skills = [s]; c.version = '1.1.0';
  const description = text.match(/^  abilityDescription: ([^\r\n]*(?:\r?\n    [^\r\n]*)*)/m);
  if (description) c.description = description[1].replace(/\r?\n\s+/g, ' ').slice(0, 300);
  const art = 'Assets/BallGame/Sprites/' + (name === 'Sawblade' ? '' : 'Redesign/') + name + '.png';
  const png = readFileSync(join(unity, art)), meta = readFileSync(join(unity, art + '.meta'), 'utf8');
  const ppu = Number(meta.match(/spritePixelsToUnits: ([\d.]+)/)![1]);
  const pivot = meta.match(/spritePivot: \{x: ([\d.]+), y: ([\d.]+)\}/)!;
  const assetDir = join(root, 'content/characters', name.toLowerCase(), 'assets'); mkdirSync(assetDir, { recursive: true });
  copyFileSync(join(unity, art), join(assetDir, 'body.png'));
  const color = text.match(/bodyColor: \{r: ([\d.]+), g: ([\d.]+), b: ([\d.]+)/)!;
  c.appearance = { ...c.appearance, body: 'assets/body.png', bodyScale: png.readUInt32BE(16) / ppu, pivot: { x: Number(pivot[1]), y: Number(pivot[2]) }, bodyTint: '#' + color.slice(1, 4).map(v => Math.round(Number(v) * 255).toString(16).padStart(2, '0')).join('') };
  if (name === 'Sawblade') { const weapon = 'Assets/BallGame/Sprites/Sawblade-Weapon.png'; copyFileSync(join(unity, weapon), join(assetDir, 'weapon.png')); c.appearance.weapon = 'assets/weapon.png'; }
  c.assets = { license: 'MIT', source: 'Original BallGame project artwork, copied unmodified from ' + art + '. See docs/UNITY_PARITY.md.' };
  validateCharacter(c); writeFileSync(path, JSON.stringify(c, null, 2) + '\n');
  audited.push({ character: name, definition: relative, definitionHash: hash(join(unity, relative)), artwork: art, artworkHash: hash(join(unity, art)), stats: c.stats, skill: s });
}
const sourceHashes = Object.fromEntries(sources.map(name => ['Assets/Scripts/' + name + '.cs', hash(join(unity, 'Assets/Scripts/' + name + '.cs'))]));
for (const path of ['Assets/Scenes/SampleScene.unity', 'ProjectSettings/TimeManager.asset', 'Tools/EditorChecks/SetupMallet.cs']) sourceHashes[path] = hash(join(unity, path));
const flamePath = 'Assets/BallGame/Sprites/Flame.png';
const effectDir = join(root, 'src/rendering/assets'); mkdirSync(effectDir, { recursive: true });
copyFileSync(join(unity, flamePath), join(effectDir, 'flame.png'));
const effects = [{ source: flamePath, file: 'src/rendering/assets/flame.png', sha256: hash(join(unity, flamePath)), license: 'MIT' }];
writeFileSync(join(root, 'docs/unity-audit.json'), JSON.stringify({ inspected: '2026-10-30', baseline: 'Base stats, attack 100%, level 1 and mastery 1; no campaign modifiers.', sourceHashes, characters: audited, effects }, null, 2) + '\n');
console.log('Synced nine base definitions and approved sprites; Unity was read only.');
