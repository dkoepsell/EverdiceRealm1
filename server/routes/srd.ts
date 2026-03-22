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
  app.get("/api/open5e/monsters", async (req, res) => {
    try {
      const { search, page = "1", limit = "20" } = req.query;
      let url = `https://api.open5e.com/v1/monsters/?limit=${limit}&page=${page}`;
      if (search) {
        url += `&search=${encodeURIComponent(search as string)}`;
      }
      const data = await fetchOpen5e(url);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching open5e monsters:", error.message);
      res.status(503).json({ message: "Unable to reach SRD database", error: error.message });
    }
  });
  
  // Get specific monster details
  app.get("/api/open5e/monsters/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const url = `https://api.open5e.com/v1/monsters/${slug}/`;
      const data = await fetchOpen5e(url);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching open5e monster:", error.message);
      res.status(503).json({ message: "Unable to reach SRD database", error: error.message });
    }
  });
  
  // Search/list spells from open5e
  app.get("/api/open5e/spells", async (req, res) => {
    try {
      const { search, page = "1", limit = "20", level } = req.query;
      let url = `https://api.open5e.com/v2/spells/?limit=${limit}&page=${page}`;
      if (search) {
        url += `&search=${encodeURIComponent(search as string)}`;
      }
      if (level) {
        url += `&spell_level=${level}`;
      }
      const data = await fetchOpen5e(url);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching open5e spells:", error.message);
      res.status(503).json({ message: "Unable to reach SRD database", error: error.message });
    }
  });
  
  // Get specific spell details
  app.get("/api/open5e/spells/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const url = `https://api.open5e.com/v2/spells/${slug}/`;
      const data = await fetchOpen5e(url);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching open5e spell:", error.message);
      res.status(503).json({ message: "Unable to reach SRD database", error: error.message });
    }
  });
  
  // Search/list magic items from open5e
  app.get("/api/open5e/magicitems", async (req, res) => {
    try {
      const { search, page = "1", limit = "20", rarity } = req.query;
      let url = `https://api.open5e.com/v1/magicitems/?limit=${limit}&page=${page}`;
      if (search) {
        url += `&search=${encodeURIComponent(search as string)}`;
      }
      if (rarity) {
        url += `&rarity=${encodeURIComponent(rarity as string)}`;
      }
      const data = await fetchOpen5e(url);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching open5e magic items:", error.message);
      res.status(503).json({ message: "Unable to reach SRD database", error: error.message });
    }
  });
  
  // Get specific magic item details
  app.get("/api/open5e/magicitems/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const url = `https://api.open5e.com/v1/magicitems/${slug}/`;
      const data = await fetchOpen5e(url);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching open5e magic item:", error.message);
      res.status(503).json({ message: "Unable to reach SRD database", error: error.message });
    }
  });
  
  // Search/list weapons from open5e
  app.get("/api/open5e/weapons", async (req, res) => {
    try {
      const { search, page = "1", limit = "50" } = req.query;
      let url = `https://api.open5e.com/v2/weapons/?limit=${limit}&page=${page}`;
      if (search) {
        url += `&search=${encodeURIComponent(search as string)}`;
      }
      const data = await fetchOpen5e(url);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching open5e weapons:", error.message);
      res.status(503).json({ message: "Unable to reach SRD database", error: error.message });
    }
  });
  
  // Get specific weapon details
  app.get("/api/open5e/weapons/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const url = `https://api.open5e.com/v2/weapons/${slug}/`;
      const data = await fetchOpen5e(url);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching open5e weapon:", error.message);
      res.status(503).json({ message: "Unable to reach SRD database", error: error.message });
    }
  });
  
  // Search/list armor from open5e
  app.get("/api/open5e/armor", async (req, res) => {
    try {
      const { search, page = "1", limit = "50" } = req.query;
      let url = `https://api.open5e.com/v2/armor/?limit=${limit}&page=${page}`;
      if (search) {
        url += `&search=${encodeURIComponent(search as string)}`;
      }
      const data = await fetchOpen5e(url);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching open5e armor:", error.message);
      res.status(503).json({ message: "Unable to reach SRD database", error: error.message });
    }
  });
  
  // Get specific armor details
  app.get("/api/open5e/armor/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const url = `https://api.open5e.com/v2/armor/${slug}/`;
      const data = await fetchOpen5e(url);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching open5e armor:", error.message);
      res.status(503).json({ message: "Unable to reach SRD database", error: error.message });
    }
  });

  // Search/list feats from open5e
  app.get("/api/open5e/feats", async (req, res) => {
    try {
      const { search, page = "1", limit = "50" } = req.query;
      let url = `https://api.open5e.com/v2/feats/?limit=${limit}&page=${page}`;
      if (search) {
        url += `&search=${encodeURIComponent(search as string)}`;
      }
      const data = await fetchOpen5e(url);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching open5e feats:", error.message);
      res.status(503).json({ message: "Unable to reach SRD database", error: error.message });
    }
  });
  
  // ========================================
  // End Open5e SRD Reference API
  // ========================================

  // ========================================
  // Campaign SRD References API
  // ========================================

  // Get all SRD references for a campaign
  app.get("/api/campaigns/:campaignId/srd-references", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const refs = await db.select()
        .from(campaignSrdReferences)
        .where(eq(campaignSrdReferences.campaignId, campaignId))
        .orderBy(campaignSrdReferences.entityType, campaignSrdReferences.entityName);
      res.json(refs);
    } catch (error: any) {
      console.error("Error fetching campaign SRD references:", error.message);
      res.status(500).json({ message: "Failed to fetch SRD references" });
    }
  });

  // Add SRD reference to a campaign
  app.post("/api/campaigns/:campaignId/srd-references", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const userId = req.user.id;
      const { entityType, entitySlug, entityName, entityData, notes } = req.body;

      // Check if already exists
      const existing = await db.select()
        .from(campaignSrdReferences)
        .where(and(
          eq(campaignSrdReferences.campaignId, campaignId),
          eq(campaignSrdReferences.entityType, entityType),
          eq(campaignSrdReferences.entitySlug, entitySlug)
        ));

      if (existing.length > 0) {
        return res.status(400).json({ message: "This entity is already added to this campaign" });
      }

      const [newRef] = await db.insert(campaignSrdReferences).values({
        campaignId,
        entityType,
        entitySlug,
        entityName,
        entityData,
        notes,
        addedBy: userId,
        addedAt: new Date().toISOString(),
      }).returning();

      res.status(201).json(newRef);
    } catch (error: any) {
      console.error("Error adding SRD reference:", error.message);
      res.status(500).json({ message: "Failed to add SRD reference" });
    }
  });

  // Remove SRD reference from a campaign
  app.delete("/api/campaigns/:campaignId/srd-references/:refId", isAuthenticated, async (req: any, res) => {
    try {
      const refId = parseInt(req.params.refId);
      await db.delete(campaignSrdReferences).where(eq(campaignSrdReferences.id, refId));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error removing SRD reference:", error.message);
      res.status(500).json({ message: "Failed to remove SRD reference" });
    }
  });

  // Update SRD reference notes
  app.patch("/api/campaigns/:campaignId/srd-references/:refId", isAuthenticated, async (req: any, res) => {
    try {
      const refId = parseInt(req.params.refId);
      const { notes } = req.body;
      const [updated] = await db.update(campaignSrdReferences)
        .set({ notes })
        .where(eq(campaignSrdReferences.id, refId))
        .returning();
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating SRD reference:", error.message);
      res.status(500).json({ message: "Failed to update SRD reference" });
    }
  });

  // Monster portrait generation
  app.post("/api/monsters/:id/generate-portrait", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const [monster] = await db.select().from(monsters).where(eq(monsters.id, id));
      
      if (!monster) {
        return res.status(404).json({ message: "Monster not found" });
      }
      
      // Generate portrait using the monster-specific generator
      const { generateMonsterPortrait } = await import("./lib/characterImageGenerator");
      const portraitData = await generateMonsterPortrait({
        name: monster.name,
        type: monster.type || 'creature',
        size: monster.size || 'Medium',
        description: monster.description || undefined
      });
      
      // Update monster with image URL
      const [updatedMonster] = await db
        .update(monsters)
        .set({ imageUrl: portraitData.url })
        .where(eq(monsters.id, id))
        .returning();
      
      res.json({ 
        imageUrl: portraitData.url, 
        monster: updatedMonster 
      });
    } catch (error: any) {
      console.error("Error generating monster portrait:", error);
      res.status(500).json({ 
        message: "Failed to generate monster portrait", 
        error: error.message 
      });
    }
  });
  
  app.post("/api/characters/:id/generate-background", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const character = await storage.getCharacter(id);
      
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      // Generate background story using OpenAI
      const backgroundStory = await generateCharacterBackground({
        name: character.name,
        race: character.race,
        class: character.class,
        background: character.background || undefined
      });
      
      // Update character with background story
      const updatedCharacter = await storage.updateCharacter(id, {
        backgroundStory: backgroundStory
      });
      
      res.json({ 
        backgroundStory: backgroundStory, 
        character: updatedCharacter 
      });
    } catch (error: any) {
      console.error("Error generating character background:", error);
      res.status(500).json({ 
        message: "Failed to generate character background", 
        error: error.message 
      });
    }
  });

  // Monster Image Generation endpoint
  app.post("/api/generate-monster-image", async (req, res) => {
    try {
      const { monsterName, description, type } = req.body;
      
      if (!monsterName) {
        return res.status(400).json({ message: "Monster name is required" });
      }
      
      const isBoss = type === 'boss';
      const prompt = `Create a dramatic D&D fantasy illustration of a ${monsterName}. ${description || ''} 
      Style: Dark fantasy, dramatic lighting, detailed monster portrait suitable for a D&D bestiary.
      ${isBoss ? 'Make it look powerful and menacing as a boss creature.' : 'Standard monster encounter creature.'}
      No text or labels. High detail, fantasy art style similar to official D&D Monster Manual illustrations.`;
      
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "vivid",
      });
      
      const imageData = response.data?.[0];
      if (!imageData || !imageData.url) {
        throw new Error("No image data returned from OpenAI");
      }
      
      res.json({ 
        success: true,
        imageUrl: imageData.url,
        monsterName 
      });
    } catch (error: any) {
      console.error("Error generating monster image:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to generate monster image", 
        error: error.message 
      });
    }
  });

  // === D&D 5e Item Recharge System ===
  // Recharges wands, staves, and other charged items at dawn (long rest / new session)
  // Per 5e rules: items regain charges based on their description, and if reduced to 0 charges,
  // roll a d20 — on a 1, the item is destroyed.
  async function rechargeCharacterItems(characterId: number): Promise<{
    recharged: { itemId: number; itemName: string; chargesRegained: number; newCharges: number; maxCharges: number }[];
    destroyed: { itemId: number; itemName: string }[];
  }> {
    const result: {
      recharged: { itemId: number; itemName: string; chargesRegained: number; newCharges: number; maxCharges: number }[];
      destroyed: { itemId: number; itemName: string }[];
    } = { recharged: [], destroyed: [] };
    
    try {
      const chargedItems = await db.execute(sql`
        SELECT id, name, current_charges, max_charges, special_effect
        FROM character_inventory
        WHERE character_id = ${characterId}
          AND max_charges IS NOT NULL
          AND max_charges > 0
      `);
      
      if (!chargedItems.rows || chargedItems.rows.length === 0) return result;
      
      for (const row of chargedItems.rows) {
        const item = row as any;
        const currentCharges = item.current_charges ?? 0;
        const maxCharges = item.max_charges ?? 7;
        const specialEffect = (item.special_effect || '') as string;
        
        // Parse recharge formula from specialEffect text
        // Supports: "Regains 1d6+1 charges at dawn", "regains 1d4 expended charges daily",
        //           "regains 2 charges at dawn", "regains 1d6 + 1 expended charges"
        let rechargeAmount = 0;
        let hasRechargeClause = false;
        
        // Pattern 1: Dice-based recharge (e.g., "regains 1d6+1 charges", "regains 1d4 expended charges")
        const diceMatch = specialEffect.match(/regains?\s+(\d+)d(\d+)(?:\s*\+\s*(\d+))?\s+(?:expended\s+)?charges?/i);
        // Pattern 2: Flat recharge (e.g., "regains 2 charges at dawn", "regains 3 expended charges")
        const flatMatch = specialEffect.match(/regains?\s+(\d+)\s+(?:expended\s+)?charges?/i);
        
        if (diceMatch) {
          hasRechargeClause = true;
          const numDice = parseInt(diceMatch[1]);
          const dieSize = parseInt(diceMatch[2]);
          const bonus = diceMatch[3] ? parseInt(diceMatch[3]) : 0;
          
          let rollTotal = 0;
          for (let i = 0; i < numDice; i++) {
            rollTotal += Math.floor(Math.random() * dieSize) + 1;
          }
          rechargeAmount = rollTotal + bonus;
          console.log(`[Recharge] ${item.name}: ${numDice}d${dieSize}+${bonus} = ${rechargeAmount} charges regained`);
        } else if (flatMatch) {
          hasRechargeClause = true;
          rechargeAmount = parseInt(flatMatch[1]);
          console.log(`[Recharge] ${item.name}: flat ${rechargeAmount} charges regained`);
        }
        
        // Skip items that don't have a recognized recharge clause
        if (!hasRechargeClause) {
          console.log(`[Recharge] ${item.name}: no recharge clause found, skipping`);
          continue;
        }
        
        if (rechargeAmount > 0) {
          const newCharges = Math.min(currentCharges + rechargeAmount, maxCharges);
          const actualRegained = newCharges - currentCharges;
          
          if (actualRegained > 0) {
            await db.execute(sql`
              UPDATE character_inventory 
              SET current_charges = ${newCharges}
              WHERE id = ${item.id}
            `);
            
            result.recharged.push({
              itemId: item.id,
              itemName: item.name,
              chargesRegained: actualRegained,
              newCharges,
              maxCharges
            });
          }
        }
      }
    } catch (err) {
      console.error('[Recharge] Error recharging items:', err);
    }
    
    return result;
  }

  // Character Rest Routes - HP Recovery (heals entire party when not in combat)
}
