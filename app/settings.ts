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
const PRODUCTION_AGENTD_URL = "https://minifish-home.taila2cd17.ts.net";
const RETIRED_AGENTD_URLS = new Set([
  "https://macbook-air-for-home.taila2cd17.ts.net",
]);

export const DEFAULT_CONNECTION: ConnectionSettings = {
  baseUrl: import.meta.env.VITE_AGENTD_BASE_URL ?? import.meta.env.VITE_AGENTD_URL ?? PRODUCTION_AGENTD_URL,
  token: import.meta.env.VITE_AGENTD_TOKEN ?? "",
  tenant: import.meta.env.VITE_AGENTD_TENANT ?? "werewolf",
};

export function resolveConnection(stored: Partial<ConnectionSettings> = {}): ConnectionSettings {
  const rawBaseUrl = stored.baseUrl ?? DEFAULT_CONNECTION.baseUrl;
  const normalizedBaseUrl = rawBaseUrl.trim().replace(/\/+$/, "");
  const baseUrl = RETIRED_AGENTD_URLS.has(normalizedBaseUrl)
    ? DEFAULT_CONNECTION.baseUrl
    : rawBaseUrl;
  return {
    baseUrl,
    token: stored.token ?? DEFAULT_CONNECTION.token,
    tenant: stored.tenant ?? DEFAULT_CONNECTION.tenant,
  };
}

export function loadConnection(): ConnectionSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<ConnectionSettings>;
      return resolveConnection(stored);
    }
  } catch {
    /* ignore corrupt/blocked storage */
  }
  return resolveConnection();
}

export function saveConnection(s: ConnectionSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage blocked — settings stay in-memory for the session */
  }
}
