/** SRD 5.1 Warlock (CC-BY 4.0), levels 1–10. */
import type { ClassDef, ClassFeature } from "../classProgression";

const INVOCATIONS: ClassFeature = {
  id: "eldritch_invocations",
  name: "Eldritch Invocations",
  summary:
    "You learn eldritch invocations, fragments of forbidden knowledge that grant lasting magical abilities. When you gain a warlock level, you can swap one invocation you know for another you qualify for.",
  kind: "passive",
  scaling: { 2: "2 known", 5: "3 known", 7: "4 known", 9: "5 known" },
};

const PACT_MAGIC_SCALING = {
  1: "1 slot, 1st level",
  2: "2 slots, 1st level",
  3: "2 slots, 2nd level",
  5: "2 slots, 3rd level",
  7: "2 slots, 4th level",
  9: "2 slots, 5th level",
};

export const WARLOCK: ClassDef = {
  name: "Warlock",
  hitDie: 8,
  primaryAbilities: ["charisma"],
  savingThrows: ["wisdom", "charisma"],
  subclassLevel: 1,
  subclassLabel: "Otherworldly Patron",
  asiLevels: [4, 8, 12, 16, 19],
  maxEncodedLevel: 10,
  spellcasting: {
    ability: "charisma",
    kind: "pact",
    style: "known",
    cantripsKnown: { 1: 2, 4: 3, 10: 4 },
    spellsKnown: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 10 },
  },
  features: {
    1: [
      {
        id: "pact_magic",
        name: "Pact Magic",
        summary:
          "You cast warlock spells from a fixed list of spells known, using Charisma (spell save DC = 8 + proficiency bonus + Charisma modifier). Your few spell slots are all the same level, and you regain them when you finish a short or long rest.",
        kind: "passive",
        scaling: PACT_MAGIC_SCALING,
      },
    ],
    2: [INVOCATIONS],
    3: [
      {
        id: "pact_boon",
        name: "Pact Boon",
        summary:
          "Choose a gift from your patron: Pact of the Chain (find familiar, with imp, pseudodragon, quasit or sprite forms), Pact of the Blade (create a pact weapon in your hand as an action) or Pact of the Tome (a Book of Shadows granting three cantrips from any class's list).",
        kind: "passive",
      },
    ],
    5: [INVOCATIONS],
    7: [INVOCATIONS],
    9: [INVOCATIONS],
  },
  subclass: {
    id: "the_fiend",
    name: "The Fiend",
    pitch: "You bargained with a lord of the Lower Planes, and hellfire answers you.",
    features: {
      1: [
        {
          id: "expanded_spell_list",
          name: "Expanded Spell List",
          summary:
            "These spells are added to the warlock list for you: burning hands, command (1st); blindness/deafness, scorching ray (2nd); fireball, stinking cloud (3rd); fire shield, wall of fire (4th); flame strike, hallow (5th).",
          kind: "passive",
        },
        {
          id: "dark_ones_blessing",
          name: "Dark One's Blessing",
          summary:
            "When you reduce a hostile creature to 0 hit points, you gain temporary hit points equal to your Charisma modifier + your warlock level (minimum 1).",
          kind: "passive",
        },
      ],
      6: [
        {
          id: "dark_ones_own_luck",
          name: "Dark One's Own Luck",
          summary:
            "When you make an ability check or saving throw, you can add a d10 to the roll, after seeing it but before its effects occur. Once used, you must finish a short or long rest to use it again.",
          kind: "passive",
          uses: { max: 1, recharge: "short" },
        },
      ],
      10: [
        {
          id: "fiendish_resilience",
          name: "Fiendish Resilience",
          summary:
            "When you finish a short or long rest, choose one damage type to gain resistance to until you choose another. Damage from magical weapons or silver weapons ignores this resistance.",
          kind: "passive",
        },
      ],
    },
  },
};
