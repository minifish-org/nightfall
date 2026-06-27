import { describe, expect, it } from "vitest";
import type { AgentdClient } from "@agentd";
import { createGame } from "@engine";
import { characterMapForHuman } from "./characters.js";
import { buildRecap, voteMvp } from "./summary.js";
import type { TimelineItem } from "./timeline.js";

describe("buildRecap", () => {
  it("uses character names instead of seat numbers when identities are provided", () => {
    const identities = characterMapForHuman(null);
    const timeline: TimelineItem[] = [
      { id: 1, kind: "decision", day: 1, phase: "day_discuss", seat: 2, role: "villager", action: "speak", target: null, say: "我怀疑纳西妲", reason: "" },
      { id: 2, kind: "decision", day: 1, phase: "day_vote", seat: 2, role: "villager", action: "vote", target: 4, say: "", reason: "" },
      {
        id: 3,
        kind: "resolution",
        day: 1,
        phase: "day_vote",
        tone: "kill",
        text: "",
        event: { type: "banish", victim: 4, tally: { 4: 3 }, abstains: 0, tie: false },
      },
    ];

    expect(buildRecap(timeline, "zh", identities)).toEqual([
      "D1 钟离(平民) 发言: 我怀疑纳西妲",
      "D1 钟离 投票→纳西妲",
      "D1 放逐纳西妲",
    ]);
  });

  it("maps MVP character id ballots back to internal seats", async () => {
    const identities = characterMapForHuman(null);
    const game = { ...createGame(7), winner: "good" as const };
    const client = {
      submitTurn: async () => ({
        runId: "r",
        status: "Succeeded",
        timedOut: false,
        output: null,
        finalDecision: { best: "nahida", worst: "zhongli", reason: "角色表现差异明显" },
      }),
    } as unknown as AgentdClient;

    await expect(voteMvp(client, game, [], "zh", null, identities)).resolves.toEqual([
      { voter: 1, best: 4, worst: 2, reason: "角色表现差异明显" },
      { voter: 2, best: 4, worst: 2, reason: "角色表现差异明显" },
      { voter: 3, best: 4, worst: 2, reason: "角色表现差异明显" },
      { voter: 4, best: 4, worst: 2, reason: "角色表现差异明显" },
      { voter: 5, best: 4, worst: 2, reason: "角色表现差异明显" },
      { voter: 6, best: 4, worst: 2, reason: "角色表现差异明显" },
    ]);
  });
});
