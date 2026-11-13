import type { AABB } from "../core/math";
import type { BombSite } from "./types";

/** Standing 3D letter height (world units). Tops clear the 140-unit perimeter walls. */
export const SIGN_LETTER_HEIGHT = 128;
/** Raise the glyph so crates (~48) and the A/B bunker (~72) do not hide it. */
export const SIGN_LETTER_LIFT = 76;
export const SIGN_WALL_HEIGHT = 140;

export type SignRole = "site" | "approach";
export type SignPartKind = "post" | "back" | "glyph";

export interface SiteSignPlacement {
  letter: "A" | "B";
  x: number;
  z: number;
  role: SignRole;
}

export interface SignPart {
  /** Center relative to the sign anchor on the ground. */
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  rotY: number;
  rotZ: number;
  kind: SignPartKind;
}

export function siteCenter(aabb: AABB): { x: number; z: number } {
  return {
    x: (aabb.min.x + aabb.max.x) / 2,
    z: (aabb.min.z + aabb.max.z) / 2,
  };
}

/**
 * Place a monument on each site and a mid-facing approach sign just outside
 * the mid-side edge, so the letter is readable from mid, boxes, and the site.
 */
export function siteSignPlacements(sites: Pick<BombSite, "id" | "aabb">[]): SiteSignPlacement[] {
  const out: SiteSignPlacement[] = [];
  for (const site of sites) {
    const c = siteCenter(site.aabb);
    const midSide = Math.abs(site.aabb.max.x) < Math.abs(site.aabb.min.x) ? site.aabb.max.x : site.aabb.min.x;
    const towardMid = midSide >= 0 ? 1 : -1;
    out.push({ letter: site.id, x: c.x, z: c.z, role: "site" });
    out.push({
      letter: site.id,
      x: midSide - towardMid * 80,
      z: c.z,
      role: "approach",
    });
  }
  return out;
}

export function signTopY(): number {
  return SIGN_LETTER_LIFT + SIGN_LETTER_HEIGHT;
}

export function signColor(kind: SignPartKind, letter: "A" | "B"): number {
  if (kind === "glyph") return letter === "A" ? 0xffcc33 : 0x3fd4ff;
  if (kind === "back") return 0x141414;
  return 0x2a2a28;
}

function facePoint(rotY: number, localX: number, localZ: number): { x: number; z: number } {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  return {
    x: localX * c + localZ * s,
    z: -localX * s + localZ * c,
  };
}

function letterStrokes(letter: "A" | "B"): Array<{ x: number; y: number; w: number; h: number; rotZ: number }> {
  const h = SIGN_LETTER_HEIGHT;
  const lift = SIGN_LETTER_LIFT;
  const midY = lift + h / 2;
  if (letter === "A") {
    return [
      { x: -22, y: midY, w: 18, h, rotZ: 0.34 },
      { x: 22, y: midY, w: 18, h, rotZ: -0.34 },
      { x: 0, y: lift + 54, w: 52, h: 18, rotZ: 0 },
    ];
  }
  return [
    { x: -30, y: midY, w: 18, h, rotZ: 0 },
    { x: -2, y: lift + h - 10, w: 58, h: 18, rotZ: 0 },
    { x: -4, y: midY, w: 52, h: 16, rotZ: 0 },
    { x: -2, y: lift + 10, w: 58, h: 18, rotZ: 0 },
    { x: 20, y: lift + h * 0.75, w: 18, h: 48, rotZ: 0 },
    { x: 20, y: lift + h * 0.25, w: 18, h: 48, rotZ: 0 },
  ];
}

/** Chunky unlit boxes that read as a standing A or B from the four cardinals. */
export function signParts(letter: "A" | "B"): SignPart[] {
  const parts: SignPart[] = [
    {
      x: 0,
      y: SIGN_LETTER_LIFT / 2,
      z: 0,
      w: 10,
      h: SIGN_LETTER_LIFT,
      d: 10,
      rotY: 0,
      rotZ: 0,
      kind: "post",
    },
  ];
  const thick = 18;
  for (const rotY of [0, Math.PI / 2]) {
    const back = facePoint(rotY, 0, -thick / 2 - 4);
    parts.push({
      x: back.x,
      y: SIGN_LETTER_LIFT + SIGN_LETTER_HEIGHT / 2,
      z: back.z,
      w: 108,
      h: SIGN_LETTER_HEIGHT + 24,
      d: 8,
      rotY,
      rotZ: 0,
      kind: "back",
    });
    for (const stroke of letterStrokes(letter)) {
      const p = facePoint(rotY, stroke.x, thick / 2 + 2);
      parts.push({
        x: p.x,
        y: stroke.y,
        z: p.z,
        w: stroke.w,
        h: stroke.h,
        d: thick,
        rotY,
        rotZ: stroke.rotZ,
        kind: "glyph",
      });
    }
  }
  return parts;
}
