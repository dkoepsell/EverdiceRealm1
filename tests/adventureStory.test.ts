/**
 * Tests for rebuilding a finished campaign's story.
 *
 * Run with: npx tsx tests/adventureStory.test.ts
 */
import { buildAdventureStory, ACTION_LOG_CAP } from '../server/lib/adventureStory';

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

const act = (text: string, timestamp: string) => ({ type: 'player_action', text, timestamp });
const narr = (text: string, timestamp: string) => ({ type: 'narrative', text, timestamp });

console.log('action log only');
{
  const story = buildAdventureStory([], [{
    sessionNumber: 1,
    title: 'The Road North',
    actionLog: [
      narr('You wake in a cart.', '2026-06-01T00:00:00Z'),
      act('Look around', '2026-06-01T00:01:00Z'),
      narr('Mud, everywhere.', '2026-06-01T00:01:00Z'),
      { type: 'combat', description: 'ignored', timestamp: '2026-06-01T00:02:00Z' },
      act('Climb out', '2026-06-01T00:03:00Z'),
    ],
  }]);
  check('one chapter titled after the session', story.chapters.map(c => c.title), ['The Road North']);
  check('opening narrative stands alone, then action+reply pairs',
    story.chapters[0].turns.map(t => [t.choice, t.narrative]),
    [[null, 'You wake in a cart.'], ['Look around', 'Mud, everywhere.'], ['Climb out', null]]);
  check('not partway', story.beginsPartway, false);
}

console.log('turn log takes over where it starts');
{
  const story = buildAdventureStory(
    [
      { id: 11, actorName: 'Feando', characterName: 'DomLight', choice: 'Hum', narrative: 'It hums back.', chapterNumber: 3, createdAt: '2026-08-10T00:00:00Z' },
      { id: 10, actorName: 'Koep', characterName: 'Vex', choice: 'Swing', narrative: 'A miss.', chapterNumber: 3, createdAt: '2026-08-09T00:00:00Z' },
      { id: 12, actorName: 'Koep', characterName: 'Vex', choice: 'Run', narrative: 'Out!', chapterNumber: 4, createdAt: '2026-08-11T00:00:00Z' },
    ],
    [{
      sessionNumber: 1,
      title: 'Session One',
      actionLog: [
        act('Old move', '2026-07-01T00:00:00Z'),
        narr('Old reply', '2026-07-01T00:00:00Z'),
        act('Swing', '2026-08-09T00:00:00Z'),
        narr('A miss.', '2026-08-09T00:00:00Z'),
      ],
    }],
  );
  check('earlier part, then chapters in id order',
    story.chapters.map(c => [c.title, c.turns.map(t => t.choice)]),
    [['Earlier in the tale', ['Old move']], ['Chapter 3', ['Swing', 'Hum']], ['Chapter 4', ['Run']]]);
  check('turn log keeps who acted', story.chapters[1].turns[1].characterName, 'DomLight');
}

console.log('chapterless party aid stays in its chapter');
{
  const row = (id: number, chapterNumber: number | null, choice: string | null) =>
    ({ id, actorName: 'Koep', characterName: 'Vex', choice, narrative: 'x', chapterNumber, createdAt: `2026-08-1${id}T00:00:00Z` });
  const story = buildAdventureStory([row(1, 8, 'Swing'), row(2, null, null), row(3, 8, 'Again'), row(4, 9, 'On')], []);
  check('one chapter 8, then chapter 9',
    story.chapters.map(c => [c.title, c.turns.length]),
    [['Chapter 8', 3], ['Chapter 9', 1]]);
}

console.log('trimmed history is flagged');
{
  const log = Array.from({ length: ACTION_LOG_CAP }, (_, i) =>
    i % 2 ? narr(`reply ${i}`, '2026-07-01T00:00:00Z') : act(`move ${i}`, '2026-07-01T00:00:00Z'));
  const story = buildAdventureStory([], [{ sessionNumber: 1, title: 'S', actionLog: log }]);
  check('a full log has lost its head', story.beginsPartway, true);
}

console.log('nothing recorded');
{
  const story = buildAdventureStory([], [{ sessionNumber: 1, title: 'S', actionLog: null }]);
  check('no chapters', story.chapters.length, 0);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
