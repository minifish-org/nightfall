import { currentActors, fallbackDecision, legalActions, reduce, viewFor } from "../engine/index.js";
import type { Action, Decision, GameState, TurnContext } from "../engine/index.js";
import type { GameResult, RunInput, SeatDecisionEvent } from "./types.js";

const ACTIONS: ReadonlySet<Action> = new Set(["check", "kill", "speak", "vote", "abstain"]);

function isDecision(d: unknown): d is Decision {
  if (!d || typeof d !== "object") return false;
  const o = d as Record<string, unknown>;
  return (
    typeof o.action === "string" &&
    ACTIONS.has(o.action as Action) &&
    (o.target === null || typeof o.target === "number")
  );
}

/**
 * Drive a game to completion (or abort). Environment-agnostic: the only I/O is
 * the injected `agentCaller`; everything else is the pure engine. The same
 * function backs the Node CLI and the browser spectator.
 *
 * Per phase: take currentActors, drive them sequentially in seat order (ordered
 * timeline + pacing via `gate`), each via agentCaller(projected view). A throw
 * or an unusable decision degrades to fallbackDecision and is reported with an
 * `error`, so a flaky agent never wedges or crashes the game. Then reduce() and
 * emit the resolution events.
 */
export async function runGame({ state, agentCaller, observer, options }: RunInput): Promise<GameResult> {
  let s: GameState = state;
  const maxSteps = options?.maxSteps ?? 500;
  const aborted = () => options?.signal?.aborted ?? false;

  observer?.onGameStart?.(s);

  let step = 0;
  while (s.phase !== "game_over" && step++ < maxSteps) {
    if (aborted()) return { winner: s.winner, state: s, aborted: true };

    const phase = s.phase;
    const day = s.day;
    const actors = currentActors(s);
    await options?.gate?.({ kind: "phase", phase, day });
    observer?.onPhaseStart?.({ phase, day, actors }, s);

    const decisions = new Map<number, Decision>();
    // This-phase context so later actors see earlier ones (sequential
    // discussion; wolf night coordination). Never stored — reduce stays the
    // sole authority and re-derives everything from `decisions`.
    const ctx: TurnContext = { speeches: [], wolfIntents: [] };
    for (const seat of actors) {
      if (aborted()) return { winner: s.winner, state: s, aborted: true };
      await options?.gate?.({ kind: "seat", phase, day, seat });

      const role = s.seats.find((x) => x.seat === seat)!.role;
      const view = viewFor(s, seat, ctx);

      let decision: Decision;
      let error: string | undefined;
      try {
        const raw = await agentCaller({ phase, day, seat, role, view });
        if (!isDecision(raw)) {
          error = "agent returned an invalid decision";
          decision = fallbackDecision(phase);
        } else if (!legalActions(phase).includes(raw.action)) {
          // Right shape, wrong phase (e.g. "speak" during day_vote): degrade to
          // the phase fallback so display and effect stay consistent.
          error = `illegal action "${raw.action}" in ${phase}`;
          decision = fallbackDecision(phase);
        } else {
          decision = raw;
        }
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        decision = fallbackDecision(phase);
      }

      decisions.set(seat, decision);
      // Make this actor's contribution visible to subsequent actors this phase.
      if (phase === "day_discuss") ctx.speeches!.push({ seat, say: decision.say });
      if (phase === "night_wolf") ctx.wolfIntents!.push({ seat, target: decision.target });

      const evt: SeatDecisionEvent = { phase, day, seat, role, view, decision, ...(error !== undefined ? { error } : {}) };
      observer?.onSeatDecision?.(evt, s);
    }

    const { state: nextState, events } = reduce(s, decisions);
    s = nextState;
    observer?.onResolution?.({ phase, day, events }, s);
  }

  if (s.phase === "game_over" && s.winner) observer?.onGameOver?.(s.winner, s);
  return { winner: s.winner, state: s, aborted: false };
}
