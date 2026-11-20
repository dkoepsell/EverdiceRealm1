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
