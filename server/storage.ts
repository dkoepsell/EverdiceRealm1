import { 
  users, type User, type InsertUser,
  characters, type Character, type InsertCharacter,
  campaigns, type Campaign, type InsertCampaign,
  campaignSessions, type CampaignSession, type InsertCampaignSession,
  diceRolls, type DiceRoll, type InsertDiceRoll,
  userSessions, type UserSession, type InsertUserSession,
  adventureCompletions, type AdventureCompletion, type InsertAdventureCompletion,
  campaignParticipants, type CampaignParticipant, type InsertCampaignParticipant,
  // New schema imports for DM tools and learning content
  learningContent, type LearningContent, type InsertLearningContent,
  adventureTemplates, type AdventureTemplate, type InsertAdventureTemplate,
  encounters, type Encounter, type InsertEncounter,
  adventureElements, type AdventureElement, type InsertAdventureElement,
  // NPC companion imports
  npcs, type Npc, type InsertNpc,
  campaignNpcs, type CampaignNpc, type InsertCampaignNpc,
  // Live Campaign Management imports
  campaignInvitations, type CampaignInvitation, type InsertCampaignInvitation,
  dmNotes, type DmNote, type InsertDmNote
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, asc, or } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLastLogin(userId: number): Promise<void>;
  
  // User Session operations
  createUserSession(session: InsertUserSession): Promise<UserSession>;
  getUserSession(token: string): Promise<UserSession | undefined>;
  deleteUserSession(token: string): Promise<boolean>;
  deleteUserSessionsForUser(userId: number): Promise<boolean>;
  
  // Character operations
  getAllCharacters(): Promise<Character[]>;
  getCharacter(id: number): Promise<Character | undefined>;
  createCharacter(character: InsertCharacter): Promise<Character>;
  updateCharacter(id: number, character: Partial<Character>): Promise<Character | undefined>;
  deleteCharacter(id: number): Promise<boolean>;
  
  // Campaign operations
  getAllCampaigns(): Promise<Campaign[]>;
  getArchivedCampaigns(): Promise<Campaign[]>;
  getCampaign(id: number): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: number, campaign: Partial<Campaign>): Promise<Campaign | undefined>;
  updateCampaignSession(id: number, sessionNumber: number): Promise<Campaign | undefined>;
  archiveCampaign(id: number): Promise<Campaign | undefined>;
  completeCampaign(id: number): Promise<Campaign | undefined>;
  deleteCampaign(id: number): Promise<boolean>;
  
  // Campaign Participant operations
  getCampaignParticipants(campaignId: number): Promise<CampaignParticipant[]>;
  getCampaignParticipant(campaignId: number, userId: number): Promise<CampaignParticipant | undefined>;
  addCampaignParticipant(participant: InsertCampaignParticipant): Promise<CampaignParticipant>;
  updateCampaignParticipant(id: number, updates: Partial<CampaignParticipant>): Promise<CampaignParticipant | undefined>;
  removeCampaignParticipant(campaignId: number, userId: number): Promise<boolean>;
  
  // Turn-based campaign operations
  getCurrentTurn(campaignId: number): Promise<{ userId: number; startedAt: string } | undefined>;
  startNextTurn(campaignId: number): Promise<{ userId: number; startedAt: string } | undefined>;
  endCurrentTurn(campaignId: number): Promise<boolean>;
  
  // Campaign Session operations
  getCampaignSession(campaignId: number, sessionNumber: number): Promise<CampaignSession | undefined>;
  getCampaignSessions(campaignId: number): Promise<CampaignSession[]>;
  createCampaignSession(session: InsertCampaignSession): Promise<CampaignSession>;
  
  // Dice Roll operations
  createDiceRoll(diceRoll: InsertDiceRoll): Promise<DiceRoll>;
  getDiceRollHistory(userId: number, limit?: number): Promise<DiceRoll[]>;
  
  // Adventure Completion operations
  createAdventureCompletion(completion: InsertAdventureCompletion): Promise<AdventureCompletion>;
  getCompletionsForUser(userId: number): Promise<AdventureCompletion[]>;
  getCompletionsForCharacter(characterId: number): Promise<AdventureCompletion[]>;
  
  // XP Management operations
  awardXPToCharacter(characterId: number, xpAmount: number): Promise<Character | undefined>;
  
  // Learning Content operations
  getAllLearningContent(): Promise<LearningContent[]>;
  getLearningContentByCategory(category: string): Promise<LearningContent[]>;
  getLearningContent(id: number): Promise<LearningContent | undefined>;
  createLearningContent(content: InsertLearningContent): Promise<LearningContent>;
  updateLearningContent(id: number, content: Partial<LearningContent>): Promise<LearningContent | undefined>;
  deleteLearningContent(id: number): Promise<boolean>;
  
  // Adventure Template operations
  getAllAdventureTemplates(): Promise<AdventureTemplate[]>;
  getPublicAdventureTemplates(): Promise<AdventureTemplate[]>;
  getUserAdventureTemplates(userId: number): Promise<AdventureTemplate[]>;
  getAdventureTemplate(id: number): Promise<AdventureTemplate | undefined>;
  createAdventureTemplate(template: InsertAdventureTemplate): Promise<AdventureTemplate>;
  updateAdventureTemplate(id: number, template: Partial<AdventureTemplate>): Promise<AdventureTemplate | undefined>;
  deleteAdventureTemplate(id: number): Promise<boolean>;
  
  // Encounter operations
  getEncountersByCampaign(campaignId: number): Promise<Encounter[]>;
  getUserEncounters(userId: number): Promise<Encounter[]>;
  getEncounter(id: number): Promise<Encounter | undefined>;
  createEncounter(encounter: InsertEncounter): Promise<Encounter>;
  updateEncounter(id: number, encounter: Partial<Encounter>): Promise<Encounter | undefined>;
  deleteEncounter(id: number): Promise<boolean>;
  
  // Adventure Elements operations 
  getAdventureElementsByType(elementType: string): Promise<AdventureElement[]>;
  getUserAdventureElements(userId: number): Promise<AdventureElement[]>;
  getPublicAdventureElements(): Promise<AdventureElement[]>;
  getAdventureElement(id: number): Promise<AdventureElement | undefined>;
  createAdventureElement(element: InsertAdventureElement): Promise<AdventureElement>;
  updateAdventureElement(id: number, element: Partial<AdventureElement>): Promise<AdventureElement | undefined>;
  deleteAdventureElement(id: number): Promise<boolean>;
  
  // NPC operations
  getAllNpcs(): Promise<Npc[]>;
  getUserNpcs(userId: number): Promise<Npc[]>;
  getCompanionNpcs(userId: number): Promise<Npc[]>;
  getNpc(id: number): Promise<Npc | undefined>;
  createNpc(npc: InsertNpc): Promise<Npc>;
  updateNpc(id: number, npc: Partial<Npc>): Promise<Npc | undefined>;
  deleteNpc(id: number): Promise<boolean>;
  
  // Campaign NPC operations
  getCampaignNpcs(campaignId: number): Promise<CampaignNpc[]>;
  getCampaignNpc(campaignId: number, npcId: number): Promise<CampaignNpc | undefined>;
  addNpcToCampaign(campaignNpc: InsertCampaignNpc): Promise<CampaignNpc>;
  updateCampaignNpc(id: number, updates: Partial<CampaignNpc>): Promise<CampaignNpc | undefined>;
  removeNpcFromCampaign(campaignId: number, npcId: number): Promise<boolean>;
  
  // NPC Turn operations
  getNpcTurn(campaignId: number, npcId: number): Promise<{ action: string; target?: number; details?: any } | undefined>;
  simulateNpcTurn(campaignId: number, npcId: number): Promise<{ action: string; target?: number; details?: any; message: string }>;
  
  // Campaign Invitation operations
  createCampaignInvitation(invitation: InsertCampaignInvitation): Promise<CampaignInvitation>;
  getCampaignInvitations(campaignId: number): Promise<CampaignInvitation[]>;
  getCampaignInvitationByCode(inviteCode: string): Promise<CampaignInvitation | undefined>;
  updateCampaignInvitation(id: number, updates: Partial<CampaignInvitation>): Promise<CampaignInvitation | undefined>;
  useInvitation(inviteCode: string): Promise<CampaignInvitation | undefined>;
  deleteCampaignInvitation(id: number): Promise<boolean>;
  
  // DM Notes operations
  createDmNote(note: InsertDmNote): Promise<DmNote>;
  getDmNotes(campaignId: number, createdBy: number): Promise<DmNote[]>;
  getDmNote(id: number): Promise<DmNote | undefined>;
  updateDmNote(id: number, updates: Partial<DmNote>): Promise<DmNote | undefined>;
  deleteDmNote(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private characterStore: Map<number, Character>;
  private campaignStore: Map<number, Campaign>;
  private sessionStore: Map<string, CampaignSession>; // key is campaignId:sessionNumber
  private diceRollStore: Map<number, DiceRoll>;
  
  private userIdCounter: number;
  private characterIdCounter: number;
  private campaignIdCounter: number;
  private sessionIdCounter: number;
  private diceRollIdCounter: number;

  constructor() {
    this.users = new Map();
    this.characterStore = new Map();
    this.campaignStore = new Map();
    this.sessionStore = new Map();
    this.diceRollStore = new Map();
    
    this.userIdCounter = 1;
    this.characterIdCounter = 1;
    this.campaignIdCounter = 1;
    this.sessionIdCounter = 1;
    this.diceRollIdCounter = 1;
    
    // Add sample data for demonstration
    this.initializeSampleData();
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Character operations
  async getAllCharacters(): Promise<Character[]> {
    return Array.from(this.characterStore.values());
  }
  
  async getCharacter(id: number): Promise<Character | undefined> {
    return this.characterStore.get(id);
  }
  
  async createCharacter(insertCharacter: InsertCharacter): Promise<Character> {
    const id = this.characterIdCounter++;
    const character: Character = { ...insertCharacter, id };
    this.characterStore.set(id, character);
    return character;
  }
  
  async updateCharacter(id: number, characterUpdate: Partial<Character>): Promise<Character | undefined> {
    const character = this.characterStore.get(id);
    if (!character) return undefined;
    
    const updatedCharacter = { ...character, ...characterUpdate };
    this.characterStore.set(id, updatedCharacter);
    return updatedCharacter;
  }
  
  async deleteCharacter(id: number): Promise<boolean> {
    return this.characterStore.delete(id);
  }
  
  // Campaign operations
  async getAllCampaigns(): Promise<Campaign[]> {
    return Array.from(this.campaignStore.values());
  }
  
  async getCampaign(id: number): Promise<Campaign | undefined> {
    return this.campaignStore.get(id);
  }
  
  async createCampaign(insertCampaign: InsertCampaign): Promise<Campaign> {
    const id = this.campaignIdCounter++;
    const campaign: Campaign = { ...insertCampaign, id };
    this.campaignStore.set(id, campaign);
    return campaign;
  }
  
  async updateCampaign(id: number, campaignUpdate: Partial<Campaign>): Promise<Campaign | undefined> {
    const campaign = this.campaignStore.get(id);
    if (!campaign) return undefined;
    
    const updatedCampaign = { ...campaign, ...campaignUpdate };
    this.campaignStore.set(id, updatedCampaign);
    return updatedCampaign;
  }
  
  async updateCampaignSession(id: number, sessionNumber: number): Promise<Campaign | undefined> {
    const campaign = this.campaignStore.get(id);
    if (!campaign) return undefined;
    
    const updatedCampaign = { 
      ...campaign, 
      currentSession: sessionNumber 
    };
    this.campaignStore.set(id, updatedCampaign);
    return updatedCampaign;
  }
  
  async deleteCampaign(id: number): Promise<boolean> {
    return this.campaignStore.delete(id);
  }
  
  // Campaign Session operations
  async getCampaignSession(campaignId: number, sessionNumber: number): Promise<CampaignSession | undefined> {
    const key = `${campaignId}:${sessionNumber}`;
    return this.sessionStore.get(key);
  }
  
  async getCampaignSessions(campaignId: number): Promise<CampaignSession[]> {
    const sessions: CampaignSession[] = [];
    for (const session of this.sessionStore.values()) {
      if (session.campaignId === campaignId) {
        sessions.push(session);
      }
    }
    return sessions.sort((a, b) => a.sessionNumber - b.sessionNumber);
  }
  
  async createCampaignSession(insertSession: InsertCampaignSession): Promise<CampaignSession> {
    const id = this.sessionIdCounter++;
    const session: CampaignSession = { ...insertSession, id };
    const key = `${session.campaignId}:${session.sessionNumber}`;
    this.sessionStore.set(key, session);
    return session;
  }
  
  // Dice Roll operations
  async createDiceRoll(insertDiceRoll: InsertDiceRoll): Promise<DiceRoll> {
    const id = this.diceRollIdCounter++;
    const diceRoll: DiceRoll = { ...insertDiceRoll, id };
    this.diceRollStore.set(id, diceRoll);
    return diceRoll;
  }
  
  async getDiceRollHistory(userId: number, limit: number = 10): Promise<DiceRoll[]> {
    const userRolls = Array.from(this.diceRollStore.values())
      .filter(roll => roll.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return userRolls.slice(0, limit);
  }
  
  // Initialize sample data for demonstration
  private async initializeSampleData() {
    // Create sample user
    const user = await this.createUser({
      username: "demo_user",
      password: "password123"
    });
    
    // Create sample character
    const character = await this.createCharacter({
      userId: user.id,
      name: "Thorne Ironfist",
      race: "Dwarf",
      class: "Fighter",
      level: 5,
      background: "Soldier",
      alignment: "Lawful Good",
      strength: 16,
      dexterity: 12,
      constitution: 15,
      intelligence: 10,
      wisdom: 13,
      charisma: 8,
      hitPoints: 45,
      maxHitPoints: 45,
      armorClass: 17,
      skills: ["Athletics", "Perception", "Intimidation", "Survival"],
      equipment: ["Battleaxe", "Chain Mail", "Shield", "Adventurer's Pack"],
      createdAt: new Date().toISOString()
    });
    
    // Create sample campaign
    const campaign = await this.createCampaign({
      userId: user.id,
      title: "The Forgotten Crypts",
      description: "An adventure into ancient crypts filled with undead and forgotten treasures.",
      difficulty: "Normal - Balanced Challenge",
      narrativeStyle: "Descriptive",
      currentSession: 1,
      characters: [character.id],
      createdAt: new Date().toISOString()
    });
    
    // Create sample campaign session
    await this.createCampaignSession({
      campaignId: campaign.id,
      sessionNumber: 1,
      title: "The Ancient Chamber",
      narrative: "The stone door grinds open, revealing a vast chamber bathed in an eerie blue light. Ancient pillars stretch upward to a ceiling lost in shadow, and at the center of the room sits a stone altar.\n\nAs Thorne steps forward, the dust of centuries swirls around his boots. The air feels heavy with magic and danger. The runes etched into the altar begin to glow with increasing intensity.\n\n\"I've seen this before,\" whispers Elyndra, the elven mage in your party. \"This is a binding circle. Something powerful was imprisoned here.\"\n\nA low rumble shakes the chamber, and small stones begin to fall from the ceiling. Whatever was bound here seems to be awakening.",
      choices: [
        {
          action: "Inspect the altar more closely",
          description: "Make an Investigation check to learn more about the altar and its purpose.",
          icon: "search"
        },
        {
          action: "Cast Detect Magic",
          description: "Identify magical auras and their schools of magic within 30 feet.",
          icon: "hand-sparkles"
        },
        {
          action: "Retreat back to the hallway",
          description: "Move away from potential danger to reassess the situation.",
          icon: "running"
        },
        {
          action: "Ready your weapon",
          description: "Prepare for potential combat as the binding weakens.",
          icon: "sword"
        }
      ],
      createdAt: new Date().toISOString()
    });
    
    // Create sample dice rolls
    await this.createDiceRoll({
      userId: user.id,
      characterId: character.id,
      diceType: "d20",
      result: 20,
      modifier: 0,
      purpose: "Attack Roll",
      createdAt: new Date().toISOString()
    });
    
    await this.createDiceRoll({
      userId: user.id,
      characterId: character.id,
      diceType: "d8",
      result: 6,
      modifier: 3,
      purpose: "Damage",
      createdAt: new Date().toISOString()
    });
  }
}

export class DatabaseStorage implements IStorage {
  // NPC operations
  async getAllNpcs(): Promise<Npc[]> {
    return await db.select().from(npcs).orderBy(desc(npcs.createdAt));
  }
  
  async getUserNpcs(userId: number): Promise<Npc[]> {
    return await db.select().from(npcs).where(eq(npcs.createdBy, userId)).orderBy(desc(npcs.createdAt));
  }
  
  async getCompanionNpcs(userId: number): Promise<Npc[]> {
    return await db.select().from(npcs)
      .where(and(
        eq(npcs.createdBy, userId),
        eq(npcs.isCompanion, true)
      ))
      .orderBy(desc(npcs.createdAt));
  }
  
  async getNpc(id: number): Promise<Npc | undefined> {
    const [npc] = await db.select().from(npcs).where(eq(npcs.id, id));
    return npc;
  }
  
  async createNpc(npc: InsertNpc): Promise<Npc> {
    const [createdNpc] = await db.insert(npcs).values(npc).returning();
    return createdNpc;
  }
  
  async updateNpc(id: number, npcUpdate: Partial<Npc>): Promise<Npc | undefined> {
    const [updatedNpc] = await db
      .update(npcs)
      .set({ ...npcUpdate, updatedAt: new Date().toISOString() })
      .where(eq(npcs.id, id))
      .returning();
    return updatedNpc;
  }
  
  async deleteNpc(id: number): Promise<boolean> {
    const result = await db.delete(npcs).where(eq(npcs.id, id));
    return result.rowCount > 0;
  }
  
  // Campaign NPC operations
  async getCampaignNpcs(campaignId: number): Promise<CampaignNpc[]> {
    return await db.select().from(campaignNpcs).where(eq(campaignNpcs.campaignId, campaignId));
  }
  
  async getCampaignNpc(campaignId: number, npcId: number): Promise<CampaignNpc | undefined> {
    const [campaignNpc] = await db.select().from(campaignNpcs)
      .where(and(
        eq(campaignNpcs.campaignId, campaignId),
        eq(campaignNpcs.npcId, npcId)
      ));
    return campaignNpc;
  }
  
  async addNpcToCampaign(campaignNpcData: InsertCampaignNpc): Promise<CampaignNpc> {
    const [campaignNpc] = await db.insert(campaignNpcs).values(campaignNpcData).returning();
    return campaignNpc;
  }
  
  async updateCampaignNpc(id: number, updates: Partial<CampaignNpc>): Promise<CampaignNpc | undefined> {
    const [updatedCampaignNpc] = await db
      .update(campaignNpcs)
      .set(updates)
      .where(eq(campaignNpcs.id, id))
      .returning();
    return updatedCampaignNpc;
  }
  
  async removeNpcFromCampaign(campaignId: number, npcId: number): Promise<boolean> {
    const result = await db.delete(campaignNpcs)
      .where(and(
        eq(campaignNpcs.campaignId, campaignId),
        eq(campaignNpcs.npcId, npcId)
      ));
    return result.rowCount > 0;
  }
  
  // NPC Turn operations
  async getNpcTurn(campaignId: number, npcId: number): Promise<{ action: string; target?: number; details?: any } | undefined> {
    // In a real implementation, this would fetch the last turn action for this NPC
    // For now, return a simple placeholder
    return { action: "wait", details: { reason: "Waiting for the right moment" } };
  }
  
  async simulateNpcTurn(campaignId: number, npcId: number): Promise<{ action: string; target?: number; details?: any; message: string }> {
    // This would use the NPC's AI persona to determine their next action
    // In a real implementation, this would be much more sophisticated
    const [npc] = await db.select().from(npcs).where(eq(npcs.id, npcId));
    
    if (!npc) {
      return { 
        action: "error", 
        message: "NPC not found" 
      };
    }
    
    // Simple behavior based on companion type
    let action: string;
    let details: any = {};
    let message: string;
    
    if (npc.companionType === "combat") {
      action = "attack";
      details = { 
        ability: npc.combatAbilities?.[0] || "Basic Attack",
        damage: Math.floor(Math.random() * 10) + 1 + Math.floor((npc.strength - 10) / 2)
      };
      message = `${npc.name} uses ${details.ability} for ${details.damage} damage!`;
    } 
    else if (npc.companionType === "support") {
      action = "heal";
      details = { 
        ability: npc.supportAbilities?.[0] || "Healing Touch",
        healing: Math.floor(Math.random() * 8) + 1 + Math.floor((npc.wisdom - 10) / 2)
      };
      message = `${npc.name} uses ${details.ability} to heal for ${details.healing} hit points!`;
    }
    else if (npc.companionType === "utility") {
      action = "utility";
      details = { 
        ability: "Search",
        result: Math.random() > 0.7 ? "success" : "failure"
      };
      message = `${npc.name} ${details.result === "success" ? "successfully searches the area and finds something useful" : "searches but finds nothing of interest"}`;
    }
    else {
      action = "social";
      details = { 
        ability: "Gather Information",
        result: Math.random() > 0.5 ? "success" : "failure"
      };
      message = `${npc.name} ${details.result === "success" ? "successfully gathers some useful information" : "tries to gather information but learns nothing new"}`;
    }
    
    // Update the NPC's last active timestamp in the campaign
    await db
      .update(campaignNpcs)
      .set({ lastActiveAt: new Date().toISOString() })
      .where(
        and(
          eq(campaignNpcs.campaignId, campaignId),
          eq(campaignNpcs.npcId, npcId)
        )
      );
    
    return { action, details, message };
  }
  
  // Campaign Invitation operations
  async createCampaignInvitation(invitation: InsertCampaignInvitation): Promise<CampaignInvitation> {
    // Generate a unique invite code if one isn't provided
    if (!invitation.inviteCode) {
      invitation.inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    }
    
    const [createdInvitation] = await db.insert(campaignInvitations).values(invitation).returning();
    return createdInvitation;
  }
  
  async getCampaignInvitations(campaignId: number): Promise<CampaignInvitation[]> {
    return await db.select().from(campaignInvitations)
      .where(eq(campaignInvitations.campaignId, campaignId))
      .orderBy(desc(campaignInvitations.createdAt));
  }
  
  async getCampaignInvitationByCode(inviteCode: string): Promise<CampaignInvitation | undefined> {
    const [invitation] = await db.select().from(campaignInvitations)
      .where(eq(campaignInvitations.inviteCode, inviteCode));
    return invitation;
  }
  
  async updateCampaignInvitation(id: number, updates: Partial<CampaignInvitation>): Promise<CampaignInvitation | undefined> {
    const [updatedInvitation] = await db
      .update(campaignInvitations)
      .set(updates)
      .where(eq(campaignInvitations.id, id))
      .returning();
    return updatedInvitation;
  }
  
  async useInvitation(inviteCode: string): Promise<CampaignInvitation | undefined> {
    // Get the invitation
    const invitation = await this.getCampaignInvitationByCode(inviteCode);
    
    if (!invitation) {
      return undefined;
    }
    
    // Check if the invitation is valid
    if (invitation.status !== 'pending') {
      return undefined;
    }
    
    // Check if the invitation has reached max uses
    if (invitation.maxUses && invitation.useCount >= invitation.maxUses) {
      // Update status to expired
      await this.updateCampaignInvitation(invitation.id, { status: 'expired' });
      return undefined;
    }
    
    // Update use count and timestamp
    const now = new Date().toISOString();
    const [updatedInvitation] = await db
      .update(campaignInvitations)
      .set({ 
        useCount: (invitation.useCount || 0) + 1,
        usedAt: now,
        // If this was the last use, mark as used
        status: invitation.maxUses && invitation.useCount + 1 >= invitation.maxUses ? 'used' : 'pending'
      })
      .where(eq(campaignInvitations.id, invitation.id))
      .returning();
      
    return updatedInvitation;
  }
  
  async deleteCampaignInvitation(id: number): Promise<boolean> {
    const result = await db.delete(campaignInvitations).where(eq(campaignInvitations.id, id));
    return result.rowCount > 0;
  }
  
  // DM Notes operations
  async createDmNote(note: InsertDmNote): Promise<DmNote> {
    const [createdNote] = await db.insert(dmNotes).values(note).returning();
    return createdNote;
  }
  
  async getDmNotes(campaignId: number, createdBy: number): Promise<DmNote[]> {
    return await db.select().from(dmNotes)
      .where(and(
        eq(dmNotes.campaignId, campaignId),
        eq(dmNotes.createdBy, createdBy)
      ))
      .orderBy(desc(dmNotes.createdAt));
  }
  
  async getDmNote(id: number): Promise<DmNote | undefined> {
    const [note] = await db.select().from(dmNotes).where(eq(dmNotes.id, id));
    return note;
  }
  
  async updateDmNote(id: number, updates: Partial<DmNote>): Promise<DmNote | undefined> {
    const now = new Date().toISOString();
    const [updatedNote] = await db
      .update(dmNotes)
      .set({ 
        ...updates,
        updatedAt: now 
      })
      .where(eq(dmNotes.id, id))
      .returning();
    return updatedNote;
  }
  
  async deleteDmNote(id: number): Promise<boolean> {
    const result = await db.delete(dmNotes).where(eq(dmNotes.id, id));
    return result.rowCount > 0;
  }
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        username: insertUser.username,
        password: insertUser.password
      })
      .returning();
    return user;
  }
  
  async updateUserLastLogin(userId: number): Promise<void> {
    await db
      .update(users)
      .set({ lastLogin: new Date().toISOString() })
      .where(eq(users.id, userId));
  }
  
  // User Session operations
  async createUserSession(session: InsertUserSession): Promise<UserSession> {
    const [userSession] = await db
      .insert(userSessions)
      .values(session)
      .returning();
    return userSession;
  }

  async getUserSession(token: string): Promise<UserSession | undefined> {
    const [session] = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.token, token));
    
    if (session) {
      // Update the lastUsed timestamp
      await db
        .update(userSessions)
        .set({ lastUsed: new Date().toISOString() })
        .where(eq(userSessions.id, session.id));
    }
    
    return session || undefined;
  }

  async deleteUserSession(token: string): Promise<boolean> {
    const result = await db
      .delete(userSessions)
      .where(eq(userSessions.token, token));
    return true; // If no error occurs, consider it successful
  }

  async deleteUserSessionsForUser(userId: number): Promise<boolean> {
    const result = await db
      .delete(userSessions)
      .where(eq(userSessions.userId, userId));
    return true; // If no error occurs, consider it successful
  }
  
  // Character operations
  async getAllCharacters(): Promise<Character[]> {
    return db.select().from(characters);
  }
  
  async getCharacter(id: number): Promise<Character | undefined> {
    const [character] = await db.select().from(characters).where(eq(characters.id, id));
    return character || undefined;
  }
  
  async createCharacter(insertCharacter: InsertCharacter): Promise<Character> {
    const [character] = await db
      .insert(characters)
      .values(insertCharacter)
      .returning();
    return character;
  }
  
  async updateCharacter(id: number, characterUpdate: Partial<Character>): Promise<Character | undefined> {
    const [character] = await db
      .update(characters)
      .set(characterUpdate)
      .where(eq(characters.id, id))
      .returning();
    return character || undefined;
  }
  
  async deleteCharacter(id: number): Promise<boolean> {
    const result = await db
      .delete(characters)
      .where(eq(characters.id, id));
    return true; // If no error occurs, consider it successful
  }
  
  // Campaign operations
  async getAllCampaigns(): Promise<Campaign[]> {
    return db.select().from(campaigns).where(eq(campaigns.isArchived, false));
  }
  
  async getArchivedCampaigns(): Promise<Campaign[]> {
    return db.select().from(campaigns).where(eq(campaigns.isArchived, true));
  }
  
  async getCampaign(id: number): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign || undefined;
  }
  
  async archiveCampaign(id: number): Promise<Campaign | undefined> {
    const [campaign] = await db
      .update(campaigns)
      .set({ 
        isArchived: true,
        updatedAt: new Date().toISOString()
      })
      .where(eq(campaigns.id, id))
      .returning();
    return campaign || undefined;
  }
  
  async completeCampaign(id: number): Promise<Campaign | undefined> {
    const now = new Date().toISOString();
    const [campaign] = await db
      .update(campaigns)
      .set({ 
        isCompleted: true,
        completedAt: now,
        updatedAt: now
      })
      .where(eq(campaigns.id, id))
      .returning();
    return campaign || undefined;
  }
  
  async createCampaign(insertCampaign: InsertCampaign): Promise<Campaign> {
    const [campaign] = await db
      .insert(campaigns)
      .values(insertCampaign)
      .returning();
    return campaign;
  }
  
  async updateCampaign(id: number, campaignUpdate: Partial<Campaign>): Promise<Campaign | undefined> {
    const [campaign] = await db
      .update(campaigns)
      .set(campaignUpdate)
      .where(eq(campaigns.id, id))
      .returning();
    return campaign || undefined;
  }
  
  async updateCampaignSession(id: number, sessionNumber: number): Promise<Campaign | undefined> {
    const [campaign] = await db
      .update(campaigns)
      .set({ currentSession: sessionNumber })
      .where(eq(campaigns.id, id))
      .returning();
    return campaign || undefined;
  }
  
  async deleteCampaign(id: number): Promise<boolean> {
    const result = await db
      .delete(campaigns)
      .where(eq(campaigns.id, id));
    return true; // If no error occurs, consider it successful
  }
  
  // Campaign Participant operations
  async getCampaignParticipants(campaignId: number): Promise<CampaignParticipant[]> {
    return db
      .select()
      .from(campaignParticipants)
      .where(eq(campaignParticipants.campaignId, campaignId))
      .orderBy(asc(campaignParticipants.turnOrder));
  }
  
  async getCampaignParticipant(campaignId: number, userId: number): Promise<CampaignParticipant | undefined> {
    const [participant] = await db
      .select()
      .from(campaignParticipants)
      .where(and(
        eq(campaignParticipants.campaignId, campaignId),
        eq(campaignParticipants.userId, userId)
      ));
    return participant || undefined;
  }
  
  async addCampaignParticipant(participant: InsertCampaignParticipant): Promise<CampaignParticipant> {
    // Determine turn order if it's not provided
    if (!participant.turnOrder) {
      const participants = await this.getCampaignParticipants(participant.campaignId);
      const maxOrder = participants.length > 0 
        ? Math.max(...participants.map(p => p.turnOrder || 0)) 
        : 0;
      participant.turnOrder = maxOrder + 1;
    }
    
    const [newParticipant] = await db
      .insert(campaignParticipants)
      .values({
        ...participant,
      })
      .returning();
      
    return newParticipant;
  }
  
  async updateCampaignParticipant(id: number, updates: Partial<CampaignParticipant>): Promise<CampaignParticipant | undefined> {
    const [updatedParticipant] = await db
      .update(campaignParticipants)
      .set(updates)
      .where(eq(campaignParticipants.id, id))
      .returning();
      
    return updatedParticipant || undefined;
  }
  
  async removeCampaignParticipant(campaignId: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(campaignParticipants)
      .where(and(
        eq(campaignParticipants.campaignId, campaignId),
        eq(campaignParticipants.userId, userId)
      ));
      
    return true; // If no error occurs, consider it successful
  }
  
  // Turn-based campaign operations
  async getCurrentTurn(campaignId: number): Promise<{ userId: number; startedAt: string } | undefined> {
    const [campaign] = await db
      .select({
        userId: campaigns.currentTurnUserId,
        startedAt: campaigns.turnStartedAt
      })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId));
      
    if (!campaign || !campaign.userId || !campaign.startedAt) return undefined;
    return { userId: campaign.userId, startedAt: campaign.startedAt };
  }
  
  async startNextTurn(campaignId: number): Promise<{ userId: number; startedAt: string } | undefined> {
    // Get campaign with current turn info
    const campaign = await this.getCampaign(campaignId);
    if (!campaign || !campaign.isTurnBased) return undefined;
    
    // Get all active participants in turn order
    const participants = await db
      .select()
      .from(campaignParticipants)
      .where(and(
        eq(campaignParticipants.campaignId, campaignId),
        eq(campaignParticipants.isActive, true)
      ))
      .orderBy(asc(campaignParticipants.turnOrder));
      
    if (participants.length === 0) return undefined;
    
    let nextParticipantIndex = 0;
    
    // If there's a current user turn, find the next one
    if (campaign.currentTurnUserId) {
      const currentIndex = participants.findIndex(p => p.userId === campaign.currentTurnUserId);
      if (currentIndex !== -1) {
        nextParticipantIndex = (currentIndex + 1) % participants.length;
      }
    }
    
    const nextParticipant = participants[nextParticipantIndex];
    const now = new Date().toISOString();
    
    // Update the campaign with the next turn
    const [updatedCampaign] = await db
      .update(campaigns)
      .set({
        currentTurnUserId: nextParticipant.userId,
        turnStartedAt: now
      })
      .where(eq(campaigns.id, campaignId))
      .returning();
      
    // Also update the participant's last active time
    await this.updateCampaignParticipant(nextParticipant.id, {
      lastActiveAt: now
    });
      
    return updatedCampaign 
      ? { userId: nextParticipant.userId, startedAt: now } 
      : undefined;
  }
  
  async endCurrentTurn(campaignId: number): Promise<boolean> {
    // This simply marks the current turn as ended, without starting a new one
    const result = await db
      .update(campaigns)
      .set({
        currentTurnUserId: null,
        turnStartedAt: null
      })
      .where(eq(campaigns.id, campaignId));
      
    return true; // If no error occurs, consider it successful
  }
  
  // Campaign Session operations
  async getCampaignSession(campaignId: number, sessionNumber: number): Promise<CampaignSession | undefined> {
    const [session] = await db
      .select()
      .from(campaignSessions)
      .where(and(
        eq(campaignSessions.campaignId, campaignId),
        eq(campaignSessions.sessionNumber, sessionNumber)
      ));
    return session || undefined;
  }
  
  async getCampaignSessions(campaignId: number): Promise<CampaignSession[]> {
    return db
      .select()
      .from(campaignSessions)
      .where(eq(campaignSessions.campaignId, campaignId))
      .orderBy(campaignSessions.sessionNumber);
  }
  
  async createCampaignSession(insertSession: InsertCampaignSession): Promise<CampaignSession> {
    const [session] = await db
      .insert(campaignSessions)
      .values(insertSession)
      .returning();
    return session;
  }
  
  // Dice Roll operations
  async createDiceRoll(insertDiceRoll: InsertDiceRoll): Promise<DiceRoll> {
    const [roll] = await db
      .insert(diceRolls)
      .values(insertDiceRoll)
      .returning();
    return roll;
  }
  
  async getDiceRollHistory(userId: number, limit: number = 10): Promise<DiceRoll[]> {
    return db
      .select()
      .from(diceRolls)
      .where(eq(diceRolls.userId, userId))
      .orderBy(desc(diceRolls.createdAt))
      .limit(limit);
  }
  
  // Adventure Completion operations
  async createAdventureCompletion(completion: InsertAdventureCompletion): Promise<AdventureCompletion> {
    const [adventureCompletion] = await db
      .insert(adventureCompletions)
      .values(completion)
      .returning();
    
    console.log(`Adventure completion recorded for user ${completion.userId}, character ${completion.characterId}, XP: ${completion.xpAwarded}`);
    return adventureCompletion;
  }
  
  async getCompletionsForUser(userId: number): Promise<AdventureCompletion[]> {
    return db
      .select()
      .from(adventureCompletions)
      .where(eq(adventureCompletions.userId, userId))
      .orderBy(desc(adventureCompletions.completedAt));
  }
  
  async getCompletionsForCharacter(characterId: number): Promise<AdventureCompletion[]> {
    return db
      .select()
      .from(adventureCompletions)
      .where(eq(adventureCompletions.characterId, characterId))
      .orderBy(desc(adventureCompletions.completedAt));
  }
  
  // XP Management operations
  async awardXPToCharacter(characterId: number, xpAmount: number): Promise<Character | undefined> {
    // First get current character to calculate proper level
    const character = await this.getCharacter(characterId);
    if (!character) {
      return undefined;
    }
    
    // Calculate new XP and level
    const newTotalXP = (character.experience || 0) + xpAmount;
    const newLevel = this.calculateLevelFromXP(newTotalXP);
    
    // Update the character
    const [updatedCharacter] = await db
      .update(characters)
      .set({ 
        experience: newTotalXP,
        level: newLevel,
        updatedAt: new Date().toISOString()
      })
      .where(eq(characters.id, characterId))
      .returning();
      
    console.log(`Awarded ${xpAmount} XP to character ${characterId}, new total: ${newTotalXP}, new level: ${newLevel}`);
    return updatedCharacter || undefined;
  }
  
  // Helper method to calculate character level from XP
  private calculateLevelFromXP(xp: number): number {
    // Standard D&D 5e XP table
    if (xp < 300) return 1;
    if (xp < 900) return 2;
    if (xp < 2700) return 3;
    if (xp < 6500) return 4;
    if (xp < 14000) return 5;
    if (xp < 23000) return 6;
    if (xp < 34000) return 7;
    if (xp < 48000) return 8;
    if (xp < 64000) return 9;
    if (xp < 85000) return 10;
    if (xp < 100000) return 11;
    if (xp < 120000) return 12;
    if (xp < 140000) return 13;
    if (xp < 165000) return 14;
    if (xp < 195000) return 15;
    if (xp < 225000) return 16;
    if (xp < 265000) return 17;
    if (xp < 305000) return 18;
    if (xp < 355000) return 19;
    return 20; // Max level in D&D 5e
  }

  // Initialize sample data for demonstration if needed
  // Create a selection of pre-made companion NPCs for easy addition to campaigns
  async createStockCompanions() {
    console.log("Creating stock companion NPCs...");
    const systemUserId = 1; // System user ID for stock content
    
    // Check if we already have a system user, if not create one
    let systemUser = await this.getUserByUsername("system");
    if (!systemUser) {
      systemUser = await this.createUser({
        username: "system",
        password: Math.random().toString(36).slice(2) + Math.random().toString(36).toUpperCase().slice(2)
      });
    }
    
    // Define our stock companion NPCs with different roles/types
    const stockCompanions = [
      {
        name: "Grimshaw the Guardian",
        race: "Half-Orc",
        occupation: "Battle-Hardened Mercenary",
        personality: "Stoic, protective, and loyal. Grimshaw rarely speaks but when he does, his words carry weight. He views protecting the party as his sacred duty.",
        appearance: "Tall and muscular with gray-green skin, scarred face, and a permanent scowl. Wears heavy plate armor adorned with battle trophies.",
        motivation: "Seeking redemption for past failures by protecting others at any cost.",
        isCompanion: true,
        isStockCompanion: true,
        companionType: "combat",
        aiPersonality: "protective, tactical, self-sacrificing",
        level: 5,
        hitPoints: 60,
        maxHitPoints: 60,
        armorClass: 18,
        strength: 18,
        dexterity: 12,
        constitution: 16,
        intelligence: 10,
        wisdom: 14,
        charisma: 8,
        skills: ["Athletics", "Intimidation", "Perception", "Survival"],
        equipment: ["Greatsword", "Heavy Crossbow", "Plate Armor", "Tower Shield", "Healing Potions (3)"],
        combatAbilities: JSON.stringify([
          "Protective Strike: Disadvantage on attacks against allies within 5 feet",
          "Second Wind: Once per rest, regain 1d10+5 hit points as a bonus action",
          "Cleaving Attack: After dropping a foe, can make another attack"
        ]),
        createdBy: systemUser.id
      },
      {
        name: "Lyra Moonshadow",
        race: "Wood Elf",
        occupation: "Wilderness Guide & Healer",
        personality: "Calm, observant, and deeply connected to nature. Lyra speaks softly but with great wisdom, serving as both moral compass and medic.",
        appearance: "Slender with copper skin, auburn hair in intricate braids adorned with feathers and small wooden beads. Wears practical leather armor with nature motifs.",
        motivation: "Seeking to preserve the balance of nature and help others find harmony with the world.",
        isCompanion: true,
        isStockCompanion: true,
        companionType: "support",
        aiPersonality: "nurturing, observant, peacemaker",
        level: 4,
        hitPoints: 32,
        maxHitPoints: 32,
        armorClass: 15,
        strength: 10,
        dexterity: 16,
        constitution: 12,
        intelligence: 13,
        wisdom: 18,
        charisma: 14,
        skills: ["Nature", "Medicine", "Perception", "Survival", "Animal Handling"],
        equipment: ["Longbow", "Healer's Kit", "Herb Pouch", "Druidic Focus", "Studded Leather"],
        supportAbilities: JSON.stringify([
          "Healing Word: Restore 1d4+4 hit points to an ally within 60 feet",
          "Goodberry: Create 10 berries that each restore 1 hit point and provide nourishment",
          "Pass Without Trace: Help the group move stealthily through natural environments"
        ]),
        createdBy: systemUser.id
      },
      {
        name: "Fizwick Gearloose",
        race: "Rock Gnome",
        occupation: "Tinkerer & Trap Expert",
        personality: "Excitable, curious, and always experimenting. Fizwick speaks rapidly, jumping between topics, and is constantly tinkering with gadgets.",
        appearance: "Small with wild white hair that stands up as if electrified. Wears multiple layers of clothes with numerous pockets filled with tools and gadgets.",
        motivation: "Seeking to create the ultimate invention that will make the world a better place.",
        isCompanion: true,
        isStockCompanion: true,
        companionType: "utility",
        aiPersonality: "curious, analytical, resourceful",
        level: 3,
        hitPoints: 24,
        maxHitPoints: 24,
        armorClass: 14,
        strength: 8,
        dexterity: 16,
        constitution: 12,
        intelligence: 18,
        wisdom: 12,
        charisma: 10,
        skills: ["Arcana", "Investigation", "Perception", "Sleight of Hand", "Thieves' Tools"],
        equipment: ["Light Crossbow", "Tinker's Tools", "Alchemist's Supplies", "Bag of Tricks", "Various Gadgets"],
        combatAbilities: JSON.stringify([
          "Smoke Bomb: Create a 10-foot cloud of smoke to obscure vision",
          "Shock Trap: Place a trap that deals 2d6 lightning damage when triggered",
          "Analyze Weakness: Identify vulnerabilities in creatures or structures"
        ]),
        createdBy: systemUser.id
      },
      {
        name: "Valeria Swiftongue",
        race: "Half-Elf",
        occupation: "Traveling Bard & Diplomat",
        personality: "Charming, quick-witted, and sociable. Valeria has a story or song for every occasion and can talk her way out of most trouble.",
        appearance: "Striking with long silver hair, purple eyes, and an enchanting smile. Dresses in colorful but practical traveling clothes with many musical instruments.",
        motivation: "Collecting stories and songs from across the realms to preserve cultural knowledge.",
        isCompanion: true,
        isStockCompanion: true,
        companionType: "social",
        aiPersonality: "diplomatic, entertaining, persuasive",
        level: 4,
        hitPoints: 30,
        maxHitPoints: 30,
        armorClass: 14,
        strength: 10,
        dexterity: 14,
        constitution: 12,
        intelligence: 13,
        wisdom: 12,
        charisma: 18,
        skills: ["Persuasion", "Deception", "Performance", "History", "Insight"],
        equipment: ["Lute", "Rapier", "Fine Clothes", "Disguise Kit", "Light Armor"],
        supportAbilities: JSON.stringify([
          "Bardic Inspiration: Grant allies a d6 bonus to ability checks, attacks, or saves",
          "Countercharm: Protect allies from being charmed or frightened",
          "Song of Rest: Help allies recover additional hit points during short rests"
        ]),
        createdBy: systemUser.id
      },
      {
        name: "Thorne Ironfist",
        race: "Mountain Dwarf",
        occupation: "Former Royal Guard & Weaponsmith",
        personality: "Gruff but fair, with a dry sense of humor. Thorne values honor, craftsmanship, and a well-brewed ale.",
        appearance: "Stocky with a long braided beard adorned with metal rings. Wears heavy armor polished to a shine and carries weapons of his own making.",
        motivation: "Proving the superiority of dwarven craftsmanship and seeking legendary materials for the ultimate weapon.",
        isCompanion: true,
        isStockCompanion: true,
        companionType: "combat",
        aiPersonality: "honorable, practical, stubborn",
        level: 5,
        hitPoints: 55,
        maxHitPoints: 55,
        armorClass: 18,
        strength: 17,
        dexterity: 10,
        constitution: 16,
        intelligence: 12,
        wisdom: 14,
        charisma: 8,
        skills: ["Athletics", "History", "Insight", "Smith's Tools"],
        equipment: ["Warhammer", "Handaxe", "Heavy Crossbow", "Chainmail", "Shield"],
        combatAbilities: JSON.stringify([
          "Shield Master: Use shield to protect allies from area effects",
          "Dwarven Resilience: Advantage on saving throws against poison",
          "Combat Maneuvers: Trip, disarm, or push opponents in battle"
        ]),
        createdBy: systemUser.id
      }
    ];
    
    // Insert stock companions if they don't already exist
    for (const companion of stockCompanions) {
      const existing = await db.select()
        .from(npcs)
        .where(
          and(
            eq(npcs.name, companion.name),
            eq(npcs.isStockCompanion, true)
          )
        );
      
      if (existing.length === 0) {
        await this.createNpc(companion);
        console.log(`Created stock companion: ${companion.name}`);
      }
    }
    
    console.log("Stock companion NPCs created successfully");
  }

  async initializeSampleData() {
    // Always check if we need to create stock NPCs regardless of other data
    const stockNpcs = await db.select().from(npcs).where(eq(npcs.isStockCompanion, true));
    if (stockNpcs.length === 0) {
      await this.createStockCompanions();
    }
    
    // We'll only create other sample data if the users table is empty
    const existingUsers = await db.select().from(users);
    if (existingUsers.length > 0) {
      return; // User data already exists, no need to initialize the rest
    }
    
    // Create sample user
    const user = await this.createUser({
      username: "demo_user",
      password: "password123"
    });
    
    // Create stock companion NPCs
    await this.createStockCompanions();
    
    // Create sample character
    const character = await this.createCharacter({
      userId: user.id,
      name: "Thorne Ironfist",
      race: "Dwarf",
      class: "Fighter",
      level: 5,
      background: "Soldier",
      alignment: "Lawful Good",
      strength: 16,
      dexterity: 12,
      constitution: 15,
      intelligence: 10,
      wisdom: 13,
      charisma: 8,
      hitPoints: 45,
      maxHitPoints: 45,
      armorClass: 17,
      skills: ["Athletics", "Perception", "Intimidation", "Survival"],
      equipment: ["Battleaxe", "Chain Mail", "Shield", "Adventurer's Pack"],
      createdAt: new Date().toISOString()
    });
    
    // Create sample campaign
    const campaign = await this.createCampaign({
      userId: user.id,
      title: "The Forgotten Crypts",
      description: "An adventure into ancient crypts filled with undead and forgotten treasures.",
      difficulty: "Normal - Balanced Challenge",
      narrativeStyle: "Descriptive",
      currentSession: 1,
      characters: [character.id],
      createdAt: new Date().toISOString()
    });
    
    // Create sample campaign session
    await this.createCampaignSession({
      campaignId: campaign.id,
      sessionNumber: 1,
      title: "The Ancient Chamber",
      narrative: "The stone door grinds open, revealing a vast chamber bathed in an eerie blue light. Ancient pillars stretch upward to a ceiling lost in shadow, and at the center of the room sits a stone altar.\n\nAs Thorne steps forward, the dust of centuries swirls around his boots. The air feels heavy with magic and danger. The runes etched into the altar begin to glow with increasing intensity.\n\n\"I've seen this before,\" whispers Elyndra, the elven mage in your party. \"This is a binding circle. Something powerful was imprisoned here.\"\n\nA low rumble shakes the chamber, and small stones begin to fall from the ceiling. Whatever was bound here seems to be awakening.",
      choices: [
        {
          action: "Inspect the altar more closely",
          description: "Make an Investigation check to learn more about the altar and its purpose.",
          icon: "search"
        },
        {
          action: "Cast Detect Magic",
          description: "Identify magical auras and their schools of magic within 30 feet.",
          icon: "hand-sparkles"
        },
        {
          action: "Retreat back to the hallway",
          description: "Move away from potential danger to reassess the situation.",
          icon: "running"
        },
        {
          action: "Ready your weapon",
          description: "Prepare for potential combat as the binding weakens.",
          icon: "sword"
        }
      ],
      createdAt: new Date().toISOString()
    });
    
    // Create sample dice rolls
    await this.createDiceRoll({
      userId: user.id,
      characterId: character.id,
      diceType: "d20",
      result: 20,
      modifier: 0,
      purpose: "Attack Roll",
      createdAt: new Date().toISOString()
    });
    
    await this.createDiceRoll({
      userId: user.id,
      characterId: character.id,
      diceType: "d8",
      result: 6,
      modifier: 3,
      purpose: "Damage",
      createdAt: new Date().toISOString()
    });
  }
}

// Switch from MemStorage to DatabaseStorage
export const storage = new DatabaseStorage();
