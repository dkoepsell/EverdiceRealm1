import { useState, useEffect } from "react";
import { X, Sparkles, ArrowRight, Lightbulb } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type OnboardingHintId = 
  | "campaign_create"
  | "campaign_run_session"
  | "campaign_ai_generate"
  | "character_builder_class"
  | "character_builder_race"
  | "character_companions"
  | "dm_toolkit_intro"
  | "quest_board"
  | "hearth_intro";

interface OnboardingHintProps {
  hintId: OnboardingHintId;
  title: string;
  description: string;
  tip?: string;
  actionLabel?: string;
  onAction?: () => void;
  position?: "top" | "bottom" | "left" | "right";
  pulse?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const STORAGE_KEY = "everdice_onboarding_hints";

function getSeenHints(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch (e) {
    console.error("Failed to parse onboarding hints:", e);
  }
  return new Set();
}

function markHintSeen(hintId: string): void {
  const seen = getSeenHints();
  seen.add(hintId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(seen)));
}

export function useOnboardingHint(hintId: OnboardingHintId) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const seen = getSeenHints();
    setIsVisible(!seen.has(hintId));
  }, [hintId]);

  const dismiss = () => {
    markHintSeen(hintId);
    setIsVisible(false);
  };

  return { isVisible, dismiss };
}

export function OnboardingHint({
  hintId,
  title,
  description,
  tip,
  actionLabel,
  onAction,
  position = "bottom",
  pulse = true,
  className,
  children,
}: OnboardingHintProps) {
  const { isVisible, dismiss } = useOnboardingHint(hintId);

  if (!isVisible) {
    return <>{children}</>;
  }

  const positionClasses = {
    top: "bottom-full mb-2 left-1/2 -translate-x-1/2",
    bottom: "top-full mt-2 left-1/2 -translate-x-1/2",
    left: "right-full mr-2 top-1/2 -translate-y-1/2",
    right: "left-full ml-2 top-1/2 -translate-y-1/2",
  };

  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-amber-500/50",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-amber-500/50",
    left: "left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-amber-500/50",
    right: "right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-amber-500/50",
  };

  return (
    <div className={cn("relative inline-block", className)}>
      {pulse && (
        <motion.div
          className="absolute inset-0 rounded-lg ring-2 ring-amber-500/50"
          animate={{ 
            opacity: [0.5, 1, 0.5],
            scale: [1, 1.02, 1],
          }}
          transition={{ 
            duration: 2, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      )}
      
      {children}
      
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className={cn(
            "absolute z-50 w-72 p-0 rounded-lg shadow-xl border border-amber-500/30 bg-slate-900/95 backdrop-blur-sm",
            positionClasses[position]
          )}
        >
          <div className={cn("absolute w-0 h-0 border-8", arrowClasses[position])} />
          
          <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/10 px-4 py-2 rounded-t-lg border-b border-amber-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-400" />
              <h4 className="font-semibold text-sm text-amber-100">{title}</h4>
            </div>
            <button 
              onClick={dismiss}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="p-4 space-y-3">
            <p className="text-sm text-slate-300">{description}</p>
            
            {tip && (
              <p className="text-xs text-amber-400 flex items-start gap-1.5">
                <Sparkles className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>{tip}</span>
              </p>
            )}
            
            <div className="flex items-center gap-2 pt-1">
              {actionLabel && onAction && (
                <Button 
                  size="sm" 
                  onClick={() => {
                    dismiss();
                    onAction();
                  }}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 text-xs"
                >
                  {actionLabel}
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              )}
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={dismiss}
                className="text-xs text-muted-foreground"
              >
                Got it
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function OnboardingPulse({ 
  hintId, 
  children, 
  className 
}: { 
  hintId: OnboardingHintId; 
  children: React.ReactNode;
  className?: string;
}) {
  const { isVisible } = useOnboardingHint(hintId);

  if (!isVisible) {
    return <>{children}</>;
  }

  return (
    <div className={cn("relative", className)}>
      <motion.div
        className="absolute -inset-1 rounded-lg bg-gradient-to-r from-amber-500/30 to-orange-500/30"
        animate={{ 
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{ 
          duration: 1.5, 
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

export function resetOnboardingHints(): void {
  localStorage.removeItem(STORAGE_KEY);
}
