import { describe, expect, it } from "vitest";
import { PLAYER_HEIGHT, PLAYER_HALF_WIDTH, TICK_DT } from "../config";
import { resolvePenetration, simulateMove, type Body, type Solid } from "../core/physics";

function bodyAt(x: number, z: number, y = 0): Body {
  return {
    position: { x, y, z },
    velocity: { x: 0, y: 0, z: 0 },
    onGround: y <= 0.01,
    crouched: false,
    height: PLAYER_HEIGHT,
  };
}

const ground: Solid = {
  aabb: { min: { x: -400, y: -24, z: -400 }, max: { x: 400, y: 0, z: 400 } },
};

const crate: Solid = {
  aabb: { min: { x: -24, y: 0, z: -24 }, max: { x: 24, y: 48, z: 24 } },
};

const solids = [ground, crate];

function step(body: Body, yaw: number, n: number, extra?: Partial<Parameters<typeof simulateMove>[1]>) {
  for (let i = 0; i < n; i++) {
    simulateMove(
      body,
      {
        forward: 1,
        right: 0,
        yaw,
        jumping: false,
        walking: false,
        crouching: false,
        maxSpeed: 250,
        frozen: false,
        ...extra,
      },
      TICK_DT,
      solids,
    );
  }
}

describe("physics collision", () => {
  it("does not walk through a crate", () => {
    const body = bodyAt(0, -80);
    // yaw π looks +Z toward the crate
    step(body, Math.PI, 120);
    expect(body.position.z).toBeLessThan(-24 - PLAYER_HALF_WIDTH + 1);
    expect(body.position.y).toBeGreaterThanOrEqual(-0.01);
  });

  it("slides around a convex crate corner instead of freezing", () => {
    const body = bodyAt(-40, -80);
    step(body, Math.PI * 0.75, 180);
    const moved = Math.hypot(body.position.x + 40, body.position.z + 80);
    expect(moved).toBeGreaterThan(40);
    expect(body.position.z).not.toBeCloseTo(-80, 0);
  });

  it("pushes a player out when they start slightly inside a crate", () => {
    // 1 unit into the south face
    const insideZ = -24 - PLAYER_HALF_WIDTH + 1;
    const freed = resolvePenetration({ x: 0, y: 0, z: insideZ }, PLAYER_HEIGHT, solids);
    expect(freed.z).toBeLessThanOrEqual(-24 - PLAYER_HALF_WIDTH);
    const body = bodyAt(0, insideZ);
    step(body, 0, 8); // walk -Z, away from crate
    const stillInside =
      Math.abs(body.position.x) < 24 + PLAYER_HALF_WIDTH &&
      Math.abs(body.position.z) < 24 + PLAYER_HALF_WIDTH &&
      body.position.y < 48;
    expect(stillInside).toBe(false);
  });
});
