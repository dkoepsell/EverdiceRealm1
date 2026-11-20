/** SRD 5.1 Fighter (CC-BY 4.0), levels 1–10. */
import type { ClassDef } from "../classProgression";

export const FIGHTER: ClassDef = {
  name: "Fighter",
  hitDie: 10,
  primaryAbilities: ["strength", "dexterity"],
  savingThrows: ["strength", "constitution"],
  subclassLevel: 3,
  subclassLabel: "Martial Archetype",
  asiLevels: [4, 6, 8, 12, 14, 16, 19],
  maxEncodedLevel: 10,
  features: {
    1: [
      {
        id: "fighting_style",
        name: "Fighting Style",
        summary:
          "Choose one fighting style: Archery (+2 to ranged weapon attack rolls), Defense (+1 AC while wearing armor), Dueling (+2 damage with a one-handed melee weapon and no other weapon), Great Weapon Fighting (reroll 1s and 2s on two-handed melee damage dice), Protection (reaction to impose disadvantage on an attack against an adjacent ally, needs a shield) or Two-Weapon Fighting (add your ability modifier to the off-hand attack's damage).",
        kind: "passive",
      },
      {
        id: "second_wind",
        name: "Second Wind",
        summary:
          "On your turn, use a bonus action to regain hit points equal to 1d10 + your fighter level. Once used, you must finish a short or long rest to use it again.",
        kind: "bonusAction",
        uses: { max: 1, recharge: "short" },
      },
    ],
    2: [
      {
        id: "action_surge",
        name: "Action Surge",
        summary:
          "On your turn, you can take one additional action. Once used, you must finish a short or long rest to use it again.",
        kind: "action",
        uses: { max: { byLevel: { 2: 1 } }, recharge: "short" },
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
    9: [
      {
        id: "indomitable",
        name: "Indomitable",
        summary:
          "You can reroll a saving throw that you fail, but must use the new roll. Once used, you must finish a long rest to use it again.",
        kind: "passive",
        uses: { max: 1, recharge: "long" },
      },
    ],
  },
  subclass: {
    id: "champion",
    name: "Champion",
    pitch: "You hone raw physical excellence until every blow can be deadly.",
    features: {
      3: [
        {
          id: "improved_critical",
          name: "Improved Critical",
          summary: "Your weapon attacks score a critical hit on a roll of 19 or 20.",
          kind: "passive",
        },
      ],
      7: [
        {
          id: "remarkable_athlete",
          name: "Remarkable Athlete",
          summary:
            "Add half your proficiency bonus (rounded up) to any Strength, Dexterity or Constitution check that doesn't already use your proficiency bonus. Your running long jump distance increases by a number of feet equal to your Strength modifier.",
          kind: "passive",
        },
      ],
      10: [
        {
          id: "additional_fighting_style",
          name: "Additional Fighting Style",
          summary: "Choose a second option from the Fighting Style class feature.",
          kind: "passive",
        },
      ],
    },
  },
};
