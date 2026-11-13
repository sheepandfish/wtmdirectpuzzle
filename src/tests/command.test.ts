import { describe, expect, it } from "vitest";
import {
  commandFromInput,
  createFireGate,
  fireAllowed,
  fireGateArmLockClick,
  fireGateEndTick,
  fireGateLockChange,
  fireGateMouseDown,
  fireGateMouseUp,
  fireGateOnLock,
  fireGated,
  type InputSnapshot,
} from "../core/command";

function snap(over: Partial<InputSnapshot> = {}): InputSnapshot {
  return {
    moveForward: 0,
    moveRight: 0,
    walking: false,
    crouching: false,
    jumping: false,
    fire: false,
    firePressed: false,
    aimPressed: false,
    reloadPressed: false,
    useDown: false,
    dropPressed: false,
    slotPressed: null,
    throwFlashPressed: false,
    throwSmokePressed: false,
    ...over,
  };
}

const ctx = { yaw: 1, maxSpeed: 215, frozen: false, buyOpen: false, automatic: true };

describe("commandFromInput", () => {
  it("maps movement, use, drop and throws onto the shared command", () => {
    const cmd = commandFromInput(
      snap({ moveForward: 1, moveRight: -1, useDown: true, dropPressed: true, throwFlashPressed: true, slotPressed: 2 }),
      ctx,
    );
    expect(cmd.move.forward).toBe(1);
    expect(cmd.move.right).toBe(-1);
    expect(cmd.use).toBe(true);
    expect(cmd.drop).toBe(true);
    expect(cmd.throwFlash).toBe(true);
    expect(cmd.slot).toBe(2);
  });

  it("does not fire while frozen or while the buy menu is open", () => {
    const shooting = snap({ fire: true, firePressed: true });
    expect(commandFromInput(shooting, { ...ctx, frozen: true }).fire).toBe(false);
    expect(commandFromInput(shooting, { ...ctx, buyOpen: true }).fire).toBe(false);
    expect(commandFromInput(shooting, ctx).fire).toBe(true);
  });

  it("uses press edges for semi-auto weapons", () => {
    const held = snap({ fire: true, firePressed: false });
    expect(commandFromInput(held, { ...ctx, automatic: true }).fire).toBe(true);
    expect(commandFromInput(held, { ...ctx, automatic: false }).fire).toBe(false);
  });
});

describe("pointer lock fire gate", () => {
  it("suppresses fire only when the lock-acquiring button is still down", () => {
    expect(fireGateOnLock(true).ignoreUntilMouseUp).toBe(true);
    expect(fireAllowed(true)).toBe(false);
    expect(fireGateOnLock(false).ignoreUntilMouseUp).toBe(false);
    expect(fireAllowed(false)).toBe(true);
  });
});

function ticks(state: ReturnType<typeof createFireGate>, n: number) {
  let s = state;
  for (let i = 0; i < n; i++) s = fireGateEndTick(s);
  return s;
}

describe("pointer lock first-click does not shoot", () => {
  it("does not fire on the canvas click that first acquires the lock", () => {
    let s = createFireGate();
    s = fireGateMouseDown(s);
    expect(fireGated(s).fire).toBe(false);
    expect(fireGated(s).firePressed).toBe(false);
    s = fireGateMouseUp(s);
    s = fireGateArmLockClick(s);
    s = fireGateLockChange(s, true);
    // Browser may dispatch a leftover/ghost mousedown after lock is granted.
    s = fireGateMouseDown(s);
    expect(s.pointerLocked).toBe(true);
    expect(fireGated(s).fire).toBe(false);
    expect(fireGated(s).firePressed).toBe(false);
    s = fireGateMouseUp(s);
    s = ticks(s, 2);
    expect(fireGated(s).fire).toBe(false);
  });

  it("allows a later shot after the lock-click has been released and the gate expires", () => {
    let s = createFireGate();
    s = fireGateMouseDown(s);
    s = fireGateMouseUp(s);
    s = fireGateLockChange(s, true);
    s = fireGateMouseDown(s);
    s = fireGateMouseUp(s);
    s = ticks(s, 2);
    s = fireGateMouseDown(s);
    expect(fireGated(s).fire).toBe(true);
    expect(fireGated(s).firePressed).toBe(true);
  });

  it("suppresses fire when lock is acquired while the button is still down, until mouseup", () => {
    let s = createFireGate();
    s = fireGateMouseDown(s);
    s = fireGateLockChange(s, true);
    expect(s.ignoreUntilMouseUp).toBe(true);
    expect(fireGated(s).fire).toBe(false);
    s = ticks(s, 4);
    // Still held: must not start shooting after the tick window.
    expect(fireGated(s).fire).toBe(false);
    s = fireGateMouseUp(s);
    s = fireGateMouseDown(s);
    expect(fireGated(s).fire).toBe(true);
  });

  it("does not arm the lock-click gate once the pointer is already locked", () => {
    let s = createFireGate();
    s = fireGateLockChange(s, true);
    s = ticks(s, 2);
    s = fireGateArmLockClick(s);
    s = fireGateMouseDown(s);
    expect(fireGated(s).fire).toBe(true);
    expect(fireGated(s).firePressed).toBe(true);
  });

  it("treats Esc re-lock the same as the first lock click", () => {
    let s = createFireGate();
    s = fireGateLockChange(s, true);
    s = ticks(s, 2);
    s = fireGateMouseDown(s);
    expect(fireGated(s).fire).toBe(true);
    s = fireGateMouseUp(s);
    s = fireGateLockChange(s, false);
    s = fireGateMouseDown(s);
    s = fireGateMouseUp(s);
    s = fireGateArmLockClick(s);
    s = fireGateLockChange(s, true);
    s = fireGateMouseDown(s);
    expect(fireGated(s).fire).toBe(false);
    expect(fireGated(s).firePressed).toBe(false);
  });
});
