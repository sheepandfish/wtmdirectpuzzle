import { describe, expect, it } from "vitest";
import { rangeDamageScale } from "../core/raycast";
import { WEAPONS } from "../config";

describe("weapon rangeModifier", () => {
  it("keeps almost all damage at point blank", () => {
    expect(rangeDamageScale(0, WEAPONS.ak.rangeModifier)).toBeCloseTo(1);
  });

  it("uses the weapon curve, so a pistol falls off faster than a rifle", () => {
    const rifle = rangeDamageScale(500, WEAPONS.ak.rangeModifier);
    const pistol = rangeDamageScale(500, WEAPONS.px9.rangeModifier);
    expect(rifle).toBeCloseTo(WEAPONS.ak.rangeModifier);
    expect(pistol).toBeCloseTo(WEAPONS.px9.rangeModifier);
    expect(pistol).toBeLessThan(rifle);
  });

  it("never drops below the 0.45 floor", () => {
    expect(rangeDamageScale(20000, 0.5)).toBe(0.45);
  });
});
