/** SRD 5.1 Wizard (CC-BY 4.0), levels 1–10. */
import type { ClassDef } from "../classProgression";

export const WIZARD: ClassDef = {
  name: "Wizard",
  hitDie: 6,
  primaryAbilities: ["intelligence"],
  savingThrows: ["intelligence", "wisdom"],
  subclassLevel: 2,
  subclassLabel: "Arcane Tradition",
  asiLevels: [4, 8, 12, 16, 19],
  maxEncodedLevel: 10,
  spellcasting: {
    ability: "intelligence",
    kind: "full",
    style: "prepared",
    cantripsKnown: { 1: 3, 4: 4, 10: 5 },
    spellbookPerLevel: 2,
  },
  features: {
    1: [
      {
        id: "spellcasting",
        name: "Spellcasting",
        summary:
          "Your spellbook starts with six 1st-level wizard spells and gains two each level. After a long rest you prepare Intelligence modifier + wizard level spells (minimum 1) from it, cast with Intelligence (spell save DC = 8 + proficiency bonus + Intelligence modifier), and can cast ritual spells from the book as rituals without preparing them.",
        kind: "passive",
      },
      {
        id: "arcane_recovery",
        name: "Arcane Recovery",
        summary:
          "Once per day when you finish a short rest, recover expended spell slots with a combined level equal to or less than half your wizard level (rounded up); none can be 6th level or higher.",
        kind: "passive",
        uses: { max: 1, recharge: "long" },
      },
    ],
  },
  subclass: {
    id: "school_of_evocation",
    name: "School of Evocation",
    pitch: "You shape raw elemental force into fire, lightning and thunder.",
    features: {
      2: [
        {
          id: "evocation_savant",
          name: "Evocation Savant",
          summary: "The gold and time you must spend to copy an evocation spell into your spellbook is halved.",
          kind: "passive",
        },
        {
          id: "sculpt_spells",
          name: "Sculpt Spells",
          summary:
            "When you cast an evocation spell that affects creatures you can see, choose up to 1 + the spell's level of them: they automatically succeed on their saving throws and take no damage if they would normally take half damage on a success.",
          kind: "passive",
        },
      ],
      6: [
        {
          id: "potent_cantrip",
          name: "Potent Cantrip",
          summary:
            "When a creature succeeds on a saving throw against your cantrip, it takes half the cantrip's damage (if any) but suffers no additional effect.",
          kind: "passive",
        },
      ],
      10: [
        {
          id: "empowered_evocation",
          name: "Empowered Evocation",
          summary: "Add your Intelligence modifier to one damage roll of any wizard evocation spell you cast.",
          kind: "passive",
        },
      ],
    },
  },
};
