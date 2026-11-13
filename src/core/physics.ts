import {
  CROUCH_HEIGHT,
  CROUCH_SPEED_MUL,
  GRAVITY,
  JUMP_VELOCITY,
  PLAYER_HALF_WIDTH,
  PLAYER_HEIGHT,
  SV_ACCELERATE,
  SV_AIRACCELERATE,
  SV_AIR_WISH_CAP,
  SV_FRICTION,
  SV_STOPSPEED,
  WALK_SPEED_MUL,
} from "../config";
import type { AABB, Vec3 } from "./math";
import { clamp, length2d, pointInAabb, vec3 } from "./math";

export interface MoveInput {
  forward: number;
  right: number;
  yaw: number;
  jumping: boolean;
  walking: boolean;
  crouching: boolean;
  maxSpeed: number;
  frozen: boolean;
}

export interface Body {
  position: Vec3;
  velocity: Vec3;
  onGround: boolean;
  crouched: boolean;
  height: number;
}

export interface Solid {
  aabb: AABB;
}

export function applyFriction(vx: number, vz: number, dt: number): { vx: number; vz: number } {
  const speed = Math.hypot(vx, vz);
  if (speed < 0.1) return { vx: 0, vz: 0 };
  const control = speed < SV_STOPSPEED ? SV_STOPSPEED : speed;
  const drop = control * SV_FRICTION * dt;
  const ns = Math.max(0, speed - drop);
  const s = ns / speed;
  return { vx: vx * s, vz: vz * s };
}

export function accelerate(
  vx: number,
  vz: number,
  wishX: number,
  wishZ: number,
  wishSpeed: number,
  accel: number,
  dt: number,
): { vx: number; vz: number } {
  const current = vx * wishX + vz * wishZ;
  const add = wishSpeed - current;
  if (add <= 0) return { vx, vz };
  let acc = accel * dt * wishSpeed;
  if (acc > add) acc = add;
  return { vx: vx + wishX * acc, vz: vz + wishZ * acc };
}

export function airAccelerate(
  vx: number,
  vz: number,
  wishX: number,
  wishZ: number,
  wishSpeed: number,
  dt: number,
): { vx: number; vz: number } {
  const capped = Math.min(wishSpeed, SV_AIR_WISH_CAP);
  return accelerate(vx, vz, wishX, wishZ, capped, SV_AIRACCELERATE, dt);
}

function verticalOverlap(y: number, height: number, aabb: AABB): boolean {
  return y < aabb.max.y && y + height > aabb.min.y;
}

/** Circle (XZ) vs AABB, so the body slides around convex box corners instead of catching a square footprint. */
function circleHitsAabb(x: number, z: number, aabb: AABB, radius = PLAYER_HALF_WIDTH): boolean {
  const nx = clamp(x, aabb.min.x, aabb.max.x);
  const nz = clamp(z, aabb.min.z, aabb.max.z);
  const dx = x - nx;
  const dz = z - nz;
  return dx * dx + dz * dz < radius * radius;
}

function overlapsSolids(x: number, y: number, z: number, height: number, solids: Solid[]): boolean {
  for (const s of solids) {
    if (verticalOverlap(y, height, s.aabb) && circleHitsAabb(x, z, s.aabb)) return true;
  }
  return false;
}

/**
 * Push a penetrating body out of walls/crates horizontally, and up if slightly in the floor.
 * Once overlapping, axis sweeps cannot move the body at all, which is how players wedge in geometry.
 */
export function resolvePenetration(pos: Vec3, height: number, solids: Solid[], maxIters = 6): Vec3 {
  let x = pos.x;
  let y = pos.y;
  let z = pos.z;
  const r = PLAYER_HALF_WIDTH;
  for (let iter = 0; iter < maxIters; iter++) {
    if (!overlapsSolids(x, y, z, height, solids)) break;
    let bestX = 0;
    let bestY = 0;
    let bestZ = 0;
    let best = 0;
    for (const s of solids) {
      if (!verticalOverlap(y, height, s.aabb)) continue;
      const floorLike = s.aabb.max.y <= 0.5;
      if (floorLike) {
        if (y < s.aabb.max.y) {
          const dy = s.aabb.max.y - y;
          if (dy > best) {
            best = dy;
            bestX = 0;
            bestY = dy;
            bestZ = 0;
          }
        }
        continue;
      }
      if (!circleHitsAabb(x, z, s.aabb)) continue;
      const nx = clamp(x, s.aabb.min.x, s.aabb.max.x);
      const nz = clamp(z, s.aabb.min.z, s.aabb.max.z);
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      let pushX: number;
      let pushZ: number;
      if (d2 < 1e-8) {
        const left = x - s.aabb.min.x + r;
        const right = s.aabb.max.x - x + r;
        const south = z - s.aabb.min.z + r;
        const north = s.aabb.max.z - z + r;
        const m = Math.min(left, right, south, north);
        if (m === left) {
          pushX = -left;
          pushZ = 0;
        } else if (m === right) {
          pushX = right;
          pushZ = 0;
        } else if (m === south) {
          pushX = 0;
          pushZ = -south;
        } else {
          pushX = 0;
          pushZ = north;
        }
      } else {
        const d = Math.sqrt(d2);
        const need = r - d + 0.05;
        pushX = (dx / d) * need;
        pushZ = (dz / d) * need;
      }
      const mag = Math.hypot(pushX, pushZ);
      if (mag > best) {
        best = mag;
        bestX = pushX;
        bestY = 0;
        bestZ = pushZ;
      }
    }
    if (best === 0) break;
    x += bestX;
    y += bestY;
    z += bestZ;
  }
  return vec3(x, y, z);
}

/** Sweep one axis at a time so the body slides along walls. */
export function moveAndCollide(
  pos: Vec3,
  vel: Vec3,
  height: number,
  dt: number,
  solids: Solid[],
): { position: Vec3; velocity: Vec3; onGround: boolean } {
  const resolved = resolvePenetration(pos, height, solids);
  let x = resolved.x;
  let y = resolved.y;
  let z = resolved.z;
  let vx = vel.x;
  let vy = vel.y;
  let vz = vel.z;

  const nx = x + vx * dt;
  if (!overlapsSolids(nx, y, z, height, solids)) x = nx;
  else vx = 0;

  const nz = z + vz * dt;
  if (!overlapsSolids(x, y, nz, height, solids)) z = nz;
  else vz = 0;

  const ny = y + vy * dt;
  let onGround = false;
  if (!overlapsSolids(x, ny, z, height, solids)) {
    y = ny;
  } else {
    if (vy <= 0) {
      onGround = true;
    }
    vy = 0;
  }

  // Snap to ground if slightly above a surface.
  if (!onGround && vy <= 0) {
    const probe = y - 2;
    if (overlapsSolids(x, probe, z, height, solids)) {
      onGround = true;
      vy = 0;
    }
  }

  return { position: vec3(x, y, z), velocity: vec3(vx, vy, vz), onGround };
}

export function simulateMove(body: Body, input: MoveInput, dt: number, solids: Solid[]): void {
  const targetHeight = input.crouching ? CROUCH_HEIGHT : PLAYER_HEIGHT;
  if (targetHeight > body.height) {
    const canStand = !overlapsSolids(body.position.x, body.position.y, body.position.z, targetHeight, solids);
    if (canStand) {
      body.height = targetHeight;
      body.crouched = false;
    }
  } else {
    body.height = targetHeight;
    body.crouched = input.crouching;
  }

  if (input.frozen) {
    body.velocity.x = 0;
    body.velocity.z = 0;
    if (!body.onGround) body.velocity.y -= GRAVITY * dt;
    const moved = moveAndCollide(body.position, body.velocity, body.height, dt, solids);
    body.position = moved.position;
    body.velocity = moved.velocity;
    body.onGround = moved.onGround;
    if (body.onGround && body.velocity.y < 0) body.velocity.y = 0;
    return;
  }

  const sy = Math.sin(input.yaw);
  const cy = Math.cos(input.yaw);
  // Same convention as yawPitchToDir / the YXZ camera.
  const fwx = -sy;
  const fwz = -cy;
  const rtx = cy;
  const rtz = -sy;

  let wishX = fwx * input.forward + rtx * input.right;
  let wishZ = fwz * input.forward + rtz * input.right;
  const wishLen = Math.hypot(wishX, wishZ);
  if (wishLen > 1e-6) {
    wishX /= wishLen;
    wishZ /= wishLen;
  }

  let maxSpeed = input.maxSpeed;
  if (input.walking) maxSpeed *= WALK_SPEED_MUL;
  if (body.crouched) maxSpeed *= CROUCH_SPEED_MUL;
  const wishSpeed = wishLen > 1e-6 ? maxSpeed : 0;

  if (body.onGround) {
    const fr = applyFriction(body.velocity.x, body.velocity.z, dt);
    body.velocity.x = fr.vx;
    body.velocity.z = fr.vz;
    if (wishSpeed > 0) {
      const acc = accelerate(body.velocity.x, body.velocity.z, wishX, wishZ, wishSpeed, SV_ACCELERATE, dt);
      body.velocity.x = acc.vx;
      body.velocity.z = acc.vz;
    }
    if (input.jumping) {
      body.velocity.y = JUMP_VELOCITY;
      body.onGround = false;
    }
  } else {
    if (wishSpeed > 0) {
      const acc = airAccelerate(body.velocity.x, body.velocity.z, wishX, wishZ, wishSpeed, dt);
      body.velocity.x = acc.vx;
      body.velocity.z = acc.vz;
    }
    body.velocity.y -= GRAVITY * dt;
  }

  const moved = moveAndCollide(body.position, body.velocity, body.height, dt, solids);
  body.position = moved.position;
  body.velocity = moved.velocity;
  body.onGround = moved.onGround;
  if (body.onGround && body.velocity.y < 0) body.velocity.y = 0;
}

export function horizontalSpeed(body: Body): number {
  return length2d(body.velocity);
}

export function isInsideVolume(pos: Vec3, volume: AABB): boolean {
  return pointInAabb(pos, volume);
}
