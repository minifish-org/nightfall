# Nightfall

A web-based **AI Werewolf** platform. Every seat is an AI player; the human is
an operator/spectator. The browser is the **referee** — it holds the
authoritative game state and decides what each AI seat is allowed to see.

```
┌─────────────────────── referee (Node CLI or browser) ─────────────────────┐
│  engine/        authoritative state · phase FSM · view projection · victory│
│  orchestrator/  env-agnostic runGame loop (drives FSM, calls agentCaller)  │
│                         │ per seat, per phase                              │
│              projected view (only what that seat may know)                 │
└─────────────────────────│──────────────────────────────────────────────────┘
                          ▼  POST /v1/turns  { payload: { input: <view> } }
                   ┌──────────────┐   external, never modified
                   │   agentd     │   wasm brains (persona + view → decision)
                   └──────────────┘
```

- **The referee is the only component that sees full state.** Each seat's
  "thinking" is one HTTP call to **agentd**; the referee sends only that seat's
  **projected view** as `payload.input` and reads back a structured decision
  from `output.final_decision`.
- **agentd is an external dependency** (`/Users/yusp/work/agentd`), consumed over
  HTTP only — never forked, embedded, or taught any werewolf rules.
- The Node CLI and the browser spectator reuse the **same** engine + orchestrator
  — the game loop is written once.

Board (see `/goal`): 6 seats — **2 wolf + 1 seer + 3 villager**, good 4 vs wolf 2,
no role reveal on death. Round loop: `night_seer → night_wolf → day_discuss →
day_vote → …`. Victory (屠边, checked after each death): wolves=0 → good wins;
all villagers dead OR the seer dead → wolves win (so killing the seer is an
instant wolf win). Full design in [docs/design.md](docs/design.md).

## Layout

| Path             | What                                                              |
| ---------------- | ----------------------------------------------------------------- |
| `engine/`        | Pure-TS referee core: setup, phase FSM, **view projection**, resolution, victory, deterministic replay. No DOM/network. |
| `orchestrator/`  | Environment-agnostic `runGame({ state, agentCaller, observer, options })` + the agentd-backed `agentCaller`. |
| `agentd-client/` | HTTP client for `POST /v1/turns` + tolerant decision decoding.    |
| `app/`           | React spectator (god-view, timeline, playback controls). No game rules. |
| `agents/`        | Seat manifests (one persona per role) applied to the external agentd. |
| `scripts/`       | `register-agents.sh`, `smoke-turn.sh`, `play.ts` (CLI runner).    |

## Prerequisites

- Node 18+ and `pnpm` (`npm i -g pnpm`).
- A running **agentd** with the shared `simple-bot` wasm published (it ships in
  the `demo` tenant) and an OpenAI-compatible LLM provider configured — both in
  the agentd repo, not here.

## Run against local agentd (`http://127.0.0.1:8080`)

The default tenant is **`demo`**. The seat manifests run on agentd's built-in
native generic agent (`artifact_uri = "builtin://generic-agent"`) — no wasm to
build or publish; each manifest carries its own persona and model.

**1. Register the three seat brains** (wolf / seer / villager) on the running
agentd. The seat manifests live here; the `agentd-cli` that applies them lives
in the agentd repo:

```bash
# Use a prebuilt CLI if you have one, else fall back to `cargo run`:
AGENTD_CLI=/Users/yusp/work/agentd/target/debug/agentd-cli pnpm agents:register
```

`agents:register` applies `agents/*.toml` (tenant `demo`, running on agentd's
built-in generic agent — persona and model live in each manifest). Override the
CLI with `AGENTD_CLI=...` or point at the repo with `AGENTD_DIR=...`.

**2. Smoke-test one turn** end-to-end:

```bash
pnpm smoke                 # POST /v1/turns with a sample seer view, prints final_decision
```

**3a. Play a full game headless (CLI)** — prints a transcript:

```bash
pnpm play --seed 7
pnpm play --seed 7 --base-url http://127.0.0.1:8080 --tenant demo
```

**3b. Or watch it in the browser:**

```bash
pnpm dev                   # http://localhost:5173
```

Fill in agentd baseUrl / tenant / seed / step delay / agent_ref pool, press
**Start**, and watch the timeline render live. Pause / Resume / Step / Stop all
work. Point at a different agentd (e.g. the Tailscale HTTPS URL in production)
via `VITE_AGENTD_URL` / `VITE_AGENTD_TENANT`.

## Develop

```bash
pnpm test                                  # Vitest (engine + orchestrator + client)
pnpm test:watch                            # watch mode
pnpm vitest run engine/projection.test.ts  # a single file
pnpm vitest run -t "information hiding"     # a single test by name
pnpm typecheck                             # tsc --noEmit
pnpm build                                 # typecheck + production build
```

The keystone test is `engine/projection.test.ts`: it asserts the
information-hiding boundary — a wolf view carries `private.teammates`, villager
and seer views do not; only the seer's view carries `private.checks`; and
`public_log` never contains a role.
