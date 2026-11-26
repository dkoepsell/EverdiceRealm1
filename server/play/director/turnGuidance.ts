/**
 * Phase 2 turn mechanics, assembled for the prompt and validated afterwards.
 *
 * In:  feature flags, the beat for this turn, the acting character.
 * Out: short prompt lines (BEAT, PASSIVES, INSPIRATION) and the extra JSON
 *      fields the model may return; then, after the model answers, the checked
 *      result: choices clamped to the beat, a passive notice only if the
 *      character's passive score really meets the DC, Inspiration only if
 *      they don't already have it, a failure cost only after a failed roll.
 */
import type { Character } from "@shared/schema";
import type { EngagementFlags } from "@shared/engagementFlags";
import { passives as passiveScores, checkModifier } from "@shared/rules/checks";
import { ABILITY_ABBR } from "@shared/rules/abilities";
import { type Beat, beatPromptLine, clampToBeat } from "./beats";
import { alignmentPromptLine } from "@shared/rules/alignment";
import { backgroundPromptLine } from "@shared/rules/backgrounds";

export interface PromptExtras {
  /** Replaces the legacy fixed CHOICE REQUIREMENTS block, or null to keep it. */
  choiceRules: string | null;
  /** Context lines for the prompt (may be ""). */
  context: string;
  /** Extra optional JSON fields, appended to the response schema (may be ""). */
  schema: string;
}

export function buildPromptExtras(flags: EngagementFlags, beat: Beat, character?: Character | null, opts: { sceneText?: string | null } = {}): PromptExtras {
  const ctx: string[] = [];
  const schema: string[] = [];

  if (flags.alignmentCompass && character) {
    const pers = (character.personality ?? {}) as Record<string, string>;
    const line = alignmentPromptLine(character.alignment, pers.ideal ?? null);
    if (line) ctx.push(line);
  }
  if (flags.backgroundFeatures && character) {
    const line = backgroundPromptLine(character.background, opts.sceneText);
    if (line) ctx.push(line);
  }

  let choiceRules: string | null = null;
  if (flags.beats) {
    choiceRules = `CHOICE REQUIREMENTS:
${beatPromptLine(beat)}
- Make choices specific to this moment, never generic. Prefer things the character might say or do with what is in the scene.
- Use real 5e terms when a roll is called for: "Charisma (Persuasion)", DC 10 easy / 15 medium / 20 hard.`;
  }

  if (flags.passives && character) {
    const p = passiveScores(character);
    ctx.push(`PASSIVES: Perception ${p.perception}, Investigation ${p.investigation}, Insight ${p.insight}. Anything in this scene with a DC at or below the matching passive score is simply noticed WITHOUT a roll; narrate it as the character's expertise and report it in "passiveNoticed".`);
    schema.push(`"passiveNoticed": {"skill": "perception|investigation|insight", "dc": number, "text": "what the character noticed, one sentence"}  // ONLY when a passive score met a DC this scene`);
  }

  if (flags.inspiration && character) {
    const pers = (character.personality ?? {}) as Record<string, string>;
    const traits = [pers.ideal && `ideal: "${pers.ideal}"`, pers.bond && `bond: "${pers.bond}"`, pers.flaw && `flaw: "${pers.flaw}"`].filter(Boolean).join("; ");
    if (!traits) {
      ctx.push(`PERSONALITY: this character has no ideal, bond or flaw recorded yet. Infer fitting ones from their background and play so far, and return them in "personalitySeed".`);
      schema.push(`"personalitySeed": {"ideal": "one short sentence", "bond": "one short sentence", "flaw": "one short sentence"}  // only because none are recorded yet`);
    }
    if (character.inspiration) {
      ctx.push(`INSPIRATION: the character already has Inspiration (they can spend it for advantage on a roll).`);
    } else if (traits) {
      ctx.push(`INSPIRATION: the character's ${traits}. If the player's action plays to their ideal, bond or flaw in a way that costs or risks them something, award Inspiration via "inspirationAwarded".`);
      schema.push(`"inspirationAwarded": {"reason": "which ideal/bond/flaw they played to, one short sentence"}  // rare; only when truly earned`);
    }
    schema.push(`On a choice that requires a roll, you may add "advantage": "reason" or "disadvantage": "reason" when the fiction clearly grants it (a prepared distraction, high ground, being blinded). Never both.`);
  }

  if (flags.beats || flags.serverChecks) {
    schema.push(`"failureCost": {"kind": "damage|item|time|attitude|complication", "detail": "the cost, one short sentence"}  // ONLY when the player's roll this turn FAILED: fail forward, never "nothing happens"`);
  }

  return {
    choiceRules,
    context: ctx.length ? `\n${ctx.join("\n")}\n` : "",
    schema: schema.length ? `\nOPTIONAL FIELDS (add only when they apply):\n${schema.map((s) => `- ${s}`).join("\n")}\n` : "",
  };
}

export interface TurnMechanicsResult {
  choices: any[];
  passiveNoticed: { skill: string; score: number; dc: number; text: string; breakdown: string } | null;
  inspirationAwarded: string | null;
  failureCost: { kind: string; detail: string } | null;
  /** Ideal/bond/flaw proposed for a character that had none (inspiration flag). */
  personalitySeed: { ideal: string; bond: string; flaw: string } | null;
  fired: { id: string; detail?: string }[];
}

const PASSIVE_SKILLS = ["perception", "investigation", "insight"] as const;

export function applyTurnMechanics(
  ai: any,
  opts: { flags: EngagementFlags; beat: Beat; character?: Character | null; rollResult?: any },
): TurnMechanicsResult {
  const fired: { id: string; detail?: string }[] = [];
  const rawChoices = Array.isArray(ai?.choices) ? ai.choices : [];
  const choices = opts.flags.beats ? clampToBeat(rawChoices, opts.beat) : rawChoices;

  let passiveNoticed: TurnMechanicsResult["passiveNoticed"] = null;
  const pn = ai?.passiveNoticed;
  if (opts.flags.passives && opts.character && pn && typeof pn === "object") {
    const skill = String(pn.skill ?? "").toLowerCase() as (typeof PASSIVE_SKILLS)[number];
    const dc = Number(pn.dc);
    if (PASSIVE_SKILLS.includes(skill) && typeof pn.text === "string" && pn.text.trim()) {
      const m = checkModifier(opts.character, skill);
      const score = 10 + m.total;
      // A notice the character's score doesn't actually reach is the model inventing numbers: drop it.
      if (!Number.isFinite(dc) || dc <= score) {
        const breakdown = `10 + ${ABILITY_ABBR[m.ability]} ${m.abilityMod >= 0 ? "+" : ""}${m.abilityMod}${m.proficiency ? ` + proficiency +${m.proficiency}` : ""} = ${score}${Number.isFinite(dc) ? ` vs DC ${dc}` : ""}`;
        passiveNoticed = { skill, score, dc: Number.isFinite(dc) ? dc : score, text: pn.text.trim().slice(0, 300), breakdown };
        fired.push({ id: "passive_check", detail: breakdown });
      }
    }
  }

  let inspirationAwarded: string | null = null;
  if (opts.flags.inspiration && opts.character && !opts.character.inspiration && ai?.inspirationAwarded?.reason) {
    inspirationAwarded = String(ai.inspirationAwarded.reason).slice(0, 200);
    fired.push({ id: "inspiration" });
  }

  let failureCost: TurnMechanicsResult["failureCost"] = null;
  const rolledAndFailed =
    opts.rollResult && typeof opts.rollResult.total === "number" && typeof opts.rollResult.dc === "number" && opts.rollResult.total < opts.rollResult.dc;
  if (rolledAndFailed && ai?.failureCost?.detail) {
    failureCost = { kind: String(ai.failureCost.kind ?? "complication"), detail: String(ai.failureCost.detail).slice(0, 200) };
    fired.push({ id: "failure_cost" });
  }

  let personalitySeed: TurnMechanicsResult["personalitySeed"] = null;
  const ps = ai?.personalitySeed;
  const hasPersonality = !!opts.character?.personality && Object.values(opts.character.personality as object).some(Boolean);
  if (opts.flags.inspiration && opts.character && !hasPersonality && ps && typeof ps === "object") {
    const clip = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 160) : "");
    const seed = { ideal: clip(ps.ideal), bond: clip(ps.bond), flaw: clip(ps.flaw) };
    if (seed.ideal || seed.bond || seed.flaw) personalitySeed = seed;
  }

  return { choices, passiveNoticed, inspirationAwarded, failureCost, personalitySeed, fired };
}
