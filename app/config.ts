import { ROLE_AGENT_REF } from "@engine";
import type { Role } from "@engine";
import type { Lang } from "./i18n.js";

/**
 * Per-game spectator config (seed / pacing / language / agent_ref pool).
 * agentd CONNECTION (baseUrl / token / tenant) lives separately in
 * settings.ts (persisted), edited in the Settings panel.
 */
export interface SpectatorConfig {
  seed: number;
  /** Delay between steps in autoplay, ms. */
  stepDelayMs: number;
  /** Drives BOTH the UI strings and the language the agents reply in. */
  lang: Lang;
  /** agent_ref pool: which registered agent plays each role. */
  pool: Record<Role, string>;
}

export const DEFAULT_CONFIG: SpectatorConfig = {
  seed: 1,
  stepDelayMs: 800,
  lang: "zh",
  pool: { ...ROLE_AGENT_REF },
};
