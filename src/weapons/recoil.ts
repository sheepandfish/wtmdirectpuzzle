import { RECOIL_RECOVER_DELAY, RECOIL_RECOVER_RATE } from "../config";

export interface RecoilProfile {
  recoilPitch: number;
  recoilYaw: number;
  pitchScaleAfter10: number;
  yawScaleAfter10: number;
}

export interface RecoilState {
  pitch: number;
  yaw: number;
  shotsFired: number;
  timeSinceShot: number;
}

export function createRecoilState(): RecoilState {
  return { pitch: 0, yaw: 0, shotsFired: 0, timeSinceShot: 999 };
}

/**
 * First 10 shots are mostly vertical climb.
 * After that, lateral oscillation dominates (alternating left/right).
 */
export function recoilKick(shotIndex: number, profile: RecoilProfile): { pitch: number; yaw: number } {
  if (shotIndex < 10) {
    const t = shotIndex / 9;
    return {
      pitch: profile.recoilPitch * (0.75 + t * 0.55),
      yaw: profile.recoilYaw * (shotIndex % 2 === 0 ? -0.25 : 0.35) * t,
    };
  }
  const k = shotIndex - 10;
  const side = k % 2 === 0 ? 1 : -1;
  const grow = 1 + Math.min(4, k) * 0.18;
  return {
    pitch: profile.recoilPitch * profile.pitchScaleAfter10,
    yaw: side * profile.recoilYaw * profile.yawScaleAfter10 * grow * (1.2 + (k % 3) * 0.2),
  };
}

export function applyShotRecoil(state: RecoilState, profile: RecoilProfile): RecoilState {
  const kick = recoilKick(state.shotsFired, profile);
  return {
    pitch: state.pitch + kick.pitch,
    yaw: state.yaw + kick.yaw,
    shotsFired: state.shotsFired + 1,
    timeSinceShot: 0,
  };
}

/** Recovery starts 0.4s after the last shot, then eases back to zero. */
export function stepRecoil(state: RecoilState, dt: number): RecoilState {
  const timeSinceShot = state.timeSinceShot + dt;
  if (timeSinceShot < RECOIL_RECOVER_DELAY) {
    return { ...state, timeSinceShot };
  }
  const k = Math.max(0, 1 - RECOIL_RECOVER_RATE * dt);
  const pitch = state.pitch * k;
  const yaw = state.yaw * k;
  const settled = Math.abs(pitch) < 0.01 && Math.abs(yaw) < 0.01;
  return {
    pitch: settled ? 0 : pitch,
    yaw: settled ? 0 : yaw,
    shotsFired: settled ? 0 : state.shotsFired,
    timeSinceShot,
  };
}
