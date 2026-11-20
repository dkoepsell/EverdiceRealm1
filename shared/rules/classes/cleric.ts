/** SRD 5.1 Cleric (CC-BY 4.0), levels 1–10. */
import type { ClassDef, ClassFeature } from "../classProgression";

const CHANNEL_DIVINITY: ClassFeature = {
  id: "channel_divinity",
  name: "Channel Divinity",
  summary:
    "You can channel divine energy to fuel an effect such as Turn Undead or your domain's option; choose one effect each time. You regain expended uses on a short or long rest (two uses per rest from 6th level).",
  kind: "resource",
  uses: { max: { byLevel: { 2: 1, 6: 2 } }, recharge: "short" },
};

const DESTROY_UNDEAD: ClassFeature = {
  id: "destroy_undead",
  name: "Destroy Undead",
  summary:
    "When an undead fails its saving throw against your Turn Undead, it is instantly destroyed if its challenge rating is at or below the listed threshold.",
  kind: "passive",
  scaling: { 5: "CR 1/2", 8: "CR 1" },
};

export const CLERIC: ClassDef = {
  name: "Cleric",
  hitDie: 8,
  primaryAbilities: ["wisdom"],
  savingThrows: ["wisdom", "charisma"],
  subclassLevel: 1,
  subclassLabel: "Divine Domain",
  asiLevels: [4, 8, 12, 16, 19],
  maxEncodedLevel: 10,
  spellcasting: {
    ability: "wisdom",
    kind: "full",
    style: "prepared",
    cantripsKnown: { 1: 3, 4: 4, 10: 5 },
  },
  features: {
    1: [
      {
        id: "spellcasting",
        name: "Spellcasting",
        summary:
          "You cast cleric spells using Wisdom (spell save DC = 8 + proficiency bonus + Wisdom modifier) with a holy symbol as your focus. After a long rest you prepare Wisdom modifier + cleric level spells (minimum 1) from the whole cleric list, and can cast prepared ritual spells as rituals.",
        kind: "passive",
      },
    ],
    2: [
      CHANNEL_DIVINITY,
      {
        id: "turn_undead",
        name: "Channel Divinity: Turn Undead",
        summary:
          "As an action, spend a Channel Divinity use and present your holy symbol: each undead within 30 feet that can see or hear you makes a Wisdom saving throw, and on a failure is turned for 1 minute or until it takes damage. A turned creature must spend its turns moving away from you and can't take reactions.",
        kind: "action",
      },
    ],
    5: [DESTROY_UNDEAD],
    6: [CHANNEL_DIVINITY],
    8: [DESTROY_UNDEAD],
    10: [
      {
        id: "divine_intervention",
        name: "Divine Intervention",
        summary:
          "As an action, call on your deity and roll percentile dice; if you roll a number equal to or lower than your cleric level, your deity intervenes (the DM chooses how). If it succeeds you can't use this again for 7 days; otherwise you can use it again after a long rest.",
        kind: "action",
        uses: { max: 1, recharge: "long" },
      },
    ],
  },
  subclass: {
    id: "life_domain",
    name: "Life Domain",
    pitch: "You carry the light of life itself, mending wounds others cannot.",
    features: {
      1: [
        {
          id: "domain_spells",
          name: "Domain Spells",
          summary:
            "You always have your Life Domain spells prepared, and they don't count against your number of prepared spells.",
          kind: "passive",
          scaling: {
            1: "bless, cure wounds",
            3: "+ lesser restoration, spiritual weapon",
            5: "+ beacon of hope, revivify",
            7: "+ death ward, guardian of faith",
            9: "+ mass cure wounds, raise dead",
          },
        },
        {
          id: "bonus_proficiency",
          name: "Bonus Proficiency",
          summary: "You gain proficiency with heavy armor.",
          kind: "passive",
        },
        {
          id: "disciple_of_life",
          name: "Disciple of Life",
          summary:
            "Whenever you use a spell of 1st level or higher to restore hit points to a creature, it regains additional hit points equal to 2 + the spell's level.",
          kind: "passive",
        },
      ],
      2: [
        {
          id: "preserve_life",
          name: "Channel Divinity: Preserve Life",
          summary:
            "As an action, spend a Channel Divinity use to restore hit points equal to five times your cleric level, divided as you choose among creatures within 30 feet; no creature can be raised above half its hit point maximum. It has no effect on undead or constructs.",
          kind: "action",
        },
      ],
      6: [
        {
          id: "blessed_healer",
          name: "Blessed Healer",
          summary:
            "When you cast a spell of 1st level or higher that restores hit points to a creature other than you, you regain hit points equal to 2 + the spell's level.",
          kind: "passive",
        },
      ],
      8: [
        {
          id: "divine_strike",
          name: "Divine Strike",
          summary:
            "Once on each of your turns when you hit a creature with a weapon attack, you can deal an extra 1d8 radiant damage to the target.",
          kind: "passive",
          scaling: { 8: "1d8" },
        },
      ],
    },
  },
};
