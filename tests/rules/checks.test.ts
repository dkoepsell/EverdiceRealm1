/**
 * Ability checks resolved in code: modifiers, proficiency, expertise, Jack of
 * All Trades, passives, DC bands, advantage never stacking.
 *
 * Run with: npx tsx tests/rules/checks.test.ts
 */
import {
  checkModifier, combineRollMode, dcLabel, describeCheck, normalizeSkill, passives, resolveCheck, validateDc,
} from '../../shared/rules/checks';

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
const thessaly = {
  level: 3, skills: ['Stealth', 'Persuasion', 'Insight', 'Perception', 'thieves_tools'],
  features: [{ id: 'expertise', choices: ['stealth', 'thieves_tools'] }, { id: 'sneak_attack' }],
  strength: 10, dexterity: 16, constitution: 12, intelligence: 12, wisdom: 14, charisma: 16,
};

console.log('modifiers (the design mock: Thessaly, Rogue 3)');
check('Persuasion +5 (CHA +3, prof +2)', checkModifier(thessaly, 'persuasion').total, 5);
check('label', checkModifier(thessaly, 'Persuasion Check').label, 'Charisma (Persuasion)');
check('Stealth expertise +7', checkModifier(thessaly, 'stealth').total, 7);
check('expertise flagged', checkModifier(thessaly, 'stealth').expertise, true);
check('Insight +4', checkModifier(thessaly, 'insight').total, 4);
check('untrained Athletics +0', checkModifier(thessaly, 'athletics').total, 0);
check('raw ability check gets no proficiency', checkModifier({ ...thessaly, skills: ['charisma'] }, 'charisma').total, 3);
check('Jack of All Trades adds half prof (rounded down) untrained', checkModifier({ ...thessaly, features: [{ id: 'jack_of_all_trades' }], level: 5 }, 'athletics').total, 1);
check('Jack does not stack on proficient skills', checkModifier({ ...thessaly, features: [{ id: 'jack_of_all_trades' }] }, 'persuasion').total, 5);
check('expertise needs proficiency', checkModifier({ ...thessaly, skills: [] }, 'stealth').total, 3);

console.log('passives');
check('passive Insight 14, Perception 14, Investigation 11', passives(thessaly), { perception: 14, investigation: 11, insight: 14 });

console.log('skill names from the model');
check('"Persuasion Check"', normalizeSkill('Persuasion Check'), 'persuasion');
check('"sleight of hand"', normalizeSkill('Sleight of Hand'), 'sleight_of_hand');
check('"lie" → deception', normalizeSkill('lie'), 'deception');
check('"Animal-Handling"', normalizeSkill('Animal-Handling'), 'animal_handling');
check('attack stays attack', normalizeSkill('attack'), 'attack');
check('nonsense → null', normalizeSkill('zzz'), null);

console.log('DCs');
check('DC 13 reads Medium', dcLabel(13), 'Medium');
check('DC 12 reads Easy', dcLabel(12), 'Easy');
check('DC 10 Easy / 15 Medium / 20 Hard', [10, 15, 20].map(dcLabel), ['Easy', 'Medium', 'Hard']);
check('DC clamped to 5..30', [validateDc(2), validateDc(45), validateDc('14'), validateDc('x')], [5, 30, 14, 15]);

console.log('advantage and disadvantage never stack');
check('one advantage', combineRollMode(1, 0), 'advantage');
check('three advantages is still advantage', combineRollMode(3, 0), 'advantage');
check('advantage + disadvantage cancel', combineRollMode(2, 1), 'normal');
check('disadvantage', combineRollMode(0, 2), 'disadvantage');

console.log('resolving');
const seq = (...n: number[]) => () => n.shift()!;
const pers = checkModifier(thessaly, 'persuasion');
const adv = resolveCheck(pers, 13, 'advantage', seq(4, 15));
check('advantage keeps the higher', [adv.dice, adv.kept, adv.total, adv.success], [[4, 15], 15, 20, true]);
const dis = resolveCheck(pers, 13, 'disadvantage', seq(4, 15));
check('disadvantage keeps the lower', [dis.kept, dis.total, dis.success], [4, 9, false]);
check('meets the DC exactly = success', resolveCheck(pers, 13, 'normal', seq(8)).success, true);
check('nat 20 is not an automatic success on a check', resolveCheck(checkModifier(thessaly, 'athletics'), 25, 'normal', seq(20)).success, false);
check('nat 1 is not an automatic failure on a check', resolveCheck(checkModifier(thessaly, 'stealth'), 8, 'normal', seq(1)).success, true);
check('math shown', describeCheck(resolveCheck(pers, 13, 'normal', seq(10))), 'd20 (10) + 3 CHA + 2 proficient = 15 vs DC 13 (Medium)');

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
