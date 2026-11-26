/**
 * SRD 5.1 monster stat blocks for exploration fights (Wander and Delve), and
 * the DMG encounter-building math (XP thresholds and multipliers).
 *
 * Stat blocks are trimmed to what a theater-of-the-mind skirmish uses: AC,
 * HP, initiative, speed, attacks (with multiattack), and the traits that
 * change how the fight goes (Pack Tactics, Undead Fortitude, knock-prone
 * bites, poison riders, damage vulnerability).
 */

export interface MonsterAttack {
  name: string;
  bonus: number;
  damage: string;
  damageType: string;
  /** Strength save or be knocked prone (wolves). */
  knockdownDC?: number;
  /** Extra damage on a hit, Con save for half (giant spider, scorpion). */
  poison?: { dc: number; damage: string; ability?: "constitution" };
  /** Extra damage on a hit with no save (a hell hound's fiery bite, a wyrmling's poison). */
  extra?: { damage: string; damageType: string };
}

/**
 * A recharge action (breath weapons). Used instead of the creature's attacks;
 * hits every enemy in front of it (theater of the mind: the whole party),
 * each makes a saving throw. Recharges on a d6 roll of `recharge` or higher
 * at the start of the creature's turn (SRD "Recharge X–6").
 */
export interface MonsterSpecial {
  name: string;
  recharge: 5 | 6;
  save: { ability: "dexterity" | "constitution" | "strength" | "wisdom"; dc: number };
  damage: string;
  damageType: string;
  halfOnSave: boolean;
  /** What the party sees the round before (the game telegraphs it so players can react). */
  tell: string;
}

export type MonsterTrait =
  | "pack_tactics"       // advantage if an ally is next to the target
  | "undead_fortitude"   // Con save DC 5 + damage to drop to 1 HP instead of 0
  | "nimble_escape"      // disengages and flees when badly hurt
  | "vulnerable_bludgeoning"
  | "martial_advantage"  // once per turn +2d6 when an ally is next to the target (hobgoblin)
  | "fearless";          // never checks morale (undead, constructs, bosses)

export interface MonsterStats {
  key: string;
  name: string;
  cr: number;
  xp: number;
  ac: number;
  hp: number;
  dexMod: number;
  speed: number;
  /** Passive Perception, for escaping by stealth. */
  passive: number;
  attacks: MonsterAttack[];
  traits: MonsterTrait[];
  creatureType: string;
  special?: MonsterSpecial;
}

const M = (m: MonsterStats) => m;

export const MONSTERS: Record<string, MonsterStats> = {
  kobold: M({ key: "kobold", name: "Kobold", cr: 0.125, xp: 25, ac: 12, hp: 5, dexMod: 2, speed: 30, passive: 8, creatureType: "humanoid", traits: ["pack_tactics"], attacks: [{ name: "Dagger", bonus: 4, damage: "1d4+2", damageType: "piercing" }] }),
  bandit: M({ key: "bandit", name: "Bandit", cr: 0.125, xp: 25, ac: 12, hp: 11, dexMod: 1, speed: 30, passive: 10, creatureType: "humanoid", traits: [], attacks: [{ name: "Scimitar", bonus: 3, damage: "1d6+1", damageType: "slashing" }] }),
  goblin: M({ key: "goblin", name: "Goblin", cr: 0.25, xp: 50, ac: 15, hp: 7, dexMod: 2, speed: 30, passive: 9, creatureType: "humanoid", traits: ["nimble_escape"], attacks: [{ name: "Scimitar", bonus: 4, damage: "1d6+2", damageType: "slashing" }] }),
  wolf: M({ key: "wolf", name: "Wolf", cr: 0.25, xp: 50, ac: 13, hp: 11, dexMod: 2, speed: 40, passive: 13, creatureType: "beast", traits: ["pack_tactics"], attacks: [{ name: "Bite", bonus: 4, damage: "2d4+2", damageType: "piercing", knockdownDC: 11 }] }),
  skeleton: M({ key: "skeleton", name: "Skeleton", cr: 0.25, xp: 50, ac: 13, hp: 13, dexMod: 2, speed: 30, passive: 9, creatureType: "undead", traits: ["vulnerable_bludgeoning", "fearless"], attacks: [{ name: "Shortsword", bonus: 4, damage: "1d6+2", damageType: "piercing" }] }),
  zombie: M({ key: "zombie", name: "Zombie", cr: 0.25, xp: 50, ac: 8, hp: 22, dexMod: -2, speed: 20, passive: 8, creatureType: "undead", traits: ["undead_fortitude", "fearless"], attacks: [{ name: "Slam", bonus: 3, damage: "1d6+1", damageType: "bludgeoning" }] }),
  dust_mephit: M({ key: "dust_mephit", name: "Dust Mephit", cr: 0.5, xp: 100, ac: 12, hp: 17, dexMod: 2, speed: 30, passive: 12, creatureType: "elemental", traits: ["fearless"], attacks: [{ name: "Claws", bonus: 4, damage: "1d4+2", damageType: "slashing" }] }),
  darkmantle: M({ key: "darkmantle", name: "Darkmantle", cr: 0.5, xp: 100, ac: 11, hp: 22, dexMod: 1, speed: 10, passive: 10, creatureType: "monstrosity", traits: [], attacks: [{ name: "Crush", bonus: 5, damage: "1d6+3", damageType: "bludgeoning" }] }),
  gnoll: M({ key: "gnoll", name: "Gnoll", cr: 0.5, xp: 100, ac: 15, hp: 22, dexMod: 1, speed: 30, passive: 10, creatureType: "humanoid", traits: [], attacks: [{ name: "Spear", bonus: 4, damage: "1d6+2", damageType: "piercing" }] }),
  lizardfolk: M({ key: "lizardfolk", name: "Lizardfolk", cr: 0.5, xp: 100, ac: 15, hp: 22, dexMod: 0, speed: 30, passive: 13, creatureType: "humanoid", traits: [], attacks: [{ name: "Bite", bonus: 4, damage: "1d6+2", damageType: "piercing" }, { name: "Heavy Club", bonus: 4, damage: "1d6+2", damageType: "bludgeoning" }] }),
  sahuagin: M({ key: "sahuagin", name: "Sahuagin", cr: 0.5, xp: 100, ac: 12, hp: 22, dexMod: 0, speed: 30, passive: 15, creatureType: "humanoid", traits: [], attacks: [{ name: "Bite", bonus: 3, damage: "1d4+1", damageType: "piercing" }, { name: "Claws", bonus: 3, damage: "1d4+1", damageType: "slashing" }] }),
  thug: M({ key: "thug", name: "Thug", cr: 0.5, xp: 100, ac: 11, hp: 32, dexMod: 0, speed: 30, passive: 10, creatureType: "humanoid", traits: ["pack_tactics"], attacks: [{ name: "Mace", bonus: 4, damage: "1d6+2", damageType: "bludgeoning" }, { name: "Mace", bonus: 4, damage: "1d6+2", damageType: "bludgeoning" }] }),
  goblin_boss: M({ key: "goblin_boss", name: "Goblin Boss", cr: 1, xp: 200, ac: 17, hp: 21, dexMod: 2, speed: 30, passive: 9, creatureType: "humanoid", traits: ["nimble_escape"], attacks: [{ name: "Scimitar", bonus: 4, damage: "1d6+2", damageType: "slashing" }, { name: "Scimitar", bonus: 4, damage: "1d6+2", damageType: "slashing" }] }),
  dire_wolf: M({ key: "dire_wolf", name: "Dire Wolf", cr: 1, xp: 200, ac: 14, hp: 37, dexMod: 2, speed: 50, passive: 13, creatureType: "beast", traits: ["pack_tactics"], attacks: [{ name: "Bite", bonus: 5, damage: "2d6+3", damageType: "piercing", knockdownDC: 13 }] }),
  ghoul: M({ key: "ghoul", name: "Ghoul", cr: 1, xp: 200, ac: 12, hp: 22, dexMod: 2, speed: 30, passive: 10, creatureType: "undead", traits: ["fearless"], attacks: [{ name: "Claws", bonus: 4, damage: "2d4+2", damageType: "slashing" }] }),
  giant_spider: M({ key: "giant_spider", name: "Giant Spider", cr: 1, xp: 200, ac: 14, hp: 26, dexMod: 3, speed: 30, passive: 10, creatureType: "beast", traits: [], attacks: [{ name: "Bite", bonus: 5, damage: "1d8+3", damageType: "piercing", poison: { dc: 11, damage: "2d8" } }] }),
  bandit_captain: M({ key: "bandit_captain", name: "Bandit Captain", cr: 2, xp: 450, ac: 15, hp: 65, dexMod: 3, speed: 30, passive: 10, creatureType: "humanoid", traits: [], attacks: [{ name: "Scimitar", bonus: 5, damage: "1d6+3", damageType: "slashing" }, { name: "Scimitar", bonus: 5, damage: "1d6+3", damageType: "slashing" }, { name: "Dagger", bonus: 5, damage: "1d4+3", damageType: "piercing" }] }),
  ettercap: M({ key: "ettercap", name: "Ettercap", cr: 2, xp: 450, ac: 13, hp: 44, dexMod: 2, speed: 30, passive: 13, creatureType: "monstrosity", traits: [], attacks: [{ name: "Bite", bonus: 4, damage: "1d8+2", damageType: "piercing", poison: { dc: 11, damage: "1d8" } }, { name: "Claws", bonus: 4, damage: "2d4+2", damageType: "slashing" }] }),
  owlbear: M({ key: "owlbear", name: "Owlbear", cr: 3, xp: 700, ac: 13, hp: 59, dexMod: 1, speed: 40, passive: 13, creatureType: "monstrosity", traits: [], attacks: [{ name: "Beak", bonus: 7, damage: "1d10+5", damageType: "piercing" }, { name: "Claws", bonus: 7, damage: "2d8+5", damageType: "slashing" }] }),
  winter_wolf: M({ key: "winter_wolf", name: "Winter Wolf", cr: 3, xp: 700, ac: 13, hp: 75, dexMod: 1, speed: 50, passive: 15, creatureType: "monstrosity", traits: ["pack_tactics"], attacks: [{ name: "Bite", bonus: 6, damage: "2d6+4", damageType: "piercing", knockdownDC: 14 }], special: { name: "Cold Breath", recharge: 5, save: { ability: "dexterity", dc: 12 }, damage: "4d8", damageType: "cold", halfOnSave: true, tell: "frost gathers on its muzzle and it sucks in a long, freezing breath" } }),
  giant_scorpion: M({ key: "giant_scorpion", name: "Giant Scorpion", cr: 3, xp: 700, ac: 15, hp: 52, dexMod: 1, speed: 40, passive: 9, creatureType: "beast", traits: [], attacks: [{ name: "Claw", bonus: 4, damage: "1d8+2", damageType: "bludgeoning" }, { name: "Claw", bonus: 4, damage: "1d8+2", damageType: "bludgeoning" }, { name: "Sting", bonus: 4, damage: "1d10+2", damageType: "piercing", poison: { dc: 12, damage: "4d10" } }] }),
  green_hag: M({ key: "green_hag", name: "Green Hag", cr: 3, xp: 700, ac: 17, hp: 82, dexMod: 1, speed: 30, passive: 14, creatureType: "fey", traits: [], attacks: [{ name: "Claws", bonus: 6, damage: "2d8+4", damageType: "slashing" }] }),
  wyvern: M({ key: "wyvern", name: "Wyvern", cr: 6, xp: 2300, ac: 13, hp: 110, dexMod: 0, speed: 80, passive: 14, creatureType: "dragon", traits: [], attacks: [{ name: "Bite", bonus: 7, damage: "2d6+4", damageType: "piercing" }, { name: "Stinger", bonus: 7, damage: "2d6+4", damageType: "piercing", poison: { dc: 15, damage: "7d6" } }] }),
  stone_giant: M({ key: "stone_giant", name: "Stone Giant", cr: 7, xp: 2900, ac: 17, hp: 126, dexMod: 2, speed: 40, passive: 14, creatureType: "giant", traits: [], attacks: [{ name: "Greatclub", bonus: 9, damage: "3d8+6", damageType: "bludgeoning" }, { name: "Greatclub", bonus: 9, damage: "3d8+6", damageType: "bludgeoning" }] }),
  // ── Added for campaign fights (danger spec Phase 3). SRD 5.1 stat blocks. ──
  giant_rat: M({ key: "giant_rat", name: "Giant Rat", cr: 0.125, xp: 25, ac: 12, hp: 7, dexMod: 2, speed: 30, passive: 10, creatureType: "beast", traits: ["pack_tactics"], attacks: [{ name: "Bite", bonus: 4, damage: "1d4+2", damageType: "piercing" }] }),
  cultist: M({ key: "cultist", name: "Cultist", cr: 0.125, xp: 25, ac: 12, hp: 9, dexMod: 1, speed: 30, passive: 10, creatureType: "humanoid", traits: [], attacks: [{ name: "Scimitar", bonus: 3, damage: "1d6+1", damageType: "slashing" }] }),
  guard: M({ key: "guard", name: "Guard", cr: 0.125, xp: 25, ac: 16, hp: 11, dexMod: 1, speed: 30, passive: 12, creatureType: "humanoid", traits: [], attacks: [{ name: "Spear", bonus: 3, damage: "1d6+1", damageType: "piercing" }] }),
  mastiff: M({ key: "mastiff", name: "Mastiff", cr: 0.125, xp: 25, ac: 12, hp: 5, dexMod: 2, speed: 40, passive: 13, creatureType: "beast", traits: [], attacks: [{ name: "Bite", bonus: 3, damage: "1d6+1", damageType: "piercing", knockdownDC: 11 }] }),
  boar: M({ key: "boar", name: "Boar", cr: 0.25, xp: 50, ac: 11, hp: 11, dexMod: 0, speed: 40, passive: 9, creatureType: "beast", traits: [], attacks: [{ name: "Tusk", bonus: 3, damage: "1d6+1", damageType: "slashing" }] }),
  giant_poisonous_snake: M({ key: "giant_poisonous_snake", name: "Giant Poisonous Snake", cr: 0.25, xp: 50, ac: 14, hp: 11, dexMod: 4, speed: 30, passive: 12, creatureType: "beast", traits: [], attacks: [{ name: "Bite", bonus: 6, damage: "1d4+4", damageType: "piercing", poison: { dc: 11, damage: "3d6" } }] }),
  giant_wolf_spider: M({ key: "giant_wolf_spider", name: "Giant Wolf Spider", cr: 0.25, xp: 50, ac: 13, hp: 11, dexMod: 3, speed: 40, passive: 13, creatureType: "beast", traits: [], attacks: [{ name: "Bite", bonus: 3, damage: "1d6+1", damageType: "piercing", poison: { dc: 11, damage: "2d6" } }] }),
  orc: M({ key: "orc", name: "Orc", cr: 0.5, xp: 100, ac: 13, hp: 15, dexMod: 1, speed: 30, passive: 10, creatureType: "humanoid", traits: [], attacks: [{ name: "Greataxe", bonus: 5, damage: "1d12+3", damageType: "slashing" }] }),
  hobgoblin: M({ key: "hobgoblin", name: "Hobgoblin", cr: 0.5, xp: 100, ac: 18, hp: 11, dexMod: 1, speed: 30, passive: 10, creatureType: "humanoid", traits: ["martial_advantage"], attacks: [{ name: "Longsword", bonus: 3, damage: "1d8+1", damageType: "slashing" }] }),
  worg: M({ key: "worg", name: "Worg", cr: 0.5, xp: 100, ac: 13, hp: 26, dexMod: 1, speed: 50, passive: 14, creatureType: "monstrosity", traits: [], attacks: [{ name: "Bite", bonus: 5, damage: "2d6+3", damageType: "piercing", knockdownDC: 13 }] }),
  shadow: M({ key: "shadow", name: "Shadow", cr: 0.5, xp: 100, ac: 12, hp: 16, dexMod: 2, speed: 40, passive: 10, creatureType: "undead", traits: ["fearless"], attacks: [{ name: "Strength Drain", bonus: 4, damage: "2d6+2", damageType: "necrotic" }] }),
  scout: M({ key: "scout", name: "Scout", cr: 0.5, xp: 100, ac: 13, hp: 16, dexMod: 2, speed: 30, passive: 15, creatureType: "humanoid", traits: [], attacks: [{ name: "Longbow", bonus: 4, damage: "1d8+2", damageType: "piercing" }, { name: "Longbow", bonus: 4, damage: "1d8+2", damageType: "piercing" }] }),
  black_bear: M({ key: "black_bear", name: "Black Bear", cr: 0.5, xp: 100, ac: 11, hp: 19, dexMod: 0, speed: 40, passive: 13, creatureType: "beast", traits: [], attacks: [{ name: "Bite", bonus: 3, damage: "1d6+2", damageType: "piercing" }, { name: "Claws", bonus: 3, damage: "2d4+2", damageType: "slashing" }] }),
  bugbear: M({ key: "bugbear", name: "Bugbear", cr: 1, xp: 200, ac: 16, hp: 27, dexMod: 2, speed: 30, passive: 10, creatureType: "humanoid", traits: [], attacks: [{ name: "Morningstar", bonus: 4, damage: "2d8+2", damageType: "piercing" }] }),
  brown_bear: M({ key: "brown_bear", name: "Brown Bear", cr: 1, xp: 200, ac: 11, hp: 34, dexMod: 0, speed: 40, passive: 13, creatureType: "beast", traits: [], attacks: [{ name: "Bite", bonus: 6, damage: "1d8+4", damageType: "piercing" }, { name: "Claws", bonus: 6, damage: "2d6+4", damageType: "slashing" }] }),
  specter: M({ key: "specter", name: "Specter", cr: 1, xp: 200, ac: 12, hp: 22, dexMod: 2, speed: 50, passive: 10, creatureType: "undead", traits: ["fearless"], attacks: [{ name: "Life Drain", bonus: 4, damage: "3d6", damageType: "necrotic" }] }),
  animated_armor: M({ key: "animated_armor", name: "Animated Armor", cr: 1, xp: 200, ac: 18, hp: 33, dexMod: 0, speed: 25, passive: 6, creatureType: "construct", traits: ["fearless"], attacks: [{ name: "Slam", bonus: 4, damage: "1d6+2", damageType: "bludgeoning" }, { name: "Slam", bonus: 4, damage: "1d6+2", damageType: "bludgeoning" }] }),
  green_dragon_wyrmling: M({ key: "green_dragon_wyrmling", name: "Green Dragon Wyrmling", cr: 2, xp: 450, ac: 17, hp: 38, dexMod: 1, speed: 30, passive: 14, creatureType: "dragon", traits: [], attacks: [{ name: "Bite", bonus: 4, damage: "1d10+2", damageType: "piercing", extra: { damage: "1d6", damageType: "poison" } }], special: { name: "Poison Breath", recharge: 5, save: { ability: "constitution", dc: 11 }, damage: "6d6", damageType: "poison", halfOnSave: true, tell: "green vapour curls from its jaws as its throat swells" } }),
  ogre: M({ key: "ogre", name: "Ogre", cr: 2, xp: 450, ac: 11, hp: 59, dexMod: -1, speed: 40, passive: 8, creatureType: "giant", traits: [], attacks: [{ name: "Greatclub", bonus: 6, damage: "2d8+4", damageType: "bludgeoning" }] }),
  ghast: M({ key: "ghast", name: "Ghast", cr: 2, xp: 450, ac: 13, hp: 36, dexMod: 3, speed: 30, passive: 10, creatureType: "undead", traits: ["fearless"], attacks: [{ name: "Claws", bonus: 5, damage: "2d6+3", damageType: "slashing" }] }),
  gargoyle: M({ key: "gargoyle", name: "Gargoyle", cr: 2, xp: 450, ac: 15, hp: 52, dexMod: 0, speed: 30, passive: 10, creatureType: "elemental", traits: ["fearless"], attacks: [{ name: "Bite", bonus: 4, damage: "1d6+2", damageType: "piercing" }, { name: "Claws", bonus: 4, damage: "1d6+2", damageType: "slashing" }] }),
  berserker: M({ key: "berserker", name: "Berserker", cr: 2, xp: 450, ac: 13, hp: 67, dexMod: 1, speed: 30, passive: 10, creatureType: "humanoid", traits: [], attacks: [{ name: "Greataxe", bonus: 5, damage: "1d12+3", damageType: "slashing" }] }),
  hell_hound: M({ key: "hell_hound", name: "Hell Hound", cr: 3, xp: 700, ac: 15, hp: 45, dexMod: 1, speed: 50, passive: 15, creatureType: "fiend", traits: ["pack_tactics"], attacks: [{ name: "Bite", bonus: 5, damage: "1d8+3", damageType: "piercing", extra: { damage: "2d6", damageType: "fire" } }], special: { name: "Fire Breath", recharge: 5, save: { ability: "dexterity", dc: 12 }, damage: "6d6", damageType: "fire", halfOnSave: true, tell: "embers spill from its jaws and the air around it shimmers with heat" } }),
  wight: M({ key: "wight", name: "Wight", cr: 3, xp: 700, ac: 14, hp: 45, dexMod: 2, speed: 30, passive: 13, creatureType: "undead", traits: ["fearless"], attacks: [{ name: "Longsword", bonus: 4, damage: "1d8+2", damageType: "slashing" }, { name: "Longsword", bonus: 4, damage: "1d8+2", damageType: "slashing" }] }),
  minotaur: M({ key: "minotaur", name: "Minotaur", cr: 3, xp: 700, ac: 14, hp: 76, dexMod: 0, speed: 40, passive: 17, creatureType: "monstrosity", traits: [], attacks: [{ name: "Greataxe", bonus: 6, damage: "2d12+4", damageType: "slashing" }] }),
  veteran: M({ key: "veteran", name: "Veteran", cr: 3, xp: 700, ac: 17, hp: 58, dexMod: 1, speed: 30, passive: 12, creatureType: "humanoid", traits: [], attacks: [{ name: "Longsword", bonus: 5, damage: "1d8+3", damageType: "slashing" }, { name: "Longsword", bonus: 5, damage: "1d8+3", damageType: "slashing" }, { name: "Shortsword", bonus: 5, damage: "1d6+3", damageType: "piercing" }] }),
  manticore: M({ key: "manticore", name: "Manticore", cr: 3, xp: 700, ac: 14, hp: 68, dexMod: 3, speed: 30, passive: 11, creatureType: "monstrosity", traits: [], attacks: [{ name: "Bite", bonus: 5, damage: "1d8+3", damageType: "piercing" }, { name: "Claw", bonus: 5, damage: "1d6+3", damageType: "slashing" }, { name: "Claw", bonus: 5, damage: "1d6+3", damageType: "slashing" }] }),
  red_dragon_wyrmling: M({ key: "red_dragon_wyrmling", name: "Red Dragon Wyrmling", cr: 4, xp: 1100, ac: 17, hp: 75, dexMod: 0, speed: 30, passive: 14, creatureType: "dragon", traits: [], attacks: [{ name: "Bite", bonus: 6, damage: "1d10+4", damageType: "piercing", extra: { damage: "1d6", damageType: "fire" } }], special: { name: "Fire Breath", recharge: 5, save: { ability: "dexterity", dc: 13 }, damage: "7d6", damageType: "fire", halfOnSave: true, tell: "light glows through the scales of its throat as it rears back" } }),
  ettin: M({ key: "ettin", name: "Ettin", cr: 4, xp: 1100, ac: 12, hp: 85, dexMod: -1, speed: 40, passive: 14, creatureType: "giant", traits: [], attacks: [{ name: "Battleaxe", bonus: 7, damage: "2d8+5", damageType: "slashing" }, { name: "Morningstar", bonus: 7, damage: "2d8+5", damageType: "piercing" }] }),
  hill_giant: M({ key: "hill_giant", name: "Hill Giant", cr: 5, xp: 1800, ac: 13, hp: 105, dexMod: -1, speed: 40, passive: 12, creatureType: "giant", traits: [], attacks: [{ name: "Greatclub", bonus: 8, damage: "3d8+5", damageType: "bludgeoning" }, { name: "Greatclub", bonus: 8, damage: "3d8+5", damageType: "bludgeoning" }] }),
};

/**
 * Who you meet, by Wander's enemy themes and thread themes. Each roster runs
 * from rank and file to leader; the encounter builder fills the DMG budget
 * from it. A theme whose weakest member is beyond the party stays that way:
 * some things in the wild are meant to be run from.
 */
export const THEME_ROSTERS: Record<string, string[]> = {
  goblin: ["goblin", "goblin_boss"],
  kobold: ["kobold"],
  bandit: ["bandit", "thug", "bandit_captain"],
  desert_bandit: ["bandit", "thug", "bandit_captain"],
  tavern_brawl: ["thug"],
  beast: ["wolf", "dire_wolf"],
  wolf_pack: ["wolf", "dire_wolf"],
  winter_wolf: ["wolf", "winter_wolf"],
  undead: ["skeleton", "zombie", "ghoul"],
  skeleton_guardian: ["skeleton"],
  elemental: ["dust_mephit"],
  gnoll: ["gnoll"],
  lizardfolk: ["lizardfolk"],
  sahuagin: ["sahuagin"],
  darkmantle: ["darkmantle"],
  cave_fisher: ["giant_spider"],
  ettercap: ["giant_spider", "ettercap"],
  owlbear: ["owlbear"],
  giant_scorpion: ["giant_scorpion"],
  green_hag: ["green_hag"],
  wyvern: ["wyvern"],
  stone_giant: ["stone_giant"],
  // Campaign rosters (danger spec Phase 3): mixed roles so fights differ in shape.
  goblinoid: ["goblin", "hobgoblin", "bugbear", "goblin_boss"],
  orc: ["orc", "worg"],
  cult: ["cultist", "bandit_captain"],
  town_watch: ["guard", "veteran"],
  forest_beasts: ["giant_wolf_spider", "boar", "black_bear", "brown_bear", "giant_poisonous_snake"],
  sewer: ["giant_rat", "thug"],
  restless_dead: ["skeleton", "zombie", "shadow", "ghoul", "specter", "ghast", "wight"],
  haunted_keep: ["animated_armor", "specter", "wight"],
  gargoyle: ["gargoyle"],
  fiend_hounds: ["hell_hound"],
  marsh: ["giant_poisonous_snake", "lizardfolk", "green_dragon_wyrmling"],
  giants: ["ogre", "ettin", "hill_giant"],
  berserkers: ["berserker", "bandit_captain"],
  monstrous: ["manticore", "minotaur"],
  red_wyrmling: ["red_dragon_wyrmling"],
};

export function rosterFor(theme: string | undefined): MonsterStats[] {
  const keys = THEME_ROSTERS[(theme ?? "").toLowerCase()] ?? THEME_ROSTERS.bandit;
  return keys.map((k) => MONSTERS[k]).filter(Boolean);
}

// ── DMG encounter building ────────────────────────────────────────────────────

export type EncounterDifficulty = "easy" | "medium" | "hard" | "deadly";

/** XP thresholds per character, DMG chapter 3 (levels 1 to 10). */
const THRESHOLDS: Record<number, [number, number, number, number]> = {
  1: [25, 50, 75, 100], 2: [50, 100, 150, 200], 3: [75, 150, 225, 400], 4: [125, 250, 375, 500],
  5: [250, 500, 750, 1100], 6: [300, 600, 900, 1400], 7: [350, 750, 1100, 1700], 8: [450, 900, 1400, 2100],
  9: [550, 1100, 1600, 2400], 10: [600, 1200, 1900, 2800],
};

export function xpThresholds(level: number, partySize = 1) {
  const t = THRESHOLDS[Math.max(1, Math.min(10, Math.floor(level)))];
  return { easy: t[0] * partySize, medium: t[1] * partySize, hard: t[2] * partySize, deadly: t[3] * partySize };
}

const MULTIPLIERS = [1, 1.5, 2, 2.5, 3, 4, 5];

function multiplierIndex(count: number): number {
  if (count <= 1) return 0;
  if (count === 2) return 1;
  if (count <= 6) return 2;
  if (count <= 10) return 3;
  if (count <= 14) return 4;
  return 5;
}

/**
 * Encounter multiplier for a number of monsters. Parties of fewer than three
 * use the next multiplier up (DMG, "Party Size"), so a solo character facing
 * one goblin counts it as 1.5x.
 */
export function encounterMultiplier(monsterCount: number, partySize = 1): number {
  let i = multiplierIndex(monsterCount);
  if (partySize < 3) i += 1;
  else if (partySize >= 6) i = Math.max(0, i - 1);
  return MULTIPLIERS[Math.min(MULTIPLIERS.length - 1, i)];
}

export function adjustedXp(monsters: Array<{ xp: number }>, partySize = 1): number {
  const raw = monsters.reduce((s, m) => s + m.xp, 0);
  return Math.round(raw * encounterMultiplier(monsters.length, partySize));
}

export function rateEncounter(adjXp: number, level: number, partySize = 1): EncounterDifficulty | "trivial" {
  const t = xpThresholds(level, partySize);
  if (adjXp >= t.deadly) return "deadly";
  if (adjXp >= t.hard) return "hard";
  if (adjXp >= t.medium) return "medium";
  if (adjXp >= t.easy) return "easy";
  return "trivial";
}

/**
 * Fill a budget for the target difficulty from a theme's roster, the way the
 * DMG suggests: add monsters while the adjusted XP stays within budget. Always
 * at least one monster, even if that one is already over budget.
 */
export function buildEncounter(
  theme: string | undefined,
  level: number,
  difficulty: "easy" | "medium" | "hard",
  rng: () => number = Math.random,
  partySize = 1,
): { monsters: MonsterStats[]; adjustedXp: number; rating: EncounterDifficulty | "trivial"; budget: number; note: string } {
  const roster = rosterFor(theme);
  const budget = xpThresholds(level, partySize)[difficulty];
  const byStrength = [...roster].sort((a, b) => b.xp - a.xp);
  const weakest = byStrength[byStrength.length - 1];
  const fill = (start: MonsterStats) => {
    const picks: MonsterStats[] = [start];
    for (let i = 0; i < 6; i++) {
      const candidates = roster.filter((m) => adjustedXp([...picks, m], partySize) <= budget);
      if (!candidates.length) break;
      // Prefer more of the weakest kind, so groups read as a pack or a gang.
      const next = candidates.includes(weakest) && rng() < 0.8 ? weakest : candidates[Math.floor(rng() * candidates.length)];
      picks.push(next);
    }
    return picks;
  };
  // Two ways to fill the budget: a leader with followers, or a pack of the
  // rank and file. Keep whichever comes closer without going over.
  const leader = byStrength.find((m) => m !== weakest && adjustedXp([m], partySize) <= budget);
  const options = [fill(weakest), ...(leader ? [fill(leader)] : [])];
  const fits = options.filter((o) => adjustedXp(o, partySize) <= budget);
  const picks = fits.length
    ? fits.sort((a, b) => adjustedXp(b, partySize) - adjustedXp(a, partySize))[0]
    : options.sort((a, b) => adjustedXp(a, partySize) - adjustedXp(b, partySize))[0];
  const adj = adjustedXp(picks, partySize);
  const rating = rateEncounter(adj, level, partySize);
  const names = picks.reduce<Record<string, number>>((acc, m) => { acc[m.name] = (acc[m.name] ?? 0) + 1; return acc; }, {});
  const article = (w: string) => (/^[aeiou]/i.test(w) ? "an" : "a");
  const plural = (w: string) => (/wolf$/i.test(w) ? w.replace(/f$/i, "ves") : /folk$|sahuagin$/i.test(w) ? w : /(s|ss)$/i.test(w) ? `${w}es` : `${w}s`);
  const list = Object.entries(names).map(([n, c]) => (c > 1 ? `${c} ${plural(n)}` : `${article(n)} ${n}`)).join(" and ");
  const raw = picks.reduce((s, m) => s + m.xp, 0);
  const note = `${list}: ${raw} XP x${encounterMultiplier(picks.length, partySize)} = ${adj} adjusted XP. ${article(rating) === "an" ? "An" : "A"} ${rating} fight for a level ${level} party of ${partySize} (DMG budget: ${budget} for ${difficulty}).`;
  return { monsters: picks, adjustedXp: adj, rating, budget, note };
}

export function xpForCr(cr: number): number {
  const table: Array<[number, number]> = [[0, 10], [0.125, 25], [0.25, 50], [0.5, 100], [1, 200], [2, 450], [3, 700], [4, 1100], [5, 1800], [6, 2300], [7, 2900], [8, 3900]];
  let xp = 10;
  for (const [c, x] of table) if (cr >= c) xp = x;
  return xp;
}
