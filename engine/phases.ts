import { makeRng, type Rng } from "./rng.js";
import { checkVictory } from "./victory.js";
import { FACTION_OF } from "./types.js";
import type {
  Action,
  Decision,
  DeathPhase,
  GameState,
  Phase,
  PublicEntry,
  ResolutionEvent,
  SeatState,
} from "./types.js";

const aliveSeats = (state: GameState): SeatState[] => state.seats.filter((s) => s.alive);
const seatOf = (state: GameState, seat: number): SeatState | undefined =>
  state.seats.find((s) => s.seat === seat);

/** Seats that must produce a decision this phase, ascending by seat. */
export function currentActors(state: GameState): number[] {
  switch (state.phase) {
    case "night_seer":
      return aliveSeats(state).filter((s) => s.role === "seer").map((s) => s.seat);
    case "night_wolf":
      return aliveSeats(state).filter((s) => s.role === "wolf").map((s) => s.seat);
    case "day_discuss":
    case "day_vote":
      return aliveSeats(state).map((s) => s.seat);
    case "game_over":
      return [];
  }
}

/**
 * Legal targets for `seat` given the current phase and that seat's role.
 * Non-actors get []. Wolves may not target wolves; checks/votes exclude self.
 * (Listing living non-wolves to a wolf leaks nothing — wolves know teammates.)
 */
export function validTargets(state: GameState, seat: number): number[] {
  const s = seatOf(state, seat);
  if (!s || !s.alive) return [];
  const livingOthers = aliveSeats(state).filter((x) => x.seat !== seat).map((x) => x.seat);
  switch (state.phase) {
    case "night_seer":
      return s.role === "seer" ? livingOthers : [];
    case "night_wolf":
      return s.role === "wolf"
        ? aliveSeats(state).filter((x) => x.role !== "wolf").map((x) => x.seat)
        : [];
    case "day_vote":
      return livingOthers;
    case "day_discuss":
    case "game_over":
      return [];
  }
}

/**
 * The action verbs that are legal in a phase (for whoever is acting — only the
 * seer acts in night_seer, only wolves in night_wolf, so phase pins the verb).
 * Used to reject a phase-mismatched action (e.g. "speak" during day_vote) so it
 * degrades to the phase fallback instead of silently becoming an abstain with a
 * misleading display.
 */
export function legalActions(phase: Phase): Action[] {
  switch (phase) {
    case "night_seer":
      return ["check"];
    case "night_wolf":
      return ["kill"];
    case "day_discuss":
      return ["speak"];
    case "day_vote":
      return ["vote", "abstain"];
    case "game_over":
      return [];
  }
}

/** Safe default when a seat fails to decide (timeout / error / illegal output). */
export function fallbackDecision(phase: Phase): Decision {
  switch (phase) {
    case "night_seer":
      return { action: "check", target: null, say: "", reason: "fallback: no check" };
    case "night_wolf":
      return { action: "kill", target: null, say: "", reason: "fallback: no kill" };
    case "day_discuss":
      return { action: "speak", target: null, say: "(silent)", reason: "fallback: silent" };
    case "day_vote":
      return { action: "abstain", target: null, say: "", reason: "fallback: abstain" };
    case "game_over":
      return { action: "abstain", target: null, say: "", reason: "fallback" };
  }
}

/**
 * Advance the game by one phase given the collected per-seat decisions.
 * Pure: returns a NEW state plus the resolution events that occurred (for the
 * transcript / spectator god-view). Illegal actions/targets are silently
 * degraded to no-op, so a misbehaving agent can never wedge the game.
 */
export function reduce(
  state: GameState,
  decisions: Map<number, Decision>,
): { state: GameState; events: ResolutionEvent[] } {
  if (state.phase === "game_over") return { state, events: [] };

  const rng = makeRng(state.rngState);
  const seats = state.seats.map((s) => ({ ...s }));
  const publicLog: PublicEntry[] = [...state.publicLog];
  const seerChecks: GameState["seerChecks"] = Object.fromEntries(
    Object.entries(state.seerChecks).map(([k, v]) => [k, [...v]]),
  );
  const events: ResolutionEvent[] = [];
  const next: GameState = { ...state, seats, publicLog, seerChecks };

  const legalTargetsFor = (seat: number) => new Set(validTargets(state, seat));
  const targetIfLegal = (seat: number, d: Decision | undefined): number | undefined => {
    if (!d || typeof d.target !== "number") return undefined;
    return legalTargetsFor(seat).has(d.target) ? d.target : undefined;
  };

  switch (state.phase) {
    case "night_seer": {
      for (const seer of seats.filter((s) => s.alive && s.role === "seer")) {
        const t = targetIfLegal(seer.seat, decisions.get(seer.seat));
        if (t !== undefined) {
          const result = FACTION_OF[seats.find((s) => s.seat === t)!.role];
          (seerChecks[seer.seat] ??= []).push({ day: state.day, seat: t, result });
          events.push({ type: "seer_check", seat: seer.seat, target: t, result });
        }
      }
      next.rngState = rng.state();
      return advance(next, "night_wolf", state.day, events);
    }

    case "night_wolf": {
      const proposals: { seat: number; target: number | null }[] = [];
      const tally = new Map<number, number>();
      for (const wolf of seats.filter((s) => s.alive && s.role === "wolf")) {
        const t = targetIfLegal(wolf.seat, decisions.get(wolf.seat));
        proposals.push({ seat: wolf.seat, target: t ?? null });
        if (t !== undefined) tally.set(t, (tally.get(t) ?? 0) + 1);
      }
      const { winner: victim, tie } = pickTop(tally, rng);
      events.push({ type: "night_kill", victim: victim ?? null, proposals, tie });
      if (victim !== undefined) {
        killSeat(seats, publicLog, events, victim, "night_wolf", "night", state.day);
      }
      next.rngState = rng.state();
      return finishOrAdvance(next, "day_discuss", state.day, events);
    }

    case "day_discuss": {
      for (const s of aliveSeats(state)) {
        const say = (decisions.get(s.seat)?.say ?? "").trim();
        publicLog.push({ type: "speech", day: state.day, phase: "day_discuss", seat: s.seat, say });
      }
      next.rngState = rng.state();
      return advance(next, "day_vote", state.day, events);
    }

    case "day_vote": {
      const tally = new Map<number, number>();
      let abstains = 0;
      for (const s of aliveSeats(state)) {
        const d = decisions.get(s.seat);
        const t = d?.action === "vote" ? targetIfLegal(s.seat, d) : undefined;
        if (t !== undefined) tally.set(t, (tally.get(t) ?? 0) + 1);
        else abstains++;
        publicLog.push({ type: "vote", day: state.day, phase: "day_vote", seat: s.seat, target: t ?? null });
      }
      const { winner: victim, tie } = pickTop(tally, rng);
      events.push({
        type: "banish",
        victim: victim ?? null,
        tally: Object.fromEntries(tally),
        abstains,
        tie,
      });
      if (victim !== undefined) {
        killSeat(seats, publicLog, events, victim, "day_vote", "vote", state.day);
      }
      next.rngState = rng.state();
      // Next round; bump the day counter.
      return finishOrAdvance(next, "night_seer", state.day + 1, events);
    }

    default:
      return { state: next, events };
  }
}

function killSeat(
  seats: SeatState[],
  publicLog: PublicEntry[],
  events: ResolutionEvent[],
  seat: number,
  phase: DeathPhase,
  cause: "night" | "vote",
  day: number,
): void {
  const s = seats.find((x) => x.seat === seat)!;
  s.alive = false;
  s.diedPhase = phase;
  s.diedDay = day;
  publicLog.push({ type: "death", day, phase, seat, cause, role_revealed: null });
  events.push({ type: "death", seat, phase, cause });
}

/** Advance to the next phase (no victory check — used after non-lethal phases). */
function advance(
  state: GameState,
  to: Phase,
  day: number,
  events: ResolutionEvent[],
): { state: GameState; events: ResolutionEvent[] } {
  events.push({ type: "phase_advance", from: state.phase, to, day });
  return { state: { ...state, phase: to, day }, events };
}

/** Resolve victory; either end the game or advance. Used after lethal phases. */
function finishOrAdvance(
  state: GameState,
  to: Phase,
  day: number,
  events: ResolutionEvent[],
): { state: GameState; events: ResolutionEvent[] } {
  const winner = checkVictory(state);
  if (winner) {
    events.push({ type: "game_over", winner });
    return { state: { ...state, phase: "game_over", winner }, events };
  }
  return advance(state, to, day, events);
}

/** Highest-count entry; ties broken deterministically by RNG. */
function pickTop(
  tally: Map<number, number>,
  rng: Rng,
): { winner: number | undefined; tie: boolean } {
  let max = 0;
  for (const c of tally.values()) max = Math.max(max, c);
  if (max === 0) return { winner: undefined, tie: false };
  const top = [...tally.entries()].filter(([, c]) => c === max).map(([t]) => t).sort((a, b) => a - b);
  if (top.length === 1) return { winner: top[0], tie: false };
  return { winner: rng.pick(top), tie: true };
}
