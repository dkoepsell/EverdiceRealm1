/**
 * Between-campaign surfaces (engagement spec Phase 6):
 *   GET  /api/engagement/flags                 global flags (defaults + ENGAGEMENT_FLAGS_ON)
 *   GET  /api/learning-path                    lessons with learned/next/locked + a one-shot payload
 *   POST /api/learning-path/:lessonId/skip     mark a lesson as skipped
 *   POST /api/characters/:id/legend            keep reputation + one recurring NPC from a finished campaign
 *   POST /api/characters/:id/downtime-hook     research / carousing / training that seeds the next adventure
 */
import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../../db";
import { storage } from "../../storage";
import { userRulesSeen, type Character } from "@shared/schema";
import { ENGAGEMENT_FLAGS, allFlagsOn, globalFlags, resolveFlags } from "@shared/engagementFlags";
import { isStaff } from "../../auth";
import { LESSONS, learningProgress, lessonById } from "@shared/rules/learningPath";
import { reputationOf } from "@shared/ledger";
import { rulesSeenFor } from "../rules/rulesSeen";
import { loadLedger } from "../ledger/store";
import { readLegend, type Legend } from "./legend";
import { HOOK_ACTIVITIES, type HookActivity, runHookActivity } from "./downtime";

const SKIP_PREFIX = "lesson_skip:";

function userOf(req: Request, res: Response): number | null {
  if (!req.isAuthenticated?.() || !req.user) {
    res.status(401).json({ message: "Not authenticated" });
    return null;
  }
  return (req.user as any).id as number;
}

async function ownCharacter(req: Request, res: Response, userId: number): Promise<Character | null> {
  const c = await storage.getCharacter(Number(req.params.id));
  if (!c || c.userId !== userId) {
    res.status(404).json({ message: "Character not found" });
    return null;
  }
  return c;
}

export function registerBetweenRoutes(app: Express) {
  // Per-campaign engagement flags: GET to read the resolved set, PATCH { flag: boolean, ... }
  // to switch phases on for one table (the campaign owner, or staff).
  app.get("/api/campaigns/:campaignId/engagement-flags", async (req, res) => {
    const userId = userOf(req, res);
    if (userId == null) return;
    const campaign = await storage.getCampaign(Number(req.params.campaignId));
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    res.json({ flags: resolveFlags(campaign), override: campaign.engagementFlags ?? null });
  });

  app.patch("/api/campaigns/:campaignId/engagement-flags", async (req, res) => {
    const userId = userOf(req, res);
    if (userId == null) return;
    const campaign = await storage.getCampaign(Number(req.params.campaignId));
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.userId !== userId && !isStaff(req.user)) return res.status(403).json({ message: "Only the campaign's owner can change this." });
    const current = (campaign.engagementFlags && typeof campaign.engagementFlags === "object" ? campaign.engagementFlags : {}) as Record<string, unknown>;
    const next: Record<string, unknown> = { ...current };
    for (const [k, v] of Object.entries(req.body ?? {})) {
      if (k in ENGAGEMENT_FLAGS && typeof v === "boolean") next[k] = v;
    }
    const updated = await storage.updateCampaign(campaign.id, { engagementFlags: next } as any);
    res.json({ flags: resolveFlags(updated ?? { engagementFlags: next }), override: next });
  });

  app.get("/api/engagement/flags", (_req, res) => {
    res.json(globalFlags(process.env.ENGAGEMENT_FLAGS_ON));
  });

  app.get("/api/learning-path", async (req, res) => {
    const userId = userOf(req, res);
    if (userId == null) return;
    const rows = await rulesSeenFor(userId);
    const seen = new Set(rows.filter((r) => !r.ruleId.startsWith(SKIP_PREFIX)).map((r) => r.ruleId));
    const skipped = new Set(rows.filter((r) => r.ruleId.startsWith(SKIP_PREFIX)).map((r) => r.ruleId.slice(SKIP_PREFIX.length)));
    const progress = learningProgress(seen, skipped);
    res.json({
      learned: progress.filter((p) => p.learned).length,
      total: LESSONS.length,
      lessons: progress.map((p) => ({
        id: p.lesson.id,
        title: p.lesson.title,
        pitch: p.lesson.pitch,
        minutes: p.lesson.minutes,
        state: p.state,
        skipped: skipped.has(p.lesson.id),
        // POST this to /api/campaigns (with a characterId) to start the lesson one-shot.
        campaign: {
          title: `Lesson: ${p.lesson.title}`,
          description: p.lesson.hook,
          mainHook: p.lesson.hook,
          difficulty: "balanced",
          narrativeStyle: "descriptive",
          campaignLength: "one_shot",
          engagementFlags: { ...allFlagsOn(), lesson: p.lesson.id },
        },
      })),
    });
  });

  app.post("/api/learning-path/:lessonId/skip", async (req, res) => {
    const userId = userOf(req, res);
    if (userId == null) return;
    const lesson = lessonById(req.params.lessonId);
    if (!lesson) return res.status(404).json({ message: "No such lesson" });
    try {
      await db.insert(userRulesSeen).values({ userId, ruleId: `${SKIP_PREFIX}${lesson.id}`, count: 1 })
        .onConflictDoUpdate({ target: [userRulesSeen.userId, userRulesSeen.ruleId], set: { count: sql`${userRulesSeen.count}` } });
      res.json({ ok: true });
    } catch (err) {
      console.error("[learning-path] skip failed:", err);
      res.status(500).json({ message: "Couldn't skip the lesson" });
    }
  });

  app.post("/api/characters/:id/legend", async (req, res) => {
    const userId = userOf(req, res);
    if (userId == null) return;
    const character = await ownCharacter(req, res, userId);
    if (!character) return;
    const campaignId = Number(req.body?.campaignId);
    const campaign = Number.isInteger(campaignId) ? await storage.getCampaign(campaignId) : undefined;
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    const ledger = await loadLedger(campaignId, campaign as any);
    const npcName = typeof req.body?.npcName === "string" ? req.body.npcName : null;
    const npc = npcName ? ledger.cast.find((c) => c.name === npcName && c.status === "alive") : null;
    if (npcName && !npc) return res.status(400).json({ message: "That person isn't someone you can meet again." });
    const legend: Legend = {
      reputation: reputationOf(ledger.deeds)?.tag ?? null,
      recurringNpc: npc ? { name: npc.name, role: npc.role, want: npc.want, attitude: npc.attitude } : null,
      fromCampaign: campaign.title,
    };
    const d = (character.downtimeState && typeof character.downtimeState === "object" ? character.downtimeState : {}) as Record<string, unknown>;
    await storage.updateCharacter(character.id, { downtimeState: { ...d, legend } } as Partial<Character>);
    res.json({ legend });
  });

  app.post("/api/characters/:id/downtime-hook", async (req, res) => {
    const userId = userOf(req, res);
    if (userId == null) return;
    if (!globalFlags(process.env.ENGAGEMENT_FLAGS_ON).downtime) return res.status(409).json({ message: "Downtime activities aren't enabled." });
    const character = await ownCharacter(req, res, userId);
    if (!character) return;
    const activity = req.body?.activity as HookActivity;
    if (!HOOK_ACTIVITIES[activity]) return res.status(400).json({ message: "Unknown activity" });
    const engagement = await storage.getCharacterEngagement(character.id);
    if (engagement) return res.status(409).json({ message: `${character.name} is ${engagement.label}. Return to town first.` });
    const d = (character.downtimeState && typeof character.downtimeState === "object" ? character.downtimeState : {}) as Record<string, any>;
    const cooldownKey = `hook_${activity}`;
    const until = d[cooldownKey] ? Date.parse(d[cooldownKey]) : 0;
    if (until > Date.now()) return res.status(429).json({ message: "You've done this recently. Try again tomorrow.", cooldownUntil: d[cooldownKey] });

    const r = runHookActivity(activity, character);
    const { hooks } = readLegend(d);
    const next: Record<string, any> = {
      ...d,
      [cooldownKey]: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
      hooks: r.hook ? [...hooks, r.hook].slice(-10) : hooks,
    };
    const updates: Partial<Character> = {};
    if (r.trainingProgress) {
      if (r.trainingProgress.sessions >= 5) {
        delete next.training;
        const key = r.trainingProgress.name.toLowerCase().replace(/[^a-z]+/g, "_").replace(/_+$/, "");
        updates.skills = Array.from(new Set([...(character.skills ?? []), key]));
      } else {
        next.training = r.trainingProgress;
      }
    }
    await storage.updateCharacter(character.id, { ...updates, downtimeState: next } as Partial<Character>);
    res.json({ ...r, cooldownUntil: next[cooldownKey] });
  });
}
