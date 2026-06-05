import { useEffect, useRef, useState } from "react";
import type { Phase } from "@engine";
import type { Lang } from "./i18n.js";

/** Atmospheric, role-free banner text per phase (safe to show in spectator). */
const BANNER: Record<Lang, Partial<Record<Phase, { icon: string; text: string }>>> = {
  zh: {
    night_seer: { icon: "🌙", text: "天黑了" },
    night_wolf: { icon: "🌙", text: "长夜漫漫" },
    day_discuss: { icon: "☀️", text: "天亮了" },
    day_vote: { icon: "🗳️", text: "开始投票" },
    last_words: { icon: "🕯️", text: "遗言" },
    game_over: { icon: "🏁", text: "游戏结束" },
  },
  en: {
    night_seer: { icon: "🌙", text: "Night falls" },
    night_wolf: { icon: "🌙", text: "The night deepens" },
    day_discuss: { icon: "☀️", text: "Day breaks" },
    day_vote: { icon: "🗳️", text: "The vote begins" },
    last_words: { icon: "🕯️", text: "Last words" },
    game_over: { icon: "🏁", text: "Game over" },
  },
};

/**
 * A transient full-width announcement shown whenever the phase changes — the
 * "天黑了 / 天亮了" beat that makes the match feel narrated. Purely cosmetic:
 * it watches (phase, day) and self-dismisses after the CSS animation. Skips
 * the very first render so it only fires on actual transitions.
 */
export function PhaseBanner({ phase, day, lang }: { phase: Phase | null; day: number; lang: Lang }) {
  const [show, setShow] = useState<{ key: string; icon: string; text: string; day: number } | null>(null);
  const prevKey = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!phase) return;
    const key = `${phase}:${day}`;
    if (prevKey.current === key) return;
    prevKey.current = key;
    const b = BANNER[lang][phase];
    if (!b) return;
    setShow({ key, ...b, day });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(null), 1800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [phase, day, lang]);

  if (!show) return null;
  const isDay = !!phase && phase.startsWith("day");
  const dayLabel = lang === "zh" ? `第${show.day}${phase === "night_wolf" || phase === "night_seer" ? "夜" : "天"}` : `Day ${show.day}`;
  return (
    <div className="nf-banner-wrap">
      <div key={show.key} className={`nf-banner${isDay ? " day" : ""}`}>
        {show.icon} {show.text}
        <span style={{ fontSize: 14, opacity: 0.7, marginLeft: 10 }}>{dayLabel}</span>
      </div>
    </div>
  );
}
