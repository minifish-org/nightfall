import { describe, expect, it, vi } from "vitest";
import type { AgentdClient } from "../agentd-client/index.js";
import { createGame, viewFor } from "../engine/index.js";
import { createAgentdCaller } from "./agentd-caller.js";

// Minimal stub matching the slice of AgentdClient that createAgentdCaller uses.
function stubClient(results: Array<{ timedOut?: boolean; finalDecision: Record<string, unknown> | null }>) {
  let i = 0;
  const submitTurn = vi.fn(async () => {
    const r = results[Math.min(i, results.length - 1)]!;
    i++;
    return { runId: "r", status: "Succeeded", timedOut: r.timedOut ?? false, output: null, finalDecision: r.finalDecision };
  });
  return { client: { submitTurn } as unknown as AgentdClient, submitTurn };
}

const reqFor = (seat: number) => {
  const state = createGame(7);
  return { phase: state.phase, day: state.day, seat, role: state.seats.find((s) => s.seat === seat)!.role, view: viewFor(state, seat) };
};

describe("createAgentdCaller — retry on unusable response", () => {
  it("retries past a null final_decision and returns the next good one", async () => {
    const { client, submitTurn } = stubClient([
      { finalDecision: null }, // attempt 1: agentd plan.generate rejected non-JSON → null
      { finalDecision: { action: "check", target: 1, say: "", reason: "ok" } }, // attempt 2
    ]);
    const caller = createAgentdCaller({ client, gameId: "g", retries: 2 });
    const decision = await caller(reqFor(3));
    expect(decision.action).toBe("check");
    expect(submitTurn).toHaveBeenCalledTimes(2);
  });

  it("retries past a timeout", async () => {
    const { client, submitTurn } = stubClient([
      { timedOut: true, finalDecision: null },
      { finalDecision: { action: "kill", target: 2, say: "", reason: "" } },
    ]);
    const caller = createAgentdCaller({ client, gameId: "g", retries: 2 });
    expect((await caller(reqFor(2))).action).toBe("kill");
    expect(submitTurn).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting attempts (orchestrator then degrades)", async () => {
    const { client, submitTurn } = stubClient([{ finalDecision: null }]);
    const caller = createAgentdCaller({ client, gameId: "g", retries: 2 });
    await expect(caller(reqFor(1))).rejects.toThrow();
    expect(submitTurn).toHaveBeenCalledTimes(3); // 1 + 2 retries
  });
});
