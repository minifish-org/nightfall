import { useState } from "react";
import type { Action, Decision, Faction, Phase, SeatView } from "@engine";
import type { SeatIdentityMap } from "@orchestrator";
import type { AgentRequest } from "@orchestrator";
import { characterLabel } from "./characters.js";
import { ACTION_NAME, ROLE_NAME, UI, type Lang } from "./i18n.js";

const factionTxt = (r: Faction, lang: Lang) => (r === "wolf" ? (lang === "zh" ? "狼" : "wolf") : lang === "zh" ? "好人" : "good");

/**
 * The human seat's OWN private info — role, seer checks (with results), wolf
 * teammates, and (during the kill turn) teammates' proposed kills. Reused by
 * the turn panel and the persistent panel. Shows only this seat's view.
 */
export function HumanInfo({ view, lang, identities }: { view: SeatView; lang: Lang; identities?: SeatIdentityMap }) {
  const t = UI[lang];
  const name = (seat: number | null) => (identities ? characterLabel(identities, seat, lang) : `${t.seat} ${seat}`);
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
          {checks.length === 0 ? t.noChecks : checks.map((c) => `${name(c.seat)}→${factionTxt(c.result, lang)}`).join("  ")}
        </div>
      )}
      {teammates && (
        <div>
          🐺 {t.teammatesLabel}: {teammates.length ? teammates.map((s) => name(s)).join("  ") : "—"}
        </div>
      )}
      {intents.length > 0 && (
        <div>
          🗡️ {t.intentsLabel}: {intents.map((i) => `${name(i.seat)}→${i.target === null ? "?" : name(i.target)}`).join("  ")}
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
    case "last_words":
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
  identities,
  onSubmit,
  onSkip,
}: {
  req: AgentRequest;
  lang: Lang;
  identities?: SeatIdentityMap;
  onSubmit: (d: Decision) => void;
  onSkip: () => void;
}) {
  const t = UI[lang];
  const { phase, view } = req;
  const name = (seat: number | null) => (identities ? characterLabel(identities, seat, lang) : `${t.seat} ${seat}`);
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
    <div className="nf-panel" style={{ padding: 12, margin: "10px 0", borderColor: "var(--good)", borderWidth: 2 }}>
      <div style={{ fontWeight: 700, fontSize: 16, color: "var(--good)" }}>
        🙋 {t.yourTurn} — {name(view.you.seat)}
      </div>
      <div style={{ fontSize: 13, color: "var(--text-dim)", margin: "2px 0 6px" }}>
        {t.phaseWord} {phase} · {t.dayWord}
        {lang === "zh" ? `${req.day}${t.dayUnit}` : ` ${req.day}`}
      </div>

      {/* own private info (role / seer checks / wolf teammates + intents) */}
      <HumanInfo view={view} lang={lang} {...(identities ? { identities } : {})} />

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
                className={target === seat ? "nf-toggle is-on" : "nf-toggle"}
                onClick={() => setTarget(seat)}
              >
                {name(seat)}
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
