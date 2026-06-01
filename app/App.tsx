import { useRef, useState } from "react";
import { fallbackDecision, viewFor } from "@engine";
import { DEFAULT_CONFIG, type SpectatorConfig } from "./config.js";
import { Controls, ConfigForm, SeatPanel, Timeline } from "./components.js";
import { Settings } from "./SettingsPanel.js";
import { SpectatorSeatPanel, SpectatorTimeline } from "./SpectatorView.js";
import { SummaryPanel } from "./SummaryPanel.js";
import { HumanPanel, HumanInfo } from "./HumanPanel.js";
import { UI } from "./i18n.js";
import { publicSeats, publicTimeline, type ViewMode } from "./spectate.js";
import { loadConnection, saveConnection, type ConnectionSettings } from "./settings.js";
import { useGameRunner } from "./useGameRunner.js";

const randomSeed = () => Math.floor(Math.random() * 1_000_000_000);

export function App() {
  const [config, setConfig] = useState<SpectatorConfig>(DEFAULT_CONFIG);
  const [connection, setConnectionState] = useState<ConnectionSettings>(loadConnection);
  const [mode, setMode] = useState<ViewMode>("god");
  const [revealed, setRevealed] = useState(false);
  const runner = useGameRunner();
  const t = UI[config.lang];

  const setConnection = (c: ConnectionSettings) => {
    setConnectionState(c);
    saveConnection(c);
  };

  const seedEditedRef = useRef(false);
  const handleConfigChange = (c: SpectatorConfig) => {
    if (c.seed !== config.seed) seedEditedRef.current = true;
    setConfig(c);
  };

  const handleStart = () => {
    let seed = config.seed;
    if (!seedEditedRef.current) {
      seed = randomSeed();
      setConfig((c) => ({ ...c, seed }));
    }
    seedEditedRef.current = false;
    setRevealed(false);
    runner.start({ ...config, seed }, connection);
  };

  const playing = runner.status === "running" || runner.status === "paused";
  const lang = config.lang;
  const pending = runner.pendingHuman;
  // The human seat's own private view, computed from full state — persistent so
  // the player can always see their role / seer checks / wolf teammates in play
  // mode (not only during their own turn or in god view).
  const humanView = config.humanSeat !== null && runner.game ? viewFor(runner.game, config.humanSeat) : null;

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 1100, margin: "1.5rem auto", padding: "0 1rem" }}>
      <h1>{t.title}</h1>
      <p style={{ color: "#666", marginTop: -8 }}>{t.subtitle}</p>

      <Settings settings={connection} onChange={setConnection} lang={lang} />

      <ConfigForm config={config} onChange={handleConfigChange} disabled={playing} />
      <Controls
        lang={lang}
        status={runner.status}
        onStart={handleStart}
        onPause={runner.pause}
        onResume={runner.resume}
        onStep={runner.step}
        onStop={runner.stop}
      />

      {/* view-mode toggle */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "4px 0 10px" }}>
        <span style={{ fontSize: 13, color: "#555" }}>{t.viewModeLabel}:</span>
        {(["god", "spectator"] as ViewMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: "3px 10px",
              border: mode === m ? "2px solid #2563eb" : "1px solid #aaa",
              borderRadius: 6,
              background: mode === m ? "#dbeafe" : "#fff",
            }}
          >
            {m === "god" ? t.godMode : t.spectatorMode}
          </button>
        ))}
        {mode === "spectator" && <span style={{ fontSize: 12, color: "#888" }}>{t.spectatorNote}</span>}
      </div>

      {runner.error && (
        <p style={{ color: "crimson" }}>
          Error: {runner.error}
          <br />
          <span style={{ color: "#888" }}>{t.unreachableHint(connection.baseUrl)}</span>
        </p>
      )}

      {/* post-game summary + AI peer vote (roles shown in god mode, or after reveal) */}
      {runner.winner && runner.game && (
        <>
          {mode === "spectator" && (
            <button onClick={() => setRevealed((v) => !v)} style={{ margin: "4px 0" }}>
              {revealed ? t.hideReveal : t.reveal}
            </button>
          )}
          <SummaryPanel
            lang={lang}
            game={runner.game}
            timeline={runner.timeline}
            connection={connection}
            showRoles={mode === "god" || revealed}
            humanSeat={config.humanSeat}
          />
        </>
      )}

      {/* persistent private-info panel for the local human seat (always visible
          in play mode; the turn panel below covers it during their own turn) */}
      {humanView && !pending && (
        <div style={{ border: "1px solid #2563eb", borderRadius: 8, padding: "8px 12px", margin: "6px 0", background: "#f5f8ff" }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            🪪 {t.myPanelTitle} — {t.seat} {config.humanSeat}
          </div>
          <HumanInfo view={humanView} lang={lang} />
        </div>
      )}

      {/* local human seat input */}
      {pending && (
        <HumanPanel
          key={`${pending.day}:${pending.phase}:${pending.seat}`}
          req={pending}
          lang={lang}
          onSubmit={runner.submitHuman}
          onSkip={() => runner.submitHuman(fallbackDecision(pending.phase))}
        />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 360px) 1fr", gap: 20, marginTop: 8 }}>
        <section>
          <h2 style={{ fontSize: 16 }}>{t.seats}</h2>
          {runner.game === null ? (
            <p style={{ color: "#888" }}>{t.noGame}</p>
          ) : mode === "god" ? (
            <SeatPanel lang={lang} game={runner.game} />
          ) : (
            <SpectatorSeatPanel
              lang={lang}
              seats={publicSeats(runner.game)}
              phase={runner.game.phase}
              day={runner.game.day}
              winner={runner.winner}
            />
          )}
        </section>
        <section>
          <h2 style={{ fontSize: 16 }}>{t.timeline}</h2>
          {runner.timeline.length === 0 ? (
            <p style={{ color: "#888" }}>{t.startHint}</p>
          ) : mode === "god" ? (
            <Timeline lang={lang} items={runner.timeline} />
          ) : (
            <SpectatorTimeline lang={lang} items={publicTimeline(runner.timeline, lang)} />
          )}
        </section>
      </div>
    </main>
  );
}
