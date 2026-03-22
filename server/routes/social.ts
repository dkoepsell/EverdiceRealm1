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
  // ========== PLAYER GROUPS (Parties, Guilds, Factions) ==========
  
  // Get all public groups or user's groups
  app.get("/api/groups", async (req, res) => {
    try {
      const userId = req.isAuthenticated() ? (req.user as any).id : undefined;
      const groups = await storage.getPlayerGroups(userId);
      // Add member count to each group
      const groupsWithMemberCount = await Promise.all(groups.map(async (group) => {
        const members = await storage.getPlayerGroupMembers(group.id);
        return { ...group, memberCount: members.length };
      }));
      res.json(groupsWithMemberCount);
    } catch (error) {
      console.error("Failed to fetch groups:", error);
      res.status(500).json({ message: "Failed to fetch groups" });
    }
  });
  
  // Get a specific group with members
  app.get("/api/groups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const group = await storage.getPlayerGroup(id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      const members = await storage.getPlayerGroupMembers(id);
      // Enrich members with usernames and avatars
      const enrichedMembers = await Promise.all(members.map(async (member) => {
        const user = await storage.getUser(member.userId);
        return { ...member, username: user?.username || 'Unknown', avatarUrl: user?.avatarUrl || null };
      }));
      res.json({ ...group, members: enrichedMembers });
    } catch (error) {
      console.error("Failed to fetch group:", error);
      res.status(500).json({ message: "Failed to fetch group" });
    }
  });
  
  // Create a new group
  app.post("/api/groups", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validated = insertPlayerGroupSchema.parse({
        ...req.body,
        founderId: userId,
        leaderIds: [userId]
      });
      const group = await storage.createPlayerGroup(validated);
      // Add founder as member
      await storage.addPlayerGroupMember({
        groupId: group.id,
        userId,
        role: "founder"
      });
      res.status(201).json(group);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid group data", errors: error.errors });
      }
      console.error("Failed to create group:", error);
      res.status(500).json({ message: "Failed to create group" });
    }
  });
  
  // Update a group
  app.patch("/api/groups/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const group = await storage.getPlayerGroup(id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      if (group.founderId !== req.user.id && !group.leaderIds?.includes(req.user.id)) {
        return res.status(403).json({ message: "Not authorized to update this group" });
      }
      const updated = await storage.updatePlayerGroup(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Failed to update group:", error);
      res.status(500).json({ message: "Failed to update group" });
    }
  });
  
  // Delete a group
  app.delete("/api/groups/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const group = await storage.getPlayerGroup(id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      if (group.founderId !== req.user.id) {
        return res.status(403).json({ message: "Only the founder can delete this group" });
      }
      await storage.deletePlayerGroup(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete group:", error);
      res.status(500).json({ message: "Failed to delete group" });
    }
  });
  
  // Add member to group
  app.post("/api/groups/:id/members", isAuthenticated, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const group = await storage.getPlayerGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      // For now, users can add themselves; later could add invite system
      const member = await storage.addPlayerGroupMember({
        groupId,
        userId: req.body.userId || req.user.id,
        characterId: req.body.characterId,
        role: req.body.role || "member",
        title: req.body.title
      });
      res.status(201).json(member);
    } catch (error) {
      console.error("Failed to add group member:", error);
      res.status(500).json({ message: "Failed to add member" });
    }
  });
  
  // Remove member from group
  app.delete("/api/groups/:groupId/members/:memberId", isAuthenticated, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const memberId = parseInt(req.params.memberId);
      const group = await storage.getPlayerGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      await storage.removePlayerGroupMember(memberId);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to remove group member:", error);
      res.status(500).json({ message: "Failed to remove member" });
    }
  });
  
  // ========== GROUP INVITATIONS ==========
  
  // Get invitations for a group
  app.get("/api/groups/:id/invitations", isAuthenticated, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const group = await storage.getPlayerGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      // Only leaders can see invitations
      if (group.founderId !== req.user.id && !group.leaderIds?.includes(req.user.id)) {
        return res.status(403).json({ message: "Only leaders can view invitations" });
      }
      const invitations = await storage.getGroupInvitations(groupId);
      res.json(invitations);
    } catch (error) {
      console.error("Failed to fetch group invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });
  
  // Get user's group memberships with group details
  app.get("/api/user/memberships", isAuthenticated, async (req: any, res) => {
    try {
      const memberships = await storage.getUserGroupMemberships(req.user.id);
      const enriched = await Promise.all(memberships.map(async (m) => {
        const group = await storage.getPlayerGroup(m.groupId);
        return {
          ...m,
          groupName: group?.name,
          groupType: group?.type,
          groupMotto: group?.motto
        };
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Failed to fetch user memberships:", error);
      res.status(500).json({ message: "Failed to fetch memberships" });
    }
  });
  
  // Invite a player to a group
  app.post("/api/groups/:id/invite", isAuthenticated, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const group = await storage.getPlayerGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      // Only leaders can invite
      if (group.founderId !== req.user.id && !group.leaderIds?.includes(req.user.id)) {
        return res.status(403).json({ message: "Only leaders can invite members" });
      }
      // Find user by username
      const invitee = await storage.findUserByUsername(req.body.username);
      if (!invitee) {
        return res.status(404).json({ message: "User not found" });
      }
      if (invitee.id === req.user.id) {
        return res.status(400).json({ message: "You cannot invite yourself" });
      }
      // Check if already a member
      const members = await storage.getPlayerGroupMembers(groupId);
      if (members.some(m => m.userId === invitee.id)) {
        return res.status(400).json({ message: "User is already a member" });
      }
      // Check for existing pending invitation
      const existingInvites = await storage.getGroupInvitations(groupId);
      if (existingInvites.some(inv => inv.inviteeId === invitee.id && inv.status === "pending")) {
        return res.status(400).json({ message: "User already has a pending invitation" });
      }
      const invitation = await storage.createGroupInvitation({
        groupId,
        inviterId: req.user.id,
        inviteeId: invitee.id,
        message: req.body.message
      });
      res.status(201).json(invitation);
    } catch (error) {
      console.error("Failed to create invitation:", error);
      res.status(500).json({ message: "Failed to send invitation" });
    }
  });
  
  // Accept a group invitation (uses specific path to avoid conflict with campaign invitations)
  app.post("/api/group-invitations/:id/accept", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const invitation = await storage.getGroupInvitation(id);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      if (invitation.inviteeId !== req.user.id) {
        return res.status(403).json({ message: "This invitation is not for you" });
      }
      if (invitation.status !== "pending") {
        return res.status(400).json({ message: "Invitation has already been responded to" });
      }
      // Update invitation status
      await storage.respondToInvitation(id, "accepted");
      // Add user to group
      const member = await storage.addPlayerGroupMember({
        groupId: invitation.groupId,
        userId: req.user.id,
        role: "member"
      });
      res.json({ success: true, member });
    } catch (error) {
      console.error("Failed to accept invitation:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });
  
  // Decline a group invitation (uses specific path to avoid conflict with campaign invitations)
  app.post("/api/group-invitations/:id/decline", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const invitation = await storage.getGroupInvitation(id);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      if (invitation.inviteeId !== req.user.id) {
        return res.status(403).json({ message: "This invitation is not for you" });
      }
      if (invitation.status !== "pending") {
        return res.status(400).json({ message: "Invitation has already been responded to" });
      }
      await storage.respondToInvitation(id, "declined");
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to decline invitation:", error);
      res.status(500).json({ message: "Failed to decline invitation" });
    }
  });
  
  // ========== GROUP MESSAGE BOARD ==========
  
  // Get messages for a group
  app.get("/api/groups/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.id);
      // Verify user is a member
      const members = await storage.getPlayerGroupMembers(groupId);
      if (!members.some(m => m.userId === req.user.id)) {
        return res.status(403).json({ message: "You are not a member of this group" });
      }
      const messages = await storage.getGroupMessages(groupId);
      // Enrich with author names
      const enrichedMessages = await Promise.all(messages.map(async (msg) => {
        const author = await storage.getUser(msg.authorId);
        return {
          ...msg,
          authorName: author?.username || 'Unknown'
        };
      }));
      res.json(enrichedMessages);
    } catch (error) {
      console.error("Failed to fetch group messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });
  
  // Create a message
  app.post("/api/groups/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.id);
      // Verify user is a member
      const members = await storage.getPlayerGroupMembers(groupId);
      if (!members.some(m => m.userId === req.user.id)) {
        return res.status(403).json({ message: "You are not a member of this group" });
      }
      const message = await storage.createGroupMessage({
        groupId,
        authorId: req.user.id,
        title: req.body.title,
        content: req.body.content,
        isPinned: false,
        isAnnouncement: false,
      });
      const author = await storage.getUser(req.user.id);
      res.status(201).json({
        ...message,
        authorName: author?.username || 'Unknown'
      });
    } catch (error) {
      console.error("Failed to create message:", error);
      res.status(500).json({ message: "Failed to post message" });
    }
  });
  
  // Delete a message
  app.delete("/api/groups/:groupId/messages/:messageId", isAuthenticated, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const messageId = parseInt(req.params.messageId);
      // Verify user is member and author or leader
      const members = await storage.getPlayerGroupMembers(groupId);
      const membership = members.find(m => m.userId === req.user.id);
      if (!membership) {
        return res.status(403).json({ message: "You are not a member of this group" });
      }
      const message = await storage.getGroupMessage(messageId);
      if (!message || message.groupId !== groupId) {
        return res.status(404).json({ message: "Message not found" });
      }
      // Only author or leaders can delete
      const isLeader = membership.role === 'founder' || membership.role === 'leader';
      if (message.authorId !== req.user.id && !isLeader) {
        return res.status(403).json({ message: "You can only delete your own messages" });
      }
      await storage.deleteGroupMessage(messageId);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete message:", error);
      res.status(500).json({ message: "Failed to delete message" });
    }
  });
  
  // Toggle pin status (leaders only)
  app.patch("/api/groups/:groupId/messages/:messageId/pin", isAuthenticated, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const messageId = parseInt(req.params.messageId);
      // Verify user is a leader
      const members = await storage.getPlayerGroupMembers(groupId);
      const membership = members.find(m => m.userId === req.user.id);
      if (!membership || (membership.role !== 'founder' && membership.role !== 'leader')) {
        return res.status(403).json({ message: "Only leaders can pin messages" });
      }
      const message = await storage.getGroupMessage(messageId);
      if (!message || message.groupId !== groupId) {
        return res.status(404).json({ message: "Message not found" });
      }
      const updated = await storage.toggleGroupMessagePin(messageId);
      res.json(updated);
    } catch (error) {
      console.error("Failed to pin message:", error);
      res.status(500).json({ message: "Failed to pin message" });
    }
  });
  
  app.get("/api/hearth/snapshot", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const now = new Date().toISOString();
      const today = new Date().toISOString().split('T')[0];

      // Get current murmur
      const murmurs = await db.select().from(hearthMurmur)
        .where(and(
          sql`${hearthMurmur.activeFrom} <= ${today}`,
          sql`${hearthMurmur.activeTo} >= ${today}`
        ))
        .limit(5);
      const currentMurmur = murmurs.length > 0 
        ? murmurs[Math.floor(Math.random() * murmurs.length)]
        : { text: "The Hall is quiet tonight." };

      // Get user's hearth state
      let userState = await db.select().from(hearthUserState)
        .where(eq(hearthUserState.userId, userId))
        .limit(1);
      
      let isReturning = false;
      if (userState.length === 0) {
        // First visit - create state
        await db.insert(hearthUserState).values({
          userId,
          seatZone: "fire",
          lastVisitAt: now,
          returnStreak: 1
        });
        userState = [{ userId, seatZone: "fire", lastVisitAt: now, quietModeDefault: false, returnStreak: 1, lastDepartureNote: null }];
      } else {
        isReturning = true;
        // Update visit
        const lastVisit = userState[0].lastVisitAt ? new Date(userState[0].lastVisitAt) : new Date();
        const daysSince = Math.floor((Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));
        const newStreak = daysSince <= 1 ? (userState[0].returnStreak || 0) + 1 : 1;
        
        await db.update(hearthUserState)
          .set({ lastVisitAt: now, returnStreak: newStreak })
          .where(eq(hearthUserState.userId, userId));
      }

      // Get presence list (active users)
      const activePresence = await db.select({
        presence: hearthPresence,
        user: { id: users.id, displayName: users.displayName, username: users.username }
      })
        .from(hearthPresence)
        .leftJoin(users, eq(hearthPresence.userId, users.id))
        .where(sql`${hearthPresence.expiresAt} > ${now}`)
        .limit(12);

      // Get board posts (non-deleted, recent first)
      const boardPosts = await db.select({
        post: hearthBoardPosts,
        user: { id: users.id, displayName: users.displayName, username: users.username }
      })
        .from(hearthBoardPosts)
        .leftJoin(users, eq(hearthBoardPosts.userId, users.id))
        .where(sql`${hearthBoardPosts.deletedAt} IS NULL`)
        .orderBy(desc(hearthBoardPosts.pinned), desc(hearthBoardPosts.createdAt))
        .limit(20);

      // Get recent hearth events (memories)
      const events = await db.select({
        event: hearthEvents,
        user: { id: users.id, displayName: users.displayName, username: users.username }
      })
        .from(hearthEvents)
        .leftJoin(users, eq(hearthEvents.userId, users.id))
        .orderBy(desc(hearthEvents.createdAt))
        .limit(20);

      // Select an arrival line
      const arrivalLine = isReturning && userState[0].returnStreak && userState[0].returnStreak > 3
        ? "The Hearth kept your seat. Welcome back."
        : arrivalLines[Math.floor(Math.random() * arrivalLines.length)];

      res.json({
        location: {
          name: "The Lantern Hall",
          murmur: currentMurmur.text
        },
        me: {
          userId,
          seatZone: userState[0].seatZone || "fire",
          quietMode: userState[0].quietModeDefault || false,
          arrivalLine,
          returnStreak: userState[0].returnStreak || 1
        },
        presence: activePresence.map(p => ({
          userId: p.presence.userId,
          displayName: p.user?.displayName || p.user?.username || "Anonymous",
          seatZone: p.presence.seatZone,
          statusText: p.presence.statusText || seatZoneStatuses[p.presence.seatZone] || "resting"
        })),
        board: {
          pinned: boardPosts.filter(p => p.post.pinned).map(p => ({
            id: p.post.id,
            category: p.post.category,
            title: p.post.title,
            body: p.post.body,
            userId: p.post.userId,
            displayName: p.user?.displayName || p.user?.username || "Anonymous",
            createdAt: p.post.createdAt
          })),
          recent: boardPosts.filter(p => !p.post.pinned).slice(0, 10).map(p => ({
            id: p.post.id,
            category: p.post.category,
            title: p.post.title,
            body: p.post.body,
            userId: p.post.userId,
            displayName: p.user?.displayName || p.user?.username || "Anonymous",
            createdAt: p.post.createdAt
          }))
        },
        events: events.map(e => ({
          id: e.event.id,
          type: e.event.type,
          displayName: e.user?.displayName || e.user?.username || "The Hall",
          payload: e.event.payload,
          createdAt: e.event.createdAt,
          text: formatHearthEvent(e.event, e.user?.displayName || e.user?.username)
        }))
      });
    } catch (error) {
      console.error("Failed to get hearth snapshot:", error);
      res.status(500).json({ message: "Failed to load the Hearth" });
    }
  });

  // POST /api/hearth/presence/ping - Update presence
  app.post("/api/hearth/presence/ping", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { seatZone, statusText } = req.body;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 2 * 60 * 1000).toISOString(); // 2 minutes

      // Upsert presence
      await db.insert(hearthPresence)
        .values({
          userId,
          seatZone: seatZone || "fire",
          statusText: statusText || seatZoneStatuses[seatZone] || "by the fire",
          lastPingAt: now.toISOString(),
          expiresAt
        })
        .onConflictDoUpdate({
          target: hearthPresence.userId,
          set: {
            seatZone: seatZone || "fire",
            statusText: statusText || seatZoneStatuses[seatZone] || "by the fire",
            lastPingAt: now.toISOString(),
            expiresAt
          }
        });

      res.json({ success: true, expiresAt });
    } catch (error) {
      console.error("Failed to update presence:", error);
      res.status(500).json({ message: "Failed to update presence" });
    }
  });

  // POST /api/hearth/board - Create a board post
  app.post("/api/hearth/board", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { category, title, body } = req.body;

      if (!category || !title) {
        return res.status(400).json({ message: "Category and title are required" });
      }

      const validCategories = ["message", "hook", "lfg", "dm_call", "gift"];
      if (!validCategories.includes(category)) {
        return res.status(400).json({ message: "Invalid category" });
      }

      const [post] = await db.insert(hearthBoardPosts).values({
        userId,
        category,
        title: title.slice(0, 80),
        body: body?.slice(0, 500),
        createdAt: new Date().toISOString()
      }).returning();

      // Log board post event
      await db.insert(hearthEvents).values({
        type: "board_post",
        userId,
        payload: { postId: post.id, category, title: title.slice(0, 40) },
        createdAt: new Date().toISOString()
      });

      res.json({ success: true, post });
    } catch (error) {
      console.error("Failed to create board post:", error);
      res.status(500).json({ message: "Failed to post to board" });
    }
  });

  // DELETE /api/hearth/board/:postId - Delete own post
  app.delete("/api/hearth/board/:postId", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const postId = parseInt(req.params.postId);

      const [post] = await db.select().from(hearthBoardPosts)
        .where(eq(hearthBoardPosts.id, postId))
        .limit(1);

      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      if (post.userId !== userId) {
        return res.status(403).json({ message: "Cannot delete another's post" });
      }

      await db.update(hearthBoardPosts)
        .set({ deletedAt: new Date().toISOString() })
        .where(eq(hearthBoardPosts.id, postId));

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete post:", error);
      res.status(500).json({ message: "Failed to delete post" });
    }
  });

  // POST /api/hearth/toast - Raise a toast
  app.post("/api/hearth/toast", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { text } = req.body;

      if (!text || text.length > 120) {
        return res.status(400).json({ message: "Toast must be 1-120 characters" });
      }

      await db.insert(hearthEvents).values({
        type: "toast",
        userId,
        payload: { text: text.slice(0, 120) },
        createdAt: new Date().toISOString()
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to create toast:", error);
      res.status(500).json({ message: "Failed to raise toast" });
    }
  });

  // POST /api/hearth/mark - Leave a mark
  app.post("/api/hearth/mark", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { mark } = req.body;

      const validMarks = ["d6", "candle", "bootprint", "tankard", "quill"];
      if (!mark || !validMarks.includes(mark)) {
        return res.status(400).json({ message: "Invalid mark type" });
      }

      await db.insert(hearthEvents).values({
        type: "mark",
        userId,
        payload: { mark },
        createdAt: new Date().toISOString()
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to leave mark:", error);
      res.status(500).json({ message: "Failed to leave mark" });
    }
  });

  // POST /api/hearth/departure - Leave a departure note
  app.post("/api/hearth/departure", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { note } = req.body;

      // Update user state with departure note
      await db.update(hearthUserState)
        .set({ lastDepartureNote: note?.slice(0, 120) || null })
        .where(eq(hearthUserState.userId, userId));

      // Log departure event
      await db.insert(hearthEvents).values({
        type: "departure",
        userId,
        payload: { note: note?.slice(0, 60) },
        createdAt: new Date().toISOString()
      });

      // Remove presence
      await db.delete(hearthPresence)
        .where(eq(hearthPresence.userId, userId));

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to record departure:", error);
      res.status(500).json({ message: "Failed to record departure" });
    }
  });

  // POST /api/hearth/seat - Update preferred seat
  app.post("/api/hearth/seat", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { seatZone } = req.body;

      const validZones = ["fire", "board", "window", "table"];
      if (!seatZone || !validZones.includes(seatZone)) {
        return res.status(400).json({ message: "Invalid seat zone" });
      }

      await db.update(hearthUserState)
        .set({ seatZone })
        .where(eq(hearthUserState.userId, userId));

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to update seat:", error);
      res.status(500).json({ message: "Failed to update seat" });
    }
  });

  // GET /api/hearth/realm-news - News of The Realm: daily briefs about character accomplishments
  app.get("/api/hearth/realm-news", async (req, res) => {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // 1. Get recent adventure completions with character + campaign data
      const recentCompletions = await db.select({
        completion: adventureCompletions,
        character: { id: characters.id, name: characters.name, race: characters.race, class: characters.class, level: characters.level, portraitUrl: characters.portraitUrl },
        campaign: { id: campaigns.id, title: campaigns.title }
      })
        .from(adventureCompletions)
        .leftJoin(characters, eq(adventureCompletions.characterId, characters.id))
        .leftJoin(campaigns, eq(adventureCompletions.campaignId, campaigns.id))
        .where(gte(adventureCompletions.completedAt, thirtyDaysAgo))
        .orderBy(desc(adventureCompletions.completedAt))
        .limit(10);

      // 2. Get high-level characters (champions) - top by level across all users
      const champions = await db.select({
        id: characters.id,
        name: characters.name,
        race: characters.race,
        class: characters.class,
        level: characters.level,
        portraitUrl: characters.portraitUrl,
        experience: characters.experience,
        userId: characters.userId
      })
        .from(characters)
        .orderBy(desc(characters.level), desc(characters.experience))
        .limit(6);

      // 3. Get newly created characters (last 14 days)
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const newCharacters = await db.select({
        id: characters.id,
        name: characters.name,
        race: characters.race,
        class: characters.class,
        level: characters.level,
        portraitUrl: characters.portraitUrl,
        createdAt: characters.createdAt
      })
        .from(characters)
        .where(gte(characters.createdAt, fourteenDaysAgo))
        .orderBy(desc(characters.createdAt))
        .limit(8);

      // 4. Get notable dice rolls (nat 20s and high rolls from last 7 days)
      const notableRolls = await db.select({
        roll: diceRolls,
        character: { id: characters.id, name: characters.name, portraitUrl: characters.portraitUrl }
      })
        .from(diceRolls)
        .leftJoin(characters, eq(diceRolls.characterId, characters.id))
        .where(and(
          gte(diceRolls.createdAt, sevenDaysAgo),
          sql`${diceRolls.result} = 20 AND ${diceRolls.diceType} = 'd20'`
        ))
        .orderBy(desc(diceRolls.createdAt))
        .limit(8);

      // 5. Get campaigns with narrative logs for achievement snippets
      const activeCampaigns = await db.select({
        id: campaigns.id,
        title: campaigns.title,
        narrativeLog: campaigns.narrativeLog,
        campaignStakes: campaigns.campaignStakes,
        currentSession: campaigns.currentSession,
        isCompleted: campaigns.isCompleted
      })
        .from(campaigns)
        .where(sql`${campaigns.narrativeLog} IS NOT NULL AND jsonb_typeof(${campaigns.narrativeLog}) = 'array' AND jsonb_array_length(CASE WHEN jsonb_typeof(${campaigns.narrativeLog}) = 'array' THEN ${campaigns.narrativeLog} ELSE '[]'::jsonb END) > 0`)
        .orderBy(desc(campaigns.currentSession))
        .limit(10);

      // Pre-fetch all participants for active campaigns in one query (avoid N+1)
      const campaignIds = activeCampaigns.map(c => c.id);
      const allParticipants = campaignIds.length > 0 ? await db.select({
        campaignId: campaignParticipants.campaignId,
        character: { id: characters.id, name: characters.name, race: characters.race, class: characters.class, portraitUrl: characters.portraitUrl }
      })
        .from(campaignParticipants)
        .leftJoin(characters, eq(campaignParticipants.characterId, characters.id))
        .where(sql`${campaignParticipants.campaignId} IN ${campaignIds}`) : [];

      const participantsByCampaign = new Map<number, typeof allParticipants>();
      for (const p of allParticipants) {
        if (!participantsByCampaign.has(p.campaignId)) participantsByCampaign.set(p.campaignId, []);
        participantsByCampaign.get(p.campaignId)!.push(p);
      }

      // Build news items from real data
      const newsItems: Array<{
        id: string;
        type: 'achievement' | 'completion' | 'critical' | 'narrative' | 'milestone';
        headline: string;
        body: string;
        characterName: string;
        characterPortrait: string | null;
        characterRace?: string;
        characterClass?: string;
        timestamp: string;
      }> = [];

      // Achievement news from narrative logs
      for (const camp of activeCampaigns) {
        const log = camp.narrativeLog as any[];
        if (!log || log.length === 0) continue;
        const recentEntries = log.slice(-3);
        const campParticipants = participantsByCampaign.get(camp.id) || [];
        // Rotate which participant is featured
        const featuredIdx = recentEntries.length > 0 ? log.length % Math.max(campParticipants.length, 1) : 0;
        const featured = campParticipants[featuredIdx] || campParticipants[0];

        for (const entry of recentEntries) {
          if (entry.reason || entry.event || entry.summary) {
            const charData = featured?.character;
            const charName = charData?.name || "An unknown adventurer";
            const summary = entry.summary || entry.reason || entry.event || "";
            if (summary.length < 5) continue;

            newsItems.push({
              id: `narrative-${camp.id}-${log.indexOf(entry)}`,
              type: 'narrative',
              headline: summary.length > 80 ? summary.substring(0, 77) + "..." : summary,
              body: `During "${camp.title}" — Chapter ${camp.currentSession}`,
              characterName: charName,
              characterPortrait: charData?.portraitUrl || null,
              characterRace: charData?.race || undefined,
              characterClass: charData?.class || undefined,
              timestamp: entry.timestamp || new Date().toISOString()
            });
          }
        }
      }

      // Completion news
      for (const comp of recentCompletions) {
        const charName = comp.character?.name || "A brave soul";
        newsItems.push({
          id: `completion-${comp.completion.id}`,
          type: 'completion',
          headline: `${charName} completed "${comp.campaign?.title || 'an adventure'}"`,
          body: `Earned ${comp.completion.xpAwarded} XP for their valorous deeds${comp.completion.notes ? '. ' + comp.completion.notes : ''}`,
          characterName: charName,
          characterPortrait: comp.character?.portraitUrl || null,
          characterRace: comp.character?.race || undefined,
          characterClass: comp.character?.class || undefined,
          timestamp: comp.completion.completedAt
        });
      }

      // Critical hit news
      for (const roll of notableRolls) {
        const charName = roll.character?.name || "A lucky adventurer";
        const purposeText = roll.roll.purpose ? ` during ${roll.roll.purpose}` : "";
        newsItems.push({
          id: `crit-${roll.roll.id}`,
          type: 'critical',
          headline: `${charName} rolled a natural 20${purposeText}!`,
          body: "The dice gods smiled upon this hero with a perfect strike.",
          characterName: charName,
          characterPortrait: roll.character?.portraitUrl || null,
          timestamp: roll.roll.createdAt
        });
      }

      // Shuffle and pick a rotation for "today's edition"
      const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
      const shuffled = newsItems.sort((a, b) => {
        const hashA = (a.id.length * 31 + dayOfYear) % 1000;
        const hashB = (b.id.length * 31 + dayOfYear) % 1000;
        return hashA - hashB;
      });

      res.json({
        edition: `${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
        news: shuffled.slice(0, 6),
        champions: champions.map(c => ({
          id: c.id,
          name: c.name,
          race: c.race,
          class: c.class,
          level: c.level,
          portraitUrl: c.portraitUrl,
          xp: c.experience
        })),
        newArrivals: newCharacters.map(c => ({
          id: c.id,
          name: c.name,
          race: c.race,
          class: c.class,
          level: c.level,
          portraitUrl: c.portraitUrl,
          createdAt: c.createdAt
        }))
      });
    } catch (error) {
      console.error("Failed to get realm news:", error);
      res.status(500).json({ message: "The town crier is indisposed" });
    }
  });

  // Helper to format hearth events for display
  function formatHearthEvent(event: any, displayName?: string): string {
    const name = displayName || "Someone";
    const payload = event.payload as any;
    
    switch (event.type) {
      case "arrival":
        return `${name} stepped into the Hall.`;
      case "departure":
        return payload?.note ? `${name} left: "${payload.note}"` : `${name} stepped out.`;
      case "toast":
        return `${name} raised a toast: "${payload?.text}"`;
      case "mark":
        const markEmoji: Record<string, string> = { d6: "🎲", candle: "🕯️", bootprint: "👢", tankard: "🍺", quill: "🪶" };
        return `${name} left a ${markEmoji[payload?.mark] || "mark"} behind.`;
      case "board_post":
        return `${name} pinned a note to the board: "${payload?.title}"`;
      case "milestone":
        return payload?.summary || "An adventure concluded.";
      case "system_murmur":
        return payload?.text || "";
      default:
        return "";
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LLM Configuration Routes
  // ═══════════════════════════════════════════════════════════════════════

}
