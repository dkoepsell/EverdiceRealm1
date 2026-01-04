// Skill to ability score mapping for D&D 5e
export const SKILL_ABILITY_MAP: Record<string, string> = {
  // Strength-based
  athletics: 'strength',
  strength: 'strength',
  
  // Dexterity-based
  acrobatics: 'dexterity',
  sleight_of_hand: 'dexterity',
  stealth: 'dexterity',
  dexterity: 'dexterity',
  thieves_tools: 'dexterity',
  
  // Intelligence-based
  arcana: 'intelligence',
  history: 'intelligence',
  investigation: 'intelligence',
  nature: 'intelligence',
  religion: 'intelligence',
  intelligence: 'intelligence',
  
  // Wisdom-based
  animal_handling: 'wisdom',
  insight: 'wisdom',
  medicine: 'wisdom',
  perception: 'wisdom',
  survival: 'wisdom',
  wisdom: 'wisdom',
  
  // Charisma-based
  deception: 'charisma',
  intimidation: 'charisma',
  performance: 'charisma',
  persuasion: 'charisma',
  charisma: 'charisma',
  
  // Combat
  attack: 'strength', // Default to strength, could be dex for finesse
};

// Skills that use proficiency bonus when proficient
export const PROFICIENCY_SKILLS = [
  'athletics', 'acrobatics', 'sleight_of_hand', 'stealth',
  'arcana', 'history', 'investigation', 'nature', 'religion',
  'animal_handling', 'insight', 'medicine', 'perception', 'survival',
  'deception', 'intimidation', 'performance', 'persuasion'
];

// Calculate ability modifier from ability score
export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

// Get proficiency bonus based on level
export function getProficiencyBonus(level: number): number {
  return Math.floor((level - 1) / 4) + 2;
}

// Get the modifier for a specific skill/ability check
export function getSkillModifier(
  character: any,
  skill: string
): { modifier: number; breakdown: string } {
  if (!character) {
    return { modifier: 0, breakdown: 'No character data' };
  }

  const normalizedSkill = skill.toLowerCase().replace(/\s+/g, '_');
  const abilityName = SKILL_ABILITY_MAP[normalizedSkill] || 'strength';
  
  // Get ability score
  const abilityScore = character[abilityName] || 10;
  const abilityMod = getAbilityModifier(abilityScore);
  
  // Check for proficiency
  const level = character.level || 1;
  const profBonus = getProficiencyBonus(level);
  
  // Check if character has proficiency in this skill
  const skills = character.skills || [];
  const isProficient = skills.some((s: string) => 
    s.toLowerCase().replace(/\s+/g, '_') === normalizedSkill
  );
  
  const totalMod = isProficient ? abilityMod + profBonus : abilityMod;
  
  // Build breakdown string
  const abilityAbbrev = abilityName.substring(0, 3).toUpperCase();
  let breakdown = `${abilityAbbrev} ${abilityMod >= 0 ? '+' : ''}${abilityMod}`;
  if (isProficient) {
    breakdown += ` + Prof ${profBonus >= 0 ? '+' : ''}${profBonus}`;
  }
  breakdown += ` = ${totalMod >= 0 ? '+' : ''}${totalMod}`;
  
  return { modifier: totalMod, breakdown };
}

// Calculate success probability
export function calculateSuccessProbability(dc: number, modifier: number): number {
  // Need to roll (DC - modifier) or higher on d20
  const neededRoll = dc - modifier;
  // Probability = (21 - neededRoll) / 20 * 100
  // Clamped between 5% (natural 1 always fails) and 95% (natural 20 always succeeds)
  const rawProbability = ((21 - neededRoll) / 20) * 100;
  return Math.max(5, Math.min(95, rawProbability));
}

// Parse DC from choice text like "Attempt to solve (Intelligence DC 14)"
export function parseDCFromText(text: string): number | null {
  const match = text.match(/DC\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

// Get likelihood description based on probability
export function getLikelihoodDescription(probability: number): { text: string; color: string } {
  if (probability >= 80) {
    return { text: 'Very Likely', color: 'text-green-600 dark:text-green-400' };
  } else if (probability >= 60) {
    return { text: 'Likely', color: 'text-emerald-600 dark:text-emerald-400' };
  } else if (probability >= 40) {
    return { text: 'Even Odds', color: 'text-yellow-600 dark:text-yellow-400' };
  } else if (probability >= 20) {
    return { text: 'Unlikely', color: 'text-orange-600 dark:text-orange-400' };
  } else {
    return { text: 'Very Hard', color: 'text-red-600 dark:text-red-400' };
  }
}
