import { useState } from "react";
import { AgentdClient } from "@agentd";
import type { GameState, Role } from "@engine";
import type { SeatIdentityMap } from "@orchestrator";
import { characterForSeat, characterLabel, characterName } from "./characters.js";
import { ROLE_NAME, UI, winnerText, type Lang } from "./i18n.js";
import type { ConnectionSettings } from "./settings.js";
import { buildRecap, seatFate, tallyVotes, voteMvp, type MvpResult } from "./summary.js";
import type { TimelineItem } from "./timeline.js";

const ROLE_EMOJI: Record<Role, string> = { wolf: "🐺", seer: "🔮", villager: "🧑‍🌾" };

function tallyLine(tally: { seat: number; count: number }[], seatWord: string, unit: string, lang: Lang, identities?: SeatIdentityMap): string {
  if (tally.length === 0) return "—";
  const top = tally[0]!;
  const name = (seat: number) => (identities ? characterLabel(identities, seat, lang) : `${seatWord} ${seat}`);
  const rest = tally.slice(1).map((x) => `${name(x.seat)}:${x.count}`).join("  ");
  return `${name(top.seat)} (${top.count} ${unit})${rest ? "  ·  " + rest : ""}`;
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
  humanSeat,
  identities,
}: {
  lang: Lang;
  game: GameState;
  timeline: TimelineItem[];
  connection: ConnectionSettings;
  showRoles: boolean;
  humanSeat: number | null;
  identities: SeatIdentityMap;
}) {
  const t = UI[lang];
  const [result, setResult] = useState<MvpResult | null>(null);
  const [voting, setVoting] = useState(false);
  const [hBest, setHBest] = useState<number | null>(null);
  const [hWorst, setHWorst] = useState<number | null>(null);
  const [hReason, setHReason] = useState("");
  const recap = buildRecap(timeline, lang, identities);
  const seatNums = game.seats.map((s) => s.seat);
  const humanReady = humanSeat === null || (hBest !== null && hWorst !== null);

  const runVote = async () => {
    setVoting(true);
    setResult(null);
    try {
      const client = new AgentdClient({ baseUrl: connection.baseUrl, tenant: connection.tenant, token: connection.token });
      const aiVotes = await voteMvp(client, game, timeline, lang, humanSeat, identities);
      const votes = [...aiVotes];
      // The local human casts their OWN ballot — never the AI on their behalf.
      if (humanSeat !== null && hBest !== null && hWorst !== null) {
        votes.push({ voter: humanSeat, best: hBest, worst: hWorst, reason: hReason.trim(), human: true });
      }
      setResult({ votes, ...tallyVotes(votes) });
    } catch {
      setResult({ votes: [], bestTally: [], worstTally: [] });
    }
    setVoting(false);
  };

  const SeatRow = ({ label, picked, onPick }: { label: string; picked: number | null; onPick: (n: number) => void }) => (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", margin: "2px 0" }}>
      <span style={{ fontSize: 13, width: 36 }}>{label}</span>
      {seatNums.map((n) => (
        <button key={n} className={picked === n ? "nf-toggle is-on" : "nf-toggle"} onClick={() => onPick(n)}>
          {characterLabel(identities, n, lang)}
        </button>
      ))}
    </div>
  );

  return (
    <div className="nf-panel" style={{ padding: 12, margin: "8px 0", borderColor: "var(--gold)" }}>
      <div style={{ fontWeight: 700, fontSize: 16, fontFamily: "var(--font-display)", color: "var(--gold)" }}>
        📜 {t.summaryTitle}
        {game.winner ? ` · ${winnerText(game.winner, lang)}` : ""}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 4, fontSize: 13, margin: "6px 0" }}>
        {game.seats.map((s) => (
          <div key={s.seat} style={{ opacity: s.alive ? 1 : 0.6 }}>
            {showRoles ? ROLE_EMOJI[s.role] : "👤"} {characterName(characterForSeat(identities, s.seat), lang)}
            {showRoles ? ` · ${ROLE_NAME[lang][s.role]}` : ""} · {seatFate(game, s.seat, lang)}
          </div>
        ))}
      </div>

      {/* the local human casts their own ballot (not the AI on their behalf) */}
      {humanSeat !== null && (
        <div style={{ border: "1px dashed var(--good)", borderRadius: 6, padding: "6px 8px", margin: "6px 0", background: "rgba(90,166,239,0.08)" }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            🙋 {t.yourBallot} {characterLabel(identities, humanSeat, lang)}
          </div>
          <SeatRow label={`🏆${t.yourBest}`} picked={hBest} onPick={setHBest} />
          <SeatRow label={`💩${t.yourWorst}`} picked={hWorst} onPick={setHWorst} />
          <input
            value={hReason}
            onChange={(e) => setHReason(e.target.value)}
            placeholder={t.yourTake}
            style={{ width: "100%", boxSizing: "border-box", marginTop: 4 }}
          />
        </div>
      )}

      {/* run the vote (human ballot + AI ballots) */}
      <div>
        <button onClick={runVote} disabled={voting || !humanReady}>
          {voting ? t.voting : humanSeat !== null ? t.submitAndVote : t.mvpVote}
        </button>
        {result &&
          (result.votes.length === 0 ? (
            <span style={{ marginLeft: 8, color: "var(--blood)" }}>{t.mvpNoVotes}</span>
          ) : (
            <div style={{ margin: "6px 0" }}>
              <div style={{ fontWeight: 600 }}>
                {t.bestLabel}: {tallyLine(result.bestTally, t.seat, t.votesUnit, lang, identities)}
              </div>
              <div style={{ fontWeight: 600 }}>
                {t.worstLabel}: {tallyLine(result.worstTally, t.seat, t.votesUnit, lang, identities)}
              </div>
              <ul style={{ fontSize: 12, color: "var(--text-dim)", margin: "4px 0" }}>
                {result.votes.map((v) => (
                  <li key={v.voter} style={v.human ? { fontWeight: 600 } : undefined}>
                    {characterLabel(identities, v.voter, lang)}
                    {v.human ? ` ${t.youTag}` : ""} → 🏆{characterLabel(identities, v.best, lang)} 💩{characterLabel(identities, v.worst, lang)}
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
        <ol style={{ fontSize: 12, color: "var(--text-dim)", maxHeight: 220, overflow: "auto" }}>
          {recap.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ol>
      </details>
    </div>
  );
}
