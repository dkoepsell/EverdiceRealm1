import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Character } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { 
  Swords, 
  Shield, 
  Heart, 
  Coins, 
  Beer, 
  Sparkles,
  User,
  ArrowRight,
  X,
  ScrollText
} from "lucide-react";

interface AdventurerInstinctProps {
  character: Character | null;
  campaignId: number;
  isDM: boolean;
  userId: number;
  sessionCount: number;
}

interface Nudge {
  id: string;
  icon: any;
  title: string;
  message: string;
  actionLabel?: string;
  actionPath?: string;
  priority: number;
}

export function NoCharacterPrompt({ campaignId, userId, onCharacterCreated }: { 
  campaignId: number; 
  userId: number;
  onCharacterCreated: () => void;
}) {
  const [, navigate] = useLocation();
  const [isGenerating, setIsGenerating] = useState(false);

  const quickBuildMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/characters/quick-build', { campaignId });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/participants`] });
      onCharacterCreated();
    }
  });

  return (
    <div className="p-6 rounded-xl bg-gradient-to-b from-amber-900/40 to-amber-950/60 border border-amber-500/30 text-center animate-in fade-in duration-500">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
        <User className="h-8 w-8 text-amber-400" />
      </div>
      <h3 className="text-xl font-bold text-amber-300 mb-2">Every adventurer needs a hero.</h3>
      <p className="text-sm text-amber-200/70 mb-6 max-w-md mx-auto">
        Before you can enter this campaign, you'll need a character. Create one now or let the fates decide.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button
          onClick={() => quickBuildMutation.mutate()}
          disabled={quickBuildMutation.isPending}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg"
        >
          {quickBuildMutation.isPending ? (
            <>
              <Sparkles className="h-4 w-4 mr-2 animate-spin" />
              The fates are deciding...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Let the Fates Decide
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate('/characters')}
          className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
        >
          <ScrollText className="h-4 w-4 mr-2" />
          Create Manually
        </Button>
      </div>
      {quickBuildMutation.isError && (
        <p className="text-xs text-rose-400 mt-3">
          Something went wrong. Try again or create a character manually.
        </p>
      )}
    </div>
  );
}

export function AdventurerInstinct({ character, campaignId, isDM, userId, sessionCount }: AdventurerInstinctProps) {
  const [, navigate] = useLocation();
  const [dismissedNudges, setDismissedNudges] = useState<Set<string>>(new Set());

  const nudges = useMemo(() => {
    if (!character || isDM) return [];
    
    const result: Nudge[] = [];
    const hpPercent = character.maxHitPoints > 0 
      ? (character.hitPoints / character.maxHitPoints) * 100 
      : 100;
    const gold = character.gold || 0;
    const hasWeapon = !!(character as any).equippedWeapon;
    const hasArmor = !!(character as any).equippedArmor;
    const hasShield = !!(character as any).equippedShield;

    const shieldProficientClasses = ['fighter', 'paladin', 'cleric', 'ranger', 'druid'];
    const isShieldProficient = shieldProficientClasses.includes(
      (character.class || '').toLowerCase()
    );

    if (hpPercent <= 40 && hpPercent > 0) {
      if (gold >= 50) {
        result.push({
          id: 'low-hp-can-buy',
          icon: Heart,
          title: "Your wounds need tending",
          message: "Your body aches from recent battles. A healing potion from the Tavern could restore your strength — or find a temple in the next settlement.",
          actionLabel: "Visit the Tavern",
          actionPath: "/tavern",
          priority: 1
        });
      } else {
        result.push({
          id: 'low-hp-need-gold',
          icon: Heart,
          title: "Wounded and light on coin",
          message: "Your wounds are heavy and your coin purse is light. Try your luck at the gambling table, or ask around for work — even a simple quest can line your pockets.",
          actionLabel: "Visit the Tavern",
          actionPath: "/tavern",
          priority: 1
        });
      }
    }

    if (!hasWeapon) {
      if (gold >= 15) {
        result.push({
          id: 'no-weapon',
          icon: Swords,
          title: "Your hands are empty",
          message: "You reach for your blade... but you carry nothing. Best visit the Tavern's shop before trouble finds you.",
          actionLabel: "Browse the Shop",
          actionPath: "/tavern",
          priority: 2
        });
      } else {
        result.push({
          id: 'no-weapon-broke',
          icon: Swords,
          title: "Unarmed and penniless",
          message: "A proper blade costs coin. Try the gambling table for quick gold, or take a small quest — even goblins carry purses.",
          actionLabel: "Earn Some Gold",
          actionPath: "/tavern",
          priority: 2
        });
      }
    }

    if (!hasArmor) {
      if (gold >= 10) {
        result.push({
          id: 'no-armor',
          icon: Shield,
          title: "The wind cuts through your clothes",
          message: "You're wearing nothing but traveling garb. A suit of armor from the Tavern's shop would serve you well before the next encounter.",
          actionLabel: "Get Armor",
          actionPath: "/tavern",
          priority: 3
        });
      } else {
        result.push({
          id: 'no-armor-broke',
          icon: Shield,
          title: "Unprotected and short on coin",
          message: "Armor costs gold you don't have. Take a quest or try gambling at the Tavern — a few lucky rolls could outfit you properly.",
          actionLabel: "Earn Some Gold",
          actionPath: "/tavern",
          priority: 3
        });
      }
    }

    if (!hasShield && isShieldProficient) {
      result.push({
        id: 'no-shield',
        icon: Shield,
        title: "Your off-hand is free",
        message: "A shield could turn a deadly blow into a glancing one. Check the Tavern shop if you have the coin.",
        actionLabel: "Browse Shields",
        actionPath: "/tavern",
        priority: 4
      });
    }

    return result
      .filter(n => !dismissedNudges.has(n.id))
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 2);
  }, [character, isDM, dismissedNudges]);

  const dismissNudge = (id: string) => {
    setDismissedNudges(prev => new Set(Array.from(prev).concat(id)));
  };

  if (nudges.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {nudges.map((nudge) => (
        <div
          key={nudge.id}
          className="p-3 rounded-lg bg-gradient-to-r from-amber-900/30 to-amber-950/20 border border-amber-500/20 animate-in fade-in slide-in-from-bottom-2 duration-500"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-1.5 rounded-md bg-amber-500/15">
              <nudge.icon className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-amber-300">{nudge.title}</p>
                <button
                  onClick={() => dismissNudge(nudge.id)}
                  className="text-amber-500/40 hover:text-amber-400 transition-colors flex-shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-xs text-amber-200/60 mt-0.5 leading-relaxed italic">
                {nudge.message}
              </p>
              {nudge.actionLabel && nudge.actionPath && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(nudge.actionPath!)}
                  className="mt-2 h-7 px-3 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                >
                  {nudge.actionLabel}
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function FirstSessionTips({ character, sessionCount }: { character: Character | null; sessionCount: number }) {
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState(false);
  
  if (dismissed || !character || sessionCount > 3) return null;

  const tips = [
    {
      icon: Beer,
      text: "A wise adventurer stocks healing potions before venturing into danger. Visit the Tavern to browse the shop.",
    },
    {
      icon: Coins,
      text: "Short on gold? The Tavern has a gambling table, and merchants often post small quests for coin.",
    },
    {
      icon: Swords,
      text: "Check your equipment before heading out. A good weapon and armor make the difference between glory and a shallow grave.",
    }
  ];

  const tipIndex = sessionCount <= 1 ? 0 : sessionCount <= 2 ? 1 : 2;
  const tip = tips[tipIndex];

  return (
    <div className="p-3 rounded-lg bg-gradient-to-r from-slate-800/50 to-slate-900/30 border border-slate-600/20 mb-4 animate-in fade-in duration-700">
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded-md bg-slate-700/50">
          <tip.icon className="h-4 w-4 text-slate-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-400">Tavern Wisdom</p>
            <button
              onClick={() => setDismissed(true)}
              className="text-slate-600 hover:text-slate-400 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <p className="text-xs text-slate-400/80 mt-0.5 italic leading-relaxed">
            "{tip.text}"
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/tavern')}
            className="mt-1.5 h-6 px-2 text-[10px] text-slate-500 hover:text-slate-300 hover:bg-slate-700/50"
          >
            Visit the Tavern
            <ArrowRight className="h-2.5 w-2.5 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
