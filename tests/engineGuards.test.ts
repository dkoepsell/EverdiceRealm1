/**
 * Tests for the engine guards added after the Hollow Crown playtest:
 * combat entry from an attack, final-chapter steering, choice hygiene.
 *
 * Run with: npx tsx tests/engineGuards.test.ts
 */
import { ensureCombatForAttack, lookupCreatureStats, attackIntentDirective } from '../server/lib/combatEntry';
import { scenesInFinalChapter, streamFinaleDirective } from '../server/lib/finale';
import { cleanChoices } from '../server/lib/choiceHygiene';

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

// ── Combat entry ──
const attack = { type: 'weapon_attack', hit: true, targetName: 'Zombie', damage: { total: 7 } };
const started = ensureCombatForAttack(attack, { inCombat: false, combatants: [] }, { location: 'Crypt' }, 4);
check('an attack outside combat starts combat', started?.inCombat, true);
check('the target becomes a combatant with SRD HP', started?.combatants?.map((c: any) => [c.name, c.maxHp, c.ac]), [['Zombie', 22, 8]]);
check('other story state survives', started?.location, 'Crypt');
check('no restart while a fight is running',
  ensureCombatForAttack(attack, { inCombat: true, combatants: [{ name: 'Zombie' }] }, {}, 4), null);
check('skill checks never start combat', ensureCombatForAttack({ total: 15, dc: 12 }, null, {}, 4), null);
check('an AI-listed target is not duplicated',
  ensureCombatForAttack(attack, null, { combatants: [{ name: 'zombie', maxHp: 30 }] }, 4)?.combatants.length, 1);
check('plural / adjectival names still match', lookupCreatureStats('two rotting zombies').hp, 22);
check('unknown creatures scale with level', lookupCreatureStats('Hollow Knight', 4).hp, 38);
check('the attack directive demands inCombat', attackIntentDirective().includes('"inCombat": true'), true);

// ── Finale ──
const log = [{ type: 'chapter_gate', turnsAtGate: 120 }, { type: 'chapter_gate', turnsAtGate: 130 }];
check('final-chapter scenes count from the last gate', scenesInFinalChapter(log, 142), 12);
check('no directive outside the final chapter', streamFinaleDirective(false, 20), '');
check('early finale pushes toward the climax', streamFinaleDirective(true, 2).includes('drive toward the climax'), true);
check('late finale demands the ending', streamFinaleDirective(true, 9).includes('THE CAMPAIGN ENDS NOW'), true);

// ── Choice hygiene ──
const cleaned = cleanChoices(
  [{ text: 'Make the defining choice' }, { text: 'Take action' }, { text: 'Smash the crown' }, { action: 'Flee', text: 'Run' }],
  ['Make the defining choice'],
);
check('engine labels and placeholders are dropped', cleaned.map((c: any) => c.text), ['Smash the crown', 'Run']);
check('text-only choices gain an action', cleaned[0].action, 'Smash the crown');
check('an explicit action is kept', cleaned[1].action, 'Flee');

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) process.exit(1);
