/**
 * Signature combat spells for exploration fights, by class (SRD 5.1). The
 * campaign play screen has the full spell panel; out in the wilds each caster
 * gets their class's iconic attack cantrip and one or two levelled spells, so
 * a wizard isn't reduced to swinging a quarterstaff.
 *
 * If the character has a known-spells list, only spells on it are offered
 * (cantrips are always offered, since every caster of these classes has one).
 */
import { getAbilityModifier, getProficiencyBonus } from "@shared/rules/xp";

export type SpellShape = "attack" | "save" | "auto" | "heal";

export interface SkirmishSpell {
  id: string;
  name: string;
  level: number;
  shape: SpellShape;
  /** Damage or healing dice at base level (cantrips scale at 5th level). */
  dice: string;
  damageType?: string;
  save?: "dexterity" | "wisdom" | "constitution";
  /** Half damage on a successful save. */
  halfOnSave?: boolean;
  /** Magic Missile: number of darts. */
  darts?: number;
  bonusAction?: boolean;
  /** Add the casting modifier to healing. */
  addMod?: boolean;
  /** Vicious Mockery: the target has disadvantage on its next attack. */
  mockery?: boolean;
  text: string;
}

const S = (s: SkirmishSpell) => s;

export const SPELLS: Record<string, SkirmishSpell> = {
  fire_bolt: S({ id: "fire_bolt", name: "Fire Bolt", level: 0, shape: "attack", dice: "1d10", damageType: "fire", text: "Ranged spell attack, 1d10 fire." }),
  eldritch_blast: S({ id: "eldritch_blast", name: "Eldritch Blast", level: 0, shape: "attack", dice: "1d10", damageType: "force", text: "Ranged spell attack, 1d10 force." }),
  produce_flame: S({ id: "produce_flame", name: "Produce Flame", level: 0, shape: "attack", dice: "1d8", damageType: "fire", text: "Ranged spell attack, 1d8 fire." }),
  sacred_flame: S({ id: "sacred_flame", name: "Sacred Flame", level: 0, shape: "save", save: "dexterity", dice: "1d8", damageType: "radiant", text: "Dexterity save or 1d8 radiant. Cover doesn't help." }),
  vicious_mockery: S({ id: "vicious_mockery", name: "Vicious Mockery", level: 0, shape: "save", save: "wisdom", dice: "1d4", damageType: "psychic", mockery: true, text: "Wisdom save or 1d4 psychic and disadvantage on its next attack." }),
  magic_missile: S({ id: "magic_missile", name: "Magic Missile", level: 1, shape: "auto", dice: "1d4+1", damageType: "force", darts: 3, text: "Three darts of 1d4+1 force that never miss (+1 dart per slot level above 1st)." }),
  guiding_bolt: S({ id: "guiding_bolt", name: "Guiding Bolt", level: 1, shape: "attack", dice: "4d6", damageType: "radiant", text: "Ranged spell attack, 4d6 radiant (+1d6 per slot level above 1st)." }),
  thunderwave: S({ id: "thunderwave", name: "Thunderwave", level: 1, shape: "save", save: "constitution", dice: "2d8", damageType: "thunder", halfOnSave: true, text: "Constitution save, 2d8 thunder, half on a success (+1d8 per slot level above 1st)." }),
  dissonant_whispers: S({ id: "dissonant_whispers", name: "Dissonant Whispers", level: 1, shape: "save", save: "wisdom", dice: "3d6", damageType: "psychic", halfOnSave: true, text: "Wisdom save, 3d6 psychic, half on a success (+1d6 per slot level above 1st)." }),
  cure_wounds: S({ id: "cure_wounds", name: "Cure Wounds", level: 1, shape: "heal", dice: "1d8", addMod: true, text: "Touch, regain 1d8 + your spellcasting modifier HP (+1d8 per slot level above 1st)." }),
  healing_word: S({ id: "healing_word", name: "Healing Word", level: 1, shape: "heal", dice: "1d4", addMod: true, bonusAction: true, text: "Bonus action, regain 1d4 + your spellcasting modifier HP (+1d4 per slot level above 1st)." }),
};

const CLASS_SPELLS: Record<string, { ability: "intelligence" | "wisdom" | "charisma"; spells: string[]; minLevel?: number }> = {
  wizard: { ability: "intelligence", spells: ["fire_bolt", "magic_missile", "thunderwave"] },
  sorcerer: { ability: "charisma", spells: ["fire_bolt", "magic_missile", "thunderwave"] },
  warlock: { ability: "charisma", spells: ["eldritch_blast"] },
  cleric: { ability: "wisdom", spells: ["sacred_flame", "guiding_bolt", "cure_wounds", "healing_word"] },
  druid: { ability: "wisdom", spells: ["produce_flame", "thunderwave", "cure_wounds", "healing_word"] },
  bard: { ability: "charisma", spells: ["vicious_mockery", "dissonant_whispers", "cure_wounds", "healing_word"] },
  paladin: { ability: "charisma", spells: ["cure_wounds"], minLevel: 2 },
  ranger: { ability: "wisdom", spells: ["cure_wounds"], minLevel: 2 },
};

export function castingAbility(className: string): "intelligence" | "wisdom" | "charisma" | null {
  return CLASS_SPELLS[className.trim().toLowerCase()]?.ability ?? null;
}

/** Spells this character can use in an exploration fight. */
export function spellsFor(className: string, level: number, known?: string[] | null): SkirmishSpell[] {
  const entry = CLASS_SPELLS[className.trim().toLowerCase()];
  if (!entry || level < (entry.minLevel ?? 1)) return [];
  const knownSet = known && known.length ? new Set(known.map((k) => k.toLowerCase().replace(/[^a-z]/g, ""))) : null;
  return entry.spells
    .map((id) => SPELLS[id])
    .filter((s) => s.level === 0 || !knownSet || knownSet.has(s.name.toLowerCase().replace(/[^a-z]/g, "")));
}

export function spellAttackBonus(char: { level: number; [k: string]: any }, className: string): number {
  const ab = castingAbility(className);
  return ab ? getProficiencyBonus(char.level || 1) + getAbilityModifier(Number(char[ab]) || 10) : 0;
}

export function spellSaveDC(char: { level: number; [k: string]: any }, className: string): number {
  return 8 + spellAttackBonus(char, className);
}

export function castingMod(char: { [k: string]: any }, className: string): number {
  const ab = castingAbility(className);
  return ab ? getAbilityModifier(Number(char[ab]) || 10) : 0;
}

/** Cantrip damage dice scale at character levels 5, 11 and 17. */
export function cantripDiceCount(level: number): number {
  return level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1;
}
