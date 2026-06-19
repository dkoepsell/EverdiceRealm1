import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Coins, Package, TrendingUp, ArrowRight,
  GraduationCap, Coffee, Compass, Users,
} from "lucide-react";

/**
 * FirstSessionWrapUp — the rewards / growth / "where next" section appended to the
 * end-of-first-session "Quiet Reckoning" dialog. Goal: celebrate what a new player's
 * character earned, show concrete growth, and steer them into the rest of the product
 * (learning D&D, the Tavern, exploration, multiplayer / next campaign) to drive
 * activation and retention.
 */

export interface SessionRewards {
  earned: { xp: number; gold: number; items: string[] };
  growth: {
    level: number;
    experience: number;
    xpToNextLevel: number;
    xpPercent: number;
    goldTotal: number;
    inventoryCount: number;
    skillsPracticed: string[];
  };
}

interface FirstSessionWrapUpProps {
  rewards: SessionRewards;
  /** Parent handles analytics tracking, closing the dialog, and routing. */
  onNavigate: (path: string, ctaId: string) => void;
}

const NEXT_STEPS = [
  {
    id: "learn_dnd",
    icon: GraduationCap,
    title: "Learn the ways of D&D",
    description: "Rules, dice, and how to play — become a true student of the game.",
    path: "/learn",
    color: "from-sky-500 to-blue-500",
  },
  {
    id: "tavern",
    icon: Coffee,
    title: "Visit the Tavern",
    description: "Spend your gold on gear, sell loot, and take on bounties.",
    path: "/tavern",
    color: "from-emerald-500 to-teal-500",
  },
  {
    id: "explore",
    icon: Compass,
    title: "Explore the realm",
    description: "Wander the world map, delve dungeons, and discover new places.",
    path: "/world-map",
    color: "from-amber-500 to-orange-500",
  },
  {
    id: "multiplayer",
    icon: Users,
    title: "Gather at the Hearth",
    description: "Meet other players, join multiplayer campaigns, or start your next one.",
    path: "/hearth",
    color: "from-purple-500 to-indigo-500",
  },
] as const;

export function FirstSessionWrapUp({ rewards, onNavigate }: FirstSessionWrapUpProps) {
  const { earned, growth } = rewards;
  const hasEarnings = earned.xp > 0 || earned.gold > 0 || (earned.items?.length ?? 0) > 0;
  const xpPercent = Math.max(0, Math.min(100, growth.xpPercent || 0));

  return (
    <div className="space-y-5 border-t border-amber-200 dark:border-amber-800 pt-5">
      {/* Rewards earned this session */}
      {hasEarnings && (
        <div>
          <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider mb-2">
            Spoils of your first session
          </div>
          <div className="flex flex-wrap gap-2">
            {earned.xp > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/60 px-3 py-1.5 text-sm font-medium text-amber-800 dark:text-amber-200">
                <Sparkles className="h-4 w-4" /> +{earned.xp.toLocaleString()} XP
              </span>
            )}
            {earned.gold > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200/60 dark:border-yellow-800/60 px-3 py-1.5 text-sm font-medium text-yellow-700 dark:text-yellow-300">
                <Coins className="h-4 w-4" /> +{earned.gold.toLocaleString()} gold
              </span>
            )}
            {(earned.items || []).map((item, i) => (
              <span key={`${item}-${i}`} className="inline-flex items-center gap-1.5 rounded-lg bg-stone-100 dark:bg-stone-800/60 border border-stone-300/60 dark:border-stone-700/60 px-3 py-1.5 text-sm text-stone-700 dark:text-stone-300">
                <Package className="h-4 w-4" /> {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Character growth snapshot */}
      <div>
        <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" /> How {`you've`} grown
        </div>
        <div className="rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/50 p-3 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-emerald-800 dark:text-emerald-200">Level {growth.level}</span>
            <span className="text-emerald-700/80 dark:text-emerald-300/80">{growth.experience.toLocaleString()} XP</span>
          </div>
          <div>
            <div className="h-2 w-full rounded-full bg-emerald-200/50 dark:bg-emerald-900/50 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${xpPercent}%` }} />
            </div>
            <div className="mt-1 text-xs text-emerald-700/70 dark:text-emerald-300/70">
              {growth.xpToNextLevel > 0
                ? `${growth.xpToNextLevel.toLocaleString()} XP to level ${growth.level + 1}`
                : "Ready to level up!"}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-emerald-800/90 dark:text-emerald-200/90">
            <span className="inline-flex items-center gap-1"><Coins className="h-3.5 w-3.5" /> {growth.goldTotal.toLocaleString()} gold</span>
            <span className="inline-flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {growth.inventoryCount} item{growth.inventoryCount === 1 ? "" : "s"}</span>
          </div>
          {growth.skillsPracticed?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {growth.skillsPracticed.map((s, i) => (
                <Badge key={i} variant="outline" className="text-[11px] border-emerald-300/60 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300 font-normal">
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Where your story goes next */}
      <div>
        <div className="text-xs font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-wider mb-2">
          Where your story goes next
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {NEXT_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <Card
                key={step.id}
                role="button"
                tabIndex={0}
                onClick={() => onNavigate(step.path, step.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavigate(step.path, step.id); } }}
                className="p-3 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md border hover:border-primary/50 group"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${step.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="h-4.5 w-4.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 font-semibold text-sm text-foreground">
                      {step.title}
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{step.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
