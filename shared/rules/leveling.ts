/**
 * Level-up rules: the single source for HP gain, features gained, ASIs and the
 * steps a level-up dialog has to walk through. Engagement spec Phase 1.
 *
 * Pure functions only — the server applies the result, the client previews it.
 * Before this, five separate code paths raised levels, each with its own
 * hit-die table, and the campaign-completion one read a Constitution score
 * that doesn't exist (conMod was always 0).
 */
import { ABILITY_NAMES, type AbilityName, isAbilityName } from "./abilities";
import {
  type ClassDef,
  type ClassFeature,
  type UsesMax,
  allFeaturesThrough,
  atLevel,
  featuresAtLevel,
  getClassDef,
  isAsiLevel,
} from "./classProgression";
import { CLASS_HIT_DICE, XP_THRESHOLDS, getAbilityModifier, getLevelFromXP, getProficiencyBonus } from "./xp";

export const MAX_LEVEL = 20;
export const ABILITY_SCORE_CAP = 20;

export type LevelingMode = "milestone" | "xp";

export function normalizeLevelingMode(v: unknown): LevelingMode {
  return v === "xp" ? "xp" : "milestone";
}

/** Stored on characters.pending_level_up while the player hasn't made their choices. */
export interface PendingLevelUp {
  /** Level the character is at now (the next resolved level is fromLevel + 1). */
  fromLevel: number;
  /** Level the character has earned. Usually fromLevel + 1; more only for XP catch-up. */
  toLevel: number;
  /** "chapter_gate:2", "campaign_complete:17", "xp" — why it was earned. */
  reason: string;
  earnedAt: string;
}

/** A feature the character has, with its remaining uses (if limited). */
export interface CharacterFeatureState {
  id: string;
  usesRemaining?: number;
}

export type AsiChoice =
  | { type: "plus2"; ability: AbilityName }
  | { type: "plus1x2"; abilities: [AbilityName, AbilityName] };

export interface LevelUpChoices {
  hpMode: "average" | "roll";
  asi?: AsiChoice;
  /** Subclass id; must be the class's SRD subclass. */
  subclass?: string;
}

export interface LevelUpCharacter {
  class: string;
  level: number;
  subclass?: string | null;
  maxHitPoints: number;
  hitPoints: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  features?: unknown;
  hitDiceRemaining?: number | null;
}

// ---------------------------------------------------------------------------
// Hit points
// ---------------------------------------------------------------------------

export function hitDieFor(className: string): number {
  const def = getClassDef(className);
  if (def) return def.hitDie;
  const key = Object.keys(CLASS_HIT_DICE).find((k) => k.toLowerCase() === className?.toLowerCase());
  return key ? CLASS_HIT_DICE[key] : 8;
}

/** 5e fixed value per level after 1st: half the die + 1 (d6→4, d8→5, d10→6, d12→7). */
export function averageHitDieGain(die: number): number {
  return die / 2 + 1;
}

export interface HpGain {
  die: number;
  conMod: number;
  /** The die result, or null when the average was taken. */
  rolled: number | null;
  base: number;
  /** HP added to max (minimum 1, per 5e). */
  gain: number;
}

export function hpGainForLevel(
  className: string,
  constitution: number,
  mode: "average" | "roll",
  rollDie: (sides: number) => number = (s) => 1 + Math.floor(Math.random() * s),
): HpGain {
  const die = hitDieFor(className);
  const conMod = getAbilityModifier(constitution);
  const rolled = mode === "roll" ? rollDie(die) : null;
  const base = rolled ?? averageHitDieGain(die);
  return { die, conMod, rolled, base, gain: Math.max(1, base + conMod) };
}

// ---------------------------------------------------------------------------
// Feature uses
// ---------------------------------------------------------------------------

export interface UsesContext {
  classLevel: number;
  abilityScores: Record<AbilityName, number>;
}

export function resolveUsesMax(max: UsesMax, ctx: UsesContext): number {
  if (typeof max === "number") return max;
  if (max === "profBonus") return getProficiencyBonus(ctx.classLevel);
  if (max === "classLevel") return ctx.classLevel;
  if (max === "classLevelX5") return ctx.classLevel * 5;
  if ("ability" in max) return Math.max(max.min, getAbilityModifier(ctx.abilityScores[max.ability] ?? 10) + (max.plus ?? 0));
  return atLevel(max.byLevel, ctx.classLevel) ?? 0;
}

function abilityScoresOf(c: LevelUpCharacter): Record<AbilityName, number> {
  const out = {} as Record<AbilityName, number>;
  for (const a of ABILITY_NAMES) out[a] = Number((c as any)[a]) || 10;
  return out;
}

export function parseFeatureState(raw: unknown): CharacterFeatureState[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is { id: string; usesRemaining?: unknown } => !!f && typeof (f as any).id === "string")
    .map((f) => (typeof f.usesRemaining === "number" ? { id: f.id, usesRemaining: f.usesRemaining } : { id: f.id }));
}

/**
 * The full feature list for a character at `level`, with uses refilled to max
 * for new or limited features. Existing remaining-use counts are kept when
 * `keepUses` is true (a level-up mid-adventure doesn't refill what you spent),
 * capped at the new maximum.
 */
export function buildFeatureState(
  def: ClassDef,
  level: number,
  subclass: string | null | undefined,
  scores: Record<AbilityName, number>,
  previous: CharacterFeatureState[] = [],
  keepUses = false,
): CharacterFeatureState[] {
  const prev = new Map(previous.map((f) => [f.id, f]));
  const hasSubclass = !!subclass && subclass === def.subclass.id;
  return allFeaturesThrough(def, level, hasSubclass).map((f) => {
    if (!f.uses) return { id: f.id };
    const max = resolveUsesMax(f.uses.max, { classLevel: level, abilityScores: scores });
    const old = prev.get(f.id)?.usesRemaining;
    const usesRemaining = keepUses && typeof old === "number" ? Math.min(max, old) : max;
    return { id: f.id, usesRemaining };
  });
}

// ---------------------------------------------------------------------------
// Level-up plan (what the dialog shows) and validation/application
// ---------------------------------------------------------------------------

export interface LevelUpPlan {
  className: string;
  fromLevel: number;
  toLevel: number; // the single level this step resolves (fromLevel + 1)
  remainingAfter: number; // further levels still pending after this one
  hitDie: number;
  conMod: number;
  averageGain: number;
  needsAsi: boolean;
  needsSubclass: boolean;
  subclassOption: { id: string; name: string; pitch: string; label: string } | null;
  /** Features gained at this level; `improves` = an existing feature getting better (same id as before). */
  newFeatures: (ClassFeature & { improves: boolean })[];
  proficiencyBonus: { from: number; to: number };
  /** True when the class data doesn't cover this level yet; features step is then empty. */
  beyondEncodedData: boolean;
}

export function planLevelUp(char: LevelUpCharacter, pending: PendingLevelUp): LevelUpPlan | null {
  const from = char.level;
  const to = from + 1;
  if (to > MAX_LEVEL || to > pending.toLevel) return null;
  const def = getClassDef(char.class);
  const die = hitDieFor(char.class);
  const conMod = getAbilityModifier(char.constitution);
  const beyond = !def || to > def.maxEncodedLevel;
  const hasSubclassNow = !!def && !!char.subclass && char.subclass === def.subclass.id;
  const needsSubclass = !!def && !beyond && !hasSubclassNow && to >= def.subclassLevel;
  const had = def ? new Set(allFeaturesThrough(def, from, hasSubclassNow).map((f) => f.id)) : new Set<string>();
  const newFeatures = def && !beyond
    ? featuresAtLevel(def, to, hasSubclassNow || needsSubclass).map((f) => ({ ...f, improves: had.has(f.id) }))
    : [];
  return {
    className: def?.name ?? char.class,
    fromLevel: from,
    toLevel: to,
    remainingAfter: Math.max(0, pending.toLevel - to),
    hitDie: die,
    conMod,
    averageGain: Math.max(1, averageHitDieGain(die) + conMod),
    needsAsi: !!def ? isAsiLevel(def, to) : [4, 8, 12, 16, 19].includes(to),
    needsSubclass,
    subclassOption: def && needsSubclass
      ? { id: def.subclass.id, name: def.subclass.name, pitch: def.subclass.pitch, label: def.subclassLabel }
      : null,
    newFeatures,
    proficiencyBonus: { from: getProficiencyBonus(from), to: getProficiencyBonus(to) },
    beyondEncodedData: beyond,
  };
}

export function validateLevelUpChoices(
  char: LevelUpCharacter,
  plan: LevelUpPlan,
  choices: LevelUpChoices,
): string[] {
  const errors: string[] = [];
  if (choices.hpMode !== "average" && choices.hpMode !== "roll") errors.push("Choose to take the average or roll your hit die.");
  if (plan.needsAsi) {
    const asi = choices.asi;
    if (!asi) {
      errors.push("Choose an Ability Score Improvement.");
    } else if (asi.type === "plus2") {
      if (!isAbilityName(asi.ability)) errors.push("Unknown ability.");
      else if ((char as any)[asi.ability] + 2 > ABILITY_SCORE_CAP) errors.push(`${asi.ability} can't go above ${ABILITY_SCORE_CAP}.`);
    } else if (asi.type === "plus1x2") {
      const [a, b] = asi.abilities ?? [];
      if (!isAbilityName(a) || !isAbilityName(b)) errors.push("Unknown ability.");
      else if (a === b) errors.push("Pick two different abilities for +1/+1 (or +2 to one).");
      else for (const ab of [a, b]) if ((char as any)[ab] + 1 > ABILITY_SCORE_CAP) errors.push(`${ab} can't go above ${ABILITY_SCORE_CAP}.`);
    } else {
      errors.push("Unknown Ability Score Improvement.");
    }
  } else if (choices.asi) {
    errors.push("No Ability Score Improvement at this level.");
  }
  if (plan.needsSubclass && choices.subclass !== plan.subclassOption?.id) {
    errors.push(`Choose your ${plan.subclassOption?.label ?? "subclass"}.`);
  }
  return errors;
}

export interface LevelUpResult {
  updates: {
    level: number;
    maxHitPoints: number;
    hitPoints: number;
    subclass: string | null;
    features: CharacterFeatureState[];
    hitDiceRemaining: number;
  } & Partial<Record<AbilityName, number>>;
  hp: HpGain;
  asiApplied: Partial<Record<AbilityName, number>>;
  newFeatureIds: string[];
}

export function applyLevelUp(
  char: LevelUpCharacter,
  plan: LevelUpPlan,
  choices: LevelUpChoices,
  rollDie?: (sides: number) => number,
): LevelUpResult {
  const scores = abilityScoresOf(char);
  const asiApplied: Partial<Record<AbilityName, number>> = {};
  if (plan.needsAsi && choices.asi) {
    if (choices.asi.type === "plus2") asiApplied[choices.asi.ability] = scores[choices.asi.ability] + 2;
    else for (const a of choices.asi.abilities) asiApplied[a] = scores[a] + 1;
  }
  const newScores = { ...scores, ...asiApplied } as Record<AbilityName, number>;
  // HP uses the Constitution AFTER this level's ASI. A Con increase also raises
  // HP retroactively by 1 per earlier level (5e: your modifier applies to every level).
  const hp = hpGainForLevel(char.class, newScores.constitution, choices.hpMode, rollDie);
  const conModDelta = getAbilityModifier(newScores.constitution) - getAbilityModifier(scores.constitution);
  const retroactive = conModDelta * char.level;
  const maxGain = hp.gain + retroactive;

  const def = getClassDef(char.class);
  const subclass = plan.needsSubclass ? choices.subclass ?? null : char.subclass ?? null;
  const previous = parseFeatureState(char.features);
  const features = def
    ? buildFeatureState(def, plan.toLevel, subclass, newScores, previous, true)
    : previous;
  const prevIds = new Set(previous.map((f) => f.id));
  // Hit Dice: one more die; you gain it unspent.
  const hdBase = typeof char.hitDiceRemaining === "number" ? char.hitDiceRemaining : char.level;
  return {
    updates: {
      level: plan.toLevel,
      maxHitPoints: char.maxHitPoints + maxGain,
      // Gaining a level raises current HP by the same amount; it does not heal you to full.
      hitPoints: Math.max(1, char.hitPoints + maxGain),
      subclass,
      features,
      hitDiceRemaining: Math.min(plan.toLevel, hdBase + 1),
      ...asiApplied,
    },
    hp,
    asiApplied,
    newFeatureIds: features.map((f) => f.id).filter((id) => !prevIds.has(id)),
  };
}

// ---------------------------------------------------------------------------
// Earning levels
// ---------------------------------------------------------------------------

/**
 * Record that a level was earned. Never more than one level per gate: a
 * milestone adds exactly one level on top of whatever is already pending.
 * XP mode can catch up several levels at once (threshold crossing).
 */
export function earnLevel(
  currentLevel: number,
  existing: PendingLevelUp | null | undefined,
  reason: string,
  opts: { mode: LevelingMode; xp?: number; now?: string } = { mode: "milestone" },
): PendingLevelUp | null {
  const now = opts.now ?? new Date().toISOString();
  const base = existing && existing.toLevel > currentLevel ? existing : null;
  if (base && base.reason === reason) return base; // same gate reported twice
  let target: number;
  if (opts.mode === "xp") {
    target = Math.min(MAX_LEVEL, getLevelFromXP(opts.xp ?? 0));
    if (target <= (base?.toLevel ?? currentLevel)) return base;
  } else {
    target = Math.min(MAX_LEVEL, (base?.toLevel ?? currentLevel) + 1);
    if (target <= currentLevel) return base;
  }
  return { fromLevel: currentLevel, toLevel: target, reason, earnedAt: base?.earnedAt ?? now };
}

export function parsePendingLevelUp(raw: unknown): PendingLevelUp | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as any;
  if (typeof r.toLevel !== "number" || typeof r.fromLevel !== "number") return null;
  return { fromLevel: r.fromLevel, toLevel: r.toLevel, reason: String(r.reason ?? ""), earnedAt: String(r.earnedAt ?? "") };
}

/** XP needed for the next level, for display. */
export function xpForNextLevel(level: number): number | null {
  return level >= MAX_LEVEL ? null : XP_THRESHOLDS[level] ?? null;
}

/** Compact "FEATURES:" line for the per-turn prompt. */
export function featuresPromptLine(
  className: string,
  level: number,
  subclass: string | null | undefined,
  state: CharacterFeatureState[],
): string {
  const def = getClassDef(className);
  if (!def || !state.length) return "";
  const all = new Map(allFeaturesThrough(def, level, !!subclass && subclass === def.subclass.id).map((f) => [f.id, f]));
  const parts: string[] = [];
  for (const s of state) {
    const f = all.get(s.id);
    if (!f || f.kind === "passive" && !f.scaling) continue;
    const scale = atLevel(f.scaling, level);
    const uses = typeof s.usesRemaining === "number" ? ` (${s.usesRemaining} left)` : "";
    const kind = f.kind === "bonusAction" ? ", bonus action" : f.kind === "reaction" ? ", reaction" : "";
    parts.push(`${f.name}${scale ? ` ${scale}` : ""}${kind}${uses}`);
  }
  return parts.length ? `FEATURES: ${parts.join("; ")}` : "";
}

/**
 * What an XP award does to level, for every XP path (DM award, story turn,
 * campaign completion). One decision point so the paths can't drift again.
 *
 * - levelUps flag OFF (legacy): level follows XP immediately, HP rises by the
 *   5e fixed value per level (correct Con modifier; min 1 per level).
 * - flag ON, xp mode: level stays; a PendingLevelUp is recorded for the dialog.
 * - flag ON, milestone mode: XP is just a number; levels come from chapter
 *   gates and completion (earnLevel with mode "milestone").
 */
export interface XpLevelOutcome {
  level: number;
  hpGain: number;
  leveledUp: boolean;
  /** Present only when it changed. */
  pendingLevelUp?: PendingLevelUp | null;
}

export function levelOutcomeForXp(
  char: { class: string; level: number; constitution: number; pendingLevelUp?: unknown },
  newXp: number,
  opts: { levelUpsFlag: boolean; mode: LevelingMode; reason: string; now?: string },
): XpLevelOutcome {
  const current = char.level || 1;
  if (!opts.levelUpsFlag) {
    const level = Math.max(current, Math.min(MAX_LEVEL, getLevelFromXP(newXp)));
    const gained = level - current;
    const per = hpGainForLevel(char.class, char.constitution, "average").gain;
    return { level, hpGain: gained * per, leveledUp: gained > 0 };
  }
  if (opts.mode === "xp") {
    const existing = parsePendingLevelUp(char.pendingLevelUp);
    const next = earnLevel(current, existing, opts.reason, { mode: "xp", xp: newXp, now: opts.now });
    const changed = JSON.stringify(next) !== JSON.stringify(existing);
    return { level: current, hpGain: 0, leveledUp: false, ...(changed ? { pendingLevelUp: next } : {}) };
  }
  return { level: current, hpGain: 0, leveledUp: false };
}
