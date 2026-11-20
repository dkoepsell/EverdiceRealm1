/**
 * Ability checks, resolved in code (engagement spec Phase 2: "Code resolves the
 * rules; the AI narrates them"). The model may PROPOSE a check (skill + DC);
 * this module validates it, computes the modifier and its breakdown, rolls,
 * and decides success. Before this, the client computed the modifier and
 * decided success, and the server trusted the total it was sent.
 */
import { ABILITY_ABBR, type AbilityName } from "./abilities";
import { parseFeatureState } from "./leveling";
import { SKILL_ABILITY_MAP } from "./skills";
import { getAbilityModifier, getProficiencyBonus } from "./xp";

/** 5e DC bands (PHB/SRD "Typical Difficulty Classes"). */
export const DC_BANDS = [
  { dc: 5, label: "Very easy" },
  { dc: 10, label: "Easy" },
  { dc: 15, label: "Medium" },
  { dc: 20, label: "Hard" },
  { dc: 25, label: "Very hard" },
  { dc: 30, label: "Nearly impossible" },
] as const;

/** Nearest DC band label (a DC of 13 reads "Medium"; 12 reads "Easy"... rounds to nearest band). */
export function dcLabel(dc: number): string {
  let best: (typeof DC_BANDS)[number] = DC_BANDS[0];
  for (const b of DC_BANDS) if (Math.abs(b.dc - dc) < Math.abs(best.dc - dc) || (Math.abs(b.dc - dc) === Math.abs(best.dc - dc) && b.dc > best.dc)) best = b;
  return best.label;
}

/** Clamp a model-proposed DC into 5..30; non-numbers become Medium (15). */
export function validateDc(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return 15;
  return Math.max(5, Math.min(30, Math.round(n)));
}

export const SKILL_LABELS: Record<string, string> = {
  athletics: "Athletics", acrobatics: "Acrobatics", sleight_of_hand: "Sleight of Hand", stealth: "Stealth",
  arcana: "Arcana", history: "History", investigation: "Investigation", nature: "Nature", religion: "Religion",
  animal_handling: "Animal Handling", insight: "Insight", medicine: "Medicine", perception: "Perception",
  survival: "Survival", deception: "Deception", intimidation: "Intimidation", performance: "Performance",
  persuasion: "Persuasion", thieves_tools: "Thieves' Tools",
};

const SKILL_ALIASES: Record<string, string> = {
  search: "investigation", investigate: "investigation", notice: "perception", spot: "perception", listen: "perception",
  sneak: "stealth", hide: "stealth", persuade: "persuasion", charm: "persuasion", diplomacy: "persuasion",
  lie: "deception", bluff: "deception", intimidate: "intimidation", threaten: "intimidation",
  climb: "athletics", swim: "athletics", jump: "athletics", tumble: "acrobatics", balance: "acrobatics",
  heal: "medicine", track: "survival", lockpicking: "thieves_tools", lockpick: "thieves_tools",
  sense_motive: "insight", read: "insight", sleight: "sleight_of_hand", pickpocket: "sleight_of_hand",
};

/** Map whatever the model wrote ("Persuasion Check", "lie") to a 5e skill key, or an ability name, or null. */
export function normalizeSkill(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const k = raw.toLowerCase().replace(/\b(check|save|saving throw|roll)\b/g, "").trim().replace(/[\s-]+/g, "_").replace(/'/g, "");
  if (k === "attack") return "attack";
  if (SKILL_LABELS[k]) return k;
  if (SKILL_ALIASES[k]) return SKILL_ALIASES[k];
  if (SKILL_ABILITY_MAP[k]) return k; // raw ability checks ("strength")
  for (const key of Object.keys(SKILL_LABELS)) if (k.includes(key)) return key;
  return null;
}

export interface CheckCharacter {
  level?: number | null;
  skills?: string[] | null;
  features?: unknown;
  strength: number; dexterity: number; constitution: number;
  intelligence: number; wisdom: number; charisma: number;
}

export interface CheckModifier {
  skill: string;
  ability: AbilityName;
  abilityMod: number;
  proficient: boolean;
  expertise: boolean;
  /** Proficiency added (0, half for Jack of All Trades, full, or double for Expertise). */
  proficiency: number;
  total: number;
  /** "Charisma (Persuasion)" */
  label: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[\s-]+/g, "_").replace(/'/g, "");

export function checkModifier(char: CheckCharacter, skillRaw: string): CheckModifier {
  const skill = normalizeSkill(skillRaw) ?? "strength";
  const ability = (SKILL_ABILITY_MAP[skill] ?? "strength") as AbilityName;
  const abilityMod = getAbilityModifier(Number((char as any)[ability]) || 10);
  const prof = getProficiencyBonus(char.level || 1);
  const isRawAbility = skill === ability;
  const proficient = !isRawAbility && Array.isArray(char.skills) && char.skills.some((s) => norm(String(s)) === skill);
  const features = parseFeatureState(char.features);
  const expertise = proficient && features.some((f) => f.id === "expertise" && (f.choices ?? []).map(norm).includes(skill));
  const jack = features.some((f) => f.id === "jack_of_all_trades");
  const proficiency = expertise ? prof * 2 : proficient ? prof : jack ? Math.floor(prof / 2) : 0;
  const abilityLabel = ability.charAt(0).toUpperCase() + ability.slice(1);
  return {
    skill,
    ability,
    abilityMod,
    proficient,
    expertise,
    proficiency,
    total: abilityMod + proficiency,
    label: isRawAbility ? `${abilityLabel} check` : `${abilityLabel} (${SKILL_LABELS[skill] ?? skill})`,
  };
}

/** 10 + modifier (+5/-5 for advantage/disadvantage on passive checks, per 5e). */
export function passiveScore(char: CheckCharacter, skill: "perception" | "investigation" | "insight"): number {
  return 10 + checkModifier(char, skill).total;
}

export function passives(char: CheckCharacter) {
  return {
    perception: passiveScore(char, "perception"),
    investigation: passiveScore(char, "investigation"),
    insight: passiveScore(char, "insight"),
  };
}

export type RollMode = "normal" | "advantage" | "disadvantage";

/**
 * Advantage and disadvantage never stack: any number of sources of each
 * reduce to one, and having both cancels to a normal roll.
 */
export function combineRollMode(advantageSources: number, disadvantageSources: number): RollMode {
  const a = advantageSources > 0;
  const d = disadvantageSources > 0;
  if (a && d) return "normal";
  if (a) return "advantage";
  if (d) return "disadvantage";
  return "normal";
}

export interface CheckResult {
  dice: number[]; // one d20, or two when rolling with advantage/disadvantage
  kept: number;
  mode: RollMode;
  modifier: CheckModifier;
  total: number;
  dc: number;
  dcLabel: string;
  success: boolean;
  natural20: boolean;
  natural1: boolean;
}

/**
 * Resolve an ability check. Note: in 5e a natural 20 or 1 on an ability check
 * is NOT an automatic success or failure (that rule is for attack rolls and
 * death saves); we still flag them for narration.
 */
export function resolveCheck(
  modifier: CheckModifier,
  dc: number,
  mode: RollMode,
  d20: () => number = () => 1 + Math.floor(Math.random() * 20),
): CheckResult {
  const dice = mode === "normal" ? [d20()] : [d20(), d20()];
  const kept = mode === "advantage" ? Math.max(...dice) : mode === "disadvantage" ? Math.min(...dice) : dice[0];
  const total = kept + modifier.total;
  return {
    dice, kept, mode, modifier, total, dc, dcLabel: dcLabel(dc),
    success: total >= dc, natural20: kept === 20, natural1: kept === 1,
  };
}

/** "d20 (14) + 3 Charisma + 2 proficient = 19 vs DC 13 (Medium)" */
export function describeCheck(r: CheckResult): string {
  const m = r.modifier;
  const dice = r.dice.length > 1 ? `2d20 ${r.mode} (${r.dice.join(", ")} → ${r.kept})` : `d20 (${r.kept})`;
  const parts = [dice, `${m.abilityMod >= 0 ? "+" : "−"} ${Math.abs(m.abilityMod)} ${ABILITY_ABBR[m.ability]}`];
  if (m.proficiency) parts.push(`+ ${m.proficiency} ${m.expertise ? "expertise" : m.proficient ? "proficient" : "Jack of All Trades"}`);
  return `${parts.join(" ")} = ${r.total} vs DC ${r.dc} (${r.dcLabel})`;
}
