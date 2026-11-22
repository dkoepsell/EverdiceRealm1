/**
 * Persistence for Wander threads and road rumors. Every call fails soft: if
 * migration 005 has not been run, reads return nothing and writes are skipped,
 * and Wander plays exactly as it did before threads existed.
 */
import { and, between, desc, eq, inArray, sql } from "drizzle-orm";
import { MARKS_PER_HEX, type RealmMark, type RealmMarkKind } from "@shared/wander/realm";
import { db } from "../../db";
import { wanderThreads, wanderMarkers, wanderRuns, worldRumors, dungeonDefinitions, realmMarks } from "@shared/schema";
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

// ── shared realm ──────────────────────────────────────────────────────────────


function toMark(r: any, viewer: number): RealmMark {
  const nodded: number[] = Array.isArray(r.noddedBy) ? r.noddedBy : [];
  return {
    id: r.id, q: r.hexQ, r: r.hexR, kind: r.kind as RealmMarkKind, text: r.text, characterName: r.characterName,
    createdAt: r.createdAt, nods: nodded.length, nodded: nodded.includes(viewer), mine: r.userId === viewer,
  };
}

/** Realm marks within `radius` hexes of (q, r): at most MARKS_PER_HEX per hex, best first. */
export async function realmMarksNear(q: number, r: number, radius: number, viewer: number): Promise<RealmMark[]> {
  try {
    const rows = await db.select().from(realmMarks).where(and(
      between(realmMarks.hexQ, q - radius, q + radius),
      between(realmMarks.hexR, r - radius, r + radius),
    )).orderBy(desc(realmMarks.id)).limit(200);
    const marks = rows
      .map((x) => toMark(x, viewer))
      .filter((m) => Math.max(Math.abs(m.q - q), Math.abs(m.r - r), Math.abs(m.q + m.r - q - r)) <= radius);
    const byHex = new Map<string, RealmMark[]>();
    for (const m of marks) {
      const k = `${m.q},${m.r}`;
      byHex.set(k, [...(byHex.get(k) ?? []), m]);
    }
    return Array.from(byHex.values()).flatMap((list) =>
      list.sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0) || b.nods - a.nods || b.id - a.id).slice(0, MARKS_PER_HEX));
  } catch (err) {
    warn("realmMarksNear", err);
    return [];
  }
}

export async function addRealmMark(m: { q: number; r: number; kind: RealmMarkKind; text: string; characterName: string; userId: number }): Promise<RealmMark | null> {
  try {
    if (m.kind === "sign") {
      // One sign per player per hex: leaving another replaces it.
      await db.delete(realmMarks).where(and(eq(realmMarks.hexQ, m.q), eq(realmMarks.hexR, m.r), eq(realmMarks.userId, m.userId), eq(realmMarks.kind, "sign")));
    }
    const [row] = await db.insert(realmMarks).values({ hexQ: m.q, hexR: m.r, kind: m.kind, text: m.text, characterName: m.characterName, userId: m.userId, noddedBy: [] as any }).returning();
    return row ? toMark(row, m.userId) : null;
  } catch (err) {
    warn("addRealmMark", err);
    return null;
  }
}

/** Nod at someone else's mark ("this helped"). Once per player; nodding again takes it back. */
export async function nodRealmMark(id: number, userId: number): Promise<RealmMark | null> {
  try {
    const [row] = await db.select().from(realmMarks).where(eq(realmMarks.id, id));
    if (!row || row.userId === userId) return row ? toMark(row, userId) : null;
    const list: number[] = Array.isArray(row.noddedBy) ? (row.noddedBy as number[]) : [];
    const next = list.includes(userId) ? list.filter((x) => x !== userId) : [...list, userId].slice(-500);
    const [updated] = await db.update(realmMarks).set({ noddedBy: next as any }).where(eq(realmMarks.id, id)).returning();
    return updated ? toMark(updated, userId) : null;
  } catch (err) {
    warn("nodRealmMark", err);
    return null;
  }
}
