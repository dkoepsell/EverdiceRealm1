/** SRD 5.1 Paladin (CC-BY 4.0), levels 1–10. */
import type { ClassDef } from "../classProgression";

export const PALADIN: ClassDef = {
  name: "Paladin",
  hitDie: 10,
  primaryAbilities: ["strength", "charisma"],
  savingThrows: ["wisdom", "charisma"],
  subclassLevel: 3,
  subclassLabel: "Sacred Oath",
  asiLevels: [4, 8, 12, 16, 19],
  maxEncodedLevel: 10,
  spellcasting: {
    ability: "charisma",
    kind: "half",
    style: "prepared",
  },
  features: {
    1: [
      {
        id: "divine_sense",
        name: "Divine Sense",
        summary:
          "As an action, until the end of your next turn you know the location and type of any celestial, fiend or undead within 60 feet that isn't behind total cover, and sense consecrated or desecrated places. You can use it 1 + your Charisma modifier times per long rest.",
        kind: "action",
        uses: { max: { ability: "charisma", min: 1, plus: 1 }, recharge: "long" },
      },
      {
        id: "lay_on_hands",
        name: "Lay on Hands",
        summary:
          "You have a healing pool of five times your paladin level in hit points, refilled on a long rest. As an action, touch a creature to restore any number of hit points from the pool, or spend 5 points to cure one disease or neutralize one poison; it has no effect on undead or constructs.",
        kind: "resource",
        uses: { max: "classLevelX5", recharge: "long" },
      },
    ],
    2: [
      {
        id: "fighting_style",
        name: "Fighting Style",
        summary:
          "Choose one fighting style: Defense (+1 AC while wearing armor), Dueling (+2 damage with a one-handed melee weapon and no other weapon), Great Weapon Fighting (reroll 1s and 2s on two-handed melee damage dice) or Protection (reaction to impose disadvantage on an attack against an adjacent ally, needs a shield).",
        kind: "passive",
      },
      {
        id: "spellcasting",
        name: "Spellcasting",
        summary:
          "You cast paladin spells using Charisma (spell save DC = 8 + proficiency bonus + Charisma modifier) with a holy symbol as your focus. After a long rest you prepare Charisma modifier + half your paladin level (rounded down) spells (minimum 1) from the paladin list.",
        kind: "passive",
      },
      {
        id: "divine_smite",
        name: "Divine Smite",
        summary:
          "When you hit a creature with a melee weapon attack, you can expend a spell slot to deal extra radiant damage: 2d8 for a 1st-level slot plus 1d8 per slot level above 1st (maximum 5d8), and 1d8 more against an undead or fiend.",
        kind: "passive",
      },
    ],
    3: [
      {
        id: "divine_health",
        name: "Divine Health",
        summary: "The divine magic flowing through you makes you immune to disease.",
        kind: "passive",
      },
      {
        id: "channel_divinity",
        name: "Channel Divinity",
        summary:
          "Your oath lets you channel divine energy to fuel one of your oath's Channel Divinity options. You regain the use when you finish a short or long rest.",
        kind: "resource",
        uses: { max: { byLevel: { 3: 1 } }, recharge: "short" },
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
    6: [
      {
        id: "aura_of_protection",
        name: "Aura of Protection",
        summary:
          "While you are conscious, you and friendly creatures within 10 feet of you add your Charisma modifier (minimum +1) to saving throws.",
        kind: "passive",
      },
    ],
    10: [
      {
        id: "aura_of_courage",
        name: "Aura of Courage",
        summary: "While you are conscious, you and friendly creatures within 10 feet of you can't be frightened.",
        kind: "passive",
      },
    ],
  },
  subclass: {
    id: "oath_of_devotion",
    name: "Oath of Devotion",
    pitch: "You swear to honesty, courage and mercy, the knight in shining armor.",
    features: {
      3: [
        {
          id: "oath_spells",
          name: "Oath Spells",
          summary: "You always have your Oath of Devotion spells prepared, and they don't count against your prepared spells.",
          kind: "passive",
          scaling: {
            3: "protection from evil and good, sanctuary",
            5: "+ lesser restoration, zone of truth",
            9: "+ beacon of hope, dispel magic",
          },
        },
        {
          id: "sacred_weapon",
          name: "Channel Divinity: Sacred Weapon",
          summary:
            "As an action, spend your Channel Divinity to imbue a weapon you hold for 1 minute: add your Charisma modifier (minimum +1) to attack rolls with it, it counts as magical, and it sheds bright light in a 20-foot radius and dim light 20 feet beyond.",
          kind: "action",
        },
        {
          id: "turn_the_unholy",
          name: "Channel Divinity: Turn the Unholy",
          summary:
            "As an action, spend your Channel Divinity: each fiend or undead within 30 feet that can see or hear you makes a Wisdom saving throw, and on a failure is turned for 1 minute or until it takes damage.",
          kind: "action",
        },
      ],
      7: [
        {
          id: "aura_of_devotion",
          name: "Aura of Devotion",
          summary: "While you are conscious, you and friendly creatures within 10 feet of you can't be charmed.",
          kind: "passive",
        },
      ],
    },
  },
};
