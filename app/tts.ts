import type { Lang } from "./i18n.js";
import { DEFAULT_TTS_SETTINGS, type TtsSettings } from "./tts-settings.js";
import { kokoroVoiceForCharacterId, type KokoroVoice } from "./voiceProfiles.js";

export const TAILGATE_TTS_REQUEST_TIMEOUT_MS = 45_000;

let cachedVoices: SpeechSynthesisVoice[] = [];
let speechQueue: Promise<void> = Promise.resolve();
let speechGeneration = 0;
let activeController: AbortController | null = null;
let currentAudio: HTMLAudioElement | null = null;

function browserTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function loadVoices(): SpeechSynthesisVoice[] {
  if (!browserTtsSupported()) return [];
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) cachedVoices = voices;
  return cachedVoices;
}

if (browserTtsSupported()) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = () => loadVoices();
}

function voicesFor(lang: Lang): SpeechSynthesisVoice[] {
  const all = loadVoices();
  const pref = lang === "zh" ? /^zh/i : /^en/i;
  const matched = all.filter((voice) => pref.test(voice.lang));
  return matched.length ? matched : all;
}

const SEAT_PITCH = [1.0, 1.28, 0.82, 1.12, 0.92, 1.4];

function tailgateConfigured(settings: TtsSettings): boolean {
  return settings.provider === "tailgate" && settings.baseUrl.trim().length > 0;
}

export function ttsSupported(settings: TtsSettings = DEFAULT_TTS_SETTINGS): boolean {
  return tailgateConfigured(settings) || browserTtsSupported();
}

export function buildTailgateTtsRequest(
  settings: TtsSettings,
  input: string,
  voice: KokoroVoice,
): { url: string; init: RequestInit } {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (settings.token.trim()) headers.Authorization = `Bearer ${settings.token.trim()}`;
  return {
    url: `${settings.baseUrl.replace(/\/+$/, "")}/v1/audio/speech`,
    init: {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: settings.model,
        input,
        voice,
        response_format: settings.responseFormat,
      }),
    },
  };
}

export interface SpeakOptions {
  settings?: TtsSettings;
  characterId?: string | null | undefined;
  seat?: number | undefined;
}

export function speak(text: string, lang: Lang, options: SpeakOptions = {}): void {
  const input = text.trim();
  if (!input) return;
  const generation = speechGeneration;
  speechQueue = speechQueue.then(async () => {
    if (generation !== speechGeneration) return;
    await speakOnce(input, lang, options);
  });
}

async function speakOnce(text: string, lang: Lang, options: SpeakOptions): Promise<void> {
  const settings = options.settings ?? DEFAULT_TTS_SETTINGS;
  if (tailgateConfigured(settings)) {
    try {
      await speakWithTailgate(text, lang, settings, options.characterId);
      return;
    } catch {
      // Fall through to browser speech. Tailgate can fail because of CORS,
      // network, auth, timeout, or an unsupported browser audio format.
    }
  }
  speakWithBrowser(text, lang, options.seat);
}

async function speakWithTailgate(text: string, lang: Lang, settings: TtsSettings, characterId: string | null | undefined): Promise<void> {
  if (typeof fetch !== "function") throw new Error("fetch is not available");
  const voice = kokoroVoiceForCharacterId(characterId ?? "narrator", lang);
  const controller = new AbortController();
  activeController = controller;
  const timeout = setTimeout(() => controller.abort(), TAILGATE_TTS_REQUEST_TIMEOUT_MS);
  try {
    const req = buildTailgateTtsRequest(settings, text, voice);
    const response = await fetch(req.url, { ...req.init, signal: controller.signal });
    if (!response.ok) throw new Error(`TTS HTTP ${response.status}`);
    const audio = await response.blob();
    await playAudioBlob(audio);
  } finally {
    clearTimeout(timeout);
    if (activeController === controller) activeController = null;
  }
}

async function playAudioBlob(blob: Blob): Promise<void> {
  if (typeof Audio === "undefined" || typeof URL === "undefined") throw new Error("Audio playback is not available");
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;
  try {
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("audio playback failed"));
      const playing = audio.play();
      if (playing) playing.catch(reject);
    });
  } finally {
    if (currentAudio === audio) currentAudio = null;
    URL.revokeObjectURL(url);
  }
}

function speakWithBrowser(text: string, lang: Lang, seat?: number): void {
  if (!browserTtsSupported()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === "zh" ? "zh-CN" : "en-US";
  const voices = voicesFor(lang);
  if (seat != null) {
    if (voices.length) utterance.voice = voices[(seat - 1) % voices.length] ?? null;
    utterance.pitch = SEAT_PITCH[(seat - 1) % SEAT_PITCH.length] ?? 1;
    utterance.rate = 1.08;
  } else {
    if (voices.length) utterance.voice = voices[0] ?? null;
    utterance.pitch = 1;
    utterance.rate = 1;
  }
  window.speechSynthesis.speak(utterance);
}

export function cancelSpeech(): void {
  speechGeneration += 1;
  speechQueue = Promise.resolve();
  activeController?.abort();
  activeController = null;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  if (browserTtsSupported()) window.speechSynthesis.cancel();
}

export async function speechIdle(timeoutMs = 30_000): Promise<void> {
  const startedAt = now();
  await Promise.race([speechQueue, wait(timeoutMs)]);
  if (!browserTtsSupported()) return;
  await new Promise<void>((resolve) => {
    const tick = () => {
      if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) return resolve();
      if (now() - startedAt > timeoutMs) return resolve();
      setTimeout(tick, 120);
    };
    tick();
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function now(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}
