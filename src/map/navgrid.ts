import type { Vec3 } from "../core/math";
import type { GameMap } from "./types";

export interface NavNode {
  x: number;
  z: number;
  wx: number;
  wz: number;
}

function inBounds(map: GameMap, gx: number, gz: number): boolean {
  return gz >= 0 && gz < map.walkable.length && gx >= 0 && gx < (map.walkable[0]?.length ?? 0);
}

export function worldToCell(map: GameMap, x: number, z: number): { x: number; z: number } {
  return {
    x: Math.floor((x - map.navOrigin.x) / map.navCell),
    z: Math.floor((z - map.navOrigin.z) / map.navCell),
  };
}

export function cellToWorld(map: GameMap, gx: number, gz: number): Vec3 {
  return {
    x: map.navOrigin.x + (gx + 0.5) * map.navCell,
    y: 0,
    z: map.navOrigin.z + (gz + 0.5) * map.navCell,
  };
}

export function isWalkable(map: GameMap, gx: number, gz: number): boolean {
  return inBounds(map, gx, gz) && map.walkable[gz][gx];
}

interface NodeRec {
  x: number;
  z: number;
  g: number;
  f: number;
  px: number;
  pz: number;
}

const DIRS: Array<[number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, 1.414],
  [1, -1, 1.414],
  [-1, 1, 1.414],
  [-1, -1, 1.414],
];

/** Snap a world point to the nearest walkable nav cell, or null if none exist. */
export function snapToWalkable(map: GameMap, x: number, z: number): { x: number; z: number } | null {
  const c = worldToCell(map, x, z);
  if (isWalkable(map, c.x, c.z)) return c;
  let best: { x: number; z: number; d: number } | null = null;
  for (let gz = 0; gz < map.walkable.length; gz++) {
    const row = map.walkable[gz];
    for (let gx = 0; gx < row.length; gx++) {
      if (!row[gx]) continue;
      const d = (gx - c.x) * (gx - c.x) + (gz - c.z) * (gz - c.z);
      if (!best || d < best.d) best = { x: gx, z: gz, d };
    }
  }
  return best ? { x: best.x, z: best.z } : null;
}

export function findPath(map: GameMap, from: Vec3, to: Vec3): Vec3[] {
  const start = snapToWalkable(map, from.x, from.z);
  const goal = snapToWalkable(map, to.x, to.z);
  if (!start || !goal) return [];
  if (start.x === goal.x && start.z === goal.z) return [cellToWorld(map, goal.x, goal.z)];

  const key = (x: number, z: number) => `${x},${z}`;
  const open: NodeRec[] = [];
  const bestG = new Map<string, number>();
  const heuristic = (x: number, z: number) => Math.hypot(x - goal.x, z - goal.z);

  open.push({ x: start.x, z: start.z, g: 0, f: heuristic(start.x, start.z), px: start.x, pz: start.z });
  bestG.set(key(start.x, start.z), 0);
  const came = new Map<string, { x: number; z: number }>();
  let found = false;
  let guard = 0;

  while (open.length && guard++ < 8000) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.x === goal.x && cur.z === goal.z) {
      found = true;
      break;
    }
    for (const [dx, dz, c] of DIRS) {
      const nx = cur.x + dx;
      const nz = cur.z + dz;
      if (!isWalkable(map, nx, nz)) continue;
      if (dx !== 0 && dz !== 0 && (!isWalkable(map, cur.x + dx, cur.z) || !isWalkable(map, cur.x, cur.z + dz))) {
        continue;
      }
      const g = cur.g + c;
      const k = key(nx, nz);
      if (g >= (bestG.get(k) ?? Infinity)) continue;
      bestG.set(k, g);
      came.set(k, { x: cur.x, z: cur.z });
      open.push({ x: nx, z: nz, g, f: g + heuristic(nx, nz), px: cur.x, pz: cur.z });
    }
  }

  if (!found) return [];
  const cells: Array<{ x: number; z: number }> = [{ x: goal.x, z: goal.z }];
  let k = key(goal.x, goal.z);
  while (k !== key(start.x, start.z)) {
    const p = came.get(k);
    if (!p) break;
    cells.push(p);
    k = key(p.x, p.z);
  }
  cells.reverse();
  return cells.map((c) => cellToWorld(map, c.x, c.z));
}
