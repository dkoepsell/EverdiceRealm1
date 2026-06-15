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

    const result = await response.json();
    // Play a dice-roll sound effect app-wide (AudioEventBridge listens for this).
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("dice_roll_result", { detail: result }));
    }
    return result;
  } catch (error) {
    console.error("Error rolling dice:", error);
    throw new Error("Failed to roll dice. Please try again.");
  }
};

// Parse dice notation like "3d6", "2d8+2", "1d10" and roll
export interface SpellDamageResult {
  diceRolls: number[];
  diceType: string;
  modifier: number;
  total: number;
  isCritical: boolean;
  damageType?: string;
}

export const parseAndRollDice = (
  diceNotation: string, 
  isCritical: boolean = false,
  damageType?: string
): SpellDamageResult => {
  // Normalize: remove all spaces and handle common formats
  const normalized = diceNotation.replace(/\s+/g, '').toLowerCase();
  
  // Parse notation like "3d6", "2d8+2", "1d10-1", "2d6+3"
  const match = normalized.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  
  if (!match) {
    // Fallback for invalid notation
    console.warn(`Invalid dice notation: ${diceNotation}`);
    return {
      diceRolls: [0],
      diceType: 'd6',
      modifier: 0,
      total: 0,
      isCritical,
      damageType
    };
  }
  
  let numDice = parseInt(match[1]);
  const diceSize = parseInt(match[2]);
  const modifier = match[3] ? parseInt(match[3]) : 0;
  
  // Double dice on critical hit (D&D 5e rules)
  if (isCritical) {
    numDice *= 2;
  }
  
  // Roll the dice
  const diceRolls: number[] = [];
  for (let i = 0; i < numDice; i++) {
    diceRolls.push(Math.floor(Math.random() * diceSize) + 1);
  }
  
  const rollSum = diceRolls.reduce((sum, roll) => sum + roll, 0);
  const total = rollSum + modifier;
  
  return {
    diceRolls,
    diceType: `d${diceSize}`,
    modifier,
    total: Math.max(0, total), // Damage can't be negative
    isCritical,
    damageType
  };
};

// Roll a spell attack (d20 + spellcasting modifier)
export interface SpellAttackResult {
  roll: number;
  modifier: number;
  total: number;
  isCritical: boolean;
  isCriticalMiss: boolean;
}

export const rollSpellAttack = (spellcastingModifier: number): SpellAttackResult => {
  const roll = Math.floor(Math.random() * 20) + 1;
  return {
    roll,
    modifier: spellcastingModifier,
    total: roll + spellcastingModifier,
    isCritical: roll === 20,
    isCriticalMiss: roll === 1
  };
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
