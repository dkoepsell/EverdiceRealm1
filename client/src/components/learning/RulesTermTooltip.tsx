import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TermDefinition {
  title: string;
  description: string;
  tip?: string;
}

export const RULES_GLOSSARY: Record<string, TermDefinition> = {
  // Core dice & rolls
  "d20": {
    title: "d20 (20-sided die)",
    description: "The most important die in D&D. Roll it for attacks, ability checks, and saving throws. Add your relevant modifier to the result.",
    tip: "Natural 20 = Critical Hit on attacks. Natural 1 = Automatic miss.",
  },
  "ability check": {
    title: "Ability Check",
    description: "Roll a d20 and add the relevant ability modifier to see if you succeed at a task. The DM sets a Difficulty Class (DC) you must meet or beat.",
    tip: "Example: Climbing a wall = Strength check. Noticing a hidden door = Perception (Wisdom) check.",
  },
  "saving throw": {
    title: "Saving Throw",
    description: "A reactive d20 roll to resist a harmful effect — a spell, trap, or danger. Add the relevant ability modifier. If you're proficient in that save, add your proficiency bonus too.",
    tip: "Example: A fireball gives you a DEX save. Pass = half damage. Fail = full damage.",
  },
  "proficiency bonus": {
    title: "Proficiency Bonus",
    description: "A bonus added to rolls for things your character is trained in — certain skills, weapons, tools, and saving throws. It increases as you level up (+2 at level 1, up to +6 at level 17).",
  },
  "difficulty class": {
    title: "Difficulty Class (DC)",
    description: "The target number you must meet or beat on a d20 roll to succeed. Set by the DM or by a spell. DC 10 = Easy, DC 15 = Medium, DC 20 = Hard, DC 25 = Very Hard.",
  },
  "dc": {
    title: "Difficulty Class (DC)",
    description: "The target number you must meet or beat on a d20 roll to succeed. DC 10 = Easy, DC 15 = Medium, DC 20 = Hard, DC 25 = Very Hard.",
  },
  // Advantage / Disadvantage
  "advantage": {
    title: "Advantage",
    description: "Roll two d20s and take the higher result. You gain advantage when circumstances favor you — high ground, a helpful ally, or a spell effect.",
    tip: "Advantage and disadvantage cancel each other out. Multiple sources of each don't stack.",
  },
  "disadvantage": {
    title: "Disadvantage",
    description: "Roll two d20s and take the lower result. You suffer disadvantage when circumstances work against you — attacking while prone, being blinded, or under certain spells.",
    tip: "Advantage and disadvantage cancel each other out.",
  },
  // Action economy
  "action": {
    title: "Action",
    description: "Your main activity on your turn. Most commonly used to attack, cast a spell, or use an item. You get one action per turn.",
  },
  "bonus action": {
    title: "Bonus Action",
    description: "An optional extra action available to you only if a spell, class feature, or rule specifically grants it. Some classes (Rogue, Ranger) get bonus actions frequently. You still need a regular action too.",
    tip: "You can only take a bonus action if something grants it — you can't just choose to act faster.",
  },
  "reaction": {
    title: "Reaction",
    description: "An instant response to a trigger, even on someone else's turn. You get one reaction per round, which resets at the start of your next turn.",
    tip: "Common reactions: Opportunity Attack (when an enemy leaves your reach), Shield spell, Counterspell.",
  },
  "opportunity attack": {
    title: "Opportunity Attack",
    description: "A free melee attack (using your reaction) against a creature that moves out of your reach without Disengaging. This is why escaping melee is risky.",
  },
  "disengage": {
    title: "Disengage",
    description: "Use your action to move away from enemies without triggering opportunity attacks. Useful for escaping melee safely.",
  },
  "dash": {
    title: "Dash",
    description: "Use your action (or bonus action for some classes) to double your movement speed this turn.",
  },
  "dodge": {
    title: "Dodge",
    description: "Use your action to focus on avoiding attacks. Until your next turn, any attack roll against you has disadvantage (if you can see the attacker), and you have advantage on Dexterity saving throws.",
  },
  "help": {
    title: "Help Action",
    description: "Use your action to assist an ally. The next ability check or attack roll they make before your next turn has advantage.",
  },
  // Conditions
  "blinded": {
    title: "Blinded",
    description: "You can't see. Attack rolls against you have advantage; your attack rolls have disadvantage. You automatically fail ability checks that require sight.",
  },
  "charmed": {
    title: "Charmed",
    description: "You can't attack the creature that charmed you, and that creature has advantage on social ability checks against you.",
  },
  "frightened": {
    title: "Frightened",
    description: "You have disadvantage on ability checks and attack rolls while the source of your fear is within line of sight. You can't willingly move closer to it.",
  },
  "grappled": {
    title: "Grappled",
    description: "Your speed becomes 0. The grapple ends if the grappler is incapacitated or if you escape (Strength or Dexterity check vs. the grappler's Athletics).",
  },
  "incapacitated": {
    title: "Incapacitated",
    description: "You can't take actions or reactions. Many worse conditions (Paralyzed, Stunned, Unconscious) also include being incapacitated.",
  },
  "invisible": {
    title: "Invisible",
    description: "You can't be seen without magic or special senses. Attacks against you have disadvantage; your attacks have advantage. You're still detectable by noise, footprints, etc.",
  },
  "paralyzed": {
    title: "Paralyzed",
    description: "You're incapacitated, can't move or speak, automatically fail STR and DEX saves, and any attack that hits you is a critical hit if the attacker is within 5 feet.",
    tip: "One of the most debilitating conditions — spells like Hold Person cause this.",
  },
  "petrified": {
    title: "Petrified",
    description: "You're turned to stone. You're incapacitated, can't move or speak, are unaware of surroundings, and have resistance to all damage. Attacks against you have advantage.",
  },
  "poisoned": {
    title: "Poisoned",
    description: "You have disadvantage on attack rolls and ability checks.",
  },
  "prone": {
    title: "Prone",
    description: "You're lying on the ground. Your only movement option is crawling (costs double movement). Attacks against you have advantage from adjacent attackers; ranged attacks have disadvantage. Stand up by spending half your movement.",
  },
  "restrained": {
    title: "Restrained",
    description: "Your speed becomes 0. Attack rolls against you have advantage; your attack rolls have disadvantage. You have disadvantage on Dexterity saving throws.",
  },
  "stunned": {
    title: "Stunned",
    description: "You're incapacitated, can't move, speak only falteringly, automatically fail STR and DEX saves, and attacks against you have advantage.",
  },
  "unconscious": {
    title: "Unconscious",
    description: "You're incapacitated, can't move or speak, are unaware of surroundings, drop what you're holding, fall prone, automatically fail STR and DEX saves, and any hit within 5 feet is a critical hit.",
  },
  "exhaustion": {
    title: "Exhaustion",
    description: "A stacking condition with 6 levels. Each level adds penalties: Level 1 = disadvantage on ability checks; Level 2 = halved speed; Level 3 = disadvantage on attacks and saves; Level 6 = death.",
  },
  // Spellcasting
  "concentration": {
    title: "Concentration",
    description: "Some spells require you to maintain focus to keep their effect active. You can only concentrate on one spell at a time. Taking damage forces a Constitution saving throw (DC = 10 or half damage, whichever is higher) or you lose concentration.",
    tip: "Losing concentration immediately ends the spell. Shield yourself or avoid taking hits while concentrating.",
  },
  "spell slot": {
    title: "Spell Slot",
    description: "The resource you spend to cast a spell of that level or higher. You recover all spell slots on a long rest (Warlocks recover on a short rest).",
    tip: "You can cast a lower-level spell in a higher-level slot to boost its power.",
  },
  "spell slots": {
    title: "Spell Slots",
    description: "Resources you spend to cast spells. Each slot level corresponds to a spell level. You recover all slots on a long rest.",
  },
  "cantrip": {
    title: "Cantrip (Level 0 Spell)",
    description: "A spell you can cast unlimited times — no spell slot required. Cantrips are the bread-and-butter of spellcasters for basic combat. They grow stronger as you level up.",
    tip: "Fire Bolt, Eldritch Blast, Sacred Flame, Toll the Dead — all cantrips.",
  },
  "spell save dc": {
    title: "Spell Save DC",
    description: "The difficulty number enemies must beat on their saving throw to resist your spell. Formula: 8 + proficiency bonus + spellcasting ability modifier.",
  },
  "ritual": {
    title: "Ritual Casting",
    description: "Some spells can be cast as rituals — taking 10 extra minutes but using no spell slot. Only Wizards (any spell in their spellbook marked ritual), Clerics, Druids, and Bards can do this.",
  },
  "verbal components": {
    title: "Verbal Components (V)",
    description: "The spell requires you to speak specific words. You can't cast spells with verbal components while silenced.",
  },
  "somatic components": {
    title: "Somatic Components (S)",
    description: "The spell requires specific hand gestures. You need a free hand (or a spellcasting focus/material component in that hand).",
  },
  "material components": {
    title: "Material Components (M)",
    description: "The spell requires a specific physical item. Usually, a spellcasting focus (arcane focus, holy symbol, druidic focus) substitutes for non-consumed materials.",
  },
  // Attacks
  "attack roll": {
    title: "Attack Roll",
    description: "Roll a d20 and add your attack bonus (proficiency bonus + ability modifier) to see if you hit. The total must meet or beat the target's Armor Class (AC).",
  },
  "critical hit": {
    title: "Critical Hit",
    description: "A natural 20 on an attack roll. You hit automatically and roll all damage dice twice (then add modifiers once).",
    tip: "Critical hits bypass AC — even the most armored enemy gets hit on a natural 20.",
  },
  "armor class": {
    title: "Armor Class (AC)",
    description: "How hard you are to hit. Attackers must roll this number or higher (attack roll = d20 + modifier) to damage you.",
  },
  "ac": {
    title: "Armor Class (AC)",
    description: "How hard you are to hit. Attackers must roll this number or higher to damage you. Armor, shields, and some spells improve your AC.",
  },
  // Resting
  "short rest": {
    title: "Short Rest",
    description: "A 1-hour break. You can spend Hit Dice (roll and add CON modifier) to regain HP. Some class features also recharge. Warlocks regain spell slots.",
  },
  "long rest": {
    title: "Long Rest",
    description: "An 8-hour rest. You fully recover HP and regain all spell slots, hit dice (up to half your level), and most class features.",
    tip: "Most adventuring days plan around one long rest. Avoid multiple per day — it's meant to represent a full night's sleep.",
  },
  "hit dice": {
    title: "Hit Dice",
    description: "Dice you roll during short rests to heal yourself. Add your CON modifier to each die rolled. Your class determines the die size (d6 to d12).",
  },
  // Other
  "inspiration": {
    title: "Inspiration",
    description: "A reward from the DM for great roleplay. Spend it to gain advantage on any d20 roll. You can only hold one at a time, but can give yours to another player.",
  },
  "passive perception": {
    title: "Passive Perception",
    description: "10 + your Perception bonus. Used when you're not actively searching — the DM secretly compares this to hidden enemies' Stealth rolls to see if you notice them.",
  },
  "initiative": {
    title: "Initiative",
    description: "Determines turn order in combat. Roll a d20 and add your Dexterity modifier at the start of combat. Higher result = earlier turn.",
  },
  "death saving throw": {
    title: "Death Saving Throw",
    description: "When you reach 0 HP, you fall unconscious. Each turn, roll a d20. 10+ = success; 1-9 = failure. 3 successes = stable. 3 failures = death. A natural 20 = regain 1 HP. A natural 1 = counts as 2 failures.",
  },
  "resistance": {
    title: "Damage Resistance",
    description: "You take half damage from that damage type (rounded down). Dwarves resist poison; some spells grant resistance temporarily.",
  },
  "immunity": {
    title: "Damage Immunity",
    description: "You take no damage from that damage type at all.",
  },
  "vulnerability": {
    title: "Damage Vulnerability",
    description: "You take double damage from that damage type.",
  },
};

// Normalize a term for lookup (lowercase, trim)
function normalizeTerm(term: string): string {
  return term.toLowerCase().trim();
}

// Build a sorted list of terms for regex matching (longer terms first to avoid partial matches)
const GLOSSARY_TERMS = Object.keys(RULES_GLOSSARY).sort((a, b) => b.length - a.length);

// Regex that matches any glossary term (case-insensitive, word-boundary aware)
const TERM_REGEX = new RegExp(
  `\\b(${GLOSSARY_TERMS.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'gi'
);

interface RulesTermTooltipProps {
  term: string;
}

/**
 * Wraps a single known rules term with a hover tooltip explaining it.
 */
export function RulesTermTooltip({ term }: RulesTermTooltipProps) {
  const def = RULES_GLOSSARY[normalizeTerm(term)];
  if (!def) return <>{term}</>;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={250}>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-dashed border-amber-500/60 hover:border-amber-400 text-amber-100 hover:text-amber-50 transition-colors">
            {term}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs p-0 overflow-hidden bg-slate-900 border-amber-500/30 z-50"
        >
          <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/10 px-3 py-2 border-b border-amber-500/20">
            <h4 className="font-semibold text-sm text-amber-100">{def.title}</h4>
          </div>
          <div className="p-3 space-y-2">
            <p className="text-sm text-slate-300">{def.description}</p>
            {def.tip && (
              <p className="text-xs text-amber-400">
                <strong>Tip:</strong> {def.tip}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Parses a string and returns an array of React nodes where known rules terms
 * are wrapped in RulesTermTooltip. Safe to use in any text-rendering context.
 *
 * Usage: <p>{annotateRulesTerms("You must make a saving throw.")}</p>
 */
export function annotateRulesTerms(text: string): React.ReactNode[] {
  if (!text) return [];

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex state
  TERM_REGEX.lastIndex = 0;

  while ((match = TERM_REGEX.exec(text)) !== null) {
    const [matched] = match;
    const matchStart = match.index;

    // Push text before this match
    if (matchStart > lastIndex) {
      parts.push(text.slice(lastIndex, matchStart));
    }

    // Push the tooltip-wrapped term
    parts.push(
      <RulesTermTooltip key={`${matchStart}-${matched}`} term={matched} />
    );

    lastIndex = matchStart + matched.length;
  }

  // Push any remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}
