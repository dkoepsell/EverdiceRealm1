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
  // ========================================
  // World Map API Routes
  // ========================================

  app.get("/api/world/party-positions", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const userId = (req.user as any).id;
      const allCampaigns = await storage.getAllCampaigns();
      const positions: Array<{
        campaignId: number;
        campaignTitle: string;
        hexQ: number;
        hexR: number;
        isOwner: boolean;
      }> = [];

      for (const campaign of allCampaigns) {
        if (campaign.isCompleted || campaign.isArchived) continue;
        const participants = await storage.getCampaignParticipants(campaign.id);
        const isInvolved = campaign.userId === userId || participants.some((p: any) => p.userId === userId);
        if (!isInvolved) continue;

        const state = await storage.getExplorationState(campaign.id);
        if (state && state.currentHexQ != null && state.currentHexR != null) {
          positions.push({
            campaignId: campaign.id,
            campaignTitle: campaign.title,
            hexQ: state.currentHexQ,
            hexR: state.currentHexR,
            isOwner: campaign.userId === userId,
          });
        }
      }

      res.json(positions);
    } catch (error) {
      console.error("Error fetching party positions:", error);
      res.status(500).json({ message: "Failed to fetch party positions" });
    }
  });
  
  // Get active campaigns/adventures per world region and location
  app.get("/api/world/activity", async (req, res) => {
    try {
      // Get all campaigns that are linked to world regions or locations
      const campaigns = await storage.getAllCampaigns();
      
      // Group by region and location
      const regionActivity: Record<number, { campaigns: any[], adventurerCount: number }> = {};
      const locationActivity: Record<number, { campaigns: any[], adventurerCount: number }> = {};
      
      for (const campaign of campaigns) {
        // Skip archived campaigns
        if (campaign.status === 'archived') continue;
        
        // Get participant count
        const participants = await storage.getCampaignParticipants(campaign.id);
        const adventurerCount = participants?.length || 0;
        
        // Get current session for status
        const currentSession = await storage.getCurrentSession(campaign.id);
        const isActive = currentSession && campaign.status !== 'completed';
        
        const campaignInfo = {
          id: campaign.id,
          title: campaign.title,
          status: campaign.status,
          isActive,
          adventurerCount,
          currentSessionTitle: currentSession?.title || null,
          worldLocationId: campaign.worldLocationId,
          worldRegionId: campaign.worldRegionId,
        };
        
        // Add to region activity
        if (campaign.worldRegionId) {
          if (!regionActivity[campaign.worldRegionId]) {
            regionActivity[campaign.worldRegionId] = { campaigns: [], adventurerCount: 0 };
          }
          regionActivity[campaign.worldRegionId].campaigns.push(campaignInfo);
          regionActivity[campaign.worldRegionId].adventurerCount += adventurerCount;
        }
        
        // Add to location activity
        if (campaign.worldLocationId) {
          if (!locationActivity[campaign.worldLocationId]) {
            locationActivity[campaign.worldLocationId] = { campaigns: [], adventurerCount: 0 };
          }
          locationActivity[campaign.worldLocationId].campaigns.push(campaignInfo);
          locationActivity[campaign.worldLocationId].adventurerCount += adventurerCount;
        }
      }
      
      res.json({ regionActivity, locationActivity });
    } catch (error) {
      console.error("Failed to fetch world activity:", error);
      res.status(500).json({ message: "Failed to fetch world activity" });
    }
  });
  
  // Get all world regions (public - anyone can view the world map)
  app.get("/api/world/regions", async (req, res) => {
    try {
      const regions = await storage.getAllWorldRegions();
      res.json(regions);
    } catch (error) {
      console.error("Failed to fetch world regions:", error);
      res.status(500).json({ message: "Failed to fetch world regions" });
    }
  });
  
  // Get a specific region
  app.get("/api/world/regions/:id", async (req, res) => {
    try {
      const regionId = parseInt(req.params.id);
      const region = await storage.getWorldRegion(regionId);
      if (!region) {
        return res.status(404).json({ message: "Region not found" });
      }
      res.json(region);
    } catch (error) {
      console.error("Failed to fetch world region:", error);
      res.status(500).json({ message: "Failed to fetch world region" });
    }
  });
  
  // Create a new world region (admin/DM only)
  app.post("/api/world/regions", isAuthenticated, async (req, res) => {
    try {
      const region = await storage.createWorldRegion(req.body);
      res.status(201).json(region);
    } catch (error) {
      console.error("Failed to create world region:", error);
      res.status(500).json({ message: "Failed to create world region" });
    }
  });
  
  // Update a world region
  app.patch("/api/world/regions/:id", isAuthenticated, async (req, res) => {
    try {
      const regionId = parseInt(req.params.id);
      const updated = await storage.updateWorldRegion(regionId, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Region not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Failed to update world region:", error);
      res.status(500).json({ message: "Failed to update world region" });
    }
  });
  
  // Get all world locations (optionally filtered by region)
  app.get("/api/world/locations", async (req, res) => {
    try {
      const regionId = req.query.regionId ? parseInt(req.query.regionId as string) : undefined;
      const locations = await storage.getWorldLocations(regionId);
      res.json(locations);
    } catch (error) {
      console.error("Failed to fetch world locations:", error);
      res.status(500).json({ message: "Failed to fetch world locations" });
    }
  });
  
  // Get a specific location
  app.get("/api/world/locations/:id", async (req, res) => {
    try {
      const locationId = parseInt(req.params.id);
      const location = await storage.getWorldLocation(locationId);
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      res.json(location);
    } catch (error) {
      console.error("Failed to fetch world location:", error);
      res.status(500).json({ message: "Failed to fetch world location" });
    }
  });
  
  // Create a new world location
  app.post("/api/world/locations", isAuthenticated, async (req, res) => {
    try {
      const location = await storage.createWorldLocation(req.body);
      res.status(201).json(location);
    } catch (error) {
      console.error("Failed to create world location:", error);
      res.status(500).json({ message: "Failed to create world location" });
    }
  });
  
  // Update a world location
  app.patch("/api/world/locations/:id", isAuthenticated, async (req, res) => {
    try {
      const locationId = parseInt(req.params.id);
      const updated = await storage.updateWorldLocation(locationId, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Location not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Failed to update world location:", error);
      res.status(500).json({ message: "Failed to update world location" });
    }
  });
  
  // Link a campaign/adventure to a world location
  app.post("/api/world/locations/:id/link-campaign", isAuthenticated, async (req, res) => {
    try {
      const locationId = parseInt(req.params.id);
      const { campaignId } = req.body;
      
      // Update the location with the linked campaign
      const updatedLocation = await storage.updateWorldLocation(locationId, { linkedCampaignId: campaignId });
      
      // Also update the campaign to reference this location
      if (updatedLocation) {
        await storage.updateCampaign(campaignId, { worldLocationId: locationId });
      }
      
      res.json(updatedLocation);
    } catch (error) {
      console.error("Failed to link campaign to location:", error);
      res.status(500).json({ message: "Failed to link campaign to location" });
    }
  });
  
  // Get user's world progress
  app.get("/api/world/progress", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const progress = await storage.getUserWorldProgress(userId);
      res.json(progress);
    } catch (error) {
      console.error("Failed to fetch user world progress:", error);
      res.status(500).json({ message: "Failed to fetch user world progress" });
    }
  });
  
  // Get any user's world progress (public for viewing other users' progress on the map)
  app.get("/api/world/progress/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const progress = await storage.getUserWorldProgress(userId);
      res.json(progress);
    } catch (error) {
      console.error("Failed to fetch user world progress:", error);
      res.status(500).json({ message: "Failed to fetch user world progress" });
    }
  });
  
  // Discover a region
  app.post("/api/world/regions/:id/discover", isAuthenticated, async (req, res) => {
    try {
      const regionId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { campaignId, sessionId } = req.body;
      
      const progress = await storage.discoverRegion(userId, regionId, campaignId, sessionId);
      res.json(progress);
    } catch (error) {
      console.error("Failed to discover region:", error);
      res.status(500).json({ message: "Failed to discover region" });
    }
  });
  
  // Discover a location
  app.post("/api/world/locations/:id/discover", isAuthenticated, async (req, res) => {
    try {
      const locationId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { campaignId, sessionId } = req.body;
      
      const progress = await storage.discoverLocation(userId, locationId, campaignId, sessionId);
      res.json(progress);
    } catch (error) {
      console.error("Failed to discover location:", error);
      res.status(500).json({ message: "Failed to discover location" });
    }
  });
  
  // Complete a region
  app.post("/api/world/regions/:id/complete", isAuthenticated, async (req, res) => {
    try {
      const regionId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      const progress = await storage.completeRegion(userId, regionId);
      res.json(progress);
    } catch (error) {
      console.error("Failed to complete region:", error);
      res.status(500).json({ message: "Failed to complete region" });
    }
  });
  
  // Complete a location
  app.post("/api/world/locations/:id/complete", isAuthenticated, async (req, res) => {
    try {
      const locationId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      const progress = await storage.completeLocation(userId, locationId);
      res.json(progress);
    } catch (error) {
      console.error("Failed to complete location:", error);
      res.status(500).json({ message: "Failed to complete location" });
    }
  });
  
  // Get all users' progress for a specific region (for aggregate map view)
  app.get("/api/world/regions/:id/all-progress", async (req, res) => {
    try {
      const regionId = parseInt(req.params.id);
      // This would need a new storage method - for now return empty
      res.json([]);
    } catch (error) {
      console.error("Failed to fetch region progress:", error);
      res.status(500).json({ message: "Failed to fetch region progress" });
    }
  });
  
  // ==================== World Events (Rumors & Developments) ====================
  
  // Get active rumors for the world or a campaign
  app.get("/api/world/rumors", async (req, res) => {
    try {
      const { campaignId, regionId } = req.query;
      const result = await db.select().from(worldRumors)
        .where(sql`is_active = true ${campaignId ? sql`AND (campaign_id = ${campaignId} OR campaign_id IS NULL)` : sql``} ${regionId ? sql`AND (region_id = ${regionId} OR region_id IS NULL)` : sql``}`)
        .orderBy(sql`created_at DESC`)
        .limit(10);
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch rumors:", error);
      res.status(500).json({ message: "Failed to fetch rumors" });
    }
  });
  
  // Get a random rumor (for tavern experience)
  app.get("/api/world/rumors/random", async (req, res) => {
    try {
      const { regionId } = req.query;
      const result = await db.select().from(worldRumors)
        .where(sql`is_active = true ${regionId ? sql`AND (region_id = ${regionId} OR region_id IS NULL)` : sql``}`)
        .orderBy(sql`RANDOM()`)
        .limit(1);
      
      if (result.length > 0) {
        // Increment times heard
        await db.update(worldRumors)
          .set({ timesHeard: sql`times_heard + 1`, lastHeardAt: new Date().toISOString() })
          .where(sql`id = ${result[0].id}`);
      }
      
      res.json(result[0] || null);
    } catch (error) {
      console.error("Failed to fetch random rumor:", error);
      res.status(500).json({ message: "Failed to fetch rumor" });
    }
  });
  
  // Create a new rumor (DM or system)
  app.post("/api/world/rumors", isAuthenticated, async (req, res) => {
    try {
      const rumor = await db.insert(worldRumors).values({
        ...req.body,
        createdAt: new Date().toISOString()
      }).returning();
      res.json(rumor[0]);
    } catch (error) {
      console.error("Failed to create rumor:", error);
      res.status(500).json({ message: "Failed to create rumor" });
    }
  });
  
  // Get pending world developments for DM
  app.get("/api/world/developments", isAuthenticated, async (req, res) => {
    try {
      const { campaignId } = req.query;
      const result = await db.select().from(worldDevelopments)
        .where(sql`dm_decision IS NULL ${campaignId ? sql`AND (campaign_id = ${campaignId} OR campaign_id IS NULL)` : sql``} AND (show_after IS NULL OR show_after <= ${new Date().toISOString()})`)
        .orderBy(sql`created_at DESC`);
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch developments:", error);
      res.status(500).json({ message: "Failed to fetch developments" });
    }
  });
  
  // DM responds to a world development
  app.post("/api/world/developments/:id/decide", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { decision, notes } = req.body; // decision: adopted, modified, ignored, postponed
      
      const result = await db.update(worldDevelopments)
        .set({ 
          dmDecision: decision, 
          dmNotes: notes,
          decidedAt: new Date().toISOString()
        })
        .where(sql`id = ${id}`)
        .returning();
      
      res.json(result[0]);
    } catch (error) {
      console.error("Failed to update development:", error);
      res.status(500).json({ message: "Failed to update development" });
    }
  });
  
  // Get region pressure/mood data
  app.get("/api/world/regions/:id/pressure", async (req, res) => {
    try {
      const regionId = parseInt(req.params.id);
      const result = await db.select({
        id: worldRegions.id,
        name: worldRegions.name,
        instability: worldRegions.instability,
        danger: worldRegions.danger,
        opportunity: worldRegions.opportunity,
        mystery: worldRegions.mystery,
        currentMood: worldRegions.currentMood
      }).from(worldRegions).where(sql`id = ${regionId}`);
      
      res.json(result[0] || null);
    } catch (error) {
      console.error("Failed to fetch region pressure:", error);
      res.status(500).json({ message: "Failed to fetch region pressure" });
    }
  });
  
  // Get world state summary (subtle player-facing)
  app.get("/api/world/state", async (req, res) => {
    try {
      // Get regions with elevated pressure
      const tensionsRising = await db.select({
        name: worldRegions.name,
        mood: worldRegions.currentMood
      }).from(worldRegions)
        .where(sql`(instability > 50 OR danger > 50 OR mystery > 50)`)
        .limit(3);
      
      const worldState = {
        message: tensionsRising.length > 0 
          ? "The world does not wait forever." 
          : "The realm rests quietly... for now.",
        tensions: tensionsRising.map(r => `${r.name}: ${r.mood}`)
      };
      
      res.json(worldState);
    } catch (error) {
      console.error("Failed to fetch world state:", error);
      res.status(500).json({ message: "Failed to fetch world state" });
    }
  });

  // ==================== World Events & Discoveries ====================

  app.get("/api/world/events", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const events = await db.select()
        .from(worldEvents)
        .where(eq(worldEvents.isActive, true))
        .orderBy(desc(worldEvents.createdAt))
        .limit(limit);
      res.json(events);
    } catch (error) {
      console.error("Failed to fetch world events:", error);
      res.status(500).json({ message: "Failed to fetch world events" });
    }
  });

  app.get("/api/world/events/:regionId", async (req, res) => {
    try {
      const regionId = parseInt(req.params.regionId);
      const events = await db.select()
        .from(worldEvents)
        .where(sql`${worldEvents.isActive} = true AND ${regionId} = ANY(${worldEvents.affectedRegionIds})`)
        .orderBy(desc(worldEvents.createdAt))
        .limit(10);
      res.json(events);
    } catch (error) {
      console.error("Failed to fetch region events:", error);
      res.status(500).json({ message: "Failed to fetch region events" });
    }
  });

  app.post("/api/world/events/generate", isAuthenticated, async (req, res) => {
    try {
      const eventsCreated = await generateWorldEvents();
      const discoveriesCreated = await aggregateDiscoveries();
      res.json({ 
        eventsCreated, 
        discoveriesCreated,
        message: `Generated ${eventsCreated} world events and ${discoveriesCreated} discoveries.`
      });
    } catch (error) {
      console.error("Failed to generate world events:", error);
      res.status(500).json({ message: "Failed to generate world events" });
    }
  });

  app.get("/api/world/discoveries", async (req, res) => {
    try {
      const regionId = req.query.regionId ? parseInt(req.query.regionId as string) : null;
      const query = db.select()
        .from(worldDiscoveries)
        .where(regionId 
          ? and(eq(worldDiscoveries.isPublic, true), eq(worldDiscoveries.regionId, regionId))
          : eq(worldDiscoveries.isPublic, true)
        )
        .orderBy(desc(worldDiscoveries.createdAt))
        .limit(100);
      const discoveries = await query;
      res.json(discoveries);
    } catch (error) {
      console.error("Failed to fetch discoveries:", error);
      res.status(500).json({ message: "Failed to fetch discoveries" });
    }
  });

  app.get("/api/world/discoveries/summary", async (req, res) => {
    try {
      const summary = await db.select({
        regionId: worldDiscoveries.regionId,
        count: sql<number>`COUNT(*)::int`,
        types: sql<string[]>`array_agg(DISTINCT ${worldDiscoveries.discoveryType})`,
        latestDiscovery: sql<string>`MAX(${worldDiscoveries.createdAt})`,
      })
        .from(worldDiscoveries)
        .where(eq(worldDiscoveries.isPublic, true))
        .groupBy(worldDiscoveries.regionId);

      const allRegions = await db.select({
        id: worldRegions.id,
        name: worldRegions.name,
        instability: worldRegions.instability,
        danger: worldRegions.danger,
        opportunity: worldRegions.opportunity,
        mystery: worldRegions.mystery,
        currentMood: worldRegions.currentMood,
      }).from(worldRegions);

      const totalExploredHexes = await db.select({
        count: sql<number>`COUNT(DISTINCT (${campaignExplorationHexes.q}, ${campaignExplorationHexes.r}))::int`
      })
        .from(campaignExplorationHexes)
        .where(eq(campaignExplorationHexes.isExplored, true));

      res.json({
        regionDiscoveries: summary,
        regions: allRegions,
        totalExploredHexes: totalExploredHexes[0]?.count || 0,
      });
    } catch (error) {
      console.error("Failed to fetch discovery summary:", error);
      res.status(500).json({ message: "Failed to fetch discovery summary" });
    }
  });

  app.get("/api/world/whispers/:campaignId", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const whispers = await db.select({
        whisper: worldWhispers,
        event: {
          title: worldEvents.title,
          description: worldEvents.description,
          eventType: worldEvents.eventType,
          severity: worldEvents.severity,
        }
      })
        .from(worldWhispers)
        .leftJoin(worldEvents, eq(worldWhispers.worldEventId, worldEvents.id))
        .where(and(
          eq(worldWhispers.campaignId, campaignId),
          eq(worldWhispers.isDismissed, false)
        ))
        .orderBy(desc(worldWhispers.createdAt))
        .limit(10);
      res.json(whispers);
    } catch (error) {
      console.error("Failed to fetch whispers:", error);
      res.status(500).json({ message: "Failed to fetch whispers" });
    }
  });

  app.post("/api/world/whispers/:id/dismiss", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.update(worldWhispers)
        .set({ isDismissed: true })
        .where(eq(worldWhispers.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to dismiss whisper:", error);
      res.status(500).json({ message: "Failed to dismiss whisper" });
    }
  });

  app.post("/api/world/whispers/:id/read", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.update(worldWhispers)
        .set({ isRead: true })
        .where(eq(worldWhispers.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to mark whisper as read:", error);
      res.status(500).json({ message: "Failed to mark whisper as read" });
    }
  });

  // ========== WORLD MEMORY (Since Last Time...) ==========
  
  // Get world memories for a campaign
  app.get("/api/campaigns/:campaignId/world-memory", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const memoryType = req.query.type as string | undefined;
      const memories = await storage.getWorldMemories(campaignId, memoryType);
      res.json(memories);
    } catch (error) {
      console.error("Failed to fetch world memories:", error);
      res.status(500).json({ message: "Failed to fetch world memories" });
    }
  });
  
  // Create a world memory
  app.post("/api/campaigns/:campaignId/world-memory", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      // Verify user is DM of this campaign
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign || campaign.dmUserId !== req.user.id) {
        return res.status(403).json({ message: "Only the DM can create world memories" });
      }
      const validated = insertWorldMemorySchema.parse({
        ...req.body,
        campaignId
      });
      const memory = await storage.createWorldMemory(validated);
      res.status(201).json(memory);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid world memory data", errors: error.errors });
      }
      console.error("Failed to create world memory:", error);
      res.status(500).json({ message: "Failed to create world memory" });
    }
  });
  
  // Reveal a world memory to players
  app.patch("/api/world-memory/:id/reveal", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const revealed = await storage.revealWorldMemory(id);
      res.json(revealed);
    } catch (error) {
      console.error("Failed to reveal world memory:", error);
      res.status(500).json({ message: "Failed to reveal memory" });
    }
  });
  
}
