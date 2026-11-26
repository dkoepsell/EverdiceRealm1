/**
 * Engagement feature flags (engagement spec: "Ship each phase behind a feature
 * flag"). Defaults live here; a campaign can override any of them through its
 * `engagement_flags` jsonb column (PATCH /api/campaigns/:id/engagement-flags).
 *
 * Rolled out 2026-11-20: every phase defaults ON. To pull one back for a single
 * campaign, set it false in that campaign's override; to pull it back for
 * everyone, flip the default here and redeploy.
 */
export const ENGAGEMENT_FLAGS = {
  /** Phase 1: pending level-ups with real 5e choices instead of silent HP bumps. */
  levelUps: true,
  /** Phase 2: ability checks rolled and resolved on the server, math shown in the Roll dialog. */
  serverChecks: true,
  /** Phase 2: the beat director picks turn rhythm in code. */
  beats: true,
  /** Phase 2: passive Perception/Insight/Investigation surfaced to narrator + UI. */
  passives: true,
  /** Phase 2: Inspiration, advantage/disadvantage, Help in the roll dialog. */
  inspiration: true,
  /** Phase 7: modular, shorter per-turn prompt. */
  promptDiet: true,
  /** Phase 3: campaign ledger (recurring cast, threads, deeds, callbacks). */
  ledger: true,
  /** Phase 4: threat clocks replace the scenes-since-combat timer. */
  clocks: true,
  /** Phase 4: action economy + class signature actions in managed combat. */
  classCombat: true,
  /** Phase 5: episode cards and "Previously on..." recaps. */
  episodes: true,
  /** Phase 2: "The rule underneath" explainers the first times a rule fires. */
  rulesUnderneath: true,
  /** Phase 6: learning-path one-shots on the Home screen. */
  learningPath: true,
  /** Phase 6: downtime activities between campaigns. */
  downtime: true,
  /** Phase 6: Wander/puzzle content excludes what the player has seen; combinatorial rooms + generated puzzles. */
  freshContent: true,
  /** Wander spec B: Wander choices resolve with the character's real checks; surprise from passive Perception. */
  wanderChecks: true,
  /** Wander spec A: threads (sign, trace, approach, climax, payoff). Needs migration 005. */
  wanderThreads: true,
  /** Wander spec B: pace, activity, time of day, weather, food and water, forced march, camping. */
  wanderTravel: true,
  /** Wander spec C: landmarks visible from a distance. */
  wanderLandmarks: true,
  /** Wander spec D: road rumors in the Tavern that point to a place. Needs migration 005. */
  wanderRumors: true,
  /** Wander spec E: recurring road characters, remembered in the Campaign Ledger. */
  wanderRecurring: true,
  /** Wander sites: dungeon entrances you can descend into, and villages, towns and cities you can enter. */
  wanderSites: true,
  /** Engagement 2: real 5e fights in Wander and Delve (server/play/skirmish). */
  exploreCombat: true,
  /** Engagement 2: a personal Wander trail per character, from their PHB background; pays off in Inspiration. */
  backstoryTrails: true,
  /** Engagement 2: the shared realm, signs and cairns all players see on the Wander map. Needs migration 006. */
  sharedRealm: true,
  /** Engagement 2: ignored trails run out of in-game days and the world changes (no real-time clock). */
  worldClocks: true,
  /** Danger spec Phase 1: a pacing dial, a danger floor, skirmish and hazard beats, and clocks that move. */
  dangerPacing: true,
  /** Danger spec Phase 5: routine combat rounds from the combat panel resolve in code with no model call. */
  fastCombatRounds: true,
  /** Companions spec: companions in every prompt, a moment per scene chosen in code, approval, their own skill rolls. */
  companionsAlive: true,
} as const;

export type EngagementFlag = keyof typeof ENGAGEMENT_FLAGS;

/**
 * How much danger a campaign wants (danger spec 1.1). Stored as the string
 * `pacing` inside the same engagement_flags jsonb (resolveFlags ignores
 * non-boolean keys, so it can't switch a flag by accident).
 */
export type Pacing = "story" | "balanced" | "action";
export const PACINGS: Pacing[] = ["story", "balanced", "action"];
export const DEFAULT_PACING: Pacing = "balanced";

export interface PacingProfile {
  /** Most scenes in a row without danger before the director must deal one. */
  dangerFloor: number;
  /** Segments on the alarm clock (fewer = it fills sooner). */
  alarmSegments: 4 | 6 | 8;
  /** Multipliers on the beat deck. */
  dangerWeight: number;
  talkWeight: number;
  /** Encounter difficulty mix, easy/medium/hard (deadly is reserved for climaxes). */
  difficultyMix: [number, number, number];
  label: string;
  description: string;
}

export const PACING_PROFILES: Record<Pacing, PacingProfile> = {
  story: {
    dangerFloor: 6, alarmSegments: 8, dangerWeight: 0.5, talkWeight: 1.5, difficultyMix: [0.4, 0.5, 0.1],
    label: "Story", description: "Mostly talk and exploration. Danger now and then, at least one fight a chapter.",
  },
  balanced: {
    dangerFloor: 4, alarmSegments: 6, dangerWeight: 1, talkWeight: 1, difficultyMix: [0.25, 0.5, 0.25],
    label: "Balanced", description: "A real mix. Danger every few scenes, about two fights a chapter.",
  },
  action: {
    dangerFloor: 2, alarmSegments: 4, dangerWeight: 2, talkWeight: 0.6, difficultyMix: [0.15, 0.5, 0.35],
    label: "Action", description: "Danger close behind. Fights, traps and chases most of the way.",
  },
};

export function resolvePacing(campaign?: { engagementFlags?: unknown } | null): Pacing {
  const raw = (campaign?.engagementFlags as any)?.pacing;
  return PACINGS.includes(raw) ? raw : DEFAULT_PACING;
}
export type EngagementFlags = Record<EngagementFlag, boolean>;

/**
 * Merge the defaults with a campaign's stored override. Unknown keys and
 * non-boolean values in the override are ignored, so a malformed jsonb value
 * can never switch something on by accident.
 */
export function resolveFlags(
  campaign?: { engagementFlags?: unknown } | null,
): EngagementFlags {
  const out = { ...ENGAGEMENT_FLAGS } as EngagementFlags;
  const raw = campaign?.engagementFlags;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const key of Object.keys(out) as EngagementFlag[]) {
      const v = (raw as Record<string, unknown>)[key];
      if (typeof v === "boolean") out[key] = v;
    }
  }
  return out;
}

export function isFlagOn(
  campaign: { engagementFlags?: unknown } | null | undefined,
  flag: EngagementFlag,
): boolean {
  return resolveFlags(campaign)[flag];
}

/**
 * Flags for surfaces that have no campaign yet (Home's learning path, the
 * Hearth's downtime). Defaults, plus any listed in the server's
 * ENGAGEMENT_FLAGS_ON env var (comma-separated), served at /api/engagement/flags.
 */
export function globalFlags(envList?: string | null): EngagementFlags {
  const out = { ...ENGAGEMENT_FLAGS } as EngagementFlags;
  for (const key of (envList ?? "").split(",").map((s) => s.trim())) {
    if (key in out) out[key as EngagementFlag] = true;
  }
  return out;
}

/** Every flag on: used for learning-path one-shots, which exist to show the new systems. */
export function allFlagsOn(): EngagementFlags {
  const out = { ...ENGAGEMENT_FLAGS } as EngagementFlags;
  for (const k of Object.keys(out) as EngagementFlag[]) out[k] = true;
  return out;
}
