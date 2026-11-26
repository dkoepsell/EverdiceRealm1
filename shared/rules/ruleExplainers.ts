/**
 * "The rule underneath" (engagement spec, guiding priority 3): a short,
 * plain-language explanation shown the first times a 5e rule fires for a
 * player. Uses the real terms so players can sit at a real table afterward.
 * Ids are what server code reports in `rulesFired` and what user_rules_seen
 * counts. `detail` may use {placeholders} filled from the firing context.
 */
export interface RuleExplainer {
  id: string;
  name: string;
  /** One-paragraph explanation. */
  body: string;
}

export const RULE_EXPLAINERS: Record<string, RuleExplainer> = {
  ability_check: {
    id: "ability_check",
    name: "Ability checks and DCs",
    body: "When the outcome is uncertain and failure would matter, the DM calls for an ability check: roll a d20, add the ability modifier, and add your proficiency bonus if you're proficient in the skill. Meet or beat the Difficulty Class (DC) to succeed. Typical DCs: 5 very easy, 10 easy, 15 medium, 20 hard, 25 very hard.",
  },
  passive_check: {
    id: "passive_check",
    name: "Passive checks",
    body: "When you aren't actively trying, the DM compares a passive score to the DC instead of asking for a roll: 10 + your ability modifier + your proficiency bonus if proficient. If the passive score meets the DC, you simply notice. Real tables use this to keep play moving.",
  },
  advantage: {
    id: "advantage",
    name: "Advantage and disadvantage",
    body: "With advantage you roll two d20s and keep the higher; with disadvantage you keep the lower. Several sources of advantage still only give you two dice, and if you have both advantage and disadvantage they cancel out and you roll one d20.",
  },
  inspiration: {
    id: "inspiration",
    name: "Inspiration",
    body: "The DM awards Inspiration when you play your character's personality: acting on an ideal, a bond, or even a flaw. You either have it or you don't. Spend it to gain advantage on one attack roll, saving throw, or ability check.",
  },
  help: {
    id: "help",
    name: "The Help action",
    body: "A creature can use its action to Help you with a task it could reasonably assist with. The next ability check you make for that task has advantage.",
  },
  proficiency: {
    id: "proficiency",
    name: "Proficiency bonus",
    body: "Your proficiency bonus (+2 at levels 1–4, +3 at 5–8, rising every four levels) is added to checks with skills you're proficient in, to attacks with weapons you're proficient with, and to saving throws your class is proficient in.",
  },
  expertise: {
    id: "expertise",
    name: "Expertise",
    body: "Rogues and Bards can choose skills to gain Expertise in. For those skills you add double your proficiency bonus.",
  },
  failure_cost: {
    id: "failure_cost",
    name: "Failing forward",
    body: "A failed check doesn't mean nothing happens. Good DMs let you make progress at a cost (you're hurt, you lose time, someone notices) or introduce a new complication. The story always moves.",
  },
  level_up: {
    id: "level_up",
    name: "Leveling up",
    body: "Each level you gain one Hit Die of hit points (roll it or take the fixed average) plus your Constitution modifier, and often a class feature. At certain levels you gain an Ability Score Improvement: +2 to one score or +1 to two. Many tables level by milestones, when the story reaches a turning point.",
  },
  short_rest: {
    id: "short_rest",
    name: "Short rests and Hit Dice",
    body: "A short rest is at least an hour of downtime. You can spend Hit Dice: roll each one and add your Constitution modifier to regain that many hit points. You regain half your total Hit Dice on a long rest, so spending them now leaves fewer for tomorrow.",
  },
  long_rest: {
    id: "long_rest",
    name: "Long rests",
    body: "A long rest is at least 8 hours. You regain all lost hit points, all spent spell slots, half your total Hit Dice (minimum one), and every class feature that recharges on a long rest.",
  },
  sneak_attack: {
    id: "sneak_attack",
    name: "Sneak Attack",
    body: "Once per turn, a Rogue deals extra damage when hitting with a finesse or ranged weapon if they have advantage on the attack, or if an ally is within 5 feet of the target and they don't have disadvantage.",
  },
  action_economy: {
    id: "action_economy",
    name: "Your turn in combat",
    body: "On your turn you can move up to your speed and take one action (Attack, Dash, Disengage, Dodge, Help, Hide, cast a spell...). Some features give you a bonus action. Once per round you can take a reaction, such as an opportunity attack, even on someone else's turn.",
  },
  opportunity_attack: {
    id: "opportunity_attack",
    name: "Opportunity attacks",
    body: "When a hostile creature you can see leaves your reach, you can use your reaction to make one melee attack against it. Taking the Disengage action prevents this.",
  },
  concentration: {
    id: "concentration",
    name: "Concentration",
    body: "Some spells last only while you concentrate. You can concentrate on one spell at a time. When you take damage, make a Constitution saving throw (DC 10 or half the damage, whichever is higher) or the spell ends.",
  },
  saving_throw: {
    id: "saving_throw",
    name: "Saving throws",
    body: "A saving throw is your attempt to resist something happening TO you: a trap's dart, a falling ceiling, poison, a spell. Roll a d20, add the ability modifier the save uses (Dexterity to dodge, Constitution to endure, Strength to hold on, Wisdom to resist the mind), and add your proficiency bonus if your class is proficient in that save. Every class is proficient in two. Meet the DC and you avoid the worst of it; many hazards still do half damage on a success.",
  },
  hazard: {
    id: "hazard",
    name: "Traps and hazards",
    body: "Not every danger is a monster. Traps and hazards usually give you a chance to notice them (your passive Perception or an Investigation check), then a saving throw if they go off. The DM sets the DC and damage by how dangerous the trap is: a setback, dangerous, or deadly for your level.",
  },
  background_feature: {
    id: "background_feature",
    name: "Background features",
    body: "Your background (Acolyte, Criminal, Sage, Soldier...) gives you a perk outside combat: a temple that shelters you, an underworld contact, knowing where to find the answer, soldiers who still salute you. When it applies it simply works, no roll needed. It's what makes your character's past useful.",
  },
  alignment: {
    id: "alignment",
    name: "Alignment",
    body: "Alignment is a shorthand for your character's moral outlook on two axes: lawful to chaotic (rules and tradition versus freedom) and good to evil (others first versus yourself first). It describes who you are; it never stops you doing anything. Characters change, and so can alignment.",
  },
  cover: {
    id: "cover",
    name: "Cover",
    body: "Walls, trees, wagons and other creatures can block attacks. Half cover (a low wall, a table) gives +2 to your AC and Dexterity saves; three-quarters cover (an arrow slit, a thick tree) gives +5. Getting into cover is part of your movement, so it doesn't cost your action.",
  },
  shove: {
    id: "shove",
    name: "Shoving",
    body: "Instead of one of your attacks, you can shove a creature no more than one size larger than you: make a Strength (Athletics) check contested by its Athletics or Acrobatics. Win, and you knock it prone or push it 5 feet, which is how you send an enemy into a fire, off a ledge, or into the water.",
  },
  use_object: {
    id: "use_object",
    name: "Use an Object",
    body: "Your action in combat doesn't have to be an attack. Cutting a chandelier's rope, tipping a brazier or kicking loose a pile of rocks is the Use an Object action. The DM sets a check to pull it off and how much damage it does, and the targets usually get a saving throw.",
  },
  death_saves: {
    id: "death_saves",
    name: "Death saving throws",
    body: "At 0 hit points you fall unconscious and make a death saving throw at the start of each of your turns: 10 or higher is a success, below 10 a failure. Three successes and you stabilize; three failures and you die. A natural 20 means you regain 1 hit point; a natural 1 counts as two failures.",
  },
  exhaustion: {
    id: "exhaustion",
    name: "Exhaustion",
    body: "Exhaustion comes in levels. At level 1 you have disadvantage on ability checks; worse levels add more penalties. A long rest with food and water removes one level.",
  },
};

export function getRuleExplainer(id: string): RuleExplainer | undefined {
  return RULE_EXPLAINERS[id];
}

/** Auto-expand "The rule underneath" for the first few times a rule fires. */
export const AUTO_EXPAND_UNTIL = 3;
