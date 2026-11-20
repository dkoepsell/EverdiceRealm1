/**
 * Campaign length → chapter count. One source for both creation paths
 * (POST /api/campaigns and the CAML import), which previously each carried
 * their own switch and silently treated any unknown value — including the
 * "oneshot" PlayerQuickStart sends — as a 5–6 chapter standard campaign.
 */
export type CampaignLength = "one_shot" | "quick" | "standard" | "epic" | "legendary";

const ALIASES: Record<string, CampaignLength> = {
  one_shot: "one_shot",
  oneshot: "one_shot",
  "one-shot": "one_shot",
  short: "quick",
  quick: "quick",
  standard: "standard",
  full: "standard",
  epic: "epic",
  legendary: "legendary",
};

export function normalizeCampaignLength(raw: unknown): CampaignLength {
  if (typeof raw !== "string") return "standard";
  return ALIASES[raw.trim().toLowerCase()] ?? "standard";
}

/**
 * Chapter count for a length. `source: "imported"` keeps the CAML importer's
 * slightly shorter ranges (an imported module brings its own structure).
 * `rand` is injectable for tests.
 */
export function chaptersForLength(
  length: CampaignLength,
  source: "generated" | "imported" = "generated",
  rand: () => number = Math.random,
): number {
  const pick = (min: number, span: number) => min + Math.floor(rand() * span);
  switch (length) {
    case "one_shot":
      // One chapter = the finale from the first scene, so the existing finale
      // pacing (urgency at 6 scenes, ending by 8) makes it a ~30-minute story.
      return 1;
    case "quick":
      return 3;
    case "epic":
      return source === "imported" ? pick(6, 3) : pick(8, 3);
    case "legendary":
      return source === "imported" ? pick(4, 2) : pick(12, 4); // import never had a legendary tier
    case "standard":
    default:
      return source === "imported" ? pick(4, 2) : pick(5, 2);
  }
}

export interface LengthPacing {
  /** Fewest scenes before a chapter gate is accepted. */
  minScenes: number;
  /** Scenes after which a chapter is force-advanced. */
  hardCap: number;
  /** Chapter-close nudges to the DM (gentle / moderate / urgent), in scenes. */
  nudges: [number, number, number];
  /** Target scenes per ~15-20 minute episode. */
  episodeScenes: number;
}

/**
 * Pacing by campaign length (engagement spec 5.1): shorter campaigns move
 * faster, so a phone player reaches a payoff in one sitting. A one-shot is a
 * single chapter, which the finale pacing already ends in 6–8 scenes.
 */
export function pacingForLength(length: CampaignLength): LengthPacing {
  switch (length) {
    case "one_shot":
      return { minScenes: 3, hardCap: 8, nudges: [4, 6, 7], episodeScenes: 7 };
    case "quick":
      return { minScenes: 4, hardCap: 9, nudges: [4, 6, 8], episodeScenes: 7 };
    case "epic":
    case "legendary":
      return { minScenes: 5, hardCap: 14, nudges: [6, 8, 10], episodeScenes: 8 };
    case "standard":
    default:
      return { minScenes: 5, hardCap: 13, nudges: [5, 7, 9], episodeScenes: 8 };
  }
}
