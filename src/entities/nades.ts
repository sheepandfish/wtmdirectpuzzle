import { GRAVITY, NADES } from "../config";
import type { Vec3 } from "../core/math";
import { clamp, dot, length, normalize, rayAabb, sub, yawPitchToDir } from "../core/math";
import { firstWallBetween } from "../core/raycast";
import type { Solid } from "../core/physics";
import type { Player } from "./player";
import { eyePosition } from "./player";
import type { GameMap } from "../map/types";

export type NadeKind = "flash" | "smoke";

export interface ThrownNade {
  id: number;
  kind: NadeKind;
  position: Vec3;
  velocity: Vec3;
  fuse: number;
  ownerId: number;
}

export interface SmokeCloud {
  id: number;
  position: Vec3;
  radius: number;
  left: number;
}

export interface NadeWorld {
  thrown: ThrownNade[];
  smokes: SmokeCloud[];
  nextId: number;
}

export interface NadeEvent {
  kind: "flash" | "smoke";
  position: Vec3;
  ownerId: number;
}

export function createNadeWorld(): NadeWorld {
  return { thrown: [], smokes: [], nextId: 1 };
}

export function throwNade(
  world: NadeWorld,
  kind: NadeKind,
  origin: Vec3,
  yaw: number,
  pitch: number,
  ownerId: number,
): ThrownNade {
  const dir = yawPitchToDir(yaw, pitch);
  const nade: ThrownNade = {
    id: world.nextId++,
    kind,
    position: { x: origin.x + dir.x * 12, y: origin.y + dir.y * 12, z: origin.z + dir.z * 12 },
    velocity: {
      x: dir.x * NADES.throwSpeed,
      y: dir.y * NADES.throwSpeed + NADES.throwUp,
      z: dir.z * NADES.throwSpeed,
    },
    fuse: kind === "flash" ? NADES.flashFuse : NADES.smokeFuse,
    ownerId,
  };
  world.thrown.push(nade);
  return nade;
}

export function stepNades(world: NadeWorld, dt: number, solids: Solid[]): NadeEvent[] {
  const events: NadeEvent[] = [];
  for (let i = world.thrown.length - 1; i >= 0; i--) {
    const n = world.thrown[i];
    stepThrown(n, dt, solids);
    n.fuse -= dt;
    if (n.fuse <= 0) {
      events.push({ kind: n.kind, position: { ...n.position }, ownerId: n.ownerId });
      if (n.kind === "smoke") {
        world.smokes.push({
          id: n.id,
          position: { ...n.position, y: Math.max(20, n.position.y) },
          radius: NADES.smokeRadius,
          left: NADES.smokeDuration,
        });
      }
      world.thrown.splice(i, 1);
    }
  }
  for (let i = world.smokes.length - 1; i >= 0; i--) {
    world.smokes[i].left -= dt;
    if (world.smokes[i].left <= 0) world.smokes.splice(i, 1);
  }
  return events;
}

function stepThrown(n: ThrownNade, dt: number, solids: Solid[]): void {
  n.velocity.y -= GRAVITY * dt;
  const dx = n.velocity.x * dt;
  const dy = n.velocity.y * dt;
  const dz = n.velocity.z * dt;
  const dest = { x: n.position.x + dx, y: n.position.y + dy, z: n.position.z + dz };
  const moveLen = Math.hypot(dx, dy, dz);
  if (moveLen > 0.001) {
    const dir = { x: dx / moveLen, y: dy / moveLen, z: dz / moveLen };
    let hitT = moveLen;
    let hitAxis: "x" | "y" | "z" | null = null;
    for (const s of solids) {
      const h = rayAabb(n.position, dir, s.aabb, 0, moveLen);
      if (!h || h.t >= hitT) continue;
      hitT = h.t;
      const nx = h.normal.x, ny = h.normal.y, nz = h.normal.z;
      hitAxis = Math.abs(ny) >= Math.abs(nx) && Math.abs(ny) >= Math.abs(nz) ? "y" : Math.abs(nx) >= Math.abs(nz) ? "x" : "z";
    }
    if (hitAxis) {
      const t = Math.max(0, hitT - 0.4);
      n.position.x += dir.x * t;
      n.position.y += dir.y * t;
      n.position.z += dir.z * t;
      if (hitAxis === "y") {
        n.velocity.y *= -0.35;
        n.velocity.x *= 0.62;
        n.velocity.z *= 0.62;
        if (Math.abs(n.velocity.y) < 40) n.velocity.y = 0;
      } else if (hitAxis === "x") {
        n.velocity.x *= -0.45;
        n.velocity.y *= 0.85;
      } else {
        n.velocity.z *= -0.45;
        n.velocity.y *= 0.85;
      }
      return;
    }
  }
  if (dest.y < 2) {
    dest.y = 2;
    n.velocity.y *= -0.35;
    n.velocity.x *= 0.62;
    n.velocity.z *= 0.62;
    if (Math.abs(n.velocity.y) < 40) n.velocity.y = 0;
  }
  n.position = dest;
}

/** Remaining flash duration (seconds) inflicted at pop, 0 if fully blocked. */
export function flashExposure(
  eye: Vec3,
  lookDir: Vec3,
  pop: Vec3,
  blocked: boolean,
): number {
  if (blocked) return 0;
  const delta = sub(pop, eye);
  const dist = length(delta);
  if (dist > NADES.flashMaxRange) return 0;
  const toward = normalize(delta);
  const facing = dot(lookDir, toward);
  const distFactor = clamp(1 - dist / NADES.flashMaxRange, 0, 1);
  const lookFactor = facing < 0 ? 0.35 : 0.5 + 0.5 * facing;
  return clamp(NADES.flashMaxDuration * distFactor * lookFactor, 0, NADES.flashMaxDuration);
}

export function applyFlashPop(pop: Vec3, players: Player[], map: GameMap): void {
  for (const p of players) {
    if (!p.alive) continue;
    const eye = eyePosition(p);
    const look = yawPitchToDir(p.yaw, p.pitch);
    const blocked = firstWallBetween(map, eye, pop);
    const add = flashExposure(eye, look, pop, blocked);
    if (add > p.flash) p.flash = add;
  }
}

export function stepFlashDecay(players: Player[], dt: number): void {
  for (const p of players) {
    if (p.flash > 0) p.flash = Math.max(0, p.flash - dt);
  }
}

export function flashOverlay(flashLeft: number): number {
  if (flashLeft <= 0) return 0;
  if (flashLeft >= 1.2) return 1;
  return flashLeft / 1.2;
}

/** True if the segment from `a` to `b` passes through a live smoke cloud. */
export function smokeBlocksSight(a: Vec3, b: Vec3, smokes: SmokeCloud[]): boolean {
  for (const s of smokes) {
    if (segmentHitsSphere(a, b, s.position, s.radius)) return true;
  }
  return false;
}

export function segmentHitsSphere(a: Vec3, b: Vec3, c: Vec3, radius: number): boolean {
  const ab = sub(b, a);
  const ac = sub(c, a);
  const abLen2 = dot(ab, ab);
  if (abLen2 <= 1e-8) return length(ac) <= radius;
  let t = dot(ac, ab) / abLen2;
  t = clamp(t, 0, 1);
  const px = a.x + ab.x * t - c.x;
  const py = a.y + ab.y * t - c.y;
  const pz = a.z + ab.z * t - c.z;
  return px * px + py * py + pz * pz <= radius * radius;
}

export function clearNades(world: NadeWorld): void {
  world.thrown.length = 0;
  world.smokes.length = 0;
}
