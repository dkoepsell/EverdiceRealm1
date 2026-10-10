/**
 * Rebuilds a campaign's story, in order, for reading back after the fact.
 *
 * Two records hold what happened, and neither is complete on its own:
 *  - `campaign_turn_log` is never trimmed and knows who acted and in which
 *    chapter, but only exists for turns taken since it shipped (2026-08-09).
 *  - each session's `action_log` goes back further but keeps only its last 200
 *    entries, and never recorded who acted.
 *
 * The turn log is authoritative from its first row onwards; the action log
 * supplies only what came before it, so no turn is told twice.
 */

export interface StoryTurn {
  actorName: string | null;
  characterName: string | null;
  choice: string | null;
  narrative: string | null;
  at: string | null;
}

export interface StoryChapter {
  key: string;
  chapterNumber: number | null;
  title: string;
  turns: StoryTurn[];
}

export interface AdventureStory {
  chapters: StoryChapter[];
  /** True when older entries were trimmed and the story starts partway through. */
  beginsPartway: boolean;
}

interface TurnLogRow {
  id: number;
  actorName: string;
  characterName: string | null;
  choice: string | null;
  narrative: string | null;
  chapterNumber: number | null;
  createdAt: string;
}

interface SessionRow {
  sessionNumber: number;
  title: string;
  actionLog: unknown;
}

/** Matches MAX_LOG_ENTRIES in storage.ts — a log this long has lost its head. */
export const ACTION_LOG_CAP = 200;

function sessionTurns(session: SessionRow, before: number): StoryTurn[] {
  const log = Array.isArray(session.actionLog) ? session.actionLog : [];
  const turns: StoryTurn[] = [];
  let current: StoryTurn | null = null;

  for (const entry of log as any[]) {
    if (!entry || typeof entry.text !== "string" || !entry.text.trim()) continue;
    const at = typeof entry.timestamp === "string" ? entry.timestamp : null;
    const time = at ? Date.parse(at) : NaN;
    if (Number.isFinite(time) && time >= before) continue;

    if (entry.type === "player_action") {
      current = { actorName: null, characterName: null, choice: entry.text, narrative: null, at };
      turns.push(current);
    } else if (entry.type === "narrative") {
      if (current && !current.narrative) {
        current.narrative = entry.text;
      } else {
        // A narrative with no action ahead of it: an opening, or a scene the
        // table was moved into rather than chose.
        current = { actorName: null, characterName: null, choice: null, narrative: entry.text, at };
        turns.push(current);
      }
    }
  }
  return turns;
}

export function buildAdventureStory(turnLog: TurnLogRow[], sessions: SessionRow[]): AdventureStory {
  const logged = [...turnLog].sort((a, b) => a.id - b.id);
  const firstLoggedAt = logged.length ? Date.parse(logged[0].createdAt) : Infinity;
  const cutoff = Number.isFinite(firstLoggedAt) ? firstLoggedAt : Infinity;

  const chapters: StoryChapter[] = [];
  const orderedSessions = [...sessions].sort((a, b) => a.sessionNumber - b.sessionNumber);

  for (const session of orderedSessions) {
    const turns = sessionTurns(session, cutoff);
    if (!turns.length) continue;
    chapters.push({
      key: `session-${session.sessionNumber}`,
      chapterNumber: null,
      // When the turn log follows, these turns are only the earlier part of the
      // tale and their session title would mislabel the chapters after them.
      title: logged.length ? "Earlier in the tale" : session.title,
      turns,
    });
  }

  let open: StoryChapter | null = chapters[chapters.length - 1] ?? null;
  for (const row of logged) {
    const n = row.chapterNumber ?? null;
    // Party aid (a potion passed, gold handed over) is logged without a
    // chapter; it happened in whichever chapter was underway.
    if (!open || (n !== null && open.chapterNumber !== n)) {
      open = {
        key: `chapter-${n ?? "x"}-${row.id}`,
        chapterNumber: n,
        title: n ? `Chapter ${n}` : "The tale continues",
        turns: [],
      };
      chapters.push(open);
    }
    open.turns.push({
      actorName: row.actorName || null,
      characterName: row.characterName,
      choice: row.choice,
      narrative: row.narrative,
      at: row.createdAt,
    });
  }

  const trimmed = orderedSessions.some(
    (s) => Array.isArray(s.actionLog) && s.actionLog.length >= ACTION_LOG_CAP,
  );
  // With nothing older to fall back on, a turn log that opens past chapter 1
  // means the campaign was already underway when the log began.
  const hasEarlierPart = chapters.some((c) => c.key.startsWith("session-"));
  const beginsPartway = trimmed || (!hasEarlierPart && (logged[0]?.chapterNumber ?? 1) > 1);

  return { chapters, beginsPartway };
}
