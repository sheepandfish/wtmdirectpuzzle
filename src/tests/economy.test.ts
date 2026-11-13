import { describe, expect, it } from "vitest";
import { applyPurchase, canAfford, clampMoney, helmetPrice, killReward, lossBonus, roundPayout } from "../core/economy";
import { MONEY_CAP, PRICES, REWARDS } from "../config";

describe("economy", () => {
  it("uses CS-style kill rewards by weapon class", () => {
    expect(killReward("rifle")).toBe(300);
    expect(killReward("pistol")).toBe(300);
    expect(killReward("blade")).toBe(1500);
    expect(killReward("sniper")).toBe(100);
  });

  it("increments loss bonus from 1400 up to 3400", () => {
    expect(lossBonus(0)).toBe(1400);
    expect(lossBonus(1)).toBe(1900);
    expect(lossBonus(2)).toBe(2400);
    expect(lossBonus(3)).toBe(2900);
    expect(lossBonus(4)).toBe(3400);
    expect(lossBonus(9)).toBe(3400);
  });

  it("pays 3250 for a win and the loss streak for a loss", () => {
    expect(roundPayout(1, 3)).toBe(REWARDS.win);
    expect(roundPayout(0, 2)).toBe(2400);
  });

  it("caps money at 16000 and rejects unaffordable buys", () => {
    expect(clampMoney(20000)).toBe(MONEY_CAP);
    expect(canAfford(2700, 2700)).toBe(true);
    expect(canAfford(2699, 2700)).toBe(false);
    expect(applyPurchase(3000, 2700)).toBe(300);
    expect(applyPurchase(100, 300)).toBeNull();
  });
});

describe("helmet upgrade price", () => {
  it("charges the full helmet price without armor and only the difference with kevlar", () => {
    expect(helmetPrice(0, false)).toBe(PRICES.helmet);
    expect(helmetPrice(100, false)).toBe(PRICES.helmet - PRICES.kevlar);
    expect(helmetPrice(100, true)).toBeNull();
  });
});
