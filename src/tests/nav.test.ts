import { describe, expect, it } from "vitest";
import { findPath, snapToWalkable, worldToCell } from "../map/navgrid";
import type { GameMap } from "../map/types";

function toyMap(): GameMap {
  const walkable = [
    [false, false, false, false],
    [false, true, true, false],
    [false, true, true, false],
    [false, false, false, false],
  ];
  return {
    name: "toy",
    brushes: [],
    sites: [],
    tSpawns: [],
    ctSpawns: [],
    bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 128, y: 10, z: 128 } },
    navOrigin: { x: 0, y: 0, z: 0 },
    navCell: 32,
    walkable,
    coverPoints: [],
  };
}

describe("nav snap", () => {
  it("snaps an unwalkable start/goal onto the nearest walkable cell", () => {
    const map = toyMap();
    const startWorld = { x: 16, y: 0, z: 16 };
    expect(worldToCell(map, startWorld.x, startWorld.z)).toEqual({ x: 0, z: 0 });
    expect(snapToWalkable(map, startWorld.x, startWorld.z)).toEqual({ x: 1, z: 1 });
    const path = findPath(map, startWorld, { x: 80, y: 0, z: 80 });
    expect(path.length).toBeGreaterThan(0);
  });

  it("returns an empty path when the grid has no walkable cells", () => {
    const map = toyMap();
    map.walkable = map.walkable.map((row) => row.map(() => false));
    expect(findPath(map, { x: 16, y: 0, z: 16 }, { x: 80, y: 0, z: 80 })).toEqual([]);
  });
});
