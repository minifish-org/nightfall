import { useEffect, useRef, useState } from "react";
import { fallbackDecision, viewFor } from "@engine";
import { DEFAULT_CONFIG, type SpectatorConfig } from "./config.js";
import { Controls, ConfigForm, Timeline } from "./components.js";
import { Settings } from "./SettingsPanel.js";
import { SpectatorTimeline } from "./SpectatorView.js";
import { RoundTable, type TableSeat } from "./RoundTable.js";
import { PhaseBanner } from "./PhaseBanner.js";
import { SummaryPanel } from "./SummaryPanel.js";
import { HumanPanel, HumanInfo } from "./HumanPanel.js";
import { UI, type Lang } from "./i18n.js";
import { ttsSupported } from "./tts.js";
import { publicTimeline, type PublicTimelineItem, type ViewMode } from "./spectate.js";
import { loadConnection, saveConnection, type ConnectionSettings } from "./settings.js";
import { useGameRunner } from "./useGameRunner.js";
import type { TimelineItem } from "./timeline.js";

const randomSeed = () => Math.floor(Math.random() * 1_000_000_000);

type Focus = { seat: number | null; bubble: { seat: number; text: string } | null };

/** A vote rendered as a short bubble, e.g. "🗳️ → 3号" / "🗳️ 弃票". */
function voteBubble(target: number | null, lang: Lang): string {
  if (target === null) return `🗳️ ${UI[lang].abstainBtn}`;
  return lang === "zh" ? `🗳️ → ${target}号` : `🗳️ → #${target}`;
}

/** Most recent actor (+ bubble) in the CURRENT phase, god timeline. Speeches and
 *  last words bubble their `say`; votes bubble who they voted for. */
function godFocus(items: TimelineItem[], lang: Lang): Focus {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i]!;
    if (it.kind === "decision") {
      const say = it.say.trim();
      let bubble: Focus["bubble"] = null;
      if ((it.phase === "day_discuss" || it.phase === "last_words") && say) bubble = { seat: it.seat, text: say };
      else if (it.phase === "day_vote") bubble = { seat: it.seat, text: voteBubble(it.action === "vote" ? it.target : null, lang) };
      return { seat: it.seat, bubble };
    }
    if (it.kind === "phase" || it.kind === "gameover") break;
  }
  return { seat: null, bubble: null };
}

/** Same, but from the public (spectator) timeline — no night actions exist here. */
function pubFocus(items: PublicTimelineItem[], lang: Lang): Focus {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i]!;
    if (it.kind === "speech") return { seat: it.seat, bubble: { seat: it.seat, text: it.say } };
    if (it.kind === "vote") return { seat: it.seat, bubble: { seat: it.seat, text: voteBubble(it.target, lang) } };
    if (it.kind === "phase" || it.kind === "gameover") break;
  }
  return { seat: null, bubble: null };
}

export function App() {
  const [config, setConfig] = useState<SpectatorConfig>(DEFAULT_CONFIG);
  const [connection, setConnectionState] = useState<ConnectionSettings>(loadConnection);
  const [mode, setMode] = useState<ViewMode>("god");
  const [revealed, setRevealed] = useState(false);
  const [ttsOn, setTtsOn] = useState(false);
  const runner = useGameRunner();
  const t = UI[config.lang];

  // Keep the runner's live TTS flag in sync with the toggle.
  const { setTts } = runner;
  useEffect(() => {
    setTts(ttsOn);
  }, [ttsOn, setTts]);

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
  const game = runner.game;
  // The human seat's own private view, computed from full state — persistent so
  // the player can always see their role / seer checks / wolf teammates in play
  // mode (not only during their own turn or in god view).
  const humanView = config.humanSeat !== null && game ? viewFor(game, config.humanSeat) : null;

  // Roles only surface in god mode, or after the spectator clicks reveal (which
  // is only available once the game is over) — so spectator play never leaks them.
  const showRoles = mode === "god" || revealed;
  const pubItems = game && mode === "spectator" ? publicTimeline(runner.timeline, lang) : null;

  let focus: Focus = { seat: null, bubble: null };
  if (game && !runner.winner) {
    focus = mode === "god" ? godFocus(runner.timeline, lang) : pubFocus(pubItems ?? [], lang);
    // While it's the human's turn, spotlight them (their decision isn't logged yet).
    if (pending) focus = { seat: pending.seat, bubble: null };
  }

  const tableSeats: TableSeat[] = game
    ? game.seats.map((s) => ({
        seat: s.seat,
        alive: s.alive,
        diedPhase: s.diedPhase,
        diedDay: s.diedDay,
        isHuman: s.seat === config.humanSeat,
        ...(showRoles ? { role: s.role } : {}),
      }))
    : [];

  return (
    <main className="nf-app" data-phase={game?.phase ?? "night_seer"} style={{ fontFamily: "var(--font)", maxWidth: 1180, margin: "1.5rem auto", padding: "0 1rem" }}>
      <PhaseBanner phase={game?.phase ?? null} day={game?.day ?? 0} lang={lang} />

      <header style={{ marginBottom: 10 }}>
        <h1>{t.title}</h1>
        <p style={{ color: "var(--text-dim)", marginTop: 2, fontSize: 13, maxWidth: 760 }}>{t.subtitle}</p>
      </header>

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

      {/* view-mode + TTS toggles */}
      <div className="nf-toolbar" style={{ margin: "4px 0 10px" }}>
        <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{t.viewModeLabel}:</span>
        {(["god", "spectator"] as ViewMode[]).map((m) => (
          <button key={m} className={`nf-toggle${mode === m ? " is-on" : ""}`} onClick={() => setMode(m)}>
            {m === "god" ? t.godMode : t.spectatorMode}
          </button>
        ))}
        {mode === "spectator" && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{t.spectatorNote}</span>}
        {ttsSupported() && (
          <button
            className={`nf-toggle${ttsOn ? " is-on" : ""}`}
            onClick={() => setTtsOn((v) => !v)}
            title="实验性:用浏览器内置语音朗读公开发言/事件"
            style={{ marginLeft: "auto" }}
          >
            {t.tts}
          </button>
        )}
      </div>

      {runner.error && (
        <p style={{ color: "var(--blood)" }}>
          Error: {runner.error}
          <br />
          <span style={{ color: "var(--text-faint)" }}>{t.unreachableHint(connection.baseUrl)}</span>
        </p>
      )}

      {/* post-game summary + AI peer vote (roles shown in god mode, or after reveal) */}
      {runner.winner && game && (
        <>
          {mode === "spectator" && (
            <button onClick={() => setRevealed((v) => !v)} style={{ margin: "4px 0" }}>
              {revealed ? t.hideReveal : t.reveal}
            </button>
          )}
          <SummaryPanel
            lang={lang}
            game={game}
            timeline={runner.timeline}
            connection={connection}
            showRoles={showRoles}
            humanSeat={config.humanSeat}
          />
        </>
      )}

      {/* persistent private-info panel for the local human seat */}
      {humanView && !pending && (
        <div className="nf-panel" style={{ padding: "8px 12px", margin: "6px 0", borderColor: "var(--good)" }}>
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

      <div className="nf-board">
        <section>
          {game === null ? (
            <p style={{ color: "var(--text-faint)", textAlign: "center", padding: "40px 0" }}>{t.startHint}</p>
          ) : (
            <RoundTable
              lang={lang}
              seats={tableSeats}
              day={game.day}
              phase={game.phase}
              winner={runner.winner}
              focusSeat={focus.seat}
              bubble={focus.bubble}
            />
          )}
        </section>
        <section>
          <h2>{t.timeline}</h2>
          {runner.timeline.length === 0 ? (
            <p style={{ color: "var(--text-faint)" }}>{t.startHint}</p>
          ) : mode === "god" ? (
            <Timeline lang={lang} items={runner.timeline} />
          ) : (
            <SpectatorTimeline lang={lang} items={pubItems ?? []} />
          )}
        </section>
      </div>
    </main>
  );
}
