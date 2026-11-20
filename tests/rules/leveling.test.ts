/**
 * Level-up rules: HP math, ASI validation, subclass step, milestone/XP earning,
 * rest recharge and Hit Dice.
 *
 * Run with: npx tsx tests/rules/leveling.test.ts
 */
import {
  applyLevelUp, earnLevel, hpGainForLevel, levelOutcomeForXp, planLevelUp, validateLevelUpChoices,
  buildFeatureState, featuresPromptLine, type LevelUpCharacter,
} from '../../shared/rules/leveling';
import { getClassDef } from '../../shared/rules/classProgression';
import { hitDiceAfterLongRest, rechargeFeatures, spendHitDice } from '../../shared/rules/rests';
import { getAbilityModifier, getProficiencyBonus } from '../../shared/rules/xp';

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

console.log('ability modifiers and proficiency');
check('8 → -1', getAbilityModifier(8), -1);
check('9 → -1', getAbilityModifier(9), -1);
check('10 → 0', getAbilityModifier(10), 0);
check('15 → +2', getAbilityModifier(15), 2);
check('20 → +5', getAbilityModifier(20), 5);
check('prof by level 1/4/5/9/13/17', [1, 4, 5, 9, 13, 17].map(getProficiencyBonus), [2, 2, 3, 4, 5, 6]);

console.log('HP gained per level (5e fixed value + Con, min 1)');
check('rogue d8 avg 5 + Con 12 (+1) = 6', hpGainForLevel('Rogue', 12, 'average').gain, 6);
check('barbarian d12 avg 7', hpGainForLevel('Barbarian', 10, 'average').gain, 7);
check('fighter d10 avg 6', hpGainForLevel('Fighter', 10, 'average').gain, 6);
check('wizard d6 avg 4', hpGainForLevel('Wizard', 10, 'average').gain, 4);
check('roll uses the die', hpGainForLevel('Rogue', 12, 'roll', () => 8).gain, 9);
check('minimum 1 HP per level', hpGainForLevel('Wizard', 3, 'roll', () => 1).gain, 1);

const rogue = (over: Partial<LevelUpCharacter> = {}): LevelUpCharacter => ({
  class: 'Rogue', level: 3, subclass: 'thief', maxHitPoints: 21, hitPoints: 14,
  strength: 10, dexterity: 16, constitution: 12, intelligence: 12, wisdom: 14, charisma: 16,
  features: [], hitDiceRemaining: 3, ...over,
});
const pending = (from: number, to = from + 1) => ({ fromLevel: from, toLevel: to, reason: 'chapter_gate:1:2', earnedAt: 'x' });

console.log('level 3 → 4 rogue (the design mock)');
const plan4 = planLevelUp(rogue(), pending(3))!;
check('to level 4', plan4.toLevel, 4);
check('needs ASI at 4', plan4.needsAsi, true);
check('no subclass step (already Thief)', plan4.needsSubclass, false);
check('average gain 6', plan4.averageGain, 6);
check('ASI required', validateLevelUpChoices(rogue(), plan4, { hpMode: 'average' }).length > 0, true);
check('+2 over 20 refused', validateLevelUpChoices(rogue({ dexterity: 19 }), plan4, { hpMode: 'average', asi: { type: 'plus2', ability: 'dexterity' } }).length > 0, true);
check('+1/+1 same ability refused', validateLevelUpChoices(rogue(), plan4, { hpMode: 'average', asi: { type: 'plus1x2', abilities: ['dexterity', 'dexterity'] } }).length > 0, true);
const res4 = applyLevelUp(rogue(), plan4, { hpMode: 'average', asi: { type: 'plus2', ability: 'dexterity' } });
check('max HP 21 → 27', res4.updates.maxHitPoints, 27);
check('current HP rises by the same 6, not full heal', res4.updates.hitPoints, 20);
check('DEX 16 → 18', res4.updates.dexterity, 18);
check('hit dice +1', res4.updates.hitDiceRemaining, 4);

console.log('Con ASI raises HP retroactively');
const planCon = planLevelUp(rogue({ constitution: 13 }), pending(3))!;
const resCon = applyLevelUp(rogue({ constitution: 13 }), planCon, { hpMode: 'average', asi: { type: 'plus1x2', abilities: ['constitution', 'charisma'] } });
// Con 13 → 14: modifier +1 → +2. New level: 5 + 2 = 7, plus 1 × 3 earlier levels = 10.
check('Con 13→14 at level 4 adds 10', resCon.updates.maxHitPoints - 21, 10);

console.log('subclass step and catch-up');
const plan3 = planLevelUp(rogue({ level: 2, subclass: null }), pending(2))!;
check('rogue 2 → 3 needs Roguish Archetype', plan3.needsSubclass, true);
check('subclass option is Thief', plan3.subclassOption?.label, 'Roguish Archetype');
check('Thief features previewed', plan3.newFeatures.map((f) => f.id).includes('fast_hands'), true);
check('wrong subclass refused', validateLevelUpChoices(rogue({ level: 2, subclass: null }), plan3, { hpMode: 'average', subclass: 'assassin' }).length > 0, true);
const res3 = applyLevelUp(rogue({ level: 2, subclass: null }), plan3, { hpMode: 'average', subclass: getClassDef('rogue')!.subclass.id });
check('subclass saved', res3.updates.subclass, getClassDef('rogue')!.subclass.id);
check('new features include fast_hands', res3.newFeatureIds.includes('fast_hands'), true);
const late = planLevelUp(rogue({ level: 5, subclass: null }), pending(5))!;
check('level 5 rogue without subclass gets catch-up pick', late.needsSubclass, true);
check('improved feature flagged (expertise at 6)', planLevelUp(rogue({ level: 5 }), pending(5))!.newFeatures.find((f) => f.id === 'expertise')?.improves, true);

console.log('earning levels');
check('milestone earns exactly one', earnLevel(3, null, 'gate:a', { mode: 'milestone', now: 't' }), { fromLevel: 3, toLevel: 4, reason: 'gate:a', earnedAt: 't' });
check('same gate twice is one level', earnLevel(3, pending(3), 'chapter_gate:1:2', { mode: 'milestone' })?.toLevel, 4);
check('second gate stacks a second level', earnLevel(3, pending(3), 'gate:b', { mode: 'milestone' })?.toLevel, 5);
check('cap at 20', earnLevel(20, null, 'gate:a', { mode: 'milestone' }), null);
check('xp mode catches up', earnLevel(1, null, 'xp', { mode: 'xp', xp: 2700 })?.toLevel, 4);
check('xp mode below threshold earns nothing', earnLevel(1, null, 'xp', { mode: 'xp', xp: 299 }), null);
check('flag off: legacy level + HP', levelOutcomeForXp({ class: 'Rogue', level: 1, constitution: 12 }, 900, { levelUpsFlag: false, mode: 'milestone', reason: 'xp' }), { level: 3, hpGain: 12, leveledUp: true });
check('flag on milestone: XP alone never levels', levelOutcomeForXp({ class: 'Rogue', level: 1, constitution: 12 }, 900, { levelUpsFlag: true, mode: 'milestone', reason: 'xp' }), { level: 1, hpGain: 0, leveledUp: false });
check('flag on xp: pending recorded', levelOutcomeForXp({ class: 'Rogue', level: 1, constitution: 12 }, 900, { levelUpsFlag: true, mode: 'xp', reason: 'xp', now: 't' }).pendingLevelUp?.toLevel, 3);

console.log('rests');
const scores = { strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 };
const fighter = getClassDef('fighter')!;
const spent = buildFeatureState(fighter, 2, null, scores).map((f) => (typeof f.usesRemaining === 'number' ? { ...f, usesRemaining: 0 } : f));
const afterShort = rechargeFeatures('Fighter', 2, null, scores, spent, 'short');
check('short rest refills Second Wind', afterShort.find((f) => f.id === 'second_wind')?.usesRemaining, 1);
check('short rest refills Action Surge', afterShort.find((f) => f.id === 'action_surge')?.usesRemaining, 1);
const barb = getClassDef('barbarian')!;
const raged = buildFeatureState(barb, 3, null, scores).map((f) => (f.id === 'rage' ? { ...f, usesRemaining: 0 } : f));
check('short rest does NOT refill Rage', rechargeFeatures('Barbarian', 3, null, scores, raged, 'short').find((f) => f.id === 'rage')?.usesRemaining, 0);
check('long rest refills Rage', rechargeFeatures('Barbarian', 3, null, scores, raged, 'long').find((f) => f.id === 'rage')?.usesRemaining, 3);
check('long rest: half hit dice back (level 6, 1 left → 4)', hitDiceAfterLongRest(6, 1), 4);
check('long rest: min 1 die back (level 1)', hitDiceAfterLongRest(1, 0), 1);
check('long rest: never above level', hitDiceAfterLongRest(4, 4), 4);
const hd = spendHitDice(8, 12, 3, 2, () => 5);
check('spend 2d8 + Con(+1) each = 12', hd.healed, 12);
check('cannot spend more than remain', spendHitDice(8, 12, 1, 3, () => 5).spent, 1);

console.log('FEATURES prompt line');
const rogueState = buildFeatureState(getClassDef('rogue')!, 3, getClassDef('rogue')!.subclass.id, scores);
const line = featuresPromptLine('Rogue', 3, getClassDef('rogue')!.subclass.id, rogueState);
check('mentions Sneak Attack 2d6', line.includes('Sneak Attack 2d6'), true);
check('mentions Cunning Action as bonus action', /Cunning Action[^;]*bonus action/.test(line), true);

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
