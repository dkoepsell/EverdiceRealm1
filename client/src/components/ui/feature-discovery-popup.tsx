import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Compass, Pickaxe, Route, Grid3X3, X } from "lucide-react";

interface FeatureTip {
  id: string;
  icon: typeof Compass;
  title: string;
  description: string;
}

const FEATURE_TIPS: FeatureTip[] = [
  {
    id: "wander_mode",
    icon: Compass,
    title: "Wander Mode",
    description: "Did you know? You can explore the wilderness freely using Wander mode from the navigation menu!"
  },
  {
    id: "delve_mode",
    icon: Pickaxe,
    title: "Delve Mode",
    description: "Try Delve mode to crawl through procedurally generated dungeons with puzzles and traps!"
  },
  {
    id: "trek_mode",
    icon: Route,
    title: "Trek",
    description: "Right-click any hex on the World Map to start a Trek — travel step-by-step with random encounters!"
  },
  {
    id: "hex_mode",
    icon: Grid3X3,
    title: "Hex Mode",
    description: "Toggle Hex Mode on the World Map for a strategic bird's-eye view of the entire realm!"
  }
];

const STORAGE_KEY = "everdice_feature_discovery_seen";
const MIN_SCENES_BEFORE_SHOWING = 5;

function getSeenFeatures(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function markFeatureSeen(id: string): void {
  const seen = getSeenFeatures();
  seen.add(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(seen)));
}

interface FeatureDiscoveryPopupProps {
  sceneCount: number;
}

export function FeatureDiscoveryPopup({ sceneCount }: FeatureDiscoveryPopupProps) {
  const [activeTip, setActiveTip] = useState<FeatureTip | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sceneCount < MIN_SCENES_BEFORE_SHOWING || dismissed) return;

    const seen = getSeenFeatures();
    const unseen = FEATURE_TIPS.filter(t => !seen.has(t.id));
    if (unseen.length === 0) return;

    const tip = unseen[Math.floor(Math.random() * unseen.length)];

    const timer = setTimeout(() => {
      setActiveTip(tip);
    }, 3000);

    return () => clearTimeout(timer);
  }, [sceneCount, dismissed]);

  const handleDismiss = useCallback(() => {
    if (activeTip) {
      markFeatureSeen(activeTip.id);
    }
    setActiveTip(null);
    setDismissed(true);
  }, [activeTip]);

  return (
    <AnimatePresence>
      {activeTip && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="mt-4 p-4 rounded-lg bg-gradient-to-r from-amber-950/50 to-yellow-950/40 border-2 border-amber-500/40 shadow-lg shadow-amber-900/20"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 shrink-0">
              <activeTip.icon className="h-5 w-5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h4 className="font-semibold text-sm text-amber-200">
                  ✨ {activeTip.title}
                </h4>
                <button
                  onClick={handleDismiss}
                  className="text-amber-400/50 hover:text-amber-300 transition-colors shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm text-amber-100/70 leading-relaxed">
                {activeTip.description}
              </p>
              <div className="flex justify-end mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                  onClick={handleDismiss}
                >
                  Got it!
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
