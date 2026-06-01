/**
 * agentd connection settings — editable in the Settings UI, persisted to
 * localStorage, with env defaults (VITE_AGENTD_BASE_URL / _TOKEN / _TENANT).
 * The token is stored locally only and never baked into the build.
 */
export interface ConnectionSettings {
  baseUrl: string;
  token: string;
  tenant: string;
}

const KEY = "nightfall.connection.v1";

export const DEFAULT_CONNECTION: ConnectionSettings = {
  baseUrl: import.meta.env.VITE_AGENTD_BASE_URL ?? import.meta.env.VITE_AGENTD_URL ?? "http://127.0.0.1:8080",
  token: import.meta.env.VITE_AGENTD_TOKEN ?? "",
  tenant: import.meta.env.VITE_AGENTD_TENANT ?? "werewolf",
};

export function loadConnection(): ConnectionSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_CONNECTION, ...(JSON.parse(raw) as Partial<ConnectionSettings>) };
  } catch {
    /* ignore corrupt/blocked storage */
  }
  return { ...DEFAULT_CONNECTION };
}

export function saveConnection(s: ConnectionSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage blocked — settings stay in-memory for the session */
  }
}
