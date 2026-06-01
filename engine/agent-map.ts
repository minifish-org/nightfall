import type { Role } from "./types.js";

/**
 * A seat's "brain" is the agentd agent_ref selected by its role. Those agents
 * (one persona per role, on agentd's built-in generic agent) are defined and
 * registered in the agentd repo — nightfall only chooses which ref a role uses.
 * A seat's identity is (agent_ref, scope) where scope = game/<gameId>/seat/<n>.
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
