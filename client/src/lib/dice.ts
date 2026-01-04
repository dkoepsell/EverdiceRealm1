import { apiRequest } from "./queryClient";

export type DiceType = "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100";

export interface DiceRoll {
  diceType: DiceType;
  count: number;
  modifier: number;
  purpose?: string;
  characterId?: number;
}

export interface RollBreakdown {
  label: string;
  value: number;
  description?: string;
}

export interface DiceRollResult {
  diceType: DiceType;
  rolls: number[];
  total: number;
  modifier: number;
  purpose?: string;
  isCritical: boolean;
  isFumble: boolean;
  breakdown?: RollBreakdown[];
  advantageState?: 'normal' | 'advantage' | 'disadvantage';
  keptRoll?: number;
  droppedRoll?: number;
  dc?: number;
  success?: boolean;
}

export const rollDice = async (diceRoll: DiceRoll): Promise<DiceRollResult> => {
  try {
    const response = await apiRequest(
      "POST", 
      "/api/dice/roll",
      diceRoll
    );
    
    return await response.json();
  } catch (error) {
    console.error("Error rolling dice:", error);
    throw new Error("Failed to roll dice. Please try again.");
  }
};

// Client-side dice rolling utility (for animation only)
// The real result will come from the server
export const clientRollDice = (diceRoll: DiceRoll): DiceRollResult => {
  // Standardize and verify input parameters
  const diceType = diceRoll.diceType || "d20";
  const count = diceRoll.count || 1;
  const modifier = diceRoll.modifier || 0;
  const purpose = diceRoll.purpose;
  
  // Log the original request
  console.log("Original dice type:", diceRoll.diceType);
  console.log("Final dice type being used:", diceType);
  
  // Get max value based on dice type
  let max = 20; // Default to d20
  if (diceType && diceType.startsWith('d')) {
    max = parseInt(diceType.substring(1));
    if (isNaN(max)) {
      console.warn(`Invalid dice type format: ${diceType}, defaulting to d20`);
      max = 20;
    }
  } else {
    console.warn(`Invalid dice type: ${diceType}, defaulting to d20`);
  }
  
  // Roll the dice the specified number of times (just for animation)
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    const roll = Math.floor(Math.random() * max) + 1;
    rolls.push(roll);
  }
  
  // Calculate total (client-side only - server will return the real result)
  const rollSum = rolls.reduce((sum, roll) => sum + roll, 0);
  const total = rollSum + modifier;
  
  // Check for critical hit or fumble (only applies to d20)
  const isCritical = diceType === "d20" && rolls.some(roll => roll === 20);
  const isFumble = diceType === "d20" && rolls.some(roll => roll === 1);
  
  return {
    diceType,
    rolls,
    total,
    modifier,
    purpose,
    isCritical,
    isFumble
  };
};
