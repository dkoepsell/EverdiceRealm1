/**
 * Engagement feature flags (engagement spec: "Ship each phase behind a feature
 * flag"). Defaults live here; a campaign can override any of them through its
 * `engagement_flags` jsonb column, so a phase can be switched on for one table
 * and compared against the Phase 0 engagement report before it goes wide.
 */
export const ENGAGEMENT_FLAGS = {
  /** Phase 1: pending level-ups with real 5e choices instead of silent HP bumps. */
  levelUps: false,
  /** Phase 2: ability checks rolled and resolved on the server, math shown in the Roll dialog. */
  serverChecks: false,
  /** Phase 2: the beat director picks turn rhythm in code. */
  beats: false,
  /** Phase 2: passive Perception/Insight/Investigation surfaced to narrator + UI. */
  passives: false,
  /** Phase 2: Inspiration, advantage/disadvantage, Help in the roll dialog. */
  inspiration: false,
  /** Phase 7: modular, shorter per-turn prompt. */
  promptDiet: false,
  /** Phase 3: campaign ledger (recurring cast, threads, deeds, callbacks). */
  ledger: false,
  /** Phase 4: threat clocks replace the scenes-since-combat timer. */
  clocks: false,
  /** Phase 4: action economy + class signature actions in managed combat. */
  classCombat: false,
  /** Phase 5: episode cards and "Previously on..." recaps. */
  episodes: false,
  /** Phase 2: "The rule underneath" explainers the first times a rule fires. */
  rulesUnderneath: false,
  /** Phase 6: learning-path one-shots on the Home screen. */
  learningPath: false,
  /** Phase 6: downtime activities between campaigns. */
  downtime: false,
  /** Phase 6: Wander/puzzle content excludes what the player has seen; combinatorial rooms + generated puzzles. */
  freshContent: false,
} as const;

export type EngagementFlag = keyof typeof ENGAGEMENT_FLAGS;
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
