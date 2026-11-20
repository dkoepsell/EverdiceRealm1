/**
 * Server-side analytics writer for user_activity_events.
 *
 * user_activity_events.session_id is NOT NULL with no default — it was built
 * for browser sessions. Server-originated events (turns, level-ups, nightly
 * jobs) have no browser session, so they are written with SERVER_SESSION_ID.
 * Before this helper existed the re-engagement writer omitted session_id and
 * every insert failed inside its try/catch, silently.
 *
 * Logging must never break the request that triggered it: failures are
 * warned and swallowed.
 */
import { db } from "../db";
import { userActivityEvents } from "@shared/schema";

export const SERVER_SESSION_ID = "server";

export interface ServerEventContext {
  campaignId?: number | null;
  characterId?: number | null;
  duration?: number | null;
}

export async function logServerEvent(
  userId: number,
  eventType: string,
  eventCategory: string,
  eventName: string,
  eventData: Record<string, unknown> = {},
  ctx: ServerEventContext = {},
): Promise<void> {
  if (!Number.isFinite(userId)) return;
  try {
    await db.insert(userActivityEvents).values({
      userId,
      sessionId: SERVER_SESSION_ID,
      eventType,
      eventCategory,
      eventName,
      eventData,
      campaignId: ctx.campaignId ?? null,
      characterId: ctx.characterId ?? null,
      duration: ctx.duration ?? null,
    });
  } catch (err) {
    console.warn(`[activityLog] failed to record ${eventType}/${eventName}:`, (err as Error)?.message);
  }
}

/** Fire-and-forget variant for hot paths (the turn handler). */
export function logServerEventAsync(...args: Parameters<typeof logServerEvent>): void {
  void logServerEvent(...args);
}
