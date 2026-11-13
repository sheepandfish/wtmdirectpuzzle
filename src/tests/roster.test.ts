import { describe, expect, it } from "vitest";
import { matchRosterNames } from "../entities/team";

describe("match roster names", () => {
  it("gives six unique names when the local player is ATK, with a single Hale on DEF", () => {
    const { t, ct } = matchRosterNames("t", 3);
    expect(t).toEqual(["You", "Ash", "Reed"]);
    expect(ct).toEqual(["Hale", "Voss", "Pike"]);
    const all = [...t, ...ct];
    expect(new Set(all).size).toBe(6);
    expect(ct.filter((n) => n === "Hale")).toHaveLength(1);
    expect(ct.includes("You")).toBe(false);
  });

  it("gives six unique names when the local player is DEF", () => {
    const { t, ct } = matchRosterNames("ct", 3);
    expect(ct[0]).toBe("You");
    expect(t.includes("You")).toBe(false);
    const all = [...t, ...ct];
    expect(new Set(all).size).toBe(6);
  });
});
