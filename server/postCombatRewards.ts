import { CR_XP_TABLE, getXPFromCR, calculateEncounterXP } from '../shared/rules/xp';

export interface DefeatedEnemy {
  name: string;
  cr?: string | number;
  type?: string; // 'enemy' | 'boss'
  maxHp?: number;
  currentHp?: number;
  status?: string;
}

export interface LootItem {
  name: string;
  type: string; // weapon, armor, wondrous, consumable, treasure
  rarity: string;
  description: string;
  properties?: string;
  value: number; // gold value
  magicBonus?: number;
  damageDice?: string;
  damageType?: string;
  baseAC?: number;
  specialEffect?: string;
  requiresAttunement?: boolean;
}

export interface PostCombatRewards {
  xpAwarded: number;
  goldAwarded: number;
  lootItems: LootItem[];
  isBossFight: boolean;
  bossName?: string;
  difficulty: 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly';
  shouldAdvanceChapter: boolean;
  chapterAdvanceReason?: string;
  victoryTier: 'minor' | 'standard' | 'major' | 'epic';
  encounterSummary: string;
}

const GOLD_BY_CR: Record<string, { min: number; max: number }> = {
  "0": { min: 1, max: 5 },
  "1/8": { min: 2, max: 10 },
  "1/4": { min: 5, max: 20 },
  "1/2": { min: 10, max: 40 },
  "1": { min: 15, max: 60 },
  "2": { min: 25, max: 100 },
  "3": { min: 40, max: 150 },
  "4": { min: 60, max: 250 },
  "5": { min: 100, max: 400 },
  "6": { min: 150, max: 500 },
  "7": { min: 200, max: 700 },
  "8": { min: 300, max: 1000 },
  "9": { min: 400, max: 1300 },
  "10": { min: 500, max: 1600 },
  "11": { min: 700, max: 2000 },
  "12": { min: 900, max: 2500 },
  "13": { min: 1200, max: 3500 },
  "14": { min: 1500, max: 4000 },
  "15": { min: 2000, max: 5000 },
  "16": { min: 2500, max: 6000 },
  "17": { min: 3000, max: 8000 },
  "18": { min: 4000, max: 10000 },
  "19": { min: 5000, max: 12000 },
  "20": { min: 6000, max: 15000 },
};

const BOSS_GOLD_MULTIPLIER = 2.5;
const BOSS_XP_MULTIPLIER = 1.5;

interface LootTableEntry {
  name: string;
  type: string;
  rarity: string;
  description: string;
  value: number;
  magicBonus?: number;
  damageDice?: string;
  damageType?: string;
  baseAC?: number;
  specialEffect?: string;
  requiresAttunement?: boolean;
}

const LOOT_TABLES: Record<string, LootTableEntry[]> = {
  common: [
    { name: "Potion of Healing", type: "consumable", rarity: "common", description: "Restores 2d4+2 hit points when consumed.", value: 50, specialEffect: "Heals 2d4+2 HP" },
    { name: "Silvered Dagger", type: "weapon", rarity: "common", description: "A finely crafted dagger coated in silver.", value: 102, damageDice: "1d4", damageType: "piercing" },
    { name: "Amulet of Minor Warding", type: "wondrous", rarity: "common", description: "Grants +1 to saves against being frightened.", value: 75, specialEffect: "+1 to saves vs frightened" },
    { name: "Cloak of Many Fashions", type: "wondrous", rarity: "common", description: "Changes style, color, and apparent quality at will.", value: 50, specialEffect: "Change appearance at will" },
    { name: "Scroll of Shield", type: "consumable", rarity: "common", description: "Casts Shield spell once when read aloud.", value: 60, specialEffect: "Cast Shield (1 use)" },
  ],
  uncommon: [
    { name: "Longsword +1", type: "weapon", rarity: "uncommon", description: "A finely forged longsword with a faint magical glow.", value: 500, magicBonus: 1, damageDice: "1d8", damageType: "slashing", specialEffect: "+1 to attack and damage rolls" },
    { name: "Shield +1", type: "armor", rarity: "uncommon", description: "A sturdy shield inscribed with protective runes.", value: 500, magicBonus: 1, baseAC: 2, specialEffect: "+1 AC bonus (total +3 with shield)" },
    { name: "Cloak of Protection", type: "wondrous", rarity: "uncommon", description: "Shimmers faintly with protective enchantment.", value: 750, specialEffect: "+1 to AC and saving throws", requiresAttunement: true },
    { name: "Bag of Holding", type: "wondrous", rarity: "uncommon", description: "This bag has an interior space considerably larger than its outside dimensions.", value: 500, specialEffect: "Holds up to 500 lbs, 64 cubic feet" },
    { name: "Potion of Greater Healing", type: "consumable", rarity: "uncommon", description: "Restores 4d4+4 hit points.", value: 150, specialEffect: "Heals 4d4+4 HP" },
    { name: "Boots of Elvenkind", type: "wondrous", rarity: "uncommon", description: "Soft boots that muffle your footsteps.", value: 500, specialEffect: "Advantage on Stealth checks" },
    { name: "Gauntlets of Ogre Power", type: "wondrous", rarity: "uncommon", description: "Gauntlets that enhance your strength.", value: 800, specialEffect: "Strength becomes 19", requiresAttunement: true },
  ],
  rare: [
    { name: "Greatsword +2", type: "weapon", rarity: "rare", description: "A magnificent greatsword wreathed in arcane energy.", value: 4000, magicBonus: 2, damageDice: "2d6", damageType: "slashing", specialEffect: "+2 to attack and damage rolls", requiresAttunement: true },
    { name: "Plate Armor +1", type: "armor", rarity: "rare", description: "Masterwork plate armor etched with protective sigils.", value: 5000, magicBonus: 1, baseAC: 18, specialEffect: "+1 AC (total AC 19)" },
    { name: "Ring of Protection", type: "wondrous", rarity: "rare", description: "A silver ring that deflects attacks.", value: 3500, specialEffect: "+1 to AC and saving throws", requiresAttunement: true },
    { name: "Flame Tongue Sword", type: "weapon", rarity: "rare", description: "This sword ignites with magical fire on command.", value: 5000, damageDice: "1d8", damageType: "slashing", specialEffect: "Bonus 2d6 fire damage when ignited", requiresAttunement: true },
    { name: "Potion of Superior Healing", type: "consumable", rarity: "rare", description: "Restores 8d4+8 hit points.", value: 500, specialEffect: "Heals 8d4+8 HP" },
    { name: "Cape of the Mountebank", type: "wondrous", rarity: "rare", description: "A swirling cape that lets you teleport.", value: 4000, specialEffect: "Cast Dimension Door once per day" },
  ],
  very_rare: [
    { name: "Vorpal Blade", type: "weapon", rarity: "very_rare", description: "A legendary blade that severs heads on critical hits.", value: 25000, magicBonus: 3, damageDice: "1d8", damageType: "slashing", specialEffect: "+3 to attack/damage, decapitates on nat 20", requiresAttunement: true },
    { name: "Armor of Invulnerability", type: "armor", rarity: "very_rare", description: "Plate armor that grants resistance to nonmagical damage.", value: 18000, baseAC: 18, specialEffect: "Resistance to nonmagical bludgeoning, piercing, slashing", requiresAttunement: true },
    { name: "Staff of Power", type: "weapon", rarity: "very_rare", description: "A staff crackling with arcane energy.", value: 20000, magicBonus: 2, damageDice: "1d6", damageType: "bludgeoning", specialEffect: "+2 AC, +2 saves, +2 spell attacks, 20 charges", requiresAttunement: true },
    { name: "Potion of Supreme Healing", type: "consumable", rarity: "very_rare", description: "Restores 10d4+20 hit points.", value: 1350, specialEffect: "Heals 10d4+20 HP" },
  ],
  legendary: [
    { name: "Holy Avenger", type: "weapon", rarity: "legendary", description: "A radiant sword that empowers paladins.", value: 50000, magicBonus: 3, damageDice: "1d8", damageType: "slashing", specialEffect: "+3, extra 2d10 radiant vs fiends/undead, 10ft aura of save bonus", requiresAttunement: true },
    { name: "Robe of the Archmagi", type: "wondrous", rarity: "legendary", description: "A flowing robe of immense magical power.", value: 45000, specialEffect: "AC 15+DEX, advantage on saves vs spells, +2 spell save DC and attack", requiresAttunement: true },
    { name: "Belt of Storm Giant Strength", type: "wondrous", rarity: "legendary", description: "A belt forged from storm giant hide.", value: 40000, specialEffect: "Strength becomes 29", requiresAttunement: true },
  ],
};

function rollRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getCRNumber(cr: string | number): number {
  const crStr = String(cr);
  if (crStr === "1/8") return 0.125;
  if (crStr === "1/4") return 0.25;
  if (crStr === "1/2") return 0.5;
  return parseFloat(crStr) || 0;
}

export function detectBossFight(enemies: DefeatedEnemy[], characterLevel: number): { isBoss: boolean; bossName?: string; reason: string } {
  if (enemies.length === 0) return { isBoss: false, reason: "No enemies" };

  const highestCREnemy = enemies.reduce((highest, e) => {
    const cr = getCRNumber(e.cr || "1/4");
    const highCr = getCRNumber(highest.cr || "1/4");
    return cr > highCr ? e : highest;
  }, enemies[0]);

  const highestCR = getCRNumber(highestCREnemy.cr || "1/4");

  if (highestCREnemy.type === 'boss') {
    return { isBoss: true, bossName: highestCREnemy.name, reason: "Marked as boss" };
  }

  if (enemies.length === 1 && highestCR >= characterLevel) {
    return { isBoss: true, bossName: highestCREnemy.name, reason: "Solo enemy at or above party level" };
  }

  if (highestCR >= characterLevel + 2) {
    return { isBoss: true, bossName: highestCREnemy.name, reason: "Enemy CR significantly exceeds party level" };
  }

  if (enemies.length <= 2 && highestCR >= characterLevel - 1 && (highestCREnemy.maxHp || 0) >= 80) {
    return { isBoss: true, bossName: highestCREnemy.name, reason: "High-HP enemy near party level" };
  }

  const bossNames = ['dragon', 'lich', 'beholder', 'tarrasque', 'demon lord', 'archdevil', 'ancient',
    'wyvern', 'hydra', 'kraken', 'titan', 'boss', 'overlord', 'lord', 'king', 'queen', 'empress', 'emperor',
    'shadow master', 'dark lord', 'necromancer', 'archmage', 'champion'];
  const nameLower = highestCREnemy.name.toLowerCase();
  if (bossNames.some(bn => nameLower.includes(bn)) && highestCR >= Math.max(1, characterLevel - 2)) {
    return { isBoss: true, bossName: highestCREnemy.name, reason: "Named boss creature" };
  }

  return { isBoss: false, reason: "Standard encounter" };
}

function getLootRarity(characterLevel: number, isBoss: boolean): string {
  const roll = Math.random() * 100;

  if (isBoss) {
    if (characterLevel >= 17) {
      if (roll < 20) return 'legendary';
      if (roll < 55) return 'very_rare';
      return 'rare';
    }
    if (characterLevel >= 11) {
      if (roll < 10) return 'very_rare';
      if (roll < 45) return 'rare';
      return 'uncommon';
    }
    if (characterLevel >= 5) {
      if (roll < 5) return 'rare';
      if (roll < 40) return 'uncommon';
      return 'common';
    }
    if (roll < 30) return 'uncommon';
    return 'common';
  }

  if (characterLevel >= 17) {
    if (roll < 5) return 'very_rare';
    if (roll < 25) return 'rare';
    if (roll < 60) return 'uncommon';
    return 'common';
  }
  if (characterLevel >= 11) {
    if (roll < 10) return 'rare';
    if (roll < 40) return 'uncommon';
    return 'common';
  }
  if (characterLevel >= 5) {
    if (roll < 15) return 'uncommon';
    return 'common';
  }
  if (roll < 10) return 'uncommon';
  return 'common';
}

function getItemDropCount(isBoss: boolean, victoryTier: string): number {
  if (isBoss) {
    if (victoryTier === 'epic') return rollRange(2, 4);
    return rollRange(1, 3);
  }
  if (victoryTier === 'major') return rollRange(1, 2);
  const roll = Math.random();
  return roll < 0.4 ? 1 : 0;
}

function selectLootItem(rarity: string): LootTableEntry | null {
  const table = LOOT_TABLES[rarity];
  if (!table || table.length === 0) {
    const fallback = LOOT_TABLES['common'];
    if (!fallback) return null;
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
  return table[Math.floor(Math.random() * table.length)];
}

function determineVictoryTier(difficulty: string, isBoss: boolean): 'minor' | 'standard' | 'major' | 'epic' {
  if (isBoss) {
    if (difficulty === 'deadly') return 'epic';
    if (difficulty === 'hard') return 'major';
    return 'major';
  }
  if (difficulty === 'deadly') return 'major';
  if (difficulty === 'hard') return 'standard';
  if (difficulty === 'medium') return 'standard';
  return 'minor';
}

export function generatePostCombatRewards(
  defeatedEnemies: DefeatedEnemy[],
  characterLevel: number,
  currentChapter: number,
  totalChapters: number,
  campaignTitle?: string,
): PostCombatRewards {
  if (defeatedEnemies.length === 0) {
    return {
      xpAwarded: 0,
      goldAwarded: 0,
      lootItems: [],
      isBossFight: false,
      difficulty: 'trivial',
      shouldAdvanceChapter: false,
      victoryTier: 'minor',
      encounterSummary: "No enemies defeated.",
    };
  }

  const enemyCRs = defeatedEnemies.map(e => String(e.cr || "1/4"));
  const encounterCalc = calculateEncounterXP(enemyCRs, 1);

  const bossDetection = detectBossFight(defeatedEnemies, characterLevel);
  const isBoss = bossDetection.isBoss;
  const bossName = bossDetection.bossName;

  let baseXP = encounterCalc.baseXP;
  if (isBoss) {
    baseXP = Math.floor(baseXP * BOSS_XP_MULTIPLIER);
  }

  let totalGold = 0;
  for (const enemy of defeatedEnemies) {
    const crStr = String(enemy.cr || "1/4");
    const goldRange = GOLD_BY_CR[crStr] || GOLD_BY_CR["1/4"];
    let enemyGold = rollRange(goldRange.min, goldRange.max);
    if (isBoss && enemy.name === bossName) {
      enemyGold = Math.floor(enemyGold * BOSS_GOLD_MULTIPLIER);
    }
    totalGold += enemyGold;
  }

  const victoryTier = determineVictoryTier(encounterCalc.difficulty, isBoss);

  const itemCount = getItemDropCount(isBoss, victoryTier);
  const lootItems: LootItem[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < itemCount; i++) {
    const rarity = getLootRarity(characterLevel, isBoss && i === 0);
    const item = selectLootItem(rarity);
    if (item && !usedNames.has(item.name)) {
      usedNames.add(item.name);
      lootItems.push({
        name: item.name,
        type: item.type,
        rarity: item.rarity,
        description: item.description,
        value: item.value,
        magicBonus: item.magicBonus,
        damageDice: item.damageDice,
        damageType: item.damageType,
        baseAC: item.baseAC,
        specialEffect: item.specialEffect,
        requiresAttunement: item.requiresAttunement,
      });
    }
  }

  let shouldAdvanceChapter = false;
  let chapterAdvanceReason: string | undefined;

  if (isBoss && currentChapter < totalChapters) {
    if (victoryTier === 'epic' || victoryTier === 'major') {
      shouldAdvanceChapter = true;
      chapterAdvanceReason = `Defeated ${bossName || 'the boss'} — a defining victory that advances the story`;
    }
  }

  const enemyNames = defeatedEnemies.map(e => e.name).join(', ');
  let encounterSummary = '';
  if (isBoss) {
    encounterSummary = `Boss defeated: ${bossName}! ${victoryTier === 'epic' ? 'An epic victory!' : 'A major victory!'} `;
    encounterSummary += `Earned ${baseXP} XP and ${totalGold} gold.`;
    if (lootItems.length > 0) {
      encounterSummary += ` Found ${lootItems.length} item${lootItems.length > 1 ? 's' : ''}: ${lootItems.map(i => i.name).join(', ')}.`;
    }
    if (shouldAdvanceChapter) {
      encounterSummary += ` Chapter ${currentChapter} complete — advancing to Chapter ${currentChapter + 1}!`;
    }
  } else {
    encounterSummary = `Defeated: ${enemyNames}. Earned ${baseXP} XP and ${totalGold} gold.`;
    if (lootItems.length > 0) {
      encounterSummary += ` Found: ${lootItems.map(i => i.name).join(', ')}.`;
    }
  }

  return {
    xpAwarded: baseXP,
    goldAwarded: totalGold,
    lootItems,
    isBossFight: isBoss,
    bossName,
    difficulty: encounterCalc.difficulty,
    shouldAdvanceChapter,
    chapterAdvanceReason,
    victoryTier,
    encounterSummary,
  };
}
