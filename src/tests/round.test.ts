import { describe, expect, it } from "vitest";
import { TICK_DT, ROUND } from "../config";
import { advancePhase, isMatchOver, simulatePhaseTicks } from "../core/round";
import { spawnYaw } from "../entities/team";
import { yawPitchToDir } from "../core/math";

describe("round phase machine", () => {
  const base = {
    phase: "freeze" as const,
    timer: ROUND.freezeTime,
    buyOpen: true,
    pendingMatchOver: false,
    roundTime: ROUND.roundTime,
    buyCloseWarn: ROUND.buyCloseWarn,
  };

  it("stays in freeze until the freeze timer elapses", () => {
    const mid = simulatePhaseTicks(base, ROUND.freezeTime - TICK_DT, TICK_DT);
    expect(mid.phase).toBe("freeze");
    expect(mid.action).toBeUndefined();
  });

  it("transitions freeze to live after freezeTime without setTimeout", () => {
    const next = simulatePhaseTicks(base, ROUND.freezeTime + TICK_DT, TICK_DT);
    expect(next.phase).toBe("live");
    expect(next.timer).toBe(ROUND.roundTime);
    expect(next.buyOpen).toBe(false);
    expect(next.banner).toBe("交战开始");
  });

  it("warns when the buy window is about to close", () => {
    const warned = advancePhase({ ...base, timer: ROUND.buyCloseWarn });
    expect(warned.phase).toBe("freeze");
    expect(warned.banner).toBe("购买阶段结束");
  });

  it("starts the next round after endDisplay from the end phase", () => {
    const ended = simulatePhaseTicks(
      { ...base, phase: "end", timer: ROUND.endDisplay, buyOpen: false, pendingMatchOver: false },
      ROUND.endDisplay + TICK_DT,
      TICK_DT,
    );
    expect(ended.action).toBe("beginRound");
    expect(ended.phase).not.toBe("matchover");
  });

  it("enters matchover after endDisplay when the match is already decided", () => {
    const over = simulatePhaseTicks(
      { ...base, phase: "end", timer: ROUND.endDisplay, buyOpen: false, pendingMatchOver: true },
      ROUND.endDisplay + TICK_DT,
      TICK_DT,
    );
    expect(over.action).toBe("matchover");
    expect(over.phase).toBe("matchover");
  });

  it("treats first-to-13 as match over and does not invent overtime at 12-12", () => {
    expect(isMatchOver(13, 12, 25, ROUND.winScore, ROUND.maxRounds)).toBe(true);
    expect(isMatchOver(12, 12, 24, ROUND.winScore, ROUND.maxRounds)).toBe(true);
    expect(isMatchOver(12, 11, 23, ROUND.winScore, ROUND.maxRounds)).toBe(false);
  });
});

describe("spawn facing", () => {
  it("points T toward mid (+Z) and CT toward mid (-Z)", () => {
    const tDir = yawPitchToDir(spawnYaw("t"), 0);
    const ctDir = yawPitchToDir(spawnYaw("ct"), 0);
    expect(tDir.z).toBeGreaterThan(0.9);
    expect(ctDir.z).toBeLessThan(-0.9);
    expect(tDir.x).toBeCloseTo(0);
    expect(ctDir.x).toBeCloseTo(0);
  });
});
