import type { Role } from "./types.js";

/**
 * Locked board for this milestone (see /goal): 6 seats, 2 wolves + 1 seer +
 * 3 villagers, no role reveal on death. Witch / guard / hunter are future work.
 */
export const STANDARD_6 = {
  name: "6p-standard",
  seats: 6,
  roles: { wolf: 2, seer: 1, villager: 3 } as Record<Role, number>,
} as const;

/** Flat, ordered role list for the board (pre-shuffle). */
export function roleDeck(): Role[] {
  const deck: Role[] = [];
  for (const [role, count] of Object.entries(STANDARD_6.roles) as [Role, number][]) {
    for (let i = 0; i < count; i++) deck.push(role);
  }
  return deck;
}
