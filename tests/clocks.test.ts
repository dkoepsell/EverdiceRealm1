/**
 * Threat clocks and encounter objectives (engagement spec 4.1/4.2).
 *
 * Run with: npx tsx tests/clocks.test.ts
 */
import { clocksPromptLine, fireFullClock, seedClocks, tickClocks, clockNearFull } from '../server/play/clocks';
import { assignObjective, checkMorale, evaluateEncounter } from '../server/play/encounters';
import { midTurn, postTurn, preTurn } from '../server/play/combat/turnHooks';
import { ENGAGEMENT_FLAGS } from '../shared/engagementFlags';

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
const filled = (cs: any[], id: string) => cs.find((c) => c.id === id)?.filled;

console.log('ticking');
let clocks = seedClocks();
check('three clocks seeded', clocks.map((c) => c.id), ['alarm', 'villain_plan', 'wilderness_danger']);
check('failed Stealth ticks alarm by 2', filled(tickClocks(clocks, { roll: { skill: 'stealth', success: false } }).clocks, 'alarm'), 2);
check('successful Stealth ticks nothing', filled(tickClocks(clocks, { roll: { skill: 'stealth', success: true } }).clocks, 'alarm'), 0);
check('loud action ticks alarm', filled(tickClocks(clocks, { choice: 'I kick down the door' }).clocks, 'alarm'), 1);
check('lingering ticks alarm', filled(tickClocks(clocks, { choice: 'We wait here and watch' }).clocks, 'alarm'), 1);
check('travel ticks wilderness', filled(tickClocks(clocks, { sceneType: 'Travel' }).clocks, 'wilderness_danger'), 1);
check('villain plan every 3 scenes', [2, 3].map((n) => filled(tickClocks(clocks, { scenesInChapter: n }).clocks, 'villain_plan')), [0, 1]);
check('unsafe rest ticks villain and wilderness', ['villain_plan', 'wilderness_danger'].map((id) => filled(tickClocks(clocks, { rest: 'unsafe' }).clocks, id)), [1, 1]);
const wild = clocks.map((c) => (c.id === 'wilderness_danger' ? { ...c, filled: 4 } : c));
check('safe rest resets wilderness', filled(tickClocks(wild, { rest: 'safe' }).clocks, 'wilderness_danger'), 0);
check('clocks don\'t tick on noise mid-fight', filled(tickClocks(clocks, { choice: 'attack', inCombat: true }).clocks, 'alarm'), 0);
check('never past full', filled(tickClocks(clocks.map((c) => ({ ...c, filled: c.segments })), { choice: 'shout' }).clocks, 'alarm'), 6);

console.log('firing');
const full = clocks.map((c) => (c.id === 'alarm' ? { ...c, filled: 6 } : c));
const f = fireFullClock(full);
check('full alarm fires combat', f.trigger?.beat, 'combat');
check('fired clock resets', filled(f.clocks, 'alarm'), 0);
check('villain plan fires pressure', fireFullClock(clocks.map((c) => (c.id === 'villain_plan' ? { ...c, filled: 8 } : c))).trigger?.beat, 'pressure');
check('nothing full, nothing fires', fireFullClock(clocks).trigger, null);
check('near full detected', clockNearFull(clocks.map((c) => (c.id === 'alarm' ? { ...c, filled: 5 } : c))), true);
check('prompt line lists live clocks', clocksPromptLine(clocks.map((c) => (c.id === 'alarm' ? { ...c, filled: 4 } : c))), 'THREAT CLOCKS (foreshadow these; the game fires them, not you): Alarm raised 4/6.');

console.log('turn hooks');
const on = { ...ENGAGEMENT_FLAGS, clocks: true, classCombat: true };
const pre = preTurn(on, { clocks: full, clockTrigger: null }, {});
const post = postTurn(on, pre, {}, { choice: 'look around', inCombat: false });
check('a clock that fills fires on the NEXT turn', [post.clockTrigger?.beat, filled(post.clocks, 'alarm')], ['combat', 0]);
const pre2 = preTurn(on, { clocks: post.clocks, clockTrigger: post.clockTrigger }, {});
check('next turn sees the trigger', pre2.trigger?.beat, 'combat');
check('flags off: no clocks', preTurn(ENGAGEMENT_FLAGS, { clocks: full }, {}).clocks, []);

console.log('objectives and morale');
const seqR = (...n: number[]) => () => (n.length ? n.shift()! : 0.99);
let nonKill = 0;
const r = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
for (let i = 0; i < 400; i++) if (assignObjective({ rng: r }).kind !== 'defeat') nonKill++;
check(`at least half of fights aren't "kill all" (${nonKill}/400)`, nonKill >= 200, true);
const hold = { objective: { kind: 'hold_until' as const, rounds: 2, description: 'Hold the landing' }, round: 2, outcome: null };
check('hold_until won after N rounds', evaluateEncounter(hold, { enemies: [{ name: 'Bandit', currentHp: 5 }], partyDown: false }).outcome, 'won');
check('party down loses', evaluateEncounter(hold, { enemies: [], partyDown: true }).outcome, 'lost');
check('ritual completes if not stopped', evaluateEncounter({ objective: { kind: 'stop_ritual', rounds: 4, description: '' }, round: 4, outcome: null }, { enemies: [{ name: 'Cultist', currentHp: 9 }], partyDown: false }).outcome, 'lost');
check('escape won when the party gets away', evaluateEncounter({ objective: { kind: 'escape', description: '' }, round: 1, outcome: null }, { enemies: [{ name: 'Troll', currentHp: 80 }], partyDown: false, playerEscaped: true }).outcome, 'won');
const enemies = [{ name: 'Bandit A', currentHp: 0, maxHp: 11, status: 'defeated' }, { name: 'Bandit B', currentHp: 4, maxHp: 11 }, { name: 'Bandit C', currentHp: 11, maxHp: 11 }];
const m = checkMorale(enemies, () => 5);
check('bloodied enemy breaks after an ally falls', m[1].status, 'fled');
check('healthy enemy stands', m[2].status, undefined);
check('the undead never break', checkMorale([{ name: 'Skeleton', currentHp: 0, status: 'defeated' }, { name: 'Zombie', currentHp: 2, maxHp: 22 }], () => 1)[1].status, undefined);
const mid = midTurn(on, { inCombat: true, encounter: { objective: { kind: 'hold_until', rounds: 2, description: 'Hold the landing' }, round: 1, outcome: null }, combatants: [{ name: 'Bandit', type: 'enemy', currentHp: 11, maxHp: 11 }] }, { inCombat: true }, { partyDown: false, rng: seqR(0.99) });
check('objective met ends the fight in code', [mid.objectiveWon, mid.inCombat, mid.combatants?.[0].status], [true, false, 'fled']);
check('new fight gets an objective', midTurn(on, { inCombat: false }, { inCombat: true, combatants: [{ name: 'Wolf', type: 'enemy', currentHp: 11, maxHp: 11 }] }, { partyDown: false }).encounter?.round, 0);

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
