import { coerceDecision } from "./parse.js";

/**
 * Minimal client for agentd's HTTP API. Consumed over HTTP ONLY — Nightfall
 * never imports, forks, or embeds agentd. Every request is prefixed with
 * `baseUrl`, carries `Authorization: Bearer <token>` when a token is set, and
 * targets the configured `tenant`.
 *
 * Surface used by Nightfall:
 *  - submitTurn   POST a run, then GET its wait endpoint to drive one seat
 *  - testConnection / listAgents                   read-only Settings UI
 */
export interface AgentdClientOptions {
  /** e.g. "http://127.0.0.1:8080" locally, or the Tailscale HTTPS URL in prod. */
  baseUrl: string;
  /** agentd tenant the seat agents live under. */
  tenant: string;
  /** Bearer token; required when agentd has auth enabled, else empty/omitted. */
  token?: string;
  /** Default per-turn timeout in ms. */
  defaultTimeoutMs?: number;
}

/** A registered agent as returned by GET /v1/tenants/:tenant/agents. */
export interface AgentSummary {
  name: string;
  tenant: string;
  model?: string | null;
}

/** Result of a connection probe, with the failure mode distinguished. */
export type ConnectionTest =
  | { ok: true; agentCount: number }
  | { ok: false; kind: "unauthorized" | "http" | "network"; status?: number; message: string };

export interface SubmitTurnArgs {
  agentRef: string;
  scope: string;
  payload: unknown;
  timeoutMs?: number;
}

export interface TurnResult {
  runId: string;
  status: string | null;
  timedOut: boolean;
  output: unknown;
  finalDecision: Record<string, unknown> | null;
}

export class AgentdClient {
  readonly baseUrl: string;
  readonly tenant: string;
  private readonly token: string;
  private readonly defaultTimeoutMs: number;

  constructor(opts: AgentdClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.tenant = opts.tenant;
    this.token = opts.token?.trim() ?? "";
    this.defaultTimeoutMs = opts.defaultTimeoutMs ?? 60_000;
  }

  private headers(json: boolean): Record<string, string> {
    const h: Record<string, string> = {};
    if (json) h["content-type"] = "application/json";
    if (this.token) h["authorization"] = `Bearer ${this.token}`;
    return h;
  }

  private url(path: string, query?: Record<string, string>): string {
    const u = new URL(this.baseUrl + path);
    if (query) for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
    return u.toString();
  }

  private tenantPath(path: string): string {
    return `/v1/tenants/${encodeURIComponent(this.tenant)}${path}`;
  }

  /** Probe connectivity + auth. Never throws; classifies the failure. */
  async testConnection(timeoutMs = 10_000): Promise<ConnectionTest> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(this.url(this.tenantPath("/agents")), {
        headers: this.headers(false),
        signal: ctrl.signal,
      });
      if (res.status === 401 || res.status === 403) {
        return { ok: false, kind: "unauthorized", status: res.status, message: `${res.status} — token 错误或缺失` };
      }
      if (!res.ok) {
        return { ok: false, kind: "http", status: res.status, message: `HTTP ${res.status}: ${await res.text()}` };
      }
      const data = (await res.json()) as unknown;
      return { ok: true, agentCount: Array.isArray(data) ? data.length : 0 };
    } catch (e) {
      return { ok: false, kind: "network", message: e instanceof Error ? e.message : String(e) };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Agents registered under the configured tenant. */
  async listAgents(): Promise<AgentSummary[]> {
    const res = await fetch(this.url(this.tenantPath("/agents")), { headers: this.headers(false) });
    if (!res.ok) throw new Error(`GET agents → ${res.status} ${await res.text()}`);
    const data = (await res.json()) as AgentSummary[];
    return Array.isArray(data) ? data : [];
  }

  /** Drive one seat's decision. */
  async submitTurn(args: SubmitTurnArgs): Promise<TurnResult> {
    const timeoutMs = args.timeoutMs ?? this.defaultTimeoutMs;
    const body = {
      agent: args.agentRef,
      scope: args.scope,
      payload: args.payload,
    };

    const submitCtrl = new AbortController();
    const submitTimer = setTimeout(() => submitCtrl.abort(), Math.min(timeoutMs + 5_000, 15_000));
    let submitRes: Response;
    try {
      submitRes = await fetch(this.url(this.tenantPath("/turns")), {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify(body),
        signal: submitCtrl.signal,
      });
    } finally {
      clearTimeout(submitTimer);
    }

    if (!submitRes.ok) throw new Error(`agentd POST turn → ${submitRes.status} ${await submitRes.text()}`);
    const submitted = (await submitRes.json()) as { run_id?: string };
    if (!submitted.run_id) throw new Error("agentd POST turn returned no run_id");

    const waitCtrl = new AbortController();
    const waitTimer = setTimeout(() => waitCtrl.abort(), timeoutMs + 5_000);
    let waitRes: Response;
    try {
      waitRes = await fetch(this.url(this.tenantPath(`/runs/${encodeURIComponent(submitted.run_id)}/wait`), {
        timeout_ms: String(timeoutMs),
      }), {
        headers: this.headers(false),
        signal: waitCtrl.signal,
      });
    } finally {
      clearTimeout(waitTimer);
    }

    if (!waitRes.ok) throw new Error(`agentd GET run wait → ${waitRes.status} ${await waitRes.text()}`);
    const json = (await waitRes.json()) as {
      run_id?: string;
      status?: string;
      timed_out?: boolean;
      output?: unknown;
    };

    return {
      runId: json.run_id ?? submitted.run_id,
      status: json.status ?? null,
      timedOut: Boolean(json.timed_out),
      output: json.output ?? null,
      finalDecision: coerceDecision(json.output),
    };
  }
}
