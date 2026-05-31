import { coerceDecision } from "./parse.js";

/**
 * Minimal client for agentd's transport-neutral pull API.
 *
 * One method matters: `submitTurn` → `POST /v1/turns`. The referee calls it
 * once per seat per phase, shipping the seat's projected view as `payload` and
 * reading the structured decision back from `output.final_decision`.
 *
 * agentd is consumed over HTTP ONLY. Nightfall never imports, forks, or embeds
 * agentd, and no werewolf rules live on the agentd side — a seat is a stateless
 * brain (persona + view in, decision out).
 */
export interface AgentdClientOptions {
  /** e.g. "http://127.0.0.1:8080" locally, or the Tailscale HTTPS URL in prod. */
  baseUrl: string;
  /** agentd tenant; seat manifests are applied under this tenant. */
  tenant: string;
  /** Default per-turn timeout in ms. */
  defaultTimeoutMs?: number;
}

export interface SubmitTurnArgs {
  /** Which persona/brain to use, e.g. "werewolf-seer". */
  agentRef: string;
  /** Session/lane scope, e.g. "game/<gameId>/seat/<n>". */
  scope: string;
  /** The seat's projected view — the only thing the seat may see. */
  payload: unknown;
  /** Wait for the run to finish and return its output (default true). */
  wait?: boolean;
  timeoutMs?: number;
  labels?: Record<string, string>;
  /** Per-turn system-prompt override. Debugging only — persona belongs in the manifest. */
  systemPrompt?: string;
}

export interface TurnResult {
  runId: string;
  status: string | null;
  timedOut: boolean;
  /** Raw RunOutputSummary as returned by agentd. */
  output: unknown;
  /** The agent's emitted decision, after tolerant JSON coercion. May be null. */
  finalDecision: Record<string, unknown> | null;
}

export class AgentdClient {
  private readonly baseUrl: string;
  private readonly tenant: string;
  private readonly defaultTimeoutMs: number;

  constructor(opts: AgentdClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.tenant = opts.tenant;
    this.defaultTimeoutMs = opts.defaultTimeoutMs ?? 60_000;
  }

  async submitTurn(args: SubmitTurnArgs): Promise<TurnResult> {
    const timeoutMs = args.timeoutMs ?? this.defaultTimeoutMs;
    const payload = args.systemPrompt
      ? { ...(args.payload as object), system_prompt: args.systemPrompt }
      : args.payload;

    const body = {
      tenant: this.tenant,
      agent_ref: args.agentRef,
      scope: args.scope,
      payload,
      wait: args.wait ?? true,
      timeout_ms: timeoutMs,
      ...(args.labels ? { labels: args.labels } : {}),
    };

    // Guard against a hung request beyond agentd's own timeout.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs + 5_000);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/v1/turns`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new Error(`agentd POST /v1/turns -> ${res.status} ${await res.text()}`);
    }

    const json = (await res.json()) as {
      run_id?: string;
      status?: string;
      timed_out?: boolean;
      output?: { final_decision?: unknown };
    };

    return {
      runId: json.run_id ?? "",
      status: json.status ?? null,
      timedOut: Boolean(json.timed_out),
      output: json.output ?? null,
      finalDecision: coerceDecision(json.output?.final_decision),
    };
  }
}
