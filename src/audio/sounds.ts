/**
 * Procedural SFX via Web Audio — no external samples.
 * Oscillator-only: BufferSource noise graphs were crashing some browsers mid-spray.
 */
export class SoundBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private footAcc = 0;
  private voices = 0;
  private static readonly MAX_VOICES = 12;
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
    const dur = kind === "sniper" ? 0.28 : kind === "rifle" ? 0.12 : 0.09;
    const freq = kind === "sniper" ? 90 : kind === "rifle" ? 140 : 210;
    const gain = kind === "sniper" ? 0.4 : 0.32;
    this.tone("square", freq, 40, dur, gain);
    this.tone("triangle", freq * 3, 120, dur * 0.45, gain * 0.22);
  }

  melee(): void {
    this.tone("triangle", 320, 90, 0.14, 0.22);
  }

  reload(): void {
    this.tone("triangle", 420, 420, 0.12, 0.1, 0);
    this.tone("triangle", 340, 340, 0.12, 0.1, 0.18);
    this.tone("triangle", 260, 260, 0.12, 0.1, 0.36);
  }

  hit(head: boolean): void {
    this.tone("sawtooth", head ? 520 : 220, 80, 0.12, head ? 0.28 : 0.16);
  }

  hurt(): void {
    this.tone("sine", 160, 60, 0.22, 0.18);
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
    this.tone("triangle", walking ? 90 : 140, 50, 0.07, walking ? 0.05 : 0.12);
  }

  plantBeep(high: boolean): void {
    this.tone("square", high ? 980 : 620, high ? 980 : 620, 0.08, 0.12);
  }

  bombTick(urgent: boolean): void {
    this.tone("square", urgent ? 1100 : 740, urgent ? 1100 : 740, urgent ? 0.06 : 0.05, urgent ? 0.16 : 0.1);
  }

  explode(): void {
    this.tone("sine", 70, 25, 0.9, 0.5);
    this.tone("square", 40, 20, 0.6, 0.2);
  }

  buy(): void {
    this.tone("square", 880, 880, 0.06, 0.1);
  }

  private tone(
    type: OscillatorType,
    freq: number,
    endFreq: number,
    dur: number,
    gain: number,
    delay = 0,
  ): void {
    const ctx = this.audio;
    if (!ctx || !this.master) return;
    if (this.voices >= SoundBus.MAX_VOICES) return;
    this.voices += 1;
    try {
      const t = ctx.currentTime + delay;
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(Math.max(1, freq), t);
      if (endFreq !== freq) o.frequency.linearRampToValueAtTime(Math.max(1, endFreq), t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(Math.max(0.0001, gain), t);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.onended = () => {
        this.voices = Math.max(0, this.voices - 1);
      };
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch {
      this.voices = Math.max(0, this.voices - 1);
    }
  }
}
