import { roleAgentRef, type GameState, type Role } from "@engine";
import type { AgentdClient } from "@agentd";
import { ROLE_NAME, type Lang } from "./i18n.js";
import type { TimelineItem } from "./timeline.js";

/** Public end-of-game fate of a seat, e.g. "存活" / "第1夜出局" / "第2天被放逐". */
export function seatFate(game: GameState, seat: number, lang: Lang): string {
  const s = game.seats.find((x) => x.seat === seat)!;
  if (s.alive) return lang === "zh" ? "存活" : "alive";
  if (s.diedPhase === "night_wolf") return lang === "zh" ? `第${s.diedDay}夜出局` : `killed night ${s.diedDay}`;
  return lang === "zh" ? `第${s.diedDay}天被放逐` : `banished day ${s.diedDay}`;
}

/** A compact, public round-by-round recap (roles included — game is over). */
export function buildRecap(timeline: TimelineItem[], lang: Lang): string[] {
  const roleTxt = (r: Role) => ROLE_NAME[lang][r];
  const lines: string[] = [];
  for (const it of timeline) {
    if (it.kind === "decision") {
      if (it.phase === "day_discuss" && it.say.trim()) {
        lines.push(`D${it.day} ${lang === "zh" ? "座位" : "seat "}${it.seat}(${roleTxt(it.role)}) ${lang === "zh" ? "发言" : "says"}: ${it.say.trim()}`);
      } else if (it.phase === "day_vote") {
        lines.push(`D${it.day} ${lang === "zh" ? "座位" : "seat "}${it.seat} ${lang === "zh" ? "投票→" : "votes→"}${it.target ?? (lang === "zh" ? "弃票" : "abstain")}`);
      }
    } else if (it.kind === "resolution") {
      const e = it.event;
      if (e.type === "seer_check") {
        lines.push(`${lang === "zh" ? "夜" : "night"}${it.day} ${lang === "zh" ? "预言家座位" : "seer seat "}${e.seat} ${lang === "zh" ? "验" : "checks"} ${e.target} = ${e.result}`);
      } else if (e.type === "night_kill" && e.victim !== null) {
        lines.push(`${lang === "zh" ? "夜" : "night"}${it.day} ${lang === "zh" ? "座位" : "seat "}${e.victim} ${lang === "zh" ? "被刀" : "killed"}`);
      } else if (e.type === "banish" && e.victim !== null) {
        lines.push(`D${it.day} ${lang === "zh" ? "放逐座位" : "banished seat "}${e.victim}`);
      }
    }
  }
  return lines;
}

function mvpPrompt(lang: Lang): string {
  if (lang === "zh") {
    return [
      "这是一局已经结束的 AI 狼人杀的完整公开复盘(身份已揭晓)。你是评委。",
      "综合:发言逻辑、投票合理性、对本方阵营的贡献或欺骗水平,投票选出【本局最佳表现】和【最差表现】各一个座位。",
      "input 含:winner(获胜阵营)、seats(座位号/角色/结局)、events(逐回合公开事件)、you(你自己的座位,best 尽量别投自己)。",
      '只输出一个 JSON 对象,无多余文字、无 markdown:{ "best": 座位号, "worst": 座位号, "reason": "不超过30字的理由" }。best 与 worst 必须是有效座位号。',
    ].join("\n");
  }
  return [
    "This is the full public recap of a finished AI Werewolf game (roles revealed). You are a judge.",
    "Considering speech logic, voting soundness, and contribution/deception for one's faction, vote for the single BEST and single WORST performer (seat numbers).",
    "input has: winner, seats (seat/role/fate), events (round-by-round public log), you (your own seat; avoid voting yourself best).",
    'Output ONE JSON object only, no prose, no markdown: { "best": <seat>, "worst": <seat>, "reason": "<=20 words" }. best/worst must be valid seat numbers.',
  ].join("\n");
}

export interface MvpVote {
  voter: number;
  best: number;
  worst: number;
  reason: string;
  human?: boolean;
}
export interface MvpResult {
  votes: MvpVote[];
  bestTally: { seat: number; count: number }[];
  worstTally: { seat: number; count: number }[];
}

/** Tally best/worst counts from a set of ballots (AI + the human's own). */
export function tallyVotes(votes: MvpVote[]): Pick<MvpResult, "bestTally" | "worstTally"> {
  const tally = (pick: (v: MvpVote) => number) => {
    const m = new Map<number, number>();
    for (const v of votes) m.set(pick(v), (m.get(pick(v)) ?? 0) + 1);
    return [...m.entries()].map(([seat, count]) => ({ seat, count })).sort((a, b) => b.count - a.count);
  };
  return { bestTally: tally((v) => v.best), worstTally: tally((v) => v.worst) };
}

/**
 * AI peer vote: each AI seat casts one MVP/worst ballot via a one-off agentd
 * turn (system_prompt override turns the generic agent into a judge — no new
 * agent registration). The local human seat is SKIPPED here — the human casts
 * their own ballot in the UI. Runs concurrently; unparseable ballots skipped.
 */
export async function voteMvp(
  client: AgentdClient,
  game: GameState,
  timeline: TimelineItem[],
  lang: Lang,
  skipSeat?: number | null,
): Promise<MvpVote[]> {
  const seats = game.seats.map((s) => ({ seat: s.seat, role: ROLE_NAME[lang][s.role], fate: seatFate(game, s.seat, lang) }));
  const events = buildRecap(timeline, lang);
  const winner = game.winner;
  const prompt = mvpPrompt(lang);
  const seatNums = game.seats.map((s) => s.seat);
  const voters = game.seats.filter((s) => s.seat !== skipSeat);

  const ballots = await Promise.all(
    voters.map(async (s) => {
      try {
        const res = await client.submitTurn({
          agentRef: roleAgentRef(s.role),
          scope: `game/${game.game_id}/mvp/${s.seat}`,
          payload: { input: { winner, seats, events, you: s.seat, lang }, system_prompt: prompt },
          wait: true,
        });
        const d = res.finalDecision;
        const best = typeof d?.best === "number" ? d.best : null;
        const worst = typeof d?.worst === "number" ? d.worst : null;
        if (best === null || worst === null || !seatNums.includes(best) || !seatNums.includes(worst)) return null;
        return { voter: s.seat, best, worst, reason: typeof d?.reason === "string" ? d.reason : "" } as MvpVote;
      } catch {
        return null;
      }
    }),
  );

  return ballots.filter((b): b is MvpVote => b !== null);
}
