import { describe, expect, it } from 'vitest';
import { HitSoundtrack } from '../src/recording/soundtrack';

describe('video-timeline hit soundtrack', () => {
  it('stays silent before a hit and produces a bounded fading tone after it', () => {
    const audio = new HitSoundtrack(); audio.hit(.1);
    expect(audio.samples(0, 800).every(sample => sample === 0)).toBe(true);
    const tone = audio.samples(.1, 4800);
    expect(tone.some(sample => Math.abs(sample) > .02)).toBe(true);
    expect(Math.max(...tone.slice(-400).map(Math.abs))).toBeLessThan(.001);
    expect(audio.samples(.3, 800).every(sample => sample === 0)).toBe(true);
  });
  it('has the same samples regardless of frame chunking or wall-clock delays', () => {
    const a = new HitSoundtrack(), b = new HitSoundtrack(); for (const at of [0, .04, .07]) { a.hit(at); b.hit(at); }
    const continuous = a.samples(0, 9600), split = new Float32Array(9600);
    for (let frame = 0; frame < 12; frame++) split.set(b.samples(frame / 60, 800), frame * 800);
    for (let i = 0; i < split.length; i++) expect(split[i]).toBeCloseTo(continuous[i], 6);
  });
});
