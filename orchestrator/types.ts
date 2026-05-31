import type {
  Decision,
  Faction,
  GameState,
  Phase,
  ResolutionEvent,
  Role,
  SeatView,
} from "../engine/index.js";

/** What the orchestrator asks a seat. The view is the PROJECTED view only. */
export interface AgentRequest {
  phase: Phase;
  day: number;
  seat: number;
  role: Role;
  view: SeatView;
}

/**
 * The single network seam. Node and browser both inject one of these; the
 * orchestrator itself never touches fetch. May throw (→ orchestrator degrades
 * to a fallback decision and marks the step as errored).
 */
export type AgentCaller = (req: AgentRequest) => Promise<Decision>;

export interface PhaseStartEvent {
  phase: Phase;
  day: number;
  actors: number[];
}

export interface SeatDecisionEvent {
  phase: Phase;
  day: number;
  seat: number;
  role: Role;
  view: SeatView;
  decision: Decision;
  /** Present when the agent failed/timed out/returned junk and we fell back. */
  error?: string;
}

export interface ResolutionBatch {
  phase: Phase;
  day: number;
  events: ResolutionEvent[];
}

/**
 * Observer callbacks. Every callback also receives the current authoritative
 * GameState (the spectator god-view) — distinct from the projected views sent
 * to agentd. onResolution / onGameOver receive the state AFTER the step.
 */
export interface Observer {
  onGameStart?(state: GameState): void;
  onPhaseStart?(e: PhaseStartEvent, state: GameState): void;
  onSeatDecision?(e: SeatDecisionEvent, state: GameState): void;
  onResolution?(e: ResolutionBatch, state: GameState): void;
  onGameOver?(winner: Faction, state: GameState): void;
}

/** A pause point; the host resolves the gate to let the orchestrator proceed. */
export type Checkpoint =
  | { kind: "phase"; phase: Phase; day: number }
  | { kind: "seat"; phase: Phase; day: number; seat: number };

export interface RunOptions {
  /** Safety stop on phase count (default 500). */
  maxSteps?: number;
  /** Awaited at each step boundary — implement pause / single-step / throttle. */
  gate?: (cp: Checkpoint) => void | Promise<void>;
  /** Abort the run between steps. */
  signal?: AbortSignal;
}

export interface RunInput {
  state: GameState;
  agentCaller: AgentCaller;
  observer?: Observer;
  options?: RunOptions;
}

export interface GameResult {
  winner: Faction | null;
  state: GameState;
  aborted: boolean;
}
