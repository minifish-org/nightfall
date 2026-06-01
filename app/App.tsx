import { useRef, useState } from "react";
import { DEFAULT_CONFIG, type SpectatorConfig } from "./config.js";
import { Controls, ConfigForm, SeatPanel, Timeline } from "./components.js";
import { Settings } from "./SettingsPanel.js";
import { UI } from "./i18n.js";
import { loadConnection, saveConnection, type ConnectionSettings } from "./settings.js";
import { useGameRunner } from "./useGameRunner.js";

const randomSeed = () => Math.floor(Math.random() * 1_000_000_000);

export function App() {
  const [config, setConfig] = useState<SpectatorConfig>(DEFAULT_CONFIG);
  const [connection, setConnectionState] = useState<ConnectionSettings>(loadConnection);
  const runner = useGameRunner();
  const t = UI[config.lang];

  const setConnection = (c: ConnectionSettings) => {
    setConnectionState(c);
    saveConnection(c); // persist to localStorage on every change
  };

  // Track whether the user hand-edited the seed since the last Start. If not,
  // each Start rolls a fresh random seed (a new deal every game); if they did,
  // that Start reproduces their seed, then we revert to auto-random.
  const seedEditedRef = useRef(false);

  const handleConfigChange = (c: SpectatorConfig) => {
    if (c.seed !== config.seed) seedEditedRef.current = true;
    setConfig(c);
  };

  const handleStart = () => {
    let seed = config.seed;
    if (!seedEditedRef.current) {
      seed = randomSeed();
      setConfig((c) => ({ ...c, seed })); // show the seed actually used
    }
    seedEditedRef.current = false;
    runner.start({ ...config, seed }, connection);
  };

  const playing = runner.status === "running" || runner.status === "paused";

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 1100, margin: "1.5rem auto", padding: "0 1rem" }}>
      <h1>{t.title}</h1>
      <p style={{ color: "#666", marginTop: -8 }}>{t.subtitle}</p>

      <Settings settings={connection} onChange={setConnection} lang={config.lang} />

      <ConfigForm config={config} onChange={handleConfigChange} disabled={playing} />
      <Controls
        lang={config.lang}
        status={runner.status}
        onStart={handleStart}
        onPause={runner.pause}
        onResume={runner.resume}
        onStep={runner.step}
        onStop={runner.stop}
      />

      {runner.error && (
        <p style={{ color: "crimson" }}>
          Error: {runner.error}
          <br />
          <span style={{ color: "#888" }}>{t.unreachableHint(connection.baseUrl)}</span>
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 360px) 1fr", gap: 20, marginTop: 8 }}>
        <section>
          <h2 style={{ fontSize: 16 }}>{t.seats}</h2>
          <SeatPanel lang={config.lang} game={runner.game} />
        </section>
        <section>
          <h2 style={{ fontSize: 16 }}>{t.timeline}</h2>
          {runner.timeline.length === 0 ? (
            <p style={{ color: "#888" }}>{t.startHint}</p>
          ) : (
            <Timeline lang={config.lang} items={runner.timeline} />
          )}
        </section>
      </div>
    </main>
  );
}
