import type { DeathPhase, Faction, GameState, Phase } from "@engine";
import { publicResolutionText, type Lang } from "./i18n.js";
import type { TimelineItem } from "./timeline.js";

/** Board view mode. god = full (current); spectator = public-only. */
export type ViewMode = "god" | "spectator";

/**
 * ─────────────────────────────────────────────────────────────────────────
 * SPECTATOR PUBLIC PROJECTION (data layer, not CSS).
 * ─────────────────────────────────────────────────────────────────────────
 * Produces view-models that contain ONLY public information — no role, no
 * private.checks, no decision `reason`, no night actions, no kill proposals.
 * The spectator components render these objects, so roles/reasons never reach
 * the DOM (or even the component props) in spectator mode.
 */

/** A seat with its role stripped — only public liveness is exposed. */
export interface PublicSeat {
  seat: number;
  alive: boolean;
  diedPhase: DeathPhase | null;
  diedDay: number | null;
}

export function publicSeats(game: GameState): PublicSeat[] {
  return game.seats.map((s) => ({ seat: s.seat, alive: s.alive, diedPhase: s.diedPhase, diedDay: s.diedDay }));
}

export type PublicTimelineItem =
  | { id: number; kind: "phase"; day: number; phase: Phase }
  | { id: number; kind: "speech"; day: number; seat: number; say: string }
  | { id: number; kind: "vote"; day: number; seat: number; target: number | null }
  | { id: number; kind: "resolution"; text: string; tone: "kill" | "info" | "safe" }
  | { id: number; kind: "gameover"; winner: Faction };

/**
 * Map the full (god) timeline to the public one:
 *  - night decisions (check/kill) are DROPPED — they're secret;
 *  - day speeches/votes keep only seat + say / target (no role, no reason);
 *  - resolution is re-formatted with public-only text (seer checks dropped,
 *    night-kill shows only the victim seat, no roles/proposals);
 *  - phase headers keep the label but NOT the acting-seat list (which would
 *    reveal who the seer/wolves are).
 */
export function publicTimeline(items: TimelineItem[], lang: Lang): PublicTimelineItem[] {
  const out: PublicTimelineItem[] = [];
  for (const it of items) {
    switch (it.kind) {
      case "phase":
        out.push({ id: it.id, kind: "phase", day: it.day, phase: it.phase });
        break;
      case "decision": {
        if (it.phase === "day_discuss") {
          const say = (it.say ?? "").trim();
          if (say) out.push({ id: it.id, kind: "speech", day: it.day, seat: it.seat, say });
        } else if (it.phase === "day_vote") {
          out.push({ id: it.id, kind: "vote", day: it.day, seat: it.seat, target: it.action === "vote" ? it.target : null });
        }
        // night_seer / night_wolf decisions are intentionally dropped.
        break;
      }
      case "resolution": {
        const r = publicResolutionText(it.event, lang);
        if (r) out.push({ id: it.id, kind: "resolution", text: r.text, tone: r.tone });
        break;
      }
      case "gameover":
        out.push({ id: it.id, kind: "gameover", winner: it.winner });
        break;
    }
  }
  return out;
}
