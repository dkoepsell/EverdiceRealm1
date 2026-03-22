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
  app.get("/api/users", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Return a list of users with limited fields for security
      const usersList = await db.select({
        id: users.id,
        username: users.username,
        displayName: users.displayName
      }).from(users);
      
      res.json(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Adventure completions endpoint
  app.get("/api/adventure-completions", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = req.user!.id;
      
      // Get all campaigns for this user by querying directly
      const userCampaigns = await db.select().from(campaigns).where(eq(campaigns.userId, userId));
      const completions: any[] = [];
      
      for (const campaign of userCampaigns) {
        // Get sessions for this campaign
        const sessions = await storage.getCampaignSessions(campaign.id);
        
        for (const session of sessions) {
          if (session.storyState) {
            try {
              const storyState = typeof session.storyState === 'string' 
                ? JSON.parse(session.storyState) 
                : session.storyState;
              
              if (storyState.adventureProgress?.isComplete) {
                completions.push({
                  id: session.id,
                  campaignId: campaign.id,
                  campaignTitle: campaign.title,
                  sessionNumber: session.sessionNumber,
                  completedAt: storyState.adventureProgress.completedAt || session.updatedAt,
                  difficulty: campaign.difficulty,
                  encounters: storyState.adventureProgress.encounters,
                  puzzles: storyState.adventureProgress.puzzles,
                  discoveries: storyState.adventureProgress.discoveries
                });
              }
            } catch (e) {
              // Skip sessions with invalid JSON
            }
          }
        }
      }
      
      res.json(completions);
    } catch (error) {
      console.error("Failed to fetch adventure completions:", error);
      res.status(500).json({ message: "Failed to fetch adventure completions" });
    }
  });

  app.get("/api/user-stats", async (req, res) => {
    try {
      // Count total registered users
      const totalUsers = await db.select({ count: sql`COUNT(*)` }).from(users);
      const totalRegistered = Number(totalUsers[0]?.count || 0);
      
      // Count total characters created
      const totalChars = await db.select({ count: sql`COUNT(*)` }).from(characters);
      const totalCharacters = Number(totalChars[0]?.count || 0);
      
      // Count total campaigns created
      const totalCamps = await db.select({ count: sql`COUNT(*)` }).from(campaigns);
      const totalCampaigns = Number(totalCamps[0]?.count || 0);
      
      // Return the stats - public facing community metrics
      res.json({
        totalRegistered,
        totalCharacters,
        totalCampaigns
      });
    } catch (error) {
      console.error("Failed to fetch user statistics:", error);
      res.status(500).json({ message: "Failed to fetch user statistics" });
    }
  });

  // Generate user avatar
  // ========== ADMIN ROUTES ==========
  
  // Get all users with stats (admin only)
  app.get("/api/admin/users", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const usersWithStats = await storage.getAllUsersWithCharacterCounts();
      // Remove passwords from response
      const sanitizedUsers = usersWithStats.map(({ password, ...user }) => user);
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Admin: Failed to fetch users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  
  // Get characters for a specific user (admin only)
  app.get("/api/admin/users/:userId/characters", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const userCharacters = await storage.getCharactersByUserId(userId);
      res.json(userCharacters);
    } catch (error) {
      console.error("Admin: Failed to fetch user characters:", error);
      res.status(500).json({ message: "Failed to fetch user characters" });
    }
  });
  
  // Get all campaigns (admin only) - including archived
  app.get("/api/admin/campaigns", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const activeCampaigns = await storage.getAllCampaigns();
      const archivedCampaigns = await storage.getArchivedCampaigns();
      const allCampaigns = [...activeCampaigns, ...archivedCampaigns];
      res.json(allCampaigns);
    } catch (error) {
      console.error("Admin: Failed to fetch campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });
  
  // Toggle user admin status (admin only)
  app.patch("/api/admin/users/:userId/toggle-admin", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const targetUserId = parseInt(req.params.userId);
      const currentUserId = req.user.id;
      
      // Prevent admin from removing their own admin status
      if (targetUserId === currentUserId) {
        return res.status(400).json({ message: "Cannot modify your own admin status" });
      }
      
      const [user] = await db.select().from(users).where(eq(users.id, targetUserId));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const [updated] = await db
        .update(users)
        .set({ isAdmin: !user.isAdmin })
        .where(eq(users.id, targetUserId))
        .returning();
      
      const { password, ...sanitizedUser } = updated;
      res.json(sanitizedUser);
    } catch (error) {
      console.error("Admin: Failed to toggle admin status:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });
  
  // ===== Analytics Tracking Endpoints =====
  
  // Track user activity event (for frontend tracking)
  app.post("/api/analytics/event", isAuthenticated, async (req: any, res) => {
    try {
      const { sessionId, eventType, eventCategory, eventName, eventData, pageUrl, campaignId, characterId, duration } = req.body;
      await db.insert(userActivityEvents).values({
        userId: req.user.id,
        sessionId: sessionId || 'unknown',
        eventType,
        eventCategory,
        eventName,
        eventData: eventData || {},
        pageUrl,
        campaignId,
        characterId,
        duration,
        createdAt: new Date().toISOString()
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Analytics: Failed to track event:", error);
      res.status(500).json({ message: "Failed to track event" });
    }
  });
  
  // Start/update session analytics
  app.post("/api/analytics/session", isAuthenticated, async (req: any, res) => {
    try {
      const { sessionId, deviceType, browserInfo } = req.body;
      
      // Check if session exists
      const [existing] = await db.select().from(userSessionsAnalytics)
        .where(and(
          eq(userSessionsAnalytics.sessionId, sessionId),
          eq(userSessionsAnalytics.userId, req.user.id)
        ));
      
      if (existing) {
        // Update existing session
        await db.update(userSessionsAnalytics)
          .set({ endedAt: new Date().toISOString() })
          .where(eq(userSessionsAnalytics.id, existing.id));
      } else {
        // Create new session
        await db.insert(userSessionsAnalytics).values({
          userId: req.user.id,
          sessionId,
          startedAt: new Date().toISOString(),
          deviceType,
          browserInfo
        });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Analytics: Failed to track session:", error);
      res.status(500).json({ message: "Failed to track session" });
    }
  });
  
  // ===== Admin Analytics Endpoints =====
  
  // Get analytics overview (admin only)
  app.get("/api/admin/analytics/overview", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // Get user counts
      const allUsers = await db.select({ count: sql<number>`count(*)` }).from(users);
      const recentUsers = await db.select({ count: sql<number>`count(*)` }).from(users)
        .where(gte(users.createdAt, last7Days));
      
      // Get session counts
      const todaySessions = await db.select({ count: sql<number>`count(*)` }).from(userSessionsAnalytics)
        .where(gte(userSessionsAnalytics.startedAt, today));
      const weekSessions = await db.select({ count: sql<number>`count(*)` }).from(userSessionsAnalytics)
        .where(gte(userSessionsAnalytics.startedAt, last7Days));
      
      // Get activity counts
      const todayEvents = await db.select({ count: sql<number>`count(*)` }).from(userActivityEvents)
        .where(gte(userActivityEvents.createdAt, today));
      const weekEvents = await db.select({ count: sql<number>`count(*)` }).from(userActivityEvents)
        .where(gte(userActivityEvents.createdAt, last7Days));
      
      // Get dice roll counts
      const todayDice = await db.select({ count: sql<number>`count(*)` }).from(diceRolls)
        .where(gte(diceRolls.createdAt, today));
      const weekDice = await db.select({ count: sql<number>`count(*)` }).from(diceRolls)
        .where(gte(diceRolls.createdAt, last7Days));
      
      // Get campaign counts  
      const activeCampaigns = await db.select({ count: sql<number>`count(*)` }).from(campaigns)
        .where(and(eq(campaigns.isCompleted, false), eq(campaigns.isArchived, false)));
      const weekNewCampaigns = await db.select({ count: sql<number>`count(*)` }).from(campaigns)
        .where(gte(campaigns.createdAt, last7Days));
      
      // Get character counts
      const totalCharacters = await db.select({ count: sql<number>`count(*)` }).from(characters);
      const weekNewCharacters = await db.select({ count: sql<number>`count(*)` }).from(characters)
        .where(gte(characters.createdAt, last7Days));
      
      res.json({
        users: {
          total: Number(allUsers[0]?.count) || 0,
          newThisWeek: Number(recentUsers[0]?.count) || 0
        },
        sessions: {
          today: Number(todaySessions[0]?.count) || 0,
          thisWeek: Number(weekSessions[0]?.count) || 0
        },
        activity: {
          eventsToday: Number(todayEvents[0]?.count) || 0,
          eventsThisWeek: Number(weekEvents[0]?.count) || 0
        },
        diceRolls: {
          today: Number(todayDice[0]?.count) || 0,
          thisWeek: Number(weekDice[0]?.count) || 0
        },
        campaigns: {
          active: Number(activeCampaigns[0]?.count) || 0,
          newThisWeek: Number(weekNewCampaigns[0]?.count) || 0
        },
        characters: {
          total: Number(totalCharacters[0]?.count) || 0,
          newThisWeek: Number(weekNewCharacters[0]?.count) || 0
        }
      });
    } catch (error) {
      console.error("Admin Analytics: Failed to fetch overview:", error);
      res.status(500).json({ message: "Failed to fetch analytics overview" });
    }
  });
  
  // Get activity breakdown by category (admin only)
  app.get("/api/admin/analytics/activity-breakdown", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      const breakdown = await db.select({
        category: userActivityEvents.eventCategory,
        count: sql<number>`count(*)`
      })
        .from(userActivityEvents)
        .where(gte(userActivityEvents.createdAt, sinceDate))
        .groupBy(userActivityEvents.eventCategory);
      
      res.json(breakdown);
    } catch (error) {
      console.error("Admin Analytics: Failed to fetch activity breakdown:", error);
      res.status(500).json({ message: "Failed to fetch activity breakdown" });
    }
  });
  
  // Get top features (admin only)
  app.get("/api/admin/analytics/top-features", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      const features = await db.select({
        feature: userActivityEvents.eventName,
        count: sql<number>`count(*)`
      })
        .from(userActivityEvents)
        .where(gte(userActivityEvents.createdAt, sinceDate))
        .groupBy(userActivityEvents.eventName)
        .orderBy(sql`count(*) DESC`)
        .limit(15);
      
      res.json(features);
    } catch (error) {
      console.error("Admin Analytics: Failed to fetch top features:", error);
      res.status(500).json({ message: "Failed to fetch top features" });
    }
  });
  
  // Get user activity timeline (admin only)
  app.get("/api/admin/analytics/timeline", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 14;
      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      const timeline = await db.select({
        date: sql<string>`DATE(${userActivityEvents.createdAt})`,
        count: sql<number>`count(*)`
      })
        .from(userActivityEvents)
        .where(gte(userActivityEvents.createdAt, sinceDate))
        .groupBy(sql`DATE(${userActivityEvents.createdAt})`)
        .orderBy(sql`DATE(${userActivityEvents.createdAt})`);
      
      res.json(timeline);
    } catch (error) {
      console.error("Admin Analytics: Failed to fetch timeline:", error);
      res.status(500).json({ message: "Failed to fetch timeline" });
    }
  });
  
  // Get most active users (admin only)
  app.get("/api/admin/analytics/active-users", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      const activeUsers = await db.select({
        userId: userActivityEvents.userId,
        eventCount: sql<number>`count(*)`,
        lastActive: sql<string>`max(${userActivityEvents.createdAt})`
      })
        .from(userActivityEvents)
        .where(gte(userActivityEvents.createdAt, sinceDate))
        .groupBy(userActivityEvents.userId)
        .orderBy(sql`count(*) DESC`)
        .limit(10);
      
      // Get user details for the active users
      const userDetails = await Promise.all(
        activeUsers.map(async (au) => {
          const [user] = await db.select({
            id: users.id,
            username: users.username,
            displayName: users.displayName
          }).from(users).where(eq(users.id, au.userId));
          return {
            ...au,
            username: user?.username || 'Unknown',
            displayName: user?.displayName || user?.username || 'Unknown'
          };
        })
      );
      
      res.json(userDetails);
    } catch (error) {
      console.error("Admin Analytics: Failed to fetch active users:", error);
      res.status(500).json({ message: "Failed to fetch active users" });
    }
  });
  
  // Get session statistics (admin only)
  app.get("/api/admin/analytics/sessions", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      const sessions = await db.select()
        .from(userSessionsAnalytics)
        .where(gte(userSessionsAnalytics.startedAt, sinceDate))
        .orderBy(desc(userSessionsAnalytics.startedAt))
        .limit(50);
      
      res.json(sessions);
    } catch (error) {
      console.error("Admin Analytics: Failed to fetch sessions:", error);
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  // Get page-level analytics (time spent per page)
  app.get("/api/admin/analytics/page-stats", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      // Get page view counts
      const pageViews = await db.select({
        page: sql<string>`(${userActivityEvents.eventData}->>'page')`,
        views: sql<number>`count(*)`,
        uniqueUsers: sql<number>`count(distinct ${userActivityEvents.userId})`
      })
        .from(userActivityEvents)
        .where(and(
          gte(userActivityEvents.createdAt, sinceDate),
          eq(userActivityEvents.eventName, "page_view")
        ))
        .groupBy(sql`${userActivityEvents.eventData}->>'page'`)
        .orderBy(sql`count(*) DESC`)
        .limit(20);
      
      // Get time spent from page_exit events only (where duration is stored)
      const pageDurations = await db.select({
        page: sql<string>`(${userActivityEvents.eventData}->>'page')`,
        avgTimeSpentMs: sql<number>`avg(${userActivityEvents.duration})`,
        totalTimeSpentMs: sql<number>`sum(${userActivityEvents.duration})`
      })
        .from(userActivityEvents)
        .where(and(
          gte(userActivityEvents.createdAt, sinceDate),
          eq(userActivityEvents.eventName, "page_exit"),
          sql`${userActivityEvents.duration} IS NOT NULL AND ${userActivityEvents.duration} > 0`
        ))
        .groupBy(sql`${userActivityEvents.eventData}->>'page'`);
      
      // Merge the data
      const durationMap = new Map(pageDurations.map(d => [d.page, d]));
      
      res.json(pageViews.map(p => {
        const duration = durationMap.get(p.page);
        return {
          page: p.page || '/',
          views: Number(p.views) || 0,
          avgTimeSpentSeconds: duration ? Math.round((Number(duration.avgTimeSpentMs) || 0) / 1000) : 0,
          totalTimeSpentMinutes: duration ? Math.round((Number(duration.totalTimeSpentMs) || 0) / 60000) : 0,
          uniqueUsers: Number(p.uniqueUsers) || 0
        };
      }));
    } catch (error) {
      console.error("Admin Analytics: Failed to fetch page stats:", error);
      res.status(500).json({ message: "Failed to fetch page stats" });
    }
  });

  // Get click analytics
  app.get("/api/admin/analytics/clicks", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      // Only include clicks that have meaningful identifying info (ID or text)
      const clickStats = await db.select({
        elementType: sql<string>`(${userActivityEvents.eventData}->>'elementType')`,
        elementId: sql<string>`(${userActivityEvents.eventData}->>'elementId')`,
        elementText: sql<string>`(${userActivityEvents.eventData}->>'elementText')`,
        clicks: sql<number>`count(*)`,
        uniqueUsers: sql<number>`count(distinct ${userActivityEvents.userId})`
      })
        .from(userActivityEvents)
        .where(and(
          gte(userActivityEvents.createdAt, sinceDate),
          eq(userActivityEvents.eventName, "click"),
          sql`(${userActivityEvents.eventData}->>'elementId' IS NOT NULL AND ${userActivityEvents.eventData}->>'elementId' != '') OR (${userActivityEvents.eventData}->>'elementText' IS NOT NULL AND ${userActivityEvents.eventData}->>'elementText' != '')`
        ))
        .groupBy(
          sql`${userActivityEvents.eventData}->>'elementType'`,
          sql`${userActivityEvents.eventData}->>'elementId'`,
          sql`${userActivityEvents.eventData}->>'elementText'`
        )
        .orderBy(sql`count(*) DESC`)
        .limit(30);
      
      res.json(clickStats
        .filter(c => c.elementId || c.elementText) // Extra filter to ensure we have meaningful data
        .map(c => ({
          elementType: c.elementType || 'element',
          elementId: c.elementId || '-',
          elementText: c.elementText?.substring(0, 50) || '-',
          clicks: Number(c.clicks) || 0,
          uniqueUsers: Number(c.uniqueUsers) || 0
        })));
    } catch (error) {
      console.error("Admin Analytics: Failed to fetch click stats:", error);
      res.status(500).json({ message: "Failed to fetch click stats" });
    }
  });

  // Get detailed event breakdown with granular data
  app.get("/api/admin/analytics/detailed-events", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      const events = await db.select({
        eventType: userActivityEvents.eventType,
        eventCategory: userActivityEvents.eventCategory,
        eventName: userActivityEvents.eventName,
        count: sql<number>`count(*)`,
        avgDuration: sql<number>`avg(${userActivityEvents.duration})`,
        uniqueUsers: sql<number>`count(distinct ${userActivityEvents.userId})`
      })
        .from(userActivityEvents)
        .where(gte(userActivityEvents.createdAt, sinceDate))
        .groupBy(
          userActivityEvents.eventType,
          userActivityEvents.eventCategory,
          userActivityEvents.eventName
        )
        .orderBy(sql`count(*) DESC`)
        .limit(50);
      
      res.json(events.map(e => ({
        eventType: e.eventType,
        category: e.eventCategory,
        name: e.eventName,
        count: Number(e.count) || 0,
        avgDurationMs: Number(e.avgDuration) || 0,
        uniqueUsers: Number(e.uniqueUsers) || 0
      })));
    } catch (error) {
      console.error("Admin Analytics: Failed to fetch detailed events:", error);
      res.status(500).json({ message: "Failed to fetch detailed events" });
    }
  });

  // ============ Demo Analytics Routes ============
  
  // Track demo events (public - no auth required)
  app.post("/api/demo/track", async (req, res) => {
    try {
      const { sessionId, eventType, eventData } = req.body;
      
      if (!sessionId || !eventType) {
        return res.status(400).json({ message: "sessionId and eventType are required" });
      }
      
      await db.insert(demoAnalytics).values({
        sessionId,
        eventType,
        eventData: eventData || {},
        userAgent: req.headers['user-agent'] || null,
        referrer: req.headers.referer || null,
        createdAt: new Date().toISOString()
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Demo Analytics: Failed to track event:", error);
      res.status(500).json({ message: "Failed to track event" });
    }
  });
  
  // Mark demo session as converted (when user signs up)
  app.post("/api/demo/convert", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ message: "sessionId is required" });
      }
      
      // Record conversion event
      await db.insert(demoAnalytics).values({
        sessionId,
        eventType: 'converted',
        eventData: { userId },
        convertedUserId: userId,
        userAgent: req.headers['user-agent'] || null,
        referrer: req.headers.referer || null,
        createdAt: new Date().toISOString()
      });
      
      // Also update any existing demo events with converted user ID
      await db.update(demoAnalytics)
        .set({ convertedUserId: userId })
        .where(eq(demoAnalytics.sessionId, sessionId));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Demo Analytics: Failed to mark conversion:", error);
      res.status(500).json({ message: "Failed to mark conversion" });
    }
  });
  
  // Get demo analytics overview (admin only)
  app.get("/api/admin/analytics/demo", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      // Get total demo starts
      const startedResult = await db.select({
        count: sql<number>`count(distinct ${demoAnalytics.sessionId})`
      })
        .from(demoAnalytics)
        .where(and(
          eq(demoAnalytics.eventType, 'started'),
          gte(demoAnalytics.createdAt, sinceDate)
        ));
      
      // Get completed demos
      const completedResult = await db.select({
        count: sql<number>`count(distinct ${demoAnalytics.sessionId})`
      })
        .from(demoAnalytics)
        .where(and(
          eq(demoAnalytics.eventType, 'completed'),
          gte(demoAnalytics.createdAt, sinceDate)
        ));
      
      // Get conversions
      const convertedResult = await db.select({
        count: sql<number>`count(distinct ${demoAnalytics.sessionId})`
      })
        .from(demoAnalytics)
        .where(and(
          eq(demoAnalytics.eventType, 'converted'),
          gte(demoAnalytics.createdAt, sinceDate)
        ));
      
      // Get character selection breakdown
      const characterBreakdown = await db.select({
        character: sql<string>`${demoAnalytics.eventData}->>'characterId'`,
        count: sql<number>`count(*)`
      })
        .from(demoAnalytics)
        .where(and(
          eq(demoAnalytics.eventType, 'character_selected'),
          gte(demoAnalytics.createdAt, sinceDate)
        ))
        .groupBy(sql`${demoAnalytics.eventData}->>'characterId'`);
      
      // Get adventure selection breakdown
      const adventureBreakdown = await db.select({
        adventure: sql<string>`${demoAnalytics.eventData}->>'adventureId'`,
        count: sql<number>`count(*)`
      })
        .from(demoAnalytics)
        .where(and(
          eq(demoAnalytics.eventType, 'adventure_selected'),
          gte(demoAnalytics.createdAt, sinceDate)
        ))
        .groupBy(sql`${demoAnalytics.eventData}->>'adventureId'`);
      
      // Get daily demo stats
      const dailyStats = await db.select({
        date: sql<string>`date(${demoAnalytics.createdAt})`,
        started: sql<number>`count(distinct case when ${demoAnalytics.eventType} = 'started' then ${demoAnalytics.sessionId} end)`,
        completed: sql<number>`count(distinct case when ${demoAnalytics.eventType} = 'completed' then ${demoAnalytics.sessionId} end)`,
        converted: sql<number>`count(distinct case when ${demoAnalytics.eventType} = 'converted' then ${demoAnalytics.sessionId} end)`
      })
        .from(demoAnalytics)
        .where(gte(demoAnalytics.createdAt, sinceDate))
        .groupBy(sql`date(${demoAnalytics.createdAt})`)
        .orderBy(sql`date(${demoAnalytics.createdAt})`);
      
      // Get drop-off analysis (how far users get)
      const funnelStats = await db.select({
        eventType: demoAnalytics.eventType,
        count: sql<number>`count(distinct ${demoAnalytics.sessionId})`
      })
        .from(demoAnalytics)
        .where(gte(demoAnalytics.createdAt, sinceDate))
        .groupBy(demoAnalytics.eventType);
      
      const started = Number(startedResult[0]?.count) || 0;
      const completed = Number(completedResult[0]?.count) || 0;
      const converted = Number(convertedResult[0]?.count) || 0;
      
      res.json({
        overview: {
          started,
          completed,
          converted,
          completionRate: started > 0 ? Math.round((completed / started) * 100) : 0,
          conversionRate: started > 0 ? Math.round((converted / started) * 100) : 0,
          completedToConversionRate: completed > 0 ? Math.round((converted / completed) * 100) : 0
        },
        characterBreakdown: characterBreakdown.map(c => ({
          character: c.character || 'unknown',
          count: Number(c.count)
        })),
        adventureBreakdown: adventureBreakdown.map(a => ({
          adventure: a.adventure || 'unknown',
          count: Number(a.count)
        })),
        dailyStats: dailyStats.map(d => ({
          date: d.date,
          started: Number(d.started),
          completed: Number(d.completed),
          converted: Number(d.converted)
        })),
        funnelStats: funnelStats.map(f => ({
          eventType: f.eventType,
          count: Number(f.count)
        }))
      });
    } catch (error) {
      console.error("Admin Analytics: Failed to fetch demo analytics:", error);
      res.status(500).json({ message: "Failed to fetch demo analytics" });
    }
  });

}
