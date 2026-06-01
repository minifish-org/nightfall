import type { Action, Faction, GameState, Phase, ResolutionEvent, Role } from "@engine";

export type Lang = "zh" | "en";

export const ROLE_NAME: Record<Lang, Record<Role, string>> = {
  zh: { wolf: "狼", seer: "预言家", villager: "平民" },
  en: { wolf: "wolf", seer: "seer", villager: "villager" },
};

export const ACTION_NAME: Record<Lang, Record<Action, string>> = {
  zh: { check: "查验", kill: "刀", speak: "发言", vote: "投票", abstain: "弃票" },
  en: { check: "check", kill: "kill", speak: "speak", vote: "vote", abstain: "abstain" },
};

export const PHASE_LABEL: Record<Lang, Record<Phase, string>> = {
  zh: {
    night_seer: "🔮 夜 · 预言家",
    night_wolf: "🐺 夜 · 狼人",
    day_discuss: "💬 昼 · 讨论",
    day_vote: "🗳️ 昼 · 投票",
    last_words: "🪦 遗言",
    game_over: "🏁 对局结束",
  },
  en: {
    night_seer: "🔮 Night · Seer",
    night_wolf: "🐺 Night · Wolves",
    day_discuss: "💬 Day · Discussion",
    day_vote: "🗳️ Day · Vote",
    last_words: "🪦 Last words",
    game_over: "🏁 Game over",
  },
};

/** Static UI strings + a few small formatters, keyed by language. */
export const UI = {
  zh: {
    title: "🐺 Nightfall — AI 狼人杀观赛",
    subtitle:
      "浏览器即裁判:持有全量状态、按阶段 FSM 推进,并以每个座位的「投影视图」调用 agentd。本页渲染上帝视角——两者从不混淆。",
    cfgLegend: "③ 开局配置",
    baseUrl: "agentd 地址",
    tenant: "租户 tenant",
    seed: "随机种子",
    stepDelay: "每步间隔 (ms)",
    language: "语言(界面/AI 输出)",
    agentRefSuffix: "agent_ref",
    start: "▶ 开始",
    restart: "↻ 重开",
    pause: "⏸ 暂停",
    resume: "▶ 继续",
    step: "⏯ 单步",
    stepTip: "暂停并只推进一步",
    stop: "⏹ 停止",
    status: "状态",
    seats: "座位",
    noGame: "暂无对局。",
    diedPrefix: "死亡",
    timeline: "时间线",
    startHint: "点「开始」对着 agentd 跑一局。",
    acting: "行动",
    seat: "座位",
    fallback: "降级",
    dayWord: "第",
    dayUnit: "天",
    phaseWord: "阶段",
    unreachableHint: (url: string) => `agentd 是否在 ${url} 运行、且已注册三个 agent?`,
    viewModeLabel: "视角",
    godMode: "上帝视角",
    spectatorMode: "观赛模式",
    tts: "🔊 朗读",
    spectatorNote: "观赛模式:隐藏身份与私有思考,只看公开信息",
    reveal: "🎭 揭晓真实身份",
    hideReveal: "收起",
    revealTitle: "身份揭晓",
    humanSeatLabel: "本地玩家座位",
    humanNone: "无(全 AI)",
    yourTurn: "轮到你了",
    youAre: "你的身份",
    yourChecks: "你的验人结果",
    noChecks: "(暂无验人结果)",
    submit: "提交决策",
    skipDefault: "跳过(默认)",
    speakPlaceholder: "输入你的公开发言…",
    reasonPlaceholder: "私有思考(可空,别人看不到)",
    pickTarget: "选择目标座位",
    abstainBtn: "弃票",
    waitingHuman: "等待你输入…",
    teammatesLabel: "你的狼队友",
    intentsLabel: "本夜队友刀口",
    myPanelTitle: "你的私密信息",
    summaryTitle: "事后总结",
    mvpVote: "🗳️ 让 AI 评选 MVP / 最差",
    voting: "AI 评选中…",
    bestLabel: "🏆 最佳表现",
    worstLabel: "💩 最差表现",
    votesUnit: "票",
    mvpNoVotes: "没有有效票(模型未返回可用结果)",
    recapEvents: "逐回合复盘",
    yourBallot: "你的一票(座位",
    yourBest: "最佳",
    yourWorst: "最差",
    yourTake: "你的点评(可空)",
    submitAndVote: "提交我的票并让 AI 评选",
    youTag: "(你)",
  },
  en: {
    title: "🐺 Nightfall — AI Werewolf spectator",
    subtitle:
      "Browser is the referee: it holds full state, runs the phase FSM, and calls agentd with each seat's projected view. This page renders the god view — the two never mix.",
    cfgLegend: "③ Game setup",
    baseUrl: "agentd baseUrl",
    tenant: "tenant",
    seed: "seed",
    stepDelay: "step delay (ms)",
    language: "Language (UI / AI output)",
    agentRefSuffix: "agent_ref",
    start: "▶ Start",
    restart: "↻ Restart",
    pause: "⏸ Pause",
    resume: "▶ Resume",
    step: "⏯ Step",
    stepTip: "Pause and advance one step",
    stop: "⏹ Stop",
    status: "status",
    seats: "Seats",
    noGame: "No game yet.",
    diedPrefix: "died",
    timeline: "Timeline",
    startHint: "Press Start to run a game against agentd.",
    acting: "acting",
    seat: "Seat",
    fallback: "fallback",
    dayWord: "Day",
    dayUnit: "",
    phaseWord: "phase",
    unreachableHint: (url: string) => `Is agentd reachable at ${url} with the three agents registered?`,
    viewModeLabel: "View",
    godMode: "God view",
    spectatorMode: "Spectator",
    tts: "🔊 Narrate",
    spectatorNote: "Spectator: identities & private notes hidden — public info only",
    reveal: "🎭 Reveal roles",
    hideReveal: "Hide",
    revealTitle: "Roles revealed",
    humanSeatLabel: "Local player seat",
    humanNone: "None (all AI)",
    yourTurn: "Your turn",
    youAre: "You are",
    yourChecks: "Your checks",
    noChecks: "(no checks yet)",
    submit: "Submit",
    skipDefault: "Skip (default)",
    speakPlaceholder: "Your public statement…",
    reasonPlaceholder: "Private note (optional, hidden from others)",
    pickTarget: "Pick a target seat",
    abstainBtn: "Abstain",
    waitingHuman: "Waiting for your input…",
    teammatesLabel: "Your wolf teammates",
    intentsLabel: "Teammates' kills tonight",
    myPanelTitle: "Your private info",
    summaryTitle: "Post-game summary",
    mvpVote: "🗳️ Let the AI vote MVP / worst",
    voting: "AI voting…",
    bestLabel: "🏆 Best performer",
    worstLabel: "💩 Worst performer",
    votesUnit: "votes",
    mvpNoVotes: "No valid votes (the model returned nothing usable)",
    recapEvents: "Round-by-round recap",
    yourBallot: "Your ballot (seat",
    yourBest: "Best",
    yourWorst: "Worst",
    yourTake: "Your take (optional)",
    submitAndVote: "Submit my ballot & run AI vote",
    youTag: "(you)",
  },
} as const;

const roleOf = (game: GameState, seat: number): Role | null => game.seats.find((s) => s.seat === seat)?.role ?? null;
/** "3(狼)" / "3(wolf)" — god-view seat tag. */
export function tag(game: GameState, seat: number, lang: Lang): string {
  const r = roleOf(game, seat);
  return r ? `${seat}(${ROLE_NAME[lang][r]})` : `${seat}`;
}

/** Localized resolution line for the god-view timeline. null = not shown. */
export function resolutionText(
  game: GameState,
  e: ResolutionEvent,
  lang: Lang,
): { text: string; tone: "kill" | "info" | "safe" } | null {
  const zh = lang === "zh";
  switch (e.type) {
    case "seer_check":
      return {
        tone: "info",
        text: zh
          ? `🔮 预言家 ${tag(game, e.seat, lang)} 查验 ${tag(game, e.target, lang)} → ${e.result === "wolf" ? "狼" : "好人"}`
          : `🔮 Seer ${tag(game, e.seat, lang)} checked ${tag(game, e.target, lang)} → ${e.result.toUpperCase()}`,
      };
    case "night_kill":
      if (e.victim === null) return { tone: "safe", text: zh ? "🌙 今夜无人死亡" : "🌙 No one was killed" };
      return {
        tone: "kill",
        text: zh
          ? `🔪 狼人刀了 ${tag(game, e.victim, lang)}${e.tie ? "(平票→按种子)" : ""}`
          : `🔪 Wolves killed seat ${tag(game, e.victim, lang)}${e.tie ? " (tie → seeded)" : ""}`,
      };
    case "banish": {
      const tally = Object.entries(e.tally).map(([s, n]) => `${s}:${n}`).join("  ") || "—";
      if (e.victim === null)
        return {
          tone: "safe",
          text: zh
            ? `⚖️ 无人被放逐 · 票数 ${tally} · 弃票 ${e.abstains}`
            : `⚖️ No banishment · votes ${tally} · abstain ${e.abstains}`,
        };
      return {
        tone: "kill",
        text: zh
          ? `⚖️ 放逐了 ${tag(game, e.victim, lang)} · 票数 ${tally} · 弃票 ${e.abstains}${e.tie ? "(平票→按种子)" : ""}`
          : `⚖️ Banished seat ${tag(game, e.victim, lang)} · votes ${tally} · abstain ${e.abstains}${e.tie ? " (tie → seeded)" : ""}`,
      };
    }
    case "death":
    case "phase_advance":
    case "game_over":
      return null;
  }
}

export function winnerText(winner: Faction, lang: Lang): string {
  if (lang === "zh") return `🏁 ${winner === "wolf" ? "狼人" : "好人"}阵营获胜`;
  return `🏁 ${winner.toUpperCase()} wins`;
}

/**
 * PUBLIC resolution text for spectator mode — uses seat numbers only, NEVER a
 * role. Seer checks are dropped entirely (private), and night-kill proposals
 * (which would expose the wolves) are never included.
 */
export function publicResolutionText(
  e: ResolutionEvent,
  lang: Lang,
): { text: string; tone: "kill" | "info" | "safe" } | null {
  const zh = lang === "zh";
  switch (e.type) {
    case "seer_check":
      return null; // private — spectators never see who checked whom
    case "night_kill":
      return e.victim === null
        ? { tone: "safe", text: zh ? "🌙 昨夜无人死亡" : "🌙 No one died last night" }
        : { tone: "kill", text: zh ? `🔪 昨夜 座位 ${e.victim} 出局` : `🔪 Seat ${e.victim} was killed last night` };
    case "banish": {
      const tally = Object.entries(e.tally).map(([s, n]) => `${s}:${n}`).join("  ") || "—";
      return e.victim === null
        ? {
            tone: "safe",
            text: zh ? `⚖️ 无人被放逐 · 票数 ${tally} · 弃票 ${e.abstains}` : `⚖️ No banishment · votes ${tally} · abstain ${e.abstains}`,
          }
        : {
            tone: "kill",
            text: zh ? `⚖️ 放逐 座位 ${e.victim} · 票数 ${tally} · 弃票 ${e.abstains}` : `⚖️ Banished seat ${e.victim} · votes ${tally} · abstain ${e.abstains}`,
          };
    }
    case "death":
    case "phase_advance":
    case "game_over":
      return null;
  }
}

/** Settings panel strings. */
export const SETTINGS = {
  zh: {
    legend: "① 连接 agentd",
    baseUrl: "服务地址",
    token: "API Token(可空)",
    tokenHint: "agentd 开启鉴权时必填;只存在本地浏览器,不会上传",
    tenant: "租户 tenant",
    test: "测试连接",
    testing: "连接中…",
    save: "保存",
    saved: "已保存",
    ok: (n: number) => `✓ 连接成功 · 该租户已有 ${n} 个 agent`,
    unauthorized: "✗ 鉴权失败:token 错误或缺失(agentd 开了鉴权)",
    http: (s: string) => `✗ 服务返回错误:${s}`,
    network: (m: string) => `✗ 连不上:${m}(地址对吗?agentd 在跑吗?)`,
    seatsLegend: "② 初始化座位",
    seatsIntro: "把三个座位 agent(预言家/平民/狼)注册到该租户。人设由 Nightfall 内置,一键写入 agentd。",
    modelsTitle: "每座位模型",
    defaultModel: "默认模型",
    applyAll: "应用到全部",
    modelHint: "下拉选或手填任意 model id;改完点「重新初始化」生效",
    runningModel: (m: string) => `生效:${m}`,
    initSeats: "初始化座位",
    reinitSeats: "重新初始化",
    initializing: "注册中…",
    refresh: "刷新列表",
    registered: "已注册座位",
    none: "(该租户下还没有座位 agent,点上面初始化)",
    del: "删除",
    seatOk: (n: string) => `✓ ${n}`,
    seatErr: (n: string, e: string) => `✗ ${n}:${e}`,
    ready: "座位就绪,可以到下方开一局了 ↓",
  },
  en: {
    legend: "① Connect agentd",
    baseUrl: "baseUrl",
    token: "API token (optional)",
    tokenHint: "Required when agentd has auth on; stored only in this browser, never uploaded",
    tenant: "tenant",
    test: "Test connection",
    testing: "Testing…",
    save: "Save",
    saved: "Saved",
    ok: (n: number) => `✓ Connected · ${n} agent(s) in this tenant`,
    unauthorized: "✗ Unauthorized: token wrong or missing (agentd has auth on)",
    http: (s: string) => `✗ Server error: ${s}`,
    network: (m: string) => `✗ Unreachable: ${m} (right URL? is agentd running?)`,
    seatsLegend: "② Initialize seats",
    seatsIntro: "Register the three seat agents (seer/villager/wolf) into this tenant. Personas are built into Nightfall; one click writes them to agentd.",
    modelsTitle: "Per-seat model",
    defaultModel: "Default model",
    applyAll: "Apply to all",
    modelHint: "Pick from the list or type any model id; click Re-initialize to apply",
    runningModel: (m: string) => `live: ${m}`,
    initSeats: "Initialize seats",
    reinitSeats: "Re-initialize",
    initializing: "Registering…",
    refresh: "Refresh list",
    registered: "Registered seats",
    none: "(no seat agents in this tenant yet — initialize above)",
    del: "Delete",
    seatOk: (n: string) => `✓ ${n}`,
    seatErr: (n: string, e: string) => `✗ ${n}: ${e}`,
    ready: "Seats ready — start a game below ↓",
  },
} as const;
