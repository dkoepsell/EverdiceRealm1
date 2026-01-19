/**
 * D&D 5e Combat Manager
 * Provides transparent, authentic D&D combat mechanics with detailed logging
 * for educational purposes - users can learn real D&D rules through play
 */

export interface Combatant {
  id: number;
  name: string;
  type: 'player' | 'companion' | 'enemy';
  currentHp: number;
  maxHp: number;
  armorClass: number;
  attackBonus: number;
  damageRoll: string; // e.g., "1d8+3", "2d6+2"
  status: 'conscious' | 'unconscious' | 'dead' | 'stabilized';
  class?: string;
  level?: number;
}

export interface AttackRollResult {
  roll: number;
  modifier: number;
  total: number;
  isCritical: boolean;
  isCriticalMiss: boolean;
}

export interface DamageRollResult {
  diceRolls: number[];
  diceType: string;
  modifier: number;
  total: number;
  isCritical: boolean;
}

export interface CombatLogEntry {
  attacker: string;
  attackerType: 'player' | 'companion' | 'enemy';
  target: string;
  targetType: 'player' | 'companion' | 'enemy';
  attackRoll: AttackRollResult;
  targetAC: number;
  isHit: boolean;
  damage?: DamageRollResult;
  targetNewHp?: number;
  targetMaxHp?: number;
  targetStatus?: string;
  description: string;
  mechanicsBreakdown: string;
}

export interface CombatTurnResult {
  logs: CombatLogEntry[];
  updatedCombatants: Combatant[];
  enemyDamageDealt: { name: string; damageTaken: number; newHp: number; maxHp: number; defeated: boolean }[];
  partyDamageDealt: { name: string; damageTaken: number; newHp: number; maxHp: number; defeated: boolean; isCompanion?: boolean }[];
  combatSummary: string;
  mechanicsExplanation: string;
}

/**
 * Roll a single die of the specified sides
 */
function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * Roll a d20 for attack rolls
 */
function rollD20(): number {
  return rollDie(20);
}

/**
 * Parse a damage string like "1d8+3" or "2d6+2"
 * Returns { count, sides, modifier }
 */
function parseDamageRoll(damageStr: string): { count: number; sides: number; modifier: number } {
  const match = damageStr.match(/(\d+)d(\d+)(?:\+(\d+))?/i);
  if (!match) {
    return { count: 1, sides: 6, modifier: 0 }; // Default fallback
  }
  return {
    count: parseInt(match[1]),
    sides: parseInt(match[2]),
    modifier: match[3] ? parseInt(match[3]) : 0
  };
}

/**
 * Roll damage dice according to D&D 5e rules
 * On a critical hit, roll the damage dice twice
 */
function rollDamage(damageStr: string, isCritical: boolean): DamageRollResult {
  const { count, sides, modifier } = parseDamageRoll(damageStr);
  const diceCount = isCritical ? count * 2 : count; // Double dice on crit
  const diceRolls: number[] = [];
  
  for (let i = 0; i < diceCount; i++) {
    diceRolls.push(rollDie(sides));
  }
  
  const total = diceRolls.reduce((sum, roll) => sum + roll, 0) + modifier;
  
  return {
    diceRolls,
    diceType: `d${sides}`,
    modifier,
    total: Math.max(1, total), // Minimum 1 damage
    isCritical
  };
}

/**
 * Make an attack roll according to D&D 5e rules
 * Natural 20 = Critical Hit (auto-hit, double damage dice)
 * Natural 1 = Critical Miss (auto-miss regardless of AC)
 */
function makeAttackRoll(attackBonus: number): AttackRollResult {
  const roll = rollD20();
  return {
    roll,
    modifier: attackBonus,
    total: roll + attackBonus,
    isCritical: roll === 20,
    isCriticalMiss: roll === 1
  };
}

/**
 * Determine if an attack hits based on D&D 5e rules
 * Hit if: Natural 20, OR (not natural 1 AND total >= target AC)
 */
function doesAttackHit(attackResult: AttackRollResult, targetAC: number): boolean {
  if (attackResult.isCritical) return true;
  if (attackResult.isCriticalMiss) return false;
  return attackResult.total >= targetAC;
}

/**
 * Get a status description based on HP percentage
 */
function getStatusFromHp(currentHp: number, maxHp: number): 'conscious' | 'unconscious' | 'dead' {
  if (currentHp <= 0) return 'unconscious';
  return 'conscious';
}

/**
 * Format the attack roll explanation for educational purposes
 */
function formatAttackRollExplanation(attackRoll: AttackRollResult, targetAC: number, isHit: boolean): string {
  const rollText = `d20(${attackRoll.roll})`;
  const modText = attackRoll.modifier >= 0 ? `+${attackRoll.modifier}` : `${attackRoll.modifier}`;
  
  if (attackRoll.isCritical) {
    return `🎯 CRITICAL HIT! Natural 20 on the d20 automatically hits and deals double damage dice!`;
  }
  if (attackRoll.isCriticalMiss) {
    return `❌ CRITICAL MISS! Natural 1 on the d20 automatically misses regardless of target's AC.`;
  }
  
  const comparison = isHit ? '≥' : '<';
  const resultText = isHit ? 'HIT' : 'MISS';
  return `Attack: ${rollText}${modText} = ${attackRoll.total} ${comparison} AC ${targetAC} → ${resultText}`;
}

/**
 * Format the damage roll explanation for educational purposes
 */
function formatDamageRollExplanation(damage: DamageRollResult, damageStr: string): string {
  const diceText = damage.diceRolls.map(r => r.toString()).join('+');
  const critText = damage.isCritical ? ' (CRITICAL - double dice!)' : '';
  const modText = damage.modifier > 0 ? `+${damage.modifier}` : (damage.modifier < 0 ? `${damage.modifier}` : '');
  
  return `Damage${critText}: ${diceText}${modText} = ${damage.total} damage`;
}

/**
 * Process enemy attacks against party members (players and companions)
 */
export function processEnemyAttacks(
  enemies: Combatant[],
  partyMembers: Combatant[]
): CombatTurnResult {
  const logs: CombatLogEntry[] = [];
  const updatedParty = [...partyMembers];
  const partyDamageDealt: CombatTurnResult['partyDamageDealt'] = [];
  
  // Filter to only conscious enemies and party members
  const activeEnemies = enemies.filter(e => e.status === 'conscious' && e.currentHp > 0);
  const activeParty = updatedParty.filter(p => p.status === 'conscious' && p.currentHp > 0);
  
  if (activeEnemies.length === 0 || activeParty.length === 0) {
    return {
      logs: [],
      updatedCombatants: updatedParty,
      enemyDamageDealt: [],
      partyDamageDealt: [],
      combatSummary: "No active combatants.",
      mechanicsExplanation: ""
    };
  }
  
  // Each active enemy attacks a random party member
  for (const enemy of activeEnemies) {
    // Select a random target from active party members
    const targetIndex = Math.floor(Math.random() * activeParty.length);
    const target = activeParty[targetIndex];
    const partyIndex = updatedParty.findIndex(p => p.id === target.id && p.type === target.type);
    
    // Make the attack roll
    const attackRoll = makeAttackRoll(enemy.attackBonus);
    const isHit = doesAttackHit(attackRoll, target.armorClass);
    
    let damage: DamageRollResult | undefined;
    let newHp = target.currentHp;
    let newStatus = target.status;
    
    if (isHit) {
      damage = rollDamage(enemy.damageRoll, attackRoll.isCritical);
      newHp = Math.max(0, target.currentHp - damage.total);
      newStatus = getStatusFromHp(newHp, target.maxHp);
      
      // Update the party member
      if (partyIndex !== -1) {
        updatedParty[partyIndex] = {
          ...updatedParty[partyIndex],
          currentHp: newHp,
          status: newStatus
        };
      }
      
      // Record damage dealt with companion flag
      partyDamageDealt.push({
        name: target.name,
        damageTaken: damage.total,
        newHp,
        maxHp: target.maxHp,
        defeated: newHp <= 0,
        isCompanion: target.type === 'companion'
      });
    }
    
    // Create the mechanics breakdown
    const attackExplanation = formatAttackRollExplanation(attackRoll, target.armorClass, isHit);
    const damageExplanation = damage ? formatDamageRollExplanation(damage, enemy.damageRoll) : '';
    const mechanicsBreakdown = damage 
      ? `${attackExplanation}\n${damageExplanation}`
      : attackExplanation;
    
    // Create descriptive text with companion identification
    const targetLabel = target.type === 'companion' ? `your companion ${target.name}` : target.name;
    let description: string;
    if (attackRoll.isCritical && damage) {
      description = `${enemy.name} lands a devastating critical hit on ${targetLabel} for ${damage.total} damage!`;
    } else if (attackRoll.isCriticalMiss) {
      description = `${enemy.name} swings wildly at ${targetLabel} but fumbles completely!`;
    } else if (isHit && damage) {
      description = `${enemy.name} strikes ${targetLabel} for ${damage.total} damage!`;
    } else {
      description = `${enemy.name} attacks ${targetLabel} but misses!`;
    }
    
    if (newHp <= 0 && damage) {
      description += ` ${target.name} falls unconscious!`;
    }
    
    logs.push({
      attacker: enemy.name,
      attackerType: 'enemy',
      target: target.name,
      targetType: target.type,
      attackRoll,
      targetAC: target.armorClass,
      isHit,
      damage,
      targetNewHp: newHp,
      targetMaxHp: target.maxHp,
      targetStatus: newStatus,
      description,
      mechanicsBreakdown
    });
  }
  
  // Build summary
  const hitCount = logs.filter(l => l.isHit).length;
  const totalDamage = partyDamageDealt.reduce((sum, p) => sum + p.damageTaken, 0);
  const downed = partyDamageDealt.filter(p => p.defeated).length;
  
  let combatSummary = `Enemies made ${logs.length} attack${logs.length !== 1 ? 's' : ''}: ${hitCount} hit${hitCount !== 1 ? 's' : ''} for ${totalDamage} total damage.`;
  if (downed > 0) {
    combatSummary += ` ${downed} party member${downed !== 1 ? 's' : ''} fell!`;
  }
  
  const mechanicsExplanation = logs.map(l => l.mechanicsBreakdown).join('\n\n');
  
  return {
    logs,
    updatedCombatants: updatedParty,
    enemyDamageDealt: [],
    partyDamageDealt,
    combatSummary,
    mechanicsExplanation
  };
}

/**
 * Process companion attacks against enemies (companions auto-attack in combat)
 * Each active companion attacks a random enemy
 */
export function processCompanionAttacks(
  companions: Combatant[],
  enemies: Combatant[]
): CombatTurnResult {
  const logs: CombatLogEntry[] = [];
  const updatedEnemies = [...enemies];
  const enemyDamageDealt: CombatTurnResult['enemyDamageDealt'] = [];
  
  // Filter to only conscious companions and enemies
  const activeCompanions = companions.filter(c => c.type === 'companion' && c.status === 'conscious' && c.currentHp > 0);
  const activeEnemies = updatedEnemies.filter(e => e.status === 'conscious' && e.currentHp > 0);
  
  if (activeCompanions.length === 0 || activeEnemies.length === 0) {
    return {
      logs: [],
      updatedCombatants: updatedEnemies,
      enemyDamageDealt: [],
      partyDamageDealt: [],
      combatSummary: "Companions have no targets or are unable to act.",
      mechanicsExplanation: ""
    };
  }
  
  // Each active companion attacks a random enemy
  for (const companion of activeCompanions) {
    // Select a random target from active enemies (refresh active list each iteration)
    const currentActiveEnemies = updatedEnemies.filter(e => e.status === 'conscious' && e.currentHp > 0);
    if (currentActiveEnemies.length === 0) break;
    
    const targetIndex = Math.floor(Math.random() * currentActiveEnemies.length);
    const target = currentActiveEnemies[targetIndex];
    const enemyIndex = updatedEnemies.findIndex(e => e.id === target.id);
    
    // Make the attack roll
    const attackRoll = makeAttackRoll(companion.attackBonus);
    const isHit = doesAttackHit(attackRoll, target.armorClass);
    
    let damage: DamageRollResult | undefined;
    let newHp = target.currentHp;
    let newStatus = target.status;
    
    if (isHit) {
      damage = rollDamage(companion.damageRoll, attackRoll.isCritical);
      newHp = Math.max(0, target.currentHp - damage.total);
      newStatus = getStatusFromHp(newHp, target.maxHp);
      
      // Update the enemy
      if (enemyIndex !== -1) {
        updatedEnemies[enemyIndex] = {
          ...updatedEnemies[enemyIndex],
          currentHp: newHp,
          status: newStatus
        };
      }
      
      // Record damage dealt
      enemyDamageDealt.push({
        name: target.name,
        damageTaken: damage.total,
        newHp,
        maxHp: target.maxHp,
        defeated: newHp <= 0
      });
    }
    
    // Create the mechanics breakdown
    const attackExplanation = formatAttackRollExplanation(attackRoll, target.armorClass, isHit);
    const damageExplanation = damage ? formatDamageRollExplanation(damage, companion.damageRoll) : '';
    const mechanicsBreakdown = damage 
      ? `${attackExplanation}\n${damageExplanation}`
      : attackExplanation;
    
    // Create descriptive text
    let description: string;
    if (attackRoll.isCritical && damage) {
      description = `${companion.name} lands a devastating critical hit on ${target.name} for ${damage.total} damage!`;
    } else if (attackRoll.isCriticalMiss) {
      description = `${companion.name} swings at ${target.name} but fumbles!`;
    } else if (isHit && damage) {
      description = `${companion.name} strikes ${target.name} for ${damage.total} damage!`;
    } else {
      description = `${companion.name} attacks ${target.name} but misses!`;
    }
    
    if (newHp <= 0 && damage) {
      description += ` ${target.name} is defeated!`;
    }
    
    logs.push({
      attacker: companion.name,
      attackerType: 'companion',
      target: target.name,
      targetType: 'enemy',
      attackRoll,
      targetAC: target.armorClass,
      isHit,
      damage,
      targetNewHp: newHp,
      targetMaxHp: target.maxHp,
      targetStatus: newStatus,
      description,
      mechanicsBreakdown
    });
  }
  
  // Build summary
  const hitCount = logs.filter(l => l.isHit).length;
  const totalDamage = enemyDamageDealt.reduce((sum, e) => sum + e.damageTaken, 0);
  const defeated = enemyDamageDealt.filter(e => e.defeated).length;
  
  let combatSummary = `Companions made ${logs.length} attack${logs.length !== 1 ? 's' : ''}: ${hitCount} hit${hitCount !== 1 ? 's' : ''} for ${totalDamage} total damage.`;
  if (defeated > 0) {
    combatSummary += ` ${defeated} enem${defeated !== 1 ? 'ies' : 'y'} defeated!`;
  }
  
  const mechanicsExplanation = logs.map(l => l.mechanicsBreakdown).join('\n\n');
  
  return {
    logs,
    updatedCombatants: updatedEnemies,
    enemyDamageDealt,
    partyDamageDealt: [],
    combatSummary,
    mechanicsExplanation
  };
}

/**
 * Process player/companion attack against enemies
 */
export function processPlayerAttack(
  attacker: Combatant,
  target: Combatant,
  hasAdvantage: boolean = false,
  hasDisadvantage: boolean = false
): { log: CombatLogEntry; updatedTarget: Combatant } {
  // Handle advantage/disadvantage
  let attackRoll: AttackRollResult;
  if (hasAdvantage && !hasDisadvantage) {
    const roll1 = makeAttackRoll(attacker.attackBonus);
    const roll2 = makeAttackRoll(attacker.attackBonus);
    attackRoll = roll1.total >= roll2.total ? roll1 : roll2;
  } else if (hasDisadvantage && !hasAdvantage) {
    const roll1 = makeAttackRoll(attacker.attackBonus);
    const roll2 = makeAttackRoll(attacker.attackBonus);
    attackRoll = roll1.total <= roll2.total ? roll1 : roll2;
  } else {
    attackRoll = makeAttackRoll(attacker.attackBonus);
  }
  
  const isHit = doesAttackHit(attackRoll, target.armorClass);
  
  let damage: DamageRollResult | undefined;
  let newHp = target.currentHp;
  let newStatus = target.status;
  
  if (isHit) {
    damage = rollDamage(attacker.damageRoll, attackRoll.isCritical);
    newHp = Math.max(0, target.currentHp - damage.total);
    newStatus = getStatusFromHp(newHp, target.maxHp);
  }
  
  const attackExplanation = formatAttackRollExplanation(attackRoll, target.armorClass, isHit);
  const damageExplanation = damage ? formatDamageRollExplanation(damage, attacker.damageRoll) : '';
  const mechanicsBreakdown = damage 
    ? `${attackExplanation}\n${damageExplanation}`
    : attackExplanation;
  
  let description: string;
  if (attackRoll.isCritical && damage) {
    description = `${attacker.name} lands a devastating critical hit on ${target.name} for ${damage.total} damage!`;
  } else if (attackRoll.isCriticalMiss) {
    description = `${attacker.name} swings at ${target.name} but fumbles!`;
  } else if (isHit && damage) {
    description = `${attacker.name} hits ${target.name} for ${damage.total} damage!`;
  } else {
    description = `${attacker.name} attacks ${target.name} but misses!`;
  }
  
  if (newHp <= 0 && damage) {
    description += ` ${target.name} is defeated!`;
  }
  
  return {
    log: {
      attacker: attacker.name,
      attackerType: attacker.type,
      target: target.name,
      targetType: target.type,
      attackRoll,
      targetAC: target.armorClass,
      isHit,
      damage,
      targetNewHp: newHp,
      targetMaxHp: target.maxHp,
      targetStatus: newStatus,
      description,
      mechanicsBreakdown
    },
    updatedTarget: {
      ...target,
      currentHp: newHp,
      status: newStatus
    }
  };
}

/**
 * Calculate attack bonus from character stats
 * Uses proficiency bonus (based on level) + ability modifier
 */
export function calculateAttackBonus(level: number, abilityScore: number, isProficient: boolean = true): number {
  const proficiencyBonus = Math.ceil(level / 4) + 1; // 2 at level 1, increases every 4 levels
  const abilityModifier = Math.floor((abilityScore - 10) / 2);
  return isProficient ? proficiencyBonus + abilityModifier : abilityModifier;
}

/**
 * Item stats interface for combat calculations
 */
export interface ItemStats {
  name: string;
  type: string;
  damageDice?: string;
  damageType?: string;
  attackBonus?: number;
  magicBonus?: number;
  baseAC?: number;
  armorType?: string;
  properties?: string[];
}

/**
 * Character combat stats derived from equipment and abilities
 */
export interface EffectiveCombatStats {
  attackBonus: number;
  damageRoll: string;
  armorClass: number;
  damageType: string;
  weaponName: string;
  breakdown: {
    attackProficiency: number;
    attackAbility: number;
    attackMagic: number;
    damageAbility: number;
    damageMagic: number;
    baseAC: number;
    dexBonus: number;
    shieldBonus: number;
    magicACBonus: number;
  };
}

/**
 * Calculate ability modifier from ability score (D&D 5e formula)
 */
export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Calculate proficiency bonus from level (D&D 5e formula)
 */
export function getProficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}

/**
 * Determine if a weapon is strictly ranged (uses DEX only per D&D 5e RAW)
 */
function isRangedWeapon(weaponProperties: string[] = [], weaponName: string = ''): boolean {
  const lowerName = weaponName.toLowerCase();
  return lowerName.includes('bow') || lowerName.includes('crossbow') || 
         lowerName.includes('sling') || lowerName.includes('dart');
}

/**
 * Determine if a weapon has the finesse property (can use STR or DEX)
 */
function isFinesseWeapon(weaponProperties: string[] = []): boolean {
  return weaponProperties.some(p => p.toLowerCase().includes('finesse'));
}

/**
 * Determine if a weapon is thrown (uses STR by default, but some are finesse)
 */
function isThrownWeapon(weaponProperties: string[] = [], weaponName: string = ''): boolean {
  const lowerName = weaponName.toLowerCase();
  const hasThrown = weaponProperties.some(p => p.toLowerCase().includes('thrown'));
  return hasThrown || lowerName.includes('javelin') || lowerName.includes('throwing');
}

/**
 * Calculate effective combat stats from character + equipped items
 * This implements D&D 5e rules for attack bonus, damage, and AC
 */
export function calculateEffectiveCombatStats(
  character: {
    level: number;
    strength: number;
    dexterity: number;
    constitution: number;
    equippedWeapon?: string;
    equippedArmor?: string;
    equippedShield?: string;
    armorClass?: number;
    class?: string;
  },
  itemStatsMap: Record<string, ItemStats | undefined>
): EffectiveCombatStats {
  const level = character.level || 1;
  const strMod = getAbilityModifier(character.strength || 10);
  const dexMod = getAbilityModifier(character.dexterity || 10);
  const profBonus = getProficiencyBonus(level);
  
  // Get weapon stats
  const weaponStats = character.equippedWeapon ? itemStatsMap[character.equippedWeapon] : undefined;
  const weaponName = character.equippedWeapon || 'Unarmed';
  const weaponProps = weaponStats?.properties || [];
  
  // Determine attack ability modifier based on weapon type (D&D 5e RAW):
  // - Ranged weapons (bows, crossbows): DEX only
  // - Finesse weapons: use higher of STR or DEX
  // - Thrown weapons without finesse: STR (unless also finesse like dagger)
  // - Melee weapons: STR
  let attackAbilityMod: number;
  
  if (isRangedWeapon(weaponProps, weaponName)) {
    // Ranged weapons always use DEX
    attackAbilityMod = dexMod;
  } else if (isFinesseWeapon(weaponProps)) {
    // Finesse weapons use the higher of STR or DEX
    attackAbilityMod = Math.max(strMod, dexMod);
  } else if (isThrownWeapon(weaponProps, weaponName)) {
    // Thrown weapons use STR (unless also finesse, handled above)
    attackAbilityMod = strMod;
  } else {
    // Default melee: use STR
    attackAbilityMod = strMod;
  }
  
  const damageAbilityMod = attackAbilityMod;
  
  // Weapon magic bonus (applies to both attack and damage)
  const weaponMagicBonus = weaponStats?.magicBonus || weaponStats?.attackBonus || 0;
  
  // Calculate attack bonus: proficiency + ability mod + magic
  const attackBonus = profBonus + attackAbilityMod + weaponMagicBonus;
  
  // Calculate damage roll
  const baseDamageDice = weaponStats?.damageDice || '1d4'; // Unarmed = 1d4 (simplified)
  const totalDamageBonus = damageAbilityMod + weaponMagicBonus;
  const damageRoll = totalDamageBonus >= 0 
    ? `${baseDamageDice}+${totalDamageBonus}` 
    : `${baseDamageDice}${totalDamageBonus}`;
  const damageType = weaponStats?.damageType || 'bludgeoning';
  
  // Calculate AC
  const armorStats = character.equippedArmor ? itemStatsMap[character.equippedArmor] : undefined;
  const shieldStats = character.equippedShield ? itemStatsMap[character.equippedShield] : undefined;
  
  let baseAC = 10; // Unarmored
  let dexBonus = dexMod;
  let armorMagicBonus = 0;
  
  if (armorStats && armorStats.baseAC) {
    baseAC = armorStats.baseAC;
    armorMagicBonus += armorStats.magicBonus || 0;
    
    // Apply DEX cap based on armor type
    const armorType = armorStats.armorType?.toLowerCase() || '';
    if (armorType.includes('heavy')) {
      dexBonus = 0; // Heavy armor: no DEX bonus
    } else if (armorType.includes('medium')) {
      dexBonus = Math.min(dexMod, 2); // Medium armor: max +2 DEX
    }
    // Light armor: full DEX bonus (no change needed)
  }
  
  // Shield bonus
  const shieldBonus = shieldStats ? (shieldStats.baseAC || 2) : 0;
  const shieldMagicBonus = shieldStats?.magicBonus || 0;
  
  // Total AC
  const armorClass = baseAC + dexBonus + shieldBonus + armorMagicBonus + shieldMagicBonus;
  
  return {
    attackBonus,
    damageRoll,
    armorClass,
    damageType,
    weaponName,
    breakdown: {
      attackProficiency: profBonus,
      attackAbility: attackAbilityMod,
      attackMagic: weaponMagicBonus,
      damageAbility: damageAbilityMod,
      damageMagic: weaponMagicBonus,
      baseAC,
      dexBonus,
      shieldBonus: shieldBonus + shieldMagicBonus,
      magicACBonus: armorMagicBonus
    }
  };
}

/**
 * Get default stats for a companion based on class
 */
export function getCompanionDefaultStats(npcClass: string, level: number = 1): { attackBonus: number; damageRoll: string; armorClass: number; maxHp: number } {
  const profBonus = Math.ceil(level / 4) + 1;
  const baseStats = {
    'Fighter': { str: 16, dex: 12, con: 14, attackBonus: profBonus + 3, damageRoll: '1d8+3', armorClass: 16, hpBase: 10, hpPerLevel: 6 },
    'Rogue': { str: 10, dex: 16, con: 12, attackBonus: profBonus + 3, damageRoll: '1d6+3', armorClass: 14, hpBase: 8, hpPerLevel: 5 },
    'Wizard': { str: 8, dex: 14, con: 12, attackBonus: profBonus + 3, damageRoll: '1d6+3', armorClass: 12, hpBase: 6, hpPerLevel: 4 },
    'Cleric': { str: 14, dex: 10, con: 14, attackBonus: profBonus + 2, damageRoll: '1d8+2', armorClass: 16, hpBase: 8, hpPerLevel: 5 },
    'Ranger': { str: 12, dex: 16, con: 12, attackBonus: profBonus + 3, damageRoll: '1d8+3', armorClass: 14, hpBase: 10, hpPerLevel: 6 },
    'Paladin': { str: 16, dex: 10, con: 14, attackBonus: profBonus + 3, damageRoll: '1d10+3', armorClass: 18, hpBase: 10, hpPerLevel: 6 },
    'Barbarian': { str: 16, dex: 14, con: 16, attackBonus: profBonus + 3, damageRoll: '1d12+3', armorClass: 14, hpBase: 12, hpPerLevel: 7 },
    'Bard': { str: 10, dex: 14, con: 12, attackBonus: profBonus + 2, damageRoll: '1d8+2', armorClass: 13, hpBase: 8, hpPerLevel: 5 },
    'Druid': { str: 10, dex: 12, con: 14, attackBonus: profBonus + 2, damageRoll: '1d8+2', armorClass: 13, hpBase: 8, hpPerLevel: 5 },
    'Monk': { str: 12, dex: 16, con: 12, attackBonus: profBonus + 3, damageRoll: '1d6+3', armorClass: 15, hpBase: 8, hpPerLevel: 5 },
    'Sorcerer': { str: 8, dex: 14, con: 14, attackBonus: profBonus + 3, damageRoll: '1d6+3', armorClass: 12, hpBase: 6, hpPerLevel: 4 },
    'Warlock': { str: 10, dex: 14, con: 14, attackBonus: profBonus + 3, damageRoll: '1d10+3', armorClass: 12, hpBase: 8, hpPerLevel: 5 },
  };
  
  const classStats = baseStats[npcClass as keyof typeof baseStats] || baseStats['Fighter'];
  const maxHp = classStats.hpBase + (level - 1) * classStats.hpPerLevel + Math.floor((classStats.con - 10) / 2) * level;
  
  return {
    attackBonus: classStats.attackBonus,
    damageRoll: classStats.damageRoll,
    armorClass: classStats.armorClass,
    maxHp
  };
}
