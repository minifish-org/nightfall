import { describe, expect, it } from "vitest";
import { createGame } from "./setup.js";
import { viewFor } from "./projection.js";
import { reduce } from "./phases.js";
import type { Decision, GameState } from "./types.js";

const seatRole = (s: GameState, role: string) => s.seats.filter((x) => x.role === role).map((x) => x.seat);

describe("viewFor — information hiding (the security boundary)", () => {
  it("wolf views carry private.teammates; villager & seer views do NOT", () => {
    const state = createGame(7);
    const wolves = seatRole(state, "wolf");

    for (const s of state.seats) {
      const view = viewFor(state, s.seat);
      if (s.role === "wolf") {
        expect(view.private).toHaveProperty("teammates");
        const teammates = (view.private as { teammates: number[] }).teammates;
        // Teammates = the OTHER wolves, never yourself.
        expect(teammates).not.toContain(s.seat);
        expect([...teammates, s.seat].sort()).toEqual([...wolves].sort());
      } else {
        expect(view.private).not.toHaveProperty("teammates");
        expect(JSON.stringify(view)).not.toContain("teammates");
      }
    }
  });

  it("only the seer's view carries private.checks", () => {
    let state = createGame(7);
    const seer = seatRole(state, "seer")[0]!;
    const wolf = seatRole(state, "wolf")[0]!;
    // Plant a check into authoritative state.
    state = { ...state, seerChecks: { [seer]: [{ day: 1, seat: wolf, result: "wolf" }] } };

    for (const s of state.seats) {
      const view = viewFor(state, s.seat);
      if (s.role === "seer") {
        expect(view.private).toHaveProperty("checks");
        expect((view.private as { checks: unknown[] }).checks).toHaveLength(1);
      } else {
        expect(view.private).not.toHaveProperty("checks");
        expect(JSON.stringify(view)).not.toContain("checks");
        expect(JSON.stringify(view)).not.toContain("result");
      }
    }
  });

  it("never leaks another seat's role, and public_log is role-free", () => {
    // Play a couple of phases so public_log has speeches/deaths.
    let state = createGame(7);
    const seer = seatRole(state, "seer")[0]!;
    const wolves = seatRole(state, "wolf");
    const victim = state.seats.find((s) => s.role === "villager")!.seat;
    state = reduce(state, new Map([[seer, dec("check", victim)]])).state; // night_seer
    state = reduce(state, new Map(wolves.map((w) => [w, dec("kill", victim)]))).state; // night_wolf

    for (const s of state.seats) {
      const view = viewFor(state, s.seat);
      // The only place a role may appear is `you.role`.
      expect(view.you.role).toBe(s.role);
      const withoutYou = { ...view, you: undefined };
      expect(JSON.stringify(withoutYou)).not.toMatch(/"role"\s*:/);
      // Full seats[] / seerChecks structures are never projected.
      expect((view as unknown as Record<string, unknown>).seats).toBeUndefined();
      expect((view as unknown as Record<string, unknown>).seerChecks).toBeUndefined();
    }
  });

  it("holds across many seeds for every role", () => {
    for (let seed = 0; seed < 60; seed++) {
      const state = createGame(seed);
      for (const s of state.seats) {
        const view = viewFor(state, s.seat);
        if (s.role !== "wolf") expect(view.private).not.toHaveProperty("teammates");
        if (s.role !== "seer") expect(view.private).not.toHaveProperty("checks");
        if (s.role === "villager") expect(view.private).toEqual({});
      }
    }
  });

  it("exposes board composition (setup) without revealing who has which role", () => {
    const state = createGame(7);
    for (const s of state.seats) {
      const view = viewFor(state, s.seat);
      // Counts only — exact shape, no seat→role mapping.
      expect(view.setup).toEqual({ seats: 6, wolves: 2, seers: 1, villagers: 3 });
    }
  });

  it("ctx.speeches: a later speaker sees earlier speakers' speeches this round", () => {
    let state = createGame(7);
    // advance to day_discuss (seer checks, wolves skip)
    state = reduce(state, new Map([[seatRole(state, "seer")[0]!, dec("check", null)]])).state;
    state = reduce(state, new Map()).state; // night_wolf, no kill -> day_discuss
    expect(state.phase).toBe("day_discuss");

    const me = state.seats.find((s) => s.alive)!.seat;
    const earlier = [{ seat: 99, say: "我怀疑 2 号" }];
    const withCtx = viewFor(state, me, { speeches: earlier });
    const withoutCtx = viewFor(state, me);
    expect(withCtx.public_log.length).toBe(withoutCtx.public_log.length + 1);
    expect(withCtx.public_log.at(-1)).toMatchObject({ type: "speech", seat: 99, say: "我怀疑 2 号" });
  });

  it("ctx.wolfIntents: wolves see teammates' proposals; non-wolves never do", () => {
    let state = createGame(7);
    state = reduce(state, new Map([[seatRole(state, "seer")[0]!, dec("check", null)]])).state; // night_wolf
    const wolves = seatRole(state, "wolf");
    const intents = wolves.map((w) => ({ seat: w, target: 1 }));

    const wolfView = viewFor(state, wolves[0]!, { wolfIntents: intents });
    const ti = (wolfView.private as { teammate_intents?: { seat: number }[] }).teammate_intents;
    expect(ti).toBeDefined();
    // sees teammates' intents, not its own
    expect(ti!.every((i) => i.seat !== wolves[0]!)).toBe(true);

    // A non-wolf must never get teammate_intents, even if ctx is (wrongly) passed.
    const nonWolf = state.seats.find((s) => s.role !== "wolf")!.seat;
    const nv = viewFor(state, nonWolf, { wolfIntents: intents });
    expect(JSON.stringify(nv)).not.toContain("teammate_intents");
    expect(nv.private).not.toHaveProperty("teammate_intents");
  });

  it("valid_targets never includes self, and wolf night targets exclude wolves", () => {
    const state = createGame(7); // phase night_seer
    const seer = seatRole(state, "seer")[0]!;
    expect(viewFor(state, seer).valid_targets).not.toContain(seer);

    const nightWolf = reduce(state, new Map([[seer, dec("check", null)]])).state;
    const wolves = seatRole(nightWolf, "wolf");
    const wolfView = viewFor(nightWolf, wolves[0]!);
    for (const w of wolves) expect(wolfView.valid_targets).not.toContain(w);
  });
});

function dec(action: Decision["action"], target: number | null): Decision {
  return { action, target, say: "", reason: "" };
}
