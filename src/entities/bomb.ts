import { ROUND } from "../config";
import type { Vec3 } from "../core/math";
import type { Player } from "./player";

export type BombState = "carried" | "dropping" | "idle" | "planting" | "planted" | "defusing" | "exploded" | "defused";

export interface Bomb {
  state: BombState;
  carrierId: number | null;
  position: Vec3;
  site: "A" | "B" | null;
  plantProgress: number;
  fuseLeft: number;
  defuseProgress: number;
}

export function createBomb(carrierId: number, position: Vec3): Bomb {
  return {
    state: "carried",
    carrierId,
    position: { ...position },
    site: null,
    plantProgress: 0,
    fuseLeft: ROUND.bombTime,
    defuseProgress: 0,
  };
}

export function bombWorldPos(bomb: Bomb, players: Player[]): Vec3 {
  if (bomb.state === "carried" && bomb.carrierId !== null) {
    const c = players.find((p) => p.id === bomb.carrierId && p.alive);
    if (c) return { x: c.body.position.x, y: c.body.position.y + 20, z: c.body.position.z };
  }
  return bomb.position;
}

export function dropBomb(bomb: Bomb, position: Vec3): void {
  if (bomb.state !== "carried" && bomb.state !== "planting") return;
  bomb.state = "dropping";
  bomb.carrierId = null;
  bomb.position = { x: position.x, y: 2, z: position.z };
}

export function settleDroppedBomb(bomb: Bomb): void {
  if (bomb.state === "dropping") bomb.state = "idle";
}

export function tryPickupBomb(
  bomb: Bomb,
  player: { id: number; alive: boolean; team: string; body: { position: Vec3 } },
  radius = 40,
): boolean {
  if (bomb.state !== "idle" || !player.alive || player.team !== "t") return false;
  const d = Math.hypot(player.body.position.x - bomb.position.x, player.body.position.z - bomb.position.z);
  if (d >= radius) return false;
  bomb.state = "carried";
  bomb.carrierId = player.id;
  return true;
}

/** Prefer a T bot so the local player is not stuck as the only planter. */
export function chooseBombCarrier<T extends { kind: string }>(terrorists: T[]): T | undefined {
  return terrorists.find((p) => p.kind === "bot") ?? terrorists[0];
}

export interface UseActionInput {
  canPlant: boolean;
  canDefuse: boolean;
  plantHeld: number;
  defuseHeld: number;
  plantTime: number;
  defuseTime: number;
  defuseTimeWithKit: number;
  hasKit: boolean;
}

/** Prompt is shown whenever the local player can plant or defuse, including before progress starts. */
export function useActionPrompt(input: UseActionInput): { label: string; progress: number } | null {
  if (input.canPlant) {
    return {
      label: input.plantHeld > 0 ? "安放炸弹" : "按住 E 安放炸弹",
      progress: input.plantTime > 0 ? input.plantHeld / input.plantTime : 0,
    };
  }
  if (input.canDefuse) {
    const need = input.hasKit ? input.defuseTimeWithKit : input.defuseTime;
    const started = input.defuseHeld > 0;
    return {
      label: started
        ? input.hasKit
          ? "拆除（拆弹钳）"
          : "拆除炸弹"
        : input.hasKit
          ? "按住 E 拆除（拆弹钳）"
          : "按住 E 拆除炸弹",
      progress: need > 0 ? input.defuseHeld / need : 0,
    };
  }
  return null;
}
