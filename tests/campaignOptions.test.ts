/**
 * Narrative style / difficulty normalisation: every value actually stored in
 * prod (2026-11-20) maps onto a dropdown option, so Settings never shows blank.
 *
 * Run with: npx tsx tests/campaignOptions.test.ts
 */
import { DIFFICULTIES, NARRATIVE_STYLES, narrativeStyleLabel, normalizeDifficulty, normalizeNarrativeStyle } from '../shared/campaignOptions';

let failures = 0;
let checks = 0;
function check(name: string, actual: unknown, expected: unknown) {
  checks++;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) { failures++; console.error(`  ✗ ${name}\n      expected ${e}\n      actual   ${a}`); } else console.log(`  ✓ ${name}`);
}

const styleValues = NARRATIVE_STYLES.map((o) => o.value as string);
const prodStyles: [string, string][] = [
  ['descriptive', 'descriptive'], ['Descriptive', 'descriptive'], ['balanced', 'descriptive'], ['tutorial_friendly', 'descriptive'],
  ['classic_fantasy', 'heroic'], ['classic', 'heroic'], ['Heroic Fantasy', 'heroic'], ['Dramatic', 'dramatic'], ['dark', 'dark'], ['Dark', 'dark'],
  ['Dark & Gritty', 'dark'], ['Humorous', 'humorous'], ['steampunk', 'descriptive'], ['Mystery', 'mystery'], ['', 'descriptive'], [null as any, 'descriptive'],
  ['Conversational', 'conversational'],
];
for (const [raw, want] of prodStyles) check(`style "${raw}"`, normalizeNarrativeStyle(raw), want);
check('every style result is an option', prodStyles.every(([raw]) => styleValues.includes(normalizeNarrativeStyle(raw))), true);
check('label', narrativeStyleLabel('dark'), 'Dark & Gritty');

const diffValues = DIFFICULTIES.map((o) => o.value as string);
const prodDiffs: [string, string][] = [
  ['balanced', 'Normal - Balanced Challenge'], ['Easy - Beginner Friendly', 'Easy - Beginner Friendly'], ['normal', 'Normal - Balanced Challenge'],
  ['Normal - Balanced Challenge', 'Normal - Balanced Challenge'], ['6-10', 'Normal - Balanced Challenge'], ['1-5', 'Normal - Balanced Challenge'],
  ['Hard - Deadly Encounters', 'Hard - Deadly Encounters'], ['hard', 'Hard - Deadly Encounters'], ['easy', 'Easy - Beginner Friendly'], ['', 'Normal - Balanced Challenge'],
];
for (const [raw, want] of prodDiffs) check(`difficulty "${raw}"`, normalizeDifficulty(raw), want);
check('every difficulty result is an option', prodDiffs.every(([raw]) => diffValues.includes(normalizeDifficulty(raw))), true);

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
