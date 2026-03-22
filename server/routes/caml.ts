import type { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { isAuthenticated, requireAdmin } from "../auth";
import { z } from "zod";
import { eq, sql, desc, and, gte, isNull, or, asc, inArray } from "drizzle-orm";
import {
  insertUserSchema,
  insertCharacterSchema,
  insertCampaignSchema,
  insertCampaignSessionSchema,
  insertDiceRollSchema,
  insertAdventureCompletionSchema,
  insertCampaignParticipantSchema,
  insertNpcSchema,
  insertCampaignNpcSchema,
  insertCampaignInvitationSchema,
  insertDmNoteSchema,
  insertLocationSchema,
  insertQuestSchema,
  insertMagicItemSchema,
  insertMonsterSchema,
  insertChatMessageSchema,
  insertOnlineUserSchema,
  insertPlayerGroupSchema,
  insertPlayerGroupMemberSchema,
  insertWorldMemorySchema,
  insertUnresolvedThreadSchema,
  insertCharacterArcInsightSchema,
  npcs,
  users,
  campaigns,
  characters,
  locations,
  quests,
  magicItems,
  monsters,
  chatMessages,
  onlineUsers,
  campaignSessions,
  dmSessionStates,
  worldRumors,
  worldDevelopments,
  worldRegions,
  diceRolls,
  userActivityEvents,
  userSessionsAnalytics,
  hearthPresence,
  hearthEvents,
  hearthBoardPosts,
  hearthUserState,
  hearthMurmur,
  insertHearthBoardPostSchema,
  campaignSrdReferences,
  demoAnalytics,
  adventureCompletions,
  campaignParticipants,
  worldEvents,
  worldDiscoveries,
  worldWhispers,
  worldLocations,
  campaignExplorationHexes,
  characterInventory,
} from "@shared/schema";
import {
  type TraceEventKind,
  type TraceEvent,
  type CAMLTrace,
  type TraceCampaign,
  type TraceSession,
  type TraceActor,
  generateEventId,
  generateTraceId,
  generateModuleId,
  CAML_TRACE_VERSION
} from "@shared/caml-trace";
import yaml from "js-yaml";
import {
  processEnemyAttacks,
  processCompanionAttacks,
  processPlayerAttack,
  getCompanionDefaultStats,
  calculateEffectiveCombatStats,
  type Combatant,
  type CombatLogEntry,
  type CombatTurnResult,
  type ItemStats
} from "../combatManager";
import { getAIClient, getAppOpenAI } from "../lib/aiProvider";
import { objectStorageClient } from "../replit_integrations/object_storage";
import { randomUUID } from "crypto";
import OpenAI from "openai";
import { generateCampaign, type CampaignGenerationRequest } from "../lib/openai";
import { generateCharacterPortrait, generateCharacterBackground } from "../lib/characterImageGenerator";
import { generateUserAvatar } from "../lib/avatarGenerator";
import { recordPurchase, recordSale, getItemPrice, getSellPrice } from "../economyEngine";
import { generateWorldEvents, aggregateDiscoveries } from "../lib/worldEventEngine";
import { generatePostCombatRewards, type PostCombatRewards, type DefeatedEnemy } from "../postCombatRewards";
import { getXPFromCR, calculateEncounterXP, QUEST_XP_REWARDS, getLevelFromXP, getXPToNextLevel } from "../../shared/rules/xp";
import {
  parseCAMLYaml,
  parseCAMLJson,
  convertCAMLToCampaign,
  convertCampaignToCAML2,
  exportToYAML,
  exportToJSON,
  buildAdventureGraph,
  CAML_AI_PROMPT,
  migrateCAML1xTo2
} from "../caml";
import {
  parseNarrativeForLocations,
  generateHexMetaFromKeywords,
  getAllAdjacentCoordinates,
  getAdjacentHexCoordinates,
  detectMovementInNarrative,
  detectAdventureSetting,
  ENVIRONMENT_KEYWORDS,
  type HexDirection,
  type AdventureSetting
} from "../narrativeHexParser";
import { getDiscordStatus, sendToChannel, createSessionStartEmbed, createRecapEmbed, createRollEmbed, postCampaignEvent } from "../discord";
import {
  generateCAMLCoverArt,
  getCachedNarrative, setCachedNarrative, deleteCachedNarrative,
  SCENE_GENERATION_CONSTRAINTS, SCENE_CHOICE_FRAMING, SCENE_TEMPERATURE_SCALING,
  WAYPOINT_TRAVEL_PATTERNS, isWaypointTravel,
  improviseDoctrine, applyStakePassiveDrift, recordTrace,
  validatePlayerChoice, generateNarrativeSummary, generateCharacterArcSummaryForDM,
  evaluateProceduralQuestTriggers, evaluateQuestTriggerCondition,
  instantiateQuestTemplate, fillPlaceholders, extractThreatFromNarrative,
  updateReputationProfileFromEvent,
  seededRandom, generateCityLayout, generateCapitalCityLayout,
  computeTrekPath, generateLocationQuests,
  type CityBuilding, type CityDistrict, type CityLayout,
} from "./_helpers";
import { syncMarketItemStats } from "../economyEngine";

type BroadcastFn = (type: string, payload: any) => void;


export function register(app: Express, broadcast: BroadcastFn): void {
  const broadcastMessage = broadcast;
  // ==================== CAML Adventure Routes ====================
  
  // Import a CAML adventure (YAML or JSON)
  app.post("/api/caml/import", isAuthenticated, async (req, res) => {
    try {
      const { content, format, createCampaign: shouldCreateCampaign, campaignLength } = req.body;
      const userId = req.user!.id;
      
      console.log("CAML import request:", { format, shouldCreateCampaign, contentLength: content?.length });
      
      if (!content) {
        return res.status(400).json({ message: "No content provided" });
      }
      
      let pack;
      try {
        if (format === 'yaml' || format === 'yml') {
          pack = parseCAMLYaml(content);
        } else {
          pack = parseCAMLJson(content);
        }
      } catch (parseError) {
        console.error("CAML parse error:", parseError);
        return res.status(400).json({ message: `Parse error: ${parseError}` });
      }
      
      console.log("CAML pack parsed:", pack ? "success" : "null", pack?.adventure?.title);
      
      if (!pack) {
        return res.status(400).json({ message: "Failed to parse CAML content - invalid format" });
      }
      
      const campaignData = convertCAMLToCampaign(pack);
      
      if (shouldCreateCampaign) {
        // Calculate total chapters based on campaign length
        let totalChapters: number;
        switch (campaignLength) {
          case 'quick':
            totalChapters = 3;
            break;
          case 'epic':
            totalChapters = 6 + Math.floor(Math.random() * 3); // 6-8
            break;
          case 'standard':
          default:
            totalChapters = 4 + Math.floor(Math.random() * 2); // 4-5
            break;
        }
        
        const campaign = await storage.createCampaign({
          userId,
          title: campaignData.title,
          description: campaignData.description + (campaignData.setting ? `\n\nSetting: ${campaignData.setting}` : ''),
          difficulty: 'normal',
          narrativeStyle: 'balanced',
          campaignLength: campaignLength || 'standard',
          totalChapters,
          currentSession: 1,
          createdAt: new Date().toISOString()
        });
        
        // Wire doctrine fields from CAML 2.0 data into campaign
        const rawContent = format === 'yaml' || format === 'yml' ? pack : (typeof content === 'string' ? JSON.parse(content) : content);
        const camlDoctrine = rawContent?.doctrine;
        if (camlDoctrine) {
          const doctrineUpdate: any = {};
          if (camlDoctrine.campaign_question) {
            doctrineUpdate.campaignQuestion = camlDoctrine.campaign_question;
          }
          if (camlDoctrine.stakes && Array.isArray(camlDoctrine.stakes) && camlDoctrine.stakes.length > 0) {
            doctrineUpdate.campaignStakes = camlDoctrine.stakes;
          }
          if (Object.keys(doctrineUpdate).length > 0) {
            await storage.updateCampaign(campaign.id, doctrineUpdate);
            console.log(`[CAML Import] Wired doctrine into campaign ${campaign.id}: question="${doctrineUpdate.campaignQuestion?.substring(0, 50)}...", ${doctrineUpdate.campaignStakes?.length || 0} stakes`);
          }
        }
        
        // Generate initial story content using AI based on CAML adventure data
        let initialNarrative = `Welcome to ${campaignData.title}. ${campaignData.description}`;
        let initialChoices: any[] = [];
        let sessionTitle = `Chapter 1: ${campaignData.title}`;
        let initialLocation = campaignData.locations[0]?.name || 'Unknown Location';
        
        // Try to generate AI-powered initial story if OpenAI is available
        if (process.env.OPENAI_API_KEY) {
          try {
            // Build context from CAML adventure data
            const locationContext = campaignData.locations.length > 0 
              ? `Locations: ${campaignData.locations.map(l => `${l.name} - ${l.description}`).slice(0, 3).join('; ')}`
              : '';
            const npcContext = campaignData.npcs.length > 0
              ? `Key NPCs: ${campaignData.npcs.map(n => `${n.name} (${n.class || 'unknown role'})`).slice(0, 3).join(', ')}`
              : '';
            const questContext = campaignData.quests.length > 0
              ? `Main Quests: ${campaignData.quests.map(q => `${q.name}: ${q.description}`).slice(0, 2).join('; ')}`
              : '';
            const encounterContext = campaignData.encounters.length > 0
              ? `Possible Encounters: ${campaignData.encounters.map(e => e.name).slice(0, 3).join(', ')}`
              : '';
            
            const adventurePrompt = `
You are an expert Dungeon Master starting a new D&D adventure.

ADVENTURE: ${campaignData.title}
SETTING: ${campaignData.setting || 'Fantasy'}
DESCRIPTION: ${campaignData.description}
${locationContext}
${npcContext}
${questContext}
${encounterContext}

Generate an engaging opening scene for this adventure that sets the stage and gives players clear direction options.

Return your response as a JSON object with these fields:
- narrative: An evocative 2-3 paragraph opening that describes the scene, atmosphere, and hints at the adventure ahead
- sessionTitle: A short, engaging title for this opening scene
- location: The starting location name
- choices: An array of 4 objects. If the narrative presents a moral dilemma or decision fork, at least 2 choices MUST represent opposing sides of that decision — do NOT replace them with generic utility actions. Each with:
  - action: A short description of a possible action
  - description: A brief explanation of what this action entails
  - icon: A simple icon identifier (use: "search", "door", "talk", "sword", "treasure", "key", "running", "hand-sparkles")
  - requiresDiceRoll: Boolean (false for most opening choices)
`;

            const { client: openaiClient, model: aiModel } = await getAIClient(req.user?.id);
            const response = await openaiClient.chat.completions.create({
              model: aiModel,
              messages: [{ role: "user", content: adventurePrompt }],
              response_format: { type: "json_object" },
              max_tokens: 1200,
            });
            
            const generatedContent = JSON.parse(response.choices[0].message.content || '{}');
            if (generatedContent.narrative && typeof generatedContent.narrative === 'string' && generatedContent.narrative.length > 10) {
              initialNarrative = generatedContent.narrative;
            }
            if (generatedContent.choices && Array.isArray(generatedContent.choices) && generatedContent.choices.length >= 2) {
              initialChoices = generatedContent.choices;
            }
            if (generatedContent.sessionTitle && typeof generatedContent.sessionTitle === 'string') {
              sessionTitle = `Chapter 1: ${generatedContent.sessionTitle}`;
            }
            if (generatedContent.location && typeof generatedContent.location === 'string') {
              initialLocation = generatedContent.location;
            }
            
            // Ensure we always have choices - fall back to defaults if AI didn't provide valid ones
            if (initialChoices.length === 0) {
              console.warn("AI did not provide valid choices for CAML import, using defaults");
              initialChoices = [
                { action: "Explore the area", description: "Look around and get your bearings", icon: "search", requiresDiceRoll: false },
                { action: "Talk to locals", description: "Seek information from nearby people", icon: "talk", requiresDiceRoll: false },
                { action: "Examine your quest", description: "Review your objectives", icon: "scroll", requiresDiceRoll: false },
                { action: "Prepare for adventure", description: "Check your equipment and ready yourself", icon: "sword", requiresDiceRoll: false }
              ];
            }
            console.log("Generated initial story for CAML import:", campaignData.title);
          } catch (aiError) {
            console.error("Failed to generate AI story for CAML import, using defaults:", aiError);
            // Fallback to basic choices if AI generation fails
            initialChoices = [
              { action: "Explore the area", description: "Look around and get your bearings", icon: "search", requiresDiceRoll: false },
              { action: "Talk to locals", description: "Seek information from nearby people", icon: "talk", requiresDiceRoll: false },
              { action: "Examine your quest", description: "Review your objectives", icon: "scroll", requiresDiceRoll: false },
              { action: "Prepare for adventure", description: "Check your equipment and ready yourself", icon: "sword", requiresDiceRoll: false }
            ];
          }
        } else {
          // No OpenAI key - use basic fallback choices
          initialChoices = [
            { action: "Explore the area", description: "Look around and get your bearings", icon: "search", requiresDiceRoll: false },
            { action: "Talk to locals", description: "Seek information from nearby people", icon: "talk", requiresDiceRoll: false },
            { action: "Examine your quest", description: "Review your objectives", icon: "scroll", requiresDiceRoll: false },
            { action: "Prepare for adventure", description: "Check your equipment and ready yourself", icon: "sword", requiresDiceRoll: false }
          ];
        }
        
        // Build activeQuests from CAML quests for Adventure Objectives display
        const activeQuests = campaignData.quests.map((quest, index) => ({
          id: `quest-${index}`,
          title: quest.name,
          description: quest.description || '',
          status: 'active',
          xpReward: quest.rewards?.xp || 100,
          goldReward: quest.rewards?.gold || 0
        }));
        
        // Calculate adventure requirements based on CAML data
        const combatEncounters = campaignData.encounters.filter(e => e.type === 'combat').length || 2;
        const trapEncounters = campaignData.encounters.filter(e => e.type === 'trap' || e.type === 'hazard').length || 1;
        const treasureEncounters = campaignData.encounters.filter(e => e.type === 'treasure' || e.type === 'loot').length || 2;
        const puzzleCount = campaignData.encounters.filter(e => e.type === 'puzzle').length || 1;
        const discoveryCount = campaignData.locations.length || 3;
        const subquestCount = Math.max(1, campaignData.quests.length);
        
        // Update story state with location, active quests, and progress tracking
        const enrichedStoryState = {
          ...campaignData.initialStoryState,
          currentLocation: initialLocation,
          adventureTitle: campaignData.title,
          activeQuests: activeQuests,
          adventureProgress: {
            encounters: { combat: 0, trap: 0, treasure: 0 },
            puzzles: 0,
            discoveries: 0,
            subquestsCompleted: 0
          },
          adventureRequirements: {
            encounters: { combat: combatEncounters, trap: trapEncounters, treasure: treasureEncounters },
            puzzles: puzzleCount,
            discoveries: discoveryCount,
            subquests: subquestCount
          }
        };
        
        const session = await storage.createCampaignSession({
          campaignId: campaign.id,
          sessionNumber: 1,
          title: sessionTitle,
          narrative: initialNarrative,
          choices: initialChoices,
          storyState: enrichedStoryState,
          createdAt: new Date().toISOString()
        });
        
        // Only create key NPCs (limit to 3 max) and don't auto-add as companions
        // NPCs are story characters, not party members - they'll appear in narrative
        const keyNpcs = campaignData.npcs.slice(0, 3);
        for (const npc of keyNpcs) {
          try {
            await storage.createNpc({
              name: npc.name,
              race: npc.race || 'Unknown',
              occupation: npc.class || 'Adventurer',
              personality: npc.description || 'A mysterious figure.',
              appearance: npc.description || 'Unremarkable appearance.',
              motivation: 'Unknown motives.',
              createdBy: userId
            });
            // Note: NPCs are NOT added to campaign as companions - they're story NPCs
            // Players can manually add them as companions later if desired
          } catch (e) {
            console.error("Failed to create NPC:", e);
          }
        }
        
        for (const quest of campaignData.quests) {
          try {
            await storage.createCampaignQuest({
              campaignId: campaign.id,
              title: quest.name,
              description: quest.description || '',
              status: 'active',
              xpReward: quest.rewards?.xp || 100,
              goldReward: quest.rewards?.gold || 0
            });
          } catch (e) {
            console.error("Failed to create quest:", e);
          }
        }
        
        res.json({
          success: true,
          campaignId: campaign.id,
          adventure: pack.adventure,
          imported: {
            npcs: campaignData.npcs.length,
            locations: campaignData.locations.length,
            encounters: campaignData.encounters.length,
            quests: campaignData.quests.length,
            items: campaignData.items.length
          }
        });
      } else {
        const caml2Doc = migrateCAML1xTo2(pack);
        res.json({
          success: true,
          adventure: pack.adventure,
          campaignData,
          graph: buildAdventureGraph(caml2Doc)
        });
      }
    } catch (error) {
      console.error("Failed to import CAML adventure:", error);
      res.status(500).json({ message: "Failed to import adventure" });
    }
  });
  
  // Export a campaign as CAML
  app.get("/api/campaigns/:campaignId/export/caml", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const format = req.query.format as string || 'json';
      const userId = req.user!.id;
      
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      if (campaign.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const sessions = await storage.getCampaignSessions(campaignId);
      const participants = await storage.getCampaignParticipants(campaignId);
      const npcs = await storage.getCampaignNpcs(campaignId);
      const quests = await storage.getCampaignQuests(campaignId);
      const dungeonMaps = await storage.getCampaignDungeonMaps(campaignId);
      const dungeonMap = dungeonMaps[0];
      
      const camlAdventure = convertCampaignToCAML2(
        campaign,
        sessions,
        participants,
        npcs,
        quests,
        dungeonMap
      );
      
      if (format === 'yaml' || format === 'yml') {
        const yamlContent = exportToYAML(camlAdventure);
        res.setHeader('Content-Type', 'text/yaml');
        res.setHeader('Content-Disposition', `attachment; filename="${campaign.title.replace(/\s+/g, '_')}.caml.yaml"`);
        res.send(yamlContent);
      } else {
        const jsonContent = exportToJSON(camlAdventure);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${campaign.title.replace(/\s+/g, '_')}.caml.json"`);
        res.send(jsonContent);
      }
    } catch (error) {
      console.error("Failed to export campaign as CAML:", error);
      res.status(500).json({ message: "Failed to export campaign" });
    }
  });
  
  // Get adventure graph for a campaign
  app.get("/api/campaigns/:campaignId/adventure-graph", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const userId = req.user!.id;
      
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      const sessions = await storage.getCampaignSessions(campaignId);
      const participants = await storage.getCampaignParticipants(campaignId);
      const npcs = await storage.getCampaignNpcs(campaignId);
      const quests = await storage.getCampaignQuests(campaignId);
      const dungeonMaps = await storage.getCampaignDungeonMaps(campaignId);
      const dungeonMap = dungeonMaps[0];
      
      const camlDoc = convertCampaignToCAML2(
        campaign,
        sessions,
        participants,
        npcs,
        quests,
        dungeonMap
      );
      
      const graph = buildAdventureGraph(camlDoc);
      console.log('Adventure graph built:', { nodes: graph.nodes.length, edges: graph.edges.length });
      res.json(graph);
    } catch (error) {
      console.error("Failed to build adventure graph:", error);
      res.status(500).json({ message: "Failed to build adventure graph" });
    }
  });
  
  // CAML-Trace API endpoints
  
  // Record a trace event
  app.post("/api/campaigns/:campaignId/trace/event", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const userId = req.user!.id;
      
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      const { kind, payload, sessionId, who, where, note, meta } = req.body;
      
      if (!kind || !payload) {
        return res.status(400).json({ message: "Missing required fields: kind, payload" });
      }
      
      const eventCount = await storage.getTraceEventCount(campaignId);
      const eid = generateEventId(eventCount + 1);
      
      const traceEvent = await storage.recordTraceEvent({
        campaignId,
        sessionId: sessionId || `session.${campaign.currentSession}`,
        eid,
        kind,
        payload,
        ts: new Date().toISOString(),
        who,
        locationRef: where,
        note,
        meta
      });
      
      res.json(traceEvent);
    } catch (error) {
      console.error("Failed to record trace event:", error);
      res.status(500).json({ message: "Failed to record trace event" });
    }
  });
  
  // Get trace events for a campaign
  app.get("/api/campaigns/:campaignId/trace/events", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const sessionId = req.query.sessionId as string | undefined;
      const userId = req.user!.id;
      
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      const events = await storage.getTraceEvents(campaignId, sessionId);
      res.json(events);
    } catch (error) {
      console.error("Failed to get trace events:", error);
      res.status(500).json({ message: "Failed to get trace events" });
    }
  });
  
  // Export complete CAML-Trace document
  app.get("/api/campaigns/:campaignId/export/trace", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const format = req.query.format as string || 'json';
      const userId = req.user!.id;
      
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      const participants = await storage.getCampaignParticipants(campaignId);
      const sessions = await storage.getCampaignSessions(campaignId);
      const traceEvents = await storage.getTraceEvents(campaignId);
      
      const actors: TraceActor[] = [
        { id: "party.main", type: "Party", name: "Main Party" },
        { id: "system.dm", type: "System", name: "Dungeon Master AI" }
      ];
      
      for (const p of participants) {
        if (p.characterId) {
          const char = await storage.getCharacter(p.characterId);
          if (char) {
            actors.push({
              id: `pc.${char.id}`,
              type: "PC",
              name: char.name
            });
          }
        }
      }
      
      const npcs = await storage.getCampaignNpcs(campaignId);
      for (const npc of npcs) {
        actors.push({
          id: `npc.${npc.id}`,
          type: "NPC",
          name: npc.name
        });
      }
      
      const traceSessions: TraceSession[] = sessions.map(s => ({
        id: `session.${s.sessionNumber}`,
        title: s.title || `Session ${s.sessionNumber}`,
        startedAt: s.createdAt,
        endedAt: s.completedAt || undefined
      }));
      
      const traceCampaign: TraceCampaign = {
        id: `campaign.${campaign.id}`,
        name: campaign.title,
        gm: "Everdice AI DM",
        ruleset: "dnd5e"
      };
      
      const events: TraceEvent[] = traceEvents.map(e => ({
        eid: e.eid,
        kind: e.kind as TraceEventKind,
        payload: e.payload as any,
        ts: e.ts,
        sessionId: e.sessionId || undefined,
        who: e.who || undefined,
        where: e.locationRef || undefined,
        note: e.note || undefined,
        meta: e.meta as Record<string, unknown> | undefined
      }));
      
      const trace: CAMLTrace = {
        type: "CAMLTrace",
        id: generateTraceId(campaignId),
        moduleId: generateModuleId(campaignId, campaign.title),
        camlVersion: "0.1",
        traceVersion: CAML_TRACE_VERSION,
        campaign: traceCampaign,
        sessions: traceSessions,
        actors,
        events
      };
      
      if (format === 'yaml') {
        const yamlContent = yaml.dump(trace, {
          indent: 2,
          lineWidth: 120,
          noRefs: true,
          sortKeys: false
        });
        res.setHeader('Content-Type', 'text/yaml');
        res.setHeader('Content-Disposition', `attachment; filename="${campaign.title.replace(/[^a-z0-9]/gi, '_')}_trace.yaml"`);
        return res.send(yamlContent);
      }
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${campaign.title.replace(/[^a-z0-9]/gi, '_')}_trace.json"`);
      res.json(trace);
    } catch (error) {
      console.error("Failed to export CAML trace:", error);
      res.status(500).json({ message: "Failed to export CAML trace" });
    }
  });
  
  // Get trace event count
  app.get("/api/campaigns/:campaignId/trace/count", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const count = await storage.getTraceEventCount(campaignId);
      res.json({ count });
    } catch (error) {
      console.error("Failed to get trace event count:", error);
      res.status(500).json({ message: "Failed to get trace event count" });
    }
  });
  
  // Generate a CAML 2.0 adventure using AI
  app.post("/api/caml/generate", isAuthenticated, async (req, res) => {
    try {
      const { 
        title, 
        theme, 
        setting, 
        minLevel, 
        maxLevel, 
        encounterCount,
        campaignLength,
        includeQuests,
        includePuzzles
      } = req.body;
      
      const adventureId = `adventure.${(title || 'adventure').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
      const timestamp = new Date().toISOString();
      
      const prompt = `Generate a complete CAML 2.0 D&D 5e adventure with ORIGINAL content and BUILT-IN PRESSURE.

ADVENTURE TO CREATE:
- ID: ${adventureId}
- Title: ${title || 'The Lost Temple'}
- Theme: ${theme || 'exploration and mystery'}
- Setting: ${setting || 'fantasy dungeon'}
- Levels: ${minLevel || 1}-${maxLevel || 5}
- Timestamp: ${timestamp}

REQUIREMENTS:
- 5 unique locations with logical connections
- 4-5 NPCs (mix of allies and enemies) with ORIGINAL names
- 3 items with rarity AND consequence (cost/risk of using each item)
- ${encounterCount || 3} processes (combat/social/puzzle/exploration mix) — at least 3 MUST modify stakes
- 1 hidden location requiring discovery
- All IDs must use YOUR adventure's names, not example names

CAML 2.0 JSON STRUCTURE (generate with your unique content):

{
  "caml_version": "2.0",
  "meta": { "id": "${adventureId}", "title": "${title || 'The Lost Temple'}", "created_utc": "${timestamp}", "authors": ["Everdice DM Toolkit"], "tags": ["fantasy"], "levels": {"min": ${minLevel || 1}, "max": ${maxLevel || 5}}, "summary": "A 2-3 sentence evocative synopsis of the adventure — what's at stake, what the players face, and why it matters. Written like the back cover of a D&D module.", "table_of_contents": [{"chapter": 1, "title": "Chapter title matching first process/scene", "summary": "Brief description of what happens"}, {"chapter": 2, "title": "Chapter title", "summary": "Brief description"}] },
  "doctrine": {
    "campaign_question": "A genuine DILEMMA — not 'defeat the villain' but 'Should X be preserved or exploited, and who pays the cost?' Must have no clean answer.",
    "stakes": [
      {"id": "stake_<name1>", "name": "<PressureTrack1>", "value": 2, "max": 5, "drift": "up", "driftRate": 0.2, "thresholdConsequence": {"at0": {"event": "<WhatHappensIfResolved>", "irreversible": false}, "at5": {"event": "<WhatHappensIfMaxed>", "irreversible": true}}},
      {"id": "stake_<name2>", "name": "<PressureTrack2>", "value": 1, "max": 5, "drift": "up", "driftRate": 0.15, "thresholdConsequence": {"at0": {"event": "<WhatHappensIfResolved>", "irreversible": false}, "at5": {"event": "<WhatHappensIfMaxed>", "irreversible": true}}}
    ]
  },
  "world": {
    "entities": {
      "characters": [
        {"id": "PC_Party", "kind": "character", "pc": true},
        {"id": "NPC_<YourUniqueName>", "kind": "character", "name": "<FullName>", "species": "<Species>", "class": "<Class>", "description": "<Description>"}
      ],
      "locations": [
        {"id": "LOC_<YourName>", "kind": "location", "name": "<FullName>", "description": "<Description>", "tags": ["dungeon"], "features": ["<Feature>"]}
      ],
      "items": [
        {"id": "ITEM_<YourName>", "kind": "item", "name": "<FullName>", "rarity": "<uncommon|rare|legendary>", "description": "<Description>", "consequence": "<What cost or risk does using this item create?>"}
      ],
      "factions": []
    },
    "connections": [
      {"id": "CONN_1", "from": "LOC_<YourLoc1>", "to": "LOC_<YourLoc2>", "mode": "<door|hall|stairs|concealed>"}
    ]
  },
  "state": {
    "facts": [
      {"id": "STATE_<NPCName>_Attitude", "bearer": "NPC_<NPCName>", "type": "attitude", "value": "<friendly|neutral|hostile>"},
      {"id": "STATE_<EnemyName>_Active", "bearer": "NPC_<EnemyName>", "type": "active", "value": true},
      {"id": "STATE_<HiddenLoc>_Discovered", "bearer": "LOC_<HiddenLoc>", "type": "discovered", "value": false},
      {"id": "STATE_Quest_Main_Status", "bearer": "${adventureId}", "type": "quest_status", "value": "active"}
    ]
  },
  "roles": {
    "assignments": [
      {"id": "ROLE_QuestGiver_Main", "role": "QuestGiver", "holder": "NPC_<YourQuestGiver>", "revocation": {"any": []}, "notes": "<QuestDescription>"},
      {"id": "ROLE_Guardian_<Name>", "role": "Guardian", "holder": "NPC_<YourEnemy>", "revocation": {"any": [{"lhs": "state[STATE_<EnemyName>_Active].value", "op": "==", "rhs": false}]}}
    ]
  },
  "processes": {
    "catalog": [
      {"id": "PROC_<Type>_<Loc>", "type": "<combat|social|puzzle|exploration>", "timebox": {"id": "TB_1", "label": "<Title>"}, "participants": ["PC_Party", "NPC_<YourNPC>"], "location": "LOC_<YourLoc>", "notes": "<Description>", "stake_effects": [{"stake_id": "stake_<name>", "delta": 1, "reason": "Why this process changes this stake"}]}
    ]
  },
  "transitions": {
    "changes": [
      {"id": "TR_<Description>", "caused_by": "PROC_<YourProcess>", "ops": [{"op": "update_state", "state_id": "STATE_<YourState>", "value": "<newValue>"}]},
      {"id": "TR_EndingA", "caused_by": "PROC_<FinalProcess>", "ops": [{"op": "update_state", "state_id": "STATE_Quest_Main_Status", "value": "complete"}]},
      {"id": "TR_EndingB", "caused_by": "PROC_<FinalProcess>", "ops": [{"op": "update_state", "state_id": "STATE_Quest_Main_Status", "value": "complete"}]}
    ]
  },
  "snapshots": {
    "timeline": [
      {"id": "SNAP_Initial", "time_utc": "${timestamp}", "world_hash": "initial", "state_hash": "initial", "roles_hash": "initial", "narration": "<OpeningScene>"},
      {"id": "SNAP_Ending_A", "time_utc": "${timestamp}", "world_hash": "final_a", "state_hash": "final_a", "roles_hash": "final_a", "narration": "<Ending where stake A is resolved but stake B worsens. What is better? What is worse? What cannot be undone?>", "derived_from_transition": "TR_EndingA"},
      {"id": "SNAP_Ending_B", "time_utc": "${timestamp}", "world_hash": "final_b", "state_hash": "final_b", "roles_hash": "final_b", "narration": "<Alternative ending — opposite tradeoff. The other stake resolves but a new cost emerges.>", "derived_from_transition": "TR_EndingB"}
    ]
  }
}

CRITICAL RULES:
1. Replace ALL <Placeholders> with your ORIGINAL creative content
2. meta.id MUST be "${adventureId}" and meta.title MUST be "${title || 'The Lost Temple'}"
3. STATE_Quest_Main_Status bearer MUST be "${adventureId}"
4. NO "attitude" property on NPCs - attitude is ONLY in state.facts
5. All IDs must cross-reference correctly (NPC_Wizard in state.facts must exist in world.entities.characters)
6. Use only SRD 5.1 content
7. doctrine.campaign_question MUST be a dilemma (not a goal) with no clean answer
8. doctrine.stakes MUST have at least 2 escalating pressure tracks
9. Items MUST have "consequence" — what cost or risk using them creates
10. At least 2 forked ending snapshots with different tradeoffs
11. meta.summary MUST be a vivid 2-3 sentence hook — what the players face, what's at stake, and why it matters
12. meta.table_of_contents MUST list one entry per process/chapter in order, with evocative titles and brief summaries`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: `You are a CAML 2.0 adventure designer. CAML 2.0 is NOT CAML 1.x.

CAML 2.0 MANDATORY STRUCTURE:
- Root must have "caml_version": "2.0" (NOT "type": "AdventureModule")
- NPCs go in world.entities.characters WITHOUT attitude property
- Attitudes are in state.facts as {bearer, type: "attitude", value}
- Encounters are in processes.catalog as processes with timeboxes
- Quests are expressed via roles.assignments (QuestGiver) + state.facts (quest_status)
- All changes occur via transitions.changes caused by processes
- doctrine.campaign_question MUST be a DILEMMA (not a goal) — "Should X be done, and at what cost?"
- doctrine.stakes MUST have at least 2 pressure tracks with drift and threshold consequences
- Items MUST have "consequence" field describing cost/risk of use
- Processes MUST include "stake_effects" showing how they modify pressure tracks
- Snapshots MUST include at least 2 forked endings with different tradeoffs
- meta.summary MUST be a vivid 2-3 sentence synopsis (like back cover of a D&D module)
- meta.table_of_contents MUST list chapters with titles and summaries matching processes

NEVER generate:
- "type": "AdventureModule"
- "encounters": [...] array at root
- "quests": [...] array at root  
- "attitude": "neutral" on NPC objects
- Clean endings where everything resolves perfectly
- Items that only grant power with no consequence

ALWAYS generate:
- "caml_version": "2.0"
- state.facts for EVERY NPC's attitude
- processes.catalog for encounters
- transitions.changes for state mutations`
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        max_tokens: 8000,
        temperature: 0.7
      });
      
      const generatedAdventure = JSON.parse(response.choices[0].message.content || '{}');
      
      // Validate it's proper CAML 2.0 format
      const hasCAML2Structure = generatedAdventure.caml_version === '2.0' && 
                      generatedAdventure.world?.entities && 
                      generatedAdventure.state?.facts &&
                      generatedAdventure.processes?.catalog;
      
      const hasCAML1Artifacts = generatedAdventure.encounters || 
                                generatedAdventure.quests || 
                                generatedAdventure.type === 'AdventureModule';
      
      // Check for placeholder remnants - ALL angle-bracket tokens are invalid in CAML 2.0 output
      const jsonStr = JSON.stringify(generatedAdventure);
      const placeholderMatches = jsonStr.match(/<[^>]+>/g);
      const hasPlaceholders = placeholderMatches && placeholderMatches.length > 0;
      
      // Check meta.id and title match request
      const requestedTitle = title || 'The Lost Temple';
      const metaIdCorrect = generatedAdventure.meta?.id === adventureId;
      const metaTitleCorrect = generatedAdventure.meta?.title === requestedTitle;
      
      // Check minimum content counts
      const characters = generatedAdventure.world?.entities?.characters || [];
      const locations = generatedAdventure.world?.entities?.locations || [];
      const processes = generatedAdventure.processes?.catalog || [];
      const hasMinContent = characters.length >= 4 && locations.length >= 4 && processes.length >= 2;
      
      // Check no NPCs have attitude property (should be in state.facts)
      const npcsWithAttitude = characters.filter((c: any) => c.attitude !== undefined);
      const attitudesInState = npcsWithAttitude.length === 0;
      
      // isCAML2 includes ALL validations
      const isCAML2 = hasCAML2Structure && !hasCAML1Artifacts && !hasPlaceholders && 
                      metaIdCorrect && metaTitleCorrect && hasMinContent && attitudesInState;
      
      const warnings: string[] = [];
      if (!hasCAML2Structure) warnings.push("Missing CAML 2.0 structure (world/state/processes layers)");
      if (hasCAML1Artifacts) warnings.push("Contains CAML 1.x artifacts (encounters/quests arrays)");
      if (hasPlaceholders) warnings.push(`Contains unsubstituted placeholders: ${placeholderMatches?.slice(0, 5).join(', ')}`);
      if (!metaIdCorrect) warnings.push(`meta.id mismatch: expected ${adventureId}, got ${generatedAdventure.meta?.id}`);
      if (!metaTitleCorrect) warnings.push(`meta.title mismatch: expected "${requestedTitle}", got "${generatedAdventure.meta?.title}"`);
      if (!hasMinContent) warnings.push(`Insufficient content: ${characters.length} chars, ${locations.length} locs, ${processes.length} procs`);
      if (!attitudesInState) warnings.push(`NPCs have attitude property instead of state facts: ${npcsWithAttitude.map((n: any) => n.id).join(', ')}`);
      
      if (warnings.length > 0) {
        console.warn("CAML 2.0 generation issues:", warnings);
      }
      
      // If validation fails, return error instead of success
      if (!isCAML2) {
        return res.status(422).json({
          success: false,
          message: "Generated adventure failed CAML 2.0 validation",
          warnings,
          adventure: generatedAdventure // Include for debugging
        });
      }
      
      const adventureTitle = generatedAdventure.meta?.title || title || 'Adventure';
      const adventureSummary = generatedAdventure.meta?.summary || generatedAdventure.doctrine?.campaign_question || '';
      const adventureTheme = theme || 'fantasy exploration';

      let coverArtUrl = '';
      try {
        coverArtUrl = await generateCAMLCoverArt(adventureTitle, adventureSummary, adventureTheme);
      } catch (coverErr) {
        console.warn("Cover art generation failed (non-blocking):", coverErr);
      }

      res.json({
        success: true,
        adventure: generatedAdventure,
        isCAML2: true,
        coverArtUrl,
        yaml: exportToYAML(generatedAdventure),
        json: exportToJSON(generatedAdventure)
      });
    } catch (error) {
      console.error("Failed to generate CAML 2.0 adventure:", error);
      res.status(500).json({ message: "Failed to generate adventure" });
    }
  });
  
  // Parse CAML content and return structure (preview without creating campaign)
  app.post("/api/caml/parse", async (req, res) => {
    try {
      const { content, format } = req.body;
      
      if (!content) {
        return res.status(400).json({ message: "No content provided" });
      }
      
      let pack;
      if (format === 'yaml' || format === 'yml') {
        pack = parseCAMLYaml(content);
      } else {
        pack = parseCAMLJson(content);
      }
      
      if (!pack) {
        return res.status(400).json({ message: "Failed to parse CAML content" });
      }
      
      const caml2Doc = migrateCAML1xTo2(pack);
      const graph = buildAdventureGraph(caml2Doc);
      
      res.json({
        success: true,
        adventure: pack.adventure,
        entityCount: Object.keys(pack.entities).length,
        camlVersion: "2.0",
        graph
      });
    } catch (error) {
      console.error("Failed to parse CAML:", error);
      res.status(500).json({ message: "Failed to parse CAML content" });
    }
  });

  // =====================================================
  // ADVENTURE LIBRARY ROUTES
  // =====================================================

  app.get("/api/adventures/my", isAuthenticated, async (req: any, res) => {
    try {
      const adventures = await storage.getSharedAdventuresByUser(req.user.id);
      res.json(adventures);
    } catch (error) {
      console.error("Failed to get user adventures:", error);
      res.status(500).json({ message: "Failed to get adventures" });
    }
  });

  app.get("/api/adventures/:id", async (req, res) => {
    try {
      const adventure = await storage.getSharedAdventure(parseInt(req.params.id));
      if (!adventure) {
        return res.status(404).json({ message: "Adventure not found" });
      }
      res.json(adventure);
    } catch (error) {
      console.error("Failed to get adventure:", error);
      res.status(500).json({ message: "Failed to get adventure" });
    }
  });

  app.post("/api/adventures", isAuthenticated, async (req: any, res) => {
    try {
      const { title, description, camlData, tags, difficulty, genre } = req.body;
      if (!title || !camlData) {
        return res.status(400).json({ message: "Title and CAML data are required" });
      }

      const summary = camlData?.meta?.summary || description || '';
      const adventure = await storage.createSharedAdventure({
        authorId: req.user.id,
        title,
        description: summary,
        shortDescription: summary.substring(0, 150),
        camlData,
        tags: tags || camlData?.meta?.tags || [],
        difficulty: difficulty || 'medium',
        genre: genre || 'fantasy',
        status: 'published',
        createdAt: new Date().toISOString(),
      });

      res.json(adventure);
    } catch (error) {
      console.error("Failed to save adventure:", error);
      res.status(500).json({ message: "Failed to save adventure" });
    }
  });

  app.delete("/api/adventures/:id", isAuthenticated, async (req: any, res) => {
    try {
      const adventure = await storage.getSharedAdventure(parseInt(req.params.id));
      if (!adventure) {
        return res.status(404).json({ message: "Adventure not found" });
      }
      if (adventure.authorId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      await storage.deleteSharedAdventure(adventure.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete adventure:", error);
      res.status(500).json({ message: "Failed to delete adventure" });
    }
  });

  // =====================================================
  // BULLETIN BOARD (LFG) ROUTES
  // =====================================================
  
  // Get all bulletin posts (with filters)
  app.get("/api/bulletin", async (req, res) => {
    try {
      const { postType, limit } = req.query;
      const posts = await storage.getBulletinPosts({
        postType: postType as string | undefined,
        isActive: true,
        limit: limit ? parseInt(limit as string) : 50
      });
      // Enrich posts with author info
      const enrichedPosts = await Promise.all(posts.map(async (post) => {
        const author = await storage.getUser(post.userId);
        return { 
          ...post, 
          authorName: author?.username || 'Unknown',
          authorAvatarUrl: author?.avatarUrl || null 
        };
      }));
      res.json(enrichedPosts);
    } catch (error) {
      console.error("Failed to get bulletin posts:", error);
      res.status(500).json({ message: "Failed to get bulletin posts" });
    }
  });
  
  // Get current user's bulletin posts
  app.get("/api/bulletin/my-posts", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const posts = await storage.getUserBulletinPosts(userId);
      res.json(posts);
    } catch (error) {
      console.error("Failed to get user bulletin posts:", error);
      res.status(500).json({ message: "Failed to get your posts" });
    }
  });
  
  // Get a single bulletin post with responses
  app.get("/api/bulletin/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const post = await storage.getBulletinPost(id);
      
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      const responses = await storage.getBulletinResponses(id);
      res.json({ ...post, responses });
    } catch (error) {
      console.error("Failed to get bulletin post:", error);
      res.status(500).json({ message: "Failed to get post" });
    }
  });
  
  // Create a new bulletin post
  app.post("/api/bulletin", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const post = await storage.createBulletinPost({
        ...req.body,
        userId
      });
      res.status(201).json(post);
    } catch (error) {
      console.error("Failed to create bulletin post:", error);
      res.status(500).json({ message: "Failed to create post" });
    }
  });
  
  // Update a bulletin post
  app.patch("/api/bulletin/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = (req.user as any).id;
      
      // Verify ownership
      const existing = await storage.getBulletinPost(id);
      if (!existing) {
        return res.status(404).json({ message: "Post not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to edit this post" });
      }
      
      const updated = await storage.updateBulletinPost(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Failed to update bulletin post:", error);
      res.status(500).json({ message: "Failed to update post" });
    }
  });
  
  // Delete a bulletin post
  app.delete("/api/bulletin/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = (req.user as any).id;
      
      // Verify ownership
      const existing = await storage.getBulletinPost(id);
      if (!existing) {
        return res.status(404).json({ message: "Post not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this post" });
      }
      
      await storage.deleteBulletinPost(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete bulletin post:", error);
      res.status(500).json({ message: "Failed to delete post" });
    }
  });
  
  // Respond to a bulletin post
  app.post("/api/bulletin/:id/respond", isAuthenticated, async (req, res) => {
    try {
      const postId = parseInt(req.params.id);
      const userId = (req.user as any).id;
      
      // Verify post exists
      const post = await storage.getBulletinPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      const response = await storage.createBulletinResponse({
        postId,
        userId,
        message: req.body.message,
        contactMethod: req.body.contactMethod,
        contactInfo: req.body.contactInfo
      });
      res.status(201).json(response);
    } catch (error) {
      console.error("Failed to create bulletin response:", error);
      res.status(500).json({ message: "Failed to respond to post" });
    }
  });
  
  // Delete a response (owner only)
  app.delete("/api/bulletin/response/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBulletinResponse(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete bulletin response:", error);
      res.status(500).json({ message: "Failed to delete response" });
    }
  });

}
