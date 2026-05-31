import type { GameState, Role } from "@engine";
import type { SpectatorConfig } from "./config.js";
import type { RunStatus } from "./useGameRunner.js";
import { ACTION_NAME, PHASE_LABEL, ROLE_NAME, UI, winnerText, type Lang } from "./i18n.js";
import type { TimelineItem } from "./timeline.js";

const ROLE_EMOJI: Record<Role, string> = { wolf: "🐺", seer: "🔮", villager: "🧑‍🌾" };

// ── Config form ──────────────────────────────────────────────────────────────
export function ConfigForm({
  config,
  onChange,
  disabled,
}: {
  config: SpectatorConfig;
  onChange: (c: SpectatorConfig) => void;
  disabled: boolean;
}) {
  const t = UI[config.lang];
  const set = <K extends keyof SpectatorConfig>(k: K, v: SpectatorConfig[K]) => onChange({ ...config, [k]: v });
  const setPool = (r: Role, v: string) => onChange({ ...config, pool: { ...config.pool, [r]: v } });
  return (
    <fieldset disabled={disabled} style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12 }}>
      <legend>{t.cfgLegend}</legend>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 10px", alignItems: "center" }}>
        <label>{t.language}</label>
        {/* Like the rest of config, the language is locked while a game runs
            (the parent fieldset is disabled). Set it when idle, then Start —
            that fixes both the UI strings and the AI output language for the game. */}
        <select
          value={config.lang}
          onChange={(e) => onChange({ ...config, lang: e.target.value as Lang })}
        >
          <option value="zh">中文</option>
          <option value="en">English</option>
        </select>
        <label>{t.baseUrl}</label>
        <input value={config.baseUrl} onChange={(e) => set("baseUrl", e.target.value)} />
        <label>{t.tenant}</label>
        <input value={config.tenant} onChange={(e) => set("tenant", e.target.value)} />
        <label>{t.seed}</label>
        <input type="number" value={config.seed} onChange={(e) => set("seed", Number(e.target.value))} />
        <label>{t.stepDelay}</label>
        <input type="number" value={config.stepDelayMs} onChange={(e) => set("stepDelayMs", Number(e.target.value))} />
        {(["wolf", "seer", "villager"] as Role[]).map((r) => (
          <FragmentRow key={r} label={`${ROLE_EMOJI[r]} ${ROLE_NAME[config.lang][r]} ${t.agentRefSuffix}`}>
            <input value={config.pool[r]} onChange={(e) => setPool(r, e.target.value)} />
          </FragmentRow>
        ))}
      </div>
    </fieldset>
  );
}

function FragmentRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <label>{label}</label>
      {children}
    </>
  );
}

// ── Playback controls ────────────────────────────────────────────────────────
export function Controls({
  lang,
  status,
  onStart,
  onPause,
  onResume,
  onStep,
  onStop,
}: {
  lang: Lang;
  status: RunStatus;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStep: () => void;
  onStop: () => void;
}) {
  const t = UI[lang];
  const active = status === "running" || status === "paused";
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "10px 0" }}>
      <button onClick={onStart}>{active ? t.restart : t.start}</button>
      <button onClick={onPause} disabled={status !== "running"}>{t.pause}</button>
      <button onClick={onResume} disabled={status !== "paused"}>{t.resume}</button>
      <button onClick={onStep} disabled={!active} title={t.stepTip}>{t.step}</button>
      <button onClick={onStop} disabled={!active}>{t.stop}</button>
      <span style={{ marginLeft: 8, color: "#666" }}>{t.status}: <b>{status}</b></span>
    </div>
  );
}

// ── Seat panel (god view) ────────────────────────────────────────────────────
export function SeatPanel({ lang, game }: { lang: Lang; game: GameState | null }) {
  const t = UI[lang];
  if (!game) return <p style={{ color: "#888" }}>{t.noGame}</p>;
  const dayLabel = lang === "zh" ? `${t.dayWord}${game.day}${t.dayUnit}` : `${t.dayWord} ${game.day}`;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
      {game.seats.map((s) => (
        <div
          key={s.seat}
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 8,
            opacity: s.alive ? 1 : 0.45,
            background: s.alive ? "#fff" : "#f3f3f3",
          }}
        >
          <div style={{ fontWeight: 600 }}>
            {ROLE_EMOJI[s.role]} {t.seat} {s.seat} {s.alive ? "" : "💀"}
          </div>
          <div style={{ fontSize: 12, color: "#666" }}>{ROLE_NAME[lang][s.role]}</div>
          {!s.alive && (
            <div style={{ fontSize: 12, color: "#a00" }}>
              {t.diedPrefix}: {s.diedPhase} ({lang === "zh" ? `${t.dayWord}${s.diedDay}${t.dayUnit}` : `${t.dayWord} ${s.diedDay}`})
            </div>
          )}
        </div>
      ))}
      <div style={{ gridColumn: "1 / -1", fontSize: 13, color: "#444" }}>
        {dayLabel} · {t.phaseWord} {PHASE_LABEL[lang][game.phase]}
        {game.winner ? ` · ${winnerText(game.winner, lang).replace("🏁 ", "")}` : ""}
      </div>
    </div>
  );
}

// ── Timeline ─────────────────────────────────────────────────────────────────
export function Timeline({ lang, items }: { lang: Lang; items: TimelineItem[] }) {
  return (
    <div style={{ fontSize: 14, lineHeight: 1.5 }}>
      {items.map((it) => (
        <TimelineRow key={it.id} lang={lang} item={it} />
      ))}
    </div>
  );
}

function TimelineRow({ lang, item }: { lang: Lang; item: TimelineItem }) {
  const t = UI[lang];
  const dayLabel = lang === "zh" ? `${t.dayWord}${item.kind === "gameover" ? "" : item.day}${t.dayUnit}` : `${t.dayWord} ${item.kind === "gameover" ? "" : item.day}`;
  switch (item.kind) {
    case "phase":
      return (
        <div style={{ marginTop: 12, fontWeight: 700, borderBottom: "1px solid #eee" }}>
          {dayLabel} · {PHASE_LABEL[lang][item.phase]}
          <span style={{ fontWeight: 400, color: "#999" }}> · {t.acting}: {item.actors.join(", ") || "—"}</span>
        </div>
      );
    case "decision":
      return (
        <div style={{ marginLeft: 12, color: item.error ? "#a00" : "#222" }}>
          <span style={{ fontWeight: 600 }}>
            {t.seat} {item.seat} ({ROLE_NAME[lang][item.role]}) [{ACTION_NAME[lang][item.action]}
            {item.target !== null ? ` → ${item.target}` : ""}]
          </span>
          {item.error ? (
            <span> ⚠️ {item.error} → {t.fallback}</span>
          ) : (
            <>
              {item.say && <span> “{item.say}”</span>}
              {item.reason && <span style={{ color: "#888", fontStyle: "italic" }}> · {item.reason}</span>}
            </>
          )}
        </div>
      );
    case "resolution":
      return (
        <div style={{ marginLeft: 12, color: item.tone === "kill" ? "#a00" : item.tone === "safe" ? "#070" : "#225" }}>
          {item.text}
        </div>
      );
    case "gameover":
      return <div style={{ marginTop: 12, fontWeight: 800, fontSize: 18 }}>{winnerText(item.winner, lang)}</div>;
  }
}
