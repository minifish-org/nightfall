import type { Faction, GameState } from "./types.js";

/**
 * Win condition, checked after every death — "屠民" (kill the villager side):
 *  - wolves = 0        → good wins
 *  - all villagers dead → wolves win
 *  - otherwise null (continue)
 *
 * Killing the seer no longer ends the game (it only costs good its information);
 * wolves must eliminate all 3 villagers (by night kill or day banish) while
 * keeping at least one wolf alive. Good wins only by voting out both wolves.
 */
export function checkVictory(state: GameState): Faction | null {
  const alive = state.seats.filter((s) => s.alive);
  const wolves = alive.filter((s) => s.role === "wolf").length;
  if (wolves === 0) return "good";

  const villagers = alive.filter((s) => s.role === "villager").length;
  if (villagers === 0) return "wolf";

  return null;
}
