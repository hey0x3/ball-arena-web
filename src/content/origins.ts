import type { Character } from './schema';

export const ORIGINAL_ORIGIN = 'Original creations';
export function characterOrigin(character: Character) {
  return character.origin ?? (character.id.startsWith('core:') ? 'Ball Arena' : ORIGINAL_ORIGIN);
}
export function characterOrigins(characters: Character[]) {
  const counts = new Map<string, number>();
  for (const character of characters) {
    const origin = characterOrigin(character); counts.set(origin, (counts.get(origin) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) => ({ name, count }));
}
