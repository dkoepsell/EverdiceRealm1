/**
 * Ready-made characters for one-shot nights (table-night spec): five level 3
 * heroes a friend can pick from an invite link and be playing in a minute,
 * the way convention and organized-play tables get new people in.
 *
 * SRD 5.1 races, classes and subclasses; standard array (15, 14, 13, 12, 10, 8)
 * plus racial increases; hit points as average per level after the first;
 * 900 XP (level 3). Features come from the class data via buildFeatureState
 * on the server, so they match what a levelled-up character would have.
 */
import type { AbilityName } from "./abilities";

export interface Pregen {
  key: string;
  name: string;
  race: string;
  className: string;
  subclass: string;
  background: string;
  alignment: string;
  /** One line for the picker card. */
  pitch: string;
  /** How they play, for a first-timer. */
  playsLike: string;
  abilities: Record<AbilityName, number>;
  hitPoints: number;
  armorClass: number;
  skills: string[];
  /** Expertise picks (Rogue). */
  expertise?: string[];
  weapon: string;
  armor: string;
  extraEquipment: string[];
  personality: { traits: string; ideal: string; bond: string; flaw: string };
  appearance: string;
}

export const PREGENS: Pregen[] = [
  {
    key: "fighter",
    name: "Brenna Holt",
    race: "Human",
    className: "Fighter",
    subclass: "champion",
    background: "Soldier",
    alignment: "Lawful Good",
    pitch: "A veteran shield-wall soldier who stands in front so others don't have to.",
    playsLike: "Simple and tough: walk up, hit hard, protect your friends. Great for a first game.",
    abilities: { strength: 16, dexterity: 14, constitution: 15, intelligence: 9, wisdom: 13, charisma: 11 },
    // d10: 10 + 6 + 6, plus Con +2 per level
    hitPoints: 28,
    // Chain mail 16 + shield 2
    armorClass: 18,
    skills: ["athletics", "intimidation", "perception", "insight"],
    weapon: "Longsword",
    armor: "Chain Mail",
    extraEquipment: ["Shield", "Javelins (4)", "Backpack", "Rations (5 days)", "Waterskin"],
    personality: {
      traits: "Says little, notices everything, and always takes the first watch.",
      ideal: "Responsibility. You do what's asked of you and you don't leave anyone behind. (Lawful)",
      bond: "Three of her old company never came home; she carries their names on a strip of leather.",
      flaw: "Trusts orders more than her own good sense.",
    },
    appearance: "Broad-shouldered, cropped grey-brown hair, a dented but polished helm.",
  },
  {
    key: "rogue",
    name: "Pip Underbough",
    race: "Halfling",
    className: "Rogue",
    subclass: "thief",
    background: "Criminal",
    alignment: "Chaotic Good",
    pitch: "A cheerful little burglar who only robs people who deserve it. Mostly.",
    playsLike: "Sneaky and clever: hide, pick locks, and strike for big damage when an ally is next to your target.",
    abilities: { strength: 8, dexterity: 17, constitution: 14, intelligence: 12, wisdom: 13, charisma: 11 },
    // d8: 8 + 5 + 5, plus Con +2 per level
    hitPoints: 24,
    armorClass: 14,
    skills: ["stealth", "deception", "acrobatics", "perception", "sleight_of_hand", "investigation"],
    expertise: ["stealth", "sleight_of_hand"],
    weapon: "Shortsword",
    armor: "Leather Armor",
    extraEquipment: ["Shortbow", "Thieves' Tools", "Crowbar", "Backpack", "Rations (5 days)"],
    personality: {
      traits: "Always has a snack, a joke and an exit.",
      ideal: "Freedom. Locks are a suggestion and so are most laws. (Chaotic)",
      bond: "Sends half of every haul to the orphanage that raised them.",
      flaw: "Can't resist a locked box, however obviously trapped.",
    },
    appearance: "Curly auburn hair, quick hands, a patched green cloak with many pockets.",
  },
  {
    key: "cleric",
    name: "Dorrin Ashvale",
    race: "Dwarf",
    className: "Cleric",
    subclass: "life_domain",
    background: "Acolyte",
    alignment: "Neutral Good",
    pitch: "A warm, stubborn dwarf priest who keeps everyone standing.",
    playsLike: "The healer and backbone of the party: heal, bless, and still swing a mean mace.",
    abilities: { strength: 13, dexterity: 10, constitution: 16, intelligence: 8, wisdom: 16, charisma: 12 },
    // d8: 8 + 5 + 5, plus Con +3 per level, plus Dwarven Toughness +1 per level
    hitPoints: 30,
    // Scale mail 14 + Dex 0 + shield 2
    armorClass: 16,
    skills: ["insight", "religion", "medicine", "persuasion"],
    weapon: "Mace",
    armor: "Scale Mail",
    extraEquipment: ["Shield", "Holy Symbol", "Healer's Kit", "Backpack", "Rations (5 days)"],
    personality: {
      traits: "Hums old hymns when nervous and hugs people who don't expect it.",
      ideal: "Charity. Help whoever needs it, whatever it costs you. (Good)",
      bond: "The mountain temple that took her in when her clan cast her out.",
      flaw: "Would rather argue than admit she's lost.",
    },
    appearance: "Braided copper beard-braids, soot-dark eyes, a holy symbol worn smooth by her thumb.",
  },
  {
    key: "wizard",
    name: "Ilyra Venn",
    race: "Elf",
    className: "Wizard",
    subclass: "school_of_evocation",
    background: "Sage",
    alignment: "Neutral",
    pitch: "A young elf scholar who studies fire because nothing else answers back so honestly.",
    playsLike: "Fragile but powerful: stay back, cast spells, and know the answer to almost everything.",
    abilities: { strength: 8, dexterity: 16, constitution: 13, intelligence: 16, wisdom: 12, charisma: 10 },
    // d6: 6 + 4 + 4, plus Con +1 per level
    hitPoints: 17,
    armorClass: 13,
    skills: ["arcana", "history", "investigation", "insight"],
    weapon: "Quarterstaff",
    armor: "Robes",
    extraEquipment: ["Spellbook", "Arcane Focus", "Ink and Quill", "Backpack", "Rations (5 days)"],
    personality: {
      traits: "Takes notes during fights. Corrects people's pronunciation of spells.",
      ideal: "Knowledge. Every question deserves an answer, even a dangerous one. (Neutral)",
      bond: "Her missing mentor's spellbook, half its pages torn out.",
      flaw: "Will read anything, including the scroll marked DO NOT READ.",
    },
    appearance: "Silver-blonde hair tied back with a quill, ink-stained fingers, a scorch mark on one sleeve.",
  },
  {
    key: "ranger",
    name: "Kael Thornwood",
    race: "Half-Elf",
    className: "Ranger",
    subclass: "hunter",
    background: "Outlander",
    alignment: "Chaotic Good",
    pitch: "A quiet tracker from the deep woods who'd rather sleep under the stars than under a roof.",
    playsLike: "A skilled archer and scout: find the trail, spot the ambush, and shoot from a distance.",
    abilities: { strength: 12, dexterity: 16, constitution: 14, intelligence: 8, wisdom: 14, charisma: 12 },
    // d10: 10 + 6 + 6, plus Con +2 per level
    hitPoints: 28,
    armorClass: 14,
    skills: ["athletics", "survival", "perception", "stealth", "nature", "insight", "animal_handling"],
    weapon: "Longbow",
    armor: "Leather Armor",
    extraEquipment: ["Shortsword", "Arrows (20)", "Hunting Trap", "Bedroll", "Rations (5 days)"],
    personality: {
      traits: "Talks to animals more easily than to people, and they seem to listen.",
      ideal: "Nature. The wild keeps its balance; people should too. (Neutral)",
      bond: "The forest that burned. Someone set that fire, and Kael will find them.",
      flaw: "Assumes city folk are fools until proven otherwise.",
    },
    appearance: "Weathered green-grey cloak, a braid with feathers in it, eyes that never stop scanning the treeline.",
  },
];

export function pregenByKey(key: unknown): Pregen | null {
  return PREGENS.find((p) => p.key === key) ?? null;
}

/** What the picker shows (no full sheet). */
export function pregenCards() {
  return PREGENS.map((p) => ({
    key: p.key, name: p.name, race: p.race, className: p.className, background: p.background, alignment: p.alignment,
    pitch: p.pitch, playsLike: p.playsLike, hitPoints: p.hitPoints, armorClass: p.armorClass,
  }));
}

/** Guest usernames are reserved (no one can register one by hand). */
export const GUEST_PREFIX = "guest-";
export const isGuestUsername = (u: unknown) => typeof u === "string" && u.toLowerCase().startsWith(GUEST_PREFIX);
