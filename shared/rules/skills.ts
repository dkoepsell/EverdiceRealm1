// Shared D&D 5e skill ↔ ability mapping and skill-check helpers.
// Used by both the client (skill UI) and the server (downtime resolution).
import { getAbilityModifier, getProficiencyBonus } from "./xp";

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

// Re-export shared ability helpers so callers can import everything skill-related from here.
export { getAbilityModifier, getProficiencyBonus };

// Get the total modifier for a specific skill/ability check for a character-like object.
// Reads {strength..charisma}, level, skills[] off the passed object.
export function getSkillModifier(
  character: any,
  skill: string
): { modifier: number; breakdown: string; isProficient: boolean } {
  if (!character) {
    return { modifier: 0, breakdown: 'No character data', isProficient: false };
  }

  const normalizedSkill = skill.toLowerCase().replace(/\s+/g, '_');
  const abilityName = SKILL_ABILITY_MAP[normalizedSkill] || 'strength';

  const abilityScore = character[abilityName] || 10;
  const abilityMod = getAbilityModifier(abilityScore);

  const level = character.level || 1;
  const profBonus = getProficiencyBonus(level);

  const skills = character.skills || [];
  const isProficient = Array.isArray(skills) && skills.some((s: string) =>
    s.toLowerCase().replace(/\s+/g, '_') === normalizedSkill
  );

  const totalMod = isProficient ? abilityMod + profBonus : abilityMod;

  const abilityAbbrev = abilityName.substring(0, 3).toUpperCase();
  let breakdown = `${abilityAbbrev} ${abilityMod >= 0 ? '+' : ''}${abilityMod}`;
  if (isProficient) {
    breakdown += ` + Prof ${profBonus >= 0 ? '+' : ''}${profBonus}`;
  }
  breakdown += ` = ${totalMod >= 0 ? '+' : ''}${totalMod}`;

  return { modifier: totalMod, breakdown, isProficient };
}
