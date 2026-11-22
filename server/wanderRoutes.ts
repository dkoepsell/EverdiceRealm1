import { Router, Request, Response } from "express";
import { storage } from "./storage";
import { globalFlags } from "@shared/engagementFlags";
import { markSeen, seenIds } from "./play/content/seen";
import {
  rollOutcome, calculateDangerRating, resolveChoice,
  generateWanderSummary, mapBiomeFromTerrain, CuratedOutcome
} from "./wanderEngine";
import { initialRunFlags, leaveRealmSign, nodRealm, roadRumors, wanderCamp, wanderChoose, wanderJournal, wanderMove, wanderShortRest } from "./play/wander/service";

export function registerWanderRoutes(router: Router) {

  router.post("/api/wander/start", async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const userId = (req.user as any).id;
      const { campaignId, characterId, startHexQ, startHexR } = req.body;

      if (!campaignId || !characterId || startHexQ == null || startHexR == null) {
        return res.status(400).json({ error: "Missing required fields: campaignId, characterId, startHexQ, startHexR" });
      }

      const existing = await storage.getActiveWanderRun(userId, campaignId);
      if (existing) {
        return res.status(400).json({ error: "An active wander run already exists for this campaign", existingRunId: existing.id });
      }

      // A character is in one place at a time. The check above is keyed on
      // (userId, campaignId), so it never noticed that this character was
      // already mid-delve or in the field with another party.
      const character = await storage.getCharacter(characterId);
      if (!character || character.userId !== userId) {
        return res.status(404).json({ error: "Character not found" });
      }
      const engagement = await storage.getCharacterEngagement(characterId);
      if (engagement) {
        return res.status(409).json({
          code: "CHARACTER_ENGAGED",
          error: `${character.name} is ${engagement.label}. Return to town before setting out again.`,
          engagement,
        });
      }

      const run = await storage.createWanderRun({
        userId,
        campaignId,
        characterId,
        startHexQ,
        startHexR,
        currentHexQ: startHexQ,
        currentHexR: startHexR,
        tick: 0,
        fatigue: 0,
        status: "active",
        startedAt: new Date().toISOString(),
        // Wander spec B: travel state (clock, weather, food and water) starts with the run.
        flags: (await initialRunFlags(campaignId, characterId)) as any,
      });

      await storage.upsertHexExplorationState({
        userId,
        campaignId,
        hexQ: startHexQ,
        hexR: startHexR,
        state: "seen",
        discoveredAt: new Date().toISOString(),
        lastVisitedAt: new Date().toISOString(),
      });

      // Mark the character as out in the field.
      await storage.setCharacterEngagement(characterId, 'wander', run.id);

      res.json(run);
    } catch (error: any) {
      console.error("Error starting wander run:", error);
      res.status(500).json({ error: "Failed to start wander run" });
    }
  });

  router.post("/api/wander/move", async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const userId = (req.user as any).id;
      const { runId, toHexQ, toHexR, terrainType } = req.body;

      if (!runId || toHexQ == null || toHexR == null) {
        return res.status(400).json({ error: "Missing required fields: runId, toHexQ, toHexR" });
      }

      const run = await storage.getWanderRun(runId);
      if (!run) {
        return res.status(404).json({ error: "Wander run not found" });
      }
      if (run.userId !== userId) {
        return res.status(401).json({ error: "Not authorized to modify this run" });
      }
      if (run.status !== "active") {
        return res.status(400).json({ error: "Wander run is not active" });
      }

      const dq = toHexQ - run.currentHexQ;
      const dr = toHexR - run.currentHexR;
      const hexDistance = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
      if (hexDistance !== 1) {
        return res.status(400).json({ error: "Invalid move: target hex must be adjacent (distance 1)" });
      }

      // Wander spec: the server works out terrain itself (shared/wander/terrain)
      // and applies travel rules, threads, landmarks and checks per campaign flags.
      void terrainType;
      const result = await wanderMove(userId, run, { toHexQ, toHexR, pace: req.body.pace, activity: req.body.activity });
      res.json(result);
    } catch (error: any) {
      console.error("Error moving in wander:", error);
      res.status(500).json({ error: "Failed to process move" });
    }
  });

  router.post("/api/wander/choose", async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const userId = (req.user as any).id;
      const { runId, choiceId, outcomeData } = req.body;

      if (!runId || !choiceId || !outcomeData) {
        return res.status(400).json({ error: "Missing required fields: runId, choiceId, outcomeData" });
      }

      const run = await storage.getWanderRun(runId);
      if (!run) {
        return res.status(404).json({ error: "Wander run not found" });
      }
      if (run.userId !== userId) {
        return res.status(401).json({ error: "Not authorized to modify this run" });
      }

      if (run.status !== "active") {
        return res.status(400).json({ error: "Wander run is not active" });
      }
      const result = await wanderChoose(userId, run, choiceId, outcomeData as CuratedOutcome);
      if ("error" in result) {
        return res.status(400).json({ error: result.error });
      }
      res.json(result);
    } catch (error: any) {
      console.error("Error resolving wander choice:", error);
      res.status(500).json({ error: "Failed to resolve choice" });
    }
  });

  router.post("/api/wander/end", async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const userId = (req.user as any).id;
      const { runId } = req.body;

      if (!runId) {
        return res.status(400).json({ error: "Missing required field: runId" });
      }

      const run = await storage.getWanderRun(runId);
      if (!run) {
        return res.status(404).json({ error: "Wander run not found" });
      }
      if (run.userId !== userId) {
        return res.status(401).json({ error: "Not authorized to end this run" });
      }

      const outcomes = await storage.getWanderOutcomes(runId);
      const markers = await storage.getWanderMarkers(run.campaignId);
      const runMarkerCount = markers.filter(m => m.discoveredBy === userId).length;

      const summary = generateWanderSummary(
        outcomes.map(o => o.outcomePayload),
        run.tick,
        runMarkerCount
      );

      const updatedRun = await storage.updateWanderRun(runId, {
        status: "completed",
        endedAt: new Date().toISOString(),
      });

      // The character is back in town and free to do other things.
      await storage.clearEngagementForTarget('wander', runId);

      res.json({ summary, run: updatedRun });
    } catch (error: any) {
      console.error("Error ending wander run:", error);
      res.status(500).json({ error: "Failed to end wander run" });
    }
  });

  // Wander spec B: make camp for the night (eat, drink, long rest, new weather).
  router.post("/api/wander/camp", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Authentication required" });
      const userId = (req.user as any).id;
      const run = await storage.getWanderRun(req.body?.runId);
      if (!run) return res.status(404).json({ error: "Wander run not found" });
      if (run.userId !== userId) return res.status(401).json({ error: "Not authorized to modify this run" });
      if (run.status !== "active") return res.status(400).json({ error: "Wander run is not active" });
      const result = await wanderCamp(userId, run);
      if ("error" in result) return res.status(409).json({ error: result.error });
      res.json(result);
    } catch (error: any) {
      console.error("Error making camp:", error);
      res.status(500).json({ error: "Failed to make camp" });
    }
  });

  // Short rest: an hour off the road, spending Hit Dice to heal.
  router.post("/api/wander/short-rest", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Authentication required" });
      const userId = (req.user as any).id;
      const run = await storage.getWanderRun(req.body?.runId);
      if (!run) return res.status(404).json({ error: "Wander run not found" });
      if (run.userId !== userId) return res.status(401).json({ error: "Not authorized to modify this run" });
      if (run.status !== "active") return res.status(400).json({ error: "Wander run is not active" });
      const result = await wanderShortRest(userId, run, Number(req.body?.hitDice) || 0);
      if ("error" in result) return res.status(404).json({ error: result.error });
      res.json(result);
    } catch (error: any) {
      console.error("Error taking a short rest:", error);
      res.status(500).json({ error: "Failed to rest" });
    }
  });

  // The shared realm: leave a sign (from the fixed list) at your hex, or nod at someone's.
  router.post("/api/wander/realm-mark", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Authentication required" });
      const userId = (req.user as any).id;
      const run = await storage.getWanderRun(req.body?.runId);
      if (!run) return res.status(404).json({ error: "Wander run not found" });
      if (run.userId !== userId) return res.status(401).json({ error: "Not authorized" });
      if (run.status !== "active") return res.status(400).json({ error: "Wander run is not active" });
      const result = await leaveRealmSign(userId, run, String(req.body?.phrase ?? ""));
      if ("error" in result) return res.status(400).json({ error: result.error });
      res.json(result);
    } catch (error: any) {
      console.error("Error leaving a realm sign:", error);
      res.status(500).json({ error: "Failed to leave a sign" });
    }
  });

  router.post("/api/wander/realm-mark/:id/nod", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Authentication required" });
      res.json(await nodRealm((req.user as any).id, parseInt(req.params.id)));
    } catch (error: any) {
      console.error("Error nodding at a realm sign:", error);
      res.status(500).json({ error: "Failed to nod" });
    }
  });

  // Travel state, landmarks and the thread journal, for resuming a run.
  router.get("/api/wander/journal/:runId", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Authentication required" });
      const userId = (req.user as any).id;
      const run = await storage.getWanderRun(parseInt(req.params.runId));
      if (!run) return res.status(404).json({ error: "Wander run not found" });
      if (run.userId !== userId) return res.status(401).json({ error: "Not authorized" });
      res.json(await wanderJournal(userId, run));
    } catch (error: any) {
      console.error("Error loading wander journal:", error);
      res.status(500).json({ error: "Failed to load journal" });
    }
  });

  // Wander spec D: road rumors, heard in the Tavern, pointing to a place on the Wander map.
  router.get("/api/wander/rumors", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Authentication required" });
      res.json(await roadRumors((req.user as any).id, false));
    } catch (error: any) {
      console.error("Error loading road rumors:", error);
      res.status(500).json({ error: "Failed to load road rumors" });
    }
  });

  router.post("/api/wander/rumors/hear", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Authentication required" });
      res.json(await roadRumors((req.user as any).id, true));
    } catch (error: any) {
      console.error("Error hearing road rumor:", error);
      res.status(500).json({ error: "Failed to hear a rumor" });
    }
  });

  router.get("/api/wander/markers/:campaignId", async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const campaignId = parseInt(req.params.campaignId);
      if (isNaN(campaignId)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
      }

      const markers = await storage.getWanderMarkers(campaignId);
      res.json(markers);
    } catch (error: any) {
      console.error("Error fetching wander markers:", error);
      res.status(500).json({ error: "Failed to fetch markers" });
    }
  });

  router.get("/api/wander/hexes/:campaignId", async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const userId = (req.user as any).id;

      const campaignId = parseInt(req.params.campaignId);
      if (isNaN(campaignId)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
      }

      const hexStates = await storage.getExploredHexes(userId, campaignId);
      res.json(hexStates);
    } catch (error: any) {
      console.error("Error fetching explored hexes:", error);
      res.status(500).json({ error: "Failed to fetch explored hexes" });
    }
  });

  router.get("/api/wander/active/:campaignId", async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const userId = (req.user as any).id;

      const campaignId = parseInt(req.params.campaignId);
      if (isNaN(campaignId)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
      }

      const run = await storage.getActiveWanderRun(userId, campaignId);
      res.json(run || null);
    } catch (error: any) {
      console.error("Error fetching active wander run:", error);
      res.status(500).json({ error: "Failed to fetch active wander run" });
    }
  });
}
