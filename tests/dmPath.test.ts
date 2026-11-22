/**
 * The DM path (shared/dm/path.ts): exercises, the five-room builder, notes and nudges.
 * Run with: npx tsx tests/dmPath.test.ts
 */
import {
  DM_STEPS, SCREEN_NOTES, FAIR_FIGHT_GOAL, rateMonsterList, checkNpc, checkClues, checkFiveRoom, fiveRoomToNodes, nudgesFor, getStep,
} from '../shared/dm/path';
import { MONSTERS } from '../shared/rules/monsters';

let failures = 0, checks = 0;
function check(name: string, actual: unknown, expected: unknown) {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failures++; console.error(`  ✗ ${name}\n      expected ${e}\n      actual   ${a}`); } else console.log(`  ✓ ${name}`);
}
const ok = (n: string, c: boolean) => check(n, c, true);
const text = (x: unknown) => JSON.stringify(x);

console.log('steps and notes');
check('seven steps', DM_STEPS.length, 7);
check('ends with running a game', DM_STEPS[DM_STEPS.length - 1].id, 'run_a_game');
for (const n of Object.values(SCREEN_NOTES)) ok(`note ${n.id} links to a real step`, !!getStep(n.step));
ok('no em dashes in any lesson or note', !text(DM_STEPS).includes('—') && !text(SCREEN_NOTES).includes('—'));

console.log('fair fight');
const g = FAIR_FIGHT_GOAL;
check('goal is a medium fight for four level 2s', [g.partyLevel, g.partySize, g.rating], [2, 4, 'medium']);
const four = rateMonsterList([{ key: 'goblin', count: 4 }], 2, 4);
check('4 goblins vs four level 2s: 200 XP x2 = 400, medium (400 <= 400 < 600)', [four.adjusted, four.rating], [400, 'medium']);
check('2 goblins: 100 x1.5 = 150, trivial for that party', rateMonsterList([{ key: 'goblin', count: 2 }], 2, 4).rating, 'trivial');
check('unknown monsters are ignored', rateMonsterList([{ key: 'tarrasque', count: 1 }], 2, 4).count, 0);
check('counts are capped', rateMonsterList([{ key: 'goblin', count: 999 }], 2, 4).count, 12);

console.log('npc and clues');
check('a complete NPC passes', checkNpc({ name: 'Tamsin', want: 'to beat the rival peddler to market', secret: 'the silk is stolen', voice: 'calls everyone petal', attitude: 1 }).ok, true);
ok('"to help" gets a nudge', checkNpc({ name: 'X', want: 'to help the party', secret: 's', voice: 'v' }).tips.some((t) => t.includes('"To help"')));
check('missing secret fails', checkNpc({ name: 'X', want: 'gold', voice: 'v' }).ok, false);
check('three clues in three places pass', checkClues({ conclusion: 'The miller did it', clues: [{ clue: 'arrows in flour', where: 'mill cellar' }, { clue: 'muddy boots', where: 'tavern' }, { clue: 'a letter', where: 'the priest' }] }).ok, true);
ok('three clues in one place fail', !checkClues({ conclusion: 'c', clues: [{ clue: 'a', where: 'mill' }, { clue: 'b', where: 'mill' }, { clue: 'c', where: 'Mill' }] }).ok);
ok('two clues get the rule quoted', checkClues({ conclusion: 'c', clues: [{ clue: 'a', where: 'x' }, { clue: 'b', where: 'y' }] }).tips.some((t) => t.includes('at least three')));

console.log('five-room dungeon');
const draft = {
  title: 'The Sunken Mill', theme: 'goblin', partyLevel: 2,
  rooms: {
    guardian: { name: 'The Millrace', description: 'Goblins fish from the wheel.', difficulty: 'easy' },
    puzzle: { name: 'The Sluice Gates', description: 'Three levers, one right order.', skill: 'investigation', dc: 12, hint: 'The marks on the floor', solution: 'Left, right, middle' },
    setback: { name: 'The Rotten Floor', description: 'The boards give way.', save: 'dexterity', dc: 12, damageDice: 2 },
    climax: { name: "Boss's Loft", description: 'The goblin boss and his guards.', bossName: 'Grubnik', difficulty: 'hard' },
    reward: { name: 'The Strongroom', description: "The miller's gold.", twist: 'The miller hired the goblins.' },
  },
};
const c = checkFiveRoom(draft);
check('a complete design passes with no warnings', [c.ok, c.tips], [true, []]);
ok('ratings use the DMG math', ['easy', 'trivial', 'medium'].includes(c.ratings.guardian) && ['hard', 'medium'].includes(c.ratings.climax));
const nodes = fiveRoomToNodes(c.draft);
check('six Delve nodes: entrance + five rooms', nodes.map((n) => n.type), ['entrance', 'encounter', 'puzzle', 'trap', 'boss', 'chest']);
ok('a connected line', nodes.every((n, i) => n.adjacentNodes.length === (i === 0 || i === 5 ? 1 : 2)));
check('the villain keeps their name', nodes[4].bossData.name, 'Grubnik');
ok('guardians are real SRD goblins', nodes[1].encounterData.enemies.every((e: any) => e.name.startsWith('Goblin') && e.ac === MONSTERS.goblin.ac || e.name === 'Goblin Boss'));
check('trap uses the design', [nodes[3].trapData.type, nodes[3].trapData.dc, nodes[3].trapData.damage], ['dexterity', 12, '2d10']);
ok('the twist is in the reward room', nodes[5].description.includes('hired the goblins'));
const hard = checkFiveRoom({ ...draft, rooms: { ...draft.rooms, puzzle: { ...draft.rooms.puzzle, dc: 25, hint: '' }, setback: { ...draft.rooms.setback, damageDice: 10 }, climax: { ...draft.rooms.climax, difficulty: 'deadly' }, reward: { ...draft.rooms.reward, twist: '' } } });
ok('feedback: hard DC, no hint, big trap, deadly climax, no twist', hard.tips.length >= 5);
ok('feedback quotes the DMG DC ladder', hard.tips.some((t) => t.includes('10 easy, 15 medium, 20 hard')));
check('missing room names block building', checkFiveRoom({ title: 'x' }).ok, false);
ok('long text is trimmed', checkFiveRoom({ ...draft, title: 'x'.repeat(500) }).draft.title.length === 60);
check('unknown themes fall back to goblins', checkFiveRoom({ ...draft, theme: 'tarrasque' }).draft.theme, 'goblin');

console.log('nudges');
const base = { maxCharacterLevel: 1, lessonsLearned: 0, trailsResolved: 0, dmStepsDone: [] as any[], hasRunGame: false, openToPlay: false };
check('a new player gets nothing', nudgesFor(base).length, 0);
check('level 3: ready for a table', nudgesFor({ ...base, maxCharacterLevel: 3 }).map((n) => n.id), ['table_ready']);
check('already open to play: no table nudge', nudgesFor({ ...base, maxCharacterLevel: 3, openToPlay: true }).map((n) => n.id), []);
check('three lessons: try the DM path', nudgesFor({ ...base, lessonsLearned: 3 }).map((n) => n.id), ['dm_curious']);
check('once started on the DM path, stop suggesting it', nudgesFor({ ...base, lessonsLearned: 3, dmStepsDone: ['dm_job'] }).map((n) => n.id), []);
check('built a dungeon: run it', nudgesFor({ ...base, dmStepsDone: ['five_room'] }).map((n) => n.id), ['run_your_dungeon']);
check('already ran a game: no nudge', nudgesFor({ ...base, dmStepsDone: ['five_room'], hasRunGame: true }).map((n) => n.id), []);
ok('nudges only link to pages, never contact anyone', nudgesFor({ ...base, maxCharacterLevel: 6, lessonsLearned: 5 }).every((n) => n.actions.every((a) => a.href.startsWith('/'))));

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
