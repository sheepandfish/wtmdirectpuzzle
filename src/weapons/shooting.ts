import { weaponDef } from "../config";
import type { Vec3 } from "../core/math";
import { degToRad, yawPitchToDir } from "../core/math";
import { horizontalSpeed } from "../core/physics";
import type { Player } from "../entities/player";
import { activeWeapon, eyePosition } from "../entities/player";

export interface AimSample {
  origin: Vec3;
  dir: Vec3;
  spreadDeg: number;
}

export function currentSpreadDeg(p: Player): number {
  const w = activeWeapon(p);
  const def = weaponDef(w.id);
  if (w.id === "blade") return 0;
  let acc = def.inaccuracyStand;
  if (p.body.crouched) acc = def.inaccuracyCrouch;
  if (!p.body.onGround) acc = Math.max(acc, def.inaccuracyJump);
  const speed = horizontalSpeed(p.body);
  if (speed > 80) {
    const t = Math.min(1, (speed - 80) / Math.max(1, def.moveSpeed - 80));
    acc += def.inaccuracyMove * t;
  } else if (speed > 20) {
    acc += def.inaccuracyMove * 0.25 * ((speed - 20) / 60);
  }
  if (def.canScope && w.scoped && def.inaccuracyScoped !== undefined) {
    acc = def.inaccuracyScoped + (speed > 40 ? def.inaccuracyMove * 0.15 : 0);
  }
  acc += w.recoil.shotsFired * 0.08;
  return acc;
}

export function sampleShotDirection(p: Player, spreadDeg: number, rng: () => number): AimSample {
  const origin = eyePosition(p);
  const w = activeWeapon(p);
  const yaw = p.yaw + w.recoil.yaw * (Math.PI / 180);
  const pitch = p.pitch + w.recoil.pitch * (Math.PI / 180);
  const base = yawPitchToDir(yaw, pitch);
  if (spreadDeg <= 0) return { origin, dir: base, spreadDeg };

  const rad = degToRad(spreadDeg);
  const theta = rng() * Math.PI * 2;
  const r = Math.sqrt(rng()) * rad;
  // Build a small cone around `base`.
  const up = Math.abs(base.y) < 0.95 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const tx = up.y * base.z - up.z * base.y;
  const ty = up.z * base.x - up.x * base.z;
  const tz = up.x * base.y - up.y * base.x;
  const tl = Math.hypot(tx, ty, tz) || 1;
  const rx = tx / tl;
  const ry = ty / tl;
  const rz = tz / tl;
  const bx = ry * base.z - rz * base.y;
  const by = rz * base.x - rx * base.z;
  const bz = rx * base.y - ry * base.x;
  const ox = base.x + (rx * Math.cos(theta) + bx * Math.sin(theta)) * Math.tan(r);
  const oy = base.y + (ry * Math.cos(theta) + by * Math.sin(theta)) * Math.tan(r);
  const oz = base.z + (rz * Math.cos(theta) + bz * Math.sin(theta)) * Math.tan(r);
  const len = Math.hypot(ox, oy, oz) || 1;
  return { origin, dir: { x: ox / len, y: oy / len, z: oz / len }, spreadDeg };
}
