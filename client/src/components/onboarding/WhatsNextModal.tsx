import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Sparkles, 
  Users, 
  BookOpen, 
  ArrowRight, 
  Trophy,
  Wand2,
  Sword,
  Coffee,
  Coins
} from "lucide-react";
import { motion } from "framer-motion";

interface WhatsNextModalProps {
  isOpen: boolean;
  onClose: () => void;
  completedType?: "demo" | "learn_by_playing" | "first_campaign";
}

const STORAGE_KEY = "everdice_whats_next_shown";

function hasShownWhatsNext(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

function markWhatsNextShown(): void {
  localStorage.setItem(STORAGE_KEY, "true");
}

export function useWhatsNextModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [completedType, setCompletedType] = useState<"demo" | "learn_by_playing" | "first_campaign">();

  const showModal = (type: "demo" | "learn_by_playing" | "first_campaign") => {
    if (!hasShownWhatsNext()) {
      setCompletedType(type);
      setIsOpen(true);
    }
  };

  const closeModal = () => {
    markWhatsNextShown();
    setIsOpen(false);
  };

  return { isOpen, completedType, showModal, closeModal };
}

export function WhatsNextModal({ isOpen, onClose, completedType = "demo" }: WhatsNextModalProps) {
  const [, navigate] = useLocation();

  const handleChoice = (path: string) => {
    markWhatsNextShown();
    onClose();
    navigate(path);
  };

  const titleByType = {
    demo: "Nice! You've completed the demo!",
    learn_by_playing: "Great job finishing your first adventure!",
    first_campaign: "Your first campaign is complete!",
  };

  const descriptionByType = {
    demo: "You've got the basics down. Now it's time to create your own adventure!",
    learn_by_playing: "You've learned the ropes and earned gold and XP along the way! Ready for what's next?",
    first_campaign: "Congratulations! You've earned rewards that carry into your next adventure.",
  };

  const isPostCampaign = completedType === "learn_by_playing" || completedType === "first_campaign";

  const nextSteps = [
    ...(isPostCampaign ? [{
      id: "visit_tavern",
      icon: Coffee,
      title: "Visit the Tavern",
      description: "Spend your hard-earned gold at the shop! Buy powerful gear, sell loot you picked up, or try your luck at Liar's Dice.",
      actionLabel: "Go to Tavern",
      path: "/tavern",
      color: "from-emerald-500 to-teal-500",
      recommended: true,
    }] : []),
    {
      id: "create_campaign",
      icon: Sparkles,
      title: "Create Your Own Campaign",
      description: isPostCampaign 
        ? "Your character keeps growing! Start a new adventure and your XP, gold, and items carry forward."
        : "Let AI generate a unique adventure based on your preferences. Choose your setting, tone, and let the magic happen.",
      actionLabel: "Generate Campaign",
      path: "/campaigns?tab=create",
      color: "from-amber-500 to-orange-500",
      recommended: !isPostCampaign,
    },
    {
      id: "build_character",
      icon: Sword,
      title: "Build a Custom Character",
      description: "Design your hero from scratch. Pick race, class, abilities, and create a backstory that fits your style.",
      actionLabel: "Character Builder",
      path: "/characters",
      color: "from-purple-500 to-indigo-500",
    },
    {
      id: "browse_adventures",
      icon: BookOpen,
      title: "Browse Adventures",
      description: "Explore pre-made adventures created by others or join an existing campaign.",
      actionLabel: "Browse",
      path: "/campaigns",
      color: "from-cyan-500 to-blue-500",
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-slate-900 border-amber-500/30">
        <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 p-6 border-b border-amber-500/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Trophy className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-amber-100">
                {titleByType[completedType]}
              </DialogTitle>
              <DialogDescription className="text-slate-300">
                {descriptionByType[completedType]}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            What would you like to do next?
          </h3>

          <div className="space-y-3">
            {nextSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card 
                    className={`p-4 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg border-2 ${
                      step.recommended 
                        ? "border-amber-500/50 bg-amber-500/5" 
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => handleChoice(step.path)}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${step.color} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-foreground">{step.title}</h4>
                          {step.recommended && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {isPostCampaign && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-4 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20"
            >
              <div className="flex items-start gap-2">
                <Coins className="h-4 w-4 text-purple-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-purple-300">
                  <span className="font-semibold">Your progress carries forward!</span> The XP, gold, skills, and items 
                  your character earned will follow them into every future adventure. The world of Everdice remembers 
                  your deeds — other adventurers may hear whispers of your heroic journey.
                </p>
              </div>
            </motion.div>
          )}

          <div className="mt-6 pt-4 border-t border-border flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              You can always find these options in the navigation menu.
            </p>
            <Button variant="ghost" onClick={onClose} className="text-sm">
              Maybe later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function resetWhatsNextModal(): void {
  localStorage.removeItem(STORAGE_KEY);
}
