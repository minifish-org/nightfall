import { describe, expect, it, vi } from "vitest";
import type { AgentdClient } from "../agentd-client/index.js";
import { createGame, viewFor } from "../engine/index.js";
import { createAgentdCaller } from "./agentd-caller.js";
import type { SeatIdentityMap } from "./identity-view.js";

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

const identities: SeatIdentityMap = {
  1: { id: "venti", zh: "温迪", en: "Venti", avatarUrl: "venti.png" },
  2: { id: "zhongli", zh: "钟离", en: "Zhongli", avatarUrl: "zhongli.png" },
  3: { id: "raiden_shogun", zh: "雷电将军", en: "Raiden Shogun", avatarUrl: "shougun.png" },
  4: { id: "nahida", zh: "纳西妲", en: "Nahida", avatarUrl: "nahida.png" },
  5: { id: "furina", zh: "芙宁娜", en: "Furina", avatarUrl: "furina.png" },
  6: { id: "mavuika", zh: "玛薇卡", en: "Mavuika", avatarUrl: "mavuika.png" },
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

  it("sends character view and maps character id targets back to seat numbers", async () => {
    const { client, submitTurn } = stubClient([
      { finalDecision: { action: "check", target: "nahida", say: "", reason: "ok" } },
    ]);
    const caller = createAgentdCaller({ client, gameId: "g", retries: 0, identities, lang: "zh" });
    const decision = await caller(reqFor(1));

    expect(decision).toMatchObject({ action: "check", target: 4 });
    const input = ((submitTurn.mock.calls as unknown[][])[0]![0] as { payload: Record<string, unknown> }).payload;
    expect(input).toHaveProperty("alive_characters");
    expect(input).not.toHaveProperty("alive_seats");
    expect(input).not.toHaveProperty("dead_seats");
    expect(input).toMatchObject({
      you: { character: { id: "venti", zh: "温迪" } },
      roleplay: expect.objectContaining({ target_format: "character_id" }),
    });
  });

  it("accepts Chinese and English character names as targets", async () => {
    const zh = stubClient([{ finalDecision: { action: "vote", target: "纳西妲", say: "", reason: "" } }]);
    const en = stubClient([{ finalDecision: { action: "vote", target: "Nahida", say: "", reason: "" } }]);

    await expect(createAgentdCaller({ client: zh.client, gameId: "g", retries: 0, identities, lang: "zh" })(reqFor(1))).resolves.toMatchObject({ target: 4 });
    await expect(createAgentdCaller({ client: en.client, gameId: "g", retries: 0, identities, lang: "en" })(reqFor(1))).resolves.toMatchObject({ target: 4 });
  });

  it("rejects numeric targets in character mode so a retry can repair them", async () => {
    const { client, submitTurn } = stubClient([
      { finalDecision: { action: "vote", target: 4, say: "", reason: "bad numeric target" } },
      { finalDecision: { action: "vote", target: "nahida", say: "", reason: "fixed" } },
    ]);
    const caller = createAgentdCaller({ client, gameId: "g", retries: 1, identities, lang: "zh" });

    await expect(caller(reqFor(1))).resolves.toMatchObject({ action: "vote", target: 4 });
    expect(submitTurn).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting numeric targets in character mode", async () => {
    const { client, submitTurn } = stubClient([
      { finalDecision: { action: "vote", target: 4, say: "", reason: "still numeric" } },
    ]);
    const caller = createAgentdCaller({ client, gameId: "g", retries: 1, identities, lang: "zh" });

    await expect(caller(reqFor(1))).rejects.toThrow(/character target/i);
    expect(submitTurn).toHaveBeenCalledTimes(2);
  });
});
