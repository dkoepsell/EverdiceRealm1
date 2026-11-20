/**
 * SRD 5.1 magic items that change what a character can DO (engagement spec
 * 5.3), not just their numbers. At least one is found per chapter; each comes
 * with an option the DM can offer. Attunement is limited to 3 items (5e).
 */
export interface MagicItem {
  name: string;
  rarity: "common" | "uncommon" | "rare";
  attunement: boolean;
  /** What it does, in plain 5e terms. */
  effect: string;
  /** The kind of new choice it opens, for the DM prompt. */
  opens: string;
  /** Checks it grants advantage on (wired into the server's ability checks). */
  advantageOn?: string[];
}

export const MAGIC_ITEMS: MagicItem[] = [
  { name: "Cloak of Elvenkind", rarity: "uncommon", attunement: true, effect: "Advantage on Dexterity (Stealth) checks; creatures have disadvantage on Wisdom (Perception) checks to see you.", opens: "slipping past watchers unseen", advantageOn: ["stealth"] },
  { name: "Boots of Elvenkind", rarity: "uncommon", attunement: false, effect: "Your steps make no sound: advantage on Dexterity (Stealth) checks that rely on moving silently.", opens: "moving silently where others would be heard", advantageOn: ["stealth"] },
  { name: "Immovable Rod", rarity: "uncommon", attunement: false, effect: "Press the button and the rod is fixed in place, holding up to 8,000 pounds.", opens: "bracing a door, building a handhold, stopping something heavy" },
  { name: "Bag of Holding", rarity: "uncommon", attunement: false, effect: "Holds up to 500 pounds in an extradimensional space; it always weighs 15 pounds.", opens: "carrying off what couldn't be carried, hiding something in plain sight" },
  { name: "Wand of Magic Missiles", rarity: "uncommon", attunement: false, effect: "7 charges: spend 1 or more to cast magic missile (1st level + 1 per extra charge). Regains 1d6 + 1 charges at dawn.", opens: "a sure hit when an attack can't miss" },
  { name: "Potion of Climbing", rarity: "common", attunement: false, effect: "For 1 hour you gain a climbing speed equal to your walking speed and advantage on Strength (Athletics) checks to climb.", opens: "scaling a wall or cliff others can't", advantageOn: ["athletics"] },
  { name: "Goggles of Night", rarity: "uncommon", attunement: false, effect: "Darkvision out to 60 feet.", opens: "acting in darkness" },
  { name: "Rope of Climbing", rarity: "uncommon", attunement: false, effect: "60 feet of rope that moves, knots and fastens itself on command.", opens: "climbing, tying up a prisoner, a rope that ties itself" },
  { name: "Driftglobe", rarity: "uncommon", attunement: false, effect: "A floating light (or daylight once a day) that follows you.", opens: "lighting a way, a light that can't be knocked away" },
  { name: "Eyes of the Eagle", rarity: "uncommon", attunement: true, effect: "Advantage on Wisdom (Perception) checks that rely on sight.", opens: "spotting something far away", advantageOn: ["perception"] },
  { name: "+1 Weapon", rarity: "uncommon", attunement: false, effect: "+1 to attack and damage rolls with this magic weapon.", opens: "hurting creatures that shrug off ordinary weapons" },
  { name: "Gloves of Thievery", rarity: "uncommon", attunement: false, effect: "Invisible while worn: +5 to Dexterity (Sleight of Hand) checks and checks to pick locks.", opens: "lifting a key or picking a lock under someone's nose" },
];

export const ATTUNEMENT_LIMIT = 3;

/** Pick an item the character doesn't have, respecting the attunement limit. */
export function pickChapterItem(owned: string[], rng: () => number = Math.random): MagicItem | null {
  const have = new Set(owned.map((o) => o.toLowerCase()));
  const attuned = MAGIC_ITEMS.filter((i) => i.attunement && have.has(i.name.toLowerCase())).length;
  const pool = MAGIC_ITEMS.filter((i) => !have.has(i.name.toLowerCase()) && (!i.attunement || attuned < ATTUNEMENT_LIMIT));
  return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
}

/** Items the character carries that open options, for the DM prompt. */
export function itemsPromptLine(owned: string[]): string {
  const have = new Set(owned.map((o) => o.toLowerCase()));
  const items = MAGIC_ITEMS.filter((i) => have.has(i.name.toLowerCase()));
  if (!items.length) return "";
  return `MAGIC ITEMS THE CHARACTER CAN USE (offer a choice that uses one when the fiction fits): ${items.map((i) => `${i.name} (${i.opens})`).join("; ")}.`;
}

/** Skill checks the character's items grant advantage on. */
export function itemAdvantages(owned: string[], skill: string): string[] {
  const have = new Set(owned.map((o) => o.toLowerCase()));
  return MAGIC_ITEMS.filter((i) => have.has(i.name.toLowerCase()) && i.advantageOn?.includes(skill)).map((i) => `${i.name}`);
}
