import { useRef, useState } from "react";
import { fallbackDecision } from "@engine";
import { DEFAULT_CONFIG, type SpectatorConfig } from "./config.js";
import { Controls, ConfigForm, SeatPanel, Timeline } from "./components.js";
import { Settings } from "./SettingsPanel.js";
import { SpectatorSeatPanel, SpectatorTimeline, RevealPanel } from "./SpectatorView.js";
import { HumanPanel } from "./HumanPanel.js";
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

          {/* reveal: god view already shows roles; in spectator, allow reveal at terminal */}
          {mode === "spectator" && runner.winner && runner.game && (
            <div style={{ marginTop: 8 }}>
              <button onClick={() => setRevealed((v) => !v)}>{revealed ? t.hideReveal : t.reveal}</button>
              {revealed && <RevealPanel lang={lang} game={runner.game} />}
            </div>
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
