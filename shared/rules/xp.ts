export const XP_THRESHOLDS = [
  0,       // Level 1
  300,     // Level 2
  900,     // Level 3
  2700,    // Level 4
  6500,    // Level 5
  14000,   // Level 6
  23000,   // Level 7
  34000,   // Level 8
  48000,   // Level 9
  64000,   // Level 10
  85000,   // Level 11
  100000,  // Level 12
  120000,  // Level 13
  140000,  // Level 14
  165000,  // Level 15
  195000,  // Level 16
  225000,  // Level 17
  265000,  // Level 18
  305000,  // Level 19
  355000,  // Level 20
];

export const CR_XP_TABLE: Record<string, number> = {
  "0": 10,
  "1/8": 25,
  "1/4": 50,
  "1/2": 100,
  "1": 200,
  "2": 450,
  "3": 700,
  "4": 1100,
  "5": 1800,
  "6": 2300,
  "7": 2900,
  "8": 3900,
  "9": 5000,
  "10": 5900,
  "11": 7200,
  "12": 8400,
  "13": 10000,
  "14": 11500,
  "15": 13000,
  "16": 15000,
  "17": 18000,
  "18": 20000,
  "19": 22000,
  "20": 25000,
  "21": 33000,
  "22": 41000,
  "23": 50000,
  "24": 62000,
  "25": 75000,
  "26": 90000,
  "27": 105000,
  "28": 120000,
  "29": 135000,
  "30": 155000,
};

export const ENCOUNTER_MULTIPLIERS: { maxCreatures: number; multiplier: number }[] = [
  { maxCreatures: 1, multiplier: 1 },
  { maxCreatures: 2, multiplier: 1.5 },
  { maxCreatures: 6, multiplier: 2 },
  { maxCreatures: 10, multiplier: 2.5 },
  { maxCreatures: 14, multiplier: 3 },
  { maxCreatures: Infinity, multiplier: 4 },
];

export const ENCOUNTER_DIFFICULTY_BY_LEVEL: Record<number, { easy: number; medium: number; hard: number; deadly: number }> = {
  1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
  2: { easy: 50, medium: 100, hard: 150, deadly: 200 },
  3: { easy: 75, medium: 150, hard: 225, deadly: 400 },
  4: { easy: 125, medium: 250, hard: 375, deadly: 500 },
  5: { easy: 250, medium: 500, hard: 750, deadly: 1100 },
  6: { easy: 300, medium: 600, hard: 900, deadly: 1400 },
  7: { easy: 350, medium: 750, hard: 1100, deadly: 1700 },
  8: { easy: 450, medium: 900, hard: 1400, deadly: 2100 },
  9: { easy: 550, medium: 1100, hard: 1600, deadly: 2400 },
  10: { easy: 600, medium: 1200, hard: 1900, deadly: 2800 },
  11: { easy: 800, medium: 1600, hard: 2400, deadly: 3600 },
  12: { easy: 1000, medium: 2000, hard: 3000, deadly: 4500 },
  13: { easy: 1100, medium: 2200, hard: 3400, deadly: 5100 },
  14: { easy: 1250, medium: 2500, hard: 3800, deadly: 5700 },
  15: { easy: 1400, medium: 2800, hard: 4300, deadly: 6400 },
  16: { easy: 1600, medium: 3200, hard: 4800, deadly: 7200 },
  17: { easy: 2000, medium: 3900, hard: 5900, deadly: 8800 },
  18: { easy: 2100, medium: 4200, hard: 6300, deadly: 9500 },
  19: { easy: 2400, medium: 4900, hard: 7300, deadly: 10900 },
  20: { easy: 2800, medium: 5700, hard: 8500, deadly: 12700 },
};

export const QUEST_XP_REWARDS = {
  minor: { min: 25, max: 100 },
  side: { min: 100, max: 300 },
  major: { min: 300, max: 750 },
  story: { min: 500, max: 1500 },
};

export function getLevelFromXP(xp: number): number {
  for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= XP_THRESHOLDS[i]) {
      return i + 1;
    }
  }
  return 1;
}

export function getXPForLevel(level: number): number {
  if (level < 1) return 0;
  if (level > 20) return XP_THRESHOLDS[19];
  return XP_THRESHOLDS[level - 1];
}

export function getXPToNextLevel(currentXP: number): { currentLevel: number; xpNeeded: number; xpProgress: number; percentComplete: number } {
  const currentLevel = getLevelFromXP(currentXP);
  
  if (currentLevel >= 20) {
    return {
      currentLevel: 20,
      xpNeeded: 0,
      xpProgress: currentXP - XP_THRESHOLDS[19],
      percentComplete: 100
    };
  }
  
  const currentThreshold = XP_THRESHOLDS[currentLevel - 1];
  const nextThreshold = XP_THRESHOLDS[currentLevel];
  const xpIntoLevel = currentXP - currentThreshold;
  const xpNeededForLevel = nextThreshold - currentThreshold;
  
  return {
    currentLevel,
    xpNeeded: nextThreshold - currentXP,
    xpProgress: xpIntoLevel,
    percentComplete: Math.floor((xpIntoLevel / xpNeededForLevel) * 100)
  };
}

export function getXPFromCR(cr: string | number): number {
  const crString = String(cr);
  return CR_XP_TABLE[crString] || 0;
}

export function getEncounterMultiplier(creatureCount: number): number {
  for (const tier of ENCOUNTER_MULTIPLIERS) {
    if (creatureCount <= tier.maxCreatures) {
      return tier.multiplier;
    }
  }
  return 4;
}

export function calculateEncounterXP(
  monsterCRs: (string | number)[],
  partySize: number = 4
): { 
  baseXP: number; 
  adjustedXP: number; 
  perCharacterXP: number; 
  difficulty: 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly';
  breakdown: { cr: string; xp: number }[];
} {
  const breakdown = monsterCRs.map(cr => ({
    cr: String(cr),
    xp: getXPFromCR(cr)
  }));
  
  const baseXP = breakdown.reduce((sum, m) => sum + m.xp, 0);
  const multiplier = getEncounterMultiplier(monsterCRs.length);
  
  let adjustedMultiplier = multiplier;
  if (partySize < 3) adjustedMultiplier += 0.5;
  else if (partySize > 5) adjustedMultiplier -= 0.5;
  
  const adjustedXP = Math.floor(baseXP * adjustedMultiplier);
  const perCharacterXP = Math.floor(baseXP / partySize);
  
  let difficulty: 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly' = 'trivial';
  const thresholds = ENCOUNTER_DIFFICULTY_BY_LEVEL[5];
  const partyThreshold = thresholds.deadly * partySize;
  
  if (adjustedXP >= partyThreshold) difficulty = 'deadly';
  else if (adjustedXP >= thresholds.hard * partySize) difficulty = 'hard';
  else if (adjustedXP >= thresholds.medium * partySize) difficulty = 'medium';
  else if (adjustedXP >= thresholds.easy * partySize) difficulty = 'easy';
  
  return {
    baseXP,
    adjustedXP,
    perCharacterXP,
    difficulty,
    breakdown
  };
}

export function calculateQuestXP(
  questType: 'minor' | 'side' | 'major' | 'story',
  partyLevel: number = 1,
  partySize: number = 4
): number {
  const { min, max } = QUEST_XP_REWARDS[questType];
  const levelMultiplier = 1 + (partyLevel - 1) * 0.1;
  const baseXP = Math.floor((min + max) / 2 * levelMultiplier);
  return Math.floor(baseXP / partySize);
}

export function formatXPProgress(currentXP: number): string {
  const { currentLevel, xpNeeded, percentComplete } = getXPToNextLevel(currentXP);
  
  if (currentLevel >= 20) {
    return `Level 20 (Max) - ${currentXP.toLocaleString()} XP`;
  }
  
  return `Level ${currentLevel} - ${currentXP.toLocaleString()} XP (${xpNeeded.toLocaleString()} to next level, ${percentComplete}%)`;
}

export const PROFICIENCY_BY_LEVEL: Record<number, number> = {
  1: 2, 2: 2, 3: 2, 4: 2,
  5: 3, 6: 3, 7: 3, 8: 3,
  9: 4, 10: 4, 11: 4, 12: 4,
  13: 5, 14: 5, 15: 5, 16: 5,
  17: 6, 18: 6, 19: 6, 20: 6
};

export function getProficiencyBonus(level: number): number {
  if (level < 1) return 2;
  if (level > 20) return 6;
  return PROFICIENCY_BY_LEVEL[level];
}

export function getAbilityModifier(abilityScore: number): number {
  return Math.floor((abilityScore - 10) / 2);
}
