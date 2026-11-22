/**
 * Wander checks with the real character (wander-threads-spec.md, Feature B,
 * "Checks, not flat odds"). Thin wrapper over shared/rules/checks.ts that adds
 * situational modifiers (pace, weather), exhaustion, saving throws, and the
 * surprise rules for travel encounters.
 */
import {
  checkModifier, combineRollMode, describeCheck, passiveScore, resolveCheck,
  type CheckCharacter, type CheckModifier,
} from "@shared/rules/checks";
import { getClassDef } from "@shared/rules/classProgression";
import { getAbilityModifier, getProficiencyBonus } from "@shared/rules/xp";
import type { AbilityName } from "@shared/rules/abilities";
import type { Situational } from "@shared/wander/travel";

export interface WanderCharacter extends CheckCharacter {
  name?: string | null;
  race?: string | null;
  class?: string | null;
}

export interface RollOutcome {
  success: boolean;
  total: number;
  dc: number;
  label: string;
  /** "Survival: d20 (12) + 2 WIS + 2 proficient - 5 fast pace = 11 vs DC 15 (Medium): failure" */
  text: string;
}

type D20 = () => number;

const ABILITIES: AbilityName[] = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];

/**
 * A plain ability check ("constitution"). shared/rules/checks.ts maps any
 * name it doesn't know as a skill to Strength, so raw abilities are handled
 * here.
 */
export function abilityCheckModifier(char: WanderCharacter, raw: string): CheckModifier | null {
  const k = raw.toLowerCase().replace(/\b(check|save|saving throw)\b/g, "").trim() as AbilityName;
  if (!ABILITIES.includes(k)) return null;
  const abilityMod = getAbilityModifier(Number((char as any)[k]) || 10);
  const label = `${k.charAt(0).toUpperCase()}${k.slice(1)} check`;
  return { skill: k, ability: k, abilityMod, proficient: false, expertise: false, proficiency: 0, total: abilityMod, label };
}
const d20default: D20 = () => 1 + Math.floor(Math.random() * 20);

/** Ability checks. Exhaustion 1+ is disadvantage on ability checks (SRD). */
export function rollSkill(
  char: WanderCharacter,
  skill: string,
  dc: number,
  opts: { exhaustion?: number; advantage?: number; disadvantage?: number; situational?: Situational[]; d20?: D20 } = {},
): RollOutcome {
  const base = abilityCheckModifier(char, skill) ?? checkModifier(char, skill);
  const sit = (opts.situational ?? []).filter((s) => s.value !== 0);
  const sitTotal = sit.reduce((s, x) => s + x.value, 0);
  const modifier: CheckModifier = { ...base, total: base.total + sitTotal };
  const dis = (opts.disadvantage ?? 0) + ((opts.exhaustion ?? 0) >= 1 ? 1 : 0);
  const mode = combineRollMode(opts.advantage ?? 0, dis);
  const r = resolveCheck(modifier, dc, mode, opts.d20 ?? d20default);
  let text = describeCheck(r);
  if (sit.length) {
    const parts = sit.map((s) => `${s.value >= 0 ? "+" : "−"} ${Math.abs(s.value)} ${s.label}`).join(" ");
    text = text.replace(" = ", ` ${parts} = `);
  }
  if ((opts.exhaustion ?? 0) >= 1 && mode === "disadvantage") text += " (exhaustion: disadvantage)";
  return { success: r.success, total: r.total, dc, label: base.label, text: `${base.label}: ${text}: ${r.success ? "success" : "failure"}` };
}

/** Saving throw, with class save proficiency. Exhaustion 3+ is disadvantage on saves. */
export function rollSave(char: WanderCharacter, ability: AbilityName, dc: number, opts: { exhaustion?: number; d20?: D20 } = {}): RollOutcome {
  const mod = getAbilityModifier(Number((char as any)[ability]) || 10);
  const def = char.class ? getClassDef(char.class) : undefined;
  const proficient = !!def?.savingThrows?.includes(ability);
  const prof = proficient ? getProficiencyBonus(char.level || 1) : 0;
  const disadvantage = (opts.exhaustion ?? 0) >= 3;
  const d20 = opts.d20 ?? d20default;
  const dice = disadvantage ? [d20(), d20()] : [d20()];
  const kept = disadvantage ? Math.min(...dice) : dice[0];
  const total = kept + mod + prof;
  const abbr = ability.slice(0, 3).toUpperCase();
  const label = `${ability.charAt(0).toUpperCase()}${ability.slice(1)} save`;
  const diceText = disadvantage ? `2d20 disadvantage (${dice.join(", ")} → ${kept})` : `d20 (${kept})`;
  const text = `${label}: ${diceText} ${mod >= 0 ? "+" : "−"} ${Math.abs(mod)} ${abbr}${prof ? ` + ${prof} proficient` : ""} = ${total} vs DC ${dc}: ${total >= dc ? "success" : "failure"}`;
  return { success: total >= dc, total, dc, label, text };
}

/** Passive Perception, with the -5 for disadvantage when exhausted. */
export function basePassivePerception(char: WanderCharacter, exhaustion = 0): number {
  return passiveScore(char, "perception") - (exhaustion >= 1 ? 5 : 0);
}

/** Races with darkvision in the SRD and common supplements ("elf" also covers half-elf and drow). */
const DARKVISION = ["dwarf", "elf", "gnome", "orc", "tiefling", "goblin", "kobold"];
export function hasDarkvision(race?: string | null): boolean {
  const r = (race ?? "").toLowerCase();
  return DARKVISION.some((x) => r.includes(x));
}

// ── surprise ──────────────────────────────────────────────────────────────────

export type Awareness = "unseen" | "spotted" | "ambushed";

const THREAT: Record<string, { stealth: number; passive: number }> = {
  easy: { stealth: 2, passive: 10 },
  medium: { stealth: 3, passive: 12 },
  hard: { stealth: 5, passive: 14 },
};

export function threatStats(difficulty?: string) {
  return THREAT[difficulty ?? "medium"] ?? THREAT.medium;
}

/**
 * Who notices whom (SRD "Surprise" plus travel-pace stealth):
 *  - moving at a slow pace, the party may travel stealthily: a Stealth check
 *    against the threat's passive Perception; success means it never sees you;
 *  - otherwise the threat's Stealth roll is compared with the party's passive
 *    Perception (already adjusted for pace, weather and darkness); if the
 *    threat beats it, the party is ambushed.
 */
export function determineAwareness(opts: {
  char: WanderCharacter;
  difficulty?: string;
  slowPace: boolean;
  passivePerception: number;
  exhaustion: number;
  d20?: D20;
}): { awareness: Awareness; notes: string[]; threatPassive: number } {
  const t = threatStats(opts.difficulty);
  const d20 = opts.d20 ?? d20default;
  const notes: string[] = [];
  if (opts.slowPace) {
    const s = rollSkill(opts.char, "stealth", t.passive, { exhaustion: opts.exhaustion, d20 });
    notes.push(`Travelling stealthily. ${s.text.replace(` vs DC ${t.passive}`, ` vs their passive Perception ${t.passive}`)}`);
    if (s.success) return { awareness: "unseen", notes, threatPassive: t.passive };
  }
  const roll = d20();
  const threatStealth = roll + t.stealth;
  const noticed = opts.passivePerception >= threatStealth;
  notes.push(`Their Stealth: d20 (${roll}) + ${t.stealth} = ${threatStealth} vs your passive Perception ${opts.passivePerception}: ${noticed ? "you spot them first" : "they catch you unaware"}`);
  return { awareness: noticed ? "spotted" : "ambushed", notes, threatPassive: t.passive };
}
