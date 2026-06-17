// Tavern bounty catalog. Each bounty is a hunt against a difficulty-scaled target,
// resolved server-side as a deterministic skirmish (see the /hunt endpoint).
// Difficulty → CR/stat block follows the same scaling used by shared/rules/xp.ts.

export type BountyDifficulty = "Easy" | "Moderate" | "Challenging" | "Deadly";

export interface BountyEnemy {
  name: string;
  type: string;
  cr: string;
  maxHp: number;
  armorClass: number;
  attackBonus: number;
  damageRoll: string; // e.g. "2d6+3"
}

export interface Bounty {
  id: string;
  target: string;
  description: string;
  reward: number; // gold paid on victory
  difficulty: BountyDifficulty;
  recommendedLevel: string;
  enemy: BountyEnemy;
}

// Difficulty → target combat profile (CR-scaled).
const DIFFICULTY_PROFILE: Record<BountyDifficulty, { cr: string; recommendedLevel: string; maxHp: number; armorClass: number; attackBonus: number; damageRoll: string }> = {
  Easy:        { cr: "1", recommendedLevel: "1–2", maxHp: 30,  armorClass: 13, attackBonus: 4, damageRoll: "1d8+2" },
  Moderate:    { cr: "3", recommendedLevel: "3–4", maxHp: 55,  armorClass: 14, attackBonus: 5, damageRoll: "2d6+3" },
  Challenging: { cr: "5", recommendedLevel: "5–6", maxHp: 95,  armorClass: 15, attackBonus: 6, damageRoll: "2d8+4" },
  Deadly:      { cr: "8", recommendedLevel: "7–9", maxHp: 150, armorClass: 17, attackBonus: 7, damageRoll: "2d10+5" },
};

function buildEnemy(name: string, type: string, difficulty: BountyDifficulty): BountyEnemy {
  const p = DIFFICULTY_PROFILE[difficulty];
  return { name, type, cr: p.cr, maxHp: p.maxHp, armorClass: p.armorClass, attackBonus: p.attackBonus, damageRoll: p.damageRoll };
}

export const BOUNTIES: Bounty[] = [
  { id: 'goblin-chief', target: 'Gnarl, Goblin Warchief', description: 'Terrorizing the Eastroads. Wanted dead or alive. Report to the Town Guard.', reward: 75, difficulty: 'Easy',
    recommendedLevel: DIFFICULTY_PROFILE.Easy.recommendedLevel, enemy: buildEnemy('Gnarl, Goblin Warchief', 'humanoid', 'Easy') },
  { id: 'bandit-gang', target: 'The Scarred Hand Gang', description: 'Brigands ambushing caravans near the Thornwood. Their leader is the real threat.', reward: 200, difficulty: 'Moderate',
    recommendedLevel: DIFFICULTY_PROFILE.Moderate.recommendedLevel, enemy: buildEnemy('Scarred Hand Ringleader', 'humanoid', 'Moderate') },
  { id: 'bridge-troll', target: 'Bridge Troll (unnamed)', description: 'Claimed the Old Mill Bridge. Three farmers dead. No tolls negotiated.', reward: 150, difficulty: 'Moderate',
    recommendedLevel: DIFFICULTY_PROFILE.Moderate.recommendedLevel, enemy: buildEnemy('Bridge Troll', 'giant', 'Moderate') },
  { id: 'werewolf', target: 'The Moonwood Killer', description: 'Lycanthrope terrorizing farms near the Moonwood. Silver weapons required.', reward: 350, difficulty: 'Challenging',
    recommendedLevel: DIFFICULTY_PROFILE.Challenging.recommendedLevel, enemy: buildEnemy('The Moonwood Killer', 'monstrosity', 'Challenging') },
  { id: 'necromancer', target: 'Meldrath the Grey', description: "Rogue mage raising the dead in Whitefall Cemetery. Mages' Guild wants him stopped.", reward: 500, difficulty: 'Deadly',
    recommendedLevel: DIFFICULTY_PROFILE.Deadly.recommendedLevel, enemy: buildEnemy('Meldrath the Grey', 'humanoid', 'Deadly') },
  { id: 'smuggler', target: "Lira Voss, Smuggler", description: "Running stolen arcane artifacts. Merchant's Guild offers a standing reward.", reward: 125, difficulty: 'Easy',
    recommendedLevel: DIFFICULTY_PROFILE.Easy.recommendedLevel, enemy: buildEnemy('Lira Voss', 'humanoid', 'Easy') },
];

export function getBounty(id: string): Bounty | undefined {
  return BOUNTIES.find(b => b.id === id);
}
