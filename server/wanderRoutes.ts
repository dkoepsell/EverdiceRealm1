import { Router, Request, Response } from "express";
import { storage } from "./storage";
import {
  rollOutcome, calculateDangerRating, resolveChoice,
  generateWanderSummary, mapBiomeFromTerrain, CuratedOutcome
} from "./wanderEngine";

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

      const newTick = run.tick + 1;
      const newFatigue = run.fatigue + 1;
      const biome = mapBiomeFromTerrain(terrainType || "grass");

      const dangerRating = calculateDangerRating({
        biome,
        proximityToLairs: 0,
        ticksSinceRest: newTick,
        partyLevel: 3,
        isHot: false,
      });

      const outcome = rollOutcome({
        biome,
        dangerRating,
        lastOutcomeType: run.lastOutcomeType,
        tick: newTick,
      });

      const updatedRun = await storage.updateWanderRun(runId, {
        currentHexQ: toHexQ,
        currentHexR: toHexR,
        tick: newTick,
        fatigue: newFatigue,
        lastOutcomeType: outcome.type,
      });

      await storage.createWanderOutcome({
        runId,
        tick: newTick,
        fromHexQ: run.currentHexQ,
        fromHexR: run.currentHexR,
        toHexQ,
        toHexR,
        outcomeType: outcome.type,
        outcomePayload: outcome as any,
        createdAt: new Date().toISOString(),
      });

      await storage.upsertHexExplorationState({
        userId,
        campaignId: run.campaignId,
        hexQ: toHexQ,
        hexR: toHexR,
        state: "seen",
        discoveredAt: new Date().toISOString(),
        lastVisitedAt: new Date().toISOString(),
      });

      res.json({ run: updatedRun, outcome, dangerRating });
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

      const outcome = outcomeData as CuratedOutcome;
      const choiceObj = outcome.choices?.find(c => c.id === choiceId);
      if (!choiceObj) {
        return res.status(400).json({ error: "Invalid choice ID for this outcome" });
      }

      const resolution = resolveChoice({
        intentTag: choiceObj.intentTag,
        outcome,
        characterLevel: 3,
        fatigue: run.fatigue,
        choiceId,
      });

      let markerCreated = false;
      if (resolution.markerToCreate) {
        await storage.createWanderMarker({
          campaignId: run.campaignId,
          hexQ: run.currentHexQ,
          hexR: run.currentHexR,
          markerType: resolution.markerToCreate.type,
          title: resolution.markerToCreate.title,
          blurb: resolution.markerToCreate.blurb,
          tags: resolution.markerToCreate.tags,
          discoveredBy: userId,
          persistence: "permanent",
          createdAt: new Date().toISOString(),
        });
        markerCreated = true;

        await storage.upsertHexExplorationState({
          userId,
          campaignId: run.campaignId,
          hexQ: run.currentHexQ,
          hexR: run.currentHexR,
          state: "noted",
          lastVisitedAt: new Date().toISOString(),
        });
      }

      const newFatigue = Math.max(0, run.fatigue + resolution.fatigueChange);
      await storage.updateWanderRun(runId, {
        fatigue: newFatigue,
      });

      let combatSeed = undefined;
      if (resolution.combatTriggered && resolution.combatSeed) {
        combatSeed = resolution.combatSeed;
      }

      res.json({
        resolution,
        markerCreated,
        combatTriggered: resolution.combatTriggered,
        combatSeed,
      });
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

      res.json({ summary, run: updatedRun });
    } catch (error: any) {
      console.error("Error ending wander run:", error);
      res.status(500).json({ error: "Failed to end wander run" });
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
