import { MONEY_CAP, PRICES, REWARDS } from "../config";
import type { WeaponClass } from "../config";

export function killReward(weaponClass: WeaponClass): number {
  switch (weaponClass) {
    case "rifle":
      return REWARDS.rifleKill;
    case "pistol":
      return REWARDS.pistolKill;
    case "blade":
      return REWARDS.bladeKill;
    case "sniper":
      return REWARDS.sniperKill;
    default:
      return REWARDS.rifleKill;
  }
}

/** Consecutive-loss bonus: $1400, $1900, $2400, $2900, $3400. A win resets the streak. */
export function lossBonus(consecutiveLosses: number): number {
  const steps = Math.max(0, Math.min(REWARDS.lossMaxSteps, consecutiveLosses));
  return REWARDS.lossBase + steps * REWARDS.lossStep;
}

export function roundPayout(won: number, consecutiveLossesBeforeRound: number): number {
  if (won) return REWARDS.win;
  return lossBonus(consecutiveLossesBeforeRound);
}

export function clampMoney(money: number): number {
  return Math.max(0, Math.min(MONEY_CAP, Math.floor(money)));
}

export function applyReward(money: number, amount: number): number {
  return clampMoney(money + amount);
}

export function canAfford(money: number, price: number): boolean {
  return money >= price;
}

export function applyPurchase(money: number, price: number): number | null {
  if (!canAfford(money, price)) return null;
  return money - price;
}

/** Already-armored helmet upgrade only charges the difference. Null if already owned. */
export function helmetPrice(armor: number, hasHelmet: boolean, prices = PRICES): number | null {
  if (hasHelmet) return null;
  if (armor > 0) return prices.helmet - prices.kevlar;
  return prices.helmet;
}
