import type { AABB, HitGroup, RayHit, Vec3 } from "./math";
import { length, normalize, rayAabb, sub } from "./math";
import { buildHitboxes, pickHitGroup } from "../entities/hitbox";
import type { Player } from "../entities/player";
import type { Brush, GameMap } from "../map/types";
import { RANGE_MODIFIER_PER_500U, WOOD_PENETRATION_DAMAGE } from "../config";

export interface WorldHit {
  kind: "world";
  t: number;
  point: Vec3;
  normal: Vec3;
  brush: Brush;
  penetratedWood: number;
}

export interface PlayerHit {
  kind: "player";
  t: number;
  point: Vec3;
  player: Player;
  group: HitGroup;
  damageScale: number;
}

export type ShotHit = WorldHit | PlayerHit;

/** CS-style falloff: remaining fraction = rangeModifier ^ (distance / 500). */
export function rangeDamageScale(distance: number, rangeModifier: number): number {
  return Math.max(0.45, Math.pow(rangeModifier, distance / 500));
}

export function traceShot(
  map: GameMap,
  origin: Vec3,
  dirIn: Vec3,
  maxDist: number,
  players: Player[],
  ignoreId: number,
  rangeModifier = 1 - RANGE_MODIFIER_PER_500U,
): ShotHit | null {
  const dir = normalize(dirIn);
  let tmin = 0.1;
  let damageScale = 1;
  let woodHits = 0;
  const solids = map.brushes.filter((b) => b.solid && b.surface !== "ground");

  for (let hop = 0; hop < 6; hop++) {
    let world: { t: number; hit: RayHit; brush: Brush } | null = null;
    for (const b of solids) {
      const h = rayAabb(origin, dir, b.aabb, tmin, maxDist);
      if (!h) continue;
      if (!world || h.t < world.t) world = { t: h.t, hit: h, brush: b };
    }

    let victim: { t: number; player: Player; group: HitGroup } | null = null;
    for (const p of players) {
      if (!p.alive || p.id === ignoreId) continue;
      const boxes = buildHitboxes(p.body.position, p.body.crouched);
      const ph = pickHitGroup(origin, dir, boxes, maxDist);
      if (!ph || ph.t < tmin) continue;
      if (!victim || ph.t < victim.t) victim = { t: ph.t, player: p, group: ph.group };
    }

    if (victim && (!world || victim.t <= world.t)) {
      const rangeScale = rangeDamageScale(victim.t, rangeModifier);
      return {
        kind: "player",
        t: victim.t,
        point: { x: origin.x + dir.x * victim.t, y: origin.y + dir.y * victim.t, z: origin.z + dir.z * victim.t },
        player: victim.player,
        group: victim.group,
        damageScale: damageScale * rangeScale,
      };
    }

    if (!world) return null;

    if (world.brush.penetrable && woodHits < 2) {
      woodHits++;
      damageScale *= WOOD_PENETRATION_DAMAGE;
      tmin = world.t + 1.5;
      continue;
    }

    return {
      kind: "world",
      t: world.t,
      point: world.hit.point,
      normal: world.hit.normal,
      brush: world.brush,
      penetratedWood: woodHits,
    };
  }
  return null;
}

export function firstWallBetween(map: GameMap, a: Vec3, b: Vec3): boolean {
  const delta = sub(b, a);
  const dist = length(delta);
  if (dist < 1) return false;
  const dir = normalize(delta);
  const solids = map.brushes.filter((s) => s.solid && s.surface !== "ground" && !s.penetrable);
  for (const s of solids) {
    const h = rayAabb(a, dir, s.aabb, 4, dist - 4);
    if (h) return true;
  }
  return false;
}

export function pointInAny(volumes: AABB[], p: Vec3): AABB | null {
  for (const v of volumes) {
    if (
      p.x >= v.min.x &&
      p.x <= v.max.x &&
      p.z >= v.min.z &&
      p.z <= v.max.z
    ) {
      return v;
    }
  }
  return null;
}
