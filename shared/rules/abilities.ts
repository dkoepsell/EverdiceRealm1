/** The six 5e abilities, keyed as the `characters` table stores them. */
export const ABILITY_NAMES = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
] as const;

export type AbilityName = (typeof ABILITY_NAMES)[number];

export const ABILITY_ABBR: Record<AbilityName, string> = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
};

export function isAbilityName(v: unknown): v is AbilityName {
  return typeof v === "string" && (ABILITY_NAMES as readonly string[]).includes(v);
}
