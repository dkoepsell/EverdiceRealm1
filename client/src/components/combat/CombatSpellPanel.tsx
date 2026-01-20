import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Sparkles, Flame, Snowflake, Zap, Heart, Shield, 
  Eye, Moon, Wand2, Star, Clock, Target, Circle, 
  Lock, CheckCircle, XCircle, Filter
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Spell {
  id: number;
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  description: string;
  damageType?: string;
  damageDice?: string;
  healingDice?: string;
  concentration?: boolean;
  ritual?: boolean;
}

interface CharacterSpell {
  id: number;
  spellId: number;
  isPrepared: boolean;
  spell: Spell;
}

interface SpellSlots {
  slotsLevel1Max: number;
  slotsLevel2Max: number;
  slotsLevel3Max: number;
  slotsLevel4Max: number;
  slotsLevel5Max: number;
  slotsLevel6Max: number;
  slotsLevel7Max: number;
  slotsLevel8Max: number;
  slotsLevel9Max: number;
  slotsLevel1Used: number;
  slotsLevel2Used: number;
  slotsLevel3Used: number;
  slotsLevel4Used: number;
  slotsLevel5Used: number;
  slotsLevel6Used: number;
  slotsLevel7Used: number;
  slotsLevel8Used: number;
  slotsLevel9Used: number;
}

interface CombatSpellPanelProps {
  characterId: number;
  characterClass: string;
  characterLevel: number;
  onCastSpell?: (spell: Spell, slotLevel: number) => void;
}

const SCHOOL_ICONS: Record<string, any> = {
  abjuration: Shield,
  conjuration: Circle,
  divination: Eye,
  enchantment: Heart,
  evocation: Flame,
  illusion: Moon,
  necromancy: Sparkles,
  transmutation: Zap,
};

const DAMAGE_ICONS: Record<string, any> = {
  fire: Flame,
  cold: Snowflake,
  lightning: Zap,
  radiant: Star,
  necrotic: Moon,
};

export default function CombatSpellPanel({ 
  characterId, 
  characterClass, 
  characterLevel,
  onCastSpell 
}: CombatSpellPanelProps) {
  const [showAllSpells, setShowAllSpells] = useState(false);

  const { data: knownSpells = [] } = useQuery<CharacterSpell[]>({
    queryKey: [`/api/characters/${characterId}/spells`],
  });
  
  const { data: spellSlots } = useQuery<SpellSlots>({
    queryKey: [`/api/characters/${characterId}/spell-slots`],
  });

  const useSlotMutation = useMutation({
    mutationFn: async (slotLevel: number) => {
      return apiRequest('POST', `/api/characters/${characterId}/spell-slots/use`, { slotLevel });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/characters/${characterId}/spell-slots`] });
    }
  });

  const getSlotInfo = (level: number) => {
    if (!spellSlots) return { max: 0, available: 0 };
    const slotKey = `slotsLevel${level}Max` as keyof SpellSlots;
    const usedKey = `slotsLevel${level}Used` as keyof SpellSlots;
    const max = spellSlots[slotKey] as number || 0;
    const used = spellSlots[usedKey] as number || 0;
    return { max, available: max - used };
  };

  const canCastSpell = (spell: Spell): { canCast: boolean; reason?: string } => {
    if (spell.level === 0) return { canCast: true };
    
    const charSpell = knownSpells.find(cs => cs.spell.id === spell.id);
    if (!charSpell?.isPrepared && spell.level > 0) {
      return { canCast: false, reason: "Not prepared" };
    }
    
    for (let i = spell.level; i <= 9; i++) {
      const { available } = getSlotInfo(i);
      if (available > 0) return { canCast: true };
    }
    
    return { canCast: false, reason: "No slots available" };
  };

  const handleCastSpell = (spell: Spell) => {
    if (spell.level === 0) {
      onCastSpell?.(spell, 0);
      return;
    }
    
    for (let i = spell.level; i <= 9; i++) {
      const { available } = getSlotInfo(i);
      if (available > 0) {
        useSlotMutation.mutate(i);
        onCastSpell?.(spell, i);
        return;
      }
    }
  };

  const preparedSpells = knownSpells.filter(cs => cs.isPrepared || cs.spell.level === 0);
  const displaySpells = showAllSpells ? knownSpells : preparedSpells;
  const cantrips = displaySpells.filter(cs => cs.spell.level === 0);
  const leveledSpells = displaySpells.filter(cs => cs.spell.level > 0);

  const spellcastingClasses = ['wizard', 'sorcerer', 'cleric', 'bard', 'druid', 'warlock', 'paladin', 'ranger'];
  const isSpellcaster = spellcastingClasses.includes(characterClass.toLowerCase());

  if (!isSpellcaster) return null;

  return (
    <Card className="border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-950/30">
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-sm flex items-center gap-2 text-purple-800 dark:text-purple-200">
          <Sparkles className="h-4 w-4" />
          Combat Spells
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-3">
        {spellSlots && (
          <div className="flex flex-wrap gap-1 mb-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => {
              const { max, available } = getSlotInfo(level);
              if (max === 0) return null;
              return (
                <TooltipProvider key={level}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs ${
                        available > 0 
                          ? 'bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-200' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                      }`}>
                        <span className="font-medium">{level}</span>
                        <span className="text-[10px]">({available}/{max})</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Level {level} slots: {available} of {max} available</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2 mb-2">
          <Switch 
            id="show-all-spells" 
            checked={showAllSpells} 
            onCheckedChange={setShowAllSpells}
            className="h-4 w-7"
          />
          <Label htmlFor="show-all-spells" className="text-xs text-gray-600 dark:text-gray-400">
            Show all known spells
          </Label>
        </div>

        <Tabs defaultValue="cantrips" className="w-full">
          <TabsList className="w-full h-7 mb-2">
            <TabsTrigger value="cantrips" className="text-xs flex-1">
              Cantrips ({cantrips.length})
            </TabsTrigger>
            <TabsTrigger value="spells" className="text-xs flex-1">
              Spells ({leveledSpells.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cantrips" className="mt-0">
            <ScrollArea className="h-[120px]">
              <div className="space-y-1">
                {cantrips.map(cs => {
                  const SchoolIcon = SCHOOL_ICONS[cs.spell.school] || Wand2;
                  const DamageIcon = cs.spell.damageType ? DAMAGE_ICONS[cs.spell.damageType] : null;
                  
                  return (
                    <TooltipProvider key={cs.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start h-7 text-xs px-2"
                            onClick={() => handleCastSpell(cs.spell)}
                          >
                            <SchoolIcon className="h-3 w-3 mr-1.5 text-purple-500" />
                            <span className="flex-1 text-left truncate">{cs.spell.name}</span>
                            {DamageIcon && <DamageIcon className="h-3 w-3 text-red-500" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                          <p className="font-bold">{cs.spell.name}</p>
                          <p className="text-xs">{cs.spell.castingTime} | {cs.spell.range}</p>
                          {cs.spell.damageDice && (
                            <p className="text-xs text-red-400">{cs.spell.damageDice} {cs.spell.damageType}</p>
                          )}
                          <p className="text-xs mt-1 opacity-80">{cs.spell.description.slice(0, 100)}...</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
                {cantrips.length === 0 && (
                  <p className="text-xs text-center text-gray-500 py-2">No cantrips known</p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="spells" className="mt-0">
            <ScrollArea className="h-[120px]">
              <div className="space-y-1">
                {leveledSpells.map(cs => {
                  const { canCast, reason } = canCastSpell(cs.spell);
                  const SchoolIcon = SCHOOL_ICONS[cs.spell.school] || Wand2;
                  const StatusIcon = canCast ? CheckCircle : reason === "Not prepared" ? Lock : XCircle;
                  
                  return (
                    <TooltipProvider key={cs.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`w-full justify-start h-7 text-xs px-2 ${
                              !canCast ? 'opacity-50' : ''
                            }`}
                            onClick={() => canCast && handleCastSpell(cs.spell)}
                            disabled={!canCast}
                          >
                            <SchoolIcon className="h-3 w-3 mr-1.5 text-purple-500" />
                            <span className="flex-1 text-left truncate">{cs.spell.name}</span>
                            <Badge variant="outline" className="h-4 px-1 text-[10px]">
                              Lv{cs.spell.level}
                            </Badge>
                            <StatusIcon className={`h-3 w-3 ml-1 ${
                              canCast ? 'text-green-500' : 'text-gray-400'
                            }`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                          <p className="font-bold">{cs.spell.name}</p>
                          <p className="text-xs">Level {cs.spell.level} | {cs.spell.castingTime} | {cs.spell.range}</p>
                          {cs.spell.concentration && <Badge className="text-[10px] h-4">Concentration</Badge>}
                          {cs.spell.damageDice && (
                            <p className="text-xs text-red-400">{cs.spell.damageDice} {cs.spell.damageType}</p>
                          )}
                          {cs.spell.healingDice && (
                            <p className="text-xs text-green-400">{cs.spell.healingDice} healing</p>
                          )}
                          {!canCast && <p className="text-xs text-red-400 mt-1">{reason}</p>}
                          <p className="text-xs mt-1 opacity-80">{cs.spell.description.slice(0, 100)}...</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
                {leveledSpells.length === 0 && (
                  <p className="text-xs text-center text-gray-500 py-2">
                    {showAllSpells ? "No spells known" : "No spells prepared"}
                  </p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
