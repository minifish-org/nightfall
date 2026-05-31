import { roleDeck, STANDARD_6 } from "./board.js";
import { makeRng } from "./rng.js";
import type { GameState, SeatState } from "./types.js";

/**
 * Build a fresh game. Deterministic: the same (seed) always deals the same
 * roles, so games are reproducible and replayable. `gameId` defaults to
 * `g<seed>` and feeds the agentd seat scope (game/<gameId>/seat/<n>).
 */
export function createGame(seed: number, gameId = `g${seed}`): GameState {
  const rng = makeRng(seed);
  const roles = rng.shuffle(roleDeck());

  const seats: SeatState[] = roles.map((role, i) => ({
    seat: i + 1,
    role,
    alive: true,
    diedPhase: null,
    diedDay: null,
  }));

  return {
    game_id: gameId,
    seed,
    rngState: rng.state(),
    day: 1,
    phase: "night_seer",
    seats,
    publicLog: [],
    seerChecks: {},
    winner: null,
  };
}

export { STANDARD_6 };
