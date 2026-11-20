/**
 * Class actions + death saves (engagement spec 4.3, "Accuracy tests are
 * mandatory"): Sneak Attack eligibility and once per turn, Rage resistance and
 * damage, Action Surge, Divine Smite, Extra Attack, cantrip scaling, Arcane
 * Recovery, death saving throws.
 *
 * Run with: npx tsx tests/rules/classActions.test.ts
 */
import {
  applyResistance, arcaneRecoveryBudget, attacksPerAction, bardicInspirationDie, cantripDiceCount, divineSmiteDice,
  martialArtsDie, rageDamageBonus, sneakAttackDice, sneakAttackEligibility, validateArcaneRecovery, weaponProfile, attackAbilityMod,
} from '../../shared/rules/classActions';
import { applyDeathSave } from '../../shared/rules/deathSaves';
import { resolveClassTurn } from '../../server/play/combat/classTurn';

let failures = 0;
let checks = 0;
function check(name: string, actual: unknown, expected: unknown) {
  checks++;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures++;
    console.error(`  ✗ ${name}\n      expected ${e}\n      actual   ${a}`);
  } else {
    console.log(`  ✓ ${name}`);
  }
}

const shortsword = weaponProfile('Shortsword');
const longsword = weaponProfile('Longsword');
const bow = weaponProfile('Shortbow');

console.log('weapons');
check('shortsword is finesse 1d6 piercing', [shortsword.finesse, shortsword.damageDice, shortsword.damageType], [true, '1d6', 'piercing']);
check('longsword is not finesse', longsword.finesse, false);
check('shortbow is ranged', bow.ranged, true);
check('finesse uses better of STR/DEX', attackAbilityMod(shortsword, 10, 16), 3);
check('longsword uses STR', attackAbilityMod(longsword, 10, 16), 0);
check('bow uses DEX', attackAbilityMod(bow, 18, 12), 1);

console.log('Sneak Attack');
const sa = (o: Partial<Parameters<typeof sneakAttackEligibility>[0]>) => sneakAttackEligibility({ className: 'Rogue', weapon: shortsword, advantage: false, disadvantage: false, allyAdjacent: false, usedThisTurn: false, ...o }).eligible;
check('advantage qualifies', sa({ advantage: true }), true);
check('ally adjacent qualifies', sa({ allyAdjacent: true }), true);
check('neither: no', sa({}), false);
check('ally adjacent but disadvantage: no', sa({ allyAdjacent: true, disadvantage: true }), false);
check('advantage + disadvantage cancel; ally adjacent still needs no disadvantage', sa({ advantage: true, disadvantage: true, allyAdjacent: true }), false);
check('non-finesse melee weapon: no', sa({ weapon: longsword, advantage: true }), false);
check('ranged weapon: yes', sa({ weapon: bow, advantage: true }), true);
check('once per turn', sa({ advantage: true, usedThisTurn: true }), false);
check('not a rogue: no', sa({ className: 'Fighter', advantage: true }), false);
check('dice 1d6 / 2d6 / 3d6 / 5d6', [1, 3, 5, 9].map(sneakAttackDice), ['1d6', '2d6', '3d6', '5d6']);

console.log('Rage, Smite, Extra Attack, scaling');
check('rage damage +2/+3/+4', [1, 9, 16].map(rageDamageBonus), [2, 3, 4]);
check('resistance halves, rounding down', [applyResistance(9), applyResistance(10), applyResistance(1)], [4, 5, 0]);
check('smite 2d8 at 1st, 3d8 at 2nd, cap 5d8', [1, 2, 4, 5].map((l) => divineSmiteDice(l, false)), [2, 3, 5, 5]);
check('smite +1d8 vs undead', divineSmiteDice(1, true), 3);
check('extra attack at 5 for martial classes', [attacksPerAction('Fighter', 4), attacksPerAction('Fighter', 5), attacksPerAction('Rogue', 5), attacksPerAction('Paladin', 5)], [1, 2, 1, 2]);
check('fighter third attack at 11', attacksPerAction('Fighter', 11), 3);
check('cantrip dice at 1/5/11/17', [1, 5, 11, 17].map(cantripDiceCount), [1, 2, 3, 4]);
check('arcane recovery: half level rounded up', arcaneRecoveryBudget(5).totalLevels, 3);
check('arcane recovery: 1st+2nd at level 5 ok', validateArcaneRecovery(5, [1, 2]), true);
check('arcane recovery: over budget refused', validateArcaneRecovery(5, [2, 2]), false);
check('martial arts die', [1, 5, 11].map(martialArtsDie), ['1d4', '1d6', '1d8']);
check('bardic inspiration die', [1, 5, 10].map(bardicInspirationDie), ['d6', 'd8', 'd10']);

console.log('death saving throws');
check('10 is a success', applyDeathSave(10, 0, 0).successes, 1);
check('9 is a failure', applyDeathSave(9, 0, 0).failures, 1);
check('natural 1 is two failures', applyDeathSave(1, 0, 0).failures, 2);
check('natural 20 regains 1 HP', applyDeathSave(20, 0, 2).outcome, 'regain_1hp');
check('third success stabilizes', applyDeathSave(12, 2, 2).outcome, 'stable');
check('third failure dies', applyDeathSave(5, 2, 2).outcome, 'dead');
check('natural 1 at two failures dies', applyDeathSave(1, 0, 2).outcome, 'dead');
check('still dying', applyDeathSave(15, 0, 1).outcome, null);

console.log('a resolved turn (the design mock: Thessaly vs a bandit)');
const seq = (...n: number[]) => { const q = [...n]; return (_s: number) => q.length ? q.shift()! : 1; };
const rogue = { name: 'Thessaly', class: 'Rogue', level: 3, hitPoints: 19, maxHitPoints: 21, strength: 10, dexterity: 16, constitution: 12, intelligence: 12, wisdom: 14, charisma: 16, skills: ['Stealth'], equippedWeapon: 'Shortsword' };
const bandit = [{ name: 'Bandit', type: 'enemy', ac: 12, currentHp: 11 }];
const base = { character: rogue, features: [{ id: 'sneak_attack' }, { id: 'cunning_action' }, { id: 'expertise', choices: ['stealth'] }], combat: {}, enemies: bandit, allyEngaged: true, spellSlotsAvailable: () => false };
// d20 = 14 → 14 + 5 = 19 hits AC 12; shortsword d6 = 4; Sneak Attack 2d6 = 3 + 5.
const hit = resolveClassTurn({ action: 'attack', targetName: 'Bandit' }, { ...base, d: seq(14, 4, 3, 5) });
check('hit with +5 to hit vs AC 12', [hit.hit, hit.attackRoll?.total], [true, 19]);
check('damage: 4 + 3 DEX + Sneak Attack 8 = 15', hit.damageTotal, 15);
check('sneak attack rule fires', hit.rulesFired.includes('sneak_attack'), true);
const alone = resolveClassTurn({ action: 'attack' }, { ...base, allyEngaged: false, d: seq(14, 4) });
check('no ally, no advantage: no Sneak Attack', alone.damageTotal, 7);
const hide = resolveClassTurn({ action: 'attack', bonus: 'cunning_hide' }, { ...base, allyEngaged: false, d: seq(15, 6, 18, 4, 2, 2) });
check('Cunning Action Hide then attack: advantage → Sneak Attack', [hide.breakdown[0].includes('hidden'), hide.damageTotal], [true, 4 + 3 + 4]);
const fighter = { ...rogue, name: 'Brann', class: 'Fighter', level: 5, strength: 16, dexterity: 12, equippedWeapon: 'Longsword' };
const surge = resolveClassTurn({ action: 'attack', actionSurge: true }, { character: fighter, features: [{ id: 'action_surge', usesRemaining: 1 }, { id: 'extra_attack' }], combat: {}, enemies: [{ name: 'Ogre', ac: 11, currentHp: 59 }], allyEngaged: false, spellSlotsAvailable: () => false, d: seq(15, 5, 15, 5, 15, 5, 15, 5) });
check('Action Surge + Extra Attack = 4 attacks', surge.breakdown.filter((b) => b.startsWith('Longsword')).length, 4);
check('Action Surge spends its use', surge.featureUses.action_surge, 1);
check('no Action Surge left: refused', resolveClassTurn({ action: 'attack', actionSurge: true }, { character: fighter, features: [{ id: 'action_surge', usesRemaining: 0 }], combat: {}, enemies: [{ name: 'Ogre', ac: 11 }], allyEngaged: false, spellSlotsAvailable: () => false, d: seq(10) }).ok, false);
const barb = { ...fighter, name: 'Ulf', class: 'Barbarian', level: 3, equippedWeapon: 'Greataxe' };
const rage = resolveClassTurn({ action: 'attack', bonus: 'rage' }, { character: barb, features: [{ id: 'rage', usesRemaining: 3 }], combat: {}, enemies: [{ name: 'Wolf', ac: 13 }], allyEngaged: false, spellSlotsAvailable: () => false, d: seq(15, 7) });
check('Rage adds +2 melee damage: 7 + 3 STR + 2', rage.damageTotal, 12);
check('Rage lasts (10 rounds, one used)', rage.combat.rageRoundsLeft, 9);
const sw = resolveClassTurn({ action: 'dodge', bonus: 'second_wind' }, { character: { ...fighter, hitPoints: 10, maxHitPoints: 44 }, features: [{ id: 'second_wind', usesRemaining: 1 }], combat: {}, enemies: [], allyEngaged: false, spellSlotsAvailable: () => false, d: seq(6) });
check('Second Wind heals 1d10 + level', sw.healed, 11);
check('Dodge sets dodging', sw.combat.dodging, true);

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
