import type { Role } from "./types.js";

/**
 * A seat's "brain" is the agentd agent_ref selected by its role. The same
 * generic wasm is registered three times with different personas — see
 * agents/*.toml. A seat's identity is (agent_ref, scope) where
 * scope = game/<gameId>/seat/<n>.
 */
export const ROLE_AGENT_REF: Record<Role, string> = {
  wolf: "werewolf-wolf",
  seer: "werewolf-seer",
  villager: "werewolf-villager",
};

export function roleAgentRef(role: Role, pool: Partial<Record<Role, string>> = {}): string {
  return pool[role] ?? ROLE_AGENT_REF[role];
}

/** Build the agentd seat scope. */
export function seatScope(gameId: string, seat: number): string {
  return `game/${gameId}/seat/${seat}`;
}
