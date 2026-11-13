import type { AABB, Vec3 } from "../core/math";

export type Surface = "concrete" | "wood" | "ground";

export interface Brush {
  aabb: AABB;
  surface: Surface;
  solid: boolean;
  visible: boolean;
  color: number;
  penetrable: boolean;
}

export interface BombSite {
  id: "A" | "B";
  aabb: AABB;
  label: string;
}

export interface GameMap {
  name: string;
  brushes: Brush[];
  sites: BombSite[];
  tSpawns: Vec3[];
  ctSpawns: Vec3[];
  bounds: AABB;
  navOrigin: Vec3;
  navCell: number;
  walkable: boolean[][];
  coverPoints: Vec3[];
}

export function brush(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  surface: Surface,
  color: number,
  opts?: Partial<Pick<Brush, "solid" | "visible" | "penetrable">>,
): Brush {
  const min = { x: Math.min(x0, x1), y: Math.min(y0, y1), z: Math.min(z0, z1) };
  const max = { x: Math.max(x0, x1), y: Math.max(y0, y1), z: Math.max(z0, z1) };
  const penetrable = opts?.penetrable ?? surface === "wood";
  return {
    aabb: { min, max },
    surface,
    solid: opts?.solid ?? true,
    visible: opts?.visible ?? true,
    color,
    penetrable,
  };
}
