import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { characterAssetPaths, characterSchema, validateCharacter } from '../src/content/schema';

const root = resolve(import.meta.dirname, '..');
const path = join(root, 'content/characters');
const ids = new Set<string>();
for (const dir of readdirSync(path, { withFileTypes: true }).filter(d => d.isDirectory())) {
  const file = join(path, dir.name, 'character.json');
  const character = validateCharacter(JSON.parse(readFileSync(file, 'utf8')));
  if (ids.has(character.id)) throw new Error(`Duplicate character ID: ${character.id}`);
  ids.add(character.id);
  for (const asset of characterAssetPaths(character)) if (!existsSync(join(path, dir.name, asset))) throw new Error(`Missing artwork for ${character.id}: ${asset}`);
}
validateCharacter(JSON.parse(readFileSync(join(root, 'templates/character/character.json'), 'utf8')));
const schema = JSON.stringify(z.toJSONSchema(characterSchema), null, 2) + '\n';
const schemaPath = join(root, 'schemas/character.v1.schema.json');
if (process.argv.includes('--write')) {
  const { mkdirSync } = await import('node:fs'); mkdirSync(join(root, 'schemas'), { recursive: true });
  writeFileSync(schemaPath, schema);
} else if (!existsSync(schemaPath) || readFileSync(schemaPath, 'utf8') !== schema) throw new Error('JSON schema is stale. Run npm run schema.');
console.log(`Validated ${ids.size} characters, the starter template, and the public schema.`);
