import { describe, expect, it } from "vitest";
import { buildHitboxes, pickHitGroup } from "../entities/hitbox";
import { applyArmor } from "../core/armor";

describe("hitboxes", () => {
  const feet = { x: 0, y: 0, z: 0 };

  it("classifies a downward ray from above as a headshot", () => {
    const boxes = buildHitboxes(feet, false);
    const hit = pickHitGroup({ x: 0, y: 90, z: 0 }, { x: 0, y: -1, z: 0 }, boxes, 200);
    expect(hit?.group).toBe("head");
  });

  it("classifies chest, stomach and legs by height", () => {
    const boxes = buildHitboxes(feet, false);
    const chest = pickHitGroup({ x: -80, y: 56, z: 0 }, { x: 1, y: 0, z: 0 }, boxes, 200);
    const stomach = pickHitGroup({ x: -80, y: 40, z: 0 }, { x: 1, y: 0, z: 0 }, boxes, 200);
    const leg = pickHitGroup({ x: -80, y: 16, z: 0 }, { x: 1, y: 0, z: 0 }, boxes, 200);
    expect(chest?.group).toBe("chest");
    expect(stomach?.group).toBe("stomach");
    expect(leg?.group).toBe("leg");
  });

  it("makes an unarmored AK headshot lethal (4.0x)", () => {
    const r = applyArmor({ baseDamage: 36, hitGroup: "head", armor: 0, hasHelmet: false, armorPenetration: 0.775 });
    expect(r.healthDamage).toBeGreaterThanOrEqual(100);
  });
});
