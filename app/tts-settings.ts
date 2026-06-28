export type TtsProvider = "browser" | "tailgate";
export type TtsResponseFormat = "wav" | "mp3" | "opus" | "webm" | "aac";

export interface TtsSettings {
  provider: TtsProvider;
  baseUrl: string;
  token: string;
  model: string;
  responseFormat: TtsResponseFormat;
}

const KEY = "nightfall.tts.v1";
const FORMATS = new Set<TtsResponseFormat>(["wav", "mp3", "opus", "webm", "aac"]);

export const DEFAULT_TTS_SETTINGS: TtsSettings = {
  provider: import.meta.env.VITE_TTS_BASE_URL ? "tailgate" : "browser",
  baseUrl: import.meta.env.VITE_TTS_BASE_URL ?? "",
  token: "",
  model: import.meta.env.VITE_TTS_MODEL ?? "local-tts",
  responseFormat: "mp3",
};

function normalizeProvider(value: unknown): TtsProvider {
  return value === "tailgate" ? "tailgate" : "browser";
}

function normalizeFormat(value: unknown): TtsResponseFormat {
  return typeof value === "string" && FORMATS.has(value as TtsResponseFormat) ? (value as TtsResponseFormat) : DEFAULT_TTS_SETTINGS.responseFormat;
}

export function loadTtsSettings(): TtsSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_TTS_SETTINGS };
    const stored = JSON.parse(raw) as Partial<TtsSettings>;
    return {
      ...DEFAULT_TTS_SETTINGS,
      ...stored,
      provider: normalizeProvider(stored.provider),
      responseFormat: normalizeFormat(stored.responseFormat),
    };
  } catch {
    return { ...DEFAULT_TTS_SETTINGS };
  }
}

export function saveTtsSettings(settings: TtsSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage blocked - settings stay in memory */
  }
}
