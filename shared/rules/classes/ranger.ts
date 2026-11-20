/** SRD 5.1 Ranger (CC-BY 4.0), levels 1–10. */
import type { ClassDef, ClassFeature } from "../classProgression";

const FAVORED_ENEMY: ClassFeature = {
  id: "favored_enemy",
  name: "Favored Enemy",
  summary:
    "Choose a type of favored enemy (aberrations, beasts, celestials, constructs, dragons, elementals, fey, fiends, giants, monstrosities, oozes, plants or undead, or two races of humanoid); you have advantage on Wisdom (Survival) checks to track them and Intelligence checks to recall information about them, and learn one language they speak. You choose another at 6th level.",
  kind: "passive",
  scaling: { 1: "1 enemy type", 6: "2 enemy types" },
};

const NATURAL_EXPLORER: ClassFeature = {
  id: "natural_explorer",
  name: "Natural Explorer",
  summary:
    "Choose a favored terrain (arctic, coast, desert, forest, grassland, mountain or swamp); your proficiency bonus is doubled for Intelligence or Wisdom checks about it that use a skill you're proficient in, and while traveling there for an hour or more your group isn't slowed by difficult terrain, can't get lost by nonmagical means, and you stay alert and forage and track more effectively. You choose more terrains at 6th and 10th level.",
  kind: "passive",
  scaling: { 1: "1 terrain", 6: "2 terrains", 10: "3 terrains" },
};

export const RANGER: ClassDef = {
  name: "Ranger",
  hitDie: 10,
  primaryAbilities: ["dexterity", "wisdom"],
  savingThrows: ["strength", "dexterity"],
  subclassLevel: 3,
  subclassLabel: "Ranger Archetype",
  asiLevels: [4, 8, 12, 16, 19],
  maxEncodedLevel: 10,
  spellcasting: {
    ability: "wisdom",
    kind: "half",
    style: "known",
    spellsKnown: { 2: 2, 3: 3, 5: 4, 7: 5, 9: 6 },
  },
  features: {
    1: [FAVORED_ENEMY, NATURAL_EXPLORER],
    2: [
      {
        id: "fighting_style",
        name: "Fighting Style",
        summary:
          "Choose one fighting style: Archery (+2 to ranged weapon attack rolls), Defense (+1 AC while wearing armor), Dueling (+2 damage with a one-handed melee weapon and no other weapon) or Two-Weapon Fighting (add your ability modifier to the off-hand attack's damage).",
        kind: "passive",
      },
      {
        id: "spellcasting",
        name: "Spellcasting",
        summary:
          "You cast ranger spells from a fixed list of spells known, using Wisdom (spell save DC = 8 + proficiency bonus + Wisdom modifier).",
        kind: "passive",
      },
    ],
    3: [
      {
        id: "primeval_awareness",
        name: "Primeval Awareness",
        summary:
          "As an action, expend a ranger spell slot: for 1 minute per slot level, you sense whether aberrations, celestials, dragons, elementals, fey, fiends or undead are within 1 mile (6 miles in favored terrain). It reveals neither their location nor their number.",
        kind: "action",
      },
    ],
    5: [
      {
        id: "extra_attack",
        name: "Extra Attack",
        summary: "You can attack twice, instead of once, whenever you take the Attack action on your turn.",
        kind: "passive",
      },
    ],
    6: [FAVORED_ENEMY, NATURAL_EXPLORER],
    8: [
      {
        id: "lands_stride",
        name: "Land's Stride",
        summary:
          "Moving through nonmagical difficult terrain costs you no extra movement, and nonmagical plants don't slow or harm you. You have advantage on saving throws against plants magically created or manipulated to impede movement.",
        kind: "passive",
      },
    ],
    10: [
      NATURAL_EXPLORER,
      {
        id: "hide_in_plain_sight",
        name: "Hide in Plain Sight",
        summary:
          "Spend 1 minute making camouflage, then press against a solid surface: while you remain still you gain +10 to Dexterity (Stealth) checks. Moving or taking an action or reaction ends it.",
        kind: "passive",
      },
    ],
  },
  subclass: {
    id: "hunter",
    name: "Hunter",
    pitch: "You stand between civilization and the monsters that would devour it.",
    features: {
      3: [
        {
          id: "hunters_prey",
          name: "Hunter's Prey",
          summary:
            "Choose one: Colossus Slayer (once per turn, +1d8 damage when you hit a creature below its hit point maximum with a weapon attack), Giant Killer (reaction attack when a Large or larger creature within 5 feet hits or misses you) or Horde Breaker (once per turn, make another weapon attack against a different creature within 5 feet of your original target).",
          kind: "passive",
        },
      ],
      7: [
        {
          id: "defensive_tactics",
          name: "Defensive Tactics",
          summary:
            "Choose one: Escape the Horde (opportunity attacks against you have disadvantage), Multiattack Defense (after a creature hits you, you gain +4 AC against its later attacks that turn) or Steel Will (advantage on saving throws against being frightened).",
          kind: "passive",
        },
      ],
    },
  },
};
