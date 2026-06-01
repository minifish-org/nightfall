import { useCallback, useState } from "react";
import { AgentdClient, type AgentSummary, type ConnectionTest } from "@agentd";
import { MODEL_SUGGESTIONS, SEAT_AGENTS, SEAT_NAMES, seatManifest } from "./seats.js";
import { ROLE_NAME, SETTINGS, type Lang } from "./i18n.js";
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
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [dft, setDft] = useState<string>(settings.models[SEAT_NAMES[0]!] ?? "standard/chat");

  const newClient = () => new AgentdClient({ baseUrl: settings.baseUrl, tenant: settings.tenant, token: settings.token });
  const set = <K extends keyof ConnectionSettings>(k: K, v: ConnectionSettings[K]) => onChange({ ...settings, [k]: v });
  const setModel = (name: string, m: string) => onChange({ ...settings, models: { ...settings.models, [name]: m } });
  const applyAllModels = (m: string) => onChange({ ...settings, models: Object.fromEntries(SEAT_NAMES.map((n) => [n, m])) });

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
    const r = await newClient().testConnection();
    setTest(r);
    setTesting(false);
    if (r.ok) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.baseUrl, settings.tenant, settings.token, refresh]);

  const initSeats = useCallback(async () => {
    setBusy(true);
    setLog([]);
    const c = newClient();
    const lines: string[] = [];
    for (const def of SEAT_AGENTS) {
      try {
        await c.applyAgent(seatManifest(def, settings.tenant, settings.models[def.name]));
        lines.push(t.seatOk(def.name));
      } catch (e) {
        lines.push(t.seatErr(def.name, e instanceof Error ? e.message : String(e)));
      }
      setLog([...lines]);
    }
    setBusy(false);
    void refresh();
    // Depend on the whole `settings` (incl. models) so a model change is not
    // captured stale — applying seats must use the latest per-seat models.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, t, refresh]);

  const del = useCallback(
    async (name: string) => {
      try {
        await newClient().deleteAgent(name);
      } finally {
        void refresh();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.baseUrl, settings.tenant, settings.token, refresh],
  );

  const seatsReady = agents !== null && SEAT_NAMES.every((n) => agents.some((a) => a.name === n));
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
      {/* ① connection */}
      <fieldset style={box}>
        <legend>{t.legend}</legend>
        <div style={grid}>
          <label>{t.baseUrl}</label>
          <input value={settings.baseUrl} onChange={(e) => set("baseUrl", e.target.value)} placeholder="http://127.0.0.1:8080" />
          <label>{t.token}</label>
          <input type="password" value={settings.token} onChange={(e) => set("token", e.target.value)} autoComplete="off" />
          <label>{t.tenant}</label>
          <input value={settings.tenant} onChange={(e) => set("tenant", e.target.value)} />
        </div>
        <div style={{ fontSize: 12, color: "#888", margin: "4px 0 8px" }}>{t.tokenHint}</div>
        <button onClick={doTest} disabled={testing}>
          {testing ? t.testing : t.test}
        </button>
        {statusText && <span style={{ marginLeft: 10, color: statusColor }}>{statusText}</span>}
      </fieldset>

      {/* ② seats */}
      <fieldset style={box}>
        <legend>{t.seatsLegend}</legend>
        <p style={{ fontSize: 13, color: "#555", marginTop: 0 }}>{t.seatsIntro}</p>

        {/* per-seat model selection */}
        <div style={{ margin: "0 0 10px" }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{t.modelsTitle}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "4px 0" }}>
            <label style={{ fontSize: 13 }}>{t.defaultModel}</label>
            <div style={{ width: 240 }}>
              <ModelSelect value={dft} onChange={setDft} lang={lang} />
            </div>
            <button onClick={() => applyAllModels(dft)}>{t.applyAll}</button>
          </div>
          {SEAT_AGENTS.map((def) => {
            const live = agents?.find((a) => a.name === def.name)?.spec?.model;
            const configured = settings.models[def.name] ?? def.model;
            return (
              <div key={def.name} style={{ display: "grid", gridTemplateColumns: "190px 1fr auto", gap: 8, alignItems: "center", margin: "2px 0" }}>
                <label style={{ fontSize: 13 }}>
                  {ROLE_NAME[lang][def.role]} <code style={{ color: "#888" }}>{def.name}</code>
                </label>
                <ModelSelect name={`model-${def.name}`} value={configured} onChange={(v) => setModel(def.name, v)} lang={lang} />
                <span style={{ fontSize: 12, color: live === configured ? "#070" : "#a60" }}>
                  {live ? t.runningModel(live) : ""}
                </span>
              </div>
            );
          })}
          <div style={{ fontSize: 12, color: "#888" }}>{t.modelHint}</div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={initSeats} disabled={busy}>
            {busy ? t.initializing : seatsReady ? t.reinitSeats : t.initSeats}
          </button>
          <button onClick={() => void refresh()} disabled={busy}>{t.refresh}</button>
          {seatsReady && <span style={{ color: "#070" }}>{t.ready}</span>}
        </div>

        {log.length > 0 && (
          <ul style={{ fontSize: 13, margin: "8px 0" }}>
            {log.map((l, i) => (
              <li key={i} style={{ color: l.startsWith("✓") ? "#070" : "#a00" }}>{l}</li>
            ))}
          </ul>
        )}

        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{t.registered}</div>
          {agents === null ? (
            <div style={{ fontSize: 13, color: "#888" }}>—</div>
          ) : agents.length === 0 ? (
            <div style={{ fontSize: 13, color: "#888" }}>{t.none}</div>
          ) : (
            <ul style={{ fontSize: 13, margin: "4px 0" }}>
              {agents.map((a) => (
                <li key={a.name} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <code>{a.name}</code>
                  {a.spec?.model && <span style={{ color: "#888" }}>· {a.spec.model}</span>}
                  <button style={{ fontSize: 11 }} onClick={() => void del(a.name)}>{t.del}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </fieldset>
    </div>
  );
}

const CUSTOM = "__custom__";

/**
 * Model picker: a native <select> of suggestions plus a "Custom…" option that
 * reveals a free-text input for any model id. Cleaner than a datalist combobox
 * (whose suggestion popup the browser renders inconsistently/ugly).
 */
function ModelSelect({
  value,
  onChange,
  lang,
  name,
}: {
  value: string;
  onChange: (v: string) => void;
  lang: Lang;
  name?: string;
}) {
  const known = (MODEL_SUGGESTIONS as readonly string[]).includes(value);
  const selectStyle: React.CSSProperties = {
    padding: "4px 6px",
    borderRadius: 6,
    border: "1px solid #aaa",
    flex: known ? 1 : "0 0 auto",
    minWidth: 0,
  };
  return (
    <span style={{ display: "flex", gap: 6, alignItems: "center", width: "100%" }}>
      <select
        name={name}
        value={known ? value : CUSTOM}
        onChange={(e) => onChange(e.target.value === CUSTOM ? (known ? "" : value) : e.target.value)}
        style={selectStyle}
      >
        {MODEL_SUGGESTIONS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
        <option value={CUSTOM}>{lang === "zh" ? "自定义…" : "Custom…"}</option>
      </select>
      {!known && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="model id"
          autoFocus
          style={{ flex: 1, minWidth: 0 }}
        />
      )}
    </span>
  );
}
