import { describe, expect, it } from "vitest";
import { applyShotRecoil, createRecoilState, recoilKick, stepRecoil } from "../weapons/recoil";
import { RECOIL_RECOVER_DELAY, WEAPONS } from "../config";

const ak = WEAPONS.ak;

describe("recoil curve", () => {
  it("is mostly vertical for the first 10 shots", () => {
    for (let i = 0; i < 10; i++) {
      const k = recoilKick(i, ak);
      expect(Math.abs(k.pitch)).toBeGreaterThan(Math.abs(k.yaw));
    }
  });

  it("introduces stronger lateral swing after 10 shots", () => {
    const early = recoilKick(3, ak);
    const lateA = recoilKick(10, ak);
    const lateB = recoilKick(11, ak);
    expect(Math.abs(lateA.yaw)).toBeGreaterThan(Math.abs(early.yaw));
    expect(Math.sign(lateA.yaw)).not.toBe(Math.sign(lateB.yaw));
  });

  it("does not recover until 0.4s after the last shot, then returns to zero", () => {
    let state = createRecoilState();
    state = applyShotRecoil(state, ak);
    const punched = state.pitch;
    expect(punched).toBeGreaterThan(0);
    state = stepRecoil(state, RECOIL_RECOVER_DELAY - 0.01);
    expect(state.pitch).toBeCloseTo(punched);
    for (let i = 0; i < 120; i++) state = stepRecoil(state, 1 / 60);
    expect(state.pitch).toBeCloseTo(0, 2);
    expect(state.yaw).toBeCloseTo(0, 2);
    expect(state.shotsFired).toBe(0);
  });
});
