import { describe, expect, it, vi } from "vitest";
import { buildTailgateTtsRequest, testTailgateTts } from "./tts.js";
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

  it("tests configured local Kokoro by requesting sample speech", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const audio = { size: 128 };
    const played: unknown[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        blob: async () => audio,
      };
    });

    const result = await testTailgateTts(settings, "zh", {
      playAudio: async (blob) => {
        played.push(blob);
      },
    });

    expect(result).toEqual({ ok: true, bytes: 128 });
    expect(played).toEqual([audio]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://tailgate.example.test/v1/audio/speech");
    expect(calls[0]!.init.method).toBe("POST");
    expect(calls[0]!.init.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer secret-token",
    });
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      model: "local-tts",
      input: "本地 Kokoro 朗读测试。",
      voice: "zf_xiaoxiao",
      response_format: "mp3",
    });
  });

  it("reports local Kokoro test failures without throwing", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: false,
      status: 401,
      text: async () => "unauthorized",
    }));

    await expect(testTailgateTts(settings, "zh")).resolves.toEqual({
      ok: false,
      message: "HTTP 401: unauthorized",
    });
  });
});
