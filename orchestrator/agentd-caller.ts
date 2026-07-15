import { AgentdClient } from "../agentd-client/index.js";
import { roleAgentRef, seatScope } from "../engine/index.js";
import type { Action, Decision, Role } from "../engine/index.js";
import type { AgentCaller } from "./types.js";
import { containsSeatReference, resolveCharacterTarget, toCharacterView, type SeatIdentityMap } from "./identity-view.js";

const ACTIONS: ReadonlySet<Action> = new Set(["check", "kill", "speak", "vote", "abstain"]);

export interface AgentdCallerConfig {
  client: AgentdClient;
  /** Feeds the seat scope game/<gameId>/seat/<n>. */
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
 * the projected view as `payload` and coerces the returned
 * final_decision into a Decision. Retries a few times on an unusable response;
 * if all attempts fail it throws, so the orchestrator degrades and marks the
 * step errored.
 */
export function createAgentdCaller(cfg: AgentdCallerConfig): AgentCaller {
  const attempts = Math.max(1, (cfg.retries ?? 2) + 1);
  return async ({ seat, role, view }) => {
    const agentRef = roleAgentRef(role, cfg.pool);
    const scope = seatScope(cfg.gameId, seat);
    const lang = cfg.lang ?? "zh";
    const actor = cfg.identities?.[seat] ? (lang === "en" ? cfg.identities[seat].en : cfg.identities[seat].zh) : `seat ${seat}`;
    // `lang` rides inside `input`; the registered role persona handles every
    // phase, including last_words.
    const input = cfg.identities ? { ...toCharacterView(view, cfg.identities, lang), lang } : { ...view, lang };
    let lastError: Error = new Error(`${actor} produced no decision`);
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const res = await cfg.client.submitTurn({
          agentRef,
          scope,
          payload: input,
          wait: true,
          ...(cfg.timeoutMs !== undefined ? { timeoutMs: cfg.timeoutMs } : {}),
        });
        if (res.timedOut) throw new Error(`${actor} timed out`);
        return toDecision(res.finalDecision, cfg.identities);
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        // Fall through to retry; a fresh sample usually yields valid JSON.
      }
    }
    throw lastError;
  };
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
