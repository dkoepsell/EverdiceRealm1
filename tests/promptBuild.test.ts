/**
 * Modular turn prompt (engagement spec Phase 7): each block appears only when
 * it applies, the JSON contract keeps its field names, and the static text
 * stays small.
 *
 * Run with: npx tsx tests/promptBuild.test.ts
 */
import { buildTurnPrompt, type TurnPromptContext } from '../server/play/prompt';
import { buildPromptExtras } from '../server/play/director/turnGuidance';
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

const base: TurnPromptContext = {
  narrativeStyle: 'Descriptive', styleInstructions: 'Use vivid detail.', difficulty: 'Normal',
  themeContext: '', chapterProgressNote: '', storySpine: '', chapterNudge: '', finaleInstructions: '',
  session1Contract: '', scaffoldGuidance: '', isTutorial: false, encounterNudge: '',
  extras: buildPromptExtras(ENGAGEMENT_FLAGS, 'open_question', null),
  recentTitles: ['The Ferry Landing', 'Mist on the Water'], recentLocations: ['Ferry Landing'], ledgerOn: false,
  previousSessionResult: null, storyState: { location: 'Ferry Landing', inCombat: false, journeyLog: new Array(50).fill('x') },
  quests: [{ title: 'Free Mira\'s brother', status: 'active' }], narrative: 'Mira waits by her boat.',
  playerCharacterInfo: 'PLAYER CHARACTER:\n- Name: Thessaly', spotlightDirective: '', choice: 'Ask about her brother',
  isWaypointTravel: false, mapState: '', movementDetected: null, skillCheckInfo: '', attackIntentInfo: '',
  skillCheckContinuation: '', recentActions: [], npcInteractions: {}, inCombat: false, previousChoices: [], momentousChoices: [],
};

const calm = buildTurnPrompt(base);
check('no combat block out of combat', calm.includes('COMBAT:'), false);
check('no combatEffects schema out of combat', calm.includes('"combatEffects"'), false);
check('no dungeon schema off the map', calm.includes('"dungeonState": {"currentRoom"'), false);
check('no motif ban list', /OVERUSED MOTIFS|MOTIFS USED/.test(calm), false);
check('no "new NPC every scene" rule', /EVERY scene MUST introduce/.test(calm), false);
check('keeps contract fields', ['"narrative"', '"sceneType"', '"choices"', '"requiresDiceRoll"', '"skillType"', '"rollDC"', '"storyState"', '"movement"', '"chapterGateMet"'].every((f) => calm.includes(f)), true);
check('bookkeeping stripped from story state', calm.includes('journeyLog'), false);
check('default choice rule when beats off', calm.includes('CHOICES: offer 3–4'), true);
check('the player\'s action is quoted', calm.includes('THE PLAYER NOW: "Ask about her brother"'), true);

const fight = buildTurnPrompt({ ...base, inCombat: true, storyState: { inCombat: true, combatants: [{ name: 'Bandit', type: 'enemy', currentHp: 5, maxHp: 11, ac: 12, status: 'bloodied' }] } });
check('combat block in combat', fight.includes('COMBAT:'), true);
check('exact enemy names listed', fight.includes('"Bandit" (enemy): HP 5/11, AC 12'), true);
check('combatEffects schema in combat', fight.includes('"combatEffects"'), true);

const mapped = buildTurnPrompt({ ...base, mapState: 'CURRENT MAP: room 3, exits north' });
check('dungeon schema on a map', mapped.includes('"dungeonState": {"currentRoom"'), true);

const beats = buildTurnPrompt({ ...base, extras: buildPromptExtras({ ...ENGAGEMENT_FLAGS, beats: true }, 'conversation', null) });
check('beat replaces the default choice rule', [beats.includes('BEAT: conversation'), beats.includes('CHOICES: offer 3–4')], [true, false]);

const ledger = buildTurnPrompt({ ...base, ledgerOn: true, ledgerBlock: 'CALLBACKS (use at least one naturally): Mira owes you.' });
check('ledger callbacks included', ledger.includes('CALLBACKS'), true);
check('prefer returning cast with the ledger', ledger.includes('Prefer the returning cast'), true);

const finale = buildTurnPrompt({ ...base, finaleInstructions: 'FINAL CHAPTER: end it.' });
check('finale only when given', [calm.includes('FINAL CHAPTER'), finale.includes('FINAL CHAPTER')], [false, true]);

const momentous = buildTurnPrompt({ ...base, momentousChoices: [{ choice: 'Took the orb', consequence: 'Eyes glow' }] });
check('permanent decisions listed', momentous.includes('"Took the orb" → Eyes glow'), true);

// Static size: the old prompt's fixed text alone (philosophy, constraints,
// framing, temperature, combat/map/style rules, schema) measured ~25k characters
// in the template plus ~9k in shared constants
// before any campaign context was added.
console.log(`  (calm prompt: ${calm.length} chars, combat prompt: ${fight.length} chars)`);
check('calm prompt under 7k chars of static text', calm.length < 7000, true);

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
