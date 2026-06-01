import { useCallback, useRef, useState } from "react";
import { AgentdClient } from "@agentd";
import { createGame, fallbackDecision } from "@engine";
import type { Decision, Faction, GameState } from "@engine";
import { createAgentdCaller, runGame } from "@orchestrator";
import type { AgentCaller, AgentRequest, Observer } from "@orchestrator";
import type { SpectatorConfig } from "./config.js";
import type { ConnectionSettings } from "./settings.js";
import { Pacer } from "./pacer.js";
import { resolutionText } from "./i18n.js";
import type { TimelineItem } from "./timeline.js";

export type RunStatus = "idle" | "running" | "paused" | "done" | "error";

export interface RunnerState {
  status: RunStatus;
  game: GameState | null;
  timeline: TimelineItem[];
  winner: Faction | null;
  error: string | null;
  /** Set when it's the local human seat's turn; the UI renders an input panel. */
  pendingHuman: AgentRequest | null;
}

/**
 * Drives a spectated game. All game logic stays in the engine/orchestrator;
 * this hook only (a) injects the agentd-backed caller, (b) maps observer events
 * to renderable React state, and (c) routes playback controls to the Pacer.
 */
export function useGameRunner() {
  const [state, setState] = useState<RunnerState>({
    status: "idle",
    game: null,
    timeline: [],
    winner: null,
    error: null,
    pendingHuman: null,
  });

  const pacerRef = useRef<Pacer | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const idRef = useRef(0);
  const nextId = () => ++idRef.current;
  // Resolver for the human seat's awaited decision (set while pendingHuman).
  const humanResolveRef = useRef<((d: Decision) => void) | null>(null);

  const submitHuman = useCallback((decision: Decision) => {
    const resolve = humanResolveRef.current;
    humanResolveRef.current = null;
    setState((s) => ({ ...s, pendingHuman: null }));
    resolve?.(decision);
  }, []);

  const push = useCallback((item: TimelineItem) => {
    setState((s) => ({ ...s, timeline: [...s.timeline, item] }));
  }, []);

  const start = useCallback(
    (config: SpectatorConfig, connection: ConnectionSettings) => {
      abortRef.current?.abort();
      const pacer = new Pacer(config.stepDelayMs, false);
      const abort = new AbortController();
      pacerRef.current = pacer;
      abortRef.current = abort;
      idRef.current = 0;

      // Unique game_id per Start → fresh agentd scope per game (no context
      // bleed when re-running the same seed). Engine replay still depends only
      // on (seed, decisions), not on game_id.
      const game = createGame(config.seed, `g${config.seed}-${Date.now().toString(36)}`);
      setState({ status: "running", game, timeline: [], winner: null, error: null, pendingHuman: null });

      const client = new AgentdClient({
        baseUrl: connection.baseUrl,
        tenant: connection.tenant,
        token: connection.token,
      });
      const aiCaller = createAgentdCaller({ client, gameId: game.game_id, pool: config.pool, lang: config.lang });
      const humanSeat = config.humanSeat;
      // For the human seat, don't call agentd — hand the projected SeatView to
      // the UI and await the human's submission (same Decision schema). All
      // other seats go to agentd. The engine/orchestrator don't know the source.
      const agentCaller: AgentCaller = (req) => {
        if (humanSeat !== null && req.seat === humanSeat) {
          return new Promise<Decision>((resolve) => {
            humanResolveRef.current = resolve;
            setState((s) => ({ ...s, pendingHuman: req }));
          });
        }
        return aiCaller(req);
      };
      const lang = config.lang;

      const observer: Observer = {
        onGameStart: (g) => setState((s) => ({ ...s, game: g })),
        onPhaseStart: (e, g) => {
          setState((s) => ({ ...s, game: g }));
          push({ id: nextId(), kind: "phase", day: e.day, phase: e.phase, actors: e.actors });
        },
        onSeatDecision: (e, g) => {
          setState((s) => ({ ...s, game: g }));
          push({
            id: nextId(),
            kind: "decision",
            day: e.day,
            phase: e.phase,
            seat: e.seat,
            role: e.role,
            action: e.decision.action,
            target: e.decision.target,
            say: e.decision.say,
            reason: e.decision.reason,
            ...(e.error !== undefined ? { error: e.error } : {}),
          });
        },
        onResolution: (e, g) => {
          setState((s) => ({ ...s, game: g }));
          for (const ev of e.events) {
            const r = resolutionText(g, ev, lang);
            if (r) push({ id: nextId(), kind: "resolution", day: e.day, phase: e.phase, text: r.text, tone: r.tone, event: ev });
          }
        },
        onGameOver: (winner, g) => {
          setState((s) => ({ ...s, game: g, winner }));
          push({ id: nextId(), kind: "gameover", winner });
        },
      };

      runGame({
        state: game,
        agentCaller,
        observer,
        options: { gate: () => pacer.gate(), signal: abort.signal },
      })
        .then((res) => {
          setState((s) => ({ ...s, status: res.aborted ? "idle" : "done", winner: res.winner, game: res.state, pendingHuman: null }));
        })
        .catch((err) => {
          setState((s) => ({ ...s, status: "error", error: err instanceof Error ? err.message : String(err) }));
        });
    },
    [push],
  );

  const pause = useCallback(() => {
    pacerRef.current?.pause();
    setState((s) => (s.status === "running" ? { ...s, status: "paused" } : s));
  }, []);
  const resume = useCallback(() => {
    pacerRef.current?.resume();
    setState((s) => (s.status === "paused" ? { ...s, status: "running" } : s));
  }, []);
  const step = useCallback(() => {
    pacerRef.current?.pause();
    pacerRef.current?.step();
    setState((s) => (s.status === "running" ? { ...s, status: "paused" } : s));
  }, []);
  const stop = useCallback(() => {
    abortRef.current?.abort();
    pacerRef.current?.abort();
    // Unblock a pending human turn so the awaited promise resolves and the loop
    // can exit at the next boundary.
    const resolve = humanResolveRef.current;
    if (resolve) {
      humanResolveRef.current = null;
      setState((s) => ({ ...s, pendingHuman: null }));
      resolve(fallbackDecision(state.game?.phase ?? "day_vote"));
    }
    setState((s) => ({ ...s, status: "idle" }));
  }, [state.game?.phase]);
  const setDelay = useCallback((ms: number) => pacerRef.current?.setDelay(ms), []);

  return { ...state, start, pause, resume, step, stop, setDelay, submitHuman };
}
