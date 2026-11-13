import { describe, expect, it } from "vitest";
import { applyArmor } from "../core/armor";

describe("applyArmor", () => {
  it("passes full damage when there is no armor", () => {
    const r = applyArmor({ baseDamage: 36, hitGroup: "chest", armor: 0, hasHelmet: false, armorPenetration: 0.775 });
    expect(r.healthDamage).toBeCloseTo(36);
    expect(r.armorDamage).toBe(0);
  });

  it("sends armorPenetration portion of chest damage to health", () => {
    const r = applyArmor({ baseDamage: 36, hitGroup: "chest", armor: 100, hasHelmet: true, armorPenetration: 0.775 });
    expect(r.healthDamage).toBeCloseTo(36 * 0.775);
    expect(r.armorDamage).toBeCloseTo((36 - 36 * 0.775) * 0.5);
    expect(r.armorLeft).toBeCloseTo(100 - r.armorDamage);
  });

  it("applies 4x head multiplier and ignores armor without a helmet", () => {
    const r = applyArmor({ baseDamage: 36, hitGroup: "head", armor: 100, hasHelmet: false, armorPenetration: 0.775 });
    expect(r.healthDamage).toBeCloseTo(144);
    expect(r.armorDamage).toBe(0);
  });

  it("applies helmet to headshots", () => {
    const r = applyArmor({ baseDamage: 36, hitGroup: "head", armor: 100, hasHelmet: true, armorPenetration: 0.775 });
    expect(r.healthDamage).toBeCloseTo(144 * 0.775);
  });

  it("does not absorb leg shots with armor", () => {
    const r = applyArmor({ baseDamage: 36, hitGroup: "leg", armor: 100, hasHelmet: true, armorPenetration: 0.775 });
    expect(r.healthDamage).toBeCloseTo(36 * 0.75);
    expect(r.armorDamage).toBe(0);
    expect(r.armorLeft).toBe(100);
  });

  it("dumps leftover absorbed damage into health when armor breaks", () => {
    const r = applyArmor({ baseDamage: 36, hitGroup: "chest", armor: 1, hasHelmet: false, armorPenetration: 0.775 });
    expect(r.armorLeft).toBe(0);
    expect(r.armorDamage).toBe(1);
    expect(r.healthDamage).toBeGreaterThan(36 * 0.775);
    expect(r.healthDamage).toBeLessThan(36);
  });
});
