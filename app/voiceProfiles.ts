import type { CharacterIdentity } from "@orchestrator";
import type { Lang } from "./i18n.js";

export type VoiceProfileId =
  | "venti"
  | "zhongli"
  | "raiden_shogun"
  | "nahida"
  | "furina"
  | "mavuika"
  | "aether"
  | "narrator";

export type KokoroVoice =
  | "zf_xiaobei"
  | "zf_xiaoni"
  | "zf_xiaoxiao"
  | "zf_xiaoyi"
  | "zm_yunjian"
  | "zm_yunxi"
  | "af_alloy"
  | "af_bella"
  | "af_heart"
  | "af_nicole"
  | "af_nova"
  | "af_sky"
  | "am_liam"
  | "am_michael";

export const VOICE_PROFILE_IDS = [
  "venti",
  "zhongli",
  "raiden_shogun",
  "nahida",
  "furina",
  "mavuika",
  "aether",
  "narrator",
] as const satisfies readonly VoiceProfileId[];

const KOKORO_VOICES: Record<VoiceProfileId, Record<Lang, KokoroVoice>> = {
  venti: { zh: "zf_xiaobei", en: "af_heart" },
  zhongli: { zh: "zm_yunjian", en: "am_michael" },
  raiden_shogun: { zh: "zf_xiaoni", en: "af_nicole" },
  nahida: { zh: "zf_xiaoxiao", en: "af_sky" },
  furina: { zh: "zf_xiaoyi", en: "af_bella" },
  mavuika: { zh: "zf_xiaobei", en: "af_nova" },
  aether: { zh: "zm_yunxi", en: "am_liam" },
  narrator: { zh: "zf_xiaoxiao", en: "af_alloy" },
};

export function kokoroVoiceForCharacterId(id: string | null | undefined, lang: Lang): KokoroVoice {
  return (KOKORO_VOICES[id as VoiceProfileId] ?? KOKORO_VOICES.narrator)[lang];
}

export function kokoroVoiceForCharacter(character: CharacterIdentity | null | undefined, lang: Lang): KokoroVoice {
  return kokoroVoiceForCharacterId(character?.id, lang);
}
