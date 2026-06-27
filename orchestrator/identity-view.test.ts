import { describe, expect, it } from "vitest";
import { createGame, reduce, viewFor, type Decision } from "../engine/index.js";
import { toCharacterView, type SeatIdentityMap } from "./identity-view.js";

const identities: SeatIdentityMap = {
  1: { id: "venti", zh: "温迪", en: "Venti", avatarUrl: "venti.png" },
  2: { id: "zhongli", zh: "钟离", en: "Zhongli", avatarUrl: "zhongli.png" },
  3: { id: "raiden_shogun", zh: "雷电将军", en: "Raiden Shogun", avatarUrl: "shougun.png" },
  4: { id: "nahida", zh: "纳西妲", en: "Nahida", avatarUrl: "nahida.png" },
  5: { id: "furina", zh: "芙宁娜", en: "Furina", avatarUrl: "furina.png" },
  6: { id: "mavuika", zh: "玛薇卡", en: "Mavuika", avatarUrl: "mavuika.png" },
};

const dec = (action: Decision["action"], target: number | null, say = ""): Decision => ({
  action,
  target,
  say,
  reason: "",
});

describe("toCharacterView", () => {
  it("projects a SeatView into character identifiers without exposing seat fields", () => {
    const state = createGame(7);
    const view = viewFor(state, 1);
    const characterView = toCharacterView(view, identities, "zh");

    expect(characterView.you).toEqual({
      role: view.you.role,
      character: identities[1],
    });
    expect(characterView).not.toHaveProperty("alive_seats");
    expect(characterView).not.toHaveProperty("dead_seats");
    expect(characterView.you).not.toHaveProperty("seat");
    expect(characterView.valid_targets.every((target) => typeof target === "object" && "id" in target)).toBe(true);
    expect(characterView.valid_targets.some((target) => target.id === "venti")).toBe(false);
    expect(characterView.roleplay.instruction).toContain("温迪");
    expect(characterView.roleplay.instruction).toContain("valid_targets[].id");
  });

  it("maps public log, seer checks, wolf teammates, and wolf intents to character ids", () => {
    let state = createGame(7);
    const seer = state.seats.find((s) => s.role === "seer")!.seat;
    const wolves = state.seats.filter((s) => s.role === "wolf").map((s) => s.seat);
    const villager = state.seats.find((s) => s.role === "villager")!.seat;

    state = reduce(state, new Map([[seer, dec("check", wolves[0]!)]])).state;
    const seerView = toCharacterView(viewFor(state, seer), identities, "zh");
    expect(seerView.private).toEqual({
      checks: [{ day: 1, character: identities[wolves[0]!]!, result: "wolf" }],
    });

    const wolfView = toCharacterView(
      viewFor(state, wolves[1]!, {
        wolfIntents: [{ seat: wolves[0]!, target: villager }],
      }),
      identities,
      "zh",
    );
    expect(wolfView.private).toEqual({
      teammates: [identities[wolves[0]!]!],
      teammate_intents: [{ actor: identities[wolves[0]!]!, target: identities[villager]! }],
    });

    state = reduce(state, new Map(wolves.map((wolf) => [wolf, dec("kill", villager)]))).state;
    const publicView = toCharacterView(viewFor(state, seer), identities, "zh");
    expect(publicView.public_log.at(-1)).toEqual({
      type: "death",
      day: 1,
      phase: "night_wolf",
      character: identities[villager],
      cause: "night",
      role_revealed: null,
    });
  });
});
