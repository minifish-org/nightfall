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
                          ▼  POST /v1/tenants/:tenant/turns  { payload: <view> }
                   ┌──────────────┐   external, never modified
                   │   agentd     │   agent brains (persona + view → decision)
                   └──────────────┘
```

- **The referee is the only component that sees full state.** Each seat's
  "thinking" is one HTTP call to **agentd**; the referee sends only that seat's
  **projected view** as `payload` and reads back a structured decision
  directly from `output`.
- **agentd is an external dependency** (`/Users/yusp/work/agentd`), consumed over
  HTTP only — never forked, embedded, or taught any werewolf rules. agentd owns
  the `werewolf-*` agent definitions (persona + model); Nightfall only picks the
  agent name per role and never writes agent configuration.
- The Node CLI and the browser spectator reuse the **same** engine + orchestrator
  — the game loop is written once.

Board (see `/goal`): 6 seats — **2 wolf + 1 seer + 3 villager**, good 4 vs wolf 2,
no role reveal on death. Round loop: `night_seer → night_wolf → day_discuss →
day_vote → …`. Victory (屠民, checked after each death): wolves=0 → good wins;
all 3 villagers dead → wolves win. Killing the seer doesn't end the game (it only
removes good's information). Full design in [docs/design.md](docs/design.md).

## Layout

| Path             | What                                                              |
| ---------------- | ----------------------------------------------------------------- |
| `engine/`        | Pure-TS referee core: setup, phase FSM, **view projection**, resolution, victory, deterministic replay. No DOM/network. |
| `orchestrator/`  | Environment-agnostic `runGame({ state, agentCaller, observer, options })` + the agentd-backed `agentCaller`. |
| `agentd-client/` | HTTP client for tenant-scoped turns + tolerant decision decoding. |
| `app/`           | React spectator (god-view, timeline, playback controls). No game rules. |
| `scripts/`       | `smoke-turn.sh`, `play.ts` (CLI runner).                          |

The `werewolf-wolf/seer/villager/judge` agents (persona + model) live in the **agentd
repo**, not here — nightfall only maps `role → agent_ref` in
`engine/agent-map.ts`.

## Prerequisites

- Node 18+ and `pnpm` (`npm i -g pnpm`).
- A running **agentd** with the `werewolf-wolf/seer/villager/judge` agents registered
  (they're defined in the agentd repo) and an
  OpenAI-compatible LLM provider configured — all on the agentd side, not here.

## Run against local agentd (`http://127.0.0.1:8080`)

The default tenant is **`werewolf`**. Nightfall references the agents by name
(`werewolf-wolf/seer/villager`) — it does not define or register them; that's
done in the agentd repo.

**1. Smoke-test one turn** end-to-end (confirms agentd is up and the agent answers):

```bash
pnpm smoke                 # POST a tenant-scoped turn and print output
```

**2a. Play a full game headless (CLI)** — prints a transcript:

```bash
pnpm play --seed 7
pnpm play --seed 7 --base-url http://127.0.0.1:8080 --tenant demo
```

**2b. Or watch it in the browser:**

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
