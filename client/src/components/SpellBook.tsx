import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  BookOpen, Sparkles, Flame, Snowflake, Zap, Heart, Shield, 
  Eye, Moon, Wand2, ChevronDown, ChevronRight, Star, Clock, 
  Target, Circle, Search, Plus, Check, X, RefreshCw
} from "lucide-react";

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
  higherLevels?: string;
  classes: string[];
  damageType?: string;
  damageDice?: string;
  healingDice?: string;
  savingThrow?: string;
  ritual?: boolean;
  concentration?: boolean;
}

interface CharacterSpell {
  id: number;
  characterId: number;
  spellId: number;
  source: string;
  isPrepared: boolean;
  inSpellbook: boolean;
  acquiredAt: string;
  acquiredLevel: number;
  acquisitionStory?: string;
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
  lastLongRest?: string;
}

interface SpellBookProps {
  characterId: number;
  characterClass: string;
  characterLevel: number;
  characterName: string;
  readOnly?: boolean;
  compact?: boolean;
}

const SCHOOL_COLORS: Record<string, string> = {
  abjuration: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  conjuration: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  divination: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  enchantment: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  evocation: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  illusion: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  necromancy: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  transmutation: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const SCHOOL_ICONS: Record<string, any> = {
  abjuration: Shield,
  conjuration: Circle,
  divination: Eye,
  enchantment: Heart,
  evocation: Flame,
  illusion: Moon,
  necromancy: Sparkles,
  transmutation: RefreshCw,
};

const DAMAGE_TYPE_ICONS: Record<string, any> = {
  fire: Flame,
  cold: Snowflake,
  lightning: Zap,
  radiant: Star,
  necrotic: Moon,
  force: Target,
  thunder: Zap,
  poison: Circle,
  psychic: Eye,
  acid: Circle,
};

function getMinCasterLevel(characterClass: string, spellLevel: number): number {
  if (spellLevel === 0) return 1;
  
  const halfCasters = ['paladin', 'ranger'];
  const isHalfCaster = halfCasters.includes(characterClass.toLowerCase());
  
  if (isHalfCaster) {
    const halfCasterLevels: Record<number, number> = {
      1: 2, 2: 5, 3: 9, 4: 13, 5: 17
    };
    return halfCasterLevels[spellLevel] ?? -1;
  }
  
  const warlockLevels: Record<number, number> = {
    1: 1, 2: 3, 3: 5, 4: 7, 5: 9
  };
  if (characterClass.toLowerCase() === 'warlock') {
    return warlockLevels[spellLevel] ?? -1;
  }
  
  const fullCasterLevels: Record<number, number> = {
    1: 1, 2: 3, 3: 5, 4: 7, 5: 9, 6: 11, 7: 13, 8: 15, 9: 17
  };
  return fullCasterLevels[spellLevel] ?? 1;
}

function isSpellLevelAvailable(characterClass: string, spellLevel: number): boolean {
  const minLevel = getMinCasterLevel(characterClass, spellLevel);
  return minLevel > 0;
}

function SpellCard({ 
  spell, 
  isKnown, 
  isPrepared, 
  onLearn, 
  onPrepare, 
  onForget,
  showActions = true,
  expanded = false 
}: { 
  spell: Spell;
  isKnown?: boolean;
  isPrepared?: boolean;
  onLearn?: () => void;
  onPrepare?: (prepared: boolean) => void;
  onForget?: () => void;
  showActions?: boolean;
  expanded?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(expanded);
  const SchoolIcon = SCHOOL_ICONS[spell.school] || Wand2;
  const DamageIcon = spell.damageType ? DAMAGE_TYPE_ICONS[spell.damageType] || Flame : null;
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={`mb-2 ${isPrepared ? 'ring-2 ring-amber-400' : ''}`}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <SchoolIcon className="h-4 w-4" />
                <span className="font-semibold">{spell.name}</span>
                {spell.level === 0 ? (
                  <Badge variant="secondary" className="text-xs">Cantrip</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">Level {spell.level}</Badge>
                )}
                {spell.concentration && (
                  <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-950">C</Badge>
                )}
                {spell.ritual && (
                  <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950">R</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge className={SCHOOL_COLORS[spell.school] || "bg-gray-100"}>
                  {spell.school}
                </Badge>
                {isPrepared && (
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    Prepared
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-sm">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-gray-500" />
                <span className="text-gray-600 dark:text-gray-400">{spell.castingTime}</span>
              </div>
              <div className="flex items-center gap-1">
                <Target className="h-3 w-3 text-gray-500" />
                <span className="text-gray-600 dark:text-gray-400">{spell.range}</span>
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                <span className="font-medium">Components:</span> {spell.components}
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                <span className="font-medium">Duration:</span> {spell.duration}
              </div>
            </div>
            
            {(spell.damageType || spell.healingDice) && (
              <div className="flex items-center gap-2 mb-2">
                {spell.damageType && DamageIcon && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <DamageIcon className="h-3 w-3" />
                    {spell.damageDice} {spell.damageType}
                  </Badge>
                )}
                {spell.healingDice && (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    {spell.healingDice} healing
                  </Badge>
                )}
                {spell.savingThrow && (
                  <Badge variant="outline">{spell.savingThrow} Save</Badge>
                )}
              </div>
            )}
            
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              {spell.description}
            </p>
            
            {spell.higherLevels && (
              <p className="text-sm text-purple-700 dark:text-purple-300 italic">
                <strong>At Higher Levels:</strong> {spell.higherLevels}
              </p>
            )}
            
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
              <span>Classes:</span>
              {spell.classes.map(c => (
                <Badge key={c} variant="outline" className="text-xs capitalize">{c}</Badge>
              ))}
            </div>
            
            {showActions && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                {!isKnown && onLearn && (
                  <Button size="sm" onClick={onLearn}>
                    <Plus className="h-3 w-3 mr-1" />
                    Learn Spell
                  </Button>
                )}
                {isKnown && onPrepare && spell.level > 0 && (
                  <Button 
                    size="sm" 
                    variant={isPrepared ? "destructive" : "default"}
                    onClick={() => onPrepare(!isPrepared)}
                  >
                    {isPrepared ? (
                      <>
                        <X className="h-3 w-3 mr-1" />
                        Unprepare
                      </>
                    ) : (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Prepare
                      </>
                    )}
                  </Button>
                )}
                {isKnown && onForget && (
                  <Button size="sm" variant="ghost" onClick={onForget}>
                    Forget
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function SpellSlotTracker({ slots, characterId, onSlotUsed }: { 
  slots: SpellSlots; 
  characterId: number;
  onSlotUsed?: () => void;
}) {
  const useSlotMutation = useMutation({
    mutationFn: async (slotLevel: number) => {
      return apiRequest('POST', `/api/characters/${characterId}/spell-slots/use`, { slotLevel });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/characters/${characterId}/spell-slots`] });
      onSlotUsed?.();
    }
  });
  
  const resetSlotsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/characters/${characterId}/spell-slots/reset`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/characters/${characterId}/spell-slots`] });
    }
  });
  
  const slotLevels = [
    { level: 1, max: slots.slotsLevel1Max, used: slots.slotsLevel1Used },
    { level: 2, max: slots.slotsLevel2Max, used: slots.slotsLevel2Used },
    { level: 3, max: slots.slotsLevel3Max, used: slots.slotsLevel3Used },
    { level: 4, max: slots.slotsLevel4Max, used: slots.slotsLevel4Used },
    { level: 5, max: slots.slotsLevel5Max, used: slots.slotsLevel5Used },
    { level: 6, max: slots.slotsLevel6Max, used: slots.slotsLevel6Used },
    { level: 7, max: slots.slotsLevel7Max, used: slots.slotsLevel7Used },
    { level: 8, max: slots.slotsLevel8Max, used: slots.slotsLevel8Used },
    { level: 9, max: slots.slotsLevel9Max, used: slots.slotsLevel9Used },
  ].filter(s => s.max > 0);
  
  return (
    <Card className="mb-4">
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Spell Slots
          </CardTitle>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => resetSlotsMutation.mutate()}
            disabled={resetSlotsMutation.isPending}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Long Rest
          </Button>
        </div>
      </CardHeader>
      <CardContent className="py-2">
        <div className="flex flex-wrap gap-3">
          {slotLevels.map(({ level, max, used }) => (
            <div key={level} className="flex flex-col items-center">
              <span className="text-xs font-medium text-gray-500 mb-1">Level {level}</span>
              <div className="flex gap-1">
                {Array.from({ length: max }).map((_, i) => (
                  <button
                    key={i}
                    className={`w-6 h-6 rounded-full border-2 transition-colors ${
                      i < max - used 
                        ? 'bg-purple-500 border-purple-600 hover:bg-purple-600' 
                        : 'bg-gray-200 border-gray-300 dark:bg-gray-700 dark:border-gray-600'
                    }`}
                    onClick={() => i < max - used && useSlotMutation.mutate(level)}
                    disabled={i >= max - used || useSlotMutation.isPending}
                    title={i < max - used ? `Use level ${level} slot` : 'Slot used'}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-400 mt-1">{max - used}/{max}</span>
            </div>
          ))}
        </div>
        {slots.lastLongRest && (
          <p className="text-xs text-gray-500 mt-2">
            Last rest: {new Date(slots.lastLongRest).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function SpellBook({ 
  characterId, 
  characterClass, 
  characterLevel, 
  characterName,
  readOnly = false,
  compact = false
}: SpellBookProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [showLearnDialog, setShowLearnDialog] = useState(false);
  const [showClassSpells, setShowClassSpells] = useState(false);
  
  const { data: knownSpells = [], isLoading: loadingKnown } = useQuery<CharacterSpell[]>({
    queryKey: [`/api/characters/${characterId}/spells`],
  });
  
  const { data: allClassSpells = [], isLoading: loadingClassSpells } = useQuery<Spell[]>({
    queryKey: [`/api/spells?className=${characterClass.toLowerCase()}`],
    enabled: showClassSpells,
  });
  
  const { data: spellSlots } = useQuery<SpellSlots>({
    queryKey: [`/api/characters/${characterId}/spell-slots`],
  });
  
  const { data: availableData, isLoading: loadingAvailable } = useQuery<{
    spells: Spell[];
    knownCount: number;
  }>({
    queryKey: [`/api/characters/${characterId}/available-spells`],
    enabled: showLearnDialog,
  });
  
  const learnSpellMutation = useMutation({
    mutationFn: async ({ spellId, source }: { spellId: number; source?: string }) => {
      return apiRequest('POST', `/api/characters/${characterId}/spells`, { spellId, source: source || 'class' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/characters/${characterId}/spells`] });
      queryClient.invalidateQueries({ queryKey: [`/api/characters/${characterId}/available-spells`] });
    }
  });
  
  const prepareSpellMutation = useMutation({
    mutationFn: async ({ spellId, prepared }: { spellId: number; prepared: boolean }) => {
      return apiRequest('PATCH', `/api/characters/${characterId}/spells/${spellId}/prepare`, { prepared });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/characters/${characterId}/spells`] });
    }
  });
  
  const forgetSpellMutation = useMutation({
    mutationFn: async (spellId: number) => {
      return apiRequest('DELETE', `/api/characters/${characterId}/spells/${spellId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/characters/${characterId}/spells`] });
      queryClient.invalidateQueries({ queryKey: [`/api/characters/${characterId}/available-spells`] });
    }
  });
  
  const filteredKnownSpells = knownSpells.filter(cs => {
    const spell = cs.spell;
    if (searchTerm && !spell.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (levelFilter !== "all" && spell.level !== parseInt(levelFilter)) return false;
    if (schoolFilter !== "all" && spell.school !== schoolFilter) return false;
    return true;
  });
  
  const cantrips = filteredKnownSpells.filter(cs => cs.spell.level === 0);
  const spellsByLevel = Array.from({ length: 9 }, (_, i) => ({
    level: i + 1,
    spells: filteredKnownSpells.filter(cs => cs.spell.level === i + 1)
  })).filter(group => group.spells.length > 0);
  
  const preparedCount = knownSpells.filter(cs => cs.isPrepared && cs.spell.level > 0).length;
  
  if (loadingKnown) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className={compact ? "" : "space-y-4"}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-purple-500" />
                {characterName}'s Spellbook
              </CardTitle>
              <CardDescription>
                {characterClass} Level {characterLevel} - {knownSpells.length} spells known
              </CardDescription>
            </div>
            {!readOnly && (
              <Dialog open={showLearnDialog} onOpenChange={setShowLearnDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-1" />
                    Learn Spell
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>Learn New Spells</DialogTitle>
                    <DialogDescription>
                      Choose from spells available to your class and level
                    </DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="h-[60vh]">
                    {loadingAvailable ? (
                      <div className="text-center py-8">Loading available spells...</div>
                    ) : availableData?.spells.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        You already know all available spells for your class and level!
                      </div>
                    ) : (
                      <div className="space-y-2 pr-4">
                        {availableData?.spells.map((spell: any) => (
                          <SpellCard
                            key={spell.name}
                            spell={spell as Spell}
                            isKnown={false}
                            onLearn={() => {
                              const spellFromDb = knownSpells.find(ks => ks.spell.name === spell.name);
                              if (!spellFromDb) {
                                fetch(`/api/spells?className=${characterClass.toLowerCase()}`)
                                  .then(r => r.json())
                                  .then((allSpells: Spell[]) => {
                                    const dbSpell = allSpells.find(s => s.name === spell.name);
                                    if (dbSpell) {
                                      learnSpellMutation.mutate({ spellId: dbSpell.id });
                                    }
                                  });
                              }
                            }}
                            showActions={true}
                          />
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {spellSlots && <SpellSlotTracker slots={spellSlots} characterId={characterId} />}
          
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search spells..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="0">Cantrips</SelectItem>
                {[1,2,3,4,5,6,7,8,9].map(l => (
                  <SelectItem key={l} value={l.toString()}>Level {l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={schoolFilter} onValueChange={setSchoolFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="School" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Schools</SelectItem>
                {Object.keys(SCHOOL_COLORS).map(school => (
                  <SelectItem key={school} value={school} className="capitalize">{school}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {preparedCount > 0 && (
            <div className="text-sm text-amber-700 dark:text-amber-300 mb-3">
              <Sparkles className="inline h-4 w-4 mr-1" />
              {preparedCount} spell{preparedCount !== 1 ? 's' : ''} prepared
            </div>
          )}
          
          <Tabs defaultValue="all" className="w-full" onValueChange={(val) => setShowClassSpells(val === 'class-spells')}>
            <TabsList className="mb-3 flex-wrap h-auto gap-1">
              <TabsTrigger value="all">All ({filteredKnownSpells.length})</TabsTrigger>
              <TabsTrigger value="prepared">Prepared ({knownSpells.filter(cs => cs.isPrepared).length})</TabsTrigger>
              <TabsTrigger value="cantrips">Cantrips ({cantrips.length})</TabsTrigger>
              <TabsTrigger value="class-spells" className="text-purple-600 dark:text-purple-400">
                Class Spells
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="all">
              <ScrollArea className="h-[400px] pr-4">
                {cantrips.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-1">
                      <Star className="h-4 w-4" /> Cantrips
                    </h3>
                    {cantrips.map(cs => (
                      <SpellCard
                        key={cs.id}
                        spell={cs.spell}
                        isKnown={true}
                        isPrepared={true}
                        onPrepare={readOnly ? undefined : (prepared) => prepareSpellMutation.mutate({ spellId: cs.spellId, prepared })}
                        onForget={readOnly ? undefined : () => forgetSpellMutation.mutate(cs.spellId)}
                        showActions={!readOnly}
                      />
                    ))}
                  </div>
                )}
                {spellsByLevel.map(({ level, spells }) => (
                  <div key={level} className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">
                      Level {level} Spells
                    </h3>
                    {spells.map(cs => (
                      <SpellCard
                        key={cs.id}
                        spell={cs.spell}
                        isKnown={true}
                        isPrepared={cs.isPrepared}
                        onPrepare={readOnly ? undefined : (prepared) => prepareSpellMutation.mutate({ spellId: cs.spellId, prepared })}
                        onForget={readOnly ? undefined : () => forgetSpellMutation.mutate(cs.spellId)}
                        showActions={!readOnly}
                      />
                    ))}
                  </div>
                ))}
                {filteredKnownSpells.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No spells found</p>
                    {!readOnly && (
                      <Button 
                        variant="link" 
                        onClick={() => setShowLearnDialog(true)}
                        className="mt-2"
                      >
                        Learn your first spell
                      </Button>
                    )}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="prepared">
              <ScrollArea className="h-[400px] pr-4">
                {knownSpells.filter(cs => cs.isPrepared).map(cs => (
                  <SpellCard
                    key={cs.id}
                    spell={cs.spell}
                    isKnown={true}
                    isPrepared={true}
                    onPrepare={readOnly ? undefined : (prepared) => prepareSpellMutation.mutate({ spellId: cs.spellId, prepared })}
                    showActions={!readOnly}
                  />
                ))}
                {knownSpells.filter(cs => cs.isPrepared).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No spells prepared. Prepare spells to cast them!
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="cantrips">
              <ScrollArea className="h-[400px] pr-4">
                {cantrips.map(cs => (
                  <SpellCard
                    key={cs.id}
                    spell={cs.spell}
                    isKnown={true}
                    isPrepared={true}
                    showActions={!readOnly}
                  />
                ))}
                {cantrips.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No cantrips known
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="class-spells">
              <ScrollArea className="h-[400px] pr-4">
                {loadingClassSpells ? (
                  <div className="text-center py-8">Loading class spells...</div>
                ) : (
                  <>
                    <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                      <h4 className="font-semibold text-purple-800 dark:text-purple-200 text-sm mb-1">
                        All {characterClass} Spells
                      </h4>
                      <p className="text-xs text-purple-600 dark:text-purple-400">
                        Spells you haven't learned yet are greyed out. Requirements show what level you need to cast them.
                      </p>
                    </div>
                    
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => {
                      const levelSpells = allClassSpells.filter(s => s.level === level);
                      if (levelSpells.length === 0) return null;
                      
                      const minCasterLevel = getMinCasterLevel(characterClass, level);
                      const isAvailableForClass = minCasterLevel > 0;
                      const canAccessLevel = isAvailableForClass && characterLevel >= minCasterLevel;
                      
                      return (
                        <div key={level} className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-gray-500 flex items-center gap-1">
                              {level === 0 ? (
                                <><Star className="h-4 w-4" /> Cantrips</>
                              ) : (
                                <>Level {level} Spells</>
                              )}
                            </h3>
                            {level > 0 && (
                              <Badge 
                                variant={canAccessLevel ? "default" : "secondary"}
                                className={`text-xs ${canAccessLevel ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
                              >
                                {canAccessLevel 
                                  ? '✓ Available' 
                                  : isAvailableForClass 
                                    ? `Requires Level ${minCasterLevel}` 
                                    : 'Not available for class'}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="space-y-1">
                            {levelSpells.map(spell => {
                              const isKnown = knownSpells.some(ks => ks.spell.name === spell.name);
                              const SchoolIcon = SCHOOL_ICONS[spell.school] || Wand2;
                              
                              return (
                                <div 
                                  key={spell.id || spell.name}
                                  className={`flex items-center gap-2 p-2 rounded border ${
                                    isKnown 
                                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                                      : canAccessLevel
                                      ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                      : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 opacity-50'
                                  }`}
                                >
                                  <SchoolIcon className={`h-4 w-4 ${isKnown ? 'text-green-500' : 'text-gray-400'}`} />
                                  <span className={`flex-1 text-sm ${isKnown ? 'font-medium' : ''}`}>
                                    {spell.name}
                                  </span>
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs ${SCHOOL_COLORS[spell.school] || ''}`}
                                  >
                                    {spell.school}
                                  </Badge>
                                  {spell.concentration && (
                                    <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-950">C</Badge>
                                  )}
                                  {spell.ritual && (
                                    <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950">R</Badge>
                                  )}
                                  {isKnown ? (
                                    <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                      <Check className="h-3 w-3 mr-1" />
                                      Known
                                    </Badge>
                                  ) : !isAvailableForClass ? (
                                    <span className="text-xs text-gray-400 italic">
                                      N/A
                                    </span>
                                  ) : canAccessLevel ? (
                                    !readOnly ? (
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="h-6 px-2 text-xs"
                                        onClick={() => {
                                          learnSpellMutation.mutate({ spellId: spell.id });
                                        }}
                                      >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Learn
                                      </Button>
                                    ) : (
                                      <Badge variant="outline" className="text-xs">
                                        Available
                                      </Badge>
                                    )
                                  ) : (
                                    <span className="text-xs text-gray-400">
                                      Lv{minCasterLevel}+
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
