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

// Equipment system tables
export const itemTypes = [
  "weapon", "armor", "shield", "potion", "scroll", "wand", 
  "rod", "ring", "wondrous", "ammunition", "tool", "gear"
] as const;

export const rarityLevels = [
  "common", "uncommon", "rare", "very_rare", "legendary", "artifact"
] as const;

export const equipmentSlots = [
  "main_hand", "off_hand", "both_hands", "head", "neck", "back", 
  "body", "wrists", "hands", "finger", "waist", "legs", "feet", 
  "none" // for items that don't need to be equipped (potions, scrolls, etc.)
] as const;

// Items table - represents the template of an item
export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  itemType: text("item_type").notNull().$type<typeof itemTypes[number]>(),
  rarity: text("rarity").notNull().$type<typeof rarityLevels[number]>().default("common"),
  slot: text("slot").notNull().$type<typeof equipmentSlots[number]>(),
  weight: integer("weight").notNull().default(0), // in pounds
  value: integer("value").notNull().default(0), // in gold pieces
  isStackable: boolean("is_stackable").notNull().default(false),
  isConsumable: boolean("is_consumable").notNull().default(false),
  requiresAttunement: boolean("requires_attunement").notNull().default(false),
  properties: jsonb("properties").notNull().default({}), // Damage, armor class, etc.
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at"),
  // If the item was created by a user (rather than being a system item)
  createdBy: integer("created_by"),
  isSystemItem: boolean("is_system_item").notNull().default(true),
});

export const insertItemSchema = createInsertSchema(items).omit({
  id: true,
});

export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof items.$inferSelect;

// Character equipment - represents items owned by a character
export const characterItems = pgTable("character_items", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").notNull(),
  itemId: integer("item_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  isEquipped: boolean("is_equipped").notNull().default(false),
  isAttuned: boolean("is_attuned").notNull().default(false),
  customName: text("custom_name"), // For renamed items
  customDescription: text("custom_description"), // For personalized descriptions
  customProperties: jsonb("custom_properties").default({}), // For altered item properties
  acquiredAt: text("acquired_at").notNull().default(new Date().toISOString()),
  notes: text("notes"),
});

export const insertCharacterItemSchema = createInsertSchema(characterItems).omit({
  id: true,
});

export type InsertCharacterItem = z.infer<typeof insertCharacterItemSchema>;
export type CharacterItem = typeof characterItems.$inferSelect;

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
  skills: text("skills").array(),
  equipment: text("equipment").array(),
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

// Campaign session schema with XP rewards
export const campaignSessions = pgTable("campaign_sessions", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  sessionNumber: integer("session_number").notNull(),
  title: text("title").notNull(),
  narrative: text("narrative").notNull(),
  location: text("location"),
  choices: jsonb("choices").notNull(),
  sessionXpReward: integer("session_xp_reward").default(0),
  isCompleted: boolean("is_completed").default(false),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
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

// Campaign rewards system
export const campaignRewards = pgTable("campaign_rewards", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  sessionId: integer("session_id"), // Optional - can be tied to a specific session
  itemId: integer("item_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  isAwarded: boolean("is_awarded").notNull().default(false), // Whether players have received this
  awardedAt: text("awarded_at"), // When it was awarded to players
  awardMethod: text("award_method"), // quest_reward, combat_drop, treasure_chest, etc.
  location: text("location"), // Description of where this was found
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertCampaignRewardSchema = createInsertSchema(campaignRewards).omit({
  id: true,
});

export type InsertCampaignReward = z.infer<typeof insertCampaignRewardSchema>;
export type CampaignReward = typeof campaignRewards.$inferSelect;

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

// Campaign Story Arcs - AI-generated narrative structure
export const campaignStoryArcs = pgTable("campaign_story_arcs", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  theme: text("theme").notNull(), // revenge, discovery, political intrigue, etc.
  setting: text("setting").notNull(), // urban, wilderness, dungeon, planar, etc.
  overallGoal: text("overall_goal").notNull(),
  estimatedSessions: integer("estimated_sessions").notNull().default(5),
  difficulty: text("difficulty").notNull().default("medium"), // easy, medium, hard, deadly
  currentAct: integer("current_act").notNull().default(1), // Story progression tracker
  totalActs: integer("total_acts").notNull().default(3),
  isActive: boolean("is_active").notNull().default(true),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at"),
});

export const insertCampaignStoryArcSchema = createInsertSchema(campaignStoryArcs).omit({
  id: true,
});

export type InsertCampaignStoryArc = z.infer<typeof insertCampaignStoryArcSchema>;
export type CampaignStoryArc = typeof campaignStoryArcs.$inferSelect;

// Plot Points - Key story beats within arcs
export const plotPoints = pgTable("plot_points", {
  id: serial("id").primaryKey(),
  storyArcId: integer("story_arc_id").notNull(),
  act: integer("act").notNull(),
  sequence: integer("sequence").notNull(), // Order within the act
  title: text("title").notNull(),
  description: text("description").notNull(),
  plotType: text("plot_type").notNull(), // hook, challenge, revelation, climax, resolution
  triggerConditions: jsonb("trigger_conditions").default([]), // Conditions to activate this plot point
  playerChoicesImpact: jsonb("player_choices_impact").default({}), // How player choices affect this
  npcsInvolved: jsonb("npcs_involved").default([]), // NPCs central to this plot point
  locationsInvolved: jsonb("locations_involved").default([]), // Key locations
  rewards: jsonb("rewards").default([]), // XP, items, story progression
  isTriggered: boolean("is_triggered").notNull().default(false),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: text("completed_at"),
  playerChoicesMade: jsonb("player_choices_made").default([]), // Track actual player decisions
  dmNotes: text("dm_notes"), // DM-specific notes and modifications
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at"),
});

export const insertPlotPointSchema = createInsertSchema(plotPoints).omit({
  id: true,
});

export type InsertPlotPoint = z.infer<typeof insertPlotPointSchema>;
export type PlotPoint = typeof plotPoints.$inferSelect;

// Campaign Invitations System
export const campaignInvitations = pgTable("campaign_invitations", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  inviterId: integer("inviter_id").notNull(), // User who sent the invitation (DM)
  inviteeEmail: text("invitee_email").notNull(), // Email of invited player
  inviteeUsername: text("invitee_username"), // Username if they're already registered
  inviteeUserId: integer("invitee_user_id"), // User ID if they're registered
  role: text("role").notNull().default("player"), // player, co-dm, observer
  personalMessage: text("personal_message"), // Custom message from DM
  status: text("status").notNull().default("pending"), // pending, accepted, declined, expired
  token: text("token").notNull().unique(), // Unique invitation token
  expiresAt: text("expires_at").notNull(),
  acceptedAt: text("accepted_at"),
  declinedAt: text("declined_at"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertCampaignInvitationSchema = createInsertSchema(campaignInvitations).omit({
  id: true,
});

export type InsertCampaignInvitation = z.infer<typeof insertCampaignInvitationSchema>;
export type CampaignInvitation = typeof campaignInvitations.$inferSelect;

// Player Decision Tracking - For AI narrative adaptation
export const playerDecisions = pgTable("player_decisions", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  sessionId: integer("session_id"),
  plotPointId: integer("plot_point_id"),
  playerId: integer("player_id").notNull(),
  characterId: integer("character_id"),
  decisionType: text("decision_type").notNull(), // dialogue, action, combat, exploration
  decisionText: text("decision_text").notNull(), // What the player decided to do
  context: text("context").notNull(), // Situation context
  diceRollIds: jsonb("dice_roll_ids").default([]), // Associated dice rolls
  outcome: text("outcome"), // Result of the decision
  impactLevel: text("impact_level").notNull().default("minor"), // minor, moderate, major, critical
  narrativeConsequences: jsonb("narrative_consequences").default([]), // How this affects future story
  dmResponse: text("dm_response"), // DM's narrative response
  aiSuggestions: jsonb("ai_suggestions").default([]), // AI-generated follow-up suggestions
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertPlayerDecisionSchema = createInsertSchema(playerDecisions).omit({
  id: true,
});

export type InsertPlayerDecision = z.infer<typeof insertPlayerDecisionSchema>;
export type PlayerDecision = typeof playerDecisions.$inferSelect;

// Dynamic Story Events - AI-generated events based on player choices
export const dynamicStoryEvents = pgTable("dynamic_story_events", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  triggerDecisionId: integer("trigger_decision_id"), // Decision that triggered this event
  eventType: text("event_type").notNull(), // encounter, revelation, complication, opportunity
  title: text("title").notNull(),
  description: text("description").notNull(),
  probability: integer("probability").notNull().default(50), // 0-100 chance of occurring
  conditions: jsonb("conditions").default([]), // Required conditions for this event
  isTriggered: boolean("is_triggered").notNull().default(false),
  triggeredAt: text("triggered_at"),
  dmApproval: text("dm_approval").notNull().default("pending"), // pending, approved, rejected, modified
  dmModifications: text("dm_modifications"), // DM changes to the AI suggestion
  playerImpact: jsonb("player_impact").default({}), // How this affects each player
  narrativeWeight: integer("narrative_weight").notNull().default(1), // 1-5 importance scale
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at"),
});

export const insertDynamicStoryEventSchema = createInsertSchema(dynamicStoryEvents).omit({
  id: true,
});

export type InsertDynamicStoryEvent = z.infer<typeof insertDynamicStoryEventSchema>;
export type DynamicStoryEvent = typeof dynamicStoryEvents.$inferSelect;

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

// Announcements system for community interaction
export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // User who created the announcement
  title: text("title").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default("general"), // "general", "looking_for_players", "looking_for_dm", "campaign_announcement"
  expiresAt: text("expires_at"), // When the announcement expires (optional)
  campaignId: integer("campaign_id"), // Related campaign (optional)
  isActive: boolean("is_active").default(true), // Whether announcement is still active
  
  // Moderation fields
  status: text("status").notNull().default("pending"), // "pending", "approved", "rejected"
  flagCount: integer("flag_count").default(0), // Number of times announcement has been flagged
  flaggedBy: integer("flagged_by").array(), // User IDs who flagged the announcement
  moderationNotes: text("moderation_notes"), // Admin notes about the announcement
  moderatedBy: integer("moderated_by"), // Admin who last moderated the announcement
  moderatedAt: text("moderated_at"), // When the announcement was last moderated
  
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at"),
});

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
});

export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type Announcement = typeof announcements.$inferSelect;
