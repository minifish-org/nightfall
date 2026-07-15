// Core domain types for the referee. No DOM, no network — pure data.
//
// These types ARE the contract from docs/design.md §2. The view shape and the
// decision shape here are what flow over agentd (as payload / the returned
// output); agentd only passes them through.

export type Role = "wolf" | "seer" | "villager";
/** Good = town. Seer check results and victory are expressed in factions. */
export type Faction = "good" | "wolf";

export const FACTION_OF: Record<Role, Faction> = {
  wolf: "wolf",
  seer: "good",
  villager: "good",
};

/**
 * The phase FSM. A round is night_seer → night_wolf → day_discuss → day_vote.
 * `last_words` is a transient one-seat step the just-died player speaks in, when
 * eligible (首夜被刀 or any banish), before the FSM resumes.
 */
export type Phase = "night_seer" | "night_wolf" | "day_discuss" | "day_vote" | "last_words" | "game_over";

/** Phases in which a death can be resolved. */
export type DeathPhase = "night_wolf" | "day_vote";

/** The five — and only five — action verbs a seat may emit. */
export type Action = "check" | "kill" | "speak" | "vote" | "abstain";

/** A seat's decision, returned as the agent's final JSON object. */
export interface Decision {
  action: Action;
  target: number | null;
  say: string;
  reason: string;
}

/** The seer's private knowledge: one entry per night investigated. */
export interface SeerCheck {
  day: number;
  seat: number;
  result: Faction;
}

/**
 * Public, broadcast-to-everyone events. These NEVER carry a role
 * (role_revealed is always null — no reveal on death this milestone). The
 * projection layer relies on this to ship public_log to any seat safely.
 */
export type PublicEntry =
  | { type: "speech"; day: number; phase: Phase; seat: number; say: string }
  | { type: "vote"; day: number; phase: Phase; seat: number; target: number | null }
  | {
      type: "death";
      day: number;
      phase: DeathPhase;
      seat: number;
      cause: "night" | "vote";
      role_revealed: null;
    }
  | { type: "lastwords"; day: number; seat: number; say: string };

export interface SeatState {
  /** 1-based seat number, stable for the whole game. */
  seat: number;
  role: Role;
  alive: boolean;
  /** Phase of death, or null while alive. */
  diedPhase: DeathPhase | null;
  diedDay: number | null;
}

export interface GameState {
  game_id: string;
  seed: number;
  /** Resumable PRNG cursor — persist to replay deterministically. */
  rngState: number;
  day: number;
  phase: Phase;
  seats: SeatState[];
  publicLog: PublicEntry[];
  /** seer seat number -> its private check history. Authority-only. */
  seerChecks: Record<number, SeerCheck[]>;
  /**
   * Set while phase === "last_words": who speaks their last words, and where the
   * FSM resumes after. Null otherwise.
   */
  pendingLastWords: { seat: number; resumePhase: Phase; resumeDay: number } | null;
  winner: Faction | null;
}

// ── The view (referee → seat). The ONLY thing a seat ever sees. ──────────────

export type SeerPrivate = { checks: SeerCheck[] };
/** Wolves know teammates; during night_wolf they also see teammates' proposed
 *  kills this round (transient, never stored in authoritative state). */
export type WolfPrivate = {
  teammates: number[];
  teammate_intents?: { seat: number; target: number | null }[];
};
export type EmptyPrivate = Record<string, never>;
export type PrivateView = SeerPrivate | WolfPrivate | EmptyPrivate;

export interface SeatView {
  phase: Phase;
  game_id: string;
  day: number;
  you: { seat: number; role: Role };
  /**
   * Public board composition — COUNTS ONLY (who has which role stays hidden).
   * Keys are pluralized ("wolves: 2" = two wolves) so they can't be misread as
   * a seat number the way `{ wolf: 2 }` could.
   */
  setup: { seats: number; wolves: number; seers: number; villagers: number };
  alive_seats: number[];
  dead_seats: { seat: number; phase: DeathPhase }[];
  public_log: PublicEntry[];
  private: PrivateView;
  valid_targets: number[];
}

/**
 * Transient, this-turn context the orchestrator threads into viewFor so an
 * actor can see what others did EARLIER in the same phase — sequential
 * discussion and wolf night coordination. None of this is stored in GameState;
 * `reduce` remains the sole authority and re-derives everything from decisions.
 */
export interface TurnContext {
  /** Day-discussion speeches already made this round (seat-ordered). */
  speeches?: { seat: number; say: string }[];
  /** Wolf kill proposals already made this night (seat-ordered). */
  wolfIntents?: { seat: number; target: number | null }[];
}

// ── Resolution events returned by reduce(), for transcript / UI (god-view). ──

export type ResolutionEvent =
  | { type: "seer_check"; seat: number; target: number; result: Faction }
  | {
      type: "night_kill";
      victim: number | null;
      proposals: { seat: number; target: number | null }[];
      tie: boolean;
    }
  | {
      type: "banish";
      victim: number | null;
      tally: Record<number, number>;
      abstains: number;
      tie: boolean;
    }
  | { type: "death"; seat: number; phase: DeathPhase; cause: "night" | "vote" }
  | { type: "phase_advance"; from: Phase; to: Phase; day: number }
  | { type: "game_over"; winner: Faction };
