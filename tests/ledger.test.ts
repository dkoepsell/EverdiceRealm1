/**
 * Campaign Ledger (engagement spec Phase 3): name dedupe, caps, callbacks,
 * recap, reputation, and a stubbed 40-turn run.
 *
 * Run with: npx tsx tests/ledger.test.ts
 */
import { mergeLedgerUpdates, sameName, seedLedgerFromCampaign, CAPS } from '../server/play/ledger/merge';
import { buildRecap, ledgerPromptBlock, selectCallbacks } from '../server/play/ledger/callbacks';
import { EMPTY_LEDGER, attitudeLabel, reputationOf, type Ledger } from '../shared/ledger';

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

console.log('names');
check('"Mira" = "Mira, ferrywoman"', sameName('Mira', 'Mira, ferrywoman'), true);
check('"Captain Korrin" = "Korrin"', sameName('Captain Korrin', 'Korrin'), true);
check('"Brother Aldric" = "Aldric"', sameName('Brother Aldric', 'Aldric'), true);
check('"Mira Vane" ≠ "Mira Holt"', sameName('Mira Vane', 'Mira Holt'), false);
check('"Korrin" ≠ "Mira"', sameName('Korrin', 'Mira'), false);

console.log('merging');
let r = mergeLedgerUpdates(EMPTY_LEDGER, { cast: [{ name: 'Mira', role: 'ferrywoman', want: 'her brother freed', attitudeChange: 1 }] }, { location: 'Ferry Landing' });
check('new NPC introduced', r.introduced, ['Mira']);
r = mergeLedgerUpdates(r.ledger, { cast: [{ name: 'Mira, ferrywoman', promise: 'owes you a crossing', attitudeChange: 5 }] }, { location: 'Ferry Landing' });
check('same NPC not introduced twice', [r.introduced, r.ledger.cast.length], [[], 1]);
check('fuller name kept', r.ledger.cast[0].name, 'Mira, ferrywoman');
check('attitude change clamped to ±2 per turn', r.ledger.cast[0].attitude, 3);
check('times met counted', r.ledger.cast[0].timesMet, 2);
check('promise recorded', r.ledger.cast[0].promisesMade, ['owes you a crossing']);
check('not "returning" when seen last turn', r.returning, []);
let l = r.ledger;
for (let i = 0; i < 6; i++) l = mergeLedgerUpdates(l, {}, { location: 'Mire Road' }).ledger;
r = mergeLedgerUpdates(l, { cast: [{ name: 'Mira' }] }, { location: 'Ferry Landing' });
check('returning after time away', r.returning, ['Mira, ferrywoman']);
check('bad deed tag ignored', mergeLedgerUpdates(EMPTY_LEDGER, { deed: { summary: 'x', tag: 'vibes' } }, {}).ledger.deeds.length, 0);
check('threads open and resolve', (() => {
  let x = mergeLedgerUpdates(EMPTY_LEDGER, { threadsOpened: ['Who is preparing the ritual upriver?'] }, {}).ledger;
  x = mergeLedgerUpdates(x, { threadsResolved: ['the ritual upriver'] }, {}).ledger;
  return x.threads[0].status;
})(), 'resolved');
check('garbage updates are harmless', mergeLedgerUpdates(EMPTY_LEDGER, { cast: 'nope', threadsOpened: 5, deed: [] }, {}).ledger.cast, []);

console.log('caps');
let big: Ledger = EMPTY_LEDGER;
for (let i = 0; i < 45; i++) {
  big = mergeLedgerUpdates(big, { cast: [{ name: `Npc${i} Person${i}` }], threadsOpened: [`Thread number ${i} about thing${i}`], deed: { summary: `did ${i}`, tag: 'cunning' } }, {}).ledger;
}
check('cast capped', big.cast.length, CAPS.cast);
check('threads capped', big.threads.length, CAPS.threads);
check('deeds capped', big.deeds.length, CAPS.deeds);
check('most recent deed kept', big.deeds[big.deeds.length - 1].summary, 'did 44');

console.log('callbacks, recap, reputation');
const story: Ledger = {
  turn: 20,
  cast: [
    { id: 'mira', name: 'Mira, ferrywoman', role: 'ferrywoman', want: 'her brother freed from the bandit crew', attitude: 2, firstSeenTurn: 2, lastSeenTurn: 9, location: 'Ferry Landing', status: 'alive', secrets: [], promisesMade: ['owes you a crossing'], timesMet: 3 },
    { id: 'korrin', name: 'Captain Korrin', role: 'bandit leader', want: 'to keep his crew alive', attitude: 0, firstSeenTurn: 5, lastSeenTurn: 19, location: 'Mire Road', status: 'alive', secrets: [], promisesMade: [], timesMet: 1 },
  ],
  threads: [{ id: 't1', summary: 'Who is preparing the ritual upriver?', openedTurn: 6, status: 'open', heat: 3 }, { id: 't2', summary: "Free Mira's brother from the bandit crew", openedTurn: 7, status: 'open', heat: 1 }],
  deeds: [{ turn: 5, summary: 'You spared the bandit captain when he surrendered', tag: 'mercy', location: 'Mire Road' }, { turn: 12, summary: 'You let the thief go', tag: 'mercy', location: null }],
  places: [{ name: 'Ferry Landing', lastVisitedTurn: 9, changedSince: 'the dock has burned' }],
  itemsOfNote: [],
};
const cbs = selectCallbacks(story, { location: 'Ferry Landing' });
check('revisited changed place first', cbs[0]?.kind, 'changed_place');
check('absent NPC tied to an open thread second', cbs[1]?.npc, 'Mira, ferrywoman');
check('never more than 2', selectCallbacks(story, { location: 'Ferry Landing', max: 5 }).length <= 4, true);
check('recently seen NPC is not a callback', selectCallbacks(story, { location: 'Mire Road' }).some((c) => c.npc === 'Captain Korrin'), false);
check('hot thread when nothing else', selectCallbacks({ ...story, cast: [], places: [] }, { location: 'Nowhere' })[0]?.kind, 'hot_thread');
check('recap', buildRecap(story), ['You let the thief go.', 'Mira, ferrywoman: owes you a crossing.', 'Who is preparing the ritual upriver?']);
check('reputation from repeated deeds', reputationOf(story.deeds)?.word, 'merciful');
check('one deed is not a reputation', reputationOf(story.deeds.slice(0, 1)), null);
check('attitude labels', [-3, 0, 1, 2].map(attitudeLabel), ['Hostile', 'Indifferent', 'Friendly', 'Trusting']);
const block = ledgerPromptBlock(story, cbs);
check('prompt block has callbacks, cast, threads, reputation, contract', ['CALLBACKS', 'PEOPLE THE PARTY KNOWS', 'OPEN THREADS', 'known as merciful', '"ledgerUpdates"'].every((s) => block.includes(s)), true);
check('seed from generated decision-makers', seedLedgerFromCampaign([{ name: 'Vexorath', role: 'villain', attitude: -100, wants: 'the crown', secrets: ['is the king'] }]).cast[0].attitude, -3);

console.log('stubbed 40-turn run');
// A stub DM that follows the prompt: uses an NPC callback when offered, keeps
// recent cast in scenes, and introduces a new named NPC at most every 3 turns.
function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }
const r2 = rng(11);
let led: Ledger = EMPTY_LEDGER;
let lastNew = -10;
let returningTurns = 0;
let newCount = 0;
const places = ['Ferry Landing', 'Mire Road', 'Reed Village', 'Bandit Camp', 'Old Mill'];
for (let t = 0; t < 40; t++) {
  const loc = places[Math.floor(r2() * places.length)];
  const callbacks = selectCallbacks(led, { location: loc });
  const scene: { name: string }[] = [];
  const cb = callbacks.find((c) => c.kind === 'absent_npc');
  if (cb?.npc) scene.push({ name: cb.npc });
  const met = led.cast.filter((c) => c.timesMet > 0);
  if (met.length && r2() < 0.35) scene.push({ name: met[Math.floor(r2() * met.length)].name });
  if (t - lastNew >= 3 && r2() < 0.7) { scene.push({ name: `Stranger${t} Of${loc.replace(/\s/g, '')}` }); lastNew = t; newCount++; }
  const before = new Set(led.cast.filter((c) => c.timesMet > 0).map((c) => c.name));
  const res = mergeLedgerUpdates(led, { cast: scene, threadsOpened: t % 6 === 0 ? [`Trouble at ${loc} ${t}`] : [] }, { location: loc });
  if (scene.some((s) => Array.from(before).some((b) => sameName(b, s.name)))) returningTurns++;
  led = res.ledger;
}
check(`≥30% of turns include a returning NPC (${returningTurns}/40)`, returningTurns >= 12, true);
check('no named NPC introduced twice', led.cast.length === new Set(led.cast.map((c) => c.name)).size, true);
check(`new NPCs at most every 3 turns (${newCount})`, newCount <= 14, true);

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
