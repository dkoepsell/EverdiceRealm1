import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, Sparkles } from "lucide-react";

export type HintId =
  | 'narrative_choices'
  | 'free_text_action'
  | 'character_stats'
  | 'hp_bar'
  | 'inventory_usage'
  | 'consumables'
  | 'companion_benefits'
  | 'companion_management'
  | 'scene_types'
  | 'dice_rolling'
  | 'rest_mechanics'
  | 'quest_tracking'
  | 'spell_slots'
  | 'death_saves'
  | 'dm_controls'
  | 'initiative_tracker';

interface HintContent {
  id: HintId;
  title: string;
  description: string;
  tip?: string;
}

const HINT_CONTENT: Record<HintId, HintContent> = {
  narrative_choices: {
    id: 'narrative_choices',
    title: "Making Choices",
    description: "Click any of the options below to take that action. Each choice leads to a different outcome in your adventure!",
    tip: "There's no wrong choice - pick what feels right for your character."
  },
  free_text_action: {
    id: 'free_text_action',
    title: "Custom Actions",
    description: "Don't see an option you like? Type your own action in the text box! You can do anything your character might attempt.",
    tip: "Try actions like 'I search the room for hidden doors' or 'I try to befriend the creature.'"
  },
  character_stats: {
    id: 'character_stats',
    title: "Your Character Stats",
    description: "These numbers represent your character's capabilities. Higher numbers mean better chances of success when using that ability.",
    tip: "STR = physical power, DEX = agility, CON = health, INT = knowledge, WIS = perception, CHA = persuasion."
  },
  hp_bar: {
    id: 'hp_bar',
    title: "Hit Points (HP)",
    description: "This is your health! When it reaches 0, you're in danger. Rest or use healing items to recover HP.",
    tip: "Keep an eye on your HP during combat - retreat or heal if it gets low!"
  },
  inventory_usage: {
    id: 'inventory_usage',
    title: "Your Inventory",
    description: "These are items you're carrying. Click on an item to see details or use it. Equipment provides bonuses when worn.",
    tip: "Some items are one-time use (consumables), others are permanent equipment."
  },
  consumables: {
    id: 'consumables',
    title: "Using Consumables",
    description: "Potions and other consumables can be used during your adventure. Click 'Use' to activate their effect immediately.",
    tip: "Healing potions restore HP, antidotes cure poison, and more. Stock up before dangerous adventures!"
  },
  companion_benefits: {
    id: 'companion_benefits',
    title: "NPC Companions",
    description: "Companions are allies who travel with you! They can help in combat, provide skills you lack, and add to the story.",
    tip: "Each companion has unique abilities - choose ones that complement your character."
  },
  companion_management: {
    id: 'companion_management',
    title: "Managing Companions",
    description: "Click on a companion to see their stats, give them items, or dismiss them from your party.",
    tip: "Companions have their own HP and can be knocked out - protect them in combat!"
  },
  scene_types: {
    id: 'scene_types',
    title: "Scene Types",
    description: "The scene indicator shows what kind of encounter this is: Exploration, Social, Combat, Puzzle, or Discovery.",
    tip: "Different scene types offer different opportunities - combat isn't always the answer!"
  },
  dice_rolling: {
    id: 'dice_rolling',
    title: "Dice Rolls",
    description: "When you attempt something with uncertain outcome, dice determine success. Higher rolls are better!",
    tip: "A 'd20' means a 20-sided die. 'd20+3' means roll and add 3 to the result."
  },
  rest_mechanics: {
    id: 'rest_mechanics',
    title: "Resting",
    description: "Short rests restore some HP and abilities. Long rests fully heal you but advance time and may trigger events.",
    tip: "Find safe locations before resting - enemies might interrupt your rest!"
  },
  quest_tracking: {
    id: 'quest_tracking',
    title: "Your Quests",
    description: "Quests are your current objectives. Main quests advance the story, side quests offer bonus rewards.",
    tip: "You can have multiple quests active - check your objectives when you're unsure what to do next."
  },
  spell_slots: {
    id: 'spell_slots',
    title: "Spell Slots",
    description: "Spellcasters use spell slots to cast magic. More powerful spells need higher level slots. Slots recharge on rest.",
    tip: "Don't use all your high-level slots at once - save some for emergencies!"
  },
  death_saves: {
    id: 'death_saves',
    title: "Death Saving Throws",
    description: "When HP hits 0, you're unconscious and must roll death saves. 3 successes = stabilized, 3 failures = character death.",
    tip: "Allies can stabilize you with healing or a Medicine check!"
  },
  dm_controls: {
    id: 'dm_controls',
    title: "DM Controls",
    description: "These controls let you manage the game session, adjust difficulty, and guide the narrative.",
    tip: "The Trust Level slider adjusts how much creative control the system has vs. you."
  },
  initiative_tracker: {
    id: 'initiative_tracker',
    title: "Initiative & Turn Order",
    description: "During combat, initiative determines who acts first. Higher initiative = earlier turn in the round.",
    tip: "Plan your actions based on when enemies act - sometimes it's better to wait!"
  }
};

const STORAGE_KEY = 'everdice_seen_hints';

function getSeenHints(): Set<HintId> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function markHintSeen(id: HintId): void {
  const seen = getSeenHints();
  seen.add(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(seen)));
}

export function resetSeenHints(): void {
  localStorage.removeItem(STORAGE_KEY);
}

interface ContextualHintProps {
  hintId: HintId;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  showOnce?: boolean;
  forceShow?: boolean;
  delay?: number;
  onDismiss?: () => void;
}

export function ContextualHint({
  hintId,
  children,
  position = 'bottom',
  showOnce = true,
  forceShow = false,
  delay = 500,
  onDismiss
}: ContextualHintProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  
  const hint = HINT_CONTENT[hintId];
  
  useEffect(() => {
    if (isDismissed) return;
    
    const seenHints = getSeenHints();
    const shouldShow = forceShow || (showOnce && !seenHints.has(hintId));
    
    if (shouldShow) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [hintId, showOnce, forceShow, delay, isDismissed]);
  
  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setIsDismissed(true);
    if (showOnce) {
      markHintSeen(hintId);
    }
    onDismiss?.();
  }, [hintId, showOnce, onDismiss]);

  const positionClasses = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2'
  };
  
  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-amber-500/50',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-amber-500/50',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-amber-500/50',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-amber-500/50'
  };

  return (
    <div className="relative inline-block">
      {children}
      <AnimatePresence>
        {isVisible && hint && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className={`absolute z-50 ${positionClasses[position]}`}
            style={{ width: '280px' }}
          >
            <div className="relative">
              <div className={`absolute w-0 h-0 border-8 ${arrowClasses[position]}`} />
              <div className="bg-gradient-to-br from-amber-950/95 to-orange-950/95 border border-amber-500/30 rounded-lg shadow-xl backdrop-blur-sm p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-amber-500/20">
                      <Sparkles className="h-4 w-4 text-amber-400" />
                    </div>
                    <h4 className="font-semibold text-sm text-amber-100">{hint.title}</h4>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-amber-400/60 hover:text-amber-300 hover:bg-amber-500/10"
                    onClick={handleDismiss}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-sm text-amber-100/80 leading-relaxed mb-2">
                  {hint.description}
                </p>
                {hint.tip && (
                  <div className="bg-amber-500/10 rounded p-2 border border-amber-500/20">
                    <p className="text-xs text-amber-300">
                      <strong>Tip:</strong> {hint.tip}
                    </p>
                  </div>
                )}
                <div className="flex justify-end mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                    onClick={handleDismiss}
                  >
                    Got it! <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function useContextualHints() {
  const [seenHints, setSeenHints] = useState<Set<HintId>>(getSeenHints);
  
  const hasSeenHint = useCallback((id: HintId) => seenHints.has(id), [seenHints]);
  
  const markSeen = useCallback((id: HintId) => {
    markHintSeen(id);
    setSeenHints(prev => new Set(prev).add(id));
  }, []);
  
  const resetAll = useCallback(() => {
    resetSeenHints();
    setSeenHints(new Set());
  }, []);
  
  return { hasSeenHint, markSeen, resetAll, seenHints };
}
