import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_TTS_SETTINGS } from "./tts-settings.js";
import { TtsSettingsPanel } from "./TtsSettingsPanel.js";

describe("TtsSettingsPanel", () => {
  it("uses a neutral tailgate service URL placeholder", () => {
    const html = renderToStaticMarkup(
      createElement(TtsSettingsPanel, {
        settings: { ...DEFAULT_TTS_SETTINGS, provider: "tailgate" },
        onChange: vi.fn(),
        lang: "zh",
      }),
    );

    expect(html).toContain('placeholder="http://tailgate.example:11435"');
    expect(html).not.toContain("ip-");
    expect(html).not.toContain("ts.net");
  });

  it("renders a local Kokoro test button for tailgate settings", () => {
    const html = renderToStaticMarkup(
      createElement(TtsSettingsPanel, {
        settings: {
          ...DEFAULT_TTS_SETTINGS,
          provider: "tailgate",
          baseUrl: "http://tailgate.example:11435",
        },
        onChange: vi.fn(),
        lang: "zh",
      }),
    );

    expect(html).toContain("测试");
    expect(html).toContain("验证当前 Kokoro 配置");
    expect(html).toContain("grid-column:1 / -1");
  });
});
