/** All tunable gameplay values. Business code should import from here, not hardcode. */

export const TICK_HZ = 60;
export const TICK_DT = 1 / TICK_HZ;
export const UNIT_TO_METERS = 0.01905;

export const GRAVITY = 800;
export const JUMP_VELOCITY = 301.99;
export const PLAYER_HEIGHT = 72;
export const CROUCH_HEIGHT = 54;
export const EYE_HEIGHT = 64;
export const CROUCH_EYE_HEIGHT = 46;
export const PLAYER_HALF_WIDTH = 16;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_MAX_ARMOR = 100;
export const STARTING_MONEY = 800;
export const MONEY_CAP = 16000;

/** Source-like ground/air acceleration and friction (CS approximates). */
export const SV_ACCELERATE = 5.5;
export const SV_AIRACCELERATE = 12;
export const SV_FRICTION = 5.2;
export const SV_STOPSPEED = 80;
export const SV_AIR_WISH_CAP = 30;

export const WALK_SPEED_MUL = 0.52;
export const CROUCH_SPEED_MUL = 0.34;

export const MOVE_SPEED = {
  blade: 250,
  rifle: 215,
  pistol: 240,
  sniper: 200,
  sniperScoped: 150,
} as const;

export const HIT_MULTIPLIER = {
  head: 4.0,
  chest: 1.0,
  stomach: 1.25,
  leg: 0.75,
} as const;

/** CS-style armor: health takes (damage * armorPenetration), armor loses half of the absorbed amount. */
export const ARMOR_BONUS = 0.5;

export const MOUSE_SENSITIVITY = 0.022;
export const DEFAULT_FOV = 90;
export const SCOPE_FOV = 40;

export const ROUND = {
  winScore: 13,
  halftimeAfter: 12,
  freezeTime: 15,
  roundTime: 115,
  bombTime: 40,
  plantTime: 3.5,
  defuseTime: 10,
  defuseTimeWithKit: 5,
  maxRounds: 24,
  /** Settlement banner duration; also the delay before the next round. */
  endDisplay: 3.2,
  buyCloseWarn: 3,
} as const;

export const REWARDS = {
  rifleKill: 300,
  pistolKill: 300,
  bladeKill: 1500,
  sniperKill: 100,
  win: 3250,
  lossBase: 1400,
  lossStep: 500,
  lossMaxSteps: 4,
  plant: 300,
  defuse: 300,
} as const;

export const PRICES = {
  ak: 2700,
  crx: 1700,
  px9: 300,
  falcon: 4750,
  kevlar: 650,
  helmet: 1000,
  kit: 400,
  flash: 200,
  smoke: 300,
} as const;

export const NADES = {
  flashFuse: 1.5,
  flashMaxDuration: 4.5,
  flashMaxRange: 1500,
  smokeFuse: 2.0,
  smokeDuration: 15,
  smokeRadius: 140,
  throwSpeed: 1400,
  throwUp: 180,
  maxFlash: 2,
  maxSmoke: 1,
} as const;

export const RECOIL_RECOVER_DELAY = 0.4;
export const RECOIL_RECOVER_RATE = 8;

export const WOOD_PENETRATION_DAMAGE = 0.65;
export const RANGE_MODIFIER_PER_500U = 0.02;

export const BOT = {
  count: 5,
  reactionMin: 0.16,
  reactionMax: 0.32,
  aimErrorDeg: 2.4,
  aimTrack: 8,
  patrolWait: 1.2,
  retreatHealth: 25,
} as const;

export const TEAM_SIZE = 3;

export const WEAPONS = {
  ak: {
    id: "ak",
    name: "AK",
    slot: 1 as const,
    className: "rifle" as const,
    damage: 36,
    rpm: 600,
    magSize: 30,
    reserve: 90,
    armorPen: 0.775,
    price: PRICES.ak,
    killReward: REWARDS.rifleKill,
    moveSpeed: MOVE_SPEED.rifle,
    inaccuracyStand: 0.35,
    inaccuracyMove: 4.2,
    inaccuracyJump: 18,
    inaccuracyCrouch: 0.18,
    rangeModifier: 0.98,
    recoilPitch: 0.72,
    recoilYaw: 0.18,
    pitchScaleAfter10: 0.28,
    yawScaleAfter10: 0.55,
    automatic: true,
    canScope: false,
    reloadTime: 2.25,
  },
  crx: {
    id: "crx",
    name: "CRX",
    slot: 1 as const,
    className: "rifle" as const,
    damage: 30,
    rpm: 666,
    magSize: 25,
    reserve: 75,
    armorPen: 0.7,
    price: PRICES.crx,
    killReward: REWARDS.rifleKill,
    moveSpeed: 230,
    inaccuracyStand: 0.42,
    inaccuracyMove: 3.6,
    inaccuracyJump: 16,
    inaccuracyCrouch: 0.22,
    rangeModifier: 0.97,
    recoilPitch: 0.58,
    recoilYaw: 0.16,
    pitchScaleAfter10: 0.26,
    yawScaleAfter10: 0.48,
    automatic: true,
    canScope: false,
    reloadTime: 2.1,
  },
  px9: {
    id: "px9",
    name: "PX9",
    slot: 2 as const,
    className: "pistol" as const,
    damage: 33,
    rpm: 400,
    magSize: 12,
    reserve: 24,
    armorPen: 0.625,
    price: PRICES.px9,
    killReward: REWARDS.pistolKill,
    moveSpeed: MOVE_SPEED.pistol,
    inaccuracyStand: 0.6,
    inaccuracyMove: 3.2,
    inaccuracyJump: 14,
    inaccuracyCrouch: 0.32,
    rangeModifier: 0.9,
    recoilPitch: 0.45,
    recoilYaw: 0.12,
    pitchScaleAfter10: 0.2,
    yawScaleAfter10: 0.3,
    automatic: false,
    canScope: false,
    reloadTime: 1.6,
  },
  falcon: {
    id: "falcon",
    name: "FALCON",
    slot: 1 as const,
    className: "sniper" as const,
    damage: 115,
    rpm: 41,
    magSize: 10,
    reserve: 30,
    armorPen: 0.975,
    price: PRICES.falcon,
    killReward: REWARDS.sniperKill,
    moveSpeed: MOVE_SPEED.sniper,
    inaccuracyStand: 8.5,
    inaccuracyMove: 22,
    inaccuracyJump: 40,
    inaccuracyCrouch: 6,
    inaccuracyScoped: 0.12,
    rangeModifier: 0.99,
    recoilPitch: 2.2,
    recoilYaw: 0.4,
    pitchScaleAfter10: 0.4,
    yawScaleAfter10: 0.4,
    automatic: false,
    canScope: true,
    unscopeOnShot: true,
    scopedSpeed: MOVE_SPEED.sniperScoped,
    reloadTime: 3.1,
  },
  blade: {
    id: "blade",
    name: "BLADE",
    slot: 3 as const,
    className: "blade" as const,
    damage: 55,
    rpm: 120,
    magSize: 1,
    reserve: 0,
    armorPen: 0.85,
    price: 0,
    killReward: REWARDS.bladeKill,
    moveSpeed: MOVE_SPEED.blade,
    inaccuracyStand: 0,
    inaccuracyMove: 0,
    inaccuracyJump: 0,
    inaccuracyCrouch: 0,
    rangeModifier: 1,
    recoilPitch: 0,
    recoilYaw: 0,
    pitchScaleAfter10: 0,
    yawScaleAfter10: 0,
    automatic: false,
    canScope: false,
    meleeRange: 64,
    reloadTime: 0,
  },
} as const;

export type WeaponId = keyof typeof WEAPONS;

export type WeaponClass = "rifle" | "pistol" | "sniper" | "blade";

export interface WeaponDef {
  id: WeaponId;
  name: string;
  slot: 1 | 2 | 3;
  className: WeaponClass;
  damage: number;
  rpm: number;
  magSize: number;
  reserve: number;
  armorPen: number;
  price: number;
  killReward: number;
  moveSpeed: number;
  inaccuracyStand: number;
  inaccuracyMove: number;
  inaccuracyJump: number;
  inaccuracyCrouch: number;
  inaccuracyScoped?: number;
  rangeModifier: number;
  recoilPitch: number;
  recoilYaw: number;
  pitchScaleAfter10: number;
  yawScaleAfter10: number;
  automatic: boolean;
  canScope: boolean;
  unscopeOnShot?: boolean;
  scopedSpeed?: number;
  meleeRange?: number;
  reloadTime: number;
}

export function weaponDef(id: WeaponId): WeaponDef {
  return WEAPONS[id] as WeaponDef;
}
