import type { Action, Faction, Phase, Role } from "@engine";

/**
 * Renderable timeline items. Pure VIEW data derived from orchestrator events +
 * the god-view GameState — no game rules here, only display. Language-specific
 * text (resolution lines, labels) is produced via app/i18n.ts.
 */
export type TimelineItem =
  | { id: number; kind: "phase"; day: number; phase: Phase; actors: number[] }
  | {
      id: number;
      kind: "decision";
      day: number;
      phase: Phase;
      seat: number;
      role: Role;
      action: Action;
      target: number | null;
      say: string;
      reason: string;
      error?: string;
    }
  | { id: number; kind: "resolution"; day: number; phase: Phase; text: string; tone: "kill" | "info" | "safe" }
  | { id: number; kind: "gameover"; winner: Faction };
