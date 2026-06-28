import type { Lang } from "./i18n.js";
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
    hint: "Calls local TTS through tailgate. The token is stored only in this browser.",
  },
} as const;

const FORMATS: TtsResponseFormat[] = ["mp3", "wav", "opus", "webm", "aac"];

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
  const set = <K extends keyof TtsSettings>(key: K, value: TtsSettings[K]) => onChange({ ...settings, [key]: value });
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
              placeholder="http://ip-...ts.net:11435"
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
          </>
        )}
      </div>
      {settings.provider === "tailgate" && <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>{t.hint}</div>}
    </fieldset>
  );
}
