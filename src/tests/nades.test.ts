import { describe, expect, it } from "vitest";
import {
  createNadeWorld,
  flashExposure,
  flashOverlay,
  segmentHitsSphere,
  smokeBlocksSight,
  stepFlashDecay,
  stepNades,
  throwNade,
} from "../entities/nades";
import { createPlayer } from "../entities/player";
import { NADES } from "../config";

describe("flash and smoke", () => {
  it("blinds more when looking at the pop than when looking away", () => {
    const eye = { x: 0, y: 64, z: 0 };
    const lookAt = { x: 0, y: 0, z: -1 };
    const lookAway = { x: 0, y: 0, z: 1 };
    const pop = { x: 0, y: 64, z: -200 };
    const facing = flashExposure(eye, lookAt, pop, false);
    const away = flashExposure(eye, lookAway, pop, false);
    expect(facing).toBeGreaterThan(away);
    expect(facing).toBeGreaterThan(1);
    expect(flashExposure(eye, lookAt, pop, true)).toBe(0);
  });

  it("fades the overlay as remaining flash time drops", () => {
    expect(flashOverlay(0)).toBe(0);
    expect(flashOverlay(3)).toBe(1);
    expect(flashOverlay(0.6)).toBeCloseTo(0.5);
  });

  it("decays player.flash on the logic clock", () => {
    const p = createPlayer(0, "You", "human", "t", { x: 0, y: 0, z: 0 });
    p.flash = 1;
    stepFlashDecay([p], 0.25);
    expect(p.flash).toBeCloseTo(0.75);
    stepFlashDecay([p], 2);
    expect(p.flash).toBe(0);
  });

  it("treats a smoke cloud as a sight occluder", () => {
    const cloud = { id: 1, position: { x: 0, y: 40, z: 0 }, radius: NADES.smokeRadius, left: 10 };
    expect(smokeBlocksSight({ x: -200, y: 64, z: 0 }, { x: 200, y: 64, z: 0 }, [cloud])).toBe(true);
    expect(smokeBlocksSight({ x: 400, y: 64, z: 400 }, { x: 500, y: 64, z: 500 }, [cloud])).toBe(false);
    expect(segmentHitsSphere({ x: 0, y: 40, z: 0 }, { x: 0, y: 40, z: 0 }, cloud.position, cloud.radius)).toBe(true);
  });

  it("pops a thrown flash after its fuse on stepped time", () => {
    const world = createNadeWorld();
    throwNade(world, "flash", { x: 0, y: 64, z: 0 }, 0, 0, 0);
    expect(world.thrown).toHaveLength(1);
    const events = stepNades(world, NADES.flashFuse + 0.05, []);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("flash");
    expect(world.thrown).toHaveLength(0);
  });
});
