import type { Lang } from "./i18n.js";

/**
 * Experimental text-to-speech via the browser's built-in Web Speech API
 * (`speechSynthesis`). Zero deps, free, offline, no backend — fits the
 * referee-in-browser / static-Pages architecture. Voice quality depends on the
 * OS/browser's installed voices. The TTS layer is isolated here so it can later
 * be swapped for a cloud TTS without touching game logic.
 */

let cachedVoices: SpeechSynthesisVoice[] = [];
function loadVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  const v = window.speechSynthesis.getVoices();
  if (v.length) cachedVoices = v;
  return cachedVoices;
}

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

if (ttsSupported()) {
  loadVoices();
  // Voices often load asynchronously.
  window.speechSynthesis.onvoiceschanged = () => loadVoices();
}

function voicesFor(lang: Lang): SpeechSynthesisVoice[] {
  const all = loadVoices();
  const pref = lang === "zh" ? /^zh/i : /^en/i;
  const matched = all.filter((v) => pref.test(v.lang));
  return matched.length ? matched : all;
}

// Per-seat pitch so distinct seats sound distinct even with one system voice.
const SEAT_PITCH = [1.0, 1.28, 0.82, 1.12, 0.92, 1.4];

/**
 * Speak `text`. With a `seat`, picks a per-seat voice + pitch (a "player"
 * voice); without, uses a neutral narrator voice. Utterances queue FIFO.
 */
export function speak(text: string, lang: Lang, seat?: number): void {
  if (!ttsSupported() || !text.trim()) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "zh" ? "zh-CN" : "en-US";
  const vs = voicesFor(lang);
  if (seat != null) {
    if (vs.length) u.voice = vs[(seat - 1) % vs.length] ?? null;
    u.pitch = SEAT_PITCH[(seat - 1) % SEAT_PITCH.length] ?? 1;
    u.rate = 1.08;
  } else {
    if (vs.length) u.voice = vs[0] ?? null;
    u.pitch = 1;
    u.rate = 1;
  }
  window.speechSynthesis.speak(u);
}

/** Stop and clear everything currently queued/speaking. */
export function cancelSpeech(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

/** Resolves once nothing is speaking/queued (used to pace steps to the voice). */
export function speechIdle(timeoutMs = 30_000): Promise<void> {
  if (!ttsSupported()) return Promise.resolve();
  const synth = window.speechSynthesis;
  const startedAt = performance.now();
  return new Promise((resolve) => {
    const tick = () => {
      if (!synth.speaking && !synth.pending) return resolve();
      if (performance.now() - startedAt > timeoutMs) return resolve();
      setTimeout(tick, 120);
    };
    tick();
  });
}
