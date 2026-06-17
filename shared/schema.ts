import { pgTable, text, serial, integer, boolean, jsonb, timestamp, real, index, uniqueIndex } from "drizzle-orm/pg-core";
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
  discordUserId: text("discord_user_id"),
  discordUsername: text("discord_username"),
  // Onboarding state - tracks which contextual hints have been seen/dismissed
  onboardingState: jsonb("onboarding_state"),
  // Tracks if user completed the demo/learn-by-playing campaign
  hasCompletedDemo: boolean("has_completed_demo").default(false),
});

// Discord connection codes for linking accounts
export const discordConnections = pgTable("discord_connections", {
  id: serial("id").primaryKey(),
  discordUserId: text("discord_user_id").notNull(),
  discordUsername: text("discord_username").notNull(),
  connectionCode: text("connection_code").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

// Pending Discord choices - stores choices made via Discord buttons for web app to pick up
export const pendingDiscordChoices = pgTable("pending_discord_choices", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  sessionNumber: integer("session_number").notNull(),
  discordUserId: text("discord_user_id").notNull(),
  userId: integer("user_id").notNull(),
  choiceIndex: integer("choice_index").notNull(),
  choiceText: text("choice_text").notNull(),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  processed: boolean("processed").notNull().default(false),
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
}, (t) => [
  index("idx_user_sessions_user_id").on(t.userId),
]);

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
  // Active conditions: [{ name, source, endsOnTurn, isConcentration }]
  activeConditions: jsonb("active_conditions").default([]),
  // Exhaustion level (D&D 5e, 0-6). Accumulates from risky downtime/bounty failures; imposes disadvantage at 1+.
  exhaustionLevel: integer("exhaustion_level").default(0),
  // Downtime cooldowns: { [activityId]: cooldownUntilISO } — server-authoritative gate on Work activities
  downtimeState: jsonb("downtime_state").default({}),
  // Resurrection tracking
  deathTimestamp: text("death_timestamp"),
  resurrectedAt: text("resurrected_at"),
  // New fields for character visualization
  appearance: text("appearance"),
  portraitUrl: text("portrait_url"),
  backgroundStory: text("background_story"),
  // One-time rename: players may rename a generated character exactly once
  hasRenamedCharacter: boolean("has_renamed_character").default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
}, (t) => [
  index("idx_characters_user_id").on(t.userId),
]);

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
  campaignLength: text("campaign_length").default('standard'), // quick, standard, epic, or legendary
  mainHook: text("main_hook"), // Player-provided central premise/hook for the campaign
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
  // Session context - DM workspace state
  sessionName: text("session_name"), // Tonight's session name
  sessionFocus: text("session_focus"), // 1-2 sentence goal for this session
  activePressures: text("active_pressures").array(), // 2-3 short phrases (max)
  unresolvedThread: text("unresolved_thread"), // One dangling question
  // DM Authoring Doctrine - Campaign Spine
  campaignQuestion: text("campaign_question"), // One sentence: "What is the player actually deciding about the world?"
  campaignStakes: jsonb("campaign_stakes"), // 2-4 stakes, each 0-5, every action must touch at least one
  chapterGates: jsonb("chapter_gates"), // What belief/truth/commitment gates each chapter's advancement
  narrativeLog: jsonb("narrative_log"), // Structured log: why chapters advanced, why XP awarded, what was foreclosed
  // CAML 2.0 State-First Adventure System
  worldState: jsonb("world_state"), // Dynamic state facts that can change (trust, suspicion, awareness, etc.)
  npcAttitudes: jsonb("npc_attitudes"), // NPC relationships and attitudes that affect scenes
  pressureMeters: jsonb("pressure_meters"), // Pressure clocks (corruption, stability, time limits)
  availablePaths: jsonb("available_paths"), // Multiple viable approaches to obstacles
  // CAML 2.0 World Deterioration System
  globalStakes: jsonb("global_stakes"), // World-level deterioration that advances on scene ends/inaction
  unreliableNPCs: jsonb("unreliable_npcs"), // NPCs with trust thresholds, breaking points, secret agendas
  foreclosures: jsonb("foreclosures"), // Doors that seal permanently, knowledge that becomes inaccessible
  // CAML 2.0 Normative Residue System
  normativeResidues: jsonb("normative_residues"), // Lasting consequences with severity levels
  residueTriggers: jsonb("residue_triggers"), // What creates/increases residue
  repairPathways: jsonb("repair_pathways"), // Costly, risky ways to reduce residue
  // CAML Campaign Architecture - Faction & Instability System
  campaignInstability: text("campaign_instability"), // Core instability that drives the campaign: "Ancient magic reawakens beneath a fractured kingdom"
  factionModels: jsonb("faction_models"), // Structured faction data: goals, methods, hidden truths, reaction triggers, strength scores
  milestoneThresholds: jsonb("milestone_thresholds"), // Phase-based milestone triggers (Arrival, Revelation, Complication, Escalation, Resolution)
  sceneEligibility: jsonb("scene_eligibility"), // Conditional scene pools that unlock based on world state thresholds
  factionStrengths: jsonb("faction_strengths"), // Current faction power levels: { faction_name: number }
  // Procedural Quest Generation System
  proceduralQuestConfig: jsonb("procedural_quest_config"), // Triggers and templates for dynamic quest generation
  lastProceduralQuestScene: integer("last_procedural_quest_scene").default(0), // Scene number of last procedural quest
  // CAML2 Adventure Skeleton System
  villainModel: jsonb("villain_model"), // Villain archetype, goal, plan structure, reaction tree
  framingEvent: jsonb("framing_event"), // Adventure framing event: type, instability, visibility
  complicationsQueue: jsonb("complications_queue"), // Moral quandaries, twists, environmental modifiers
  encounterDesigns: jsonb("encounter_designs"), // Structured encounters with objectives, stakes, terrain, combat interest
  partyGoal: jsonb("party_goal"), // Primary/secondary/hidden goals with success/partial/failure states
  powerNetwork: jsonb("power_network"), // Faction groups, consequence chains, instability rules
  rivalAgent: jsonb("rival_agent"), // Competing NPC/group with interference actions and alliance possibility
  meterWorldEffects: jsonb("meter_world_effects"), // How stakes/meters alter physical environment at thresholds
  dynamicClimax: jsonb("dynamic_climax"), // Assembly rules, variations, and approach paths for final encounter
  // CAML2 Persistent Campaign Tracking
  villainCorruption: integer("villain_corruption").default(0), // Villain's corruption/power scale (0-10)
  partyReputation: integer("party_reputation").default(50), // Party's reputation (0-100)
  worldInstability: integer("world_instability").default(20), // Overall world instability (0-100)
  failureAdvancementLog: jsonb("failure_advancement_log"), // Log of how failures advanced the world state
  // Progressive scaffolding: tutorial sandbox (spec §13). When true, the DM
  // explicitly teaches + rewards off-menu attempts ("you can attempt anything
  // and the world responds"), seeding the off-menu habit early.
  isTutorial: boolean("is_tutorial").default(false),
  // The pristine source CAML 2.0 document captured at creation (generated or
  // imported). Lets "Publish to Trading Post" share the original module rather
  // than reconstructing it from played state. Null for older/legacy campaigns.
  camlSource: jsonb("caml_source"),
  // Generated cover art for the adventure, preserved so it travels with the
  // campaign everywhere it appears (campaign cards, Trading Post listing, etc.).
  coverImageUrl: text("cover_image_url"),
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
}, (t) => [
  index("idx_campaign_participants_campaign_id").on(t.campaignId),
  index("idx_campaign_participants_user_id").on(t.userId),
]);

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
  // Scene Schema v2 fields
  sceneType: text("scene_type"), // Current scene type: Combat, Exploration, Social, Puzzle, Discovery, Travel, Downtime
  sceneData: jsonb("scene_data"), // Full SceneV2 object with goal, obstacles, stakes, actions
  previousSceneType: text("previous_scene_type"), // For anti-combat-treadmill tracking
  actionLog: jsonb("action_log"), // Persistent log of player actions, AI narratives, and combat results
  // Cliffhanger hook for returning players
  cliffhangerHook: text("cliffhanger_hook"), // AI-generated 1-2 sentence DM hook shown on the campaign card
  cliffhangerGeneratedAt: text("cliffhanger_generated_at"), // ISO timestamp of last generation
}, (t) => [
  index("idx_campaign_sessions_campaign_id").on(t.campaignId),
]);

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
}, (t) => [
  index("idx_adventure_completions_user_id").on(t.userId),
  index("idx_adventure_completions_campaign_id").on(t.campaignId),
]);

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
}, (t) => [
  index("idx_dice_rolls_user_id").on(t.userId),
]);

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
  gold: integer("gold").default(0), // Gold held by this NPC in this campaign
  inventory: text("inventory").array().default([]), // Items held by this NPC in this campaign
  consumables: jsonb("consumables").default([]), // Consumable items (potions, scrolls) held by this NPC
  deathSaveSuccesses: integer("death_save_successes").default(0),
  deathSaveFailures: integer("death_save_failures").default(0),
  // Override NPC default behavior
  customBehaviorRules: jsonb("custom_behavior_rules").default({}),
  controlledBy: integer("controlled_by"), // User ID of player who controls this NPC, null = AI controlled
}, (t) => [
  index("idx_campaign_npcs_campaign_id").on(t.campaignId),
]);

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
}, (t) => [
  index("idx_campaign_invitations_campaign_id").on(t.campaignId),
]);

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
}, (t) => [
  index("idx_dm_notes_campaign_id").on(t.campaignId),
]);

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
}, (t) => [
  index("idx_chat_messages_campaign_id").on(t.campaignId),
  index("idx_chat_messages_user_id").on(t.userId),
]);

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
}, (t) => [
  index("idx_campaign_dungeon_maps_campaign_id").on(t.campaignId),
]);

export const insertCampaignDungeonMapSchema = createInsertSchema(campaignDungeonMaps).omit({
  id: true,
});

export type InsertCampaignDungeonMap = z.infer<typeof insertCampaignDungeonMapSchema>;
export type CampaignDungeonMap = typeof campaignDungeonMaps.$inferSelect;

// Procedural Exploration Hexes - Narrative-driven hex exploration
export const campaignExplorationHexes = pgTable("campaign_exploration_hexes", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  q: integer("q").notNull(), // Axial hex coordinate (column)
  r: integer("r").notNull(), // Axial hex coordinate (row)
  terrainType: text("terrain_type").notNull().default("Unknown"),
  locationName: text("location_name"),
  locationDescription: text("location_description"),
  hexMeta: jsonb("hex_meta"), // HexMetaV2 data
  isExplored: boolean("is_explored").default(false),
  isRevealed: boolean("is_revealed").default(false), // Visible but not yet visited
  exploredAt: text("explored_at"),
  revealedAt: text("revealed_at"),
  narrativeContext: text("narrative_context"), // The narrative that spawned this hex
  connectedDirections: jsonb("connected_directions").default([]), // Which directions have paths
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
}, (t) => [
  index("idx_campaign_exploration_hexes_campaign_id").on(t.campaignId),
]);

// Exploration state tracks the party's current position and exploration progress
export const campaignExplorationState = pgTable("campaign_exploration_state", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().unique(),
  currentHexQ: integer("current_hex_q").default(0),
  currentHexR: integer("current_hex_r").default(0),
  exploredHexCount: integer("explored_hex_count").default(1),
  totalDistance: integer("total_distance").default(0), // Hexes traveled
  lastMovementAt: text("last_movement_at"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at"),
});

export const insertCampaignExplorationHexSchema = createInsertSchema(campaignExplorationHexes).omit({
  id: true,
});

export const insertCampaignExplorationStateSchema = createInsertSchema(campaignExplorationState).omit({
  id: true,
});

export type InsertCampaignExplorationHex = z.infer<typeof insertCampaignExplorationHexSchema>;
export type CampaignExplorationHex = typeof campaignExplorationHexes.$inferSelect;
export type InsertCampaignExplorationState = z.infer<typeof insertCampaignExplorationStateSchema>;

export const cityMaps = pgTable("city_maps", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  worldLocationId: integer("world_location_id").notNull(),
  locationName: text("location_name").notNull(),
  seed: integer("seed").notNull(),
  layout: jsonb("layout").notNull(),
  discoveredBuildings: jsonb("discovered_buildings").default([]),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
}, (t) => [
  index("idx_city_maps_campaign_id").on(t.campaignId),
]);

export const insertCityMapSchema = createInsertSchema(cityMaps).omit({
  id: true,
});

export type InsertCityMap = z.infer<typeof insertCityMapSchema>;
export type CityMap = typeof cityMaps.$inferSelect;

export const capitalExploration = pgTable("capital_exploration", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  userId: integer("user_id").notNull(),
  worldLocationId: integer("world_location_id").notNull(),
  currentQ: integer("current_q").notNull().default(15),
  currentR: integer("current_r").notNull().default(2),
  revealedHexes: jsonb("revealed_hexes").default([]),
  discoveredBuildings: jsonb("discovered_buildings").default([]),
  hexLayout: jsonb("hex_layout"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
}, (t) => [
  index("idx_capital_exploration_campaign_id").on(t.campaignId),
  index("idx_capital_exploration_user_id").on(t.userId),
]);

export const insertCapitalExplorationSchema = createInsertSchema(capitalExploration).omit({
  id: true,
});

export type InsertCapitalExploration = z.infer<typeof insertCapitalExplorationSchema>;
export type CapitalExploration = typeof capitalExploration.$inferSelect;

export const trekRoutes = pgTable("trek_routes", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  userId: integer("user_id").notNull(),
  characterId: integer("character_id"),
  characterName: text("character_name"),
  originQ: integer("origin_q").default(0),
  originR: integer("origin_r").default(0),
  destinationQ: integer("destination_q").notNull(),
  destinationR: integer("destination_r").notNull(),
  destinationName: text("destination_name"),
  path: jsonb("path").notNull(),
  currentStep: integer("current_step").default(0),
  status: text("status").notNull().default("active"),
  pendingEncounter: jsonb("pending_encounter"),
  lootFound: jsonb("loot_found").default([]),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
}, (t) => [
  index("idx_trek_routes_campaign_id").on(t.campaignId),
  index("idx_trek_routes_user_id").on(t.userId),
]);

export const insertTrekRouteSchema = createInsertSchema(trekRoutes).omit({
  id: true,
});

export type InsertTrekRoute = z.infer<typeof insertTrekRouteSchema>;
export type TrekRoute = typeof trekRoutes.$inferSelect;
export type CampaignExplorationState = typeof campaignExplorationState.$inferSelect;

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
  // Quest Board fields
  isPostedToBoard: boolean("is_posted_to_board").default(false),
  postedAt: text("posted_at"),
  acceptedByCharacterId: integer("accepted_by_character_id"),
  acceptedByUserId: integer("accepted_by_user_id"),
  acceptedAt: text("accepted_at"),
  difficultyRating: text("difficulty_rating").default("moderate"), // easy, moderate, challenging, deadly
  estimatedDuration: text("estimated_duration"), // "1 session", "2-3 sessions", etc.
  prerequisites: text("prerequisites"), // Any requirements to accept
  // AI-discovered quests
  discoveredByAI: boolean("discovered_by_ai").default(false), // True if quest was generated by AI during gameplay
  discoveryContext: text("discovery_context"), // How/where the quest was discovered (e.g., "Overheard in the tavern")
  // CAML 2.0 role assignment support
  questGiver: text("quest_giver"), // NPC name who gives this quest (for CAML QuestGiver role assignment)
}, (t) => [
  index("idx_campaign_quests_campaign_id").on(t.campaignId),
]);

export const insertCampaignQuestSchema = createInsertSchema(campaignQuests).omit({
  id: true,
});

export type InsertCampaignQuest = z.infer<typeof insertCampaignQuestSchema>;
export type CampaignQuest = typeof campaignQuests.$inferSelect;

// Character bounties — server-authoritative state for Tavern bounty contracts.
// bountyId matches an entry in the shared bounty catalog (shared/rules/bounties.ts).
export const characterBounties = pgTable("character_bounties", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").notNull(),
  bountyId: text("bounty_id").notNull(), // catalog id, e.g. "goblin-chief"
  status: text("status").notNull().default("accepted"), // accepted | completed | failed
  campaignId: integer("campaign_id"), // campaign the bounty fight runs in
  reward: integer("reward").notNull().default(0), // gold paid on victory
  acceptedAt: text("accepted_at").notNull().default(new Date().toISOString()),
  resolvedAt: text("resolved_at"),
  cooldownUntil: text("cooldown_until"), // set on failure; blocks re-accept until past
}, (t) => [
  index("idx_character_bounties_character_id").on(t.characterId),
]);

export const insertCharacterBountySchema = createInsertSchema(characterBounties).omit({
  id: true,
});

export type InsertCharacterBounty = z.infer<typeof insertCharacterBountySchema>;
export type CharacterBounty = typeof characterBounties.$inferSelect;

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
}, (t) => [
  index("idx_user_world_progress_user_id").on(t.userId),
]);

export const insertUserWorldProgressSchema = createInsertSchema(userWorldProgress).omit({
  id: true,
});

export type InsertUserWorldProgress = z.infer<typeof insertUserWorldProgressSchema>;
export type UserWorldProgress = typeof userWorldProgress.$inferSelect;

// World Events - Persistent cross-campaign events that shape the shared world
export const worldEvents = pgTable("world_events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  eventType: text("event_type").notNull().default("narrative"),
  severity: text("severity").notNull().default("minor"),
  affectedRegionIds: integer("affected_region_ids").array().default([]),
  affectedLocationIds: integer("affected_location_ids").array().default([]),
  pressureEffects: jsonb("pressure_effects").default({}),
  sourceCampaignId: integer("source_campaign_id"),
  sourceCharacterId: integer("source_character_id"),
  sourceCharacterName: text("source_character_name"),
  triggerType: text("trigger_type").notNull().default("narrative"),
  triggerDetail: text("trigger_detail"),
  isActive: boolean("is_active").default(true),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertWorldEventSchema = createInsertSchema(worldEvents).omit({
  id: true,
});

export type InsertWorldEvent = z.infer<typeof insertWorldEventSchema>;
export type WorldEvent = typeof worldEvents.$inferSelect;

// World Discoveries - Aggregated cross-campaign discoveries revealed on world map
export const worldDiscoveries = pgTable("world_discoveries", {
  id: serial("id").primaryKey(),
  regionId: integer("region_id"),
  locationId: integer("location_id"),
  discoveryType: text("discovery_type").notNull().default("exploration"),
  title: text("title").notNull(),
  description: text("description"),
  discoveredByUserId: integer("discovered_by_user_id"),
  discoveredByCharacterName: text("discovered_by_character_name"),
  sourceCampaignId: integer("source_campaign_id"),
  hexQ: integer("hex_q"),
  hexR: integer("hex_r"),
  terrainType: text("terrain_type"),
  isPublic: boolean("is_public").default(true),
  metadata: jsonb("metadata").default({}),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
}, (t) => [
  index("idx_world_discoveries_source_campaign_id").on(t.sourceCampaignId),
]);

export const insertWorldDiscoverySchema = createInsertSchema(worldDiscoveries).omit({
  id: true,
});

export type InsertWorldDiscovery = z.infer<typeof insertWorldDiscoverySchema>;
export type WorldDiscovery = typeof worldDiscoveries.$inferSelect;

// World Whispers - Notifications to active campaigns about world events
export const worldWhispers = pgTable("world_whispers", {
  id: serial("id").primaryKey(),
  worldEventId: integer("world_event_id").notNull(),
  campaignId: integer("campaign_id").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  isDismissed: boolean("is_dismissed").default(false),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
}, (t) => [
  index("idx_world_whispers_campaign_id").on(t.campaignId),
]);

export const insertWorldWhisperSchema = createInsertSchema(worldWhispers).omit({
  id: true,
});

export type InsertWorldWhisper = z.infer<typeof insertWorldWhisperSchema>;
export type WorldWhisper = typeof worldWhispers.$inferSelect;

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
}, (t) => [
  index("idx_bulletin_posts_user_id").on(t.userId),
]);

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
}, (t) => [
  index("idx_bulletin_responses_post_id").on(t.postId),
  index("idx_bulletin_responses_user_id").on(t.userId),
]);

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
}, (t) => [
  index("idx_campaign_trace_events_campaign_id").on(t.campaignId),
]);

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
  // Group choice voting system for multiplayer
  activeGroupChoices: jsonb("active_group_choices").default([]), // [{id, text, description, dc, modifier, skillCheck, createdBy}]
  groupChoiceVotes: jsonb("group_choice_votes").default([]), // [{choiceId, characterId, characterName, userId, timestamp}]
  groupChoiceStatus: text("group_choice_status").default("none"), // none, pending, resolved
  groupChoiceThreshold: integer("group_choice_threshold").default(0), // 0 = majority, >0 = specific count needed
  groupChoiceResolution: jsonb("group_choice_resolution"), // {winningChoiceId, method: 'majority'|'initiative', votes: {...}}
  // DM messages log
  dmMessages: jsonb("dm_messages").default([]), // [{message, timestamp, type: 'narration'|'ooc'|'system'}]
  // Table-wide chat - all players can send messages anytime
  tableChat: jsonb("table_chat").default([]), // [{id, message, senderId, senderName, characterName, isDM, timestamp}]
  // Session artifacts - dragged items from sidebar
  sessionArtifacts: jsonb("session_artifacts").default([]), // [{type, entityId, name, data, addedAt}]
  // CAML entity sources for sidebar
  camlEntitySources: jsonb("caml_entity_sources").default({}), // {npcs: [], items: [], encounters: [], locations: []}
  // Status
  isActive: boolean("is_active").default(true),
  startedAt: text("started_at").notNull().default(new Date().toISOString()),
  lastUpdatedAt: text("last_updated_at"),
}, (t) => [
  index("idx_dm_session_states_campaign_id").on(t.campaignId),
]);

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
}, (t) => [
  index("idx_factions_campaign_id").on(t.campaignId),
]);

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
}, (t) => [
  index("idx_char_reputation_profiles_campaign_id").on(t.campaignId),
  index("idx_char_reputation_profiles_character_id").on(t.characterId),
]);

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
}, (t) => [
  index("idx_reputation_events_campaign_id").on(t.campaignId),
  index("idx_reputation_events_character_id").on(t.characterId),
]);

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
}, (t) => [
  index("idx_player_group_members_group_id").on(t.groupId),
  index("idx_player_group_members_user_id").on(t.userId),
]);

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
}, (t) => [
  index("idx_group_messages_group_id").on(t.groupId),
]);

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
}, (t) => [
  index("idx_world_memory_campaign_id").on(t.campaignId),
]);

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
}, (t) => [
  index("idx_unresolved_threads_campaign_id").on(t.campaignId),
]);

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
}, (t) => [
  index("idx_character_arc_insights_campaign_id").on(t.campaignId),
  index("idx_character_arc_insights_character_id").on(t.characterId),
]);

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
}, (t) => [
  index("idx_user_session_tracking_campaign_id").on(t.campaignId),
  index("idx_user_session_tracking_user_id").on(t.userId),
]);

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
}, (t) => [
  index("idx_user_activity_events_user_id").on(t.userId),
]);

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
}, (t) => [
  index("idx_user_sessions_analytics_user_id").on(t.userId),
]);

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
}, (t) => [
  index("idx_character_spells_character_id").on(t.characterId),
]);

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
}, (t) => [
  index("idx_user_badges_user_id").on(t.userId),
]);

export const insertUserBadgeSchema = createInsertSchema(userBadges).omit({
  id: true,
});

export type InsertUserBadge = z.infer<typeof insertUserBadgeSchema>;
export type UserBadge = typeof userBadges.$inferSelect;

// Magic Item Templates - Templates for magical items that can drop from milestones or be purchased
export const magicItemTemplates = pgTable("magic_item_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(), // weapon, armor, accessory, wondrous, consumable
  rarity: text("rarity").notNull().default("uncommon"), // uncommon, rare, very_rare, legendary
  // Level requirements - item is appropriate for these levels
  minLevel: integer("min_level").default(1),
  maxLevel: integer("max_level").default(20),
  // Class affinity - classes that benefit most from this item (null = any class)
  classAffinity: text("class_affinity").array(), // Fighter, Wizard, Cleric, etc.
  // Item stats
  magicBonus: integer("magic_bonus").default(0), // +1, +2, +3
  damageDice: text("damage_dice"), // e.g., "1d8", "2d6"
  damageType: text("damage_type"), // fire, ice, lightning, etc.
  baseAC: integer("base_ac"), // For armor
  properties: text("properties").array(), // finesse, versatile, etc.
  specialEffect: text("special_effect"), // Unique magical ability
  requiresAttunement: boolean("requires_attunement").default(false),
  attunementRequirements: text("attunement_requirements"), // e.g., "by a spellcaster"
  // Milestone drop settings
  milestoneType: text("milestone_type"), // boss_defeat, quest_complete, chapter_end, exploration, etc.
  dropWeight: integer("drop_weight").default(10), // Higher = more likely to drop
  // Shop settings
  isShoppable: boolean("is_shoppable").default(false), // Can be purchased in tavern
  shopPrice: integer("shop_price"), // Price in gold if purchasable
  // Flavor
  lore: text("lore"), // Background story of the item
  imageUrl: text("image_url"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertMagicItemTemplateSchema = createInsertSchema(magicItemTemplates).omit({
  id: true,
});

export type InsertMagicItemTemplate = z.infer<typeof insertMagicItemTemplateSchema>;
export type MagicItemTemplate = typeof magicItemTemplates.$inferSelect;

// Character Inventory - Actual items owned by characters (including bound magical items)
export const characterInventory = pgTable("character_inventory", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").notNull(),
  templateId: integer("template_id"), // Reference to magic_item_templates (null for non-magical items)
  // Item identity
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // weapon, armor, accessory, wondrous, consumable
  rarity: text("rarity").default("common"),
  // Binding and ownership
  isBound: boolean("is_bound").default(false), // Soulbound to character
  boundAt: text("bound_at"), // When item was bound
  acquiredFrom: text("acquired_from"), // "milestone", "shop", "quest", "loot"
  acquiredAt: text("acquired_at").notNull(),
  // Stats (copied from template or set manually)
  magicBonus: integer("magic_bonus").default(0),
  damageDice: text("damage_dice"),
  damageType: text("damage_type"),
  baseAC: integer("base_ac"),
  properties: text("properties").array(),
  specialEffect: text("special_effect"),
  requiresAttunement: boolean("requires_attunement").default(false),
  isAttuned: boolean("is_attuned").default(false),
  // Equipment status
  isEquipped: boolean("is_equipped").default(false),
  equipSlot: text("equip_slot"), // weapon, armor, shield, accessory
  // Quantity for stackable items
  quantity: integer("quantity").default(1),
  // Charges for wands, staves, and other charged items
  maxCharges: integer("max_charges"),
  currentCharges: integer("current_charges"),
  // Value
  value: integer("value").default(0), // Gold value
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
}, (t) => [
  index("idx_character_inventory_character_id").on(t.characterId),
]);

export const insertCharacterInventorySchema = createInsertSchema(characterInventory).omit({
  id: true,
});

export type InsertCharacterInventory = z.infer<typeof insertCharacterInventorySchema>;
export type CharacterInventory = typeof characterInventory.$inferSelect;

// Milestone Rewards - Tracks milestone rewards earned by characters
export const milestoneRewards = pgTable("milestone_rewards", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").notNull(),
  campaignId: integer("campaign_id").notNull(),
  // Milestone info
  milestoneType: text("milestone_type").notNull(), // boss_defeat, quest_complete, chapter_end, exploration
  milestoneName: text("milestone_name").notNull(), // e.g., "Defeated the Dragon", "Completed Chapter 3"
  sessionNumber: integer("session_number"), // Which session this occurred in
  // Reward info
  itemTemplateId: integer("item_template_id"), // Reference to magic_item_templates
  inventoryItemId: integer("inventory_item_id"), // Reference to the actual item created
  xpAwarded: integer("xp_awarded").default(0),
  goldAwarded: integer("gold_awarded").default(0),
  // Status
  isClaimed: boolean("is_claimed").default(false),
  claimedAt: text("claimed_at"),
  // Timestamps
  earnedAt: text("earned_at").notNull(),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
}, (t) => [
  index("idx_milestone_rewards_campaign_id").on(t.campaignId),
  index("idx_milestone_rewards_character_id").on(t.characterId),
]);

export const insertMilestoneRewardSchema = createInsertSchema(milestoneRewards).omit({
  id: true,
});

export type InsertMilestoneReward = z.infer<typeof insertMilestoneRewardSchema>;
export type MilestoneReward = typeof milestoneRewards.$inferSelect;

// =====================================================
// PROGRESSIVE SCAFFOLDING — per-player-per-campaign progression
// Tracks the player's scaffolding "rung" and the rolling window of turn
// signals that drives auto-advancement. Keyed on (campaignId, userId) because
// scaffolding teaches the *human's* skill, which persists across character
// swaps. See everdice-progressive-scaffolding-spec.md §3.1.
// rung / rulesVerbosity are text columns (the codebase uses TS union types,
// not pgEnum). Phase 0 records + evaluates in shadow mode (no behavior change).
// =====================================================
export const playerProgression = pgTable("player_progression", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  userId: integer("user_id").notNull(),
  rung: text("rung").notNull().default("GUIDED"), // GUIDED | HYBRID | OPEN | PURE
  rungPinned: boolean("rung_pinned").notNull().default(false), // manual override; disables auto-advancement
  expertMode: boolean("expert_mode").notNull().default(false), // pins to PURE + oracle engine (§9)
  rulesVerbosity: text("rules_verbosity"), // verbose | terse | off; null = derive from rung
  turnSignals: jsonb("turn_signals").default([]), // last WINDOW_SIZE TurnSignal[] (§3.2)
  confirmCount: integer("confirm_count").notNull().default(0), // consecutive promote-qualifying evals
  lastRungChangeTurn: integer("last_rung_change_turn").notNull().default(0),
  totalTurns: integer("total_turns").notNull().default(0),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
}, (t) => [
  index("idx_player_progression_campaign_id").on(t.campaignId),
  index("idx_player_progression_user_id").on(t.userId),
  uniqueIndex("uq_player_progression_campaign_user").on(t.campaignId, t.userId),
]);

export const insertPlayerProgressionSchema = createInsertSchema(playerProgression).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPlayerProgression = z.infer<typeof insertPlayerProgressionSchema>;
export type PlayerProgression = typeof playerProgression.$inferSelect;

// =====================================================
// HEARTH - Persistent Social Hub
// =====================================================

// Hearth Presence - Who is currently "in the Hall"
export const hearthPresence = pgTable("hearth_presence", {
  userId: integer("user_id").primaryKey(),
  seatZone: text("seat_zone").notNull().default("fire"), // fire, board, window, table
  statusText: text("status_text"), // "by the fire", "packing gear", etc.
  lastPingAt: text("last_ping_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export const insertHearthPresenceSchema = createInsertSchema(hearthPresence);
export type InsertHearthPresence = z.infer<typeof insertHearthPresenceSchema>;
export type HearthPresence = typeof hearthPresence.$inferSelect;

// Hearth Events - Append-only log for Memories feed
export const hearthEvents = pgTable("hearth_events", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // arrival, departure, toast, mark, board_post, milestone, system_murmur
  userId: integer("user_id"), // nullable for system events
  payload: jsonb("payload"), // { text, campaignId, summary, etc. }
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertHearthEventSchema = createInsertSchema(hearthEvents).omit({
  id: true,
});
export type InsertHearthEvent = z.infer<typeof insertHearthEventSchema>;
export type HearthEvent = typeof hearthEvents.$inferSelect;

// Hearth Board Posts - Noticeboard
export const hearthBoardPosts = pgTable("hearth_board_posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  category: text("category").notNull(), // message, hook, lfg, dm_call, gift
  title: text("title").notNull(),
  body: text("body"),
  pinned: boolean("pinned").default(false),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  expiresAt: text("expires_at"),
  deletedAt: text("deleted_at"),
});

export const insertHearthBoardPostSchema = createInsertSchema(hearthBoardPosts).omit({
  id: true,
});
export type InsertHearthBoardPost = z.infer<typeof insertHearthBoardPostSchema>;
export type HearthBoardPost = typeof hearthBoardPosts.$inferSelect;

// Hearth User State - Personal seat and return behavior
export const hearthUserState = pgTable("hearth_user_state", {
  userId: integer("user_id").primaryKey(),
  seatZone: text("seat_zone").default("fire"),
  lastVisitAt: text("last_visit_at"),
  lastDepartureNote: text("last_departure_note"),
  quietModeDefault: boolean("quiet_mode_default").default(false),
  returnStreak: integer("return_streak").default(0),
  // Return experience fields
  welcomeGreeting: text("welcome_greeting"),        // Cached AI-generated innkeeper greeting
  welcomeGeneratedAt: text("welcome_generated_at"), // ISO timestamp of last greeting generation
  rewardClaimedAt: text("reward_claimed_at"),        // ISO date (YYYY-MM-DD) when streak reward was last claimed
});

export const insertHearthUserStateSchema = createInsertSchema(hearthUserState);
export type InsertHearthUserState = z.infer<typeof insertHearthUserStateSchema>;
export type HearthUserState = typeof hearthUserState.$inferSelect;

// Hearth Murmur - System message of the day/week
export const hearthMurmur = pgTable("hearth_murmur", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  activeFrom: text("active_from").notNull(),
  activeTo: text("active_to").notNull(),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertHearthMurmurSchema = createInsertSchema(hearthMurmur).omit({
  id: true,
});
export type InsertHearthMurmur = z.infer<typeof insertHearthMurmurSchema>;
export type HearthMurmur = typeof hearthMurmur.$inferSelect;

// ============================================
// Scene Schema v2 - Varied Scene Resolution
// ============================================
// Design: Scenes focus on resolution, not encounters
// Combat becomes a consequence/escalation, not the default

export type SceneType =
  | "Combat"
  | "Exploration"
  | "Social"
  | "Puzzle"
  | "Discovery"
  | "Travel"
  | "Downtime";

export type ResolutionMode =
  | "Violence"
  | "Dialogue"
  | "Investigation"
  | "Ingenuity"
  | "Stealth"
  | "Endurance";

export interface SceneGoal {
  description: string;
  resolvableBy: ResolutionMode[];
  successState: string;
  failureState?: string;
  partialSuccessState?: string;
}

export interface SceneAction {
  label: string;
  resolutionMode: ResolutionMode;
  risk: "Low" | "Medium" | "High";
  description: string;
  requiresDiceRoll?: boolean;
  diceType?: string;
  rollDC?: number;
  skillType?: string;
  rollPurpose?: string;
  successText?: string;
  failureText?: string;
}

export interface SceneEscalation {
  condition: string;
  effect: string;
}

export interface SceneRewards {
  information?: string[];
  reputation?: string[];
  items?: string[];
  xp?: number;
  gold?: number;
}

export interface SceneStakes {
  onSuccess: string[];
  onFailure: string[];
  onEscalation?: string[];
}

export interface SceneV2 {
  id: string;
  type: SceneType;
  summary: string;
  goal: SceneGoal;
  obstacles: string[];
  stakes: SceneStakes;
  availableActions: SceneAction[];
  escalationTrigger?: SceneEscalation;
  rewards?: SceneRewards;
  nextSceneHints?: SceneType[];
}

// Scene type weights for varied generation
export const sceneTypeWeights: Record<SceneType, number> = {
  Exploration: 25,
  Social: 20,
  Discovery: 18,
  Travel: 12,
  Puzzle: 10,
  Downtime: 8,
  Combat: 7
};

// Resolution mode to skill mapping
export const resolutionSkillMap: Record<ResolutionMode, string[]> = {
  Violence: ["athletics", "acrobatics"],
  Dialogue: ["persuasion", "deception", "intimidation", "insight"],
  Investigation: ["investigation", "perception", "arcana", "history", "nature", "religion"],
  Ingenuity: ["sleight_of_hand", "arcana", "investigation", "survival"],
  Stealth: ["stealth", "deception", "sleight_of_hand"],
  Endurance: ["constitution", "athletics", "survival", "medicine"]
};

// ==================== Hex Metadata V2 Schema ====================
// Semantic narrative layer for dungeon map tiles

export type NarrativeTone = 
  | "Whispering"   // Something wants to communicate
  | "Sacred"       // Holy/consecrated ground
  | "Watched"      // Something is observing
  | "Unstable"     // Reality/structure is fragile
  | "Forgotten"    // Lost to time, secrets buried
  | "Hostile"      // Actively dangerous
  | "Benevolent"   // Safe haven, healing
  | "Sealed"       // Locked away, requires unlocking
  | "Cursed"       // Dark magic lingers
  | "Ancient";     // Pre-dates current civilization

export type HexState =
  | "Dormant"      // Quiet, nothing happening
  | "Stirring"     // Something is waking
  | "Active"       // Fully engaged
  | "Fading"       // Power diminishing
  | "Sealed"       // Locked/inaccessible
  | "Compromised"; // Damaged/corrupted

export type HexImportanceType =
  | "Revelation"   // Knowledge awaits (gold outline)
  | "Risk"         // Danger ahead (fractured outline)
  | "LostKnowledge" // Forgotten secrets (faded glow)
  | "Sanctuary"    // Safe zone (soft glow)
  | "Convergence"  // Multiple story threads meet
  | "None";        // Standard hex

export interface HexAffordances {
  exploration: number;   // 0-5: How much exploration this hex supports
  social: number;        // 0-5: Social interaction opportunities
  investigation: number; // 0-5: Clues and mysteries to uncover
  puzzle: number;        // 0-5: Logic/mechanical challenges
  combat: number;        // 0-5: Combat likelihood
}

export type HexEscalationTrigger = "Failure" | "Delay" | "Noise" | "Violence" | "Magic";

export type HexEscalationEffect = 
  | "IncreaseTension"
  | "ChangeTone"
  | "SealAdjacentHex"
  | "SummonThreat"
  | "RevealSecret"
  | "TriggerTrap";

export interface HexEscalation {
  trigger: HexEscalationTrigger;
  effect: HexEscalationEffect;
  threshold?: number; // Tension threshold to trigger
}

export type KnowledgeCategory = "Lore" | "Warning" | "Leverage" | "MapInsight" | "Weakness";

export interface KnowledgeHook {
  id: string;
  category: KnowledgeCategory;
  description: string;
  consumedOnUse?: boolean;
  revealedBy?: ResolutionMode; // What action reveals this
}

export interface HexUIHints {
  icon?: string;           // lucide icon name
  glowIntensity?: number;  // 0-1
  pulse?: boolean;
  tooltipNote?: string;    // One short sentence max
  outlineStyle?: "solid" | "dashed" | "fractured" | "glowing";
}

export type EnvironmentTag = 
  | "frost-touched" | "overgrown" | "waterlogged" | "ash-covered"
  | "sunlit" | "moonlit" | "torch-lit" | "dark"
  | "ancient-stone" | "living-wood" | "crystalline" | "corrupted"
  | "blood-stained" | "rune-carved" | "moss-covered" | "dusty";

export interface HexMetaV2 {
  narrativeTone: NarrativeTone;
  currentState: HexState;
  importanceType: HexImportanceType;
  affordances: HexAffordances;
  tension: number; // 0-100
  environmentTags: EnvironmentTag[];
  escalation?: HexEscalation;
  knowledgeHooks?: KnowledgeHook[];
  uiHints?: HexUIHints;
  regionName?: string;      // Named area for choice text
  regionDescription?: string; // Thematic one-liner
}

// Default affordances for different terrain types
export const defaultAffordancesByTerrain: Record<string, HexAffordances> = {
  "Chamber": { exploration: 3, social: 2, investigation: 4, puzzle: 3, combat: 2 },
  "Corridor": { exploration: 4, social: 1, investigation: 2, puzzle: 1, combat: 3 },
  "Portal": { exploration: 2, social: 0, investigation: 3, puzzle: 4, combat: 1 },
  "Shrine": { exploration: 2, social: 3, investigation: 4, puzzle: 2, combat: 1 },
  "Entrance": { exploration: 3, social: 2, investigation: 2, puzzle: 1, combat: 2 },
  "default": { exploration: 2, social: 1, investigation: 2, puzzle: 1, combat: 2 }
};

// Narrative tone icons for UI
export const narrativeToneIcons: Record<NarrativeTone, string> = {
  "Whispering": "ear",
  "Sacred": "sparkles",
  "Watched": "eye",
  "Unstable": "alert-triangle",
  "Forgotten": "clock",
  "Hostile": "skull",
  "Benevolent": "heart",
  "Sealed": "lock",
  "Cursed": "ghost",
  "Ancient": "landmark"
};

export const campaignSrdReferences = pgTable("campaign_srd_references", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  entityType: text("entity_type").notNull(), // monster, spell, magicitem, weapon
  entitySlug: text("entity_slug").notNull(), // open5e slug identifier
  entityName: text("entity_name").notNull(), // Display name
  entityData: jsonb("entity_data"), // Cached entity data for quick display
  notes: text("notes"), // Optional DM notes about this entity
  addedBy: integer("added_by").notNull(), // User who added it
  addedAt: text("added_at").notNull().default(new Date().toISOString()),
}, (t) => [
  index("idx_campaign_srd_references_campaign_id").on(t.campaignId),
]);

// Demo analytics - track guest demo usage and conversions
export const demoAnalytics = pgTable("demo_analytics", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(), // Browser fingerprint/session for tracking unique visitors
  eventType: text("event_type").notNull(), // started, character_selected, adventure_selected, scene_completed, dice_rolled, completed, converted
  eventData: jsonb("event_data"), // Additional event metadata (character chosen, adventure, scene number, etc.)
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  userAgent: text("user_agent"),
  referrer: text("referrer"),
  convertedUserId: integer("converted_user_id"), // If user signed up after demo, link to their user ID
});

export const insertDemoAnalyticsSchema = createInsertSchema(demoAnalytics).omit({
  id: true,
});

export type InsertDemoAnalytics = z.infer<typeof insertDemoAnalyticsSchema>;
export type DemoAnalytics = typeof demoAnalytics.$inferSelect;

export const insertCampaignSrdReferenceSchema = createInsertSchema(campaignSrdReferences).omit({
  id: true,
});

export type InsertCampaignSrdReference = z.infer<typeof insertCampaignSrdReferenceSchema>;
export type CampaignSrdReference = typeof campaignSrdReferences.$inferSelect;

// ==========================================
// Trading Post - Community Sharing System
// ==========================================

export const sharedAdventures = pgTable("shared_adventures", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  shortDescription: text("short_description"),
  camlData: jsonb("caml_data"),
  coverImageUrl: text("cover_image_url"),
  tags: text("tags").array().default([]),
  difficulty: text("difficulty").notNull().default("medium"),
  playerCountMin: integer("player_count_min").default(1),
  playerCountMax: integer("player_count_max").default(5),
  estimatedSessions: integer("estimated_sessions").default(1),
  genre: text("genre").default("fantasy"),
  avgRating: integer("avg_rating").default(0),
  totalRatings: integer("total_ratings").default(0),
  downloadCount: integer("download_count").default(0),
  isFeatured: boolean("is_featured").default(false),
  status: text("status").notNull().default("published"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at"),
});

export const insertSharedAdventureSchema = createInsertSchema(sharedAdventures).omit({
  id: true,
  avgRating: true,
  totalRatings: true,
  downloadCount: true,
  isFeatured: true,
});

export type InsertSharedAdventure = z.infer<typeof insertSharedAdventureSchema>;
export type SharedAdventure = typeof sharedAdventures.$inferSelect;

export const sharedItems = pgTable("shared_items", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  itemType: text("item_type").notNull().default("weapon"),
  rarity: text("rarity").notNull().default("common"),
  stats: jsonb("stats").default({}),
  lore: text("lore"),
  imageUrl: text("image_url"),
  tags: text("tags").array().default([]),
  avgRating: integer("avg_rating").default(0),
  totalRatings: integer("total_ratings").default(0),
  downloadCount: integer("download_count").default(0),
  isFeatured: boolean("is_featured").default(false),
  status: text("status").notNull().default("published"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertSharedItemSchema = createInsertSchema(sharedItems).omit({
  id: true,
  avgRating: true,
  totalRatings: true,
  downloadCount: true,
  isFeatured: true,
});

export type InsertSharedItem = z.infer<typeof insertSharedItemSchema>;
export type SharedItem = typeof sharedItems.$inferSelect;

export const tradingPostReviews = pgTable("trading_post_reviews", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  targetType: text("target_type").notNull(),
  targetId: integer("target_id").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
}, (t) => [
  index("idx_trading_post_reviews_user_id").on(t.userId),
]);

export const insertTradingPostReviewSchema = createInsertSchema(tradingPostReviews).omit({
  id: true,
});

export type InsertTradingPostReview = z.infer<typeof insertTradingPostReviewSchema>;
export type TradingPostReview = typeof tradingPostReviews.$inferSelect;

export const marketItemStats = pgTable("market_item_stats", {
  id: serial("id").primaryKey(),
  itemSlug: text("item_slug").notNull().unique(),
  basePrice: real("base_price").notNull(),
  currentPrice: real("current_price").notNull(),
  demandMultiplier: real("demand_multiplier").notNull().default(1.0),
  totalPurchases: integer("total_purchases").notNull().default(0),
  recentPurchases: integer("recent_purchases").notNull().default(0),
  lastPurchaseAt: text("last_purchase_at"),
  lastDecayAt: text("last_decay_at"),
});

export const insertMarketItemStatsSchema = createInsertSchema(marketItemStats).omit({
  id: true,
});
export type InsertMarketItemStats = z.infer<typeof insertMarketItemStatsSchema>;
export type MarketItemStats = typeof marketItemStats.$inferSelect;

export const playerListings = pgTable("player_listings", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull(),
  characterId: integer("character_id").notNull(),
  itemName: text("item_name").notNull(),
  itemData: jsonb("item_data").notNull(),
  askingPrice: integer("asking_price").notNull(),
  status: text("status").notNull().default("active"),
  buyerId: integer("buyer_id"),
  buyerCharacterId: integer("buyer_character_id"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  soldAt: text("sold_at"),
});

export const insertPlayerListingSchema = createInsertSchema(playerListings).omit({
  id: true,
  buyerId: true,
  buyerCharacterId: true,
  soldAt: true,
});
export type InsertPlayerListing = z.infer<typeof insertPlayerListingSchema>;
export type PlayerListing = typeof playerListings.$inferSelect;

// ==========================================
// Wander Mode - Hex Exploration System
// ==========================================

export const wanderRuns = pgTable("wander_runs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  campaignId: integer("campaign_id").notNull(),
  characterId: integer("character_id").notNull(),
  startHexQ: integer("start_hex_q").notNull(),
  startHexR: integer("start_hex_r").notNull(),
  currentHexQ: integer("current_hex_q").notNull(),
  currentHexR: integer("current_hex_r").notNull(),
  tick: integer("tick").notNull().default(0),
  fatigue: integer("fatigue").notNull().default(0),
  lastOutcomeType: text("last_outcome_type"),
  status: text("status").notNull().default("active"),
  flags: jsonb("flags"),
  startedAt: text("started_at").notNull().default(new Date().toISOString()),
  endedAt: text("ended_at"),
}, (t) => [
  index("idx_wander_runs_campaign_id").on(t.campaignId),
  index("idx_wander_runs_user_id").on(t.userId),
]);

export const insertWanderRunSchema = createInsertSchema(wanderRuns).omit({
  id: true,
});

export type InsertWanderRun = z.infer<typeof insertWanderRunSchema>;
export type WanderRun = typeof wanderRuns.$inferSelect;

export const wanderOutcomeLog = pgTable("wander_outcome_log", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull(),
  tick: integer("tick").notNull(),
  fromHexQ: integer("from_hex_q").notNull(),
  fromHexR: integer("from_hex_r").notNull(),
  toHexQ: integer("to_hex_q").notNull(),
  toHexR: integer("to_hex_r").notNull(),
  outcomeType: text("outcome_type").notNull(),
  outcomePayload: jsonb("outcome_payload"),
  rewardPayload: jsonb("reward_payload"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
}, (t) => [
  index("idx_wander_outcome_log_run_id").on(t.runId),
]);

export const insertWanderOutcomeLogSchema = createInsertSchema(wanderOutcomeLog).omit({
  id: true,
});

export type InsertWanderOutcomeLog = z.infer<typeof insertWanderOutcomeLogSchema>;
export type WanderOutcomeLog = typeof wanderOutcomeLog.$inferSelect;

export const wanderMarkers = pgTable("wander_markers", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  hexQ: integer("hex_q").notNull(),
  hexR: integer("hex_r").notNull(),
  markerType: text("marker_type").notNull(),
  title: text("title").notNull(),
  blurb: text("blurb"),
  tags: text("tags").array(),
  discoveredBy: integer("discovered_by").notNull(),
  persistence: text("persistence").notNull().default("permanent"),
  linkedDungeonId: integer("linked_dungeon_id"),
  linkedSceneId: text("linked_scene_id"),
  linkedFactionId: text("linked_faction_id"),
  linkedItemId: text("linked_item_id"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  expiresAtTick: integer("expires_at_tick"),
}, (t) => [
  index("idx_wander_markers_campaign_id").on(t.campaignId),
]);

export const insertWanderMarkerSchema = createInsertSchema(wanderMarkers).omit({
  id: true,
});

export type InsertWanderMarker = z.infer<typeof insertWanderMarkerSchema>;
export type WanderMarker = typeof wanderMarkers.$inferSelect;

export const hexExplorationStates = pgTable("hex_exploration_states", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  campaignId: integer("campaign_id").notNull(),
  hexQ: integer("hex_q").notNull(),
  hexR: integer("hex_r").notNull(),
  state: text("state").notNull().default("unknown"),
  markers: jsonb("markers"),
  notes: text("notes"),
  dangerOverride: integer("danger_override"),
  depletionUntilTick: integer("depletion_until_tick"),
  discoveredAt: text("discovered_at"),
  lastVisitedAt: text("last_visited_at"),
}, (t) => [
  index("idx_hex_exploration_states_campaign_id").on(t.campaignId),
  index("idx_hex_exploration_states_user_id").on(t.userId),
]);

export const insertHexExplorationStateSchema = createInsertSchema(hexExplorationStates).omit({
  id: true,
});

export type InsertHexExplorationState = z.infer<typeof insertHexExplorationStateSchema>;
export type HexExplorationState = typeof hexExplorationStates.$inferSelect;

// ==========================================
// Delve Mode - Dungeon Exploration System
// ==========================================

export const dungeonDefinitions = pgTable("dungeon_definitions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  themeTags: text("theme_tags").array(),
  recommendedLevelMin: integer("recommended_level_min").notNull().default(1),
  recommendedLevelMax: integer("recommended_level_max").notNull().default(5),
  mapWidth: integer("map_width").notNull().default(9),
  mapHeight: integer("map_height").notNull().default(9),
  mapLayout: jsonb("map_layout").notNull(),
  nodeTable: jsonb("node_table").notNull(),
  rewardProfile: jsonb("reward_profile"),
  completionHooks: jsonb("completion_hooks"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertDungeonDefinitionSchema = createInsertSchema(dungeonDefinitions).omit({
  id: true,
});

export type InsertDungeonDefinition = z.infer<typeof insertDungeonDefinitionSchema>;
export type DungeonDefinition = typeof dungeonDefinitions.$inferSelect;

export const dungeonRuns = pgTable("dungeon_runs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  campaignId: integer("campaign_id").notNull(),
  characterId: integer("character_id").notNull(),
  dungeonId: integer("dungeon_id").notNull(),
  currentQ: integer("current_q").notNull().default(0),
  currentR: integer("current_r").notNull().default(0),
  revealedCoords: jsonb("revealed_coords").notNull(),
  clearedNodes: jsonb("cleared_nodes"),
  disarmedTraps: jsonb("disarmed_traps"),
  solvedPuzzles: jsonb("solved_puzzles"),
  lightTicks: integer("light_ticks").notNull().default(20),
  supplies: integer("supplies").notNull().default(10),
  status: text("status").notNull().default("active"),
  flags: jsonb("flags"),
  startedAt: text("started_at").notNull().default(new Date().toISOString()),
  endedAt: text("ended_at"),
}, (t) => [
  index("idx_dungeon_runs_campaign_id").on(t.campaignId),
  index("idx_dungeon_runs_user_id").on(t.userId),
]);

export const insertDungeonRunSchema = createInsertSchema(dungeonRuns).omit({
  id: true,
});

export type InsertDungeonRun = z.infer<typeof insertDungeonRunSchema>;
export type DungeonRun = typeof dungeonRuns.$inferSelect;

export const dungeonNodeStates = pgTable("dungeon_node_states", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull(),
  nodeId: text("node_id").notNull(),
  state: text("state").notNull().default("hidden"),
  resolutionPayload: jsonb("resolution_payload"),
  lastResolvedAt: text("last_resolved_at"),
}, (t) => [
  index("idx_dungeon_node_states_run_id").on(t.runId),
]);

export const insertDungeonNodeStateSchema = createInsertSchema(dungeonNodeStates).omit({
  id: true,
});

export type InsertDungeonNodeState = z.infer<typeof insertDungeonNodeStateSchema>;
export type DungeonNodeState = typeof dungeonNodeStates.$inferSelect;

export const dungeonRewards = pgTable("dungeon_rewards", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull(),
  userId: integer("user_id").notNull(),
  characterId: integer("character_id").notNull(),
  itemDrops: jsonb("item_drops"),
  knowledgeDrops: jsonb("knowledge_drops"),
  unlockDrops: jsonb("unlock_drops"),
  goldValue: integer("gold_value").notNull().default(0),
  xpValue: integer("xp_value").notNull().default(0),
  grantedAt: text("granted_at").notNull().default(new Date().toISOString()),
}, (t) => [
  index("idx_dungeon_rewards_run_id").on(t.runId),
  index("idx_dungeon_rewards_user_id").on(t.userId),
]);

export const insertDungeonRewardSchema = createInsertSchema(dungeonRewards).omit({
  id: true,
});

export type InsertDungeonReward = z.infer<typeof insertDungeonRewardSchema>;
export type DungeonReward = typeof dungeonRewards.$inferSelect;

export const llmConfigs = pgTable("llm_configs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  provider: text("provider").notNull().default("openai"),
  apiKey: text("api_key").notNull(),
  endpoint: text("endpoint"),
  model: text("model"),
  isActive: boolean("is_active").notNull().default(true),
  label: text("label").notNull().default("My LLM"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at"),
}, (t) => [
  index("idx_llm_configs_user_id").on(t.userId),
]);

export const insertLlmConfigSchema = createInsertSchema(llmConfigs).omit({
  id: true,
});

export type InsertLlmConfig = z.infer<typeof insertLlmConfigSchema>;
export type LlmConfig = typeof llmConfigs.$inferSelect;

export const userFeedback = pgTable("user_feedback", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  feltConfusing: boolean("felt_confusing").notNull().default(false),
  feltSlow: boolean("felt_slow").notNull().default(false),
  wouldUse: boolean("would_use").notNull().default(false),
  comment: text("comment"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertUserFeedbackSchema = createInsertSchema(userFeedback).omit({
  id: true,
});

export type InsertUserFeedback = z.infer<typeof insertUserFeedbackSchema>;
export type UserFeedback = typeof userFeedback.$inferSelect;

// Player Houses — owned properties in the capital city
export const playerHouses = pgTable("player_houses", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").notNull(),
  campaignId: integer("campaign_id").notNull(),
  houseName: text("house_name").notNull(),
  houseType: text("house_type").notNull().default("modest"), // modest, comfortable, wealthy, noble, manor
  district: text("district").notNull(),
  purchasePrice: integer("purchase_price").notNull(),
  furnishings: jsonb("furnishings").default([]),
  storedItems: jsonb("stored_items").default([]),
  upgrades: jsonb("upgrades").default([]),
  purchasedAt: text("purchased_at").notNull(),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
}, (t) => [
  index("idx_player_houses_campaign_id").on(t.campaignId),
  index("idx_player_houses_character_id").on(t.characterId),
]);

export const insertPlayerHouseSchema = createInsertSchema(playerHouses).omit({
  id: true,
});

export type InsertPlayerHouse = z.infer<typeof insertPlayerHouseSchema>;
export type PlayerHouse = typeof playerHouses.$inferSelect;

// Player Bank — gold deposit/withdrawal at the capital bank
export const playerBank = pgTable("player_bank", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").notNull(),
  campaignId: integer("campaign_id").notNull(),
  balance: integer("balance").notNull().default(0),
  lastInterestAt: text("last_interest_at"),
  transactions: jsonb("transactions").default([]),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
}, (t) => [
  index("idx_player_bank_campaign_id").on(t.campaignId),
  index("idx_player_bank_character_id").on(t.characterId),
]);

export const insertPlayerBankSchema = createInsertSchema(playerBank).omit({
  id: true,
});

export type InsertPlayerBank = z.infer<typeof insertPlayerBankSchema>;
export type PlayerBank = typeof playerBank.$inferSelect;
