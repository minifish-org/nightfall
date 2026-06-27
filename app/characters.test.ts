import { describe, expect, it } from "vitest";
import { AETHER, ARCHON_CHARACTERS, characterMapForHuman, characterName } from "./characters.js";

describe("character identities", () => {
  it("uses the fixed six-archon lineup", () => {
    expect(ARCHON_CHARACTERS.map((c) => c.id)).toEqual([
      "venti",
      "zhongli",
      "raiden_shogun",
      "nahida",
      "furina",
      "mavuika",
    ]);
  });

  it("replaces the selected human character with Aether", () => {
    const identities = characterMapForHuman(3);

    expect(identities[1]!.id).toBe("venti");
    expect(identities[3]).toEqual(AETHER);
    expect(characterName(identities[3]!, "zh")).toBe("空");
    expect(characterName(identities[3]!, "en")).toBe("Aether");
  });
});
