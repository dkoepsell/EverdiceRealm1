/**
 * What a rest restores beyond hit points: class feature uses, Hit Dice and
 * spell slots (engagement spec 1.4). Wired into the existing short/long rest
 * routes. A long rest used to leave spell slots spent until the player found
 * the separate reset button in the spellbook.
 */
import type { Character } from "@shared/schema";
import { ABILITY_NAMES, type AbilityName } from "@shared/rules/abilities";
import { parseFeatureState } from "@shared/rules/leveling";
import { type RestKind, hitDiceAfterLongRest, rechargeFeatures } from "@shared/rules/rests";
import { storage } from "../../storage";

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
