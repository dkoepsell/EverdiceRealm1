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
  // ============ Badge System Routes ============
  
  // Get all available badges
  app.get("/api/badges", async (req, res) => {
    try {
      const allBadges = await storage.getAllBadges();
      res.json(allBadges);
    } catch (error) {
      console.error("Failed to get badges:", error);
      res.status(500).json({ message: "Failed to get badges" });
    }
  });
  
  // Get user's earned badges
  app.get("/api/users/:userId/badges", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const userBadges = await storage.getUserBadges(userId);
      res.json(userBadges);
    } catch (error) {
      console.error("Failed to get user badges:", error);
      res.status(500).json({ message: "Failed to get user badges" });
    }
  });
  
  // Get current user's badges (authenticated)
  app.get("/api/my-badges", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const userBadges = await storage.getUserBadges(userId);
      res.json(userBadges);
    } catch (error) {
      console.error("Failed to get my badges:", error);
      res.status(500).json({ message: "Failed to get badges" });
    }
  });
  
  // Award a badge to the current user (for learning path completion)
  app.post("/api/badges/award", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { badgeName, context } = req.body;
      
      if (!badgeName) {
        return res.status(400).json({ message: "Badge name is required" });
      }
      
      const badge = await storage.getBadgeByName(badgeName);
      if (!badge) {
        return res.status(404).json({ message: "Badge not found" });
      }
      
      // Check if user already has this badge
      const hasBadge = await storage.hasUserBadge(userId, badge.id);
      if (hasBadge) {
        return res.json({ message: "Badge already earned", alreadyEarned: true });
      }
      
      const userBadge = await storage.awardBadge(userId, badge.id, context);
      res.json({ ...userBadge, badge, message: "Badge awarded!", alreadyEarned: false });
    } catch (error) {
      console.error("Failed to award badge:", error);
      res.status(500).json({ message: "Failed to award badge" });
    }
  });

  // ============================================
  // Discord Integration Routes
  // ============================================
  
  // Get Discord bot status
  app.get("/api/discord/status", isAuthenticated, async (req, res) => {
    try {
      const status = getDiscordStatus();
      res.json(status);
    } catch (error) {
      console.error("Failed to get Discord status:", error);
      res.status(500).json({ message: "Failed to get Discord status" });
    }
  });
  
  // Send session start notification to Discord
  app.post("/api/discord/session-start", isAuthenticated, async (req, res) => {
    try {
      const { channelId, campaignTitle, sessionNumber, dmName } = req.body;
      
      if (!channelId || !campaignTitle) {
        return res.status(400).json({ message: "Channel ID and campaign title are required" });
      }
      
      const embed = createSessionStartEmbed(
        campaignTitle, 
        sessionNumber || 1, 
        dmName || "Dungeon Master"
      );
      
      const success = await sendToChannel(channelId, embed);
      if (success) {
        res.json({ message: "Session start notification sent!" });
      } else {
        res.status(500).json({ message: "Failed to send notification - Discord not connected" });
      }
    } catch (error) {
      console.error("Failed to send session start:", error);
      res.status(500).json({ message: "Failed to send session notification" });
    }
  });
  
  // Send recap to Discord
  app.post("/api/discord/recap", isAuthenticated, async (req, res) => {
    try {
      const { channelId, campaignTitle, sessionNumber, recap } = req.body;
      
      if (!channelId || !campaignTitle || !recap) {
        return res.status(400).json({ message: "Channel ID, campaign title, and recap are required" });
      }
      
      const embed = createRecapEmbed(campaignTitle, sessionNumber || 1, recap);
      const success = await sendToChannel(channelId, embed);
      
      if (success) {
        res.json({ message: "Recap sent to Discord!" });
      } else {
        res.status(500).json({ message: "Failed to send recap - Discord not connected" });
      }
    } catch (error) {
      console.error("Failed to send recap:", error);
      res.status(500).json({ message: "Failed to send recap" });
    }
  });
  
  // Send dice roll to Discord
  app.post("/api/discord/roll", isAuthenticated, async (req, res) => {
    try {
      const { channelId, characterName, rollType, result, breakdown } = req.body;
      
      if (!channelId || !characterName || result === undefined) {
        return res.status(400).json({ message: "Channel ID, character name, and result are required" });
      }
      
      const embed = createRollEmbed(
        characterName, 
        rollType || "Dice Roll", 
        result, 
        breakdown || `${result}`
      );
      
      const success = await sendToChannel(channelId, embed);
      if (success) {
        res.json({ message: "Roll sent to Discord!" });
      } else {
        res.status(500).json({ message: "Failed to send roll - Discord not connected" });
      }
    } catch (error) {
      console.error("Failed to send roll:", error);
      res.status(500).json({ message: "Failed to send roll" });
    }
  });
  
  // Send custom message to Discord
  app.post("/api/discord/message", isAuthenticated, async (req, res) => {
    try {
      const { channelId, message } = req.body;
      
      if (!channelId || !message) {
        return res.status(400).json({ message: "Channel ID and message are required" });
      }
      
      const success = await sendToChannel(channelId, message);
      if (success) {
        res.json({ message: "Message sent to Discord!" });
      } else {
        res.status(500).json({ message: "Failed to send message - Discord not connected" });
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // ============================================
  // MAGIC ITEM SHOP & MILESTONE REWARDS ROUTES
  // ============================================
  
  // Get magic item templates (filtered)
  app.get("/api/magic-items/templates", isAuthenticated, async (req, res) => {
    try {
      const { rarity, type, minLevel, maxLevel, classAffinity, isShoppable } = req.query;
      const filters: any = {};
      
      if (rarity) filters.rarity = rarity as string;
      if (type) filters.type = type as string;
      if (minLevel) filters.minLevel = parseInt(minLevel as string);
      if (maxLevel) filters.maxLevel = parseInt(maxLevel as string);
      if (classAffinity) filters.classAffinity = classAffinity as string;
      if (isShoppable !== undefined) filters.isShoppable = isShoppable === 'true';
      
      const items = await storage.getMagicItemTemplates(filters);
      res.json(items);
    } catch (error) {
      console.error("Failed to get magic items:", error);
      res.status(500).json({ message: "Failed to get magic items" });
    }
  });
  
  // Get single magic item template
  app.get("/api/magic-items/templates/:id", isAuthenticated, async (req, res) => {
    try {
      const item = await storage.getMagicItemTemplate(parseInt(req.params.id));
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Failed to get magic item:", error);
      res.status(500).json({ message: "Failed to get magic item" });
    }
  });
  
  // Get milestone drops for a character
  app.get("/api/magic-items/milestone-drops", isAuthenticated, async (req, res) => {
    try {
      const { milestoneType, characterId } = req.query;
      
      if (!milestoneType || !characterId) {
        return res.status(400).json({ message: "Milestone type and character ID required" });
      }
      
      const character = await storage.getCharacter(parseInt(characterId as string));
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      const drops = await storage.getMilestoneDrops(
        milestoneType as string,
        character.level,
        character.class
      );
      res.json(drops);
    } catch (error) {
      console.error("Failed to get milestone drops:", error);
      res.status(500).json({ message: "Failed to get milestone drops" });
    }
  });
  
  // Get tavern magic shop items (level/class adjusted)
  app.get("/api/magic-items/shop", isAuthenticated, async (req, res) => {
    try {
      const { characterId } = req.query;
      let characterLevel: number | undefined;
      let characterClass: string | undefined;
      
      if (characterId) {
        const character = await storage.getCharacter(parseInt(characterId as string));
        if (character) {
          characterLevel = character.level;
          characterClass = character.class;
        }
      }
      
      const items = await storage.getShopMagicItems(characterLevel, characterClass);
      res.json(items);
    } catch (error) {
      console.error("Failed to get shop items:", error);
      res.status(500).json({ message: "Failed to get shop items" });
    }
  });
  
  // Purchase magic item from tavern shop
  app.post("/api/magic-items/shop/purchase", isAuthenticated, async (req, res) => {
    try {
      const { characterId, templateId } = req.body;
      
      if (!characterId || !templateId) {
        return res.status(400).json({ message: "Character ID and template ID required" });
      }
      
      const result = await storage.purchaseMagicItem(characterId, templateId);
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }
      
      res.json({ message: "Item purchased successfully!", item: result.item });
    } catch (error) {
      console.error("Failed to purchase item:", error);
      res.status(500).json({ message: "Failed to purchase item" });
    }
  });
  
  // Get character's magical inventory (from character_inventory table)
  app.get("/api/characters/:characterId/magical-inventory", isAuthenticated, async (req, res) => {
    try {
      const inventory = await storage.getCharacterInventory(parseInt(req.params.characterId));
      res.json(inventory);
    } catch (error) {
      console.error("Failed to get inventory:", error);
      res.status(500).json({ message: "Failed to get inventory" });
    }
  });
  
  // Equip/unequip item
  app.post("/api/characters/:characterId/inventory/:itemId/equip", isAuthenticated, async (req, res) => {
    try {
      const { slot } = req.body;
      const itemId = parseInt(req.params.itemId);
      
      if (slot) {
        const allowedSlots = ["weapon", "armor", "shield", "accessory"];
        if (!allowedSlots.includes(slot)) {
          return res.status(400).json({ message: `Invalid slot. Use: ${allowedSlots.join(", ")}` });
        }
        
        const existingItem = await db.execute(sql`SELECT * FROM character_inventory WHERE id = ${itemId}`);
        const itemData = existingItem.rows[0] as any;
        if (itemData) {
          const validSlots = getValidSlotsForItem(itemData.name || '', itemData.equip_slot || itemData.type);
          if (validSlots.length === 0) {
            return res.status(400).json({ 
              message: `${itemData.name} cannot be equipped — it's a consumable, tool, or gear item.`,
              validSlots: []
            });
          }
          if (!validSlots.includes(slot)) {
            const slotLabels: Record<string, string> = { weapon: "Weapon", armor: "Armor", shield: "Shield", accessory: "Accessory" };
            return res.status(400).json({ 
              message: `${itemData.name} can only be equipped in the ${validSlots.map(s => slotLabels[s] || s).join(" or ")} slot.`,
              validSlots
            });
          }
        }
        
        const item = await storage.equipItem(itemId, slot);
        res.json({ message: "Item equipped!", item });
      } else {
        const item = await storage.unequipItem(itemId);
        res.json({ message: "Item unequipped!", item });
      }
    } catch (error) {
      console.error("Failed to equip/unequip item:", error);
      res.status(500).json({ message: "Failed to equip/unequip item" });
    }
  });
  
  // Bind item to character
  app.post("/api/characters/:characterId/inventory/:itemId/bind", isAuthenticated, async (req, res) => {
    try {
      const item = await storage.bindItem(parseInt(req.params.itemId));
      res.json({ message: "Item bound to character!", item });
    } catch (error) {
      console.error("Failed to bind item:", error);
      res.status(500).json({ message: "Failed to bind item" });
    }
  });
  
  // Get milestone rewards for character
  app.get("/api/characters/:characterId/milestone-rewards", isAuthenticated, async (req, res) => {
    try {
      const { campaignId } = req.query;
      const rewards = await storage.getMilestoneRewards(
        parseInt(req.params.characterId),
        campaignId ? parseInt(campaignId as string) : undefined
      );
      res.json(rewards);
    } catch (error) {
      console.error("Failed to get rewards:", error);
      res.status(500).json({ message: "Failed to get rewards" });
    }
  });
  
  // Get unclaimed rewards
  app.get("/api/characters/:characterId/unclaimed-rewards", isAuthenticated, async (req, res) => {
    try {
      const rewards = await storage.getUnclaimedRewards(parseInt(req.params.characterId));
      res.json(rewards);
    } catch (error) {
      console.error("Failed to get unclaimed rewards:", error);
      res.status(500).json({ message: "Failed to get unclaimed rewards" });
    }
  });
  
  // Claim milestone reward
  app.post("/api/milestone-rewards/:rewardId/claim", isAuthenticated, async (req, res) => {
    try {
      const reward = await storage.claimMilestoneReward(parseInt(req.params.rewardId));
      if (!reward) {
        return res.status(400).json({ message: "Reward not found or already claimed" });
      }
      res.json({ message: "Reward claimed!", reward });
    } catch (error) {
      console.error("Failed to claim reward:", error);
      res.status(500).json({ message: "Failed to claim reward" });
    }
  });
  
  // Create milestone reward (for DM use when milestones are achieved)
  app.post("/api/milestone-rewards", isAuthenticated, async (req, res) => {
    try {
      const { characterId, campaignId, milestoneType, milestoneName, sessionNumber, xpAwarded, goldAwarded } = req.body;
      
      if (!characterId || !campaignId || !milestoneType || !milestoneName) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Get character to determine level/class for item drop
      const character = await storage.getCharacter(characterId);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      // Find appropriate milestone drop
      const possibleDrops = await storage.getMilestoneDrops(milestoneType, character.level, character.class);
      let selectedItem = null;
      
      if (possibleDrops.length > 0) {
        // Weight-based random selection
        const totalWeight = possibleDrops.reduce((sum, item) => sum + (item.drop_weight || 10), 0);
        let random = Math.random() * totalWeight;
        
        for (const item of possibleDrops) {
          random -= (item.drop_weight || 10);
          if (random <= 0) {
            selectedItem = item;
            break;
          }
        }
      }
      
      const reward = await storage.createMilestoneReward({
        characterId,
        campaignId,
        milestoneType,
        milestoneName,
        sessionNumber,
        itemTemplateId: selectedItem?.id || null,
        xpAwarded: xpAwarded || 0,
        goldAwarded: goldAwarded || 0,
        earnedAt: new Date().toISOString()
      });
      
      res.json({ 
        message: "Milestone reward created!", 
        reward,
        itemDrop: selectedItem ? { name: selectedItem.name, rarity: selectedItem.rarity } : null
      });
    } catch (error) {
      console.error("Failed to create milestone reward:", error);
      res.status(500).json({ message: "Failed to create milestone reward" });
    }
  });

  // =====================================================
  // HEARTH ENDPOINTS - Persistent Social Hub
  // =====================================================

  // Arrival line options for personalization
  const arrivalLines = [
    "You step back into the Lantern Hall. Your usual spot is still open.",
    "The fire is low tonight. Someone has been here recently.",
    "Rain taps the windows. The noticeboard has fresh ink.",
    "The Hearth kept your seat. Welcome back.",
    "It has been a little while. The Hall still remembers you."
  ];

  const seatZoneStatuses: Record<string, string> = {
    fire: "by the fire",
    board: "at the board",
    window: "watching the rain",
    table: "packing gear"
  };

  // GET /api/hearth/snapshot - Main page data
  app.get("/api/llm-config", isAuthenticated, async (req: any, res) => {
    try {
      const configs = await storage.getLlmConfigs(req.user.id);
      const sanitized = configs.map(c => ({
        ...c,
        apiKey: c.apiKey ? `${c.apiKey.substring(0, 8)}...${c.apiKey.substring(c.apiKey.length - 4)}` : "",
      }));
      res.json(sanitized);
    } catch (error) {
      console.error("Failed to get LLM configs:", error);
      res.status(500).json({ message: "Failed to load AI configurations" });
    }
  });

  app.get("/api/llm-config/active", isAuthenticated, async (req: any, res) => {
    try {
      const config = await storage.getLlmConfig(req.user.id);
      if (!config) {
        return res.json({ provider: "everdice", isCustom: false });
      }
      res.json({
        id: config.id,
        provider: config.provider,
        label: config.label,
        model: config.model,
        endpoint: config.endpoint,
        isCustom: true,
        isActive: config.isActive,
      });
    } catch (error) {
      console.error("Failed to get active LLM config:", error);
      res.status(500).json({ message: "Failed to load active AI configuration" });
    }
  });

  app.post("/api/llm-config", isAuthenticated, async (req: any, res) => {
    try {
      const { provider, apiKey, endpoint, model, label, isActive } = req.body;
      if (!provider || !apiKey) {
        return res.status(400).json({ message: "Provider and API key are required" });
      }
      const config = await storage.createLlmConfig({
        userId: req.user.id,
        provider,
        apiKey,
        endpoint: endpoint || null,
        model: model || null,
        label: label || "My LLM",
        isActive: isActive !== false,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      });
      res.json({
        ...config,
        apiKey: `${config.apiKey.substring(0, 8)}...${config.apiKey.substring(config.apiKey.length - 4)}`,
      });
    } catch (error) {
      console.error("Failed to create LLM config:", error);
      res.status(500).json({ message: "Failed to save AI configuration" });
    }
  });

  app.patch("/api/llm-config/:id", isAuthenticated, async (req: any, res) => {
    try {
      const configId = parseInt(req.params.id);
      const existing = (await storage.getLlmConfigs(req.user.id)).find(c => c.id === configId);
      if (!existing) {
        return res.status(404).json({ message: "Configuration not found" });
      }
      const updates: any = {};
      if (req.body.provider !== undefined) updates.provider = req.body.provider;
      if (req.body.apiKey !== undefined) updates.apiKey = req.body.apiKey;
      if (req.body.endpoint !== undefined) updates.endpoint = req.body.endpoint;
      if (req.body.model !== undefined) updates.model = req.body.model;
      if (req.body.label !== undefined) updates.label = req.body.label;
      if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;
      const updated = await storage.updateLlmConfig(configId, updates);
      if (updated) {
        res.json({
          ...updated,
          apiKey: `${updated.apiKey.substring(0, 8)}...${updated.apiKey.substring(updated.apiKey.length - 4)}`,
        });
      } else {
        res.status(404).json({ message: "Configuration not found" });
      }
    } catch (error) {
      console.error("Failed to update LLM config:", error);
      res.status(500).json({ message: "Failed to update AI configuration" });
    }
  });

  app.delete("/api/llm-config/:id", isAuthenticated, async (req: any, res) => {
    try {
      const configId = parseInt(req.params.id);
      const existing = (await storage.getLlmConfigs(req.user.id)).find(c => c.id === configId);
      if (!existing) {
        return res.status(404).json({ message: "Configuration not found" });
      }
      await storage.deleteLlmConfig(configId);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete LLM config:", error);
      res.status(500).json({ message: "Failed to delete AI configuration" });
    }
  });

  app.post("/api/llm-config/test", isAuthenticated, async (req: any, res) => {
    try {
      const { provider, apiKey, endpoint, model } = req.body;
      if (!apiKey) {
        return res.status(400).json({ message: "API key is required" });
      }
      const { testAIConnection } = await import("./lib/aiProvider");
      const result = await testAIConnection(provider || "openai", apiKey, endpoint, model);
      res.json(result);
    } catch (error) {
      console.error("Failed to test LLM connection:", error);
      res.status(500).json({ success: false, message: "Failed to test connection" });
    }
  });

  app.post("/api/feedback", async (req: any, res) => {
    try {
      const { feltConfusing, feltSlow, wouldUse, comment } = req.body;
      const userId = req.user?.id || null;
      const feedback = await storage.createUserFeedback({
        userId,
        feltConfusing: feltConfusing || false,
        feltSlow: feltSlow || false,
        wouldUse: wouldUse || false,
        comment: comment || null,
      });
      res.json({ success: true, id: feedback.id });
    } catch (error) {
      console.error("Failed to save feedback:", error);
      res.status(500).json({ message: "Failed to save feedback" });
    }
  });

  return httpServer;
}
