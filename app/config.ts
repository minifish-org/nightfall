import { ROLE_AGENT_REF } from "@engine";
import type { Role } from "@engine";
import type { Lang } from "./i18n.js";

/** Spectator-page configuration (all fields editable in the UI). */
export interface SpectatorConfig {
  baseUrl: string;
  tenant: string;
  seed: number;
  /** Delay between steps in autoplay, ms. */
  stepDelayMs: number;
  /** Drives BOTH the UI strings and the language the agents reply in. */
  lang: Lang;
  /** agent_ref pool: which registered agent plays each role. */
  pool: Record<Role, string>;
}

export const DEFAULT_CONFIG: SpectatorConfig = {
  baseUrl: import.meta.env.VITE_AGENTD_URL ?? "http://127.0.0.1:8080",
  tenant: import.meta.env.VITE_AGENTD_TENANT ?? "demo",
  seed: 1,
  stepDelayMs: 800,
  lang: "zh",
  pool: { ...ROLE_AGENT_REF },
};
