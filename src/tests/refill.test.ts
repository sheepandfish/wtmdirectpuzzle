import { describe, expect, it } from "vitest";
import { createPlayer, giveWeapon, resetForRound } from "../entities/player";
import { spawnYaw } from "../entities/team";
import { WEAPONS } from "../config";

describe("round start refill", () => {
  it("restores mag and reserve through resetForRound", () => {
    const p = createPlayer(0, "You", "human", "t", { x: 0, y: 0, z: 0 });
    giveWeapon(p, "ak");
    p.inventory.primary!.mag = 3;
    p.inventory.primary!.reserve = 10;
    p.inventory.secondary.mag = 1;
    p.inventory.secondary.reserve = 0;
    resetForRound(p, { x: 5, y: 0, z: 5 }, spawnYaw("t"));
    expect(p.inventory.primary!.mag).toBe(WEAPONS.ak.magSize);
    expect(p.inventory.primary!.reserve).toBe(WEAPONS.ak.reserve);
    expect(p.inventory.secondary.mag).toBe(WEAPONS.px9.magSize);
    expect(p.inventory.secondary.reserve).toBe(WEAPONS.px9.reserve);
  });
});
