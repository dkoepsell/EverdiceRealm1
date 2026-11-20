/** SRD 5.1 Bard (CC-BY 4.0), levels 1–10. */
import type { ClassDef, ClassFeature } from "../classProgression";

const BI_SCALING = { 1: "d6", 5: "d8", 10: "d10" };

const BARDIC_INSPIRATION_SHORT: ClassFeature = {
  id: "bardic_inspiration",
  name: "Bardic Inspiration (Font of Inspiration)",
  summary:
    "As a bonus action, give one creature other than you within 60 feet that can hear you a Bardic Inspiration die; within 10 minutes it can add the die to one ability check, attack roll or saving throw. You have uses equal to your Charisma modifier (minimum 1), and from 5th level (Font of Inspiration) you regain them all on a short or long rest.",
  kind: "bonusAction",
  uses: { max: { ability: "charisma", min: 1 }, recharge: "short" },
  scaling: BI_SCALING,
};

const EXPERTISE: ClassFeature = {
  id: "expertise",
  name: "Expertise",
  summary:
    "Choose two of your skill proficiencies; your proficiency bonus is doubled for any ability check that uses them. You choose two more at 10th level.",
  kind: "passive",
};

export const BARD: ClassDef = {
  name: "Bard",
  hitDie: 8,
  primaryAbilities: ["charisma"],
  savingThrows: ["dexterity", "charisma"],
  subclassLevel: 3,
  subclassLabel: "Bard College",
  asiLevels: [4, 8, 12, 16, 19],
  maxEncodedLevel: 10,
  spellcasting: {
    ability: "charisma",
    kind: "full",
    style: "known",
    cantripsKnown: { 1: 2, 4: 3, 10: 4 },
    spellsKnown: { 1: 4, 2: 5, 3: 6, 4: 7, 5: 8, 6: 9, 7: 10, 8: 11, 9: 12, 10: 14 },
  },
  features: {
    1: [
      {
        id: "spellcasting",
        name: "Spellcasting",
        summary:
          "You cast bard spells from a fixed list of spells known, using Charisma (spell save DC = 8 + proficiency bonus + Charisma modifier), with a musical instrument as your spellcasting focus. You can cast a known spell as a ritual if it has the ritual tag.",
        kind: "passive",
      },
      {
        id: "bardic_inspiration",
        name: "Bardic Inspiration",
        summary:
          "As a bonus action, give one creature other than you within 60 feet that can hear you a Bardic Inspiration die; within 10 minutes it can add the die to one ability check, attack roll or saving throw. You have uses equal to your Charisma modifier (minimum 1), regained on a long rest.",
        kind: "bonusAction",
        uses: { max: { ability: "charisma", min: 1 }, recharge: "long" },
        scaling: BI_SCALING,
      },
    ],
    2: [
      {
        id: "jack_of_all_trades",
        name: "Jack of All Trades",
        summary:
          "Add half your proficiency bonus, rounded down, to any ability check you make that doesn't already include your proficiency bonus.",
        kind: "passive",
      },
      {
        id: "song_of_rest",
        name: "Song of Rest",
        summary:
          "During a short rest, if you or friendly creatures who hear your performance regain hit points by spending Hit Dice, each of them regains extra hit points equal to your Song of Rest die.",
        kind: "passive",
        scaling: { 2: "d6", 9: "d8" },
      },
    ],
    3: [EXPERTISE],
    5: [BARDIC_INSPIRATION_SHORT],
    6: [
      {
        id: "countercharm",
        name: "Countercharm",
        summary:
          "As an action, start a performance that lasts until the end of your next turn; during it, you and friendly creatures within 30 feet that can hear you have advantage on saving throws against being frightened or charmed. It ends early if you are incapacitated or silenced, or if you end it (no action required).",
        kind: "action",
      },
    ],
    10: [
      BARDIC_INSPIRATION_SHORT,
      EXPERTISE,
      {
        id: "magical_secrets",
        name: "Magical Secrets",
        summary:
          "Learn two spells of your choice from any class (cantrips or spells of a level you can cast); they count as bard spells and are included in your spells known.",
        kind: "passive",
      },
    ],
  },
  subclass: {
    id: "college_of_lore",
    name: "College of Lore",
    pitch: "You collect secrets, stories and spells, and your words cut deep.",
    features: {
      3: [
        {
          id: "bonus_proficiencies",
          name: "Bonus Proficiencies",
          summary: "You gain proficiency with three skills of your choice.",
          kind: "passive",
        },
        {
          id: "cutting_words",
          name: "Cutting Words",
          summary:
            "When a creature you can see within 60 feet makes an attack roll, ability check or damage roll, you can use your reaction and expend one Bardic Inspiration use to roll the die and subtract the number from its roll, after it rolls but before the DM says whether it succeeds. Creatures that can't hear you or are immune to being charmed are unaffected.",
          kind: "reaction",
        },
      ],
      6: [
        {
          id: "additional_magical_secrets",
          name: "Additional Magical Secrets",
          summary:
            "Learn two spells of your choice from any class (of a level you can cast, or cantrips); they count as bard spells but don't count against your number of spells known.",
          kind: "passive",
        },
      ],
    },
  },
};
