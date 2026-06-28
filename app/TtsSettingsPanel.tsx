import { useCallback, useState } from "react";
import type { Lang } from "./i18n.js";
import { testTailgateTts, type TailgateTtsTestResult } from "./tts.js";
import type { TtsResponseFormat, TtsSettings } from "./tts-settings.js";

const COPY = {
  zh: {
    legend: "朗读服务",
    provider: "朗读方式",
    browser: "浏览器朗读",
    tailgate: "本地 Kokoro",
    baseUrl: "服务地址",
    token: "API Token",
    model: "模型",
    format: "格式",
    test: "测试",
    testing: "测试中…",
    testTitle: "验证当前 Kokoro 配置",
    testOk: (bytes: number) => `✓ 可用 · ${bytes} bytes`,
    testFail: (message: string) => `✗ ${message}`,
    hint: "通过 tailgate 调用本地 TTS；token 只保存在本机浏览器。",
  },
  en: {
    legend: "Narration Service",
    provider: "Voice engine",
    browser: "Browser voice",
    tailgate: "Local Kokoro",
    baseUrl: "Service URL",
    token: "API Token",
    model: "Model",
    format: "Format",
    test: "Test",
    testing: "Testing…",
    testTitle: "Verify current Kokoro settings",
    testOk: (bytes: number) => `✓ Available · ${bytes} bytes`,
    testFail: (message: string) => `✗ ${message}`,
    hint: "Calls local TTS through tailgate. The token is stored only in this browser.",
  },
} as const;

const FORMATS: TtsResponseFormat[] = ["mp3", "wav", "opus", "webm", "aac"];
const TAILGATE_URL_PLACEHOLDER = "http://tailgate.example:11435";

export function TtsSettingsPanel({
  settings,
  onChange,
  lang,
}: {
  settings: TtsSettings;
  onChange: (settings: TtsSettings) => void;
  lang: Lang;
}) {
  const t = COPY[lang];
  const [test, setTest] = useState<TailgateTtsTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const set = <K extends keyof TtsSettings>(key: K, value: TtsSettings[K]) => {
    setTest(null);
    onChange({ ...settings, [key]: value });
  };
  const doTest = useCallback(async () => {
    setTesting(true);
    setTest(null);
    setTest(await testTailgateTts(settings, lang));
    setTesting(false);
  }, [settings, lang]);
  const statusText = !test ? "" : test.ok ? t.testOk(test.bytes) : t.testFail(test.message);
  const statusColor = !test ? "#888" : test.ok ? "var(--safe)" : "var(--blood)";

  return (
    <fieldset style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, marginBottom: 12 }}>
      <legend>{t.legend}</legend>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 10px", alignItems: "center" }}>
        <label>{t.provider}</label>
        <select value={settings.provider} onChange={(event) => set("provider", event.target.value as TtsSettings["provider"])}>
          <option value="browser">{t.browser}</option>
          <option value="tailgate">{t.tailgate}</option>
        </select>
        {settings.provider === "tailgate" && (
          <>
            <label>{t.baseUrl}</label>
            <input
              value={settings.baseUrl}
              onChange={(event) => set("baseUrl", event.target.value)}
              placeholder={TAILGATE_URL_PLACEHOLDER}
            />
            <label>{t.token}</label>
            <input type="password" value={settings.token} onChange={(event) => set("token", event.target.value)} autoComplete="off" />
            <label>{t.model}</label>
            <input value={settings.model} onChange={(event) => set("model", event.target.value)} placeholder="local-tts" />
            <label>{t.format}</label>
            <select value={settings.responseFormat} onChange={(event) => set("responseFormat", event.target.value as TtsResponseFormat)}>
              {FORMATS.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button type="button" onClick={() => void doTest()} disabled={testing || !settings.baseUrl.trim()} title={t.testTitle}>
                {testing ? t.testing : t.test}
              </button>
              {statusText && <span style={{ color: statusColor, fontSize: 12 }}>{statusText}</span>}
            </div>
          </>
        )}
      </div>
      {settings.provider === "tailgate" && <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>{t.hint}</div>}
    </fieldset>
  );
}
