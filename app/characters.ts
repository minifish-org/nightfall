import type { CharacterIdentity, SeatIdentityMap } from "@orchestrator";
import type { Lang } from "./i18n.js";

export const ARCHON_CHARACTERS: CharacterIdentity[] = [
  { id: "venti", zh: "温迪", en: "Venti", avatarUrl: "https://enka.network/ui/UI_AvatarIcon_Venti.png" },
  { id: "zhongli", zh: "钟离", en: "Zhongli", avatarUrl: "https://enka.network/ui/UI_AvatarIcon_Zhongli.png" },
  {
    id: "raiden_shogun",
    zh: "雷电将军",
    en: "Raiden Shogun",
    avatarUrl: "https://enka.network/ui/UI_AvatarIcon_Shougun.png",
    aliases: ["Shougun", "Raiden", "雷神"],
  },
  { id: "nahida", zh: "纳西妲", en: "Nahida", avatarUrl: "https://enka.network/ui/UI_AvatarIcon_Nahida.png" },
  { id: "furina", zh: "芙宁娜", en: "Furina", avatarUrl: "https://enka.network/ui/UI_AvatarIcon_Furina.png" },
  { id: "mavuika", zh: "玛薇卡", en: "Mavuika", avatarUrl: "https://enka.network/ui/UI_AvatarIcon_Mavuika.png" },
];

export const AETHER: CharacterIdentity = {
  id: "aether",
  zh: "空",
  en: "Aether",
  avatarUrl: "https://enka.network/ui/UI_AvatarIcon_PlayerBoy.png",
  aliases: ["Traveler", "旅行者"],
};

export function characterMapForHuman(humanSeat: number | null): SeatIdentityMap {
  return Object.fromEntries(
    ARCHON_CHARACTERS.map((character, index) => {
      const seat = index + 1;
      return [seat, humanSeat === seat ? AETHER : character];
    }),
  );
}

export function characterName(character: CharacterIdentity, lang: Lang): string {
  return lang === "zh" ? character.zh : character.en;
}

export function characterForSeat(identities: SeatIdentityMap, seat: number): CharacterIdentity {
  const character = identities[seat];
  if (!character) throw new Error(`missing character identity for seat ${seat}`);
  return character;
}

export function characterLabel(identities: SeatIdentityMap, seat: number | null, lang: Lang, fallback = "—"): string {
  if (seat === null) return fallback;
  return characterName(characterForSeat(identities, seat), lang);
}
