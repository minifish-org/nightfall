import { defaultSeatModels } from "./seats.js";

/**
 * agentd connection settings — editable in the Settings UI, persisted to
 * localStorage, with env defaults (VITE_AGENTD_BASE_URL / _TOKEN / _TENANT).
 * The token is stored locally only and never baked into the build.
 *
 * `models` is the per-seat LLM model id (agent name → model), written into each
 * seat's manifest spec.model when initializing seats.
 */
export interface ConnectionSettings {
  baseUrl: string;
  token: string;
  tenant: string;
  models: Record<string, string>;
}

const KEY = "nightfall.connection.v1";

export const DEFAULT_CONNECTION: ConnectionSettings = {
  baseUrl: import.meta.env.VITE_AGENTD_BASE_URL ?? import.meta.env.VITE_AGENTD_URL ?? "http://127.0.0.1:8080",
  token: import.meta.env.VITE_AGENTD_TOKEN ?? "",
  tenant: import.meta.env.VITE_AGENTD_TENANT ?? "werewolf",
  models: defaultSeatModels(),
};

export function loadConnection(): ConnectionSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<ConnectionSettings>;
      return {
        ...DEFAULT_CONNECTION,
        ...stored,
        // Merge models so newly-added seats still get a default, and a stored
        // value without `models` (older versions) is backfilled.
        models: { ...DEFAULT_CONNECTION.models, ...(stored.models ?? {}) },
      };
    }
  } catch {
    /* ignore corrupt/blocked storage */
  }
  return { ...DEFAULT_CONNECTION, models: { ...DEFAULT_CONNECTION.models } };
}

export function saveConnection(s: ConnectionSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage blocked — settings stay in-memory for the session */
  }
}
