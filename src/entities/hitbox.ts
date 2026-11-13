import { CROUCH_HEIGHT, PLAYER_HEIGHT } from "../config";
import type { AABB, HitGroup, Vec3 } from "../core/math";
import { rayAabb } from "../core/math";

export interface HitBox {
  group: HitGroup;
  aabb: AABB;
}

export function buildHitboxes(feet: Vec3, crouched: boolean): HitBox[] {
  const scale = crouched ? CROUCH_HEIGHT / PLAYER_HEIGHT : 1;
  const x = feet.x;
  const y = feet.y;
  const z = feet.z;
  const hx = 12;
  const hz = 12;
  const headR = 7;

  const legTop = 32 * scale;
  const stomachTop = 48 * scale;
  const chestTop = 64 * scale;
  const headTop = 76 * scale;

  return [
    {
      group: "leg",
      aabb: { min: { x: x - hx, y, z: z - hz }, max: { x: x + hx, y: y + legTop, z: z + hz } },
    },
    {
      group: "stomach",
      aabb: {
        min: { x: x - hx, y: y + legTop, z: z - hz },
        max: { x: x + hx, y: y + stomachTop, z: z + hz },
      },
    },
    {
      group: "chest",
      aabb: {
        min: { x: x - hx, y: y + stomachTop, z: z - hz },
        max: { x: x + hx, y: y + chestTop, z: z + hz },
      },
    },
    {
      group: "head",
      aabb: {
        min: { x: x - headR, y: y + chestTop - 2, z: z - headR },
        max: { x: x + headR, y: y + headTop, z: z + headR },
      },
    },
  ];
}

export function pickHitGroup(
  origin: Vec3,
  dir: Vec3,
  boxes: HitBox[],
  tmax: number,
): { group: HitGroup; t: number } | null {
  let best: { group: HitGroup; t: number } | null = null;
  for (const box of boxes) {
    const hit = rayAabb(origin, dir, box.aabb, 0, tmax);
    if (!hit) continue;
    if (!best || hit.t < best.t) best = { group: box.group, t: hit.t };
  }
  return best;
}
