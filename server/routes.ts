import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { z } from "zod";
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
  npcs,
  users,
  campaigns,
  characters,
  locations,
  quests,
  magicItems,
  monsters,
  chatMessages,
  onlineUsers
} from "@shared/schema";
import { setupAuth, isAuthenticated } from "./auth";
import { generateCampaign, CampaignGenerationRequest } from "./lib/openai";
import { generateCharacterPortrait, generateCharacterBackground } from "./lib/characterImageGenerator";
import { registerCampaignDeploymentRoutes } from "./lib/campaignDeploy";
import { db } from "./db";
import { eq, sql, desc } from "drizzle-orm";
import OpenAI from "openai";
import { getXPFromCR, calculateEncounterXP, QUEST_XP_REWARDS, getLevelFromXP, getXPToNextLevel } from "../shared/rules/xp";
import { 
  parseCAMLYaml, 
  parseCAMLJson, 
  convertCAMLToCampaign, 
  convertCampaignToCAML, 
  exportToYAML, 
  exportToJSON, 
  buildAdventureGraph,
  CAML_AI_PROMPT
} from "./caml";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user

// Active WebSocket connections
type ClientWebSocket = WebSocket;
const activeConnections = new Set<ClientWebSocket>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);
  
  // Register campaign deployment routes
  registerCampaignDeploymentRoutes(app);
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Initialize WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // WebSocket event handlers
  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');
    activeConnections.add(ws);
    
    ws.on('message', (message: any) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received WebSocket message:', data);
        
        // Handle different message types
        if (data.type === 'dice_roll') {
          // Broadcast dice roll to all connected clients
          broadcastMessage(data.type, data.payload);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      activeConnections.delete(ws);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      activeConnections.delete(ws);
    });
  });
  
  // Function to broadcast messages to all connected clients
  function broadcastMessage(type: string, payload: any) {
    const message = JSON.stringify({ type, payload });
    activeConnections.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
  // API Routes
  app.get("/api/characters", async (req, res) => {
    try {
      const characters = await storage.getAllCharacters();
      res.json(characters);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch characters" });
    }
  });

  app.post("/api/characters", async (req, res) => {
    try {
      const characterData = insertCharacterSchema.parse(req.body);
      
      // Add starter consumables including resurrection scrolls
      const starterConsumables = [
        { name: "Healing Potion", quantity: 2, effect: "Restores 2d4+2 HP" },
        { name: "Scroll of Revivify", quantity: 2, effect: "Resurrects a dead character" },
        { name: "Antitoxin", quantity: 1, effect: "Advantage on poison saves for 1 hour" }
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
      
      // Add starter gold
      const starterGold = 50;
      
      const character = await storage.createCharacter({
        ...characterData,
        consumables: mergedConsumables,
        equipment: mergedEquipment,
        equippedWeapon: starterWeapon,
        equippedArmor: starterArmor,
        gold: ((characterData as any).gold || 0) + starterGold
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

  // Character Rest Routes - HP Recovery
  app.post("/api/characters/:id/short-rest", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
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
      
      res.json({
        character: updatedCharacter,
        healedAmount: actualHeal,
        message: `Short rest complete. Recovered ${actualHeal} HP.`
      });
    } catch (error: any) {
      console.error("Error during short rest:", error);
      res.status(500).json({ message: "Failed to complete short rest", error: error.message });
    }
  });

  app.post("/api/characters/:id/long-rest", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
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
      
      res.json({
        character: updatedCharacter,
        healedAmount: actualHeal,
        message: `Long rest complete. Fully restored to ${character.maxHitPoints} HP.`
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
      
      // Check if weapon is in inventory
      const currentEquipment = character.equipment || [];
      const weaponIndex = currentEquipment.indexOf(weapon);
      if (weaponIndex === -1) {
        return res.status(400).json({ message: "Weapon not in inventory" });
      }
      
      // Move ONE instance of the equipped weapon to front of array (first item is equipped)
      // This preserves duplicate items
      const reorderedEquipment = [...currentEquipment];
      reorderedEquipment.splice(weaponIndex, 1); // Remove one instance
      reorderedEquipment.unshift(weapon); // Add to front
      
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

  // Consumable Items Routes
  const CONSUMABLE_EFFECTS: Record<string, { type: string; effect: string; healDice?: string; healBonus?: number }> = {
    "Healing Potion": { type: "healing", effect: "Restores 2d4+2 HP", healDice: "2d4", healBonus: 2 },
    "Greater Healing Potion": { type: "healing", effect: "Restores 4d4+4 HP", healDice: "4d4", healBonus: 4 },
    "Superior Healing Potion": { type: "healing", effect: "Restores 8d4+8 HP", healDice: "8d4", healBonus: 8 },
    "Supreme Healing Potion": { type: "healing", effect: "Restores 10d4+20 HP", healDice: "10d4", healBonus: 20 },
    "Potion of Resistance": { type: "buff", effect: "Resistance to one damage type for 1 hour" },
    "Antitoxin": { type: "utility", effect: "Advantage on saves vs poison for 1 hour" },
    "Scroll of Cure Wounds": { type: "healing", effect: "Casts Cure Wounds (1d8+3 HP)", healDice: "1d8", healBonus: 3 },
    "Scroll of Lesser Restoration": { type: "utility", effect: "Ends one condition (poisoned, blinded, etc.)" },
  };

  app.get("/api/characters/:id/consumables", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const character = await storage.getCharacter(id);
      
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      const consumables = (character as any).consumables || [];
      
      res.json({
        characterId: id,
        consumables,
        knownConsumables: Object.keys(CONSUMABLE_EFFECTS).map(name => ({
          name,
          ...CONSUMABLE_EFFECTS[name]
        }))
      });
    } catch (error: any) {
      console.error("Error fetching consumables:", error);
      res.status(500).json({ message: "Failed to fetch consumables", error: error.message });
    }
  });

  app.post("/api/characters/:id/consumables/add", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, quantity = 1 } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "Consumable name is required" });
      }
      
      const character = await storage.getCharacter(id);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      const consumables: any[] = (character as any).consumables || [];
      const existing = consumables.find(c => c.name === name);
      
      if (existing) {
        existing.quantity += quantity;
      } else {
        const effectInfo = CONSUMABLE_EFFECTS[name] || { type: "unknown", effect: "Unknown effect" };
        consumables.push({
          name,
          quantity,
          ...effectInfo
        });
      }
      
      const updatedCharacter = await storage.updateCharacter(id, {
        consumables,
        updatedAt: new Date().toISOString()
      } as any);
      
      res.json({
        character: updatedCharacter,
        message: `Added ${quantity}x ${name}.`
      });
    } catch (error: any) {
      console.error("Error adding consumable:", error);
      res.status(500).json({ message: "Failed to add consumable", error: error.message });
    }
  });

  // Helper function to roll dice
  function rollDice(diceStr: string): number {
    const match = diceStr.match(/(\d+)d(\d+)/);
    if (!match) return 0;
    const [_, numDice, dieSize] = match;
    let total = 0;
    for (let i = 0; i < parseInt(numDice); i++) {
      total += Math.floor(Math.random() * parseInt(dieSize)) + 1;
    }
    return total;
  }

  app.post("/api/characters/:id/consumables/use", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "Consumable name is required" });
      }
      
      const character = await storage.getCharacter(id);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      if (character.status === "dead") {
        return res.status(400).json({ message: "Dead characters cannot use items." });
      }
      
      const consumables: any[] = (character as any).consumables || [];
      const itemIndex = consumables.findIndex(c => c.name === name);
      
      if (itemIndex === -1) {
        return res.status(404).json({ message: "Consumable not found" });
      }
      
      const item = consumables[itemIndex];
      let resultMessage = "";
      let healedAmount = 0;
      let newHP = character.hitPoints;
      let newStatus = character.status;
      
      // Apply effect based on type
      if (item.type === "healing" && item.healDice) {
        const diceRoll = rollDice(item.healDice);
        healedAmount = diceRoll + (item.healBonus || 0);
        newHP = Math.min(character.maxHitPoints, character.hitPoints + healedAmount);
        
        // If unconscious/stabilized and healed above 0, become conscious
        if (newHP > 0 && (character.status === "unconscious" || character.status === "stabilized")) {
          newStatus = "conscious";
          resultMessage = `Used ${name}! Healed ${healedAmount} HP and regained consciousness!`;
        } else {
          resultMessage = `Used ${name}! Healed ${healedAmount} HP (${character.hitPoints} → ${newHP}).`;
        }
      } else {
        resultMessage = `Used ${name}! ${item.effect}`;
      }
      
      // Reduce quantity or remove
      if (item.quantity <= 1) {
        consumables.splice(itemIndex, 1);
      } else {
        item.quantity -= 1;
      }
      
      const updateData: any = {
        consumables,
        updatedAt: new Date().toISOString()
      };
      
      if (healedAmount > 0) {
        updateData.hitPoints = newHP;
        updateData.status = newStatus;
        if (newStatus === "conscious") {
          updateData.deathSaveSuccesses = 0;
          updateData.deathSaveFailures = 0;
        }
      }
      
      const updatedCharacter = await storage.updateCharacter(id, updateData);
      
      res.json({
        character: updatedCharacter,
        healedAmount,
        newHP,
        message: resultMessage
      });
    } catch (error: any) {
      console.error("Error using consumable:", error);
      res.status(500).json({ message: "Failed to use consumable", error: error.message });
    }
  });

  // Get available characters (excludes dead characters for campaign joining)
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
      
      // Check if item is in inventory
      const equipment = character.equipment || [];
      if (!equipment.includes(item)) {
        return res.status(400).json({ message: "Item not in inventory" });
      }
      
      // Build update object based on slot
      const updateData: any = { updatedAt: new Date().toISOString() };
      
      switch (slot) {
        case "weapon":
          updateData.equippedWeapon = item;
          break;
        case "armor":
          updateData.equippedArmor = item;
          break;
        case "shield":
          updateData.equippedShield = item;
          break;
        case "accessory":
          updateData.equippedAccessory = item;
          break;
      }
      
      const updatedCharacter = await storage.updateCharacter(id, updateData);
      
      res.json({
        character: updatedCharacter,
        message: `Equipped ${item} to ${slot} slot`
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

  // Transfer item between characters in the same campaign
  app.post("/api/campaigns/:campaignId/items/transfer", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const { fromCharacterId, toCharacterId, item } = req.body;
      
      if (!fromCharacterId || !toCharacterId || !item) {
        return res.status(400).json({ message: "fromCharacterId, toCharacterId, and item are required" });
      }
      
      // Verify both characters are in the campaign
      const participants = await storage.getCampaignParticipants(campaignId);
      const fromParticipant = participants.find((p: any) => p.characterId === fromCharacterId);
      const toParticipant = participants.find((p: any) => p.characterId === toCharacterId);
      
      if (!fromParticipant || !toParticipant) {
        return res.status(400).json({ message: "Both characters must be in the campaign" });
      }
      
      const fromCharacter = await storage.getCharacter(fromCharacterId);
      const toCharacter = await storage.getCharacter(toCharacterId);
      
      if (!fromCharacter || !toCharacter) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      // Check if item is in from character's inventory
      const fromEquipment = fromCharacter.equipment || [];
      const itemIndex = fromEquipment.indexOf(item);
      
      if (itemIndex === -1) {
        return res.status(400).json({ message: "Item not in source character's inventory" });
      }
      
      // Remove from source
      fromEquipment.splice(itemIndex, 1);
      
      // Unequip if it was equipped
      const unequipUpdates: any = {};
      if ((fromCharacter as any).equippedWeapon === item) unequipUpdates.equippedWeapon = null;
      if ((fromCharacter as any).equippedArmor === item) unequipUpdates.equippedArmor = null;
      if ((fromCharacter as any).equippedShield === item) unequipUpdates.equippedShield = null;
      if ((fromCharacter as any).equippedAccessory === item) unequipUpdates.equippedAccessory = null;
      
      await storage.updateCharacter(fromCharacterId, {
        equipment: fromEquipment,
        ...unequipUpdates,
        updatedAt: new Date().toISOString()
      });
      
      // Add to target
      const toEquipment = toCharacter.equipment || [];
      toEquipment.push(item);
      
      await storage.updateCharacter(toCharacterId, {
        equipment: toEquipment,
        updatedAt: new Date().toISOString()
      });
      
      res.json({
        message: `Transferred ${item} from ${fromCharacter.name} to ${toCharacter.name}`
      });
    } catch (error: any) {
      console.error("Error transferring item:", error);
      res.status(500).json({ message: "Failed to transfer item", error: error.message });
    }
  });

  // Campaign routes
  app.get("/api/campaigns", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = req.user.id;
      const allCampaigns = await storage.getAllCampaigns();
      const userCampaigns = [];
      
      // For each campaign, add participant information
      for (const campaign of allCampaigns) {
        const participants = await storage.getCampaignParticipants(campaign.id);
        
        // Check if user is the creator or a participant
        if (campaign.userId === userId || participants.some(p => p.userId === userId)) {
          const campaignWithParticipants = {
            ...campaign,
            participants: participants
          };
          
          userCampaigns.push(campaignWithParticipants);
        }
      }
      
      res.json(userCampaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });
  
  // Get archived campaigns
  app.get("/api/campaigns/archived", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = req.user.id;
      const archivedCampaigns = await storage.getArchivedCampaigns();
      const userArchivedCampaigns = [];
      
      // For each archived campaign, add participant information
      for (const campaign of archivedCampaigns) {
        // Check if user is the creator
        if (campaign.userId === userId) {
          const participants = await storage.getCampaignParticipants(campaign.id);
          const campaignWithParticipants = {
            ...campaign,
            participants
          };
          userArchivedCampaigns.push(campaignWithParticipants);
        }
      }
      
      res.json(userArchivedCampaigns);
    } catch (error) {
      console.error("Failed to fetch archived campaigns:", error);
      res.status(500).json({ message: "Failed to fetch archived campaigns" });
    }
  });

  // Generate a campaign using AI
  app.post("/api/campaigns/generate", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Check if OpenAI API key exists
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ message: "OpenAI API key not configured" });
      }
      
      const campaignRequest: CampaignGenerationRequest = {
        theme: req.body.theme,
        difficulty: req.body.difficulty,
        narrativeStyle: req.body.narrativeStyle,
        numberOfSessions: req.body.numberOfSessions
      };
      
      const generatedCampaign = await generateCampaign(campaignRequest);
      
      res.json({
        ...generatedCampaign,
        // Include additional fields needed for campaign creation form
        userId: req.user.id,
        createdAt: new Date().toISOString(),
        currentSession: 1
      });
    } catch (error) {
      console.error("Error generating campaign:", error);
      res.status(500).json({ message: "Failed to generate campaign" });
    }
  });

  app.post("/api/campaigns", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const campaignData = insertCampaignSchema.parse({
        ...req.body,
        userId: req.user.id,
        createdAt: new Date().toISOString(),
        currentSession: 1,
        isPublished: false,
        isPrivate: true,
        maxPlayers: 6
      });
      
      const campaign = await storage.createCampaign(campaignData);
      
      // Add the creator as a DM participant if a characterId is provided
      if (req.body.characterId) {
        await storage.addCampaignParticipant({
          campaignId: campaign.id,
          userId: req.user.id,
          characterId: req.body.characterId,
          role: 'dm',
          joinedAt: new Date().toISOString()
        });
      }
      
      // Generate and create the initial session for this campaign
      try {
        // Generate initial narrative based on campaign description
        const openaiClient = new OpenAI({ 
          apiKey: process.env.OPENAI_API_KEY
        });
        
        const prompt = `
You are an expert Dungeon Master for a D&D game with a ${campaign.narrativeStyle || "descriptive"} storytelling style.
Campaign: ${campaign.title}. ${campaign.description || ""}
Difficulty level: ${campaign.difficulty || "Normal - Balanced Challenge"}

Generate the opening scene for this campaign. Include:
1. A descriptive narrative of the initial setting and situation (2-3 paragraphs, keep it concise)
2. A title for this opening scene
3. Four possible actions the players can take next, with at least 2 actions requiring dice rolls
4. Initial quests/objectives for the players to complete

Return your response as a JSON object with these fields:
- narrative: The descriptive text of the opening scene (keep under 150 words)
- sessionTitle: A short, engaging title for this scene
- location: The current location or setting where the campaign begins
- choices: An array of 4 objects, each with:
  - action: A short description of a possible action
  - description: A brief explanation of what this action entails 
  - requiresDiceRoll: Boolean indicating if this action requires a dice roll
  - diceType: If requiresDiceRoll is true, include the type of dice to roll ("d20" for most skill checks)
  - rollDC: If requiresDiceRoll is true, include the DC/difficulty (number to beat) for this roll
  - rollModifier: The modifier to add to the roll (usually -2 to +5)
  - rollPurpose: A short explanation of what the roll is for (e.g., "Perception Check", "Athletics Check")
  - successText: Brief text to display on a successful roll
  - failureText: Brief text to display on a failed roll
- activeQuests: An array of 1-3 initial quests, each with:
  - id: Unique identifier like "quest_main_1" or "quest_side_1"
  - title: Short quest title
  - description: What the player needs to accomplish
  - status: Always "active" for initial quests
  - xpReward: XP reward (100-500 based on difficulty)
`;
        
        const response = await openaiClient.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 1500,
        });
        
        const responseContent = response.choices[0].message.content;
        let initialSessionData;
        
        try {
          initialSessionData = JSON.parse(responseContent);
          
          // Ensure the response has the expected structure
          if (!initialSessionData.narrative || !initialSessionData.sessionTitle || 
              !initialSessionData.location || !Array.isArray(initialSessionData.choices)) {
            throw new Error("Invalid response structure");
          }
          
          // Set default values for optional fields to prevent type errors
          initialSessionData.choices.forEach(choice => {
            if (choice.requiresDiceRoll) {
              choice.rollModifier = choice.rollModifier || 0;
            }
          });
          
          // Create initial session with quests in storyState
          const initialStoryState = {
            location: initialSessionData.location,
            activeNPCs: [],
            plotPoints: [],
            conditions: [],
            activeQuests: initialSessionData.activeQuests || [
              { id: "quest_main_1", title: "Begin the Adventure", description: "Explore your surroundings and discover the first clues", status: "active", xpReward: 100 }
            ]
          };
          
          const sessionData = {
            campaignId: campaign.id,
            sessionNumber: 1,
            title: initialSessionData.sessionTitle,
            narrative: initialSessionData.narrative,
            location: initialSessionData.location,
            choices: JSON.stringify(initialSessionData.choices),
            storyState: JSON.stringify(initialStoryState),
            sessionXpReward: 100,
            createdAt: new Date().toISOString(),
          };
          
          await storage.createCampaignSession(sessionData);
          console.log(`Created initial session for campaign ${campaign.id}`);
          
        } catch (parseError) {
          console.error("Failed to parse OpenAI response for initial session:", parseError);
          console.log("Raw response:", responseContent);
          
          // Create a fallback session if parsing fails
          const fallbackSessionData = {
            campaignId: campaign.id,
            sessionNumber: 1,
            title: "The Adventure Begins",
            narrative: "Your journey begins in a small settlement at the edge of the known world. The air is filled with possibility as you prepare to embark on your first adventure.",
            location: "Starting Village",
            choices: JSON.stringify([
              { action: "Visit the local tavern", description: "Gather information from the locals", requiresDiceRoll: false },
              { action: "Meet with the town elder", description: "Learn about problems facing the settlement", requiresDiceRoll: false },
              { action: "Investigate nearby ruins", description: "Search for treasure and adventure", requiresDiceRoll: true, diceType: "d20", rollDC: 12, rollModifier: 0, rollPurpose: "Investigation Check", successText: "You find something interesting!", failureText: "Nothing catches your eye." }
            ]),
            storyState: JSON.stringify({
              location: "Starting Village",
              activeNPCs: [],
              plotPoints: [],
              conditions: [],
              activeQuests: [
                { id: "quest_main_1", title: "Uncover the Mystery", description: "Explore the village and discover what adventure awaits", status: "active", xpReward: 100 }
              ]
            }),
            sessionXpReward: 100,
            createdAt: new Date().toISOString(),
          };
          
          await storage.createCampaignSession(fallbackSessionData);
          console.log(`Created fallback session for campaign ${campaign.id} due to parsing error`);
        }
        
        // Update the campaign with the session number to establish the link
        await storage.updateCampaignSession(campaign.id, 1);
        
      } catch (sessionError) {
        console.error("Error creating initial session:", sessionError);
        
        // Create a fallback session if OpenAI call fails
        const fallbackSessionData = {
          campaignId: campaign.id,
          sessionNumber: 1,
          title: "The Adventure Begins",
          narrative: "Your journey begins in a small settlement at the edge of the known world. The air is filled with possibility as you prepare to embark on your first adventure.",
          location: "Starting Village",
          choices: JSON.stringify([
            { action: "Visit the local tavern", description: "Gather information from the locals", requiresDiceRoll: false },
            { action: "Meet with the town elder", description: "Learn about problems facing the settlement", requiresDiceRoll: false },
            { action: "Investigate nearby ruins", description: "Search for treasure and adventure", requiresDiceRoll: true, diceType: "d20", rollDC: 12, rollModifier: 0, rollPurpose: "Investigation Check", successText: "You find something interesting!", failureText: "Nothing catches your eye." }
          ]),
          storyState: JSON.stringify({
            location: "Starting Village",
            activeNPCs: [],
            plotPoints: [],
            conditions: [],
            activeQuests: [
              { id: "quest_main_1", title: "Uncover the Mystery", description: "Explore the village and discover what adventure awaits", status: "active", xpReward: 100 }
            ]
          }),
          sessionXpReward: 100,
          createdAt: new Date().toISOString(),
        };
        
        try {
          await storage.createCampaignSession(fallbackSessionData);
          console.log(`Created fallback session for campaign ${campaign.id} due to API error`);
          
          // Update the campaign with the session number to establish the link
          await storage.updateCampaignSession(campaign.id, 1);
        } catch (fallbackError) {
          console.error("Failed to create fallback session:", fallbackError);
        }
      }
      
      res.status(201).json(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid campaign data", errors: error.errors });
      } else {
        console.error("Error creating campaign:", error);
        res.status(500).json({ message: "Failed to create campaign" });
      }
    }
  });

  app.get("/api/campaigns/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const id = parseInt(req.params.id);
      const campaign = await storage.getCampaign(id);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Check if user is authorized to view this campaign
      const participants = await storage.getCampaignParticipants(id);
      const isParticipant = participants.some(p => p.userId === req.user.id);
      
      if (campaign.userId !== req.user.id && !isParticipant) {
        return res.status(403).json({ message: "Not authorized to view this campaign" });
      }
      
      // Get character details for each participant
      const participantsWithDetails = await Promise.all(
        participants.map(async (p) => {
          const character = await storage.getCharacter(p.characterId);
          const user = await storage.getUser(p.userId);
          return {
            ...p,
            character: character,
            username: user ? user.username : 'Unknown',
            displayName: user ? user.displayName : null
          };
        })
      );
      
      const campaignWithParticipants = {
        ...campaign,
        participants: participantsWithDetails
      };
      
      res.json(campaignWithParticipants);
    } catch (error) {
      console.error("Error fetching campaign:", error);
      res.status(500).json({ message: "Failed to fetch campaign" });
    }
  });

  app.patch("/api/campaigns/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const id = parseInt(req.params.id);
      const campaign = await storage.getCampaign(id);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      if (campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to update this campaign" });
      }
      
      const updates = req.body;
      const updatedCampaign = await storage.updateCampaign(id, updates);
      
      res.json(updatedCampaign);
    } catch (error) {
      console.error("Error updating campaign:", error);
      res.status(500).json({ message: "Failed to update campaign" });
    }
  });

  // Campaign Session routes
  app.get("/api/campaigns/:campaignId/sessions/:sessionNumber", async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const sessionNumber = parseInt(req.params.sessionNumber);
      const session = await storage.getCampaignSession(campaignId, sessionNumber);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch session" });
    }
  });
  
  // Get all sessions for a campaign
  app.get("/api/campaigns/:campaignId/sessions", async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const sessions = await storage.getCampaignSessions(campaignId);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch campaign sessions" });
    }
  });
  
  // Multi-user Campaign Participant Management
  // Note: The main /api/campaigns/:campaignId/participants GET route is defined in the Multi-user Campaign Management section below
  
  // Add a participant to a campaign - THIS ROUTE IS DUPLICATED
  // SEE MULTI-USER CAMPAIGN MANAGEMENT SECTION FOR THE ACTIVE IMPLEMENTATION
  app.post("/api/campaigns/:campaignId/participants-unused", async (req, res) => {
    try {
      res.status(500).json({ message: "This route is deprecated" });
    } catch (err) {
      res.status(500).json({ message: "This route is deprecated" });
    }
  });
  
  // Remove a participant from a campaign
  app.delete("/api/campaigns/:campaignId/participants/:userId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const userIdToRemove = parseInt(req.params.userId);
      
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Verify permissions: only campaign owner or the participant themselves can remove
      if (campaign.userId !== req.user.id && userIdToRemove !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to remove participants" });
      }
      
      // Remove the participant
      const result = await storage.removeCampaignParticipant(campaignId, userIdToRemove);
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error removing participant:", error);
      res.status(500).json({ message: "Failed to remove participant" });
    }
  });
  
  // Turn-based Campaign Management
  
  // Get the current turn information
  app.get("/api/campaigns/:campaignId/turns/current", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      
      // Verify the campaign exists
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Check if user is a participant
      const participant = await storage.getCampaignParticipant(campaignId, req.user.id);
      if (!participant && campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to view this campaign" });
      }
      
      // Get current turn info
      const turnInfo = await storage.getCurrentTurn(campaignId);
      
      if (!turnInfo) {
        return res.json({ active: false });
      }
      
      // Get user details for the current turn
      const user = await storage.getUser(turnInfo.userId);
      const participantInfo = await storage.getCampaignParticipant(campaignId, turnInfo.userId);
      const character = participantInfo ? await storage.getCharacter(participantInfo.characterId) : null;
      
      res.json({
        active: true,
        userId: turnInfo.userId,
        username: user ? user.username : 'Unknown',
        displayName: user ? user.displayName : null,
        character: character,
        startedAt: turnInfo.startedAt,
        isCurrentUser: turnInfo.userId === req.user.id
      });
    } catch (error) {
      console.error("Error fetching current turn:", error);
      res.status(500).json({ message: "Failed to fetch current turn information" });
    }
  });
  
  // Start the next turn in the campaign
  app.post("/api/campaigns/:campaignId/turns/next", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      
      // Verify the campaign exists
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Only the DM can advance turns
      if (campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the DM can advance turns" });
      }
      
      // Start the next turn
      const turnInfo = await storage.startNextTurn(campaignId);
      
      if (!turnInfo) {
        return res.status(400).json({ message: "Failed to start next turn" });
      }
      
      // Get user details for the new turn
      const user = await storage.getUser(turnInfo.userId);
      const participantInfo = await storage.getCampaignParticipant(campaignId, turnInfo.userId);
      const character = participantInfo ? await storage.getCharacter(participantInfo.characterId) : null;
      
      // Broadcast turn change via WebSocket
      broadcastMessage('turn_change', {
        campaignId,
        userId: turnInfo.userId,
        username: user ? user.username : 'Unknown',
        startedAt: turnInfo.startedAt
      });
      
      res.json({
        userId: turnInfo.userId,
        username: user ? user.username : 'Unknown',
        displayName: user ? user.displayName : null,
        character: character,
        startedAt: turnInfo.startedAt
      });
    } catch (error) {
      console.error("Error starting next turn:", error);
      res.status(500).json({ message: "Failed to start next turn" });
    }
  });
  
  // End the current turn
  app.post("/api/campaigns/:campaignId/turns/end", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      
      // Verify the campaign exists
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Only the DM or current player can end the turn
      if (campaign.userId !== req.user.id && campaign.currentTurnUserId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to end the current turn" });
      }
      
      // End the current turn
      const result = await storage.endCurrentTurn(campaignId);
      
      // Broadcast turn end via WebSocket
      broadcastMessage('turn_ended', { campaignId });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error ending turn:", error);
      res.status(500).json({ message: "Failed to end turn" });
    }
  });

  app.post("/api/campaigns/:campaignId/sessions", async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const sessionData = insertCampaignSessionSchema.parse({
        ...req.body,
        campaignId
      });
      
      const session = await storage.createCampaignSession(sessionData);
      
      // Update the campaign's current session number
      const campaign = await storage.getCampaign(campaignId);
      if (campaign) {
        await storage.updateCampaignSession(campaignId, session.sessionNumber);
      }
      
      res.status(201).json(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid session data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create session" });
      }
    }
  });

  // Advance to next session (end current chapter/session and start new one)
  app.post("/api/campaigns/:campaignId/sessions/advance", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const { summary } = req.body;
      
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Only campaign owner can advance sessions
      if (campaign.userId !== req.user!.id) {
        return res.status(403).json({ message: "Only the campaign owner can advance sessions" });
      }
      
      const newSession = await storage.advanceToNextSession(campaignId, summary);
      
      // Broadcast session advancement via WebSocket
      broadcastMessage('session_advanced', { 
        campaignId, 
        newSessionNumber: newSession.sessionNumber 
      });
      
      res.json({ 
        success: true, 
        session: newSession,
        message: `Advanced to Session ${newSession.sessionNumber}`
      });
    } catch (error) {
      console.error("Error advancing session:", error);
      res.status(500).json({ message: "Failed to advance to next session" });
    }
  });

  // Items database routes
  app.get("/api/items", async (req, res) => {
    try {
      const { type } = req.query;
      if (type && typeof type === 'string') {
        const items = await storage.getItemsByType(type);
        res.json(items);
      } else {
        const items = await storage.getAllItems();
        res.json(items);
      }
    } catch (error) {
      console.error("Error fetching items:", error);
      res.status(500).json({ message: "Failed to fetch items" });
    }
  });
  
  app.get("/api/items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.getItem(id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error fetching item:", error);
      res.status(500).json({ message: "Failed to fetch item" });
    }
  });
  
  app.get("/api/items/name/:name", async (req, res) => {
    try {
      const name = req.params.name;
      const item = await storage.getItemByName(name);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error fetching item:", error);
      res.status(500).json({ message: "Failed to fetch item" });
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
  app.post("/api/campaigns/advance-story", async (req, res) => {
    try {
      const { campaignId, prompt, narrativeStyle, difficulty, storyDirection, currentLocation } = req.body;
      
      if (!campaignId) {
        return res.status(400).json({ message: "Campaign ID is required" });
      }
      
      // Remove any "What will you do?" text from the prompt if prompt exists
      const cleanedPrompt = prompt ? prompt.replace(/What will you do\?/g, "").trim() : "";
      
      // Get campaign and character information for context
      let campaignContext = "";
      let locationContext = "";
      
      if (currentLocation) {
        locationContext = `Current location: ${currentLocation}.`;
      }
      
      const campaign = await storage.getCampaign(parseInt(campaignId));
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      campaignContext = `Campaign: ${campaign.title}. ${campaign.description || ""}`;
      
      // Get campaign participants to find characters
      const participants = await storage.getCampaignParticipants(campaign.id);
      if (participants && participants.length > 0) {
        // Get character info for each participant
        const characters = await Promise.all(
          participants.map(async (p) => await storage.getCharacter(p.characterId))
        );
        
        const validCharacters = characters.filter(Boolean);
        if (validCharacters.length > 0) {
          campaignContext += " Characters in party: " + 
            validCharacters.map(char => {
              if (!char) return "";
              return `${char.name || "Unknown"} (Level ${char.level || 1} ${char.race || "Human"} ${char.class || "Fighter"})`;
            }).filter(Boolean).join(", ");
        }
      }
      
      const promptWithContext = `
You are an expert Dungeon Master for a D&D game with a ${narrativeStyle || "descriptive"} storytelling style.
${campaignContext}
${locationContext}
Difficulty level: ${difficulty || "Normal - Balanced Challenge"}
Story direction preference: ${storyDirection || "balanced mix of combat, roleplay, and exploration"}

Based on the player's action: "${cleanedPrompt}", generate the next part of the adventure. Include:
1. A descriptive narrative of what happens next (3-4 paragraphs)
2. A title for this scene/encounter
3. Four possible actions the player can take next, with at least 2 actions requiring dice rolls (skill checks, saving throws, or combat rolls)

Return your response as a JSON object with these fields:
- narrative: The descriptive text of what happens next
- sessionTitle: A short, engaging title for this scene
- location: The current location or setting where this scene takes place
- choices: An array of 4 objects, each with:
  - action: A short description of a possible action
  - description: A brief explanation of what this action entails 
  - icon: A simple icon identifier (use: "search", "hand-sparkles", "running", "sword", or any basic icon name)
  - requiresDiceRoll: Boolean indicating if this action requires a dice roll
  - diceType: If requiresDiceRoll is true, include the type of dice to roll ("d20" for most skill checks and attacks, "d4", "d6", "d8", etc. for damage)
  - rollDC: If requiresDiceRoll is true, include the DC/difficulty (number to beat) for this roll
  - rollModifier: The modifier to add to the roll (based on character attributes, usually -2 to +5)
  - rollPurpose: A short explanation of what the roll is for (e.g., "Perception Check", "Athletics Check", "Attack Roll")
  - successText: Brief text to display on a successful roll
  - failureText: Brief text to display on a failed roll
`;

      // Generate story directly using OpenAI
      const openaiClient = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY
      });
      
      const response = await openaiClient.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        messages: [{ role: "user", content: promptWithContext }],
        response_format: { type: "json_object" },
        max_tokens: 1500,
      });

      const responseContent = response.choices[0].message.content;
      let storyData;
      
      try {
        storyData = JSON.parse(responseContent);
        
        // Ensure the response has the expected structure
        if (!storyData.narrative || !storyData.sessionTitle || 
            !storyData.location || !Array.isArray(storyData.choices)) {
          throw new Error("Invalid response structure");
        }
      } catch (parseError) {
        console.error("Failed to parse OpenAI response:", parseError);
        console.log("Raw response:", responseContent);
        return res.status(500).json({ 
          message: "Failed to parse story generation response",
          error: parseError.message
        });
      }
      
      // Create new session
      const sessionNumber = (campaign.currentSession || 0) + 1;
      const sessionData = {
        campaignId: parseInt(campaignId),
        sessionNumber,
        title: storyData.sessionTitle,
        narrative: storyData.narrative,
        location: storyData.location,
        choices: storyData.choices,
        createdAt: new Date().toISOString(), // Add required createdAt field
      };
      
      // Save the session
      const session = await storage.createCampaignSession(sessionData);
      
      // Update campaign's current session
      await storage.updateCampaignSession(parseInt(campaignId), sessionNumber);
      
      res.status(201).json(session);
    } catch (error) {
      console.error("Error advancing story:", error);
      
      // More detailed error handling
      let errorMessage = "Failed to advance story";
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error("Error details:", error.stack);
      }
      
      res.status(500).json({ 
        message: "Failed to advance story", 
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error)
      });
    }
  });

  // AI Scene Generation for Live Sessions with Skill Check Embedding
  app.post("/api/campaigns/:id/generate-scene", async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const { context, playerAction, currentLocation } = req.body;

      if (!context || !playerAction) {
        return res.status(400).json({ message: "Context and player action are required" });
      }

      // Get campaign information for context
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      // Get current session for additional context
      const currentSession = await storage.getCampaignSession(campaignId, campaign.currentSession);
      
      // Get campaign participants for NPC context
      const participants = await storage.getCampaignParticipants(campaignId);

      // Handle structured player action data with skill checks
      const isStructuredAction = typeof playerAction === 'object' && playerAction.description;
      const actionDescription = isStructuredAction ? playerAction.description : playerAction;
      const skillCheck = isStructuredAction ? playerAction.skill_check : null;

      // Build skill check continuation prompt
      let skillCheckContinuation = "";
      if (skillCheck) {
        skillCheckContinuation = `
PLAYER ACTION CARRIED FORWARD:
Last session, a player made a ${skillCheck.skill} check targeting "${skillCheck.target}" with the intent to ${skillCheck.intent}. The result was ${skillCheck.result}. This moment must carry forward - begin the next scene by reflecting how this influences the situation and the group's next steps. Do not ignore this previous choice.`;
      }

      const scenePrompt = `
You are a fantasy RPG narrator working with a live Dungeon Master. Generate the next scene for the DM to describe.

Campaign Context:
- Title: ${campaign.title}
- Difficulty: ${campaign.difficulty}
- Narrative Style: ${campaign.narrativeStyle}
- Current Location: ${currentLocation || "Unknown Location"}

Current Situation: ${context}
Last Player Action: ${actionDescription}

${skillCheckContinuation}

${currentSession ? `Previous Scene: ${currentSession.narrative}` : ''}

${participants?.length > 0 ? `Active NPCs/Characters: ${participants.map(p => p.character?.name || 'Unknown').join(', ')}` : ''}

CRITICAL INSTRUCTIONS:
You must carry forward the effects of player skill checks or major decisions. If players succeeded in a skill check, those effects should influence NPC behavior, environment changes, or story progression. Do not ignore previous choices. Refer to the result and build new tension from it.

TASK: Generate the next scene for the DM to describe, including:
- Vivid location description
- NPC emotional reactions (if applicable)
- Narrative development based on the player action
- Three meaningful player options or events

Respond in structured JSON format for structured consequence tracking:
{
  "scene": "Detailed description of what happens next reflecting the skill check outcome (3-4 paragraphs)",
  "npc_reactions": {
    "npc_name": "reaction description showing how they respond to the skill check result"
  },
  "environment": "Updated environment description showing changes from player actions",
  "options": [
    {
      "label": "Action description",
      "path_type": "Exploration|Magic|Stealth|Combat|Dialogue",
      "effect": "Brief description of potential outcome",
      "consequence": "Specific result of choosing this path",
      "requiresDiceRoll": boolean,
      "diceType": "d20|d6|etc (if dice roll required)",
      "rollDC": number,
      "rollPurpose": "What the roll is for"
    }
  ],
  "dmNotes": "Private notes for the DM about consequences, hidden information, or plot hooks arising from the skill check"
}`;

      const openaiClient = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY
      });
      
      const response = await openaiClient.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        messages: [{ role: "user", content: scenePrompt }],
        response_format: { type: "json_object" },
        max_tokens: 1200,
      });

      const responseContent = response.choices[0].message.content;
      let sceneData;
      
      try {
        sceneData = JSON.parse(responseContent);
        
        // Ensure the response has the expected structure
        if (!sceneData.scene || !Array.isArray(sceneData.options)) {
          throw new Error("Invalid scene generation response structure");
        }
      } catch (parseError) {
        console.error("Failed to parse scene generation response:", parseError);
        return res.status(500).json({ 
          message: "Failed to parse scene generation response",
          error: parseError.message
        });
      }

      res.json({ scene: sceneData });
    } catch (error) {
      console.error("Error generating scene:", error);
      res.status(500).json({ 
        message: "Failed to generate scene",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // OpenAI integration routes
  app.post("/api/openai/generate-story", async (req, res) => {
    try {
      const { prompt, narrativeStyle, difficulty, storyDirection, campaignId, currentLocation } = req.body;

      // Get campaign and character information for context if provided
      let campaignContext = "";
      let locationContext = "";
      
      if (currentLocation) {
        locationContext = `Current location: ${currentLocation}.`;
      }
      
      if (campaignId) {
        const campaign = await storage.getCampaign(parseInt(campaignId));
        if (campaign) {
          campaignContext = `Campaign: ${campaign.title}. ${campaign.description || ""}`;
          
          // Get campaign participants to find characters
          const participants = await storage.getCampaignParticipants(parseInt(campaignId));
          if (participants && participants.length > 0) {
            // Get character info for each participant
            const characters = await Promise.all(
              participants.map(async (p) => await storage.getCharacter(p.characterId))
            );
            
            const validCharacters = characters.filter(Boolean);
            if (validCharacters.length > 0) {
              campaignContext += " Characters in party: " + 
                validCharacters.map(char => {
                  if (!char) return "";
                  return `${char.name || "Unknown"} (Level ${char.level || 1} ${char.race || "Human"} ${char.class || "Fighter"})`;
                }).filter(Boolean).join(", ");
            }
          }
        }
      }

      // Get quest context for milestone tracking
      let questContext = "";
      let activeQuests: any[] = [];
      if (campaignId) {
        activeQuests = await storage.getCampaignQuests(parseInt(campaignId));
        const inProgressQuests = activeQuests.filter(q => q.status === "active" || q.status === "in_progress");
        if (inProgressQuests.length > 0) {
          questContext = "\n\nACTIVE QUESTS:\n" + inProgressQuests.map(q => 
            `- ${q.title}: ${q.description} (XP: ${q.xpReward}, Gold: ${q.goldReward})`
          ).join("\n");
        }
      }

      const promptWithContext = `
You are an expert Dungeon Master for a D&D game with a ${narrativeStyle || "descriptive"} storytelling style.
${campaignContext}
${locationContext}
${questContext}
Difficulty level: ${difficulty || "Normal - Balanced Challenge"}
Story direction preference: ${storyDirection || "balanced mix of combat, roleplay, and exploration"}

PACING GUIDELINES - IMPORTANT:
- AVOID frequent combat encounters. Only 1 in 4-5 story beats should involve combat.
- Focus on EXPLORATION, DISCOVERY, MYSTERY, and SOCIAL ENCOUNTERS.
- Make progress feel FAST and MEANINGFUL - each scene should advance the story significantly.
- Include TREASURE FINDS, SECRET DISCOVERIES, or NPC INTERACTIONS regularly.
- When players complete objectives, mark them as QUEST MILESTONES with rewards.

Based on the player's action: "${prompt}", generate the next part of the adventure.

Return your response as a JSON object with these fields:
- narrative: The descriptive text of what happens next (2-3 paragraphs, keep it moving)
- sessionTitle: A short, engaging title for this scene
- location: The current location or setting where this scene takes place
- choices: An array of 4 objects, each with:
  - action: A short description of a possible action
  - description: A brief explanation of what this action entails 
  - icon: A simple icon identifier (use: "search", "hand-sparkles", "running", "sword", "door", "treasure", "key", "talk", or any basic icon name)
  - requiresDiceRoll: Boolean indicating if this action requires a dice roll
  - diceType: If requiresDiceRoll is true, include the type of dice to roll ("d20" for most skill checks)
  - rollDC: If requiresDiceRoll is true, include the DC/difficulty (10-15 for most, 16-20 for hard)
  - rollModifier: The modifier to add to the roll (based on character attributes, usually -2 to +5)
  - rollPurpose: A short explanation of what the roll is for (e.g., "Perception Check", "Investigation Check")
  - successText: Brief text to display on a successful roll
  - failureText: Brief text to display on a failed roll
- questUpdate: Optional object with quest progress. Include if this action completes or advances a quest:
  - questCompleted: Boolean if a quest milestone was achieved
  - questTitle: Title of the completed quest
  - xpReward: XP to award (50-300 for milestones)
  - goldReward: Gold to award (10-100)
  - lootItems: Array of item names found (1-3 items like "Health Potion", "Shortsword +1", "Ruby Ring")
- treasureFound: Optional array of treasure/items discovered in this scene (only if exploration reveals treasure)
`;

      const openaiClient = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY
      });
      
      const response = await openaiClient.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        messages: [{ role: "user", content: promptWithContext }],
        response_format: { type: "json_object" },
        max_tokens: 1500,
      });

      const responseContent = response.choices[0].message.content;
      let parsedResponse;
      
      try {
        parsedResponse = JSON.parse(responseContent);
        
        // Ensure the response has the expected structure
        if (!parsedResponse.narrative || !parsedResponse.sessionTitle || 
            !parsedResponse.location || !Array.isArray(parsedResponse.choices)) {
          throw new Error("Invalid response structure");
        }
        
        res.json(parsedResponse);
      } catch (parseError) {
        // Fallback for parsing errors
        res.status(500).json({ 
          message: "Failed to parse OpenAI response",
          rawResponse: responseContent
        });
      }
    } catch (error) {
      console.error("OpenAI API error:", error);
      // More detailed error logging
      if (error.response) {
        console.error("OpenAI API error details:", {
          status: error.response.status,
          data: error.response.data
        });
      }
      res.status(500).json({ 
        message: "Failed to generate story", 
        error: error.message 
      });
    }
  });

  app.post("/api/openai/generate-character", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ message: "OpenAI API key not configured" });
      }
      
      const { prompt } = req.body;

      const characterPrompt = `
Generate a unique and compelling character concept for a Dungeons & Dragons 5th Edition game. 
${prompt ? `Additional requirements: ${prompt}` : ""}

Return your response as a JSON object with these fields:
- name: A fantasy-appropriate name for the character
- race: A D&D race (Human, Elf, Dwarf, Halfling, etc.)
- class: A D&D class (Fighter, Wizard, Rogue, etc.)
- background: A D&D background (Soldier, Sage, Criminal, etc.)
- alignment: The character's alignment (Lawful Good, Chaotic Neutral, etc.)
- personality: A brief description of personality traits
- backstory: A short paragraph about the character's history
`;

      // Import the OpenAI client from our module
      const openaiClient = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY
      });
      
      const response = await openaiClient.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        messages: [{ role: "user", content: characterPrompt }],
        response_format: { type: "json_object" },
        max_tokens: 1000,
      });

      const characterData = JSON.parse(response.choices[0].message.content);
      res.json(characterData);
    } catch (error) {
      console.error("OpenAI API error:", error);
      res.status(500).json({ message: "Failed to generate character" });
    }
  });

  app.post("/api/openai/explain-rule", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ message: "OpenAI API key not configured" });
      }
      
      const { ruleTopic } = req.body;

      const rulePrompt = `
Explain the following D&D 5e rule topic in a clear, concise way: "${ruleTopic}"

Return your response as a JSON object with these fields:
- title: The name of the rule or mechanic
- explanation: A clear explanation of how the rule works in 2-3 paragraphs
- examples: An array of 2-3 practical examples of how this rule is applied in gameplay
`;

      // Import the OpenAI client from our module
      const openaiClient = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY
      });
      
      const response = await openaiClient.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        messages: [{ role: "user", content: rulePrompt }],
        response_format: { type: "json_object" },
        max_tokens: 1000,
      });

      const ruleExplanation = JSON.parse(response.choices[0].message.content);
      res.json(ruleExplanation);
    } catch (error) {
      console.error("OpenAI API error:", error);
      res.status(500).json({ message: "Failed to explain rule" });
    }
  });

  // Get dice roll history
  app.get("/api/dice/history", async (req, res) => {
    try {
      // Default user ID for demo
      const userId = 1;
      // Get the last 20 dice rolls
      const history = await storage.getDiceRollHistory(userId, 20);
      res.json(history);
    } catch (error) {
      console.error("Failed to retrieve dice roll history:", error);
      res.status(500).json({ message: "Failed to retrieve dice roll history" });
    }
  });
  
  // Archive a campaign
  app.post("/api/campaigns/:campaignId/archive", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Only campaign owner can archive
      if (campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to archive this campaign" });
      }
      
      const archivedCampaign = await storage.archiveCampaign(campaignId);
      res.json(archivedCampaign);
    } catch (error) {
      console.error("Error archiving campaign:", error);
      res.status(500).json({ message: "Failed to archive campaign" });
    }
  });
  
  // Restore a campaign from archive
  app.post("/api/campaigns/:campaignId/restore", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Only campaign owner can restore
      if (campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to restore this campaign" });
      }
      
      // Update campaign to remove archive flag
      const restoredCampaign = await storage.updateCampaign(campaignId, { 
        isArchived: false,
        updatedAt: new Date().toISOString()
      });
      
      res.json(restoredCampaign);
    } catch (error) {
      console.error("Error restoring campaign:", error);
      res.status(500).json({ message: "Failed to restore campaign" });
    }
  });
  
  // Mark a campaign as complete
  app.post("/api/campaigns/:campaignId/complete", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Only campaign owner can complete
      if (campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to complete this campaign" });
      }
      
      const completedCampaign = await storage.completeCampaign(campaignId);
      
      // Mark world location/region as completed for all participants
      if (completedCampaign) {
        const participants = await storage.getCampaignParticipants(campaignId);
        for (const participant of participants) {
          if (completedCampaign.worldLocationId) {
            await storage.completeLocation(participant.userId, completedCampaign.worldLocationId);
          }
          if (completedCampaign.worldRegionId) {
            // Update region progress but don't mark complete (regions need multiple locations)
            await storage.updateUserWorldProgress(participant.userId, completedCampaign.worldRegionId, null, {
              hasVisited: true,
              lastVisitedAt: new Date().toISOString()
            });
          }
        }
      }
      
      res.json(completedCampaign);
    } catch (error) {
      console.error("Error completing campaign:", error);
      res.status(500).json({ message: "Failed to complete campaign" });
    }
  });

  // Multi-user Campaign Management API
  
  // Get all participants in a campaign
  app.get("/api/campaigns/:campaignId/participants", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    
    try {
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Check if user is authorized to view this campaign
      const participant = await storage.getCampaignParticipant(campaignId, req.user.id);
      if (!participant && campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to view this campaign's participants" });
      }
      
      const participants = await storage.getCampaignParticipants(campaignId);
      
      // Get character details for each participant
      const participantsWithCharacters = await Promise.all(
        participants.map(async (p) => {
          const character = await storage.getCharacter(p.characterId);
          const user = await storage.getUser(p.userId);
          return {
            ...p,
            character: character,
            username: user ? user.username : 'Unknown',
            displayName: user ? user.displayName : null
          };
        })
      );
      
      // Get NPC companions in this campaign
      const campaignNpcs = await storage.getCampaignNpcs(campaignId);
      
      // Get full NPC data for each campaign NPC
      const npcsWithDetails = await Promise.all(
        campaignNpcs.map(async (campaignNpc) => {
          const npc = await storage.getNpc(campaignNpc.npcId);
          return {
            ...campaignNpc,
            isNpc: true,
            npc: npc,
            // Match the structure of participants for the frontend
            character: {
              id: npc.id,
              name: npc.name,
              race: npc.race,
              class: npc.occupation,
              level: npc.level || 1,
              portraitUrl: npc.portraitUrl
            }
          };
        })
      );
      
      // Combine participants and NPCs
      const allParticipants = [...participantsWithCharacters, ...npcsWithDetails];
      
      res.json(allParticipants);
    } catch (error) {
      console.error("Failed to get campaign participants:", error);
      res.status(500).json({ message: "Failed to get campaign participants" });
    }
  });
  
  // Add a participant to a campaign
  app.post("/api/campaigns/:campaignId/participants", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    
    try {
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Users can either join themselves or the DM can add others
      const targetUserId = req.body.userId || req.user.id;
      
      // If adding someone else, must be campaign owner
      if (targetUserId !== req.user.id && campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the campaign owner can add other participants" });
      }
      
      const participantData = req.body;
      const validationSchema = insertCampaignParticipantSchema.extend({
        userId: z.number(),
        characterId: z.number(),
      });
      
      const validatedData = validationSchema.parse({
        ...participantData,
        campaignId,
        joinedAt: new Date().toISOString()
      });
      
      // Check if user and character exist
      const user = await storage.getUser(validatedData.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const character = await storage.getCharacter(validatedData.characterId);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      // Check if participant already exists
      const existingParticipant = await storage.getCampaignParticipant(campaignId, validatedData.userId);
      if (existingParticipant) {
        return res.status(400).json({ message: "User is already a participant in this campaign" });
      }
      
      const participant = await storage.addCampaignParticipant(validatedData);
      
      // Notify via WebSocket
      broadcastMessage('participant_added', {
        campaignId,
        participant: {
          ...participant,
          username: user.username,
          displayName: user.displayName
        }
      });
      
      res.status(201).json(participant);
    } catch (error) {
      console.error("Failed to add campaign participant:", error);
      
      if (error.name === 'ZodError') {
        res.status(400).json({ message: "Invalid participant data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to add campaign participant" });
      }
    }
  });
  
  // Remove a participant from a campaign
  app.delete("/api/campaigns/:campaignId/participants/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    
    try {
      const campaignId = parseInt(req.params.campaignId);
      const userId = parseInt(req.params.userId);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Only campaign owner or the participant themselves can remove
      if (campaign.userId !== req.user.id && userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to remove this participant" });
      }
      
      const removed = await storage.removeCampaignParticipant(campaignId, userId);
      
      if (!removed) {
        return res.status(404).json({ message: "Participant not found" });
      }
      
      // Notify via WebSocket
      broadcastMessage('participant_removed', {
        campaignId,
        userId
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to remove campaign participant:", error);
      res.status(500).json({ message: "Failed to remove campaign participant" });
    }
  });
  
  // Turn-based gameplay endpoints
  
  // Get current turn info
  app.get("/api/campaigns/:campaignId/turn", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    
    try {
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Check if user is a participant
      const participant = await storage.getCampaignParticipant(campaignId, req.user.id);
      if (!participant && campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to view this campaign's turn information" });
      }
      
      // If campaign is not turn-based, return error
      if (!campaign.isTurnBased) {
        return res.status(400).json({ message: "This campaign is not turn-based" });
      }
      
      const turnInfo = await storage.getCurrentTurn(campaignId);
      
      if (!turnInfo) {
        return res.json({ active: false });
      }
      
      // Get additional info about the current player
      const currentUser = await storage.getUser(turnInfo.userId);
      const currentParticipant = await storage.getCampaignParticipant(campaignId, turnInfo.userId);
      
      res.json({
        active: true,
        userId: turnInfo.userId,
        username: currentUser ? currentUser.username : 'Unknown',
        displayName: currentUser ? currentUser.displayName : null,
        startedAt: turnInfo.startedAt,
        // Include time remaining if there's a time limit
        timeLimit: campaign.turnTimeLimit,
        isYourTurn: turnInfo.userId === req.user.id
      });
    } catch (error) {
      console.error("Failed to get turn information:", error);
      res.status(500).json({ message: "Failed to get turn information" });
    }
  });
  
  // Start next turn
  app.post("/api/campaigns/:campaignId/turn/next", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    
    try {
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Only campaign owner or current player can end their turn
      const currentTurn = await storage.getCurrentTurn(campaignId);
      if (campaign.userId !== req.user.id && 
          (!currentTurn || currentTurn.userId !== req.user.id)) {
        return res.status(403).json({ message: "Not authorized to change turns" });
      }
      
      // If campaign is not turn-based, return error
      if (!campaign.isTurnBased) {
        return res.status(400).json({ message: "This campaign is not turn-based" });
      }
      
      const nextTurn = await storage.startNextTurn(campaignId);
      
      if (!nextTurn) {
        return res.status(500).json({ message: "Failed to start next turn" });
      }
      
      // Get additional info about the next player
      const nextUser = await storage.getUser(nextTurn.userId);
      
      const turnInfo = {
        userId: nextTurn.userId,
        username: nextUser ? nextUser.username : 'Unknown',
        displayName: nextUser ? nextUser.displayName : null,
        startedAt: nextTurn.startedAt
      };
      
      // Notify via WebSocket
      broadcastMessage('turn_changed', {
        campaignId,
        ...turnInfo
      });
      
      res.json(turnInfo);
    } catch (error) {
      console.error("Failed to start next turn:", error);
      res.status(500).json({ message: "Failed to start next turn" });
    }
  });
  
  // End current turn without starting a new one
  app.post("/api/campaigns/:campaignId/turn/end", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    
    try {
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Only campaign owner or current player can end their turn
      const currentTurn = await storage.getCurrentTurn(campaignId);
      if (campaign.userId !== req.user.id && 
          (!currentTurn || currentTurn.userId !== req.user.id)) {
        return res.status(403).json({ message: "Not authorized to end the current turn" });
      }
      
      // If campaign is not turn-based, return error
      if (!campaign.isTurnBased) {
        return res.status(400).json({ message: "This campaign is not turn-based" });
      }
      
      const success = await storage.endCurrentTurn(campaignId);
      
      if (!success) {
        return res.status(500).json({ message: "Failed to end current turn" });
      }
      
      // Notify via WebSocket
      broadcastMessage('turn_ended', {
        campaignId
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to end current turn:", error);
      res.status(500).json({ message: "Failed to end current turn" });
    }
  });
  
  // Convert a campaign to turn-based or back to real-time
  // NPC Companions API Routes
  
  // Get all NPCs
  app.get("/api/npcs", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const npcs = await storage.getAllNpcs();
      res.json(npcs);
    } catch (error) {
      console.error("Failed to fetch NPCs:", error);
      res.status(500).json({ message: "Failed to fetch NPCs" });
    }
  });
  
  // Get NPCs belonging to a user
  app.get("/api/npcs/user", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = req.user.id;
      const npcs = await storage.getUserNpcs(userId);
      res.json(npcs);
    } catch (error) {
      console.error("Failed to fetch user NPCs:", error);
      res.status(500).json({ message: "Failed to fetch user NPCs" });
    }
  });
  
  // Get NPC companions belonging to a user
  app.get("/api/npcs/companions", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = req.user.id;
      const companionNpcs = await storage.getCompanionNpcs(userId);
      res.json(companionNpcs);
    } catch (error) {
      console.error("Failed to fetch companion NPCs:", error);
      res.status(500).json({ message: "Failed to fetch companion NPCs" });
    }
  });
  
  // Get stock (pre-made) companion NPCs
  app.get("/api/npcs/stock-companions", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Check if stock companions exist, if not create them
      const stockNpcsCheck = await db.select().from(npcs).where(eq(npcs.isStockCompanion, true));
      if (stockNpcsCheck.length === 0) {
        console.log("No stock companions found, creating them now...");
        await storage.createStockCompanions();
      }
      
      // Use a storage method to get stock companions
      const allNpcs = await storage.getAllNpcs();
      
      // Filter to get only stock companions
      const stockCompanionsOnly = allNpcs.filter(npc => npc.isStockCompanion === true);
      
      console.log(`Returning ${stockCompanionsOnly.length} stock companions`);
      res.json(stockCompanionsOnly);
    } catch (error) {
      console.error("Failed to fetch stock companion NPCs:", error);
      res.status(500).json({ message: "Failed to fetch stock companion NPCs" });
    }
  });
  
  // Get a specific NPC by ID
  app.get("/api/npcs/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const id = parseInt(req.params.id);
      const npc = await storage.getNpc(id);
      
      if (!npc) {
        return res.status(404).json({ message: "NPC not found" });
      }
      
      res.json(npc);
    } catch (error) {
      console.error("Failed to fetch NPC:", error);
      res.status(500).json({ message: "Failed to fetch NPC" });
    }
  });
  
  // Create a new NPC
  app.post("/api/npcs", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const npcData = insertNpcSchema.parse({
        ...req.body,
        createdBy: req.user.id,
        createdAt: new Date().toISOString()
      });
      
      const npc = await storage.createNpc(npcData);
      res.status(201).json(npc);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid NPC data", errors: error.errors });
      } else {
        console.error("Failed to create NPC:", error);
        res.status(500).json({ message: "Failed to create NPC" });
      }
    }
  });
  
  // Update an NPC
  app.put("/api/npcs/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const id = parseInt(req.params.id);
      const npc = await storage.getNpc(id);
      
      if (!npc) {
        return res.status(404).json({ message: "NPC not found" });
      }
      
      // Make sure the user can only update their own NPCs
      if (npc.createdBy !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to update this NPC" });
      }
      
      const updatedNpc = await storage.updateNpc(id, {
        ...req.body,
        updatedAt: new Date().toISOString()
      });
      
      res.json(updatedNpc);
    } catch (error) {
      console.error("Failed to update NPC:", error);
      res.status(500).json({ message: "Failed to update NPC" });
    }
  });
  
  // Delete an NPC
  app.delete("/api/npcs/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const id = parseInt(req.params.id);
      const npc = await storage.getNpc(id);
      
      if (!npc) {
        return res.status(404).json({ message: "NPC not found" });
      }
      
      // Make sure the user can only delete their own NPCs
      if (npc.createdBy !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to delete this NPC" });
      }
      
      const deleted = await storage.deleteNpc(id);
      
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(500).json({ message: "Failed to delete NPC" });
      }
    } catch (error) {
      console.error("Failed to delete NPC:", error);
      res.status(500).json({ message: "Failed to delete NPC" });
    }
  });
  
  // NPC Inventory Management Routes
  
  // Get NPC inventory
  app.get("/api/npcs/:id/inventory", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const npc = await storage.getNpc(id);
      
      if (!npc) {
        return res.status(404).json({ message: "NPC not found" });
      }
      
      res.json({
        npcId: id,
        items: npc.equipment || [],
        consumables: npc.consumables || [],
        gold: npc.gold || 0,
        equippedWeapon: npc.equippedWeapon,
        equippedArmor: npc.equippedArmor,
        equippedShield: npc.equippedShield,
        equippedAccessory: npc.equippedAccessory
      });
    } catch (error: any) {
      console.error("Error fetching NPC inventory:", error);
      res.status(500).json({ message: "Failed to fetch NPC inventory" });
    }
  });
  
  // Add item to NPC inventory
  app.post("/api/npcs/:id/inventory/add", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { item } = req.body;
      
      if (!item) {
        return res.status(400).json({ message: "Item name is required" });
      }
      
      const npc = await storage.getNpc(id);
      if (!npc) {
        return res.status(404).json({ message: "NPC not found" });
      }
      
      const currentEquipment = npc.equipment || [];
      const updatedEquipment = [...currentEquipment, item];
      
      const updatedNpc = await storage.updateNpc(id, {
        equipment: updatedEquipment,
        updatedAt: new Date().toISOString()
      });
      
      res.json({
        npc: updatedNpc,
        message: `Added ${item} to inventory.`
      });
    } catch (error: any) {
      console.error("Error adding item to NPC:", error);
      res.status(500).json({ message: "Failed to add item" });
    }
  });
  
  // Remove item from NPC inventory
  app.post("/api/npcs/:id/inventory/remove", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { item } = req.body;
      
      if (!item) {
        return res.status(400).json({ message: "Item name is required" });
      }
      
      const npc = await storage.getNpc(id);
      if (!npc) {
        return res.status(404).json({ message: "NPC not found" });
      }
      
      const currentEquipment = npc.equipment || [];
      const itemIndex = currentEquipment.indexOf(item);
      
      if (itemIndex === -1) {
        return res.status(404).json({ message: "Item not found in inventory" });
      }
      
      const updatedEquipment = currentEquipment.filter((_, i) => i !== itemIndex);
      
      const updatedNpc = await storage.updateNpc(id, {
        equipment: updatedEquipment,
        updatedAt: new Date().toISOString()
      });
      
      res.json({
        npc: updatedNpc,
        message: `Removed ${item} from inventory.`
      });
    } catch (error: any) {
      console.error("Error removing item from NPC:", error);
      res.status(500).json({ message: "Failed to remove item" });
    }
  });
  
  // Equip item for NPC
  app.post("/api/npcs/:id/equip", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { item, slot } = req.body;
      
      if (!item || !slot) {
        return res.status(400).json({ message: "Item and slot are required" });
      }
      
      const validSlots = ["weapon", "armor", "shield", "accessory"];
      if (!validSlots.includes(slot)) {
        return res.status(400).json({ message: "Invalid slot. Valid slots: weapon, armor, shield, accessory" });
      }
      
      const npc = await storage.getNpc(id);
      if (!npc) {
        return res.status(404).json({ message: "NPC not found" });
      }
      
      const slotFieldMap: Record<string, string> = {
        weapon: "equippedWeapon",
        armor: "equippedArmor",
        shield: "equippedShield",
        accessory: "equippedAccessory"
      };
      
      const updateData: any = {
        [slotFieldMap[slot]]: item,
        updatedAt: new Date().toISOString()
      };
      
      const updatedNpc = await storage.updateNpc(id, updateData);
      
      res.json({
        npc: updatedNpc,
        message: `Equipped ${item} to ${slot} slot`
      });
    } catch (error: any) {
      console.error("Error equipping item for NPC:", error);
      res.status(500).json({ message: "Failed to equip item" });
    }
  });
  
  // Unequip item from NPC
  app.post("/api/npcs/:id/unequip", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { slot } = req.body;
      
      if (!slot) {
        return res.status(400).json({ message: "Slot is required" });
      }
      
      const validSlots = ["weapon", "armor", "shield", "accessory"];
      if (!validSlots.includes(slot)) {
        return res.status(400).json({ message: "Invalid slot. Valid slots: weapon, armor, shield, accessory" });
      }
      
      const npc = await storage.getNpc(id);
      if (!npc) {
        return res.status(404).json({ message: "NPC not found" });
      }
      
      const slotFieldMap: Record<string, keyof typeof npc> = {
        weapon: "equippedWeapon",
        armor: "equippedArmor",
        shield: "equippedShield",
        accessory: "equippedAccessory"
      };
      
      const currentItem = npc[slotFieldMap[slot]];
      if (!currentItem) {
        return res.status(400).json({ message: `Nothing equipped in ${slot} slot` });
      }
      
      const updateData: any = {
        [slotFieldMap[slot]]: null,
        updatedAt: new Date().toISOString()
      };
      
      const updatedNpc = await storage.updateNpc(id, updateData);
      
      res.json({
        npc: updatedNpc,
        message: `Unequipped ${currentItem} from ${slot} slot`
      });
    } catch (error: any) {
      console.error("Error unequipping item from NPC:", error);
      res.status(500).json({ message: "Failed to unequip item" });
    }
  });
  
  // Update NPC gold
  app.post("/api/npcs/:id/gold", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { amount, operation } = req.body;
      
      if (typeof amount !== 'number') {
        return res.status(400).json({ message: "Amount is required and must be a number" });
      }
      
      const npc = await storage.getNpc(id);
      if (!npc) {
        return res.status(404).json({ message: "NPC not found" });
      }
      
      let newGold = npc.gold || 0;
      if (operation === 'add') {
        newGold += amount;
      } else if (operation === 'subtract') {
        newGold = Math.max(0, newGold - amount);
      } else {
        newGold = amount;
      }
      
      const updatedNpc = await storage.updateNpc(id, {
        gold: newGold,
        updatedAt: new Date().toISOString()
      });
      
      res.json({
        npc: updatedNpc,
        message: operation === 'add' ? `Added ${amount} gold` : operation === 'subtract' ? `Removed ${amount} gold` : `Set gold to ${amount}`
      });
    } catch (error: any) {
      console.error("Error updating NPC gold:", error);
      res.status(500).json({ message: "Failed to update gold" });
    }
  });
  
  // Campaign NPC Routes
  
  // Get NPCs in a campaign
  app.get("/api/campaigns/:campaignId/npcs", async (req, res) => {
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
      
      // Check if user is a participant in this campaign
      const participants = await storage.getCampaignParticipants(campaignId);
      const isParticipant = participants.some(p => p.userId === req.user.id) || campaign.userId === req.user.id;
      
      if (!isParticipant) {
        return res.status(403).json({ message: "Not authorized to view NPCs in this campaign" });
      }
      
      const campaignNpcs = await storage.getCampaignNpcs(campaignId);
      
      // Get full NPC data for each campaign NPC
      const npcsWithDetails = await Promise.all(
        campaignNpcs.map(async (campaignNpc) => {
          const npc = await storage.getNpc(campaignNpc.npcId);
          return {
            ...campaignNpc,
            npc
          };
        })
      );
      
      res.json(npcsWithDetails);
    } catch (error) {
      console.error("Failed to fetch campaign NPCs:", error);
      res.status(500).json({ message: "Failed to fetch campaign NPCs" });
    }
  });
  
  // Add an NPC to a campaign
  app.post("/api/campaigns/:campaignId/npcs", async (req, res) => {
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
      
      // Only DM can add NPCs to the campaign
      if (campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the DM can add NPCs to this campaign" });
      }
      
      // Get the NPC to check if it exists and belongs to the user
      const npcId = req.body.npcId;
      const npc = await storage.getNpc(npcId);
      
      if (!npc) {
        return res.status(404).json({ message: "NPC not found" });
      }
      
      // Check if NPC is already in the campaign
      const existingCampaignNpc = await storage.getCampaignNpc(campaignId, npcId);
      if (existingCampaignNpc) {
        return res.status(400).json({ message: "NPC is already in this campaign" });
      }
      
      const campaignNpcData = insertCampaignNpcSchema.parse({
        campaignId,
        npcId,
        role: req.body.role || 'companion',
        turnOrder: req.body.turnOrder,
        isActive: true,
        joinedAt: new Date().toISOString()
      });
      
      const campaignNpc = await storage.addNpcToCampaign(campaignNpcData);
      
      // Get full NPC data to return
      const npcWithDetails = {
        ...campaignNpc,
        npc
      };
      
      res.status(201).json(npcWithDetails);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid campaign NPC data", errors: error.errors });
      } else {
        console.error("Failed to add NPC to campaign:", error);
        res.status(500).json({ message: "Failed to add NPC to campaign" });
      }
    }
  });
  
  // Remove an NPC from a campaign
  app.delete("/api/campaigns/:campaignId/npcs/:npcId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const npcId = parseInt(req.params.npcId);
      
      // Get the campaign to check authorization
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Only DM can remove NPCs from the campaign
      if (campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the DM can remove NPCs from this campaign" });
      }
      
      const removed = await storage.removeNpcFromCampaign(campaignId, npcId);
      
      if (removed) {
        res.status(204).send();
      } else {
        res.status(404).json({ message: "NPC not found in this campaign" });
      }
    } catch (error) {
      console.error("Failed to remove NPC from campaign:", error);
      res.status(500).json({ message: "Failed to remove NPC from campaign" });
    }
  });
  
  // Simulate NPC turn in a campaign
  app.post("/api/campaigns/:campaignId/npcs/:npcId/simulate-turn", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const npcId = parseInt(req.params.npcId);
      
      // Get the campaign to check authorization
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Only DM can simulate NPC turns
      if (campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the DM can simulate NPC turns" });
      }
      
      // Check if NPC is in the campaign
      const campaignNpc = await storage.getCampaignNpc(campaignId, npcId);
      if (!campaignNpc) {
        return res.status(404).json({ message: "NPC not found in this campaign" });
      }
      
      // Simulate the NPC's turn
      const turnResult = await storage.simulateNpcTurn(campaignId, npcId);
      
      // Broadcast the turn action to all connected clients via WebSocket
      broadcastMessage('npc_action', {
        campaignId,
        npcId,
        action: turnResult.action,
        details: turnResult.details,
        message: turnResult.message
      });
      
      res.json(turnResult);
    } catch (error) {
      console.error("Failed to simulate NPC turn:", error);
      res.status(500).json({ message: "Failed to simulate NPC turn" });
    }
  });

  // ==================== Campaign Dungeon Map Routes ====================
  
  // Get active dungeon map for a campaign
  app.get("/api/campaigns/:campaignId/dungeon-map", async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const map = await storage.getCampaignDungeonMap(campaignId);
      if (!map) {
        return res.status(404).json({ message: "No active dungeon map found" });
      }
      res.json(map);
    } catch (error) {
      console.error("Error fetching dungeon map:", error);
      res.status(500).json({ message: "Failed to fetch dungeon map" });
    }
  });
  
  // Get all dungeon maps for a campaign
  app.get("/api/campaigns/:campaignId/dungeon-maps", async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const maps = await storage.getCampaignDungeonMaps(campaignId);
      res.json(maps);
    } catch (error) {
      console.error("Error fetching dungeon maps:", error);
      res.status(500).json({ message: "Failed to fetch dungeon maps" });
    }
  });
  
  // Create a new dungeon map for a campaign
  app.post("/api/campaigns/:campaignId/dungeon-map", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const { mapName, mapData, playerPosition } = req.body;
      
      const map = await storage.createCampaignDungeonMap({
        campaignId,
        mapName: mapName || "Dungeon",
        mapData,
        playerPosition: playerPosition || { x: 0, y: 0 },
        exploredTiles: [],
        entityPositions: [],
        fogOfWar: {},
        discoveredSecrets: [],
        lootedChests: [],
        isActive: true,
        createdAt: new Date().toISOString()
      });
      
      res.status(201).json(map);
    } catch (error) {
      console.error("Error creating dungeon map:", error);
      res.status(500).json({ message: "Failed to create dungeon map" });
    }
  });
  
  // Update dungeon map (player movement, exploration, etc.)
  app.patch("/api/campaigns/:campaignId/dungeon-map/:mapId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const mapId = parseInt(req.params.mapId);
      const updates = req.body;
      
      const updatedMap = await storage.updateCampaignDungeonMap(mapId, updates);
      if (!updatedMap) {
        return res.status(404).json({ message: "Dungeon map not found" });
      }
      
      res.json(updatedMap);
    } catch (error) {
      console.error("Error updating dungeon map:", error);
      res.status(500).json({ message: "Failed to update dungeon map" });
    }
  });
  
  // Delete dungeon map
  app.delete("/api/campaigns/:campaignId/dungeon-map/:mapId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const mapId = parseInt(req.params.mapId);
      await storage.deleteCampaignDungeonMap(mapId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting dungeon map:", error);
      res.status(500).json({ message: "Failed to delete dungeon map" });
    }
  });
  
  // Move player on dungeon map (turn-based, generates narrative)
  app.post("/api/campaigns/:campaignId/dungeon-move", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const { direction, mapId, currentPosition, newPosition, tileType, nearbyEntities } = req.body;
      
      // Get campaign and verify user is a participant
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      const participants = await storage.getCampaignParticipants(campaignId);
      const userParticipant = participants.find(p => p.userId === req.user.id);
      
      if (campaign.userId !== req.user.id && !userParticipant) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Get current session to check story state
      const currentSessionNumber = campaign.currentSession || 1;
      const session = await storage.getCampaignSession(campaignId, currentSessionNumber);
      
      let storyState: any = {};
      if (session?.storyState) {
        try {
          storyState = typeof session.storyState === 'string' 
            ? JSON.parse(session.storyState) 
            : session.storyState;
        } catch (e) {
          storyState = {};
        }
      }
      
      // Check if there's a pending encounter that must be resolved
      if (storyState.pendingEncounter && !storyState.pendingEncounter.resolved) {
        return res.status(400).json({ 
          message: "You must resolve the current encounter before moving",
          pendingEncounter: storyState.pendingEncounter
        });
      }
      
      // Narrative-Map Tie-in: Limit exploration radius based on story progression
      const explorationLimit = storyState.explorationLimit || 5; // Default 5 tiles from start
      const startPosition = storyState.startPosition || { x: 4, y: 4 };
      const distanceFromStart = Math.abs(newPosition.x - startPosition.x) + Math.abs(newPosition.y - startPosition.y);
      
      if (distanceFromStart > explorationLimit) {
        return res.status(400).json({
          message: "You've reached the edge of the explored area. Advance the story to unlock more of the dungeon.",
          narrativeRequired: true,
          explorationLimit,
          distanceFromStart
        });
      }
      
      // Track consecutive moves without narrative to force story progression
      const movesWithoutStory = (storyState.movesWithoutStory || 0) + 1;
      const maxMovesWithoutStory = 6; // Force narrative after 6 moves
      
      let forceNarrativeEvent = movesWithoutStory >= maxMovesWithoutStory;
      
      // Generate narrative based on movement context
      const tileDescriptions: Record<string, string> = {
        floor: "an empty stone corridor",
        door: "through a creaking wooden door",
        trap: "a suspicious-looking section of floor",
        treasure: "a glittering treasure chest",
        stairs_up: "stairs leading upward",
        stairs_down: "stairs descending into darkness",
        water: "shallow water pooling on the floor",
        lava: "the heat of nearby lava",
        pit: "a deep pit in the floor",
        secret_door: "a hidden passage"
      };
      
      const tileDesc = tileDescriptions[tileType] || "an unknown area";
      const hasEnemies = nearbyEntities && nearbyEntities.some((e: any) => e.type === 'enemy' || e.type === 'boss');
      
      let narrativePrompt = `The party moves ${direction} to (${newPosition.x}, ${newPosition.y}), entering ${tileDesc}.`;
      let encounterTriggered = false;
      let encounterData: any = null;
      
      // Check for special tile interactions that require choices
      if (tileType === 'trap') {
        encounterTriggered = true;
        encounterData = {
          type: 'trap',
          description: 'A hidden trap springs to life as you step on a pressure plate!',
          choices: [
            { id: 'dodge', text: 'Attempt to dodge (Dexterity save DC 14)', rollRequired: { type: 'd20', skill: 'dexterity' } },
            { id: 'disarm', text: 'Try to disarm it (Thieves\' Tools DC 15)', rollRequired: { type: 'd20', skill: 'thieves_tools' } },
            { id: 'take_hit', text: 'Brace for impact', rollRequired: null }
          ],
          resolved: false
        };
      } else if (tileType === 'treasure') {
        encounterTriggered = true;
        encounterData = {
          type: 'treasure',
          description: 'You discover an ornate chest covered in dust. It might be trapped, or it could contain valuable loot.',
          choices: [
            { id: 'search', text: 'Search for traps (Investigation DC 12)', rollRequired: { type: 'd20', skill: 'investigation' } },
            { id: 'open', text: 'Open it immediately', rollRequired: null },
            { id: 'leave', text: 'Leave it alone', rollRequired: null }
          ],
          resolved: false
        };
      } else if (hasEnemies) {
        const enemyNames = nearbyEntities.filter((e: any) => e.type === 'enemy' || e.type === 'boss').map((e: any) => e.name);
        encounterTriggered = true;
        encounterData = {
          type: 'combat',
          description: `${enemyNames.join(' and ')} blocks your path! Combat is imminent.`,
          enemies: nearbyEntities.filter((e: any) => e.type === 'enemy' || e.type === 'boss'),
          choices: [
            { id: 'attack', text: 'Attack!', rollRequired: { type: 'd20', skill: 'attack' } },
            { id: 'stealth', text: 'Try to sneak past (Stealth DC 13)', rollRequired: { type: 'd20', skill: 'stealth' } },
            { id: 'diplomacy', text: 'Attempt to negotiate (Persuasion DC 15)', rollRequired: { type: 'd20', skill: 'persuasion' } },
            { id: 'flee', text: 'Run back the way you came', rollRequired: null }
          ],
          resolved: false
        };
      }
      
      // Random puzzle encounter chance (if no other encounter triggered)
      // Triggers ~15% of the time on non-special tiles to vary gameplay
      if (!encounterTriggered && Math.random() < 0.15) {
        const puzzleTypes = [
          {
            description: 'Ancient runes glow on the wall, forming a cryptic riddle. The answer may unlock hidden secrets.',
            choices: [
              { id: 'solve', text: 'Attempt to solve the riddle (Intelligence DC 14)', rollRequired: { type: 'd20', skill: 'intelligence' } },
              { id: 'arcana', text: 'Use arcane knowledge (Arcana DC 12)', rollRequired: { type: 'd20', skill: 'arcana' } },
              { id: 'skip', text: 'Move on without solving', rollRequired: null }
            ]
          },
          {
            description: 'A locked mechanism blocks your path. Gears and levers must be arranged correctly.',
            choices: [
              { id: 'investigate', text: 'Study the mechanism (Investigation DC 13)', rollRequired: { type: 'd20', skill: 'investigation' } },
              { id: 'force', text: 'Try to force it open (Strength DC 16)', rollRequired: { type: 'd20', skill: 'strength' } },
              { id: 'bypass', text: 'Find another way around', rollRequired: null }
            ]
          },
          {
            description: 'A magical barrier shimmers before you. Words of power are inscribed nearby.',
            choices: [
              { id: 'dispel', text: 'Attempt to dispel it (Arcana DC 15)', rollRequired: { type: 'd20', skill: 'arcana' } },
              { id: 'read', text: 'Read the inscription (History DC 12)', rollRequired: { type: 'd20', skill: 'history' } },
              { id: 'wait', text: 'Study the barrier pattern', rollRequired: null }
            ]
          },
          {
            description: 'Pressure plates form a pattern on the floor. One wrong step could trigger disaster.',
            choices: [
              { id: 'perception', text: 'Study the safe path (Perception DC 14)', rollRequired: { type: 'd20', skill: 'perception' } },
              { id: 'acrobatics', text: 'Leap across carefully (Acrobatics DC 13)', rollRequired: { type: 'd20', skill: 'acrobatics' } },
              { id: 'trigger', text: 'Trigger them deliberately from afar', rollRequired: null }
            ]
          }
        ];
        const puzzle = puzzleTypes[Math.floor(Math.random() * puzzleTypes.length)];
        encounterTriggered = true;
        encounterData = {
          type: 'puzzle',
          description: puzzle.description,
          choices: puzzle.choices,
          resolved: false
        };
      }
      
      // Social encounter chance (10% - adds variety with NPC interactions)
      if (!encounterTriggered && Math.random() < 0.10) {
        const socialEncounters = [
          {
            description: 'A weary traveler sits by a small fire, offering to share information about the dangers ahead.',
            choices: [
              { id: 'persuade', text: 'Convince them to share their knowledge (Persuasion DC 12)', rollRequired: { type: 'd20', skill: 'persuasion' } },
              { id: 'intimidate', text: 'Demand they tell you everything (Intimidation DC 14)', rollRequired: { type: 'd20', skill: 'intimidation' } },
              { id: 'share', text: 'Share your own supplies and stories', rollRequired: null }
            ]
          },
          {
            description: 'A mysterious merchant has set up a small stall in an alcove, dealing in unusual wares.',
            choices: [
              { id: 'insight', text: 'Sense their true intentions (Insight DC 13)', rollRequired: { type: 'd20', skill: 'insight' } },
              { id: 'deception', text: 'Pretend to be a fellow merchant (Deception DC 14)', rollRequired: { type: 'd20', skill: 'deception' } },
              { id: 'browse', text: 'Browse their wares peacefully', rollRequired: null }
            ]
          },
          {
            description: 'You encounter a group of lost adventurers arguing over which direction to go.',
            choices: [
              { id: 'diplomacy', text: 'Help mediate their dispute (Persuasion DC 11)', rollRequired: { type: 'd20', skill: 'persuasion' } },
              { id: 'guide', text: 'Offer to guide them out (Survival DC 12)', rollRequired: { type: 'd20', skill: 'survival' } },
              { id: 'observe', text: 'Watch from a distance', rollRequired: null }
            ]
          },
          {
            description: 'A sprite hovers nearby, speaking in riddles and offering a bargain for safe passage.',
            choices: [
              { id: 'arcana', text: 'Speak in the old tongue (Arcana DC 13)', rollRequired: { type: 'd20', skill: 'arcana' } },
              { id: 'performance', text: 'Entertain with a song or tale (Performance DC 12)', rollRequired: { type: 'd20', skill: 'performance' } },
              { id: 'decline', text: 'Politely decline and continue', rollRequired: null }
            ]
          }
        ];
        const social = socialEncounters[Math.floor(Math.random() * socialEncounters.length)];
        encounterTriggered = true;
        encounterData = {
          type: 'social',
          description: social.description,
          choices: social.choices,
          resolved: false
        };
      }
      
      // Exploration/Discovery encounter chance (12% - finding hidden areas, clues, lore)
      if (!encounterTriggered && Math.random() < 0.12) {
        const explorationEncounters = [
          {
            description: 'You notice loose stones in the wall that might conceal a hidden passage.',
            choices: [
              { id: 'investigate', text: 'Search for a hidden mechanism (Investigation DC 13)', rollRequired: { type: 'd20', skill: 'investigation' } },
              { id: 'perception', text: 'Listen for sounds beyond the wall (Perception DC 14)', rollRequired: { type: 'd20', skill: 'perception' } },
              { id: 'leave', text: 'Continue on your current path', rollRequired: null }
            ]
          },
          {
            description: 'Ancient murals cover the walls, depicting events that may hold clues to your quest.',
            choices: [
              { id: 'history', text: 'Study the historical significance (History DC 12)', rollRequired: { type: 'd20', skill: 'history' } },
              { id: 'religion', text: 'Interpret the religious symbolism (Religion DC 13)', rollRequired: { type: 'd20', skill: 'religion' } },
              { id: 'sketch', text: 'Make a quick sketch for later', rollRequired: null }
            ]
          },
          {
            description: 'A faint magical aura emanates from somewhere nearby, barely perceptible.',
            choices: [
              { id: 'arcana', text: 'Trace the source of magic (Arcana DC 14)', rollRequired: { type: 'd20', skill: 'arcana' } },
              { id: 'nature', text: 'Sense if it is natural magic (Nature DC 12)', rollRequired: { type: 'd20', skill: 'nature' } },
              { id: 'ignore', text: 'Proceed cautiously', rollRequired: null }
            ]
          },
          {
            description: 'Old journals and maps are scattered across a dusty table, left by previous explorers.',
            choices: [
              { id: 'investigation', text: 'Search for useful information (Investigation DC 11)', rollRequired: { type: 'd20', skill: 'investigation' } },
              { id: 'survival', text: 'Check for signs of what happened here (Survival DC 13)', rollRequired: { type: 'd20', skill: 'survival' } },
              { id: 'take', text: 'Gather the documents for later', rollRequired: null }
            ]
          }
        ];
        const exploration = explorationEncounters[Math.floor(Math.random() * explorationEncounters.length)];
        encounterTriggered = true;
        encounterData = {
          type: 'exploration',
          description: exploration.description,
          choices: exploration.choices,
          resolved: false
        };
      }
      
      // Update dungeon map position
      if (mapId) {
        await storage.updateCampaignDungeonMap(mapId, {
          playerPosition: newPosition,
          mapData: req.body.mapData
        });
      }
      
      // Every 3 moves without an encounter, generate a minor narrative event
      let narrativeEvent = null;
      const movesSinceEvent = (storyState.movementsSinceLastEvent || 0) + 1;
      
      if (!encounterTriggered && movesSinceEvent >= 3) {
        const minorEvents = [
          "You hear distant echoes deeper in the dungeon.",
          "A cold draft suggests hidden passages nearby.",
          "Ancient runes on the wall catch your eye - perhaps they hold a clue.",
          "The faint smell of something cooking wafts through the corridor.",
          "You find old adventurer's marks scratched into the stone."
        ];
        narrativeEvent = minorEvents[Math.floor(Math.random() * minorEvents.length)];
      }
      
      // Create journey log entry for this movement
      const journeyEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        type: encounterTriggered ? encounterData.type : (narrativeEvent ? 'discovery' : 'movement'),
        position: newPosition,
        description: encounterTriggered 
          ? encounterData.description 
          : narrativeEvent || `Moved ${direction} to position (${newPosition.x}, ${newPosition.y}).`,
        resolved: !encounterTriggered
      };
      
      // Initialize or update adventure progress
      const { getRequirementsForDifficulty, createEmptyProgress, checkAdventureCompletion } = await import('../shared/rules/adventure');
      const difficulty = campaign.difficulty || "Normal - Balanced Challenge";
      const requirements = getRequirementsForDifficulty(difficulty);
      let adventureProgress = storyState.adventureProgress || createEmptyProgress();
      
      // Track discoveries from narrative events
      if (narrativeEvent && !encounterTriggered) {
        adventureProgress = {
          ...adventureProgress,
          discoveries: (adventureProgress.discoveries || 0) + 1
        };
      }
      
      // Update story state with pending encounter and journey log
      const existingJourneyLog = storyState.journeyLog || [];
      const hasStoryEvent = encounterTriggered || narrativeEvent || forceNarrativeEvent;
      
      const updatedStoryState = {
        ...storyState,
        lastMovement: {
          from: currentPosition,
          to: newPosition,
          direction,
          timestamp: new Date().toISOString()
        },
        pendingEncounter: encounterTriggered ? encounterData : null,
        movementsSinceLastEvent: hasStoryEvent ? 0 : movesSinceEvent,
        movesWithoutStory: hasStoryEvent ? 0 : movesWithoutStory,
        startPosition: storyState.startPosition || startPosition,
        explorationLimit: storyState.explorationLimit || explorationLimit,
        journeyLog: [...existingJourneyLog, journeyEntry].slice(-50),
        adventureProgress,
        adventureRequirements: requirements
      };
      
      // Save updated story state
      if (session) {
        await storage.updateSessionStoryState(campaignId, currentSessionNumber, updatedStoryState);
      }
      
      res.json({
        success: true,
        newPosition,
        tileType,
        encounterTriggered,
        encounter: encounterData,
        narrativeEvent,
        message: encounterTriggered 
          ? encounterData.description 
          : narrativeEvent || `You move ${direction} into ${tileDesc}.`
      });
      
    } catch (error) {
      console.error("Error processing dungeon movement:", error);
      res.status(500).json({ message: "Failed to process movement" });
    }
  });
  
  // Resolve pending dungeon encounter
  app.post("/api/campaigns/:campaignId/dungeon-resolve", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const { choiceId, rollResult } = req.body;
      
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      const currentSessionNumber = campaign.currentSession || 1;
      const session = await storage.getCampaignSession(campaignId, currentSessionNumber);
      
      let storyState: any = {};
      if (session?.storyState) {
        try {
          storyState = typeof session.storyState === 'string' 
            ? JSON.parse(session.storyState) 
            : session.storyState;
        } catch (e) {
          storyState = {};
        }
      }
      
      if (!storyState.pendingEncounter) {
        return res.status(400).json({ message: "No pending encounter to resolve" });
      }
      
      const encounter = storyState.pendingEncounter;
      const choice = encounter.choices.find((c: any) => c.id === choiceId);
      
      let outcome = { success: true, narrative: '', rewards: null as any };
      
      // Determine outcome based on choice and roll
      if (choice?.rollRequired && rollResult) {
        const dc = parseInt(choice.text.match(/DC (\d+)/)?.[1] || '10');
        outcome.success = rollResult >= dc;
        
        if (encounter.type === 'trap') {
          outcome.narrative = outcome.success 
            ? "You successfully avoid the trap's effects!"
            : "The trap catches you! Take 2d6 damage.";
        } else if (encounter.type === 'treasure') {
          if (choiceId === 'search') {
            outcome.narrative = outcome.success
              ? "You carefully search and find no traps. The chest is safe to open."
              : "You don't find any traps, but you're not entirely sure it's safe.";
          }
        } else if (encounter.type === 'combat') {
          if (choiceId === 'stealth') {
            outcome.narrative = outcome.success
              ? "You successfully sneak past the enemies unnoticed!"
              : "The enemies spot you! Roll for initiative!";
          } else if (choiceId === 'diplomacy') {
            outcome.narrative = outcome.success
              ? "Your words convince them to let you pass peacefully."
              : "They are not interested in talking. Prepare for combat!";
          }
        } else if (encounter.type === 'puzzle') {
          if (outcome.success) {
            const puzzleRewards = [
              { narrative: "The puzzle clicks into place, revealing a hidden compartment with treasure!", reward: { gold: 30, items: ['Mysterious Key'] } },
              { narrative: "The runes glow brightly and fade, granting you ancient knowledge.", reward: { xp: 50 } },
              { narrative: "The mechanism unlocks with a satisfying click. A secret passage opens!", reward: null },
              { narrative: "You solve the puzzle! The magical barrier dissipates harmlessly.", reward: { xp: 25 } }
            ];
            const reward = puzzleRewards[Math.floor(Math.random() * puzzleRewards.length)];
            outcome.narrative = reward.narrative;
            outcome.rewards = reward.reward;
          } else {
            outcome.narrative = "You struggle with the puzzle but can't quite figure it out. Perhaps you can try again later.";
          }
        } else if (encounter.type === 'social') {
          if (outcome.success) {
            const socialRewards = [
              { narrative: "The traveler shares valuable information about the dangers ahead and gives you a healing potion for your kindness.", reward: { items: ['Potion of Healing'], xp: 30 } },
              { narrative: "The merchant is impressed by your insight and offers you a discount on their finest wares.", reward: { gold: 20, xp: 25 } },
              { narrative: "You successfully mediate the dispute. The grateful adventurers share their map with you.", reward: { xp: 40 } },
              { narrative: "The sprite is delighted by your knowledge and grants you a minor blessing.", reward: { xp: 35 } }
            ];
            const reward = socialRewards[Math.floor(Math.random() * socialRewards.length)];
            outcome.narrative = reward.narrative;
            outcome.rewards = reward.reward;
          } else {
            outcome.narrative = "Your social approach doesn't quite work out, but no harm is done. The interaction ends awkwardly.";
          }
        } else if (encounter.type === 'exploration') {
          if (outcome.success) {
            const explorationRewards = [
              { narrative: "You discover a hidden passage! It leads to a small cache containing gold and an old map.", reward: { gold: 40, xp: 30 } },
              { narrative: "The murals reveal ancient secrets about this place. You gain valuable historical knowledge.", reward: { xp: 50 } },
              { narrative: "You trace the magical aura to a hidden enchanted item glowing faintly in an alcove.", reward: { items: ['Enchanted Trinket'], xp: 35 } },
              { narrative: "The journals contain detailed notes about the dungeon's layout and hidden dangers.", reward: { xp: 45 } }
            ];
            const reward = explorationRewards[Math.floor(Math.random() * explorationRewards.length)];
            outcome.narrative = reward.narrative;
            outcome.rewards = reward.reward;
          } else {
            outcome.narrative = "Your investigation doesn't reveal anything of note, but you've learned more about this place.";
          }
        }
      } else {
        // Non-roll choices
        if (choiceId === 'open' && encounter.type === 'treasure') {
          outcome.narrative = "You open the chest and find: 25 gold pieces and a potion of healing!";
          outcome.rewards = { gold: 25, items: ['Potion of Healing'] };
        } else if (choiceId === 'leave') {
          outcome.narrative = "You decide to leave it undisturbed and continue on.";
        } else if (choiceId === 'flee') {
          outcome.narrative = "You turn and flee back the way you came!";
        } else if (choiceId === 'take_hit') {
          outcome.narrative = "You brace yourself as the trap activates. Take 2d6 damage.";
        } else if (choiceId === 'attack') {
          outcome.narrative = "Combat begins! Roll for initiative.";
          outcome.success = true;
        } else if (choiceId === 'skip' && encounter.type === 'puzzle') {
          outcome.narrative = "You move on without attempting the puzzle.";
          outcome.success = false;
        } else if (choiceId === 'bypass' && encounter.type === 'puzzle') {
          outcome.narrative = "You find another way around, avoiding the puzzle entirely.";
          outcome.success = false;
        } else if (choiceId === 'wait' && encounter.type === 'puzzle') {
          outcome.narrative = "You study the barrier's pattern carefully. It seems to weaken at certain intervals...";
          outcome.success = true;
        } else if (choiceId === 'trigger' && encounter.type === 'puzzle') {
          outcome.narrative = "You throw a rock to trigger the plates from safety. The mechanism resets after the trap fires.";
          outcome.success = true;
        } else if (encounter.type === 'social') {
          // Non-roll social choices
          if (choiceId === 'share') {
            outcome.narrative = "You share your supplies and stories. The traveler appreciates your kindness and wishes you well.";
            outcome.success = true;
          } else if (choiceId === 'browse') {
            outcome.narrative = "You browse the merchant's unusual wares. Some items catch your eye for future reference.";
            outcome.success = true;
          } else if (choiceId === 'observe') {
            outcome.narrative = "You watch the adventurers from a distance. Eventually they sort out their differences and move on.";
            outcome.success = true;
          } else if (choiceId === 'decline') {
            outcome.narrative = "You politely decline the sprite's offer. It shrugs and vanishes in a puff of glitter.";
            outcome.success = true;
          }
        } else if (encounter.type === 'exploration') {
          // Non-roll exploration choices
          if (choiceId === 'leave') {
            outcome.narrative = "You decide not to investigate further and continue on your way.";
            outcome.success = true;
          } else if (choiceId === 'sketch') {
            outcome.narrative = "You make a quick sketch of the murals for later study.";
            outcome.success = true;
          } else if (choiceId === 'ignore') {
            outcome.narrative = "You proceed cautiously past the magical aura, keeping your distance.";
            outcome.success = true;
          } else if (choiceId === 'take') {
            outcome.narrative = "You gather the scattered documents. They might prove useful later.";
            outcome.success = true;
          }
        }
      }
      
      // Add resolution to journey log
      const resolutionEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        type: `${encounter.type}_resolved`,
        description: outcome.narrative,
        success: outcome.success,
        rewards: outcome.rewards,
        resolved: true
      };
      
      const existingJourneyLog = storyState.journeyLog || [];
      
      // Update adventure progress when encounter is resolved
      const { getRequirementsForDifficulty, createEmptyProgress, checkAdventureCompletion } = await import('../shared/rules/adventure');
      const difficulty = campaign.difficulty || "Normal - Balanced Challenge";
      const requirements = getRequirementsForDifficulty(difficulty);
      let adventureProgress = storyState.adventureProgress || createEmptyProgress();
      
      // Increment the appropriate encounter counter based on type
      const encounterType = encounter.type as string;
      if (encounterType === 'puzzle') {
        // Puzzles are tracked separately from encounters
        adventureProgress = {
          ...adventureProgress,
          puzzles: (adventureProgress.puzzles || 0) + 1
        };
      } else if (['combat', 'trap', 'treasure'].includes(encounterType)) {
        // Standard encounter types
        adventureProgress = {
          ...adventureProgress,
          encounters: {
            ...adventureProgress.encounters,
            [encounterType]: (adventureProgress.encounters?.[encounterType] || 0) + 1,
            total: (adventureProgress.encounters?.total || 0) + 1
          }
        };
      } else if (['social', 'exploration'].includes(encounterType)) {
        // Social and exploration encounters count as discoveries
        adventureProgress = {
          ...adventureProgress,
          discoveries: (adventureProgress.discoveries || 0) + 1
        };
      }
      
      // Check if adventure is complete
      const completionStatus = checkAdventureCompletion(adventureProgress, requirements);
      if (completionStatus.isComplete && !adventureProgress.isComplete) {
        adventureProgress.isComplete = true;
        adventureProgress.completedAt = new Date().toISOString();
      }
      
      // Mark encounter as resolved and clear it
      // Also clear combat state if this was a combat encounter
      const isCombatEncounter = encounterType === 'combat';
      const updatedStoryState = {
        ...storyState,
        pendingEncounter: null, // Clear the pending encounter so movement can continue
        inCombat: isCombatEncounter ? false : storyState.inCombat, // Clear combat flag after combat resolution
        combatants: isCombatEncounter ? [] : storyState.combatants, // Clear enemies
        lastResolvedEncounter: {
          ...encounter,
          resolved: true,
          resolution: {
            choiceId,
            rollResult,
            outcome
          }
        },
        journeyLog: [...existingJourneyLog, resolutionEntry].slice(-50),
        adventureProgress,
        adventureRequirements: requirements,
        adventureCompletion: completionStatus
      };
      
      console.log(`Encounter resolved: type=${encounterType}, progress updated:`, adventureProgress.encounters);
      
      await storage.updateSessionStoryState(campaignId, currentSessionNumber, updatedStoryState);
      
      res.json({
        success: true,
        outcome,
        canContinueMoving: true
      });
      
    } catch (error) {
      console.error("Error resolving encounter:", error);
      res.status(500).json({ message: "Failed to resolve encounter" });
    }
  });
  
  // ==================== Campaign Quest Routes ====================
  
  // Get all quests for a campaign
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
      const { title, description, questType, xpReward, goldReward, lootRewards, objectives } = req.body;
      
      const quest = await storage.createCampaignQuest({
        campaignId,
        title,
        description,
        questType: questType || "main",
        status: "active",
        xpReward: xpReward || 100,
        goldReward: goldReward || 0,
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

  app.patch("/api/campaigns/:campaignId/turn-based", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    
    try {
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Only campaign owner can change turn-based settings
      if (campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the campaign owner can change turn-based settings" });
      }
      
      const { isTurnBased, turnTimeLimit } = req.body;
      
      // Update campaign settings
      const updatedCampaign = await storage.updateCampaign(campaignId, {
        isTurnBased: isTurnBased === true,
        turnTimeLimit: turnTimeLimit || null
      });
      
      if (!updatedCampaign) {
        return res.status(500).json({ message: "Failed to update campaign settings" });
      }
      
      // If turning on turn-based mode, we may want to set the initial turn
      if (isTurnBased && !campaign.isTurnBased) {
        // Start with the campaign owner's turn
        await storage.updateCampaign(campaignId, {
          currentTurnUserId: campaign.userId,
          turnStartedAt: new Date().toISOString()
        });
      }
      
      // If turning off turn-based mode, clear any active turns
      if (!isTurnBased && campaign.isTurnBased) {
        await storage.endCurrentTurn(campaignId);
      }
      
      // Notify via WebSocket
      broadcastMessage('turn_based_changed', {
        campaignId,
        isTurnBased: isTurnBased === true,
        turnTimeLimit: turnTimeLimit || null
      });
      
      res.json(updatedCampaign);
    } catch (error) {
      console.error("Failed to update turn-based settings:", error);
      res.status(500).json({ message: "Failed to update turn-based settings" });
    }
  });
  
  // User Statistics API Endpoint
  // Get all users (for selection in invitations, etc.)
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
      const totalRegistered = totalUsers[0]?.count || 0;
      
      // Calculate online users based on active WebSocket connections
      // Each client may have multiple connections, so count unique IPs
      const activeConnections = new Set();
      wss.clients.forEach((client) => {
        if (client.readyState === 1) { // 1 = OPEN state
          // Get a unique identifier (use socket properties or default to unknown)
          const clientId = (client as any)._socket?.remoteAddress || 'unknown';
          activeConnections.add(clientId);
        }
      });
      
      // Return the stats
      res.json({
        totalRegistered: Number(totalRegistered),
        onlineUsers: activeConnections.size
      });
    } catch (error) {
      console.error("Failed to fetch user statistics:", error);
      res.status(500).json({ message: "Failed to fetch user statistics" });
    }
  });
  
  // Campaign Invitation routes
  app.post("/api/campaigns/:campaignId/invitations", async (req, res) => {
    try {
      // Authentication check
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const campaignId = parseInt(req.params.campaignId);
      
      // Get the campaign to check authorization
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Only campaign owner can create invitations
      if (campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the DM can create invitations" });
      }
      
      // Create invitation with createdBy field
      const invitationData = {
        ...req.body,
        campaignId,
        createdBy: req.user.id,
        createdAt: new Date().toISOString()
      };
      
      // Generate random invite code if not provided
      if (!invitationData.inviteCode) {
        invitationData.inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      }
      
      // Validate with Zod schema
      const validatedData = insertCampaignInvitationSchema.parse(invitationData);
      
      // Create the invitation
      const invitation = await storage.createCampaignInvitation(validatedData);
      
      res.status(201).json(invitation);
    } catch (error) {
      console.error("Failed to create invitation:", error);
      res.status(500).json({ message: "Failed to create invitation" });
    }
  });
  
  app.get("/api/campaigns/:campaignId/invitations", async (req, res) => {
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
      
      // Only campaign owner can view all invitations
      if (campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the DM can view all invitations" });
      }
      
      const invitations = await storage.getCampaignInvitations(campaignId);
      res.json(invitations);
    } catch (error) {
      console.error("Failed to fetch invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });
  
  app.get("/api/invitations/:code", async (req, res) => {
    try {
      const code = req.params.code;
      const invitation = await storage.getCampaignInvitationByCode(code);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      
      // Get campaign data to return with the invitation
      const campaign = await storage.getCampaign(invitation.campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      res.json({
        invitation,
        campaign: {
          id: campaign.id,
          title: campaign.title,
          description: campaign.description,
          difficulty: campaign.difficulty
        }
      });
    } catch (error) {
      console.error("Failed to fetch invitation:", error);
      res.status(500).json({ message: "Failed to fetch invitation" });
    }
  });
  
  app.post("/api/invitations/:code/accept", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const code = req.params.code;
      const characterId = req.body.characterId;
      
      if (!characterId) {
        return res.status(400).json({ message: "Character ID is required" });
      }
      
      // Get the invitation
      const invitation = await storage.getCampaignInvitationByCode(code);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found or expired" });
      }
      
      // Check if invitation is still valid
      if (invitation.status !== 'pending') {
        return res.status(400).json({ message: `Invitation is ${invitation.status}` });
      }
      
      // Use the invitation (this increments the use count)
      const updatedInvitation = await storage.useInvitation(code);
      if (!updatedInvitation) {
        return res.status(400).json({ message: "Failed to use invitation" });
      }
      
      // Add user as campaign participant
      const participant = await storage.addCampaignParticipant({
        campaignId: invitation.campaignId,
        userId: req.user.id,
        characterId,
        role: invitation.role,
        permissions: 'standard',
        joinedAt: new Date().toISOString()
      });
      
      // Broadcast to connected clients about new participant
      broadcastMessage('participant_joined', {
        campaignId: invitation.campaignId,
        userId: req.user.id,
        role: invitation.role
      });
      
      res.json({
        success: true,
        participant,
        message: "Successfully joined campaign"
      });
    } catch (error) {
      console.error("Failed to accept invitation:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });
  
  app.delete("/api/campaigns/:campaignId/invitations/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const invitationId = parseInt(req.params.id);
      
      // Get the campaign to check authorization
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Only campaign owner can delete invitations
      if (campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the DM can delete invitations" });
      }
      
      const result = await storage.deleteCampaignInvitation(invitationId);
      if (!result) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete invitation:", error);
      res.status(500).json({ message: "Failed to delete invitation" });
    }
  });
  
  // DM Notes routes
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

  // Magic item management routes
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

  // AI Generation routes for DM toolkit
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

  // Character XP and Inventory Management Routes
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
  app.post("/api/campaigns/:id/start-live-session", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const userId = req.user.id;

      // Verify campaign ownership
      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
      
      if (!campaign || campaign.userId !== userId) {
        return res.status(404).json({ message: "Campaign not found or access denied" });
      }

      // Update campaign to live status
      const [updatedCampaign] = await db
        .update(campaigns)
        .set({
          isLive: true,
          liveSessionStartedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(campaigns.id, campaignId))
        .returning();

      // Broadcast to all connected WebSocket clients
      broadcastMessage('live-session-started', {
        campaignId,
        campaign: updatedCampaign,
        timestamp: new Date().toISOString()
      });

      res.json({
        message: "Live session started successfully",
        campaign: updatedCampaign
      });
    } catch (error) {
      console.error("Failed to start live session:", error);
      res.status(500).json({ 
        message: "Failed to start live session",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/campaigns/:id/end-live-session", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const userId = req.user.id;

      // Verify campaign ownership
      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
      
      if (!campaign || campaign.userId !== userId) {
        return res.status(404).json({ message: "Campaign not found or access denied" });
      }

      // Update campaign to end live status
      const [updatedCampaign] = await db
        .update(campaigns)
        .set({
          isLive: false,
          liveSessionEndedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(campaigns.id, campaignId))
        .returning();

      // Broadcast to all connected WebSocket clients
      broadcastMessage('live-session-ended', {
        campaignId,
        campaign: updatedCampaign,
        timestamp: new Date().toISOString()
      });

      res.json({
        message: "Live session ended successfully",
        campaign: updatedCampaign
      });
    } catch (error) {
      console.error("Failed to end live session:", error);
      res.status(500).json({ 
        message: "Failed to end live session",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Player Invitation Routes
  app.post("/api/campaigns/:id/generate-invite", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const userId = req.user.id;

      // Verify campaign ownership
      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
      
      if (!campaign || campaign.userId !== userId) {
        return res.status(404).json({ message: "Campaign not found or access denied" });
      }

      // Generate a unique invite code
      const inviteCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      // Update campaign with invite code
      const [updatedCampaign] = await db
        .update(campaigns)
        .set({
          inviteCode,
          inviteCodeExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          updatedAt: new Date()
        })
        .where(eq(campaigns.id, campaignId))
        .returning();

      res.json({
        inviteCode,
        expiresAt: updatedCampaign.inviteCodeExpiresAt,
        campaignTitle: campaign.title
      });
    } catch (error) {
      console.error("Failed to generate invite code:", error);
      res.status(500).json({ 
        message: "Failed to generate invite code",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/campaigns/:id/invite-player", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const userId = req.user.id;
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Verify campaign ownership
      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
      
      if (!campaign || campaign.userId !== userId) {
        return res.status(404).json({ message: "Campaign not found or access denied" });
      }

      // For now, we'll just log the invitation (in a real app, you'd send an email)
      console.log(`Invitation sent to ${email} for campaign "${campaign.title}" (ID: ${campaignId})`);

      // In a real implementation, you would:
      // 1. Create an invitation record in the database
      // 2. Send an email with the invitation link
      // 3. Handle the invitation acceptance flow

      res.json({
        message: "Invitation sent successfully",
        email,
        campaignTitle: campaign.title
      });
    } catch (error) {
      console.error("Failed to send invitation:", error);
      res.status(500).json({ 
        message: "Failed to send invitation",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Complete Campaign Generation endpoint
  app.post("/api/campaigns/generate-complete", isAuthenticated, async (req: any, res) => {
    try {
      const { type, level, length, theme, customPrompt } = req.body;

      if (!type || !level || !length || !theme) {
        return res.status(400).json({ message: "Missing required campaign parameters" });
      }

      // Build comprehensive campaign generation prompt
      const campaignPrompt = `Generate a complete D&D campaign package with the following specifications:

Campaign Type: ${type}
Player Level Range: ${level}
Campaign Length: ${length}
Theme/Tone: ${theme}
${customPrompt ? `Additional Requirements: ${customPrompt}` : ''}

Generate a fully integrated campaign with interconnected elements. Return a JSON object with this exact structure:

{
  "title": "Campaign Title",
  "description": "Detailed campaign description (2-3 sentences)",
  "mainStoryArc": "Main story arc overview (2-3 sentences)",
  "quests": [
    {
      "title": "Quest Name",
      "type": "main|side|optional",
      "description": "Quest description",
      "objectives": ["Objective 1", "Objective 2"],
      "rewards": "Quest rewards description",
      "connections": "How this quest connects to others"
    }
  ],
  "npcs": [
    {
      "name": "NPC Name",
      "race": "Race",
      "class": "Class/Profession",
      "role": "ally|enemy|neutral|questgiver",
      "description": "Physical and background description",
      "personality": "Personality traits",
      "motivations": "What drives this NPC",
      "questConnections": "Which quests they're involved in"
    }
  ],
  "locations": [
    {
      "name": "Location Name",
      "type": "city|dungeon|wilderness|building",
      "description": "Detailed location description",
      "features": ["Feature 1", "Feature 2"],
      "encounters": "Potential encounters or activities here"
    }
  ],
  "encounters": [
    {
      "name": "Encounter Name",
      "type": "combat|social|exploration|puzzle",
      "challengeRating": "Appropriate CR",
      "description": "Encounter description",
      "setup": "How to set up this encounter",
      "tactics": "Enemy tactics or challenge mechanics",
      "treasure": "Rewards for success"
    }
  ],
  "rewards": [
    {
      "name": "Item/Reward Name",
      "type": "magic_item|treasure|experience|story",
      "rarity": "common|uncommon|rare|very_rare|legendary",
      "description": "Item description",
      "mechanics": "Mechanical effects if applicable",
      "questConnection": "Which quest provides this reward"
    }
  ]
}

Ensure all elements are interconnected and form a cohesive narrative. Include 3-5 main quests, 2-4 side quests, 8-12 NPCs, 6-10 locations, 8-12 encounters, and 6-10 meaningful rewards. Make sure everything ties together thematically.`;

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert D&D campaign designer. Generate comprehensive, interconnected campaign content that forms a cohesive narrative. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: campaignPrompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
        max_tokens: 4000
      });

      const generatedContent = JSON.parse(completion.choices[0].message.content || '{}');

      // Validate the generated content has required structure
      if (!generatedContent.title || !generatedContent.description) {
        throw new Error("Generated content missing required fields");
      }

      console.log(`Generated complete campaign: "${generatedContent.title}"`);

      res.json(generatedContent);
    } catch (error) {
      console.error("Failed to generate complete campaign:", error);
      res.status(500).json({ 
        message: "Failed to generate campaign",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Enhanced Live Session Management APIs

  // Get current session with DM context
  app.get("/api/campaigns/:campaignId/live-session", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const session = await storage.getCurrentSession(campaignId);
      
      if (!session) {
        return res.status(404).json({ message: "No active session found" });
      }

      // Check if user is DM to provide enhanced context
      const campaign = await storage.getCampaign(campaignId);
      const isDM = campaign && campaign.userId === req.user.id;
      
      // Provide different context for DM vs players
      const responseData = {
        ...session,
        isDM,
        dmView: isDM ? {
          dmNarrative: session.dmNarrative || session.narrative,
          storyState: session.storyState,
          pendingEvents: session.pendingEvents,
          npcInteractions: session.npcInteractions,
          quickContentGenerated: session.quickContentGenerated,
          playerChoicesMade: session.playerChoicesMade
        } : undefined
      };
      
      res.json(responseData);
    } catch (error) {
      console.error("Failed to get live session:", error);
      res.status(500).json({ message: "Failed to get live session" });
    }
  });

  // Advance story based on player choice with continuity
  app.post("/api/campaigns/:campaignId/advance-story", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const { choice, rollResult } = req.body;
      
      const currentSession = await storage.getCurrentSession(campaignId);
      if (!currentSession) {
        return res.status(404).json({ message: "No active session found" });
      }

      // Parse skill check information if it exists
      let skillCheckInfo = "";
      let skillCheckContinuation = "";
      
      if (rollResult) {
        const rollSuccess = rollResult.total >= (rollResult.dc || 10);
        const skillType = rollResult.purpose || "skill check";
        
        skillCheckInfo = `
SKILL CHECK RESULT ANALYSIS:
- Skill Check: ${skillType}
- Roll: ${rollResult.diceType} rolled ${rollResult.result} + ${rollResult.modifier || 0} = ${rollResult.total}
- DC: ${rollResult.dc || 10}
- Result: ${rollSuccess ? 'SUCCESS' : 'FAILURE'}
- Target: ${rollResult.target || 'Unknown target'}
- Intent: ${rollResult.intent || choice}`;

        skillCheckContinuation = `
CRITICAL: You must carry forward the effects of this ${rollSuccess ? 'successful' : 'failed'} ${skillType}. 
${rollSuccess ? 
  `The success should meaningfully impact the situation - NPCs may react favorably, obstacles are overcome, information is gained, or new opportunities arise.` : 
  `The failure should create interesting complications - NPCs may react negatively, obstacles remain or worsen, misinformation occurs, or new challenges emerge.`}
Do not ignore this result. Build the entire next scene around this outcome.`;
      }

      // Get current quests from story state
      const currentQuests = (currentSession.storyState as any)?.activeQuests || [];
      
      // Get player character info for combat tracking
      const participants = await storage.getCampaignParticipants(campaignId);
      let playerCharacterInfo = "";
      let playerCharacter: any = null;
      let isSoloAdventure = participants && participants.length === 1;
      
      if (participants && participants.length > 0) {
        const character = await storage.getCharacter(participants[0].characterId);
        playerCharacter = character;
        if (character) {
          // Get equipped weapon from inventory (first item is typically equipped)
          const equippedWeapon = character.equipment && Array.isArray(character.equipment) && character.equipment.length > 0 
            ? character.equipment[0] 
            : 'Unarmed';
          
          // Get consumables list
          const consumables = (character as any).consumables || [];
          const consumablesList = consumables.length > 0 
            ? consumables.map((c: any) => `${c.name} x${c.quantity}`).join(', ')
            : 'None';
          
          // Get currency
          const gold = (character as any).gold || 0;
          const silver = (character as any).silver || 0;
          const copper = (character as any).copper || 0;
          
          playerCharacterInfo = `
PLAYER CHARACTER:
- Name: ${character.name}
- Class: ${character.class}
- Level: ${character.level}
- Current HP: ${character.hitPoints}/${character.maxHitPoints}
- AC: ${character.armorClass || 10}
- Status: ${character.status || 'conscious'}
- Equipped Weapon: ${equippedWeapon}
- Inventory: ${character.equipment && Array.isArray(character.equipment) ? character.equipment.join(', ') : 'Empty'}
- Consumables: ${consumablesList}
- Currency: ${gold} gp, ${silver} sp, ${copper} cp

IMPORTANT CHARACTER STATUS:
${character.status === 'dead' ? '⚠️ THIS CHARACTER IS DEAD - They cannot take actions, speak, or participate in the adventure. The adventure should focus on their death and its consequences.' : 
  character.status === 'unconscious' ? '⚠️ This character is UNCONSCIOUS at 0 HP - They cannot take actions until healed or stabilized.' :
  character.status === 'stabilized' ? '⚠️ This character is STABILIZED at 0 HP - They are stable but unconscious and cannot take actions.' :
  'Character is conscious and can act normally.'}`;
        }
      }
      
      // Check if player is dead in a solo adventure - adventure should end
      if (isSoloAdventure && playerCharacter && playerCharacter.status === 'dead') {
        // Update session to reflect adventure end due to death
        const adventureEndNarrative = `
The adventure has come to a tragic end. ${playerCharacter.name} has fallen, their journey cut short by the dangers of this world.

Perhaps another hero will rise to continue where they left off, or perhaps their tale will serve as a warning to those who come after.

**GAME OVER**

You may create a new character or start a new adventure to continue playing.`;
        
        await storage.updateSession(currentSession.id, {
          narrative: adventureEndNarrative,
          choices: [],
          storyState: {
            ...(currentSession.storyState as any || {}),
            adventureEnded: true,
            endReason: 'player_death',
            inCombat: false
          }
        });
        
        return res.json({
          ...currentSession,
          narrative: adventureEndNarrative,
          choices: [],
          storyState: {
            ...(currentSession.storyState as any || {}),
            adventureEnded: true,
            endReason: 'player_death',
            inCombat: false
          },
          adventureEnded: true,
          endReason: 'player_death'
        });
      }
      
      // Get campaign for narrative style and difficulty
      const campaign = await storage.getCampaign(campaignId);
      const narrativeStyle = campaign?.narrativeStyle || "Descriptive";
      const difficulty = campaign?.difficulty || "Normal - Balanced Challenge";
      
      // Define narrative style instructions based on setting (case-insensitive lookup)
      const normalizedStyle = narrativeStyle.toLowerCase();
      const narrativeStyleInstructions = {
        "descriptive": "Use vivid, detailed descriptions of settings and actions. Paint the scene with sensory details.",
        "dramatic": "Focus on tension, emotion, and high-stakes moments. Build suspense and emphasize character reactions.",
        "conversational": "Keep the tone light and accessible. Use natural dialogue and straightforward descriptions.",
        "humorous": "Include witty observations, amusing situations, and playful narrative voice. Don't take things too seriously.",
        "dark": "Emphasize danger, consequences, and grim atmosphere. Focus on moral ambiguity and harsh realities."
      }[normalizedStyle] || "Use vivid, detailed descriptions of settings and actions.";
      
      // Generate story continuation based on choice and previous context
      const prompt = `
You are an expert Dungeon Master for a D&D game with a ${narrativeStyle} storytelling style.
${narrativeStyleInstructions}
Difficulty: ${difficulty}

Continue this D&D story based on the player's choice and maintain story continuity.

Previous Session Context:
${currentSession.previousSessionResult ? JSON.stringify(currentSession.previousSessionResult) : 'Beginning of adventure'}

Current Story State:
${JSON.stringify(currentSession.storyState || {})}

ACTIVE QUESTS (track completion!):
${currentQuests.length > 0 ? currentQuests.map((q: any) => 
  `- ${q.title}: ${q.description} [Status: ${q.status}]`
).join('\n') : 'No active quests - create 1-2 initial quests based on the story'}

Current Narrative:
${currentSession.narrative}
${playerCharacterInfo}

Player Choice Made: ${choice}
${skillCheckInfo}

${skillCheckContinuation}

Previous Player Actions History:
${currentSession.playerChoicesMade && currentSession.playerChoicesMade.length > 0 ? 
  currentSession.playerChoicesMade.slice(-3).map((action: any, i: number) => 
    `${i + 1}. ${action.choice} ${action.rollResult ? `(${action.rollResult.diceType}: ${action.rollResult.total})` : ''} - ${action.consequences || 'No recorded consequences'}`
  ).join('\n') : 'No previous actions recorded'}

NPC Interactions in Progress:
${JSON.stringify(currentSession.npcInteractions || {})}

CRITICAL INSTRUCTIONS - FOLLOW EXACTLY:

1. FOCUS ON ACTION AND CONSEQUENCES, NOT DESCRIPTION
2. Start with immediate results of the skill check/choice
3. Keep environmental description to 1 sentence maximum
4. Prioritize character reactions and story progression
5. Build directly on the specific skill check outcome
6. TRACK QUEST PROGRESS - Update quest status when player makes progress!

QUEST TRACKING REQUIREMENTS:
- If the player's action advances a quest, update its status to "in_progress" or "completed"
- Mark quests "completed" when objectives are clearly achieved
- Add new quests when story naturally introduces new objectives
- Always include at least 1 active quest

COMBAT MECHANICS REQUIREMENTS:
- IMPORTANT: Set "inCombat": true in storyState IMMEDIATELY when:
  * Player chooses an attack action against any creature
  * An enemy attacks the party
  * Any hostile encounter begins
- When combat occurs, track BOTH enemy HP AND party member HP
- Use the ACTUAL player character name from PLAYER CHARACTER section above in partyMembers
- Track the player character AND any AI companions in "partyMembers" array with PROPER NAMES
- Attack rolls that succeed should deal damage (use standard D&D damage: 1d6+modifier for light weapons, 1d8+modifier for medium, 1d10+ for heavy)
- Failed attack rolls mean the attack misses - no damage dealt
- Track when combatants are wounded, bloodied (below 50% HP), or defeated
- Player and party members can take damage from enemy attacks
- AI companions should take actions each round - describe what they do!
- Include "combatEffects" with damage for ALL combatants (player, companions, enemies)
- Include "companionActions" describing what each AI companion did this round
- Combat should feel dangerous and consequential
- ALWAYS populate "combatants" array with enemies when inCombat is true
- ALWAYS populate "partyMembers" array with player and companions when inCombat is true

COMBAT END CONDITIONS:
- Set "inCombat": false when ALL enemies are defeated, fled, or surrendered
- Combat can also end via successful disengage/retreat by the party
- Describe the combat resolution clearly in the narrative

TACTICAL COMBAT OPTIONS (include these choices when in combat):
- Attack with current weapon (requires attack roll)
- Switch weapons (free action, describe new weapon)
- Disengage/retreat (requires Athletics or Acrobatics check)
- Defensive stance (take cover, +2 AC, no attack)
- Use item/potion (consumes turn)
- Cast a spell (if magic user)

WRITING STYLE REQUIREMENTS:
- Apply the ${narrativeStyle} storytelling style consistently
- Lead with what HAPPENS as a result of the player action
- Keep narrative between 80-120 words - tight and punchy
- Every sentence must advance the plot or show consequences
- IMPORTANT: Make each story beat SIGNIFICANT - big reveals, meaningful encounters, plot twists
- Advance the story rapidly - skip mundane travel or waiting periods
- Jump to the next interesting moment or encounter

Generate the next story segment that:
1. IMMEDIATELY shows what happened because of their specific action/roll
2. Demonstrates clear success/failure consequences from the skill check
3. Advances plot through character reactions and new developments
4. Provides 4-5 diverse choices that build directly on what just occurred

CHOICE REQUIREMENTS:
- At least 4 choices, up to 5 maximum
- Include variety: dialogue, exploration, action, stealth, magic/investigation
- At least 2 choices should require dice rolls
- Make choices specific to the current situation, not generic

Respond with JSON:
{
  "narrative": "CONCISE story segment focused on immediate action results and character reactions (2-3 sentences maximum)",
  "dmNarrative": "Behind-the-scenes context for DM about consequences and what NPCs are thinking/planning",
  "choices": [
    {
      "text": "Action-focused choice description", 
      "type": "action/dialogue/exploration/magic/stealth/combat",
      "difficulty": "easy/medium/hard",
      "requiresDiceRoll": true/false,
      "diceType": "d20/d6/etc (if roll required)",
      "rollDC": "number (if roll required)",
      "rollPurpose": "What the roll represents",
      "successText": "What happens on success",
      "failureText": "What happens on failure"
    }
  ],
  "storyState": {
    "location": "current location",
    "activeNPCs": ["NPCs present"],
    "plotPoints": ["active plot elements"],
    "conditions": ["current conditions"],
    "activeQuests": [
      {"id": "quest_1", "title": "Quest Title", "description": "What the player needs to do", "status": "active/in_progress/completed", "xpReward": 100}
    ],
    "inCombat": true/false,
    "combatants": [
      {"name": "Enemy Name", "type": "enemy/boss", "cr": "1/4", "maxHp": 30, "currentHp": 30, "ac": 13, "attackBonus": 4, "damage": "1d6+2", "status": "healthy/wounded/bloodied/defeated", "description": "Brief visual description for illustration"}
    ],
    "partyMembers": [
      {"name": "Player Name", "type": "player", "maxHp": 25, "currentHp": 25, "ac": 14, "status": "healthy/wounded/bloodied/unconscious"},
      {"name": "Companion Name", "type": "companion", "class": "Fighter/Cleric/etc", "maxHp": 20, "currentHp": 20, "ac": 12, "status": "healthy"}
    ]
  },
  "npcInteractions": {"npcName": {"mood": "current mood", "relationship": "relationship change", "nextAction": "immediate plan"}},
  "consequencesOfChoice": "Specific result of the player's action and skill check outcome",
  "questUpdates": [{"questId": "quest_1", "newStatus": "in_progress/completed", "progressNote": "What changed"}],
  "combatEffects": {
    "playerDamageTaken": 0,
    "playerDamageDealt": 0,
    "enemyDamage": [{"name": "Enemy Name", "cr": "1/4", "damageTaken": 8, "newHp": 22, "defeated": false}],
    "partyDamage": [{"name": "Companion Name", "damageTaken": 5, "newHp": 15, "defeated": false}],
    "combatDescription": "Brief description of the combat exchange",
    "companionActions": [{"name": "Companion Name", "action": "Swung her sword at the goblin", "result": "Hit for 6 damage", "damageDealt": 6}],
    "lootDrops": [{"name": "Gold Coins", "type": "currency", "value": "15 gp", "fromEnemy": "Goblin"}]
  },
  "skillUsed": "Stealth/Perception/Athletics/etc or null if no skill check",
  "rewardItems": [{"name": "Healing Potion", "type": "consumable", "description": "Restores 2d4+2 HP", "rarity": "common"}],
  "movement": {
    "occurred": true/false,
    "direction": "up/down/left/right/null (if movement occurred, which direction on the map grid)",
    "description": "Brief description of where the party moved (e.g. 'entered the eastern chamber', 'descended the stairs')"
  }
}`;

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const storyAdvancement = JSON.parse(response.choices[0].message.content);

      // Calculate XP and item rewards based on story advancement
      let xpAwarded = 0;
      let itemsFound: any[] = [];
      let skillProgressUpdate: { skill: string, wasSuccessful: boolean } | null = null;
      const consequences = storyAdvancement.consequencesOfChoice || "";
      
      // Track skill used for progression
      const skillUsed = storyAdvancement.skillUsed;
      
      // Award XP for successful skill checks and story progression (D&D 5e style)
      if (rollResult) {
        const wasSuccessful = rollResult.total >= (rollResult.dc || 10);
        
        // Track skill usage for progression
        if (skillUsed && skillUsed !== "null") {
          skillProgressUpdate = { skill: skillUsed, wasSuccessful };
        }
        
        if (wasSuccessful) {
          // Award XP based on DC difficulty (scaled for D&D 5e progression)
          // DC 10 = Easy (25 XP), DC 15 = Medium (50 XP), DC 20 = Hard (75 XP), DC 25+ = Very Hard (100 XP)
          const dc = rollResult.dc || 10;
          if (dc >= 25) xpAwarded += 100; // Nearly impossible
          else if (dc >= 20) xpAwarded += 75; // Very hard
          else if (dc >= 15) xpAwarded += 50; // Hard
          else if (dc >= 10) xpAwarded += 25; // Medium
          else xpAwarded += 10; // Easy
        } else {
          // Minimal XP for attempting (learning from failure)
          xpAwarded += 5;
        }
      } else {
        // Base XP for story participation (roleplay/exploration)
        xpAwarded += 10;
      }
      
      // Collect AI-generated reward items
      if (storyAdvancement.rewardItems && storyAdvancement.rewardItems.length > 0) {
        itemsFound.push(...storyAdvancement.rewardItems);
      }
      
      // Collect loot drops from defeated enemies
      const combatEffects = storyAdvancement.combatEffects;
      if (combatEffects?.lootDrops && combatEffects.lootDrops.length > 0) {
        itemsFound.push(...combatEffects.lootDrops);
      }
      
      // Check for defeated enemies and award XP based on D&D 5e CR table
      // Also track combat completion for adventure progress
      let combatCompleted = false;
      if (combatEffects?.enemyDamage) {
        const defeatedEnemies = combatEffects.enemyDamage.filter((e: any) => e.defeated);
        if (defeatedEnemies.length > 0) {
          combatCompleted = true;
          // Award XP based on enemy Challenge Rating (D&D 5e official)
          for (const enemy of defeatedEnemies) {
            const cr = enemy.cr || "1/4"; // Default CR 1/4 for basic enemies
            const enemyXP = getXPFromCR(cr);
            xpAwarded += enemyXP;
          }
        }
      }
      
      // Bonus XP for significant story advancement
      if (consequences.toLowerCase().includes('discover') || 
          consequences.toLowerCase().includes('solve') ||
          consequences.toLowerCase().includes('defeat')) {
        xpAwarded += 50;
      }

      // Award XP for completed quests
      const questUpdates = storyAdvancement.questUpdates || [];
      const completedQuests: any[] = [];
      for (const update of questUpdates) {
        if (update.newStatus === 'completed') {
          // Find the quest in the story state to get its XP reward
          const activeQuests = storyAdvancement.storyState?.activeQuests || [];
          const completedQuest = activeQuests.find((q: any) => q.id === update.questId);
          if (completedQuest) {
            xpAwarded += completedQuest.xpReward || 100; // Default 100 XP if not specified
            completedQuests.push({
              ...completedQuest,
              progressNote: update.progressNote
            });
          }
        }
      }

      // Check for random item drops based on story context
      const shouldDropItem = Math.random() < 0.15; // 15% chance
      if (shouldDropItem && (consequences.toLowerCase().includes('search') || 
                             consequences.toLowerCase().includes('find') ||
                             consequences.toLowerCase().includes('chest') ||
                             consequences.toLowerCase().includes('treasure') ||
                             (rollResult && rollResult.total >= (rollResult.dc || 10) + 5))) {
        // Generate a random item based on character level
        const campaign = await storage.getCampaign(campaignId);
        const participants = await storage.getCampaignParticipants(campaignId);
        if (participants && participants.length > 0) {
          const characterId = participants[0].characterId;
          const character = await storage.getCharacter(characterId);
          if (character) {
            const itemRarity = character.level < 3 ? 'common' : 
                             character.level < 6 ? 'uncommon' : 
                             character.level < 10 ? 'rare' : 'very rare';
            
            const itemPrompt = `Generate a random D&D 5e magic item or treasure suitable for level ${character.level} character.
            Rarity: ${itemRarity}
            Context: ${consequences}
            
            Respond with JSON: {"name": "Item Name", "type": "weapon/armor/wondrous/consumable", "rarity": "${itemRarity}", "description": "Brief description", "properties": "Game mechanics"}`;
            
            try {
              const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
              const itemResponse = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: itemPrompt }],
                response_format: { type: "json_object" },
              });
              
              const generatedItem = JSON.parse(itemResponse.choices[0].message.content);
              itemsFound.push(generatedItem);
            } catch (error) {
              console.error("Failed to generate item:", error);
            }
          }
        }
      }

      // Expand exploration limit when story advances (narrative unlocks more of the map)
      const currentStoryState = currentSession.storyState as any || {};
      const currentExplorationLimit = currentStoryState.explorationLimit || 5;
      const newExplorationLimit = currentExplorationLimit + 2; // Expand by 2 tiles per story advancement
      
      // Handle movement from narrative choices - update dungeon map position
      let updatedMapData = null;
      const movement = storyAdvancement.movement;
      if (movement && movement.occurred && movement.direction) {
        try {
          // Get the current dungeon map for this campaign
          const dungeonMap = await storage.getCampaignDungeonMap(campaignId);
          if (dungeonMap && dungeonMap.mapData) {
            const mapData = typeof dungeonMap.mapData === 'string' 
              ? JSON.parse(dungeonMap.mapData) 
              : dungeonMap.mapData;
            
            // Normalize various direction terms to canonical directions
            const normalizeDirection = (dir: string): string | null => {
              const normalized = dir.toLowerCase().trim();
              // Map various terms to canonical directions
              if (['up', 'north', 'n', 'forward', 'ahead', 'forwards'].includes(normalized)) return 'up';
              if (['down', 'south', 's', 'back', 'backward', 'backwards'].includes(normalized)) return 'down';
              if (['left', 'west', 'w'].includes(normalized)) return 'left';
              if (['right', 'east', 'e'].includes(normalized)) return 'right';
              // Handle compound directions - take primary direction
              if (normalized.includes('north') || normalized.includes('up')) return 'up';
              if (normalized.includes('south') || normalized.includes('down')) return 'down';
              if (normalized.includes('west') || normalized.includes('left')) return 'left';
              if (normalized.includes('east') || normalized.includes('right')) return 'right';
              return null;
            };
            
            const canonicalDirection = normalizeDirection(movement.direction);
            
            // Calculate new position based on direction
            const directionOffsets: Record<string, {x: number, y: number}> = {
              up: { x: 0, y: -1 },
              down: { x: 0, y: 1 },
              left: { x: -1, y: 0 },
              right: { x: 1, y: 0 },
            };
            const offset = canonicalDirection ? directionOffsets[canonicalDirection] : { x: 0, y: 0 };
            const currentPos = mapData.playerPosition || { x: 4, y: 4 };
            const newPosition = {
              x: Math.max(0, Math.min(mapData.width - 1, currentPos.x + offset.x)),
              y: Math.max(0, Math.min(mapData.height - 1, currentPos.y + offset.y)),
            };
            
            // Check that the new position is not a wall
            const targetTile = mapData.tiles?.[newPosition.y]?.[newPosition.x];
            if (targetTile && targetTile.type !== "wall") {
              // Update player position and mark tiles as explored
              mapData.playerPosition = newPosition;
              mapData.tiles = mapData.tiles.map((row: any[], y: number) =>
                row.map((tile: any, x: number) => {
                  const dist = Math.sqrt(
                    Math.pow(x - newPosition.x, 2) + 
                    Math.pow(y - newPosition.y, 2)
                  );
                  if (dist <= 2) {
                    return { ...tile, explored: true, visible: dist <= 1.5 };
                  }
                  return { ...tile, visible: false };
                })
              );
              
              // Save updated map
              await storage.updateCampaignDungeonMap(dungeonMap.id, { mapData });
              updatedMapData = mapData;
            }
          }
        } catch (mapError) {
          console.error("Failed to update dungeon map from story movement:", mapError);
        }
      }
      
      // Add narrative event to journey log
      const existingJourneyLog = (currentStoryState.journeyLog as any[]) || [];
      const narrativeSummary = storyAdvancement.narrative?.slice(0, 150) || choice;
      const newJourneyEntry = {
        id: `story-${Date.now()}`,
        type: 'story',
        description: narrativeSummary + (storyAdvancement.narrative && storyAdvancement.narrative.length > 150 ? '...' : ''),
        timestamp: new Date().toISOString(),
        choice: choice,
        consequences: storyAdvancement.consequencesOfChoice
      };
      const updatedJourneyLog = [...existingJourneyLog, newJourneyEntry].slice(-50);
      
      // Update adventure progress if combat was completed
      // Check if combat just ended (was in combat, now not) - must be done AFTER currentStoryState is defined
      const wasInCombat = currentStoryState.inCombat || false;
      const nowInCombat = storyAdvancement.storyState?.inCombat || false;
      if (wasInCombat && !nowInCombat) {
        combatCompleted = true;
      }
      
      let updatedAdventureProgress = currentStoryState.adventureProgress || {
        encounters: { combat: 0, trap: 0, treasure: 0, total: 0 },
        puzzles: 0,
        discoveries: 0,
        subquestsCompleted: 0,
        startedAt: new Date().toISOString(),
        isComplete: false
      };
      
      if (combatCompleted) {
        updatedAdventureProgress = {
          ...updatedAdventureProgress,
          encounters: {
            ...updatedAdventureProgress.encounters,
            combat: (updatedAdventureProgress.encounters?.combat || 0) + 1,
            total: (updatedAdventureProgress.encounters?.total || 0) + 1
          }
        };
        console.log("Combat completed - incrementing counter:", updatedAdventureProgress.encounters);
      }
      
      // Merge the new exploration limit with the AI-generated story state
      const mergedStoryState = {
        ...storyAdvancement.storyState,
        explorationLimit: newExplorationLimit,
        startPosition: currentStoryState.startPosition || { x: 4, y: 4 },
        journeyLog: updatedJourneyLog,
        adventureProgress: updatedAdventureProgress,
        adventureRequirements: currentStoryState.adventureRequirements,
        movesWithoutStory: 0, // Reset moves counter after story advancement
        lastMovement: movement?.occurred ? {
          direction: movement.direction,
          description: movement.description,
          timestamp: new Date().toISOString()
        } : currentStoryState.lastMovement
      };
      
      // Add movement choices if not in combat
      let finalChoices = storyAdvancement.choices || [];
      const inCombat = storyAdvancement.storyState?.inCombat || mergedStoryState.inCombat;
      
      if (!inCombat) {
        // Get current dungeon map position for movement context
        const dungeonMap = await storage.getCampaignDungeonMap(campaignId);
        const currentPosition = dungeonMap?.playerPosition || { x: 4, y: 4 };
        
        // Add movement choices for exploration
        const movementChoices = [
          {
            text: "Move North (explore ahead)",
            type: "exploration",
            difficulty: "easy",
            requiresDiceRoll: false,
            isMovement: true,
            movementDirection: "north"
          },
          {
            text: "Move South (go back)",
            type: "exploration", 
            difficulty: "easy",
            requiresDiceRoll: false,
            isMovement: true,
            movementDirection: "south"
          },
          {
            text: "Move East (explore right)",
            type: "exploration",
            difficulty: "easy",
            requiresDiceRoll: false,
            isMovement: true,
            movementDirection: "east"
          },
          {
            text: "Move West (explore left)",
            type: "exploration",
            difficulty: "easy",
            requiresDiceRoll: false,
            isMovement: true,
            movementDirection: "west"
          }
        ];
        
        // Add movement choices that aren't already represented
        const hasMovementChoice = finalChoices.some((c: any) => 
          c.isMovement || 
          c.text?.toLowerCase().includes('north') ||
          c.text?.toLowerCase().includes('south') ||
          c.text?.toLowerCase().includes('east') ||
          c.text?.toLowerCase().includes('west') ||
          c.text?.toLowerCase().includes('move') ||
          c.text?.toLowerCase().includes('explore')
        );
        
        if (!hasMovementChoice) {
          // Add 2-3 movement options to give variety
          const shuffledMovements = movementChoices.sort(() => Math.random() - 0.5);
          finalChoices = [...finalChoices.slice(0, 3), ...shuffledMovements.slice(0, 2)];
        }
      }
      
      // Update session with story advancement
      const updatedSession = await storage.advanceSessionStory(campaignId, {
        narrative: storyAdvancement.narrative,
        dmNarrative: storyAdvancement.dmNarrative,
        choices: finalChoices,
        storyState: mergedStoryState,
        npcInteractions: storyAdvancement.npcInteractions,
        playerChoicesMade: [...(currentSession.playerChoicesMade || []), {
          choice,
          rollResult,
          timestamp: new Date().toISOString(),
          consequences: storyAdvancement.consequencesOfChoice,
          xpAwarded,
          itemsFound
        }]
      });

      // Auto-link campaign to world location if not already linked
      const campaignForLinking = await storage.getCampaign(campaignId);
      if (campaignForLinking && !campaignForLinking.worldLocationId && !campaignForLinking.worldRegionId) {
        try {
          // Get location from story state or session
          const storyLocation = mergedStoryState?.location || 
                               currentSession.location || 
                               updatedSession?.location;
          
          if (storyLocation) {
            // Try to match location name to world locations
            const allWorldLocations = await storage.getAllWorldLocations();
            const matchedLocation = allWorldLocations.find(loc => {
              const locName = loc.name.toLowerCase();
              const storyLocLower = storyLocation.toLowerCase();
              // Match if names contain each other or are similar
              return locName.includes(storyLocLower) || 
                     storyLocLower.includes(locName) ||
                     locName.split(' ').some((word: string) => storyLocLower.includes(word) && word.length > 3);
            });
            
            if (matchedLocation) {
              await storage.updateCampaign(campaignId, {
                worldLocationId: matchedLocation.id,
                worldRegionId: matchedLocation.regionId
              });
              console.log(`Auto-linked campaign ${campaignId} to world location: ${matchedLocation.name}`);
            } else {
              // Try to match to a region by name
              const allRegions = await storage.getAllWorldRegions();
              const matchedRegion = allRegions.find(region => {
                const regionName = region.name.toLowerCase();
                const storyLocLower = storyLocation.toLowerCase();
                return regionName.includes(storyLocLower) || 
                       storyLocLower.includes(regionName) ||
                       regionName.split(' ').some((word: string) => storyLocLower.includes(word) && word.length > 3);
              });
              
              if (matchedRegion) {
                await storage.updateCampaign(campaignId, {
                  worldRegionId: matchedRegion.id
                });
                console.log(`Auto-linked campaign ${campaignId} to world region: ${matchedRegion.name}`);
              }
            }
          }
        } catch (linkError) {
          console.error("Failed to auto-link campaign to world location:", linkError);
        }
      }

      // Apply XP, items, skill progress, and combat damage to character if there's a participant
      let characterProgression = null;
      // participants already fetched earlier for character info
      if (participants && participants.length > 0) {
        const characterId = participants[0].characterId;
        const character = await storage.getCharacter(characterId);
        if (character) {
          const newXP = (character.experience || 0) + xpAwarded;
          // Use official D&D 5e XP thresholds for level calculation
          const newLevel = getLevelFromXP(newXP);
          const leveledUp = newLevel > character.level;
          
          // D&D 5e class hit dice for HP calculation
          const CLASS_HIT_DICE: Record<string, number> = {
            'Barbarian': 12, 'Fighter': 10, 'Paladin': 10, 'Ranger': 10,
            'Bard': 8, 'Cleric': 8, 'Druid': 8, 'Monk': 8, 'Rogue': 8, 'Warlock': 8,
            'Sorcerer': 6, 'Wizard': 6
          };
          
          // Calculate HP increase on level up using D&D 5e rules
          let newMaxHitPoints = character.maxHitPoints;
          let hpGainFromLevelUp = 0;
          if (leveledUp) {
            const hitDie = CLASS_HIT_DICE[character.class] || 8;
            const conMod = Math.floor((character.constitution - 10) / 2);
            const levelsGained = newLevel - character.level;
            // D&D 5e average: (hit die / 2) + 1 + CON modifier per level
            const hpPerLevel = Math.floor(hitDie / 2) + 1 + conMod;
            hpGainFromLevelUp = Math.max(levelsGained, levelsGained * hpPerLevel);
            newMaxHitPoints = (character.maxHitPoints || 10) + hpGainFromLevelUp;
          }
          
          // Apply combat damage if any
          const combatEffects = storyAdvancement.combatEffects;
          let newHitPoints = leveledUp ? character.hitPoints + hpGainFromLevelUp : character.hitPoints;
          let damageTaken = 0;
          let damageDealt = 0;
          let newStatus = character.status || "conscious";
          let deathSaveFailures = character.deathSaveFailures || 0;
          let deathSaveSuccesses = character.deathSaveSuccesses || 0;
          let statusChange: string | null = null;
          
          if (combatEffects) {
            damageTaken = combatEffects.playerDamageTaken || 0;
            damageDealt = combatEffects.playerDamageDealt || 0;
            
            if (damageTaken > 0) {
              // Check if already unconscious - damage at 0 HP = death save failure
              if (character.hitPoints <= 0 && newStatus === "unconscious") {
                deathSaveFailures += 1;
                if (deathSaveFailures >= 3) {
                  newStatus = "dead";
                  statusChange = "dead";
                }
              } else {
                newHitPoints = Math.max(0, character.hitPoints - damageTaken);
                
                // Check for unconscious
                if (newHitPoints <= 0 && character.hitPoints > 0) {
                  newStatus = "unconscious";
                  statusChange = "unconscious";
                  // Reset death saves
                  deathSaveSuccesses = 0;
                  deathSaveFailures = 0;
                  
                  // Check for massive damage (instant death)
                  const excessDamage = Math.abs(newHitPoints);
                  if (excessDamage >= character.maxHitPoints) {
                    newStatus = "dead";
                    statusChange = "dead";
                  }
                }
              }
            }
          }
          
          // Update skill progression
          let updatedSkillProgress = (character.skillProgress as Record<string, { uses: number, bonus: number }>) || {};
          let skillImproved = null;
          
          if (skillProgressUpdate) {
            const { skill, wasSuccessful } = skillProgressUpdate;
            const currentProgress = updatedSkillProgress[skill] || { uses: 0, bonus: 0 };
            const newUses = currentProgress.uses + 1;
            
            // Skills improve after successful uses (every 5 successful uses = +1 bonus, max +5)
            let newBonus = currentProgress.bonus;
            if (wasSuccessful && newUses % 5 === 0 && currentProgress.bonus < 5) {
              newBonus = currentProgress.bonus + 1;
              skillImproved = { skill, newBonus };
            }
            
            updatedSkillProgress[skill] = { uses: newUses, bonus: newBonus };
          }
          
          // Add found items to character equipment
          const currentEquipment = character.equipment || [];
          const newEquipment = [...currentEquipment];
          for (const item of itemsFound) {
            if (item.name && !newEquipment.includes(item.name)) {
              newEquipment.push(item.name);
            }
          }
          
          await storage.updateCharacter(characterId, {
            experience: newXP,
            level: newLevel,
            hitPoints: newHitPoints,
            maxHitPoints: newMaxHitPoints,
            status: newStatus,
            deathSaveSuccesses,
            deathSaveFailures,
            equipment: newEquipment,
            skillProgress: updatedSkillProgress,
            updatedAt: new Date().toISOString()
          });
          
          characterProgression = {
            xpAwarded,
            newXP,
            newLevel,
            leveledUp,
            hpGainFromLevelUp: leveledUp ? hpGainFromLevelUp : 0,
            newMaxHitPoints,
            itemsFound,
            completedQuests,
            skillImproved,
            skillProgress: updatedSkillProgress,
            statusChange,
            currentStatus: newStatus,
            deathSaveSuccesses,
            deathSaveFailures,
            combatEffects: combatEffects ? {
              damageTaken,
              damageDealt,
              newHitPoints,
              maxHitPoints: newMaxHitPoints,
              combatDescription: combatEffects.combatDescription,
              enemyDamage: combatEffects.enemyDamage,
              partyDamage: combatEffects.partyDamage,
              companionActions: combatEffects.companionActions
            } : null
          };
        }
      }

      // Update user world progress if campaign is linked to a world location
      const campaignForWorld = await storage.getCampaign(campaignId);
      if (campaignForWorld && participants && participants.length > 0) {
        for (const participant of participants) {
          // If campaign has a linked world location, update user progress
          if (campaignForWorld.worldLocationId) {
            try {
              await storage.updateUserWorldProgress(participant.userId, null, campaignForWorld.worldLocationId, {
                hasVisited: true,
                hasDiscovered: true,
                completionState: "in_progress",
                lastVisitedAt: new Date().toISOString(),
                lastSessionId: updatedSession.id,
                lastCampaignId: campaignId
              });
            } catch (e) {
              console.error("Failed to update world progress for location:", e);
            }
          }
          // If campaign has a linked world region, update region progress
          if (campaignForWorld.worldRegionId) {
            try {
              await storage.updateUserWorldProgress(participant.userId, campaignForWorld.worldRegionId, null, {
                hasVisited: true,
                hasDiscovered: true,
                completionState: "in_progress",
                lastVisitedAt: new Date().toISOString(),
                lastSessionId: updatedSession.id,
                lastCampaignId: campaignId
              });
            } catch (e) {
              console.error("Failed to update world progress for region:", e);
            }
          }
        }
      }
      
      // Broadcast story update to all participants
      broadcastMessage('story_advanced', {
        campaignId,
        narrative: storyAdvancement.narrative,
        choices: storyAdvancement.choices,
        playerChoice: choice,
        rollResult,
        progression: characterProgression
      });

      res.json({
        ...updatedSession,
        progression: characterProgression,
        dungeonMapData: updatedMapData,
        movement: movement?.occurred ? {
          occurred: true,
          direction: movement.direction,
          description: movement.description
        } : null
      });
    } catch (error) {
      console.error("Failed to advance story:", error);
      res.status(500).json({ message: "Failed to advance story" });
    }
  });

  // Generate quick content for DMs
  app.post("/api/campaigns/:campaignId/generate-quick-content", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const { contentType, parameters } = req.body;
      
      // Verify DM permissions
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign || campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the DM can generate quick content" });
      }

      const currentSession = await storage.getCurrentSession(campaignId);
      
      let prompt = "";
      switch (contentType) {
        case "encounter":
          prompt = `Generate a random encounter for a D&D session.
Current Context: ${currentSession?.narrative || 'Adventure in progress'}
Location: ${currentSession?.storyState?.location || parameters.location || 'Current area'}
Party Level: ${parameters.partyLevel || '1-3'}
Difficulty: ${parameters.difficulty || 'medium'}

Create an encounter with:
- Description of the situation
- Combat statistics if needed
- Non-combat resolution options
- Potential rewards

Respond with JSON: {"type": "encounter", "title": "", "description": "", "combat": {}, "rewards": [], "nonCombatOptions": []}`;
          break;
        
        case "loot":
          prompt = `Generate magical items and treasure for a D&D session.
Current Context: ${currentSession?.narrative || 'Adventure rewards'}
Party Level: ${parameters.partyLevel || '1-3'}
Value Tier: ${parameters.tier || 'common'}

Create 3-5 items including:
- Mix of magical items, gold, and consumables
- Items appropriate for the story context
- Interesting magical properties

Respond with JSON: {"type": "loot", "items": [{"name": "", "type": "", "description": "", "value": "", "magical": true/false}]}`;
          break;
        
        case "npc":
          prompt = `Generate an NPC for immediate use in a D&D session.
Current Context: ${currentSession?.narrative || 'Current scene'}
NPC Role: ${parameters.role || 'helpful/neutral/hostile'}
Location: ${currentSession?.storyState?.location || 'current area'}

Create an NPC with:
- Name, appearance, and personality
- Motivation and goals
- Knowledge they possess
- How they react to the party

Respond with JSON: {"type": "npc", "name": "", "appearance": "", "personality": "", "motivation": "", "knowledge": [], "attitude": ""}`;
          break;
        
        default:
          return res.status(400).json({ message: "Invalid content type" });
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const generatedContent = JSON.parse(response.choices[0].message.content);

      // Save to session's quick content
      await storage.addQuickContentToSession(campaignId, generatedContent);

      res.json(generatedContent);
    } catch (error) {
      console.error("Failed to generate quick content:", error);
      res.status(500).json({ message: "Failed to generate quick content" });
    }
  });

  // Start combat scenario
  app.post("/api/campaigns/:campaignId/start-combat", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const { enemies, environment } = req.body;
      
      // Verify DM permissions
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign || campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the DM can start combat" });
      }

      // Get current participants for initiative order
      const participants = await storage.getCampaignParticipants(campaignId);
      
      // Generate initiative order and combat state
      const combatState = {
        round: 1,
        turn: 0,
        participants: participants.map(p => ({
          ...p,
          initiative: Math.floor(Math.random() * 20) + 1,
          hp: p.character?.hitPoints || 10,
          maxHp: p.character?.maxHitPoints || 10,
          conditions: []
        })).sort((a, b) => b.initiative - a.initiative),
        enemies: enemies.map((enemy: any) => ({
          ...enemy,
          initiative: Math.floor(Math.random() * 20) + 1,
          hp: enemy.maxHp,
          conditions: []
        })),
        environment: environment || {}
      };

      // Update session to combat mode
      await storage.startCombat(campaignId, combatState);

      // Broadcast combat start
      broadcastMessage('combat_started', {
        campaignId,
        combatState,
        message: "Combat has begun! Roll for initiative!"
      });

      res.json({ success: true, combatState });
    } catch (error) {
      console.error("Failed to start combat:", error);
      res.status(500).json({ message: "Failed to start combat" });
    }
  });

  // Handle combat actions
  app.post("/api/campaigns/:campaignId/combat-action", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const { action, target, rollResult } = req.body;
      
      const currentSession = await storage.getCurrentSession(campaignId);
      if (!currentSession?.isInCombat) {
        return res.status(400).json({ message: "Not currently in combat" });
      }

      // Process the combat action with AI assistance
      const prompt = `
Process this combat action in D&D 5e:

Action: ${action}
Target: ${target || 'none'}
Roll Result: ${rollResult ? `${rollResult.diceType} = ${rollResult.result} + ${rollResult.modifier || 0} = ${rollResult.total}` : 'no roll'}

Current Combat State: ${JSON.stringify(currentSession.combatState)}

Determine:
1. Whether the action succeeds
2. Damage/effects if applicable
3. Updated combat state
4. Narrative description of what happens
5. Next choices for the current player

Respond with JSON:
{
  "success": true/false,
  "damage": number,
  "effects": [],
  "narrative": "What happens in the combat",
  "updatedCombatState": {},
  "nextChoices": [{"text": "", "type": "attack/spell/move", "description": ""}]
}`;

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const combatResult = JSON.parse(response.choices[0].message.content);

      // Update combat state
      await storage.updateCombatState(campaignId, combatResult.updatedCombatState);

      // Check if combat ended (all enemies defeated)
      const combatState = combatResult.updatedCombatState || currentSession.combatState;
      const allEnemiesDefeated = combatState?.enemies?.every((e: any) => e.hp <= 0 || e.defeated);
      
      // Update world progress if combat ended successfully
      if (allEnemiesDefeated) {
        const campaign = await storage.getCampaign(campaignId);
        const participants = await storage.getCampaignParticipants(campaignId);
        
        if (campaign && participants && participants.length > 0) {
          for (const participant of participants) {
            // Update location progress
            if (campaign.worldLocationId) {
              try {
                await storage.updateUserWorldProgress(participant.userId, null, campaign.worldLocationId, {
                  hasVisited: true,
                  hasDiscovered: true,
                  completionState: "in_progress",
                  lastVisitedAt: new Date().toISOString(),
                  lastCampaignId: campaignId
                });
              } catch (e) {
                console.error("Failed to update world progress for location after combat:", e);
              }
            }
            // Update region progress
            if (campaign.worldRegionId) {
              try {
                await storage.updateUserWorldProgress(participant.userId, campaign.worldRegionId, null, {
                  hasVisited: true,
                  hasDiscovered: true,
                  completionState: "in_progress",
                  lastVisitedAt: new Date().toISOString(),
                  lastCampaignId: campaignId
                });
              } catch (e) {
                console.error("Failed to update world progress for region after combat:", e);
              }
            }
          }
        }
      }

      // Broadcast combat update
      broadcastMessage('combat_action', {
        campaignId,
        action,
        result: combatResult,
        narrative: combatResult.narrative
      });

      res.json(combatResult);
    } catch (error) {
      console.error("Failed to process combat action:", error);
      res.status(500).json({ message: "Failed to process combat action" });
    }
  });

  // Chat API Routes
  app.get("/api/chat/messages/:channel", isAuthenticated, async (req, res) => {
    try {
      const { channel } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const messages = await storage.getChatMessages(channel, limit);
      res.json(messages);
    } catch (error) {
      console.error("Failed to fetch chat messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  app.post("/api/chat/messages", isAuthenticated, async (req, res) => {
    try {
      const messageData = insertChatMessageSchema.parse(req.body);
      const message = await storage.createChatMessage(messageData);
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid message data", errors: error.errors });
      } else {
        console.error("Failed to create chat message:", error);
        res.status(500).json({ message: "Failed to create chat message" });
      }
    }
  });

  app.get("/api/chat/online-users", isAuthenticated, async (req, res) => {
    try {
      const onlineUsers = await storage.getOnlineUsers();
      res.json(onlineUsers);
    } catch (error) {
      console.error("Failed to fetch online users:", error);
      res.status(500).json({ message: "Failed to fetch online users" });
    }
  });

  app.post("/api/chat/user-status", isAuthenticated, async (req, res) => {
    try {
      const { userId, username, isOnline, campaignId } = req.body;
      
      await storage.updateUserOnlineStatus(userId, username, isOnline);
      
      if (campaignId !== undefined) {
        await storage.setUserCurrentCampaign(userId, campaignId);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to update user status:", error);
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  // ========================================
  // World Map API Routes
  // ========================================
  
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

  // ==================== CAML Adventure Routes ====================
  
  // Import a CAML adventure (YAML or JSON)
  app.post("/api/caml/import", isAuthenticated, async (req, res) => {
    try {
      const { content, format, createCampaign: shouldCreateCampaign } = req.body;
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
        const campaign = await storage.createCampaign({
          userId,
          title: campaignData.title,
          description: campaignData.description,
          setting: campaignData.setting,
          isActive: true,
          currentSessionNumber: 1
        });
        
        const session = await storage.createCampaignSession({
          campaignId: campaign.id,
          sessionNumber: 1,
          summary: `Imported from CAML: ${campaignData.title}`,
          storyState: campaignData.initialStoryState
        });
        
        for (const npc of campaignData.npcs) {
          try {
            const createdNpc = await storage.createNpc({
              name: npc.name,
              description: npc.description,
              race: npc.race,
              class: npc.class,
              alignment: npc.alignment,
              statblock: npc.statblock
            });
            await storage.addNpcToCampaign(campaign.id, createdNpc.id);
          } catch (e) {
            console.error("Failed to create NPC:", e);
          }
        }
        
        for (const quest of campaignData.quests) {
          try {
            await storage.createQuest({
              campaignId: campaign.id,
              title: quest.name,
              description: quest.description,
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
        res.json({
          success: true,
          adventure: pack.adventure,
          campaignData,
          graph: buildAdventureGraph(pack)
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
      
      const camlAdventure = convertCampaignToCAML(
        campaign,
        sessions,
        participants,
        npcs,
        quests
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
      
      const camlAdventure = convertCampaignToCAML(
        campaign,
        sessions,
        participants,
        npcs,
        quests
      );
      
      const pack = {
        adventure: camlAdventure,
        entities: {} as Record<string, any>
      };
      
      pack.entities[camlAdventure.id] = { ...camlAdventure, type: 'AdventureModule' };
      for (const loc of camlAdventure.locations || []) {
        pack.entities[loc.id] = { ...loc, type: 'Location' };
      }
      for (const npc of camlAdventure.npcs || []) {
        pack.entities[npc.id] = { ...npc, type: 'NPC' };
      }
      for (const quest of camlAdventure.quests || []) {
        pack.entities[quest.id] = { ...quest, type: 'Quest' };
      }
      for (const enc of camlAdventure.encounters || []) {
        pack.entities[enc.id] = { ...enc, type: 'Encounter' };
      }
      for (const item of camlAdventure.items || []) {
        pack.entities[item.id] = { ...item, type: 'Item' };
      }
      
      const graph = buildAdventureGraph(pack);
      console.log('Adventure graph built:', { nodes: graph.nodes.length, edges: graph.edges.length });
      res.json(graph);
    } catch (error) {
      console.error("Failed to build adventure graph:", error);
      res.status(500).json({ message: "Failed to build adventure graph" });
    }
  });
  
  // Generate a CAML adventure using AI
  app.post("/api/caml/generate", isAuthenticated, async (req, res) => {
    try {
      const { 
        title, 
        theme, 
        setting, 
        minLevel, 
        maxLevel, 
        encounterCount,
        includeQuests,
        includePuzzles
      } = req.body;
      
      const prompt = `You are a D&D adventure designer. Generate a COMPLETE adventure module in JSON format.

CRITICAL: You MUST populate ALL arrays with actual content. Empty arrays are NOT acceptable.

Generate an adventure with these specifications:
- Title: ${title || 'The Lost Temple'}
- Theme: ${theme || 'exploration and mystery'}
- Setting: ${setting || 'fantasy dungeon'}
- Level range: ${minLevel || 1} to ${maxLevel || 5}
- Number of encounters: ${encounterCount || 5}
${includeQuests ? '- Include 2-3 quests with clear objectives and rewards' : ''}
${includePuzzles ? '- Include 1-2 puzzle/trap encounters' : ''}

YOU MUST INCLUDE:
1. EXACTLY 5 locations with connections between them
2. EXACTLY 4 NPCs (mix of friendly and hostile)
3. EXACTLY ${encounterCount || 5} encounters (combat, social, exploration mix)
4. EXACTLY 3 items/treasures
5. EXACTLY 2 quests with objectives

Return this exact JSON structure with ALL arrays populated:

{
  "id": "adventure.${Date.now()}",
  "type": "AdventureModule",
  "title": "${title || 'The Lost Temple'}",
  "synopsis": "Adventure synopsis here",
  "minLevel": ${minLevel || 1},
  "maxLevel": ${maxLevel || 5},
  "setting": "${setting || 'fantasy dungeon'}",
  "hooks": ["Hook 1", "Hook 2"],
  "locations": [
    {"id": "location.area1", "type": "Location", "name": "Name", "description": "Description", "connections": [{"direction": "north", "target": "location.area2"}], "encounters": [], "npcs": []}
  ],
  "npcs": [
    {"id": "npc.character1", "type": "NPC", "name": "Name", "description": "Description", "race": "Race", "class": "Class", "alignment": "Alignment", "attitude": "friendly", "statblock": {"ac": 14, "hp": 30, "cr": "1"}}
  ],
  "encounters": [
    {"id": "encounter.event1", "type": "Encounter", "name": "Name", "description": "Description", "encounterType": "combat", "difficulty": "medium", "enemies": [], "rewards": {"xp": 100, "gold": 25}}
  ],
  "quests": [
    {"id": "quest.main1", "type": "Quest", "name": "Name", "description": "Description", "objectives": [{"id": "obj1", "description": "Objective"}], "rewards": {"xp": 200, "gold": 50}}
  ],
  "items": [
    {"id": "item.treasure1", "type": "Item", "name": "Name", "description": "Description", "itemType": "wondrous", "rarity": "uncommon"}
  ]
}

IMPORTANT: Replace all placeholders with creative, detailed D&D content. Every array must have multiple entries!`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: "You are a creative D&D adventure designer. Always generate complete, detailed adventures with all arrays fully populated. Never return empty arrays."
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        max_tokens: 8000,
        temperature: 0.8
      });
      
      const generatedAdventure = JSON.parse(response.choices[0].message.content || '{}');
      
      res.json({
        success: true,
        adventure: generatedAdventure,
        yaml: exportToYAML(generatedAdventure),
        json: exportToJSON(generatedAdventure)
      });
    } catch (error) {
      console.error("Failed to generate CAML adventure:", error);
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
      
      const graph = buildAdventureGraph(pack);
      
      res.json({
        success: true,
        adventure: pack.adventure,
        entityCount: Object.keys(pack.entities).length,
        graph
      });
    } catch (error) {
      console.error("Failed to parse CAML:", error);
      res.status(500).json({ message: "Failed to parse CAML content" });
    }
  });

  return httpServer;
}
