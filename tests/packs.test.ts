import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import { importPack } from '../src/content/packs';
import { characterAssetPaths, validateCharacter } from '../src/content/schema';

const template = () => JSON.parse(readFileSync('templates/character/character.json', 'utf8'));
function pack(files: Record<string, Uint8Array>) { return new File([new Uint8Array(zipSync(files))], 'test.zip', { type: 'application/zip' }); }
describe('portable character packs', () => {
  it('imports standalone JSON and ZIP definitions without modifying their content', async () => {
    const character = template(), bytes = strToU8(JSON.stringify(character));
    const json = await importPack(new File([new Uint8Array(bytes)], 'ball.json'));
    const zipped = await importPack(pack({ 'character.json': bytes }));
    expect(json).toEqual(zipped); expect(zipped.character).toEqual(character);
  });
  it('preserves optional origin metadata and accepts older packs without an origin', async () => {
    const character = { ...template(), origin: 'The Legend of Zelda' };
    expect((await importPack(pack({ 'character.json': strToU8(JSON.stringify(character)) }))).character.origin).toBe('The Legend of Zelda');
    delete character.origin;
    expect((await importPack(pack({ 'character.json': strToU8(JSON.stringify(character)) }))).character.origin).toBeUndefined();
  });
  it('rejects path traversal, executable files, excessive entries, and missing assets', async () => {
    const bytes = strToU8(JSON.stringify(template()));
    await expect(importPack(pack({ 'character.json': bytes, '../outside.png': new Uint8Array() }))).rejects.toThrow('path');
    await expect(importPack(pack({ 'character.json': bytes, 'assets/run.js': strToU8('alert(1)') }))).rejects.toThrow('Packs support');
    const many: Record<string, Uint8Array> = { 'character.json': bytes };
    for (let i = 0; i < 33; i++) many[`assets/${i}.png`] = new Uint8Array();
    await expect(importPack(pack(many))).rejects.toThrow('limit');
    const missing = template(); missing.appearance.body = 'assets/missing.png';
    await expect(importPack(pack({ 'character.json': strToU8(JSON.stringify(missing)) }))).rejects.toThrow('missing');
  });
  it('validates skill artwork paths, requires ZIP media, and detects missing icons', async () => {
    const character = template(); character.skills[0].icon = 'assets/skill.png';
    expect(characterAssetPaths(validateCharacter(character))).toEqual(['assets/skill.png']);
    await expect(importPack(new File([JSON.stringify(character)], 'icon.json'))).rejects.toThrow('ZIP');
    await expect(importPack(pack({ 'character.json': strToU8(JSON.stringify(character)) }))).rejects.toThrow('missing');
    for (const icon of ['../outside.png', 'https://example.com/icon.png', 'assets/../outside.png', 'assets/icon.svg']) expect(() => validateCharacter({ ...character, skills: [{ ...character.skills[0], icon }] })).toThrow('Artwork');
  });
});
