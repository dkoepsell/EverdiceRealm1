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
  avatarUrl: text("avatar_url"),
  lastLogin: text("last_login"),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  twoFactorSecret: text("two_factor_secret"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
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
  campaignLength: text("campaign_length").default('standard'), // quick, standard, or epic
  currentSession: integer("current_session").notNull().default(1),
  totalChapters: integer("total_chapters").notNull().default(5), // Total chapters in campaign
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
  // World map linkage - where this adventure takes place
  worldLocationId: integer("world_location_id"), // Link to world_locations table
  worldRegionId: integer("world_region_id"), // Link to world_regions table
  // Discord integration - deploy campaigns to Discord channels
  discordGuildId: text("discord_guild_id"), // Discord server ID
  discordChannelId: text("discord_channel_id"), // Main channel for this campaign
  discordThreadId: text("discord_thread_id"), // Optional thread for session logs
  isDiscordDeployed: boolean("is_discord_deployed").default(false), // Whether campaign is active on Discord
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
  // Campaign-specific combat stats (overrides base NPC stats for this campaign)
  currentHp: integer("current_hp"), // Current HP in this campaign (null = use base NPC maxHitPoints)
  maxHp: integer("max_hp"), // Max HP for this campaign (null = use base NPC maxHitPoints)
  armorClass: integer("armor_class"), // AC for this campaign (null = use base NPC AC)
  attackBonus: integer("attack_bonus").default(3), // Attack bonus for combat
  damageRoll: text("damage_roll").default("1d6+1"), // Damage dice (e.g., "1d6+1")
  status: text("status").default("conscious"), // conscious, unconscious, dead, stabilized
  inventory: text("inventory").array().default([]), // Items held by this NPC in this campaign
  consumables: jsonb("consumables").default([]), // Consumable items (potions, scrolls) held by this NPC
  deathSaveSuccesses: integer("death_save_successes").default(0),
  deathSaveFailures: integer("death_save_failures").default(0),
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
  imageUrl: text("image_url"), // Monster portrait/image URL
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

// Campaign Dungeon Maps - Persistent map state for campaigns
export const campaignDungeonMaps = pgTable("campaign_dungeon_maps", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  sessionId: integer("session_id"), // Optional tie to specific session
  mapName: text("map_name").notNull(),
  mapData: jsonb("map_data").notNull(), // Full dungeon grid data (tiles, rooms, corridors)
  exploredTiles: jsonb("explored_tiles").default([]), // Array of {x, y} coordinates explored
  entityPositions: jsonb("entity_positions").default([]), // Current positions of all entities
  playerPosition: jsonb("player_position").default({ x: 0, y: 0 }), // Player's current position
  fogOfWar: jsonb("fog_of_war").default({}), // Visibility state for tiles
  discoveredSecrets: jsonb("discovered_secrets").default([]), // Secret doors/traps found
  lootedChests: jsonb("looted_chests").default([]), // Chest positions that have been looted
  isActive: boolean("is_active").default(true), // Whether this is the current active map
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at"),
});

export const insertCampaignDungeonMapSchema = createInsertSchema(campaignDungeonMaps).omit({
  id: true,
});

export type InsertCampaignDungeonMap = z.infer<typeof insertCampaignDungeonMapSchema>;
export type CampaignDungeonMap = typeof campaignDungeonMaps.$inferSelect;

// Campaign Quests - Milestone tracking within adventures
export const campaignQuests = pgTable("campaign_quests", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  questType: text("quest_type").notNull().default("main"), // main, side, exploration, combat
  status: text("status").notNull().default("active"), // active, in_progress, completed, failed
  objectives: jsonb("objectives").default([]), // Array of {text, completed} objectives
  xpReward: integer("xp_reward").default(100),
  goldReward: integer("gold_reward").default(0),
  silverReward: integer("silver_reward").default(0),
  lootRewards: jsonb("loot_rewards").default([]), // Array of item names/objects
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  order: integer("order").default(0), // Display order
});

export const insertCampaignQuestSchema = createInsertSchema(campaignQuests).omit({
  id: true,
});

export type InsertCampaignQuest = z.infer<typeof insertCampaignQuestSchema>;
export type CampaignQuest = typeof campaignQuests.$inferSelect;

// World Map - The persistent realm of Everdice
export const worldRegions = pgTable("world_regions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  regionType: text("region_type").notNull().default("territory"), // continent, kingdom, territory, area, dungeon
  parentRegionId: integer("parent_region_id"), // For hierarchical regions
  // Position on the world map (grid-based coordinates)
  gridX: integer("grid_x").notNull().default(0),
  gridY: integer("grid_y").notNull().default(0),
  width: integer("width").notNull().default(1), // Width in grid units
  height: integer("height").notNull().default(1), // Height in grid units
  // Visual display
  color: text("color").default("#4a5568"), // Display color on map
  iconType: text("icon_type").default("territory"), // Icon to display
  terrain: text("terrain").default("plains"), // plains, forest, mountain, desert, swamp, ocean, etc.
  dangerLevel: integer("danger_level").default(1), // 1-5 danger rating
  levelRange: text("level_range").default("1-5"), // Recommended character level range
  // Lore and details
  lore: text("lore"),
  knownFor: text("known_for"), // Brief description shown on hover
  // Pressure gradients (0-100 scale) - These drift slowly over time for world events
  instability: integer("instability").default(0), // Political/social unrest
  danger: integer("danger").default(0), // Monster activity, banditry (distinct from dangerLevel rating)
  opportunity: integer("opportunity").default(0), // Trade, treasure, alliances
  mystery: integer("mystery").default(0), // Unexplained phenomena, rumors
  currentMood: text("current_mood").default("stable"), // stable, tense, volatile, erupting
  lastPressureUpdate: text("last_pressure_update"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertWorldRegionSchema = createInsertSchema(worldRegions).omit({
  id: true,
});

export type InsertWorldRegion = z.infer<typeof insertWorldRegionSchema>;
export type WorldRegion = typeof worldRegions.$inferSelect;

// World Locations - Points of interest within regions (adventure sites)
export const worldLocations = pgTable("world_locations", {
  id: serial("id").primaryKey(),
  regionId: integer("region_id").notNull(), // Which region this is in
  name: text("name").notNull(),
  description: text("description"),
  locationType: text("location_type").notNull().default("landmark"), // city, town, village, dungeon, landmark, ruins, shrine, cave, tower
  // Position within the region (relative coordinates 0-100%)
  posX: integer("pos_x").notNull().default(50),
  posY: integer("pos_y").notNull().default(50),
  // Display properties
  iconType: text("icon_type").default("marker"),
  isDiscoverable: boolean("is_discoverable").default(true), // Can players discover this?
  isMainQuest: boolean("is_main_quest").default(false), // Is this a main storyline location?
  // Adventure linkage - a campaign/adventure can be associated with this location
  linkedCampaignId: integer("linked_campaign_id"),
  // Lore
  lore: text("lore"),
  secrets: text("secrets"), // Hidden info revealed when discovered
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertWorldLocationSchema = createInsertSchema(worldLocations).omit({
  id: true,
});

export type InsertWorldLocation = z.infer<typeof insertWorldLocationSchema>;
export type WorldLocation = typeof worldLocations.$inferSelect;

// User World Progress - Tracks each user's exploration of the world
export const userWorldProgress = pgTable("user_world_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  regionId: integer("region_id"), // Which region (null if location-based)
  locationId: integer("location_id"), // Which location (null if region-based)
  // Progress state
  hasDiscovered: boolean("has_discovered").default(false), // Has the user found this?
  hasVisited: boolean("has_visited").default(false), // Has the user entered/explored?
  completionPercent: integer("completion_percent").default(0), // 0-100%
  completionState: text("completion_state").default("undiscovered"), // undiscovered, discovered, in_progress, completed
  // Stats
  timesVisited: integer("times_visited").default(0),
  lastVisitedAt: text("last_visited_at"),
  firstDiscoveredAt: text("first_discovered_at"),
  completedAt: text("completed_at"),
  // Link to sessions - which session brought them here
  lastSessionId: integer("last_session_id"),
  lastCampaignId: integer("last_campaign_id"),
  // Notes the player made about this area
  playerNotes: text("player_notes"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertUserWorldProgressSchema = createInsertSchema(userWorldProgress).omit({
  id: true,
});

export type InsertUserWorldProgress = z.infer<typeof insertUserWorldProgressSchema>;
export type UserWorldProgress = typeof userWorldProgress.$inferSelect;

// Bulletin Board - LFG (Looking For Group) posts
export const bulletinPosts = pgTable("bulletin_posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  // Post type: lfg (looking for group), lfp (looking for players/DM), discussion, announcement
  postType: text("post_type").notNull().default("lfg"),
  // Game details
  gameSystem: text("game_system").default("D&D 5e"), // D&D 5e, Pathfinder, etc.
  playersNeeded: integer("players_needed").default(1),
  experienceLevel: text("experience_level").default("any"), // beginner, intermediate, experienced, any
  playStyle: text("play_style").default("mixed"), // roleplay, combat, exploration, mixed
  // Scheduling
  preferredTime: text("preferred_time"), // e.g. "Weekends", "Evenings EST"
  sessionDuration: text("session_duration"), // e.g. "2-3 hours"
  isOngoing: boolean("is_ongoing").default(false), // One-shot vs campaign
  // Status
  isActive: boolean("is_active").default(true),
  responseCount: integer("response_count").default(0),
  // Timestamps
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at"),
  expiresAt: text("expires_at"), // Auto-expire old posts
});

export const insertBulletinPostSchema = createInsertSchema(bulletinPosts).omit({
  id: true,
  responseCount: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBulletinPost = z.infer<typeof insertBulletinPostSchema>;
export type BulletinPost = typeof bulletinPosts.$inferSelect;

// Bulletin Responses - Replies to bulletin posts
export const bulletinResponses = pgTable("bulletin_responses", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  userId: integer("user_id").notNull(),
  message: text("message").notNull(),
  // Contact preferences
  contactMethod: text("contact_method"), // in-app, discord, etc.
  contactInfo: text("contact_info"), // Optional contact details
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertBulletinResponseSchema = createInsertSchema(bulletinResponses).omit({
  id: true,
  createdAt: true,
});

export type InsertBulletinResponse = z.infer<typeof insertBulletinResponseSchema>;
export type BulletinResponse = typeof bulletinResponses.$inferSelect;

export const campaignTraceEvents = pgTable("campaign_trace_events", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  sessionId: text("session_id"),
  eid: text("eid").notNull(),
  kind: text("kind").notNull(),
  payload: jsonb("payload").notNull(),
  ts: text("ts").notNull(),
  who: text("who"),
  locationRef: text("location_ref"),
  note: text("note"),
  meta: jsonb("meta"),
});

export const insertCampaignTraceEventSchema = createInsertSchema(campaignTraceEvents).omit({
  id: true,
});

export type InsertCampaignTraceEvent = z.infer<typeof insertCampaignTraceEventSchema>;
export type CampaignTraceEvent = typeof campaignTraceEvents.$inferSelect;

// DM Live Session State - Tracks real-time session data for DM Live Manager
export const dmSessionStates = pgTable("dm_session_states", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  sessionId: integer("session_id"), // Links to campaign_sessions
  // Presence tracking
  presence: jsonb("presence").default([]), // [{userId, characterId, name, isOnline, lastSeen}]
  // Initiative tracking
  initiativeOrder: jsonb("initiative_order").default([]), // [{characterId, name, initiative, isPlayer, isCurrentTurn, hp, maxHp, conditions}]
  currentTurnIndex: integer("current_turn_index").default(0),
  roundNumber: integer("round_number").default(1),
  // Player choices tracking
  pendingChoices: jsonb("pending_choices").default([]), // [{characterId, choice, timestamp}]
  // DM messages log
  dmMessages: jsonb("dm_messages").default([]), // [{message, timestamp, type: 'narration'|'ooc'|'system'}]
  // Session artifacts - dragged items from sidebar
  sessionArtifacts: jsonb("session_artifacts").default([]), // [{type, entityId, name, data, addedAt}]
  // CAML entity sources for sidebar
  camlEntitySources: jsonb("caml_entity_sources").default({}), // {npcs: [], items: [], encounters: [], locations: []}
  // Status
  isActive: boolean("is_active").default(true),
  startedAt: text("started_at").notNull().default(new Date().toISOString()),
  lastUpdatedAt: text("last_updated_at"),
});

export const insertDmSessionStateSchema = createInsertSchema(dmSessionStates).omit({
  id: true,
});

export type InsertDmSessionState = z.infer<typeof insertDmSessionStateSchema>;
export type DmSessionState = typeof dmSessionStates.$inferSelect;

// Factions - Groups that characters build reputation with (per campaign)
export const factions = pgTable("factions", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("group"), // group, institution, settlement, guild, religious, criminal
  disposition: text("disposition").default("neutral"), // friendly, neutral, suspicious, hostile
  values: text("values").array(), // What the faction values: honor, wealth, power, knowledge, etc.
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertFactionSchema = createInsertSchema(factions).omit({
  id: true,
  createdAt: true,
});

export type InsertFaction = z.infer<typeof insertFactionSchema>;
export type Faction = typeof factions.$inferSelect;

// Character Reputation Profiles - Descriptive reputation per character/faction
export const characterReputationProfiles = pgTable("character_reputation_profiles", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").notNull(),
  factionId: integer("faction_id"), // Null = general world perception
  campaignId: integer("campaign_id").notNull(),
  // Trust & Reliability descriptors (narrative, not numeric)
  trustDescriptor: text("trust_descriptor"), // e.g., "Known for keeping promises under pressure"
  trustLevel: text("trust_level").default("unknown"), // unknown, distrusted, cautious, neutral, trusted, respected
  // Behavioral tendency patterns
  behaviorDescriptor: text("behavior_descriptor"), // e.g., "Quick to respond with force when threatened"
  tendencies: jsonb("tendencies").default({}), // {cautious_vs_reckless: 0.7, merciful_vs_ruthless: 0.3, selfless_vs_selfish: 0.5}
  // Notable deeds and reputation notes
  notableDeeds: jsonb("notable_deeds").default([]), // [{deed: "Saved the village from bandits", impact: "positive", timestamp}]
  reputationNotes: text("reputation_notes"), // DM notes about this reputation
  // Update tracking
  lastEventId: integer("last_event_id"), // Last reputation event processed
  lastUpdatedAt: text("last_updated_at").notNull().default(new Date().toISOString()),
});

export const insertCharacterReputationProfileSchema = createInsertSchema(characterReputationProfiles).omit({
  id: true,
  lastUpdatedAt: true,
});

export type InsertCharacterReputationProfile = z.infer<typeof insertCharacterReputationProfileSchema>;
export type CharacterReputationProfile = typeof characterReputationProfiles.$inferSelect;

// Reputation Events - Individual events that affected character reputation
export const reputationEvents = pgTable("reputation_events", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").notNull(),
  campaignId: integer("campaign_id").notNull(),
  factionId: integer("faction_id"), // Null = affects general reputation
  traceEventId: integer("trace_event_id"), // Link to campaign_trace_events if applicable
  // Event classification
  triggerType: text("trigger_type").notNull(), // kept_promise, broken_trust, showed_mercy, used_force, helped_stranger, betrayal, etc.
  significance: text("significance").default("minor"), // minor, moderate, major, defining
  // Narrative description of what happened
  narrativeSummary: text("narrative_summary").notNull(),
  // Impact on patterns (delta, not absolute)
  patternDelta: jsonb("pattern_delta").default({}), // {trust: +0.1, cautious_vs_reckless: -0.05}
  // Witnesses and context
  witnesses: text("witnesses").array(), // Names of NPCs who witnessed
  locationContext: text("location_context"), // Where it happened
  // Metadata
  isProcessed: boolean("is_processed").default(false), // Whether this was factored into profile
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertReputationEventSchema = createInsertSchema(reputationEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertReputationEvent = z.infer<typeof insertReputationEventSchema>;
export type ReputationEvent = typeof reputationEvents.$inferSelect;

// Player-Created Groups (Parties, Guilds, Factions)
export const playerGroups = pgTable("player_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // party, guild, faction, order, brotherhood, company
  description: text("description"),
  motto: text("motto"),
  emblemUrl: text("emblem_url"),
  // Leadership
  founderId: integer("founder_id").notNull(),
  leaderIds: integer("leader_ids").array().default([]),
  // Collective reputation
  collectiveIdentity: text("collective_identity"), // "Known for decisive action"
  reputationDescriptor: text("reputation_descriptor"), // Narrative description of how they're perceived
  notableAchievements: jsonb("notable_achievements").default([]), // [{achievement, date, significance}]
  // Settings
  isPublic: boolean("is_public").default(true),
  maxMembers: integer("max_members").default(20),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at"),
});

export const insertPlayerGroupSchema = createInsertSchema(playerGroups).omit({
  id: true,
  createdAt: true,
});

export type InsertPlayerGroup = z.infer<typeof insertPlayerGroupSchema>;
export type PlayerGroup = typeof playerGroups.$inferSelect;

// Group Membership
export const playerGroupMembers = pgTable("player_group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  userId: integer("user_id").notNull(),
  characterId: integer("character_id"), // Which character represents them (optional)
  role: text("role").default("member"), // founder, leader, officer, member
  title: text("title"), // Custom title within the group
  joinedAt: text("joined_at").notNull().default(new Date().toISOString()),
  isActive: boolean("is_active").default(true),
});

export const insertPlayerGroupMemberSchema = createInsertSchema(playerGroupMembers).omit({
  id: true,
  joinedAt: true,
});

export type InsertPlayerGroupMember = z.infer<typeof insertPlayerGroupMemberSchema>;
export type PlayerGroupMember = typeof playerGroupMembers.$inferSelect;

// Group Invitations
export const groupInvitations = pgTable("group_invitations", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  inviterId: integer("inviter_id").notNull(), // Who sent the invite
  inviteeId: integer("invitee_id").notNull(), // Who is being invited
  message: text("message"), // Optional message with the invite
  status: text("status").default("pending"), // pending, accepted, declined, expired
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  respondedAt: text("responded_at"),
});

export const insertGroupInvitationSchema = createInsertSchema(groupInvitations).omit({
  id: true,
  createdAt: true,
  respondedAt: true,
  status: true,
});

export type InsertGroupInvitation = z.infer<typeof insertGroupInvitationSchema>;
export type GroupInvitation = typeof groupInvitations.$inferSelect;

// Group Message Board - Asynchronous messages between guild members
export const groupMessages = pgTable("group_messages", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  authorId: integer("author_id").notNull(),
  // Message content
  title: text("title"),
  content: text("content").notNull(),
  isPinned: boolean("is_pinned").default(false),
  isAnnouncement: boolean("is_announcement").default(false),
  // Metadata
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at"),
});

export const insertGroupMessageSchema = createInsertSchema(groupMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGroupMessage = z.infer<typeof insertGroupMessageSchema>;
export type GroupMessage = typeof groupMessages.$inferSelect;

// World Memory - Tracks significant events for "Since Last Time..." and delayed consequences
export const worldMemory = pgTable("world_memory", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  // Memory classification
  memoryType: text("memory_type").notNull(), // npc_reaction, rumor_spread, faction_shift, location_change, consequence_pending, promise_made
  // Content
  subject: text("subject").notNull(), // Who/what this memory is about
  narrative: text("narrative").notNull(), // The narrative description
  details: jsonb("details").default({}), // Structured data about the memory
  // Visibility and state
  isResolved: boolean("is_resolved").default(false), // For pending consequences
  revealedAt: text("revealed_at"), // When this surfaced to players (null = not yet)
  // Causality tracking
  causedByCharacterId: integer("caused_by_character_id"),
  triggeringEventId: integer("triggering_event_id"), // Link to reputation event
  // Timing
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  expiresAt: text("expires_at"), // When this memory fades (null = permanent)
});

export const insertWorldMemorySchema = createInsertSchema(worldMemory).omit({
  id: true,
  createdAt: true,
});

export type InsertWorldMemory = z.infer<typeof insertWorldMemorySchema>;
export type WorldMemory = typeof worldMemory.$inferSelect;

// Unresolved Threads - Promises, tensions, and pending consequences
export const unresolvedThreads = pgTable("unresolved_threads", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  characterId: integer("character_id"), // Null = party-wide
  // Thread type
  threadType: text("thread_type").notNull(), // promise, tension, consequence, mystery, relationship
  // Content
  title: text("title").notNull(), // Brief summary
  narrative: text("narrative").notNull(), // Full description
  involvedParties: text("involved_parties").array().default([]), // NPCs, factions, or locations involved
  // State
  urgency: text("urgency").default("low"), // low, moderate, high, critical
  status: text("status").default("active"), // active, dormant, resolved, failed
  // Resolution
  resolvedAt: text("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  // Tracking
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  lastMentionedAt: text("last_mentioned_at"),
});

export const insertUnresolvedThreadSchema = createInsertSchema(unresolvedThreads).omit({
  id: true,
  createdAt: true,
});

export type InsertUnresolvedThread = z.infer<typeof insertUnresolvedThreadSchema>;
export type UnresolvedThread = typeof unresolvedThreads.$inferSelect;

// Character Arc Insights - Subtle patterns and turning points
export const characterArcInsights = pgTable("character_arc_insights", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").notNull(),
  campaignId: integer("campaign_id").notNull(),
  // Insight type
  insightType: text("insight_type").notNull(), // turning_point, pattern_emerging, crossroads, growth_moment
  // Content
  teaser: text("teaser").notNull(), // Cryptic hint: "A pattern is becoming noticeable"
  fullInsight: text("full_insight"), // Detailed insight (revealed later or to DM)
  relatedBehaviors: jsonb("related_behaviors").default([]), // Events that led to this insight
  // Display state
  isRevealed: boolean("is_revealed").default(false), // Whether player has seen this
  revealedAt: text("revealed_at"),
  // Tracking
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  expiresAt: text("expires_at"), // When insight is no longer relevant
});

export const insertCharacterArcInsightSchema = createInsertSchema(characterArcInsights).omit({
  id: true,
  createdAt: true,
});

export type InsertCharacterArcInsight = z.infer<typeof insertCharacterArcInsightSchema>;
export type CharacterArcInsight = typeof characterArcInsights.$inferSelect;

// User Session Tracking - For "Since Last Time..." feature
export const userSessionTracking = pgTable("user_session_tracking", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  campaignId: integer("campaign_id").notNull(),
  lastLoginAt: text("last_login_at").notNull(),
  lastWorldStateHash: text("last_world_state_hash"), // To detect meaningful changes
  sinceThenBullets: jsonb("since_then_bullets").default([]), // Cached bullets for display
  bulletsCachedAt: text("bullets_cached_at"),
});

// World Rumors - Background narrative suggestions, not missions
export const worldRumors = pgTable("world_rumors", {
  id: serial("id").primaryKey(),
  regionId: integer("region_id"), // Null = realm-wide
  campaignId: integer("campaign_id"), // Null = global pool, or specific campaign
  // The rumor itself
  narrative: text("narrative").notNull(), // "Travelers speak of fires in the southern isles..."
  source: text("source"), // Who spreads this rumor: merchants, guards, travelers, locals
  // Classification
  rumorType: text("rumor_type").notNull(), // threat, opportunity, mystery, omen, gossip
  relatedFaction: text("related_faction"), // If tied to a faction
  // Pressure drivers - what this rumor suggests
  suggestsInstability: boolean("suggests_instability").default(false),
  suggestsDanger: boolean("suggests_danger").default(false),
  suggestsOpportunity: boolean("suggests_opportunity").default(false),
  suggestsMystery: boolean("suggests_mystery").default(false),
  // State
  isActive: boolean("is_active").default(true),
  timesHeard: integer("times_heard").default(0), // How many times surfaced
  lastHeardAt: text("last_heard_at"),
  // Origin tracking
  generatedFromPattern: text("generated_from_pattern"), // What caused this rumor
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  expiresAt: text("expires_at"), // When rumor fades from circulation
});

export const insertWorldRumorSchema = createInsertSchema(worldRumors).omit({
  id: true,
  createdAt: true,
});

export type InsertWorldRumor = z.infer<typeof insertWorldRumorSchema>;
export type WorldRumor = typeof worldRumors.$inferSelect;

// World Developments - DM-facing suggestions, not player-facing events
export const worldDevelopments = pgTable("world_developments", {
  id: serial("id").primaryKey(),
  regionId: integer("region_id"), // Null = realm-wide
  campaignId: integer("campaign_id"), // Null = global, or specific campaign
  // The development suggestion
  title: text("title").notNull(), // Brief: "Trade routes weakening"
  narrative: text("narrative").notNull(), // "Continued banditry may disrupt commerce..."
  consequence: text("consequence"), // What happens if ignored
  // Classification
  developmentType: text("development_type").notNull(), // drift, consequence, opportunity, threat
  urgency: text("urgency").default("slow"), // slow, moderate, pressing (not "urgent" - no demands)
  // Source - what triggered this development
  triggeredBy: text("triggered_by"), // player_action, world_drift, faction_movement, neglect
  relatedPatterns: jsonb("related_patterns").default([]), // Events/actions that led here
  // DM action state
  dmDecision: text("dm_decision"), // null, adopted, modified, ignored, postponed
  dmNotes: text("dm_notes"),
  decidedAt: text("decided_at"),
  // If adopted, what happened
  resolution: text("resolution"),
  resolvedAt: text("resolved_at"),
  // Tracking
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  showAfter: text("show_after"), // Don't show until this date (for slow reveals)
});

export const insertWorldDevelopmentSchema = createInsertSchema(worldDevelopments).omit({
  id: true,
  createdAt: true,
});

export type InsertWorldDevelopment = z.infer<typeof insertWorldDevelopmentSchema>;
export type WorldDevelopment = typeof worldDevelopments.$inferSelect;

// User Activity Tracking - Tracks user interactions during sessions
export const userActivityEvents = pgTable("user_activity_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  sessionId: text("session_id").notNull(), // Browser session identifier
  eventType: text("event_type").notNull(), // page_view, feature_use, dice_roll, ai_request, campaign_action
  eventCategory: text("event_category").notNull(), // navigation, combat, roleplay, dm_tools, character_mgmt
  eventName: text("event_name").notNull(), // Specific action: "create_character", "roll_attack", "generate_npc"
  eventData: jsonb("event_data").default({}), // Additional context data
  pageUrl: text("page_url"),
  campaignId: integer("campaign_id"), // If action is campaign-specific
  characterId: integer("character_id"), // If action is character-specific
  duration: integer("duration"), // Time spent in milliseconds (for timed events)
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertUserActivityEventSchema = createInsertSchema(userActivityEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertUserActivityEvent = z.infer<typeof insertUserActivityEventSchema>;
export type UserActivityEvent = typeof userActivityEvents.$inferSelect;

// User Sessions Analytics - Aggregated session data
export const userSessionsAnalytics = pgTable("user_sessions_analytics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  sessionId: text("session_id").notNull(),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
  durationMinutes: integer("duration_minutes"),
  pageViews: integer("page_views").default(0),
  actionsCount: integer("actions_count").default(0),
  diceRolls: integer("dice_rolls").default(0),
  aiRequests: integer("ai_requests").default(0),
  campaignsPlayed: jsonb("campaigns_played").default([]), // Array of campaign IDs
  featuresUsed: jsonb("features_used").default([]), // Array of feature names
  deviceType: text("device_type"), // desktop, mobile, tablet
  browserInfo: text("browser_info"),
});

export const insertUserSessionsAnalyticsSchema = createInsertSchema(userSessionsAnalytics).omit({
  id: true,
});

export type InsertUserSessionsAnalytics = z.infer<typeof insertUserSessionsAnalyticsSchema>;
export type UserSessionsAnalytics = typeof userSessionsAnalytics.$inferSelect;

// Daily Stats Rollup - Pre-aggregated daily metrics
export const dailyStatsRollup = pgTable("daily_stats_rollup", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(), // YYYY-MM-DD format
  activeUsers: integer("active_users").default(0),
  newUsers: integer("new_users").default(0),
  totalSessions: integer("total_sessions").default(0),
  avgSessionDuration: integer("avg_session_duration").default(0), // in minutes
  totalDiceRolls: integer("total_dice_rolls").default(0),
  totalAiRequests: integer("total_ai_requests").default(0),
  campaignsStarted: integer("campaigns_started").default(0),
  campaignsCompleted: integer("campaigns_completed").default(0),
  charactersCreated: integer("characters_created").default(0),
  featureBreakdown: jsonb("feature_breakdown").default({}), // { feature: count }
  topPages: jsonb("top_pages").default([]), // [{ url, views }]
});

export const insertDailyStatsRollupSchema = createInsertSchema(dailyStatsRollup).omit({
  id: true,
});

export type InsertDailyStatsRollup = z.infer<typeof insertDailyStatsRollupSchema>;
export type DailyStatsRollup = typeof dailyStatsRollup.$inferSelect;

// Spells - Master spell library (SRD 5e spells)
export const spells = pgTable("spells", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  level: integer("level").notNull(), // 0 = cantrip, 1-9 = spell levels
  school: text("school").notNull(), // abjuration, conjuration, divination, enchantment, evocation, illusion, necromancy, transmutation
  castingTime: text("casting_time").notNull(), // 1 action, 1 bonus action, 1 reaction, 1 minute, etc.
  range: text("range").notNull(), // Self, Touch, 30 feet, 120 feet, etc.
  components: text("components").notNull(), // V, S, M (material description)
  duration: text("duration").notNull(), // Instantaneous, Concentration up to 1 minute, 1 hour, etc.
  description: text("description").notNull(),
  higherLevels: text("higher_levels"), // What happens when cast at higher level
  // Class availability
  classes: text("classes").array().notNull(), // wizard, sorcerer, cleric, druid, bard, paladin, ranger, warlock
  // Damage/healing info for combat
  damageType: text("damage_type"), // fire, cold, lightning, necrotic, radiant, etc.
  damageDice: text("damage_dice"), // 1d10, 2d6, 8d6, etc.
  healingDice: text("healing_dice"), // For healing spells
  savingThrow: text("saving_throw"), // DEX, CON, WIS, etc.
  // Flags
  ritual: boolean("ritual").default(false),
  concentration: boolean("concentration").default(false),
  // SRD compliance
  srdCompliant: boolean("srd_compliant").default(true),
});

export const insertSpellSchema = createInsertSchema(spells).omit({
  id: true,
});

export type InsertSpell = z.infer<typeof insertSpellSchema>;
export type Spell = typeof spells.$inferSelect;

// Character Spells - Junction table for known/prepared spells
export const characterSpells = pgTable("character_spells", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").notNull(),
  spellId: integer("spell_id").notNull(),
  // How the spell was acquired
  source: text("source").default("class"), // class, race, item, quest, scroll
  // For prepared casters (Cleric, Druid, Paladin, Wizard)
  isPrepared: boolean("is_prepared").default(false),
  // For spellbook casters (Wizard) - spells in spellbook vs just known
  inSpellbook: boolean("in_spellbook").default(true),
  // Acquisition tracking
  acquiredAt: text("acquired_at").notNull(),
  acquiredLevel: integer("acquired_level").default(1), // Character level when learned
  // Story context
  acquisitionStory: text("acquisition_story"), // How they learned it (quest reward, scroll study, etc.)
});

export const insertCharacterSpellSchema = createInsertSchema(characterSpells).omit({
  id: true,
});

export type InsertCharacterSpell = z.infer<typeof insertCharacterSpellSchema>;
export type CharacterSpell = typeof characterSpells.$inferSelect;

// Character Spell Slots - Daily spell slot tracking
export const characterSpellSlots = pgTable("character_spell_slots", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").notNull().unique(),
  // Spell slots per level (max available based on class/level)
  slotsLevel1Max: integer("slots_level_1_max").default(0),
  slotsLevel2Max: integer("slots_level_2_max").default(0),
  slotsLevel3Max: integer("slots_level_3_max").default(0),
  slotsLevel4Max: integer("slots_level_4_max").default(0),
  slotsLevel5Max: integer("slots_level_5_max").default(0),
  slotsLevel6Max: integer("slots_level_6_max").default(0),
  slotsLevel7Max: integer("slots_level_7_max").default(0),
  slotsLevel8Max: integer("slots_level_8_max").default(0),
  slotsLevel9Max: integer("slots_level_9_max").default(0),
  // Currently available slots (decreases as spells are cast)
  slotsLevel1Used: integer("slots_level_1_used").default(0),
  slotsLevel2Used: integer("slots_level_2_used").default(0),
  slotsLevel3Used: integer("slots_level_3_used").default(0),
  slotsLevel4Used: integer("slots_level_4_used").default(0),
  slotsLevel5Used: integer("slots_level_5_used").default(0),
  slotsLevel6Used: integer("slots_level_6_used").default(0),
  slotsLevel7Used: integer("slots_level_7_used").default(0),
  slotsLevel8Used: integer("slots_level_8_used").default(0),
  slotsLevel9Used: integer("slots_level_9_used").default(0),
  // Last long rest (resets slots)
  lastLongRest: text("last_long_rest"),
})

export const insertCharacterSpellSlotsSchema = createInsertSchema(characterSpellSlots).omit({
  id: true,
});

export type InsertCharacterSpellSlots = z.infer<typeof insertCharacterSpellSlotsSchema>;
export type CharacterSpellSlots = typeof characterSpellSlots.$inferSelect;

// Badge definitions - Achievement/skill badges users can earn
export const badges = pgTable("badges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  icon: text("icon").notNull(), // Icon name or emoji
  category: text("category").notNull(), // 'learning', 'gameplay', 'social', 'dm'
  tier: text("tier").notNull().default("bronze"), // 'bronze', 'silver', 'gold', 'platinum'
  // Criteria for earning this badge (e.g., pathId for learning badges)
  criteria: jsonb("criteria").default({}),
  // Display settings
  color: text("color").default("#8B5CF6"), // Badge color theme
  rarity: text("rarity").default("common"), // 'common', 'uncommon', 'rare', 'legendary'
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertBadgeSchema = createInsertSchema(badges).omit({
  id: true,
});

export type InsertBadge = z.infer<typeof insertBadgeSchema>;
export type Badge = typeof badges.$inferSelect;

// User Badges - Tracks which badges users have earned
export const userBadges = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  badgeId: integer("badge_id").notNull(),
  earnedAt: text("earned_at").notNull(),
  // Context about how they earned it
  context: jsonb("context").default({}), // e.g., { campaignId: 5, characterName: "Thorin" }
  // Display preferences
  isFeatured: boolean("is_featured").default(false), // Show prominently on profile
  isHidden: boolean("is_hidden").default(false), // Hide from public view
});

export const insertUserBadgeSchema = createInsertSchema(userBadges).omit({
  id: true,
});

export type InsertUserBadge = z.infer<typeof insertUserBadgeSchema>;
export type UserBadge = typeof userBadges.$inferSelect;
