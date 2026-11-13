import { describe, expect, it } from "vitest";
import { buildSandMap } from "../map/sand";
import {
  SIGN_WALL_HEIGHT,
  signColor,
  signParts,
  signTopY,
  siteCenter,
  siteSignPlacements,
} from "../map/signs";

describe("site signs", () => {
  it("builds chunky A/B glyphs that stand above the walls", () => {
    const a = signParts("A");
    const b = signParts("B");
    expect(a.filter((p) => p.kind === "glyph").length).toBeGreaterThanOrEqual(3);
    expect(b.filter((p) => p.kind === "glyph").length).toBeGreaterThanOrEqual(5);
    expect(a.some((p) => p.kind === "back")).toBe(true);
    expect(a.some((p) => p.kind === "post")).toBe(true);
    const top = Math.max(...a.map((p) => p.y + p.h / 2), ...b.map((p) => p.y + p.h / 2));
    expect(top).toBeGreaterThan(SIGN_WALL_HEIGHT);
    expect(signTopY()).toBeGreaterThan(SIGN_WALL_HEIGHT);
    expect(signColor("glyph", "A")).not.toBe(signColor("glyph", "B"));
    expect(signColor("glyph", "A")).not.toBe(signColor("back", "A"));
  });

  it("places a site monument and a mid-facing approach sign for A and B", () => {
    const map = buildSandMap();
    const places = siteSignPlacements(map.sites);
    const aSite = places.find((p) => p.letter === "A" && p.role === "site");
    const bSite = places.find((p) => p.letter === "B" && p.role === "site");
    const aApp = places.find((p) => p.letter === "A" && p.role === "approach");
    const bApp = places.find((p) => p.letter === "B" && p.role === "approach");
    expect(aSite && bSite && aApp && bApp).toBeTruthy();
    const a = map.sites.find((s) => s.id === "A")!;
    const b = map.sites.find((s) => s.id === "B")!;
    const ac = siteCenter(a.aabb);
    const bc = siteCenter(b.aabb);
    expect(aSite!.x).toBeCloseTo(ac.x);
    expect(aSite!.z).toBeCloseTo(ac.z);
    expect(bSite!.x).toBeCloseTo(bc.x);
    expect(Math.abs(aApp!.x)).toBeLessThan(Math.abs(aSite!.x));
    expect(Math.abs(bApp!.x)).toBeLessThan(Math.abs(bSite!.x));
  });
});
