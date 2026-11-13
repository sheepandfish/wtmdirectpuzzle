import { WEAPONS, weaponDef, type WeaponId } from "../config";
import { applyShotRecoil, createRecoilState, stepRecoil, type RecoilState } from "./recoil";

export type WeaponStateName = "idle" | "firing" | "reloading";

export interface WeaponInstance {
  id: WeaponId;
  mag: number;
  reserve: number;
  cooldown: number;
  reloadLeft: number;
  state: WeaponStateName;
  recoil: RecoilState;
  scoped: boolean;
}

export function makeWeapon(id: WeaponId, full = true): WeaponInstance {
  const def = WEAPONS[id];
  return {
    id,
    mag: full ? def.magSize : 0,
    reserve: full ? def.reserve : 0,
    cooldown: 0,
    reloadLeft: 0,
    state: "idle",
    recoil: createRecoilState(),
    scoped: false,
  };
}

export function fireInterval(id: WeaponId): number {
  return 60 / WEAPONS[id].rpm;
}

export function stepWeapon(w: WeaponInstance, dt: number): void {
  if (w.cooldown > 0) w.cooldown = Math.max(0, w.cooldown - dt);
  w.recoil = stepRecoil(w.recoil, dt);
  if (w.state === "reloading") {
    w.reloadLeft -= dt;
    if (w.reloadLeft <= 0) {
      const def = WEAPONS[w.id];
      const need = def.magSize - w.mag;
      const take = Math.min(need, w.reserve);
      w.mag += take;
      w.reserve -= take;
      w.reloadLeft = 0;
      w.state = "idle";
    }
  }
}

export function canFire(w: WeaponInstance): boolean {
  if (w.id === "blade") return w.state !== "reloading" && w.cooldown <= 0;
  return w.state !== "reloading" && w.cooldown <= 0 && w.mag > 0;
}

export function beginReload(w: WeaponInstance): boolean {
  if (w.id === "blade") return false;
  const def = WEAPONS[w.id];
  if (w.state === "reloading") return false;
  if (w.mag >= def.magSize) return false;
  if (w.reserve <= 0) return false;
  w.state = "reloading";
  w.reloadLeft = def.reloadTime;
  w.scoped = false;
  return true;
}

export function consumeShot(w: WeaponInstance): boolean {
  if (!canFire(w)) return false;
  if (w.id !== "blade") w.mag -= 1;
  w.cooldown = fireInterval(w.id);
  w.state = "firing";
  w.recoil = applyShotRecoil(w.recoil, WEAPONS[w.id]);
  if (weaponDef(w.id).unscopeOnShot) w.scoped = false;
  if (w.mag === 0 && w.id !== "blade") {
    beginReload(w);
  } else {
    w.state = "idle";
  }
  return true;
}

export function toggleScope(w: WeaponInstance): boolean {
  if (!WEAPONS[w.id].canScope) return false;
  if (w.state === "reloading") return false;
  w.scoped = !w.scoped;
  return true;
}

export function refillFromBuy(w: WeaponInstance): void {
  const def = WEAPONS[w.id];
  w.mag = def.magSize;
  w.reserve = def.reserve;
  w.state = "idle";
  w.reloadLeft = 0;
  w.cooldown = 0;
}
