import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  HelpCircle,
  BookOpen,
  Dice6,
  MessageSquare,
  Swords,
  Heart,
  Shield,
  Package,
  Users,
  Sparkles,
  Target,
  Bed,
  Scroll,
  Wand2,
} from "lucide-react";

interface GuideSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: {
    heading: string;
    text: string;
    tips?: string[];
  }[];
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'basics',
    title: 'Getting Started',
    icon: <BookOpen className="h-4 w-4" />,
    content: [
      {
        heading: 'How the Story Works',
        text: "Everdice creates a dynamic adventure where your choices shape the narrative. Each scene presents a situation, and you decide how your character responds. There's no single 'correct' path - explore, experiment, and see where the story takes you!",
        tips: ["Read the scene description carefully for clues", "Think about what your character would do, not just what's optimal"]
      },
      {
        heading: 'Making Choices',
        text: "Below each scene, you'll see suggested actions. Click one to take that action, or type your own custom response in the text box. The story will adapt to whatever you choose.",
        tips: ["You can attempt creative solutions - try talking, sneaking, or finding alternate routes", "Some choices lead to dice rolls to determine success"]
      }
    ]
  },
  {
    id: 'character',
    title: 'Understanding Your Character',
    icon: <Users className="h-4 w-4" />,
    content: [
      {
        heading: 'Your Stats',
        text: "Your character has six main abilities: Strength (physical power), Dexterity (agility), Constitution (health), Intelligence (knowledge), Wisdom (perception), and Charisma (personality). Higher numbers mean better chances of success.",
        tips: ["Your class determines which stats are most important", "Stats affect both combat and roleplay situations"]
      },
      {
        heading: 'Hit Points (HP)',
        text: "HP represents your health. When you take damage, HP decreases. At 0 HP, you're unconscious and in danger. Rest or healing restores HP.",
        tips: ["Watch your HP during combat - retreat if it gets low", "Potions and healing spells can save you in tough spots"]
      },
      {
        heading: 'Armor Class (AC)',
        text: "AC shows how hard you are to hit. Enemies need to roll your AC number or higher to damage you. Armor and shields increase your AC.",
        tips: ["Higher AC means fewer hits land on you", "Light armor uses Dexterity, heavy armor doesn't"]
      }
    ]
  },
  {
    id: 'dice',
    title: 'Dice & Rolling',
    icon: <Dice6 className="h-4 w-4" />,
    content: [
      {
        heading: 'When Dice Are Rolled',
        text: "When the outcome of your action is uncertain, dice determine success. You'll see a roll like 'd20+5' which means a 20-sided die plus your modifier. Beat the target number (Difficulty Class or AC) to succeed.",
        tips: ["Rolling a natural 20 is a critical success!", "A natural 1 is always a failure, regardless of modifiers"]
      },
      {
        heading: 'Types of Rolls',
        text: "Attack rolls hit enemies. Saving throws resist effects. Ability checks attempt tasks like climbing, persuading, or investigating. Each uses d20 plus a relevant modifier.",
        tips: ["The system automatically adds your bonuses", "Some situations grant advantage (roll twice, take higher) or disadvantage (take lower)"]
      }
    ]
  },
  {
    id: 'inventory',
    title: 'Items & Inventory',
    icon: <Package className="h-4 w-4" />,
    content: [
      {
        heading: 'Equipment',
        text: "Weapons, armor, and magical items provide permanent bonuses when equipped. Check your inventory to see what you're carrying and what's equipped.",
        tips: ["Better equipment significantly improves your capabilities", "Some items have special abilities - read their descriptions"]
      },
      {
        heading: 'Consumables',
        text: "Potions, scrolls, and other single-use items provide powerful effects. Click 'Use' to activate them. They're gone after one use, so save them for when you need them!",
        tips: ["Healing potions are essential for tough battles", "Some consumables can turn the tide of combat"]
      }
    ]
  },
  {
    id: 'companions',
    title: 'NPC Companions',
    icon: <Users className="h-4 w-4" />,
    content: [
      {
        heading: 'What Companions Do',
        text: "Companions are allies who travel with you. They have their own abilities, can help in combat, and add to the story. Different companions offer different skills and perspectives.",
        tips: ["Choose companions whose strengths complement your weaknesses", "Companions can provide skills you don't have"]
      },
      {
        heading: 'Managing Companions',
        text: "Click on a companion to see their details, give them items, or dismiss them. They have their own HP and can be knocked out in combat - protect them!",
        tips: ["Companions can carry items for you", "Keep their equipment updated for better combat performance"]
      }
    ]
  },
  {
    id: 'combat',
    title: 'Combat',
    icon: <Swords className="h-4 w-4" />,
    content: [
      {
        heading: 'How Combat Works',
        text: "In combat, turns happen based on initiative (who's fastest). On your turn, you can move and take an action - usually attacking, casting a spell, or using an item.",
        tips: ["Consider positioning - ranged attackers should stay back", "Focus fire on one enemy to reduce threats quickly"]
      },
      {
        heading: 'Attack and Damage',
        text: "To hit an enemy, roll d20 + your attack modifier vs their AC. If you hit, roll damage. Different weapons deal different damage types (slashing, piercing, fire, etc.).",
        tips: ["Some enemies resist or are immune to certain damage types", "Critical hits (natural 20) deal double damage dice"]
      }
    ]
  },
  {
    id: 'rest',
    title: 'Resting & Recovery',
    icon: <Bed className="h-4 w-4" />,
    content: [
      {
        heading: 'Short Rest',
        text: "A short rest takes about an hour. You can spend Hit Dice to heal and recover some abilities. Good for recovering between encounters.",
        tips: ["Short rests are quick and efficient", "Some class abilities recharge on short rest"]
      },
      {
        heading: 'Long Rest',
        text: "A long rest takes 8 hours. You fully heal, recover all spell slots, and regain half your Hit Dice. However, time passes and events may occur.",
        tips: ["Find a safe location before long resting", "Long rests advance the story timeline"]
      }
    ]
  },
  {
    id: 'spells',
    title: 'Spellcasting',
    icon: <Wand2 className="h-4 w-4" />,
    content: [
      {
        heading: 'Spell Slots',
        text: "Spellcasters use spell slots to cast magic. Each spell requires a slot of its level or higher. Slots recharge on rest (short or long depending on class).",
        tips: ["Higher level slots make spells more powerful", "Don't burn all your best slots early - save some for emergencies"]
      },
      {
        heading: 'Cantrips',
        text: "Cantrips are basic spells you can cast at will without using slots. They're weaker but unlimited, perfect for regular use.",
        tips: ["Use cantrips for minor tasks to save slots", "Damage cantrips scale as you level up"]
      }
    ]
  }
];

interface HowToPlayPanelProps {
  triggerClassName?: string;
  variant?: 'icon' | 'button';
}

export function HowToPlayPanel({ triggerClassName, variant = 'icon' }: HowToPlayPanelProps) {
  const [open, setOpen] = useState(false);
  
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {variant === 'icon' ? (
          <Button
            variant="ghost"
            size="icon"
            className={triggerClassName}
            title="How to Play"
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            variant="outline"
            className={triggerClassName}
          >
            <BookOpen className="h-4 w-4 mr-2" />
            How to Play
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[540px] p-0">
        <SheetHeader className="p-6 pb-4 bg-gradient-to-r from-amber-500/10 to-orange-500/5 border-b border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <BookOpen className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <SheetTitle className="text-xl">How to Play Everdice</SheetTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Quick reference guide for your adventure
              </p>
            </div>
          </div>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="p-6">
            <Accordion type="single" collapsible className="space-y-2">
              {GUIDE_SECTIONS.map((section) => (
                <AccordionItem
                  key={section.id}
                  value={section.id}
                  className="border border-border/50 rounded-lg px-4 bg-card/50"
                >
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded bg-amber-500/10 text-amber-500">
                        {section.icon}
                      </div>
                      <span className="font-medium">{section.title}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="space-y-4 pt-2">
                      {section.content.map((item, idx) => (
                        <div key={idx} className="space-y-2">
                          <h4 className="font-semibold text-sm text-amber-100">
                            {item.heading}
                          </h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {item.text}
                          </p>
                          {item.tips && item.tips.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {item.tips.map((tip, tipIdx) => (
                                <div
                                  key={tipIdx}
                                  className="flex items-start gap-2 text-xs text-amber-400/80"
                                >
                                  <Sparkles className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                  <span>{tip}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {idx < section.content.length - 1 && (
                            <div className="border-t border-border/30 my-3" />
                          )}
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            
            <div className="mt-6 p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm text-amber-100 mb-1">
                    Remember: It's Your Story!
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    There's no wrong way to play. Experiment, take risks, and most importantly - have fun! The best adventures come from creative thinking and embracing the unexpected.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export function HowToPlayFloatingButton() {
  return (
    <div className="fixed bottom-4 right-4 z-40">
      <HowToPlayPanel
        variant="button"
        triggerClassName="shadow-lg bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-500 hover:to-orange-500 border-0"
      />
    </div>
  );
}
