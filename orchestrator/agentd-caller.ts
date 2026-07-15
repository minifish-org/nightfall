import { AgentdClient } from "../agentd-client/index.js";
import { legalActions, roleAgentRef, seatScope } from "../engine/index.js";
import type { Action, Decision, Phase, Role } from "../engine/index.js";
import type { AgentCaller } from "./types.js";
import { containsSeatReference, resolveCharacterTarget, toCharacterView, type SeatIdentityMap } from "./identity-view.js";

const ACTIONS: ReadonlySet<Action> = new Set(["check", "kill", "speak", "vote", "abstain"]);

export interface AgentdCallerConfig {
  client: AgentdClient;
  /** Feeds the stable seat lane game/<gameId>/seat/<n>. */
  gameId: string;
  /** Optional role → agent_ref overrides (the UI's agent_ref pool). */
  pool?: Partial<Record<Role, string>>;
  /** Optional seat → public character identity map. Enables roleplay-mode input/output. */
  identities?: SeatIdentityMap;
  timeoutMs?: number;
  /**
   * Language tag the agent should reply in, sent as `payload.lang`. The
   * registered persona is instructed to honor `input.lang` in agentd's run
   * envelope, so
   * switching language needs NO agent re-registration. Defaults to "zh".
   */
  lang?: string;
  /**
   * Extra attempts when a turn yields no usable decision. The common failure is
   * an LLM returning an unusable decision. With
   * temperature > 0 a fresh attempt usually parses, so we retry before giving up
   * (which would degrade the seat to a fallback). Default 2 (→ 3 attempts).
   */
  retries?: number;
}

/**
 * Concrete AgentCaller backed by a live agentd. Sends the projected view as
 * `payload`, validates phase actions and targets, and retries unusable results.
 * Attempts use isolated context scopes on one stable seat lane. If all attempts
 * fail it throws, so the orchestrator degrades and marks the step errored.
 */
export function createAgentdCaller(cfg: AgentdCallerConfig): AgentCaller {
  const attempts = Math.max(1, (cfg.retries ?? 2) + 1);
  return async ({ seat, role, view, phase, day }) => {
    const agentRef = roleAgentRef(role, cfg.pool);
    const lane = seatScope(cfg.gameId, seat);
    const lang = cfg.lang ?? "zh";
    const actor = cfg.identities?.[seat] ? (lang === "en" ? cfg.identities[seat].en : cfg.identities[seat].zh) : `seat ${seat}`;
    const allowedActions = legalActions(phase);
    const input = cfg.identities
      ? { ...toCharacterView(view, cfg.identities, lang), lang, allowed_actions: allowedActions }
      : { ...view, lang, allowed_actions: allowedActions };
    let lastError: Error = new Error(`${actor} produced no decision`);
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        // Nightfall sends a complete projected state every turn, so rolling
        // chat context is redundant and can bias a vote toward the preceding
        // discussion. Isolate every attempt while keeping a stable seat lane.
        const scope = `${lane}/day/${day}/phase/${phase}/attempt/${attempt}`;
        const payload = attempt === 1 ? input : { ...input, previous_error: lastError.message };
        const res = await cfg.client.submitTurn({
          agentRef,
          scope,
          lane,
          payload,
          wait: true,
          ...(cfg.timeoutMs !== undefined ? { timeoutMs: cfg.timeoutMs } : {}),
        });
        if (res.timedOut) throw new Error(`${actor} timed out`);
        const decision = toDecision(res.finalDecision, cfg.identities);
        return validateDecision(decision, phase, view.valid_targets);
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        // Fall through to retry; a fresh sample usually yields valid JSON.
      }
    }
    throw lastError;
  };
}

function validateDecision(decision: Decision, phase: Phase, validTargets: number[]): Decision {
  if (!legalActions(phase).includes(decision.action)) {
    throw new Error(`illegal action "${decision.action}" in ${phase}`);
  }
  const requiresTarget = decision.action === "check" || decision.action === "kill" || decision.action === "vote";
  if (requiresTarget && (decision.target === null || !validTargets.includes(decision.target))) {
    throw new Error(`illegal target ${JSON.stringify(decision.target)} for ${decision.action} in ${phase}`);
  }
  if (!requiresTarget && decision.target !== null) {
    throw new Error(`action "${decision.action}" requires a null target in ${phase}`);
  }
  return decision;
}

/** Map a tolerantly-decoded final_decision into a strict Decision, or throw. */
function toDecision(raw: Record<string, unknown> | null, identities?: SeatIdentityMap): Decision {
  if (!raw) throw new Error("agent emitted no decision");
  const action = raw.action;
  if (typeof action !== "string" || !ACTIONS.has(action as Action)) {
    throw new Error(`agent emitted no valid action (got ${JSON.stringify(action)})`);
  }
  const say = typeof raw.say === "string" ? raw.say : "";
  const reason = typeof raw.reason === "string" ? raw.reason : "";
  if (identities && (containsSeatReference(say) || containsSeatReference(reason))) {
    throw new Error("agent emitted a seat reference in character mode");
  }
  const target = identities
    ? resolveCharacterTarget(raw.target, identities)
    : typeof raw.target === "number"
      ? raw.target
      : raw.target === null
        ? null
        : null;
  return {
    action: action as Action,
    target,
    say,
    reason,
  };
}
