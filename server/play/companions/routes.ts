/**
 * Friends play companions (table-night spec). The campaign owner hands a
 * companion to anyone seated in the campaign (campaign_npcs.controlled_by);
 * that friend then tells the game what the companion says or does, and in a
 * fight whom they attack or whether they Dodge. The next story turn, whoever
 * takes it, carries it out.
 *
 *   GET  /api/campaigns/:id/companions
 *   POST /api/campaigns/:id/companions/:cnId/controller  { userId | null }   (owner)
 *   POST /api/campaigns/:id/companions/:cnId/intent      { text?, order? }   (controller)
 */
import type { Express } from "express";
import { storage } from "../../storage";
import { moodFromPoints } from "@shared/companionMood";
import { parseBonds, parseIntents } from "./companions";
import { loadCompanions } from "./load";

async function member(req: any, res: any) {
  if (!req.isAuthenticated?.() || !req.user) {
    res.status(401).json({ message: "Not authenticated" });
    return null;
  }
  const userId = req.user.id as number;
  const campaignId = Number(req.params.id);
  const campaign = await storage.getCampaign(campaignId);
  if (!campaign) {
    res.status(404).json({ message: "Campaign not found" });
    return null;
  }
  const participants = await storage.getCampaignParticipants(campaignId);
  if (campaign.userId !== userId && !participants.some((p: any) => p.userId === userId)) {
    res.status(403).json({ message: "Not in this campaign" });
    return null;
  }
  return { userId, campaignId, campaign, participants };
}

export function registerCompanionRoutes(app: Express) {
  app.get("/api/campaigns/:id/companions", async (req, res) => {
    try {
      const m = await member(req, res);
      if (!m) return;
      const companions = await loadCompanions(m.campaignId);
      const session = await storage.getCurrentSession(m.campaignId);
      const state: any = session?.storyState ?? {};
      const bonds = parseBonds(state.companionBonds);
      const intents = parseIntents(state.companionIntents);
      const isOwner = m.campaign.userId === m.userId;
      const seats = isOwner
        ? await Promise.all(m.participants.map(async (p: any) => {
            const u: any = await storage.getUser(p.userId);
            return { userId: p.userId, name: String(u?.displayName || u?.username || `Player ${p.userId}`) };
          }))
        : [];
      res.json({
        isOwner,
        seats,
        inCombat: !!state.inCombat,
        enemies: Array.isArray(state.combatants)
          ? state.combatants.filter((c: any) => (c?.type === "enemy" || c?.type === "boss") && (c.currentHp ?? 1) > 0 && c.status !== "defeated").map((c: any) => c.name)
          : [],
        companions: companions.map((c) => ({
          campaignNpcId: c.campaignNpcId,
          name: c.name,
          race: c.race,
          className: c.className,
          hp: c.hp,
          maxHp: c.maxHp,
          mood: moodFromPoints((bonds[c.name] ?? { points: 3 }).points),
          controlledBy: c.controlledBy ?? null,
          controllerName: c.controllerName ?? null,
          isMine: c.controlledBy === m.userId,
          pending: intents[c.name] ?? null,
        })),
      });
    } catch (err) {
      console.error("[companions] list failed:", err);
      res.status(500).json({ message: "Failed to load companions" });
    }
  });

  app.post("/api/campaigns/:id/companions/:cnId/controller", async (req, res) => {
    try {
      const m = await member(req, res);
      if (!m) return;
      if (m.campaign.userId !== m.userId) return res.status(403).json({ message: "Only the campaign's owner can hand out companions" });
      const cnId = Number(req.params.cnId);
      const row = (await storage.getCampaignNpcs(m.campaignId)).find((cn) => cn.id === cnId);
      if (!row) return res.status(404).json({ message: "Companion not found" });
      const raw = req.body?.userId;
      const userId = raw === null || raw === undefined || raw === "" ? null : Number(raw);
      if (userId !== null && userId !== m.campaign.userId && !m.participants.some((p: any) => p.userId === userId)) {
        return res.status(400).json({ message: "Hand a companion only to someone seated in this campaign" });
      }
      await storage.updateCampaignNpc(cnId, { controlledBy: userId } as any);
      res.json({ ok: true, controlledBy: userId });
    } catch (err) {
      console.error("[companions] controller failed:", err);
      res.status(500).json({ message: "Failed to hand over the companion" });
    }
  });

  app.post("/api/campaigns/:id/companions/:cnId/intent", async (req, res) => {
    try {
      const m = await member(req, res);
      if (!m) return;
      const cnId = Number(req.params.cnId);
      const companions = await loadCompanions(m.campaignId);
      const c = companions.find((x) => x.campaignNpcId === cnId);
      if (!c) return res.status(404).json({ message: "Companion not found" });
      if (c.controlledBy !== m.userId) return res.status(403).json({ message: `You aren't playing ${c.name}` });
      const session = await storage.getCurrentSession(m.campaignId);
      if (!session) return res.status(400).json({ message: "The campaign hasn't started" });
      const state: any = { ...(session.storyState as any ?? {}) };
      const intents = parseIntents(state.companionIntents);
      const text = typeof req.body?.text === "string" ? req.body.text.trim().slice(0, 400) : "";
      const action = req.body?.order?.action;
      const order = action === "attack" || action === "dodge" ? { action, target: typeof req.body.order.target === "string" ? req.body.order.target : undefined } : undefined;
      if (!text && !order) {
        delete intents[c.name];
      } else {
        intents[c.name] = { text: text || intents[c.name]?.text, order: order ?? intents[c.name]?.order, by: c.controllerName ?? "a friend", at: new Date().toISOString() };
      }
      state.companionIntents = intents;
      await storage.updateSessionStoryState(m.campaignId, session.sessionNumber, state);
      res.json({ ok: true, intent: intents[c.name] ?? null });
    } catch (err) {
      console.error("[companions] intent failed:", err);
      res.status(500).json({ message: "Failed to save" });
    }
  });
}
