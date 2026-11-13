import { describe, expect, it } from "vitest";
import { chooseBombCarrier, createBomb, dropBomb, settleDroppedBomb, tryPickupBomb, useActionPrompt } from "../entities/bomb";

function actor(id: number, team: string, kind: string, x = 0, z = 0) {
  return { id, kind, team, alive: true, body: { position: { x, y: 0, z } } };
}

describe("bomb drop and pickup", () => {
  it("prefers a T bot as the opening carrier", () => {
    const local = actor(0, "t", "human");
    const bot = actor(1, "t", "bot");
    expect(chooseBombCarrier([local, bot])?.id).toBe(1);
    expect(chooseBombCarrier([local])?.id).toBe(0);
  });

  it("drops into a settling state that cannot be picked up until the next settle", () => {
    const carrier = actor(0, "t", "human", 10, 10);
    const bomb = createBomb(carrier.id, carrier.body.position);
    dropBomb(bomb, carrier.body.position);
    expect(bomb.state).toBe("dropping");
    expect(bomb.carrierId).toBeNull();
    expect(tryPickupBomb(bomb, carrier)).toBe(false);
    settleDroppedBomb(bomb);
    expect(bomb.state).toBe("idle");
    expect(tryPickupBomb(bomb, carrier)).toBe(true);
    expect(bomb.state).toBe("carried");
    expect(bomb.carrierId).toBe(0);
  });

  it("only lets living terrorists pick up a loose bomb", () => {
    const bomb = createBomb(0, { x: 0, y: 0, z: 0 });
    dropBomb(bomb, { x: 0, y: 0, z: 0 });
    settleDroppedBomb(bomb);
    expect(tryPickupBomb(bomb, actor(2, "ct", "bot"))).toBe(false);
    const far = actor(3, "t", "bot", 400, 0);
    expect(tryPickupBomb(bomb, far)).toBe(false);
  });
});

const promptBase = {
  canPlant: false,
  canDefuse: false,
  plantHeld: 0,
  defuseHeld: 0,
  plantTime: 3.2,
  defuseTime: 10,
  defuseTimeWithKit: 5,
  hasKit: false,
};

describe("plant and defuse prompts", () => {
  it("shows 按住 E when the player can plant or defuse, even before progress starts", () => {
    const plant = useActionPrompt({ ...promptBase, canPlant: true });
    expect(plant?.label).toBe("按住 E 安放炸弹");
    expect(plant?.progress).toBe(0);
    const defuse = useActionPrompt({ ...promptBase, canDefuse: true });
    expect(defuse?.label).toBe("按住 E 拆除炸弹");
    expect(defuse?.progress).toBe(0);
  });

  it("switches to the in-progress label once hold time is above zero", () => {
    const plant = useActionPrompt({ ...promptBase, canPlant: true, plantHeld: 1.6 });
    expect(plant?.label).toBe("安放炸弹");
    expect(plant?.progress).toBeCloseTo(0.5);
  });
});
