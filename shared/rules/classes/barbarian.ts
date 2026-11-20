/** SRD 5.1 Barbarian (CC-BY 4.0), levels 1–10. */
import type { ClassDef, ClassFeature } from "../classProgression";

const RAGE: ClassFeature = {
  id: "rage",
  name: "Rage",
  summary:
    "As a bonus action (not in heavy armor), rage for 1 minute: advantage on Strength checks and Strength saving throws, a bonus to melee weapon damage rolls using Strength, and resistance to bludgeoning, piercing and slashing damage. You can't cast or concentrate on spells while raging, and it ends early if your turn ends without you attacking a hostile creature or taking damage.",
  kind: "bonusAction",
  uses: { max: { byLevel: { 1: 2, 3: 3, 6: 4 } }, recharge: "long" },
  scaling: { 1: "+2", 9: "+3" },
};

export const BARBARIAN: ClassDef = {
  name: "Barbarian",
  hitDie: 12,
  primaryAbilities: ["strength"],
  savingThrows: ["strength", "constitution"],
  subclassLevel: 3,
  subclassLabel: "Primal Path",
  asiLevels: [4, 8, 12, 16, 19],
  maxEncodedLevel: 10,
  features: {
    1: [
      RAGE,
      {
        id: "unarmored_defense",
        name: "Unarmored Defense",
        summary:
          "While you wear no armor, your AC equals 10 + your Dexterity modifier + your Constitution modifier. You can still use a shield.",
        kind: "passive",
      },
    ],
    2: [
      {
        id: "reckless_attack",
        name: "Reckless Attack",
        summary:
          "When you make your first attack on your turn, you can attack recklessly: you have advantage on melee weapon attack rolls using Strength this turn, but attack rolls against you have advantage until your next turn.",
        kind: "passive",
      },
      {
        id: "danger_sense",
        name: "Danger Sense",
        summary:
          "You have advantage on Dexterity saving throws against effects you can see, such as traps and spells, as long as you aren't blinded, deafened or incapacitated.",
        kind: "passive",
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
        id: "fast_movement",
        name: "Fast Movement",
        summary: "Your speed increases by 10 feet while you aren't wearing heavy armor.",
        kind: "passive",
      },
    ],
    7: [
      {
        id: "feral_instinct",
        name: "Feral Instinct",
        summary:
          "You have advantage on initiative rolls. If you are surprised at the start of combat and aren't incapacitated, you can act normally on your first turn, but only if you enter your rage before doing anything else.",
        kind: "passive",
      },
    ],
    9: [
      {
        id: "brutal_critical",
        name: "Brutal Critical",
        summary:
          "When you score a critical hit with a melee attack, roll one additional weapon damage die when determining the extra damage.",
        kind: "passive",
        scaling: { 9: "1 die" },
      },
    ],
  },
  subclass: {
    id: "path_of_the_berserker",
    name: "Path of the Berserker",
    pitch: "You let fury swallow you whole and carve through anything in reach.",
    features: {
      3: [
        {
          id: "frenzy",
          name: "Frenzy",
          summary:
            "When you rage, you can choose to frenzy: for the rest of that rage you can make a single melee weapon attack as a bonus action on each of your turns after this one. When the rage ends, you suffer one level of exhaustion.",
          kind: "bonusAction",
        },
      ],
      6: [
        {
          id: "mindless_rage",
          name: "Mindless Rage",
          summary:
            "You can't be charmed or frightened while raging. If you are charmed or frightened when you enter your rage, the effect is suspended for the rage's duration.",
          kind: "passive",
        },
      ],
      10: [
        {
          id: "intimidating_presence",
          name: "Intimidating Presence",
          summary:
            "As an action, choose a creature you can see within 30 feet; if it can see or hear you, it must succeed on a Wisdom saving throw (DC 8 + your proficiency bonus + your Charisma modifier) or be frightened of you until the end of your next turn. You can use your action on later turns to extend it; a creature that succeeds is immune to this feature for 24 hours.",
          kind: "action",
        },
      ],
    },
  },
};
