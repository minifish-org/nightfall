import type { Faction, GameState } from "./types.js";

/**
 * Win condition, checked after every death — "屠边" (slaughter-one-side):
 *  - wolves = 0                          → good wins
 *  - all villagers dead OR all gods dead → wolves win
 *  - otherwise null (continue)
 *
 * On this board the only god is the seer, so killing the seer ends the game in
 * a wolf win (屠神边); wiping the 3 villagers does too (屠民边). Good wins only
 * by eliminating both wolves.
 */
export function checkVictory(state: GameState): Faction | null {
  const alive = state.seats.filter((s) => s.alive);
  const wolves = alive.filter((s) => s.role === "wolf").length;
  if (wolves === 0) return "good";

  const villagers = alive.filter((s) => s.role === "villager").length;
  const gods = alive.filter((s) => s.role === "seer").length;
  if (villagers === 0 || gods === 0) return "wolf";

  return null;
}
