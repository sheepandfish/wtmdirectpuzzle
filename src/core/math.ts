export type HitGroup = "head" | "chest" | "stomach" | "leg";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function clone(v: Vec3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

export function set(out: Vec3, x: number, y: number, z: number): Vec3 {
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

export function copy(out: Vec3, v: Vec3): Vec3 {
  out.x = v.x;
  out.y = v.y;
  out.z = v.z;
  return out;
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function addScaled(out: Vec3, v: Vec3, s: number): Vec3 {
  out.x += v.x * s;
  out.y += v.y * s;
  out.z += v.z * s;
  return out;
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function length(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

export function length2d(v: Vec3): number {
  return Math.hypot(v.x, v.z);
}

export function normalize(v: Vec3): Vec3 {
  const len = length(v);
  if (len <= 1e-8) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function degToRad(d: number): number {
  return (d * Math.PI) / 180;
}

export function radToDeg(r: number): number {
  return (r * 180) / Math.PI;
}

export interface AABB {
  min: Vec3;
  max: Vec3;
}

export function aabb(min: Vec3, max: Vec3): AABB {
  return { min, max };
}

export function aabbIntersects(a: AABB, b: AABB): boolean {
  return (
    a.min.x <= b.max.x &&
    a.max.x >= b.min.x &&
    a.min.y <= b.max.y &&
    a.max.y >= b.min.y &&
    a.min.z <= b.max.z &&
    a.max.z >= b.min.z
  );
}

export function pointInAabb(p: Vec3, box: AABB): boolean {
  return (
    p.x >= box.min.x &&
    p.x <= box.max.x &&
    p.y >= box.min.y &&
    p.y <= box.max.y &&
    p.z >= box.min.z &&
    p.z <= box.max.z
  );
}

export function expandAabb(box: AABB, hx: number, hy: number, hz: number): AABB {
  return {
    min: { x: box.min.x - hx, y: box.min.y - hy, z: box.min.z - hz },
    max: { x: box.max.x + hx, y: box.max.y + hy, z: box.max.z + hz },
  };
}

export interface RayHit {
  t: number;
  point: Vec3;
  normal: Vec3;
}

/** Segment / ray vs AABB (slab). `dir` should be normalized; `t` is distance. */
export function rayAabb(
  origin: Vec3,
  dir: Vec3,
  box: AABB,
  tmin = 0,
  tmax = Infinity,
): RayHit | null {
  let t0 = tmin;
  let t1 = tmax;
  let nx = 0;
  let ny = 0;
  let nz = 0;

  const axes: Array<"x" | "y" | "z"> = ["x", "y", "z"];
  for (const axis of axes) {
    const o = origin[axis];
    const d = dir[axis];
    const min = box.min[axis];
    const max = box.max[axis];
    if (Math.abs(d) < 1e-12) {
      if (o < min || o > max) return null;
      continue;
    }
    const inv = 1 / d;
    let ta = (min - o) * inv;
    let tb = (max - o) * inv;
    let sign = -Math.sign(d);
    if (ta > tb) {
      const tmp = ta;
      ta = tb;
      tb = tmp;
      sign = -sign;
    }
    if (ta > t0) {
      t0 = ta;
      nx = axis === "x" ? sign : 0;
      ny = axis === "y" ? sign : 0;
      nz = axis === "z" ? sign : 0;
    }
    if (tb < t1) t1 = tb;
    if (t0 > t1) return null;
  }

  if (t0 < tmin || t0 > tmax) return null;
  return {
    t: t0,
    point: { x: origin.x + dir.x * t0, y: origin.y + dir.y * t0, z: origin.z + dir.z * t0 },
    normal: { x: nx, y: ny, z: nz },
  };
}

/** Matches a Three.js camera with rotation.order = "YXZ" looking down local -Z. */
export function yawPitchToDir(yaw: number, pitch: number): Vec3 {
  const cp = Math.cos(pitch);
  return {
    x: -Math.sin(yaw) * cp,
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * cp,
  };
}

/** Yaw that aims a YXZ camera toward a horizontal offset (dx, dz). */
export function yawToOffset(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz);
}

export function angleDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
