// Environment-agnostic game driver. Shared verbatim by the Node CLI and the
// browser spectator — neither re-implements the loop. The orchestrator core
// (run.ts) imports only the pure engine; agentd-caller.ts is the optional
// concrete network binding.

export { runGame } from "./run.js";
export { createAgentdCaller } from "./agentd-caller.js";
export type { AgentdCallerConfig } from "./agentd-caller.js";
export type {
  AgentCaller,
  AgentRequest,
  Checkpoint,
  GameResult,
  Observer,
  PhaseStartEvent,
  ResolutionBatch,
  RunInput,
  RunOptions,
  SeatDecisionEvent,
} from "./types.js";
