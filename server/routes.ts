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
      const character = await storage.createCharacter(characterData);
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
      
      if (character.userId !== req.user.id) {
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
      
      if (character.userId !== req.user.id) {
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
      
      if (character.userId !== req.user.id) {
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
      
      // Implement actual dice rolling
      const { diceType, modifier, purpose } = validatedData;
      const count = validatedData.count || 1; // Default to 1 if count is not provided
      
      // Parse and validate dice type
      let max = 20; // Default to d20
      if (diceType && diceType.startsWith('d')) {
        const parsedMax = parseInt(diceType.substring(1));
        if (!isNaN(parsedMax) && parsedMax > 0) {
          max = parsedMax;
        } else {
          console.warn(`Server: Invalid dice type format: ${diceType}, defaulting to d20`);
        }
      } else {
        console.warn(`Server: Invalid dice type: ${diceType}, defaulting to d20`);
      }
      
      console.log(`Server rolling ${count}d${max} with modifier ${modifier || 0}`);
      
      // Roll the dice the specified number of times
      const rolls: number[] = [];
      for (let i = 0; i < count; i++) {
        const roll = Math.floor(Math.random() * max) + 1;
        console.log(`Server roll ${i+1} result: ${roll}`);
        rolls.push(roll);
      }
      
      // Calculate total
      const rollSum = rolls.reduce((sum, roll) => sum + roll, 0);
      const total = rollSum + (modifier || 0); // Ensure modifier is a number
      
      // Check for critical hit or fumble (only applies to d20)
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
        total,
        isCritical,
        isFumble,
        // Make sure we include these for the client
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

      const promptWithContext = `
You are an expert Dungeon Master for a D&D game with a ${narrativeStyle || "descriptive"} storytelling style.
${campaignContext}
${locationContext}
Difficulty level: ${difficulty || "Normal - Balanced Challenge"}
Story direction preference: ${storyDirection || "balanced mix of combat, roleplay, and exploration"}

Based on the player's action: "${prompt}", generate the next part of the adventure. Include:
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
      
      // TODO: Award XP to all characters involved in this campaign
      
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

      // Calculate new XP and level
      const newXP = (character.xp || 0) + parseInt(xp);
      let newLevel = character.level || 1;
      
      // Simple level calculation (every 1000 XP = 1 level)
      if (newXP >= 1000) {
        newLevel = Math.floor(newXP / 1000) + 1;
      }

      // Update character
      const [updatedCharacter] = await db
        .update(characters)
        .set({
          xp: newXP,
          level: newLevel,
          updatedAt: new Date()
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
      
      // Generate story continuation based on choice and previous context
      const prompt = `
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
- Be CONCISE and ACTION-FOCUSED
- No flowery descriptions of scenery or atmosphere
- Lead with what HAPPENS as a result of the player action
- Keep narrative under 150 words total
- Every sentence must advance the plot or show consequences

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
      {"name": "Enemy Name", "type": "enemy", "maxHp": 30, "currentHp": 30, "ac": 13, "status": "healthy/wounded/bloodied/defeated"}
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
    "enemyDamage": [{"name": "Enemy Name", "damageTaken": 8, "newHp": 22, "defeated": false}],
    "partyDamage": [{"name": "Companion Name", "damageTaken": 5, "newHp": 15, "defeated": false}],
    "combatDescription": "Brief description of the combat exchange",
    "companionActions": [{"name": "Companion Name", "action": "Swung her sword at the goblin", "result": "Hit for 6 damage", "damageDealt": 6}],
    "lootDrops": [{"name": "Gold Coins", "type": "currency", "value": "15 gp", "fromEnemy": "Goblin"}]
  },
  "skillUsed": "Stealth/Perception/Athletics/etc or null if no skill check",
  "rewardItems": [{"name": "Healing Potion", "type": "consumable", "description": "Restores 2d4+2 HP", "rarity": "common"}]
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
      
      // Award XP for successful skill checks and story progression
      if (rollResult) {
        const wasSuccessful = rollResult.total >= (rollResult.dc || 10);
        
        // Track skill usage for progression
        if (skillUsed && skillUsed !== "null") {
          skillProgressUpdate = { skill: skillUsed, wasSuccessful };
        }
        
        if (wasSuccessful) {
          // Award XP based on DC difficulty
          const dc = rollResult.dc || 10;
          if (dc >= 20) xpAwarded += 100; // Very hard
          else if (dc >= 15) xpAwarded += 75; // Hard
          else if (dc >= 10) xpAwarded += 50; // Medium
          else xpAwarded += 25; // Easy
        } else {
          // Small XP for attempting difficult actions even if failed
          xpAwarded += 10;
        }
      } else {
        // Base XP for story participation
        xpAwarded += 25;
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
      
      // Check for defeated enemies and generate additional loot
      if (combatEffects?.enemyDamage) {
        const defeatedEnemies = combatEffects.enemyDamage.filter((e: any) => e.defeated);
        if (defeatedEnemies.length > 0) {
          // Award bonus XP for defeating enemies
          xpAwarded += defeatedEnemies.length * 50;
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

      // Update session with story advancement
      const updatedSession = await storage.advanceSessionStory(campaignId, {
        narrative: storyAdvancement.narrative,
        dmNarrative: storyAdvancement.dmNarrative,
        choices: storyAdvancement.choices,
        storyState: storyAdvancement.storyState,
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

      // Apply XP, items, skill progress, and combat damage to character if there's a participant
      let characterProgression = null;
      // participants already fetched earlier for character info
      if (participants && participants.length > 0) {
        const characterId = participants[0].characterId;
        const character = await storage.getCharacter(characterId);
        if (character) {
          const newXP = (character.experience || 0) + xpAwarded;
          const newLevel = Math.max(1, Math.floor(newXP / 1000) + 1);
          const leveledUp = newLevel > character.level;
          
          // Apply combat damage if any
          const combatEffects = storyAdvancement.combatEffects;
          let newHitPoints = character.hitPoints;
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
              maxHitPoints: character.maxHitPoints,
              combatDescription: combatEffects.combatDescription,
              enemyDamage: combatEffects.enemyDamage,
              partyDamage: combatEffects.partyDamage,
              companionActions: combatEffects.companionActions
            } : null
          };
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
        progression: characterProgression
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

  return httpServer;
}
