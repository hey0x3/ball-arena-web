export class ArenaAudio {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  enabled = false;
  async enable() {
    this.context ??= new AudioContext();
    if (!this.output) {
      this.output = this.context.createGain(); this.output.gain.value = .07;
      this.output.connect(this.context.destination);
      this.destination = this.context.createMediaStreamDestination(); this.output.connect(this.destination);
    }
    await this.context.resume(); this.enabled = true;
  }
  get stream() { return this.enabled ? this.destination?.stream : undefined; }
  hit() {
    if (!this.enabled || !this.context || !this.output) return;
    const oscillator = this.context.createOscillator(), envelope = this.context.createGain(), now = this.context.currentTime;
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(280, now); oscillator.frequency.exponentialRampToValueAtTime(90, now + .08);
    envelope.gain.setValueAtTime(.5, now); envelope.gain.exponentialRampToValueAtTime(.001, now + .1);
    oscillator.connect(envelope); envelope.connect(this.output); oscillator.start(); oscillator.stop(now + .11);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }
  dispose() { void this.context?.close(); }
}
