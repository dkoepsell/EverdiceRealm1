import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { clientRollDice, DiceRoll, DiceRollResult, DiceType } from "@/lib/dice";
import { Character } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown, ChevronUp, Sparkles, ScrollText, Dice1, Dice5 } from "lucide-react";

const diceTypes: DiceType[] = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];

const SKILL_PURPOSES = [
  "Athletics", "Acrobatics", "Sleight of Hand", "Stealth",
  "Arcana", "History", "Investigation", "Nature", "Religion",
  "Animal Handling", "Insight", "Medicine", "Perception", "Survival",
  "Deception", "Intimidation", "Performance", "Persuasion"
];

const SKILL_DESCRIPTIONS: Record<string, string> = {
  "Perception": "Often used when searching rooms or noticing danger.",
  "Persuasion": "When trying to convince someone through charm or reason.",
  "Investigation": "For searching for clues or solving puzzles.",
  "Athletics": "Climbing, jumping, swimming, or feats of strength.",
  "Stealth": "Moving silently or hiding from enemies.",
  "Insight": "Reading someone's true intentions or emotions.",
  "Arcana": "Recalling lore about spells, magic, and planes.",
  "Deception": "Convincing others of something untrue."
};

const getSkillAbility = (skill: string): string => {
  const skillMap: Record<string, string> = {
    "Athletics": "Strength",
    "Acrobatics": "Dexterity", "Sleight of Hand": "Dexterity", "Stealth": "Dexterity",
    "Arcana": "Intelligence", "History": "Intelligence", "Investigation": "Intelligence", 
    "Nature": "Intelligence", "Religion": "Intelligence",
    "Animal Handling": "Wisdom", "Insight": "Wisdom", "Medicine": "Wisdom", 
    "Perception": "Wisdom", "Survival": "Wisdom",
    "Deception": "Charisma", "Intimidation": "Charisma", 
    "Performance": "Charisma", "Persuasion": "Charisma"
  };
  return skillMap[skill] || "Unknown";
};

const DieIcon = ({ type, selected, onClick }: { type: DiceType; selected: boolean; onClick: () => void }) => {
  const sides = parseInt(type.slice(1));
  
  const getShape = () => {
    switch(type) {
      case "d4": return "polygon(50% 0%, 0% 100%, 100% 100%)";
      case "d6": return "none";
      case "d8": return "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
      case "d10": return "polygon(50% 0%, 90% 35%, 75% 100%, 25% 100%, 10% 35%)";
      case "d12": return "polygon(50% 0%, 85% 20%, 100% 55%, 75% 95%, 25% 95%, 0% 55%, 15% 20%)";
      case "d20": return "polygon(50% 0%, 95% 30%, 80% 90%, 20% 90%, 5% 30%)";
      case "d100": return "none";
      default: return "none";
    }
  };
  
  return (
    <button
      onClick={onClick}
      className={`
        relative w-16 h-16 flex items-center justify-center
        transition-all duration-200 transform
        ${selected 
          ? 'scale-110 z-10' 
          : 'hover:scale-105'
        }
      `}
    >
      <div 
        className={`
          w-14 h-14 flex items-center justify-center
          rounded-lg transition-all duration-200
          ${type === "d6" || type === "d100" ? "rounded-lg" : ""}
          ${selected 
            ? 'bg-gradient-to-br from-amber-200 to-amber-400 shadow-lg shadow-amber-500/50 ring-2 ring-amber-400' 
            : 'bg-gradient-to-br from-stone-200 to-stone-300 dark:from-stone-600 dark:to-stone-700 hover:from-amber-100 hover:to-amber-200'
          }
        `}
        style={{ 
          clipPath: type !== "d6" && type !== "d100" ? getShape() : undefined,
          boxShadow: selected ? 'inset 0 -3px 6px rgba(0,0,0,0.2), 0 4px 12px rgba(217,119,6,0.4)' : 'inset 0 -2px 4px rgba(0,0,0,0.1)'
        }}
      >
        <span className={`font-bold text-sm ${selected ? 'text-amber-900' : 'text-stone-700 dark:text-stone-200'}`}>
          {type}
        </span>
      </div>
      {selected && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-amber-400 rounded-full blur-sm"
        />
      )}
    </button>
  );
};

export default function DiceRoller() {
  const [selectedDiceType, setSelectedDiceType] = useState<DiceType>("d20");
  const [diceCount, setDiceCount] = useState(1);
  const [modifier, setModifier] = useState(0);
  const [purpose, setPurpose] = useState("");
  const [characterId, setCharacterId] = useState<number | undefined>(undefined);
  const [isRolling, setIsRolling] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [diceResult, setDiceResult] = useState<DiceRollResult | null>(null);
  const [rollHistory, setRollHistory] = useState<DiceRollResult[]>([]);
  const [declareRollOpen, setDeclareRollOpen] = useState(false);
  
  const { toast } = useToast();
  
  const { data: characters } = useQuery<Character[]>({
    queryKey: ['/api/characters'],
  });
  
  const { data: savedRolls, isLoading: isLoadingRolls } = useQuery<DiceRollResult[]>({
    queryKey: ['/api/dice/history'],
  });
  
  useEffect(() => {
    if (savedRolls && savedRolls.length > 0) {
      setRollHistory(savedRolls);
    }
  }, [savedRolls]);

  const saveDiceRoll = useMutation({
    mutationFn: async (diceRoll: DiceRoll) => {
      const response = await apiRequest("POST", "/api/dice/roll", diceRoll);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/dice/history'] });
      setRollHistory(prev => [data, ...prev].slice(0, 10));
    },
  });

  const handleRollDice = (diceType: DiceType = selectedDiceType) => {
    setIsRolling(true);
    setShowResult(false);
    
    setTimeout(() => {
      const diceRoll: DiceRoll = {
        diceType,
        count: diceCount,
        modifier,
        purpose: purpose || undefined,
        characterId: characterId || undefined
      };
      
      const result = clientRollDice(diceRoll);
      setDiceResult(result);
      saveDiceRoll.mutate(diceRoll);
      setIsRolling(false);
      
      setTimeout(() => {
        setShowResult(true);
        
        if (result.isCritical) {
          toast({
            title: "Natural 20!",
            description: "The dice favor you today, adventurer!",
            variant: "default",
          });
        } else if (result.isFumble) {
          toast({
            title: "Natural 1...",
            description: "Even heroes stumble sometimes.",
            variant: "destructive",
          });
        }
      }, 300);
      
    }, 1200);
  };

  const handleQuickRoll = (
    diceType: DiceType, 
    count: number = 1, 
    mod: number = 0, 
    purposeText: string = ""
  ) => {
    setSelectedDiceType(diceType);
    setDiceCount(count);
    setModifier(mod);
    setPurpose(purposeText);
    handleRollDice(diceType);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <section className="relative bg-gradient-to-br from-slate-900 via-amber-900/20 to-slate-900 py-8 md:py-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl"></div>
        <div className="absolute top-6 right-8 md:right-16 opacity-15">
          <Dice5 className="h-14 w-14 md:h-20 md:w-20 text-amber-400" />
        </div>
        <div className="absolute top-16 right-20 md:right-40 opacity-10">
          <Dice1 className="h-10 w-10 md:h-16 md:w-16 text-orange-300 rotate-12" />
        </div>
        <div className="absolute bottom-6 right-12 md:right-28 opacity-10">
          <Sparkles className="h-12 w-12 md:h-16 md:w-16 text-amber-300" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
              <Dice5 className="h-3 w-3" />
              <span>Shared Table Tool</span>
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-fantasy font-bold text-white mb-2">Dice Tray</h1>
          <p className="text-white/60">Roll the bones and let fate decide</p>
        </div>
      </section>
      
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card 
            className="relative rounded-xl shadow-xl overflow-hidden border-2 border-amber-900/30 bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
            <CardHeader className="relative bg-gradient-to-r from-amber-900/80 to-orange-900/60 border-b border-amber-700/30">
              <CardTitle className="font-fantasy text-xl font-bold text-amber-100 flex items-center gap-2">
                <Dice5 className="h-5 w-5" />
                Dice Tray
              </CardTitle>
            </CardHeader>
            
            <CardContent className="relative p-6">
              <h3 className="font-fantasy text-lg font-bold mb-4 text-amber-200/90">Choose Your Die</h3>
              <div className="flex flex-wrap justify-center gap-2 mb-6 p-4 rounded-xl bg-black/20 border border-amber-900/20">
                {diceTypes.map((diceType) => (
                  <DieIcon
                    key={diceType}
                    type={diceType}
                    selected={selectedDiceType === diceType}
                    onClick={() => setSelectedDiceType(diceType)}
                  />
                ))}
              </div>
              
              <div className="flex justify-center mb-6">
                <Button 
                  size="lg"
                  className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold px-8 py-3 rounded-full shadow-lg shadow-amber-900/50 transition-all transform hover:scale-105"
                  onClick={() => handleRollDice()}
                  disabled={isRolling}
                >
                  {isRolling ? (
                    <span className="flex items-center gap-2">
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
                      >
                        <Dice5 className="h-5 w-5" />
                      </motion.span>
                      Rolling...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Dice5 className="h-5 w-5" />
                      Roll {selectedDiceType}
                    </span>
                  )}
                </Button>
              </div>
              
              <Collapsible open={declareRollOpen} onOpenChange={setDeclareRollOpen}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="w-full flex items-center justify-between text-amber-300 hover:text-amber-200 hover:bg-amber-900/20 mb-2"
                  >
                    <span className="flex items-center gap-2">
                      <ScrollText className="h-4 w-4" />
                      Declare a Roll
                    </span>
                    {declareRollOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="bg-black/30 rounded-lg p-4 border border-amber-900/30 space-y-3">
                    <div className="flex space-x-2 items-center">
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={diceCount}
                        onChange={(e) => setDiceCount(parseInt(e.target.value) || 1)}
                        className="w-16 bg-black/40 border-amber-900/40 text-center text-amber-100"
                      />
                      <Select value={selectedDiceType} onValueChange={(value) => setSelectedDiceType(value as DiceType)}>
                        <SelectTrigger className="bg-black/40 border-amber-900/40 text-amber-100 w-24">
                          <SelectValue placeholder={selectedDiceType} />
                        </SelectTrigger>
                        <SelectContent>
                          {diceTypes.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-amber-400 font-bold">+</span>
                      <Input
                        type="number"
                        value={modifier}
                        onChange={(e) => setModifier(parseInt(e.target.value) || 0)}
                        className="w-16 bg-black/40 border-amber-900/40 text-center text-amber-100"
                      />
                    </div>
                    
                    <div className="flex space-x-2">
                      <Input
                        type="text"
                        placeholder="What are you rolling for?"
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        className="flex-1 bg-black/40 border-amber-900/40 text-amber-100 placeholder:text-amber-100/40"
                      />
                      <Select onValueChange={(value) => setPurpose(value)}>
                        <SelectTrigger className="w-32 bg-black/40 border-amber-900/40 text-amber-100">
                          <SelectValue placeholder="Skill" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">Custom</SelectItem>
                          {SKILL_PURPOSES.map((skill) => (
                            <SelectItem key={skill} value={skill}>{skill}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {characters && characters.length > 0 && (
                      <Select 
                        value={characterId?.toString() || "none"}
                        onValueChange={(value) => setCharacterId(value !== "none" ? parseInt(value) : undefined)}
                      >
                        <SelectTrigger className="w-full bg-black/40 border-amber-900/40 text-amber-100">
                          <SelectValue placeholder="Select Character" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Character</SelectItem>
                          {characters.map((character) => (
                            <SelectItem key={character.id} value={character.id.toString()}>
                              {character.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
              
              <div className="mt-4 bg-gradient-to-br from-purple-900/30 to-indigo-900/20 rounded-lg p-4 border border-purple-700/30">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <h4 className="text-purple-200 font-medium">The DM Suggests</h4>
                </div>
                <p className="text-purple-300/60 text-xs mb-3">Try common rolls without pressure</p>
                <TooltipProvider>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { skill: "Perception", mod: 3 },
                      { skill: "Persuasion", mod: 2 },
                      { skill: "Investigation", mod: 4 },
                      { skill: "Athletics", mod: 1 }
                    ].map(({ skill, mod }) => (
                      <Tooltip key={skill}>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="outline"
                            className="bg-purple-900/30 hover:bg-purple-800/40 border-purple-700/40 text-purple-200 hover:text-white text-sm"
                            onClick={() => handleQuickRoll("d20", 1, mod, skill)}
                            disabled={isRolling}
                          >
                            {skill} (d20+{mod})
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[200px]">
                          <p className="text-xs">{SKILL_DESCRIPTIONS[skill] || `${skill} check using ${getSkillAbility(skill)}`}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </TooltipProvider>
              </div>
              
              <p className="text-amber-400/50 text-xs text-center mt-4 italic">
                The DM decides the outcome.
              </p>
            </CardContent>
          </Card>
          
          <Card 
            className="relative rounded-xl shadow-xl overflow-hidden border-2 border-amber-900/30 bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
            <CardHeader className="relative bg-gradient-to-r from-amber-900/80 to-orange-900/60 border-b border-amber-700/30">
              <CardTitle className="font-fantasy text-xl font-bold text-amber-100">The Roll</CardTitle>
            </CardHeader>
            
            <CardContent className="relative p-6">
              <div className="relative h-48 flex flex-col items-center justify-center mb-6">
                <AnimatePresence mode="wait">
                  {isRolling ? (
                    <motion.div
                      key="rolling"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ 
                        scale: [1, 1.1, 1],
                        rotate: [0, 180, 360, 540, 720],
                        opacity: 1
                      }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      className="w-28 h-28 bg-gradient-to-br from-amber-200 to-amber-400 rounded-xl flex items-center justify-center shadow-xl shadow-amber-500/30"
                      style={{
                        boxShadow: 'inset 0 -4px 8px rgba(0,0,0,0.2), 0 8px 24px rgba(217,119,6,0.4)'
                      }}
                    >
                      <motion.span
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 0.3, repeat: Infinity }}
                        className="text-amber-900 font-fantasy text-4xl font-bold"
                      >
                        ?
                      </motion.span>
                    </motion.div>
                  ) : diceResult ? (
                    <motion.div
                      key="result"
                      initial={{ scale: 0.8, opacity: 0, y: 20 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      transition={{ 
                        type: "spring",
                        stiffness: 200,
                        damping: 15
                      }}
                      className={`w-28 h-28 rounded-xl flex items-center justify-center shadow-xl
                        ${diceResult.isCritical 
                          ? 'bg-gradient-to-br from-yellow-300 to-amber-500 shadow-yellow-500/50' 
                          : diceResult.isFumble
                            ? 'bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/50'
                            : 'bg-gradient-to-br from-amber-200 to-amber-400 shadow-amber-500/30'
                        }`}
                      style={{
                        boxShadow: diceResult.isCritical 
                          ? 'inset 0 -4px 8px rgba(0,0,0,0.2), 0 8px 24px rgba(234,179,8,0.6), 0 0 40px rgba(234,179,8,0.3)' 
                          : diceResult.isFumble
                            ? 'inset 0 -4px 8px rgba(0,0,0,0.3), 0 8px 24px rgba(239,68,68,0.5)'
                            : 'inset 0 -4px 8px rgba(0,0,0,0.2), 0 8px 24px rgba(217,119,6,0.4)'
                      }}
                    >
                      <AnimatePresence>
                        {showResult && (
                          <motion.span
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ 
                              type: "spring",
                              stiffness: 300,
                              damping: 10
                            }}
                            className={`font-fantasy text-5xl font-bold
                              ${diceResult.isCritical ? 'text-amber-900' : diceResult.isFumble ? 'text-white' : 'text-amber-900'}`}
                          >
                            {diceResult.rolls[0]}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0.5 }}
                      animate={{ opacity: 1 }}
                      className="w-28 h-28 bg-gradient-to-br from-stone-300 to-stone-400 dark:from-stone-600 dark:to-stone-700 rounded-xl flex items-center justify-center shadow-lg"
                      style={{
                        boxShadow: 'inset 0 -4px 8px rgba(0,0,0,0.15)'
                      }}
                    >
                      <span className="text-stone-500 dark:text-stone-400 font-fantasy text-4xl font-bold">?</span>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {diceResult?.isCritical && showResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -bottom-2"
                  >
                    <Badge className="bg-yellow-500 text-yellow-900 font-bold">
                      NATURAL 20!
                    </Badge>
                  </motion.div>
                )}
                {diceResult?.isFumble && showResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -bottom-2"
                  >
                    <Badge variant="destructive" className="font-bold">
                      Natural 1...
                    </Badge>
                  </motion.div>
                )}
              </div>
              
              {diceResult && showResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 text-center space-y-2"
                >
                  {diceResult.purpose && (
                    <p className="text-xl font-bold text-amber-200">{diceResult.purpose}</p>
                  )}
                  <p className="text-amber-400/70 text-sm">
                    {diceResult.rolls.length > 1 ? `${diceResult.rolls.length}` : ''}{diceResult.diceType}
                    {diceResult.modifier !== 0 && (
                      <span>{diceResult.modifier > 0 ? ` + ${diceResult.modifier}` : ` - ${Math.abs(diceResult.modifier)}`}</span>
                    )}
                    <span className="text-amber-300 font-bold"> → {diceResult.total}</span>
                  </p>
                  {diceResult.rolls.length > 1 && (
                    <p className="text-amber-400/50 text-xs">
                      Individual: [{diceResult.rolls.join(', ')}]
                    </p>
                  )}
                  {diceResult.purpose && SKILL_PURPOSES.includes(diceResult.purpose) && (
                    <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-300">
                      {getSkillAbility(diceResult.purpose)} Check
                    </Badge>
                  )}
                </motion.div>
              )}
              
              <div className="bg-black/30 rounded-lg p-4 border border-amber-900/30 max-h-48 overflow-y-auto">
                <h4 className="text-amber-200 font-medium mb-3 flex items-center gap-2">
                  <ScrollText className="h-4 w-4" />
                  Table Log
                </h4>
                {isLoadingRolls ? (
                  <div className="animate-pulse space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-8 bg-amber-900/20 rounded"></div>
                    ))}
                  </div>
                ) : rollHistory.length > 0 ? (
                  <div className="space-y-2">
                    {rollHistory.map((roll, index) => (
                      <div 
                        key={index} 
                        className="flex justify-between items-start border-b border-amber-900/20 pb-2 last:border-0"
                      >
                        <div className="flex-1">
                          {roll.purpose && (
                            <p className="text-amber-200 text-sm font-medium">{roll.purpose}</p>
                          )}
                          <p className="text-amber-400/60 text-xs">
                            {roll.rolls && roll.rolls.length > 1 ? `${roll.rolls.length}` : ''}{roll.diceType}
                            {roll.modifier !== 0 && (
                              roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier
                            )}
                          </p>
                        </div>
                        <span className={`font-bold text-lg ${
                          roll.isCritical ? "text-yellow-400" : 
                          roll.isFumble ? "text-red-400" : 
                          "text-amber-200"
                        }`}>
                          {roll.total}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-amber-400/40 text-center py-4 text-sm italic">
                    No rolls yet... pick up those dice!
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
