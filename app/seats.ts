import type { AgentManifest } from "@agentd";
import type { Role } from "@engine";
import seerPrompt from "./prompts/werewolf-seer.txt?raw";
import villagerPrompt from "./prompts/werewolf-villager.txt?raw";
import wolfPrompt from "./prompts/werewolf-wolf.txt?raw";

/**
 * Seat agent definitions — Nightfall's source of truth for the game personas.
 * The system prompts are the .txt files in ./prompts (imported raw); the
 * agentd runtime, model id, and limits are fixed here. The Settings UI registers
 * these into the configured agentd tenant via POST /v1/agents/apply, replacing
 * the old `agentd-cli apply` step. Killing the seer no longer ends the game
 * (屠民), and the prompts reflect that.
 */
export interface SeatAgentDef {
  /** agent_ref / metadata.name on agentd. */
  name: string;
  /** Which engine role this agent plays (for display). */
  role: Role;
  /** LLM model id agentd should run this agent on. */
  model: string;
  /** Full persona. */
  systemPrompt: string;
}

export const SEAT_ARTIFACT_URI = "builtin://generic-agent";
export const SEAT_LIMITS = { timeout_ms: 60000, memory_mb: 128, max_steps: 16 } as const;
export const SEAT_MODEL = "standard/chat";

export const SEAT_AGENTS: SeatAgentDef[] = [
  { name: "werewolf-seer", role: "seer", model: SEAT_MODEL, systemPrompt: seerPrompt },
  { name: "werewolf-villager", role: "villager", model: SEAT_MODEL, systemPrompt: villagerPrompt },
  { name: "werewolf-wolf", role: "wolf", model: SEAT_MODEL, systemPrompt: wolfPrompt },
];

export const SEAT_NAMES = SEAT_AGENTS.map((s) => s.name);

/**
 * Suggested model ids for the gateway (the combobox datalist). NOT exhaustive —
 * the UI lets the user type any model id agentd accepts.
 */
export const MODEL_SUGGESTIONS = [
  "free/chat",
  "standard/chat",
  "premium/chat",
  "deepseek/chat",
  "deepseek/premium",
  "local/chat",
  "openrouter/auto",
  "openrouter/free",
  "openrouter/premium",
] as const;

/** Default per-seat model map (every seat → SEAT_MODEL). */
export function defaultSeatModels(): Record<string, string> {
  return Object.fromEntries(SEAT_AGENTS.map((s) => [s.name, s.model]));
}

/**
 * Build the POST /v1/agents/apply body for a seat under the given tenant.
 * `model` overrides the seat's default model (per-seat model selection).
 */
export function seatManifest(def: SeatAgentDef, tenant: string, model: string = def.model): AgentManifest {
  return {
    apiVersion: "agentd/v2alpha1",
    kind: "Agent",
    metadata: { name: def.name, tenant },
    spec: {
      artifact_uri: SEAT_ARTIFACT_URI,
      model: model.trim() || def.model,
      system_prompt: def.systemPrompt,
      limits: { ...SEAT_LIMITS },
    },
  };
}
