import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { clientRollDice, DiceRoll, DiceRollResult, DiceType } from "@/lib/dice";
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
import { motion, AnimatePresence } from "framer-motion";

const diceTypes: DiceType[] = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];

// Helper function to map database dice rolls to UI dice roll results
const mapDatabaseRollToResult = (dbRoll: any): DiceRollResult => {
  // Calculate if it was a critical hit or fumble (only applies to d20)
  const isCritical = dbRoll.diceType === "d20" && dbRoll.result - (dbRoll.modifier || 0) === 20;
  const isFumble = dbRoll.diceType === "d20" && dbRoll.result - (dbRoll.modifier || 0) === 1;
  
  // For UI presentation, we need to make an educated guess about the dice roll values
  // The database just stores the total, not the individual dice values
  const dieMax = parseInt(dbRoll.diceType.substring(1));
  const count = dbRoll.count || 1;
  const modifier = dbRoll.modifier || 0;
  
  // We don't have the actual rolls, so we'll simulate them for display
  // For actual gameplay, the total is what matters
  const baseValue = dbRoll.result - modifier;
  
  // If it's a critical hit or fumble on d20, we know the exact roll
  let rolls: number[] = [];
  if (isCritical) {
    rolls = [20];
  } else if (isFumble) {
    rolls = [1];
  } else if (count === 1) {
    // For a single die, the roll is just the result minus the modifier
    rolls = [baseValue];
  } else {
    // For multiple dice, distribute evenly (this is just for display)
    const average = Math.floor(baseValue / count);
    rolls = Array(count).fill(average);
    // Adjust the last roll to make the total correct
    const sum = rolls.reduce((a, b) => a + b, 0);
    if (sum !== baseValue) {
      rolls[rolls.length - 1] += (baseValue - sum);
    }
  }
  
  return {
    diceType: dbRoll.diceType as DiceType,
    rolls: rolls,
    total: dbRoll.result,
    modifier: modifier,
    purpose: dbRoll.purpose || undefined,
    isCritical,
    isFumble
  };
};

export default function DiceRoller() {
  const [selectedDiceType, setSelectedDiceType] = useState<DiceType>("d20");
  const [diceCount, setDiceCount] = useState(1);
  const [modifier, setModifier] = useState(0);
  const [purpose, setPurpose] = useState("");
  const [isRolling, setIsRolling] = useState(false);
  const [diceResult, setDiceResult] = useState<DiceRollResult | null>(null);
  const [rollHistory, setRollHistory] = useState<DiceRollResult[]>([]);
  
  const { toast } = useToast();
  
  // Query to fetch dice roll history from the server
  const { data: diceHistory } = useQuery({
    queryKey: ['/api/dice/history'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/dice/history");
      return response.json();
    }
  });
  
  // Update local roll history when server data changes
  useEffect(() => {
    if (diceHistory && Array.isArray(diceHistory)) {
      // Map server data to UI format
      const mappedHistory = diceHistory.map(mapDatabaseRollToResult);
      setRollHistory(mappedHistory);
    }
  }, [diceHistory]);
  
  const saveDiceRoll = useMutation({
    mutationFn: async (diceRoll: DiceRoll) => {
      const response = await apiRequest("POST", "/api/dice/roll", {
        ...diceRoll,
        // Add required fields for database schema
        userId: 1, // Default user
        result: 0, // Will be overwritten by server
        createdAt: new Date().toISOString()
      });
      return response.json();
    },
    onSuccess: () => {
      // Refresh the dice roll history
      queryClient.invalidateQueries({ queryKey: ['/api/dice/history'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save dice roll",
        variant: "destructive",
      });
    }
  });

  const handleRollDice = (diceType: DiceType = selectedDiceType) => {
    setIsRolling(true);
    
    // Show animation for 1.5 seconds
    setTimeout(() => {
      const diceRoll: DiceRoll = {
        diceType,
        count: diceCount,
        modifier,
        purpose: purpose || undefined,
      };
      
      // Roll dice client-side for instant feedback
      const result = clientRollDice(diceRoll);
      
      // Update UI with the result
      setDiceResult(result);
      
      // Create server roll record with the same result to ensure consistency
      const serverRoll = {
        diceType,
        count: diceCount,
        modifier,
        purpose: purpose || undefined,
        result: result.total,  // Store the actual roll result
        userId: 1,  // Default user
        createdAt: new Date().toISOString()
      };
      
      // Save roll to server - this will also update the history via the useQuery
      fetch('/api/dice/roll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverRoll)
      })
      .then(() => {
        // Refresh dice history after successful save
        queryClient.invalidateQueries({ queryKey: ['/api/dice/history'] });
      })
      .catch(err => {
        console.error("Failed to save dice roll:", err);
        toast({
          title: "Error",
          description: "Failed to save dice roll to history",
          variant: "destructive",
        });
      });
      
      // Animation complete
      setIsRolling(false);
      
      // Show toast for natural 20 or natural 1
      if (result.isCritical) {
        toast({
          title: "Critical Hit!",
          description: `You rolled a natural 20 on your ${diceType} roll!`,
          variant: "default",
        });
      } else if (result.isFumble) {
        toast({
          title: "Critical Fail!",
          description: `You rolled a natural 1 on your ${diceType} roll.`,
          variant: "destructive",
        });
      }
      
    }, 1500);
  };

  const handleQuickRoll = (
    diceType: DiceType, 
    count: number = 1, 
    modifier: number = 0, 
    purpose: string = ""
  ) => {
    setSelectedDiceType(diceType);
    setDiceCount(count);
    setModifier(modifier);
    setPurpose(purpose);
    handleRollDice(diceType);
  };

  return (
    <Card className="bg-secondary-light rounded-lg shadow-xl overflow-hidden">
      <CardHeader className="bg-primary">
        <CardTitle className="font-fantasy text-xl font-bold text-white">Dice Roller</CardTitle>
      </CardHeader>
      
      <CardContent className="p-6 grid grid-cols-1 gap-6">
        {/* Dice Selection */}
        <div>
          <h3 className="font-fantasy text-lg font-bold mb-3 text-white">Roll Dice</h3>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {diceTypes.map((diceType) => (
              <Button
                key={diceType}
                variant={selectedDiceType === diceType ? "default" : "outline"}
                className={`text-center font-bold text-sm p-2 ${
                  selectedDiceType === diceType 
                    ? "bg-primary-light hover:bg-primary-dark text-white" 
                    : "bg-parchment hover:bg-parchment-dark text-secondary"
                }`}
                onClick={() => setSelectedDiceType(diceType)}
              >
                {diceType}
              </Button>
            ))}
          </div>
          
          <div className="bg-secondary rounded-lg p-3 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-white font-medium">Custom Roll</span>
              <Button 
                variant="ghost" 
                className="text-gold hover:text-gold-dark transition text-sm"
                onClick={() => handleRollDice()}
                disabled={isRolling}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"></path>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg> Roll
              </Button>
            </div>
            <div className="flex space-x-2 items-center">
              <Input
                type="number"
                min={1}
                max={10}
                value={diceCount}
                onChange={(e) => setDiceCount(parseInt(e.target.value) || 1)}
                className="w-16 bg-secondary-light border border-gray-700 rounded-lg px-2 py-1 text-center text-white"
              />
              <Select value={selectedDiceType} onValueChange={(value) => setSelectedDiceType(value as DiceType)}>
                <SelectTrigger className="bg-secondary-light border border-gray-700 rounded-lg text-white">
                  <SelectValue placeholder={selectedDiceType} />
                </SelectTrigger>
                <SelectContent>
                  {diceTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-white self-center">+</span>
              <Input
                type="number"
                value={modifier}
                onChange={(e) => setModifier(parseInt(e.target.value) || 0)}
                className="w-16 bg-secondary-light border border-gray-700 rounded-lg px-2 py-1 text-center text-white"
              />
            </div>
            
            <div className="mt-3">
              <Input
                type="text"
                placeholder="Purpose (e.g. Attack Roll)"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full bg-secondary-light border border-gray-700 rounded-lg px-2 py-1 text-white"
              />
            </div>
          </div>
          
          <div className="bg-secondary rounded-lg p-3">
            <h4 className="text-white font-medium mb-2">Common Rolls</h4>
            <div className="flex flex-wrap gap-2">
              <Button 
                className="bg-primary-light hover:bg-primary text-white p-1 rounded-lg transition text-xs"
                onClick={() => handleQuickRoll("d20", 1, 3, "Attack Roll")}
              >
                Attack (d20+3)
              </Button>
              <Button 
                className="bg-primary-light hover:bg-primary text-white p-1 rounded-lg transition text-xs"
                onClick={() => handleQuickRoll("d8", 1, 3, "Damage")}
              >
                Damage (1d8+3)
              </Button>
              <Button 
                className="bg-primary-light hover:bg-primary text-white p-1 rounded-lg transition text-xs"
                onClick={() => handleQuickRoll("d20", 1, 5, "Skill Check")}
              >
                Skill (d20+5)
              </Button>
              <Button 
                className="bg-primary-light hover:bg-primary text-white p-1 rounded-lg transition text-xs"
                onClick={() => handleQuickRoll("d20", 1, 2, "Saving Throw")}
              >
                Save (d20+2)
              </Button>
            </div>
          </div>
        </div>
        
        {/* Dice Results */}
        <div>
          <h3 className="font-fantasy text-lg font-bold mb-3 text-white">Results</h3>
          
          {/* 3D Dice Visualization */}
          <div className="dice-container relative h-40 flex items-center justify-center mb-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={isRolling ? "rolling" : "result"}
                initial={{ scale: 0.8, rotateX: 0, rotateY: 0, rotateZ: 0 }}
                animate={
                  isRolling
                    ? {
                        scale: 1,
                        rotateX: [0, 180, 360, 540, 720],
                        rotateY: [0, 90, 180, 270, 360],
                        rotateZ: [0, 45, 90, 135, 180],
                        transition: { duration: 1.5, ease: "easeOut" }
                      }
                    : { scale: 1, rotateX: 0, rotateY: 0, rotateZ: 0 }
                }
                exit={{ scale: 0.8 }}
                className={`dice w-24 h-24 relative bg-parchment rounded-xl flex items-center justify-center 
                  ${diceResult?.isCritical ? "bg-gold" : ""}`}
              >
                <span className="text-primary font-fantasy text-4xl font-bold">
                  {diceResult ? diceResult.rolls[0] : "?"}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>
          
          {diceResult && (
            <div className="mb-4 bg-secondary rounded-lg p-3">
              <div className="text-center mb-3">
                <p className={`text-2xl font-bold ${diceResult.isCritical ? 'text-gold' : diceResult.isFumble ? 'text-red-500' : 'text-white'}`}>
                  Total: {diceResult.total}
                </p>
                {diceResult.purpose && (
                  <p className="text-gray-300 text-sm mt-1">{diceResult.purpose}</p>
                )}
              </div>
              
              <div className="bg-secondary-light rounded p-2 text-sm space-y-1" data-testid="roll-breakdown">
                <p className="text-gold font-medium mb-2 text-xs uppercase tracking-wide">Roll Breakdown</p>
                
                <div className="flex justify-between text-gray-300">
                  <span className="flex items-center gap-1">
                    <span className="text-amber-400">🎲</span>
                    {diceResult.rolls.length > 1 ? `${diceResult.rolls.length}${diceResult.diceType}` : diceResult.diceType}
                  </span>
                  <span className="font-mono text-white">[{diceResult.rolls.join(', ')}]</span>
                </div>
                
                <div className="flex justify-between text-gray-300">
                  <span>Base Roll</span>
                  <span className="font-mono text-white">{diceResult.rolls.reduce((a, b) => a + b, 0)}</span>
                </div>
                
                {diceResult.modifier !== 0 && (
                  <div className="flex justify-between text-gray-300">
                    <span className="flex items-center gap-1">
                      <span className="text-blue-400">+</span>
                      Modifier
                      <span className="text-xs text-gray-500">(ability/proficiency)</span>
                    </span>
                    <span className={`font-mono ${diceResult.modifier >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {diceResult.modifier >= 0 ? '+' : ''}{diceResult.modifier}
                    </span>
                  </div>
                )}
                
                <div className="border-t border-gray-600 my-2"></div>
                
                <div className="flex justify-between font-bold">
                  <span className="text-white">Final Result</span>
                  <span className={`font-mono ${diceResult.isCritical ? 'text-gold' : diceResult.isFumble ? 'text-red-500' : 'text-white'}`}>
                    = {diceResult.total}
                  </span>
                </div>
                
                {diceResult.isCritical && (
                  <div className="bg-gold/20 text-gold p-2 rounded text-xs mt-2">
                    <strong>Natural 20!</strong> Critical success - attacks deal double dice damage!
                  </div>
                )}
                
                {diceResult.isFumble && (
                  <div className="bg-red-900/30 text-red-400 p-2 rounded text-xs mt-2">
                    <strong>Natural 1!</strong> Critical failure - automatic miss on attacks.
                  </div>
                )}
                
                <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-700">
                  <p className="font-medium text-gray-400 mb-1">D&D Mechanics:</p>
                  <p>• Roll {diceResult.diceType} = random 1 to {parseInt(diceResult.diceType.substring(1))}</p>
                  {diceResult.modifier !== 0 && <p>• Modifier adds bonuses from abilities and proficiency</p>}
                  {diceResult.diceType === 'd20' && <p>• d20 rolls determine success vs Difficulty Class (DC)</p>}
                </div>
              </div>
            </div>
          )}
          
          {/* Roll History */}
          <div className="bg-secondary rounded-lg p-3 max-h-48 overflow-y-auto scroll-container">
            <h4 className="text-white font-medium mb-2">Roll History</h4>
            {rollHistory.length > 0 ? (
              <div className="space-y-2">
                {rollHistory.map((roll, index) => (
                  <div key={index} className="border-b border-gray-700 pb-2 text-sm" data-testid={`roll-history-${index}`}>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-gold font-medium">
                          {roll.rolls?.length > 1 ? `${roll.rolls.length}${roll.diceType}` : roll.diceType}
                        </span>
                        {roll.purpose && (
                          <span className="text-gray-400 text-xs">({roll.purpose})</span>
                        )}
                      </div>
                      <span className={`font-bold ${roll.isCritical ? "text-gold" : roll.isFumble ? "text-red-500" : "text-white"}`}>
                        {roll.total}
                        {roll.isCritical && " ⭐"}
                        {roll.isFumble && " ❌"}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 font-mono">
                      [{roll.rolls?.join(', ') || '?'}]{roll.modifier !== 0 && ` ${roll.modifier >= 0 ? '+' : ''}${roll.modifier}`} = {roll.total}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-2">No roll history yet</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
