import { describe, expect, it } from "vitest";
import { AETHER, ARCHON_CHARACTERS } from "./characters.js";
import { kokoroVoiceForCharacter, kokoroVoiceForCharacterId, VOICE_PROFILE_IDS } from "./voiceProfiles.js";

const ZH_VOICES = new Set(["zf_xiaobei", "zf_xiaoni", "zf_xiaoxiao", "zf_xiaoyi", "zm_yunjian", "zm_yunxi", "zm_yunxia", "zm_yunyang"]);
const EN_US_VOICES = new Set([
  "af_alloy",
  "af_aoede",
  "af_bella",
  "af_heart",
  "af_jessica",
  "af_kore",
  "af_nicole",
  "af_nova",
  "af_river",
  "af_sarah",
  "af_sky",
  "am_adam",
  "am_echo",
  "am_eric",
  "am_fenrir",
  "am_liam",
  "am_michael",
  "am_onyx",
  "am_puck",
  "am_santa",
]);

describe("Kokoro voice profiles", () => {
  it("defines a Kokoro voice for every public character and narrator", () => {
    expect(VOICE_PROFILE_IDS).toEqual([
      "venti",
      "zhongli",
      "raiden_shogun",
      "nahida",
      "furina",
      "mavuika",
      "aether",
      "narrator",
    ]);

    for (const character of [...ARCHON_CHARACTERS, AETHER]) {
      expect(kokoroVoiceForCharacter(character, "zh")).toBeTruthy();
      expect(kokoroVoiceForCharacter(character, "en")).toBeTruthy();
    }
  });

  it("uses only Chinese voices for zh and American English voices for en", () => {
    for (const id of VOICE_PROFILE_IDS) {
      expect(ZH_VOICES.has(kokoroVoiceForCharacterId(id, "zh"))).toBe(true);
      expect(EN_US_VOICES.has(kokoroVoiceForCharacterId(id, "en"))).toBe(true);
    }
  });

  it("uses male voices only for Zhongli and Aether", () => {
    for (const id of VOICE_PROFILE_IDS) {
      const shouldBeMale = id === "zhongli" || id === "aether";
      expect(kokoroVoiceForCharacterId(id, "zh").startsWith("zm_")).toBe(shouldBeMale);
      expect(kokoroVoiceForCharacterId(id, "en").startsWith("am_")).toBe(shouldBeMale);
    }
  });

  it("falls back to narrator for unknown profile ids", () => {
    expect(kokoroVoiceForCharacterId("unknown", "zh")).toBe(kokoroVoiceForCharacterId("narrator", "zh"));
  });
});
