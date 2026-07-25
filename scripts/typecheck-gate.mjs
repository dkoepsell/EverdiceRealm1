#!/usr/bin/env node
/**
 * Type-check gate: fails on NEW type errors, tolerates the existing backlog.
 *
 * Why this exists: the production build is esbuild, which does not type-check,
 * so a compile error can ship. One did — commit 4a946cf replaced `req.user.id`
 * with `ctx.userId` in thirteen handlers that never define `ctx`, and `tsc` had
 * been reporting all fifteen occurrences as "Cannot find name 'ctx'" the whole
 * time. In production every one of those handlers threw ReferenceError and
 * returned 500, so players could not see or add their own characters.
 *
 * A plain `tsc` gate is unusable here because the repo carries a large existing
 * backlog. So this compares against a committed baseline and only fails when a
 * file gains errors it did not have before.
 *
 * Errors are keyed by `file|TScode` and counted — deliberately NOT by message
 * or line number. Messages embed full type dumps that churn whenever an
 * unrelated type changes, and line numbers move on every edit; either would
 * make the baseline drift constantly and train everyone to ignore it. Counts
 * still catch the real case: a file going from 0 to 1 errors, or from 1 to 16.
 *
 *   npm run check:gate      verify (used by prebuild, so `npm run build` gates)
 *   npm run check:baseline  re-record after legitimately fixing or adding errors
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE = join(HERE, 'typecheck-baseline.json');
const UPDATE = process.argv.includes('--update');

function runTsc() {
  try {
    // tsc exits non-zero whenever there are errors, which is the normal case
    // here — the output is what matters, not the exit code.
    return execFileSync('npx', ['tsc', '--noEmit', '--pretty', 'false'], {
      cwd: join(HERE, '..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    if (err.stdout != null) return err.stdout + (err.stderr ?? '');
    throw err;
  }
}

/** `path(12,34): error TS2304: ...` -> { "path|TS2304": count } */
function tally(output) {
  const counts = {};
  const re = /^(.+?)\((\d+),(\d+)\): error (TS\d+):/;
  for (const line of output.split('\n')) {
    const m = re.exec(line.trim());
    if (!m) continue;
    const key = `${m[1].replace(/\\/g, '/')}|${m[4]}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

const current = tally(runTsc());
const currentTotal = Object.values(current).reduce((a, b) => a + b, 0);

if (UPDATE) {
  writeFileSync(BASELINE, JSON.stringify({ total: currentTotal, counts: current }, null, 2) + '\n');
  console.log(`Baseline updated: ${currentTotal} error(s) across ${Object.keys(current).length} file/code pair(s).`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(`No baseline at ${BASELINE}. Run: npm run check:baseline`);
  process.exit(2);
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')).counts ?? {};
const baselineTotal = Object.values(baseline).reduce((a, b) => a + b, 0);

const regressions = [];
for (const [key, count] of Object.entries(current)) {
  const was = baseline[key] ?? 0;
  if (count > was) regressions.push({ key, was, now: count });
}

if (regressions.length > 0) {
  console.error(`\n✗ ${regressions.length} new type error location(s) — refusing to build.\n`);
  for (const { key, was, now } of regressions.sort((a, b) => a.key.localeCompare(b.key))) {
    const [file, code] = key.split('|');
    console.error(`  ${file}  ${code}: ${was} -> ${now}`);
  }
  console.error(`\nTotal: ${baselineTotal} (baseline) -> ${currentTotal} (now).`);
  console.error(`Run \`npx tsc --noEmit\` for the messages.`);
  console.error(`If these errors are intentional and understood, re-record with: npm run check:baseline\n`);
  process.exit(1);
}

const fixed = baselineTotal - currentTotal;
if (fixed > 0) {
  console.log(`✓ No new type errors (${currentTotal}). ${fixed} fewer than baseline — consider: npm run check:baseline`);
} else {
  console.log(`✓ No new type errors (${currentTotal}).`);
}
