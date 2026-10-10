/**
 * Tests for refusing play in a finished campaign.
 *
 * Run with: npx tsx tests/finishedCampaignGuard.test.ts
 */
import { playActionCampaignId, blockFinishedCampaignPlay } from '../server/lib/finishedCampaignGuard';

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

console.log('which requests count as play');
for (const path of [
  '/api/campaigns/8/advance-story',
  '/api/campaigns/8/advance-story-stream',
  '/api/campaigns/8/combat-action',
  '/api/campaigns/8/group-choices/vote',
  '/api/campaigns/8/trek/step',
  '/api/campaigns/8/capital/3/move',
  '/api/campaigns/8/party/give-gold',
  '/api/campaigns/8/sessions/advance',
]) {
  check(`POST ${path} is play`, playActionCampaignId('POST', path), 8);
}
for (const [method, path] of [
  ['GET', '/api/campaigns/8/advance-story'],
  ['POST', '/api/campaigns/8/notes'],
  ['POST', '/api/campaigns/8/turns/seen'],
  ['POST', '/api/campaigns/8/archive'],
  ['POST', '/api/campaigns/8/bank/deposit'],
  ['POST', '/api/campaigns/8/advance-story-streaming'],
  ['GET', '/api/campaigns/8/story'],
]) {
  check(`${method} ${path} is not play`, playActionCampaignId(method, path), null);
}

console.log('middleware');
async function run(campaign: any, path = '/api/campaigns/8/advance-story') {
  let status = 0;
  let body: any = null;
  let passed = false;
  const res: any = { status(s: number) { status = s; return this; }, json(b: any) { body = b; return this; } };
  await blockFinishedCampaignPlay(async () => campaign)({ method: 'POST', path, isAuthenticated: () => true } as any, res, () => { passed = true; });
  return { status, code: body?.code ?? null, passed };
}

(async () => {
  check('finished campaign refused', await run({ isCompleted: true }), { status: 409, code: 'campaign_completed', passed: false });
  check('live campaign passes', await run({ isCompleted: false }), { status: 0, code: null, passed: true });
  {
    let passed = false;
    const res: any = { status() { throw new Error('should not respond'); } };
    await blockFinishedCampaignPlay(async () => ({ isCompleted: true }))(
      { method: 'POST', path: '/api/campaigns/8/advance-story', isAuthenticated: () => false } as any, res, () => { passed = true; });
    check('signed-out request left to the route', passed, true);
  }
  check('bookkeeping in a finished campaign passes', await run({ isCompleted: true }, '/api/campaigns/8/notes'), { status: 0, code: null, passed: true });

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures) process.exit(1);
})();
