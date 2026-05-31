// Public surface of the referee engine.
//
// Framework-free: no DOM, no fetch, no globals. The single authority over game
// state and the only place the full hidden state exists. The Node CLI, the
// orchestrator, and the browser referee all consume it unchanged.

export * from "./types.js";
export { STANDARD_6, roleDeck } from "./board.js";
export { makeRng } from "./rng.js";
export type { Rng } from "./rng.js";
export { createGame } from "./setup.js";
export { viewFor } from "./projection.js";
export { currentActors, validTargets, reduce, fallbackDecision, legalActions } from "./phases.js";
export { checkVictory } from "./victory.js";
export { ROLE_AGENT_REF, roleAgentRef, seatScope } from "./agent-map.js";
