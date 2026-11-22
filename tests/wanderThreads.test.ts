/**
 * Wander threads and travel rules (wander-threads-spec.md): SRD numbers,
 * forced march, end of day, navigation, surprise, thread progression, rumors,
 * and the authored content itself.
 *
 * Run with: npx tsx tests/wanderThreads.test.ts
 */
import {
  forcedMarchSaves, hoursPerHex, navigationBaseDC, navigationModifiers, forageDC, endOfDay,
  initialTravelState, parseTravelState, navigationCheckDue, travelPassivePerception, sightRadius, isNight, type TravelState,
} from '../shared/wander/travel';
import { bearing, hexDistance, getTerrainForHex, biomeForHex } from '../shared/wander/terrain';
import { landmarkAt } from '../shared/wander/landmarks';
import { normalizeSkill } from '../shared/rules/checks';
import { rollSkill, rollSave, determineAwareness, hasDarkvision, abilityCheckModifier } from '../server/play/wander/checks';
import { THREAD_TEMPLATES } from '../server/play/wander/threadTemplates';
import { onMove, makeRumor, pickTarget, fill, climaxOutcome, journalEntry, type ThreadRow } from '../server/play/wander/threads';
import { RECURRING, recurringOutcome } from '../server/play/wander/recurring';
import { EMPTY_LEDGER } from '../shared/ledger';

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
function ok(name: string, cond: boolean) { check(name, cond, true); }

function seq(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}
function seeded(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rogue = { level: 3, class: 'Rogue', race: 'Human', skills: ['stealth', 'perception'], strength: 10, dexterity: 16, constitution: 12, intelligence: 10, wisdom: 14, charisma: 10 };
const fighter = { level: 3, class: 'Fighter', race: 'Dwarf', skills: ['athletics', 'survival'], strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 };

console.log('travel: SRD numbers');
check('normal pace: 2 hours a 6-mile hex', hoursPerHex('normal', 0), 2);
check('fast pace: 1.5 hours', hoursPerHex('fast', 0), 1.5);
check('slow pace: 3 hours', hoursPerHex('slow', 0), 3);
check('exhaustion 2 halves speed', hoursPerHex('normal', 2), 4);
check('navigation DC grassland 5', navigationBaseDC('grass'), 5);
check('navigation DC desert 10', navigationBaseDC('desert'), 10);
check('navigation DC forest 15', navigationBaseDC('forest'), 15);
check('no navigation check along a coast', navigationBaseDC('coast'), null);
check('fast pace -5 to navigation', navigationModifiers('fast', 'clear'), [{ value: -5, label: 'fast pace' }]);
check('slow pace +5, fog -5', navigationModifiers('slow', 'fog'), [{ value: 5, label: 'slow pace' }, { value: -5, label: 'fog' }]);
check('forage DC: abundant forest 10', forageDC('forest', 'clear'), 10);
check('forage DC: very little desert 20', forageDC('desert', 'clear'), 20);

console.log('travel: forced march');
check('within 8 hours: no saves', forcedMarchSaves(4, 6), []);
check('6 -> 8 hours: no saves', forcedMarchSaves(6, 8), []);
check('8 -> 10 hours: DC 11 and DC 12', forcedMarchSaves(8, 10), [11, 12]);
check('7.5 -> 9 hours: DC 11', forcedMarchSaves(7.5, 9), [11]);
check('9 -> 10.5 hours: DC 12 (end of hour 10 only)', forcedMarchSaves(9, 10.5), [12]);
check('6.5 -> 8.5 hours: no save yet (hour 9 not finished)', forcedMarchSaves(6.5, 8.5), []);
check('8.5 -> 10.5 hours: DC 11 and DC 12, never charged twice', forcedMarchSaves(8.5, 10.5), [11, 12]);

console.log('travel: end of day');
const base: TravelState = { ...initialTravelState({ biome: 'grass', rng: () => 0 }), food: 2, water: 2 };
let eod = endOfDay(base, { conMod: 0, biome: 'grass', conSave: () => ({ success: true, text: '' }), rng: () => 0 });
check('eats 1 lb, drinks 1 gal', [eod.state.food, eod.state.water], [1, 1]);
check('wakes on day 2 at 08:00', [eod.state.day, eod.state.hour, eod.state.hoursToday], [2, 8, 0]);
eod = endOfDay({ ...base, water: 0 }, { conMod: 0, biome: 'grass', conSave: () => ({ success: true, text: '' }) });
check('no water: exhaustion, then long rest with food takes one back', eod.state.exhaustion, 0);
eod = endOfDay({ ...base, food: 0, water: 0 }, { conMod: 0, biome: 'grass', conSave: () => ({ success: true, text: '' }) });
check('no food and no water: one level, no rest recovery', eod.state.exhaustion, 1);
eod = endOfDay({ ...base, water: 0, exhaustion: 1 }, { conMod: 0, biome: 'grass', conSave: () => ({ success: true, text: '' }) });
check('no water when already tired: two levels, rest takes one back', eod.state.exhaustion, 2);
eod = endOfDay({ ...base, water: 1, hot: true }, { conMod: 0, biome: 'desert', conSave: () => ({ success: false, text: 'fail' }) });
check('hot day, half water, failed DC 15 save: 1 level, rest takes it back', eod.state.exhaustion, 0);
eod = endOfDay({ ...base, food: 0, daysWithoutFood: 3 }, { conMod: 0, biome: 'grass', conSave: () => ({ success: true, text: '' }) });
check('4th day without food (limit 3 + Con 0): exhaustion, drank so rest recovers it', eod.state.exhaustion, 0);
check('days without food counted', eod.state.daysWithoutFood, 4);
check('parse round-trips', parseTravelState(JSON.parse(JSON.stringify(base))), base);
check('parse rejects junk', parseTravelState({ v: 2 }), null);

console.log('travel: when the navigator rolls');
const fresh0 = { ...base, oriented: null };
check('setting out: check due', navigationCheckDue(fresh0, 15), true);
const oriented = { ...base, day: 1, hour: 10, oriented: { dc: 15, at: 8 } };
check('same difficulty, 2 hours later: no check', navigationCheckDue(oriented, 15), false);
check('easier country: no check', navigationCheckDue(oriented, 5), false);
check('harder country than your bearings: check', navigationCheckDue({ ...oriented, oriented: { dc: 10, at: 8 } }, 15), true);
check('4 hours later: check', navigationCheckDue({ ...oriented, hour: 12 }, 15), true);
check('next morning: check', navigationCheckDue({ ...oriented, day: 2, hour: 8 }, 15), true);

console.log('travel: perception and sight');
check('fast pace -5 passive', travelPassivePerception({ base: 14, pace: 'fast', activity: 'navigate', weather: 'clear', night: false, darkvision: false }).score, 9);
check('a scout keeps full passive at fast pace', travelPassivePerception({ base: 14, pace: 'fast', activity: 'scout', weather: 'clear', night: false, darkvision: false }).score, 14);
check('fog and night do not stack (both disadvantage)', travelPassivePerception({ base: 14, pace: 'normal', activity: 'navigate', weather: 'fog', night: true, darkvision: false }).score, 9);
check('darkvision ignores night', travelPassivePerception({ base: 14, pace: 'normal', activity: 'navigate', weather: 'clear', night: true, darkvision: true }).score, 14);
check('mountain sight 3, scout +1', sightRadius({ terrain: 'mountain', activity: 'scout', weather: 'clear', night: false }), 4);
check('forest fog night sight 0', sightRadius({ terrain: 'forest', activity: 'navigate', weather: 'fog', night: true }), 0);
check('22:00 is night', isNight(22), true);
check('dwarf darkvision', hasDarkvision('Hill Dwarf'), true);
check('human no darkvision', hasDarkvision('Human'), false);

console.log('checks with the real character');
let r = rollSkill(rogue, 'stealth', 13, { d20: seq([10]) });
check('rogue stealth: 10 + 3 Dex + 2 prof = 15 succeeds vs 13', [r.total, r.success], [15, true]);
r = rollSkill(rogue, 'survival', 15, { d20: seq([12]), situational: [{ value: -5, label: 'fast pace' }] });
check('survival with fast pace: 12 + 2 Wis - 5 = 9', r.total, 9);
ok('situational modifier is written out', r.text.includes('5 fast pace'));
r = rollSkill(rogue, 'stealth', 13, { d20: seq([18, 4]), exhaustion: 1 });
check('exhaustion 1: disadvantage keeps the 4', r.total, 9);
let sv = rollSave(fighter, 'constitution', 12, { d20: seq([8]) });
check('fighter Con save proficient: 8 + 2 + 2 = 12', [sv.total, sv.success], [12, true]);
sv = rollSave(rogue, 'constitution', 12, { d20: seq([8]) });
check('rogue Con save not proficient: 8 + 1 = 9', sv.total, 9);

r = rollSkill(fighter, 'constitution', 13, { d20: seq([10]) });
check('raw Constitution check uses Con (10 + 2), not Strength', [r.total, r.label], [12, 'Constitution check']);

console.log('surprise');
let aw = determineAwareness({ char: rogue, difficulty: 'medium', slowPace: false, passivePerception: 14, exhaustion: 0, d20: seq([15]) });
check('threat Stealth 18 beats passive 14: ambushed', aw.awareness, 'ambushed');
aw = determineAwareness({ char: rogue, difficulty: 'medium', slowPace: false, passivePerception: 14, exhaustion: 0, d20: seq([5]) });
check('threat Stealth 8 vs 14: spotted', aw.awareness, 'spotted');
aw = determineAwareness({ char: rogue, difficulty: 'medium', slowPace: true, passivePerception: 14, exhaustion: 0, d20: seq([10]) });
check('slow pace, Stealth 15 vs their passive 12: unseen', aw.awareness, 'unseen');

console.log('terrain and bearings');
check('(0,-1) is northwest', bearing(0, 0, 0, -1), 'northwest');
check('(1,-1) is northeast', bearing(0, 0, 1, -1), 'northeast');
check('(1,0) is east', bearing(0, 0, 1, 0), 'east');
check('(-1,0) is west', bearing(0, 0, -1, 0), 'west');
check('(1,-2) is north', bearing(0, 0, 1, -2), 'north');
check('(-1,2) is south', bearing(0, 0, -1, 2), 'south');
check('terrain is deterministic', getTerrainForHex(5, -3), getTerrainForHex(5, -3));
check('town is a landmark with water', [landmarkAt(0, 0)?.name, landmarkAt(0, 0)?.water], ['Town', true]);
let lmCount = 0;
for (let q = -20; q <= 20; q++) for (let rr = -20; rr <= 20; rr++) if (landmarkAt(q, rr)) lmCount++;
ok(`about 9% of hexes have landmarks (${lmCount} of 1681)`, lmCount > 100 && lmCount < 210);

console.log('authored content');
for (const t of THREAD_TEMPLATES) {
  ok(`${t.id}: track skill "${t.trackSkill}" is a real skill`, normalizeSkill(t.trackSkill) !== null);
  for (const o of t.climax.options) {
    if (o.skill) ok(`${t.id}/${o.id}: "${o.skill}" is a real skill or ability`, normalizeSkill(o.skill) !== null || !!abilityCheckModifier(rogue, o.skill));
    ok(`${t.id}/${o.id}: has a check or is a fight`, !!o.fight || (!!o.skill && !!o.dc));
  }
  const vars = { bearing: 'north', dist: 3, name: 'Testname' };
  const texts = [t.sign, t.trace, t.approach].flatMap((b) => [b.title, b.reveal, b.detail]).concat([t.climax.title, t.climax.reveal, t.rumor.text, t.completionRumor, t.payoff.text]);
  ok(`${t.id}: every text slot fills`, texts.every((x) => !/\{\w+\}/.test(fill(x, vars))));
  ok(`${t.id}: no em dashes in player-facing text`, texts.every((x) => !x.includes('—')));
  const target = pickTarget(t, 0, 0, seeded(7));
  const d = hexDistance(0, 0, target.q, target.r);
  ok(`${t.id}: target 3 to 6 hexes away (${d}) on an allowed biome (${biomeForHex(target.q, target.r)})`, d >= 3 && d <= 6 && t.biomes.includes(biomeForHex(target.q, target.r)));
}
for (const role of RECURRING) {
  ok(`${role.id}: help skill is real`, normalizeSkill(role.help.skill) !== null);
  const o = recurringOutcome(role, EMPTY_LEDGER);
  check(`${role.id}: first meeting offers help`, o.choices[0].id, 'help');
}
const friendly = { ...EMPTY_LEDGER, cast: [{ id: 'tamsin', name: 'Tamsin', role: '', want: '', attitude: 2, firstSeenTurn: 1, lastSeenTurn: 1, location: null, status: 'alive' as const, secrets: [], promisesMade: [], timesMet: 2 }] };
check('Tamsin remembers a friend', recurringOutcome(RECURRING[0], friendly).choices[0].id, 'visit');

console.log('thread progression');
const tpl = THREAD_TEMPLATES[0];
const row: ThreadRow = { id: 1, campaignId: 1, userId: 1, templateId: tpl.id, beat: 0, targetHexQ: 4, targetHexR: 0, status: 'active', payload: { name: 'Bonegnaw', movesSinceAdvance: 0 } };
let m = onMove([row], { fromQ: 0, fromR: 0, toQ: 1, toR: 0 }, () => 0);
check('moving toward the target advances sign -> trace', [m.outcome?.thread.beat, m.patches[0].beat], ['trace', 1]);
ok('the trace names the bearing', !!m.outcome?.reveal.includes('east'));
m = onMove([{ ...row, beat: 1 }], { fromQ: 1, fromR: 0, toQ: 2, toR: 0 }, () => 0.99);
check('an unlucky roll does not advance', m.outcome, null);
m = onMove([{ ...row, beat: 2 }], { fromQ: 3, fromR: 0, toQ: 4, toR: 0 }, () => 0.99);
check('arriving at the target is the climax', [m.outcome?.thread.beat, m.outcome?.type], ['climax', 'risk']);
ok('climax names the warren', !!m.outcome?.title.includes('Bonegnaw'));
let away: ThreadRow = { ...row, payload: { movesAway: 2 } };
m = onMove([away], { fromQ: 0, fromR: 0, toQ: -1, toR: 0 }, () => 0);
check('third move away: a reminder', m.outcome?.thread.beat, 'reminder');
m = onMove([{ ...row, payload: { movesSinceAdvance: 30 } }], { fromQ: 0, fromR: 0, toQ: 0, toR: 1 }, () => 0.99);
check('ignored for 30 moves: expires', m.patches[0].status, 'expired');
const two: ThreadRow[] = [row, { ...row, id: 2, templateId: THREAD_TEMPLATES[1].id, targetHexQ: 1, targetHexR: 0, beat: 2 }];
m = onMove(two, { fromQ: 0, fromR: 0, toQ: 1, toR: 0 }, () => 0);
check('only one thread outcome per move, the further-along one wins', [m.outcome?.thread.id, m.outcome?.thread.beat], [2, 'climax']);
check('both threads are updated', m.patches.map((p) => p.id).sort(), [1, 2]);
const climax = climaxOutcome(tpl, row);
ok('climax always offers a way to leave', climax.choices.some((c) => c.id === 'leave'));
ok('fight options say they cost exhaustion', climax.choices.filter((c) => c.intentTag === 'engage').every((c) => c.label.includes('exhaustion')));

console.log('rumors');
const rumor = makeRumor([], seeded(3))!;
ok('a rumor points 3 to 8 hexes from town', hexDistance(0, 0, rumor.targetHexQ, rumor.targetHexR) >= 3 && hexDistance(0, 0, rumor.targetHexQ, rumor.targetHexR) <= 8);
ok('rumor text names a direction', /north|south|east|west/.test(rumor.payload!.rumorText!));
const rumored: ThreadRow = { ...(rumor as any), id: 9, campaignId: 1, userId: 1 };
m = onMove([{ ...rumored, payload: { ...rumored.payload, truth: true } }], { fromQ: rumored.targetHexQ - 1, fromR: rumored.targetHexR, toQ: rumored.targetHexQ, toR: rumored.targetHexR }, () => 0);
check('a true rumor: arriving is the climax, thread becomes active', [m.outcome?.thread.beat, m.patches[0].status], ['climax', 'active']);
m = onMove([{ ...rumored, payload: { ...rumored.payload, truth: false } }], { fromQ: rumored.targetHexQ - 1, fromR: rumored.targetHexR, toQ: rumored.targetHexQ, toR: rumored.targetHexR }, () => 0);
check('a false rumor is debunked', [m.outcome?.thread.beat, m.patches[0].status], ['debunk', 'debunked']);
const je = journalEntry({ ...rumored, payload: { ...rumored.payload, truth: false } }, 0, 0);
ok('the journal never reveals whether a rumor is true', !JSON.stringify(je).includes('truth'));
const hidden = journalEntry({ ...row, beat: 0 }, 0, 0);
check('exact target is hidden until the approach', hidden.target, null);

console.log('simulation: walking toward a thread reaches it');
let reached = 0;
for (let s = 1; s <= 200; s++) {
  const rng = seeded(s);
  const t = THREAD_TEMPLATES[s % THREAD_TEMPLATES.length];
  const target = pickTarget(t, 0, 0, rng);
  let th: ThreadRow = { id: 1, campaignId: 1, userId: 1, templateId: t.id, beat: 0, targetHexQ: target.q, targetHexR: target.r, status: 'active', payload: {} };
  let q = 0, rr = 0;
  const beats: string[] = ['sign'];
  for (let step = 0; step < 12; step++) {
    // greedy step toward the target
    const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
    const [dq, dr] = dirs.reduce((best, d) => hexDistance(q + d[0], rr + d[1], th.targetHexQ, th.targetHexR) < hexDistance(q + best[0], rr + best[1], th.targetHexQ, th.targetHexR) ? d : best);
    const res = onMove([th], { fromQ: q, fromR: rr, toQ: q + dq, toR: rr + dr }, rng);
    q += dq; rr += dr;
    for (const p of res.patches) th = { ...th, beat: p.beat ?? th.beat, status: p.status ?? th.status, payload: p.payload ?? th.payload };
    if (res.outcome) beats.push(res.outcome.thread.beat);
    if (res.outcome?.thread.beat === 'climax') break;
  }
  if (beats.includes('climax')) reached++;
}
check('200 trails followed directly all reach their climax', reached, 200);

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
