import type { DeathPhase, Faction, Phase, Role } from "@engine";
import { PHASE_LABEL, ROLE_NAME, UI, winnerText, type Lang } from "./i18n.js";

const ROLE_EMOJI: Record<Role, string> = { wolf: "🐺", seer: "🔮", villager: "🧑‍🌾" };

/**
 * One seat as the table renders it. `role` is present ONLY when identities may
 * be shown (god view, or after the spectator reveal) — in spectator mode the
 * caller omits it, so roles never reach this component or the DOM.
 */
export interface TableSeat {
  seat: number;
  alive: boolean;
  role?: Role;
  diedPhase?: DeathPhase | null;
  diedDay?: number | null;
  isHuman?: boolean;
}

function fateText(lang: Lang, phase: DeathPhase | null | undefined, day: number | null | undefined): string {
  if (!phase) return "";
  const zh = lang === "zh";
  if (phase === "night_wolf") return zh ? `第${day}夜出局` : `night ${day}`;
  return zh ? `第${day}天放逐` : `banished d${day}`;
}

/**
 * The round table: players seated around a moonlit ellipse, the phase/day at
 * its center. Shared by god and spectator modes — the difference is only
 * whether `role` is populated on each TableSeat. Atmosphere (day vs night) is
 * driven by [data-phase] up on .nf-app, so this component is layout-only.
 */
export function RoundTable({
  lang,
  seats,
  day,
  phase,
  winner,
  focusSeat,
  bubble,
}: {
  lang: Lang;
  seats: TableSeat[];
  day: number;
  phase: Phase;
  winner: Faction | null;
  focusSeat: number | null;
  bubble: { seat: number; text: string } | null;
}) {
  const t = UI[lang];
  const n = seats.length;
  const dayLabel = lang === "zh" ? `${t.dayWord}${day}${t.dayUnit}` : `${t.dayWord} ${day}`;
  const isDay = phase.startsWith("day");

  return (
    <div className="nf-stage" aria-label="game table">
      <div className="nf-felt" />

      <div className="nf-center">
        {winner ? (
          <>
            <div className="nf-orb" />
            <div className="winner">{winnerText(winner, lang)}</div>
          </>
        ) : (
          <>
            <div className="nf-orb" title={isDay ? "day" : "night"} />
            <div className="day">{dayLabel}</div>
            <div className="phase">{PHASE_LABEL[lang][phase]}</div>
          </>
        )}
      </div>

      {seats.map((s, i) => {
        // Seat 1 at the top, going clockwise around the ellipse.
        const angle = (-90 + (360 / n) * i) * (Math.PI / 180);
        const left = 50 + 45 * Math.cos(angle);
        const top = 50 + 44 * Math.sin(angle);
        const acting = focusSeat === s.seat && s.alive && !winner;
        const cls = ["nf-seat", s.alive ? "" : "dead", acting ? "acting" : ""].filter(Boolean).join(" ");
        const avatarCls = ["nf-avatar", s.role ? `r-${s.role}` : ""].filter(Boolean).join(" ");
        return (
          <div key={s.seat} className={cls} style={{ left: `${left}%`, top: `${top}%` }}>
            {/* No s.alive gate: last words are spoken by a just-eliminated seat. */}
            {bubble && bubble.seat === s.seat && <div className="nf-bubble">{bubble.text}</div>}
            <div className={avatarCls}>
              {s.seat}
              {s.isHuman && <span className="you-tag" title={t.yourTurn}>🙋</span>}
            </div>
            <div className="name">
              {t.seat} {s.seat}
            </div>
            {s.role && (
              <div className={`role nf-role-${s.role}`}>
                {ROLE_EMOJI[s.role]} {ROLE_NAME[lang][s.role]}
              </div>
            )}
            {!s.alive && <div className="fate">{fateText(lang, s.diedPhase, s.diedDay)}</div>}
          </div>
        );
      })}
    </div>
  );
}
