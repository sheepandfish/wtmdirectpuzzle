/**
 * Procedural SFX via Web Audio — no external samples.
 */
export class SoundBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private footAcc = 0;
  muted = false;

  resume(): void {
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(ctx.destination);
    }
    void this.ctx.resume();
  }

  private get audio(): AudioContext | null {
    return this.muted ? null : this.ctx;
  }

  gunshot(kind: "rifle" | "pistol" | "sniper"): void {
    const ctx = this.audio;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const dur = kind === "sniper" ? 0.38 : kind === "rifle" ? 0.16 : 0.12;
    const freq = kind === "sniper" ? 90 : kind === "rifle" ? 140 : 210;

    const noise = this.noise(ctx, dur, kind === "sniper" ? 1800 : 2400);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.9, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
    noise.connect(ng).connect(this.master);

    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + dur);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.35, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.8);
    osc.connect(og).connect(this.master);
    osc.start(t);
    osc.stop(t + dur);
  }

  melee(): void {
    const ctx = this.audio;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const n = this.noise(ctx, 0.1, 1800);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.35, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    n.connect(ng).connect(this.master);
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(320, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.12);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.22, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    o.connect(og).connect(this.master);
    o.start(t);
    o.stop(t + 0.14);
  }

  reload(): void {
    const ctx = this.audio;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = 420 - i * 80;
      const g = ctx.createGain();
      const s = t + i * 0.18;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.12, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.12);
      o.connect(g).connect(this.master);
      o.start(s);
      o.stop(s + 0.14);
    }
  }

  hit(head: boolean): void {
    const ctx = this.audio;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(head ? 520 : 220, t);
    o.frequency.exponentialRampToValueAtTime(80, t + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(head ? 0.28 : 0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.13);
  }

  hurt(): void {
    const ctx = this.audio;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.23);
  }

  footsteps(speed: number, walking: boolean, dt: number, airborne: boolean): void {
    if (airborne || speed < 40) {
      this.footAcc = 0;
      return;
    }
    const interval = walking ? 0.55 : speed > 200 ? 0.32 : 0.4;
    this.footAcc += dt;
    if (this.footAcc < interval) return;
    this.footAcc = 0;
    const ctx = this.audio;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const n = this.noise(ctx, 0.08, walking ? 400 : 900);
    const g = ctx.createGain();
    g.gain.setValueAtTime(walking ? 0.05 : 0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    n.connect(g).connect(this.master);
  }

  plantBeep(high: boolean): void {
    this.beep(high ? 980 : 620, 0.08, 0.12);
  }

  bombTick(urgent: boolean): void {
    this.beep(urgent ? 1100 : 740, urgent ? 0.06 : 0.05, urgent ? 0.16 : 0.1);
  }

  explode(): void {
    const ctx = this.audio;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const n = this.noise(ctx, 1.2, 600);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    n.connect(g).connect(this.master);
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(25, t + 0.8);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.5, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    o.connect(og).connect(this.master);
    o.start(t);
    o.stop(t + 1);
  }

  buy(): void {
    this.beep(880, 0.06, 0.1);
  }

  private beep(freq: number, dur: number, gain: number): void {
    const ctx = this.audio;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(ctx: AudioContext, dur: number, cutoff: number): AudioNode {
    const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    src.connect(filter);
    src.start();
    return filter;
  }
}
