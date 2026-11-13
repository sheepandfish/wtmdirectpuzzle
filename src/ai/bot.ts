import { BOT, MOUSE_SENSITIVITY, weaponDef } from "../config";
import type { Vec3 } from "../core/math";
import { angleDiff, clamp, yawToOffset } from "../core/math";
import { findPath } from "../map/navgrid";
import type { GameMap } from "../map/types";
import type { Player } from "../entities/player";
import { activeWeapon, eyePosition, switchSlot, tryReload } from "../entities/player";
import { visibleEnemy, distance2d } from "./senses";
import { currentSpreadDeg } from "../weapons/shooting";
import type { PlayerCommand } from "../core/command";
import { emptyCommand } from "../core/command";
import type { SmokeCloud } from "../entities/nades";

export type { PlayerCommand as BotCommand } from "../core/command";

export type BotMode = "patrol" | "encounter" | "combat" | "cover" | "retreat";

export interface BotBrain {
  playerId: number;
  mode: BotMode;
  path: Vec3[];
  pathIndex: number;
  goal: Vec3 | null;
  reaction: number;
  seenId: number | null;
  holdFire: number;
  strafe: number;
  strafeTimer: number;
  sitePref: "A" | "B";
  repathIn: number;
  stuckFor: number;
  stayAt: Vec3 | null;
}

export function createBrain(playerId: number, sitePref: "A" | "B"): BotBrain {
  return {
    playerId,
    mode: "patrol",
    path: [],
    pathIndex: 0,
    goal: null,
    reaction: 0,
    seenId: null,
    holdFire: 0,
    strafe: 1,
    strafeTimer: 0,
    sitePref,
    repathIn: 0,
    stuckFor: 0,
    stayAt: null,
  };
}

export interface WorldView {
  map: GameMap;
  players: Player[];
  bombPos: Vec3;
  bombState: string;
  bombCarrierId: number | null;
  canPlant: boolean;
  canDefuse: boolean;
  frozen: boolean;
  bombLoose: boolean;
  bombFuseLeft: number | null;
  smokes: SmokeCloud[];
}

function lookAt(self: Player, target: Vec3, dt: number, tightness: number, errorDeg: number, rng: () => number): void {
  const eye = eyePosition(self);
  const dx = target.x - eye.x;
  const dy = target.y - eye.y;
  const dz = target.z - eye.z;
  const wantYaw = yawToOffset(dx, dz);
  const horiz = Math.hypot(dx, dz);
  const wantPitch = Math.atan2(dy, horiz);
  const err = ((rng() - 0.5) * 2 * errorDeg * Math.PI) / 180;
  const k = 1 - Math.exp(-tightness * dt);
  self.yaw += angleDiff(self.yaw, wantYaw + err) * k;
  self.pitch += (wantPitch - self.pitch) * k;
  self.pitch = clamp(self.pitch, -1.3, 1.3);
  void MOUSE_SENSITIVITY;
}

function setGoal(map: GameMap, self: Player, brain: BotBrain, goal: Vec3): void {
  brain.goal = goal;
  brain.path = findPath(map, self.body.position, goal);
  brain.pathIndex = 0;
}

function followPath(self: Player, brain: BotBrain): { forward: number; right: number } {
  if (brain.pathIndex >= brain.path.length) return { forward: 0, right: 0 };
  const p = brain.path[brain.pathIndex];
  if (distance2d(self.body.position, p) < 36) {
    brain.pathIndex++;
    if (brain.pathIndex >= brain.path.length) return { forward: 0, right: 0 };
  }
  const n = brain.path[Math.min(brain.pathIndex, brain.path.length - 1)];
  const dx = n.x - self.body.position.x;
  const dz = n.z - self.body.position.z;
  const wantYaw = yawToOffset(dx, dz);
  const f = Math.cos(self.yaw - wantYaw);
  const r = Math.sin(wantYaw - self.yaw);
  if (brain.mode === "patrol") {
    self.yaw += angleDiff(self.yaw, wantYaw) * 0.15;
  }
  return { forward: f, right: r };
}

function siteCenter(map: GameMap, id: "A" | "B"): Vec3 {
  const s = map.sites.find((x) => x.id === id)!;
  return {
    x: (s.aabb.min.x + s.aabb.max.x) / 2,
    y: 0,
    z: (s.aabb.min.z + s.aabb.max.z) / 2,
  };
}

function pickPatrol(map: GameMap, self: Player, brain: BotBrain, view: WorldView): Vec3 {
  if (self.team === "t") {
    if (view.bombLoose) return { ...view.bombPos };
    if (view.bombCarrierId === self.id) return siteCenter(map, brain.sitePref);
    if (view.bombState === "planted" || view.bombState === "defusing") return { ...view.bombPos };
    return siteCenter(map, brain.sitePref);
  }
  if (view.bombState === "planted") return { ...view.bombPos };
  const mid = { x: 0, y: 0, z: self.team === "ct" ? 400 : -400 };
  const options = [siteCenter(map, "A"), siteCenter(map, "B"), mid, ...map.coverPoints];
  return options[Math.floor(Math.abs(Math.sin(self.id * 12.3 + brain.repathIn)) * options.length) % options.length];
}

export function stepBot(
  brain: BotBrain,
  self: Player,
  view: WorldView,
  dt: number,
  rng: () => number,
): PlayerCommand {
  const def0 = weaponDef(activeWeapon(self).id);
  const none = emptyCommand(self.yaw, def0.moveSpeed, view.frozen);
  if (!self.alive || view.frozen) return none;

  const w = activeWeapon(self);
  if (w.mag === 0 && w.reserve > 0) tryReload(self);
  if (!self.inventory.primary && self.inventory.active !== "secondary") switchSlot(self, 2);
  if (self.inventory.primary && self.inventory.active !== "primary") switchSlot(self, 1);

  const enemy = visibleEnemy(view.map, self, view.players, 2400, view.smokes);
  brain.holdFire = Math.max(0, brain.holdFire - dt);
  brain.strafeTimer -= dt;
  brain.repathIn -= dt;

  if (brain.stayAt) {
    if (distance2d(self.body.position, brain.stayAt) < 4) brain.stuckFor += dt;
    else {
      brain.stuckFor = 0;
      brain.stayAt = { ...self.body.position };
    }
  } else {
    brain.stayAt = { ...self.body.position };
  }
  if (
    (brain.mode === "patrol" || brain.mode === "cover" || brain.mode === "retreat") &&
    brain.stuckFor > 1.25 &&
    brain.pathIndex < brain.path.length
  ) {
    brain.pathIndex += 1;
    brain.repathIn = 0;
    brain.stuckFor = 0;
  }

  if (enemy) {
    if (brain.seenId !== enemy.id) {
      brain.seenId = enemy.id;
      brain.reaction = BOT.reactionMin + rng() * (BOT.reactionMax - BOT.reactionMin);
    }
    brain.reaction -= dt;
    const d = distance2d(self.body.position, enemy.body.position);
    if (self.health <= BOT.retreatHealth && d < 600) brain.mode = "retreat";
    else if (d < 900) brain.mode = "combat";
    else brain.mode = "encounter";
  } else {
    brain.seenId = null;
    if (brain.mode === "combat" || brain.mode === "encounter") brain.mode = "patrol";
    if (self.health <= BOT.retreatHealth) brain.mode = "cover";
  }

  if (brain.mode === "patrol" || brain.mode === "cover" || brain.mode === "retreat") {
    if (brain.repathIn <= 0 || brain.pathIndex >= brain.path.length) {
      const goal =
        brain.mode === "retreat" || brain.mode === "cover"
          ? nearestCover(view.map, self)
          : pickPatrol(view.map, self, brain, view);
      setGoal(view.map, self, brain, goal);
      brain.repathIn = 1.4 + rng();
    }
  }

  let forward = 0;
  let right = 0;
  let walking = false;
  let crouching = false;
  let fire = false;
  let use = false;
  const def = weaponDef(activeWeapon(self).id);

  if (enemy && (brain.mode === "combat" || brain.mode === "encounter")) {
    const target = { ...eyePosition(enemy) };
    lookAt(self, target, dt, BOT.aimTrack, BOT.aimErrorDeg, rng);
    if (brain.strafeTimer <= 0) {
      brain.strafe = rng() < 0.5 ? -1 : 1;
      brain.strafeTimer = 0.35 + rng() * 0.5;
    }
    right = brain.strafe;
    forward = brain.mode === "encounter" ? 0.6 : (distance2d(self.body.position, enemy.body.position) > 420 ? 0.4 : -0.15);
    walking = currentSpreadDeg(self) > 3 && def.className === "rifle";
    crouching = def.className === "sniper";
    const scopedWant = def.canScope && !w.scoped;
    if (def.canScope && !w.scoped) none.aimToggle = true;
    void scopedWant;
    if (brain.reaction <= 0 && w.cooldown <= 0 && (w.mag > 0 || w.id === "blade")) {
      fire = true;
    }
  } else {
    const steer = followPath(self, brain);
    forward = steer.forward;
    right = steer.right;
    if (brain.mode === "cover") crouching = true;
  }

  if (self.team === "t" && view.canPlant && view.bombCarrierId === self.id) {
    use = true;
    forward = 0;
    right = 0;
    crouching = true;
  }
  if (self.team === "ct" && view.canDefuse) {
    const urgent = view.bombFuseLeft !== null && view.bombFuseLeft < 5;
    if (!enemy || urgent) {
      use = true;
      forward = 0;
      right = 0;
      crouching = true;
    }
  }

  none.move.forward = clamp(forward, -1, 1);
  none.move.right = clamp(right, -1, 1);
  none.move.yaw = self.yaw;
  none.move.walking = walking;
  none.move.crouching = crouching;
  none.move.maxSpeed = def.scopedSpeed && w.scoped ? def.scopedSpeed : def.moveSpeed;
  none.fire = fire;
  none.use = use;
  none.reload = w.mag <= def.magSize * 0.2 && w.reserve > 0 && !enemy;
  return none;
}

function nearestCover(map: GameMap, self: Player): Vec3 {
  let best = map.coverPoints[0] ?? { x: 0, y: 0, z: 0 };
  let bd = Infinity;
  for (const c of map.coverPoints) {
    const d = distance2d(self.body.position, c);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}
