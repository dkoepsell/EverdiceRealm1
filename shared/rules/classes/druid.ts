/** SRD 5.1 Druid (CC-BY 4.0), levels 1–10. */
import type { ClassDef, ClassFeature } from "../classProgression";

const WILD_SHAPE: ClassFeature = {
  id: "wild_shape",
  name: "Wild Shape",
  summary:
    "As an action, magically assume the shape of a beast you have seen, within the listed challenge rating and movement limits, for up to half your druid level in hours. You revert as a bonus action, or automatically if you drop to 0 hit points, fall unconscious or die; you can't cast spells while transformed.",
  kind: "action",
  uses: { max: 2, recharge: "short" },
  scaling: {
    2: "Max CR 1/4, no flying or swimming speed",
    4: "Max CR 1/2, no flying speed",
    8: "Max CR 1",
  },
};

export const DRUID: ClassDef = {
  name: "Druid",
  hitDie: 8,
  primaryAbilities: ["wisdom"],
  savingThrows: ["intelligence", "wisdom"],
  subclassLevel: 2,
  subclassLabel: "Druid Circle",
  asiLevels: [4, 8, 12, 16, 19],
  maxEncodedLevel: 10,
  spellcasting: {
    ability: "wisdom",
    kind: "full",
    style: "prepared",
    cantripsKnown: { 1: 2, 4: 3, 10: 4 },
  },
  features: {
    1: [
      {
        id: "druidic",
        name: "Druidic",
        summary:
          "You know Druidic, the secret language of druids, and can leave hidden messages in it that others notice only with a DC 15 Wisdom (Perception) check and can't decipher without magic.",
        kind: "passive",
      },
      {
        id: "spellcasting",
        name: "Spellcasting",
        summary:
          "You cast druid spells using Wisdom (spell save DC = 8 + proficiency bonus + Wisdom modifier) with a druidic focus. After a long rest you prepare Wisdom modifier + druid level spells (minimum 1) from the whole druid list, and can cast prepared ritual spells as rituals.",
        kind: "passive",
      },
    ],
    2: [WILD_SHAPE],
    4: [WILD_SHAPE],
    8: [WILD_SHAPE],
  },
  subclass: {
    id: "circle_of_the_land",
    name: "Circle of the Land",
    pitch: "You draw your magic from the land you swore to keep.",
    features: {
      2: [
        {
          id: "bonus_cantrip",
          name: "Bonus Cantrip",
          summary: "You learn one additional druid cantrip of your choice.",
          kind: "passive",
        },
        {
          id: "natural_recovery",
          name: "Natural Recovery",
          summary:
            "Once per long rest, during a short rest you can recover expended spell slots with a combined level equal to or less than half your druid level (rounded up); none can be 6th level or higher.",
          kind: "passive",
          uses: { max: 1, recharge: "long" },
        },
      ],
      3: [
        {
          id: "circle_spells",
          name: "Circle Spells",
          summary:
            "Choose a land: arctic, coast, desert, forest, grassland, mountain, swamp or Underdark. At 3rd, 5th, 7th and 9th level you gain that land's circle spells, which are always prepared and don't count against your prepared spells.",
          kind: "passive",
        },
      ],
      6: [
        {
          id: "lands_stride",
          name: "Land's Stride",
          summary:
            "Moving through nonmagical difficult terrain costs you no extra movement, and nonmagical plants don't slow or harm you. You have advantage on saving throws against plants magically created or manipulated to impede movement.",
          kind: "passive",
        },
      ],
      10: [
        {
          id: "natures_ward",
          name: "Nature's Ward",
          summary:
            "You can't be charmed or frightened by elementals or fey, and you are immune to poison and disease.",
          kind: "passive",
        },
      ],
    },
  },
};
