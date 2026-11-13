import type { Team } from "../entities/team";

export type Phase = "menu" | "freeze" | "live" | "end" | "matchover";

export interface PhaseState {
  phase: Phase;
  timer: number;
  buyOpen: boolean;
}

export interface PhaseStepInput extends PhaseState {
  pendingMatchOver: boolean;
  roundTime: number;
  buyCloseWarn: number;
}

export interface PhaseStepResult extends PhaseState {
  banner?: string;
  bannerLeft?: number;
  action?: "beginRound" | "matchover";
}

/**
 * Pure freeze / end-phase transitions. Timer is assumed already decremented
 * by dt this tick. Does not use setTimeout or wall-clock time.
 */
export function advancePhase(state: PhaseStepInput): PhaseStepResult {
  if (state.phase === "freeze" && state.timer <= 0) {
    return {
      phase: "live",
      timer: state.roundTime,
      buyOpen: false,
      banner: "交战开始",
      bannerLeft: 1.5,
    };
  }
  if (state.phase === "freeze" && state.timer <= state.buyCloseWarn) {
    return {
      phase: state.phase,
      timer: state.timer,
      buyOpen: state.buyOpen,
      banner: "购买阶段结束",
      bannerLeft: state.timer,
    };
  }
  if (state.phase === "end" && state.timer <= 0) {
    if (state.pendingMatchOver) {
      return { phase: "matchover", timer: 0, buyOpen: false, action: "matchover" };
    }
    return { phase: "end", timer: 0, buyOpen: false, action: "beginRound" };
  }
  return { phase: state.phase, timer: state.timer, buyOpen: state.buyOpen };
}

export function isMatchOver(
  scoreT: number,
  scoreCT: number,
  roundsPlayed: number,
  winScore: number,
  maxRounds: number,
): boolean {
  return scoreT >= winScore || scoreCT >= winScore || roundsPlayed >= maxRounds;
}

/** T spawns south (−Z) and must face mid (+Z); CT spawns north and faces mid (−Z). */
export function spawnYaw(team: Team): number {
  return team === "t" ? Math.PI : 0;
}

/** Simulate a stretch of phase ticks for tests (no wall clock, no timers). */
export function simulatePhaseTicks(
  start: PhaseStepInput,
  seconds: number,
  dt: number,
): PhaseStepResult {
  let state: PhaseStepInput = { ...start };
  let last: PhaseStepResult = { phase: state.phase, timer: state.timer, buyOpen: state.buyOpen };
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    state = { ...state, timer: state.timer - dt };
    last = advancePhase(state);
    if (last.action || last.phase !== state.phase) return last;
    state = {
      ...state,
      phase: last.phase,
      timer: last.timer,
      buyOpen: last.buyOpen,
    };
  }
  return last;
}
