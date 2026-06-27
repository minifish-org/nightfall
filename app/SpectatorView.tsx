import type { Faction, GameState, Phase, Role } from "@engine";
import type { SeatIdentityMap } from "@orchestrator";
import { characterForSeat, characterLabel, characterName } from "./characters.js";
import { PHASE_LABEL, ROLE_NAME, UI, winnerText, type Lang } from "./i18n.js";
import type { PublicSeat, PublicTimelineItem } from "./spectate.js";

const ROLE_EMOJI: Record<Role, string> = { wolf: "🐺", seer: "🔮", villager: "🧑‍🌾" };

function dayText(lang: Lang, day: number): string {
  const t = UI[lang];
  return lang === "zh" ? `${t.dayWord}${day}${t.dayUnit}` : `${t.dayWord} ${day}`;
}

/** Seat panel WITHOUT roles — only public liveness. */
export function SpectatorSeatPanel({
  lang,
  seats,
  phase,
  day,
  winner,
  identities,
}: {
  lang: Lang;
  seats: PublicSeat[];
  phase: Phase;
  day: number;
  winner: Faction | null;
  identities?: SeatIdentityMap;
}) {
  const t = UI[lang];
  const diedLabel = (p: PublicSeat["diedPhase"]) =>
    lang === "zh"
      ? p === "night_wolf"
        ? "夜里出局"
        : "被放逐"
      : p === "night_wolf"
        ? "killed at night"
        : "banished";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
      {seats.map((s) => (
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
              👤 {identities ? characterName(characterForSeat(identities, s.seat), lang) : `${t.seat} ${s.seat}`} {s.alive ? "" : "💀"}
            </div>
          {!s.alive && s.diedPhase && (
            <div style={{ fontSize: 12, color: "#a00" }}>
              {diedLabel(s.diedPhase)} ({dayText(lang, s.diedDay ?? 0)})
            </div>
          )}
        </div>
      ))}
      <div style={{ gridColumn: "1 / -1", fontSize: 13, color: "#444" }}>
        {dayText(lang, day)} · {t.phaseWord} {PHASE_LABEL[lang][phase]}
        {winner ? ` · ${winnerText(winner, lang).replace("🏁 ", "")}` : ""}
      </div>
    </div>
  );
}

/** Timeline rendering ONLY public items (no roles, no reason, no night actions). */
export function SpectatorTimeline({ lang, items, identities }: { lang: Lang; items: PublicTimelineItem[]; identities?: SeatIdentityMap }) {
  const t = UI[lang];
  const name = (seat: number | null) => (identities ? characterLabel(identities, seat, lang, lang === "zh" ? "弃票" : "abstain") : seat ?? (lang === "zh" ? "弃票" : "abstain"));
  return (
    <div className="nf-log">
      {items.map((it) => {
        switch (it.kind) {
          case "phase":
            return (
              <div key={it.id} className="phase-row">
                {dayText(lang, it.day)} · {PHASE_LABEL[lang][it.phase]}
              </div>
            );
          case "speech":
            return (
              <div key={it.id} className="row">
                <span className="actor">{name(it.seat)}</span> <span className="say">“{it.say}”</span>
              </div>
            );
          case "vote":
            return (
              <div key={it.id} className="row">
                <span className="actor">{name(it.seat)}</span>{" "}
                {it.target !== null ? `🗳️ → ${name(it.target)}` : `🗳️ ${t.abstainBtn}`}
              </div>
            );
          case "resolution":
            return (
              <div key={it.id} className={`row t-${it.tone}`}>
                {it.text}
              </div>
            );
          case "gameover":
            return (
              <div key={it.id} className="gameover">
                {winnerText(it.winner, lang)}
              </div>
            );
        }
      })}
    </div>
  );
}

/** End-of-game role reveal (shown only at terminal, or in god mode). */
export function RevealPanel({ lang, game, identities }: { lang: Lang; game: GameState; identities?: SeatIdentityMap }) {
  const t = UI[lang];
  return (
    <div style={{ border: "1px solid #c9a227", background: "#fffdf5", borderRadius: 8, padding: 10, margin: "8px 0" }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>🎭 {t.revealTitle}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, fontSize: 13 }}>
        {game.seats.map((s) => (
          <div key={s.seat} style={{ opacity: s.alive ? 1 : 0.5 }}>
            {ROLE_EMOJI[s.role]} {identities ? characterName(characterForSeat(identities, s.seat), lang) : `${t.seat} ${s.seat}`} · {ROLE_NAME[lang][s.role]} {s.alive ? "" : "💀"}
          </div>
        ))}
      </div>
    </div>
  );
}
