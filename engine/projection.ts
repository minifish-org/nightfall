import { validTargets } from "./phases.js";
import type {
  DeathPhase,
  GameState,
  PrivateView,
  PublicEntry,
  SeatView,
  TurnContext,
} from "./types.js";

/**
 * ─────────────────────────────────────────────────────────────────────────
 * THE INFORMATION-HIDING BOUNDARY (docs/design.md §2).
 * ─────────────────────────────────────────────────────────────────────────
 *
 * viewFor is the ONLY payload an agentd seat ever sees. It is an ALLOWLIST:
 * every field is built up from what the seat is entitled to know, never by
 * stripping the full GameState. Anything not added here is hidden by
 * construction.
 *
 * The optional `ctx` carries THIS-PHASE, not-yet-resolved activity so an actor
 * can see what earlier actors did in the same phase (sequential discussion;
 * wolf night coordination). It is transient — it never widens what a seat may
 * know: speeches are public anyway, and wolf intents are shown only to wolves.
 *
 * Invariants (enforced here, tested in projection.test.ts):
 *  - `you.role` is the only role fact; no other seat's role appears anywhere.
 *  - `private.teammates` / `private.teammate_intents` exist ONLY for a wolf seat.
 *  - `private.checks` exists ONLY for the seer seat (its own checks only).
 *  - `public_log` and `setup` are role-free.
 */
export function viewFor(state: GameState, seat: number, ctx?: TurnContext): SeatView {
  const me = state.seats.find((s) => s.seat === seat);
  if (!me) throw new Error(`viewFor: unknown seat ${seat}`);

  let priv: PrivateView;
  if (me.role === "wolf") {
    const wolf: { teammates: number[]; teammate_intents?: { seat: number; target: number | null }[] } = {
      teammates: state.seats.filter((s) => s.role === "wolf" && s.seat !== seat).map((s) => s.seat),
    };
    // This-night teammate proposals (others', not your own). Wolves only.
    const intents = ctx?.wolfIntents?.filter((i) => i.seat !== seat) ?? [];
    if (intents.length) wolf.teammate_intents = intents;
    priv = wolf;
  } else if (me.role === "seer") {
    priv = { checks: state.seerChecks[seat] ?? [] };
  } else {
    priv = {};
  }

  // public_log + any speeches already made THIS discussion round (so later
  // speakers can respond to earlier ones).
  const public_log: PublicEntry[] = ctx?.speeches?.length
    ? [
        ...state.publicLog,
        ...ctx.speeches.map(
          (s): PublicEntry => ({ type: "speech", day: state.day, phase: "day_discuss", seat: s.seat, say: s.say.trim() }),
        ),
      ]
    : state.publicLog;

  const dead_seats: { seat: number; phase: DeathPhase }[] = state.seats
    .filter((s) => !s.alive && s.diedPhase !== null)
    .map((s) => ({ seat: s.seat, phase: s.diedPhase! }));

  return {
    phase: state.phase,
    game_id: state.game_id,
    day: state.day,
    you: { seat: me.seat, role: me.role },
    setup: setupOf(state),
    alive_seats: state.seats.filter((s) => s.alive).map((s) => s.seat),
    dead_seats,
    public_log,
    private: priv,
    valid_targets: validTargets(state, seat),
  };
}

/** Public role COUNTS (not identities), with seat-collision-proof plural keys. */
function setupOf(state: GameState): SeatView["setup"] {
  const c = { seats: state.seats.length, wolves: 0, seers: 0, villagers: 0 };
  for (const s of state.seats) {
    if (s.role === "wolf") c.wolves++;
    else if (s.role === "seer") c.seers++;
    else c.villagers++;
  }
  return c;
}
