/** SRD 5.1 Rogue (CC-BY 4.0), levels 1–10. */
import type { ClassDef, ClassFeature } from "../classProgression";

const EXPERTISE: ClassFeature = {
  id: "expertise",
  name: "Expertise",
  summary:
    "Choose two of your skill proficiencies, or one skill and thieves' tools; your proficiency bonus is doubled for ability checks that use them. You choose two more at 6th level.",
  kind: "passive",
};

const SNEAK_ATTACK: ClassFeature = {
  id: "sneak_attack",
  name: "Sneak Attack",
  summary:
    "Once per turn, deal extra damage to one creature you hit with a finesse or ranged weapon attack if you have advantage on the roll, or if another enemy of the target is within 5 feet of it, isn't incapacitated, and you don't have disadvantage.",
  kind: "passive",
  scaling: { 1: "1d6", 3: "2d6", 5: "3d6", 7: "4d6", 9: "5d6" },
};

export const ROGUE: ClassDef = {
  name: "Rogue",
  hitDie: 8,
  primaryAbilities: ["dexterity"],
  savingThrows: ["dexterity", "intelligence"],
  subclassLevel: 3,
  subclassLabel: "Roguish Archetype",
  asiLevels: [4, 8, 10, 12, 16, 19],
  maxEncodedLevel: 10,
  features: {
    1: [
      EXPERTISE,
      SNEAK_ATTACK,
      {
        id: "thieves_cant",
        name: "Thieves' Cant",
        summary:
          "You know thieves' cant, a secret mix of dialect, jargon and code that hides messages in normal conversation, plus signs and symbols for short messages.",
        kind: "passive",
      },
    ],
    2: [
      {
        id: "cunning_action",
        name: "Cunning Action",
        summary: "You can take a bonus action on each of your turns to Dash, Disengage or Hide.",
        kind: "bonusAction",
      },
    ],
    5: [
      {
        id: "uncanny_dodge",
        name: "Uncanny Dodge",
        summary: "When an attacker you can see hits you with an attack, you can use your reaction to halve the attack's damage against you.",
        kind: "reaction",
      },
    ],
    6: [EXPERTISE],
    7: [
      {
        id: "evasion",
        name: "Evasion",
        summary:
          "When an effect lets you make a Dexterity saving throw to take only half damage, you take no damage on a success and only half damage on a failure.",
        kind: "passive",
      },
    ],
  },
  subclass: {
    id: "thief",
    name: "Thief",
    pitch: "You live by quick fingers, climbing walls and taking what isn't nailed down.",
    features: {
      3: [
        {
          id: "fast_hands",
          name: "Fast Hands",
          summary:
            "You can use your Cunning Action bonus action to make a Dexterity (Sleight of Hand) check, use thieves' tools to disarm a trap or open a lock, or take the Use an Object action.",
          kind: "bonusAction",
        },
        {
          id: "second_story_work",
          name: "Second-Story Work",
          summary:
            "Climbing no longer costs you extra movement, and when you make a running jump, the distance you cover increases by a number of feet equal to your Dexterity modifier.",
          kind: "passive",
        },
      ],
      9: [
        {
          id: "supreme_sneak",
          name: "Supreme Sneak",
          summary: "You have advantage on Dexterity (Stealth) checks if you move no more than half your speed on the same turn.",
          kind: "passive",
        },
      ],
    },
  },
};
