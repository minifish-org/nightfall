import { useCallback, useState } from "react";
import { AgentdClient, type AgentSummary, type ConnectionTest } from "@agentd";
import { SETTINGS, type Lang } from "./i18n.js";
import { REQUIRED_AGENTS } from "./seats.js";
import type { ConnectionSettings } from "./settings.js";

export function Settings({
  settings,
  onChange,
  lang,
}: {
  settings: ConnectionSettings;
  onChange: (s: ConnectionSettings) => void;
  lang: Lang;
}) {
  const t = SETTINGS[lang];
  const [test, setTest] = useState<ConnectionTest | null>(null);
  const [testing, setTesting] = useState(false);
  const [agents, setAgents] = useState<AgentSummary[] | null>(null);

  const newClient = () => new AgentdClient({ baseUrl: settings.baseUrl, tenant: settings.tenant, token: settings.token });
  const set = <K extends keyof ConnectionSettings>(key: K, value: ConnectionSettings[K]) => onChange({ ...settings, [key]: value });

  const refresh = useCallback(async () => {
    try {
      setAgents(await newClient().listAgents());
    } catch {
      setAgents([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.baseUrl, settings.tenant, settings.token]);

  const doTest = useCallback(async () => {
    setTesting(true);
    setTest(null);
    const result = await newClient().testConnection();
    setTest(result);
    setTesting(false);
    if (result.ok) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.baseUrl, settings.tenant, settings.token, refresh]);

  const registered = new Set(agents?.map((agent) => agent.name));
  const ready = agents !== null && REQUIRED_AGENTS.every((name) => registered.has(name));
  const statusColor = !test ? "#666" : test.ok ? "#070" : test.kind === "unauthorized" ? "#a60" : "#a00";
  const statusText = !test
    ? ""
    : test.ok
      ? t.ok(test.agentCount)
      : test.kind === "unauthorized"
        ? t.unauthorized
        : test.kind === "http"
          ? t.http(test.message)
          : t.network(test.message);
  const box = { border: "1px solid #ccc", borderRadius: 8, padding: 12, marginBottom: 12 } as const;
  const grid = { display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 10px", alignItems: "center" } as const;

  return (
    <div>
      <fieldset style={box}>
        <legend>{t.legend}</legend>
        <div style={grid}>
          <label>{t.baseUrl}</label>
          <input value={settings.baseUrl} onChange={(event) => set("baseUrl", event.target.value)} placeholder="http://127.0.0.1:8080" />
          <label>{t.token}</label>
          <input type="password" value={settings.token} onChange={(event) => set("token", event.target.value)} autoComplete="off" />
          <label>{t.tenant}</label>
          <input value={settings.tenant} onChange={(event) => set("tenant", event.target.value)} />
        </div>
        <div style={{ fontSize: 12, color: "#888", margin: "4px 0 8px" }}>{t.tokenHint}</div>
        <button onClick={doTest} disabled={testing}>{testing ? t.testing : t.test}</button>
        {statusText && <span style={{ marginLeft: 10, color: statusColor }}>{statusText}</span>}
      </fieldset>

      <fieldset style={box}>
        <legend>{t.seatsLegend}</legend>
        <p style={{ fontSize: 13, color: "#555", marginTop: 0 }}>{t.seatsIntro}</p>
        <button onClick={() => void refresh()}>{t.refresh}</button>
        {ready && <span style={{ marginLeft: 10, color: "#070" }}>{t.ready}</span>}
        <ul style={{ fontSize: 13, margin: "8px 0" }}>
          {REQUIRED_AGENTS.map((name) => {
            const agent = agents?.find((item) => item.name === name);
            return (
              <li key={name} style={{ color: agent ? "#070" : agents === null ? "#888" : "#a00" }}>
                <code>{name}</code>
                {agent?.model ? ` · ${agent.model}` : ` · ${agents === null ? "—" : t.missing}`}
              </li>
            );
          })}
        </ul>
      </fieldset>
    </div>
  );
}
