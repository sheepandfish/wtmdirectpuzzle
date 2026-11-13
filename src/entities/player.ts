import {
  CROUCH_EYE_HEIGHT,
  EYE_HEIGHT,
  PLAYER_HEIGHT,
  PLAYER_MAX_ARMOR,
  PLAYER_MAX_HEALTH,
  STARTING_MONEY,
  WEAPONS,
  type WeaponId,
} from "../config";
import type { Vec3 } from "../core/math";
import { vec3 } from "../core/math";
import { applyArmor } from "../core/armor";
import type { HitGroup } from "../core/math";
import type { Body } from "../core/physics";
import { clampMoney } from "../core/economy";
import { beginReload, makeWeapon, refillFromBuy, type WeaponInstance } from "../weapons/weapon";
import { spawnYaw, type Team } from "./team";

export type PlayerKind = "human" | "bot";

export interface Inventory {
  primary: WeaponInstance | null;
  secondary: WeaponInstance;
  blade: WeaponInstance;
  active: "primary" | "secondary" | "blade";
}

export interface Player {
  id: number;
  name: string;
  kind: PlayerKind;
  team: Team;
  body: Body;
  prevPosition: Vec3;
  yaw: number;
  pitch: number;
  health: number;
  armor: number;
  helmet: boolean;
  kit: boolean;
  money: number;
  inventory: Inventory;
  alive: boolean;
  spawn: Vec3;
  flash: number;
  lastHurtDir: number;
  lastHurtAt: number;
  kills: number;
  deaths: number;
  useIntent: boolean;
  diedAt: number;
  nades: { flash: number; smoke: number };
}

export function createPlayer(
  id: number,
  name: string,
  kind: PlayerKind,
  team: Team,
  spawn: Vec3,
): Player {
  const body: Body = {
    position: vec3(spawn.x, spawn.y, spawn.z),
    velocity: vec3(),
    onGround: true,
    crouched: false,
    height: PLAYER_HEIGHT,
  };
  return {
    id,
    name,
    kind,
    team,
    body,
    prevPosition: vec3(spawn.x, spawn.y, spawn.z),
    yaw: spawnYaw(team),
    pitch: 0,
    health: PLAYER_MAX_HEALTH,
    armor: 0,
    helmet: false,
    kit: false,
    money: STARTING_MONEY,
    inventory: {
      primary: null,
      secondary: makeWeapon("px9"),
      blade: makeWeapon("blade"),
      active: "secondary",
    },
    alive: true,
    spawn: vec3(spawn.x, spawn.y, spawn.z),
    flash: 0,
    lastHurtDir: 0,
    lastHurtAt: -999,
    kills: 0,
    deaths: 0,
    useIntent: false,
    diedAt: 0,
    nades: { flash: 0, smoke: 0 },
  };
}

export function activeWeapon(p: Player): WeaponInstance {
  if (p.inventory.active === "primary" && p.inventory.primary) return p.inventory.primary;
  if (p.inventory.active === "blade") return p.inventory.blade;
  return p.inventory.secondary;
}

export function activeWeaponDef(p: Player) {
  return WEAPONS[activeWeapon(p).id];
}

export function eyeHeight(p: Player): number {
  return p.body.crouched ? CROUCH_EYE_HEIGHT : EYE_HEIGHT;
}

export function eyePosition(p: Player): Vec3 {
  return { x: p.body.position.x, y: p.body.position.y + eyeHeight(p), z: p.body.position.z };
}

export function switchSlot(p: Player, slot: 1 | 2 | 3): void {
  if (slot === 1 && p.inventory.primary) p.inventory.active = "primary";
  else if (slot === 2) p.inventory.active = "secondary";
  else if (slot === 3) p.inventory.active = "blade";
}

export function giveWeapon(p: Player, id: WeaponId): void {
  const inst = makeWeapon(id, true);
  const def = WEAPONS[id];
  if (def.className === "pistol") {
    p.inventory.secondary = inst;
    p.inventory.active = "secondary";
  } else if (def.className === "blade") {
    p.inventory.blade = inst;
    p.inventory.active = "blade";
  } else {
    p.inventory.primary = inst;
    p.inventory.active = "primary";
  }
}

export function damagePlayer(
  p: Player,
  baseDamage: number,
  hitGroup: HitGroup,
  armorPen: number,
  now = 0,
): { healthDamage: number; killed: boolean; remaining: number } {
  if (!p.alive) return { healthDamage: 0, killed: false, remaining: 0 };
  const result = applyArmor({
    baseDamage,
    hitGroup,
    armor: p.armor,
    hasHelmet: p.helmet,
    armorPenetration: armorPen,
  });
  p.health = Math.max(0, p.health - result.healthDamage);
  p.armor = result.armorLeft;
  if (p.armor <= 0) p.helmet = false;
  const killed = p.health <= 0;
  if (killed) {
    p.alive = false;
    p.health = 0;
    p.diedAt = now;
    p.deaths += 1;
    p.body.velocity = vec3();
  }
  return { healthDamage: result.healthDamage, killed, remaining: p.health };
}

export function tryReload(p: Player): boolean {
  return beginReload(activeWeapon(p));
}

export function resetForRound(p: Player, spawn: Vec3, yaw: number): void {
  p.spawn = vec3(spawn.x, spawn.y, spawn.z);
  p.body.position = vec3(spawn.x, spawn.y, spawn.z);
  p.prevPosition = vec3(spawn.x, spawn.y, spawn.z);
  p.body.velocity = vec3();
  p.body.onGround = true;
  p.body.crouched = false;
  p.body.height = PLAYER_HEIGHT;
  p.yaw = yaw;
  p.pitch = 0;
  p.health = PLAYER_MAX_HEALTH;
  p.alive = true;
  p.diedAt = 0;
  p.flash = 0;
  if (p.inventory.primary) refillFromBuy(p.inventory.primary);
  refillFromBuy(p.inventory.secondary);
  refillFromBuy(p.inventory.blade);
}

export function addMoney(p: Player, amount: number): void {
  p.money = clampMoney(p.money + amount);
}

export function buyKevlar(p: Player): boolean {
  p.armor = PLAYER_MAX_ARMOR;
  return true;
}

export function buyHelmet(p: Player): boolean {
  p.armor = PLAYER_MAX_ARMOR;
  p.helmet = true;
  return true;
}
