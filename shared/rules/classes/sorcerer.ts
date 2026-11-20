/** SRD 5.1 Sorcerer (CC-BY 4.0), levels 1–10. */
import type { ClassDef, ClassFeature } from "../classProgression";

const METAMAGIC: ClassFeature = {
  id: "metamagic",
  name: "Metamagic",
  summary:
    "Choose Metamagic options to twist your spells by spending sorcery points: Careful, Distant, Empowered, Extended, Heightened, Quickened, Subtle or Twinned Spell. You can use only one per spell unless an option says otherwise; you learn another at 10th level.",
  kind: "passive",
  scaling: { 3: "2 options", 10: "3 options" },
};

export const SORCERER: ClassDef = {
  name: "Sorcerer",
  hitDie: 6,
  primaryAbilities: ["charisma"],
  savingThrows: ["constitution", "charisma"],
  subclassLevel: 1,
  subclassLabel: "Sorcerous Origin",
  asiLevels: [4, 8, 12, 16, 19],
  maxEncodedLevel: 10,
  spellcasting: {
    ability: "charisma",
    kind: "full",
    style: "known",
    cantripsKnown: { 1: 4, 4: 5, 10: 6 },
    spellsKnown: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 11 },
  },
  features: {
    1: [
      {
        id: "spellcasting",
        name: "Spellcasting",
        summary:
          "You cast sorcerer spells from a fixed list of spells known, using Charisma (spell save DC = 8 + proficiency bonus + Charisma modifier), with an arcane focus.",
        kind: "passive",
      },
    ],
    2: [
      {
        id: "font_of_magic",
        name: "Font of Magic",
        summary:
          "You have sorcery points equal to your sorcerer level, regained when you finish a long rest. You spend them on Metamagic or convert them to and from spell slots.",
        kind: "resource",
        uses: { max: "classLevel", recharge: "long" },
      },
      {
        id: "flexible_casting",
        name: "Flexible Casting",
        summary:
          "As a bonus action, expend a spell slot to gain sorcery points equal to its level, or spend sorcery points to create a slot (1st: 2, 2nd: 3, 3rd: 5, 4th: 6, 5th: 7; no higher than 5th). Created slots vanish when you finish a long rest.",
        kind: "bonusAction",
      },
    ],
    3: [METAMAGIC],
    10: [METAMAGIC],
  },
  subclass: {
    id: "draconic_bloodline",
    name: "Draconic Bloodline",
    pitch: "Dragon blood runs in your veins, and its magic burns inside you.",
    features: {
      1: [
        {
          id: "dragon_ancestor",
          name: "Dragon Ancestor",
          summary:
            "Choose a dragon ancestor, which sets your damage type: black or copper (acid), blue or bronze (lightning), brass, gold or red (fire), green (poison), silver or white (cold). You speak Draconic, and your proficiency bonus is doubled on Charisma checks to interact with dragons if it applies.",
          kind: "passive",
        },
        {
          id: "draconic_resilience",
          name: "Draconic Resilience",
          summary:
            "Your hit point maximum increases by 1 for each sorcerer level, and while you wear no armor your AC equals 13 + your Dexterity modifier.",
          kind: "passive",
        },
      ],
      6: [
        {
          id: "elemental_affinity",
          name: "Elemental Affinity",
          summary:
            "When you cast a spell that deals damage of your ancestry's type, add your Charisma modifier to one damage roll of that spell. You can also spend 1 sorcery point to gain resistance to that damage type for 1 hour.",
          kind: "passive",
        },
      ],
    },
  },
};
