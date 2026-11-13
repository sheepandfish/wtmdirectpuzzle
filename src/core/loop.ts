import { TICK_DT, TICK_HZ } from "../config";

export type TickFn = (dt: number, tick: number) => void;
export type DrawFn = (alpha: number, nowMs: number) => void;

/**
 * Fixed 60 Hz simulation with leftover-time interpolation for rendering.
 * Behavior stays consistent across frame rates.
 */
export class FixedLoop {
  private acc = 0;
  private last = 0;
  private tick = 0;
  private raf = 0;
  private running = false;
  private readonly maxFrame = 0.25;

  constructor(
    private readonly onTick: TickFn,
    private readonly onDraw: DrawFn,
    private readonly onFrame?: () => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    const frame = (now: number) => {
      if (!this.running) return;
      let delta = (now - this.last) / 1000;
      this.last = now;
      if (delta > this.maxFrame) delta = this.maxFrame;
      // Look / other per-display-frame input before the fixed ticks and draw.
      try {
        this.onFrame?.();
        this.acc += delta;
        let steps = 0;
        while (this.acc >= TICK_DT && steps < TICK_HZ) {
          this.onTick(TICK_DT, this.tick++);
          this.acc -= TICK_DT;
          steps++;
        }
        this.onDraw(this.acc / TICK_DT, now);
      } catch (err) {
        console.error("game frame failed", err);
      }
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}
