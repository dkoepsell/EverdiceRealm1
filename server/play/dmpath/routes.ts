/**
 * The DM path, milestone nudges, and "open to live play" (dm-path.md).
 *
 *   GET  /api/dm-path                      steps with status and what you made
 *   POST /api/dm-path/dm_job/complete      mark the reading step done
 *   POST /api/dm-path/fair-fight           rate an encounter; completes on the goal
 *   POST /api/dm-path/npc                  save an NPC (optionally into a campaign you run)
 *   POST /api/dm-path/clues                save a three-clue mystery
 *   POST /api/dm-path/five-room/check      feedback on a five-room design
 *   POST /api/dm-path/five-room            build it as a Delve dungeon you can playtest
 *   POST /api/dm-path/session-zero         save a session-zero checklist
 *   POST /api/dm-path/post-oneshot         post your dungeon on Find a Game
 *   GET  /api/dm-path/nudges               milestone nudges not yet dismissed
 *   POST /api/dm-path/nudges/:id/dismiss
 *   GET  /api/play-together                your preferences, and matches if you're open
 *   PUT  /api/play-together
 *
 * Fails soft without migration 007: reads return empty, writes are skipped.
 */
import type { Express, Request, Response } from "express";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "../../db";
import { storage } from "../../storage";
import {
  campaigns, campaignParticipants, campaignSessions, characters, dmPathProgress, dungeonDefinitions, dungeonRuns,
  playPreferences, userRulesSeen, users, wanderThreads, bulletinPosts,
} from "@shared/schema";
import {
  DM_STEPS, FAIR_FIGHT_GOAL, PLAY_ROLES, PLAY_SLOTS, PLAY_STYLES, SESSION_ZERO_ITEMS,
  checkClues, checkFiveRoom, checkNpc, fiveRoomToNodes, nudgesFor, rateMonsterList, type DmStepId,
} from "@shared/dm/path";
import { LESSONS } from "@shared/rules/learningPath";
import { MONSTERS } from "@shared/rules/monsters";
import { loadLedger, saveLedger } from "../ledger/store";
import { mergeLedgerUpdates } from "../ledger/merge";

let warned = false;
function warn(where: string, err: unknown) {
  if (warned) return;
  warned = true;
  console.warn(`[dm-path] ${where} failed (has scripts/migrations/007-dm-path.sql been run?):`, (err as Error)?.message);
}

function uid(req: Request, res: Response): number | null {
  if (!req.isAuthenticated?.() || !req.user) { res.status(401).json({ error: "Authentication required" }); return null; }
  return (req.user as any).id as number;
}

async function progressRows(userId: number) {
  try {
    return await db.select().from(dmPathProgress).where(eq(dmPathProgress.userId, userId));
  } catch (err) { warn("progressRows", err); return []; }
}

async function saveStep(userId: number, stepId: string, data: unknown, complete: boolean) {
  try {
    const now = new Date().toISOString();
    const [existing] = await db.select().from(dmPathProgress).where(and(eq(dmPathProgress.userId, userId), eq(dmPathProgress.stepId, stepId)));
    const completedAt = existing?.completedAt ?? (complete ? now : null);
    if (existing) {
      await db.update(dmPathProgress).set({ data: data as any, completedAt, updatedAt: now })
        .where(and(eq(dmPathProgress.userId, userId), eq(dmPathProgress.stepId, stepId)));
    } else {
      await db.insert(dmPathProgress).values({ userId, stepId, data: data as any, completedAt, updatedAt: now });
    }
    return true;
  } catch (err) { warn("saveStep", err); return false; }
}

/** Campaigns this user runs as DM with at least one other player and at least one session. */
async function gamesRun(userId: number): Promise<number> {
  try {
    const mine = await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.userId, userId));
    if (!mine.length) return 0;
    const ids = mine.map((c) => c.id);
    const others = await db.selectDistinct({ campaignId: campaignParticipants.campaignId }).from(campaignParticipants)
      .where(and(inArray(campaignParticipants.campaignId, ids), ne(campaignParticipants.userId, userId)));
    if (!others.length) return 0;
    const withSessions = await db.selectDistinct({ campaignId: campaignSessions.campaignId }).from(campaignSessions)
      .where(inArray(campaignSessions.campaignId, others.map((o) => o.campaignId)));
    return withSessions.length;
  } catch (err) {
    console.warn("[dm-path] gamesRun failed:", (err as Error)?.message);
    return 0;
  }
}

async function playtested(userId: number, dungeonIds: number[]): Promise<boolean> {
  if (!dungeonIds.length) return false;
  try {
    const [row] = await db.select({ n: sql<number>`count(*)` }).from(dungeonRuns)
      .where(and(eq(dungeonRuns.userId, userId), inArray(dungeonRuns.dungeonId, dungeonIds)));
    return Number(row?.n ?? 0) > 0;
  } catch { return false; }
}

async function status(userId: number) {
  const rows = await progressRows(userId);
  const byStep = new Map(rows.map((r) => [r.stepId, r]));
  const dungeons = ((byStep.get("five_room")?.data as any)?.dungeonIds ?? []) as number[];
  // Steps that complete themselves
  if (!byStep.get("five_room")?.completedAt && (await playtested(userId, dungeons))) {
    await saveStep(userId, "five_room", byStep.get("five_room")?.data ?? {}, true);
  }
  const ran = await gamesRun(userId);
  if (ran > 0 && !byStep.get("run_a_game")?.completedAt) await saveStep(userId, "run_a_game", { campaigns: ran }, true);
  const fresh = new Map((await progressRows(userId)).map((r) => [r.stepId, r]));
  return { byStep: fresh, gamesRun: ran, dungeonIds: dungeons };
}

async function myDungeons(ids: number[]) {
  if (!ids.length) return [];
  try {
    return (await db.select().from(dungeonDefinitions).where(inArray(dungeonDefinitions.id, ids)))
      .map((d) => ({ id: d.id, name: d.name, description: d.description, themeTags: d.themeTags }));
  } catch { return []; }
}

const bad = (res: Response, error: string) => res.status(400).json({ error });

export function registerDmPathRoutes(app: Express) {
  app.get("/api/dm-path", async (req, res) => {
    const userId = uid(req, res); if (!userId) return;
    try {
      const { byStep, gamesRun: ran, dungeonIds } = await status(userId);
      const ownCampaigns = await db.select({ id: campaigns.id, title: campaigns.title }).from(campaigns).where(eq(campaigns.userId, userId)).catch(() => []);
      res.json({
        steps: DM_STEPS.map((s) => ({ ...s, done: !!byStep.get(s.id)?.completedAt, data: byStep.get(s.id)?.data ?? null })),
        doneCount: DM_STEPS.filter((s) => byStep.get(s.id)?.completedAt).length,
        fairFightGoal: FAIR_FIGHT_GOAL,
        monsters: Object.values(MONSTERS).map((m) => ({ key: m.key, name: m.name, cr: m.cr, xp: m.xp })),
        sessionZeroItems: SESSION_ZERO_ITEMS,
        dungeons: await myDungeons(dungeonIds),
        campaignsAsDm: ownCampaigns,
        gamesRun: ran,
      });
    } catch (err) {
      console.error("[dm-path] load failed:", err);
      res.status(500).json({ error: "Failed to load the DM path" });
    }
  });

  app.post("/api/dm-path/dm_job/complete", async (req, res) => {
    const userId = uid(req, res); if (!userId) return;
    await saveStep(userId, "dm_job", { read: true }, true);
    res.json({ ok: true });
  });

  app.post("/api/dm-path/fair-fight", async (req, res) => {
    const userId = uid(req, res); if (!userId) return;
    const list = Array.isArray(req.body?.monsters) ? req.body.monsters : [];
    const partyLevel = Math.max(1, Math.min(10, Number(req.body?.partyLevel) || FAIR_FIGHT_GOAL.partyLevel));
    const partySize = Math.max(1, Math.min(8, Number(req.body?.partySize) || FAIR_FIGHT_GOAL.partySize));
    const r = rateMonsterList(list.map((m: any) => ({ key: String(m?.key ?? ""), count: Number(m?.count) || 0 })), partyLevel, partySize);
    const goal = partyLevel === FAIR_FIGHT_GOAL.partyLevel && partySize === FAIR_FIGHT_GOAL.partySize && r.rating === FAIR_FIGHT_GOAL.rating;
    if (goal) await saveStep(userId, "fair_fight", { monsters: list, partyLevel, partySize, ...r }, true);
    res.json({ ...r, goalMet: goal });
  });

  app.post("/api/dm-path/npc", async (req, res) => {
    const userId = uid(req, res); if (!userId) return;
    const c = checkNpc(req.body?.npc ?? {});
    if (!c.ok) return res.json({ ok: false, tips: c.tips });
    await saveStep(userId, "npc", c.draft, true);
    let addedTo: string | null = null;
    const campaignId = Number(req.body?.campaignId);
    if (campaignId) {
      const campaign = await storage.getCampaign(campaignId);
      if (campaign && campaign.userId === userId) {
        const ledger = await loadLedger(campaignId, campaign as any);
        const merged = mergeLedgerUpdates(ledger, { cast: [{ name: c.draft.name, role: c.draft.voice, want: c.draft.want, attitudeChange: c.draft.attitude, secretRevealed: undefined }] as any }, {});
        const member = merged.ledger.cast.find((m) => m.name === c.draft.name);
        if (member && !member.secrets.includes(c.draft.secret)) member.secrets.push(c.draft.secret);
        await saveLedger(campaignId, merged.ledger);
        addedTo = (campaign as any).title ?? "your campaign";
      }
    }
    res.json({ ok: true, tips: c.tips, addedTo });
  });

  app.post("/api/dm-path/clues", async (req, res) => {
    const userId = uid(req, res); if (!userId) return;
    const c = checkClues(req.body ?? {});
    if (c.ok) await saveStep(userId, "three_clues", c.draft, true);
    res.json({ ok: c.ok, tips: c.tips });
  });

  app.post("/api/dm-path/five-room/check", async (req, res) => {
    const userId = uid(req, res); if (!userId) return;
    const c = checkFiveRoom(req.body ?? {});
    res.json({ ok: c.ok, tips: c.tips, ratings: c.ratings });
  });

  app.post("/api/dm-path/five-room", async (req, res) => {
    const userId = uid(req, res); if (!userId) return;
    try {
      const c = checkFiveRoom(req.body ?? {});
      if (!c.ok) return res.json({ ok: false, tips: c.tips, ratings: c.ratings });
      const nodes = fiveRoomToNodes(c.draft);
      const def = await storage.createDungeonDefinition({
        name: c.draft.title,
        description: `A five-room dungeon for level ${c.draft.partyLevel} characters, made on Everdice.`,
        themeTags: ["player-made", c.draft.theme],
        recommendedLevelMin: c.draft.partyLevel,
        recommendedLevelMax: c.draft.partyLevel + 1,
        mapWidth: 7, mapHeight: 3,
        mapLayout: nodes.map((n) => ({ q: n.q, r: n.r, nodeId: n.nodeId })),
        nodeTable: nodes,
        rewardProfile: null, completionHooks: null,
        createdAt: new Date().toISOString(),
      } as any);
      const rows = await progressRows(userId);
      const prev = rows.find((r) => r.stepId === "five_room");
      const data = { ...(prev?.data as any ?? {}), dungeonIds: [...(((prev?.data as any)?.dungeonIds ?? []) as number[]), def.id].slice(-10), lastDraft: c.draft };
      await saveStep(userId, "five_room", data, false);
      res.json({ ok: true, tips: c.tips, ratings: c.ratings, dungeonId: def.id });
    } catch (err) {
      console.error("[dm-path] five-room failed:", err);
      res.status(500).json({ error: "Failed to build the dungeon" });
    }
  });

  app.post("/api/dm-path/session-zero", async (req, res) => {
    const userId = uid(req, res); if (!userId) return;
    const valid = new Set(SESSION_ZERO_ITEMS.map((i) => i.id as string));
    const checked = (Array.isArray(req.body?.checked) ? req.body.checked : []).map(String).filter((x: string) => valid.has(x));
    const complete = checked.length === valid.size;
    await saveStep(userId, "session_zero", { checked }, complete);
    res.json({ ok: complete, checked });
  });

  app.post("/api/dm-path/post-oneshot", async (req, res) => {
    const userId = uid(req, res); if (!userId) return;
    try {
      const rows = await progressRows(userId);
      const mine = (((rows.find((r) => r.stepId === "five_room")?.data as any)?.dungeonIds ?? []) as number[]);
      const id = Number(req.body?.dungeonId);
      if (!mine.includes(id)) return bad(res, "That's not one of your dungeons.");
      const [def] = await db.select().from(dungeonDefinitions).where(eq(dungeonDefinitions.id, id));
      if (!def) return bad(res, "Dungeon not found.");
      const nodes = (def.nodeTable as any[]) ?? [];
      const rooms = nodes.filter((n) => n.type !== "entrance").map((n) => n.name).filter(Boolean);
      const [prefs] = await db.select().from(playPreferences).where(eq(playPreferences.userId, userId)).catch(() => [] as any[]);
      const slots = (prefs?.slots as string[] | undefined)?.join(", ");
      const post = await storage.createBulletinPost({
        userId,
        title: `One-shot: ${def.name}`,
        message: `I'm running my own five-room dungeon as a one-shot, for level ${def.recommendedLevelMin} characters. Rooms: ${rooms.join(", ")}. New players welcome; it's one of my first games as a DM.`,
        postType: "lfg",
        gameSystem: "D&D 5e",
        playersNeeded: Math.max(1, Math.min(5, Number(req.body?.playersNeeded) || 3)),
        experienceLevel: "beginner",
        playStyle: "mixed",
        preferredTime: slots || null,
        sessionDuration: "2-3 hours",
        isOngoing: false,
        isActive: true,
      } as any);
      res.json({ ok: true, postId: post.id });
    } catch (err) {
      console.error("[dm-path] post-oneshot failed:", err);
      res.status(500).json({ error: "Failed to post the one-shot" });
    }
  });

  app.get("/api/dm-path/nudges", async (req, res) => {
    const userId = uid(req, res); if (!userId) return;
    try {
      const { byStep, gamesRun: ran } = await status(userId);
      const chars = await storage.getCharactersByUserId(userId);
      const seen = await db.select().from(userRulesSeen).where(eq(userRulesSeen.userId, userId)).catch(() => [] as any[]);
      const seenSet = new Set(seen.map((s: any) => s.ruleId));
      const trails = await db.select({ n: sql<number>`count(*)` }).from(wanderThreads)
        .where(and(eq(wanderThreads.userId, userId), eq(wanderThreads.status, "resolved"))).catch(() => [{ n: 0 }]);
      const [prefs] = await db.select().from(playPreferences).where(eq(playPreferences.userId, userId)).catch(() => [] as any[]);
      const all = nudgesFor({
        maxCharacterLevel: Math.max(0, ...chars.map((c) => c.level || 1)),
        lessonsLearned: LESSONS.filter((l) => l.ruleIds.some((r) => seenSet.has(r))).length,
        trailsResolved: Number(trails[0]?.n ?? 0),
        dmStepsDone: DM_STEPS.filter((s) => byStep.get(s.id)?.completedAt).map((s) => s.id as DmStepId),
        hasRunGame: ran > 0,
        openToPlay: !!prefs?.open,
      });
      res.json({ nudges: all.filter((n) => !byStep.has(`nudge:${n.id}`)) });
    } catch (err) {
      console.error("[dm-path] nudges failed:", err);
      res.json({ nudges: [] });
    }
  });

  app.post("/api/dm-path/nudges/:id/dismiss", async (req, res) => {
    const userId = uid(req, res); if (!userId) return;
    await saveStep(userId, `nudge:${String(req.params.id).slice(0, 40)}`, { dismissed: true }, true);
    res.json({ ok: true });
  });

  // ── play together ──────────────────────────────────────────────────────────

  app.get("/api/play-together", async (req, res) => {
    const userId = uid(req, res); if (!userId) return;
    try {
      const [mine] = await db.select().from(playPreferences).where(eq(playPreferences.userId, userId)).catch(() => [] as any[]);
      const me = mine ?? { open: false, role: "player", timezone: null, slots: [], styles: [] };
      let matches: any[] = [];
      if (me.open) {
        // Only people who opted in, active in the last 60 days, sharing at least one time slot.
        const cutoff = new Date(Date.now() - 60 * 86400_000).toISOString();
        const others = await db.select({ p: playPreferences, username: users.username }).from(playPreferences)
          .innerJoin(users, eq(users.id, playPreferences.userId))
          .where(and(eq(playPreferences.open, true), ne(playPreferences.userId, userId), sql`${playPreferences.updatedAt} >= ${cutoff}`))
          .limit(200);
        const mySlots = new Set((me.slots as string[]) ?? []);
        const scored = others.map((o) => {
          const slots = ((o.p.slots as string[]) ?? []);
          const overlap = slots.filter((s) => mySlots.has(s));
          const complement = (me.role === "dm" && o.p.role !== "dm") || (me.role !== "dm" && o.p.role !== "player") ? 1 : 0;
          return { o, overlap, score: overlap.length * 2 + complement };
        }).filter((x) => x.overlap.length > 0).sort((a, b) => b.score - a.score).slice(0, 20);
        const ids = scored.map((x) => x.o.p.userId);
        const levels = ids.length ? await db.select({ userId: characters.userId, lvl: sql<number>`max(${characters.level})` }).from(characters).where(inArray(characters.userId, ids)).groupBy(characters.userId) : [];
        const posts = ids.length ? await db.select({ id: bulletinPosts.id, userId: bulletinPosts.userId, title: bulletinPosts.title }).from(bulletinPosts)
          .where(and(inArray(bulletinPosts.userId, ids), eq(bulletinPosts.isActive, true), sql`${bulletinPosts.deletedAt} IS NULL`)).orderBy(desc(bulletinPosts.id)) : [];
        matches = scored.map(({ o, overlap }) => ({
          username: o.username,
          role: o.p.role,
          timezone: o.p.timezone,
          sharedSlots: overlap,
          styles: o.p.styles,
          level: Number(levels.find((l) => l.userId === o.p.userId)?.lvl ?? 0) || null,
          post: posts.find((p) => p.userId === o.p.userId) ?? null,
        }));
      }
      res.json({ prefs: me, matches, options: { slots: PLAY_SLOTS, roles: PLAY_ROLES, styles: PLAY_STYLES } });
    } catch (err) {
      warn("play-together", err);
      res.json({ prefs: { open: false, role: "player", timezone: null, slots: [], styles: [] }, matches: [], options: { slots: PLAY_SLOTS, roles: PLAY_ROLES, styles: PLAY_STYLES } });
    }
  });

  app.put("/api/play-together", async (req, res) => {
    const userId = uid(req, res); if (!userId) return;
    const b = req.body ?? {};
    const slots = (Array.isArray(b.slots) ? b.slots : []).filter((s: string) => (PLAY_SLOTS as readonly string[]).includes(s));
    const styles = (Array.isArray(b.styles) ? b.styles : []).filter((s: string) => (PLAY_STYLES as readonly string[]).includes(s));
    const role = (PLAY_ROLES as readonly string[]).includes(b.role) ? b.role : "player";
    const timezone = typeof b.timezone === "string" ? b.timezone.slice(0, 60) : null;
    const open = !!b.open;
    try {
      const values = { userId, open, role, timezone, slots: slots as any, styles: styles as any, updatedAt: new Date().toISOString() };
      await db.insert(playPreferences).values(values).onConflictDoUpdate({ target: playPreferences.userId, set: values });
      res.json({ ok: true });
    } catch (err) {
      warn("play-together save", err);
      res.status(503).json({ error: "Couldn't save your preferences yet." });
    }
  });
}

/** Dungeons this player designed on the DM path, for their Delve list. */
export async function playerMadeDungeons(userId: number) {
  try {
    const [row] = await db.select().from(dmPathProgress).where(and(eq(dmPathProgress.userId, userId), eq(dmPathProgress.stepId, "five_room")));
    const ids = (((row?.data as any)?.dungeonIds ?? []) as number[]);
    return (await myDungeons(ids)).reverse().map((d: any) => ({ ...d, recommendedLevelMin: 1, recommendedLevelMax: 10, madeByYou: true }));
  } catch { return []; }
}
