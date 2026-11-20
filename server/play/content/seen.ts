/** Per-player seen-content tracking (user_seen_content). Never throws. */
import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { userSeenContent } from "@shared/schema";

export async function seenIds(userId: number, kind: string): Promise<Set<string>> {
  try {
    const rows = await db.select({ id: userSeenContent.contentId }).from(userSeenContent)
      .where(and(eq(userSeenContent.userId, userId), eq(userSeenContent.kind, kind)));
    return new Set(rows.map((r) => r.id));
  } catch (err) {
    console.warn("[seen] read failed:", (err as Error)?.message);
    return new Set();
  }
}

export async function markSeen(userId: number, kind: string, contentId: string): Promise<void> {
  try {
    await db.insert(userSeenContent).values({ userId, kind, contentId }).onConflictDoNothing();
  } catch (err) {
    console.warn("[seen] write failed:", (err as Error)?.message);
  }
}
