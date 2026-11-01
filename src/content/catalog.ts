import { validateCharacter, type Character } from './schema';

const files = import.meta.glob('../../content/characters/*/character.json', { eager: true, import: 'default' });
const artwork = import.meta.glob('../../content/characters/*/assets/**/*.{png,webp}', { eager: true, query: '?url', import: 'default' });
export const builtinMedia: Record<string, Record<string, string>> = {};
for (const [path, value] of Object.entries(files)) {
  const c = validateCharacter(value);
  for (const asset of [c.appearance.body, c.appearance.weapon].filter((p): p is string => !!p)) {
    const url = artwork[`${path.slice(0, path.lastIndexOf('/'))}/${asset}`];
    if (typeof url !== 'string') throw new Error(`Missing built-in artwork: ${c.id}`);
    builtinMedia[c.id] ??= {}; builtinMedia[c.id][asset] = url;
  }
}
export const builtins: Character[] = Object.entries(files).sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => validateCharacter(value));
export const catalog = [...builtins].sort((a, b) => {
  const order = ['bumper', 'sawblade', 'dartling', 'bulwark', 'magnetron', 'embertrail', 'prism', 'meteorion', 'mallet'];
  return order.indexOf(a.id.split(':')[1]) - order.indexOf(b.id.split(':')[1]);
});
