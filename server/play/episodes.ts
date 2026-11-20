/**
 * Episodes (engagement spec 5.2): ~15–20 minutes of play ending on a card —
 * what you gained, a short-rest decision, the clock most at risk, and the
 * cliffhanger — so a phone player gets a payoff every sitting. Kept on the
 * session's storyState.episode.
 */
import type { Clock } from "./clocks";

export interface EpisodeState {
  number: number;
  startedAt: string;
  scenes: number;
  gains: { items: string[]; allies: string[]; rules: string[] };
}

export function parseEpisode(raw: unknown, now = new Date().toISOString()): EpisodeState {
  const r = (raw && typeof raw === "object" ? raw : {}) as any;
  return {
    number: typeof r.number === "number" ? r.number : 1,
    startedAt: typeof r.startedAt === "string" ? r.startedAt : now,
    scenes: typeof r.scenes === "number" ? r.scenes : 0,
    gains: {
      items: Array.isArray(r.gains?.items) ? r.gains.items : [],
      allies: Array.isArray(r.gains?.allies) ? r.gains.allies : [],
      rules: Array.isArray(r.gains?.rules) ? r.gains.rules : [],
    },
  };
}

const uniq = (a: string[]) => Array.from(new Set(a.filter(Boolean)));

export function trackEpisode(ep: EpisodeState, turn: { items?: string[]; allies?: string[]; rules?: string[] }): EpisodeState {
  return {
    ...ep,
    scenes: ep.scenes + 1,
    gains: {
      items: uniq([...ep.gains.items, ...(turn.items ?? [])]).slice(-6),
      allies: uniq([...ep.gains.allies, ...(turn.allies ?? [])]).slice(-6),
      rules: uniq([...ep.gains.rules, ...(turn.rules ?? [])]),
    },
  };
}

/**
 * A good break point: never mid-fight; a chapter that just turned; the DM's
 * own breakpoint after a few scenes; or the episode is at its target length and
 * this scene was a breather (or it has run two scenes over).
 */
export function shouldEndEpisode(
  ep: EpisodeState,
  s: { inCombat: boolean; chapterAdvanced: boolean; sessionBreakpoint: boolean; beat?: string | null; targetScenes: number },
): boolean {
  if (s.inCombat) return false;
  if (s.chapterAdvanced) return true;
  if (s.sessionBreakpoint && ep.scenes >= 4) return true;
  if (ep.scenes >= s.targetScenes && (s.beat === "quiet" || s.beat === "discovery")) return true;
  return ep.scenes >= s.targetScenes + 2;
}

export function nextEpisode(ep: EpisodeState, now = new Date().toISOString()): EpisodeState {
  return { number: ep.number + 1, startedAt: now, scenes: 0, gains: { items: [], allies: [], rules: [] } };
}

/** "About 12 minutes left": ~2 minutes a scene. */
export function minutesLeft(ep: EpisodeState, targetScenes: number): number {
  return Math.max(2, (targetScenes - ep.scenes) * 2);
}

export interface EpisodeCard {
  number: number;
  title: string;
  cliffhanger: string;
  gains: EpisodeState["gains"];
  nextClock: { name: string; filled: number; segments: number; ifRest: number } | null;
  rest: { hp: number; maxHp: number; hitDiceLeft: number; hitDie: number; conMod: number } | null;
}

/** The clock most at risk, and what a short rest would push it to. */
export function clockAtRisk(clocks: Clock[]): EpisodeCard["nextClock"] {
  const live = clocks.filter((c) => c.filled > 0).sort((a, b) => b.filled / b.segments - a.filled / a.segments);
  const c = live[0];
  if (!c) return null;
  const restTicks = c.id === "villain_plan" || c.id === "wilderness_danger" ? 1 : 0;
  return { name: c.name, filled: c.filled, segments: c.segments, ifRest: Math.min(c.segments, c.filled + restTicks) };
}

/** Last sentence of the scene, as the cliffhanger when no hook was generated. */
export function lastSentence(text: string): string {
  const parts = (text || "").replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/);
  return parts[parts.length - 1] ?? "";
}
