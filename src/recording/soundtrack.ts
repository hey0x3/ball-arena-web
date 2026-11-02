/** The same falling hit tone as the live arena, sampled on the video timeline. */
export class HitSoundtrack {
  private hits: number[] = [];
  hit(at: number) { if (Number.isFinite(at) && at >= 0) this.hits.push(Math.round(at * 48000)); }
  samples(start: number, count: number) {
    const data = new Float32Array(count), rate = 48000, startSample = Math.round(start * rate), decay = Math.log(90 / 280) / .08;
    for (const hit of this.hits) {
      const first = Math.max(0, hit - startSample), last = Math.min(count, hit + 5280 - startSample);
      for (let i = first; i < last; i++) {
        const t = (startSample + i - hit) / rate, frequencyIntegral = 280 * Math.expm1(decay * t) / decay;
        data[i] += Math.sin(2 * Math.PI * frequencyIntegral) * .035 * Math.exp(-Math.log(500) * t / .1);
      }
    }
    this.hits = this.hits.filter(at => at + 5280 > startSample + count);
    for (let i = 0; i < count; i++) data[i] = Math.max(-1, Math.min(1, data[i]));
    return data;
  }
}
