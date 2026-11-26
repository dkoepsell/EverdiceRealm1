// Chapters advance on the same campaign_sessions row (gate, hard cap, boss
// defeat, DM override all bump campaigns.currentSession without opening a new
// session). A row created as "Chapter 2" therefore kept that title while the
// party moved on to chapter 5, and everything that reads session titles —
// the story heading, Discord, the admin session list — named the wrong chapter.

/** A title that only names a chapter number, optionally with a subtitle: "Chapter 2", "Session 3: The Pass". */
const NUMBERED = /^\s*(?:chapter|session)\s*(\d+)\b\s*(?::\s*(.*))?$/i;

/**
 * The title the active session should carry once the campaign is in `chapter`,
 * or null to leave it alone.
 *
 * - Empty or a bare "Chapter N" / "Session N" placeholder for another chapter → "Chapter {chapter}".
 * - "Chapter N: Name" for another chapter → "Chapter {chapter}"; that name belonged to chapter N.
 * - A free-form name ("Blood on the Proclamation") is left alone: it may be a DM's
 *   own title, and nothing records which chapter it belonged to.
 */
export function sessionTitleForChapter(currentTitle: string | null | undefined, chapter: number): string | null {
  if (!Number.isInteger(chapter) || chapter < 1) return null;
  const title = (currentTitle ?? "").trim();
  const wanted = `Chapter ${chapter}`;
  if (!title) return wanted;
  const m = NUMBERED.exec(title);
  if (!m) return null;
  if (Number(m[1]) === chapter) return null;
  return wanted;
}
