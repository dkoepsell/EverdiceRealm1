/**
 * Tests for the narrator's dice-outcome block.
 *
 * Run with: npx tsx tests/rollNarration.test.ts
 */
import { describeRollForNarrator, rollSucceeded } from '../server/lib/rollNarration';

let failures = 0;
let checks = 0;

function check(name: string, actual: unknown, expected: unknown) {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures++;
    console.error(`  ✗ ${name}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
  } else {
    console.log(`  ✓ ${name}`);
  }
}

// Shape copied from a real Hollow Crown turn the narrator wrote up as a miss.
const longswordHit = {
  hit: true, type: 'weapon_attack', targetName: 'Zombie', weaponName: 'Longsword',
  damage: { total: 7, diceType: 'd8', modifier: 2, diceRolls: [5], damageType: 'slashing', isCritical: false },
  attackRoll: { roll: 9, total: 13, modifier: 4, isCritical: false, isCriticalMiss: false },
};
const hitText = describeRollForNarrator(longswordHit, 'DomLight');
check('an attack hit is a success', rollSucceeded(longswordHit), true);
check('an attack hit is narrated as a HIT', hitText.includes('Result: HIT for 7 slashing damage'), true);
check('the attacker is named', hitText.includes('DomLight with Longsword vs Zombie'), true);
check('an attack hit is never read as a failure', hitText.includes('FAILURE'), false);

const miss = { ...longswordHit, hit: false };
check('an attack miss is a miss', describeRollForNarrator(miss).includes('Result: MISS'), true);

const skill = { diceType: 'd20', result: 8, modifier: 2, total: 10, dc: '12', purpose: 'Persuasion Check' };
check('a skill check below DC fails', rollSucceeded(skill), false);
check('a skill check at DC succeeds', rollSucceeded({ ...skill, total: 12 }), true);
check('skill checks keep the check block', describeRollForNarrator(skill).includes('Check: Persuasion Check'), true);
check('no roll, no block', describeRollForNarrator(undefined), '');

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) process.exit(1);
