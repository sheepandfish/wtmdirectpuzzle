import {
  createFireGate,
  fireGateArmLockClick,
  fireGateEndTick,
  fireGateLockChange,
  fireGateMouseDown,
  fireGateMouseUp,
  fireGated,
  type FireGateState,
} from "./command";

export class Input {
  readonly keys = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  fire = false;
  firePressed = false;
  aimPressed = false;
  buyPressed = false;
  useDown = false;
  reloadPressed = false;
  jumpPressed = false;
  slotPressed: number | null = null;
  dropPressed = false;
  throwFlashPressed = false;
  throwSmokePressed = false;
  pointerLocked = false;
  private canvas: HTMLCanvasElement | null = null;
  private gate: FireGateState = createFireGate();

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onLock);
    canvas.addEventListener("click", this.requestLock);
  }

  detach(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onLock);
    this.canvas?.removeEventListener("click", this.requestLock);
  }

  /** Take pending mouse deltas so look can be applied every display frame. */
  consumeMouse(): { dx: number; dy: number } {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  /** Call at the end of each logic tick so "pressed this tick" flags reset. */
  endTick(): void {
    this.gate = fireGateEndTick(this.gate);
    this.syncGate();
    this.aimPressed = false;
    this.buyPressed = false;
    this.reloadPressed = false;
    this.jumpPressed = false;
    this.slotPressed = null;
    this.dropPressed = false;
    this.throwFlashPressed = false;
    this.throwSmokePressed = false;
  }

  snapshot(): {
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
  } {
    const gated = fireGated(this.gate);
    return {
      moveForward: this.moveForward,
      moveRight: this.moveRight,
      walking: this.walking,
      crouching: this.crouching,
      jumping: this.jumpPressed,
      fire: gated.fire,
      firePressed: gated.firePressed,
      aimPressed: this.aimPressed,
      reloadPressed: this.reloadPressed,
      useDown: this.useDown,
      dropPressed: this.dropPressed,
      slotPressed: this.slotPressed,
      throwFlashPressed: this.throwFlashPressed,
      throwSmokePressed: this.throwSmokePressed,
    };
  }

  get scoreboard(): boolean {
    return this.isDown("Tab");
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  get moveForward(): number {
    return (this.isDown("KeyW") ? 1 : 0) - (this.isDown("KeyS") ? 1 : 0);
  }

  get moveRight(): number {
    return (this.isDown("KeyD") ? 1 : 0) - (this.isDown("KeyA") ? 1 : 0);
  }

  get walking(): boolean {
    return this.isDown("ShiftLeft") || this.isDown("ShiftRight");
  }

  get crouching(): boolean {
    return this.isDown("ControlLeft") || this.isDown("ControlRight");
  }

  private syncGate(): void {
    const gated = fireGated(this.gate);
    this.fire = gated.fire;
    this.firePressed = gated.firePressed;
    this.pointerLocked = this.gate.pointerLocked;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat && e.code !== "Space") return;
    if (["Space", "KeyB", "KeyR", "Tab"].includes(e.code)) e.preventDefault();
    this.keys.add(e.code);
    if (e.code === "Space") this.jumpPressed = true;
    if (e.code === "KeyB") this.buyPressed = true;
    if (e.code === "KeyR") this.reloadPressed = true;
    if (e.code === "Digit1") this.slotPressed = 1;
    if (e.code === "Digit2") this.slotPressed = 2;
    if (e.code === "Digit3") this.slotPressed = 3;
    if (e.code === "KeyE") this.useDown = true;
    if (e.code === "KeyG") this.dropPressed = true;
    if (e.code === "KeyF") this.throwFlashPressed = true;
    if (e.code === "KeyC") this.throwSmokePressed = true;
    if (e.code === "Escape" && document.pointerLockElement) {
      document.exitPointerLock();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (e.code === "KeyE") this.useDown = false;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) {
      this.gate = fireGateMouseDown(this.gate);
      this.syncGate();
    }
    if (!this.pointerLocked) return;
    if (e.button === 2) this.aimPressed = true;
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.gate = fireGateMouseUp(this.gate);
      this.syncGate();
    }
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.pointerLocked) return;
    this.mouseDX += e.movementX;
    this.mouseDY += e.movementY;
  };

  private onLock = () => {
    const locked = document.pointerLockElement === this.canvas;
    this.gate = fireGateLockChange(this.gate, locked);
    this.syncGate();
  };

  private requestLock = () => {
    if (!this.canvas || this.gate.pointerLocked) return;
    const canvas = this.canvas;
    this.gate = fireGateArmLockClick(this.gate);
    this.syncGate();
    // Raw mouse deltas (no OS acceleration) feel consistent in an FPS.
    const request = canvas.requestPointerLock.bind(canvas) as (opts?: { unadjustedMovement?: boolean }) => Promise<void> | void;
    try {
      const result = request({ unadjustedMovement: true });
      if (result && typeof result.catch === "function") {
        result.catch(() => canvas.requestPointerLock());
      }
    } catch {
      canvas.requestPointerLock();
    }
  };
}
