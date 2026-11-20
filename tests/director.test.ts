/**
 * Beat director + turn mechanics over a stubbed 30-turn run (engagement spec
 * Phase 2 acceptance): no triple repeats, mean choices per turn 2.5–3.5,
 * fewer than half of turns require a roll, a breather each chapter.
 *
 * Run with: npx tsx tests/director.test.ts
 */
import { BEATS, type Beat, beatForTurn, clampToBeat, parseDirectorState, pickNextBeat } from '../server/play/director/beats';
import { applyTurnMechanics, buildPromptExtras } from '../server/play/director/turnGuidance';
import { ENGAGEMENT_FLAGS as DEFAULT_FLAGS } from '../shared/engagementFlags';
// Tests start from every flag OFF and switch on what they exercise.
const ENGAGEMENT_FLAGS = Object.fromEntries(Object.keys(DEFAULT_FLAGS).map((k) => [k, false])) as unknown as typeof DEFAULT_FLAGS;
import { signRollToken, trustedRollResult, verifyRollToken } from '../server/play/checks/rollToken';

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

// Deterministic PRNG (mulberry32).
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The old prompt's shape: 5 choices, 3 of them rolls, every turn.
const stubChoices = () => [
  { text: 'a', requiresDiceRoll: true, skillType: 'persuasion', rollDC: 13 },
  { text: 'b', requiresDiceRoll: false },
  { text: 'c', requiresDiceRoll: true, skillType: 'perception', rollDC: 12 },
  { text: 'd', requiresDiceRoll: true, skillType: 'stealth', rollDC: 15 },
  { text: 'e', requiresDiceRoll: false },
];

const flags = { ...ENGAGEMENT_FLAGS, beats: true };
for (const seed of [1, 7, 42, 99, 2026]) {
  const r = rng(seed);
  let state = parseDirectorState(null, 1);
  const beats: Beat[] = [];
  let choiceTotal = 0;
  let rollTurns = 0;
  let chapter = 1;
  for (let turn = 0; turn < 30; turn++) {
    if (turn > 0 && turn % 8 === 0) { chapter++; state = parseDirectorState(state, chapter); }
    const beat = beatForTurn(state, { inCombat: false, attackIntent: r() < 0.08 });
    const { choices } = applyTurnMechanics({ choices: stubChoices() }, { flags, beat });
    if (beat !== 'combat') {
      choiceTotal += choices.length;
      // The player picks one offered choice at random; did it need a roll?
      const picked = choices[Math.floor(r() * choices.length)];
      if (picked?.requiresDiceRoll) rollTurns++;
    }
    beats.push(beat);
    state = pickNextBeat(state, beat, { rng: r });
  }
  const nonCombat = beats.filter((b) => b !== 'combat').length;
  const triples = beats.some((b, i) => i >= 2 && b !== 'combat' && b === beats[i - 1] && b === beats[i - 2]);
  const mean = choiceTotal / nonCombat;
  check(`seed ${seed}: no beat three times running`, triples, false);
  check(`seed ${seed}: mean choices 2.5–3.5 (${mean.toFixed(2)})`, mean >= 2.5 && mean <= 3.5, true);
  check(`seed ${seed}: under half of turns roll (${rollTurns}/${nonCombat})`, rollTurns < nonCombat / 2, true);
  const chapters = [beats.slice(0, 8), beats.slice(8, 16), beats.slice(16, 24)];
  check(`seed ${seed}: every full chapter has a quiet or discovery beat`, chapters.every((c) => c.some((b) => b === 'quiet' || b === 'discovery')), true);
}

console.log('the deck never deals combat');
{
  const r = rng(3);
  let st = parseDirectorState(null, 1);
  let dealtCombat = false;
  for (let i = 0; i < 2000; i++) {
    st = pickNextBeat(st, i % 5 === 0 ? 'combat' : st.nextBeat ?? 'open_question', { rng: r, clockNearFull: i % 7 === 0 });
    if (st.nextBeat === 'combat') dealtCombat = true;
  }
  check('2000 draws, no combat', dealtCombat, false);
}

console.log('overrides');
check('live combat wins', beatForTurn({ nextBeat: 'quiet', recent: [], chapterBeats: [], chapter: 1 }, { inCombat: true, attackIntent: false }), 'combat');
check('player aggression starts combat', beatForTurn({ nextBeat: 'quiet', recent: [], chapterBeats: [], chapter: 1 }, { inCombat: false, attackIntent: true }), 'combat');
check('stored beat used otherwise', beatForTurn({ nextBeat: 'quiet', recent: [], chapterBeats: [], chapter: 1 }, { inCombat: false, attackIntent: false }), 'quiet');
check('chapter change resets chapter beats', parseDirectorState({ chapter: 1, chapterBeats: ['quiet'], recent: ['quiet'] }, 2).chapterBeats, []);

console.log('clamping');
check('quiet: no rolls survive', clampToBeat(stubChoices(), 'quiet').filter((c) => c.requiresDiceRoll).length, 0);
check('quiet: max 3 choices', clampToBeat(stubChoices(), 'quiet').length, BEATS.quiet.choices[1]);
check('dropped roll fields removed', 'rollDC' in clampToBeat(stubChoices(), 'quiet')[0], false);
check('attacks keep their roll', clampToBeat([{ text: 'x', requiresDiceRoll: true, skillType: 'attack' }], 'quiet')[0].requiresDiceRoll, true);
check('never pads', clampToBeat([{ text: 'only' }], 'open_question').length, 1);
check('flag off: choices untouched', applyTurnMechanics({ choices: stubChoices() }, { flags: ENGAGEMENT_FLAGS, beat: 'quiet' }).choices.length, 5);

console.log('turn mechanics validation');
const rogue: any = { level: 3, skills: ['Insight', 'Perception'], features: [], strength: 10, dexterity: 16, constitution: 12, intelligence: 12, wisdom: 14, charisma: 16, inspiration: false, personality: { bond: 'I never abandon someone who kept a promise.' } };
const allOn = { ...ENGAGEMENT_FLAGS, beats: true, passives: true, inspiration: true, serverChecks: true };
const ok = applyTurnMechanics({ passiveNoticed: { skill: 'insight', dc: 12, text: 'She keeps looking upriver.' } }, { flags: allOn, beat: 'conversation', character: rogue });
check('passive within score kept', ok.passiveNoticed?.score, 14);
check('passive breakdown shows the math', ok.passiveNoticed?.breakdown, '10 + WIS +2 + proficiency +2 = 14 vs DC 12');
check('passive rule fires', ok.fired.map((f) => f.id), ['passive_check']);
check('passive above score dropped', applyTurnMechanics({ passiveNoticed: { skill: 'insight', dc: 18, text: 'x' } }, { flags: allOn, beat: 'conversation', character: rogue }).passiveNoticed, null);
check('inspiration awarded when not held', applyTurnMechanics({ inspirationAwarded: { reason: 'kept her word' } }, { flags: allOn, beat: 'quiet', character: rogue }).inspirationAwarded, 'kept her word');
check('inspiration capped at 1', applyTurnMechanics({ inspirationAwarded: { reason: 'x' } }, { flags: allOn, beat: 'quiet', character: { ...rogue, inspiration: true } }).inspirationAwarded, null);
check('failure cost only after a failed roll', applyTurnMechanics({ failureCost: { kind: 'time', detail: 'The guards hear you.' } }, { flags: allOn, beat: 'pressure', rollResult: { total: 15, dc: 13 } }).failureCost, null);
check('failure cost kept after a failed roll', applyTurnMechanics({ failureCost: { kind: 'time', detail: 'The guards hear you.' } }, { flags: allOn, beat: 'pressure', rollResult: { total: 9, dc: 13 } }).failureCost?.kind, 'time');
const extras = buildPromptExtras(allOn, 'conversation', rogue);
check('prompt carries the beat', extras.choiceRules?.includes('BEAT: conversation'), true);
check('prompt carries passives', extras.context.includes('PASSIVES: Perception 14, Investigation 11, Insight 14'), true);
check('prompt carries the bond', extras.context.includes('I never abandon'), true);
check('flags off: legacy prompt kept', buildPromptExtras(ENGAGEMENT_FLAGS, 'quiet', rogue), { choiceRules: null, context: '', schema: '' });

check('missing personality is seeded once', applyTurnMechanics({ personalitySeed: { ideal: 'Freedom', bond: 'My sister', flaw: 'Greed' } }, { flags: allOn, beat: 'quiet', character: { ...rogue, personality: null } }).personalitySeed?.bond, 'My sister');
check('existing personality never overwritten', applyTurnMechanics({ personalitySeed: { ideal: 'x', bond: 'y', flaw: 'z' } }, { flags: allOn, beat: 'quiet', character: rogue }).personalitySeed, null);

console.log('roll tokens');
const tok = signRollToken({ campaignId: 5, userId: 9, characterId: 3, skill: 'persuasion', label: 'Charisma (Persuasion)', dice: [14], kept: 14, mode: 'normal', modifier: 5, total: 19, dc: 13, success: true, action: 'Offer gold', issuedAt: Date.now() });
check('valid token verifies', verifyRollToken(tok, { campaignId: 5, userId: 9 })?.total, 19);
check('other user rejected', verifyRollToken(tok, { campaignId: 5, userId: 10 }), null);
check('other campaign rejected', verifyRollToken(tok, { campaignId: 6, userId: 9 }), null);
const [body, sig] = tok.split('.');
const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), total: 30 })).toString('base64url') + '.' + sig;
check('tampered total rejected', verifyRollToken(forged, { campaignId: 5, userId: 9 }), null);
check('expired token rejected', verifyRollToken(tok, { campaignId: 5, userId: 9 }, Date.now() + 31 * 60 * 1000), null);
check('token replaces client total', trustedRollResult({ total: 99, dc: 1, token: tok }, { campaignId: 5, userId: 9 }).total, 19);
check('no token: client roll passes through', trustedRollResult({ total: 12, dc: 10 }, { campaignId: 5, userId: 9 }).total, 12);

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
