import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TTS_SETTINGS, loadTtsSettings, saveTtsSettings } from "./tts-settings.js";

function installStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  });
  return store;
}

describe("TTS settings", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses browser narration by default unless a tailgate URL is configured", () => {
    installStorage();

    expect(loadTtsSettings()).toEqual(DEFAULT_TTS_SETTINGS);
  });

  it("merges missing stored fields with defaults", () => {
    const store = installStorage();
    store.set("nightfall.tts.v1", JSON.stringify({ provider: "tailgate", baseUrl: "https://tailgate.example.test" }));

    expect(loadTtsSettings()).toEqual({
      ...DEFAULT_TTS_SETTINGS,
      provider: "tailgate",
      baseUrl: "https://tailgate.example.test",
    });
  });

  it("keeps only supported audio formats", () => {
    const store = installStorage();
    store.set("nightfall.tts.v1", JSON.stringify({ responseFormat: "flac" }));

    expect(loadTtsSettings().responseFormat).toBe(DEFAULT_TTS_SETTINGS.responseFormat);
  });

  it("saves settings locally", () => {
    const store = installStorage();
    saveTtsSettings({ ...DEFAULT_TTS_SETTINGS, provider: "tailgate", token: "secret" });

    expect(JSON.parse(store.get("nightfall.tts.v1")!)).toMatchObject({ provider: "tailgate", token: "secret" });
  });
});
