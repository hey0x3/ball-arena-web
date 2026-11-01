import { inflateSync } from 'node:zlib';

/** A coarse entropy check on the decoded PNG IDAT scanlines: reject blank captures. */
export function PNG(bytes: Buffer) {
  const chunks: Buffer[] = []; let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)); const colors = new Set<number>();
  for (let i = 0; i < raw.length - 3; i += 4) colors.add(raw.readUInt32LE(i));
  return { uniqueColors: colors.size };
}
