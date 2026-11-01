import type { SavedCharacter } from '../content/schema';
import { validateCharacter } from '../content/schema';

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ball-arena', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('characters', { keyPath: 'character.id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Browser storage is unavailable. You can still export your characters.'));
  });
}
export async function loadCharacters(): Promise<SavedCharacter[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('characters').objectStore('characters').getAll();
      request.onsuccess = () => {
        try { resolve(request.result.map((entry: SavedCharacter) => ({ character: validateCharacter(entry.character), media: entry.media }))); }
        catch { reject(new Error('A saved character is incompatible. Export backups before clearing browser data.')); }
      };
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
export async function saveCharacter(entry: SavedCharacter): Promise<void> {
  validateCharacter(entry.character);
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('characters', 'readwrite');
      tx.objectStore('characters').put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('Could not save character. Browser storage may be full. Export a backup.'));
      tx.onabort = () => reject(new Error('Character save was interrupted. Export a backup.'));
    });
  } finally { db.close(); }
}
