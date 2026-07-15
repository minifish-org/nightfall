import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentdClient } from "./client.js";

afterEach(() => vi.unstubAllGlobals());

describe("AgentdClient tenant API", () => {
  it("tests and lists through the tenant-scoped read endpoint", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(
      JSON.stringify([{ tenant: "werewolf", name: "werewolf-seer", model: "standard/chat" }]),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const client = new AgentdClient({ baseUrl: "https://agentd.example/", tenant: "werewolf", token: "secret" });

    await expect(client.testConnection()).resolves.toEqual({ ok: true, agentCount: 1 });
    await expect(client.listAgents()).resolves.toHaveLength(1);

    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).toBe("https://agentd.example/v1/tenants/werewolf/agents");
      expect(init.headers).toMatchObject({ authorization: "Bearer secret" });
    }
  });

  it("submits only the current tenant-scoped turn shape", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        run_id: "run-1",
        status: "queued",
      }), { status: 202, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        run_id: "run-1",
        status: "succeeded",
        timed_out: false,
        output: { action: "vote", target: "nahida" },
      }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new AgentdClient({ baseUrl: "https://agentd.example", tenant: "werewolf" });
    const payload = { phase: "day_vote", valid_targets: [{ id: "nahida" }] };

    await expect(client.submitTurn({ agentRef: "werewolf-seer", scope: "game/1/seat/1", payload })).resolves.toMatchObject({
      runId: "run-1",
      status: "succeeded",
      finalDecision: { action: "vote", target: "nahida" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://agentd.example/v1/tenants/werewolf/turns");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      agent: "werewolf-seer",
      scope: "game/1/seat/1",
      payload,
    });
    const [waitUrl, waitInit] = fetchMock.mock.calls[1]!;
    expect(waitUrl).toBe("https://agentd.example/v1/tenants/werewolf/runs/run-1/wait?timeout_ms=60000");
    expect(waitInit.method).toBeUndefined();
  });
});
