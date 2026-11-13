export type Team = "t" | "ct";

export function otherTeam(team: Team): Team {
  return team === "t" ? "ct" : "t";
}

export function teamName(team: Team): string {
  return team === "t" ? "ATK" : "DEF";
}

export function teamColor(team: Team): number {
  return team === "t" ? 0xc56a2d : 0x3a7ca5;
}

/** T is south of mid and must face +Z (yaw = π); CT is north and faces −Z (yaw = 0). */
export function spawnYaw(team: Team): number {
  return team === "t" ? Math.PI : 0;
}

/** Bot callsigns. "You" is reserved for the local player and is never given to a bot. */
export const T_BOT_NAMES = ["Ash", "Reed", "Cole"] as const;
export const CT_BOT_NAMES = ["Hale", "Voss", "Pike"] as const;

/** Unique names for every player in a match (safer than uniqueness only within a team). */
export function matchRosterNames(localTeam: Team, teamSize = 3): { t: string[]; ct: string[] } {
  const size = Math.max(1, teamSize);
  const t = localTeam === "t"
    ? ["You", ...T_BOT_NAMES.slice(0, size - 1)]
    : [...T_BOT_NAMES.slice(0, size)];
  const ct = localTeam === "ct"
    ? ["You", ...CT_BOT_NAMES.slice(0, size - 1)]
    : [...CT_BOT_NAMES.slice(0, size)];
  return { t, ct };
}
