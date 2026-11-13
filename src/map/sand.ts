import { PLAYER_HALF_WIDTH } from "../config";
import type { AABB, Vec3 } from "../core/math";
import { brush, type Brush, type GameMap } from "./types";

const H = 140;
const CONCRETE = 0x8d908b;
const CONCRETE_DK = 0x6a6d6a;
const WOOD = 0x9a6a3a;
const WOOD_DK = 0x6f4a28;
const FLOOR = 0xc4b084;
const SITE_FLOOR = 0xb7904e;
const SPAWN_FLOOR = 0x9aa06a;

function ground(x0: number, z0: number, x1: number, z1: number, color = FLOOR): Brush {
  return brush(x0, -24, z0, x1, 0, z1, "ground", color, { penetrable: false });
}

/** Visual floor paint only — raised a little so it does not z-fight with the base ground. */
function floorPaint(x0: number, z0: number, x1: number, z1: number, color: number): Brush {
  return brush(x0, 0.15, z0, x1, 0.4, z1, "ground", color, { penetrable: false, solid: false });
}

function wall(x0: number, z0: number, x1: number, z1: number, color = CONCRETE): Brush {
  return brush(x0, 0, z0, x1, H, z1, "concrete", color, { penetrable: false });
}

function crate(x: number, z: number, w = 48, d = 48, h = 48, color = WOOD): Brush {
  return brush(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, "wood", color, { penetrable: true });
}

function barrier(x0: number, z0: number, x1: number, z1: number, h = 56): Brush {
  return brush(x0, 0, z0, x1, h, z1, "wood", WOOD_DK, { penetrable: true });
}

function siteVolume(id: "A" | "B", x0: number, z0: number, x1: number, z1: number) {
  return {
    id,
    aabb: {
      min: { x: Math.min(x0, x1), y: 0, z: Math.min(z0, z1) },
      max: { x: Math.max(x0, x1), y: 80, z: Math.max(z0, z1) },
    } satisfies AABB,
    label: id,
  };
}

function buildWalkable(brushes: Brush[], bounds: AABB, cell: number): {
  origin: Vec3;
  walkable: boolean[][];
} {
  const origin = { x: bounds.min.x, y: 0, z: bounds.min.z };
  const w = Math.ceil((bounds.max.x - bounds.min.x) / cell);
  const h = Math.ceil((bounds.max.z - bounds.min.z) / cell);
  const solids = brushes.filter((b) => b.solid && b.surface !== "ground");
  const pad = PLAYER_HALF_WIDTH + 2;
  const walkable: boolean[][] = [];
  for (let gz = 0; gz < h; gz++) {
    const row: boolean[] = [];
    for (let gx = 0; gx < w; gx++) {
      const x = origin.x + (gx + 0.5) * cell;
      const z = origin.z + (gz + 0.5) * cell;
      let blocked = false;
      for (const s of solids) {
        if (
          x + pad > s.aabb.min.x &&
          x - pad < s.aabb.max.x &&
          z + pad > s.aabb.min.z &&
          z - pad < s.aabb.max.z &&
          16 > s.aabb.min.y &&
          16 < s.aabb.max.y
        ) {
          blocked = true;
          break;
        }
      }
      const inside =
        x > bounds.min.x + 8 &&
        x < bounds.max.x - 8 &&
        z > bounds.min.z + 8 &&
        z < bounds.max.z - 8;
      row.push(inside && !blocked);
    }
    walkable.push(row);
  }
  return { origin, walkable };
}

/**
 * SAND — a compact, symmetric two-site map.
 * T spawns south (−Z), CT north (+Z). Mid is the central corridor.
 * Wooden crates/boards are penetrable; concrete walls are not.
 */
export function buildSandMap(): GameMap {
  const brushes: Brush[] = [];
  const X = 1400;
  const Z = 1600;

  brushes.push(ground(-X, -Z, X, Z, FLOOR));
  brushes.push(floorPaint(-1180, 260, -560, 860, SITE_FLOOR));
  brushes.push(floorPaint(560, 260, 1180, 860, SITE_FLOOR));
  brushes.push(floorPaint(-320, -1520, 320, -1120, SPAWN_FLOOR));
  brushes.push(floorPaint(-320, 1120, 320, 1520, SPAWN_FLOOR));

  // Perimeter
  brushes.push(wall(-X, -Z, X, -Z + 36, CONCRETE_DK));
  brushes.push(wall(-X, Z - 36, X, Z, CONCRETE_DK));
  brushes.push(wall(-X, -Z, -X + 36, Z, CONCRETE_DK));
  brushes.push(wall(X - 36, -Z, X, Z, CONCRETE_DK));

  // Mid corridor walls (gaps open to A/B connectors and spawns)
  // West mid wall with two openings: south (T-A) and mid (mid-A) and north (CT-A)
  const midW = 150;
  const open = (z0: number, z1: number) =>
    [
      [ -900, z0 ],
      [ 900, z1 ],
    ] as const;

  // Continuous mid walls broken into segments
  const midGapsW = [
    { z0: -1120, z1: -980 }, // T mid mouth
    { z0: -80, z1: 80 }, // mid cross
    { z0: 980, z1: 1120 }, // CT mid mouth
    { z0: -640, z1: -480 }, // T-A / T-B mid doors
    { z0: 480, z1: 640 }, // CT-A / CT-B mid doors
  ];
  const midSegments = segmentsFromGaps(-1120, 1120, midGapsW);
  for (const s of midSegments) {
    brushes.push(wall(-midW - 28, s.z0, -midW, s.z1));
    brushes.push(wall(midW, s.z0, midW + 28, s.z1));
  }

  // T spawn side rooms
  brushes.push(wall(-320, -1520, -292, -1120));
  brushes.push(wall(292, -1520, 320, -1120));
  // CT spawn side rooms
  brushes.push(wall(-320, 1120, -292, 1520));
  brushes.push(wall(292, 1120, 320, 1520));

  // A / B long halls (outer lanes)
  // West long (T-A / CT-A): corridor around x = -980
  brushes.push(wall(-860, -1120, -832, -640));
  brushes.push(wall(-1180, -1120, -1152, 250));
  brushes.push(wall(-1180, -1120, -860, -1092));
  // Opening from T spawn west into long
  brushes.push(wall(-860, -1520, -832, -1280));
  brushes.push(wall(-320, -1520, -320 + 28, -1480)); // already have spawn wall
  // South connector T-spawn to A long
  brushes.push(wall(-860, -1520, -320, -1492));
  brushes.push(wall(-860, -1280, -320, -1252));

  // A site walls
  brushes.push(wall(-1180, 830, -560, 858));
  brushes.push(wall(-1180, 250, -1152, 830));
  brushes.push(wall(-588, 250, -560, 480));
  brushes.push(wall(-588, 640, -560, 830));
  brushes.push(wall(-860, 250, -560, 278));
  // A entry from long
  brushes.push(wall(-860, -480, -832, 250));

  // Connector mid <-> A (through mid door at z 480-640 and -640--480)
  brushes.push(wall(-832, -480, -midW, -452));
  brushes.push(wall(-832, -640, -midW, -612));
  brushes.push(wall(-832, 452, -midW, 480));
  brushes.push(wall(-832, 612, -midW, 640));

  // Mirror to B (east)
  const mir = (b: Brush): Brush => {
    const a = b.aabb;
    return {
      ...b,
      aabb: {
        min: { x: -a.max.x, y: a.min.y, z: a.min.z },
        max: { x: -a.min.x, y: a.max.y, z: a.max.z },
      },
    };
  };
  // We already built mid + spawns + perimeter + A side. Capture A-only brushes to mirror.
  // Simpler: explicitly build B as mirrored copies of the west structures added after mid/spawns.

  // The west structures start after CT spawn walls. We'll just write B explicitly.

  brushes.push(wall(832, -1120, 860, -640));
  brushes.push(wall(1152, -1120, 1180, 250));
  brushes.push(wall(860, -1120, 1180, -1092));
  brushes.push(wall(832, -1520, 860, -1280));
  brushes.push(wall(320, -1520, 860, -1492));
  brushes.push(wall(320, -1280, 860, -1252));

  brushes.push(wall(560, 830, 1180, 858));
  brushes.push(wall(1152, 250, 1180, 830));
  brushes.push(wall(560, 250, 588, 480));
  brushes.push(wall(560, 640, 588, 830));
  brushes.push(wall(560, 250, 860, 278));
  brushes.push(wall(832, -480, 860, 250));

  brushes.push(wall(midW, -480, 832, -452));
  brushes.push(wall(midW, -640, 832, -612));
  brushes.push(wall(midW, 452, 832, 480));
  brushes.push(wall(midW, 612, 832, 640));

  // CT west / east halls
  brushes.push(wall(-860, 858, -832, 1120));
  brushes.push(wall(-1180, 858, -1152, 1480));
  brushes.push(wall(-860, 1480, -320, 1520)); // may overlap perimeter slightly
  brushes.push(wall(-860, 1252, -320, 1280));
  brushes.push(wall(-860, 1492, -320, 1520));
  brushes.push(wall(832, 858, 860, 1120));
  brushes.push(wall(1152, 858, 1180, 1480));
  brushes.push(wall(320, 1252, 860, 1280));
  brushes.push(wall(320, 1492, 860, 1520));

  // Cover: wooden crates & boards (penetrable), a few concrete blocks
  brushes.push(crate(-80, 0, 56, 56, 40));
  brushes.push(crate(80, 80, 48, 48, 48));
  brushes.push(crate(-40, -60, 44, 64, 36));
  brushes.push(barrier(-120, 200, 120, 216, 40));

  // A site cover
  brushes.push(crate(-980, 520, 64, 48, 48));
  brushes.push(crate(-720, 700, 52, 52, 44));
  brushes.push(crate(-640, 400, 48, 72, 40));
  brushes.push(barrier(-900, 360, -700, 376, 52));
  brushes.push(brush(-1080, 0, 600, -1020, 72, 720, "concrete", CONCRETE_DK, { penetrable: false })); // A bunker

  // B site cover (mirror-ish)
  brushes.push(crate(980, 520, 64, 48, 48));
  brushes.push(crate(720, 700, 52, 52, 44));
  brushes.push(crate(640, 400, 48, 72, 40));
  brushes.push(barrier(700, 360, 900, 376, 52));
  brushes.push(brush(1020, 0, 600, 1080, 72, 720, "concrete", CONCRETE_DK, { penetrable: false }));

  // Mid wooden doors / boards at connectors (penetrable)
  brushes.push(barrier(-midW - 4, -80, -midW + 20, 80, 88));
  brushes.push(barrier(midW - 20, -80, midW + 4, 80, 88));

  // T/CT spawn boxes
  brushes.push(crate(-120, -1320, 40, 40, 36, WOOD));
  brushes.push(crate(140, -1360, 40, 40, 36, WOOD));
  brushes.push(crate(-140, 1320, 40, 40, 36, WOOD));
  brushes.push(crate(120, 1360, 40, 40, 36, WOOD));

  void mir;
  void open;

  const bounds: AABB = {
    min: { x: -X, y: -24, z: -Z },
    max: { x: X, y: H, z: Z },
  };
  const cell = 32;
  const { origin, walkable } = buildWalkable(brushes, bounds, cell);

  const coverPoints: Vec3[] = [
    { x: -80, y: 0, z: 40 },
    { x: 80, y: 0, z: 80 },
    { x: -980, y: 0, z: 560 },
    { x: -720, y: 0, z: 700 },
    { x: 980, y: 0, z: 560 },
    { x: 720, y: 0, z: 700 },
    { x: -640, y: 0, z: 420 },
    { x: 640, y: 0, z: 420 },
    { x: -200, y: 0, z: -500 },
    { x: 200, y: 0, z: 500 },
  ];

  const tSpawns: Vec3[] = [
    { x: 0, y: 2, z: -1360 },
    { x: -140, y: 2, z: -1400 },
    { x: 140, y: 2, z: -1400 },
  ];
  const ctSpawns: Vec3[] = [
    { x: 0, y: 2, z: 1360 },
    { x: -140, y: 2, z: 1400 },
    { x: 140, y: 2, z: 1400 },
  ];

  return {
    name: "SAND",
    brushes,
    sites: [
      siteVolume("A", -1140, 300, -600, 820),
      siteVolume("B", 600, 300, 1140, 820),
    ],
    tSpawns,
    ctSpawns,
    bounds,
    navOrigin: origin,
    navCell: cell,
    walkable,
    coverPoints,
  };
}

function segmentsFromGaps(
  z0: number,
  z1: number,
  gaps: Array<{ z0: number; z1: number }>,
): Array<{ z0: number; z1: number }> {
  const g = [...gaps].sort((a, b) => a.z0 - b.z0);
  const out: Array<{ z0: number; z1: number }> = [];
  let cursor = z0;
  for (const gap of g) {
    if (gap.z0 > cursor) out.push({ z0: cursor, z1: gap.z0 });
    cursor = Math.max(cursor, gap.z1);
  }
  if (cursor < z1) out.push({ z0: cursor, z1 });
  return out;
}
