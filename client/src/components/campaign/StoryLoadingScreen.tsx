import { useState, useEffect, useRef, useMemo } from "react";
import { Sparkles, Sword, Shield, Heart, MapPin, Scroll, Moon, BookOpen, Compass, Users, Search, Footprints, Flame, Skull, Crown, Gem, TreePine, Mountain, Castle, Eye } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface StoryLoadingScreenProps {
  previousNarrative?: string;
  chosenAction?: string;
  character?: {
    name: string;
    class: string;
    level: number;
    hitPoints: number;
    maxHitPoints: number;
    status?: string;
    armorClass?: number;
  } | null;
  combatants?: any[];
  inCombat?: boolean;
  location?: string;
  phase?: 'commit' | 'reveal' | 'deepen' | 'loading';
  revealText?: string;
  streamedText?: string;
}

const FLAVOR_TEXTS = [
  { text: "Weaving consequences...", icon: Sparkles },
  { text: "The world shifts around you...", icon: Moon },
  { text: "Your choice echoes forward...", icon: BookOpen },
  { text: "Fate considers your path...", icon: Scroll },
  { text: "The story deepens...", icon: MapPin },
  { text: "Consequences take shape...", icon: Sword },
  { text: "The threads of destiny realign...", icon: Sparkles },
  { text: "Something stirs in response...", icon: Moon },
];

const COMBAT_FLAVOR_TEXTS = [
  { text: "Steel meets steel...", icon: Sword },
  { text: "The clash of battle resounds...", icon: Shield },
  { text: "Fortune favors the bold...", icon: Sword },
  { text: "Blood and fury...", icon: Heart },
  { text: "The tide of battle shifts...", icon: Shield },
];

type SceneContext = 'combat' | 'exploration' | 'social' | 'dungeon' | 'wilderness' | 'town' | 'mystery' | 'magic';

const SCENE_CRAWL_ICONS: Record<SceneContext, typeof Sword[]> = {
  combat: [Sword, Shield, Skull, Flame],
  exploration: [Compass, Footprints, MapPin, Eye],
  social: [Users, Crown, Scroll, BookOpen],
  dungeon: [Skull, Gem, Eye, Flame],
  wilderness: [TreePine, Mountain, Compass, Footprints],
  town: [Castle, Users, Crown, Scroll],
  mystery: [Eye, Search, Moon, Sparkles],
  magic: [Sparkles, Gem, Moon, Flame],
};

function detectSceneContext(
  inCombat?: boolean,
  location?: string,
  chosenAction?: string,
  previousNarrative?: string
): SceneContext {
  if (inCombat) return 'combat';

  const combined = `${location || ''} ${chosenAction || ''} ${previousNarrative || ''}`.toLowerCase();

  if (/cave|dungeon|crypt|tomb|ruin|catacomb|underground|chamber/.test(combined)) return 'dungeon';
  if (/forest|mountain|wild|river|swamp|desert|gorge|cliff|trail|valley/.test(combined)) return 'wilderness';
  if (/tavern|inn|town|city|village|market|shop|castle|court|throne/.test(combined)) return 'town';
  if (/investigate|search|clue|mystery|hidden|secret|shadow|whisper|puzzle/.test(combined)) return 'mystery';
  if (/spell|magic|arcane|enchant|ritual|rune|amulet|crystal|wand|sorcery/.test(combined)) return 'magic';
  if (/talk|persuade|convince|negotiate|diplomacy|alliance|trade|barter/.test(combined)) return 'social';
  if (/explore|discover|scout|travel|journey|path|venture|wander/.test(combined)) return 'exploration';

  return 'exploration';
}

const crawlKeyframes = `
@keyframes crawl-across {
  0% { left: -5%; opacity: 0; }
  5% { opacity: 0.3; }
  50% { opacity: 0.35; }
  95% { opacity: 0.3; }
  100% { left: 105%; opacity: 0; }
}
@keyframes gentle-bob {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-6px); }
}
`;

function CrawlingIcon({ sceneContext }: { sceneContext: SceneContext }) {
  const icons = SCENE_CRAWL_ICONS[sceneContext];
  const [iconIndex, setIconIndex] = useState(() => Math.floor(Math.random() * icons.length));

  useEffect(() => {
    const interval = setInterval(() => {
      setIconIndex(prev => (prev + 1) % icons.length);
    }, 15000);
    return () => clearInterval(interval);
  }, [icons.length]);

  const Icon = icons[iconIndex];

  return (
    <>
      <style>{crawlKeyframes}</style>
      <div
        className="absolute pointer-events-none top-1/2"
        style={{
          animation: 'crawl-across 15s linear infinite',
          willChange: 'left, opacity',
        }}
      >
        <div style={{ animation: 'gentle-bob 3s ease-in-out infinite' }}>
          <Icon
            className="h-6 w-6 text-amber-400"
            style={{
              filter: 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.4))',
            }}
          />
        </div>
      </div>
    </>
  );
}

export function StoryLoadingScreen({
  previousNarrative,
  chosenAction,
  character,
  combatants,
  inCombat,
  location,
  phase = 'loading',
  revealText,
  streamedText
}: StoryLoadingScreenProps) {
  const [flavorIndex, setFlavorIndex] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());

  const flavors = inCombat ? COMBAT_FLAVOR_TEXTS : FLAVOR_TEXTS;

  const sceneContext = useMemo(
    () => detectSceneContext(inCombat, location, chosenAction, previousNarrative),
    [inCombat, location, chosenAction, previousNarrative]
  );

  useEffect(() => {
    setFlavorIndex(Math.floor(Math.random() * flavors.length));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setFlavorIndex(prev => (prev + 1) % flavors.length);
        setFadeIn(true);
      }, 400);
    }, 3500);
    return () => clearInterval(interval);
  }, [flavors.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Date.now() - startTime.current);
    }, 50);
    return () => clearInterval(timer);
  }, []);

  const currentFlavor = flavors[flavorIndex];
  const FlavorIcon = currentFlavor.icon;

  const phaseLabel = phase === 'commit' ? 'Choice locked'
    : phase === 'reveal' ? 'Scene emerging...'
    : phase === 'deepen' ? 'Story unfolding...'
    : currentFlavor.text;

  const showStream = phase === 'deepen' && streamedText;
  const showReveal = (phase === 'reveal' || (phase === 'deepen' && !streamedText));

  return (
    <div className="space-y-4">
      {chosenAction && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-900/30 border border-amber-600/30 rounded-lg animate-in fade-in duration-300">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-sm text-amber-200/80 italic truncate">
            "{chosenAction}"
          </span>
          {phase === 'commit' && (
            <span className="ml-auto text-xs text-green-400 font-medium animate-pulse">Preparing scene...</span>
          )}
          {phase === 'reveal' && (
            <span className="ml-auto text-xs text-amber-400 font-medium">Full story loading...</span>
          )}
        </div>
      )}

      {/* Crawling contextual icon across the loading area */}
      <div className="relative min-h-[60px] overflow-hidden">
        <CrawlingIcon sceneContext={sceneContext} />

        {showReveal && revealText ? (
          <div className="relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <p className="whitespace-pre-line text-lg leading-relaxed text-slate-100 font-medium" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.4)' }}>
              {revealText}
            </p>
            <div className="mt-4 flex items-center gap-3 px-3 py-2.5 bg-amber-900/20 border border-amber-600/20 rounded-lg animate-in fade-in duration-700" style={{ animationDelay: '600ms', animationFillMode: 'both' }}>
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-sm text-amber-300/70 italic">
                {elapsed > 8000 ? "Almost there — crafting your choices..." : "Weaving the full scene and your choices..."}
              </span>
            </div>
          </div>
        ) : showStream && streamedText ? (
          <div className="relative z-10 animate-in fade-in duration-300">
            <p className="whitespace-pre-line text-lg leading-relaxed text-slate-100/80 font-medium" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.4)' }}>
              {streamedText}
              {!streamedText.endsWith("...") && (
                <span className="inline-block w-0.5 h-5 bg-amber-400 ml-0.5 animate-pulse" />
              )}
            </p>
            {streamedText.endsWith("...") && (
              <div className="mt-4 flex items-center gap-3 px-3 py-2.5 bg-amber-900/20 border border-amber-600/20 rounded-lg animate-in fade-in duration-500">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm text-amber-300/70 italic">
                  {elapsed > 8000 ? "Almost there — crafting your choices..." : "Weaving the complete scene..."}
                </span>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="relative z-10 flex flex-col items-center justify-center py-6">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-2 border-amber-500/30 flex items-center justify-center">
                  <FlavorIcon
                    className={`h-8 w-8 text-amber-400 transition-all duration-400 ${fadeIn ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
                  />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-amber-400/60 border-t-transparent animate-spin" style={{ animationDuration: '3s' }} />
              </div>

              <p className={`mt-4 text-center font-medium text-amber-300 text-lg transition-opacity duration-400 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
                {phaseLabel}
              </p>

              {elapsed > 4000 && (
                <p className="mt-1 text-xs text-amber-200/40 animate-in fade-in duration-1000">
                  Some choices take longer to resolve
                </p>
              )}
            </div>

            {character && (
              <div className="flex items-center gap-3 px-3 py-2 bg-slate-800/50 border border-slate-700/40 rounded-lg animate-in fade-in duration-500" style={{ animationDelay: '500ms', animationFillMode: 'both' }}>
                <div className="flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5 text-red-400" />
                  <span className="text-xs text-slate-300">{character.hitPoints}/{character.maxHitPoints}</span>
                </div>
                <div className="flex-1">
                  <Progress
                    value={Math.max(0, (character.hitPoints / character.maxHitPoints) * 100)}
                    className="h-1.5"
                  />
                </div>
                {character.armorClass && (
                  <div className="flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5 text-blue-400" />
                    <span className="text-xs text-slate-300">{character.armorClass}</span>
                  </div>
                )}
                <span className="text-xs text-slate-400">Lv.{character.level} {character.class}</span>
              </div>
            )}

            {inCombat && combatants && combatants.length > 0 && (
              <div className="space-y-1.5 px-3 py-2 bg-red-900/20 border border-red-700/30 rounded-lg animate-in fade-in duration-500" style={{ animationDelay: '700ms', animationFillMode: 'both' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Sword className="h-3 w-3 text-red-400" />
                  <span className="text-xs font-medium text-red-300">In Combat</span>
                </div>
                {combatants.filter((c: any) => (c.type === 'enemy' || c.type === 'boss') && c.status !== 'defeated').map((enemy: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-slate-300 truncate flex-1">{enemy.name}</span>
                    <div className="w-16">
                      <Progress
                        value={Math.max(0, ((enemy.currentHp ?? enemy.maxHp) / (enemy.maxHp || 1)) * 100)}
                        className="h-1"
                      />
                    </div>
                    <span className="text-xs text-slate-400 w-12 text-right">{enemy.currentHp ?? '?'}/{enemy.maxHp ?? '?'}</span>
                  </div>
                ))}
              </div>
            )}

            {previousNarrative && (
              <div className="relative mt-2 max-h-24 overflow-hidden animate-in fade-in duration-700" style={{ animationDelay: '1000ms', animationFillMode: 'both' }}>
                <p className="text-sm leading-relaxed text-slate-400/50 italic line-clamp-3">
                  {previousNarrative}
                </p>
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-slate-900/80 to-transparent" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
