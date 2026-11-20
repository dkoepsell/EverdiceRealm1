/**
 * What a rest restores beyond hit points: class feature uses, Hit Dice and
 * spell slots (engagement spec 1.4). Wired into the existing short/long rest
 * routes. A long rest used to leave spell slots spent until the player found
 * the separate reset button in the spellbook.
 */
import type { Character } from "@shared/schema";
import { ABILITY_NAMES, type AbilityName } from "@shared/rules/abilities";
import { parseFeatureState } from "@shared/rules/leveling";
import { type RestKind, hitDiceAfterLongRest, rechargeFeatures, spendHitDice } from "@shared/rules/rests";
import { hitDieFor } from "@shared/rules/leveling";
import { resolveFlags } from "@shared/engagementFlags";
import { storage } from "../../storage";
import { fireFullClock, parseClocks, tickClocks } from "../clocks";

export function restUpdates(character: Character, rest: RestKind): Partial<Character> {
  const scores = {} as Record<AbilityName, number>;
  for (const a of ABILITY_NAMES) scores[a] = Number((character as any)[a]) || 10;
  const level = character.level || 1;
  const features = rechargeFeatures(character.class, level, character.subclass, scores, parseFeatureState(character.features), rest);
  const out: Partial<Character> = { features };
  if (rest === "long") out.hitDiceRemaining = hitDiceAfterLongRest(level, character.hitDiceRemaining);
  return out;
}

/** Long rest: all expended spell slots come back. Warlock pact slots also return on a short rest. */
export async function restoreSpellSlots(character: Character, rest: RestKind): Promise<boolean> {
  const isWarlock = (character.class || "").toLowerCase() === "warlock";
  if (rest === "short" && !isWarlock) return false;
  const slots = await storage.getCharacterSpellSlots(character.id);
  if (!slots) return false;
  await storage.resetSpellSlots(character.id);
  return true;
}

/**
 * Short rest with Hit Dice (5e): spend up to `count` dice, each healing its roll
 * + Con modifier. Replaces the flat 25% heal when the client asks for it.
 */
export function hitDiceShortRest(character: Character, count: number) {
  const level = character.level || 1;
  const remaining = typeof character.hitDiceRemaining === "number" ? character.hitDiceRemaining : level;
  const die = hitDieFor(character.class);
  // No point spending a die at full health.
  const r = spendHitDice(die, character.constitution, remaining, character.hitPoints >= character.maxHitPoints ? 0 : count);
  const newHp = Math.min(character.maxHitPoints, character.hitPoints + r.healed);
  return { ...r, die, newHp, healedActual: newHp - character.hitPoints, hitDiceRemaining: remaining - r.spent };
}

/** Resting where it isn't safe gives the enemy time (engagement spec 4.4). */
export async function tickClocksForRest(campaignId: number, rest: "short" | "long", safe: boolean): Promise<string[]> {
  const campaign = await storage.getCampaign(campaignId);
  if (!campaign || !resolveFlags(campaign).clocks) return [];
  const session = await storage.getCurrentSession(campaignId);
  if (!session) return [];
  const state: any = typeof session.storyState === "string" ? JSON.parse(session.storyState) : session.storyState ?? {};
  if (rest === "short" && safe) return [];
  const { clocks, ticks } = tickClocks(parseClocks(state.clocks), { rest: safe ? "safe" : "unsafe" });
  const fired = fireFullClock(clocks);
  await storage.updateSessionStoryState(campaignId, session.sessionNumber, {
    ...state,
    clocks: fired.clocks,
    clockTrigger: fired.trigger ? { beat: fired.trigger.beat, directive: fired.trigger.directive, clockName: fired.trigger.clock.name } : state.clockTrigger ?? null,
  });
  return ticks.map((t) => `${clocks.find((c) => c.id === t.id)?.name ?? t.id} +${t.by} (${t.why})`);
}
