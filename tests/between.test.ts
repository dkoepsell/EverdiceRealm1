/**
 * Between campaigns (engagement spec Phase 6): learning path progress, legend
 * carryover into a new ledger, downtime hooks, generated puzzles and rooms,
 * global flags.
 *
 * Run with: npx tsx tests/between.test.ts
 */
import { LESSONS, learningProgress, lessonPromptLine } from '../shared/rules/learningPath';
import { seedFromLegends } from '../server/play/between/legend';
import { runHookActivity } from '../server/play/between/downtime';
import { generatePuzzle } from '../server/play/content/puzzleGenerators';
import { generateRoom, ROOM_COMBINATIONS } from '../server/play/content/rooms';
import { checkPuzzleAnswer as checkAnalyticAnswer } from '../server/lib/explorationPuzzles';
import { EMPTY_LEDGER, reputationOf } from '../shared/ledger';
import { globalFlags, allFlagsOn, ENGAGEMENT_FLAGS } from '../shared/engagementFlags';
import { selectCallbacks } from '../server/play/ledger/callbacks';

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
function rng(seed: number) { return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }; }

console.log('learning path');
check('8 lessons', LESSONS.length, 8);
const fresh = learningProgress(new Set());
check('first lesson is next, rest locked', [fresh[0].state, fresh[1].state, fresh[7].state], ['next', 'locked', 'locked']);
const p2 = learningProgress(new Set(['ability_check', 'advantage']));
check('learned from rules seen anywhere', [p2[0].state, p2[1].state, p2[2].state], ['learned', 'learned', 'next']);
check('skipping counts', learningProgress(new Set(), new Set(['ability_checks']))[0].state, 'learned');
check('lesson prompt uses the mechanic name', lessonPromptLine(LESSONS[2]).includes('Your turn in combat'), true);

console.log('legend carryover');
const seeded = seedFromLegends(EMPTY_LEDGER, [{
  legend: { reputation: 'mercy', recurringNpc: { name: 'Mira', role: 'ferrywoman', want: 'her brother freed', attitude: 2 }, fromCampaign: 'The Mire Lantern' },
  hooks: [{ kind: 'rumor', text: 'Someone is buying every lantern oil cask', createdAt: 'x' }, { kind: 'contact', text: 'Petra owes you', npc: { name: 'Petra Quill', role: 'fence', want: 'a partner', attitude: 1 }, createdAt: 'x' }, { kind: 'rumor', text: 'old', createdAt: 'x', used: true }],
}]);
check('recurring NPC joins the cast', seeded.ledger.cast.map((c) => c.name), ['Mira', 'Petra Quill']);
check('reputation carries', reputationOf(seeded.ledger.deeds)?.word, 'merciful');
check('rumor becomes an open thread', seeded.ledger.threads.map((t) => t.summary), ['Someone is buying every lantern oil cask']);
check('used hooks are not reused', seeded.usedHooks, 2);
check('the recurring NPC is offered as an early callback', selectCallbacks(seeded.ledger, { location: 'Anywhere' }).some((c) => c.npc === 'Mira'), true);
check('only seeds a brand-new ledger', seedFromLegends({ ...EMPTY_LEDGER, turn: 3 }, [{ legend: { reputation: 'mercy', recurringNpc: null, fromCampaign: null }, hooks: [] }]).ledger.deeds.length, 0);

console.log('downtime hooks');
const hero: any = { level: 3, skills: ['Investigation', 'Persuasion'], features: [], strength: 10, dexterity: 14, constitution: 12, intelligence: 14, wisdom: 12, charisma: 14, downtimeState: {} };
const research = runHookActivity('research', hero, () => 0.95);
check('successful research yields a rumor', [research.success, research.hook?.kind], [true, 'rumor']);
check('failed research yields nothing', runHookActivity('research', hero, () => 0).hook, null);
check('carousing success makes a contact', runHookActivity('carousing', hero, () => 0.95).hook?.kind, 'contact');
check('carousing failure is a complication', runHookActivity('carousing', hero, () => 0).hook?.kind, 'rumor');
check('training progresses', runHookActivity('training', { ...hero, downtimeState: { training: { name: 'Elvish', sessions: 2 } } }, () => 0.95).trainingProgress, { name: 'Elvish', sessions: 3 });
check('training completes at 5', runHookActivity('training', { ...hero, downtimeState: { training: { name: 'Elvish', sessions: 4 } } }, () => 0.95).hook?.kind, 'training');
check('math shown', research.breakdown.startsWith('Intelligence (Investigation): d20'), true);

console.log('generated puzzles');
const r = rng(5);
let allValid = true;
const ids = new Set<string>();
for (let i = 0; i < 200; i++) {
  const p = generatePuzzle(r);
  ids.add(p.id);
  const correct = p.choices!.find((c) => c.text === p.answer);
  if (!correct || !checkAnalyticAnswer(p, p.answer).correct || p.choices!.length !== 4 || new Set(p.choices!.map((c) => c.text)).size !== 4) allValid = false;
}
check('every generated puzzle has its answer among 4 distinct choices and grades correct', allValid, true);
check(`many distinct instances (${ids.size} of 200)`, ids.size > 60, true);
check('exclusion avoids seen ids', (() => { const p = generatePuzzle(rng(9)); return generatePuzzle(rng(9), new Set([p.id])).id !== p.id; })(), true);

console.log('combinatorial rooms');
check('1,440 combinations per biome', ROOM_COMBINATIONS, 1440);
const rooms = new Set(Array.from({ length: 300 }, (_, i) => generateRoom('forest', rng(i + 1)).contentId));
check(`varied (${rooms.size} distinct in 300)`, rooms.size > 150, true);
const room = generateRoom('desert', rng(3));
check('unknown biome falls back', room.contentId.startsWith('room:desert:'), true);
check('rooms offer investigate/engage/avoid', room.choices.map((c) => c.intentTag), ['investigate', 'engage', 'avoid']);

console.log('global flags');
check('env list switches flags on', [globalFlags('learningPath, downtime').learningPath, globalFlags('learningPath, downtime').downtime, globalFlags('learningPath').ledger], [true, true, ENGAGEMENT_FLAGS.ledger]);
check('unknown env names ignored', 'bogus' in globalFlags('bogus'), false);
check('lesson one-shots turn everything on', Object.values(allFlagsOn()).every(Boolean), true);

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
