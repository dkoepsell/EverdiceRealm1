import { useState } from "react";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type StatType =
  | 'strength'
  | 'dexterity'
  | 'constitution'
  | 'intelligence'
  | 'wisdom'
  | 'charisma'
  | 'hp'
  | 'max_hp'
  | 'ac'
  | 'level'
  | 'xp'
  | 'proficiency'
  | 'speed'
  | 'initiative'
  | 'spell_slots'
  | 'hit_dice'
  | 'gold'
  | 'inspiration';

interface StatExplanation {
  name: string;
  shortName: string;
  description: string;
  examples: string[];
}

const STAT_EXPLANATIONS: Record<StatType, StatExplanation> = {
  strength: {
    name: "Strength",
    shortName: "STR",
    description: "Physical power for melee attacks, carrying capacity, and feats of might.",
    examples: ["Breaking down doors", "Melee weapon damage", "Grappling enemies", "Climbing cliffs"]
  },
  dexterity: {
    name: "Dexterity",
    shortName: "DEX",
    description: "Agility and reflexes for dodging, stealth, and ranged attacks.",
    examples: ["Dodging traps", "Picking locks", "Ranged weapon attacks", "Moving quietly"]
  },
  constitution: {
    name: "Constitution",
    shortName: "CON",
    description: "Health and stamina. Determines your hit points and resistance to fatigue.",
    examples: ["Resisting poison", "Holding your breath", "Marching long distances", "Surviving harsh conditions"]
  },
  intelligence: {
    name: "Intelligence",
    shortName: "INT",
    description: "Memory and reasoning. Used for knowledge checks and wizard spellcasting.",
    examples: ["Recalling lore", "Investigating clues", "Wizard spells", "Understanding languages"]
  },
  wisdom: {
    name: "Wisdom",
    shortName: "WIS",
    description: "Perception and insight. Used for awareness and cleric/druid spellcasting.",
    examples: ["Spotting hidden creatures", "Reading people's intentions", "Cleric/Druid spells", "Tracking"]
  },
  charisma: {
    name: "Charisma",
    shortName: "CHA",
    description: "Force of personality. Used for social skills and bard/sorcerer/warlock spells.",
    examples: ["Persuading NPCs", "Intimidating foes", "Deception", "Bard/Sorcerer/Warlock spells"]
  },
  hp: {
    name: "Hit Points",
    shortName: "HP",
    description: "Your current health. When it reaches 0, you fall unconscious and must make death saves.",
    examples: ["Reduced by taking damage", "Restored by healing spells", "Restored by potions", "Recovered during rest"]
  },
  max_hp: {
    name: "Maximum Hit Points",
    shortName: "Max HP",
    description: "Your total health capacity. Increases when you level up based on your class and Constitution.",
    examples: ["Increases each level", "Constitution modifier adds to it", "Some effects can temporarily reduce it"]
  },
  ac: {
    name: "Armor Class",
    shortName: "AC",
    description: "How hard you are to hit. Attackers must roll this number or higher to damage you.",
    examples: ["Improved by wearing armor", "Shields add +2", "Dexterity bonus applies (light armor)", "Some spells boost AC"]
  },
  level: {
    name: "Level",
    shortName: "LVL",
    description: "Your experience tier. Higher levels mean more abilities, spells, and hit points.",
    examples: ["Gain new class features", "Learn more powerful spells", "Increase proficiency bonus", "More hit points"]
  },
  xp: {
    name: "Experience Points",
    shortName: "XP",
    description: "Progress toward your next level. Earned by completing encounters and story milestones.",
    examples: ["Defeating enemies", "Completing quests", "Roleplay achievements", "Discovery bonuses"]
  },
  proficiency: {
    name: "Proficiency Bonus",
    shortName: "Prof",
    description: "Added to rolls for things you're trained in. Increases as you level up.",
    examples: ["Skill checks you're proficient in", "Attack rolls with proficient weapons", "Saving throws", "Spell attack rolls"]
  },
  speed: {
    name: "Speed",
    shortName: "SPD",
    description: "How far you can move in one turn, measured in feet. Standard is 30 feet.",
    examples: ["Movement in combat", "Chasing or fleeing", "Some races are faster", "Some effects slow you"]
  },
  initiative: {
    name: "Initiative",
    shortName: "INIT",
    description: "Determines turn order in combat. Higher initiative means you act earlier.",
    examples: ["d20 + Dexterity modifier", "Some features add bonuses", "Acting first gives advantage", "Surprised creatures have 0"]
  },
  spell_slots: {
    name: "Spell Slots",
    shortName: "Slots",
    description: "Resources used to cast spells. Higher level slots power stronger spells. Restored on rest.",
    examples: ["Each spell costs one slot", "Higher level = stronger spell", "Long rest restores all", "Some classes have unique recovery"]
  },
  hit_dice: {
    name: "Hit Dice",
    shortName: "HD",
    description: "Used during short rests to heal. Roll and add Constitution modifier to recover HP.",
    examples: ["d6 to d12 depending on class", "Spend during short rest", "Recover half on long rest", "Equal to your level"]
  },
  gold: {
    name: "Gold Pieces",
    shortName: "GP",
    description: "Your currency. Used to buy equipment, supplies, and services.",
    examples: ["Buy weapons and armor", "Purchase potions", "Pay for lodging", "Hire services"]
  },
  inspiration: {
    name: "Inspiration",
    shortName: "INSP",
    description: "A special reward for great roleplay. Spend it to gain advantage on any d20 roll.",
    examples: ["Reroll any d20", "Earned through good roleplay", "Can only have 0 or 1", "Give to another player"]
  }
};

interface HelpTooltipProps {
  statType: StatType;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
}

export function HelpTooltip({ statType, size = 'sm', className, showLabel = false }: HelpTooltipProps) {
  const stat = STAT_EXPLANATIONS[statType];
  
  const iconSize = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };
  
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 text-muted-foreground hover:text-amber-500 transition-colors cursor-help",
              className
            )}
          >
            <HelpCircle className={iconSize[size]} />
            {showLabel && <span className="text-xs">{stat.shortName}</span>}
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs p-0 overflow-hidden bg-slate-900 border-amber-500/30"
        >
          <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/10 px-3 py-2 border-b border-amber-500/20">
            <h4 className="font-semibold text-sm text-amber-100">
              {stat.name} <span className="text-amber-400/60">({stat.shortName})</span>
            </h4>
          </div>
          <div className="p-3 space-y-2">
            <p className="text-sm text-slate-300">{stat.description}</p>
            <div className="pt-1">
              <p className="text-xs font-medium text-amber-400 mb-1">Used for:</p>
              <ul className="text-xs text-slate-400 space-y-0.5">
                {stat.examples.map((example, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-amber-500/50" />
                    {example}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface InlineHelpProps {
  children: React.ReactNode;
  title: string;
  description: string;
  tip?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export function InlineHelp({ children, title, description, tip, side = 'top' }: InlineHelpProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-dashed border-muted-foreground/50 hover:border-amber-500 transition-colors">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="max-w-xs p-3 bg-slate-900 border-amber-500/30"
        >
          <h4 className="font-semibold text-sm text-amber-100 mb-1">{title}</h4>
          <p className="text-sm text-slate-300">{description}</p>
          {tip && (
            <p className="text-xs text-amber-400 mt-2">
              <strong>Tip:</strong> {tip}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
