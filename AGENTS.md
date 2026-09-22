# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

Nightfall is a web AI Werewolf platform. Every seat is an AI player driven by
the external **agentd** runtime; the human is an operator/spectator. The
defining choice is **referee-in-frontend**: the referee (a Node CLI today, the
browser for spectating) holds the authoritative game state and is the only
component that ever sees it in full.

## The four hard rules (non-negotiable)

1. **Never modify, fork, or embed agentd.** It lives in a separate repo
   ([minifish-org/agentd](https://github.com/minifish-org/agentd)) and is consumed over HTTP only. **agentd owns the
   agent definitions** — the `werewolf-wolf/seer/villager/judge` agents (persona +
   model) are defined and registered in
   the agentd repo, NOT here. Nightfall does not write or apply manifests; it
   only maps `role → agent name` (`engine/agent-map.ts`), sends the projected
   view, and reads the decision. Game state and rule enforcement never go into
   agentd — a seat is a brain: decision = f(persona, view).
2. **The referee is the single authority and the only holder of full state.**
   Each seat receives only a **view projection** (`engine/projection.ts`,
   `viewFor`) — an allowlist of what it may know. This is the information-hiding
   boundary; it is enforced in code and tested (`engine/projection.test.ts`),
   never left to the agent prompt. Any change that could widen a seat's view is
   security-critical.
3. **Rules live only in the engine.** The orchestrator and the React layer
   contain NO game logic — they drive the loop and render. The spectator may
   render the god-view (full state from the observer), but the payload sent to
   agentd is always the projected view; never mix the two.
4. **Keep the engine framework-agnostic.** `engine/` and `orchestrator/run.ts`
   have no DOM and no network (the only I/O is the injected `agentCaller`). This
   is what lets authority move to a Cloudflare Durable Object later unchanged.

## Architecture & data flow

`orchestrator/run.ts` `runGame` is the loop to read first:

```
for each phase until game_over:
  currentActors(state)              → seats that act now, seat-ascending   [engine]
  for each actor (sequential):
    viewFor(state, seat)            → projected view (the ONLY thing sent)  [engine]
    agentCaller({ phase, seat, role, view }) → POST turn → GET run wait [agentd]
      (throw/invalid → fallbackDecision + onSeatDecision{error})
  reduce(state, decisions)          → next state + ResolutionEvents        [engine]
```

- **engine/** is a pure reducer. `createGame(seed)` → `currentActors` / `viewFor`
  → `reduce(state, decisions) → { state, events }`. All randomness comes from
  `engine/rng.ts` (mulberry32); the cursor lives in `GameState.rngState`, so a
  game is a pure function of `(seed, decision sequence)` and replays
  bit-identically (tie-breaks included). Never add `Math.random()`/`Date.now()`
  to the engine. The only authoritative secrets are `seats[].role` and
  `seerChecks`; `viewFor` rebuilds each view as an allowlist (add a field only
  if the seat is entitled to it — never strip from full state).
- **Phase FSM:** `night_seer → night_wolf → day_discuss → day_vote → night_seer`
  (day increments on day_vote→night_seer), ending in `game_over`. Victory is
  checked after each lethal phase. **Win rule is 屠民** (`engine/victory.ts`):
  good wins when wolves=0; wolves win when all 3 villagers are dead. Killing the
  seer no longer ends the game (it only costs good its information) — 屠边 with a
  single god was too wolf-favored. Illegal actions/targets degrade to no-op, so a flaky agent can never
  wedge a game.
- **orchestrator/** is environment-agnostic. `run.ts` imports only the engine;
  `agentd-caller.ts` is the concrete network binding (`createAgentdCaller`). The
  Node CLI (`scripts/play.ts`) and the browser (`app/useGameRunner.ts`) inject
  the same caller — the loop is written once. Playback (pause/step/autoplay) is
  the injected `options.gate`; the browser implements it with `app/pacer.ts`.

## The contract (defined here; agentd only passes it through)

- Referee → seat: `POST /v1/tenants/:tenant/turns` with `payload = <SeatView>`.
  The POST returns a queued `run_id`; Nightfall then calls the tenant-scoped
  run wait endpoint and reads its canonical output. It does not request an
  outbox delivery. agentd places the payload under `input` in the run envelope.
  View shape =
  `{ phase, game_id, day, you:{seat,role}, setup:{seats,roles}, alive_seats,
  dead_seats, public_log, private, valid_targets }`; `private` is `{teammates,
  teammate_intents?}` for wolves, `{checks}` for the seer, `{}` otherwise.
- **Intra-phase visibility** (`TurnContext`, threaded by `orchestrator/run.ts`,
  rendered by `viewFor(state, seat, ctx)`): within a phase, all actors would
  otherwise see the same pre-phase snapshot. `ctx` fixes the realism gaps —
  during `day_discuss` a later speaker sees earlier speakers' speeches this
  round (`ctx.speeches`), and during `night_wolf` a wolf sees teammates' kill
  proposals so far (`ctx.wolfIntents` → `private.teammate_intents`). `ctx` is
  transient and never stored; `reduce` stays the sole authority and re-derives
  everything from the collected decisions (speeches appended exactly once).
- Seat → referee: the agent's final JSON becomes the run `output`,
  shape `{ action, target, say, reason }` with `action ∈ {check, kill, speak,
  vote, abstain}` — the only five verbs.
- **Output language is dynamic, no re-registration.** The personas are
  registered once with "reply in the language given by `input.lang`"; the
  referee sets it per turn — `agentd-caller` sends `payload = { ...view, lang }`.
  The UI language toggle drives both the UI strings (`app/i18n.ts`) and the
  `lang` sent, fixed per game at Start. `viewFor` stays pure rules — the caller,
  not the engine, attaches `lang`.
- The LLM may not return clean JSON. `agentd-client/parse.ts` (`coerceDecision`)
  strips fences and extracts the first balanced `{…}`; `agentd-caller.ts`
  throws on an unusable response so the orchestrator degrades and marks the step
  errored (timeout / failed run / no emit all map to a safe default).

## Commands

```bash
pnpm dev                                   # Vite spectator at http://localhost:5173
pnpm play --seed 7                         # headless game vs agentd, prints transcript
pnpm test                                  # Vitest (engine + orchestrator + client)
pnpm vitest run engine/projection.test.ts  # one file
pnpm vitest run -t "information hiding"     # one test by name
pnpm typecheck                             # tsc --noEmit
pnpm build                                 # typecheck + production build
pnpm smoke                                 # submit one sample turn, wait, print output
```

Default tenant is **`demo`**. The `werewolf-*` agents are defined and registered
in the agentd repo (on `builtin://generic-agent`); nightfall just references them
by `agent_ref`. Local agentd is `http://127.0.0.1:8080`; production is over
Tailscale. Override with
`--tenant` / `--base-url` (CLI) or `VITE_AGENTD_URL` / `VITE_AGENTD_TENANT`
(browser). agentd has permissive CORS so the browser connects directly.

## Conventions

- Single pnpm package. Module aliases `@engine` / `@agentd` / `@orchestrator`
  are defined in BOTH `tsconfig.json` and `vite.config.ts` — keep them in sync.
  Non-app code (engine, orchestrator, agentd-client, scripts) uses relative
  imports with explicit `.js` extensions (ESM); the app uses the aliases.
- `vite.config.ts` doubles as the Vitest config; tests are colocated `*.test.ts`.
- `scripts/play.ts` runs under `tsx`.
- Extending the board (witch/guard/hunter, more seats): add the role/phase to
  `engine/types.ts`, extend `currentActors`/`validTargets`/`reduce`, **add new
  knowledge to `viewFor` only for the entitled role**, map the new role to its
  `agent_ref` in `engine/agent-map.ts` (define that agent in the agentd repo),
  and add a projection test.
