import { useState } from "react";
import { AgentdClient } from "@agentd";
import type { GameState, Role } from "@engine";
import { ROLE_NAME, UI, winnerText, type Lang } from "./i18n.js";
import type { ConnectionSettings } from "./settings.js";
import { buildRecap, seatFate, voteMvp, type MvpResult } from "./summary.js";
import type { TimelineItem } from "./timeline.js";

const ROLE_EMOJI: Record<Role, string> = { wolf: "🐺", seer: "🔮", villager: "🧑‍🌾" };

function tallyLine(tally: { seat: number; count: number }[], seatWord: string, unit: string): string {
  if (tally.length === 0) return "—";
  const top = tally[0]!;
  const rest = tally.slice(1).map((x) => `${x.seat}:${x.count}`).join("  ");
  return `${seatWord} ${top.seat} (${top.count} ${unit})${rest ? "  ·  " + rest : ""}`;
}

/**
 * Post-game summary: winner, each seat's fate (roles shown when `showRoles`),
 * a round-by-round recap, and an AI peer vote for best/worst performer.
 */
export function SummaryPanel({
  lang,
  game,
  timeline,
  connection,
  showRoles,
}: {
  lang: Lang;
  game: GameState;
  timeline: TimelineItem[];
  connection: ConnectionSettings;
  showRoles: boolean;
}) {
  const t = UI[lang];
  const [result, setResult] = useState<MvpResult | null>(null);
  const [voting, setVoting] = useState(false);
  const recap = buildRecap(timeline, lang);

  const runVote = async () => {
    setVoting(true);
    setResult(null);
    try {
      const client = new AgentdClient({ baseUrl: connection.baseUrl, tenant: connection.tenant, token: connection.token });
      setResult(await voteMvp(client, game, timeline, lang));
    } catch {
      setResult({ votes: [], bestTally: [], worstTally: [] });
    }
    setVoting(false);
  };

  return (
    <div style={{ border: "1px solid #c9a227", background: "#fffdf5", borderRadius: 8, padding: 12, margin: "8px 0" }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>
        📜 {t.summaryTitle}
        {game.winner ? ` · ${winnerText(game.winner, lang)}` : ""}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 4, fontSize: 13, margin: "6px 0" }}>
        {game.seats.map((s) => (
          <div key={s.seat} style={{ opacity: s.alive ? 1 : 0.6 }}>
            {showRoles ? ROLE_EMOJI[s.role] : "👤"} {t.seat} {s.seat}
            {showRoles ? ` · ${ROLE_NAME[lang][s.role]}` : ""} · {seatFate(game, s.seat, lang)}
          </div>
        ))}
      </div>

      {/* AI peer vote */}
      <div>
        <button onClick={runVote} disabled={voting}>
          {voting ? t.voting : t.mvpVote}
        </button>
        {result &&
          (result.votes.length === 0 ? (
            <span style={{ marginLeft: 8, color: "#a00" }}>{t.mvpNoVotes}</span>
          ) : (
            <div style={{ margin: "6px 0" }}>
              <div style={{ fontWeight: 600 }}>
                {t.bestLabel}: {tallyLine(result.bestTally, t.seat, t.votesUnit)}
              </div>
              <div style={{ fontWeight: 600 }}>
                {t.worstLabel}: {tallyLine(result.worstTally, t.seat, t.votesUnit)}
              </div>
              <ul style={{ fontSize: 12, color: "#555", margin: "4px 0" }}>
                {result.votes.map((v) => (
                  <li key={v.voter}>
                    {t.seat} {v.voter} → 🏆{v.best} 💩{v.worst}
                    {v.reason ? ` · ${v.reason}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>

      <details>
        <summary style={{ cursor: "pointer", fontSize: 13 }}>
          {t.recapEvents} ({recap.length})
        </summary>
        <ol style={{ fontSize: 12, color: "#444", maxHeight: 220, overflow: "auto" }}>
          {recap.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ol>
      </details>
    </div>
  );
}
