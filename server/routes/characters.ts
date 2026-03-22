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
  app.get("/api/characters", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userCharacters = await storage.getCharactersByUserId(userId);
      res.json(userCharacters);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch characters" });
    }
  });

  app.post("/api/characters", isAuthenticated, async (req: any, res) => {
    try {
      const rawData = req.body;
      const characterData = insertCharacterSchema.parse({
        ...rawData,
        userId: req.user.id
      });
      
      // Check for duplicate character name for this user
      const existingCharacters = await storage.getCharactersByUserId(req.user.id);
      const duplicateName = existingCharacters.find(
        (c: any) => c.name.toLowerCase() === (characterData as any).name?.toLowerCase()
      );
      if (duplicateName) {
        return res.status(400).json({ 
          message: `You already have a character named "${(characterData as any).name}". Please choose a different name.`
        });
      }
      
      // Add starter consumables including resurrection scrolls
      const starterConsumables = [
        { name: "Healing Potion", quantity: 2, type: "healing", effect: "Restores 2d4+2 HP", healDice: "2d4", healBonus: 2 },
        { name: "Scroll of Revivify", quantity: 2, type: "utility", effect: "Resurrects a dead character" },
        { name: "Antitoxin", quantity: 1, type: "utility", effect: "Advantage on poison saves for 1 hour" }
      ];
      
      // Add starter equipment based on class
      const characterClass = (characterData as any).class?.toLowerCase() || "";
      let starterWeapon = "Shortsword";
      let starterArmor = "Leather Armor";
      
      // Class-specific starting equipment
      if (["fighter", "paladin", "barbarian"].includes(characterClass)) {
        starterWeapon = "Longsword";
        starterArmor = "Chain Mail";
      } else if (["ranger", "rogue"].includes(characterClass)) {
        starterWeapon = "Shortbow";
        starterArmor = "Leather Armor";
      } else if (["wizard", "sorcerer", "warlock"].includes(characterClass)) {
        starterWeapon = "Quarterstaff";
        starterArmor = "Robes";
      } else if (["cleric", "druid"].includes(characterClass)) {
        starterWeapon = "Mace";
        starterArmor = "Scale Mail";
      } else if (["monk"].includes(characterClass)) {
        starterWeapon = "Quarterstaff";
        starterArmor = "Simple Clothes";
      } else if (["bard"].includes(characterClass)) {
        starterWeapon = "Rapier";
        starterArmor = "Leather Armor";
      }
      
      const starterEquipment = [starterWeapon, starterArmor, "Backpack", "Waterskin", "Rations (5 days)"];
      
      // Merge with any existing consumables and equipment
      const existingConsumables = (characterData as any).consumables || [];
      const mergedConsumables = [...starterConsumables, ...existingConsumables];
      const existingEquipment = (characterData as any).equipment || [];
      const mergedEquipment = [...starterEquipment, ...existingEquipment];
      
      // Add starter gold and silver
      const starterGold = 50;
      const starterSilver = 50;
      
      const character = await storage.createCharacter({
        ...characterData,
        consumables: mergedConsumables,
        equipment: mergedEquipment,
        equippedWeapon: starterWeapon,
        equippedArmor: starterArmor,
        gold: ((characterData as any).gold || 0) + starterGold,
        silver: ((characterData as any).silver || 0) + starterSilver
      } as any);
      res.status(201).json(character);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid character data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create character" });
      }
    }
  });

  app.post("/api/characters/quick-build", isAuthenticated, async (req: any, res) => {
    try {
      const { campaignId } = req.body;
      const userId = req.user.id;

      const races = ["Human", "Elf", "Dwarf", "Halfling", "Half-Orc", "Tiefling", "Gnome", "Dragonborn"];
      const classes = ["Fighter", "Rogue", "Wizard", "Cleric", "Ranger", "Bard", "Paladin", "Barbarian"];
      const namesByRace: Record<string, string[]> = {
        Human: ["Aldric", "Elara", "Garrett", "Sera", "Theron", "Mira", "Cedric", "Lyra"],
        Elf: ["Aelindra", "Thalion", "Faelwen", "Caelum", "Isilme", "Eryndor"],
        Dwarf: ["Thorin", "Brenna", "Durin", "Helga", "Balin", "Greta"],
        Halfling: ["Pippin", "Rosie", "Milo", "Daisy", "Tuck", "Fern"],
        "Half-Orc": ["Grukk", "Shara", "Brog", "Kestra", "Thokk", "Yara"],
        Tiefling: ["Zariel", "Lilith", "Mordai", "Ravenna", "Akta", "Nyx"],
        Gnome: ["Fizban", "Nimble", "Gizmo", "Tinka", "Cogsworth", "Pip"],
        Dragonborn: ["Rhogar", "Surina", "Balasar", "Jheri", "Torinn", "Kava"]
      };

      const race = races[Math.floor(Math.random() * races.length)];
      const charClass = classes[Math.floor(Math.random() * classes.length)];
      const names = namesByRace[race] || namesByRace.Human;
      const name = names[Math.floor(Math.random() * names.length)];

      const rollStat = () => {
        const rolls = [1,2,3,4].map(() => Math.floor(Math.random() * 6) + 1);
        rolls.sort((a, b) => a - b);
        return rolls[1] + rolls[2] + rolls[3];
      };

      const stats = {
        strength: rollStat(),
        dexterity: rollStat(),
        constitution: rollStat(),
        intelligence: rollStat(),
        wisdom: rollStat(),
        charisma: rollStat()
      };

      const conMod = Math.floor((stats.constitution - 10) / 2);
      const hitDice: Record<string, number> = {
        Fighter: 10, Paladin: 10, Ranger: 10,
        Barbarian: 12,
        Rogue: 8, Bard: 8, Cleric: 8, Monk: 8, Druid: 8, Warlock: 8,
        Wizard: 6, Sorcerer: 6
      };
      const hd = hitDice[charClass] || 8;
      const hp = hd + conMod;

      let weapon = "Shortsword";
      let armor = "Leather Armor";
      let ac = 11 + Math.floor((stats.dexterity - 10) / 2);

      if (["Fighter", "Paladin", "Barbarian"].includes(charClass)) {
        weapon = "Longsword"; armor = "Chain Mail"; ac = 16;
      } else if (charClass === "Ranger" || charClass === "Rogue") {
        weapon = charClass === "Ranger" ? "Shortbow" : "Rapier";
      } else if (charClass === "Wizard") {
        weapon = "Quarterstaff"; armor = "Robes"; ac = 10 + Math.floor((stats.dexterity - 10) / 2);
      } else if (charClass === "Cleric") {
        weapon = "Mace"; armor = "Scale Mail"; ac = 14 + Math.min(2, Math.floor((stats.dexterity - 10) / 2));
      } else if (charClass === "Bard") {
        weapon = "Rapier";
      }

      const consumables = [
        { name: "Healing Potion", quantity: 2, type: "healing", effect: "Restores 2d4+2 HP", healDice: "2d4", healBonus: 2 },
        { name: "Scroll of Revivify", quantity: 2, type: "utility", effect: "Resurrects a dead character" },
        { name: "Antitoxin", quantity: 1, type: "utility", effect: "Advantage on poison saves for 1 hour" }
      ];
      const equipment = [weapon, armor, "Backpack", "Waterskin", "Rations (5 days)"];

      const character = await storage.createCharacter({
        userId,
        name,
        race,
        class: charClass,
        level: 1,
        hitPoints: Math.max(1, hp),
        maxHitPoints: Math.max(1, hp),
        armorClass: ac,
        ...stats,
        background: "Adventurer",
        alignment: "Neutral Good",
        experiencePoints: 0,
        gold: 50,
        silver: 50,
        consumables,
        equipment,
        equippedWeapon: weapon,
        equippedArmor: armor,
        proficiencyBonus: 2,
      } as any);

      if (campaignId) {
        await storage.addCampaignParticipant({
          campaignId,
          userId,
          characterId: character.id,
          role: 'player'
        });
      }

      res.status(201).json(character);
    } catch (error) {
      console.error("Quick-build character error:", error);
      res.status(500).json({ message: "Failed to quick-build character" });
    }
  });

  app.get("/api/characters/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const character = await storage.getCharacter(id);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      res.json(character);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch character" });
    }
  });

  // Delete a character (only owner can delete)
  app.delete("/api/characters/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const id = parseInt(req.params.id);
      const character = await storage.getCharacter(id);
      
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      // Verify ownership
      if (character.userId !== req.user.id) {
        return res.status(403).json({ message: "You can only delete your own characters" });
      }
      
      // Check if character is in any active campaigns
      const campaigns = await storage.getCampaigns();
      const participatingCampaigns = [];
      for (const campaign of campaigns) {
        const participants = await storage.getCampaignParticipants(campaign.id);
        if (participants.some(p => p.characterId === id)) {
          participatingCampaigns.push(campaign.title);
        }
      }
      
      if (participatingCampaigns.length > 0) {
        return res.status(400).json({ 
          message: `Cannot delete character while participating in campaigns: ${participatingCampaigns.join(', ')}. Remove them from these campaigns first.`
        });
      }
      
      await storage.deleteCharacter(id);
      res.json({ message: "Character deleted successfully" });
    } catch (error) {
      console.error("Error deleting character:", error);
      res.status(500).json({ message: "Failed to delete character" });
    }
  });
  
  // Testing OpenAI portrait generation
  app.get("/api/test-portrait-generation", async (req, res) => {
    try {
      // Test portrait generation
      const testPrompt = "Create a fantasy portrait of a dwarf fighter with armor and axe";
      
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      console.log("Testing OpenAI portrait generation...");
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: testPrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "vivid",
      });
      
      console.log("OpenAI response:", response);
      
      const imageData = response.data?.[0];
      if (!imageData || !imageData.url) {
        throw new Error("No image data returned from OpenAI");
      }
      
      res.json({ 
        success: true, 
        message: "Test portrait generation successful", 
        url: imageData.url
      });
    } catch (error: any) {
      console.error("Error testing portrait generation:", error);
      res.status(500).json({ 
        success: false, 
        message: "Test portrait generation failed", 
        error: error.message 
      });
    }
  });

  // Character Portrait and Background Generation endpoints
  app.post("/api/characters/:id/generate-portrait", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const character = await storage.getCharacter(id);
      
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      // Generate portrait using OpenAI
      const portraitData = await generateCharacterPortrait({
        name: character.name,
        race: character.race,
        class: character.class,
        background: character.background || undefined,
        appearance: character.appearance || undefined
      });
      
      // Update character with portrait URL
      const updatedCharacter = await storage.updateCharacter(id, {
        portraitUrl: portraitData.url
      });
      
      res.json({ 
        portraitUrl: portraitData.url, 
        character: updatedCharacter 
      });
    } catch (error: any) {
      console.error("Error generating character portrait:", error);
      res.status(500).json({ 
        message: "Failed to generate character portrait", 
        error: error.message 
      });
    }
  });

  // NPC Portrait Generation endpoint
  app.post("/api/npcs/:id/generate-portrait", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const npc = await storage.getNpc(id);
      
      if (!npc) {
        return res.status(404).json({ message: "NPC not found" });
      }
      
      // Generate portrait using OpenAI with NPC details
      const portraitData = await generateCharacterPortrait({
        name: npc.name,
        race: npc.race,
        class: npc.occupation || 'Warrior',
        background: npc.personality || undefined,
        appearance: npc.appearance || undefined
      });
      
      // Update NPC with portrait URL
      const updatedNpc = await storage.updateNpc(id, {
        portraitUrl: portraitData.url
      });
      
      res.json({ 
        portraitUrl: portraitData.url, 
        npc: updatedNpc 
      });
    } catch (error: any) {
      console.error("Error generating NPC portrait:", error);
      res.status(500).json({ 
        message: "Failed to generate NPC portrait", 
        error: error.message 
      });
    }
  });
  
  // ========================================
  // Open5e SRD Reference API (proxy with caching)
  // ========================================
  
  // Simple in-memory cache with TTL (1 hour)
  const open5eCache = new Map<string, { data: any; expiry: number }>();
  const CACHE_TTL = 60 * 60 * 1000; // 1 hour
  
  async function fetchOpen5e(url: string): Promise<any> {
    const cached = open5eCache.get(url);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Open5e API error: ${response.status}`);
    }
    
    const data = await response.json();
    open5eCache.set(url, { data, expiry: Date.now() + CACHE_TTL });
    return data;
  }
  
  // Search/list monsters from open5e
  app.post("/api/characters/:id/short-rest", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { campaignId } = req.body; // Optional: if provided, heal all party members
      const character = await storage.getCharacter(id);
      
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      // Short rest: Heal 25% of max HP (minimum 1) - only if conscious or stabilized
      // Dead characters cannot rest, unconscious need stabilization first
      if (character.status === "dead") {
        return res.status(400).json({ message: "Dead characters cannot rest." });
      }
      if (character.status === "unconscious") {
        return res.status(400).json({ message: "Unconscious characters must be stabilized or healed first." });
      }
      
      const healAmount = Math.max(1, Math.floor(character.maxHitPoints * 0.25));
      const newHP = Math.min(character.maxHitPoints, character.hitPoints + healAmount);
      const actualHeal = newHP - character.hitPoints;
      
      // If healing brings HP above 0 and was stabilized, become conscious
      let newStatus = character.status;
      if (newHP > 0 && character.status === "stabilized") {
        newStatus = "conscious";
      }
      
      const updatedCharacter = await storage.updateCharacter(id, {
        hitPoints: newHP,
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      
      // If campaignId provided, also heal all NPC companions in the party
      const companionResults: any[] = [];
      if (campaignId) {
        const campaignNpcs = await storage.getCampaignNpcs(campaignId);
        for (const cn of campaignNpcs) {
          if (cn.role === 'companion' || cn.role === 'ally') {
            const npc = await storage.getNpc(cn.npcId);
            if (!npc) continue;
            const currentHp = cn.currentHp ?? npc.hitPoints ?? 0;
            const maxHp = cn.maxHp ?? npc.maxHitPoints ?? 10;
            const status = cn.status || 'conscious';
            
            // Skip dead/unconscious NPCs
            if (status === 'dead' || status === 'unconscious') continue;
            
            const npcHealAmount = Math.max(1, Math.floor(maxHp * 0.25));
            const npcNewHp = Math.min(maxHp, currentHp + npcHealAmount);
            const npcActualHeal = npcNewHp - currentHp;
            
            if (npcActualHeal > 0) {
              await storage.updateCampaignNpc(cn.id, { currentHp: npcNewHp });
              companionResults.push({ name: npc.name, healed: npcActualHeal });
            }
          }
        }
      }
      
      const companionMsg = companionResults.length > 0 
        ? ` Companions also rested: ${companionResults.map(c => `${c.name} +${c.healed} HP`).join(', ')}.`
        : '';
      
      res.json({
        character: updatedCharacter,
        healedAmount: actualHeal,
        companionResults,
        message: `Short rest complete. Recovered ${actualHeal} HP.${companionMsg}`
      });
    } catch (error: any) {
      console.error("Error during short rest:", error);
      res.status(500).json({ message: "Failed to complete short rest", error: error.message });
    }
  });

  app.post("/api/characters/:id/long-rest", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { campaignId } = req.body; // Optional: if provided, heal all party members
      const character = await storage.getCharacter(id);
      
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      // Long rest: Fully restore HP and reset status
      const actualHeal = character.maxHitPoints - character.hitPoints;
      
      const updatedCharacter = await storage.updateCharacter(id, {
        hitPoints: character.maxHitPoints,
        status: "conscious",
        deathSaveSuccesses: 0,
        deathSaveFailures: 0,
        updatedAt: new Date().toISOString()
      });
      
      // If campaignId provided, also fully heal all NPC companions
      const companionResults: any[] = [];
      if (campaignId) {
        const campaignNpcs = await storage.getCampaignNpcs(campaignId);
        for (const cn of campaignNpcs) {
          if (cn.role === 'companion' || cn.role === 'ally') {
            const npc = await storage.getNpc(cn.npcId);
            if (!npc) continue;
            const currentHp = cn.currentHp ?? npc.hitPoints ?? 0;
            const maxHp = cn.maxHp ?? npc.maxHitPoints ?? 10;
            const npcActualHeal = maxHp - currentHp;
            
            if (npcActualHeal > 0 || cn.status !== 'conscious') {
              await storage.updateCampaignNpc(cn.id, { 
                currentHp: maxHp, 
                status: 'conscious' 
              });
              companionResults.push({ name: npc.name, healed: npcActualHeal });
            }
          }
        }
      }
      
      const companionMsg = companionResults.length > 0 
        ? ` Companions also rested: ${companionResults.map(c => `${c.name} fully healed`).join(', ')}.`
        : '';
      
      // D&D 5e: Recharge magical items at dawn (long rest)
      const itemRechargeResult = await rechargeCharacterItems(id);
      
      let rechargeMsg = '';
      if (itemRechargeResult.recharged.length > 0) {
        rechargeMsg = ` Items recharged: ${itemRechargeResult.recharged.map(r => 
          `${r.itemName} regained ${r.chargesRegained} charges (${r.newCharges}/${r.maxCharges})`
        ).join(', ')}.`;
      }
      if (itemRechargeResult.destroyed.length > 0) {
        rechargeMsg += ` Items destroyed: ${itemRechargeResult.destroyed.map(d => d.itemName).join(', ')} crumbled to dust!`;
      }
      
      res.json({
        character: updatedCharacter,
        healedAmount: actualHeal,
        companionResults,
        itemRecharge: itemRechargeResult,
        message: `Long rest complete. Fully restored to ${character.maxHitPoints} HP.${companionMsg}${rechargeMsg}`
      });
    } catch (error: any) {
      console.error("Error during long rest:", error);
      res.status(500).json({ message: "Failed to complete long rest", error: error.message });
    }
  });

  // Death Saving Throw
  app.post("/api/characters/:id/death-save", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const character = await storage.getCharacter(id);
      
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      if (character.status !== "unconscious") {
        return res.status(400).json({ message: "Death saves only apply to unconscious characters." });
      }
      
      // Roll a d20 for death save
      const roll = Math.floor(Math.random() * 20) + 1;
      let successes = character.deathSaveSuccesses || 0;
      let failures = character.deathSaveFailures || 0;
      let newStatus = character.status;
      let message = "";
      let newHP = character.hitPoints;
      
      if (roll === 20) {
        // Natural 20: Regain 1 HP and become conscious
        newHP = 1;
        newStatus = "conscious";
        successes = 0;
        failures = 0;
        message = "Critical success! You regain 1 HP and are conscious!";
      } else if (roll === 1) {
        // Natural 1: Two failures
        failures += 2;
        message = "Critical failure! Two death save failures.";
      } else if (roll >= 10) {
        // Success
        successes += 1;
        message = `Success (${roll})! ${successes}/3 successes.`;
      } else {
        // Failure
        failures += 1;
        message = `Failure (${roll}). ${failures}/3 failures.`;
      }
      
      // Check for stabilization (3 successes) or death (3 failures)
      if (successes >= 3) {
        newStatus = "stabilized";
        message = "Stabilized! You are no longer dying.";
      } else if (failures >= 3) {
        newStatus = "dead";
        message = "You have died.";
      }
      
      const updatedCharacter = await storage.updateCharacter(id, {
        hitPoints: newHP,
        status: newStatus,
        deathSaveSuccesses: successes,
        deathSaveFailures: failures,
        updatedAt: new Date().toISOString()
      });
      
      res.json({
        character: updatedCharacter,
        roll,
        successes,
        failures,
        status: newStatus,
        message
      });
    } catch (error: any) {
      console.error("Error rolling death save:", error);
      res.status(500).json({ message: "Failed to roll death save", error: error.message });
    }
  });

  // Stabilize an unconscious character (requires Medicine check DC 10)
  app.post("/api/characters/:id/stabilize", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const character = await storage.getCharacter(id);
      
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      if (character.status !== "unconscious") {
        return res.status(400).json({ message: "Only unconscious characters can be stabilized." });
      }
      
      // Stabilize the character
      const updatedCharacter = await storage.updateCharacter(id, {
        status: "stabilized",
        deathSaveSuccesses: 0,
        deathSaveFailures: 0,
        updatedAt: new Date().toISOString()
      });
      
      res.json({
        character: updatedCharacter,
        message: "Character stabilized! They are no longer dying but remain unconscious at 0 HP."
      });
    } catch (error: any) {
      console.error("Error stabilizing character:", error);
      res.status(500).json({ message: "Failed to stabilize character", error: error.message });
    }
  });

  // Heal an unconscious/stabilized character
  app.post("/api/characters/:id/heal", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { amount } = req.body;
      const character = await storage.getCharacter(id);
      
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      if (character.status === "dead") {
        return res.status(400).json({ message: "Dead characters cannot be healed by normal means." });
      }
      
      const healAmount = parseInt(amount) || 1;
      const newHP = Math.min(character.maxHitPoints, character.hitPoints + healAmount);
      
      // Any healing brings unconscious/stabilized characters back to conscious
      let newStatus = character.status;
      if (newHP > 0 && (character.status === "unconscious" || character.status === "stabilized")) {
        newStatus = "conscious";
      }
      
      const updatedCharacter = await storage.updateCharacter(id, {
        hitPoints: newHP,
        status: newStatus,
        deathSaveSuccesses: 0,
        deathSaveFailures: 0,
        updatedAt: new Date().toISOString()
      });
      
      res.json({
        character: updatedCharacter,
        healedAmount: healAmount,
        message: `Healed ${healAmount} HP. ${newStatus === "conscious" ? "Character regained consciousness!" : ""}`
      });
    } catch (error: any) {
      console.error("Error healing character:", error);
      res.status(500).json({ message: "Failed to heal character", error: error.message });
    }
  });

  // Character Inventory Management Routes
  app.get("/api/characters/:id/inventory", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const character = await storage.getCharacter(id);
      
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      // Parse equipment array into structured inventory
      const equipment = character.equipment || [];
      
      res.json({
        characterId: id,
        items: equipment,
        equippedWeapon: (character as any).equippedWeapon || equipment[0] || null,
        equippedArmor: (character as any).equippedArmor || null
      });
    } catch (error: any) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ message: "Failed to fetch inventory", error: error.message });
    }
  });

  app.post("/api/characters/:id/inventory/add", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { item } = req.body;
      
      if (!item) {
        return res.status(400).json({ message: "Item name is required" });
      }
      
      const character = await storage.getCharacter(id);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      const currentEquipment = character.equipment || [];
      const updatedEquipment = [...currentEquipment, item];
      
      const updatedCharacter = await storage.updateCharacter(id, {
        equipment: updatedEquipment,
        updatedAt: new Date().toISOString()
      });
      
      res.json({
        character: updatedCharacter,
        message: `Added ${item} to inventory.`
      });
    } catch (error: any) {
      console.error("Error adding item:", error);
      res.status(500).json({ message: "Failed to add item", error: error.message });
    }
  });

  app.post("/api/characters/:id/inventory/remove", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { item } = req.body;
      
      if (!item) {
        return res.status(400).json({ message: "Item name is required" });
      }
      
      const character = await storage.getCharacter(id);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      const currentEquipment = character.equipment || [];
      const itemIndex = currentEquipment.indexOf(item);
      
      if (itemIndex === -1) {
        return res.status(404).json({ message: "Item not found in inventory" });
      }
      
      const updatedEquipment = currentEquipment.filter((_, i) => i !== itemIndex);
      
      const updatedCharacter = await storage.updateCharacter(id, {
        equipment: updatedEquipment,
        updatedAt: new Date().toISOString()
      });
      
      res.json({
        character: updatedCharacter,
        message: `Removed ${item} from inventory.`
      });
    } catch (error: any) {
      console.error("Error removing item:", error);
      res.status(500).json({ message: "Failed to remove item", error: error.message });
    }
  });

  app.post("/api/characters/:id/equip-weapon", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { weapon } = req.body;
      
      if (!weapon) {
        return res.status(400).json({ message: "Weapon name is required" });
      }
      
      const character = await storage.getCharacter(id);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      // Check if weapon is in inventory - handle both JSON strings and plain strings
      const currentEquipment = character.equipment || [];
      let foundWeapon: string | null = null;
      let weaponIndex = -1;
      
      // First check for exact match
      weaponIndex = currentEquipment.indexOf(weapon);
      if (weaponIndex !== -1) {
        foundWeapon = weapon;
      } else {
        // Check if weapon name matches a JSON-stored item
        for (let i = 0; i < currentEquipment.length; i++) {
          const equip = currentEquipment[i];
          try {
            const parsed = JSON.parse(equip);
            if (parsed.name === weapon || parsed.name?.toLowerCase() === weapon?.toLowerCase()) {
              foundWeapon = equip;
              weaponIndex = i;
              break;
            }
          } catch {
            if (equip.toLowerCase() === weapon?.toLowerCase()) {
              foundWeapon = equip;
              weaponIndex = i;
              break;
            }
          }
        }
      }
      
      if (weaponIndex === -1 || !foundWeapon) {
        return res.status(400).json({ message: "Weapon not in inventory" });
      }
      
      // Move ONE instance of the equipped weapon to front of array (first item is equipped)
      // This preserves duplicate items
      const reorderedEquipment = [...currentEquipment];
      reorderedEquipment.splice(weaponIndex, 1); // Remove one instance
      reorderedEquipment.unshift(foundWeapon); // Add to front
      
      const updatedCharacter = await storage.updateCharacter(id, {
        equipment: reorderedEquipment,
        updatedAt: new Date().toISOString()
      });
      
      res.json({
        character: updatedCharacter,
        message: `Equipped ${weapon}.`
      });
    } catch (error: any) {
      console.error("Error equipping weapon:", error);
      res.status(500).json({ message: "Failed to equip weapon", error: error.message });
    }
  });

  // Currency Management Routes
  app.get("/api/characters/:id/currency", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const character = await storage.getCharacter(id);
      
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      res.json({
        characterId: id,
        gold: (character as any).gold || 0,
        silver: (character as any).silver || 0,
        copper: (character as any).copper || 0,
        platinum: (character as any).platinum || 0,
        // Total value in gold pieces
        totalGP: ((character as any).platinum || 0) * 10 + 
                 ((character as any).gold || 0) + 
                 ((character as any).silver || 0) / 10 + 
                 ((character as any).copper || 0) / 100
      });
    } catch (error: any) {
      console.error("Error fetching currency:", error);
      res.status(500).json({ message: "Failed to fetch currency", error: error.message });
    }
  });

  app.post("/api/characters/:id/currency/add", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { gold = 0, silver = 0, copper = 0, platinum = 0 } = req.body;
      
      const character = await storage.getCharacter(id);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      const updatedCharacter = await storage.updateCharacter(id, {
        gold: ((character as any).gold || 0) + gold,
        silver: ((character as any).silver || 0) + silver,
        copper: ((character as any).copper || 0) + copper,
        platinum: ((character as any).platinum || 0) + platinum,
        updatedAt: new Date().toISOString()
      } as any);
      
      const addedParts = [];
      if (platinum > 0) addedParts.push(`${platinum} pp`);
      if (gold > 0) addedParts.push(`${gold} gp`);
      if (silver > 0) addedParts.push(`${silver} sp`);
      if (copper > 0) addedParts.push(`${copper} cp`);
      
      res.json({
        character: updatedCharacter,
        message: `Added ${addedParts.join(", ") || "no currency"}.`
      });
    } catch (error: any) {
      console.error("Error adding currency:", error);
      res.status(500).json({ message: "Failed to add currency", error: error.message });
    }
  });

  // Alias route for tavern dice game (uses add-currency instead of currency/add)
  app.post("/api/characters/:id/add-currency", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { gold = 0, silver = 0, copper = 0, platinum = 0 } = req.body;
      
      const character = await storage.getCharacter(id);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      const updatedCharacter = await storage.updateCharacter(id, {
        gold: ((character as any).gold || 0) + gold,
        silver: ((character as any).silver || 0) + silver,
        copper: ((character as any).copper || 0) + copper,
        platinum: ((character as any).platinum || 0) + platinum,
        updatedAt: new Date().toISOString()
      } as any);
      
      const changedParts = [];
      if (platinum !== 0) changedParts.push(`${platinum > 0 ? '+' : ''}${platinum} pp`);
      if (gold !== 0) changedParts.push(`${gold > 0 ? '+' : ''}${gold} gp`);
      if (silver !== 0) changedParts.push(`${silver > 0 ? '+' : ''}${silver} sp`);
      if (copper !== 0) changedParts.push(`${copper > 0 ? '+' : ''}${copper} cp`);
      
      res.json({
        character: updatedCharacter,
        message: changedParts.length > 0 ? `Currency changed: ${changedParts.join(", ")}` : "No change"
      });
    } catch (error: any) {
      console.error("Error changing currency:", error);
      res.status(500).json({ message: "Failed to change currency", error: error.message });
    }
  });

  app.post("/api/characters/:id/currency/spend", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { gold = 0, silver = 0, copper = 0, platinum = 0 } = req.body;
      
      const character = await storage.getCharacter(id);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      // Convert all to copper for easy calculation
      const totalHave = 
        ((character as any).platinum || 0) * 1000 + 
        ((character as any).gold || 0) * 100 + 
        ((character as any).silver || 0) * 10 + 
        ((character as any).copper || 0);
      
      const totalSpend = platinum * 1000 + gold * 100 + silver * 10 + copper;
      
      if (totalSpend > totalHave) {
        return res.status(400).json({ message: "Not enough currency!" });
      }
      
      // Simple subtraction (could be optimized for proper change-making)
      let newPlatinum = (character as any).platinum || 0;
      let newGold = (character as any).gold || 0;
      let newSilver = (character as any).silver || 0;
      let newCopper = (character as any).copper || 0;
      
      // Subtract from each denomination, borrowing if needed
      newCopper -= copper;
      if (newCopper < 0) {
        const borrow = Math.ceil(-newCopper / 10);
        newSilver -= borrow;
        newCopper += borrow * 10;
      }
      
      newSilver -= silver;
      if (newSilver < 0) {
        const borrow = Math.ceil(-newSilver / 10);
        newGold -= borrow;
        newSilver += borrow * 10;
      }
      
      newGold -= gold;
      if (newGold < 0) {
        const borrow = Math.ceil(-newGold / 10);
        newPlatinum -= borrow;
        newGold += borrow * 10;
      }
      
      newPlatinum -= platinum;
      
      const updatedCharacter = await storage.updateCharacter(id, {
        gold: newGold,
        silver: newSilver,
        copper: newCopper,
        platinum: newPlatinum,
        updatedAt: new Date().toISOString()
      } as any);
      
      const spentParts = [];
      if (platinum > 0) spentParts.push(`${platinum} pp`);
      if (gold > 0) spentParts.push(`${gold} gp`);
      if (silver > 0) spentParts.push(`${silver} sp`);
      if (copper > 0) spentParts.push(`${copper} cp`);
      
      res.json({
        character: updatedCharacter,
        message: `Spent ${spentParts.join(", ")}.`
      });
    } catch (error: any) {
      console.error("Error spending currency:", error);
      res.status(500).json({ message: "Failed to spend currency", error: error.message });
    }
  });

  // ==================== Tavern Shop Routes ====================

  // Buy item from shop
  app.get("/api/characters/available", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = req.user.id;
      const allCharacters = await storage.getCharactersByUserId(userId);
      
      // Filter out dead characters - they must be resurrected first
      const availableCharacters = allCharacters.filter(
        (char: any) => char.status !== "dead"
      );
      
      res.json(availableCharacters);
    } catch (error: any) {
      console.error("Error fetching available characters:", error);
      res.status(500).json({ message: "Failed to fetch available characters", error: error.message });
    }
  });

  // Resurrect a dead character
  app.post("/api/characters/:id/resurrect", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const id = parseInt(req.params.id);
      const { method, consumableName } = req.body;
      
      const character = await storage.getCharacter(id);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      // Allow resurrection if: user owns the character OR they're in the same campaign
      let isAuthorized = character.userId === req.user.id;
      
      if (!isAuthorized) {
        // Check if user is in the same campaign as this character
        const allCharacters = await storage.getAllCharacters();
        const userCharacterIds = allCharacters
          .filter((c: any) => c.userId === req.user.id)
          .map((c: any) => c.id);
        
        // Get all campaigns where the dead character is a participant
        const allCampaigns = await storage.getAllCampaigns();
        for (const campaign of allCampaigns) {
          const participants = await storage.getCampaignParticipants(campaign.id);
          const deadCharInCampaign = participants.some((p: any) => p.characterId === character.id);
          const userInCampaign = participants.some((p: any) => userCharacterIds.includes(p.characterId)) || campaign.userId === req.user.id;
          
          if (deadCharInCampaign && userInCampaign) {
            isAuthorized = true;
            break;
          }
        }
      }
      
      if (!isAuthorized) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      if (character.status !== "dead") {
        return res.status(400).json({ message: "Character is not dead" });
      }
      
      let costMessage = "";
      const consumables = ((character as any).consumables || []) as any[];
      
      if (method === "consumable") {
        // Check for resurrection consumable
        const resurrectionItems = ["Scroll of Revivify", "Scroll of Raise Dead", "Diamond Dust", "Resurrection Scroll"];
        const itemIndex = consumables.findIndex((c: any) => 
          resurrectionItems.includes(c.name) || c.name === consumableName
        );
        
        if (itemIndex === -1) {
          return res.status(400).json({ 
            message: "No resurrection item found. You need a Scroll of Revivify, Raise Dead, or similar item." 
          });
        }
        
        const item = consumables[itemIndex];
        costMessage = `Used ${item.name} to resurrect ${character.name}!`;
        
        // Remove the consumable
        if (item.quantity <= 1) {
          consumables.splice(itemIndex, 1);
        } else {
          item.quantity -= 1;
        }
      } else if (method === "temple") {
        // Temple resurrection costs gold
        const gold = (character as any).gold || 0;
        const resurrectionCost = 500; // 500 gold for temple resurrection
        
        if (gold < resurrectionCost) {
          return res.status(400).json({ 
            message: `Not enough gold for temple resurrection. Need ${resurrectionCost} gp, have ${gold} gp.` 
          });
        }
        
        costMessage = `Paid ${resurrectionCost} gold at a temple to resurrect ${character.name}!`;
        
        // Deduct the gold
        await storage.updateCharacter(id, {
          gold: gold - resurrectionCost
        });
      } else {
        return res.status(400).json({ message: "Invalid resurrection method. Use 'consumable' or 'temple'." });
      }
      
      // Resurrect the character - restore to 1 HP, reset death saves
      const updatedCharacter = await storage.updateCharacter(id, {
        status: "conscious",
        hitPoints: 1,
        deathSaveSuccesses: 0,
        deathSaveFailures: 0,
        consumables,
        resurrectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      res.json({
        character: updatedCharacter,
        message: costMessage
      });
    } catch (error: any) {
      console.error("Error resurrecting character:", error);
      res.status(500).json({ message: "Failed to resurrect character", error: error.message });
    }
  });

  // Item slot classification for D&D 5e equipment
  const WEAPON_NAMES = new Set([
    "club", "dagger", "greatclub", "handaxe", "javelin", "light hammer",
    "mace", "quarterstaff", "sickle", "spear", "battleaxe", "flail",
    "glaive", "greataxe", "longsword", "morningstar", "pike", "rapier",
    "scimitar", "shortsword", "trident", "war pick", "warhammer", "whip",
    "greatsword", "lance", "maul", "shortbow", "light crossbow",
    "hand crossbow", "heavy crossbow", "longbow", "pistol", "musket",
    "blowgun", "dart", "net", "sling", "halberd",
  ]);

  const ARMOR_NAMES = new Set([
    "padded armor", "leather armor", "studded leather", "hide armor",
    "chain shirt", "scale mail", "breastplate", "half plate",
    "ring mail", "chain mail", "splint armor", "plate armor",
    "padded", "leather", "studded leather armor", "hide",
    "chain", "splint", "plate", "half-plate", "scale",
    "mithral armor", "adamantine armor",
  ]);

  const SHIELD_NAMES = new Set([
    "shield", "wooden shield", "steel shield",
  ]);

  const CONSUMABLE_KEYWORDS = [
    "potion", "scroll", "antitoxin", "holy water", "oil flask",
    "alchemist's fire", "acid vial", "rations", "torch", "candle",
    "ammunition", "arrows", "bolts", "bullets", "food", "drink",
  ];

  const TOOL_KEYWORDS = [
    "tools", "kit", "supplies", "pack", "pouch",
    "rope", "torch bundle", "lantern", "bedroll", "spyglass",
    "manacles", "tent", "crowbar", "caltrops", "grappling hook",
    "component pouch", "arcane focus", "holy symbol",
    "explorer's pack", "dungeoneer's pack",
  ];

  const ACCESSORY_KEYWORDS = [
    "ring", "amulet", "cloak", "boots", "gloves", "gauntlets",
    "bracers", "belt", "helm", "helmet", "circlet", "crown",
    "necklace", "pendant", "brooch", "cape", "mantle", "goggles",
    "periapt", "stone", "gem", "orb", "rod", "wand", "staff",
    "headband", "hat", "robe", "vestment", "ioun",
  ];

  function getValidSlotsForItem(itemName: string, itemType?: string): string[] {
    const name = itemName.toLowerCase().trim();

    if (itemType) {
      const t = itemType.toLowerCase();
      if (t === "weapon" || t === "melee weapon" || t === "ranged weapon") return ["weapon"];
      if (t === "armor" || t === "light armor" || t === "medium armor" || t === "heavy armor") return ["armor"];
      if (t === "shield") return ["shield"];
      if (t === "accessory" || t === "wondrous item" || t === "wondrous" || t === "ring" || t === "wand" || t === "rod" || t === "staff") return ["accessory"];
      if (t === "potion" || t === "scroll" || t === "consumable" || t === "ammunition") return [];
      if (t === "tool" || t === "adventuring gear") return [];
    }

    if (WEAPON_NAMES.has(name)) return ["weapon"];
    for (const w of WEAPON_NAMES) {
      if (name.includes(w)) return ["weapon"];
    }
    if (name.includes("sword") || name.includes("axe") || name.includes("bow") ||
        name.includes("crossbow") || name.includes("dagger") || name.includes("mace") ||
        name.includes("hammer") || name.includes("spear") || name.includes("pike") ||
        name.includes("halberd") || name.includes("glaive") || name.includes("flail") ||
        name.includes("whip") || name.includes("trident") || name.includes("lance") ||
        name.includes("maul") || name.includes("rapier") || name.includes("scimitar") ||
        name.includes("javelin") || name.includes("sickle") || name.includes("club") ||
        name.includes("pistol") || name.includes("musket") ||
        name.includes("blowgun") || name.includes("sling")) {
      if (!name.includes("potion") && !name.includes("kit") && !name.includes("tools")) {
        return ["weapon"];
      }
    }

    if (ARMOR_NAMES.has(name)) return ["armor"];
    if (name.includes("armor") || name.includes("mail") || name.includes("plate") ||
        name.includes("breastplate") || name.includes("half plate") || name.includes("scale mail") ||
        name.includes("hide armor") || name.includes("padded armor") || name.includes("studded leather") ||
        name.includes("chain shirt") || name.includes("splint")) {
      if (!name.includes("shield")) return ["armor"];
    }

    if (SHIELD_NAMES.has(name) || name.includes("shield")) return ["shield"];

    for (const keyword of CONSUMABLE_KEYWORDS) {
      if (name.includes(keyword)) return [];
    }
    for (const keyword of TOOL_KEYWORDS) {
      if (name.includes(keyword)) return [];
    }

    for (const keyword of ACCESSORY_KEYWORDS) {
      if (name.includes(keyword)) return ["accessory"];
    }

    return [];
  }

  app.get("/api/equipment/valid-slots", (req, res) => {
    const itemName = req.query.name as string;
    const itemType = req.query.type as string | undefined;
    if (!itemName) {
      return res.status(400).json({ message: "Item name is required" });
    }
    const validSlots = getValidSlotsForItem(itemName, itemType);
    res.json({ itemName, validSlots });
  });

  // Equip an item to a slot
  app.post("/api/characters/:id/equipment/equip", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const id = parseInt(req.params.id);
      const { item, slot } = req.body;
      
      if (!item || !slot) {
        return res.status(400).json({ message: "Item and slot are required" });
      }
      
      const allowedSlots = ["weapon", "armor", "shield", "accessory"];
      if (!allowedSlots.includes(slot)) {
        return res.status(400).json({ message: `Invalid slot. Use: ${allowedSlots.join(", ")}` });
      }
      
      const character = await storage.getCharacter(id);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      const canManage = await storage.canUserManageCharacter(req.user.id, id);
      if (!canManage) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Check if item is in inventory - handle both JSON strings and plain strings
      const equipment = character.equipment || [];
      let foundItem: string | null = null;
      
      // First check for exact match
      if (equipment.includes(item)) {
        foundItem = item;
      } else {
        // Check if item name matches a JSON-stored item
        for (const equip of equipment) {
          try {
            const parsed = JSON.parse(equip);
            if (parsed.name === item || parsed.name?.toLowerCase() === item?.toLowerCase()) {
              foundItem = equip; // Use the full JSON string
              break;
            }
          } catch {
            // Not JSON, check if plain string matches
            if (equip.toLowerCase() === item?.toLowerCase()) {
              foundItem = equip;
              break;
            }
          }
        }
      }
      
      if (!foundItem) {
        return res.status(400).json({ message: "Item not in inventory" });
      }
      
      // Validate that item is appropriate for the chosen slot
      let itemDisplayName = item;
      let itemTypeHint: string | undefined;
      try {
        const parsed = JSON.parse(foundItem);
        itemDisplayName = parsed.name || item;
        itemTypeHint = parsed.type || parsed.equipSlot || parsed.equip_slot;
      } catch {
        itemDisplayName = foundItem;
      }
      
      const validSlots = getValidSlotsForItem(itemDisplayName, itemTypeHint);
      if (validSlots.length === 0) {
        return res.status(400).json({ 
          message: `${itemDisplayName} cannot be equipped — it's a consumable, tool, or gear item.`,
          validSlots: []
        });
      }
      if (!validSlots.includes(slot)) {
        const slotLabels: Record<string, string> = { weapon: "Weapon", armor: "Armor", shield: "Shield", accessory: "Accessory" };
        return res.status(400).json({ 
          message: `${itemDisplayName} can only be equipped in the ${validSlots.map(s => slotLabels[s] || s).join(" or ")} slot.`,
          validSlots
        });
      }
      
      // Build update object based on slot - use foundItem to preserve JSON data
      const updateData: any = { updatedAt: new Date().toISOString() };
      const displayName = itemDisplayName;
      
      switch (slot) {
        case "weapon":
          updateData.equippedWeapon = foundItem;
          break;
        case "armor":
          updateData.equippedArmor = foundItem;
          break;
        case "shield":
          updateData.equippedShield = foundItem;
          break;
        case "accessory":
          updateData.equippedAccessory = foundItem;
          break;
      }
      
      const updatedCharacter = await storage.updateCharacter(id, updateData);
      
      res.json({
        character: updatedCharacter,
        message: `Equipped ${displayName} to ${slot} slot`
      });
    } catch (error: any) {
      console.error("Error equipping item:", error);
      res.status(500).json({ message: "Failed to equip item", error: error.message });
    }
  });

  // Unequip an item from a slot
  app.post("/api/characters/:id/equipment/unequip", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const id = parseInt(req.params.id);
      const { slot } = req.body;
      
      if (!slot) {
        return res.status(400).json({ message: "Slot is required" });
      }
      
      const validSlots = ["weapon", "armor", "shield", "accessory"];
      if (!validSlots.includes(slot)) {
        return res.status(400).json({ message: `Invalid slot. Use: ${validSlots.join(", ")}` });
      }
      
      const character = await storage.getCharacter(id);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      const canManage = await storage.canUserManageCharacter(req.user.id, id);
      if (!canManage) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Build update object based on slot
      const updateData: any = { updatedAt: new Date().toISOString() };
      let unequippedItem = "";
      
      switch (slot) {
        case "weapon":
          unequippedItem = (character as any).equippedWeapon || "";
          updateData.equippedWeapon = null;
          break;
        case "armor":
          unequippedItem = (character as any).equippedArmor || "";
          updateData.equippedArmor = null;
          break;
        case "shield":
          unequippedItem = (character as any).equippedShield || "";
          updateData.equippedShield = null;
          break;
        case "accessory":
          unequippedItem = (character as any).equippedAccessory || "";
          updateData.equippedAccessory = null;
          break;
      }
      
      if (!unequippedItem) {
        return res.status(400).json({ message: `Nothing equipped in ${slot} slot` });
      }
      
      const updatedCharacter = await storage.updateCharacter(id, updateData);
      
      res.json({
        character: updatedCharacter,
        message: `Unequipped ${unequippedItem} from ${slot} slot`
      });
    } catch (error: any) {
      console.error("Error unequipping item:", error);
      res.status(500).json({ message: "Failed to unequip item", error: error.message });
    }
  });

  // Transfer item between characters or to NPC companions in the same campaign
  app.get("/api/spells", async (req, res) => {
    try {
      const { level, className, school } = req.query;
      
      if (level !== undefined) {
        const spells = await storage.getSpellsByLevel(parseInt(level as string));
        return res.json(spells);
      }
      
      if (className && typeof className === 'string') {
        const spells = await storage.getSpellsByClass(className.toLowerCase());
        return res.json(spells);
      }
      
      if (school && typeof school === 'string') {
        const spells = await storage.getSpellsBySchool(school.toLowerCase());
        return res.json(spells);
      }
      
      const spells = await storage.getAllSpells();
      res.json(spells);
    } catch (error) {
      console.error("Error fetching spells:", error);
      res.status(500).json({ message: "Failed to fetch spells" });
    }
  });
  
  // Get single spell by ID
  app.get("/api/spells/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const spell = await storage.getSpell(id);
      if (!spell) {
        return res.status(404).json({ message: "Spell not found" });
      }
      res.json(spell);
    } catch (error) {
      console.error("Error fetching spell:", error);
      res.status(500).json({ message: "Failed to fetch spell" });
    }
  });
  
  // Seed spell database from SRD data
  app.post("/api/spells/seed", async (req, res) => {
    try {
      const { SRD_SPELLS } = await import("./spellData");
      const count = await storage.seedSpells(SRD_SPELLS);
      res.json({ success: true, seeded: count, message: `Seeded ${count} spells` });
    } catch (error) {
      console.error("Error seeding spells:", error);
      res.status(500).json({ message: "Failed to seed spells" });
    }
  });
  
  // Get character's known spells
  app.get("/api/characters/:characterId/spells", async (req, res) => {
    try {
      const characterId = parseInt(req.params.characterId);
      const characterSpells = await storage.getCharacterSpells(characterId);
      res.json(characterSpells);
    } catch (error) {
      console.error("Error fetching character spells:", error);
      res.status(500).json({ message: "Failed to fetch character spells" });
    }
  });
  
  // Learn a new spell
  app.post("/api/characters/:characterId/spells", async (req, res) => {
    try {
      const characterId = parseInt(req.params.characterId);
      const { spellId, source, acquisitionStory } = req.body;
      
      // Check if character exists
      const character = await storage.getCharacter(characterId);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      // Check if spell exists
      const spell = await storage.getSpell(spellId);
      if (!spell) {
        return res.status(404).json({ message: "Spell not found" });
      }
      
      // Check if already known
      const existing = await storage.getCharacterSpell(characterId, spellId);
      if (existing) {
        return res.status(400).json({ message: "Character already knows this spell" });
      }
      
      const characterSpell = await storage.learnSpell({
        characterId,
        spellId,
        source: source || 'class',
        acquiredAt: new Date().toISOString(),
        acquiredLevel: character.level,
        acquisitionStory,
        isPrepared: spell.level === 0, // Cantrips are always prepared
        inSpellbook: true
      });
      
      res.json({ success: true, spell: characterSpell });
    } catch (error) {
      console.error("Error learning spell:", error);
      res.status(500).json({ message: "Failed to learn spell" });
    }
  });
  
  // Prepare/unprepare a spell
  app.patch("/api/characters/:characterId/spells/:spellId/prepare", async (req, res) => {
    try {
      const characterId = parseInt(req.params.characterId);
      const spellId = parseInt(req.params.spellId);
      const { prepared } = req.body;
      
      const updated = await storage.prepareSpell(characterId, spellId, prepared);
      if (!updated) {
        return res.status(404).json({ message: "Character spell not found" });
      }
      res.json({ success: true, spell: updated });
    } catch (error) {
      console.error("Error preparing spell:", error);
      res.status(500).json({ message: "Failed to prepare spell" });
    }
  });
  
  // Forget a spell
  app.delete("/api/characters/:characterId/spells/:spellId", async (req, res) => {
    try {
      const characterId = parseInt(req.params.characterId);
      const spellId = parseInt(req.params.spellId);
      
      await storage.forgetSpell(characterId, spellId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error forgetting spell:", error);
      res.status(500).json({ message: "Failed to forget spell" });
    }
  });
  
  // Get character's spell slots
  app.get("/api/characters/:characterId/spell-slots", async (req, res) => {
    try {
      const characterId = parseInt(req.params.characterId);
      const slots = await storage.getCharacterSpellSlots(characterId);
      
      if (!slots) {
        // Initialize spell slots if not exists
        const character = await storage.getCharacter(characterId);
        if (!character) {
          return res.status(404).json({ message: "Character not found" });
        }
        
        // Import spell slot calculations
        const { getSpellSlotsByLevel, isSpellcastingClass } = await import("./spellData");
        
        if (!isSpellcastingClass(character.class)) {
          return res.json({ message: "Character is not a spellcasting class", slots: null });
        }
        
        const slotsByLevel = getSpellSlotsByLevel(character.class, character.level);
        const newSlots = await storage.initializeSpellSlots(characterId, {
          characterId,
          slotsLevel1Max: slotsByLevel[0],
          slotsLevel2Max: slotsByLevel[1],
          slotsLevel3Max: slotsByLevel[2],
          slotsLevel4Max: slotsByLevel[3],
          slotsLevel5Max: slotsByLevel[4],
          slotsLevel6Max: slotsByLevel[5],
          slotsLevel7Max: slotsByLevel[6],
          slotsLevel8Max: slotsByLevel[7],
          slotsLevel9Max: slotsByLevel[8],
          lastLongRest: new Date().toISOString()
        });
        return res.json(newSlots);
      }
      
      res.json(slots);
    } catch (error) {
      console.error("Error fetching spell slots:", error);
      res.status(500).json({ message: "Failed to fetch spell slots" });
    }
  });
  
  // Use a spell slot
  app.post("/api/characters/:characterId/spell-slots/use", async (req, res) => {
    try {
      const characterId = parseInt(req.params.characterId);
      const { slotLevel } = req.body;
      
      if (!slotLevel || slotLevel < 1 || slotLevel > 9) {
        return res.status(400).json({ message: "Invalid slot level (must be 1-9)" });
      }
      
      const success = await storage.useSpellSlot(characterId, slotLevel);
      if (!success) {
        return res.status(400).json({ message: "No available spell slots at this level" });
      }
      
      const slots = await storage.getCharacterSpellSlots(characterId);
      res.json({ success: true, slots });
    } catch (error) {
      console.error("Error using spell slot:", error);
      res.status(500).json({ message: "Failed to use spell slot" });
    }
  });
  
  // Reset spell slots (long rest)
  app.post("/api/characters/:characterId/spell-slots/reset", async (req, res) => {
    try {
      const characterId = parseInt(req.params.characterId);
      const slots = await storage.resetSpellSlots(characterId);
      if (!slots) {
        return res.status(404).json({ message: "Character spell slots not found" });
      }
      res.json({ success: true, slots, message: "Spell slots restored after long rest" });
    } catch (error) {
      console.error("Error resetting spell slots:", error);
      res.status(500).json({ message: "Failed to reset spell slots" });
    }
  });
  
  // Get available spells for a character's class and level
  app.get("/api/characters/:characterId/available-spells", async (req, res) => {
    try {
      const characterId = parseInt(req.params.characterId);
      const character = await storage.getCharacter(characterId);
      
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      const { getSpellsAvailableForCharacter, isSpellcastingClass } = await import("./spellData");
      
      if (!isSpellcastingClass(character.class)) {
        return res.json({ spells: [], message: `${character.class} is not a spellcasting class` });
      }
      
      // Get all spells available for this class
      const allAvailable = getSpellsAvailableForCharacter(character.class, character.level);
      
      // Get already known spells
      const knownSpells = await storage.getCharacterSpells(characterId);
      const knownIds = new Set(knownSpells.map(cs => cs.spellId));
      
      // Filter out known spells
      const available = allAvailable.filter(s => !knownIds.has((s as any).id || 0));
      
      res.json({
        class: character.class,
        level: character.level,
        spells: available,
        knownCount: knownSpells.length
      });
    } catch (error) {
      console.error("Error fetching available spells:", error);
      res.status(500).json({ message: "Failed to fetch available spells" });
    }
  });

  // Calculate character stats from equipped items
  app.get("/api/characters/:id/computed-stats", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const character = await storage.getCharacter(id);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      // Calculate ability modifiers
      const getModifier = (score: number) => Math.floor((score - 10) / 2);
      const dexMod = getModifier(character.dexterity);
      const strMod = getModifier(character.strength);
      
      // Start with base AC (10 + Dex modifier for unarmored)
      let computedAC = 10 + dexMod;
      let attackBonus = 0;
      let damageBonus = 0;
      let damageDice = "1d4"; // Unarmed
      let damageType = "bludgeoning";
      let weaponName = "Unarmed Strike";
      let armorName = "Unarmored";
      let shieldBonus = 0;
      
      // Get equipped armor stats
      if ((character as any).equippedArmor) {
        const armor = await storage.getItemByName((character as any).equippedArmor);
        if (armor && armor.baseAc) {
          armorName = armor.name;
          if (armor.armorType === 'light') {
            computedAC = armor.baseAc + dexMod + (armor.magicBonus || 0);
          } else if (armor.armorType === 'medium') {
            const cappedDex = armor.maxDexBonus !== null ? Math.min(dexMod, armor.maxDexBonus) : dexMod;
            computedAC = armor.baseAc + cappedDex + (armor.magicBonus || 0);
          } else if (armor.armorType === 'heavy') {
            computedAC = armor.baseAc + (armor.magicBonus || 0);
          }
        }
      }
      
      // Get equipped shield stats
      if ((character as any).equippedShield) {
        const shield = await storage.getItemByName((character as any).equippedShield);
        if (shield && shield.baseAc) {
          shieldBonus = shield.baseAc + (shield.magicBonus || 0);
          computedAC += shieldBonus;
        }
      }
      
      // Get equipped weapon stats
      if ((character as any).equippedWeapon) {
        const weapon = await storage.getItemByName((character as any).equippedWeapon);
        if (weapon) {
          weaponName = weapon.name;
          damageDice = weapon.damageDice || "1d4";
          damageType = weapon.damageType || "bludgeoning";
          damageBonus = (weapon.magicBonus || 0);
          attackBonus = (weapon.attackBonus || 0) + (weapon.magicBonus || 0);
          
          // Add ability modifier to attack/damage
          const properties = weapon.properties || [];
          if (properties.includes('finesse')) {
            // Use higher of STR or DEX
            const abilityMod = Math.max(strMod, dexMod);
            attackBonus += abilityMod;
            damageBonus += abilityMod;
          } else if (weapon.weaponRange === 'ranged') {
            attackBonus += dexMod;
            damageBonus += dexMod;
          } else {
            attackBonus += strMod;
            damageBonus += strMod;
          }
        }
      } else {
        // Unarmed strike uses STR
        attackBonus = strMod;
        damageBonus = strMod;
      }
      
      // Get accessory bonuses
      let accessoryBonus = 0;
      if ((character as any).equippedAccessory) {
        const accessory = await storage.getItemByName((character as any).equippedAccessory);
        if (accessory && accessory.magicBonus) {
          // Items like Ring of Protection add to AC
          if (accessory.specialEffect?.toLowerCase().includes('ac')) {
            accessoryBonus = accessory.magicBonus;
            computedAC += accessoryBonus;
          }
        }
      }
      
      res.json({
        characterId: id,
        computedAC,
        attackBonus,
        damageBonus,
        damageDice,
        damageType,
        weaponName,
        armorName,
        shieldBonus,
        accessoryBonus,
        abilityModifiers: {
          strength: strMod,
          dexterity: dexMod,
          constitution: getModifier(character.constitution),
          intelligence: getModifier(character.intelligence),
          wisdom: getModifier(character.wisdom),
          charisma: getModifier(character.charisma)
        }
      });
    } catch (error) {
      console.error("Error computing character stats:", error);
      res.status(500).json({ message: "Failed to compute character stats" });
    }
  });

  // Character Reputation & Story Arc routes
  app.get("/api/characters/:id/reputation", async (req, res) => {
    try {
      const characterId = parseInt(req.params.id);
      const storyArc = await storage.getCharacterStoryArc(characterId);
      
      // Generate a narrative summary from the profiles and events
      const narrativeSummary = generateNarrativeSummary(storyArc);
      
      res.json({
        characterId,
        ...storyArc,
        narrativeSummary
      });
    } catch (error) {
      console.error("Error fetching character reputation:", error);
      res.status(500).json({ message: "Failed to fetch character reputation" });
    }
  });
  
  app.get("/api/characters/:id/story-arc", async (req, res) => {
    try {
      const characterId = parseInt(req.params.id);
      const storyArc = await storage.getCharacterStoryArc(characterId);
      
      // Format for "Your Story So Far" display
      const formattedArc = {
        characterId,
        worldPerception: storyArc.profiles.find(p => !p.factionId),
        factionStandings: storyArc.profiles.filter(p => p.factionId),
        recentDeeds: storyArc.recentEvents.map(e => ({
          id: e.id,
          type: e.triggerType,
          summary: e.narrativeSummary,
          significance: e.significance,
          date: e.createdAt
        })),
        summary: generateNarrativeSummary(storyArc)
      };
      
      res.json(formattedArc);
    } catch (error) {
      console.error("Error fetching character story arc:", error);
      res.status(500).json({ message: "Failed to fetch character story arc" });
    }
  });
  
  // Record a reputation-affecting event
  app.post("/api/characters/:id/reputation/event", isAuthenticated, async (req, res) => {
    try {
      const characterId = parseInt(req.params.id);
      const { campaignId, triggerType, narrativeSummary, factionId, significance, witnesses, locationContext } = req.body;
      
      if (!campaignId || !triggerType || !narrativeSummary) {
        return res.status(400).json({ message: "Missing required fields: campaignId, triggerType, narrativeSummary" });
      }
      
      const event = await storage.createReputationEvent({
        characterId,
        campaignId,
        factionId: factionId || null,
        triggerType,
        narrativeSummary,
        significance: significance || "minor",
        witnesses: witnesses || [],
        locationContext: locationContext || null
      });
      
      // Update or create the reputation profile based on this event
      await updateReputationProfileFromEvent(characterId, campaignId, factionId, event);
      
      res.json(event);
    } catch (error) {
      console.error("Error recording reputation event:", error);
      res.status(500).json({ message: "Failed to record reputation event" });
    }
  });
  
  // Campaign faction routes
  app.get("/api/campaigns/:id/factions", async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const campaignFactions = await storage.getFactions(campaignId);
      res.json(campaignFactions);
    } catch (error) {
      console.error("Error fetching campaign factions:", error);
      res.status(500).json({ message: "Failed to fetch factions" });
    }
  });
  
  app.post("/api/campaigns/:id/factions", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const { name, description, type, disposition, values } = req.body;
      
      const faction = await storage.createFaction({
        campaignId,
        name,
        description,
        type: type || "group",
        disposition: disposition || "neutral",
        values: values || []
      });
      
      res.json(faction);
    } catch (error) {
      console.error("Error creating faction:", error);
      res.status(500).json({ message: "Failed to create faction" });
    }
  });
  
  // Campaign reputation signals (for DM view)
  app.get("/api/campaigns/:id/reputation-signals", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const signals = await storage.getCampaignReputationSignals(campaignId);
      
      // Format signals for DM Arc Signals panel
      const formattedSignals = signals.map(signal => ({
        ...signal,
        summary: generateCharacterArcSummaryForDM(signal)
      }));
      
      res.json(formattedSignals);
    } catch (error) {
      console.error("Error fetching campaign reputation signals:", error);
      res.status(500).json({ message: "Failed to fetch reputation signals" });
    }
  });

  // Dice roll routes
  app.post("/api/dice/roll", async (req, res) => {
    try {
      // Log the raw request body for debugging
      console.log("Dice roll request body:", req.body);
      
      // Authentication check
      if (!req.isAuthenticated()) {
        req.body.userId = 1; // For demo, use user ID 1 if not authenticated
      } else {
        req.body.userId = req.user?.id;
      }
      
      // Ensure we have all the required fields with defaults
      const diceRollData = {
        ...req.body,
        userId: req.body.userId || 1,
        createdAt: new Date().toISOString(),
        diceType: req.body.diceType || "d20",
        result: 0 // This will be replaced with actual result
      };
      
      // Now try to parse with the schema
      const validatedData = insertDiceRollSchema.parse(diceRollData);
      
      // Implement actual dice rolling with advantage/disadvantage support
      const { diceType, modifier, purpose } = validatedData;
      const count = validatedData.count || 1;
      const advantage = req.body.advantage === true;
      const disadvantage = req.body.disadvantage === true;
      const abilityType = req.body.abilityType; // e.g., 'strength', 'dexterity'
      const characterId = req.body.characterId;
      
      // Parse and validate dice type
      let max = 20;
      if (diceType && diceType.startsWith('d')) {
        const parsedMax = parseInt(diceType.substring(1));
        if (!isNaN(parsedMax) && parsedMax > 0) {
          max = parsedMax;
        }
      }
      
      // Calculate ability modifier if character and ability type provided
      let abilityModifier = 0;
      if (characterId && abilityType) {
        const character = await storage.getCharacter(characterId);
        if (character) {
          const getModifier = (score: number | undefined | null) => {
            if (score === undefined || score === null || isNaN(score)) return 0;
            return Math.floor((score - 10) / 2);
          };
          switch (abilityType.toLowerCase()) {
            case 'strength': abilityModifier = getModifier(character.strength); break;
            case 'dexterity': abilityModifier = getModifier(character.dexterity); break;
            case 'constitution': abilityModifier = getModifier(character.constitution); break;
            case 'intelligence': abilityModifier = getModifier(character.intelligence); break;
            case 'wisdom': abilityModifier = getModifier(character.wisdom); break;
            case 'charisma': abilityModifier = getModifier(character.charisma); break;
            default: abilityModifier = 0; break;
          }
        }
      }
      
      const totalModifier = (modifier || 0) + abilityModifier;
      
      console.log(`Server rolling ${count}d${max} with modifier ${totalModifier}, advantage: ${advantage}, disadvantage: ${disadvantage}`);
      
      // Roll the dice
      const rolls: number[] = [];
      let usedRoll: number;
      let advantageRolls: number[] = [];
      
      // Handle advantage/disadvantage for d20 rolls
      if (max === 20 && (advantage || disadvantage) && !advantage === !disadvantage) {
        // Advantage and disadvantage cancel out - roll normally
        for (let i = 0; i < count; i++) {
          rolls.push(Math.floor(Math.random() * max) + 1);
        }
        usedRoll = rolls.reduce((sum, roll) => sum + roll, 0);
      } else if (max === 20 && advantage) {
        // Roll 2d20 and take the higher for each die in count
        for (let i = 0; i < count; i++) {
          const roll1 = Math.floor(Math.random() * max) + 1;
          const roll2 = Math.floor(Math.random() * max) + 1;
          advantageRolls.push(roll1, roll2);
          const higher = Math.max(roll1, roll2);
          rolls.push(higher);
          console.log(`Advantage roll: ${roll1} vs ${roll2}, using ${higher}`);
        }
        usedRoll = rolls.reduce((sum, roll) => sum + roll, 0);
      } else if (max === 20 && disadvantage) {
        // Roll 2d20 and take the lower for each die in count
        for (let i = 0; i < count; i++) {
          const roll1 = Math.floor(Math.random() * max) + 1;
          const roll2 = Math.floor(Math.random() * max) + 1;
          advantageRolls.push(roll1, roll2);
          const lower = Math.min(roll1, roll2);
          rolls.push(lower);
          console.log(`Disadvantage roll: ${roll1} vs ${roll2}, using ${lower}`);
        }
        usedRoll = rolls.reduce((sum, roll) => sum + roll, 0);
      } else {
        // Normal roll
        for (let i = 0; i < count; i++) {
          const roll = Math.floor(Math.random() * max) + 1;
          rolls.push(roll);
        }
        usedRoll = rolls.reduce((sum, roll) => sum + roll, 0);
      }
      
      // Calculate total
      const total = usedRoll + totalModifier;
      
      // Check for critical hit or fumble (based on the used roll, not all rolls)
      const isCritical = diceType === "d20" && rolls.some(roll => roll === 20);
      const isFumble = diceType === "d20" && rolls.some(roll => roll === 1);
      
      // Save dice roll to storage with the calculated result
      // Make sure we have the actual result before saving
      const dataToSave = {
        ...validatedData,
        result: total,
        modifier: modifier || 0,
        count: count
      };
      
      console.log("Saving dice roll to storage:", dataToSave);
      
      const diceRoll = await storage.createDiceRoll(dataToSave);
      
      // Full result object with all details for client
      const fullResult = {
        ...diceRoll,
        rolls,
        advantageRolls: advantageRolls.length > 0 ? advantageRolls : undefined,
        total,
        isCritical,
        isFumble,
        hasAdvantage: advantage,
        hasDisadvantage: disadvantage,
        abilityModifier,
        totalModifier,
        diceType: diceType,
        modifier: modifier || 0,
        count: count,
        purpose: purpose || null
      };
      
      console.log("Server sending dice roll result:", JSON.stringify(fullResult));
      
      // Return full result with rolls details
      res.status(201).json(fullResult);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid dice roll data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to process dice roll" });
      }
    }
  });

  app.get("/api/dice/history", async (req, res) => {
    try {
      const rolls = await storage.getDiceRollHistory(1); // Default user for demo
      res.json(rolls);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dice roll history" });
    }
  });

  // Route to advance campaign story based on player actions
  app.post("/api/user/generate-avatar", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const user = req.user as User;
      const { style } = req.body;
      
      const avatarData = await generateUserAvatar({
        username: user.username,
        style: style || "fantasy"
      });
      
      await storage.updateUser(user.id, { avatarUrl: avatarData.url });
      
      res.json({ avatarUrl: avatarData.url });
    } catch (error: any) {
      console.error("Error generating avatar:", error);
      res.status(500).json({ 
        message: "Failed to generate avatar",
        error: error.message 
      });
    }
  });
  
  // Campaign Invitation routes
  app.post("/api/characters/award-xp", isAuthenticated, async (req: any, res) => {
    try {
      const { characterId, xp, reason } = req.body;
      
      if (!characterId || !xp || !reason) {
        return res.status(400).json({ message: "Character ID, XP amount, and reason are required" });
      }

      // Get current character data
      const [character] = await db.select().from(characters).where(eq(characters.id, characterId));
      
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }

      // Calculate new XP and level using proper D&D 5e thresholds
      const newXP = (character.experience || 0) + parseInt(xp);
      const oldLevel = character.level || 1;
      
      // Use D&D 5e XP thresholds from shared/rules/xp.ts
      const { getLevelFromXP, getAbilityModifier } = await import('../shared/rules/xp');
      const newLevel = getLevelFromXP(newXP);
      
      // If level increased, calculate HP increase using class hit dice
      let newMaxHp = character.maxHitPoints;
      let newCurrentHp = character.hitPoints;
      
      if (newLevel > oldLevel) {
        // D&D 5e class hit dice
        const CLASS_HIT_DICE: Record<string, number> = {
          'Barbarian': 12,
          'Fighter': 10,
          'Paladin': 10,
          'Ranger': 10,
          'Bard': 8,
          'Cleric': 8,
          'Druid': 8,
          'Monk': 8,
          'Rogue': 8,
          'Warlock': 8,
          'Sorcerer': 6,
          'Wizard': 6,
        };
        
        const hitDie = CLASS_HIT_DICE[character.class] || 8;
        const conMod = getAbilityModifier(character.constitution);
        
        // For each level gained, add average hit die roll + CON modifier
        // D&D 5e uses average (hit die / 2 + 1) for leveling up
        const levelsGained = newLevel - oldLevel;
        const hpPerLevel = Math.floor(hitDie / 2) + 1 + conMod;
        const hpGain = Math.max(levelsGained, levelsGained * hpPerLevel); // Minimum 1 HP per level
        
        newMaxHp = (character.maxHitPoints || 10) + hpGain;
        newCurrentHp = (character.hitPoints || 10) + hpGain; // Heal the gained HP
      }

      // Update character
      const [updatedCharacter] = await db
        .update(characters)
        .set({
          experience: newXP,
          level: newLevel,
          maxHitPoints: newMaxHp,
          hitPoints: newCurrentHp,
          updatedAt: new Date().toISOString()
        })
        .where(eq(characters.id, characterId))
        .returning();

      // Log the XP award
      console.log(`XP awarded: ${xp} to character ${characterId} (${reason})`);

      res.json({
        character: updatedCharacter,
        xpAwarded: parseInt(xp),
        reason,
        levelUp: newLevel > (character.level || 1)
      });
    } catch (error) {
      console.error("Failed to award XP:", error);
      res.status(500).json({ 
        message: "Failed to award XP",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/characters/add-item", isAuthenticated, async (req: any, res) => {
    try {
      const { characterId, itemId, quantity = 1 } = req.body;
      
      if (!characterId || !itemId) {
        return res.status(400).json({ message: "Character ID and item ID are required" });
      }

      // Get character and item data
      const [character] = await db.select().from(characters).where(eq(characters.id, characterId));
      const [item] = await db.select().from(magicItems).where(eq(magicItems.id, itemId));
      
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Update character inventory (stored as JSON array)
      let inventory = character.inventory || [];
      
      // Check if item already exists in inventory
      const existingItemIndex = inventory.findIndex((invItem: any) => invItem.id === itemId);
      
      if (existingItemIndex >= 0) {
        // Update quantity
        inventory[existingItemIndex].quantity = (inventory[existingItemIndex].quantity || 1) + parseInt(quantity);
      } else {
        // Add new item
        inventory.push({
          id: itemId,
          name: item.name,
          type: item.type,
          rarity: item.rarity,
          quantity: parseInt(quantity),
          addedAt: new Date().toISOString()
        });
      }

      // Update character
      const [updatedCharacter] = await db
        .update(characters)
        .set({
          inventory,
          updatedAt: new Date()
        })
        .where(eq(characters.id, characterId))
        .returning();

      // Log the item addition
      console.log(`Item added: ${item.name} (x${quantity}) to character ${characterId}`);

      res.json({
        character: updatedCharacter,
        itemAdded: {
          name: item.name,
          quantity: parseInt(quantity)
        }
      });
    } catch (error) {
      console.error("Failed to add item to inventory:", error);
      res.status(500).json({ 
        message: "Failed to add item to inventory",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Live Session Management Routes
}
