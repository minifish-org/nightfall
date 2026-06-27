#!/usr/bin/env tsx
// Headless play runner: instantiate one game, drive the FSM by calling a live
// agentd for every seat decision, and print a readable transcript. Reuses the
// SAME engine + orchestrator the browser uses — no duplicated loop.
//
//   pnpm play --seed 7
//   pnpm play --seed 7 --base-url http://127.0.0.1:8080 --tenant nightfall
//
// Requires a running agentd with werewolf-wolf / werewolf-seer /
// werewolf-villager registered (those agents are defined in the agentd repo).

import { AgentdClient } from "../agentd-client/index.js";
import { createGame, ROLE_AGENT_REF } from "../engine/index.js";
import type { GameState, ResolutionEvent } from "../engine/index.js";
import { createAgentdCaller, runGame } from "../orchestrator/index.js";
import type { Observer } from "../orchestrator/index.js";
import { characterLabel, characterMapForHuman } from "../app/characters.js";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

const seed = Number(arg("seed", "1"));
const baseUrl = arg("base-url", process.env.AGENTD_BASE_URL ?? process.env.AGENTD_URL ?? "http://127.0.0.1:8080")!;
const tenant = arg("tenant", process.env.AGENTD_TENANT ?? "werewolf")!;
const token = arg("token", process.env.AGENTD_TOKEN ?? "")!;
const timeoutMs = Number(arg("timeout-ms", "60000"));
if (!Number.isFinite(seed)) {
  console.error("usage: pnpm play --seed <number> [--base-url URL] [--tenant T]");
  process.exit(1);
}

const PHASE_LABEL: Record<string, string> = {
  night_seer: "🔮 NIGHT — Seer",
  night_wolf: "🐺 NIGHT — Wolves",
  day_discuss: "💬 DAY — Discussion",
  day_vote: "🗳️  DAY — Vote",
};

const identities = characterMapForHuman(null);
const playerName = (seat: number | null) => characterLabel(identities, seat, "zh", "abstain");

function roleTag(state: GameState, seat: number): string {
  return `${playerName(seat)}(${state.seats.find((s) => s.seat === seat)!.role})`;
}

function describeResolution(state: GameState, e: ResolutionEvent): string | null {
  switch (e.type) {
    case "seer_check":
      return `   🔮 seer ${roleTag(state, e.seat)} checked ${roleTag(state, e.target)} → ${e.result.toUpperCase()}`;
    case "night_kill":
      return e.victim === null
        ? `   🌙 no one was killed`
        : `   🔪 wolves killed ${roleTag(state, e.victim)}${e.tie ? " (tie → seeded)" : ""}`;
    case "banish": {
      const tally = Object.entries(e.tally).map(([s, n]) => `${playerName(Number(s))}:${n}`).join(" ") || "—";
      return e.victim === null
        ? `   ⚖️  no banishment (votes ${tally}, abstain ${e.abstains})`
        : `   ⚖️  banished ${roleTag(state, e.victim)} (votes ${tally}, abstain ${e.abstains})${e.tie ? " (tie → seeded)" : ""}`;
    }
    case "game_over":
      return `\n🏁 GAME OVER — ${e.winner.toUpperCase()} wins`;
    case "death":
    case "phase_advance":
      return null; // covered by night_kill/banish and phase headers
  }
}

let lastPhaseKey = "";
const observer: Observer = {
  onGameStart(state) {
    console.log(`\n=== Nightfall game ${state.game_id} (seed ${seed}) ===`);
    console.log("Players: " + state.seats.map((s) => roleTag(state, s.seat)).join("  "));
    console.log(`agentd: ${baseUrl}  tenant: ${tenant}\n`);
  },
  onPhaseStart(e) {
    const key = `${e.day}:${e.phase}`;
    if (key !== lastPhaseKey) {
      console.log(`\n──────── Day ${e.day} · ${PHASE_LABEL[e.phase] ?? e.phase} ────────`);
      lastPhaseKey = key;
    }
  },
  onSeatDecision(e, state) {
    const who = roleTag(state, e.seat);
    if (e.error) {
      console.log(`   ⚠️  ${who} [${e.decision.action}] error: ${e.error} → fallback`);
      return;
    }
    const tgt = e.decision.target !== null ? ` → ${playerName(e.decision.target)}` : "";
    const say = e.decision.say ? `  “${e.decision.say}”` : "";
    console.log(`   ${who} [${e.decision.action}${tgt}]${say}`);
    if (e.decision.reason) console.log(`         · reason: ${e.decision.reason}`);
  },
  onResolution(e, state) {
    for (const ev of e.events) {
      const line = describeResolution(state, ev);
      if (line) console.log(line);
    }
  },
};

const client = new AgentdClient({ baseUrl, tenant, token, defaultTimeoutMs: timeoutMs });
// Unique game_id per run → fresh agentd scope (no context bleed across runs of
// the same seed). Engine replay depends only on (seed, decisions), not game_id.
const state = createGame(seed, `g${seed}-${Date.now().toString(36)}`);
const agentCaller = createAgentdCaller({ client, gameId: state.game_id, timeoutMs, identities });

console.log(`role → agent_ref: ${JSON.stringify(ROLE_AGENT_REF)}`);
runGame({ state, agentCaller, observer })
  .then((r) => {
    console.log(`\nFinal: ${r.winner ?? "(none)"} · ${r.state.seats.filter((s) => s.alive).length} alive`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("\nplay failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
