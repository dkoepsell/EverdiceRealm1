import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  displayName: text("display_name"),
  lastLogin: text("last_login"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  displayName: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// User sessions for authentication
export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  lastUsed: text("last_used"),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
});

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
});

export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type UserSession = typeof userSessions.$inferSelect;

// Character schema with XP tracking and portrait generation
export const characters = pgTable("characters", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  race: text("race").notNull(),
  class: text("class").notNull(),
  level: integer("level").notNull().default(1),
  background: text("background"),
  alignment: text("alignment"),
  strength: integer("strength").notNull(),
  dexterity: integer("dexterity").notNull(),
  constitution: integer("constitution").notNull(),
  intelligence: integer("intelligence").notNull(),
  wisdom: integer("wisdom").notNull(),
  charisma: integer("charisma").notNull(),
  hitPoints: integer("hit_points").notNull(),
  maxHitPoints: integer("max_hit_points").notNull(),
  armorClass: integer("armor_class").notNull(),
  experience: integer("experience").notNull().default(0),
  // Combat status: conscious, unconscious, dead, stabilized
  status: text("status").default("conscious"),
  // Death saving throws tracking
  deathSaveSuccesses: integer("death_save_successes").default(0),
  deathSaveFailures: integer("death_save_failures").default(0),
  skills: text("skills").array(),
  equipment: text("equipment").array(),
  // Equipment slots - what is actively equipped
  equippedWeapon: text("equipped_weapon"),
  equippedArmor: text("equipped_armor"),
  equippedShield: text("equipped_shield"),
  equippedAccessory: text("equipped_accessory"),
  // Skill progression tracking - stores {skillName: {uses: number, bonus: number}}
  skillProgress: jsonb("skill_progress").default({}),
  // Currency tracking (D&D standard: 10cp=1sp, 10sp=1gp, 10gp=1pp)
  gold: integer("gold").default(0),
  silver: integer("silver").default(0),
  copper: integer("copper").default(0),
  platinum: integer("platinum").default(0),
  // Consumable items - [{name, type, effect, quantity}]
  consumables: jsonb("consumables").default([]),
  // Resurrection tracking
  deathTimestamp: text("death_timestamp"),
  resurrectedAt: text("resurrected_at"),
  // New fields for character visualization
  appearance: text("appearance"),
  portraitUrl: text("portrait_url"),
  backgroundStory: text("background_story"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const insertCharacterSchema = createInsertSchema(characters).omit({
  id: true,
});

export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type Character = typeof characters.$inferSelect;

// Items database with D&D 5e stats
export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  type: text("type").notNull(), // weapon, armor, shield, accessory, consumable
  rarity: text("rarity").default("common"), // common, uncommon, rare, very_rare, legendary
  description: text("description"),
  // Weapon stats
  damageDice: text("damage_dice"), // e.g., "1d8", "2d6"
  damageType: text("damage_type"), // slashing, piercing, bludgeoning, fire, etc.
  weaponType: text("weapon_type"), // simple, martial
  weaponRange: text("weapon_range"), // melee, ranged
  attackBonus: integer("attack_bonus").default(0), // magic weapon bonus
  properties: text("properties").array(), // finesse, versatile, two-handed, etc.
  // Armor stats
  baseAC: integer("base_ac"), // Base AC provided (e.g., 14 for chain shirt)
  maxDexBonus: integer("max_dex_bonus"), // Max dex modifier allowed (null = unlimited)
  stealthDisadvantage: boolean("stealth_disadvantage").default(false),
  strengthRequirement: integer("strength_requirement"), // Min STR to wear without penalty
  armorType: text("armor_type"), // light, medium, heavy, shield
  // General stats
  weight: integer("weight").default(0), // Weight in pounds
  value: integer("value").default(0), // Value in gold pieces
  requiresAttunement: boolean("requires_attunement").default(false),
  magicBonus: integer("magic_bonus").default(0), // +1, +2, +3 magic items
  specialEffect: text("special_effect"), // Special magical effects
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertItemSchema = createInsertSchema(items).omit({
  id: true,
});

export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof items.$inferSelect;

// Campaign schema with archive functionality, XP rewards, and multi-user support
export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // Campaign creator/DM
  title: text("title").notNull(),
  description: text("description"),
  difficulty: text("difficulty").notNull(),
  narrativeStyle: text("narrative_style").notNull(),
  currentSession: integer("current_session").notNull().default(1),
  currentTurnUserId: integer("current_turn_user_id"), // Current player's turn
  isTurnBased: boolean("is_turn_based").default(false), // Whether campaign is turn-based
  turnTimeLimit: integer("turn_time_limit"), // Time limit in seconds (null = no limit)
  turnStartedAt: text("turn_started_at"), // Timestamp of when current turn started
  xpReward: integer("xp_reward").default(0),
  isArchived: boolean("is_archived").default(false),
  isCompleted: boolean("is_completed").default(false),
  completedAt: text("completed_at"),
  // Campaign deployment features
  isPublished: boolean("is_published").default(false), // Whether campaign is published for others
  publishedAt: text("published_at"), // When the campaign was published
  deploymentCode: text("deployment_code"), // Unique code for joining this campaign
  isPrivate: boolean("is_private").default(true), // Whether the campaign requires code to join
  maxPlayers: integer("max_players").default(6), // Maximum number of players allowed
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
});

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

// Campaign participants join table for multi-user campaigns
export const campaignParticipants = pgTable("campaign_participants", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  userId: integer("user_id").notNull(),
  characterId: integer("character_id").notNull(), // Character used in this campaign
  role: text("role").notNull().default("player"), // DM or player
  turnOrder: integer("turn_order"), // Position in turn order (null = not turn-based)
  isActive: boolean("is_active").default(true), // Whether participant is active
  joinedAt: text("joined_at").notNull(),
  lastActiveAt: text("last_active_at"), // Last time they took a turn
});

export const insertCampaignParticipantSchema = createInsertSchema(campaignParticipants).omit({
  id: true,
});

export type InsertCampaignParticipant = z.infer<typeof insertCampaignParticipantSchema>;
export type CampaignParticipant = typeof campaignParticipants.$inferSelect;

// Campaign session schema with enhanced story continuity tracking
export const campaignSessions = pgTable("campaign_sessions", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  sessionNumber: integer("session_number").notNull(),
  title: text("title").notNull(),
  narrative: text("narrative").notNull(), // Current narrative shown to players
  location: text("location"),
  choices: jsonb("choices").notNull(), // Available choices for players
  sessionXpReward: integer("session_xp_reward").default(0),
  isCompleted: boolean("is_completed").default(false),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
  // Enhanced story continuity fields
  previousSessionResult: jsonb("previous_session_result"), // What happened in previous session
  storyState: jsonb("story_state"), // Current story context and state
  dmNarrative: text("dm_narrative"), // What DM sees (fuller context)
  playerChoicesMade: jsonb("player_choices_made"), // Choices already made by players
  pendingEvents: jsonb("pending_events"), // Events queued for this session
  npcInteractions: jsonb("npc_interactions"), // Active NPCs and their states
  isInCombat: boolean("is_in_combat").default(false),
  combatState: jsonb("combat_state"), // Initiative order, HP, conditions
  quickContentGenerated: jsonb("quick_content_generated"), // DM-generated content for this session
});

export const insertCampaignSessionSchema = createInsertSchema(campaignSessions).omit({
  id: true,
});

export type InsertCampaignSession = z.infer<typeof insertCampaignSessionSchema>;
export type CampaignSession = typeof campaignSessions.$inferSelect;

// Table for tracking adventure completions and XP rewards
export const adventureCompletions = pgTable("adventure_completions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  characterId: integer("character_id").notNull(),
  campaignId: integer("campaign_id").notNull(),
  xpAwarded: integer("xp_awarded").notNull(),
  completedAt: text("completed_at").notNull(),
  notes: text("notes"),
});

export const insertAdventureCompletionSchema = createInsertSchema(adventureCompletions).omit({
  id: true,
});

export type InsertAdventureCompletion = z.infer<typeof insertAdventureCompletionSchema>;
export type AdventureCompletion = typeof adventureCompletions.$inferSelect;

// Dice roll history
export const diceRolls = pgTable("dice_rolls", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  characterId: integer("character_id"),
  diceType: text("dice_type").notNull(),
  result: integer("result").notNull(),
  modifier: integer("modifier").default(0),
  count: integer("count").default(1), // Adding count field with default of 1
  purpose: text("purpose"),
  createdAt: text("created_at").notNull(),
});

export const insertDiceRollSchema = createInsertSchema(diceRolls).omit({
  id: true,
});

export type InsertDiceRoll = z.infer<typeof insertDiceRollSchema>;
export type DiceRoll = typeof diceRolls.$inferSelect;

// D&D Learning Content
export const learningContent = pgTable("learning_content", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(), // character_creation, combat, spells, etc.
  content: text("content").notNull(),
  difficulty: text("difficulty").notNull().default("beginner"), // beginner, intermediate, advanced
  relatedRules: text("related_rules"),
  examples: jsonb("examples").default([]),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at"),
});

export const insertLearningContentSchema = createInsertSchema(learningContent).omit({
  id: true,
});

export type InsertLearningContent = z.infer<typeof insertLearningContentSchema>;
export type LearningContent = typeof learningContent.$inferSelect;

// DM Tools - Adventure Templates
export const adventureTemplates = pgTable("adventure_templates", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  structure: jsonb("structure").notNull(), // JSON containing adventure structure
  difficultyRange: text("difficulty_range").notNull(),
  recommendedLevels: text("recommended_levels").notNull(),
  tags: text("tags").array(),
  isPublic: boolean("is_public").default(true),
  createdBy: integer("created_by").notNull(), // User ID
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at"),
});

export const insertAdventureTemplateSchema = createInsertSchema(adventureTemplates).omit({
  id: true,
});

export type InsertAdventureTemplate = z.infer<typeof insertAdventureTemplateSchema>;
export type AdventureTemplate = typeof adventureTemplates.$inferSelect;

// DM Tools - Encounter Builder
export const encounters = pgTable("encounters", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  monsterList: jsonb("monster_list").notNull(), // List of monsters with stats
  difficulty: text("difficulty").notNull(),
  environment: text("environment"),
  treasureRewards: jsonb("treasure_rewards").default([]),
  xpReward: integer("xp_reward").default(0),
  notes: text("notes"),
  createdBy: integer("created_by").notNull(), // User ID
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at"),
});

export const insertEncounterSchema = createInsertSchema(encounters).omit({
  id: true,
});

export type InsertEncounter = z.infer<typeof insertEncounterSchema>;
export type Encounter = typeof encounters.$inferSelect;

// Adventure building blocks - NPCs, locations, quests, etc.
export const adventureElements = pgTable("adventure_elements", {
  id: serial("id").primaryKey(),
  elementType: text("element_type").notNull(), // npc, location, quest, item, etc.
  title: text("title").notNull(),
  description: text("description").notNull(),
  details: jsonb("details").notNull(), // Element-specific details
  isPublic: boolean("is_public").default(false),
  createdBy: integer("created_by").notNull(), // User ID
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at"),
});

export const insertAdventureElementSchema = createInsertSchema(adventureElements).omit({
  id: true,
});

export type InsertAdventureElement = z.infer<typeof insertAdventureElementSchema>;
export type AdventureElement = typeof adventureElements.$inferSelect;

// Dedicated NPC table with companion functionality
export const npcs = pgTable("npcs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  race: text("race").notNull(),
  occupation: text("occupation").notNull(),
  personality: text("personality").notNull(),
  appearance: text("appearance").notNull(),
  motivation: text("motivation").notNull(),
  // NPC companion functionality
  isCompanion: boolean("is_companion").default(false),
  isStockCompanion: boolean("is_stock_companion").default(false), // Indicates a pre-made companion
  companionType: text("companion_type"), // combat, support, utility, social, etc.
  aiPersonality: text("ai_personality"), // For AI-driven behavior
  combatAbilities: jsonb("combat_abilities").default([]), // Combat moves and abilities
  supportAbilities: jsonb("support_abilities").default([]), // Healing, buffing, etc.
  decisionMakingRules: jsonb("decision_making_rules").default({}), // Rules for automated decisions
  level: integer("level").default(1),
  hitPoints: integer("hit_points"),
  maxHitPoints: integer("max_hit_points"),
  armorClass: integer("armor_class"),
  strength: integer("strength"),
  dexterity: integer("dexterity"),
  constitution: integer("constitution"),
  intelligence: integer("intelligence"),
  wisdom: integer("wisdom"),
  charisma: integer("charisma"),
  skills: text("skills").array(),
  equipment: text("equipment").array(),
  consumables: jsonb("consumables").default([]),
  gold: integer("gold").default(0),
  equippedWeapon: text("equipped_weapon"),
  equippedArmor: text("equipped_armor"),
  equippedShield: text("equipped_shield"),
  equippedAccessory: text("equipped_accessory"),
  status: text("status").default("conscious"),
  portraitUrl: text("portrait_url"),
  isPublic: boolean("is_public").default(false),
  createdBy: integer("created_by").notNull(), // User ID
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at"),
});

export const insertNpcSchema = createInsertSchema(npcs).omit({
  id: true,
});

export type InsertNpc = z.infer<typeof insertNpcSchema>;
export type Npc = typeof npcs.$inferSelect;

// Campaign NPC companions join table
export const campaignNpcs = pgTable("campaign_npcs", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  npcId: integer("npc_id").notNull(),
  role: text("role").notNull().default("companion"), // companion, ally, neutral, enemy
  turnOrder: integer("turn_order"), // Position in turn order (null = not turn-based)
  isActive: boolean("is_active").default(true), // Whether NPC is active
  joinedAt: text("joined_at").notNull().default(new Date().toISOString()),
  lastActiveAt: text("last_active_at"), // Last time they took a turn
  // Override NPC default behavior
  customBehaviorRules: jsonb("custom_behavior_rules").default({}),
  controlledBy: integer("controlled_by"), // User ID of player who controls this NPC, null = AI controlled
});

export const insertCampaignNpcSchema = createInsertSchema(campaignNpcs).omit({
  id: true,
});

export type InsertCampaignNpc = z.infer<typeof insertCampaignNpcSchema>;
export type CampaignNpc = typeof campaignNpcs.$inferSelect;

// Invitation system for campaigns
export const campaignInvitations = pgTable("campaign_invitations", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  inviteCode: text("invite_code").notNull().unique(), // Unique code for joining
  email: text("email"), // Optional email for direct invites
  role: text("role").notNull().default("player"), // Default role for the invitee (player, observer, co-dm)
  status: text("status").notNull().default("pending"), // pending, accepted, declined, expired
  createdBy: integer("created_by").notNull(), // User ID who created the invite
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  expiresAt: text("expires_at"), // When the invitation expires
  usedAt: text("used_at"), // When the invitation was used
  maxUses: integer("max_uses").default(1), // How many times the invite can be used
  useCount: integer("use_count").default(0), // How many times the invite has been used
  notes: text("notes"), // Optional notes about the invitation
});

export const insertCampaignInvitationSchema = createInsertSchema(campaignInvitations).omit({
  id: true,
  useCount: true,
});

export type InsertCampaignInvitation = z.infer<typeof insertCampaignInvitationSchema>;
export type CampaignInvitation = typeof campaignInvitations.$inferSelect;

// DM private notes for campaigns
export const dmNotes = pgTable("dm_notes", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  isPrivate: boolean("is_private").notNull().default(true), // Whether note is private to DM only
  relatedEntityType: text("related_entity_type"), // Optional: npc, location, etc.
  relatedEntityId: integer("related_entity_id"), // Optional: ID of related entity
  createdBy: integer("created_by").notNull(), // User ID who created the note
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at"),
});

export const insertDmNoteSchema = createInsertSchema(dmNotes).omit({
  id: true,
});

export type InsertDmNote = z.infer<typeof insertDmNoteSchema>;
export type DmNote = typeof dmNotes.$inferSelect;

// Locations schema
export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  environment: text("environment"), // dungeon, forest, city, etc.
  climate: text("climate"), // temperate, tropical, arctic, etc.
  terrain: text("terrain"), // rocky, swampy, mountainous, etc.
  notable_features: text("notable_features").array().default([]),
  inhabitants: text("inhabitants").array().default([]),
  secrets: text("secrets"),
  hooks: text("hooks").array().default([]),
  created_by: integer("created_by").notNull(),
  is_public: boolean("is_public").default(false),
  created_at: timestamp("created_at").defaultNow(),
});

export const insertLocationSchema = createInsertSchema(locations).omit({
  id: true,
});

export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locations.$inferSelect;

// Quests schema
export const quests = pgTable("quests", {
  id: serial("id").primaryKey(),
  campaign_id: integer("campaign_id"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  rewards: jsonb("rewards").default({}),
  status: text("status").notNull().default("draft"), // draft, active, completed, abandoned
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const insertQuestSchema = createInsertSchema(quests).omit({
  id: true,
});

export type InsertQuest = z.infer<typeof insertQuestSchema>;
export type Quest = typeof quests.$inferSelect;

// Magic Items schema
export const magicItems = pgTable("magic_items", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // weapon, armor, wondrous, potion, scroll, etc.
  rarity: text("rarity").notNull(), // common, uncommon, rare, very rare, legendary, artifact
  description: text("description").notNull(),
  requires_attunement: boolean("requires_attunement").default(false),
  notes: text("notes"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const insertMagicItemSchema = createInsertSchema(magicItems).omit({
  id: true,
});

export type InsertMagicItem = z.infer<typeof insertMagicItemSchema>;
export type MagicItem = typeof magicItems.$inferSelect;

// Monsters schema
export const monsters = pgTable("monsters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // beast, humanoid, undead, etc.
  size: text("size").notNull(), // tiny, small, medium, large, huge, gargantuan
  challenge_rating: text("challenge_rating").notNull(),
  armor_class: integer("armor_class").notNull(),
  hit_points: integer("hit_points").notNull(),
  speed: text("speed").notNull(),
  stats: text("stats").notNull(), // Combined ability scores as string
  skills: text("skills").array().default([]),
  resistances: text("resistances").array().default([]),
  immunities: text("immunities").array().default([]),
  senses: text("senses").array().default([]),
  languages: text("languages").array().default([]),
  abilities: text("abilities").array().default([]),
  actions: text("actions").array().default([]),
  description: text("description"),
  environment: text("environment").array().default([]),
  lore: text("lore"), // Background information
  created_by: integer("created_by").notNull(),
  is_public: boolean("is_public").default(false),
  created_at: timestamp("created_at").defaultNow(),
});

export const insertMonsterSchema = createInsertSchema(monsters).omit({
  id: true,
});

export type InsertMonster = z.infer<typeof insertMonsterSchema>;
export type Monster = typeof monsters.$inferSelect;

// Chat Messages - Both global and campaign-specific
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  username: text("username").notNull(),
  displayName: text("display_name"),
  message: text("message").notNull(),
  messageType: text("message_type").notNull().default("text"), // text, campaign-link, system, dice-roll
  channelType: text("channel_type").notNull().default("global"), // global, campaign
  campaignId: integer("campaign_id"), // Required for campaign channels, optional for global
  campaignTitle: text("campaign_title"), // For campaign link sharing
  diceRoll: jsonb("dice_roll"), // For dice roll messages
  isEdited: boolean("is_edited").default(false),
  editedAt: text("edited_at"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
});

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// Online Users tracking
export const onlineUsers = pgTable("online_users", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  username: text("username").notNull(),
  displayName: text("display_name"),
  lastSeen: text("last_seen").notNull(),
  socketId: text("socket_id"),
  isInCampaign: boolean("is_in_campaign").default(false),
  currentCampaignId: integer("current_campaign_id"),
});

export const insertOnlineUserSchema = createInsertSchema(onlineUsers).omit({
  id: true,
});

export type InsertOnlineUser = z.infer<typeof insertOnlineUserSchema>;
export type OnlineUser = typeof onlineUsers.$inferSelect;
