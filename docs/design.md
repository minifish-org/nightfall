# Design — Goal 1 (headless engine) & Goal 2 (browser spectator)

This is the design for the first two milestones. Goal 1 delivers a pure-TS
engine + agentd client + an env-agnostic orchestrator + a Node CLI that plays a
full AI game against a live agentd and prints a transcript. Goal 2 adds a
browser spectator that reuses the *same* engine + orchestrator and renders the
game live, with no game rules in the React layer.

## 1. Locked rules (this milestone only)

- 6 seats (1–6), randomly dealt: **2 wolf + 1 seer + 3 villager** (good 4 vs wolf 2).
- **No role reveal on death** — `role_revealed` is always `null`.
- Round loop (night → day):
  1. `night_seer` — the seer checks one living non-self seat → learns `good`/`wolf` (into its private `checks`).
  2. `night_wolf` — both wolves name a kill target; referee aggregates (plurality, ties broken by seeded RNG) → ≤1 death.
  3. resolve night death → victory check.
  4. `day_discuss` — each living seat speaks once (one round, seat order).
  5. `day_vote` — each living seat votes one target or abstains; plurality banished (ties → seeded RNG) → ≤1 death.
  6. resolve → victory check → back to step 1 (`day` increments).
- Victory (屠边, checked after each death): wolves = 0 → **good** wins; all villagers dead OR all gods (the seer) dead → **wolf** wins; else continue. (Updated from the original parity rule per /goal follow-up.)

## 2. Contract (defined here; agentd only passes it through)

### Referee → seat (the `POST /v1/turns` payload is `{ input: <view> }`)

The real `simple-bot` wasm reads `payload.input` as the model's user content
(verified in agentd `apps/simple-bot/agent/src/lib.rs`), so the view is nested
under `input`.

```jsonc
{
  "phase": "night_seer" | "night_wolf" | "day_discuss" | "day_vote",
  "game_id": "g42",
  "day": 1,
  "you": { "seat": 3, "role": "seer" },
  "alive_seats": [1,2,3,5,6],
  "dead_seats": [ { "seat": 4, "phase": "night_wolf" } ],
  "public_log": [ /* speech | vote | death events, NEVER any role */ ],
  "private": { /* role-projected, see below */ },
  "valid_targets": [1,2,5,6]
}
```

`private` by role — **the information-hiding boundary**:
- seer → `{ "checks": [ { "day": 1, "seat": 5, "result": "wolf" } ] }`
- wolf → `{ "teammates": [ <other wolf seats> ] }`
- villager → `{}`

`valid_targets` by (phase, role): seer@night = living non-self; wolf@night =
living non-wolves; vote = living non-self; discuss = `[]`.

### Seat → referee (the agent's single `output.emit`, surfaced as `final_decision`)

```jsonc
{ "action": "check"|"kill"|"speak"|"vote"|"abstain", "target": 5, "say": "...", "reason": "..." }
```

`target` is a seat number or `null`. Five actions only.

## 3. Modules

```
engine/        pure TS, no DOM, no network — the only holder of full state
  types.ts       Role/Phase/Action/Decision/SeatView/PublicEntry/GameState
  rng.ts         mulberry32, resumable cursor (GameState.rngState)
  board.ts       STANDARD_6 constant + role deck
  setup.ts       createGame(seed, gameId) — deterministic deal
  projection.ts  viewFor(state, seat) — builds the view as an ALLOWLIST
  phases.ts      currentActors / validTargets / reduce / fallbackDecision
  victory.ts     checkVictory
  index.ts       public surface
  agent-map.ts   role → default agent_ref
orchestrator/  env-agnostic async driver (imports engine only in run.ts)
  types.ts       AgentCaller, Observer, GameEvent, RunOptions
  run.ts         runGame({ state, agentCaller, observer, options })
  agentd-caller.ts  createAgentdCaller(client, …): AgentCaller (imports engine+client)
agentd-client/ HTTP only — POST /v1/turns, tolerant JSON decode
app/           React spectator (Goal 2) — renders observer events, zero rules
scripts/
  register-agents.sh   apply agents/*.toml to external agentd
  play.ts              Node CLI: createGame → runGame → transcript
agents/        wolf/seer/villager manifests (persona + strict-JSON instruction)
```

### Engine API (pure reducer)

```ts
createGame(seed: number, gameId?: string): GameState
currentActors(state): number[]                 // who decides this phase, seat-ascending
viewFor(state, seat): SeatView                  // projection (the only thing a seat sees)
reduce(state, decisions: Map<seat, Decision>): { state: GameState; events: ResolutionEvent[] }
fallbackDecision(phase): Decision               // safe degrade
checkVictory(state): Faction | null
```

`reduce` is a pure function of `(state, decisions)`; illegal actions/targets are
ignored (degraded to no-op / abstain). Given a seed and a recorded decision
sequence, replay is bit-identical (RNG cursor lives in state).

### Orchestrator (shared by CLI and browser)

```ts
type AgentCaller = (req: { phase; day; seat; role; view: SeatView }) => Promise<Decision>;
interface Observer { onGameStart?; onPhaseStart?; onSeatDecision?; onResolution?; onDeath?; onGameOver?; }
runGame({ state, agentCaller, observer, options }): Promise<{ winner; state }>
```

Loop: for each phase, take `currentActors`, drive them **sequentially in seat
order** (ordered timeline + pacing), each via `agentCaller(viewFor(seat))`; on
throw/invalid, substitute `fallbackDecision` and emit `onSeatDecision{error}`;
then `reduce` and emit resolution/death/gameover events. `options.gate(cp)` is
awaited at each step boundary so a host can pause/single-step/throttle without
the orchestrator knowing about UI or timers. `options.signal` aborts.

The injected `agentCaller` is the only network seam: Node and browser both use
`createAgentdCaller` (global `fetch`, direct to agentd via its open CORS). The
view passed to agentd is always the **projected** view; the god-view the UI
renders comes from the full `GameState` the observer also receives — the two are
never mixed.

## 4. Fault tolerance

agentd unreachable / timeout / non-JSON → the client returns a coerced object or
null; the orchestrator falls back (vote→abstain, night→no-op, discuss→silent),
emits `onSeatDecision{error}`, and the game continues. No hang: every turn has a
client-side timeout and the orchestrator never blocks on a single seat.

## 5. Tests

- **Info hiding (key):** wolf view has `private.teammates`; villager & seer views
  do **not**; only the seer's view has `private.checks`; `public_log` never
  contains a role.
- Night-kill aggregation (plurality + seeded tie-break).
- Vote banish + tie + all-abstain.
- Victory: wolves=0 (good), all villagers dead (wolf), seer dead (wolf).
- Deterministic replay: same seed + same decision sequence ⇒ identical end state.
- Orchestrator: injected fake `agentCaller` + fixed seed plays a full game to a
  winner with no network.

## 6. Goal 2 — browser spectator (after Goal 1 is green)

- Reuses `runGame` + engine unchanged. A React store subscribes to the
  `Observer` and renders incrementally; **no rule logic in components**.
- God-view: every seat's true role, alive/dead, each step's public `say` + private
  `reason`, night results, vote distribution, banish/deaths, final winner.
- Config form: agentd baseUrl (default `http://127.0.0.1:8080`), tenant, seed,
  agent_ref pool (role→ref), step delay ms.
- Playback: start / pause / single-step / autoplay — implemented via the
  orchestrator `gate`, resolved by a button click or an interval timer.
- Timeline grouped by night/day; a 6-seat status panel.
