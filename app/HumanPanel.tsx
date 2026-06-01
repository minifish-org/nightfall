import { useState } from "react";
import type { Action, Decision, Faction, Phase, SeatView } from "@engine";
import type { AgentRequest } from "@orchestrator";
import { ACTION_NAME, ROLE_NAME, UI, type Lang } from "./i18n.js";

const factionTxt = (r: Faction, lang: Lang) => (r === "wolf" ? (lang === "zh" ? "狼" : "wolf") : lang === "zh" ? "好人" : "good");

/**
 * The human seat's OWN private info — role, seer checks (with results), wolf
 * teammates, and (during the kill turn) teammates' proposed kills. Reused by
 * the turn panel and the persistent panel. Shows only this seat's view.
 */
export function HumanInfo({ view, lang }: { view: SeatView; lang: Lang }) {
  const t = UI[lang];
  const p = view.private;
  const checks = "checks" in p ? p.checks : null;
  const teammates = "teammates" in p ? p.teammates : null;
  const intents = "teammate_intents" in p ? (p.teammate_intents ?? []) : [];
  return (
    <div style={{ fontSize: 13 }}>
      <div>
        {t.youAre}: <b>{ROLE_NAME[lang][view.you.role]}</b>
      </div>
      {checks && (
        <div>
          🔮 {t.yourChecks}:{" "}
          {checks.length === 0 ? t.noChecks : checks.map((c) => `${t.seat}${c.seat}→${factionTxt(c.result, lang)}`).join("  ")}
        </div>
      )}
      {teammates && (
        <div>
          🐺 {t.teammatesLabel}: {teammates.length ? teammates.map((s) => `${t.seat}${s}`).join("  ") : "—"}
        </div>
      )}
      {intents.length > 0 && (
        <div>
          🗡️ {t.intentsLabel}: {intents.map((i) => `${t.seat}${i.seat}→${i.target ?? "?"}`).join("  ")}
        </div>
      )}
    </div>
  );
}

/** The action a human must produce for a given phase. */
function phaseAction(phase: Phase): Action {
  switch (phase) {
    case "night_seer":
      return "check";
    case "night_wolf":
      return "kill";
    case "day_discuss":
      return "speak";
    default:
      return "vote"; // day_vote (abstain is a separate button)
  }
}

/**
 * Local human seat input. Shows ONLY this seat's own SeatView (the same
 * info-hiding boundary the AI gets — never other seats' roles), and produces a
 * Decision with the exact same schema the engine expects from AI seats.
 */
export function HumanPanel({
  req,
  lang,
  onSubmit,
  onSkip,
}: {
  req: AgentRequest;
  lang: Lang;
  onSubmit: (d: Decision) => void;
  onSkip: () => void;
}) {
  const t = UI[lang];
  const { phase, view } = req;
  const action = phaseAction(phase);
  const needsTarget = action === "check" || action === "kill" || action === "vote";

  // Inputs reset per turn via a `key` remount from the parent (App).
  const [target, setTarget] = useState<number | null>(null);
  const [say, setSay] = useState("");
  const [reason, setReason] = useState("");

  const submit = () => {
    const d: Decision = {
      action,
      target: needsTarget ? target : null,
      say: action === "speak" ? say.trim() : "",
      reason: reason.trim(),
    };
    onSubmit(d);
  };

  return (
    <div style={{ border: "2px solid #2563eb", borderRadius: 8, padding: 12, margin: "10px 0", background: "#f5f8ff" }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>
        🙋 {t.yourTurn} — {t.seat} {view.you.seat}
      </div>
      <div style={{ fontSize: 13, color: "#334", margin: "2px 0 6px" }}>
        {t.phaseWord} {phase} · {t.dayWord}
        {lang === "zh" ? `${req.day}${t.dayUnit}` : ` ${req.day}`}
      </div>

      {/* own private info (role / seer checks / wolf teammates + intents) */}
      <HumanInfo view={view} lang={lang} />

      {/* controls by phase */}
      {needsTarget && (
        <div style={{ margin: "6px 0" }}>
          <div style={{ fontSize: 13, marginBottom: 2 }}>
            {t.pickTarget} ({ACTION_NAME[lang][action]}):
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {view.valid_targets.map((seat) => (
              <button
                key={seat}
                onClick={() => setTarget(seat)}
                style={{
                  padding: "4px 10px",
                  border: target === seat ? "2px solid #2563eb" : "1px solid #aaa",
                  borderRadius: 6,
                  background: target === seat ? "#dbeafe" : "#fff",
                }}
              >
                {t.seat} {seat}
              </button>
            ))}
          </div>
        </div>
      )}

      {action === "speak" && (
        <textarea
          value={say}
          onChange={(e) => setSay(e.target.value)}
          placeholder={t.speakPlaceholder}
          rows={2}
          style={{ width: "100%", boxSizing: "border-box", margin: "6px 0" }}
        />
      )}

      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t.reasonPlaceholder}
        style={{ width: "100%", boxSizing: "border-box", margin: "2px 0 8px" }}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={submit} disabled={needsTarget && target === null}>
          {t.submit}
        </button>
        {phase === "day_vote" && (
          <button onClick={() => onSubmit({ action: "abstain", target: null, say: "", reason: reason.trim() })}>
            {t.abstainBtn}
          </button>
        )}
        <button onClick={onSkip} style={{ marginLeft: "auto" }}>
          {t.skipDefault}
        </button>
      </div>
    </div>
  );
}
