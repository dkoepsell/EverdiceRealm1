/** SRD 5.1 Monk (CC-BY 4.0), levels 1–10. */
import type { ClassDef } from "../classProgression";

const UNARMORED_MOVEMENT_SCALING = { 2: "+10 ft", 6: "+15 ft", 10: "+20 ft" };

export const MONK: ClassDef = {
  name: "Monk",
  hitDie: 8,
  primaryAbilities: ["dexterity", "wisdom"],
  savingThrows: ["strength", "dexterity"],
  subclassLevel: 3,
  subclassLabel: "Monastic Tradition",
  asiLevels: [4, 8, 12, 16, 19],
  maxEncodedLevel: 10,
  features: {
    1: [
      {
        id: "unarmored_defense",
        name: "Unarmored Defense",
        summary:
          "While you wear no armor and carry no shield, your AC equals 10 + your Dexterity modifier + your Wisdom modifier.",
        kind: "passive",
      },
      {
        id: "martial_arts",
        name: "Martial Arts",
        summary:
          "While unarmed or wielding only monk weapons (shortswords and simple melee weapons without the two-handed or heavy property) and wearing no armor or shield, you can use Dexterity instead of Strength for attack and damage rolls and can roll your Martial Arts die in place of the normal damage. When you take the Attack action with an unarmed strike or monk weapon, you can make one unarmed strike as a bonus action.",
        kind: "passive",
        scaling: { 1: "1d4", 5: "1d6" },
      },
    ],
    2: [
      {
        id: "ki",
        name: "Ki",
        summary:
          "You have ki points equal to your monk level, spent to fuel ki features; your Ki save DC is 8 + proficiency bonus + Wisdom modifier. You regain all spent ki when you finish a short or long rest (spending at least 30 minutes meditating).",
        kind: "resource",
        uses: { max: "classLevel", recharge: "short" },
      },
      {
        id: "flurry_of_blows",
        name: "Flurry of Blows",
        summary: "Immediately after you take the Attack action on your turn, spend 1 ki point to make two unarmed strikes as a bonus action.",
        kind: "bonusAction",
      },
      {
        id: "patient_defense",
        name: "Patient Defense",
        summary: "Spend 1 ki point to take the Dodge action as a bonus action on your turn.",
        kind: "bonusAction",
      },
      {
        id: "step_of_the_wind",
        name: "Step of the Wind",
        summary:
          "Spend 1 ki point to take the Disengage or Dash action as a bonus action on your turn; your jump distance is doubled for the turn.",
        kind: "bonusAction",
      },
      {
        id: "unarmored_movement",
        name: "Unarmored Movement",
        summary: "Your speed increases while you aren't wearing armor or wielding a shield.",
        kind: "passive",
        scaling: UNARMORED_MOVEMENT_SCALING,
      },
    ],
    3: [
      {
        id: "deflect_missiles",
        name: "Deflect Missiles",
        summary:
          "When a ranged weapon attack hits you, use your reaction to reduce the damage by 1d10 + your Dexterity modifier + your monk level. If you reduce it to 0 and have a hand free, you can catch the missile and spend 1 ki point to throw it back as a ranged attack (range 20/60) with proficiency.",
        kind: "reaction",
      },
    ],
    4: [
      {
        id: "slow_fall",
        name: "Slow Fall",
        summary: "When you fall, use your reaction to reduce the falling damage by five times your monk level.",
        kind: "reaction",
      },
    ],
    5: [
      {
        id: "extra_attack",
        name: "Extra Attack",
        summary: "You can attack twice, instead of once, whenever you take the Attack action on your turn.",
        kind: "passive",
      },
      {
        id: "stunning_strike",
        name: "Stunning Strike",
        summary:
          "When you hit another creature with a melee weapon attack, you can spend 1 ki point; the target must succeed on a Constitution saving throw or be stunned until the end of your next turn.",
        kind: "passive",
      },
    ],
    6: [
      {
        id: "ki_empowered_strikes",
        name: "Ki-Empowered Strikes",
        summary:
          "Your unarmed strikes count as magical for overcoming resistance and immunity to nonmagical attacks and damage.",
        kind: "passive",
      },
    ],
    7: [
      {
        id: "evasion",
        name: "Evasion",
        summary:
          "When an effect lets you make a Dexterity saving throw to take only half damage, you take no damage on a success and only half damage on a failure.",
        kind: "passive",
      },
      {
        id: "stillness_of_mind",
        name: "Stillness of Mind",
        summary: "You can use your action to end one effect on yourself that is causing you to be charmed or frightened.",
        kind: "action",
      },
    ],
    9: [
      {
        id: "unarmored_movement",
        name: "Unarmored Movement",
        summary:
          "Your speed increases while you aren't wearing armor or wielding a shield, and you can now move along vertical surfaces and across liquids on your turn without falling during the move.",
        kind: "passive",
        scaling: UNARMORED_MOVEMENT_SCALING,
      },
    ],
    10: [
      {
        id: "purity_of_body",
        name: "Purity of Body",
        summary: "Your mastery of ki makes you immune to disease and poison.",
        kind: "passive",
      },
    ],
  },
  subclass: {
    id: "way_of_the_open_hand",
    name: "Way of the Open Hand",
    pitch: "You master unarmed combat, toppling foes and healing your own body.",
    features: {
      3: [
        {
          id: "open_hand_technique",
          name: "Open Hand Technique",
          summary:
            "When you hit a creature with a Flurry of Blows attack, choose one: it must succeed on a Dexterity saving throw or be knocked prone; it must succeed on a Strength saving throw or be pushed up to 15 feet away; or it can't take reactions until the end of your next turn.",
          kind: "passive",
        },
      ],
      6: [
        {
          id: "wholeness_of_body",
          name: "Wholeness of Body",
          summary: "As an action, regain hit points equal to three times your monk level. You must finish a long rest before using it again.",
          kind: "action",
          uses: { max: 1, recharge: "long" },
        },
      ],
    },
  },
};
