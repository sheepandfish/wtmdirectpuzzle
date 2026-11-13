import { ARMOR_BONUS, HIT_MULTIPLIER } from "../config";
import type { HitGroup } from "./math";

export interface ArmorInput {
  baseDamage: number;
  hitGroup: HitGroup;
  armor: number;
  hasHelmet: boolean;
  /** 0–1, e.g. 0.775 for AK. */
  armorPenetration: number;
}

export interface ArmorResult {
  healthDamage: number;
  armorDamage: number;
  armorLeft: number;
}

/**
 * CS-style armor:
 * - Legs never hit armor.
 * - Headshots ignore armor unless a helmet is worn.
 * - Health receives `damage * armorPenetration`.
 * - Armor loses half of the absorbed amount (`ARMOR_BONUS`).
 * - If armor is insufficient, leftover absorbed damage goes to health.
 */
export function applyArmor(input: ArmorInput): ArmorResult {
  const scaled = input.baseDamage * HIT_MULTIPLIER[input.hitGroup];
  const useArmor =
    input.armor > 0 &&
    input.hitGroup !== "leg" &&
    (input.hitGroup !== "head" || input.hasHelmet);

  if (!useArmor) {
    return { healthDamage: scaled, armorDamage: 0, armorLeft: input.armor };
  }

  const pen = Math.max(0, Math.min(1, input.armorPenetration));
  let healthDamage = scaled * pen;
  let absorbed = scaled - healthDamage;
  let armorDamage = absorbed * ARMOR_BONUS;

  if (armorDamage > input.armor) {
    const used = input.armor;
    const leftoverAbsorbed = absorbed - used / ARMOR_BONUS;
    healthDamage += leftoverAbsorbed;
    return { healthDamage, armorDamage: used, armorLeft: 0 };
  }

  return {
    healthDamage,
    armorDamage,
    armorLeft: input.armor - armorDamage,
  };
}
