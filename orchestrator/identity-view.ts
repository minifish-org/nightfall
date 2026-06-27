import type { DeathPhase, Faction, Phase, PrivateView, PublicEntry, Role, SeatView } from "../engine/index.js";

export interface CharacterIdentity {
  id: string;
  zh: string;
  en: string;
  avatarUrl?: string;
  aliases?: string[];
}

export type SeatIdentityMap = Record<number, CharacterIdentity>;

export type CharacterPublicEntry =
  | { type: "speech"; day: number; phase: Phase; actor: CharacterIdentity; say: string }
  | { type: "vote"; day: number; phase: Phase; actor: CharacterIdentity; target: CharacterIdentity | null }
  | {
      type: "death";
      day: number;
      phase: DeathPhase;
      character: CharacterIdentity;
      cause: "night" | "vote";
      role_revealed: null;
    }
  | { type: "lastwords"; day: number; actor: CharacterIdentity; say: string };

export type CharacterPrivateView =
  | { checks: { day: number; character: CharacterIdentity; result: Faction }[] }
  | { teammates: CharacterIdentity[]; teammate_intents?: { actor: CharacterIdentity; target: CharacterIdentity | null }[] }
  | Record<string, never>;

export interface CharacterSeatView {
  phase: Phase;
  game_id: string;
  day: number;
  you: { role: Role; character: CharacterIdentity };
  setup: SeatView["setup"];
  alive_characters: CharacterIdentity[];
  dead_characters: { character: CharacterIdentity; phase: DeathPhase }[];
  public_log: CharacterPublicEntry[];
  private: CharacterPrivateView;
  valid_targets: CharacterIdentity[];
  roleplay: {
    target_format: "character_id";
    instruction: string;
  };
}

export function toCharacterView(view: SeatView, identities: SeatIdentityMap, lang = "zh"): CharacterSeatView {
  const character = identityFor(identities, view.you.seat);
  return {
    phase: view.phase,
    game_id: view.game_id,
    day: view.day,
    you: { role: view.you.role, character },
    setup: view.setup,
    alive_characters: view.alive_seats.map((seat) => identityFor(identities, seat)),
    dead_characters: view.dead_seats.map((dead) => ({ character: identityFor(identities, dead.seat), phase: dead.phase })),
    public_log: view.public_log.map((entry) => publicEntryFor(entry, identities)),
    private: privateFor(view.private, identities),
    valid_targets: view.valid_targets.map((seat) => identityFor(identities, seat)),
    roleplay: {
      target_format: "character_id",
      instruction: roleplayInstruction(character, lang),
    },
  };
}

export function resolveCharacterTarget(raw: unknown, identities: SeatIdentityMap): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") throw new Error("agent emitted numeric target; expected character target");
  if (typeof raw !== "string") return null;
  if (looksLikeSeatReference(raw)) throw new Error(`agent emitted seat reference target ${JSON.stringify(raw)}; expected character target`);

  const key = normalize(raw);
  for (const [seat, identity] of Object.entries(identities)) {
    const names = [identity.id, identity.zh, identity.en, ...(identity.aliases ?? [])];
    if (names.some((name) => normalize(name) === key)) return Number(seat);
  }
  return null;
}

export function containsSeatReference(text: string): boolean {
  return /(?:^|[^\d])(?:[1-9]\d*\s*号|seat\s*#?\s*[1-9]\d*)/i.test(text);
}

function publicEntryFor(entry: PublicEntry, identities: SeatIdentityMap): CharacterPublicEntry {
  switch (entry.type) {
    case "speech":
      return { type: "speech", day: entry.day, phase: entry.phase, actor: identityFor(identities, entry.seat), say: entry.say };
    case "vote":
      return {
        type: "vote",
        day: entry.day,
        phase: entry.phase,
        actor: identityFor(identities, entry.seat),
        target: entry.target === null ? null : identityFor(identities, entry.target),
      };
    case "death":
      return {
        type: "death",
        day: entry.day,
        phase: entry.phase,
        character: identityFor(identities, entry.seat),
        cause: entry.cause,
        role_revealed: entry.role_revealed,
      };
    case "lastwords":
      return { type: "lastwords", day: entry.day, actor: identityFor(identities, entry.seat), say: entry.say };
  }
}

function privateFor(priv: PrivateView, identities: SeatIdentityMap): CharacterPrivateView {
  if ("checks" in priv) {
    return { checks: priv.checks.map((check) => ({ day: check.day, character: identityFor(identities, check.seat), result: check.result })) };
  }
  if ("teammates" in priv) {
    const out: { teammates: CharacterIdentity[]; teammate_intents?: { actor: CharacterIdentity; target: CharacterIdentity | null }[] } = {
      teammates: priv.teammates.map((seat) => identityFor(identities, seat)),
    };
    if (priv.teammate_intents?.length) {
      out.teammate_intents = priv.teammate_intents.map((intent) => ({
        actor: identityFor(identities, intent.seat),
        target: intent.target === null ? null : identityFor(identities, intent.target),
      }));
    }
    return out;
  }
  return {};
}

function identityFor(identities: SeatIdentityMap, seat: number): CharacterIdentity {
  const identity = identities[seat];
  if (!identity) throw new Error(`missing character identity for seat ${seat}`);
  return identity;
}

function roleplayInstruction(character: CharacterIdentity, lang: string): string {
  if (lang === "en") {
    return `You are role-playing as ${character.en}. Address other players by character name, never by seat number. If you choose a target, target must be exactly one id from valid_targets[].id.`;
  }
  return `你正在扮演${character.zh}。公开发言请称呼其他玩家的角色名,不要使用座位号。如果需要选择目标,target 必须严格填写 valid_targets[].id 里的一个 id。`;
}

function looksLikeSeatReference(value: string): boolean {
  return /^\s*(?:#?\d+|seat\s*#?\s*\d+|\d+\s*号)\s*$/i.test(value);
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_\-·.]/g, "");
}
