import type { MoveInput } from "./physics";

export interface PlayerCommand {
  move: MoveInput;
  fire: boolean;
  aimToggle: boolean;
  use: boolean;
  reload: boolean;
  drop: boolean;
  slot: 1 | 2 | 3 | null;
  throwFlash: boolean;
  throwSmoke: boolean;
}

export interface InputSnapshot {
  moveForward: number;
  moveRight: number;
  walking: boolean;
  crouching: boolean;
  jumping: boolean;
  fire: boolean;
  firePressed: boolean;
  aimPressed: boolean;
  reloadPressed: boolean;
  useDown: boolean;
  dropPressed: boolean;
  slotPressed: number | null;
  throwFlashPressed: boolean;
  throwSmokePressed: boolean;
}

export interface CommandContext {
  yaw: number;
  maxSpeed: number;
  frozen: boolean;
  buyOpen: boolean;
  automatic: boolean;
}

export function emptyCommand(yaw: number, maxSpeed: number, frozen: boolean): PlayerCommand {
  return {
    move: {
      forward: 0,
      right: 0,
      yaw,
      jumping: false,
      walking: false,
      crouching: false,
      maxSpeed,
      frozen,
    },
    fire: false,
    aimToggle: false,
    use: false,
    reload: false,
    drop: false,
    slot: null,
    throwFlash: false,
    throwSmoke: false,
  };
}

/** Map a sampled input snapshot to the same command shape bots already produce. */
export function commandFromInput(input: InputSnapshot, ctx: CommandContext): PlayerCommand {
  const cmd = emptyCommand(ctx.yaw, ctx.maxSpeed, ctx.frozen);
  cmd.move.forward = input.moveForward;
  cmd.move.right = input.moveRight;
  cmd.move.walking = input.walking;
  cmd.move.crouching = input.crouching;
  cmd.move.jumping = input.jumping && !ctx.buyOpen;
  if (ctx.buyOpen) {
    return cmd;
  }
  cmd.slot = input.slotPressed === 1 || input.slotPressed === 2 || input.slotPressed === 3
    ? input.slotPressed
    : null;
  cmd.reload = input.reloadPressed;
  cmd.aimToggle = input.aimPressed;
  cmd.use = input.useDown;
  cmd.drop = input.dropPressed;
  cmd.throwFlash = input.throwFlashPressed;
  cmd.throwSmoke = input.throwSmokePressed;
  if (!ctx.frozen) {
    cmd.fire = ctx.automatic ? input.fire : input.firePressed;
  }
  return cmd;
}

/** Pointer-lock fire gate: the click that acquired the lock must not shoot. */

export interface FireGateState {
  fire: boolean;
  firePressed: boolean;
  mouseLeftDown: boolean;
  pointerLocked: boolean;
  ignoreUntilMouseUp: boolean;
  /** Remaining logic ticks that swallow fire after a lock-acquire click. */
  suppressTicks: number;
}

export function createFireGate(): FireGateState {
  return {
    fire: false,
    firePressed: false,
    mouseLeftDown: false,
    pointerLocked: false,
    ignoreUntilMouseUp: false,
    suppressTicks: 0,
  };
}

export function fireGated(state: FireGateState): { fire: boolean; firePressed: boolean } {
  const allowed = state.pointerLocked && !state.ignoreUntilMouseUp && state.suppressTicks <= 0;
  return {
    fire: allowed && state.fire,
    firePressed: allowed && state.firePressed,
  };
}

/** Arm the gate for a click that is (or may be) requesting pointer lock. */
export function fireGateArmLockClick(state: FireGateState): FireGateState {
  if (state.pointerLocked) return state;
  return {
    ...state,
    fire: false,
    firePressed: false,
    ignoreUntilMouseUp: state.mouseLeftDown || state.ignoreUntilMouseUp,
    suppressTicks: Math.max(state.suppressTicks, 2),
  };
}

export function fireGateMouseDown(state: FireGateState): FireGateState {
  const next: FireGateState = { ...state, mouseLeftDown: true };
  if (!next.pointerLocked) {
    return fireGateArmLockClick(next);
  }
  if (next.ignoreUntilMouseUp || next.suppressTicks > 0) return next;
  next.fire = true;
  next.firePressed = true;
  return next;
}

export function fireGateMouseUp(state: FireGateState): FireGateState {
  return { ...state, mouseLeftDown: false, fire: false, ignoreUntilMouseUp: false };
}

export function fireGateLockChange(state: FireGateState, locked: boolean): FireGateState {
  const justLocked = locked && !state.pointerLocked;
  const next: FireGateState = { ...state, pointerLocked: locked };
  if (!locked) {
    next.fire = false;
    next.firePressed = false;
    return next;
  }
  if (justLocked) {
    next.fire = false;
    next.firePressed = false;
    next.ignoreUntilMouseUp = next.mouseLeftDown;
    next.suppressTicks = Math.max(next.suppressTicks, 2);
  }
  return next;
}

export function fireGateEndTick(state: FireGateState): FireGateState {
  const next: FireGateState = { ...state, firePressed: false };
  if (next.suppressTicks > 0) {
    next.fire = false;
    next.suppressTicks -= 1;
  }
  return next;
}

export function fireGateOnLock(buttonDown: boolean): { ignoreUntilMouseUp: boolean } {
  return { ignoreUntilMouseUp: buttonDown };
}

export function fireAllowed(ignoreUntilMouseUp: boolean): boolean {
  return !ignoreUntilMouseUp;
}
