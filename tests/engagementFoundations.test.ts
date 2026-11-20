/**
 * Engagement spec Phase F: feature flags and campaign length.
 *
 * Run with: npx tsx tests/engagementFoundations.test.ts
 */
import { ENGAGEMENT_FLAGS, resolveFlags, isFlagOn } from '../shared/engagementFlags';
import { normalizeCampaignLength, chaptersForLength } from '../shared/rules/campaignLength';

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

console.log('engagement flags');
check('null campaign gets defaults', resolveFlags(null), { ...ENGAGEMENT_FLAGS });
check('override switches one flag on', resolveFlags({ engagementFlags: { beats: true } }).beats, true);
check('override leaves others at default', resolveFlags({ engagementFlags: { beats: true } }).ledger, ENGAGEMENT_FLAGS.ledger);
check('non-boolean override ignored', resolveFlags({ engagementFlags: { beats: 'yes' } }).beats, ENGAGEMENT_FLAGS.beats);
check('unknown key ignored', 'bogus' in resolveFlags({ engagementFlags: { bogus: true } }), false);
check('array override ignored', resolveFlags({ engagementFlags: [true] }), { ...ENGAGEMENT_FLAGS });
check('isFlagOn reads override', isFlagOn({ engagementFlags: { clocks: true } }, 'clocks'), true);

console.log('campaign length');
check('"oneshot" (PlayerQuickStart) is a one-shot', normalizeCampaignLength('oneshot'), 'one_shot');
check('"one_shot" is a one-shot', normalizeCampaignLength('one_shot'), 'one_shot');
check('missing length is standard', normalizeCampaignLength(undefined), 'standard');
check('unknown length is standard', normalizeCampaignLength('weird'), 'standard');
check('"short" maps to quick', normalizeCampaignLength('short'), 'quick');
check('one-shot is 1 chapter', chaptersForLength('one_shot'), 1);
check('quick is 3 chapters', chaptersForLength('quick'), 3);
check('standard low end', chaptersForLength('standard', 'generated', () => 0), 5);
check('standard high end', chaptersForLength('standard', 'generated', () => 0.99), 6);
check('epic generated 8-10', [chaptersForLength('epic', 'generated', () => 0), chaptersForLength('epic', 'generated', () => 0.99)], [8, 10]);
check('legendary generated 12-15', [chaptersForLength('legendary', 'generated', () => 0), chaptersForLength('legendary', 'generated', () => 0.99)], [12, 15]);
check('imported standard 4-5', [chaptersForLength('standard', 'imported', () => 0), chaptersForLength('standard', 'imported', () => 0.99)], [4, 5]);
check('imported epic 6-8', [chaptersForLength('epic', 'imported', () => 0), chaptersForLength('epic', 'imported', () => 0.99)], [6, 8]);

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
