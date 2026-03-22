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
  app.post("/api/campaigns/:campaignId/notes", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      
      // Get the campaign to check authorization
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Check if the user is the DM
      if (campaign.userId !== req.user.id) {
        // Check if user is a participant with appropriate permissions
        const participant = await storage.getCampaignParticipant(campaignId, req.user.id);
        if (!participant || (participant.role !== 'co-dm' && participant.permissions !== 'editor')) {
          return res.status(403).json({ message: "You don't have permission to create notes" });
        }
      }
      
      const noteData = {
        ...req.body,
        campaignId,
        createdBy: req.user.id,
        createdAt: new Date().toISOString()
      };
      
      // Validate with schema
      const validatedData = insertDmNoteSchema.parse(noteData);
      
      // Create the note
      const note = await storage.createDmNote(validatedData);
      
      res.status(201).json(note);
    } catch (error) {
      console.error("Failed to create note:", error);
      res.status(500).json({ message: "Failed to create note" });
    }
  });
  
  app.get("/api/campaigns/:campaignId/notes", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      
      // Get the campaign to check authorization
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Check if user is the DM or a participant
      const isOwner = campaign.userId === req.user.id;
      if (!isOwner) {
        const participant = await storage.getCampaignParticipant(campaignId, req.user.id);
        if (!participant) {
          return res.status(403).json({ message: "You are not a participant in this campaign" });
        }
      }
      
      // Fetch the notes for this user
      const notes = await storage.getDmNotes(campaignId, req.user.id);
      
      // If the user is the DM, also get notes with isPrivate=false from other participants
      if (isOwner) {
        // This would be a more complex query in a real implementation
        // For now, omit fetching shared notes from other participants
      }
      
      res.json(notes);
    } catch (error) {
      console.error("Failed to fetch notes:", error);
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });
  
  app.get("/api/campaigns/:campaignId/notes/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const noteId = parseInt(req.params.id);
      
      // Get the note
      const note = await storage.getDmNote(noteId);
      if (!note || note.campaignId !== campaignId) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      // Check permission - must be the note creator unless it's shared and user is a participant
      const isCreator = note.createdBy === req.user.id;
      if (!isCreator) {
        if (note.isPrivate) {
          return res.status(403).json({ message: "You don't have permission to view this note" });
        }
        
        // If note is shared, user must be a participant or DM
        const campaign = await storage.getCampaign(campaignId);
        const isDM = campaign && campaign.userId === req.user.id;
        if (!isDM) {
          const participant = await storage.getCampaignParticipant(campaignId, req.user.id);
          if (!participant) {
            return res.status(403).json({ message: "You are not a participant in this campaign" });
          }
        }
      }
      
      res.json(note);
    } catch (error) {
      console.error("Failed to fetch note:", error);
      res.status(500).json({ message: "Failed to fetch note" });
    }
  });
  
  app.put("/api/campaigns/:campaignId/notes/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const noteId = parseInt(req.params.id);
      
      // Get the note
      const note = await storage.getDmNote(noteId);
      if (!note || note.campaignId !== campaignId) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      // Only the creator can edit the note
      if (note.createdBy !== req.user.id) {
        return res.status(403).json({ message: "You don't have permission to edit this note" });
      }
      
      // Update the note
      const updatedNote = await storage.updateDmNote(noteId, {
        ...req.body,
        updatedAt: new Date().toISOString()
      });
      
      res.json(updatedNote);
    } catch (error) {
      console.error("Failed to update note:", error);
      res.status(500).json({ message: "Failed to update note" });
    }
  });
  
  app.delete("/api/campaigns/:campaignId/notes/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const noteId = parseInt(req.params.id);
      
      // Get the note
      const note = await storage.getDmNote(noteId);
      if (!note || note.campaignId !== campaignId) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      // Only the creator can delete the note
      if (note.createdBy !== req.user.id) {
        return res.status(403).json({ message: "You don't have permission to delete this note" });
      }
      
      // Delete the note
      const result = await storage.deleteDmNote(noteId);
      if (!result) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete note:", error);
      res.status(500).json({ message: "Failed to delete note" });
    }
  });

  // AI DM Assistance endpoints
  app.post("/api/dm-assistance/generate-guidance", isAuthenticated, async (req, res) => {
    try {
      const { campaignId, encounterType, situation, currentStep } = req.body;
      
      if (!campaignId || !encounterType || !situation) {
        return res.status(400).json({ message: "Campaign ID, encounter type, and situation are required" });
      }

      // Verify user has access to the campaign
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign || campaign.userId !== req.user.id) {
        return res.status(404).json({ message: "Campaign not found or access denied" });
      }

      // Generate AI guidance using OpenAI
      const prompt = `You are an expert D&D Dungeon Master assistant. Help guide a DM through a ${encounterType} encounter.

Campaign: ${campaign.title}
Campaign Description: ${campaign.description || "No description provided"}
Current Situation: ${situation}
${currentStep !== undefined ? `Current Step: ${currentStep + 1}` : ''}

Generate a step-by-step guide for running this encounter effectively. Return your response as a JSON object with this structure:
{
  "steps": [
    {
      "id": 1,
      "title": "Step Title",
      "description": "Detailed description of what to do in this step",
      "tips": ["Pro tip 1", "Pro tip 2", "Pro tip 3"],
      "commonMistakes": ["Common mistake 1", "Common mistake 2"],
      "suggestions": ["Suggested action 1", "Suggested action 2"]
    }
  ]
}

Focus on practical, actionable advice. Include 4-6 steps total. Make tips specific and helpful for new DMs. Common mistakes should highlight pitfalls to avoid. Suggestions should be concrete actions the DM can take.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are an expert D&D Dungeon Master trainer. Provide structured, practical guidance for running encounters. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 2000
      });

      const guidanceData = JSON.parse(completion.choices[0].message.content);
      
      // Ensure each step has an incrementing ID
      guidanceData.steps = guidanceData.steps.map((step: any, index: number) => ({
        ...step,
        id: index + 1
      }));

      res.json(guidanceData);
    } catch (error) {
      console.error("Failed to generate DM guidance:", error);
      res.status(500).json({ 
        message: "Failed to generate guidance",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Location management routes
  app.post('/api/magic-items', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const itemData = { 
        user_id: userId,
        name: req.body.name,
        type: req.body.type,
        rarity: req.body.rarity,
        description: req.body.description,
        requires_attunement: req.body.requires_attunement || false,
        notes: req.body.notes || '',
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const [item] = await db
        .insert(magicItems)
        .values(itemData)
        .returning();
      
      res.json(item);
    } catch (error) {
      console.error("Error creating magic item:", error);
      res.status(500).json({ message: "Failed to create magic item" });
    }
  });

  app.get('/api/magic-items', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userItems = await db
        .select()
        .from(magicItems)
        .where(eq(magicItems.user_id, userId))
        .orderBy(desc(magicItems.created_at));
      
      res.json(userItems);
    } catch (error) {
      console.error("Error fetching magic items:", error);
      res.status(500).json({ message: "Failed to fetch magic items" });
    }
  });

  // Update a magic item
  app.put('/api/magic-items/:id', isAuthenticated, async (req: any, res) => {
    try {
      const itemId = parseInt(req.params.id);
      const itemData = {
        name: req.body.name,
        type: req.body.type,
        rarity: req.body.rarity,
        description: req.body.description,
        requires_attunement: req.body.requires_attunement,
        notes: req.body.notes,
        updated_at: new Date()
      };

      const [updatedItem] = await db
        .update(magicItems)
        .set(itemData)
        .where(eq(magicItems.id, itemId))
        .returning();

      res.json(updatedItem);
    } catch (error) {
      console.error("Failed to update magic item:", error);
      res.status(500).json({ message: "Failed to update magic item" });
    }
  });

  // Delete a magic item
  app.delete('/api/magic-items/:id', isAuthenticated, async (req: any, res) => {
    try {
      const itemId = parseInt(req.params.id);
      await db.delete(magicItems).where(eq(magicItems.id, itemId));
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete magic item:", error);
      res.status(500).json({ message: "Failed to delete magic item" });
    }
  });

  // Monster management routes
  app.post('/api/monsters', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const monsterData = { 
        name: req.body.name,
        type: req.body.type,
        size: req.body.size,
        challenge_rating: req.body.challenge_rating,
        armor_class: req.body.armor_class || 10,
        hit_points: req.body.hit_points || 1,
        speed: req.body.speed || '30 ft.',
        stats: `STR ${req.body.strength || 10}, DEX ${req.body.dexterity || 10}, CON ${req.body.constitution || 10}, INT ${req.body.intelligence || 10}, WIS ${req.body.wisdom || 10}, CHA ${req.body.charisma || 10}`,
        description: req.body.description,
        lore: req.body.notes || '',
        skills: [],
        resistances: [],
        immunities: [],
        senses: [],
        languages: [],
        abilities: [],
        actions: [],
        environment: [],
        created_by: userId,
        is_public: false,
        created_at: new Date()
      };
      
      const [monster] = await db
        .insert(monsters)
        .values(monsterData)
        .returning();
      
      res.json(monster);
    } catch (error) {
      console.error("Error creating monster:", error);
      res.status(500).json({ message: "Failed to create monster" });
    }
  });

  app.get('/api/monsters', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userMonsters = await db
        .select()
        .from(monsters)
        .where(eq(monsters.created_by, userId))
        .orderBy(desc(monsters.created_at));
      
      res.json(userMonsters);
    } catch (error) {
      console.error("Error fetching monsters:", error);
      res.status(500).json({ message: "Failed to fetch monsters" });
    }
  });

  // Update a monster
  app.put('/api/monsters/:id', isAuthenticated, async (req: any, res) => {
    try {
      const monsterId = parseInt(req.params.id);
      const monsterData = {
        name: req.body.name,
        type: req.body.type,
        size: req.body.size,
        alignment: req.body.alignment,
        ac: req.body.ac,
        hp: req.body.hp,
        speed: req.body.speed,
        str: req.body.str,
        dex: req.body.dex,
        con: req.body.con,
        int: req.body.int,
        wis: req.body.wis,
        cha: req.body.cha,
        cr: req.body.cr,
        description: req.body.description,
        updated_at: new Date()
      };

      const [updatedMonster] = await db
        .update(monsters)
        .set(monsterData)
        .where(eq(monsters.id, monsterId))
        .returning();

      res.json(updatedMonster);
    } catch (error) {
      console.error("Failed to update monster:", error);
      res.status(500).json({ message: "Failed to update monster" });
    }
  });

  // Delete a monster
  app.delete('/api/monsters/:id', isAuthenticated, async (req: any, res) => {
    try {
      const monsterId = parseInt(req.params.id);
      await db.delete(monsters).where(eq(monsters.id, monsterId));
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete monster:", error);
      res.status(500).json({ message: "Failed to delete monster" });
    }
  });

  // AI Generation routes for DM toolkit
  app.post('/api/ai-generate/npc', isAuthenticated, async (req: any, res) => {
    try {
      const { race, npcClass, companionType, personalityArchetype, campaignId } = req.body;

      const raceHint = race && race !== 'any' ? `Race: ${race}` : 'Race: choose any interesting D&D race';
      const classHint = npcClass && npcClass !== 'any' ? `Class: ${npcClass}` : 'Class: choose any D&D class that fits';
      const typeHint = companionType && companionType !== 'any' ? `Role in party: ${companionType}` : 'Role: choose a fitting role (combat, support, utility, or social)';
      const personalityHint = personalityArchetype && personalityArchetype !== 'any' ? `Personality archetype: ${personalityArchetype}` : 'Personality: create a unique and memorable personality';

      const prompt = `Generate a unique D&D 5e NPC companion with the following constraints:
${raceHint}
${classHint}
${typeHint}
${personalityHint}

Return valid JSON with exactly these fields:
{
  "name": "Full character name (creative, fits the race)",
  "race": "The character's race",
  "class": "The character's D&D class",
  "occupation": "Their occupation or title (e.g. 'Sellsword', 'Wandering Healer', 'Court Spy')",
  "personality": "2-3 key personality traits in one sentence",
  "appearance": "A vivid 1-2 sentence physical description",
  "motivation": "What drives this character (1-2 sentences)",
  "backstory": "A compelling 2-3 sentence backstory",
  "companionType": "combat | support | utility | social",
  "aiPersonality": "Brief instruction for how AI should roleplay this NPC in-game",
  "combatAbilities": ["ability 1 name", "ability 2 name"],
  "strength": number (8-18),
  "dexterity": number (8-18),
  "constitution": number (8-18),
  "intelligence": number (8-18),
  "wisdom": number (8-18),
  "charisma": number (8-18),
  "skills": ["skill1", "skill2", "skill3"],
  "equipment": ["weapon or item 1", "armor or item 2"],
  "equippedWeapon": "primary weapon name",
  "equippedArmor": "armor name or null"
}

Make this NPC feel like a real person with quirks and depth, not generic.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert D&D 5e Dungeon Master creating memorable NPC companions. Always respond with valid JSON matching the exact schema requested. Stats should be realistic for a level 1 character."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.9,
        max_tokens: 1000
      });

      const aiResult = JSON.parse(completion.choices[0].message.content || "{}");
      
      const npcClassStr = typeof aiResult.class === 'string' ? aiResult.class : 'Fighter';
      const defaultStats = getCompanionDefaultStats(npcClassStr, 1);

      const clampStat = (val: any) => {
        const n = typeof val === 'number' ? val : parseInt(val);
        return isNaN(n) ? 10 : Math.max(3, Math.min(20, n));
      };
      const validCompTypes = ['combat', 'support', 'utility', 'social'];
      const resolvedCompType = validCompTypes.includes(aiResult.companionType) 
        ? aiResult.companionType 
        : (validCompTypes.includes(companionType) ? companionType : 'combat');

      const npcRecord = {
        name: (typeof aiResult.name === 'string' && aiResult.name) ? aiResult.name : 'Unknown Companion',
        race: (typeof aiResult.race === 'string' && aiResult.race) ? aiResult.race : 'Human',
        occupation: (typeof aiResult.occupation === 'string' && aiResult.occupation) ? aiResult.occupation : npcClassStr,
        personality: (typeof aiResult.personality === 'string' && aiResult.personality) ? aiResult.personality : 'Quiet and observant',
        appearance: (typeof aiResult.appearance === 'string' && aiResult.appearance) ? aiResult.appearance : 'A weathered adventurer',
        motivation: (typeof aiResult.motivation === 'string' && aiResult.motivation) ? aiResult.motivation : 'Seeks adventure and coin',
        isCompanion: true,
        companionType: resolvedCompType,
        aiPersonality: (typeof aiResult.aiPersonality === 'string') ? aiResult.aiPersonality : '',
        combatAbilities: Array.isArray(aiResult.combatAbilities) ? aiResult.combatAbilities : [],
        supportAbilities: [],
        decisionMakingRules: {},
        level: 1,
        hitPoints: defaultStats.maxHp,
        maxHitPoints: defaultStats.maxHp,
        armorClass: defaultStats.armorClass,
        strength: clampStat(aiResult.strength),
        dexterity: clampStat(aiResult.dexterity),
        constitution: clampStat(aiResult.constitution),
        intelligence: clampStat(aiResult.intelligence),
        wisdom: clampStat(aiResult.wisdom),
        charisma: clampStat(aiResult.charisma),
        skills: Array.isArray(aiResult.skills) ? aiResult.skills : [],
        equipment: Array.isArray(aiResult.equipment) ? aiResult.equipment : [],
        equippedWeapon: (typeof aiResult.equippedWeapon === 'string') ? aiResult.equippedWeapon : null,
        equippedArmor: (typeof aiResult.equippedArmor === 'string') ? aiResult.equippedArmor : null,
        gold: 10,
        createdBy: req.user.id,
        createdAt: new Date().toISOString(),
      };

      const savedNpc = await storage.createNpc(npcRecord);

      if (campaignId) {
        const campaign = await storage.getCampaign(parseInt(campaignId));
        if (campaign && campaign.userId === req.user.id) {
          const defaultInventory = [
            { name: "Potion of Healing", type: "potion", rarity: "common", description: "Restores 2d4+2 hit points", properties: "Consumable, healing", quantity: 2 }
          ];
          await storage.addNpcToCampaign({
            campaignId: parseInt(campaignId),
            npcId: savedNpc.id,
            role: 'companion',
            isActive: true,
            joinedAt: new Date().toISOString(),
            inventory: defaultInventory,
          } as any);
        }
      }

      res.json({ ...savedNpc, backstory: aiResult.backstory });
    } catch (error) {
      console.error("Failed to generate NPC:", error);
      res.status(500).json({ 
        message: "Failed to generate NPC",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post('/api/ai-generate/location', isAuthenticated, async (req: any, res) => {
    try {
      const prompt = `Generate a D&D location with the following details in JSON format:
{
  "name": "Location name",
  "type": "Type of location (city, dungeon, forest, etc.)",
  "description": "Detailed description of the location",
  "population": "Population size if applicable",
  "government": "Government type if applicable", 
  "notable_features": "Notable features or landmarks",
  "notes": "DM notes and additional details"
}

Create an interesting and unique fantasy location suitable for D&D adventures.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert D&D Dungeon Master. Generate creative and detailed locations for fantasy campaigns. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
        max_tokens: 1500
      });

      const locationData = JSON.parse(completion.choices[0].message.content);
      res.json(locationData);
    } catch (error) {
      console.error("Failed to generate location:", error);
      res.status(500).json({ 
        message: "Failed to generate location",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post('/api/ai-generate/quest', isAuthenticated, async (req: any, res) => {
    try {
      const prompt = `Generate a D&D quest with the following details in JSON format:
{
  "title": "Quest title",
  "description": "Detailed quest description and objective",
  "category": "Quest category (main, side, personal, etc.)",
  "difficulty": "Difficulty level (easy, medium, hard, deadly)",
  "level_range": "Recommended character level range",
  "estimated_duration": "Estimated completion time",
  "notes": "DM notes, plot hooks, and additional details"
}

Create an engaging quest suitable for D&D adventures with clear objectives and interesting story elements.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert D&D Dungeon Master. Generate engaging quests with clear objectives and interesting narratives. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
        max_tokens: 1500
      });

      const questData = JSON.parse(completion.choices[0].message.content);
      res.json(questData);
    } catch (error) {
      console.error("Failed to generate quest:", error);
      res.status(500).json({ 
        message: "Failed to generate quest",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post('/api/ai-generate/magic-item', isAuthenticated, async (req: any, res) => {
    try {
      const prompt = `Generate a D&D magic item with the following details in JSON format:
{
  "name": "Magic item name",
  "type": "Item type (weapon, armor, wondrous, etc.)",
  "rarity": "Rarity level (common, uncommon, rare, very rare, legendary)",
  "description": "Detailed description of appearance and magical properties",
  "requires_attunement": true or false,
  "notes": "DM notes about usage, balance, and lore"
}

Create a unique and balanced magic item suitable for D&D campaigns with interesting magical properties.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert D&D Dungeon Master. Generate balanced and creative magic items with interesting properties. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
        max_tokens: 1500
      });

      const itemData = JSON.parse(completion.choices[0].message.content);
      res.json(itemData);
    } catch (error) {
      console.error("Failed to generate magic item:", error);
      res.status(500).json({ 
        message: "Failed to generate magic item",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post('/api/ai-generate/monster', isAuthenticated, async (req: any, res) => {
    try {
      const prompt = `Generate a D&D monster with the following details in JSON format:
{
  "name": "Monster name",
  "size": "Size category (tiny, small, medium, large, huge, gargantuan)",
  "type": "Creature type (beast, humanoid, undead, etc.)",
  "alignment": "Alignment (e.g., chaotic evil)",
  "challenge_rating": "Challenge rating (e.g., 1/4, 2, 5)",
  "armor_class": 15,
  "hit_points": 58,
  "speed": "Speed (e.g., 30 ft., fly 60 ft.)",
  "strength": 16,
  "dexterity": 14,
  "constitution": 16,
  "intelligence": 10,
  "wisdom": 12,
  "charisma": 8,
  "description": "Detailed description of appearance and behavior",
  "notes": "DM notes about tactics, lore, and special abilities"
}

Create a unique monster with balanced stats appropriate for its challenge rating.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert D&D Dungeon Master. Generate balanced monsters with appropriate stats for their challenge rating. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
        max_tokens: 1500
      });

      const monsterData = JSON.parse(completion.choices[0].message.content);
      res.json(monsterData);
    } catch (error) {
      console.error("Failed to generate monster:", error);
      res.status(500).json({ 
        message: "Failed to generate monster",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Generate monster from threat archetype
  app.post('/api/ai-generate/threat-monster', isAuthenticated, async (req: any, res) => {
    try {
      const { archetype } = req.body;
      if (!archetype) {
        return res.status(400).json({ message: "Archetype data required" });
      }

      const tierToCR: Record<string, string> = { low: '1', medium: '3', high: '6', apex: '10' };
      const cr = tierToCR[archetype.threatTier] || '1';

      const prompt = `Generate a D&D monster based on this threat archetype:

Archetype: ${archetype.displayName}
Role: ${archetype.playstyleRole}
Threat Tier: ${archetype.threatTier} (CR ${cr})
Purpose: ${archetype.narrativeFunction?.purpose || 'Combat encounter'}
Default Tactic: ${archetype.behavior?.defaultTactic || 'Aggressive'}
Under Pressure: ${archetype.behavior?.underPressure || 'Reckless'}
When Winning: ${archetype.behavior?.whenWinning || 'Press advantage'}
When Losing: ${archetype.behavior?.whenLosing || 'Flee'}
Possible Reskins: ${archetype.reskins?.join(', ') || 'Generic monster'}

Create a specific creature (pick one of the reskins or create a thematic variant) with the following JSON format:
{
  "name": "Specific monster name",
  "size": "Size category",
  "type": "Creature type",
  "alignment": "Alignment",
  "challenge_rating": "${cr}",
  "armor_class": 15,
  "hit_points": 58,
  "speed": "30 ft.",
  "strength": 16,
  "dexterity": 14,
  "constitution": 16,
  "intelligence": 10,
  "wisdom": 12,
  "charisma": 8,
  "description": "Description incorporating the archetype's behavior and tactics",
  "notes": "DM notes on how to run this creature using the archetype's behavior patterns"
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert D&D Dungeon Master. Generate thematic monsters that embody the given threat archetype's behavioral patterns. The monster should feel like a living creature that follows the archetype's tactics. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
        max_tokens: 1500
      });

      const aiMonsterData = JSON.parse(completion.choices[0].message.content || '{}');
      
      // Save to database
      const monsterToSave = {
        name: aiMonsterData.name,
        type: aiMonsterData.type,
        size: aiMonsterData.size,
        challenge_rating: aiMonsterData.challenge_rating || cr,
        armor_class: aiMonsterData.armor_class || 10,
        hit_points: aiMonsterData.hit_points || 1,
        speed: aiMonsterData.speed || '30 ft.',
        stats: `STR ${aiMonsterData.strength || 10}, DEX ${aiMonsterData.dexterity || 10}, CON ${aiMonsterData.constitution || 10}, INT ${aiMonsterData.intelligence || 10}, WIS ${aiMonsterData.wisdom || 10}, CHA ${aiMonsterData.charisma || 10}`,
        description: aiMonsterData.description,
        lore: aiMonsterData.notes || '',
        skills: [],
        resistances: [],
        immunities: [],
        senses: [],
        languages: [],
        abilities: [],
        actions: [],
        environment: [],
        created_by: req.user!.id,
        is_public: false,
        created_at: new Date()
      };

      const [savedMonster] = await db
        .insert(monsters)
        .values(monsterToSave)
        .returning();

      res.json(savedMonster);
    } catch (error) {
      console.error("Failed to generate threat monster:", error);
      res.status(500).json({ 
        message: "Failed to generate threat monster",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Character XP and Inventory Management Routes
  // ========== WORLD PRESSURE ==========

  const SUGGESTED_PRESSURES_POOL = [
    { name: "Bandit activity rising on trade roads", stage: 1, maxStages: 5, trigger: "Merchants report more attacks each tenday", daysToAdvance: 3 },
    { name: "Local noble consolidating power", stage: 1, maxStages: 5, trigger: "Political maneuvering goes unchecked", daysToAdvance: 5 },
    { name: "Cult rumor spreading through taverns", stage: 1, maxStages: 5, trigger: "No one investigates the disappearances", daysToAdvance: 4 },
    { name: "Weather anomaly approaching from the north", stage: 2, maxStages: 5, trigger: "Natural forces beyond mortal control", daysToAdvance: 2 },
    { name: "Merchant guild threatening a trade strike", stage: 1, maxStages: 5, trigger: "Taxes remain high with no negotiation", daysToAdvance: 6 },
    { name: "Ancient seal weakening in the undercrypt", stage: 1, maxStages: 5, trigger: "Magical wards decay without maintenance", daysToAdvance: 7 },
    { name: "Refugee caravan arriving from war-torn lands", stage: 2, maxStages: 5, trigger: "Conflict in neighboring region escalates", daysToAdvance: 3 },
    { name: "Wild magic surges growing more frequent", stage: 1, maxStages: 5, trigger: "Ley line disruption beneath the city", daysToAdvance: 4 },
    { name: "Thieves' guild expanding territory", stage: 1, maxStages: 5, trigger: "City watch stretched too thin", daysToAdvance: 5 },
    { name: "Dragon sighting reported near the mountains", stage: 1, maxStages: 5, trigger: "Ancient creature stirs from slumber", daysToAdvance: 8 },
  ];

  const SPARK_TEMPLATES: Record<string, { pressures: Array<{ name: string; stage: number; maxStages: number; trigger: string; daysToAdvance: number }>; hiddenVariable: string }> = {
    political: {
      pressures: [
        { name: "Succession crisis brewing in the royal court", stage: 1, maxStages: 5, trigger: "No clear heir named before deadline", daysToAdvance: 4 },
        { name: "Foreign ambassador making secret deals", stage: 2, maxStages: 5, trigger: "Diplomatic immunity shields investigation", daysToAdvance: 3 },
      ],
      hiddenVariable: "The court advisor is actually working for a rival kingdom",
    },
    natural: {
      pressures: [
        { name: "Unnatural storms battering the coast", stage: 2, maxStages: 5, trigger: "Elemental forces remain unbound", daysToAdvance: 2 },
        { name: "Crops failing across the farmlands", stage: 1, maxStages: 5, trigger: "Blight spreads unchecked through soil", daysToAdvance: 5 },
      ],
      hiddenVariable: "An imprisoned elemental is the source of the disturbance",
    },
    faction: {
      pressures: [
        { name: "Two guilds escalating toward open conflict", stage: 2, maxStages: 5, trigger: "Territory dispute remains unresolved", daysToAdvance: 3 },
        { name: "Militia forming in the outer districts", stage: 1, maxStages: 5, trigger: "People lose faith in official protection", daysToAdvance: 4 },
      ],
      hiddenVariable: "A third faction is secretly manipulating both sides",
    },
    religious: {
      pressures: [
        { name: "Heretical sect gaining followers rapidly", stage: 1, maxStages: 5, trigger: "Established temples fail to respond", daysToAdvance: 5 },
        { name: "Sacred relic reported stolen from the cathedral", stage: 2, maxStages: 5, trigger: "Temple guards found unconscious, no leads", daysToAdvance: 3 },
      ],
      hiddenVariable: "The high priest knows more than they're revealing",
    },
    criminal: {
      pressures: [
        { name: "Smuggling ring using the sewers", stage: 2, maxStages: 5, trigger: "Underground passages go unpatrolled", daysToAdvance: 3 },
        { name: "Mysterious poisonings targeting merchants", stage: 1, maxStages: 5, trigger: "No antidote found, deaths continue", daysToAdvance: 4 },
      ],
      hiddenVariable: "The crime lord has a legitimate public identity no one suspects",
    },
    arcane: {
      pressures: [
        { name: "Unstable portal flickering in the mage quarter", stage: 2, maxStages: 5, trigger: "Arcane energy builds without release", daysToAdvance: 2 },
        { name: "Wizards reporting shared nightmares", stage: 1, maxStages: 5, trigger: "Psychic resonance from an unknown source", daysToAdvance: 4 },
      ],
      hiddenVariable: "An entity from the Far Realm is probing the barrier between worlds",
    },
  };

  const PROACTIVE_WORLD_EVENTS = [
    { title: "Seasonal migration shifts trade routes", description: "Nomadic tribes are moving earlier than expected, disrupting caravan schedules and merchant plans.", impact: "Trade goods become scarce in frontier settlements" },
    { title: "Full moon intensifies lycanthropic activity", description: "Reports of livestock attacks increase near the forest edge. Guards double their patrols.", impact: "Curfews tighten, suspicion falls on outsiders" },
    { title: "Rival adventuring party completes a quest", description: "Another group of adventurers returned from the Hollow Peaks with treasure and glory. The tavern buzzes with their tales.", impact: "Competition for available quests intensifies" },
    { title: "Tax collectors making rounds", description: "The crown's agents are moving through the region collecting seasonal tributes. Some villages resist.", impact: "Local tensions rise, potential allies become cautious" },
    { title: "Festival preparations begin in the capital", description: "The annual Harvest Revel draws crowds and attention. Security is diverted to celebration duties.", impact: "Criminal elements exploit the distraction" },
    { title: "Ancient observatory aligns with celestial event", description: "Stargazers report an unusual conjunction approaching. Old prophecies are being re-examined.", impact: "Magical energies fluctuate unpredictably" },
  ];

  app.get("/api/campaigns/:id/world-pressure", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      const threads = await db.select().from(unresolvedThreads).where(
        and(
          eq(unresolvedThreads.campaignId, campaignId),
          isNull(unresolvedThreads.resolvedAt)
        )
      );

      const activePressures = (campaign as any).activePressures || [];
      const campaignStakes = (campaign as any).campaignStakes || [];
      const powerNetwork = (campaign as any).powerNetwork || null;
      const rivalAgent = (campaign as any).rivalAgent || null;
      const meterWorldEffects = (campaign as any).meterWorldEffects || null;
      const dynamicClimax = (campaign as any).dynamicClimax || null;
      const dmPressures = (campaign as any).dmPressures || [];
      const dmClocks = (campaign as any).dmClocks || [];

      const stakes = Array.isArray(campaignStakes)
        ? campaignStakes.map((s: any) => ({
            name: s.name || s.id || "Unknown",
            value: s.value ?? 0,
            maxValue: s.max ?? s.maxValue ?? 5,
          }))
        : [];

      const unresolvedThreadsList = threads.map((t) => ({
        id: t.id,
        description: t.title || t.narrative,
        urgency: t.urgency || "low",
        createdAt: t.createdAt,
      }));

      const doNothingForecast: string[] = [];

      for (const clock of dmClocks) {
        if (clock.stage >= clock.maxStages - 1) {
          doNothingForecast.push(`Clock "${clock.name}" is about to complete`);
        } else if (clock.daysToAdvance && clock.daysToAdvance <= 2) {
          doNothingForecast.push(`"${clock.name}" advances in ${clock.daysToAdvance} day${clock.daysToAdvance === 1 ? '' : 's'}`);
        }
      }

      for (const s of stakes) {
        if (s.value >= 4) {
          doNothingForecast.push(`${s.name} reaches critical threshold`);
        }
      }

      if (rivalAgent && typeof rivalAgent === "object") {
        const ra = rivalAgent as any;
        if (ra.nextAction || ra.next_action) {
          const name = ra.name || ra.id || "Unknown rival";
          const action = ra.nextAction || ra.next_action;
          doNothingForecast.push(`Rival ${name} advances: ${action}`);
        }
      }

      if (powerNetwork && typeof powerNetwork === "object") {
        const pn = powerNetwork as any;
        const factions = Array.isArray(pn) ? pn : (pn.factions || pn.groups || []);
        for (const f of factions) {
          if (f.instability || f.unstable) {
            doNothingForecast.push(`${f.name || f.id || "A faction"} grows more unstable`);
          }
        }
      }

      if (meterWorldEffects && typeof meterWorldEffects === "object") {
        const effects = Array.isArray(meterWorldEffects) ? meterWorldEffects : Object.entries(meterWorldEffects);
        if (effects.length > 0) {
          const meterName = Array.isArray(meterWorldEffects)
            ? (meterWorldEffects[0] as any)?.name || (meterWorldEffects[0] as any)?.meter || "a meter"
            : String(effects[0]?.[0] || "a meter");
          doNothingForecast.push(`Environment shifts as ${meterName} rises`);
        }
      }

      for (const t of unresolvedThreadsList) {
        if (t.urgency === "high" || t.urgency === "critical") {
          doNothingForecast.push(`Unresolved: ${t.description} demands attention`);
        }
      }

      const hasDMContent = dmPressures.length > 0 || dmClocks.length > 0;
      const hasAnyPressures = activePressures.length > 0 || stakes.length > 0 || unresolvedThreadsList.length > 0 || rivalAgent;

      let suggestedPressures: any[] = [];
      if (!hasDMContent && !hasAnyPressures) {
        const seed = campaignId * 7;
        const shuffled = [...SUGGESTED_PRESSURES_POOL].sort((a, b) => {
          const ha = (seed + a.name.length) % 100;
          const hb = (seed + b.name.length) % 100;
          return ha - hb;
        });
        suggestedPressures = shuffled.slice(0, 3);
      }

      const seed2 = (campaignId * 13) % PROACTIVE_WORLD_EVENTS.length;
      const suggestedWorldEvents = [];
      for (let i = 0; i < 2; i++) {
        suggestedWorldEvents.push(PROACTIVE_WORLD_EVENTS[(seed2 + i) % PROACTIVE_WORLD_EVENTS.length]);
      }

      res.json({
        activePressures,
        stakes,
        unresolvedThreads: unresolvedThreadsList,
        powerNetwork,
        rivalAgent,
        meterWorldEffects,
        dynamicClimax,
        doNothingForecast: doNothingForecast.slice(0, 5),
        dmPressures,
        dmClocks,
        suggestedPressures,
        suggestedWorldEvents,
      });
    } catch (error) {
      console.error("Failed to fetch world pressure:", error);
      res.status(500).json({ message: "Failed to fetch world pressure data" });
    }
  });

  app.post("/api/campaigns/:id/dm-pressures", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });

      const { pressure } = req.body;
      if (!pressure || !pressure.name) return res.status(400).json({ message: "Pressure name required" });

      const existing = (campaign as any).dmPressures || [];
      const newPressure = {
        id: `pressure-${Date.now()}`,
        name: pressure.name,
        stage: pressure.stage ?? 1,
        maxStages: pressure.maxStages ?? 5,
        trigger: pressure.trigger || "",
        daysToAdvance: pressure.daysToAdvance ?? 0,
        createdAt: new Date().toISOString(),
      };
      const updated = [...existing, newPressure];
      await storage.updateCampaign(campaignId, { dmPressures: updated } as any);
      res.json(newPressure);
    } catch (error) {
      console.error("Failed to add DM pressure:", error);
      res.status(500).json({ message: "Failed to add pressure" });
    }
  });

  app.patch("/api/campaigns/:id/dm-pressures/:pressureId", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const pressureId = req.params.pressureId;
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });

      const existing = (campaign as any).dmPressures || [];
      const updates = req.body;
      const updated = existing.map((p: any) => p.id === pressureId ? { ...p, ...updates } : p);
      await storage.updateCampaign(campaignId, { dmPressures: updated } as any);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to update DM pressure:", error);
      res.status(500).json({ message: "Failed to update pressure" });
    }
  });

  app.delete("/api/campaigns/:id/dm-pressures/:pressureId", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const pressureId = req.params.pressureId;
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });

      const existing = (campaign as any).dmPressures || [];
      const updated = existing.filter((p: any) => p.id !== pressureId);
      await storage.updateCampaign(campaignId, { dmPressures: updated } as any);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete DM pressure:", error);
      res.status(500).json({ message: "Failed to delete pressure" });
    }
  });

  app.post("/api/campaigns/:id/dm-clocks", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });

      const { clock } = req.body;
      if (!clock || !clock.name) return res.status(400).json({ message: "Clock name required" });

      const existing = (campaign as any).dmClocks || [];
      const newClock = {
        id: `clock-${Date.now()}`,
        name: clock.name,
        stage: clock.stage ?? 0,
        maxStages: clock.maxStages ?? 5,
        trigger: clock.trigger || "",
        daysToAdvance: clock.daysToAdvance ?? 0,
        createdAt: new Date().toISOString(),
      };
      const updated = [...existing, newClock];
      await storage.updateCampaign(campaignId, { dmClocks: updated } as any);
      res.json(newClock);
    } catch (error) {
      console.error("Failed to add DM clock:", error);
      res.status(500).json({ message: "Failed to add clock" });
    }
  });

  app.patch("/api/campaigns/:id/dm-clocks/:clockId", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const clockId = req.params.clockId;
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });

      const existing = (campaign as any).dmClocks || [];
      const updates = req.body;
      const updated = existing.map((c: any) => c.id === clockId ? { ...c, ...updates } : c);
      await storage.updateCampaign(campaignId, { dmClocks: updated } as any);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to update DM clock:", error);
      res.status(500).json({ message: "Failed to update clock" });
    }
  });

  app.delete("/api/campaigns/:id/dm-clocks/:clockId", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const clockId = req.params.clockId;
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });

      const existing = (campaign as any).dmClocks || [];
      const updated = existing.filter((c: any) => c.id !== clockId);
      await storage.updateCampaign(campaignId, { dmClocks: updated } as any);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete DM clock:", error);
      res.status(500).json({ message: "Failed to delete clock" });
    }
  });

  app.post("/api/campaigns/:id/spark", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });

      const { sparkType } = req.body;
      const template = SPARK_TEMPLATES[sparkType];
      if (!template) return res.status(400).json({ message: "Invalid spark type" });

      const existingPressures = (campaign as any).dmPressures || [];
      const existingClocks = (campaign as any).dmClocks || [];

      const newPressures = template.pressures.map((p: any, i: number) => ({
        id: `pressure-spark-${Date.now()}-${i}`,
        ...p,
        createdAt: new Date().toISOString(),
        source: "spark",
      }));

      const newClocks = template.pressures.map((p: any, i: number) => ({
        id: `clock-spark-${Date.now()}-${i}`,
        name: p.name,
        stage: p.stage,
        maxStages: p.maxStages,
        trigger: p.trigger,
        daysToAdvance: p.daysToAdvance,
        createdAt: new Date().toISOString(),
      }));

      await storage.updateCampaign(campaignId, {
        dmPressures: [...existingPressures, ...newPressures],
        dmClocks: [...existingClocks, ...newClocks],
      } as any);

      res.json({
        pressures: newPressures,
        clocks: newClocks,
        hiddenVariable: template.hiddenVariable,
      });
    } catch (error) {
      console.error("Failed to apply spark:", error);
      res.status(500).json({ message: "Failed to apply spark" });
    }
  });

  // ========== UNRESOLVED THREADS ==========
  
  // Get unresolved threads for a campaign
  app.get("/api/campaigns/:campaignId/threads", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const characterId = req.query.characterId ? parseInt(req.query.characterId as string) : undefined;
      const threads = await storage.getUnresolvedThreads(campaignId, characterId);
      res.json(threads);
    } catch (error) {
      console.error("Failed to fetch threads:", error);
      res.status(500).json({ message: "Failed to fetch threads" });
    }
  });
  
  // Get active threads only
  app.get("/api/campaigns/:campaignId/threads/active", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const threads = await storage.getActiveThreads(campaignId);
      res.json(threads);
    } catch (error) {
      console.error("Failed to fetch active threads:", error);
      res.status(500).json({ message: "Failed to fetch active threads" });
    }
  });
  
  // Create an unresolved thread
  app.post("/api/campaigns/:campaignId/threads", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      // Verify user is DM of this campaign
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign || campaign.dmUserId !== req.user.id) {
        return res.status(403).json({ message: "Only the DM can create threads" });
      }
      const validated = insertUnresolvedThreadSchema.parse({
        ...req.body,
        campaignId
      });
      const thread = await storage.createUnresolvedThread(validated);
      res.status(201).json(thread);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid thread data", errors: error.errors });
      }
      console.error("Failed to create thread:", error);
      res.status(500).json({ message: "Failed to create thread" });
    }
  });
  
  // Resolve a thread
  app.patch("/api/threads/:id/resolve", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const resolved = await storage.resolveThread(id, req.body.notes);
      res.json(resolved);
    } catch (error) {
      console.error("Failed to resolve thread:", error);
      res.status(500).json({ message: "Failed to resolve thread" });
    }
  });
  
  // ========== CHARACTER ARC INSIGHTS ==========
  
  // Get insights for a character
  app.get("/api/characters/:characterId/arc-insights", isAuthenticated, async (req, res) => {
    try {
      const characterId = parseInt(req.params.characterId);
      const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined;
      const insights = await storage.getCharacterArcInsights(characterId, campaignId);
      res.json(insights);
    } catch (error) {
      console.error("Failed to fetch arc insights:", error);
      res.status(500).json({ message: "Failed to fetch arc insights" });
    }
  });
  
  // Get unrevealed insights for a character
  app.get("/api/characters/:characterId/arc-insights/unrevealed", isAuthenticated, async (req, res) => {
    try {
      const characterId = parseInt(req.params.characterId);
      const insights = await storage.getUnrevealedInsights(characterId);
      res.json(insights);
    } catch (error) {
      console.error("Failed to fetch unrevealed insights:", error);
      res.status(500).json({ message: "Failed to fetch unrevealed insights" });
    }
  });
  
  // Create an arc insight
  app.post("/api/characters/:characterId/arc-insights", isAuthenticated, async (req: any, res) => {
    try {
      const characterId = parseInt(req.params.characterId);
      // Verify user owns this character or is DM of related campaign
      const character = await storage.getCharacter(characterId);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      // Only DMs should create arc insights, check via campaign if specified
      const campaignId = req.body.campaignId;
      if (campaignId) {
        const campaign = await storage.getCampaign(campaignId);
        if (!campaign || campaign.dmUserId !== req.user.id) {
          return res.status(403).json({ message: "Only the DM can create arc insights" });
        }
      } else if (character.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const validated = insertCharacterArcInsightSchema.parse({
        ...req.body,
        characterId
      });
      const insight = await storage.createCharacterArcInsight(validated);
      res.status(201).json(insight);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid insight data", errors: error.errors });
      }
      console.error("Failed to create arc insight:", error);
      res.status(500).json({ message: "Failed to create arc insight" });
    }
  });
  
  // Reveal an insight
  app.patch("/api/arc-insights/:id/reveal", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      // Get the insight to check ownership
      const insight = await storage.getCharacterArcInsight(id);
      if (!insight) {
        return res.status(404).json({ message: "Insight not found" });
      }
      // Verify user owns the character
      const character = await storage.getCharacter(insight.characterId);
      if (!character || character.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to reveal this insight" });
      }
      const revealed = await storage.revealInsight(id);
      res.json(revealed);
    } catch (error) {
      console.error("Failed to reveal insight:", error);
      res.status(500).json({ message: "Failed to reveal insight" });
    }
  });
  
  // ========== SINCE LAST TIME... ==========
  
  // Get "Since Last Time..." bullets for a campaign
  app.get("/api/campaigns/:campaignId/since-last-time", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const userId = req.user.id;
      
      // Get tracking data
      const tracking = await storage.getUserSessionTracking(userId, campaignId);
      
      // If no tracking or stale, generate new bullets from world memory
      const now = new Date();
      const shouldRefresh = !tracking || 
        !tracking.bulletsCachedAt || 
        (new Date(tracking.bulletsCachedAt).getTime() < now.getTime() - 3600000); // 1 hour cache
      
      if (shouldRefresh) {
        // Get recent world memories since last login
        const memories = await storage.getWorldMemories(campaignId);
        const lastLogin = tracking?.lastLoginAt ? new Date(tracking.lastLoginAt) : new Date(0);
        
        // Filter to events since last login and generate bullets
        const recentMemories = memories.filter(m => 
          new Date(m.createdAt) > lastLogin
        ).slice(0, 5);
        
        const bullets = recentMemories.map(m => m.narrative);
        
        // Update tracking
        await storage.updateUserSessionTracking(userId, campaignId, bullets);
        
        res.json({ bullets, lastLogin: tracking?.lastLoginAt || null });
      } else {
        res.json({ 
          bullets: tracking.sinceThenBullets || [], 
          lastLogin: tracking.lastLoginAt 
        });
      }
    } catch (error) {
      console.error("Failed to fetch since-last-time data:", error);
      res.status(500).json({ message: "Failed to fetch since-last-time data" });
    }
  });
  
  // Record a campaign visit (updates last login)
  app.post("/api/campaigns/:campaignId/record-visit", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const userId = req.user.id;
      
      // Update session tracking with current login time
      const tracking = await storage.updateUserSessionTracking(userId, campaignId, []);
      res.json(tracking);
    } catch (error) {
      console.error("Failed to record visit:", error);
      res.status(500).json({ message: "Failed to record visit" });
    }
  });

}
