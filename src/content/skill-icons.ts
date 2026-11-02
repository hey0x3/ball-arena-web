import { skillTypes, type MediaFiles, type Skill, type SkillType } from './schema';

const glyphs: Record<SkillType, string> = {
  'wall-charge': '<path d="M8 6v20M24 6v20M11 11l6 5-6 5M16 11l6 5-6 5"/>',
  'rotating-blade': '<path d="m16 3 3 5 6-1-1 6 5 3-5 3 1 6-6-1-3 5-3-5-6 1 1-6-5-3 5-3-1-6 6 1Z"/><circle cx="16" cy="16" r="5"/>',
  projectile: '<path d="m5 24 20-17-4 13-5-4-4-5M4 17l5-4M12 27l4-5"/>',
  shield: '<path d="M16 4 26 8v8c0 6-6 10-10 12C12 26 6 22 6 16V8Z"/><path d="m11 16 4 4 7-8"/>',
  magnet: '<path d="M7 6v11a9 9 0 0 0 18 0V6h-6v11a3 3 0 0 1-6 0V6ZM7 11h6M19 11h6"/>',
  trail: '<path d="M17 3c2 9-7 9-3 16 0-5 4-5 6-9 1 5 6 7 6 12a10 10 0 0 1-20 0c0-7 7-10 11-19Z"/>',
  beam: '<path d="m4 24 10-10 5 5 9-13M20 6h8v8M8 7l3 3M22 24l3 3"/>',
  dash: '<path d="m3 9 12 7L3 23M11 8l13 8-13 8M24 5l4 2M24 27l4-2"/>',
  puck: '<ellipse cx="16" cy="18" rx="11" ry="6"/><path d="M5 18v5c0 7 22 7 22 0v-5M9 9l4-5M16 8l4-5"/>',
  'darkin-blade': '<path d="m7 26 6-7-4-4L25 3l-5 16-4-3-6 13M8 18l7 7"/>',
  'infernal-chains': '<path d="m12 8 3-3a6 6 0 0 1 9 9l-3 3M20 24l-3 3a6 6 0 0 1-9-9l3-3M11 21l10-10"/>',
  'world-ender': '<path d="m15 10-4-6-7 2 4 4-4 7 8-3 4 13 4-13 8 3-4-7 4-4-7-2-4 6Z"/>',
  timewinder: '<circle cx="16" cy="16" r="8"/><path d="M16 10v6l5 3M4 12a13 13 0 0 1 23-3M4 6v6h6M28 20A13 13 0 0 1 5 23M28 26v-6h-6"/>',
  'phase-dive': '<path d="M4 9h11M3 16h7M4 23h11M20 5l8 11-8 11M15 7l6 9-6 9"/>',
  chronobreak: '<path d="M7 7a12 12 0 1 1-3 12M7 3v7H1M16 8v9l-6 3"/>',
  'meat-hook': '<path d="M12 3v13c0 11 16 11 16 1v-4l-6 5M12 7H6M12 12H6"/>',
  rot: '<circle cx="16" cy="18" r="9"/><circle cx="7" cy="7" r="2"/><circle cx="25" cy="5" r="2"/><path d="m12 16 2 2M20 16l-2 2M12 23c3-3 5-3 8 0"/>',
  dismember: '<path d="M5 8c7-6 15-6 22 0L16 27ZM7 9l3 8 3-8 3 8 3-8 3 8 3-8"/>',
  'orb-of-deception': '<circle cx="16" cy="16" r="7"/><path d="M8 7C-4 15 7 30 25 24M24 25c12-8 1-23-17-17M9 4 7 8l4 1M23 28l2-4-4-1"/>',
  charm: '<path d="M16 27C-8 11 9-3 16 9 23-3 40 11 16 27Z"/>',
  'spirit-rush': '<path d="M25 17C2-8-2 2 19 18 0 0-7 17 18 20-4 12-2 31 20 22 7 36 30 31 25 17Z"/>',
  'piltover-peacemaker': '<path d="m4 24 7-7 4 2 12-12M17 8l7 7M22 5l5 5M5 8h7M3 13h6"/>',
  'yordle-snap-trap': '<ellipse cx="16" cy="19" rx="12" ry="8"/><path d="m5 14 4 7 4-7 3 7 4-7 3 7 4-7M12 9h8M13 5h6"/>',
  'ace-in-the-hole': '<circle cx="16" cy="16" r="9"/><circle cx="16" cy="16" r="3"/><path d="M16 2v8M16 22v8M2 16h8M22 16h8"/>',
  'urchin-strike': '<path d="m7 27 17-17M16 6l5 5 6-1 1-7M13 9l-1 8 5 2M22 4l5 5"/>',
  'playful-trickster': '<path d="M16 29V11M8 5v7l8 5 8-5V5M13 5h6M3 26c4-4 6 3 10 0M19 26c4-4 6 3 10 0"/>',
  'chum-the-waters': '<path d="M4 25 14 4l5 15 9 6ZM13 22l2-5 2 5 2-5 2 5M2 29c6-5 8 4 14 0s8 5 14 0"/>',
};
export const fallbackSkillIcons = Object.fromEntries(skillTypes.map(type => [type, 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="5" fill="#252333"/><circle cx="20" cy="20" r="17" fill="#363146"/><g transform="translate(4 4)" fill="none" stroke="#d6c5f2" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${glyphs[type]}</g></svg>`)])) as Record<SkillType, string>;
export const fallbackSkillMedia = Object.fromEntries(skillTypes.map(type => ['skill-icons/' + type, fallbackSkillIcons[type]]));
export function skillIconUrl(skill: Skill, media: MediaFiles = {}) { return skill.icon && media[skill.icon] || fallbackSkillIcons[skill.type]; }
