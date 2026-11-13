import { describe, expect, it } from "vitest";
import { yawPitchToDir, yawToOffset } from "../core/math";

describe("aim convention", () => {
  it("matches a YXZ camera looking down local -Z", () => {
    const level = yawPitchToDir(0, 0);
    expect(level.x).toBeCloseTo(0);
    expect(level.y).toBeCloseTo(0);
    expect(level.z).toBeCloseTo(-1);

    const right = yawPitchToDir(-Math.PI / 2, 0);
    expect(right.x).toBeCloseTo(1);
    expect(right.y).toBeCloseTo(0);
    expect(right.z).toBeCloseTo(0);

    const up = yawPitchToDir(0, Math.PI / 2);
    expect(up.x).toBeCloseTo(0);
    expect(up.y).toBeCloseTo(1);
    expect(up.z).toBeCloseTo(0);
  });

  it("aims yaw at a target to the right of a -Z facing player", () => {
    const yaw = yawToOffset(100, 0);
    const dir = yawPitchToDir(yaw, 0);
    expect(dir.x).toBeCloseTo(1);
    expect(dir.z).toBeCloseTo(0);
  });
});
