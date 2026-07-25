import { Router, Request, Response } from "express";
import { storage } from "./storage";
import {
  generateProceduralDungeon, revealAdjacentNodes, canMoveTo, resolveNodeEntry,
  resolveAction, consumeResources, restInSafeRoom, processRetreat,
  generateDelveSummary, getChestOptions, DungeonNode
} from "./delveEngine";

export function registerDelveRoutes(router: Router) {

  router.get("/api/delve/dungeons", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });

      res.json([{
        id: -1,
        name: "Enter the Depths",
        description: "Descend into a procedurally generated dungeon. Every delve carves a unique layout of traps, puzzles, encounters, and a fearsome boss. No two runs are the same.",
        themeTags: ["procedural", "dungeon", "adventure"],
        recommendedLevelMin: 1,
        recommendedLevelMax: 3,
      }]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/api/delve/start", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userId = (req.user as any).id;
      const { campaignId, characterId, dungeonId } = req.body;

      if (!campaignId || !characterId || dungeonId === undefined) {
        return res.status(400).json({ error: "campaignId, characterId, and dungeonId are required" });
      }

      const existingRun = await storage.getActiveDungeonRun(userId, campaignId);
      if (existingRun) {
        return res.status(409).json({ error: "An active dungeon run already exists for this campaign", run: existingRun });
      }

      // A character is in one place at a time. The check above is keyed on
      // (userId, campaignId), so it never noticed this character was already
      // wandering or in the field with another party.
      const character = await storage.getCharacter(characterId);
      if (!character || character.userId !== userId) {
        return res.status(404).json({ error: "Character not found" });
      }
      const engagement = await storage.getCharacterEngagement(characterId);
      if (engagement) {
        return res.status(409).json({
          code: "CHARACTER_ENGAGED",
          error: `${character.name} is ${engagement.label}. Return to town before delving.`,
          engagement,
        });
      }

      const dungeonNodes = generateProceduralDungeon('goblin');

      const DUNGEON_PREFIXES = [
        "The Sunken", "The Forsaken", "The Shattered", "The Burning", "The Frozen",
        "The Rotting", "The Howling", "The Silent", "The Cursed", "The Forgotten",
        "The Writhing", "The Blighted", "The Dread", "The Iron", "The Bone",
      ];
      const DUNGEON_NOUNS = [
        "Warren", "Catacombs", "Tunnels", "Depths", "Hollows",
        "Burrow", "Undercroft", "Labyrinth", "Passages", "Caverns",
        "Lair", "Den", "Pit", "Vault", "Warrens",
      ];
      const prefix = DUNGEON_PREFIXES[Math.floor(Math.random() * DUNGEON_PREFIXES.length)];
      const noun = DUNGEON_NOUNS[Math.floor(Math.random() * DUNGEON_NOUNS.length)];
      const dungeonName = `${prefix} ${noun}`;

      const dungeonDef = await storage.createDungeonDefinition({
        name: dungeonName,
        description: `A procedurally generated dungeon: ${dungeonName}. Each delve is different.`,
        themeTags: ["procedural", "dungeon", "adventure"],
        recommendedLevelMin: 1,
        recommendedLevelMax: 3,
        mapWidth: 9,
        mapHeight: 9,
        mapLayout: dungeonNodes.map(n => ({ q: n.q, r: n.r, nodeId: n.nodeId })),
        nodeTable: dungeonNodes,
        rewardProfile: null,
        completionHooks: null,
        createdAt: new Date().toISOString(),
      });

      const actualDungeonId = dungeonDef.id;

      const entranceNode = dungeonNodes.find(n => n.type === "entrance");
      if (!entranceNode) {
        return res.status(500).json({ error: "Dungeon has no entrance node" });
      }

      const initialRevealed = revealAdjacentNodes({ q: entranceNode.q, r: entranceNode.r }, dungeonNodes);

      const run = await storage.createDungeonRun({
        userId,
        campaignId,
        characterId,
        dungeonId: actualDungeonId,
        currentQ: entranceNode.q,
        currentR: entranceNode.r,
        revealedCoords: initialRevealed,
        clearedNodes: [],
        disarmedTraps: [],
        solvedPuzzles: [],
        lightTicks: 20,
        supplies: 10,
        status: "active",
        flags: null,
        startedAt: new Date().toISOString(),
        endedAt: null,
      });

      await storage.upsertDungeonNodeState(run.id, entranceNode.nodeId, { state: "revealed" });
      for (const coord of initialRevealed) {
        const node = dungeonNodes.find(n => n.q === coord.q && n.r === coord.r);
        if (node && node.nodeId !== entranceNode.nodeId) {
          await storage.upsertDungeonNodeState(run.id, node.nodeId, { state: "hidden" });
        }
      }

      const revealedNodes = dungeonNodes.filter(n =>
        initialRevealed.some(c => c.q === n.q && c.r === n.r)
      );

      // Mark the character as underground.
      await storage.setCharacterEngagement(characterId, 'delve', run.id);

      res.json({ run, revealedNodes, currentNode: entranceNode });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/api/delve/move", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userId = (req.user as any).id;
      const { runId, toQ, toR } = req.body;

      if (!runId || toQ === undefined || toR === undefined) {
        return res.status(400).json({ error: "runId, toQ, and toR are required" });
      }

      const run = await storage.getDungeonRun(runId);
      if (!run) return res.status(404).json({ error: "Dungeon run not found" });
      if (run.userId !== userId) return res.status(403).json({ error: "Not your dungeon run" });
      if (run.status !== "active") return res.status(400).json({ error: "Dungeon run is not active" });

      const dungeon = await storage.getDungeonDefinition(run.dungeonId);
      if (!dungeon) return res.status(404).json({ error: "Dungeon definition not found" });
      const dungeonNodes = dungeon.nodeTable as DungeonNode[];

      const currentNode = dungeonNodes.find(n => n.q === run.currentQ && n.r === run.currentR);
      if (!currentNode) return res.status(500).json({ error: "Current node not found in dungeon" });

      const targetNode = dungeonNodes.find(n => n.q === toQ && n.r === toR);
      if (!targetNode) return res.status(400).json({ error: "Target node does not exist" });

      const moveCheck = canMoveTo(
        currentNode,
        targetNode.nodeId,
        (run.clearedNodes as string[]) || [],
        dungeonNodes
      );
      if (!moveCheck.allowed) {
        return res.status(400).json({ error: moveCheck.reason });
      }

      const resources = consumeResources("move", run.lightTicks, run.supplies);

      const newRevealed = revealAdjacentNodes({ q: toQ, r: toR }, dungeonNodes);
      const existingRevealed = (run.revealedCoords as Array<{ q: number; r: number }>) || [];
      const mergedRevealed = [...existingRevealed];
      for (const coord of newRevealed) {
        if (!mergedRevealed.some(c => c.q === coord.q && c.r === coord.r)) {
          mergedRevealed.push(coord);
        }
      }

      const nodeResolution = resolveNodeEntry(targetNode, {
        clearedNodes: (run.clearedNodes as string[]) || [],
        disarmedTraps: (run.disarmedTraps as string[]) || [],
        solvedPuzzles: (run.solvedPuzzles as string[]) || [],
      });

      const updatedRun = await storage.updateDungeonRun(run.id, {
        currentQ: toQ,
        currentR: toR,
        revealedCoords: mergedRevealed,
        lightTicks: resources.lightTicks,
        supplies: resources.supplies,
      });

      for (const coord of newRevealed) {
        const node = dungeonNodes.find(n => n.q === coord.q && n.r === coord.r);
        if (node) {
          await storage.upsertDungeonNodeState(run.id, node.nodeId, { state: "revealed" });
        }
      }

      const revealedNodes = dungeonNodes.filter(n =>
        newRevealed.some(c => c.q === n.q && c.r === n.r)
      );

      res.json({
        run: updatedRun,
        nodeResolution,
        revealedNodes,
        resourceWarnings: resources.warnings,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/api/delve/action", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userId = (req.user as any).id;
      const { runId, nodeId, optionId, diceRoll: providedRoll } = req.body;

      if (!runId || !nodeId || !optionId) {
        return res.status(400).json({ error: "runId, nodeId, and optionId are required" });
      }

      const run = await storage.getDungeonRun(runId);
      if (!run) return res.status(404).json({ error: "Dungeon run not found" });
      if (run.userId !== userId) return res.status(403).json({ error: "Not your dungeon run" });
      if (run.status !== "active") return res.status(400).json({ error: "Dungeon run is not active" });

      const dungeon = await storage.getDungeonDefinition(run.dungeonId);
      if (!dungeon) return res.status(404).json({ error: "Dungeon definition not found" });
      const dungeonNodes = dungeon.nodeTable as DungeonNode[];

      const node = dungeonNodes.find(n => n.nodeId === nodeId);
      if (!node) return res.status(404).json({ error: "Node not found in dungeon" });

      if (node.type === "chest") {
        const chestOptions = getChestOptions(run.dungeonId, 1);
        const chosen = chestOptions.find(o => o.id === optionId);
        if (!chosen) return res.status(400).json({ error: "Invalid chest option" });

        const clearedNodes = [...((run.clearedNodes as string[]) || [])];
        if (!clearedNodes.includes(nodeId)) clearedNodes.push(nodeId);

        const updatedRun = await storage.updateDungeonRun(run.id, { clearedNodes });
        const nodeState = await storage.upsertDungeonNodeState(run.id, nodeId, {
          state: "cleared",
          resolutionPayload: chosen,
          lastResolvedAt: new Date().toISOString(),
        });

        return res.json({
          resolution: {
            success: true,
            narrative: `You choose the ${chosen.name}. ${chosen.description}`,
            rewards: chosen.rewards,
            statusEffect: chosen.consequence,
            nodeCleared: true,
            combatTriggered: false,
          },
          run: updatedRun,
          nodeState,
          combatTriggered: false,
          combatData: null,
        });
      }

      const diceRoll = providedRoll ?? Math.floor(Math.random() * 20) + 1;

      const resolution = resolveAction({
        node,
        optionId,
        characterLevel: 1,
        skillModifier: 0,
        diceRoll,
      });

      const clearedNodes = [...((run.clearedNodes as string[]) || [])];
      const disarmedTraps = [...((run.disarmedTraps as string[]) || [])];
      const solvedPuzzles = [...((run.solvedPuzzles as string[]) || [])];

      if (resolution.nodeCleared) {
        if (!clearedNodes.includes(nodeId)) clearedNodes.push(nodeId);
        if (node.type === "trap" && resolution.success) {
          if (!disarmedTraps.includes(nodeId)) disarmedTraps.push(nodeId);
        }
        if (node.type === "puzzle" && resolution.success) {
          if (!solvedPuzzles.includes(nodeId)) solvedPuzzles.push(nodeId);
        }
      }

      const runUpdates: any = { clearedNodes, disarmedTraps, solvedPuzzles };

      if (resolution.combatTriggered) {
        const resources = consumeResources("combat", run.lightTicks, run.supplies);
        runUpdates.lightTicks = resources.lightTicks;
        runUpdates.supplies = resources.supplies;
      }

      const updatedRun = await storage.updateDungeonRun(run.id, runUpdates);

      const nodeState = await storage.upsertDungeonNodeState(run.id, nodeId, {
        state: resolution.nodeCleared ? "cleared" : "revealed",
        resolutionPayload: resolution,
        lastResolvedAt: new Date().toISOString(),
      });

      res.json({
        resolution,
        run: updatedRun,
        nodeState,
        combatTriggered: resolution.combatTriggered,
        combatData: resolution.combatData || null,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/api/delve/chest", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userId = (req.user as any).id;
      const { runId, rewardChoiceId } = req.body;

      if (!runId || !rewardChoiceId) {
        return res.status(400).json({ error: "runId and rewardChoiceId are required" });
      }

      const run = await storage.getDungeonRun(runId);
      if (!run) return res.status(404).json({ error: "Dungeon run not found" });
      if (run.userId !== userId) return res.status(403).json({ error: "Not your dungeon run" });

      const dungeon = await storage.getDungeonDefinition(run.dungeonId);
      if (!dungeon) return res.status(404).json({ error: "Dungeon definition not found" });
      const dungeonNodes = dungeon.nodeTable as DungeonNode[];

      const bossNode = dungeonNodes.find(n => n.type === "boss");
      const clearedNodes = (run.clearedNodes as string[]) || [];
      if (bossNode && !clearedNodes.includes(bossNode.nodeId)) {
        return res.status(400).json({ error: "The boss must be defeated before claiming chest rewards" });
      }

      const chestOptions = getChestOptions(run.dungeonId, 1);
      const selectedReward = chestOptions.find(o => o.id === rewardChoiceId);
      if (!selectedReward) {
        return res.status(400).json({ error: "Invalid reward choice" });
      }

      const goldValue = selectedReward.rewards
        .filter(r => r.type === "gold")
        .reduce((sum, r) => sum + (r.value || 0), 0);
      const xpValue = selectedReward.rewards
        .filter(r => r.type !== "gold" && r.type !== "lore")
        .reduce((sum, r) => sum + (r.value || 0), 0);

      const reward = await storage.createDungeonReward({
        runId: run.id,
        userId,
        characterId: run.characterId,
        itemDrops: selectedReward.rewards.filter(r => r.type !== "gold" && r.type !== "lore"),
        knowledgeDrops: selectedReward.rewards.filter(r => r.type === "lore"),
        unlockDrops: selectedReward.rewards.filter(r => r.type === "quest_item"),
        goldValue,
        xpValue,
        grantedAt: new Date().toISOString(),
      });

      res.json({ reward, consequence: selectedReward.consequence || null });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/api/delve/rest", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userId = (req.user as any).id;
      const { runId } = req.body;

      if (!runId) return res.status(400).json({ error: "runId is required" });

      const run = await storage.getDungeonRun(runId);
      if (!run) return res.status(404).json({ error: "Dungeon run not found" });
      if (run.userId !== userId) return res.status(403).json({ error: "Not your dungeon run" });
      if (run.status !== "active") return res.status(400).json({ error: "Dungeon run is not active" });

      const dungeon = await storage.getDungeonDefinition(run.dungeonId);
      if (!dungeon) return res.status(404).json({ error: "Dungeon definition not found" });
      const dungeonNodes = dungeon.nodeTable as DungeonNode[];

      const currentNode = dungeonNodes.find(n => n.q === run.currentQ && n.r === run.currentR);
      if (!currentNode || currentNode.type !== "safe") {
        return res.status(400).json({ error: "You can only rest in a safe room" });
      }

      const restResult = restInSafeRoom(run.lightTicks, run.supplies, 0);

      const updatedRun = await storage.updateDungeonRun(run.id, {
        lightTicks: restResult.lightTicks,
        supplies: restResult.supplies,
      });

      res.json({ restResult, run: updatedRun });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/api/delve/retreat", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userId = (req.user as any).id;
      const { runId } = req.body;

      if (!runId) return res.status(400).json({ error: "runId is required" });

      const run = await storage.getDungeonRun(runId);
      if (!run) return res.status(404).json({ error: "Dungeon run not found" });
      if (run.userId !== userId) return res.status(403).json({ error: "Not your dungeon run" });
      if (run.status !== "active") return res.status(400).json({ error: "Dungeon run is not active" });

      const dungeon = await storage.getDungeonDefinition(run.dungeonId);
      if (!dungeon) return res.status(404).json({ error: "Dungeon definition not found" });
      const dungeonNodes = dungeon.nodeTable as DungeonNode[];

      const currentNode = dungeonNodes.find(n => n.q === run.currentQ && n.r === run.currentR);
      if (!currentNode) return res.status(500).json({ error: "Current node not found" });

      const retreatResult = processRetreat(currentNode, (run.clearedNodes as string[]) || [], dungeonNodes);

      const updatedRun = await storage.updateDungeonRun(run.id, {
        status: "retreated",
        endedAt: new Date().toISOString(),
      });

      // Back in town — free the character for other activities.
      await storage.clearEngagementForTarget('delve', run.id);

      res.json({
        narrative: retreatResult.narrative,
        respawnedNodes: retreatResult.respawnedNodes,
        run: updatedRun,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/api/delve/end", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userId = (req.user as any).id;
      const { runId } = req.body;

      if (!runId) return res.status(400).json({ error: "runId is required" });

      const run = await storage.getDungeonRun(runId);
      if (!run) return res.status(404).json({ error: "Dungeon run not found" });
      if (run.userId !== userId) return res.status(403).json({ error: "Not your dungeon run" });
      if (run.status !== "active") return res.status(400).json({ error: "Dungeon run is already ended" });

      const dungeon = await storage.getDungeonDefinition(run.dungeonId);
      if (!dungeon) return res.status(404).json({ error: "Dungeon definition not found" });
      const dungeonNodes = dungeon.nodeTable as DungeonNode[];

      const summary = generateDelveSummary({
        clearedNodes: (run.clearedNodes as string[]) || [],
        disarmedTraps: (run.disarmedTraps as string[]) || [],
        solvedPuzzles: (run.solvedPuzzles as string[]) || [],
        lightTicks: run.lightTicks,
        supplies: run.supplies,
        status: run.status,
      }, dungeonNodes);

      const bossDefeated = summary.bossDefeated;
      const updatedRun = await storage.updateDungeonRun(run.id, {
        status: bossDefeated ? "victory" : "ended",
        endedAt: new Date().toISOString(),
      });

      // Back in town — free the character for other activities.
      await storage.clearEngagementForTarget('delve', run.id);

      const rewards = await storage.getDungeonRewards(run.id);

      res.json({ summary, rewards, run: updatedRun });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/api/delve/run/:runId", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userId = (req.user as any).id;
      const runId = parseInt(req.params.runId);

      if (isNaN(runId)) return res.status(400).json({ error: "Invalid runId" });

      const run = await storage.getDungeonRun(runId);
      if (!run) return res.status(404).json({ error: "Dungeon run not found" });
      if (run.userId !== userId) return res.status(403).json({ error: "Not your dungeon run" });

      const nodeStates = await storage.getDungeonNodeStates(runId);
      const rewards = await storage.getDungeonRewards(runId);

      const dungeon = await storage.getDungeonDefinition(run.dungeonId);
      const dungeonNodes = dungeon ? (dungeon.nodeTable as DungeonNode[]) : [];

      const revealedCoords = (run.revealedCoords as Array<{ q: number; r: number }>) || [];
      const revealedNodes = dungeonNodes.filter(n =>
        revealedCoords.some(c => c.q === n.q && c.r === n.r)
      );

      const currentNode = dungeonNodes.find(n => n.q === run.currentQ && n.r === run.currentR);

      res.json({ run, nodeStates, rewards, revealedNodes, currentNode });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/api/delve/active/:campaignId", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userId = (req.user as any).id;
      const campaignId = parseInt(req.params.campaignId);

      if (isNaN(campaignId)) return res.status(400).json({ error: "Invalid campaignId" });

      const run = await storage.getActiveDungeonRun(userId, campaignId);
      res.json({ run: run || null });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
