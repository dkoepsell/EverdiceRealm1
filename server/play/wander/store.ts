/**
 * Persistence for Wander threads and road rumors. Every call fails soft: if
 * migration 005 has not been run, reads return nothing and writes are skipped,
 * and Wander plays exactly as it did before threads existed.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import { wanderThreads, wanderMarkers, wanderRuns, worldRumors, dungeonDefinitions } from "@shared/schema";
import type { ThreadRow, ThreadStatus, ThreadPayload } from "./threads";

let warned = false;
function warn(where: string, err: unknown) {
  if (warned) return;
  warned = true;
  console.warn(`[wander-threads] ${where} failed (has scripts/migrations/005-wander-threads.sql been run?):`, (err as Error)?.message);
}

function toRow(r: any): ThreadRow {
  return {
    id: r.id,
    campaignId: r.campaignId,
    userId: r.userId,
    templateId: r.templateId,
    beat: r.beat,
    targetHexQ: r.targetHexQ,
    targetHexR: r.targetHexR,
    status: r.status as ThreadStatus,
    payload: (r.payload ?? null) as ThreadPayload | null,
  };
}

export async function listThreads(userId: number, campaignId: number, statuses: ThreadStatus[] = ["active", "rumored"]): Promise<ThreadRow[]> {
  try {
    const rows = await db.select().from(wanderThreads).where(and(
      eq(wanderThreads.userId, userId),
      eq(wanderThreads.campaignId, campaignId),
      inArray(wanderThreads.status, statuses),
    )).orderBy(desc(wanderThreads.id));
    return rows.map(toRow);
  } catch (err) {
    warn("listThreads", err);
    return [];
  }
}

export async function getThread(id: number): Promise<ThreadRow | null> {
  try {
    const [row] = await db.select().from(wanderThreads).where(eq(wanderThreads.id, id));
    return row ? toRow(row) : null;
  } catch (err) {
    warn("getThread", err);
    return null;
  }
}

export async function createThread(row: Omit<ThreadRow, "id">): Promise<ThreadRow | null> {
  try {
    const [created] = await db.insert(wanderThreads).values({
      campaignId: row.campaignId,
      userId: row.userId,
      templateId: row.templateId,
      beat: row.beat,
      targetHexQ: row.targetHexQ,
      targetHexR: row.targetHexR,
      status: row.status,
      payload: row.payload as any,
      updatedAt: new Date().toISOString(),
    }).returning();
    return created ? toRow(created) : null;
  } catch (err) {
    warn("createThread", err);
    return null;
  }
}

export async function updateThread(id: number, patch: { beat?: number; status?: ThreadStatus; payload?: ThreadPayload }): Promise<void> {
  try {
    const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (patch.beat != null) set.beat = patch.beat;
    if (patch.status) set.status = patch.status;
    if (patch.payload) set.payload = patch.payload;
    await db.update(wanderThreads).set(set).where(eq(wanderThreads.id, id));
  } catch (err) {
    warn("updateThread", err);
  }
}

/** The campaign the player most recently wandered in, for Tavern road rumors. */
export async function latestWanderCampaign(userId: number): Promise<number | null> {
  try {
    const [run] = await db.select({ campaignId: wanderRuns.campaignId }).from(wanderRuns)
      .where(eq(wanderRuns.userId, userId)).orderBy(desc(wanderRuns.id)).limit(1);
    return run?.campaignId ?? null;
  } catch (err) {
    console.warn("[wander] latestWanderCampaign failed:", (err as Error)?.message);
    return null;
  }
}

/** Post a "they say someone..." rumor to the campaign's pool when a thread is resolved. */
export async function postCompletionRumor(campaignId: number, narrative: string): Promise<void> {
  try {
    await db.insert(worldRumors).values({
      campaignId,
      narrative,
      source: "travellers",
      rumorType: "gossip",
      createdAt: new Date().toISOString(),
    } as any);
  } catch (err) {
    console.warn("[wander] postCompletionRumor failed:", (err as Error)?.message);
  }
}

/**
 * Dungeons found by following Wander threads, for the Delve list. They are
 * linked from the player's wander markers.
 */
export async function wanderFoundDungeons(userId: number) {
  try {
    const markers = await db.select().from(wanderMarkers)
      .where(and(eq(wanderMarkers.discoveredBy, userId), sql`${wanderMarkers.linkedDungeonId} IS NOT NULL`))
      .orderBy(desc(wanderMarkers.id)).limit(8);
    const ids = markers.map((m) => m.linkedDungeonId!).filter(Boolean);
    if (!ids.length) return [];
    const defs = await db.select().from(dungeonDefinitions).where(inArray(dungeonDefinitions.id, ids));
    return defs.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      themeTags: d.themeTags,
      recommendedLevelMin: d.recommendedLevelMin,
      recommendedLevelMax: d.recommendedLevelMax,
      campaignId: markers.find((m) => m.linkedDungeonId === d.id)?.campaignId ?? null,
    }));
  } catch (err) {
    console.warn("[wander] wanderFoundDungeons failed:", (err as Error)?.message);
    return [];
  }
}
