/**
 * Journal API (engagement spec 3.4):
 *   GET /api/campaigns/:campaignId/ledger → people, threads, reputation, recap,
 *       and the requesting player's Rules Learned.
 */
import type { Express } from "express";
import { storage } from "../../storage";
import { attitudeLabel, reputationOf } from "@shared/ledger";
import { RULE_EXPLAINERS } from "@shared/rules/ruleExplainers";
import { loadLedger } from "./store";
import { buildRecap } from "./callbacks";
import { rulesSeenFor } from "../rules/rulesSeen";

export function registerLedgerRoutes(app: Express) {
  app.get("/api/campaigns/:campaignId/ledger", async (req, res) => {
    try {
      if (!req.isAuthenticated?.() || !req.user) return res.status(401).json({ message: "Not authenticated" });
      const userId = (req.user as any).id as number;
      const campaignId = Number(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      const participants = await storage.getCampaignParticipants(campaignId);
      if (campaign.userId !== userId && !participants.some((p: any) => p.userId === userId)) {
        return res.status(403).json({ message: "Not in this campaign" });
      }
      const ledger = await loadLedger(campaignId, campaign as any);
      const rules = (await rulesSeenFor(userId))
        .filter((r) => RULE_EXPLAINERS[r.ruleId])
        .map((r) => ({ id: r.ruleId, name: RULE_EXPLAINERS[r.ruleId].name, count: r.count, firstSeenAt: r.firstSeenAt }))
        .sort((a, b) => b.count - a.count);
      res.json({
        turn: ledger.turn,
        people: ledger.cast
          .filter((c) => c.timesMet > 0)
          .sort((a, b) => b.lastSeenTurn - a.lastSeenTurn)
          .map((c) => ({ ...c, attitudeLabel: attitudeLabel(c.attitude), secrets: undefined })),
        threads: ledger.threads.filter((t) => t.status === "open").sort((a, b) => b.heat - a.heat),
        resolvedThreads: ledger.threads.filter((t) => t.status === "resolved").slice(-5),
        reputation: reputationOf(ledger.deeds),
        deeds: ledger.deeds.slice(-10),
        itemsOfNote: ledger.itemsOfNote,
        recap: buildRecap(ledger),
        rulesLearned: rules,
        rulesTotal: Object.keys(RULE_EXPLAINERS).length,
      });
    } catch (err) {
      console.error("[ledger] read failed:", err);
      res.status(500).json({ message: "Failed to load the journal" });
    }
  });
}
