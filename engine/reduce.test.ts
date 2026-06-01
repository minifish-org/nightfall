import { describe, expect, it } from "vitest";
import { createGame } from "./setup.js";
import { currentActors, reduce } from "./phases.js";
import { checkVictory } from "./victory.js";
import type { Decision, GameState, ResolutionEvent } from "./types.js";

const dec = (action: Decision["action"], target: number | null = null, say = ""): Decision => ({
  action,
  target,
  say,
  reason: "",
});
const roleSeats = (s: GameState, r: string) => s.seats.filter((x) => x.role === r).map((x) => x.seat);
const ev = <T extends ResolutionEvent["type"]>(events: ResolutionEvent[], t: T) =>
  events.find((e) => e.type === t) as Extract<ResolutionEvent, { type: T }> | undefined;

describe("setup", () => {
  it("deals exactly 2 wolf + 1 seer + 3 villager and starts at night_seer", () => {
    const s = createGame(7);
    const counts = s.seats.reduce<Record<string, number>>((a, x) => ((a[x.role] = (a[x.role] ?? 0) + 1), a), {});
    expect(counts).toEqual({ wolf: 2, seer: 1, villager: 3 });
    expect(s.phase).toBe("night_seer");
    expect(s.day).toBe(1);
  });

  it("is reproducible from the seed", () => {
    expect(createGame(123).seats).toEqual(createGame(123).seats);
  });
});

describe("currentActors", () => {
  it("night_seer = seer, night_wolf = wolves, day = everyone alive", () => {
    let s = createGame(7);
    expect(currentActors(s)).toEqual(roleSeats(s, "seer"));
    s = reduce(s, new Map()).state; // -> night_wolf
    expect(currentActors(s).sort()).toEqual(roleSeats(s, "wolf").sort());
  });
});

describe("night_wolf — kill aggregation", () => {
  it("plurality target dies; first-night kill goes to last_words", () => {
    let s = createGame(7);
    const seer = roleSeats(s, "seer")[0]!;
    s = reduce(s, new Map([[seer, dec("check", null)]])).state; // night_wolf now (day 1)
    const wolves = roleSeats(s, "wolf");
    const victim = s.seats.find((x) => x.role === "villager")!.seat;

    const { state: after, events } = reduce(s, new Map(wolves.map((w) => [w, dec("kill", victim)])));
    expect(after.seats.find((x) => x.seat === victim)!.alive).toBe(false);
    expect(ev(events, "night_kill")!.victim).toBe(victim);
    expect(after.phase).toBe("last_words"); // 首夜被刀 → 遗言
    expect(after.pendingLastWords?.seat).toBe(victim);
    // No role reveal.
    const death = after.publicLog.find((e) => e.type === "death");
    expect(death && "role_revealed" in death && death.role_revealed).toBeNull();
  });

  it("split vote is broken deterministically by the seed (tie flagged)", () => {
    const run = () => {
      let s = createGame(42);
      s = reduce(s, new Map([[roleSeats(s, "seer")[0]!, dec("check", null)]])).state;
      const wolves = roleSeats(s, "wolf");
      const villagers = roleSeats(s, "villager");
      const r = reduce(s, new Map([
        [wolves[0]!, dec("kill", villagers[0]!)],
        [wolves[1]!, dec("kill", villagers[1]!)],
      ]));
      return r;
    };
    const a = run();
    const b = run();
    expect(ev(a.events, "night_kill")!.tie).toBe(true);
    expect(a.state.seats).toEqual(b.state.seats); // seed-stable tie-break
  });

  it("no valid proposals => nobody dies", () => {
    let s = createGame(7);
    s = reduce(s, new Map([[roleSeats(s, "seer")[0]!, dec("check", null)]])).state;
    const { state: after, events } = reduce(s, new Map()); // wolves don't decide
    expect(after.seats.every((x) => x.alive)).toBe(true);
    expect(ev(events, "night_kill")!.victim).toBeNull();
  });
});

describe("day_vote — banish", () => {
  // Helper: get a fresh game to its first day_vote with everyone alive.
  const toDayVote = (seed: number) => {
    let s = createGame(seed);
    s = reduce(s, new Map([[roleSeats(s, "seer")[0]!, dec("check", null)]])).state; // night_seer
    s = reduce(s, new Map()).state; // night_wolf, no kill
    s = reduce(s, new Map(currentActors(s).map((x) => [x, dec("speak", null, "hi")]))).state; // discuss
    return s; // day_vote
  };

  it("plurality is banished", () => {
    const s = toDayVote(7);
    const target = s.seats.find((x) => x.alive)!.seat;
    const votes = new Map(currentActors(s).map((x) => [x, dec("vote", target)]));
    const { state: after, events } = reduce(s, votes);
    expect(after.seats.find((x) => x.seat === target)!.alive).toBe(false);
    expect(ev(events, "banish")!.victim).toBe(target);
  });

  it("all abstain => nobody banished, continues to next night", () => {
    const s = toDayVote(7);
    const { state: after, events } = reduce(s, new Map(currentActors(s).map((x) => [x, dec("abstain")])));
    expect(after.seats.every((x) => x.alive)).toBe(true);
    expect(ev(events, "banish")!.victim).toBeNull();
    expect(ev(events, "banish")!.abstains).toBe(currentActors(s).length);
    expect(after.phase).toBe("night_seer");
    expect(after.day).toBe(2);
  });

  it("a tie is broken by the seed and flagged", () => {
    const s = toDayVote(7);
    const alive = currentActors(s); // 6 alive seats
    const [t1, t2] = [alive[4]!, alive[5]!];
    // Two votes each for two targets; no one votes themselves -> a real 2-2 tie.
    const votes = new Map<number, Decision>([
      [alive[0]!, dec("vote", t1)],
      [alive[1]!, dec("vote", t1)],
      [alive[2]!, dec("vote", t2)],
      [alive[3]!, dec("vote", t2)],
    ]);
    const r1 = reduce(s, votes);
    const r2 = reduce(s, votes);
    expect(ev(r1.events, "banish")!.tie).toBe(true);
    expect(r1.state.seats).toEqual(r2.state.seats);
  });
});

describe("victory (屠民 / kill the villager side)", () => {
  it("good wins when wolves reach 0", () => {
    const s = createGame(7);
    const dead: GameState = { ...s, seats: s.seats.map((x) => (x.role === "wolf" ? { ...x, alive: false } : x)) };
    expect(checkVictory(dead)).toBe("good");
  });

  it("wolves win when all villagers are wiped out", () => {
    const s = createGame(7);
    const seats = s.seats.map((x) => (x.role === "villager" ? { ...x, alive: false } : { ...x }));
    expect(checkVictory({ ...s, seats })).toBe("wolf");
  });

  it("killing the seer does NOT end the game while villagers survive", () => {
    const s = createGame(7);
    const seats = s.seats.map((x) => (x.role === "seer" ? { ...x, alive: false } : { ...x }));
    expect(checkVictory({ ...s, seats })).toBeNull(); // seer dead, villagers alive → continue
  });

  it("game continues with everyone alive", () => {
    expect(checkVictory(createGame(7))).toBeNull();
  });

  it("a night kill removing the LAST villager ends the game (wolf win)", () => {
    const base = createGame(7);
    const wolves = roleSeats(base, "wolf");
    const villagers = roleSeats(base, "villager");
    const lastVillager = villagers[0]!;
    // Pre-kill the other two villagers; only one villager + wolves + seer alive.
    const seats = base.seats.map((x) =>
      x.role === "villager" && x.seat !== lastVillager ? { ...x, alive: false } : { ...x },
    );
    const s: GameState = { ...base, phase: "night_wolf", seats };
    const { state: after, events } = reduce(s, new Map(wolves.map((w) => [w, dec("kill", lastVillager)])));
    expect(after.seats.find((x) => x.seat === lastVillager)!.alive).toBe(false);
    expect(after.phase).toBe("game_over");
    expect(after.winner).toBe("wolf");
    expect(after.pendingLastWords).toBeNull(); // game over → no last words
    expect(events.some((e) => e.type === "game_over")).toBe(true);
  });
});

describe("last words (首夜被刀 + 所有放逐)", () => {
  it("a first-night kill triggers last_words for the victim, then resumes to day_discuss", () => {
    let s = createGame(7);
    s = reduce(s, new Map()).state; // night_seer (no check) → night_wolf, day 1
    expect(s.phase).toBe("night_wolf");
    const wolves = roleSeats(s, "wolf");
    const victim = s.seats.find((x) => x.role === "villager")!.seat;
    let r = reduce(s, new Map(wolves.map((w) => [w, dec("kill", victim)])));
    expect(r.state.phase).toBe("last_words");
    expect(r.state.pendingLastWords?.seat).toBe(victim);
    expect(currentActors(r.state)).toEqual([victim]); // the dead seat speaks
    r = reduce(r.state, new Map([[victim, dec("speak", null, "我是好人,小心狼")]]));
    expect(r.state.phase).toBe("day_discuss");
    expect(r.state.pendingLastWords).toBeNull();
    expect(r.state.publicLog.some((e) => e.type === "lastwords" && e.seat === victim && e.say === "我是好人,小心狼")).toBe(true);
  });

  it("a second-night kill gives NO last words (straight to day_discuss)", () => {
    let s = createGame(7);
    s = reduce(s, new Map()).state; // night_wolf d1
    s = reduce(s, new Map()).state; // no kill → day_discuss d1
    s = reduce(s, new Map(currentActors(s).map((x) => [x, dec("speak", null, "hi")]))).state; // → day_vote d1
    s = reduce(s, new Map(currentActors(s).map((x) => [x, dec("abstain")]))).state; // all abstain → night_seer d2
    expect(s.day).toBe(2);
    s = reduce(s, new Map()).state; // → night_wolf d2
    expect(s.phase).toBe("night_wolf");
    const wolves = roleSeats(s, "wolf");
    const v = s.seats.find((x) => x.alive && x.role === "villager")!.seat;
    const r = reduce(s, new Map(wolves.map((w) => [w, dec("kill", v)])));
    expect(r.state.phase).toBe("day_discuss"); // no last_words on night 2
    expect(r.state.pendingLastWords).toBeNull();
    expect(r.state.publicLog.some((e) => e.type === "lastwords")).toBe(false);
  });

  it("a banished player always gets last words, then on to the next night", () => {
    let s = createGame(7);
    s = reduce(s, new Map()).state; // night_wolf
    s = reduce(s, new Map()).state; // day_discuss (no kill)
    s = reduce(s, new Map(currentActors(s).map((x) => [x, dec("speak", null, "hi")]))).state; // → day_vote
    const target = s.seats.find((x) => x.alive)!.seat;
    let r = reduce(s, new Map(currentActors(s).map((x) => [x, dec("vote", target)])));
    expect(r.state.phase).toBe("last_words");
    expect(r.state.pendingLastWords?.seat).toBe(target);
    r = reduce(r.state, new Map([[target, dec("speak", null, "我冤枉")]]));
    expect(r.state.phase).toBe("night_seer");
    expect(r.state.day).toBe(2);
    expect(r.state.publicLog.some((e) => e.type === "lastwords" && e.seat === target)).toBe(true);
  });
});
