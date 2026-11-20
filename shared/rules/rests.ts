/**
 * 5e rest rules (SRD 5.1): what comes back on a short or long rest.
 * Engagement spec Phase 1.4 (feature recharge) and Phase 4.4 (Hit Dice).
 */
import type { AbilityName } from "./abilities";
import { allFeaturesThrough, getClassDef } from "./classProgression";
import { type CharacterFeatureState, buildFeatureState, resolveUsesMax } from "./leveling";
import { getAbilityModifier } from "./xp";

export type RestKind = "short" | "long";

/**
 * Refill limited features. A short rest refills features that recharge on a
 * short rest; a long rest refills everything. Unknown/legacy ids are kept.
 */
export function rechargeFeatures(
  className: string,
  level: number,
  subclass: string | null | undefined,
  scores: Record<AbilityName, number>,
  state: CharacterFeatureState[],
  rest: RestKind,
): CharacterFeatureState[] {
  const def = getClassDef(className);
  if (!def) return state;
  if (!state.length) return buildFeatureState(def, level, subclass, scores);
  const feats = new Map(allFeaturesThrough(def, level, !!subclass && subclass === def.subclass.id).map((f) => [f.id, f]));
  return state.map((s) => {
    const f = feats.get(s.id);
    if (!f?.uses) return s;
    if (rest === "short" && f.uses.recharge !== "short") return s;
    return { ...s, usesRemaining: resolveUsesMax(f.uses.max, { classLevel: level, abilityScores: scores }) };
  });
}

/** Hit Dice regained on a long rest: half your total (minimum one), never above your level. */
export function hitDiceAfterLongRest(level: number, remaining: number | null | undefined): number {
  const have = typeof remaining === "number" ? remaining : level;
  return Math.min(level, have + Math.max(1, Math.floor(level / 2)));
}

export interface HitDieSpend {
  rolls: number[];
  conMod: number;
  /** HP healed: each die heals its roll + Con modifier (min 0 per die). */
  healed: number;
  spent: number;
}

/**
 * Spend Hit Dice on a short rest (5e: roll each die + Con modifier). Spends no
 * more dice than remain. `rollDie` is injectable for tests.
 */
export function spendHitDice(
  hitDie: number,
  constitution: number,
  remaining: number,
  count: number,
  rollDie: (sides: number) => number = (s) => 1 + Math.floor(Math.random() * s),
): HitDieSpend {
  const spent = Math.max(0, Math.min(remaining, Math.floor(count)));
  const conMod = getAbilityModifier(constitution);
  const rolls: number[] = [];
  let healed = 0;
  for (let i = 0; i < spent; i++) {
    const r = rollDie(hitDie);
    rolls.push(r);
    healed += Math.max(0, r + conMod);
  }
  return { rolls, conMod, healed, spent };
}
