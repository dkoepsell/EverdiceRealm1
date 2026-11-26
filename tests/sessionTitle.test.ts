/**
 * Session titles follow the chapter: when a chapter advances on the same
 * campaign_sessions row, the active session is renamed (server/lib/sessionTitle.ts).
 *
 * Run with: npx tsx tests/sessionTitle.test.ts
 */
import { sessionTitleForChapter } from "../server/lib/sessionTitle";

let failures = 0;
let checks = 0;
function check(name: string, actual: unknown, expected: unknown) {
  checks++;
  const ok = actual === expected;
  if (!ok) { failures++; console.error(`  ✗ ${name}\n      expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
  else console.log(`  ✓ ${name}`);
}

console.log("Placeholders are renamed to the live chapter");
check("the reported bug: 'Chapter 2' row in chapter 5", sessionTitleForChapter("Chapter 2", 5), "Chapter 5");
check("'Session 3' placeholder", sessionTitleForChapter("Session 3", 4), "Chapter 4");
check("case and spacing", sessionTitleForChapter("  chapter   2 ", 3), "Chapter 3");
check("empty title", sessionTitleForChapter("", 2), "Chapter 2");
check("null title", sessionTitleForChapter(null, 2), "Chapter 2");

console.log("A numbered name from an earlier chapter is retired");
check("'Chapter 2: The Pass' in chapter 3", sessionTitleForChapter("Chapter 2: The Pass", 3), "Chapter 3");

console.log("Titles that already fit, or are the DM's own, are left alone");
check("already the right chapter", sessionTitleForChapter("Chapter 5", 5), null);
check("right chapter with its name", sessionTitleForChapter("Chapter 5: Ashes", 5), null);
check("free-form name", sessionTitleForChapter("Blood on the Proclamation", 5), null);
check("name that only contains a number", sessionTitleForChapter("The 12 Gates", 2), null);
check("'Chapterhouse' is not 'Chapter N'", sessionTitleForChapter("Chapterhouse 2", 3), null);

console.log("Nonsense chapters change nothing");
check("chapter 0", sessionTitleForChapter("Chapter 2", 0), null);
check("fractional chapter", sessionTitleForChapter("Chapter 2", 2.5), null);

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
