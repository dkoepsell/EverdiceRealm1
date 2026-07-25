/**
 * Rules tests for multiplayer turn order.
 *
 * Run with: npx tsx tests/turnOrder.test.ts
 *
 * The repo has no test runner configured, so this is a self-contained script
 * that exits non-zero on failure.
 */
import {
  orderRoster,
  nextSeatIndex,
  buildTurnState,
  TURN_STALL_FALLBACK_SECONDS,
} from '../server/lib/turnOrder';

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

function group(name: string, body: () => void) {
  console.log(`\n${name}`);
  body();
}

const T0 = Date.parse('2026-07-25T12:00:00.000Z');
const seat = (id: number, userId: number, turnOrder: number | null) =>
  ({ id, userId, characterId: id * 10, turnOrder });

group('orderRoster', () => {
  check(
    'sorts by turn order',
    orderRoster([seat(3, 30, 3), seat(1, 10, 1), seat(2, 20, 2)]).map(s => s.userId),
    [10, 20, 30]
  );

  // The seat goes to the character the player JOINED with (lowest participant
  // id), even when their second character holds a better turn order. Picking by
  // turnOrder looked equivalent but wasn't: rollInitiativeForSession renumbers
  // turnOrder from initiative rolls, so the seat — and therefore the character
  // the player is shown as playing — used to change at random mid-campaign.
  check(
    'gives a player with two characters exactly one seat, the one they joined with',
    orderRoster([seat(1, 10, 5), seat(2, 10, 2), seat(3, 20, 3)]).map(s => [s.userId, s.characterId]),
    [[20, 30], [10, 10]]
  );

  check(
    'the seat survives an initiative reshuffle that favours the other character',
    // Same two rows, re-rolled: character 10's order worsens, character 20's
    // improves. The player still plays the character they joined with.
    [
      orderRoster([seat(1, 10, 2), seat(2, 10, 9)]).map(s => s.characterId),
      orderRoster([seat(1, 10, 9), seat(2, 10, 2)]).map(s => s.characterId),
    ],
    [[10], [10]]
  );

  check(
    'queues unordered joiners behind seated players',
    orderRoster([seat(5, 50, null), seat(1, 10, 2), seat(6, 60, null)]).map(s => s.userId),
    [10, 50, 60]
  );

  check(
    'ignores rows with no user (an unclaimed seat is not a player)',
    orderRoster([{ id: 1, userId: null, characterId: 9, turnOrder: 1 }, seat(2, 20, 2)]).map(s => s.userId),
    [20]
  );
});

group('nextSeatIndex', () => {
  const roster = orderRoster([seat(1, 10, 1), seat(2, 20, 2), seat(3, 30, 3)]);

  check('advances one seat', nextSeatIndex(roster, 10), 1);
  check('wraps at the end of the round', nextSeatIndex(roster, 30), 0);
  check('starts at the top when nobody is anchored', nextSeatIndex(roster, null), 0);
  check('restarts at the top when the anchor has left the party', nextSeatIndex(roster, 999), 0);
  check('reports no seat for an empty roster', nextSeatIndex([], 10), -1);
});

const roster3 = orderRoster([seat(1, 10, 1), seat(2, 20, 2), seat(3, 30, 3)]);
const DM = 99;

group('buildTurnState — when turn order does not apply', () => {
  const solo = orderRoster([seat(1, 10, 1)]);

  check(
    'a solo player is never gated, even with turn mode on',
    buildTurnState({ userId: DM, isTurnBased: true, currentTurnUserId: 10, turnStartedAt: new Date(T0).toISOString() }, solo, 10, T0).canAct,
    true
  );
  check(
    'a solo table reports the rotation as unenforced',
    buildTurnState({ userId: DM, isTurnBased: true, currentTurnUserId: 10, turnStartedAt: new Date(T0).toISOString() }, solo, 10, T0).enforced,
    false
  );
  check(
    'a free-for-all multiplayer party is never gated',
    buildTurnState({ userId: DM, isTurnBased: false, currentTurnUserId: 10, turnStartedAt: new Date(T0).toISOString() }, roster3, 20, T0).canAct,
    true
  );
});

group('buildTurnState — an open turn', () => {
  const campaign = {
    userId: DM,
    isTurnBased: true,
    currentTurnUserId: 10,
    turnStartedAt: new Date(T0).toISOString(),
    turnTimeLimit: 3600,
  };

  check('the holder may act', buildTurnState(campaign, roster3, 10, T0).canAct, true);
  check('the holder is told it is their turn', buildTurnState(campaign, roster3, 10, T0).isYourTurn, true);
  check('another player may not act', buildTurnState(campaign, roster3, 20, T0).canAct, false);
  check(
    'the blocked player is given a reason',
    buildTurnState(campaign, roster3, 20, T0).blockedReason,
    "It's another player's turn."
  );
  check('the DM is never blocked', buildTurnState(campaign, roster3, DM, T0).canAct, true);
  check(
    'the expiry is the start plus the limit',
    buildTurnState(campaign, roster3, 20, T0).expiresAt,
    new Date(T0 + 3600 * 1000).toISOString()
  );
});

group('buildTurnState — async safety', () => {
  const campaign = {
    userId: DM,
    isTurnBased: true,
    currentTurnUserId: 10,
    turnStartedAt: new Date(T0).toISOString(),
    turnTimeLimit: 3600,
  };
  const afterExpiry = T0 + 3600 * 1000 + 1;

  check('an expired turn is reported stale', buildTurnState(campaign, roster3, 20, afterExpiry).isStale, true);
  check('an absent player cannot strand the table', buildTurnState(campaign, roster3, 20, afterExpiry).canAct, true);
  check(
    'a player two seats away can also take over, not just the next in line',
    buildTurnState(campaign, roster3, 30, afterExpiry).canAct,
    true
  );

  const noLimit = { ...campaign, turnTimeLimit: null };
  check(
    '"no timer" still blocks other players inside the backstop window',
    buildTurnState(noLimit, roster3, 20, T0 + 24 * 3600 * 1000).canAct,
    false
  );
  check(
    '"no timer" still expires at the backstop, so the campaign can never deadlock',
    buildTurnState(noLimit, roster3, 20, T0 + (TURN_STALL_FALLBACK_SECONDS + 1) * 1000).canAct,
    true
  );
});

group('buildTurnState — a closed turn', () => {
  // Ending a turn clears the start time but keeps the holder as a bookmark, so
  // the rotation resumes in the right place instead of rewinding to seat one.
  const paused = {
    userId: DM,
    isTurnBased: true,
    currentTurnUserId: 10,
    turnStartedAt: null,
    turnTimeLimit: 3600,
  };

  check('nobody is gated while no turn is open', buildTurnState(paused, roster3, 20, T0).canAct, true);
  check('the bookmark does not read as an active turn', buildTurnState(paused, roster3, 10, T0).isYourTurn, false);
  check(
    'the bookmark is preserved so the next turn follows it',
    nextSeatIndex(roster3, buildTurnState(paused, roster3, 10, T0).currentTurnUserId),
    1
  );
});

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
