import { describe, expect, it } from "vitest";
import { buildTailgateTtsRequest } from "./tts.js";
import type { TtsSettings } from "./tts-settings.js";

describe("tailgate TTS requests", () => {
  const settings: TtsSettings = {
    provider: "tailgate",
    baseUrl: "https://tailgate.example.test/",
    token: "secret-token",
    model: "local-tts",
    responseFormat: "mp3",
  };

  it("posts OpenAI-compatible speech requests through tailgate", () => {
    const req = buildTailgateTtsRequest(settings, "你好，旅行者。", "zm_yunjian");

    expect(req.url).toBe("https://tailgate.example.test/v1/audio/speech");
    expect(req.init.method).toBe("POST");
    expect(req.init.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer secret-token",
    });
    expect(JSON.parse(req.init.body as string)).toEqual({
      model: "local-tts",
      input: "你好，旅行者。",
      voice: "zm_yunjian",
      response_format: "mp3",
    });
  });

  it("omits Authorization when the token is blank", () => {
    const req = buildTailgateTtsRequest({ ...settings, token: "" }, "Night falls.", "af_alloy");

    expect(req.init.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("does not send VoiceDesign instruct fields", () => {
    const req = buildTailgateTtsRequest(settings, "开始投票。", "zf_xiaoxiao");

    expect(JSON.parse(req.init.body as string)).not.toHaveProperty("instruct");
  });
});
