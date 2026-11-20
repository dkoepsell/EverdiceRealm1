/**
 * Shorter loops (engagement spec Phase 5): episode tracking and break points,
 * pacing by campaign length, and option-opening SRD loot with the attunement limit.
 *
 * Run with: npx tsx tests/episodes.test.ts
 */
import { clockAtRisk, lastSentence, minutesLeft, nextEpisode, parseEpisode, shouldEndEpisode, trackEpisode } from '../server/play/episodes';
import { pacingForLength } from '../shared/rules/campaignLength';
import { ATTUNEMENT_LIMIT, MAGIC_ITEMS, itemAdvantages, itemsPromptLine, pickChapterItem } from '../shared/rules/magicItems';
import { seedClocks } from '../server/play/clocks';

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

console.log('episodes');
let ep = parseEpisode(null, 't0');
check('starts at episode 1', [ep.number, ep.scenes], [1, 0]);
ep = trackEpisode(ep, { items: ['Cloak of Elvenkind'], allies: ['Mira'], rules: ['Passive checks'] });
ep = trackEpisode(ep, { rules: ['Passive checks', 'Advantage'] });
check('gains accumulate, deduped', ep.gains, { items: ['Cloak of Elvenkind'], allies: ['Mira'], rules: ['Passive checks', 'Advantage'] });
check('scenes counted', ep.scenes, 2);
const at = (scenes: number) => ({ ...ep, scenes });
const base = { inCombat: false, chapterAdvanced: false, sessionBreakpoint: false, beat: 'open_question', targetScenes: 8 };
check('never mid-fight', shouldEndEpisode(at(20), { ...base, inCombat: true }), false);
check('a chapter turning ends it', shouldEndEpisode(at(1), { ...base, chapterAdvanced: true }), true);
check('DM breakpoint after 4+ scenes', [shouldEndEpisode(at(3), { ...base, sessionBreakpoint: true }), shouldEndEpisode(at(4), { ...base, sessionBreakpoint: true })], [false, true]);
check('at target on a breather', shouldEndEpisode(at(8), { ...base, beat: 'quiet' }), true);
check('at target mid-tension waits', shouldEndEpisode(at(8), { ...base, beat: 'pressure' }), false);
check('two over target ends regardless', shouldEndEpisode(at(10), base), true);
check('next episode resets', [nextEpisode(ep, 't1').number, nextEpisode(ep, 't1').scenes], [2, 0]);
check('minutes left ~2 per scene', [minutesLeft(at(2), 8), minutesLeft(at(9), 8)], [12, 2]);
check('cliffhanger from last sentence', lastSentence('Mira rows away. Upriver, a green light flickers.'), 'Upriver, a green light flickers.');
const clocks = seedClocks().map((c) => (c.id === 'villain_plan' ? { ...c, filled: 2 } : c.id === 'alarm' ? { ...c, filled: 1 } : c));
check('clock most at risk, and the rest tick', clockAtRisk(clocks), { name: "The enemy's plan", filled: 2, segments: 8, ifRest: 3 });

console.log('pacing by length');
check('one-shot gates from scene 3', pacingForLength('one_shot').minScenes, 3);
check('quick is brisk', [pacingForLength('quick').minScenes, pacingForLength('quick').hardCap], [4, 9]);
check('standard unchanged', [pacingForLength('standard').minScenes, pacingForLength('standard').hardCap, pacingForLength('standard').nudges], [5, 13, [5, 7, 9]]);

console.log('loot that changes play');
check('every item opens an option', MAGIC_ITEMS.every((i) => i.opens.length > 5), true);
check('never a duplicate', pickChapterItem(MAGIC_ITEMS.slice(1).map((i) => i.name))?.name, MAGIC_ITEMS[0].name);
{
  const owned: string[] = [];
  for (let n = 0; n < 40; n++) { const it = pickChapterItem(owned, () => 0.5); if (!it) break; owned.push(it.name); }
  const attunedCount = MAGIC_ITEMS.filter((i) => i.attunement && owned.includes(i.name)).length;
  check(`granting every item never exceeds ${ATTUNEMENT_LIMIT} attuned (${attunedCount})`, attunedCount <= ATTUNEMENT_LIMIT, true);
  check('every item eventually granted once', owned.length, MAGIC_ITEMS.length);
}
check('nothing left to find', pickChapterItem(MAGIC_ITEMS.map((i) => i.name)), null);
check('Cloak of Elvenkind grants advantage on Stealth', itemAdvantages(['cloak of elvenkind'], 'stealth'), ['Cloak of Elvenkind']);
check('but not on Persuasion', itemAdvantages(['Cloak of Elvenkind'], 'persuasion'), []);
check('prompt line names the option', itemsPromptLine(['Immovable Rod']).includes('bracing a door'), true);

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
