import type { Vec3 } from "../core/math";
import { length, sub } from "../core/math";
import { firstWallBetween } from "../core/raycast";
import type { Player } from "../entities/player";
import { eyePosition } from "../entities/player";
import type { GameMap } from "../map/types";
import type { SmokeCloud } from "../entities/nades";
import { smokeBlocksSight } from "../entities/nades";

export function visibleEnemy(
  map: GameMap,
  self: Player,
  others: Player[],
  maxDist = 2400,
  smokes: SmokeCloud[] = [],
): Player | null {
  if (!self.alive) return null;
  const eye = eyePosition(self);
  let best: { p: Player; d: number } | null = null;
  for (const o of others) {
    if (!o.alive || o.team === self.team) continue;
    const t = eyePosition(o);
    const d = length(sub(t, eye));
    if (d > maxDist) continue;
    if (firstWallBetween(map, eye, t)) continue;
    if (smokeBlocksSight(eye, t, smokes)) continue;
    if (!best || d < best.d) best = { p: o, d };
  }
  return best?.p ?? null;
}

export function distance2d(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
