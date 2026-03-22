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
  // ==================== Campaign Dungeon Map Routes ====================
  
  // Get dungeon map for a campaign, optionally filtered by location
  app.get("/api/campaigns/:campaignId/dungeon-map", async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const location = req.query.location as string | undefined;
      
      if (location) {
        // Find map for specific location
        const maps = await storage.getCampaignDungeonMaps(campaignId);
        const locationMap = maps.find(m => 
          m.mapName.toLowerCase().includes(location.toLowerCase()) ||
          location.toLowerCase().includes(m.mapName.toLowerCase())
        );
        if (!locationMap) {
          return res.status(404).json({ message: "No dungeon map found for this location" });
        }
        return res.json(locationMap);
      }
      
      // Default: return active map
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
      
      // Combat cooldown - reduce/prevent combat encounters if recent combat occurred
      const movesSinceLastCombat = storyState.movesSinceLastCombat || 999;
      const combatCooldownActive = movesSinceLastCombat < 4; // Minimum 4 moves between combat encounters
      
      // If combat cooldown is active and this would be a combat encounter, convert to social or exploration
      if (combatCooldownActive && encounterTriggered && encounterData?.type === 'combat') {
        // Convert combat to exploration - enemies spotted but can be avoided
        encounterData = {
          type: 'exploration',
          description: `You spot ${nearbyEntities?.filter((e: any) => e.type === 'enemy' || e.type === 'boss').map((e: any) => e.name).join(' and ') || 'enemies'} in the distance. They haven't noticed you yet - perhaps you can find another way or learn something useful here.`,
          choices: [
            { id: 'investigate', text: 'Search for useful items or clues (Investigation DC 12)', rollRequired: { type: 'd20', skill: 'investigation' } },
            { id: 'stealth', text: 'Sneak past them quietly (Stealth DC 13)', rollRequired: { type: 'd20', skill: 'stealth' } },
            { id: 'observe', text: 'Watch and learn their patrol patterns', rollRequired: null }
          ],
          resolved: false
        };
      }
      
      // Interactive riddle encounter chance - requires TYPED answers, not skill checks
      // These are verbal puzzles that test player knowledge and thinking
      if (!encounterTriggered && Math.random() < 0.15) {
        const riddleEncounters = [
          {
            description: 'A stone guardian blocks the passage. Its eyes glow as it speaks: "I have cities, but no houses live there. I have mountains, but no trees grow there. I have water, but no fish swim there. What am I?"',
            answer: 'map',
            alternateAnswers: ['a map', 'maps'],
            hint: 'Think about what shows places without being the places themselves...',
            successNarrative: 'The guardian nods slowly. "Wisdom opens doors that strength cannot." The stone figure steps aside, revealing a hidden alcove with treasure.',
            failureNarrative: 'The guardian shakes its head. "Ponder more deeply, traveler. You may try again." The passage remains blocked.',
            reward: { gold: 50, xp: 40, items: ['Ring of Minor Protection'] }
          },
          {
            description: 'An ancient spirit materializes before you, speaking in a hollow voice: "The more you take, the more you leave behind. What am I?"',
            answer: 'footsteps',
            alternateAnswers: ['steps', 'footprints', 'tracks'],
            hint: 'Consider what happens when you walk...',
            successNarrative: 'The spirit smiles warmly. "You understand the journey matters as much as the destination." It fades, leaving behind a glowing orb of knowledge.',
            failureNarrative: 'The spirit looks disappointed. "The answer walks with you always. Think on it." The spirit waits patiently.',
            reward: { xp: 35, items: ['Orb of Insight'] }
          },
          {
            description: 'A sphinx-like statue animates and poses: "I speak without a mouth and hear without ears. I have no body, but I come alive with the wind. What am I?"',
            answer: 'echo',
            alternateAnswers: ['an echo', 'echoes'],
            hint: 'Listen to the mountains...',
            successNarrative: 'The sphinx purrs with satisfaction. "Your mind is sharp. May your echoes carry far." A compartment opens in its base.',
            failureNarrative: 'The sphinx closes its eyes. "Listen more carefully to the world around you."',
            reward: { gold: 30, xp: 45 }
          },
          {
            description: 'Glowing runes on the door pulse with each heartbeat. A voice whispers: "I fly without wings. I cry without eyes. Wherever I go, darkness dies. What am I?"',
            answer: 'cloud',
            alternateAnswers: ['a cloud', 'clouds', 'rain cloud'],
            hint: 'Look to the sky when storms gather...',
            successNarrative: 'The runes flash brilliantly and the door swings open. Rain begins to fall gently, blessing your passage.',
            failureNarrative: 'The runes dim slightly. "The sky holds many secrets. Look up and think again."',
            reward: { xp: 40, items: ['Cloak of the Storm'] }
          },
          {
            description: 'A mischievous fey creature appears, giggling: "What can travel around the world while staying in a corner?"',
            answer: 'stamp',
            alternateAnswers: ['a stamp', 'postage stamp', 'stamps'],
            hint: 'Think about letters and messages...',
            successNarrative: 'The fey claps delightedly! "Oh, clever, clever! Here, take this for your wit!" It tosses you a pouch of gold.',
            failureNarrative: 'The fey pouts. "No no no! Think smaller, think paper!" It crosses its arms, waiting.',
            reward: { gold: 40, xp: 30 }
          }
        ];
        const riddle = riddleEncounters[Math.floor(Math.random() * riddleEncounters.length)];
        encounterTriggered = true;
        encounterData = {
          type: 'riddle',
          description: riddle.description,
          answer: riddle.answer.toLowerCase(),
          alternateAnswers: riddle.alternateAnswers.map((a: string) => a.toLowerCase()),
          hint: riddle.hint,
          successNarrative: riddle.successNarrative,
          failureNarrative: riddle.failureNarrative,
          reward: riddle.reward,
          choices: [
            { id: 'answer_riddle', text: 'Type your answer...', type: 'text_input', rollRequired: null },
            { id: 'request_hint', text: 'Ask for a hint', rollRequired: null },
            { id: 'skip_riddle', text: 'Leave without answering', rollRequired: null }
          ],
          resolved: false,
          hintGiven: false,
          attempts: 0
        };
      }
      
      // Dialogue/conversation encounter - branching conversations with consequences
      if (!encounterTriggered && Math.random() < 0.18) {
        const dialogueEncounters = [
          {
            npcName: 'Wounded Knight',
            description: 'A badly wounded knight in dented armor leans against the wall, clutching a bleeding wound. They look up at you with desperate eyes.',
            initialDialogue: '"Please... I was ambushed. The cultists... they took something important. A sacred relic. You look capable - will you hear my plea?"',
            branches: [
              {
                id: 'help',
                text: '"Tell me everything. I will help you."',
                response: '"Bless you, adventurer! The cultists went deeper into the ruins. They seek to corrupt the Moonstone Chalice. Here, take my family ring - it will prove I sent you. And this healing potion... I was saving it, but you need your strength."',
                consequence: 'gained_trust',
                reward: { items: ['Knight\'s Signet Ring', 'Potion of Healing'], xp: 25 },
                followUp: { questHook: 'Find the cultists and recover the Moonstone Chalice' }
              },
              {
                id: 'payment',
                text: '"What\'s in it for me? I don\'t work for free."',
                response: '"I... I understand. I have little, but I can offer my family ring. It\'s valuable, and I give you my word - recover the chalice and my family will reward you handsomely."',
                consequence: 'mercenary',
                reward: { items: ['Knight\'s Signet Ring'], xp: 15 },
                followUp: { questHook: 'The knight promised gold for recovering the chalice' }
              },
              {
                id: 'interrogate',
                text: '"How do I know this isn\'t a trap? Tell me more about these cultists first."',
                response: '"Fair caution. They wear robes of deep purple, marked with a bleeding eye. They worship something old and hungry. I overheard them speak of a ritual at moonrise. Please... I have no strength left to lie."',
                consequence: 'informed',
                reward: { xp: 20 },
                followUp: { intel: 'Purple-robed cultists, Bleeding Eye symbol, ritual at moonrise' }
              },
              {
                id: 'refuse',
                text: '"I have my own problems. Good luck with yours."',
                response: '"I... I understand. These are dark times. May your path be safer than mine was." *The knight slumps back, hope fading from their eyes.*',
                consequence: 'abandoned',
                reward: null,
                followUp: null
              }
            ]
          },
          {
            npcName: 'Suspicious Merchant',
            description: 'A hooded figure has set up a small display of curious items on a worn blanket. Their eyes gleam with intelligence... and perhaps something else.',
            initialDialogue: '"Ah, a fellow traveler in these forgotten places! I deal in... rarities. Things found in the dark. Perhaps we can help each other? I seek information about what lies ahead."',
            branches: [
              {
                id: 'trade_info',
                text: '"I\'ll share what I know - if your prices are fair."',
                response: '"A pragmatist! Excellent. I heard sounds of combat and screaming from the north passage. In exchange, I offer you this scroll - it reveals hidden doors. And a word of warning: trust nothing that speaks in riddles down here."',
                consequence: 'fair_trade',
                reward: { items: ['Scroll of Detect Secret Doors'], xp: 20 },
                followUp: { intel: 'Dangers in the north passage, something that speaks in riddles' }
              },
              {
                id: 'intimidate',
                text: '"Drop the act. Who are you really, and what are you doing down here?"',
                response: '*The merchant\'s demeanor shifts, becoming cold.* "Careful, adventurer. I am more than I appear. But... I respect directness. I\'m a collector of forbidden knowledge. And I know things about this place that could save your life - or end it."',
                consequence: 'tense_respect',
                reward: { xp: 15 },
                followUp: { intel: 'The merchant knows dangerous secrets about this place' }
              },
              {
                id: 'browse',
                text: '"Let me see what you\'re selling."',
                response: '"Of course! I have potions that heal wounds, daggers that never dull, and... ah, this." *They produce a strange amulet.* "Found it on a corpse two levels down. It radiates magic, but I cannot discern its purpose. Interested?"',
                consequence: 'browsing',
                reward: null,
                followUp: { shopAvailable: true }
              },
              {
                id: 'ignore',
                text: '"I don\'t deal with strangers in dark places."',
                response: '"A pity. Caution is wise, but it can also mean missed opportunities. Should you change your mind, I will be here... for a time." *They return to arranging their wares.*',
                consequence: 'cautious',
                reward: null,
                followUp: null
              }
            ]
          },
          {
            npcName: 'Captured Prisoner',
            description: 'Behind rusty bars, a gaunt figure in tattered robes reaches toward you. Their eyes are haunted but lucid.',
            initialDialogue: '"Please, you must help me! I am a scholar from the Academy. I was captured while researching these ruins. The creatures here... they\'re not what they seem. I have vital information!"',
            branches: [
              {
                id: 'free_them',
                text: '"Stand back from the bars. I\'ll get you out."',
                response: '"Thank the gods! The key... the jailer carries it. A twisted creature that patrols the eastern hall. Once I\'m free, I can tell you everything I\'ve learned about the curse affecting this place."',
                consequence: 'rescue_mission',
                reward: { xp: 30 },
                followUp: { questHook: 'Find the jailer and get the key to free the scholar' }
              },
              {
                id: 'information_first',
                text: '"Tell me what you know first. Then we\'ll discuss your freedom."',
                response: '"Understandable. Listen: the lord of these ruins was betrayed by his own court wizard. The wizard\'s ghost still lingers, protecting a treasure room. But the ghost can be reasoned with - it seeks proof of the betrayer\'s guilt."',
                consequence: 'informed',
                reward: { xp: 25 },
                followUp: { intel: 'Ghost of betrayed lord guards treasure, can be reasoned with using proof of betrayal' }
              },
              {
                id: 'suspicious',
                text: '"How do I know you\'re not one of the monsters, wearing a person\'s face?"',
                response: '"A... fair question in this place. Ask me something only a living person would know. Test me. I was once a lecturer at the Academy in Waterdeep. I can name the deans, the subjects, the architecture..."',
                consequence: 'testing',
                reward: null,
                followUp: { dialogueContinues: true }
              },
              {
                id: 'leave_them',
                text: '"Sorry, I can\'t risk it. You could be bait for a trap."',
                response: '"No! Wait! Please... *sob* ...at least tell someone I\'m here. Please. I have a daughter. Her name is Elara. Please..." *Their voice breaks.*',
                consequence: 'abandoned',
                reward: null,
                followUp: { moralWeight: 'You left someone to suffer' }
              }
            ]
          },
          {
            npcName: 'Ghostly Noble',
            description: 'A translucent figure in fine but ancient clothing materializes before you. Unlike most specters, this one seems composed, even regal.',
            initialDialogue: '"Hold, mortal. I am Lord Aldric, master of these halls in life. I sense you are not with the defilers who now infest my home. Perhaps we can aid each other?"',
            branches: [
              {
                id: 'ally',
                text: '"I mean no disrespect to your home, Lord Aldric. What aid do you offer?"',
                response: '"Courtesy! How refreshing. My traitorous advisor hid my family\'s treasures before poisoning me. Bring me his confession - a letter he kept as a trophy - and I shall reveal the vault\'s location to you."',
                consequence: 'ghostly_alliance',
                reward: { xp: 35 },
                followUp: { questHook: 'Find the traitor\'s confession letter for Lord Aldric' }
              },
              {
                id: 'comfort',
                text: '"You have suffered a great injustice. Perhaps it is time to find peace?"',
                response: '"Peace... I had forgotten the word. But no, I cannot rest until my betrayer\'s crimes are exposed. Yet your words are kind. Take this blessing - it will shield you from the lesser dead here."',
                consequence: 'compassion',
                reward: { items: ['Blessing of the Departed'], xp: 30 },
                followUp: { protection: 'Lesser undead will not attack unprovoked' }
              },
              {
                id: 'banish',
                text: '"Begone, spirit! I\'ll not bargain with the dead!"',
                response: '"Fool! I was offering you aid!" *The ghost\'s form flickers with anger.* "Very well. Navigate my halls without my guidance. But know this - the living are not the only dangers here." *The ghost vanishes.*',
                consequence: 'hostile_ghost',
                reward: null,
                followUp: { consequence: 'Lord Aldric may interfere with your exploration' }
              },
              {
                id: 'question',
                text: '"Tell me about this betrayer. What happened to you?"',
                response: '"My advisor, Malachar. He coveted my wife, my wealth, my title. When I refused to grant him more power, he poisoned my wine. I watched helplessly as he took everything. His spirit lingers too, in the east wing, gloating even in death."',
                consequence: 'informed',
                reward: { xp: 25 },
                followUp: { intel: 'Malachar\'s ghost haunts the east wing, motivated by jealousy' }
              }
            ]
          }
        ];
        const dialogue = dialogueEncounters[Math.floor(Math.random() * dialogueEncounters.length)];
        encounterTriggered = true;
        encounterData = {
          type: 'dialogue',
          npcName: dialogue.npcName,
          description: dialogue.description,
          initialDialogue: dialogue.initialDialogue,
          branches: dialogue.branches,
          choices: dialogue.branches.map((b: any) => ({
            id: b.id,
            text: b.text,
            type: 'dialogue',
            rollRequired: null
          })),
          resolved: false,
          currentBranch: null
        };
      }
      
      // Random puzzle encounter chance (if no other encounter triggered)
      // Reduced from 22% to 12% since we added riddles and dialogue
      if (!encounterTriggered && Math.random() < 0.12) {
        const puzzleTypes = [
          {
            description: 'A tall mirror stands at the end of the hall, reflecting a version of the room that doesn\'t match reality. Objects in the reflection are rearranged — the solution lies in matching the real room to the mirror\'s image.',
            choices: [
              { id: 'investigate', text: 'Study the differences between reflection and reality (Investigation DC 13)', rollRequired: { type: 'd20', skill: 'investigation' } },
              { id: 'arcana', text: 'Sense the enchantment binding the mirror (Arcana DC 14)', rollRequired: { type: 'd20', skill: 'arcana' } },
              { id: 'force', text: 'Smash the mirror and see what happens (Strength DC 15)', rollRequired: { type: 'd20', skill: 'strength' } },
              { id: 'skip', text: 'Leave the mirror alone and move on', rollRequired: null }
            ]
          },
          {
            description: 'Weathered carvings on the wall depict a riddle in verse: "I have cities but no houses, forests but no trees, and water but no fish." A stone dial below awaits an answer.',
            choices: [
              { id: 'solve', text: 'Attempt to solve the riddle (Intelligence DC 14)', rollRequired: { type: 'd20', skill: 'intelligence' } },
              { id: 'history', text: 'Recall similar riddles from folklore (History DC 12)', rollRequired: { type: 'd20', skill: 'history' } },
              { id: 'force', text: 'Force the dial to turn (Strength DC 16)', rollRequired: { type: 'd20', skill: 'strength' } },
              { id: 'skip', text: 'Move on without solving', rollRequired: null }
            ]
          },
          {
            description: 'A series of bronze pipes line the walls, each producing a different tone when struck. Faded painted murals above show a sequence of colored notes that must be played in order.',
            choices: [
              { id: 'performance', text: 'Play the sequence from the mural (Performance DC 13)', rollRequired: { type: 'd20', skill: 'performance' } },
              { id: 'perception', text: 'Listen for a pattern in the ambient echoes (Perception DC 14)', rollRequired: { type: 'd20', skill: 'perception' } },
              { id: 'force', text: 'Bend the pipes to force them open (Strength DC 15)', rollRequired: { type: 'd20', skill: 'strength' } },
              { id: 'skip', text: 'Ignore the pipes and search for another way', rollRequired: null }
            ]
          },
          {
            description: 'A locked mechanism blocks your path. Interlocking gears and weighted levers must be arranged in the correct sequence to release the lock.',
            choices: [
              { id: 'investigate', text: 'Study the mechanism (Investigation DC 13)', rollRequired: { type: 'd20', skill: 'investigation' } },
              { id: 'thieves', text: 'Pick the lock with thieves\' tools (Sleight of Hand DC 14)', rollRequired: { type: 'd20', skill: 'sleight_of_hand' } },
              { id: 'force', text: 'Try to force it open (Strength DC 16)', rollRequired: { type: 'd20', skill: 'strength' } },
              { id: 'bypass', text: 'Find another way around', rollRequired: null }
            ]
          },
          {
            description: 'The corridor opens into a flooded chamber. Water rises slowly from grates in the floor. A sealed door on the far side has a valve mechanism that must be turned underwater.',
            choices: [
              { id: 'swim', text: 'Dive under and turn the valve (Athletics DC 14)', rollRequired: { type: 'd20', skill: 'athletics' } },
              { id: 'investigate', text: 'Find a way to drain the water first (Investigation DC 13)', rollRequired: { type: 'd20', skill: 'investigation' } },
              { id: 'nature', text: 'Use natural debris to block the rising water (Nature DC 12)', rollRequired: { type: 'd20', skill: 'nature' } },
              { id: 'wait', text: 'Wait and observe the water pattern', rollRequired: null }
            ]
          },
          {
            description: 'Four stone statues stand in alcoves, each holding an empty hand outstretched. Scattered across the floor are objects: a feather, a coin, a skull, and a flower. Placing the right item in each hand opens the way.',
            choices: [
              { id: 'religion', text: 'Identify the statues\' symbolism (Religion DC 13)', rollRequired: { type: 'd20', skill: 'religion' } },
              { id: 'investigate', text: 'Examine the statues for clues (Investigation DC 12)', rollRequired: { type: 'd20', skill: 'investigation' } },
              { id: 'trial', text: 'Try placing objects by instinct (Wisdom DC 14)', rollRequired: { type: 'd20', skill: 'wisdom' } },
              { id: 'force', text: 'Break a statue to see what\'s inside (Strength DC 16)', rollRequired: { type: 'd20', skill: 'strength' } }
            ]
          },
          {
            description: 'Colored tiles cover the floor in a grid pattern. Scorch marks and shattered bones suggest some tiles are deadly. A faded inscription reads: "Only the path of the serpent is safe."',
            choices: [
              { id: 'perception', text: 'Study the safe path (Perception DC 14)', rollRequired: { type: 'd20', skill: 'perception' } },
              { id: 'acrobatics', text: 'Leap across carefully (Acrobatics DC 13)', rollRequired: { type: 'd20', skill: 'acrobatics' } },
              { id: 'nature', text: 'Look for a serpentine pattern in the tiles (Nature DC 12)', rollRequired: { type: 'd20', skill: 'nature' } },
              { id: 'trigger', text: 'Trigger tiles deliberately from afar', rollRequired: null }
            ]
          },
          {
            description: 'A spectral figure paces in a sealed chamber, unable to rest. It gestures at a crumbled journal on the floor. The spirit seems bound here by an unfinished task.',
            choices: [
              { id: 'insight', text: 'Communicate with the restless spirit (Insight DC 13)', rollRequired: { type: 'd20', skill: 'insight' } },
              { id: 'history', text: 'Read the journal for context (History DC 12)', rollRequired: { type: 'd20', skill: 'history' } },
              { id: 'religion', text: 'Attempt to lay the spirit to rest (Religion DC 15)', rollRequired: { type: 'd20', skill: 'religion' } },
              { id: 'leave', text: 'Back away slowly and find another route', rollRequired: null }
            ]
          },
          {
            description: 'A maze of crystalline walls shifts and rearranges every few moments. Light refracts through the formations, creating disorienting illusions. The exit seems to move each time you look away.',
            choices: [
              { id: 'perception', text: 'Track the pattern of shifts (Perception DC 15)', rollRequired: { type: 'd20', skill: 'perception' } },
              { id: 'arcana', text: 'Sense the magic driving the maze (Arcana DC 14)', rollRequired: { type: 'd20', skill: 'arcana' } },
              { id: 'survival', text: 'Mark your path and navigate by feel (Survival DC 13)', rollRequired: { type: 'd20', skill: 'survival' } },
              { id: 'force', text: 'Shatter a crystal wall to force a path (Strength DC 16)', rollRequired: { type: 'd20', skill: 'strength' } }
            ]
          },
          {
            description: 'A large stone door bears a mechanical combination lock with three rotating rings, each engraved with alchemical symbols. Nearby, an old workbench holds scattered notes and reagent bottles.',
            choices: [
              { id: 'investigate', text: 'Study the notes for the combination (Investigation DC 13)', rollRequired: { type: 'd20', skill: 'investigation' } },
              { id: 'arcana', text: 'Identify the alchemical symbols (Arcana DC 14)', rollRequired: { type: 'd20', skill: 'arcana' } },
              { id: 'thieves', text: 'Feel for the tumblers and pick the lock (Sleight of Hand DC 15)', rollRequired: { type: 'd20', skill: 'sleight_of_hand' } },
              { id: 'force', text: 'Attempt to pry the door open (Strength DC 17)', rollRequired: { type: 'd20', skill: 'strength' } }
            ]
          },
          {
            description: 'You enter a room where gravity seems wrong — furniture hangs from the ceiling, and a staircase leads downward into the sky. A compass rose on the floor points in impossible directions.',
            choices: [
              { id: 'arcana', text: 'Analyze the spatial distortion (Arcana DC 15)', rollRequired: { type: 'd20', skill: 'arcana' } },
              { id: 'acrobatics', text: 'Carefully navigate the inverted space (Acrobatics DC 14)', rollRequired: { type: 'd20', skill: 'acrobatics' } },
              { id: 'perception', text: 'Look for the real exit among the illusions (Perception DC 13)', rollRequired: { type: 'd20', skill: 'perception' } },
              { id: 'wait', text: 'Sit down and wait for the effect to end', rollRequired: null }
            ]
          },
          {
            description: 'A narrow bridge spans a chasm, but the bridge is made of interlocking stone blocks that retract one at a time. A countdown mechanism ticks on the wall — you have limited time to cross or find the lever to stop it.',
            choices: [
              { id: 'athletics', text: 'Sprint across before the blocks retract (Athletics DC 14)', rollRequired: { type: 'd20', skill: 'athletics' } },
              { id: 'investigate', text: 'Find and disable the countdown mechanism (Investigation DC 15)', rollRequired: { type: 'd20', skill: 'investigation' } },
              { id: 'acrobatics', text: 'Jump between remaining blocks (Acrobatics DC 13)', rollRequired: { type: 'd20', skill: 'acrobatics' } },
              { id: 'rope', text: 'Use rope to swing across the chasm', rollRequired: null }
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
      
      // Social encounter chance - increased for more NPC interactions and verbal gameplay
      if (!encounterTriggered && Math.random() < 0.20) {
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
          },
          {
            description: 'A captured cultist cowers in the corner, clearly terrified. They know something about what lies ahead.',
            choices: [
              { id: 'interrogate', text: '"Tell me everything you know." (Intimidation DC 13)', rollRequired: { type: 'd20', skill: 'intimidation' } },
              { id: 'sympathize', text: '"I can help you if you help me." (Persuasion DC 12)', rollRequired: { type: 'd20', skill: 'persuasion' } },
              { id: 'insight_check', text: 'Study their body language for lies (Insight DC 14)', rollRequired: { type: 'd20', skill: 'insight' } },
              { id: 'leave_them', text: 'Leave them alone', rollRequired: null }
            ]
          },
          {
            description: 'Two rival factions have representatives here, each trying to recruit you to their cause.',
            choices: [
              { id: 'negotiate', text: 'Try to broker a truce between them (Persuasion DC 15)', rollRequired: { type: 'd20', skill: 'persuasion' } },
              { id: 'play_both', text: 'Pretend to support both sides (Deception DC 14)', rollRequired: { type: 'd20', skill: 'deception' } },
              { id: 'insight_motives', text: 'Determine which side is more trustworthy (Insight DC 13)', rollRequired: { type: 'd20', skill: 'insight' } },
              { id: 'refuse_both', text: 'Refuse to get involved', rollRequired: null }
            ]
          },
          {
            description: 'A dying messenger clutches a sealed letter. With their last breath, they whisper about a conspiracy.',
            choices: [
              { id: 'comfort', text: 'Comfort them and ask questions (Medicine DC 12)', rollRequired: { type: 'd20', skill: 'medicine' } },
              { id: 'read_letter', text: 'Read the sealed letter carefully (Investigation DC 11)', rollRequired: { type: 'd20', skill: 'investigation' } },
              { id: 'search', text: 'Search them for more clues (Investigation DC 13)', rollRequired: { type: 'd20', skill: 'investigation' } },
              { id: 'respect', text: 'Respect their final moments and move on', rollRequired: null }
            ]
          },
          {
            description: 'A powerful being appears and offers you a bargain: information you seek in exchange for a favor later.',
            choices: [
              { id: 'accept', text: 'Accept the bargain - knowledge is power', rollRequired: null },
              { id: 'negotiate_terms', text: 'Try to negotiate better terms (Persuasion DC 16)', rollRequired: { type: 'd20', skill: 'persuasion' } },
              { id: 'detect_trap', text: 'Sense if this is a trap (Insight DC 15)', rollRequired: { type: 'd20', skill: 'insight' } },
              { id: 'refuse_deal', text: 'Refuse - such bargains always have a price', rollRequired: null }
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
      
      // Exploration/Discovery encounter chance - increased from 12% to 25% for more discoveries
      if (!encounterTriggered && Math.random() < 0.25) {
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
      
      // Track combat encounters for cooldown system
      const isCombatEncounter = encounterTriggered && encounterData?.type === 'combat';
      const newMovesSinceLastCombat = isCombatEncounter ? 0 : (movesSinceLastCombat + 1);
      
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
        movesSinceLastCombat: newMovesSinceLastCombat,
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
            // Match reward to specific choice types for more meaningful outcomes
            const choiceType = choiceId;
            let reward;
            if (choiceType === 'interrogate' || choiceType === 'intimidate') {
              reward = { narrative: "Fear loosens their tongue. They reveal crucial information about what lies ahead - secret passages, hidden dangers, and enemy weaknesses.", reward: { xp: 40 }, intel: 'Enemy weaknesses and secret passages revealed' };
            } else if (choiceType === 'sympathize' || choiceType === 'persuade') {
              reward = { narrative: "Your kindness earns their trust. They share not just information, but a token of gratitude - a healing potion from their pack.", reward: { items: ['Potion of Healing'], xp: 30 } };
            } else if (choiceType === 'negotiate' || choiceType === 'diplomacy') {
              reward = { narrative: "Your diplomatic skills forge an unlikely alliance. Both parties agree to a truce, and offer you a reward for your mediation.", reward: { gold: 35, xp: 45 } };
            } else if (choiceType === 'play_both' || choiceType === 'deception') {
              reward = { narrative: "Your silver tongue weaves a convincing tale. Each side believes you're their ally, giving you advantages with both factions.", reward: { xp: 40 }, consequence: 'Gained favor with both factions (for now)' };
            } else if (choiceType === 'insight' || choiceType === 'insight_check' || choiceType === 'insight_motives' || choiceType === 'detect_trap') {
              reward = { narrative: "Your keen perception reveals their true intentions. You now know what they really want, giving you a crucial advantage.", reward: { xp: 35 }, intel: 'Hidden motives revealed' };
            } else if (choiceType === 'comfort' || choiceType === 'read_letter') {
              reward = { narrative: "Their final words reveal a conspiracy of great importance. This knowledge could change everything.", reward: { xp: 45 }, intel: 'A dangerous conspiracy revealed' };
            } else if (choiceType === 'negotiate_terms') {
              reward = { narrative: "Against all odds, you bargain with this powerful being and secure better terms. Your cleverness impresses even them.", reward: { xp: 50 } };
            } else {
              const socialRewards = [
                { narrative: "The traveler shares valuable information about the dangers ahead and gives you a healing potion for your kindness.", reward: { items: ['Potion of Healing'], xp: 30 } },
                { narrative: "The merchant is impressed by your insight and offers you a discount on their finest wares.", reward: { gold: 20, xp: 25 } },
                { narrative: "You successfully mediate the dispute. The grateful adventurers share their map with you.", reward: { xp: 40 } },
                { narrative: "The sprite is delighted by your knowledge and grants you a minor blessing.", reward: { xp: 35 } },
                { narrative: "The conversation reveals hidden truths. You've gained valuable insight into the mysteries of this place.", reward: { xp: 35 } }
              ];
              reward = socialRewards[Math.floor(Math.random() * socialRewards.length)];
            }
            outcome.narrative = reward.narrative;
            outcome.rewards = reward.reward;
            if ((reward as any).intel) outcome.intel = (reward as any).intel;
            if ((reward as any).consequence) outcome.consequence = (reward as any).consequence;
          } else {
            // Specific failure messages based on approach
            if (choiceId === 'interrogate' || choiceId === 'intimidate') {
              outcome.narrative = "They clam up, refusing to speak. Your aggressive approach has closed this door - for now.";
            } else if (choiceId === 'negotiate' || choiceId === 'negotiate_terms') {
              outcome.narrative = "The negotiation falls apart. Neither side trusts your mediation, and the tension remains.";
            } else if (choiceId === 'play_both' || choiceId === 'deception') {
              outcome.narrative = "Your deception is seen through! They eye you with suspicion, but let you go... this time.";
            } else {
              outcome.narrative = "Your social approach doesn't quite work out, but no harm is done. The interaction ends awkwardly.";
            }
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
        } else if (encounter.type === 'riddle') {
          // Interactive riddle encounters - requires typed answer
          if (choiceId === 'answer_riddle') {
            const playerAnswer = (req.body.riddleAnswer || '').toLowerCase().trim();
            const correctAnswer = encounter.answer?.toLowerCase();
            const alternateAnswers = (encounter.alternateAnswers || []).map((a: string) => a.toLowerCase());
            
            const isCorrect = playerAnswer === correctAnswer || alternateAnswers.includes(playerAnswer);
            
            if (isCorrect) {
              outcome.narrative = encounter.successNarrative || "You solved the riddle!";
              outcome.success = true;
              outcome.rewards = encounter.reward;
            } else {
              const attempts = (encounter.attempts || 0) + 1;
              if (attempts >= 3) {
                outcome.narrative = "After three attempts, the guardian shakes its head sadly. 'Perhaps another time, traveler.' The riddle fades, but you may encounter it again in your journey.";
                outcome.success = false;
              } else {
                outcome.narrative = encounter.failureNarrative || "That is not correct. Think carefully...";
                outcome.success = false;
                outcome.canRetry = true;
                encounter.attempts = attempts;
              }
            }
          } else if (choiceId === 'request_hint') {
            outcome.narrative = encounter.hint || "No hint is available.";
            outcome.success = false;
            outcome.canRetry = true;
            encounter.hintGiven = true;
          } else if (choiceId === 'skip_riddle') {
            outcome.narrative = "You leave the riddle unsolved and continue on your way. Perhaps you will encounter it again.";
            outcome.success = false;
          }
        } else if (encounter.type === 'dialogue') {
          // Branching dialogue encounters
          const selectedBranch = encounter.branches?.find((b: any) => b.id === choiceId);
          if (selectedBranch) {
            outcome.narrative = `${selectedBranch.response}`;
            outcome.success = true;
            outcome.rewards = selectedBranch.reward;
            outcome.consequence = selectedBranch.consequence;
            outcome.followUp = selectedBranch.followUp;
            outcome.npcName = encounter.npcName;
            
            // Add quest hooks from dialogue
            if (selectedBranch.followUp?.questHook) {
              outcome.questHook = selectedBranch.followUp.questHook;
            }
            // Add intel from dialogue
            if (selectedBranch.followUp?.intel) {
              outcome.intel = selectedBranch.followUp.intel;
            }
          } else {
            outcome.narrative = "The conversation reaches a natural end.";
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
      if (encounterType === 'puzzle' || encounterType === 'riddle') {
        // Puzzles and riddles are tracked together
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
      } else if (['social', 'exploration', 'dialogue'].includes(encounterType)) {
        // Social, dialogue, and exploration encounters count as discoveries
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
        movesSinceLastCombat: isCombatEncounter ? 0 : storyState.movesSinceLastCombat, // Reset combat cooldown after combat
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
  
  // ==================== Procedural Exploration Routes ====================
  
  // Get exploration state and hexes for a campaign
  app.get("/api/campaigns/:campaignId/exploration", async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      
      const [state, hexes] = await Promise.all([
        storage.getExplorationState(campaignId),
        storage.getExplorationHexes(campaignId)
      ]);
      
      res.json({
        state: state || { currentHexQ: 0, currentHexR: 0, exploredHexCount: 0 },
        hexes
      });
    } catch (error) {
      console.error("Error fetching exploration data:", error);
      res.status(500).json({ message: "Failed to fetch exploration data" });
    }
  });
  
  // Initialize exploration for a campaign (creates origin hex from current narrative)
  app.post("/api/campaigns/:campaignId/exploration/initialize", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Check if exploration already exists
      const existingState = await storage.getExplorationState(campaignId);
      if (existingState) {
        const hexes = await storage.getExplorationHexes(campaignId);
        return res.json({ state: existingState, hexes, alreadyInitialized: true });
      }
      
      // Get current session for narrative context
      const currentSessionNum = campaign.currentSession || 1;
      const session = await storage.getCampaignSession(campaignId, currentSessionNum);
      const narrative = session?.narrative || "You stand at the beginning of your adventure.";
      
      // Detect adventure setting for context-aware terrain generation
      // Priority: current narrative > chapter description > campaign title
      const adventureSetting = detectAdventureSetting(
        campaign.title || '', 
        campaign.description || '',
        narrative,  // Pass current narrative for immediate context
        campaign.currentChapter ? `Chapter ${campaign.currentChapter}` : undefined
      );
      
      // Parse narrative for location context
      const parsed = parseNarrativeForLocations(narrative, adventureSetting);
      const hexMeta = generateHexMetaFromKeywords(
        parsed.currentLocation.environmentKeywords,
        parsed.atmosphereKeywords
      );
      
      const REGION_SCALE = 8;
      let startQ = 0;
      let startR = 0;
      
      try {
        const allRegions = await storage.getWorldRegions();
        if (allRegions && allRegions.length > 0) {
          let targetRegion;
          if (campaign.worldRegionId) {
            targetRegion = allRegions.find(r => r.id === campaign.worldRegionId);
          }
          if (!targetRegion) {
            targetRegion = allRegions[Math.floor(Math.random() * allRegions.length)];
          }
          const minQ = (targetRegion.gridX - 1) * REGION_SCALE;
          const maxQ = (targetRegion.gridX - 1 + targetRegion.width) * REGION_SCALE - 1;
          const minR = (targetRegion.gridY - 1) * REGION_SCALE;
          const maxR = (targetRegion.gridY - 1 + targetRegion.height) * REGION_SCALE - 1;
          startQ = Math.floor(Math.random() * (maxQ - minQ + 1)) + minQ;
          startR = Math.floor(Math.random() * (maxR - minR + 1)) + minR;
          console.log(`Exploration initialized in region "${targetRegion.name}" at hex (${startQ}, ${startR})`);
        }
      } catch (regionErr) {
        console.warn("Could not determine starting region, using center fallback:", regionErr);
        startQ = Math.floor(Math.random() * 40) + 24;
        startR = Math.floor(Math.random() * 32) + 16;
      }
      
      const originHex = await storage.createExplorationHex({
        campaignId,
        q: startQ,
        r: startR,
        terrainType: parsed.terrainType,
        locationName: parsed.currentLocation.name,
        locationDescription: parsed.currentLocation.description,
        hexMeta,
        isExplored: true,
        isRevealed: true,
        exploredAt: new Date().toISOString(),
        revealedAt: new Date().toISOString(),
        narrativeContext: narrative.slice(0, 500),
        connectedDirections: []
      });
      
      const state = await storage.createExplorationState({
        campaignId,
        currentHexQ: startQ,
        currentHexR: startR,
        exploredHexCount: 1,
        totalDistance: 0
      });
      
      // Reveal adjacent hexes based on narrative hints
      const revealedHexes = [originHex];
      for (const hint of parsed.adjacentHints) {
        if (hint.distance === "adjacent" || hint.distance === "nearby") {
          const coords = getAdjacentHexCoordinates(startQ, startR, hint.direction);
          const hintHexMeta = generateHexMetaFromKeywords(hint.environmentKeywords, []);
          
          const adjacentHex = await storage.createExplorationHex({
            campaignId,
            q: coords.q,
            r: coords.r,
            terrainType: hint.environmentKeywords[0] ? hint.environmentKeywords[0] : "Unknown",
            locationName: hint.description.slice(0, 50),
            locationDescription: hint.description,
            hexMeta: hintHexMeta,
            isExplored: false,
            isRevealed: true,
            revealedAt: new Date().toISOString(),
            narrativeContext: hint.description,
            connectedDirections: []
          });
          revealedHexes.push(adjacentHex);
        }
      }
      
      res.status(201).json({
        state,
        hexes: revealedHexes,
        parsed: {
          currentLocation: parsed.currentLocation.name,
          adjacentHints: parsed.adjacentHints.length
        }
      });
    } catch (error) {
      console.error("Error initializing exploration:", error);
      res.status(500).json({ message: "Failed to initialize exploration" });
    }
  });
  
  // Move to an adjacent hex (triggers AI narrative for unexplored hexes)
  app.post("/api/campaigns/:campaignId/exploration/move", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const { targetQ, targetR } = req.body;
      
      const state = await storage.getExplorationState(campaignId);
      if (!state) {
        return res.status(400).json({ message: "Exploration not initialized" });
      }
      
      // Verify target is adjacent to current position
      const adjacent = getAllAdjacentCoordinates(state.currentHexQ || 0, state.currentHexR || 0);
      const isAdjacent = adjacent.some(a => a.q === targetQ && a.r === targetR);
      if (!isAdjacent && !(targetQ === state.currentHexQ && targetR === state.currentHexR)) {
        return res.status(400).json({ message: "Target hex is not adjacent" });
      }
      
      // Get or create target hex
      let targetHex = await storage.getExplorationHex(campaignId, targetQ, targetR);
      const wasExplored = targetHex?.isExplored || false;
      
      if (!targetHex) {
        // Create a new unexplored hex (will be populated when story advances)
        targetHex = await storage.createExplorationHex({
          campaignId,
          q: targetQ,
          r: targetR,
          terrainType: "Unknown",
          isExplored: false,
          isRevealed: true,
          revealedAt: new Date().toISOString(),
          connectedDirections: []
        });
      }
      
      // Mark as explored if not already
      if (!targetHex.isExplored) {
        targetHex = await storage.updateExplorationHex(targetHex.id, {
          isExplored: true,
          exploredAt: new Date().toISOString()
        }) || targetHex;
      }
      
      // Update exploration state
      await storage.updateExplorationState(campaignId, {
        currentHexQ: targetQ,
        currentHexR: targetR,
        exploredHexCount: (state.exploredHexCount || 0) + (wasExplored ? 0 : 1),
        totalDistance: (state.totalDistance || 0) + 1,
        lastMovementAt: new Date().toISOString()
      });
      
      // If this is a newly explored hex, we need to trigger AI scene generation
      // Return flag indicating if narrative generation is needed
      res.json({
        success: true,
        targetHex,
        needsNarrative: !wasExplored,
        newPosition: { q: targetQ, r: targetR }
      });
    } catch (error) {
      console.error("Error moving on exploration map:", error);
      res.status(500).json({ message: "Failed to move" });
    }
  });
  
  // Update hex after narrative is generated (called by story advance)
  app.patch("/api/campaigns/:campaignId/exploration/hex/:q/:r", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const q = parseInt(req.params.q);
      const r = parseInt(req.params.r);
      const updates = req.body;
      
      const hex = await storage.getExplorationHex(campaignId, q, r);
      if (!hex) {
        return res.status(404).json({ message: "Hex not found" });
      }
      
      const updatedHex = await storage.updateExplorationHex(hex.id, updates);
      res.json(updatedHex);
    } catch (error) {
      console.error("Error updating hex:", error);
      res.status(500).json({ message: "Failed to update hex" });
    }
  });
  
  // Import hexes from DM Map Builder
  app.post("/api/campaigns/:campaignId/exploration/import-hexes", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const { hexes } = req.body;
      
      if (!Array.isArray(hexes)) {
        return res.status(400).json({ message: "hexes must be an array" });
      }
      
      // Clear existing hexes and state for this campaign
      const existingHexes = await storage.getExplorationHexes(campaignId);
      for (const hex of existingHexes) {
        await storage.deleteExplorationHex(hex.id);
      }
      
      // Create new hexes
      const createdHexes = [];
      for (const hex of hexes) {
        const newHex = await storage.createExplorationHex({
          campaignId,
          q: hex.q,
          r: hex.r,
          terrainType: hex.terrainType || "Unknown",
          isExplored: hex.isExplored ?? true,
          isRevealed: hex.isRevealed ?? true,
          revealedAt: new Date().toISOString(),
          connectedDirections: hex.connectedDirections || []
        });
        createdHexes.push(newHex);
      }
      
      // Initialize or update exploration state using first hex's coordinates
      const firstHexQ = createdHexes.length > 0 ? createdHexes[0].q : 0;
      const firstHexR = createdHexes.length > 0 ? createdHexes[0].r : 0;
      let state = await storage.getExplorationState(campaignId);
      if (state) {
        await storage.updateExplorationState(campaignId, {
          currentHexQ: firstHexQ,
          currentHexR: firstHexR,
          exploredHexCount: createdHexes.length,
          totalDistance: 0
        });
      } else {
        await storage.createExplorationState({
          campaignId,
          currentHexQ: firstHexQ,
          currentHexR: firstHexR,
          exploredHexCount: createdHexes.length,
          totalDistance: 0
        });
      }
      
      res.json({ success: true, hexCount: createdHexes.length });
    } catch (error) {
      console.error("Error importing hexes:", error);
      res.status(500).json({ message: "Failed to import hexes" });
    }
  });
  
  // === City Map System ===
  // Enter a location (city/town) - generates city map layout + location quests
  app.post("/api/campaigns/:campaignId/enter-location/:locationId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const campaignId = parseInt(req.params.campaignId);
      const locationId = parseInt(req.params.locationId);
      
      const location = await storage.getWorldLocation(locationId);
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      
      let cityMap = await storage.getCityMap(campaignId, locationId);
      if (cityMap) {
        return res.json({ cityMap, isNew: false });
      }
      
      const locType = location.locationType || "landmark";
      const seed = campaignId * 1000 + locationId;
      const layout = locType === "capital" 
        ? generateCapitalCityLayout(location.name, seed) 
        : generateCityLayout(location.name, locType, seed);
      
      cityMap = await storage.createCityMap({
        campaignId,
        worldLocationId: locationId,
        locationName: location.name,
        seed,
        layout,
        discoveredBuildings: [],
      });
      
      // Generate location-based quests if this is a settlement
      if (["city", "town", "village", "capital"].includes(locType)) {
        await generateLocationQuests(campaignId, location, layout);
      }
      
      res.json({ cityMap, isNew: true });
    } catch (error) {
      console.error("Error entering location:", error);
      res.status(500).json({ message: "Failed to enter location" });
    }
  });
  
  // Get city map for a location
  app.get("/api/campaigns/:campaignId/city-map/:locationId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const campaignId = parseInt(req.params.campaignId);
      const locationId = parseInt(req.params.locationId);
      
      const cityMap = await storage.getCityMap(campaignId, locationId);
      if (!cityMap) {
        return res.status(404).json({ message: "City map not found. Enter the location first." });
      }
      res.json(cityMap);
    } catch (error) {
      console.error("Error fetching city map:", error);
      res.status(500).json({ message: "Failed to fetch city map" });
    }
  });
  
  // Discover a building within a city
  app.post("/api/campaigns/:campaignId/city-map/:locationId/discover", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const campaignId = parseInt(req.params.campaignId);
      const locationId = parseInt(req.params.locationId);
      const { buildingId } = req.body;
      
      const cityMap = await storage.getCityMap(campaignId, locationId);
      if (!cityMap) {
        return res.status(404).json({ message: "City map not found" });
      }
      
      const discovered = (cityMap.discoveredBuildings as string[]) || [];
      if (!discovered.includes(buildingId)) {
        discovered.push(buildingId);
        await storage.updateCityMap(cityMap.id, { discoveredBuildings: discovered });
      }
      
      res.json({ success: true, discoveredBuildings: discovered });
    } catch (error) {
      console.error("Error discovering building:", error);
      res.status(500).json({ message: "Failed to discover building" });
    }
  });
  
  // === Capital Exploration System ===

  function getOffsetHexNeighbors(q: number, r: number): Array<{ q: number; r: number }> {
    const isOddRow = r % 2 === 1;
    if (isOddRow) {
      return [
        { q: q + 1, r }, { q: q, r: r - 1 }, { q: q + 1, r: r - 1 },
        { q: q, r: r + 1 }, { q: q + 1, r: r + 1 }, { q: q - 1, r },
      ];
    }
    return [
      { q: q + 1, r }, { q: q - 1, r: r - 1 }, { q: q, r: r - 1 },
      { q: q - 1, r: r + 1 }, { q: q, r: r + 1 }, { q: q - 1, r },
    ];
  }

  function serverHexDistance(q1: number, r1: number, q2: number, r2: number): number {
    const dx = Math.abs(q2 - q1);
    const dy = Math.abs(r2 - r1);
    return Math.max(dx, dy, Math.abs(dx - dy));
  }

  function generateServerCapitalBuildings(seed: number): Array<{ id: string; q: number; r: number; type: string; name: string }> {
    const rng = (() => {
      let s = seed;
      return () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };
    })();
    const districtCenters = [
      { q: 15, r: 6 }, { q: 8, r: 12 }, { q: 22, r: 10 }, { q: 5, r: 20 },
      { q: 24, r: 22 }, { q: 15, r: 15 }, { q: 22, r: 17 }, { q: 10, r: 24 },
    ];
    const districtBuildings: Record<number, Array<{ type: string; name: string }>> = {
      0: [{ type: "palace", name: "The Royal Palace" }, { type: "barracks", name: "Royal Guard Barracks" }, { type: "tailor", name: "Royal Clothier" }],
      1: [{ type: "general_store", name: "Grand Bazaar" }, { type: "jeweler", name: "Sparkle & Stone" }, { type: "auction", name: "The Auction House" }],
      2: [{ type: "temple", name: "Grand Cathedral" }, { type: "apothecary", name: "Temple Apothecary" }],
      3: [{ type: "tavern", name: "The Rusty Dagger" }, { type: "underworld", name: "Shadow Market" }, { type: "information_broker", name: "The Whisperer" }],
      4: [{ type: "general_store", name: "Harbor Supplies" }, { type: "tavern", name: "The Salty Anchor" }],
      5: [{ type: "blacksmith", name: "Master Forge" }, { type: "guild", name: "Artisan's Guild" }],
      6: [{ type: "library", name: "The Great Library" }, { type: "academy", name: "Scholar's Academy" }, { type: "magic_shop", name: "Arcane Emporium" }],
      7: [{ type: "dark_temple", name: "Forgotten Shrine" }, { type: "dungeon_entrance", name: "Old City Catacombs" }],
    };
    const buildings: Array<{ id: string; q: number; r: number; type: string; name: string }> = [];
    for (let di = 0; di < districtCenters.length; di++) {
      const center = districtCenters[di];
      const bldgs = districtBuildings[di] || [];
      for (let bi = 0; bi < bldgs.length; bi++) {
        const angle = (bi / bldgs.length) * Math.PI * 2;
        const dist = 2 + Math.floor(rng() * 2);
        const bq = Math.round(center.q + Math.cos(angle) * dist);
        const br = Math.round(center.r + Math.sin(angle) * dist);
        buildings.push({ id: `bldg-${di}-${bi}`, q: Math.max(1, Math.min(28, bq)), r: Math.max(1, Math.min(28, br)), type: bldgs[bi].type, name: bldgs[bi].name });
      }
    }
    return buildings;
  }

  async function validateCampaignAccess(campaignId: number, userId: number): Promise<boolean> {
    const campaign = await storage.getCampaign(campaignId);
    if (!campaign) return false;
    if (campaign.createdBy === userId) return true;
    const participants = await storage.getCampaignParticipants(campaignId);
    return participants.some((p: any) => p.userId === userId);
  }

  app.get("/api/campaigns/:campaignId/capital/:locationId/exploration", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      const campaignId = parseInt(req.params.campaignId);
      const locationId = parseInt(req.params.locationId);
      const userId = (req.user as any).id;

      if (!(await validateCampaignAccess(campaignId, userId))) {
        return res.status(403).json({ message: "Not a member of this campaign" });
      }

      const exploration = await storage.getCapitalExploration(campaignId, userId, locationId);
      if (!exploration) {
        return res.json(null);
      }
      res.json(exploration);
    } catch (error) {
      console.error("Error fetching capital exploration:", error);
      res.status(500).json({ message: "Failed to fetch capital exploration" });
    }
  });

  app.post("/api/campaigns/:campaignId/capital/:locationId/enter", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      const campaignId = parseInt(req.params.campaignId);
      const locationId = parseInt(req.params.locationId);
      const userId = (req.user as any).id;

      if (!(await validateCampaignAccess(campaignId, userId))) {
        return res.status(403).json({ message: "Not a member of this campaign" });
      }

      let exploration = await storage.getCapitalExploration(campaignId, userId, locationId);
      if (exploration) {
        return res.json({ exploration, isNew: false });
      }

      const explorationSeed = campaignId * 1000 + locationId;
      const serverBuildings = generateServerCapitalBuildings(explorationSeed);
      const spawnQ = 15;
      const spawnR = 2;

      const initialRevealed: Array<{q: number; r: number}> = [];
      for (let dr = -3; dr <= 3; dr++) {
        for (let dq = -3; dq <= 3; dq++) {
          const tq = spawnQ + dq;
          const tr = spawnR + dr;
          if (tq >= 0 && tq < 30 && tr >= 0 && tr < 30 && serverHexDistance(spawnQ, spawnR, tq, tr) <= 2) {
            initialRevealed.push({ q: tq, r: tr });
          }
        }
      }

      const hexLayoutData = { seed: explorationSeed, spawnQ, spawnR, buildings: serverBuildings } as any;

      exploration = await storage.createCapitalExploration({
        campaignId,
        userId,
        worldLocationId: locationId,
        currentQ: spawnQ,
        currentR: spawnR,
        revealedHexes: initialRevealed,
        discoveredBuildings: [],
        hexLayout: hexLayoutData,
      });

      const location = await storage.getWorldLocation(locationId);
      if (location) {
        const layout = generateCapitalCityLayout(location.name, explorationSeed);
        await generateLocationQuests(campaignId, location, layout);
      }

      res.json({ exploration, isNew: true });
    } catch (error) {
      console.error("Error entering capital:", error);
      res.status(500).json({ message: "Failed to enter capital" });
    }
  });

  app.post("/api/campaigns/:campaignId/capital/:locationId/move", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      const campaignId = parseInt(req.params.campaignId);
      const locationId = parseInt(req.params.locationId);
      const userId = (req.user as any).id;
      const { targetQ, targetR } = req.body;

      if (targetQ === undefined || targetR === undefined) {
        return res.status(400).json({ message: "Target coordinates required" });
      }

      if (!(await validateCampaignAccess(campaignId, userId))) {
        return res.status(403).json({ message: "Not a member of this campaign" });
      }

      const exploration = await storage.getCapitalExploration(campaignId, userId, locationId);
      if (!exploration) {
        return res.status(404).json({ message: "Capital exploration not initialized. Enter the capital first." });
      }

      const neighbors = getOffsetHexNeighbors(exploration.currentQ, exploration.currentR);
      const isNeighbor = neighbors.some(n => n.q === targetQ && n.r === targetR);
      if (!isNeighbor) {
        return res.status(400).json({ message: "Can only move to adjacent hexes" });
      }

      if (targetQ < 0 || targetQ >= 30 || targetR < 0 || targetR >= 30) {
        return res.status(400).json({ message: "Target out of bounds" });
      }

      const revealed = (exploration.revealedHexes as Array<{q: number; r: number}>) || [];
      const newRevealed = [...revealed];
      const revealedSet = new Set(revealed.map((h: any) => `${h.q},${h.r}`));

      for (let rr = -2; rr <= 2; rr++) {
        for (let qq = -2; qq <= 2; qq++) {
          const dist = Math.max(Math.abs(qq), Math.abs(rr), Math.abs(qq - rr));
          if (dist <= 2) {
            const nq = targetQ + qq;
            const nr = targetR + rr;
            const key = `${nq},${nr}`;
            if (!revealedSet.has(key)) {
              newRevealed.push({ q: nq, r: nr });
              revealedSet.add(key);
            }
          }
        }
      }

      const hexLayout = exploration.hexLayout as any;
      const discoveredBuildings = [...((exploration.discoveredBuildings as string[]) || [])];
      const newlyDiscovered: string[] = [];

      if (hexLayout?.buildings) {
        for (const bldg of hexLayout.buildings) {
          if (!discoveredBuildings.includes(bldg.id)) {
            const bDist = Math.max(Math.abs(bldg.q - targetQ), Math.abs(bldg.r - targetR));
            if (bDist <= 1) {
              discoveredBuildings.push(bldg.id);
              newlyDiscovered.push(bldg.id);
            }
          }
        }
      }

      let questEncounter: any = null;
      const moveRoll = Math.random();
      if (moveRoll < 0.15 && newlyDiscovered.length === 0) {
        const encounterTypes = [
          { type: "street_event", desc: "A commotion breaks out in the street ahead. Guards rush past, shouting orders." },
          { type: "merchant", desc: "A traveling merchant flags you down, offering exotic wares from distant lands." },
          { type: "rumor", desc: "You overhear whispered secrets from hooded figures in an alcove." },
          { type: "pickpocket", desc: "Nimble fingers brush against your coin purse! A young thief darts through the crowd." },
          { type: "festival", desc: "A neighborhood celebration fills the street with music, dancers, and the smell of roasting meats." },
        ];
        questEncounter = encounterTypes[Math.floor(Math.random() * encounterTypes.length)];
      }

      const updated = await storage.updateCapitalExploration(exploration.id, {
        currentQ: targetQ,
        currentR: targetR,
        revealedHexes: newRevealed,
        discoveredBuildings,
      });

      res.json({
        exploration: updated,
        newlyDiscovered,
        questEncounter,
        discoveredBuildingDetails: newlyDiscovered.map(id => {
          const bldg = hexLayout?.buildings?.find((b: any) => b.id === id);
          return bldg ? { id: bldg.id, name: bldg.name, type: bldg.type, description: bldg.description } : null;
        }).filter(Boolean),
      });
    } catch (error) {
      console.error("Error moving in capital:", error);
      res.status(500).json({ message: "Failed to move in capital" });
    }
  });

  // === Trek System ===
  // Set a trek destination
  app.post("/api/campaigns/:campaignId/trek/start", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const campaignId = parseInt(req.params.campaignId);
      const userId = (req.user as any).id;
      const { destinationQ, destinationR, destinationName, characterId } = req.body;
      
      if (destinationQ === undefined || destinationR === undefined) {
        return res.status(400).json({ message: "Destination coordinates required" });
      }

      let validatedCharacterId: number | null = null;
      let validatedCharacterName: string | null = null;

      if (characterId) {
        const character = await storage.getCharacter(characterId);
        if (!character || character.userId !== userId) {
          return res.status(403).json({ message: "Character does not belong to you" });
        }
        const participant = await storage.getCampaignParticipant(campaignId, userId);
        if (!participant || participant.characterId !== characterId) {
          return res.status(403).json({ message: "Character is not part of this campaign" });
        }
        validatedCharacterId = character.id;
        validatedCharacterName = character.name;
      }
      
      // Cancel any existing active trek
      const existing = await storage.getActiveTrekRoute(campaignId, userId);
      if (existing) {
        await storage.cancelTrekRoute(existing.id);
      }
      
      // Get current position from exploration state
      const state = await storage.getExplorationState(campaignId);
      const startQ = state?.currentHexQ || 0;
      const startR = state?.currentHexR || 0;
      
      // Compute path using simple A*-like approach
      const path = computeTrekPath(startQ, startR, destinationQ, destinationR);
      
      const route = await storage.createTrekRoute({
        campaignId,
        userId,
        characterId: validatedCharacterId,
        characterName: validatedCharacterName,
        originQ: startQ,
        originR: startR,
        destinationQ,
        destinationR,
        destinationName: destinationName || null,
        path,
        currentStep: 0,
        status: "active",
        lootFound: [],
      });
      
      res.json({ route, pathLength: path.length });
    } catch (error) {
      console.error("Error starting trek:", error);
      res.status(500).json({ message: "Failed to start trek" });
    }
  });
  
  // Get active trek route
  app.get("/api/campaigns/:campaignId/trek/active", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const campaignId = parseInt(req.params.campaignId);
      const userId = (req.user as any).id;
      
      const route = await storage.getActiveTrekRoute(campaignId, userId);
      res.json(route || null);
    } catch (error) {
      console.error("Error fetching trek:", error);
      res.status(500).json({ message: "Failed to fetch trek" });
    }
  });
  
  // Advance trek by one step (move to next hex in path)
  app.post("/api/campaigns/:campaignId/trek/step", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const campaignId = parseInt(req.params.campaignId);
      const userId = (req.user as any).id;
      
      const route = await storage.getActiveTrekRoute(campaignId, userId);
      if (!route) {
        return res.status(404).json({ message: "No active trek" });
      }

      if (route.status === "encounter") {
        return res.status(400).json({ message: "Resolve or dismiss the current encounter before continuing your trek." });
      }
      
      const path = route.path as Array<{ q: number; r: number }>;
      const nextStep = (route.currentStep || 0) + 1;
      
      if (nextStep >= path.length) {
        await storage.updateTrekRoute(route.id, { status: "completed", currentStep: nextStep });
        
        // Auto-return to origin position
        const originQ = (route as any).originQ ?? 0;
        const originR = (route as any).originR ?? 0;
        const state2 = await storage.getExplorationState(campaignId);
        if (state2) {
          await storage.updateExplorationState(campaignId, {
            currentHexQ: originQ,
            currentHexR: originR,
            lastMovementAt: new Date().toISOString(),
          });
        }
        
        const lootFound = (route as any).lootFound || [];
        return res.json({ success: true, completed: true, position: { q: originQ, r: originR }, returnedToOrigin: true, lootFound });
      }
      
      const nextHex = path[nextStep];
      
      // Use exploration move logic
      const state = await storage.getExplorationState(campaignId);
      if (state) {
        let targetHex = await storage.getExplorationHex(campaignId, nextHex.q, nextHex.r);
        const wasExplored = targetHex?.isExplored || false;
        
        if (!targetHex) {
          targetHex = await storage.createExplorationHex({
            campaignId,
            q: nextHex.q,
            r: nextHex.r,
            terrainType: "Unknown",
            isExplored: false,
            isRevealed: true,
            revealedAt: new Date().toISOString(),
            connectedDirections: [],
          });
        }
        
        if (!targetHex.isExplored) {
          targetHex = await storage.updateExplorationHex(targetHex.id, {
            isExplored: true,
            exploredAt: new Date().toISOString(),
          }) || targetHex;
        }
        
        await storage.updateExplorationState(campaignId, {
          currentHexQ: nextHex.q,
          currentHexR: nextHex.r,
          exploredHexCount: (state.exploredHexCount || 0) + (wasExplored ? 0 : 1),
          totalDistance: (state.totalDistance || 0) + 1,
          lastMovementAt: new Date().toISOString(),
        });
      }
      
      await storage.updateTrekRoute(route.id, { currentStep: nextStep });
      
      // Random encounter chance (25% per step)
      const encounterRoll = Math.random();
      let encounter = null;
      if (encounterRoll < 0.25) {
        const encounterTemplates = [
          {
            type: "ambush",
            descriptions: [
              "Bandits emerge from the brush, weapons drawn, blocking your path!",
              "A snarling pack of wolves surrounds your party from the treeline.",
              "Goblin raiders leap from behind rocks, cackling with malice!",
              "Dark shapes materialize from the shadows — an ambush!",
            ],
            hook: "Your party must fight or find a way to escape.",
            sceneType: "combat",
            narrativeCategory: "combat",
          },
          {
            type: "traveler",
            descriptions: [
              "A weathered merchant with a laden cart flags you down, seeking company on the road.",
              "A wounded knight stumbles toward you, clutching a sealed letter and begging for aid.",
              "A mysterious hooded figure stands at a crossroads, offering cryptic advice.",
              "A traveling bard shares tales of treasure hidden in nearby ruins.",
            ],
            hook: "An opportunity for conversation, trade, or a new quest awaits.",
            sceneType: "social",
            narrativeCategory: "quest",
          },
          {
            type: "discovery",
            descriptions: [
              "You stumble upon ancient ruins half-buried beneath vines and moss.",
              "A glowing spring bubbles up from the earth, radiating faint magical energy.",
              "Carved stones mark the entrance to a forgotten shrine.",
              "An old campsite reveals a tattered journal with a hand-drawn map.",
            ],
            hook: "Something significant lies here — explore further to uncover its secrets.",
            sceneType: "exploration",
            narrativeCategory: "discovery",
          },
          {
            type: "weather",
            descriptions: [
              "A sudden, violent storm forces your party to seek shelter immediately.",
              "A thick, unnatural fog rolls in, distorting sound and direction.",
              "The sky darkens as an arcane tempest crackles with wild magic overhead.",
              "Freezing winds and driving sleet threaten to sap your party's strength.",
            ],
            hook: "Survive the elements and decide whether to press on or wait it out.",
            sceneType: "exploration",
            narrativeCategory: "discovery",
          },
          {
            type: "wildlife",
            descriptions: [
              "A massive owlbear crashes through the underbrush, guarding its territory.",
              "A wounded dire wolf limps across your path — it could be dangerous, or in need of help.",
              "Giant spiders drop silently from the canopy above, webs glistening.",
              "A majestic griffon circles overhead and lands before you, regarding your party with keen eyes.",
            ],
            hook: "A creature encounter — fight, tame, or carefully retreat.",
            sceneType: "combat",
            narrativeCategory: "combat",
          },
          {
            type: "loot_find",
            descriptions: [
              "Sunlight catches something glinting beneath a fallen log — a leather pouch tucked away by a previous traveler.",
              "You discover the remains of a merchant's wagon, its contents scattered but some valuables intact.",
              "A hidden cache is revealed behind loose stones in a rocky outcrop — someone's emergency stash.",
              "Among the wildflowers, you spot a skeletal hand clutching a small chest. Whatever befell the owner, their belongings remain.",
              "A hollow tree reveals a bundle wrapped in oilcloth — weapons and supplies left behind long ago.",
            ],
            hook: "You've found something valuable! Examine the loot and add it to your inventory.",
            sceneType: "exploration",
            narrativeCategory: "discovery",
          },
        ];
        const template = encounterTemplates[Math.floor(Math.random() * encounterTemplates.length)];
        const description = template.descriptions[Math.floor(Math.random() * template.descriptions.length)];
        const encounterId = `trek-enc-${campaignId}-${nextStep}-${Date.now()}`;
        encounter = {
          id: encounterId,
          type: template.type,
          description,
          hook: template.hook,
          sceneType: template.sceneType,
          narrativeCategory: template.narrativeCategory,
          step: nextStep,
          hexQ: nextHex.q,
          hexR: nextHex.r,
          destinationName: route.destinationName || "Unknown",
          loot: null as any,
        };

        // Generate loot for loot_find encounters
        if (template.type === "loot_find") {
          const lootTables = {
            weapons: [
              { name: "Sturdy Shortsword", type: "weapon", rarity: "common", value: 10, damageDice: "1d6", damageType: "slashing" },
              { name: "Hunting Bow", type: "weapon", rarity: "common", value: 25, damageDice: "1d8", damageType: "piercing" },
              { name: "Dagger of the Road", type: "weapon", rarity: "uncommon", value: 50, damageDice: "1d4+1", damageType: "piercing", specialEffect: "Glows faintly when hostile creatures are within 60 feet" },
              { name: "Traveler's Mace", type: "weapon", rarity: "common", value: 15, damageDice: "1d6", damageType: "bludgeoning" },
            ],
            potions: [
              { name: "Potion of Healing", type: "consumable", rarity: "common", value: 50, specialEffect: "Restores 2d4+2 hit points" },
              { name: "Potion of Climbing", type: "consumable", rarity: "common", value: 25, specialEffect: "Gain climbing speed equal to walking speed for 1 hour" },
              { name: "Antitoxin", type: "consumable", rarity: "common", value: 25, specialEffect: "Advantage on saves vs poison for 1 hour" },
              { name: "Potion of Greater Healing", type: "consumable", rarity: "uncommon", value: 100, specialEffect: "Restores 4d4+4 hit points" },
            ],
            gear: [
              { name: "Explorer's Pack", type: "wondrous", rarity: "common", value: 10, specialEffect: "Contains rope, torches, rations, and a bedroll" },
              { name: "Cloak of Comfort", type: "wondrous", rarity: "common", value: 30, specialEffect: "Keeps the wearer warm and dry in harsh weather" },
              { name: "Ring of Whispers", type: "accessory", rarity: "uncommon", value: 75, specialEffect: "Allows the wearer to send a 25-word message telepathically once per day" },
              { name: "Amulet of the Wayfinder", type: "accessory", rarity: "uncommon", value: 80, specialEffect: "Points toward the nearest settlement when held aloft" },
            ],
          };
          const categories = Object.keys(lootTables) as Array<keyof typeof lootTables>;
          const cat = categories[Math.floor(Math.random() * categories.length)];
          const item = lootTables[cat][Math.floor(Math.random() * lootTables[cat].length)];
          const goldDrop = Math.floor(Math.random() * 30) + 5;
          encounter.loot = { item, goldDrop };

          // Accumulate loot found during trek
          const existingLoot = (route as any).lootFound || [];
          await storage.updateTrekRoute(route.id, {
            lootFound: [...existingLoot, { item, goldDrop, step: nextStep }],
          });
        }

        await storage.updateTrekRoute(route.id, {
          status: "encounter",
          pendingEncounter: encounter,
        });
      }
      
      res.json({
        success: true,
        completed: false,
        position: nextHex,
        currentStep: nextStep,
        totalSteps: path.length,
        encounter,
        needsNarrative: true,
      });
    } catch (error) {
      console.error("Error stepping trek:", error);
      res.status(500).json({ message: "Failed to advance trek" });
    }
  });
  
  // Enter narrative from a trek encounter - generates AI scene
  app.post("/api/campaigns/:campaignId/trek/enter-narrative", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const campaignId = parseInt(req.params.campaignId);
      const userId = (req.user as any).id;
      const { encounter } = req.body;

      if (!encounter || !encounter.type || !encounter.description) {
        return res.status(400).json({ message: "Encounter data is required" });
      }

      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      const route = await storage.getActiveTrekRoute(campaignId, userId);
      if (!route || route.status !== "encounter") {
        return res.status(400).json({ message: "No active encounter to enter" });
      }

      let trekCharacter: any = null;
      if (route.characterId) {
        trekCharacter = await storage.getCharacter(route.characterId);
      }
      const characterSummary = trekCharacter
        ? `${trekCharacter.name} (Level ${trekCharacter.level || 1} ${trekCharacter.race || ''} ${trekCharacter.class || ''})`
        : "An unnamed adventurer";

      const encounterPrompt = `You are an expert D&D 5th Edition Dungeon Master. Generate a vivid, immersive narrative scene for a trek encounter.

Campaign: "${campaign.title}"
${campaign.description ? `Campaign Description: ${campaign.description}` : ''}
Character: ${characterSummary}
Encounter Type: ${encounter.type}
Encounter Description: ${encounter.description}
Location: Hex (${encounter.hexQ}, ${encounter.hexR}), traveling toward ${encounter.destinationName || "an unknown destination"}
Scene Type: ${encounter.sceneType || "exploration"}

Generate an engaging D&D narrative scene. Return valid JSON with this exact structure:
{
  "narrative": "A 2-3 paragraph vivid narrative description of the scene, written in second person ('You see...'). Set the atmosphere, describe the environment, and present the situation.",
  "title": "A dramatic short title for this encounter (3-6 words)",
  "choices": [
    {"id": "choice_1", "text": "First choice the character can make", "type": "action"},
    {"id": "choice_2", "text": "Second choice", "type": "action"},
    {"id": "choice_3", "text": "Third choice (if combat: option to fight)", "type": "action"},
    {"id": "choice_4", "text": "A creative or unexpected option", "type": "action"}
  ],
  "sceneType": "${encounter.sceneType || 'exploration'}",
  "combatReady": ${encounter.narrativeCategory === 'combat' ? 'true' : 'false'},
  "npcs": [{"name": "NPC Name", "role": "Brief role description"}],
  "possibleRewards": ["Possible reward 1", "Possible reward 2"],
  "difficultyHint": "Easy/Medium/Hard/Deadly"
}

Make choices varied and interesting. For combat encounters, include both fighting and non-combat resolution options. For social encounters, include persuasion, deception, and investigation options. For discoveries, include exploration, study, and interaction options. Always include at least one creative or unexpected option.`;

      const { client, model } = await getAIClient(userId);

      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: "You are a creative D&D Dungeon Master. Generate immersive encounter narratives. Always respond with valid JSON." },
          { role: "user", content: encounterPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
        max_tokens: 2000,
      });

      let sceneData: any;
      try {
        sceneData = JSON.parse(completion.choices[0].message.content || "{}");
      } catch {
        sceneData = {
          narrative: encounter.description + "\n\nYou must decide what to do next.",
          title: `${encounter.type.charAt(0).toUpperCase() + encounter.type.slice(1)} on the Road`,
          choices: [
            { id: "investigate", text: "Investigate carefully", type: "action" },
            { id: "engage", text: "Engage directly", type: "action" },
            { id: "avoid", text: "Try to avoid or go around", type: "action" },
            { id: "observe", text: "Observe from a safe distance", type: "action" },
          ],
          sceneType: encounter.sceneType || "exploration",
          combatReady: encounter.narrativeCategory === "combat",
          npcs: [],
          possibleRewards: [],
          difficultyHint: "Medium",
        };
      }

      await storage.updateTrekRoute(route.id, {
        status: "narrative",
        pendingEncounter: {
          ...(route.pendingEncounter as any || {}),
          sceneData,
          enteredNarrative: true,
        },
      });

      res.json({
        success: true,
        scene: sceneData,
        characterName: trekCharacter?.name || route.characterName,
      });
    } catch (error) {
      console.error("Error entering trek narrative:", error);
      res.status(500).json({ message: "Failed to generate encounter narrative" });
    }
  });

  app.post("/api/campaigns/:campaignId/trek/resolve-encounter", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const campaignId = parseInt(req.params.campaignId);
      const userId = (req.user as any).id;
      const { choiceId, choiceText } = req.body;

      if (!choiceId) {
        return res.status(400).json({ message: "Choice is required" });
      }

      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      const route = await storage.getActiveTrekRoute(campaignId, userId);
      if (!route || route.status !== "narrative") {
        return res.status(400).json({ message: "No active narrative encounter to resolve" });
      }

      const pendingEncounter = route.pendingEncounter as any;
      const sceneData = pendingEncounter?.sceneData;
      if (!sceneData) {
        return res.status(400).json({ message: "No scene data found for this encounter" });
      }

      let trekCharacter: any = null;
      if (route.characterId) {
        trekCharacter = await storage.getCharacter(route.characterId);
      }
      const charName = trekCharacter?.name || route.characterName || "The adventurer";
      const charLevel = trekCharacter?.level || 1;

      const resolvePrompt = `You are an expert D&D 5th Edition Dungeon Master resolving a trek encounter.

Character: ${charName} (Level ${charLevel} ${trekCharacter?.race || ''} ${trekCharacter?.class || ''})
Scene: ${sceneData.title}
Narrative: ${sceneData.narrative}
Player chose: "${choiceText}"
Encounter type: ${pendingEncounter.type || 'exploration'}
Difficulty: ${sceneData.difficultyHint || 'Medium'}

Resolve this encounter based on the player's choice. Return valid JSON:
{
  "conclusion": "A 1-2 paragraph vivid conclusion describing what happens based on the choice. Written in second person.",
  "outcome": "success" or "partial" or "failure",
  "xpAwarded": number (10-100 based on difficulty and outcome),
  "goldAwarded": number (0-50 based on encounter type),
  "lootItems": [{"name": "Item Name", "type": "weapon/armor/potion/gear/misc", "rarity": "common/uncommon/rare", "value": number, "description": "Brief description"}],
  "injuries": "none" or brief description if injured
}

Award loot that makes sense for the encounter. Combat encounters should award more XP. Discovery/loot encounters should award items. Social encounters may award gold or useful items. Scale rewards to the difficulty.`;

      const { client, model } = await getAIClient(userId);

      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: "You are a creative D&D Dungeon Master resolving encounters. Always respond with valid JSON." },
          { role: "user", content: resolvePrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 1500,
      });

      let resolution: any;
      try {
        resolution = JSON.parse(completion.choices[0].message.content || "{}");
      } catch {
        resolution = {
          conclusion: `${charName} chose wisely. The encounter passes without further incident, though the experience proves valuable.`,
          outcome: "success",
          xpAwarded: 25,
          goldAwarded: 5,
          lootItems: [],
          injuries: "none",
        };
      }

      if (trekCharacter) {
        const currentXp = trekCharacter.experiencePoints || 0;
        const currentGold = trekCharacter.gold || 0;
        const currentEquipment = trekCharacter.equipment || [];

        const newItems = (resolution.lootItems || []).map((item: any) => 
          typeof item === 'string' ? item : `${item.name}${item.description ? ` (${item.description})` : ''}`
        );

        await storage.updateCharacter(trekCharacter.id, {
          experiencePoints: currentXp + (resolution.xpAwarded || 0),
          gold: currentGold + (resolution.goldAwarded || 0),
          equipment: [...currentEquipment, ...newItems],
          updatedAt: new Date().toISOString(),
        });
      }

      const existingLoot = (route.lootFound as any[]) || [];
      const newLootEntries = (resolution.lootItems || []).map((item: any) => ({
        name: typeof item === 'string' ? item : item.name,
        type: typeof item === 'string' ? 'misc' : item.type,
        rarity: typeof item === 'string' ? 'common' : item.rarity,
        value: typeof item === 'string' ? 0 : (item.value || 0),
        fromEncounter: sceneData.title,
      }));

      await storage.updateTrekRoute(route.id, {
        status: "active",
        pendingEncounter: null,
        lootFound: [...existingLoot, ...newLootEntries],
      });

      res.json({
        success: true,
        resolution: {
          conclusion: resolution.conclusion,
          outcome: resolution.outcome,
          xpAwarded: resolution.xpAwarded || 0,
          goldAwarded: resolution.goldAwarded || 0,
          lootItems: resolution.lootItems || [],
          injuries: resolution.injuries || "none",
        },
        characterName: charName,
      });
    } catch (error) {
      console.error("Error resolving trek encounter:", error);
      res.status(500).json({ message: "Failed to resolve encounter" });
    }
  });

  // Dismiss trek encounter without entering narrative - resume trek
  app.post("/api/campaigns/:campaignId/trek/dismiss-encounter", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const campaignId = parseInt(req.params.campaignId);
      const userId = (req.user as any).id;

      const route = await storage.getActiveTrekRoute(campaignId, userId);
      if (!route) {
        return res.status(404).json({ message: "No active trek" });
      }
      if (route.status === "encounter") {
        await storage.updateTrekRoute(route.id, { status: "active", pendingEncounter: null });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error dismissing encounter:", error);
      res.status(500).json({ message: "Failed to dismiss encounter" });
    }
  });

  // Cancel active trek — auto-returns party to origin
  app.post("/api/campaigns/:campaignId/trek/cancel", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const campaignId = parseInt(req.params.campaignId);
      const userId = (req.user as any).id;
      
      const route = await storage.getActiveTrekRoute(campaignId, userId);
      if (route) {
        await storage.cancelTrekRoute(route.id);
        
        // Auto-return to origin position
        const originQ = (route as any).originQ ?? 0;
        const originR = (route as any).originR ?? 0;
        const state = await storage.getExplorationState(campaignId);
        if (state) {
          await storage.updateExplorationState(campaignId, {
            currentHexQ: originQ,
            currentHexR: originR,
            lastMovementAt: new Date().toISOString(),
          });
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error cancelling trek:", error);
      res.status(500).json({ message: "Failed to cancel trek" });
    }
  });
  
  // ======== Capital City Bank Endpoints ========
  
  app.get("/api/campaigns/:campaignId/bank", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Not authenticated" });
      const campaignId = parseInt(req.params.campaignId);
      const userId = (req.user as any).id;
      const characters = await storage.getCharactersByCampaign(campaignId);
      const myChar = characters.find((c: any) => c.userId === userId);
      if (!myChar) return res.status(404).json({ message: "No character in this campaign" });
      
      const account = await storage.getPlayerBank(myChar.id, campaignId);
      if (!account) {
        return res.json({ account: null, balance: 0, transactions: [] });
      }
      
      // Calculate interest (1% per day, max once per day)
      let balance = account.balance;
      const now = new Date();
      if (account.lastInterestAt) {
        const lastInterest = new Date(account.lastInterestAt);
        const daysSince = Math.floor((now.getTime() - lastInterest.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince >= 1 && balance > 0) {
          const interest = Math.floor(balance * 0.01 * daysSince);
          if (interest > 0) {
            const txns = (account.transactions as any[]) || [];
            txns.push({ type: "interest", amount: interest, date: now.toISOString(), note: `${daysSince} day(s) interest` });
            balance += interest;
            await storage.updatePlayerBank(account.id, {
              balance,
              lastInterestAt: now.toISOString(),
              transactions: txns,
            });
          }
        }
      }
      
      res.json({ account: { ...account, balance }, balance, transactions: (account.transactions as any[]) || [] });
    } catch (error) {
      console.error("Error fetching bank:", error);
      res.status(500).json({ message: "Failed to fetch bank account" });
    }
  });

  app.post("/api/campaigns/:campaignId/bank/deposit", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Not authenticated" });
      const campaignId = parseInt(req.params.campaignId);
      const userId = (req.user as any).id;
      const { amount } = req.body;
      if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid amount" });
      
      const characters = await storage.getCharactersByCampaign(campaignId);
      const myChar = characters.find((c: any) => c.userId === userId);
      if (!myChar) return res.status(404).json({ message: "No character in this campaign" });
      
      const charGold = (myChar as any).gold || 0;
      if (charGold < amount) return res.status(400).json({ message: "Not enough gold" });
      
      let account = await storage.getPlayerBank(myChar.id, campaignId);
      if (!account) {
        account = await storage.createPlayerBank({
          characterId: myChar.id,
          campaignId,
          balance: 0,
          lastInterestAt: new Date().toISOString(),
          transactions: [],
          createdAt: new Date().toISOString(),
        });
      }
      
      const txns = (account.transactions as any[]) || [];
      txns.push({ type: "deposit", amount, date: new Date().toISOString() });
      
      await storage.updatePlayerBank(account.id, {
        balance: account.balance + amount,
        transactions: txns,
        lastInterestAt: account.lastInterestAt || new Date().toISOString(),
      });
      
      // Deduct gold from character
      await storage.updateCharacter(myChar.id, { gold: charGold - amount } as any);
      
      res.json({ success: true, newBalance: account.balance + amount, characterGold: charGold - amount });
    } catch (error) {
      console.error("Error depositing:", error);
      res.status(500).json({ message: "Failed to deposit" });
    }
  });

  app.post("/api/campaigns/:campaignId/bank/withdraw", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Not authenticated" });
      const campaignId = parseInt(req.params.campaignId);
      const userId = (req.user as any).id;
      const { amount } = req.body;
      if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid amount" });
      
      const characters = await storage.getCharactersByCampaign(campaignId);
      const myChar = characters.find((c: any) => c.userId === userId);
      if (!myChar) return res.status(404).json({ message: "No character in this campaign" });
      
      const account = await storage.getPlayerBank(myChar.id, campaignId);
      if (!account || account.balance < amount) {
        return res.status(400).json({ message: "Insufficient bank balance" });
      }
      
      const txns = (account.transactions as any[]) || [];
      txns.push({ type: "withdrawal", amount, date: new Date().toISOString() });
      
      await storage.updatePlayerBank(account.id, {
        balance: account.balance - amount,
        transactions: txns,
      });
      
      const charGold = (myChar as any).gold || 0;
      await storage.updateCharacter(myChar.id, { gold: charGold + amount } as any);
      
      res.json({ success: true, newBalance: account.balance - amount, characterGold: charGold + amount });
    } catch (error) {
      console.error("Error withdrawing:", error);
      res.status(500).json({ message: "Failed to withdraw" });
    }
  });

  // ======== Capital City Housing Endpoints ========
  
  const HOUSE_CATALOG = [
    { type: "modest", name: "Modest Apartment", price: 200, district: "Old City", desc: "A small but functional apartment in the Old City. Two rooms and a hearth." },
    { type: "comfortable", name: "Comfortable Townhouse", price: 500, district: "Artisan Heights", desc: "A well-appointed townhouse with a workshop space and small garden." },
    { type: "wealthy", name: "Wealthy Residence", price: 1500, district: "Grand Market", desc: "An elegant home with multiple rooms, servants' quarters, and a private courtyard." },
    { type: "noble", name: "Noble Estate", price: 5000, district: "Royal Quarter", desc: "A prestigious estate befitting minor nobility. Includes a ballroom and wine cellar." },
    { type: "manor", name: "Grand Manor", price: 15000, district: "Royal Quarter", desc: "A sprawling manor with extensive grounds, a personal library, and enchanted defenses." },
  ];
  
  app.get("/api/campaigns/:campaignId/housing", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Not authenticated" });
      const campaignId = parseInt(req.params.campaignId);
      const userId = (req.user as any).id;
      const characters = await storage.getCharactersByCampaign(campaignId);
      const myChar = characters.find((c: any) => c.userId === userId);
      if (!myChar) return res.status(404).json({ message: "No character in this campaign" });
      
      const house = await storage.getPlayerHouse(myChar.id, campaignId);
      res.json({ house: house || null, catalog: HOUSE_CATALOG });
    } catch (error) {
      console.error("Error fetching housing:", error);
      res.status(500).json({ message: "Failed to fetch housing" });
    }
  });

  app.post("/api/campaigns/:campaignId/housing/buy", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Not authenticated" });
      const campaignId = parseInt(req.params.campaignId);
      const userId = (req.user as any).id;
      const { houseType } = req.body;
      
      const listing = HOUSE_CATALOG.find(h => h.type === houseType);
      if (!listing) return res.status(400).json({ message: "Invalid house type" });
      
      const characters = await storage.getCharactersByCampaign(campaignId);
      const myChar = characters.find((c: any) => c.userId === userId);
      if (!myChar) return res.status(404).json({ message: "No character in this campaign" });
      
      const existing = await storage.getPlayerHouse(myChar.id, campaignId);
      if (existing) return res.status(400).json({ message: "You already own a house. Sell it first to buy a new one." });
      
      const charGold = (myChar as any).gold || 0;
      if (charGold < listing.price) return res.status(400).json({ message: `Not enough gold. Need ${listing.price}gp.` });
      
      await storage.updateCharacter(myChar.id, { gold: charGold - listing.price } as any);
      
      const house = await storage.createPlayerHouse({
        characterId: myChar.id,
        campaignId,
        houseName: listing.name,
        houseType: listing.type,
        district: listing.district,
        purchasePrice: listing.price,
        furnishings: [],
        storedItems: [],
        upgrades: [],
        purchasedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      
      res.json({ success: true, house, remainingGold: charGold - listing.price });
    } catch (error) {
      console.error("Error buying house:", error);
      res.status(500).json({ message: "Failed to buy house" });
    }
  });

  app.post("/api/campaigns/:campaignId/housing/sell", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Not authenticated" });
      const campaignId = parseInt(req.params.campaignId);
      const userId = (req.user as any).id;
      
      const characters = await storage.getCharactersByCampaign(campaignId);
      const myChar = characters.find((c: any) => c.userId === userId);
      if (!myChar) return res.status(404).json({ message: "No character in this campaign" });
      
      const house = await storage.getPlayerHouse(myChar.id, campaignId);
      if (!house) return res.status(400).json({ message: "You don't own a house" });
      
      const sellPrice = Math.floor(house.purchasePrice * 0.6);
      const charGold = (myChar as any).gold || 0;
      await storage.updateCharacter(myChar.id, { gold: charGold + sellPrice } as any);
      
      // Delete the house (update to mark sold - or we just delete the record)
      await storage.updatePlayerHouse(house.id, { houseName: "__SOLD__" } as any);
      
      res.json({ success: true, goldReceived: sellPrice, newGold: charGold + sellPrice });
    } catch (error) {
      console.error("Error selling house:", error);
      res.status(500).json({ message: "Failed to sell house" });
    }
  });

  app.post("/api/campaigns/:campaignId/housing/store-item", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Not authenticated" });
      const campaignId = parseInt(req.params.campaignId);
      const userId = (req.user as any).id;
      const { item } = req.body;
      if (!item) return res.status(400).json({ message: "Item required" });
      
      const characters = await storage.getCharactersByCampaign(campaignId);
      const myChar = characters.find((c: any) => c.userId === userId);
      if (!myChar) return res.status(404).json({ message: "No character" });
      
      const house = await storage.getPlayerHouse(myChar.id, campaignId);
      if (!house || house.houseName === "__SOLD__") return res.status(400).json({ message: "You need a house to store items" });
      
      const stored = (house.storedItems as any[]) || [];
      stored.push({ ...item, storedAt: new Date().toISOString() });
      
      await storage.updatePlayerHouse(house.id, { storedItems: stored });
      res.json({ success: true, storedItems: stored });
    } catch (error) {
      console.error("Error storing item:", error);
      res.status(500).json({ message: "Failed to store item" });
    }
  });

  // World hex info lookup (returns deterministic hex data from world generator)
  app.get("/api/world/hex-info", async (req, res) => {
    try {
      const q = parseInt(req.query.q as string);
      const r = parseInt(req.query.r as string);
      
      if (isNaN(q) || isNaN(r)) {
        return res.status(400).json({ message: "q and r coordinates required" });
      }
      
      // Fetch all regions and locations for the world hex generator context
      const regions = await storage.getAllWorldRegions();
      const locations = await storage.getAllWorldLocations();
      
      // Find which region this hex belongs to, and if it has a location
      const region = regions.find(reg => {
        const gx = reg.gridX || 0;
        const gy = reg.gridY || 0;
        const w = reg.width || 1;
        const h = reg.height || 1;
        const scale = 8;
        return q >= gx * scale && q < (gx + w) * scale && r >= gy * scale && r < (gy + h) * scale;
      });
      
      const location = locations.find(loc => {
        if (!region || loc.regionId !== region.id) return false;
        const gx = region.gridX || 0;
        const gy = region.gridY || 0;
        const w = region.width || 1;
        const h = region.height || 1;
        const scale = 8;
        const hexQ = Math.round(gx * scale + (loc.posX / 100) * w * scale);
        const hexR = Math.round(gy * scale + (loc.posY / 100) * h * scale);
        return Math.abs(hexQ - q) <= 1 && Math.abs(hexR - r) <= 1;
      });
      
      res.json({
        q, r,
        regionId: region?.id || null,
        regionName: region?.name || "Unknown",
        terrain: region?.terrain || "plains",
        locationId: location?.id || null,
        locationName: location?.name || null,
        locationType: location?.locationType || null,
      });
    } catch (error) {
      console.error("Error fetching hex info:", error);
      res.status(500).json({ message: "Failed to fetch hex info" });
    }
  });
  
  // AI Map Generation
  app.post("/api/campaigns/:campaignId/generate-map", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const { prompt } = req.body;
      
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ message: "prompt is required" });
      }
      
      // Use OpenAI to generate hex layout from description
      const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        return res.status(500).json({ message: "OpenAI API key not configured" });
      }
      
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are a hex map generator for a fantasy RPG. Generate hex coordinates with terrain types based on the user's description.

Output format: JSON array of hex objects with q, r coordinates (axial hex coordinates), terrainType, and terrainEmoji.

Terrain types: forest, grove, grass, meadow, clearing, swamp, mountain, hill, cliff, valley, cave, desert, snow, river, lake, waterfall, coast, bridge, path, road, crossroads, village, town, tavern, market, house, camp, castle, tower, wall, gate, ruins, temple, shrine, altar, dungeon, crypt, graveyard, battlefield, tunnel, corridor, chamber

Guidelines:
- Use q=0, r=0 as the center/starting point
- Create coherent geography (rivers flow downhill, forests cluster, paths connect locations)
- Respect adjacency - nearby hexes should have related terrain
- Generate 10-30 hexes depending on description complexity
- Include relevant emojis for each terrain type

Example output:
[
  {"q": 0, "r": 0, "terrainType": "clearing", "terrainEmoji": "☀️"},
  {"q": 1, "r": 0, "terrainType": "forest", "terrainEmoji": "🌲"},
  {"q": -1, "r": 0, "terrainType": "path", "terrainEmoji": "🛤️"}
]`
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: "json_object" }
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error("OpenAI API error:", error);
        return res.status(500).json({ message: "AI generation failed" });
      }
      
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        return res.status(500).json({ message: "No response from AI" });
      }
      
      let hexes;
      try {
        const parsed = JSON.parse(content);
        // Handle various AI response formats
        if (parsed.hexes && Array.isArray(parsed.hexes)) {
          hexes = parsed.hexes;
        } else if (parsed.map && Array.isArray(parsed.map)) {
          hexes = parsed.map;
        } else if (Array.isArray(parsed)) {
          hexes = parsed;
        } else {
          hexes = [parsed];
        }
        
        // Flatten if AI returned nested array with map property
        if (hexes.length > 0 && hexes[0].map && Array.isArray(hexes[0].map)) {
          hexes = hexes[0].map;
        }
        
        // Validate hex structure
        hexes = hexes.filter((h: any) => typeof h.q === 'number' && typeof h.r === 'number');
        
        console.log(`AI Map Generation: parsed ${hexes.length} valid hexes`);
      } catch (e) {
        console.error("Failed to parse AI response:", content);
        return res.status(500).json({ message: "Invalid AI response format" });
      }
      
      res.json({ hexes });
    } catch (error) {
      console.error("Error generating map:", error);
      res.status(500).json({ message: "Failed to generate map" });
    }
  });
  
  // ==================== Campaign Quest Routes ====================
  
  // Get all quests for a campaign
}
