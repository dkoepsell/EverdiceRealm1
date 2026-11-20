/**
 * Narrative style and difficulty: one canonical list for the Settings
 * dropdowns, the creation form and the narrator.
 *
 * Campaigns in prod store these inconsistently ("descriptive", "Descriptive",
 * "balanced", "Dark & Gritty", "classic_fantasy", "Normal - Balanced
 * Challenge", "normal", "1-5"...) because different creation paths wrote
 * different strings. The Settings dropdowns compared the raw value against
 * fixed option strings, so most campaigns showed them blank. Everything now
 * reads through these normalisers.
 */
export const NARRATIVE_STYLES = [
  { value: "descriptive", label: "Descriptive" },
  { value: "dramatic", label: "Dramatic" },
  { value: "conversational", label: "Conversational" },
  { value: "humorous", label: "Humorous" },
  { value: "dark", label: "Dark & Gritty" },
  { value: "heroic", label: "Heroic Fantasy" },
  { value: "mystery", label: "Mystery" },
] as const;
export type NarrativeStyle = (typeof NARRATIVE_STYLES)[number]["value"];

export const DIFFICULTIES = [
  { value: "Easy - Beginner Friendly", label: "Easy - Beginner Friendly" },
  { value: "Normal - Balanced Challenge", label: "Normal - Balanced Challenge" },
  { value: "Hard - Deadly Encounters", label: "Hard - Deadly Encounters" },
] as const;
export type Difficulty = (typeof DIFFICULTIES)[number]["value"];

export function normalizeNarrativeStyle(raw: unknown): NarrativeStyle {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "descriptive";
  if (s.startsWith("dark") || s.includes("gritty") || s.includes("grim")) return "dark";
  if (s.includes("heroic") || s.includes("classic") || s.includes("epic")) return "heroic";
  if (s.includes("myster") || s.includes("noir") || s.includes("intrigue")) return "mystery";
  if (s.includes("humor") || s.includes("comed") || s.includes("light-hearted") || s.includes("lighthearted")) return "humorous";
  if (s.includes("dramat")) return "dramatic";
  if (s.includes("conversation") || s.includes("casual")) return "conversational";
  // "descriptive", "balanced", "tutorial_friendly", themes like "steampunk"...
  return "descriptive";
}

export function normalizeDifficulty(raw: unknown): Difficulty {
  const s = String(raw ?? "").trim().toLowerCase();
  if (/^(easy|relaxed|beginner|story)/.test(s) || s.includes("beginner")) return "Easy - Beginner Friendly";
  if (/^(hard|deadly|challenging|heroic|brutal)/.test(s) || s.includes("deadly")) return "Hard - Deadly Encounters";
  // "normal", "balanced", "medium", "moderate", level ranges like "1-5", unknown
  return "Normal - Balanced Challenge";
}

export function narrativeStyleLabel(raw: unknown): string {
  const v = normalizeNarrativeStyle(raw);
  return NARRATIVE_STYLES.find((o) => o.value === v)!.label;
}
