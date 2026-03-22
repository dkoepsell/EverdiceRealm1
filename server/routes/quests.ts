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
  app.get("/api/campaigns/:campaignId/quests", async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const quests = await storage.getCampaignQuests(campaignId);
      res.json(quests);
    } catch (error) {
      console.error("Error fetching quests:", error);
      res.status(500).json({ message: "Failed to fetch quests" });
    }
  });
  
  // Create a new quest for a campaign
  app.post("/api/campaigns/:campaignId/quests", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const { title, description, questType, xpReward, goldReward, silverReward, lootRewards, objectives } = req.body;
      
      const quest = await storage.createCampaignQuest({
        campaignId,
        title,
        description,
        questType: questType || "main",
        status: "active",
        xpReward: xpReward || 100,
        goldReward: goldReward || 0,
        silverReward: silverReward || 0,
        lootRewards: lootRewards || [],
        objectives: objectives || [],
        createdAt: new Date().toISOString()
      });
      
      res.status(201).json(quest);
    } catch (error) {
      console.error("Error creating quest:", error);
      res.status(500).json({ message: "Failed to create quest" });
    }
  });
  
  // Update a quest
  app.patch("/api/campaigns/:campaignId/quests/:questId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const questId = parseInt(req.params.questId);
      const updates = req.body;
      
      const updatedQuest = await storage.updateCampaignQuest(questId, updates);
      if (!updatedQuest) {
        return res.status(404).json({ message: "Quest not found" });
      }
      
      res.json(updatedQuest);
    } catch (error) {
      console.error("Error updating quest:", error);
      res.status(500).json({ message: "Failed to update quest" });
    }
  });
  
  // Complete a quest (mark as completed with rewards)
  app.post("/api/campaigns/:campaignId/quests/:questId/complete", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const questId = parseInt(req.params.questId);
      const { characterId } = req.body;
      
      // Complete the quest
      const completedQuest = await storage.completeCampaignQuest(questId);
      if (!completedQuest) {
        return res.status(404).json({ message: "Quest not found" });
      }
      
      // If a character is specified, award XP and gold
      if (characterId) {
        const character = await storage.getCharacter(characterId);
        if (character) {
          // Award XP
          if (completedQuest.xpReward) {
            await storage.awardXPToCharacter(characterId, completedQuest.xpReward);
          }
          
          // Award gold
          if (completedQuest.goldReward) {
            const currentGold = character.gold || 0;
            await storage.updateCharacter(characterId, {
              gold: currentGold + completedQuest.goldReward
            });
          }
          
          // Award silver
          if ((completedQuest as any).silverReward) {
            const currentSilver = character.silver || 0;
            await storage.updateCharacter(characterId, {
              silver: currentSilver + (completedQuest as any).silverReward
            });
          }
          
          // Add loot items to inventory
          const lootRewards = completedQuest.lootRewards as string[] || [];
          if (lootRewards.length > 0) {
            const currentEquipment = character.equipment || [];
            await storage.updateCharacter(characterId, {
              equipment: [...currentEquipment, ...lootRewards]
            });
          }
        }
      }
      
      res.json({
        quest: completedQuest,
        rewards: {
          xp: completedQuest.xpReward,
          gold: completedQuest.goldReward,
          silver: (completedQuest as any).silverReward || 0,
          items: completedQuest.lootRewards
        }
      });
    } catch (error) {
      console.error("Error completing quest:", error);
      res.status(500).json({ message: "Failed to complete quest" });
    }
  });
  
  // Delete a quest
  app.delete("/api/campaigns/:campaignId/quests/:questId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const questId = parseInt(req.params.questId);
      await storage.deleteCampaignQuest(questId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting quest:", error);
      res.status(500).json({ message: "Failed to delete quest" });
    }
  });

  // ==================== Quest Board Routes ====================
  
  // Get all quests posted to the board for a campaign
  app.get("/api/campaigns/:campaignId/quest-board", async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const allQuests = await storage.getCampaignQuests(campaignId);
      const boardQuests = allQuests.filter((q: any) => q.isPostedToBoard === true);
      res.json(boardQuests);
    } catch (error) {
      console.error("Error fetching quest board:", error);
      res.status(500).json({ message: "Failed to fetch quest board" });
    }
  });
  
  // Post a quest to the board (DM only)
  app.post("/api/campaigns/:campaignId/quests/:questId/post-to-board", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const questId = parseInt(req.params.questId);
      const { difficultyRating, estimatedDuration, prerequisites } = req.body;
      
      // Verify user is DM
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign || campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the DM can post quests to the board" });
      }
      
      const updatedQuest = await storage.updateCampaignQuest(questId, {
        isPostedToBoard: true,
        postedAt: new Date().toISOString(),
        difficultyRating: difficultyRating || "moderate",
        estimatedDuration,
        prerequisites
      });
      
      res.json(updatedQuest);
    } catch (error) {
      console.error("Error posting quest to board:", error);
      res.status(500).json({ message: "Failed to post quest to board" });
    }
  });
  
  // Remove a quest from the board (DM only)
  app.post("/api/campaigns/:campaignId/quests/:questId/remove-from-board", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const questId = parseInt(req.params.questId);
      
      // Verify user is DM
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign || campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the DM can remove quests from the board" });
      }
      
      const updatedQuest = await storage.updateCampaignQuest(questId, {
        isPostedToBoard: false,
        postedAt: null
      });
      
      res.json(updatedQuest);
    } catch (error) {
      console.error("Error removing quest from board:", error);
      res.status(500).json({ message: "Failed to remove quest from board" });
    }
  });
  
  // Accept a quest from the board (player)
  app.post("/api/campaigns/:campaignId/quests/:questId/accept", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const questId = parseInt(req.params.questId);
      const { characterId } = req.body;
      
      // Validate characterId is provided
      if (!characterId || typeof characterId !== 'number') {
        return res.status(400).json({ message: "Valid characterId is required" });
      }
      
      // Verify the character belongs to the authenticated user
      const character = await storage.getCharacter(characterId);
      if (!character || character.userId !== req.user.id) {
        return res.status(403).json({ message: "Character not found or doesn't belong to you" });
      }
      
      // Verify user is a participant in the campaign
      const participants = await storage.getCampaignParticipants(campaignId);
      const isParticipant = participants.some((p: any) => p.userId === req.user.id);
      if (!isParticipant) {
        return res.status(403).json({ message: "You must be a campaign participant to accept quests" });
      }
      
      // Get the quest
      const allQuests = await storage.getCampaignQuests(campaignId);
      const quest = allQuests.find((q: any) => q.id === questId);
      
      if (!quest) {
        return res.status(404).json({ message: "Quest not found" });
      }
      
      if (!quest.isPostedToBoard) {
        return res.status(400).json({ message: "Quest is not on the board" });
      }
      
      if (quest.acceptedByUserId) {
        return res.status(400).json({ message: "Quest has already been accepted" });
      }
      
      const updatedQuest = await storage.updateCampaignQuest(questId, {
        acceptedByCharacterId: characterId,
        acceptedByUserId: req.user.id,
        acceptedAt: new Date().toISOString(),
        status: "in_progress"
      });
      
      res.json(updatedQuest);
    } catch (error) {
      console.error("Error accepting quest:", error);
      res.status(500).json({ message: "Failed to accept quest" });
    }
  });
  
  // Abandon a quest (player who accepted it)
  app.post("/api/campaigns/:campaignId/quests/:questId/abandon", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const questId = parseInt(req.params.questId);
      
      // Get the quest first
      const allQuests = await storage.getCampaignQuests(parseInt(req.params.campaignId));
      const quest = allQuests.find((q: any) => q.id === questId);
      
      if (!quest) {
        return res.status(404).json({ message: "Quest not found" });
      }
      
      // Only the player who accepted can abandon
      if (quest.acceptedByUserId !== req.user.id) {
        return res.status(403).json({ message: "Only the player who accepted can abandon this quest" });
      }
      
      const updatedQuest = await storage.updateCampaignQuest(questId, {
        acceptedByCharacterId: null,
        acceptedByUserId: null,
        acceptedAt: null,
        status: "active"
      });
      
      res.json(updatedQuest);
    } catch (error) {
      console.error("Error abandoning quest:", error);
      res.status(500).json({ message: "Failed to abandon quest" });
    }
  });
  
  // Create quest directly to board (DM shortcut)
  app.post("/api/campaigns/:campaignId/quest-board", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      
      // Verify user is DM
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign || campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the DM can post quests to the board" });
      }
      
      const { title, description, questType, xpReward, goldReward, silverReward, lootRewards, objectives, difficultyRating, estimatedDuration, prerequisites } = req.body;
      
      const quest = await storage.createCampaignQuest({
        campaignId,
        title,
        description,
        questType: questType || "side",
        status: "active",
        xpReward: xpReward || 100,
        goldReward: goldReward || 0,
        silverReward: silverReward || 0,
        lootRewards: lootRewards || [],
        objectives: objectives || [],
        createdAt: new Date().toISOString(),
        isPostedToBoard: true,
        postedAt: new Date().toISOString(),
        difficultyRating: difficultyRating || "moderate",
        estimatedDuration,
        prerequisites
      });
      
      res.status(201).json(quest);
    } catch (error) {
      console.error("Error creating quest on board:", error);
      res.status(500).json({ message: "Failed to create quest on board" });
    }
  });

  // ==================== Campaign Dashboard / Narrative Insights Routes ====================
  
  // Get narrative insights for a campaign (cached) - DM only
  app.post('/api/locations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const locationData = { 
        name: req.body.name,
        description: req.body.description,
        environment: req.body.type || 'unknown',
        climate: req.body.climate || 'temperate',
        terrain: req.body.terrain || 'varied',
        notable_features: Array.isArray(req.body.notable_features) ? req.body.notable_features : 
                         req.body.notable_features ? req.body.notable_features.split(',').map(f => f.trim()) : [],
        inhabitants: Array.isArray(req.body.inhabitants) ? req.body.inhabitants : 
                    req.body.inhabitants ? req.body.inhabitants.split(',').map(i => i.trim()) : [],
        secrets: req.body.notes || '',
        hooks: Array.isArray(req.body.hooks) ? req.body.hooks : 
               req.body.hooks ? req.body.hooks.split(',').map(h => h.trim()) : [],
        created_by: userId,
        is_public: false,
        created_at: new Date()
      };
      
      const [location] = await db
        .insert(locations)
        .values(locationData)
        .returning();
      
      res.json(location);
    } catch (error) {
      console.error("Error creating location:", error);
      res.status(500).json({ message: "Failed to create location" });
    }
  });

  app.get('/api/locations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userLocations = await db
        .select()
        .from(locations)
        .where(eq(locations.created_by, userId))
        .orderBy(desc(locations.created_at));
      
      res.json(userLocations);
    } catch (error) {
      console.error("Error fetching locations:", error);
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });

  // Update a location
  app.put('/api/locations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const locationId = parseInt(req.params.id);
      const locationData = { 
        name: req.body.name,
        description: req.body.description,
        environment: req.body.type || req.body.environment || 'unknown',
        climate: req.body.climate || 'temperate',
        terrain: req.body.terrain || 'varied',
        notable_features: Array.isArray(req.body.notable_features) ? req.body.notable_features : 
                         req.body.notable_features ? req.body.notable_features.split(',').map((f: any) => f.trim()) : [],
        population: req.body.population,
        government: req.body.government,
        notes: req.body.notes,
        updated_at: new Date()
      };

      const [updatedLocation] = await db
        .update(locations)
        .set(locationData)
        .where(eq(locations.id, locationId))
        .returning();

      res.json(updatedLocation);
    } catch (error) {
      console.error("Failed to update location:", error);
      res.status(500).json({ message: "Failed to update location" });
    }
  });

  // Delete a location
  app.delete('/api/locations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const locationId = parseInt(req.params.id);
      await db.delete(locations).where(eq(locations.id, locationId));
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete location:", error);
      res.status(500).json({ message: "Failed to delete location" });
    }
  });

  // Quest management routes
  app.post('/api/quests', isAuthenticated, async (req: any, res) => {
    try {
      const questData = { 
        campaign_id: req.body.campaign_id || null,
        title: req.body.title,
        description: req.body.description,
        rewards: req.body.rewards ? JSON.parse(JSON.stringify(req.body.rewards)) : {},
        status: 'draft',
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const [quest] = await db
        .insert(quests)
        .values(questData)
        .returning();
      
      res.json(quest);
    } catch (error) {
      console.error("Error creating quest:", error);
      res.status(500).json({ message: "Failed to create quest" });
    }
  });

  app.get('/api/quests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      // Get all quests - both standalone (campaign_id is null) and campaign-linked
      const userQuests = await db
        .select()
        .from(quests)
        .orderBy(desc(quests.created_at));
      
      res.json(userQuests);
    } catch (error) {
      console.error("Error fetching quests:", error);
      res.status(500).json({ message: "Failed to fetch quests" });
    }
  });

  // Update a quest
  app.put('/api/quests/:id', isAuthenticated, async (req: any, res) => {
    try {
      const questId = parseInt(req.params.id);
      const questData = { 
        campaign_id: req.body.campaign_id || null,
        title: req.body.title,
        description: req.body.description,
        category: req.body.category,
        difficulty: req.body.difficulty,
        level_range: req.body.level_range,
        estimated_duration: req.body.estimated_duration,
        notes: req.body.notes,
        updated_at: new Date()
      };

      const [updatedQuest] = await db
        .update(quests)
        .set(questData)
        .where(eq(quests.id, questId))
        .returning();

      res.json(updatedQuest);
    } catch (error) {
      console.error("Failed to update quest:", error);
      res.status(500).json({ message: "Failed to update quest" });
    }
  });

  // Delete a quest
  app.delete('/api/quests/:id', isAuthenticated, async (req: any, res) => {
    try {
      const questId = parseInt(req.params.id);
      await db.delete(quests).where(eq(quests.id, questId));
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete quest:", error);
      res.status(500).json({ message: "Failed to delete quest" });
    }
  });

  // Magic item management routes
}
