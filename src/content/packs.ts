import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { validateCharacter, type SavedCharacter } from './schema';

const MAX_FILE = 10 * 1024 * 1024;
const MAX_EXPANDED = 20 * 1024 * 1024;
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export async function imageData(file: Blob): Promise<string> {
  if (file.size > 4 * 1024 * 1024) throw new Error('Artwork must be under 4 MiB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  const webp = strFromU8(bytes.slice(0, 4)) === 'RIFF' && strFromU8(bytes.slice(8, 12)) === 'WEBP';
  if (!png && !webp) throw new Error('Use a PNG or WebP image.');
  const image = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: png ? 'image/png' : 'image/webp' }));
  const valid = image.width <= 2048 && image.height <= 2048; image.close();
  if (!valid) throw new Error('Artwork dimensions must be at most 2048 × 2048.');
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read artwork.'));
    reader.readAsDataURL(new Blob([new Uint8Array(bytes)], { type: png ? 'image/png' : 'image/webp' }));
  });
}
export async function importPack(file: File): Promise<SavedCharacter> {
  if (file.size > MAX_FILE) throw new Error('Character packs must be under 10 MiB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.name.toLowerCase().endsWith('.json')) {
    const character = validateCharacter(JSON.parse(strFromU8(bytes)));
    if (character.appearance.body || character.appearance.weapon) throw new Error('This character uses artwork. Import a ZIP with its assets folder.');
    return { character, media: {} };
  }
  let size = 0, count = 0;
  const files = unzipSync(bytes, { filter: entry => {
    count++; size += entry.originalSize;
    if (count > 32 || size > MAX_EXPANDED || entry.originalSize > MAX_FILE) throw new Error('Pack exceeds the 32-file / 20 MiB expanded limit.');
    if (entry.name.startsWith('/') || entry.name.includes('\\') || entry.name.split('/').includes('..')) throw new Error('Pack contains an invalid file path.');
    if (entry.name.endsWith('/')) return false;
    if (entry.name !== 'character.json' && !/^assets\/[a-zA-Z0-9_\-/]+\.(png|webp)$/.test(entry.name)) throw new Error('Packs support character.json and PNG/WebP artwork in assets/.');
    return true;
  } });
  if (!files['character.json']) throw new Error('ZIP must contain character.json at its root.');
  const character = validateCharacter(JSON.parse(strFromU8(files['character.json'])));
  const media: Record<string, string> = {};
  for (const path of [character.appearance.body, character.appearance.weapon].filter((p): p is string => !!p)) {
    const data = files[path]; if (!data) throw new Error('The artwork referenced in character.json is missing: ' + path);
    media[path] = await imageData(new Blob([new Uint8Array(data)]));
  }
  return { character, media };
}
export async function exportPack(entry: SavedCharacter) {
  const character = validateCharacter(entry.character);
  const files: Record<string, Uint8Array> = { 'character.json': strToU8(JSON.stringify(character, null, 2)) };
  for (const path of [character.appearance.body, character.appearance.weapon].filter((p): p is string => !!p)) {
    let data = entry.media[path];
    if (!data) throw new Error('Body artwork is missing.');
    if (!data.startsWith('data:')) {
      const response = await fetch(data); if (!response.ok) throw new Error('Could not load character artwork for export.');
      data = await imageData(await response.blob());
    }
    files[path] = Uint8Array.from(atob(data.split(',')[1]), c => c.charCodeAt(0));
  }
  downloadBlob(new Blob([new Uint8Array(zipSync(files))], { type: 'application/zip' }), `${character.id.replace(':', '-')}.zip`);
}
