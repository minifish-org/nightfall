import { describe, expect, it } from "vitest";
import { createGame } from "./setup.js";
import { currentActors, reduce, validTargets as validTargetsFor } from "./phases.js";
import type { Decision, GameState } from "./types.js";

/**
 * Deterministic replay: a game is a pure function of (seed, decision sequence).
 * We record one playthrough's decisions, then replay them from a fresh game with
 * the same seed and assert the end state is bit-identical — including all
 * RNG-driven tie-breaks (the cursor lives in GameState.rngState).
 */
function fixedCaller() {
  // A deterministic pseudo-agent: picks a valid target varying by seat+day so
  // games actually progress to a winner.
  return (state: GameState, seat: number): Decision => {
    const valid = currentActors(state).includes(seat) ? validTargetsFor(state, seat) : [];
    const pick = valid.length ? valid[(seat + state.day) % valid.length]! : null;
    switch (state.phase) {
      case "night_seer":
        return { action: "check", target: pick, say: "", reason: "" };
      case "night_wolf":
        return { action: "kill", target: pick, say: "", reason: "" };
      case "day_discuss":
        return { action: "speak", target: null, say: `seat ${seat} on day ${state.day}`, reason: "" };
      case "day_vote":
        return { action: "vote", target: pick, say: "", reason: "" };
      default:
        return { action: "abstain", target: null, say: "", reason: "" };
    }
  };
}

function play(seed: number): { final: GameState; log: Map<number, Decision>[] } {
  let state = createGame(seed);
  const caller = fixedCaller();
  const log: Map<number, Decision>[] = [];
  let guard = 0;
  while (state.phase !== "game_over" && guard++ < 500) {
    const decisions = new Map<number, Decision>();
    for (const seat of currentActors(state)) decisions.set(seat, caller(state, seat));
    log.push(decisions);
    state = reduce(state, decisions).state;
  }
  return { final: state, log };
}

describe("deterministic replay", () => {
  it("same seed + same decisions => identical terminal state", () => {
    const a = play(7);
    const b = play(7);
    expect(a.final).toEqual(b.final);
    expect(a.final.phase).toBe("game_over");
    expect(a.final.winner).not.toBeNull();
  });

  it("a recorded decision log replays to the same end state", () => {
    const { final, log } = play(7);
    let state = createGame(7);
    for (const decisions of log) state = reduce(state, decisions).state;
    expect(state).toEqual(final);
  });

  it("several seeds all terminate with a winner", () => {
    for (const seed of [1, 2, 3, 11, 99, 12345]) {
      const { final } = play(seed);
      expect(final.phase).toBe("game_over");
      expect(["good", "wolf"]).toContain(final.winner);
    }
  });
});
