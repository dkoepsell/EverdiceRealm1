import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Lightbulb, 
  X, 
  ChevronRight,
  Dice6,
  MessageSquare,
  Swords,
  Users,
  BookOpen
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type LearningTipType = 'dice_roll' | 'choice' | 'combat' | 'social' | 'general' | 'pacing';

interface LearningTip {
  id: string;
  type: LearningTipType;
  title: string;
  content: string;
  mechanic: string;
  groupPlayNote?: string;
}

const LEARNING_TIPS: Record<LearningTipType, LearningTip[]> = {
  dice_roll: [
    {
      id: 'roll_basics',
      type: 'dice_roll',
      title: "You Just Made an Ability Check!",
      content: "In D&D, when the outcome is uncertain, you roll a d20 and add your modifier. Beat the DC (Difficulty Class) to succeed.",
      mechanic: "Ability Score + Modifier + d20 ≥ DC = Success",
      groupPlayNote: "In group play, the DM sets the DC and describes what happens."
    },
    {
      id: 'nat_20',
      type: 'dice_roll',
      title: "Critical Success!",
      content: "Rolling a natural 20 is always exciting! In combat, it means double damage dice. For ability checks, it's usually a spectacular success.",
      mechanic: "Natural 20 = Critical Hit in Combat",
      groupPlayNote: "Your table might cheer when someone rolls a nat 20!"
    },
    {
      id: 'modifiers',
      type: 'dice_roll',
      title: "Understanding Modifiers",
      content: "Your modifier comes from your ability scores. A Strength of 16 gives you +3. Higher abilities = better chances!",
      mechanic: "(Ability Score - 10) ÷ 2 = Modifier",
      groupPlayNote: "Different characters excel at different things based on their abilities."
    }
  ],
  choice: [
    {
      id: 'choices_matter',
      type: 'choice',
      title: "Your Choices Shape the Story",
      content: "D&D isn't about finding the 'right' answer. It's about deciding what YOUR character would do. There are always consequences!",
      mechanic: "Narrative Consequence System",
      groupPlayNote: "In a group, you'll discuss choices together before acting."
    },
    {
      id: 'roleplay',
      type: 'choice',
      title: "Roleplaying Your Character",
      content: "How would your character react? Consider their background, personality, and goals. Acting in character makes the game richer.",
      mechanic: "Character-Driven Decision Making",
      groupPlayNote: "Group play lets you bounce ideas off other players."
    }
  ],
  combat: [
    {
      id: 'combat_turn',
      type: 'combat',
      title: "Combat Turn Structure",
      content: "In combat, you get: 1 Action, 1 Bonus Action (if available), Movement (usually 30 feet), and 1 Reaction per round.",
      mechanic: "Action Economy: Action + Bonus + Move + Reaction",
      groupPlayNote: "In group combat, you coordinate with allies for tactical advantage."
    },
    {
      id: 'attack_roll',
      type: 'combat',
      title: "How Attack Rolls Work",
      content: "Roll d20 + your attack modifier. If you meet or beat the target's Armor Class (AC), you hit! Then roll damage.",
      mechanic: "d20 + Attack Mod ≥ AC = Hit",
      groupPlayNote: "Parties often focus fire on one enemy to reduce threats quickly."
    }
  ],
  social: [
    {
      id: 'persuasion',
      type: 'social',
      title: "Social Skills in D&D",
      content: "Persuasion, Deception, Intimidation - these skills let you influence NPCs. The DM decides what's possible, then you roll!",
      mechanic: "Charisma-based skills for social encounters",
      groupPlayNote: "In groups, the 'face' character often leads negotiations."
    }
  ],
  general: [
    {
      id: 'adventure_fun',
      type: 'general',
      title: "The Heart of D&D",
      content: "D&D is collaborative storytelling. There's no 'winning' - just great stories created together. Embrace the unexpected!",
      mechanic: "Collaborative Storytelling Game",
      groupPlayNote: "The magic happens when players build on each other's ideas."
    }
  ],
  pacing: [
    {
      id: 'story_crafting',
      type: 'pacing',
      title: "Your Story Is Being Crafted",
      content: "Just like a real DM takes a moment to describe a vivid scene, Everdice weaves your choices into a rich narrative. The brief pause means your actions truly matter!",
      mechanic: "AI Dungeon Master at Work",
      groupPlayNote: "In tabletop games, great DMs take a moment to craft memorable scenes too."
    },
    {
      id: 'choices_consequences',
      type: 'pacing',
      title: "Every Choice Has Weight",
      content: "Your decision is rippling through the world - affecting NPCs, quests, and the story itself. Great adventures take a moment to unfold.",
      mechanic: "Dynamic World Response",
    }
  ]
};

interface LearningTipProps {
  type: LearningTipType;
  show: boolean;
  onClose: () => void;
  onLearnMore?: () => void;
  tipId?: string; // Optional specific tip ID to show
}

export function LearningTip({ type, show, onClose, onLearnMore, tipId }: LearningTipProps) {
  const tips = LEARNING_TIPS[type] || LEARNING_TIPS.general;
  
  // If tipId is provided, find that specific tip; otherwise pick first one
  const tip = tipId 
    ? (tips.find(t => t.id === tipId) || tips[0])
    : tips[0];

  const getIcon = () => {
    switch (type) {
      case 'dice_roll': return <Dice6 className="h-5 w-5" />;
      case 'choice': return <MessageSquare className="h-5 w-5" />;
      case 'combat': return <Swords className="h-5 w-5" />;
      case 'social': return <Users className="h-5 w-5" />;
      case 'pacing': return <BookOpen className="h-5 w-5" />;
      default: return <Lightbulb className="h-5 w-5" />;
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-4 right-4 z-50 max-w-sm"
        >
          <Card className="border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 shadow-xl">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-600">
                    {getIcon()}
                  </div>
                  <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-600">
                    D&D Tip
                  </Badge>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <h4 className="font-semibold text-sm mb-2">{tip.title}</h4>
              <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                {tip.content}
              </p>

              <div className="bg-muted/50 rounded-md p-2 mb-3">
                <p className="text-xs font-mono text-center text-primary">
                  {tip.mechanic}
                </p>
              </div>

              {tip.groupPlayNote && (
                <div className="flex items-start gap-2 p-2 bg-blue-500/10 rounded-md border border-blue-500/20">
                  <Users className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    <strong>In group play:</strong> {tip.groupPlayNote}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between mt-3 pt-2 border-t">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs h-7"
                  onClick={onClose}
                >
                  Got it!
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs h-7"
                  onClick={() => {
                    onClose();
                    if (onLearnMore) onLearnMore();
                  }}
                >
                  Learn more <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Session-based tracking to avoid repeating tips within a session
const sessionShownTipIds = new Set<string>();
let lastTipTime = 0;
const TIP_COOLDOWN_MS = 60000; // 60 seconds minimum between tips
const TIP_PROBABILITY = 0.3; // Only 30% chance to show a tip

export function useLearningTips() {
  const [shownTips, setShownTips] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('everdice_shown_tips');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  
  const [currentTip, setCurrentTip] = useState<{ type: LearningTipType; show: boolean; tipId?: string }>({
    type: 'general',
    show: false
  });

  const showTip = (type: LearningTipType) => {
    const now = Date.now();
    
    // Enforce cooldown between tips
    if (now - lastTipTime < TIP_COOLDOWN_MS) {
      return;
    }
    
    // Probability check - only show tips 30% of the time
    if (Math.random() > TIP_PROBABILITY) {
      return;
    }
    
    // Get available tips that haven't been shown this session
    const availableTips = (LEARNING_TIPS[type] || LEARNING_TIPS.general)
      .filter(tip => !sessionShownTipIds.has(tip.id));
    
    // If all tips of this type have been shown this session, skip
    if (availableTips.length === 0) {
      return;
    }
    
    // Pick a random tip from available ones
    const tip = availableTips[Math.floor(Math.random() * availableTips.length)];
    
    // Mark as shown in session
    sessionShownTipIds.add(tip.id);
    lastTipTime = now;
    
    // Show the tip
    setCurrentTip({ type, show: true, tipId: tip.id });
    
    // Persist to localStorage for long-term tracking
    const tipKey = `${type}_${tip.id}`;
    if (!shownTips.has(tipKey)) {
      const newShown = new Set(shownTips).add(tipKey);
      setShownTips(newShown);
      localStorage.setItem('everdice_shown_tips', JSON.stringify(Array.from(newShown)));
    }
  };

  const hideTip = () => {
    setCurrentTip(prev => ({ ...prev, show: false }));
  };

  // Get the specific tip to display based on tipId
  const getCurrentTip = () => {
    if (!currentTip.tipId) return null;
    const tips = LEARNING_TIPS[currentTip.type] || LEARNING_TIPS.general;
    return tips.find(t => t.id === currentTip.tipId) || tips[0];
  };

  return { currentTip, showTip, hideTip, getCurrentTip };
}
