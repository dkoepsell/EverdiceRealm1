import { 
  users, type User, type InsertUser,
  discordConnections,
  pendingDiscordChoices,
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
  dmNotes, type DmNote, type InsertDmNote,
  // Chat system imports
  chatMessages, type ChatMessage, type InsertChatMessage,
  onlineUsers, type OnlineUser, type InsertOnlineUser,
  // Items database imports
  items, type Item, type InsertItem,
  // Dungeon maps and quests
  campaignDungeonMaps, type CampaignDungeonMap, type InsertCampaignDungeonMap,
  campaignQuests, type CampaignQuest, type InsertCampaignQuest,
  // Procedural exploration hexes
  campaignExplorationHexes, type CampaignExplorationHex, type InsertCampaignExplorationHex,
  campaignExplorationState, type CampaignExplorationState, type InsertCampaignExplorationState,
  // World map system
  worldRegions, type WorldRegion, type InsertWorldRegion,
  worldLocations, type WorldLocation, type InsertWorldLocation,
  userWorldProgress, type UserWorldProgress, type InsertUserWorldProgress,
  // Bulletin board
  bulletinPosts, type BulletinPost, type InsertBulletinPost,
  bulletinResponses, type BulletinResponse, type InsertBulletinResponse,
  // CAML trace events
  campaignTraceEvents, type CampaignTraceEvent, type InsertCampaignTraceEvent,
  // Reputation system
  factions, type Faction, type InsertFaction,
  characterReputationProfiles, type CharacterReputationProfile, type InsertCharacterReputationProfile,
  reputationEvents, type ReputationEvent, type InsertReputationEvent,
  // World memory and player groups
  playerGroups, type PlayerGroup, type InsertPlayerGroup,
  playerGroupMembers, type PlayerGroupMember, type InsertPlayerGroupMember,
  groupInvitations, type GroupInvitation, type InsertGroupInvitation,
  groupMessages, type GroupMessage, type InsertGroupMessage,
  worldMemory, type WorldMemory, type InsertWorldMemory,
  unresolvedThreads, type UnresolvedThread, type InsertUnresolvedThread,
  characterArcInsights, type CharacterArcInsight, type InsertCharacterArcInsight,
  userSessionTracking,
  // Spell system
  spells, type Spell, type InsertSpell,
  characterSpells, type CharacterSpell, type InsertCharacterSpell,
  characterSpellSlots, type CharacterSpellSlots, type InsertCharacterSpellSlots,
  // Badge system
  badges, type Badge, type InsertBadge,
  userBadges, type UserBadge, type InsertUserBadge,
  // Shared adventures
  sharedAdventures, type SharedAdventure, type InsertSharedAdventure,
  // Wander Mode
  wanderRuns, type WanderRun, type InsertWanderRun,
  wanderOutcomeLog, type WanderOutcomeLog, type InsertWanderOutcomeLog,
  wanderMarkers, type WanderMarker, type InsertWanderMarker,
  hexExplorationStates, type HexExplorationState, type InsertHexExplorationState,
  // Delve Mode
  dungeonDefinitions, type DungeonDefinition, type InsertDungeonDefinition,
  dungeonRuns, type DungeonRun, type InsertDungeonRun,
  dungeonNodeStates, type DungeonNodeState, type InsertDungeonNodeState,
  dungeonRewards, type DungeonReward, type InsertDungeonReward,
  // LLM Config
  llmConfigs, type LlmConfig, type InsertLlmConfig,
  // City maps and trek routes
  cityMaps, type CityMap, type InsertCityMap,
  trekRoutes, type TrekRoute, type InsertTrekRoute,
  userFeedback, type UserFeedback, type InsertUserFeedback,
  playerHouses, type PlayerHouse, type InsertPlayerHouse,
  playerBank, type PlayerBank, type InsertPlayerBank,
  capitalExploration, type CapitalExploration, type InsertCapitalExploration
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, asc, or, inArray } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByDiscordId(discordUserId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(userId: number, updates: Partial<User>): Promise<User | undefined>;
  updateUserProfile(userId: number, updates: { displayName?: string; email?: string | null }): Promise<User | undefined>;
  updateUserLastLogin(userId: number): Promise<void>;
  linkDiscordAccount(userId: number, discordUserId: string, discordUsername: string): Promise<User | undefined>;
  
  // Discord connection operations
  createDiscordConnection(discordUserId: string, discordUsername: string, connectionCode: string): Promise<any>;
  getDiscordConnectionByCode(code: string): Promise<any>;
  deleteDiscordConnection(id: number): Promise<boolean>;
  
  // Pending Discord choices operations
  createPendingDiscordChoice(data: { campaignId: number; sessionNumber: number; discordUserId: string; userId: number; choiceIndex: number; choiceText: string }): Promise<any>;
  getPendingDiscordChoice(campaignId: number): Promise<any>;
  markPendingChoiceProcessed(id: number): Promise<boolean>;
  
  // User Session operations
  createUserSession(session: InsertUserSession): Promise<UserSession>;
  getUserSession(token: string): Promise<UserSession | undefined>;
  deleteUserSession(token: string): Promise<boolean>;
  deleteUserSessionsForUser(userId: number): Promise<boolean>;
  
  // Character operations
  getAllCharacters(): Promise<Character[]>;
  getCharactersByUserId(userId: number): Promise<Character[]>;
  getCharacter(id: number): Promise<Character | undefined>;
  createCharacter(character: InsertCharacter): Promise<Character>;
  updateCharacter(id: number, character: Partial<Character>): Promise<Character | undefined>;
  deleteCharacter(id: number): Promise<boolean>;
  
  // Admin operations
  getAllUsers(): Promise<User[]>;
  getAllUsersWithCharacterCounts(): Promise<Array<User & { characterCount: number; campaignCount: number }>>;
  
  // Campaign operations
  getAllCampaigns(): Promise<Campaign[]>;
  getArchivedCampaigns(): Promise<Campaign[]>;
  getCampaign(id: number): Promise<Campaign | undefined>;
  getCampaignByDeploymentCode(code: string): Promise<Campaign | undefined>;
  getCampaignByDiscordChannel(channelId: string): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: number, campaign: Partial<Campaign>): Promise<Campaign | undefined>;
  updateCampaignSession(id: number, sessionNumber: number): Promise<Campaign | undefined>;
  archiveCampaign(id: number): Promise<Campaign | undefined>;
  completeCampaign(id: number): Promise<Campaign | undefined>;
  deleteCampaign(id: number): Promise<boolean>;
  
  // Campaign Participant operations
  getCampaignParticipants(campaignId: number): Promise<CampaignParticipant[]>;
  getCampaignParticipant(campaignId: number, userId: number): Promise<CampaignParticipant | undefined>;
  getCampaignParticipantByCharacter(campaignId: number, characterId: number): Promise<CampaignParticipant | undefined>;
  addCampaignParticipant(participant: InsertCampaignParticipant): Promise<CampaignParticipant>;
  updateCampaignParticipant(id: number, updates: Partial<CampaignParticipant>): Promise<CampaignParticipant | undefined>;
  removeCampaignParticipant(campaignId: number, userId: number): Promise<boolean>;
  
  // Turn-based campaign operations
  getCurrentTurn(campaignId: number): Promise<{ userId: number; startedAt: string } | undefined>;
  startNextTurn(campaignId: number): Promise<{ userId: number; startedAt: string } | undefined>;
  endCurrentTurn(campaignId: number): Promise<boolean>;
  rollInitiativeForSession(campaignId: number): Promise<Array<{ participantId: number; characterId: number; userId: number; characterName: string; initiative: number; roll: number; modifier: number }>>;
  
  // Campaign Session operations
  getCampaignSession(campaignId: number, sessionNumber: number): Promise<CampaignSession | undefined>;
  getCampaignSessions(campaignId: number): Promise<CampaignSession[]>;
  createCampaignSession(session: InsertCampaignSession): Promise<CampaignSession>;
  getCurrentSession(campaignId: number): Promise<CampaignSession | undefined>;
  advanceSessionStory(campaignId: number, storyData: any): Promise<CampaignSession>;
  advanceToNextSession(campaignId: number, summary?: string): Promise<CampaignSession>;
  addQuickContentToSession(campaignId: number, content: any): Promise<void>;
  startCombat(campaignId: number, combatState: any): Promise<void>;
  updateCombatState(campaignId: number, combatState: any): Promise<void>;
  updateSessionStoryState(campaignId: number, sessionNumber: number, storyState: any, sceneType?: string): Promise<CampaignSession | undefined>;
  
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

  // Chat operations
  getChatMessages(channel: string, limit?: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getOnlineUsers(): Promise<OnlineUser[]>;
  updateUserOnlineStatus(userId: number, username: string, isOnline: boolean): Promise<void>;
  setUserCurrentCampaign(userId: number, campaignId?: number): Promise<void>;
  
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
  
  // Item database operations
  getAllItems(): Promise<Item[]>;
  getItemsByType(type: string): Promise<Item[]>;
  getItem(id: number): Promise<Item | undefined>;
  getItemByName(name: string): Promise<Item | undefined>;
  createItem(item: InsertItem): Promise<Item>;
  updateItem(id: number, item: Partial<Item>): Promise<Item | undefined>;
  deleteItem(id: number): Promise<boolean>;
  
  // Campaign Dungeon Map operations
  getCampaignDungeonMap(campaignId: number): Promise<CampaignDungeonMap | undefined>;
  getCampaignDungeonMaps(campaignId: number): Promise<CampaignDungeonMap[]>;
  createCampaignDungeonMap(map: InsertCampaignDungeonMap): Promise<CampaignDungeonMap>;
  updateCampaignDungeonMap(id: number, updates: Partial<CampaignDungeonMap>): Promise<CampaignDungeonMap | undefined>;
  deleteCampaignDungeonMap(id: number): Promise<boolean>;
  
  // Procedural Exploration operations
  getExplorationHexes(campaignId: number): Promise<CampaignExplorationHex[]>;
  getExplorationHex(campaignId: number, q: number, r: number): Promise<CampaignExplorationHex | undefined>;
  createExplorationHex(hex: InsertCampaignExplorationHex): Promise<CampaignExplorationHex>;
  updateExplorationHex(id: number, updates: Partial<CampaignExplorationHex>): Promise<CampaignExplorationHex | undefined>;
  deleteExplorationHex(id: number): Promise<boolean>;
  getExplorationState(campaignId: number): Promise<CampaignExplorationState | undefined>;
  createExplorationState(state: InsertCampaignExplorationState): Promise<CampaignExplorationState>;
  updateExplorationState(campaignId: number, updates: Partial<CampaignExplorationState>): Promise<CampaignExplorationState | undefined>;
  
  // City Map operations
  getCityMap(campaignId: number, worldLocationId: number): Promise<CityMap | undefined>;
  createCityMap(cityMap: InsertCityMap): Promise<CityMap>;
  updateCityMap(id: number, updates: Partial<CityMap>): Promise<CityMap | undefined>;
  
  // Capital Exploration operations
  getCapitalExploration(campaignId: number, userId: number, worldLocationId: number): Promise<CapitalExploration | undefined>;
  createCapitalExploration(data: InsertCapitalExploration): Promise<CapitalExploration>;
  updateCapitalExploration(id: number, updates: Partial<CapitalExploration>): Promise<CapitalExploration | undefined>;

  // Trek Route operations
  getActiveTrekRoute(campaignId: number, userId: number): Promise<TrekRoute | undefined>;
  createTrekRoute(route: InsertTrekRoute): Promise<TrekRoute>;
  updateTrekRoute(id: number, updates: Partial<TrekRoute>): Promise<TrekRoute | undefined>;
  cancelTrekRoute(id: number): Promise<boolean>;

  // Player House operations
  getPlayerHouse(characterId: number, campaignId: number): Promise<PlayerHouse | undefined>;
  createPlayerHouse(house: InsertPlayerHouse): Promise<PlayerHouse>;
  updatePlayerHouse(id: number, updates: Partial<PlayerHouse>): Promise<PlayerHouse | undefined>;

  // Player Bank operations
  getPlayerBank(characterId: number, campaignId: number): Promise<PlayerBank | undefined>;
  createPlayerBank(bank: InsertPlayerBank): Promise<PlayerBank>;
  updatePlayerBank(id: number, updates: Partial<PlayerBank>): Promise<PlayerBank | undefined>;
  
  // Campaign Quest operations
  getCampaignQuests(campaignId: number): Promise<CampaignQuest[]>;
  getCampaignQuest(id: number): Promise<CampaignQuest | undefined>;
  createCampaignQuest(quest: InsertCampaignQuest): Promise<CampaignQuest>;
  updateCampaignQuest(id: number, updates: Partial<CampaignQuest>): Promise<CampaignQuest | undefined>;
  completeCampaignQuest(id: number): Promise<CampaignQuest | undefined>;
  deleteCampaignQuest(id: number): Promise<boolean>;
  
  // World Map operations
  getAllWorldRegions(): Promise<WorldRegion[]>;
  getWorldRegion(id: number): Promise<WorldRegion | undefined>;
  createWorldRegion(region: InsertWorldRegion): Promise<WorldRegion>;
  updateWorldRegion(id: number, updates: Partial<WorldRegion>): Promise<WorldRegion | undefined>;
  deleteWorldRegion(id: number): Promise<boolean>;
  
  // World Location operations
  getWorldLocations(regionId?: number): Promise<WorldLocation[]>;
  getWorldLocation(id: number): Promise<WorldLocation | undefined>;
  getWorldLocationByCampaign(campaignId: number): Promise<WorldLocation | undefined>;
  createWorldLocation(location: InsertWorldLocation): Promise<WorldLocation>;
  updateWorldLocation(id: number, updates: Partial<WorldLocation>): Promise<WorldLocation | undefined>;
  deleteWorldLocation(id: number): Promise<boolean>;
  
  // User World Progress operations
  getUserWorldProgress(userId: number): Promise<UserWorldProgress[]>;
  getUserProgressForRegion(userId: number, regionId: number): Promise<UserWorldProgress | undefined>;
  getUserProgressForLocation(userId: number, locationId: number): Promise<UserWorldProgress | undefined>;
  updateUserWorldProgress(userId: number, regionId: number | null, locationId: number | null, updates: Partial<UserWorldProgress>): Promise<UserWorldProgress>;
  discoverRegion(userId: number, regionId: number, campaignId?: number, sessionId?: number): Promise<UserWorldProgress>;
  discoverLocation(userId: number, locationId: number, campaignId?: number, sessionId?: number): Promise<UserWorldProgress>;
  completeRegion(userId: number, regionId: number): Promise<UserWorldProgress | undefined>;
  completeLocation(userId: number, locationId: number): Promise<UserWorldProgress | undefined>;
  
  // Bulletin Board operations
  getBulletinPosts(options?: { postType?: string; isActive?: boolean; limit?: number }): Promise<BulletinPost[]>;
  getUserBulletinPosts(userId: number): Promise<BulletinPost[]>;
  getBulletinPost(id: number): Promise<BulletinPost | undefined>;
  createBulletinPost(post: InsertBulletinPost): Promise<BulletinPost>;
  updateBulletinPost(id: number, updates: Partial<BulletinPost>): Promise<BulletinPost | undefined>;
  deleteBulletinPost(id: number): Promise<boolean>;
  
  // Bulletin Response operations
  getBulletinResponses(postId: number): Promise<BulletinResponse[]>;
  createBulletinResponse(response: InsertBulletinResponse): Promise<BulletinResponse>;
  deleteBulletinResponse(id: number): Promise<boolean>;
  
  // CAML Trace Event operations
  recordTraceEvent(event: InsertCampaignTraceEvent): Promise<CampaignTraceEvent>;
  getTraceEvents(campaignId: number, sessionId?: string): Promise<CampaignTraceEvent[]>;
  getTraceEventCount(campaignId: number): Promise<number>;
  clearTraceEvents(campaignId: number): Promise<boolean>;
  
  // Faction operations
  getFactions(campaignId: number): Promise<Faction[]>;
  getFaction(id: number): Promise<Faction | undefined>;
  createFaction(faction: InsertFaction): Promise<Faction>;
  updateFaction(id: number, updates: Partial<Faction>): Promise<Faction | undefined>;
  deleteFaction(id: number): Promise<boolean>;
  
  // Character Reputation Profile operations
  getCharacterReputationProfiles(characterId: number, campaignId?: number): Promise<CharacterReputationProfile[]>;
  getCharacterReputationProfile(characterId: number, factionId: number | null, campaignId: number): Promise<CharacterReputationProfile | undefined>;
  createCharacterReputationProfile(profile: InsertCharacterReputationProfile): Promise<CharacterReputationProfile>;
  updateCharacterReputationProfile(id: number, updates: Partial<CharacterReputationProfile>): Promise<CharacterReputationProfile | undefined>;
  deleteCharacterReputationProfile(id: number): Promise<boolean>;
  getCharacterStoryArc(characterId: number): Promise<{ profiles: CharacterReputationProfile[]; recentEvents: ReputationEvent[] }>;
  
  // Reputation Event operations
  getReputationEvents(characterId: number, campaignId?: number, limit?: number): Promise<ReputationEvent[]>;
  getReputationEvent(id: number): Promise<ReputationEvent | undefined>;
  createReputationEvent(event: InsertReputationEvent): Promise<ReputationEvent>;
  updateReputationEvent(id: number, updates: Partial<ReputationEvent>): Promise<ReputationEvent | undefined>;
  markReputationEventProcessed(id: number): Promise<boolean>;
  getCampaignReputationSignals(campaignId: number): Promise<{ characterId: number; characterName: string; profiles: CharacterReputationProfile[]; recentEvents: ReputationEvent[] }[]>;
  
  // Player Group operations
  getPlayerGroups(userId?: number): Promise<PlayerGroup[]>;
  getPlayerGroup(id: number): Promise<PlayerGroup | undefined>;
  createPlayerGroup(group: InsertPlayerGroup): Promise<PlayerGroup>;
  updatePlayerGroup(id: number, updates: Partial<PlayerGroup>): Promise<PlayerGroup | undefined>;
  deletePlayerGroup(id: number): Promise<boolean>;
  
  // Player Group Member operations
  getPlayerGroupMembers(groupId: number): Promise<PlayerGroupMember[]>;
  getUserGroupMemberships(userId: number): Promise<PlayerGroupMember[]>;
  addPlayerGroupMember(member: InsertPlayerGroupMember): Promise<PlayerGroupMember>;
  updatePlayerGroupMember(id: number, updates: Partial<PlayerGroupMember>): Promise<PlayerGroupMember | undefined>;
  removePlayerGroupMember(id: number): Promise<boolean>;
  
  // Group Invitation operations
  getGroupInvitation(id: number): Promise<GroupInvitation | undefined>;
  getGroupInvitations(groupId: number): Promise<GroupInvitation[]>;
  getUserPendingInvitations(userId: number): Promise<GroupInvitation[]>;
  createGroupInvitation(invitation: InsertGroupInvitation): Promise<GroupInvitation>;
  respondToInvitation(id: number, status: 'accepted' | 'declined'): Promise<GroupInvitation | undefined>;
  deleteGroupInvitation(id: number): Promise<boolean>;
  findUserByUsername(username: string): Promise<User | undefined>;
  
  // Group Message Board operations
  getGroupMessages(groupId: number): Promise<GroupMessage[]>;
  getGroupMessage(id: number): Promise<GroupMessage | undefined>;
  createGroupMessage(message: InsertGroupMessage): Promise<GroupMessage>;
  deleteGroupMessage(id: number): Promise<boolean>;
  toggleGroupMessagePin(id: number): Promise<GroupMessage | undefined>;
  
  // World Memory operations
  getWorldMemories(campaignId: number, memoryType?: string): Promise<WorldMemory[]>;
  getUnrevealedWorldMemories(campaignId: number): Promise<WorldMemory[]>;
  createWorldMemory(memory: InsertWorldMemory): Promise<WorldMemory>;
  updateWorldMemory(id: number, updates: Partial<WorldMemory>): Promise<WorldMemory | undefined>;
  revealWorldMemory(id: number): Promise<WorldMemory | undefined>;
  deleteWorldMemory(id: number): Promise<boolean>;
  
  // Unresolved Thread operations
  getUnresolvedThreads(campaignId: number, characterId?: number): Promise<UnresolvedThread[]>;
  getActiveThreads(campaignId: number): Promise<UnresolvedThread[]>;
  createUnresolvedThread(thread: InsertUnresolvedThread): Promise<UnresolvedThread>;
  updateUnresolvedThread(id: number, updates: Partial<UnresolvedThread>): Promise<UnresolvedThread | undefined>;
  resolveThread(id: number, notes?: string): Promise<UnresolvedThread | undefined>;
  deleteUnresolvedThread(id: number): Promise<boolean>;
  
  // Character Arc Insight operations
  getCharacterArcInsight(id: number): Promise<CharacterArcInsight | undefined>;
  getCharacterArcInsights(characterId: number, campaignId?: number): Promise<CharacterArcInsight[]>;
  getUnrevealedInsights(characterId: number): Promise<CharacterArcInsight[]>;
  createCharacterArcInsight(insight: InsertCharacterArcInsight): Promise<CharacterArcInsight>;
  revealInsight(id: number): Promise<CharacterArcInsight | undefined>;
  deleteCharacterArcInsight(id: number): Promise<boolean>;
  
  // User Session Tracking (for "Since Last Time...")
  getUserSessionTracking(userId: number, campaignId: number): Promise<any>;
  updateUserSessionTracking(userId: number, campaignId: number, bullets: any[]): Promise<any>;
  getSinceLastTimeBullets(userId: number, campaignId: number): Promise<string[]>;
  
  // Spell Library operations
  getAllSpells(): Promise<Spell[]>;
  getSpell(id: number): Promise<Spell | undefined>;
  getSpellByName(name: string): Promise<Spell | undefined>;
  getSpellsByLevel(level: number): Promise<Spell[]>;
  getSpellsByClass(className: string): Promise<Spell[]>;
  getSpellsBySchool(school: string): Promise<Spell[]>;
  createSpell(spell: InsertSpell): Promise<Spell>;
  seedSpells(spellsData: InsertSpell[]): Promise<number>;
  
  // Character Spell operations
  getCharacterSpells(characterId: number): Promise<(CharacterSpell & { spell: Spell })[]>;
  getCharacterSpell(characterId: number, spellId: number): Promise<CharacterSpell | undefined>;
  learnSpell(characterSpell: InsertCharacterSpell): Promise<CharacterSpell>;
  prepareSpell(characterId: number, spellId: number, prepared: boolean): Promise<CharacterSpell | undefined>;
  forgetSpell(characterId: number, spellId: number): Promise<boolean>;
  
  // Character Spell Slots operations
  getCharacterSpellSlots(characterId: number): Promise<CharacterSpellSlots | undefined>;
  initializeSpellSlots(characterId: number, slots: InsertCharacterSpellSlots): Promise<CharacterSpellSlots>;
  updateSpellSlots(characterId: number, updates: Partial<CharacterSpellSlots>): Promise<CharacterSpellSlots | undefined>;
  useSpellSlot(characterId: number, slotLevel: number): Promise<boolean>;
  resetSpellSlots(characterId: number): Promise<CharacterSpellSlots | undefined>;
  
  // Badge operations
  getAllBadges(): Promise<Badge[]>;
  getBadge(id: number): Promise<Badge | undefined>;
  getBadgeByName(name: string): Promise<Badge | undefined>;
  getBadgesByCategory(category: string): Promise<Badge[]>;
  createBadge(badge: InsertBadge): Promise<Badge>;
  
  // User Badge operations
  getUserBadges(userId: number): Promise<(UserBadge & { badge: Badge })[]>;
  awardBadge(userId: number, badgeId: number, context?: any): Promise<UserBadge>;
  hasUserBadge(userId: number, badgeId: number): Promise<boolean>;
  updateUserBadge(id: number, updates: Partial<UserBadge>): Promise<UserBadge | undefined>;
  
  // Magic Item Template operations
  getMagicItemTemplates(filters?: { rarity?: string; type?: string; minLevel?: number; maxLevel?: number; classAffinity?: string; isShoppable?: boolean }): Promise<any[]>;
  getMagicItemTemplate(id: number): Promise<any | undefined>;
  getMilestoneDrops(milestoneType: string, characterLevel: number, characterClass: string): Promise<any[]>;
  
  // Character Inventory operations (magical items)
  getCharacterInventory(characterId: number): Promise<any[]>;
  addItemToInventory(item: any): Promise<any>;
  updateInventoryItem(id: number, updates: any): Promise<any | undefined>;
  removeInventoryItem(id: number): Promise<boolean>;
  equipItem(itemId: number, slot: string): Promise<any | undefined>;
  unequipItem(itemId: number): Promise<any | undefined>;
  bindItem(itemId: number): Promise<any | undefined>;
  
  // Milestone Reward operations
  getMilestoneRewards(characterId: number, campaignId?: number): Promise<any[]>;
  getUnclaimedRewards(characterId: number): Promise<any[]>;
  createMilestoneReward(reward: any): Promise<any>;
  claimMilestoneReward(rewardId: number): Promise<any | undefined>;
  
  // Tavern Magic Shop operations
  getShopMagicItems(characterLevel?: number, characterClass?: string): Promise<any[]>;
  purchaseMagicItem(characterId: number, templateId: number): Promise<{ success: boolean; item?: any; error?: string }>;
  
  // Shared Adventures (Adventure Library) operations
  createSharedAdventure(adventure: InsertSharedAdventure): Promise<SharedAdventure>;
  getSharedAdventure(id: number): Promise<SharedAdventure | undefined>;
  getSharedAdventuresByUser(userId: number): Promise<SharedAdventure[]>;
  getAllSharedAdventures(options?: { limit?: number; genre?: string; difficulty?: string }): Promise<SharedAdventure[]>;
  deleteSharedAdventure(id: number): Promise<boolean>;

  // Wander Mode operations
  createWanderRun(run: InsertWanderRun): Promise<WanderRun>;
  getWanderRun(id: number): Promise<WanderRun | undefined>;
  getActiveWanderRun(userId: number, campaignId: number): Promise<WanderRun | undefined>;
  updateWanderRun(id: number, updates: Partial<WanderRun>): Promise<WanderRun | undefined>;
  createWanderOutcome(outcome: InsertWanderOutcomeLog): Promise<WanderOutcomeLog>;
  getWanderOutcomes(runId: number): Promise<WanderOutcomeLog[]>;
  createWanderMarker(marker: InsertWanderMarker): Promise<WanderMarker>;
  getWanderMarkers(campaignId: number): Promise<WanderMarker[]>;
  getWanderMarkersForHex(campaignId: number, hexQ: number, hexR: number): Promise<WanderMarker[]>;
  getHexExplorationState(userId: number, campaignId: number, hexQ: number, hexR: number): Promise<HexExplorationState | undefined>;
  upsertHexExplorationState(state: InsertHexExplorationState): Promise<HexExplorationState>;
  getExploredHexes(userId: number, campaignId: number): Promise<HexExplorationState[]>;

  // Delve Mode operations
  createDungeonDefinition(dungeon: InsertDungeonDefinition): Promise<DungeonDefinition>;
  getDungeonDefinition(id: number): Promise<DungeonDefinition | undefined>;
  getAllDungeonDefinitions(): Promise<DungeonDefinition[]>;
  createDungeonRun(run: InsertDungeonRun): Promise<DungeonRun>;
  getDungeonRun(id: number): Promise<DungeonRun | undefined>;
  getActiveDungeonRun(userId: number, campaignId: number): Promise<DungeonRun | undefined>;
  updateDungeonRun(id: number, updates: Partial<DungeonRun>): Promise<DungeonRun | undefined>;
  createDungeonNodeState(nodeState: InsertDungeonNodeState): Promise<DungeonNodeState>;
  getDungeonNodeStates(runId: number): Promise<DungeonNodeState[]>;
  updateDungeonNodeState(id: number, updates: Partial<DungeonNodeState>): Promise<DungeonNodeState | undefined>;
  upsertDungeonNodeState(runId: number, nodeId: string, updates: Partial<DungeonNodeState>): Promise<DungeonNodeState>;
  createDungeonReward(reward: InsertDungeonReward): Promise<DungeonReward>;
  getDungeonRewards(runId: number): Promise<DungeonReward[]>;

  // LLM Config operations
  getLlmConfig(userId: number): Promise<LlmConfig | undefined>;
  getLlmConfigs(userId: number): Promise<LlmConfig[]>;
  createLlmConfig(config: InsertLlmConfig): Promise<LlmConfig>;
  updateLlmConfig(id: number, updates: Partial<LlmConfig>): Promise<LlmConfig | undefined>;
  deleteLlmConfig(id: number): Promise<boolean>;

  // Feedback operations
  createUserFeedback(feedback: InsertUserFeedback): Promise<UserFeedback>;
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

  async getUserByDiscordId(discordUserId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.discordUserId === discordUserId);
  }

  async updateUser(userId: number, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    const updated = { ...user, ...updates };
    this.users.set(userId, updated);
    return updated;
  }

  async updateUserProfile(userId: number, updates: { displayName?: string; email?: string | null }): Promise<User | undefined> {
    return this.updateUser(userId, updates);
  }

  async updateUserLastLogin(userId: number): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      this.users.set(userId, { ...user, lastLogin: new Date().toISOString() });
    }
  }

  async linkDiscordAccount(userId: number, discordUserId: string, discordUsername: string): Promise<User | undefined> {
    return this.updateUser(userId, { discordUserId, discordUsername });
  }

  async createDiscordConnection(discordUserId: string, discordUsername: string, connectionCode: string): Promise<any> {
    return { id: 1, discordUserId, discordUsername, connectionCode, expiresAt: new Date(Date.now() + 600000).toISOString() };
  }

  async getDiscordConnectionByCode(code: string): Promise<any> {
    return undefined;
  }

  async deleteDiscordConnection(id: number): Promise<boolean> {
    return true;
  }

  async createPendingDiscordChoice(data: { campaignId: number; sessionNumber: number; discordUserId: string; userId: number; choiceIndex: number; choiceText: string }): Promise<any> {
    return { id: 1, ...data };
  }

  async getPendingDiscordChoice(campaignId: number): Promise<any> {
    return undefined;
  }

  async markPendingChoiceProcessed(id: number): Promise<boolean> {
    return true;
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
  
  async getCampaignByDeploymentCode(code: string): Promise<Campaign | undefined> {
    return Array.from(this.campaignStore.values()).find(c => c.deploymentCode === code);
  }
  
  async getCampaignByDiscordChannel(channelId: string): Promise<Campaign | undefined> {
    return Array.from(this.campaignStore.values()).find(c => c.discordChannelId === channelId && c.isDiscordDeployed);
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
  
  async updateSessionStoryState(campaignId: number, sessionNumber: number, storyState: any, sceneType?: string): Promise<CampaignSession | undefined> {
    const key = `${campaignId}:${sessionNumber}`;
    const session = this.sessionStore.get(key);
    if (!session) return undefined;
    const updatedSession: any = { ...session, storyState };
    if (sceneType) {
      updatedSession.previousSceneType = session.sceneType || null;
      updatedSession.sceneType = sceneType;
    }
    this.sessionStore.set(key, updatedSession);
    return updatedSession;
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
    // Create sample user with demo credentials (not a real secret - just sample data)
    const user = await this.createUser({
      username: "demo_user",
      password: "demo_sample_data"
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

  async createSharedAdventure(adventure: InsertSharedAdventure): Promise<SharedAdventure> { throw new Error("Not implemented"); }
  async getSharedAdventure(id: number): Promise<SharedAdventure | undefined> { return undefined; }
  async getSharedAdventuresByUser(userId: number): Promise<SharedAdventure[]> { return []; }
  async getAllSharedAdventures(): Promise<SharedAdventure[]> { return []; }
  async deleteSharedAdventure(id: number): Promise<boolean> { return false; }

  async getLlmConfig(userId: number): Promise<LlmConfig | undefined> { return undefined; }
  async getLlmConfigs(userId: number): Promise<LlmConfig[]> { return []; }
  async createLlmConfig(config: InsertLlmConfig): Promise<LlmConfig> { throw new Error("Not implemented"); }
  async updateLlmConfig(id: number, updates: Partial<LlmConfig>): Promise<LlmConfig | undefined> { return undefined; }
  async deleteLlmConfig(id: number): Promise<boolean> { return false; }
  async createUserFeedback(feedback: InsertUserFeedback): Promise<UserFeedback> { throw new Error("Not implemented"); }
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
  
  async updateUser(userId: number, updates: Partial<User>): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();
    return updated || undefined;
  }

  async updateUserProfile(userId: number, updates: { displayName?: string; email?: string | null }): Promise<User | undefined> {
    const safeUpdates: { displayName?: string; email?: string | null } = {};
    if (updates.displayName !== undefined) safeUpdates.displayName = updates.displayName;
    if (updates.email !== undefined) safeUpdates.email = updates.email;
    
    const [updated] = await db
      .update(users)
      .set(safeUpdates)
      .where(eq(users.id, userId))
      .returning();
    return updated || undefined;
  }

  async updateUserLastLogin(userId: number): Promise<void> {
    await db
      .update(users)
      .set({ lastLogin: new Date().toISOString() })
      .where(eq(users.id, userId));
  }

  async getUserByDiscordId(discordUserId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.discordUserId, discordUserId));
    return user || undefined;
  }

  async linkDiscordAccount(userId: number, discordUserId: string, discordUsername: string): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ discordUserId, discordUsername })
      .where(eq(users.id, userId))
      .returning();
    return updated || undefined;
  }

  // Discord connection operations
  async createDiscordConnection(discordUserId: string, discordUsername: string, connectionCode: string): Promise<any> {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes
    const [connection] = await db
      .insert(discordConnections)
      .values({ discordUserId, discordUsername, connectionCode, expiresAt })
      .returning();
    return connection;
  }

  async getDiscordConnectionByCode(code: string): Promise<any> {
    const [connection] = await db
      .select()
      .from(discordConnections)
      .where(eq(discordConnections.connectionCode, code));
    return connection || undefined;
  }

  async deleteDiscordConnection(id: number): Promise<boolean> {
    const result = await db.delete(discordConnections).where(eq(discordConnections.id, id));
    return true;
  }

  // Pending Discord choices operations
  async createPendingDiscordChoice(data: { campaignId: number; sessionNumber: number; discordUserId: string; userId: number; choiceIndex: number; choiceText: string }): Promise<any> {
    const [choice] = await db
      .insert(pendingDiscordChoices)
      .values({
        campaignId: data.campaignId,
        sessionNumber: data.sessionNumber,
        discordUserId: data.discordUserId,
        userId: data.userId,
        choiceIndex: data.choiceIndex,
        choiceText: data.choiceText,
        createdAt: new Date().toISOString(),
        processed: false
      })
      .returning();
    return choice;
  }

  async getPendingDiscordChoice(campaignId: number): Promise<any> {
    const [choice] = await db
      .select()
      .from(pendingDiscordChoices)
      .where(and(eq(pendingDiscordChoices.campaignId, campaignId), eq(pendingDiscordChoices.processed, false)))
      .orderBy(pendingDiscordChoices.createdAt);
    return choice || undefined;
  }

  async markPendingChoiceProcessed(id: number): Promise<boolean> {
    await db.update(pendingDiscordChoices).set({ processed: true }).where(eq(pendingDiscordChoices.id, id));
    return true;
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
  
  async getCharactersByUserId(userId: number): Promise<Character[]> {
    return db.select().from(characters).where(eq(characters.userId, userId));
  }
  
  async getCharacter(id: number): Promise<Character | undefined> {
    const [character] = await db.select().from(characters).where(eq(characters.id, id));
    return character || undefined;
  }
  
  // Admin operations
  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }
  
  async getAllUsersWithCharacterCounts(): Promise<Array<User & { characterCount: number; campaignCount: number }>> {
    const allUsers = await db.select().from(users);
    const result = [];
    
    for (const user of allUsers) {
      const userChars = await db.select().from(characters).where(eq(characters.userId, user.id));
      const userCamps = await db.select().from(campaigns).where(eq(campaigns.userId, user.id));
      
      result.push({
        ...user,
        characterCount: userChars.length,
        campaignCount: userCamps.length
      });
    }
    
    return result;
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
  
  async getCampaignByDeploymentCode(code: string): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.deploymentCode, code));
    return campaign || undefined;
  }
  
  async getCampaignByDiscordChannel(channelId: string): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns)
      .where(and(eq(campaigns.discordChannelId, channelId), eq(campaigns.isDiscordDeployed, true)));
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
  
  async getCampaignParticipantByCharacter(campaignId: number, characterId: number): Promise<CampaignParticipant | undefined> {
    const [participant] = await db
      .select()
      .from(campaignParticipants)
      .where(and(
        eq(campaignParticipants.campaignId, campaignId),
        eq(campaignParticipants.characterId, characterId)
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
  
  async canUserManageCharacter(userId: number, characterId: number): Promise<boolean> {
    // Check if user owns the character directly
    const character = await this.getCharacter(characterId);
    if (character && character.userId === userId) {
      return true;
    }
    
    // Check if user has this character assigned via campaign participation
    const [participation] = await db
      .select()
      .from(campaignParticipants)
      .where(and(
        eq(campaignParticipants.userId, userId),
        eq(campaignParticipants.characterId, characterId)
      ));
    
    return !!participation;
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
  
  async rollInitiativeForSession(campaignId: number): Promise<Array<{ participantId: number; characterId: number; userId: number; characterName: string; initiative: number; roll: number; modifier: number }>> {
    // First, clear all existing turn order and reset campaign turn state
    // This ensures clean state when rolling new initiative
    await db
      .update(campaignParticipants)
      .set({ turnOrder: null })
      .where(eq(campaignParticipants.campaignId, campaignId));
    
    await db
      .update(campaigns)
      .set({
        currentTurnUserId: null,
        turnStartedAt: null
      })
      .where(eq(campaigns.id, campaignId));
    
    // Get all active participants
    const participants = await db
      .select()
      .from(campaignParticipants)
      .where(and(
        eq(campaignParticipants.campaignId, campaignId),
        eq(campaignParticipants.isActive, true)
      ));
    
    if (participants.length === 0) {
      return [];
    }
    
    // Roll initiative for each participant based on their character's DEX modifier
    const initiativeResults = await Promise.all(
      participants.map(async (participant) => {
        const character = await this.getCharacter(participant.characterId);
        
        // Calculate DEX modifier (standard D&D formula: (stat - 10) / 2)
        const dexScore = character?.stats?.dexterity || 10;
        const dexModifier = Math.floor((dexScore - 10) / 2);
        
        // Roll d20 + DEX modifier
        const roll = Math.floor(Math.random() * 20) + 1;
        const initiative = roll + dexModifier;
        
        return {
          participantId: participant.id,
          characterId: participant.characterId,
          userId: participant.userId,
          characterName: character?.name || 'Unknown',
          initiative,
          roll,
          modifier: dexModifier
        };
      })
    );
    
    // Sort by initiative (highest first), with ties broken by DEX modifier, then random
    initiativeResults.sort((a, b) => {
      if (b.initiative !== a.initiative) {
        return b.initiative - a.initiative;
      }
      if (b.modifier !== a.modifier) {
        return b.modifier - a.modifier;
      }
      return Math.random() - 0.5;
    });
    
    // Update turnOrder for each participant based on initiative
    await Promise.all(
      initiativeResults.map(async (result, index) => {
        await db
          .update(campaignParticipants)
          .set({ turnOrder: index + 1 })
          .where(eq(campaignParticipants.id, result.participantId));
      })
    );
    
    // Set the first player's turn
    if (initiativeResults.length > 0) {
      const now = new Date().toISOString();
      await db
        .update(campaigns)
        .set({
          currentTurnUserId: initiativeResults[0].userId,
          turnStartedAt: now,
          isTurnBased: true
        })
        .where(eq(campaigns.id, campaignId));
    }
    
    return initiativeResults;
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
        equipment: ["Greatsword", "Heavy Crossbow", "Plate Armor", "Tower Shield"],
        consumables: JSON.stringify([
          { name: "Healing Potion", quantity: 3, type: "healing", healDice: "2d4", healBonus: 2, effect: "Restores 2d4+2 HP" },
          { name: "Revivify Scroll", quantity: 2, type: "resurrection", effect: "Revives a dead creature within 1 minute of death to 1 HP" }
        ]),
        combatAbilities: JSON.stringify([
          "Protective Strike: Disadvantage on attacks against allies within 5 feet",
          "Second Wind: Once per rest, regain 1d10+5 hit points as a bonus action",
          "Cleaving Attack: After dropping a foe, can make another attack"
        ]),
        gold: 150,
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
        consumables: JSON.stringify([
          { name: "Healing Potion", quantity: 4, type: "healing", healDice: "2d4", healBonus: 2, effect: "Restores 2d4+2 HP" },
          { name: "Greater Healing Potion", quantity: 1, type: "healing", healDice: "4d4", healBonus: 4, effect: "Restores 4d4+4 HP" },
          { name: "Revivify Scroll", quantity: 2, type: "resurrection", effect: "Revives a dead creature within 1 minute of death to 1 HP" }
        ]),
        supportAbilities: JSON.stringify([
          "Healing Word: Restore 1d4+4 hit points to an ally within 60 feet",
          "Goodberry: Create 10 berries that each restore 1 hit point and provide nourishment",
          "Pass Without Trace: Help the group move stealthily through natural environments"
        ]),
        gold: 200,
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
        consumables: JSON.stringify([
          { name: "Healing Potion", quantity: 2, type: "healing", healDice: "2d4", healBonus: 2, effect: "Restores 2d4+2 HP" },
          { name: "Antitoxin", quantity: 2, type: "buff", effect: "Advantage on poison saves for 1 hour" },
          { name: "Revivify Scroll", quantity: 2, type: "resurrection", effect: "Revives a dead creature within 1 minute of death to 1 HP" }
        ]),
        combatAbilities: JSON.stringify([
          "Smoke Bomb: Create a 10-foot cloud of smoke to obscure vision",
          "Shock Trap: Place a trap that deals 2d6 lightning damage when triggered",
          "Analyze Weakness: Identify vulnerabilities in creatures or structures"
        ]),
        gold: 175,
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
        consumables: JSON.stringify([
          { name: "Healing Potion", quantity: 2, type: "healing", healDice: "2d4", healBonus: 2, effect: "Restores 2d4+2 HP" },
          { name: "Revivify Scroll", quantity: 2, type: "resurrection", effect: "Revives a dead creature within 1 minute of death to 1 HP" }
        ]),
        supportAbilities: JSON.stringify([
          "Bardic Inspiration: Grant allies a d6 bonus to ability checks, attacks, or saves",
          "Countercharm: Protect allies from being charmed or frightened",
          "Song of Rest: Help allies recover additional hit points during short rests"
        ]),
        gold: 250,
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
        consumables: JSON.stringify([
          { name: "Healing Potion", quantity: 3, type: "healing", healDice: "2d4", healBonus: 2, effect: "Restores 2d4+2 HP" },
          { name: "Antitoxin", quantity: 1, type: "buff", effect: "Advantage on poison saves for 1 hour" },
          { name: "Revivify Scroll", quantity: 2, type: "resurrection", effect: "Revives a dead creature within 1 minute of death to 1 HP" }
        ]),
        combatAbilities: JSON.stringify([
          "Shield Master: Use shield to protect allies from area effects",
          "Dwarven Resilience: Advantage on saving throws against poison",
          "Combat Maneuvers: Trip, disarm, or push opponents in battle"
        ]),
        gold: 125,
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
      username: process.env.DEMO_USER_NAME || "demo_user",
      password: process.env.DEMO_USER_PASSWORD || "demo_password"
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

  // Migration: Add narrative structure to existing dungeon map tiles
  async migrateDungeonMapsWithNarrative() {
    console.log("Migrating existing dungeon maps to include narrative data...");
    
    // Environment-specific tile descriptions
    const ENVIRONMENT_TILE_NARRATIVES: Record<string, Record<string, { short: string; atmosphere: string }>> = {
      dungeon: {
        floor: { short: 'Stone floor worn by ages', atmosphere: 'Cold stone echoes your footsteps' },
        wall: { short: 'Ancient stonework', atmosphere: 'Massive blocks fitted without mortar' },
        corridor: { short: 'Narrow passage', atmosphere: 'Shadows dance in the torchlight' },
        default: { short: 'Dark chamber', atmosphere: 'Shadows cling to every corner' }
      },
      forest: {
        grass: { short: 'Forest clearing', atmosphere: 'Dappled sunlight filters through leaves' },
        path: { short: 'Winding trail', atmosphere: 'A well-worn path through the trees' },
        tree: { short: 'Dense foliage', atmosphere: 'Ancient oaks tower above' },
        dense_forest: { short: 'Impenetrable thicket', atmosphere: 'Thorns and brambles block the way' },
        clearing: { short: 'Sunlit glade', atmosphere: 'A peaceful break in the canopy' },
        default: { short: 'Forest floor', atmosphere: 'Birds sing in the branches above' }
      },
      cave: {
        floor: { short: 'Cavern floor', atmosphere: 'Smooth stone worn by water' },
        rock: { short: 'Solid rock wall', atmosphere: 'Natural stone formations' },
        stalactite: { short: 'Crystal formations', atmosphere: 'Minerals glitter faintly' },
        underground_lake: { short: 'Dark waters', atmosphere: 'Still black water reflects nothing' },
        default: { short: 'Cave passage', atmosphere: 'Echoes reverberate in the darkness' }
      },
      town: {
        road: { short: 'Cobblestone street', atmosphere: 'Busy market sounds surround you' },
        building: { short: 'Stone structure', atmosphere: 'Smoke rises from chimneys' },
        market: { short: 'Market square', atmosphere: 'Merchants hawk their wares' },
        tavern: { short: 'Welcoming tavern', atmosphere: 'Warmth and laughter spill out' },
        well: { short: 'Town well', atmosphere: 'Fresh water bubbles up' },
        default: { short: 'Town center', atmosphere: 'Citizens go about their day' }
      },
      swamp: {
        mud: { short: 'Squelching mud', atmosphere: 'Your boots sink with each step' },
        bog: { short: 'Treacherous bog', atmosphere: 'Murky water conceals dangers' },
        reeds: { short: 'Tall reeds', atmosphere: 'Things rustle unseen' },
        bridge: { short: 'Rickety crossing', atmosphere: 'Rotting planks creak ominously' },
        default: { short: 'Fetid marsh', atmosphere: 'Mist clings to everything' }
      },
      desert: {
        sand: { short: 'Endless sands', atmosphere: 'Heat shimmers on the horizon' },
        dune: { short: 'Towering dune', atmosphere: 'Wind-sculpted sand rises high' },
        oasis: { short: 'Blessed oasis', atmosphere: 'Palm trees offer shade' },
        default: { short: 'Scorched earth', atmosphere: 'The sun beats down mercilessly' }
      },
      mountain: {
        path: { short: 'Rocky trail', atmosphere: 'Loose stones shift underfoot' },
        rock: { short: 'Sheer cliff', atmosphere: 'Jagged peaks pierce the sky' },
        clearing: { short: 'Mountain plateau', atmosphere: 'Wind howls across the heights' },
        default: { short: 'High ground', atmosphere: 'The world spreads below you' }
      }
    };
    
    // Detect environment from map name
    function detectEnvironment(name?: string): string {
      const text = (name || '').toLowerCase();
      if (text.includes('forest') || text.includes('glade') || text.includes('grove') || text.includes('wood')) return 'forest';
      if (text.includes('cave') || text.includes('cavern')) return 'cave';
      if (text.includes('swamp') || text.includes('marsh') || text.includes('bog')) return 'swamp';
      if (text.includes('mountain') || text.includes('peak') || text.includes('cliff')) return 'mountain';
      if (text.includes('desert') || text.includes('dune') || text.includes('sand')) return 'desert';
      if (text.includes('town') || text.includes('city') || text.includes('village')) return 'town';
      return 'dungeon';
    }
    
    try {
      const allMaps = await db.select().from(campaignDungeonMaps);
      let migratedCount = 0;
      
      for (const dungeonMap of allMaps) {
        if (!dungeonMap.mapData) continue;
        
        const mapData = typeof dungeonMap.mapData === 'string' 
          ? JSON.parse(dungeonMap.mapData) 
          : dungeonMap.mapData;
        
        if (!mapData.tiles || !Array.isArray(mapData.tiles)) continue;
        
        let needsUpdate = false;
        
        const firstTileRow = mapData.tiles[0];
        if (firstTileRow && firstTileRow[0] && firstTileRow[0].narrative !== undefined) {
          continue;
        }
        
        // Detect environment and set on map data
        const environment = mapData.environment || detectEnvironment(mapData.name);
        mapData.environment = environment;
        const envNarratives = ENVIRONMENT_TILE_NARRATIVES[environment] || ENVIRONMENT_TILE_NARRATIVES.dungeon;
        
        mapData.tiles = mapData.tiles.map((row: any[], y: number) => 
          row.map((tile: any, x: number) => {
            const tileNarrative = envNarratives[tile.type] || envNarratives.default;
            
            let narrative: any = {
              discovered: tile.explored || tile.visible || false,
              dangerLevel: 'safe',
              interactable: false,
              shortDescription: tileNarrative?.short
            };
            
            switch (tile.type) {
              case 'treasure':
                narrative.shortDescription = environment === 'forest' ? 'Hidden cache beneath roots' : 
                                             environment === 'desert' ? 'Buried treasure glints' : 
                                             'A glittering treasure awaits';
                narrative.items = ['Treasure chest'];
                narrative.interactable = true;
                break;
              case 'trap':
                narrative.shortDescription = environment === 'forest' ? 'Concealed snare' : 
                                             environment === 'swamp' ? 'Quicksand pit' : 
                                             'Danger lurks here';
                narrative.dangerLevel = 'medium';
                narrative.events = ['Trap detected'];
                break;
              case 'pit':
                narrative.shortDescription = environment === 'cave' ? 'Bottomless chasm' : 
                                             environment === 'mountain' ? 'Sheer drop' : 
                                             'Dark pit';
                narrative.dangerLevel = 'high';
                break;
              case 'secret_door':
                narrative.secretInfo = environment === 'forest' ? 'Vines conceal a hidden path' : 
                                       environment === 'cave' ? 'A crack in the wall opens' : 
                                       'A hidden passage lies concealed';
                narrative.discovered = false;
                break;
              case 'stairs_up':
              case 'stairs_down':
                narrative.shortDescription = environment === 'forest' ? (tile.type === 'stairs_up' ? 'Uphill trail' : 'Downhill path') :
                                             environment === 'cave' ? (tile.type === 'stairs_up' ? 'Ascending tunnel' : 'Descending passage') :
                                             (tile.type === 'stairs_up' ? 'Stairs leading up' : 'Stairs leading down');
                narrative.interactable = true;
                break;
              case 'door':
              case 'door_locked':
                narrative.shortDescription = environment === 'forest' ? (tile.type === 'door_locked' ? 'Blocked path' : 'Forest clearing') :
                                             environment === 'cave' ? (tile.type === 'door_locked' ? 'Collapsed passage' : 'Cave opening') :
                                             (tile.type === 'door_locked' ? 'A locked door' : 'An open doorway');
                narrative.interactable = true;
                break;
            }
            
            if (mapData.playerPosition && mapData.playerPosition.x === x && mapData.playerPosition.y === y) {
              narrative.shortDescription = mapData.currentRoom?.description || narrative.shortDescription || 'Current location';
              narrative.description = mapData.currentRoom?.description;
            }
            
            needsUpdate = true;
            return { ...tile, narrative };
          })
        );
        
        if (!mapData.narrativeContext) {
          const envAtmosphere = envNarratives.default?.atmosphere || 'An air of mystery surrounds you';
          mapData.narrativeContext = {
            theme: mapData.name || 'Mysterious location',
            atmosphere: mapData.lighting === 'dark' ? 'Darkness engulfs everything' : envAtmosphere,
            discoveredLore: [],
            storyHooks: []
          };
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          await db.update(campaignDungeonMaps)
            .set({ mapData })
            .where(eq(campaignDungeonMaps.id, dungeonMap.id));
          migratedCount++;
        }
      }
      
      console.log(`Migrated ${migratedCount} dungeon maps with environment-aware narrative data`);
    } catch (error) {
      console.error("Error migrating dungeon maps:", error);
    }
  }

  // Enhanced live session management methods
  async getCurrentSession(campaignId: number): Promise<CampaignSession | undefined> {
    const [session] = await db
      .select()
      .from(campaignSessions)
      .where(and(
        eq(campaignSessions.campaignId, campaignId),
        eq(campaignSessions.isCompleted, false)
      ))
      .orderBy(desc(campaignSessions.sessionNumber))
      .limit(1);
    return session;
  }

  async advanceSessionStory(campaignId: number, storyData: any): Promise<CampaignSession> {
    const currentSession = await this.getCurrentSession(campaignId);
    if (!currentSession) {
      throw new Error("No active session found");
    }

    // CRITICAL: Sync is_in_combat column with storyState.inCombat to prevent desync
    const inCombat = storyData.storyState?.inCombat || false;
    
    // Scene Schema v2: Track scene type for anti-combat-treadmill
    const previousSceneType = (currentSession as any).sceneType || null;
    const newSceneType = storyData.sceneType || (inCombat ? 'Combat' : null);

    const existingLog = (currentSession as any).actionLog || [];
    const newLogEntries = storyData.actionLogEntries || [];
    const MAX_LOG_ENTRIES = 200;
    const combinedLog = [...existingLog, ...newLogEntries].slice(-MAX_LOG_ENTRIES);
    
    const updateData: any = {
      narrative: storyData.narrative,
      dmNarrative: storyData.dmNarrative,
      choices: storyData.choices,
      storyState: storyData.storyState,
      npcInteractions: storyData.npcInteractions,
      playerChoicesMade: storyData.playerChoicesMade,
      isInCombat: inCombat,
      updatedAt: new Date().toISOString(),
      actionLog: combinedLog
    };
    
    // Update scene type tracking if we have a new scene type
    if (newSceneType) {
      updateData.sceneType = newSceneType;
      updateData.previousSceneType = previousSceneType;
    }

    const [updatedSession] = await db
      .update(campaignSessions)
      .set(updateData)
      .where(eq(campaignSessions.id, currentSession.id))
      .returning();

    return updatedSession;
  }

  async advanceToNextSession(campaignId: number, summary?: string): Promise<CampaignSession> {
    const currentSession = await this.getCurrentSession(campaignId);
    if (!currentSession) {
      throw new Error("No active session found");
    }
    
    // Mark current session as completed (preserve original title)
    await db
      .update(campaignSessions)
      .set({
        isCompleted: true,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .where(eq(campaignSessions.id, currentSession.id));
    
    // Get the campaign to update currentSession
    const campaign = await this.getCampaign(campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }
    
    const nextSessionNumber = (campaign.currentSession || 1) + 1;
    
    // Update campaign's current session number
    await db
      .update(campaigns)
      .set({
        currentSession: nextSessionNumber
      })
      .where(eq(campaigns.id, campaignId));
    
    // Create new session with story state carried over
    const newSession = await this.createCampaignSession({
      campaignId,
      sessionNumber: nextSessionNumber,
      title: `Chapter ${nextSessionNumber}`,
      narrative: summary || `The adventure continues...\n\nAs a new chapter begins, your party reflects on the events that have passed. The path ahead remains uncertain, but your courage is unwavering.`,
      choices: [
        { action: "Continue exploring", requiresRoll: false },
        { action: "Rest and plan your next move", requiresRoll: false },
        { action: "Seek information from locals", requiresRoll: false }
      ],
      createdAt: new Date().toISOString(),
      storyState: currentSession.storyState as any // Carry over story state
    });
    
    return newSession;
  }

  async addQuickContentToSession(campaignId: number, content: any): Promise<void> {
    const currentSession = await this.getCurrentSession(campaignId);
    if (!currentSession) {
      throw new Error("No active session found");
    }

    const existingContent = currentSession.quickContentGenerated || [];
    const updatedContent = [...existingContent, {
      ...content,
      timestamp: new Date().toISOString()
    }];

    await db
      .update(campaignSessions)
      .set({
        quickContentGenerated: updatedContent,
        updatedAt: new Date().toISOString()
      })
      .where(eq(campaignSessions.id, currentSession.id));
  }

  async startCombat(campaignId: number, combatState: any): Promise<void> {
    const currentSession = await this.getCurrentSession(campaignId);
    if (!currentSession) {
      throw new Error("No active session found");
    }

    await db
      .update(campaignSessions)
      .set({
        isInCombat: true,
        combatState: combatState,
        updatedAt: new Date().toISOString()
      })
      .where(eq(campaignSessions.id, currentSession.id));
  }

  async updateCombatState(campaignId: number, combatState: any): Promise<void> {
    const currentSession = await this.getCurrentSession(campaignId);
    if (!currentSession) {
      throw new Error("No active session found");
    }

    await db
      .update(campaignSessions)
      .set({
        combatState: combatState,
        updatedAt: new Date().toISOString()
      })
      .where(eq(campaignSessions.id, currentSession.id));
  }
  
  async updateSessionStoryState(campaignId: number, sessionNumber: number, storyState: any, sceneType?: string): Promise<CampaignSession | undefined> {
    // Get current session to track previous scene type for anti-combat-treadmill
    const currentSession = await this.getCampaignSession(campaignId, sessionNumber);
    const previousSceneType = currentSession?.sceneType || null;
    
    const updateData: any = {
      storyState: storyState,
      updatedAt: new Date().toISOString()
    };
    
    // Update scene type tracking if provided
    if (sceneType) {
      updateData.sceneType = sceneType;
      updateData.previousSceneType = previousSceneType;
    }
    
    const [updatedSession] = await db
      .update(campaignSessions)
      .set(updateData)
      .where(and(
        eq(campaignSessions.campaignId, campaignId),
        eq(campaignSessions.sessionNumber, sessionNumber)
      ))
      .returning();
    return updatedSession || undefined;
  }

  // Chat operations
  async getChatMessages(channel: string, limit: number = 50): Promise<ChatMessage[]> {
    const [channelType, channelId] = channel.split('-');
    
    let whereClause;
    if (channelType === 'campaign' && channelId) {
      whereClause = and(
        eq(chatMessages.channelType, 'campaign'),
        eq(chatMessages.campaignId, parseInt(channelId))
      );
    } else {
      whereClause = eq(chatMessages.channelType, 'global');
    }

    const messages = await db
      .select()
      .from(chatMessages)
      .where(whereClause)
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    return messages.reverse();
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db
      .insert(chatMessages)
      .values({
        ...message,
        createdAt: new Date().toISOString()
      })
      .returning();

    return newMessage;
  }

  async getOnlineUsers(): Promise<OnlineUser[]> {
    // Clean up old entries (users offline for more than 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await db
      .delete(onlineUsers)
      .where(sql`${onlineUsers.lastSeen} < ${fiveMinutesAgo}`);

    return await db.select().from(onlineUsers);
  }

  async updateUserOnlineStatus(userId: number, username: string, isOnline: boolean): Promise<void> {
    if (isOnline) {
      await db
        .insert(onlineUsers)
        .values({
          userId,
          username,
          isInCampaign: false,
          lastSeen: new Date().toISOString()
        })
        .onConflictDoUpdate({
          target: onlineUsers.userId,
          set: {
            lastSeen: new Date().toISOString()
          }
        });
    } else {
      await db
        .delete(onlineUsers)
        .where(eq(onlineUsers.userId, userId));
    }
  }

  async setUserCurrentCampaign(userId: number, campaignId?: number): Promise<void> {
    await db
      .update(onlineUsers)
      .set({
        isInCampaign: !!campaignId,
        currentCampaignId: campaignId || null,
        lastSeen: new Date().toISOString()
      })
      .where(eq(onlineUsers.userId, userId));
  }
  
  // Item database operations
  async getAllItems(): Promise<Item[]> {
    return await db.select().from(items).orderBy(asc(items.name));
  }
  
  async getItemsByType(type: string): Promise<Item[]> {
    return await db.select().from(items).where(eq(items.type, type)).orderBy(asc(items.name));
  }
  
  async getItem(id: number): Promise<Item | undefined> {
    const [item] = await db.select().from(items).where(eq(items.id, id));
    return item || undefined;
  }
  
  async getItemByName(name: string): Promise<Item | undefined> {
    const [item] = await db.select().from(items).where(eq(items.name, name));
    return item || undefined;
  }
  
  async createItem(item: InsertItem): Promise<Item> {
    const [newItem] = await db
      .insert(items)
      .values({
        ...item,
        createdAt: new Date().toISOString()
      })
      .returning();
    return newItem;
  }
  
  async updateItem(id: number, updates: Partial<Item>): Promise<Item | undefined> {
    const [updatedItem] = await db
      .update(items)
      .set(updates)
      .where(eq(items.id, id))
      .returning();
    return updatedItem || undefined;
  }
  
  async deleteItem(id: number): Promise<boolean> {
    await db.delete(items).where(eq(items.id, id));
    return true;
  }
  
  // Campaign Dungeon Map operations
  async getCampaignDungeonMap(campaignId: number): Promise<CampaignDungeonMap | undefined> {
    const [map] = await db.select().from(campaignDungeonMaps)
      .where(and(
        eq(campaignDungeonMaps.campaignId, campaignId),
        eq(campaignDungeonMaps.isActive, true)
      ));
    return map || undefined;
  }
  
  async getCampaignDungeonMaps(campaignId: number): Promise<CampaignDungeonMap[]> {
    return await db.select().from(campaignDungeonMaps)
      .where(eq(campaignDungeonMaps.campaignId, campaignId))
      .orderBy(desc(campaignDungeonMaps.createdAt));
  }
  
  async createCampaignDungeonMap(map: InsertCampaignDungeonMap): Promise<CampaignDungeonMap> {
    // Deactivate existing maps for this campaign first
    await db.update(campaignDungeonMaps)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(campaignDungeonMaps.campaignId, map.campaignId));
    
    const [newMap] = await db.insert(campaignDungeonMaps)
      .values({
        ...map,
        createdAt: new Date().toISOString()
      })
      .returning();
    return newMap;
  }
  
  async updateCampaignDungeonMap(id: number, updates: Partial<CampaignDungeonMap>): Promise<CampaignDungeonMap | undefined> {
    const [updatedMap] = await db.update(campaignDungeonMaps)
      .set({
        ...updates,
        updatedAt: new Date().toISOString()
      })
      .where(eq(campaignDungeonMaps.id, id))
      .returning();
    return updatedMap || undefined;
  }
  
  async deleteCampaignDungeonMap(id: number): Promise<boolean> {
    await db.delete(campaignDungeonMaps).where(eq(campaignDungeonMaps.id, id));
    return true;
  }
  
  // Procedural Exploration operations
  async getExplorationHexes(campaignId: number): Promise<CampaignExplorationHex[]> {
    return await db.select().from(campaignExplorationHexes)
      .where(eq(campaignExplorationHexes.campaignId, campaignId));
  }
  
  async getExplorationHex(campaignId: number, q: number, r: number): Promise<CampaignExplorationHex | undefined> {
    const [hex] = await db.select().from(campaignExplorationHexes)
      .where(and(
        eq(campaignExplorationHexes.campaignId, campaignId),
        eq(campaignExplorationHexes.q, q),
        eq(campaignExplorationHexes.r, r)
      ));
    return hex || undefined;
  }
  
  async createExplorationHex(hex: InsertCampaignExplorationHex): Promise<CampaignExplorationHex> {
    const [newHex] = await db.insert(campaignExplorationHexes)
      .values({
        ...hex,
        createdAt: new Date().toISOString()
      })
      .returning();
    return newHex;
  }
  
  async updateExplorationHex(id: number, updates: Partial<CampaignExplorationHex>): Promise<CampaignExplorationHex | undefined> {
    const [updated] = await db.update(campaignExplorationHexes)
      .set(updates)
      .where(eq(campaignExplorationHexes.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteExplorationHex(id: number): Promise<boolean> {
    const result = await db.delete(campaignExplorationHexes)
      .where(eq(campaignExplorationHexes.id, id))
      .returning();
    return result.length > 0;
  }
  
  async getExplorationState(campaignId: number): Promise<CampaignExplorationState | undefined> {
    const [state] = await db.select().from(campaignExplorationState)
      .where(eq(campaignExplorationState.campaignId, campaignId));
    return state || undefined;
  }
  
  async createExplorationState(state: InsertCampaignExplorationState): Promise<CampaignExplorationState> {
    const [newState] = await db.insert(campaignExplorationState)
      .values({
        ...state,
        createdAt: new Date().toISOString()
      })
      .returning();
    return newState;
  }
  
  async updateExplorationState(campaignId: number, updates: Partial<CampaignExplorationState>): Promise<CampaignExplorationState | undefined> {
    const [updated] = await db.update(campaignExplorationState)
      .set({
        ...updates,
        updatedAt: new Date().toISOString()
      })
      .where(eq(campaignExplorationState.campaignId, campaignId))
      .returning();
    return updated || undefined;
  }
  
  // City Map operations
  async getCityMap(campaignId: number, worldLocationId: number): Promise<CityMap | undefined> {
    const [map] = await db.select().from(cityMaps)
      .where(and(eq(cityMaps.campaignId, campaignId), eq(cityMaps.worldLocationId, worldLocationId)));
    return map || undefined;
  }
  
  async createCityMap(cityMap: InsertCityMap): Promise<CityMap> {
    const [newMap] = await db.insert(cityMaps).values({
      ...cityMap,
      createdAt: new Date().toISOString()
    }).returning();
    return newMap;
  }
  
  async updateCityMap(id: number, updates: Partial<CityMap>): Promise<CityMap | undefined> {
    const [updated] = await db.update(cityMaps).set(updates).where(eq(cityMaps.id, id)).returning();
    return updated || undefined;
  }
  
  // Capital Exploration operations
  async getCapitalExploration(campaignId: number, userId: number, worldLocationId: number): Promise<CapitalExploration | undefined> {
    const [record] = await db.select().from(capitalExploration)
      .where(and(
        eq(capitalExploration.campaignId, campaignId),
        eq(capitalExploration.userId, userId),
        eq(capitalExploration.worldLocationId, worldLocationId)
      ));
    return record || undefined;
  }

  async createCapitalExploration(data: InsertCapitalExploration): Promise<CapitalExploration> {
    const [record] = await db.insert(capitalExploration).values({
      ...data,
      createdAt: new Date().toISOString()
    }).returning();
    return record;
  }

  async updateCapitalExploration(id: number, updates: Partial<CapitalExploration>): Promise<CapitalExploration | undefined> {
    const [updated] = await db.update(capitalExploration).set(updates).where(eq(capitalExploration.id, id)).returning();
    return updated || undefined;
  }

  // Trek Route operations
  async getActiveTrekRoute(campaignId: number, userId: number): Promise<TrekRoute | undefined> {
    const [route] = await db.select().from(trekRoutes)
      .where(and(
        eq(trekRoutes.campaignId, campaignId),
        eq(trekRoutes.userId, userId),
        or(eq(trekRoutes.status, "active"), eq(trekRoutes.status, "encounter"))
      ));
    return route || undefined;
  }
  
  async createTrekRoute(route: InsertTrekRoute): Promise<TrekRoute> {
    const [newRoute] = await db.insert(trekRoutes).values({
      ...route,
      createdAt: new Date().toISOString()
    }).returning();
    return newRoute;
  }
  
  async updateTrekRoute(id: number, updates: Partial<TrekRoute>): Promise<TrekRoute | undefined> {
    const [updated] = await db.update(trekRoutes).set(updates).where(eq(trekRoutes.id, id)).returning();
    return updated || undefined;
  }
  
  async cancelTrekRoute(id: number): Promise<boolean> {
    const [result] = await db.update(trekRoutes).set({ status: "cancelled" }).where(eq(trekRoutes.id, id)).returning();
    return !!result;
  }

  async getPlayerHouse(characterId: number, campaignId: number): Promise<PlayerHouse | undefined> {
    const [house] = await db.select().from(playerHouses)
      .where(and(eq(playerHouses.characterId, characterId), eq(playerHouses.campaignId, campaignId)));
    return house || undefined;
  }

  async createPlayerHouse(house: InsertPlayerHouse): Promise<PlayerHouse> {
    const [created] = await db.insert(playerHouses).values(house).returning();
    return created;
  }

  async updatePlayerHouse(id: number, updates: Partial<PlayerHouse>): Promise<PlayerHouse | undefined> {
    const [updated] = await db.update(playerHouses).set(updates).where(eq(playerHouses.id, id)).returning();
    return updated || undefined;
  }

  async getPlayerBank(characterId: number, campaignId: number): Promise<PlayerBank | undefined> {
    const [bank] = await db.select().from(playerBank)
      .where(and(eq(playerBank.characterId, characterId), eq(playerBank.campaignId, campaignId)));
    return bank || undefined;
  }

  async createPlayerBank(bank: InsertPlayerBank): Promise<PlayerBank> {
    const [created] = await db.insert(playerBank).values(bank).returning();
    return created;
  }

  async updatePlayerBank(id: number, updates: Partial<PlayerBank>): Promise<PlayerBank | undefined> {
    const [updated] = await db.update(playerBank).set(updates).where(eq(playerBank.id, id)).returning();
    return updated || undefined;
  }
  
  // Campaign Quest operations
  async getCampaignQuests(campaignId: number): Promise<CampaignQuest[]> {
    return await db.select().from(campaignQuests)
      .where(eq(campaignQuests.campaignId, campaignId))
      .orderBy(asc(campaignQuests.order), asc(campaignQuests.createdAt));
  }
  
  async getCampaignQuest(id: number): Promise<CampaignQuest | undefined> {
    const [quest] = await db.select().from(campaignQuests)
      .where(eq(campaignQuests.id, id));
    return quest || undefined;
  }
  
  async createCampaignQuest(quest: InsertCampaignQuest): Promise<CampaignQuest> {
    const [newQuest] = await db.insert(campaignQuests)
      .values({
        ...quest,
        createdAt: new Date().toISOString()
      })
      .returning();
    return newQuest;
  }
  
  async updateCampaignQuest(id: number, updates: Partial<CampaignQuest>): Promise<CampaignQuest | undefined> {
    const [updatedQuest] = await db.update(campaignQuests)
      .set(updates)
      .where(eq(campaignQuests.id, id))
      .returning();
    return updatedQuest || undefined;
  }
  
  async completeCampaignQuest(id: number): Promise<CampaignQuest | undefined> {
    const [completedQuest] = await db.update(campaignQuests)
      .set({
        status: "completed",
        completedAt: new Date().toISOString()
      })
      .where(eq(campaignQuests.id, id))
      .returning();
    return completedQuest || undefined;
  }
  
  async deleteCampaignQuest(id: number): Promise<boolean> {
    await db.delete(campaignQuests).where(eq(campaignQuests.id, id));
    return true;
  }
  
  // World Region operations
  async getAllWorldRegions(): Promise<WorldRegion[]> {
    return await db.select().from(worldRegions).orderBy(asc(worldRegions.gridY), asc(worldRegions.gridX));
  }
  
  async getWorldRegion(id: number): Promise<WorldRegion | undefined> {
    const [region] = await db.select().from(worldRegions).where(eq(worldRegions.id, id));
    return region || undefined;
  }
  
  async createWorldRegion(region: InsertWorldRegion): Promise<WorldRegion> {
    const [newRegion] = await db.insert(worldRegions)
      .values({ ...region, createdAt: new Date().toISOString() })
      .returning();
    return newRegion;
  }
  
  async updateWorldRegion(id: number, updates: Partial<WorldRegion>): Promise<WorldRegion | undefined> {
    const [updated] = await db.update(worldRegions).set(updates).where(eq(worldRegions.id, id)).returning();
    return updated || undefined;
  }
  
  async deleteWorldRegion(id: number): Promise<boolean> {
    await db.delete(worldRegions).where(eq(worldRegions.id, id));
    return true;
  }
  
  // World Location operations
  async getWorldLocations(regionId?: number): Promise<WorldLocation[]> {
    if (regionId) {
      return await db.select().from(worldLocations).where(eq(worldLocations.regionId, regionId));
    }
    return await db.select().from(worldLocations);
  }
  
  async getWorldLocation(id: number): Promise<WorldLocation | undefined> {
    const [location] = await db.select().from(worldLocations).where(eq(worldLocations.id, id));
    return location || undefined;
  }
  
  async getWorldLocationByCampaign(campaignId: number): Promise<WorldLocation | undefined> {
    const [location] = await db.select().from(worldLocations).where(eq(worldLocations.linkedCampaignId, campaignId));
    return location || undefined;
  }
  
  async createWorldLocation(location: InsertWorldLocation): Promise<WorldLocation> {
    const [newLocation] = await db.insert(worldLocations)
      .values({ ...location, createdAt: new Date().toISOString() })
      .returning();
    return newLocation;
  }
  
  async updateWorldLocation(id: number, updates: Partial<WorldLocation>): Promise<WorldLocation | undefined> {
    const [updated] = await db.update(worldLocations).set(updates).where(eq(worldLocations.id, id)).returning();
    return updated || undefined;
  }
  
  async deleteWorldLocation(id: number): Promise<boolean> {
    await db.delete(worldLocations).where(eq(worldLocations.id, id));
    return true;
  }
  
  // User World Progress operations
  async getUserWorldProgress(userId: number): Promise<UserWorldProgress[]> {
    return await db.select().from(userWorldProgress).where(eq(userWorldProgress.userId, userId));
  }
  
  async getUserProgressForRegion(userId: number, regionId: number): Promise<UserWorldProgress | undefined> {
    const [progress] = await db.select().from(userWorldProgress)
      .where(and(eq(userWorldProgress.userId, userId), eq(userWorldProgress.regionId, regionId)));
    return progress || undefined;
  }
  
  async getUserProgressForLocation(userId: number, locationId: number): Promise<UserWorldProgress | undefined> {
    const [progress] = await db.select().from(userWorldProgress)
      .where(and(eq(userWorldProgress.userId, userId), eq(userWorldProgress.locationId, locationId)));
    return progress || undefined;
  }
  
  async updateUserWorldProgress(userId: number, regionId: number | null, locationId: number | null, updates: Partial<UserWorldProgress>): Promise<UserWorldProgress> {
    // Try to find existing progress
    let existing: UserWorldProgress | undefined;
    if (regionId) {
      existing = await this.getUserProgressForRegion(userId, regionId);
    } else if (locationId) {
      existing = await this.getUserProgressForLocation(userId, locationId);
    }
    
    if (existing) {
      // Smart merge: increment visit count, don't downgrade completion state
      const mergedUpdates = { ...updates };
      
      // Increment times visited instead of overwriting
      if (updates.timesVisited !== undefined || updates.hasVisited) {
        mergedUpdates.timesVisited = (existing.timesVisited || 0) + 1;
      }
      
      // Don't downgrade completion state (completed > in_progress > discovered > undiscovered)
      const stateRanking: Record<string, number> = {
        'undiscovered': 0,
        'discovered': 1,
        'in_progress': 2,
        'completed': 3
      };
      const existingRank = stateRanking[existing.completionState || 'undiscovered'] || 0;
      const newRank = stateRanking[updates.completionState || 'undiscovered'] || 0;
      if (newRank < existingRank) {
        delete mergedUpdates.completionState;
      }
      
      const [updated] = await db.update(userWorldProgress)
        .set(mergedUpdates)
        .where(eq(userWorldProgress.id, existing.id))
        .returning();
      return updated;
    } else {
      // New record - set initial values
      const [created] = await db.insert(userWorldProgress)
        .values({
          userId,
          regionId,
          locationId,
          timesVisited: 1,
          firstDiscoveredAt: new Date().toISOString(),
          ...updates,
          createdAt: new Date().toISOString()
        })
        .returning();
      return created;
    }
  }
  
  async discoverRegion(userId: number, regionId: number, campaignId?: number, sessionId?: number): Promise<UserWorldProgress> {
    return this.updateUserWorldProgress(userId, regionId, null, {
      hasDiscovered: true,
      completionState: "discovered",
      firstDiscoveredAt: new Date().toISOString(),
      lastCampaignId: campaignId,
      lastSessionId: sessionId
    });
  }
  
  async discoverLocation(userId: number, locationId: number, campaignId?: number, sessionId?: number): Promise<UserWorldProgress> {
    return this.updateUserWorldProgress(userId, null, locationId, {
      hasDiscovered: true,
      completionState: "discovered",
      firstDiscoveredAt: new Date().toISOString(),
      lastCampaignId: campaignId,
      lastSessionId: sessionId
    });
  }
  
  async completeRegion(userId: number, regionId: number): Promise<UserWorldProgress | undefined> {
    const existing = await this.getUserProgressForRegion(userId, regionId);
    if (!existing) return undefined;
    
    const [updated] = await db.update(userWorldProgress)
      .set({
        completionState: "completed",
        completionPercent: 100,
        completedAt: new Date().toISOString()
      })
      .where(eq(userWorldProgress.id, existing.id))
      .returning();
    return updated || undefined;
  }
  
  async completeLocation(userId: number, locationId: number): Promise<UserWorldProgress | undefined> {
    const existing = await this.getUserProgressForLocation(userId, locationId);
    if (!existing) return undefined;
    
    const [updated] = await db.update(userWorldProgress)
      .set({
        completionState: "completed",
        completionPercent: 100,
        completedAt: new Date().toISOString()
      })
      .where(eq(userWorldProgress.id, existing.id))
      .returning();
    return updated || undefined;
  }
  
  // Bulletin Board operations
  async getBulletinPosts(options?: { postType?: string; isActive?: boolean; limit?: number }): Promise<BulletinPost[]> {
    let query = db.select().from(bulletinPosts);
    
    const conditions = [];
    if (options?.postType) {
      conditions.push(eq(bulletinPosts.postType, options.postType));
    }
    if (options?.isActive !== undefined) {
      conditions.push(eq(bulletinPosts.isActive, options.isActive));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    query = query.orderBy(desc(bulletinPosts.createdAt)) as any;
    
    if (options?.limit) {
      query = query.limit(options.limit) as any;
    }
    
    return query;
  }
  
  async getUserBulletinPosts(userId: number): Promise<BulletinPost[]> {
    return db.select()
      .from(bulletinPosts)
      .where(eq(bulletinPosts.userId, userId))
      .orderBy(desc(bulletinPosts.createdAt));
  }
  
  async getBulletinPost(id: number): Promise<BulletinPost | undefined> {
    const [post] = await db.select()
      .from(bulletinPosts)
      .where(eq(bulletinPosts.id, id));
    return post || undefined;
  }
  
  async createBulletinPost(post: InsertBulletinPost): Promise<BulletinPost> {
    const [created] = await db.insert(bulletinPosts)
      .values({
        ...post,
        createdAt: new Date().toISOString()
      })
      .returning();
    return created;
  }
  
  async updateBulletinPost(id: number, updates: Partial<BulletinPost>): Promise<BulletinPost | undefined> {
    const [updated] = await db.update(bulletinPosts)
      .set({
        ...updates,
        updatedAt: new Date().toISOString()
      })
      .where(eq(bulletinPosts.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteBulletinPost(id: number): Promise<boolean> {
    // Also delete all responses to this post
    await db.delete(bulletinResponses)
      .where(eq(bulletinResponses.postId, id));
    const result = await db.delete(bulletinPosts)
      .where(eq(bulletinPosts.id, id));
    return true;
  }
  
  // Bulletin Response operations
  async getBulletinResponses(postId: number): Promise<BulletinResponse[]> {
    return db.select()
      .from(bulletinResponses)
      .where(eq(bulletinResponses.postId, postId))
      .orderBy(asc(bulletinResponses.createdAt));
  }
  
  async createBulletinResponse(response: InsertBulletinResponse): Promise<BulletinResponse> {
    const [created] = await db.insert(bulletinResponses)
      .values({
        ...response,
        createdAt: new Date().toISOString()
      })
      .returning();
    
    // Increment response count on the post
    await db.update(bulletinPosts)
      .set({
        responseCount: sql`${bulletinPosts.responseCount} + 1`
      })
      .where(eq(bulletinPosts.id, response.postId));
    
    return created;
  }
  
  async deleteBulletinResponse(id: number): Promise<boolean> {
    // Get the response to find the post ID
    const [response] = await db.select()
      .from(bulletinResponses)
      .where(eq(bulletinResponses.id, id));
    
    if (response) {
      await db.delete(bulletinResponses)
        .where(eq(bulletinResponses.id, id));
      
      // Decrement response count
      await db.update(bulletinPosts)
        .set({
          responseCount: sql`GREATEST(${bulletinPosts.responseCount} - 1, 0)`
        })
        .where(eq(bulletinPosts.id, response.postId));
    }
    return true;
  }
  
  // CAML Trace Event operations
  async recordTraceEvent(event: InsertCampaignTraceEvent): Promise<CampaignTraceEvent> {
    const [created] = await db.insert(campaignTraceEvents)
      .values(event)
      .returning();
    return created;
  }
  
  async getTraceEvents(campaignId: number, sessionId?: string): Promise<CampaignTraceEvent[]> {
    if (sessionId) {
      return db.select()
        .from(campaignTraceEvents)
        .where(and(
          eq(campaignTraceEvents.campaignId, campaignId),
          eq(campaignTraceEvents.sessionId, sessionId)
        ))
        .orderBy(asc(campaignTraceEvents.id));
    }
    return db.select()
      .from(campaignTraceEvents)
      .where(eq(campaignTraceEvents.campaignId, campaignId))
      .orderBy(asc(campaignTraceEvents.id));
  }
  
  async getTraceEventCount(campaignId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(campaignTraceEvents)
      .where(eq(campaignTraceEvents.campaignId, campaignId));
    return Number(result[0]?.count || 0);
  }
  
  async clearTraceEvents(campaignId: number): Promise<boolean> {
    await db.delete(campaignTraceEvents)
      .where(eq(campaignTraceEvents.campaignId, campaignId));
    return true;
  }
  
  // Faction operations
  async getFactions(campaignId: number): Promise<Faction[]> {
    return db.select()
      .from(factions)
      .where(eq(factions.campaignId, campaignId))
      .orderBy(asc(factions.name));
  }
  
  async getFaction(id: number): Promise<Faction | undefined> {
    const [faction] = await db.select()
      .from(factions)
      .where(eq(factions.id, id));
    return faction || undefined;
  }
  
  async createFaction(faction: InsertFaction): Promise<Faction> {
    const [created] = await db.insert(factions)
      .values({
        ...faction,
        createdAt: new Date().toISOString()
      })
      .returning();
    return created;
  }
  
  async updateFaction(id: number, updates: Partial<Faction>): Promise<Faction | undefined> {
    const [updated] = await db.update(factions)
      .set(updates)
      .where(eq(factions.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteFaction(id: number): Promise<boolean> {
    await db.delete(factions).where(eq(factions.id, id));
    return true;
  }
  
  // Character Reputation Profile operations
  async getCharacterReputationProfiles(characterId: number, campaignId?: number): Promise<CharacterReputationProfile[]> {
    if (campaignId) {
      return db.select()
        .from(characterReputationProfiles)
        .where(and(
          eq(characterReputationProfiles.characterId, characterId),
          eq(characterReputationProfiles.campaignId, campaignId)
        ))
        .orderBy(desc(characterReputationProfiles.lastUpdatedAt));
    }
    return db.select()
      .from(characterReputationProfiles)
      .where(eq(characterReputationProfiles.characterId, characterId))
      .orderBy(desc(characterReputationProfiles.lastUpdatedAt));
  }
  
  async getCharacterReputationProfile(characterId: number, factionId: number | null, campaignId: number): Promise<CharacterReputationProfile | undefined> {
    const conditions = [
      eq(characterReputationProfiles.characterId, characterId),
      eq(characterReputationProfiles.campaignId, campaignId)
    ];
    
    if (factionId === null) {
      const [profile] = await db.select()
        .from(characterReputationProfiles)
        .where(and(...conditions, sql`${characterReputationProfiles.factionId} IS NULL`));
      return profile || undefined;
    }
    
    const [profile] = await db.select()
      .from(characterReputationProfiles)
      .where(and(...conditions, eq(characterReputationProfiles.factionId, factionId)));
    return profile || undefined;
  }
  
  async createCharacterReputationProfile(profile: InsertCharacterReputationProfile): Promise<CharacterReputationProfile> {
    const [created] = await db.insert(characterReputationProfiles)
      .values({
        ...profile,
        lastUpdatedAt: new Date().toISOString()
      })
      .returning();
    return created;
  }
  
  async updateCharacterReputationProfile(id: number, updates: Partial<CharacterReputationProfile>): Promise<CharacterReputationProfile | undefined> {
    const [updated] = await db.update(characterReputationProfiles)
      .set({
        ...updates,
        lastUpdatedAt: new Date().toISOString()
      })
      .where(eq(characterReputationProfiles.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteCharacterReputationProfile(id: number): Promise<boolean> {
    await db.delete(characterReputationProfiles).where(eq(characterReputationProfiles.id, id));
    return true;
  }
  
  async getCharacterStoryArc(characterId: number): Promise<{ profiles: CharacterReputationProfile[]; recentEvents: ReputationEvent[] }> {
    const profiles = await db.select()
      .from(characterReputationProfiles)
      .where(eq(characterReputationProfiles.characterId, characterId))
      .orderBy(desc(characterReputationProfiles.lastUpdatedAt));
    
    const recentEvents = await db.select()
      .from(reputationEvents)
      .where(eq(reputationEvents.characterId, characterId))
      .orderBy(desc(reputationEvents.createdAt))
      .limit(10);
    
    return { profiles, recentEvents };
  }
  
  // Reputation Event operations
  async getReputationEvents(characterId: number, campaignId?: number, limit: number = 20): Promise<ReputationEvent[]> {
    if (campaignId) {
      return db.select()
        .from(reputationEvents)
        .where(and(
          eq(reputationEvents.characterId, characterId),
          eq(reputationEvents.campaignId, campaignId)
        ))
        .orderBy(desc(reputationEvents.createdAt))
        .limit(limit);
    }
    return db.select()
      .from(reputationEvents)
      .where(eq(reputationEvents.characterId, characterId))
      .orderBy(desc(reputationEvents.createdAt))
      .limit(limit);
  }
  
  async getReputationEvent(id: number): Promise<ReputationEvent | undefined> {
    const [event] = await db.select()
      .from(reputationEvents)
      .where(eq(reputationEvents.id, id));
    return event || undefined;
  }
  
  async createReputationEvent(event: InsertReputationEvent): Promise<ReputationEvent> {
    const [created] = await db.insert(reputationEvents)
      .values({
        ...event,
        createdAt: new Date().toISOString()
      })
      .returning();
    return created;
  }
  
  async updateReputationEvent(id: number, updates: Partial<ReputationEvent>): Promise<ReputationEvent | undefined> {
    const [updated] = await db.update(reputationEvents)
      .set(updates)
      .where(eq(reputationEvents.id, id))
      .returning();
    return updated || undefined;
  }
  
  async markReputationEventProcessed(id: number): Promise<boolean> {
    await db.update(reputationEvents)
      .set({ isProcessed: true })
      .where(eq(reputationEvents.id, id));
    return true;
  }
  
  async getCampaignReputationSignals(campaignId: number): Promise<{ characterId: number; characterName: string; profiles: CharacterReputationProfile[]; recentEvents: ReputationEvent[] }[]> {
    // Get all participants in the campaign
    const participants = await db.select()
      .from(campaignParticipants)
      .where(eq(campaignParticipants.campaignId, campaignId));
    
    const results: { characterId: number; characterName: string; profiles: CharacterReputationProfile[]; recentEvents: ReputationEvent[] }[] = [];
    
    for (const participant of participants) {
      if (!participant.characterId) continue;
      
      const [character] = await db.select()
        .from(characters)
        .where(eq(characters.id, participant.characterId));
      
      if (!character) continue;
      
      const profiles = await db.select()
        .from(characterReputationProfiles)
        .where(and(
          eq(characterReputationProfiles.characterId, participant.characterId),
          eq(characterReputationProfiles.campaignId, campaignId)
        ))
        .orderBy(desc(characterReputationProfiles.lastUpdatedAt));
      
      const recentEvents = await db.select()
        .from(reputationEvents)
        .where(and(
          eq(reputationEvents.characterId, participant.characterId),
          eq(reputationEvents.campaignId, campaignId)
        ))
        .orderBy(desc(reputationEvents.createdAt))
        .limit(5);
      
      results.push({
        characterId: participant.characterId,
        characterName: character.name,
        profiles,
        recentEvents
      });
    }
    
    return results;
  }
  
  // Player Group operations
  async getPlayerGroups(userId?: number): Promise<PlayerGroup[]> {
    // Always return all public groups, plus any private groups the user is a member of
    const publicGroups = await db.select()
      .from(playerGroups)
      .where(eq(playerGroups.isPublic, true))
      .orderBy(desc(playerGroups.createdAt));
    
    if (userId) {
      const memberships = await db.select()
        .from(playerGroupMembers)
        .where(eq(playerGroupMembers.userId, userId));
      const groupIds = memberships.map(m => m.groupId);
      
      if (groupIds.length > 0) {
        const privateGroups = await db.select()
          .from(playerGroups)
          .where(and(
            inArray(playerGroups.id, groupIds),
            eq(playerGroups.isPublic, false)
          ));
        
        // Merge, ensuring no duplicates
        const allGroupIds = new Set(publicGroups.map(g => g.id));
        for (const pg of privateGroups) {
          if (!allGroupIds.has(pg.id)) {
            publicGroups.push(pg);
          }
        }
      }
    }
    
    return publicGroups;
  }
  
  async getPlayerGroup(id: number): Promise<PlayerGroup | undefined> {
    const [group] = await db.select()
      .from(playerGroups)
      .where(eq(playerGroups.id, id));
    return group || undefined;
  }
  
  async createPlayerGroup(group: InsertPlayerGroup): Promise<PlayerGroup> {
    const [created] = await db.insert(playerGroups)
      .values({
        ...group,
        createdAt: new Date().toISOString()
      })
      .returning();
    return created;
  }
  
  async updatePlayerGroup(id: number, updates: Partial<PlayerGroup>): Promise<PlayerGroup | undefined> {
    const [updated] = await db.update(playerGroups)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(playerGroups.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deletePlayerGroup(id: number): Promise<boolean> {
    await db.delete(playerGroupMembers).where(eq(playerGroupMembers.groupId, id));
    await db.delete(playerGroups).where(eq(playerGroups.id, id));
    return true;
  }
  
  // Player Group Member operations
  async getPlayerGroupMembers(groupId: number): Promise<PlayerGroupMember[]> {
    return db.select()
      .from(playerGroupMembers)
      .where(eq(playerGroupMembers.groupId, groupId));
  }
  
  async getUserGroupMemberships(userId: number): Promise<PlayerGroupMember[]> {
    return db.select()
      .from(playerGroupMembers)
      .where(eq(playerGroupMembers.userId, userId));
  }
  
  async addPlayerGroupMember(member: InsertPlayerGroupMember): Promise<PlayerGroupMember> {
    const [created] = await db.insert(playerGroupMembers)
      .values({
        ...member,
        joinedAt: new Date().toISOString()
      })
      .returning();
    return created;
  }
  
  async updatePlayerGroupMember(id: number, updates: Partial<PlayerGroupMember>): Promise<PlayerGroupMember | undefined> {
    const [updated] = await db.update(playerGroupMembers)
      .set(updates)
      .where(eq(playerGroupMembers.id, id))
      .returning();
    return updated || undefined;
  }
  
  async removePlayerGroupMember(id: number): Promise<boolean> {
    await db.delete(playerGroupMembers).where(eq(playerGroupMembers.id, id));
    return true;
  }
  
  // Group Invitation operations
  async getGroupInvitation(id: number): Promise<GroupInvitation | undefined> {
    const [invitation] = await db.select()
      .from(groupInvitations)
      .where(eq(groupInvitations.id, id));
    return invitation || undefined;
  }
  
  async getGroupInvitations(groupId: number): Promise<GroupInvitation[]> {
    return db.select()
      .from(groupInvitations)
      .where(eq(groupInvitations.groupId, groupId))
      .orderBy(desc(groupInvitations.createdAt));
  }
  
  async getUserPendingInvitations(userId: number): Promise<GroupInvitation[]> {
    return db.select()
      .from(groupInvitations)
      .where(and(
        eq(groupInvitations.inviteeId, userId),
        eq(groupInvitations.status, "pending")
      ))
      .orderBy(desc(groupInvitations.createdAt));
  }
  
  async createGroupInvitation(invitation: InsertGroupInvitation): Promise<GroupInvitation> {
    const [created] = await db.insert(groupInvitations)
      .values({
        ...invitation,
        status: "pending",
        createdAt: new Date().toISOString()
      })
      .returning();
    return created;
  }
  
  async respondToInvitation(id: number, status: 'accepted' | 'declined'): Promise<GroupInvitation | undefined> {
    const [updated] = await db.update(groupInvitations)
      .set({ 
        status, 
        respondedAt: new Date().toISOString() 
      })
      .where(eq(groupInvitations.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteGroupInvitation(id: number): Promise<boolean> {
    await db.delete(groupInvitations).where(eq(groupInvitations.id, id));
    return true;
  }
  
  async findUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.username, username));
    return user || undefined;
  }
  
  // Group Message Board operations
  async getGroupMessages(groupId: number): Promise<GroupMessage[]> {
    return db.select()
      .from(groupMessages)
      .where(eq(groupMessages.groupId, groupId))
      .orderBy(desc(groupMessages.isPinned), desc(groupMessages.createdAt));
  }
  
  async getGroupMessage(id: number): Promise<GroupMessage | undefined> {
    const [message] = await db.select()
      .from(groupMessages)
      .where(eq(groupMessages.id, id));
    return message || undefined;
  }
  
  async createGroupMessage(message: InsertGroupMessage): Promise<GroupMessage> {
    const [created] = await db.insert(groupMessages)
      .values({
        ...message,
        createdAt: new Date().toISOString()
      })
      .returning();
    return created;
  }
  
  async deleteGroupMessage(id: number): Promise<boolean> {
    await db.delete(groupMessages).where(eq(groupMessages.id, id));
    return true;
  }
  
  async toggleGroupMessagePin(id: number): Promise<GroupMessage | undefined> {
    const message = await this.getGroupMessage(id);
    if (!message) return undefined;
    const [updated] = await db.update(groupMessages)
      .set({ 
        isPinned: !message.isPinned,
        updatedAt: new Date().toISOString()
      })
      .where(eq(groupMessages.id, id))
      .returning();
    return updated || undefined;
  }
  
  // World Memory operations
  async getWorldMemories(campaignId: number, memoryType?: string): Promise<WorldMemory[]> {
    if (memoryType) {
      return db.select()
        .from(worldMemory)
        .where(and(
          eq(worldMemory.campaignId, campaignId),
          eq(worldMemory.memoryType, memoryType)
        ))
        .orderBy(desc(worldMemory.createdAt));
    }
    return db.select()
      .from(worldMemory)
      .where(eq(worldMemory.campaignId, campaignId))
      .orderBy(desc(worldMemory.createdAt));
  }
  
  async getUnrevealedWorldMemories(campaignId: number): Promise<WorldMemory[]> {
    return db.select()
      .from(worldMemory)
      .where(and(
        eq(worldMemory.campaignId, campaignId),
        sql`${worldMemory.revealedAt} IS NULL`
      ))
      .orderBy(desc(worldMemory.createdAt));
  }
  
  async createWorldMemory(memory: InsertWorldMemory): Promise<WorldMemory> {
    const [created] = await db.insert(worldMemory)
      .values({
        ...memory,
        createdAt: new Date().toISOString()
      })
      .returning();
    return created;
  }
  
  async updateWorldMemory(id: number, updates: Partial<WorldMemory>): Promise<WorldMemory | undefined> {
    const [updated] = await db.update(worldMemory)
      .set(updates)
      .where(eq(worldMemory.id, id))
      .returning();
    return updated || undefined;
  }
  
  async revealWorldMemory(id: number): Promise<WorldMemory | undefined> {
    const [updated] = await db.update(worldMemory)
      .set({ revealedAt: new Date().toISOString() })
      .where(eq(worldMemory.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteWorldMemory(id: number): Promise<boolean> {
    await db.delete(worldMemory).where(eq(worldMemory.id, id));
    return true;
  }
  
  // Unresolved Thread operations
  async getUnresolvedThreads(campaignId: number, characterId?: number): Promise<UnresolvedThread[]> {
    if (characterId) {
      return db.select()
        .from(unresolvedThreads)
        .where(and(
          eq(unresolvedThreads.campaignId, campaignId),
          eq(unresolvedThreads.characterId, characterId)
        ))
        .orderBy(desc(unresolvedThreads.createdAt));
    }
    return db.select()
      .from(unresolvedThreads)
      .where(eq(unresolvedThreads.campaignId, campaignId))
      .orderBy(desc(unresolvedThreads.createdAt));
  }
  
  async getActiveThreads(campaignId: number): Promise<UnresolvedThread[]> {
    return db.select()
      .from(unresolvedThreads)
      .where(and(
        eq(unresolvedThreads.campaignId, campaignId),
        eq(unresolvedThreads.status, "active")
      ))
      .orderBy(desc(unresolvedThreads.createdAt));
  }
  
  async createUnresolvedThread(thread: InsertUnresolvedThread): Promise<UnresolvedThread> {
    const [created] = await db.insert(unresolvedThreads)
      .values({
        ...thread,
        createdAt: new Date().toISOString()
      })
      .returning();
    return created;
  }
  
  async updateUnresolvedThread(id: number, updates: Partial<UnresolvedThread>): Promise<UnresolvedThread | undefined> {
    const [updated] = await db.update(unresolvedThreads)
      .set(updates)
      .where(eq(unresolvedThreads.id, id))
      .returning();
    return updated || undefined;
  }
  
  async resolveThread(id: number, notes?: string): Promise<UnresolvedThread | undefined> {
    const [updated] = await db.update(unresolvedThreads)
      .set({ 
        status: "resolved", 
        resolvedAt: new Date().toISOString(),
        resolutionNotes: notes || null
      })
      .where(eq(unresolvedThreads.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteUnresolvedThread(id: number): Promise<boolean> {
    await db.delete(unresolvedThreads).where(eq(unresolvedThreads.id, id));
    return true;
  }
  
  // Character Arc Insight operations
  async getCharacterArcInsight(id: number): Promise<CharacterArcInsight | undefined> {
    const [insight] = await db.select()
      .from(characterArcInsights)
      .where(eq(characterArcInsights.id, id));
    return insight || undefined;
  }
  
  async getCharacterArcInsights(characterId: number, campaignId?: number): Promise<CharacterArcInsight[]> {
    if (campaignId) {
      return db.select()
        .from(characterArcInsights)
        .where(and(
          eq(characterArcInsights.characterId, characterId),
          eq(characterArcInsights.campaignId, campaignId)
        ))
        .orderBy(desc(characterArcInsights.createdAt));
    }
    return db.select()
      .from(characterArcInsights)
      .where(eq(characterArcInsights.characterId, characterId))
      .orderBy(desc(characterArcInsights.createdAt));
  }
  
  async getUnrevealedInsights(characterId: number): Promise<CharacterArcInsight[]> {
    return db.select()
      .from(characterArcInsights)
      .where(and(
        eq(characterArcInsights.characterId, characterId),
        eq(characterArcInsights.isRevealed, false)
      ))
      .orderBy(desc(characterArcInsights.createdAt));
  }
  
  async createCharacterArcInsight(insight: InsertCharacterArcInsight): Promise<CharacterArcInsight> {
    const [created] = await db.insert(characterArcInsights)
      .values({
        ...insight,
        createdAt: new Date().toISOString()
      })
      .returning();
    return created;
  }
  
  async revealInsight(id: number): Promise<CharacterArcInsight | undefined> {
    const [updated] = await db.update(characterArcInsights)
      .set({ isRevealed: true, revealedAt: new Date().toISOString() })
      .where(eq(characterArcInsights.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteCharacterArcInsight(id: number): Promise<boolean> {
    await db.delete(characterArcInsights).where(eq(characterArcInsights.id, id));
    return true;
  }
  
  // User Session Tracking (for "Since Last Time...")
  async getUserSessionTracking(userId: number, campaignId: number): Promise<any> {
    const [tracking] = await db.select()
      .from(userSessionTracking)
      .where(and(
        eq(userSessionTracking.userId, userId),
        eq(userSessionTracking.campaignId, campaignId)
      ));
    return tracking || null;
  }
  
  async updateUserSessionTracking(userId: number, campaignId: number, bullets: any[]): Promise<any> {
    const existing = await this.getUserSessionTracking(userId, campaignId);
    
    if (existing) {
      const [updated] = await db.update(userSessionTracking)
        .set({
          lastLoginAt: new Date().toISOString(),
          sinceThenBullets: bullets,
          bulletsCachedAt: new Date().toISOString()
        })
        .where(and(
          eq(userSessionTracking.userId, userId),
          eq(userSessionTracking.campaignId, campaignId)
        ))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(userSessionTracking)
      .values({
        userId,
        campaignId,
        lastLoginAt: new Date().toISOString(),
        sinceThenBullets: bullets,
        bulletsCachedAt: new Date().toISOString()
      })
      .returning();
    return created;
  }
  
  async getSinceLastTimeBullets(userId: number, campaignId: number): Promise<string[]> {
    const tracking = await this.getUserSessionTracking(userId, campaignId);
    if (!tracking || !tracking.sinceThenBullets) return [];
    return tracking.sinceThenBullets as string[];
  }
  
  // Spell Library operations
  async getAllSpells(): Promise<Spell[]> {
    return db.select().from(spells).orderBy(asc(spells.level), asc(spells.name));
  }
  
  async getSpell(id: number): Promise<Spell | undefined> {
    const [spell] = await db.select().from(spells).where(eq(spells.id, id));
    return spell || undefined;
  }
  
  async getSpellByName(name: string): Promise<Spell | undefined> {
    const [spell] = await db.select().from(spells).where(eq(spells.name, name));
    return spell || undefined;
  }
  
  async getSpellsByLevel(level: number): Promise<Spell[]> {
    return db.select().from(spells).where(eq(spells.level, level)).orderBy(asc(spells.name));
  }
  
  async getSpellsByClass(className: string): Promise<Spell[]> {
    return db.select().from(spells)
      .where(sql`${className} = ANY(${spells.classes})`)
      .orderBy(asc(spells.level), asc(spells.name));
  }
  
  async getSpellsBySchool(school: string): Promise<Spell[]> {
    return db.select().from(spells).where(eq(spells.school, school)).orderBy(asc(spells.level), asc(spells.name));
  }
  
  async createSpell(spell: InsertSpell): Promise<Spell> {
    const [created] = await db.insert(spells).values(spell).returning();
    return created;
  }
  
  async seedSpells(spellsData: InsertSpell[]): Promise<number> {
    let count = 0;
    for (const spellData of spellsData) {
      const existing = await this.getSpellByName(spellData.name);
      if (!existing) {
        await this.createSpell(spellData);
        count++;
      }
    }
    return count;
  }
  
  // Character Spell operations
  async getCharacterSpells(characterId: number): Promise<(CharacterSpell & { spell: Spell })[]> {
    const results = await db.select({
      characterSpell: characterSpells,
      spell: spells
    })
    .from(characterSpells)
    .innerJoin(spells, eq(characterSpells.spellId, spells.id))
    .where(eq(characterSpells.characterId, characterId))
    .orderBy(asc(spells.level), asc(spells.name));
    
    return results.map(r => ({ ...r.characterSpell, spell: r.spell }));
  }
  
  async getCharacterSpell(characterId: number, spellId: number): Promise<CharacterSpell | undefined> {
    const [result] = await db.select().from(characterSpells)
      .where(and(
        eq(characterSpells.characterId, characterId),
        eq(characterSpells.spellId, spellId)
      ));
    return result || undefined;
  }
  
  async learnSpell(characterSpell: InsertCharacterSpell): Promise<CharacterSpell> {
    const [created] = await db.insert(characterSpells).values(characterSpell).returning();
    return created;
  }
  
  async prepareSpell(characterId: number, spellId: number, prepared: boolean): Promise<CharacterSpell | undefined> {
    const [updated] = await db.update(characterSpells)
      .set({ isPrepared: prepared })
      .where(and(
        eq(characterSpells.characterId, characterId),
        eq(characterSpells.spellId, spellId)
      ))
      .returning();
    return updated || undefined;
  }
  
  async forgetSpell(characterId: number, spellId: number): Promise<boolean> {
    await db.delete(characterSpells)
      .where(and(
        eq(characterSpells.characterId, characterId),
        eq(characterSpells.spellId, spellId)
      ));
    return true;
  }
  
  // Character Spell Slots operations
  async getCharacterSpellSlots(characterId: number): Promise<CharacterSpellSlots | undefined> {
    const [slots] = await db.select().from(characterSpellSlots)
      .where(eq(characterSpellSlots.characterId, characterId));
    return slots || undefined;
  }
  
  async initializeSpellSlots(characterId: number, slots: InsertCharacterSpellSlots): Promise<CharacterSpellSlots> {
    const existing = await this.getCharacterSpellSlots(characterId);
    if (existing) {
      const [updated] = await db.update(characterSpellSlots)
        .set(slots)
        .where(eq(characterSpellSlots.characterId, characterId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(characterSpellSlots).values({ ...slots, characterId }).returning();
    return created;
  }
  
  async updateSpellSlots(characterId: number, updates: Partial<CharacterSpellSlots>): Promise<CharacterSpellSlots | undefined> {
    const [updated] = await db.update(characterSpellSlots)
      .set(updates)
      .where(eq(characterSpellSlots.characterId, characterId))
      .returning();
    return updated || undefined;
  }
  
  async useSpellSlot(characterId: number, slotLevel: number): Promise<boolean> {
    const slots = await this.getCharacterSpellSlots(characterId);
    if (!slots) return false;
    
    const maxKey = `slotsLevel${slotLevel}Max` as keyof CharacterSpellSlots;
    const usedKey = `slotsLevel${slotLevel}Used` as keyof CharacterSpellSlots;
    
    const maxSlots = (slots[maxKey] as number) || 0;
    const usedSlots = (slots[usedKey] as number) || 0;
    
    if (usedSlots >= maxSlots) return false;
    
    await db.update(characterSpellSlots)
      .set({ [usedKey]: usedSlots + 1 })
      .where(eq(characterSpellSlots.characterId, characterId));
    return true;
  }
  
  async resetSpellSlots(characterId: number): Promise<CharacterSpellSlots | undefined> {
    const [updated] = await db.update(characterSpellSlots)
      .set({
        slotsLevel1Used: 0,
        slotsLevel2Used: 0,
        slotsLevel3Used: 0,
        slotsLevel4Used: 0,
        slotsLevel5Used: 0,
        slotsLevel6Used: 0,
        slotsLevel7Used: 0,
        slotsLevel8Used: 0,
        slotsLevel9Used: 0,
        lastLongRest: new Date().toISOString()
      })
      .where(eq(characterSpellSlots.characterId, characterId))
      .returning();
    return updated || undefined;
  }
  
  // Badge operations
  async getAllBadges(): Promise<Badge[]> {
    return await db.select().from(badges).orderBy(asc(badges.name));
  }
  
  async getBadge(id: number): Promise<Badge | undefined> {
    const [badge] = await db.select().from(badges).where(eq(badges.id, id));
    return badge || undefined;
  }
  
  async getBadgeByName(name: string): Promise<Badge | undefined> {
    const [badge] = await db.select().from(badges).where(eq(badges.name, name));
    return badge || undefined;
  }
  
  async getBadgesByCategory(category: string): Promise<Badge[]> {
    return await db.select().from(badges)
      .where(eq(badges.category, category))
      .orderBy(asc(badges.name));
  }
  
  async createBadge(badge: InsertBadge): Promise<Badge> {
    const [created] = await db.insert(badges).values(badge).returning();
    return created;
  }
  
  // User Badge operations
  async getUserBadges(userId: number): Promise<(UserBadge & { badge: Badge })[]> {
    const results = await db.select({
      userBadge: userBadges,
      badge: badges
    })
    .from(userBadges)
    .innerJoin(badges, eq(userBadges.badgeId, badges.id))
    .where(eq(userBadges.userId, userId))
    .orderBy(desc(userBadges.earnedAt));
    
    return results.map(r => ({ ...r.userBadge, badge: r.badge }));
  }
  
  async awardBadge(userId: number, badgeId: number, context?: any): Promise<UserBadge> {
    const [existing] = await db.select().from(userBadges)
      .where(and(
        eq(userBadges.userId, userId),
        eq(userBadges.badgeId, badgeId)
      ));
    
    if (existing) {
      return existing;
    }
    
    const [created] = await db.insert(userBadges).values({
      userId,
      badgeId,
      earnedAt: new Date().toISOString(),
      context: context || {}
    }).returning();
    return created;
  }
  
  async hasUserBadge(userId: number, badgeId: number): Promise<boolean> {
    const [result] = await db.select().from(userBadges)
      .where(and(
        eq(userBadges.userId, userId),
        eq(userBadges.badgeId, badgeId)
      ));
    return !!result;
  }
  
  async updateUserBadge(id: number, updates: Partial<UserBadge>): Promise<UserBadge | undefined> {
    const [updated] = await db.update(userBadges)
      .set(updates)
      .where(eq(userBadges.id, id))
      .returning();
    return updated || undefined;
  }
  
  // Magic Item Template operations
  async getMagicItemTemplates(filters?: { rarity?: string; type?: string; minLevel?: number; maxLevel?: number; classAffinity?: string; isShoppable?: boolean }): Promise<any[]> {
    let query = `SELECT * FROM magic_item_templates WHERE 1=1`;
    const params: any[] = [];
    
    if (filters?.rarity) {
      params.push(filters.rarity);
      query += ` AND rarity = $${params.length}`;
    }
    if (filters?.type) {
      params.push(filters.type);
      query += ` AND type = $${params.length}`;
    }
    if (filters?.minLevel !== undefined) {
      params.push(filters.minLevel);
      query += ` AND max_level >= $${params.length}`;
    }
    if (filters?.maxLevel !== undefined) {
      params.push(filters.maxLevel);
      query += ` AND min_level <= $${params.length}`;
    }
    if (filters?.classAffinity) {
      params.push(filters.classAffinity);
      query += ` AND ($${params.length} = ANY(class_affinity) OR class_affinity IS NULL)`;
    }
    if (filters?.isShoppable !== undefined) {
      params.push(filters.isShoppable);
      query += ` AND is_shoppable = $${params.length}`;
    }
    
    query += ` ORDER BY rarity DESC, name ASC`;
    
    const result = await db.execute(sql.raw(query));
    return result.rows as any[];
  }
  
  async getMagicItemTemplate(id: number): Promise<any | undefined> {
    const result = await db.execute(sql`SELECT * FROM magic_item_templates WHERE id = ${id}`);
    return result.rows[0] || undefined;
  }
  
  async getMilestoneDrops(milestoneType: string, characterLevel: number, characterClass: string): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT * FROM magic_item_templates 
      WHERE milestone_type = ${milestoneType}
        AND min_level <= ${characterLevel}
        AND max_level >= ${characterLevel}
        AND (${characterClass} = ANY(class_affinity) OR class_affinity IS NULL)
      ORDER BY drop_weight DESC, RANDOM()
    `);
    return result.rows as any[];
  }
  
  // Character Inventory operations (magical items)
  async getCharacterInventory(characterId: number): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT * FROM character_inventory 
      WHERE character_id = ${characterId}
      ORDER BY is_equipped DESC, rarity DESC, name ASC
    `);
    return result.rows as any[];
  }
  
  async addItemToInventory(item: any): Promise<any> {
    const result = await db.execute(sql`
      INSERT INTO character_inventory (
        character_id, template_id, name, description, type, rarity,
        is_bound, bound_at, acquired_from, acquired_at,
        magic_bonus, damage_dice, damage_type, base_ac, properties,
        special_effect, requires_attunement, is_attuned,
        is_equipped, equip_slot, quantity, value
      ) VALUES (
        ${item.characterId}, ${item.templateId || null}, ${item.name}, ${item.description || null},
        ${item.type}, ${item.rarity || 'common'},
        ${item.isBound || false}, ${item.boundAt || null}, ${item.acquiredFrom || null}, ${item.acquiredAt || new Date().toISOString()},
        ${item.magicBonus || 0}, ${item.damageDice || null}, ${item.damageType || null}, ${item.baseAC || null}, ${item.properties || null},
        ${item.specialEffect || null}, ${item.requiresAttunement || false}, ${item.isAttuned || false},
        ${item.isEquipped || false}, ${item.equipSlot || null}, ${item.quantity || 1}, ${item.value || 0}
      ) RETURNING *
    `);
    return result.rows[0];
  }
  
  async updateInventoryItem(id: number, updates: any): Promise<any | undefined> {
    const setClause = Object.entries(updates)
      .map(([key, _], i) => `${key.replace(/([A-Z])/g, '_$1').toLowerCase()} = $${i + 2}`)
      .join(', ');
    
    const result = await db.execute(sql`
      UPDATE character_inventory 
      SET ${sql.raw(setClause)}
      WHERE id = ${id}
      RETURNING *
    `);
    return result.rows[0] || undefined;
  }
  
  async removeInventoryItem(id: number): Promise<boolean> {
    const result = await db.execute(sql`DELETE FROM character_inventory WHERE id = ${id}`);
    return (result.rowCount || 0) > 0;
  }
  
  async equipItem(itemId: number, slot: string): Promise<any | undefined> {
    const result = await db.execute(sql`
      UPDATE character_inventory 
      SET is_equipped = true, equip_slot = ${slot}
      WHERE id = ${itemId}
      RETURNING *
    `);
    return result.rows[0] || undefined;
  }
  
  async unequipItem(itemId: number): Promise<any | undefined> {
    const result = await db.execute(sql`
      UPDATE character_inventory 
      SET is_equipped = false, equip_slot = null
      WHERE id = ${itemId}
      RETURNING *
    `);
    return result.rows[0] || undefined;
  }
  
  async bindItem(itemId: number): Promise<any | undefined> {
    const result = await db.execute(sql`
      UPDATE character_inventory 
      SET is_bound = true, bound_at = ${new Date().toISOString()}
      WHERE id = ${itemId}
      RETURNING *
    `);
    return result.rows[0] || undefined;
  }
  
  // Milestone Reward operations
  async getMilestoneRewards(characterId: number, campaignId?: number): Promise<any[]> {
    if (campaignId) {
      const result = await db.execute(sql`
        SELECT mr.*, mit.name as item_name, mit.rarity as item_rarity, mit.description as item_description
        FROM milestone_rewards mr
        LEFT JOIN magic_item_templates mit ON mr.item_template_id = mit.id
        WHERE mr.character_id = ${characterId} AND mr.campaign_id = ${campaignId}
        ORDER BY mr.earned_at DESC
      `);
      return result.rows as any[];
    }
    const result = await db.execute(sql`
      SELECT mr.*, mit.name as item_name, mit.rarity as item_rarity, mit.description as item_description
      FROM milestone_rewards mr
      LEFT JOIN magic_item_templates mit ON mr.item_template_id = mit.id
      WHERE mr.character_id = ${characterId}
      ORDER BY mr.earned_at DESC
    `);
    return result.rows as any[];
  }
  
  async getUnclaimedRewards(characterId: number): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT mr.*, mit.name as item_name, mit.rarity as item_rarity, mit.description as item_description,
             mit.type as item_type, mit.special_effect, mit.magic_bonus
      FROM milestone_rewards mr
      LEFT JOIN magic_item_templates mit ON mr.item_template_id = mit.id
      WHERE mr.character_id = ${characterId} AND mr.is_claimed = false
      ORDER BY mr.earned_at DESC
    `);
    return result.rows as any[];
  }
  
  async createMilestoneReward(reward: any): Promise<any> {
    const result = await db.execute(sql`
      INSERT INTO milestone_rewards (
        character_id, campaign_id, milestone_type, milestone_name,
        session_number, item_template_id, xp_awarded, gold_awarded, earned_at
      ) VALUES (
        ${reward.characterId}, ${reward.campaignId}, ${reward.milestoneType}, ${reward.milestoneName},
        ${reward.sessionNumber || null}, ${reward.itemTemplateId || null},
        ${reward.xpAwarded || 0}, ${reward.goldAwarded || 0}, ${reward.earnedAt || new Date().toISOString()}
      ) RETURNING *
    `);
    return result.rows[0];
  }
  
  async claimMilestoneReward(rewardId: number): Promise<any | undefined> {
    // First get the reward details
    const rewardResult = await db.execute(sql`SELECT * FROM milestone_rewards WHERE id = ${rewardId} AND is_claimed = false`);
    const reward = rewardResult.rows[0] as any;
    if (!reward) return undefined;
    
    // If there's an item template, create the inventory item
    if (reward.item_template_id) {
      const templateResult = await db.execute(sql`SELECT * FROM magic_item_templates WHERE id = ${reward.item_template_id}`);
      const template = templateResult.rows[0] as any;
      
      if (template) {
        // Create the inventory item (bound by default for milestone drops)
        await db.execute(sql`
          INSERT INTO character_inventory (
            character_id, template_id, name, description, type, rarity,
            is_bound, bound_at, acquired_from, acquired_at,
            magic_bonus, damage_dice, damage_type, base_ac, properties,
            special_effect, requires_attunement, value
          ) VALUES (
            ${reward.character_id}, ${template.id}, ${template.name}, ${template.description},
            ${template.type}, ${template.rarity},
            true, ${new Date().toISOString()}, 'milestone', ${new Date().toISOString()},
            ${template.magic_bonus || 0}, ${template.damage_dice}, ${template.damage_type}, ${template.base_ac}, ${template.properties},
            ${template.special_effect}, ${template.requires_attunement || false}, ${template.shop_price || 0}
          )
        `);
      }
    }
    
    // Mark the reward as claimed
    const result = await db.execute(sql`
      UPDATE milestone_rewards 
      SET is_claimed = true, claimed_at = ${new Date().toISOString()}
      WHERE id = ${rewardId}
      RETURNING *
    `);
    return result.rows[0] || undefined;
  }
  
  // Tavern Magic Shop operations
  async getShopMagicItems(characterLevel?: number, characterClass?: string): Promise<any[]> {
    let query = `SELECT * FROM magic_item_templates WHERE is_shoppable = true`;
    
    if (characterLevel) {
      query += ` AND min_level <= ${characterLevel} AND max_level >= ${characterLevel}`;
    }
    if (characterClass) {
      query += ` AND ('${characterClass}' = ANY(class_affinity) OR class_affinity IS NULL)`;
    }
    
    query += ` ORDER BY shop_price ASC, name ASC`;
    
    const result = await db.execute(sql.raw(query));
    return result.rows as any[];
  }
  
  async purchaseMagicItem(characterId: number, templateId: number): Promise<{ success: boolean; item?: any; error?: string }> {
    // Get character gold
    const charResult = await db.execute(sql`SELECT gold, level, class FROM characters WHERE id = ${characterId}`);
    const character = charResult.rows[0] as any;
    if (!character) {
      return { success: false, error: 'Character not found' };
    }
    
    // Get item template
    const templateResult = await db.execute(sql`SELECT * FROM magic_item_templates WHERE id = ${templateId} AND is_shoppable = true`);
    const template = templateResult.rows[0] as any;
    if (!template) {
      return { success: false, error: 'Item not available for purchase' };
    }
    
    // Check gold
    if ((character.gold || 0) < (template.shop_price || 0)) {
      return { success: false, error: 'Not enough gold' };
    }
    
    // Check level requirements
    if (character.level < template.min_level) {
      return { success: false, error: `Requires level ${template.min_level}` };
    }
    
    // Deduct gold
    await db.execute(sql`UPDATE characters SET gold = gold - ${template.shop_price} WHERE id = ${characterId}`);
    
    // Add item to inventory (not bound - purchased items can be traded)
    const itemResult = await db.execute(sql`
      INSERT INTO character_inventory (
        character_id, template_id, name, description, type, rarity,
        is_bound, acquired_from, acquired_at,
        magic_bonus, damage_dice, damage_type, base_ac, properties,
        special_effect, requires_attunement, value
      ) VALUES (
        ${characterId}, ${template.id}, ${template.name}, ${template.description},
        ${template.type}, ${template.rarity},
        false, 'shop', ${new Date().toISOString()},
        ${template.magic_bonus || 0}, ${template.damage_dice}, ${template.damage_type}, ${template.base_ac}, ${template.properties},
        ${template.special_effect}, ${template.requires_attunement || false}, ${template.shop_price}
      ) RETURNING *
    `);
    
    return { success: true, item: itemResult.rows[0] };
  }

  async createSharedAdventure(adventure: InsertSharedAdventure): Promise<SharedAdventure> {
    const [result] = await db.insert(sharedAdventures).values(adventure).returning();
    return result;
  }

  async getSharedAdventure(id: number): Promise<SharedAdventure | undefined> {
    const [result] = await db.select().from(sharedAdventures).where(eq(sharedAdventures.id, id));
    return result;
  }

  async getSharedAdventuresByUser(userId: number): Promise<SharedAdventure[]> {
    return await db.select().from(sharedAdventures).where(eq(sharedAdventures.authorId, userId)).orderBy(desc(sharedAdventures.id));
  }

  async getAllSharedAdventures(options?: { limit?: number; genre?: string; difficulty?: string }): Promise<SharedAdventure[]> {
    const conditions = [eq(sharedAdventures.status, 'published')];
    if (options?.genre) conditions.push(eq(sharedAdventures.genre, options.genre));
    if (options?.difficulty) conditions.push(eq(sharedAdventures.difficulty, options.difficulty));
    
    let query = db.select().from(sharedAdventures).where(and(...conditions)).orderBy(desc(sharedAdventures.id));
    if (options?.limit) {
      query = query.limit(options.limit) as any;
    }
    return await query;
  }

  async deleteSharedAdventure(id: number): Promise<boolean> {
    const result = await db.delete(sharedAdventures).where(eq(sharedAdventures.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Wander Mode operations
  async createWanderRun(run: InsertWanderRun): Promise<WanderRun> {
    const [result] = await db.insert(wanderRuns).values(run).returning();
    return result;
  }

  async getWanderRun(id: number): Promise<WanderRun | undefined> {
    const [result] = await db.select().from(wanderRuns).where(eq(wanderRuns.id, id));
    return result;
  }

  async getActiveWanderRun(userId: number, campaignId: number): Promise<WanderRun | undefined> {
    const [result] = await db.select().from(wanderRuns).where(
      and(
        eq(wanderRuns.userId, userId),
        eq(wanderRuns.campaignId, campaignId),
        eq(wanderRuns.status, 'active')
      )
    );
    return result;
  }

  async updateWanderRun(id: number, updates: Partial<WanderRun>): Promise<WanderRun | undefined> {
    const [result] = await db.update(wanderRuns).set(updates).where(eq(wanderRuns.id, id)).returning();
    return result;
  }

  async createWanderOutcome(outcome: InsertWanderOutcomeLog): Promise<WanderOutcomeLog> {
    const [result] = await db.insert(wanderOutcomeLog).values(outcome).returning();
    return result;
  }

  async getWanderOutcomes(runId: number): Promise<WanderOutcomeLog[]> {
    return await db.select().from(wanderOutcomeLog).where(eq(wanderOutcomeLog.runId, runId)).orderBy(asc(wanderOutcomeLog.tick));
  }

  async createWanderMarker(marker: InsertWanderMarker): Promise<WanderMarker> {
    const [result] = await db.insert(wanderMarkers).values(marker).returning();
    return result;
  }

  async getWanderMarkers(campaignId: number): Promise<WanderMarker[]> {
    return await db.select().from(wanderMarkers).where(eq(wanderMarkers.campaignId, campaignId));
  }

  async getWanderMarkersForHex(campaignId: number, hexQ: number, hexR: number): Promise<WanderMarker[]> {
    return await db.select().from(wanderMarkers).where(
      and(
        eq(wanderMarkers.campaignId, campaignId),
        eq(wanderMarkers.hexQ, hexQ),
        eq(wanderMarkers.hexR, hexR)
      )
    );
  }

  async getHexExplorationState(userId: number, campaignId: number, hexQ: number, hexR: number): Promise<HexExplorationState | undefined> {
    const [result] = await db.select().from(hexExplorationStates).where(
      and(
        eq(hexExplorationStates.userId, userId),
        eq(hexExplorationStates.campaignId, campaignId),
        eq(hexExplorationStates.hexQ, hexQ),
        eq(hexExplorationStates.hexR, hexR)
      )
    );
    return result;
  }

  async upsertHexExplorationState(state: InsertHexExplorationState): Promise<HexExplorationState> {
    const existing = await this.getHexExplorationState(state.userId, state.campaignId, state.hexQ, state.hexR);
    if (existing) {
      const [result] = await db.update(hexExplorationStates).set(state).where(eq(hexExplorationStates.id, existing.id)).returning();
      return result;
    }
    const [result] = await db.insert(hexExplorationStates).values(state).returning();
    return result;
  }

  async getExploredHexes(userId: number, campaignId: number): Promise<HexExplorationState[]> {
    return await db.select().from(hexExplorationStates).where(
      and(
        eq(hexExplorationStates.userId, userId),
        eq(hexExplorationStates.campaignId, campaignId)
      )
    );
  }

  // Delve Mode operations
  async createDungeonDefinition(dungeon: InsertDungeonDefinition): Promise<DungeonDefinition> {
    const [result] = await db.insert(dungeonDefinitions).values(dungeon).returning();
    return result;
  }

  async getDungeonDefinition(id: number): Promise<DungeonDefinition | undefined> {
    const [result] = await db.select().from(dungeonDefinitions).where(eq(dungeonDefinitions.id, id));
    return result;
  }

  async getAllDungeonDefinitions(): Promise<DungeonDefinition[]> {
    return await db.select().from(dungeonDefinitions);
  }

  async createDungeonRun(run: InsertDungeonRun): Promise<DungeonRun> {
    const [result] = await db.insert(dungeonRuns).values(run).returning();
    return result;
  }

  async getDungeonRun(id: number): Promise<DungeonRun | undefined> {
    const [result] = await db.select().from(dungeonRuns).where(eq(dungeonRuns.id, id));
    return result;
  }

  async getActiveDungeonRun(userId: number, campaignId: number): Promise<DungeonRun | undefined> {
    const [result] = await db.select().from(dungeonRuns).where(
      and(
        eq(dungeonRuns.userId, userId),
        eq(dungeonRuns.campaignId, campaignId),
        eq(dungeonRuns.status, 'active')
      )
    );
    return result;
  }

  async updateDungeonRun(id: number, updates: Partial<DungeonRun>): Promise<DungeonRun | undefined> {
    const [result] = await db.update(dungeonRuns).set(updates).where(eq(dungeonRuns.id, id)).returning();
    return result;
  }

  async createDungeonNodeState(nodeState: InsertDungeonNodeState): Promise<DungeonNodeState> {
    const [result] = await db.insert(dungeonNodeStates).values(nodeState).returning();
    return result;
  }

  async getDungeonNodeStates(runId: number): Promise<DungeonNodeState[]> {
    return await db.select().from(dungeonNodeStates).where(eq(dungeonNodeStates.runId, runId));
  }

  async updateDungeonNodeState(id: number, updates: Partial<DungeonNodeState>): Promise<DungeonNodeState | undefined> {
    const [result] = await db.update(dungeonNodeStates).set(updates).where(eq(dungeonNodeStates.id, id)).returning();
    return result;
  }

  async upsertDungeonNodeState(runId: number, nodeId: string, updates: Partial<DungeonNodeState>): Promise<DungeonNodeState> {
    const [existing] = await db.select().from(dungeonNodeStates).where(
      and(
        eq(dungeonNodeStates.runId, runId),
        eq(dungeonNodeStates.nodeId, nodeId)
      )
    );
    if (existing) {
      const [result] = await db.update(dungeonNodeStates).set(updates).where(eq(dungeonNodeStates.id, existing.id)).returning();
      return result;
    }
    const [result] = await db.insert(dungeonNodeStates).values({ runId, nodeId, ...updates }).returning();
    return result;
  }

  async createDungeonReward(reward: InsertDungeonReward): Promise<DungeonReward> {
    const [result] = await db.insert(dungeonRewards).values(reward).returning();
    return result;
  }

  async getDungeonRewards(runId: number): Promise<DungeonReward[]> {
    return await db.select().from(dungeonRewards).where(eq(dungeonRewards.runId, runId));
  }

  async getLlmConfig(userId: number): Promise<LlmConfig | undefined> {
    const results = await db.select().from(llmConfigs)
      .where(and(eq(llmConfigs.userId, userId), eq(llmConfigs.isActive, true)))
      .limit(1);
    return results[0];
  }

  async getLlmConfigs(userId: number): Promise<LlmConfig[]> {
    return await db.select().from(llmConfigs)
      .where(eq(llmConfigs.userId, userId))
      .orderBy(desc(llmConfigs.createdAt));
  }

  async createLlmConfig(config: InsertLlmConfig): Promise<LlmConfig> {
    if (config.isActive) {
      await db.update(llmConfigs)
        .set({ isActive: false })
        .where(eq(llmConfigs.userId, config.userId));
    }
    const [result] = await db.insert(llmConfigs).values(config).returning();
    return result;
  }

  async updateLlmConfig(id: number, updates: Partial<LlmConfig>): Promise<LlmConfig | undefined> {
    if (updates.isActive) {
      const [existing] = await db.select().from(llmConfigs).where(eq(llmConfigs.id, id));
      if (existing) {
        await db.update(llmConfigs)
          .set({ isActive: false })
          .where(and(eq(llmConfigs.userId, existing.userId), eq(llmConfigs.isActive, true)));
      }
    }
    const [result] = await db.update(llmConfigs)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(llmConfigs.id, id))
      .returning();
    return result;
  }

  async deleteLlmConfig(id: number): Promise<boolean> {
    const result = await db.delete(llmConfigs).where(eq(llmConfigs.id, id));
    return true;
  }

  async createUserFeedback(feedback: InsertUserFeedback): Promise<UserFeedback> {
    const [result] = await db.insert(userFeedback).values({
      ...feedback,
      createdAt: new Date().toISOString(),
    }).returning();
    return result;
  }
}

// Switch from MemStorage to DatabaseStorage
export const storage = new DatabaseStorage();
