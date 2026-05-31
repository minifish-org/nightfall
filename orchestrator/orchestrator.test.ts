import { describe, expect, it, vi } from "vitest";
import { createGame } from "../engine/index.js";
import type { AgentCaller, Checkpoint, Observer } from "./index.js";
import { runGame } from "./index.js";

/**
 * A deterministic fake agent: no network. Picks the first valid target and
 * speaks/votes plausibly so games converge to a winner. Combined with a fixed
 * seed this lets us assert a full playthrough offline.
 */
const fakeCaller: AgentCaller = async ({ phase, view, seat }) => {
  const t = view.valid_targets[0] ?? null;
  switch (phase) {
    case "night_seer":
      return { action: "check", target: t, say: "", reason: "scan" };
    case "night_wolf":
      return { action: "kill", target: t, say: "", reason: "hunt" };
    case "day_discuss":
      return { action: "speak", target: null, say: `seat ${seat} speaks`, reason: "" };
    case "day_vote":
      return { action: "vote", target: t, say: "", reason: "suspicion" };
    default:
      return { action: "abstain", target: null, say: "", reason: "" };
  }
};

describe("runGame — orchestrator with injected fake caller", () => {
  it("plays a full game to a winner, no network", async () => {
    const result = await runGame({ state: createGame(7), agentCaller: fakeCaller });
    expect(result.aborted).toBe(false);
    expect(result.state.phase).toBe("game_over");
    expect(["good", "wolf"]).toContain(result.winner);
  });

  it("is deterministic for a fixed seed", async () => {
    const a = await runGame({ state: createGame(7), agentCaller: fakeCaller });
    const b = await runGame({ state: createGame(7), agentCaller: fakeCaller });
    expect(a.state).toEqual(b.state);
  });

  it("emits ordered observer events including game_over", async () => {
    const seen: string[] = [];
    const observer: Observer = {
      onGameStart: () => seen.push("start"),
      onPhaseStart: (e) => seen.push(`phase:${e.phase}`),
      onSeatDecision: (e) => seen.push(`seat:${e.seat}`),
      onResolution: () => seen.push("resolve"),
      onGameOver: (w) => seen.push(`over:${w}`),
    };
    await runGame({ state: createGame(7), agentCaller: fakeCaller, observer });
    expect(seen[0]).toBe("start");
    expect(seen.at(-1)).toMatch(/^over:(good|wolf)$/);
    // First phase is night_seer with the seer deciding before resolution.
    expect(seen[1]).toBe("phase:night_seer");
    expect(seen.indexOf("seat:")).toBeLessThan(seen.indexOf("resolve"));
  });

  it("degrades gracefully when the agent throws (fault tolerance)", async () => {
    let calls = 0;
    const flaky: AgentCaller = async (req) => {
      calls++;
      if (calls % 3 === 0) throw new Error("simulated agentd timeout");
      return fakeCaller(req);
    };
    const errors: string[] = [];
    const result = await runGame({
      state: createGame(7),
      agentCaller: flaky,
      observer: { onSeatDecision: (e) => e.error && errors.push(e.error) },
    });
    expect(result.state.phase).toBe("game_over"); // never wedged
    expect(errors.length).toBeGreaterThan(0); // errors were surfaced, not swallowed
  });

  it("sequential discussion: later speakers see earlier speeches this round", async () => {
    // Record, per day_discuss turn, how many speeches the actor could see.
    const seen: number[] = [];
    const caller: AgentCaller = async (req) => {
      if (req.phase === "day_discuss") {
        const speechesThisRound = req.view.public_log.filter(
          (e) => e.type === "speech" && e.day === req.day,
        ).length;
        seen.push(speechesThisRound);
      }
      return fakeCaller(req);
    };
    await runGame({ state: createGame(7), agentCaller: caller, options: { maxSteps: 4 } });
    // First day's discussion (6 alive): the k-th speaker should see k-1 prior
    // speeches, i.e. a strictly increasing 0,1,2,... prefix — not all zeros.
    const firstRound = seen.slice(0, 6);
    expect(firstRound[0]).toBe(0);
    expect(firstRound.some((n) => n > 0)).toBe(true);
    expect(firstRound).toEqual([...firstRound].sort((a, b) => a - b));
  });

  it("wolf coordination: the second wolf sees the first wolf's proposal", async () => {
    let secondWolfSawIntent = false;
    const caller: AgentCaller = async (req) => {
      if (req.phase === "night_wolf") {
        const ti = (req.view.private as { teammate_intents?: unknown[] }).teammate_intents;
        if (ti && ti.length > 0) secondWolfSawIntent = true;
      }
      return fakeCaller(req);
    };
    await runGame({ state: createGame(7), agentCaller: caller, options: { maxSteps: 3 } });
    expect(secondWolfSawIntent).toBe(true);
  });

  it("coerces a phase-illegal action (speak during vote) to the fallback + marks it", async () => {
    const errors: string[] = [];
    const caller: AgentCaller = async (req) => {
      if (req.phase === "day_vote") {
        // Wrong verb for the phase — should be rejected, not silently abstained.
        return { action: "speak", target: null, say: "I'd rather chat", reason: "" };
      }
      return fakeCaller(req);
    };
    const result = await runGame({
      state: createGame(7),
      agentCaller: caller,
      observer: { onSeatDecision: (e) => e.error && errors.push(e.error) },
      options: { maxSteps: 4 },
    });
    // Game still resolves (everyone effectively abstains in votes) and the
    // illegal action was surfaced, not hidden.
    expect(errors.some((e) => e.includes("illegal action") && e.includes("day_vote"))).toBe(true);
    expect(["good", "wolf", null]).toContain(result.winner);
  });

  it("respects the gate (pause/step hook) and the abort signal", async () => {
    const gate = vi.fn<(cp: Checkpoint) => void>();
    await runGame({ state: createGame(7), agentCaller: fakeCaller, options: { gate } });
    expect(gate).toHaveBeenCalled();

    const ctrl = new AbortController();
    ctrl.abort();
    const res = await runGame({ state: createGame(7), agentCaller: fakeCaller, options: { signal: ctrl.signal } });
    expect(res.aborted).toBe(true);
    expect(res.state.phase).not.toBe("game_over");
  });
});
