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
  partyDamageDealt: { name: string; damageTaken: number; newHp: number; maxHp: number; defeated: boolean }[];
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
      
      // Record damage dealt
      partyDamageDealt.push({
        name: target.name,
        damageTaken: damage.total,
        newHp,
        maxHp: target.maxHp,
        defeated: newHp <= 0
      });
    }
    
    // Create the mechanics breakdown
    const attackExplanation = formatAttackRollExplanation(attackRoll, target.armorClass, isHit);
    const damageExplanation = damage ? formatDamageRollExplanation(damage, enemy.damageRoll) : '';
    const mechanicsBreakdown = damage 
      ? `${attackExplanation}\n${damageExplanation}`
      : attackExplanation;
    
    // Create descriptive text
    let description: string;
    if (attackRoll.isCritical && damage) {
      description = `${enemy.name} lands a devastating critical hit on ${target.name} for ${damage.total} damage!`;
    } else if (attackRoll.isCriticalMiss) {
      description = `${enemy.name} swings wildly at ${target.name} but fumbles completely!`;
    } else if (isHit && damage) {
      description = `${enemy.name} strikes ${target.name} for ${damage.total} damage!`;
    } else {
      description = `${enemy.name} attacks ${target.name} but misses!`;
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
