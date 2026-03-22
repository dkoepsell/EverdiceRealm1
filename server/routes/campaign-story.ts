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
      
      // DM Authoring Doctrine: Auto-improvise doctrine fields for campaigns that lack them
      const improvised = await improviseDoctrine(campaign);
      if (improvised) {
        (campaign as any).campaignQuestion = improvised.campaignQuestion;
        (campaign as any).campaignStakes = improvised.campaignStakes;
        (campaign as any).chapterGates = improvised.chapterGates;
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
      
      // DM AUTHORING DOCTRINE: Build campaign spine context
      let campaignSpineContext = "";
      const campaignQuestion = (campaign as any).campaignQuestion;
      const campaignStakes = (campaign as any).campaignStakes as any[] || [];
      const chapterGates = (campaign as any).chapterGates as any[] || [];
      
      if (campaignQuestion) {
        campaignSpineContext += `\nCAMPAIGN QUESTION (every scene must advance this): ${campaignQuestion}\n`;
      }
      
      if (campaignStakes.length > 0) {
        campaignSpineContext += `\nCAMPAIGN STAKES (2-4 stakes, 0-5 range — EVERY choice must touch at least one):\n`;
        campaignSpineContext += `NOTE: Stakes have PASSIVE DRIFT — the world deteriorates each scene automatically. Player must ACTIVELY work to counter drift.\n`;
        campaignSpineContext += campaignStakes.map((s: any) => {
          let line = `- ${s.name} [${s.id}]: ${s.value}/${s.max} — ${s.description}`;
          if (s.passiveDrift && s.passiveDrift !== 0) {
            line += ` [DRIFTS ${s.passiveDrift > 0 ? '+' : ''}${s.passiveDrift}/scene: ${s.driftReason || 'world pressure'}]`;
          }
          if (s.value <= 1 && s.thresholdConsequence?.at0) {
            line += `\n  ⚠ CRITICAL LOW — if this reaches 0: ${s.thresholdConsequence.at0.event}${s.thresholdConsequence.at0.irreversible ? ' [IRREVERSIBLE]' : ''}`;
          } else if (s.value <= 1) {
            line += ` [CRITICAL LOW — consequences imminent]`;
          }
          if (s.value >= 4 && s.thresholdConsequence?.at5) {
            line += `\n  ⚠ HIGH — if this reaches ${s.max || 5}: ${s.thresholdConsequence.at5.event}${s.thresholdConsequence.at5.irreversible ? ' [IRREVERSIBLE]' : ''}`;
          } else if (s.value >= 4) {
            line += ` [HIGH — threshold approaching]`;
          }
          line += `\n  Worsens when: ${(s.worsensWhen || []).join(', ')}`;
          line += `\n  Improves when: ${(s.improvesWhen || []).join(', ')}`;
          return line;
        }).join("\n");
      }
      
      if (chapterGates.length > 0) {
        const currentChapterNum = (campaign as any).currentSession || 1;
        const currentGate = chapterGates.find((g: any) => g.chapter === currentChapterNum);
        if (currentGate) {
          campaignSpineContext += `\n\nCHAPTER ${currentChapterNum} GATE (what must happen before chapter advances):\n`;
          campaignSpineContext += `- Advance when: ${currentGate.advanceWhen}\n`;
          if (currentGate.requiredTruth) campaignSpineContext += `- Required truth to discover: "${currentGate.requiredTruth}"\n`;
          if (currentGate.requiredCommitment) campaignSpineContext += `- Required commitment: "${currentGate.requiredCommitment}"\n`;
          if (currentGate.requiredBeliefChange) campaignSpineContext += `- Required belief change: "${currentGate.requiredBeliefChange}"\n`;
        }
      }
      
      // CAML 2.0: Build OPERATIVE state context for reactive storytelling
      let stateContext = campaignSpineContext;
      let activeGates: string[] = [];
      let availableUnlocks: string[] = [];
      let criticalPressure: string[] = [];
      let blockedPaths: string[] = [];
      
      const worldState = campaign.worldState as any[] || [];
      const npcAttitudes = campaign.npcAttitudes as any[] || [];
      const pressureMeters = campaign.pressureMeters as any[] || [];
      const availablePaths = campaign.availablePaths as any[] || [];
      
      if (worldState.length > 0) {
        stateContext += "\n\nCURRENT WORLD STATE (facts that affect this scene):\n";
        stateContext += worldState.map((s: any) => `- ${s.key}: ${s.value} (${s.description})`).join("\n");
      }
      
      if (npcAttitudes.length > 0) {
        stateContext += "\n\nKEY NPCs AND ATTITUDES:\n";
        stateContext += npcAttitudes.map((npc: any) => {
          let npcLine = `- ${npc.name} (${npc.role}): attitude ${npc.attitude}/100, wants: ${npc.wants}`;
          // Track operative gates
          if (npc.blocksAccess && npc.attitude < 0) {
            npcLine += ` [ACTIVELY BLOCKING: ${npc.blocksAccess}]`;
            activeGates.push(`${npc.name} is blocking "${npc.blocksAccess}" due to hostile attitude (${npc.attitude})`);
          }
          if (npc.unlocksAccess && npc.attitude >= 50) {
            npcLine += ` [NOW UNLOCKED: ${npc.unlocksAccess}]`;
            availableUnlocks.push(`${npc.name} has unlocked "${npc.unlocksAccess}" due to friendly attitude (${npc.attitude})`);
          } else if (npc.unlocksAccess && npc.attitude < 50) {
            npcLine += ` [LOCKED until attitude >= 50: ${npc.unlocksAccess}]`;
          }
          return npcLine;
        }).join("\n");
      }
      
      if (pressureMeters.length > 0) {
        stateContext += "\n\nPRESSURE METERS (OPERATIVE - affect scene availability):\n";
        stateContext += pressureMeters.map((m: any) => {
          const percentFull = (m.current / m.max) * 100;
          let meterLine = `- ${m.name}: ${m.current}/${m.max}`;
          if (percentFull >= 80) {
            meterLine += ` [CRITICAL - consequence imminent: ${m.consequence}]`;
            criticalPressure.push(`${m.name} at ${m.current}/${m.max} - ${m.consequence}`);
          } else if (percentFull >= 50) {
            meterLine += ` [HIGH - scenes become harder, some options closing]`;
          }
          meterLine += ` (triggers: ${(m.triggers || []).join(', ')})`;
          return meterLine;
        }).join("\n");
      }
      
      if (availablePaths.length > 0) {
        stateContext += "\n\nAVAILABLE APPROACHES:\n";
        stateContext += availablePaths.map((p: any) => {
          const isBlocked = p.isBlocked || false;
          let pathLine = `- ${p.approach}: ${p.description}`;
          if (isBlocked) {
            pathLine = `- [BLOCKED] ${p.approach}: ${p.blockedReason || 'No longer available'}`;
            blockedPaths.push(p.approach);
          } else {
            pathLine += ` (requires: ${p.requirements})`;
          }
          return pathLine;
        }).join("\n");
      }
      
      // WORLD DETERIORATION: Build context for global stakes, broken NPCs, and foreclosures
      const globalStakes = campaign.globalStakes as any[] || [];
      const unreliableNPCs = campaign.unreliableNPCs as any[] || [];
      const foreclosures = campaign.foreclosures as any[] || [];
      
      let criticalStakes: string[] = [];
      let brokenNPCs: string[] = [];
      let sealedForeclosures: string[] = [];
      
      if (globalStakes.length > 0) {
        stateContext += "\n\nGLOBAL STAKES (world deterioration - advance every scene):\n";
        stateContext += globalStakes.map((s: any) => {
          const percentFull = (s.current / s.max) * 100;
          let stakeLine = `- ${s.name}: ${s.current}/${s.max}`;
          if (percentFull >= 80) {
            stakeLine += ` [CATASTROPHE IMMINENT: ${s.consequence}]`;
            criticalStakes.push(`${s.name} at ${s.current}/${s.max} - ${s.consequence}`);
          } else if (percentFull >= 50) {
            stakeLine += ` [DETERIORATING - world is changing]`;
          }
          stakeLine += ` (advances on: ${(s.advancesOn || []).join(', ')})`;
          if (s.milestones) {
            const nextMilestone = s.milestones.find((m: any) => m.threshold > s.current);
            if (nextMilestone) {
              stakeLine += ` [next at ${nextMilestone.threshold}: ${nextMilestone.effect}]`;
            }
          }
          return stakeLine;
        }).join("\n");
      }
      
      if (unreliableNPCs.length > 0) {
        stateContext += "\n\nNPC RELIABILITY STATUS:\n";
        stateContext += unreliableNPCs.map((npc: any) => {
          let npcLine = `- ${npc.name}: attitude ${npc.attitude}, trust threshold: ${npc.trustThreshold}`;
          if (npc.isBroken) {
            npcLine += ` [BROKEN - will ${npc.betrayalBehavior}]`;
            brokenNPCs.push(`${npc.name} is BROKEN and will ${npc.betrayalBehavior}`);
          } else if (npc.attitude < npc.trustThreshold) {
            npcLine += ` [UNRELIABLE - below trust threshold]`;
          }
          npcLine += ` (secret agenda: ${npc.secretAgenda})`;
          npcLine += ` (breaking points: ${npc.breakingPoints?.join(', ') || 'none'})`;
          return npcLine;
        }).join("\n");
      }
      
      if (foreclosures.length > 0) {
        stateContext += "\n\nFORECLOSURES (doors that seal permanently):\n";
        stateContext += foreclosures.map((f: any) => {
          if (f.isSealed) {
            sealedForeclosures.push(`${f.name}: ${f.consequence}`);
            return `- ${f.name}: [SEALED - PERMANENTLY LOST] ${f.sealedReason || f.consequence}`;
          } else {
            return `- ${f.name}: seals when ${f.sealedWhen} → ${f.consequence}`;
          }
        }).join("\n");
      }
      
      // NORMATIVE RESIDUE: Build context for lasting consequences
      const normativeResidues = campaign.normativeResidues as any[] || [];
      const residueTriggers = campaign.residueTriggers as any[] || [];
      const repairPathways = campaign.repairPathways as any[] || [];
      
      let activeResidueEffects: string[] = [];
      let unrecoverableResidues: string[] = [];
      
      if (normativeResidues.length > 0) {
        stateContext += "\n\nNORMATIVE RESIDUE (lasting consequences - some things cannot be fixed):\n";
        stateContext += normativeResidues.map((r: any) => {
          let residueLine = `- ${r.id} on ${r.bearer} (${r.domain}): severity ${r.severity}/${r.maxSeverity}`;
          
          // Check if at max severity (unrecoverable)
          if (r.severity >= r.maxSeverity) {
            residueLine += ` [UNRECOVERABLE]`;
            unrecoverableResidues.push(`${r.id}: ${r.description}`);
          } else if (r.severity > 0) {
            residueLine += ` [DAMAGED]`;
          }
          
          // Show active effects at current severity
          const activeEffects = (r.effects || []).filter((e: any) => e.atSeverity <= r.severity);
          for (const effect of activeEffects) {
            activeResidueEffects.push(`${r.bearer}: ${effect.description} (${effect.effectType} ${effect.target})`);
          }
          
          residueLine += ` - ${r.description}`;
          if (r.cannotBeRemovedBy && r.cannotBeRemovedBy.length > 0) {
            residueLine += ` [Cannot be fixed by: ${r.cannotBeRemovedBy.join(', ')}]`;
          }
          
          return residueLine;
        }).join("\n");
        
        // Show active triggers
        if (residueTriggers.length > 0) {
          stateContext += "\n\nRESIDUE TRIGGERS (what increases lasting damage):\n";
          stateContext += residueTriggers.map((t: any) => 
            `- ${t.id}: On ${t.condition} of ${t.causedBy} → ${t.producesResidueId} +${t.delta} (${t.reason})`
          ).join("\n");
        }
      }
      
      // CAML Campaign Architecture: Add faction and instability context
      const r1Instability = (campaign as any).campaignInstability;
      const r1FactionModels = (campaign as any).factionModels as any[] || [];
      const r1FactionStrengths = (campaign as any).factionStrengths as Record<string, number> || {};

      if (r1Instability) {
        stateContext += `\n\nCORE INSTABILITY (the engine driving ALL events):
"${r1Instability}"
This instability is ACTIVE — reference its effects. The world changes whether players act or not.\n`;
      }

      if (r1FactionModels.length > 0) {
        stateContext += `\n\nACTIVE FACTIONS (independent agents that act between scenes):`;
        for (const f of r1FactionModels) {
          const strength = r1FactionStrengths[f.id] ?? f.strength ?? 50;
          stateContext += `\n- ${f.name} [${f.id}] — Strength: ${strength}/100
  Goal: ${f.publicGoal} | Method: ${f.operationalMethod}
  Hidden Truth: ${f.hiddenTruth} | Vulnerability: ${f.vulnerability}`;
        }
        stateContext += `\nFACTION RULES: Report faction changes in "factionUpdates" array. Factions must act logically based on goals/strength.\n`;
      }

      // CAML2 Adventure Skeleton: Add villain, complications, encounters context (Route 1)
      const r1VillainModel = (campaign as any).villainModel as any;
      const r1FramingEvent = (campaign as any).framingEvent as any;
      const r1ComplicationsQueue = (campaign as any).complicationsQueue as any;
      const r1EncounterDesigns = (campaign as any).encounterDesigns as any[] || [];
      const r1PartyGoal = (campaign as any).partyGoal as any;
      const r1VillainCorruption = (campaign as any).villainCorruption || 0;
      const r1PartyReputation = (campaign as any).partyReputation || 50;
      const r1WorldInstability = (campaign as any).worldInstability || 20;

      if (r1VillainModel) {
        const completedSteps = (r1VillainModel.planStructure || []).slice(0, r1VillainModel.currentStep || 0);
        const nextStep = (r1VillainModel.planStructure || [])[r1VillainModel.currentStep || 0];
        stateContext += `\n\nVILLAIN: ${r1VillainModel.name} [${r1VillainModel.archetype}]
- Goal: ${r1VillainModel.goal} | Corruption: ${r1VillainCorruption}/10
${completedSteps.length > 0 ? `- Completed Steps: ${completedSteps.join('; ')}` : ''}
${nextStep ? `- CURRENT STEP: "${nextStep}"` : ''}
REACTIONS: escalate(${r1VillainModel.reactionTree?.escalate || 'raise stakes'}), redirect(${r1VillainModel.reactionTree?.redirect || 'change approach'}), retaliate(${r1VillainModel.reactionTree?.retaliate || 'strike back'}), accelerate(${r1VillainModel.reactionTree?.accelerate || 'speed up'})
Report villain changes in "villainUpdate". If player thwarts villain's current step, villain REACTS.\n`;
      }

      if (r1FramingEvent && !r1FramingEvent.isResolved) {
        stateContext += `\nFRAMING EVENT [${r1FramingEvent.type}]: ${r1FramingEvent.description}\n`;
      }

      if (r1PartyGoal) {
        stateContext += `\nPARTY GOAL: ${r1PartyGoal.primary}
On failure: ${r1PartyGoal.failureState} (failure advances world — does NOT end story)\n`;
      }

      stateContext += `\nTRACKING: Reputation ${r1PartyReputation}/100, Instability ${r1WorldInstability}/100, Corruption ${r1VillainCorruption}/10
Include "trackingUpdates" with reputationDelta, instabilityDelta, corruptionDelta.\n`;

      // Build operative summary
      let operativeSummary = "";
      if (activeGates.length > 0) {
        operativeSummary += "\n\n⚠️ ACTIVE BLOCKS (you MUST enforce these):\n" + activeGates.map(g => `- ${g}`).join("\n");
      }
      if (availableUnlocks.length > 0) {
        operativeSummary += "\n\n✓ UNLOCKED CONTENT (now available):\n" + availableUnlocks.map(u => `- ${u}`).join("\n");
      }
      if (criticalPressure.length > 0) {
        operativeSummary += "\n\n🔥 CRITICAL PRESSURE (consequence imminent):\n" + criticalPressure.map(c => `- ${c}`).join("\n");
      }
      if (blockedPaths.length > 0) {
        operativeSummary += "\n\n❌ BLOCKED PATHS (no longer available):\n" + blockedPaths.map(b => `- ${b}`).join("\n");
      }
      if (criticalStakes.length > 0) {
        operativeSummary += "\n\n💀 WORLD DETERIORATION (catastrophe imminent):\n" + criticalStakes.map(s => `- ${s}`).join("\n");
      }
      if (brokenNPCs.length > 0) {
        operativeSummary += "\n\n🔒 BROKEN NPCS (trust permanently lost):\n" + brokenNPCs.map(n => `- ${n}`).join("\n");
      }
      if (sealedForeclosures.length > 0) {
        operativeSummary += "\n\n⛔ PERMANENT LOSSES (sealed forever):\n" + sealedForeclosures.map(f => `- ${f}`).join("\n");
      }
      if (activeResidueEffects.length > 0) {
        operativeSummary += "\n\n💔 ACTIVE RESIDUE EFFECTS (these MUST constrain the narrative):\n" + activeResidueEffects.map(e => `- ${e}`).join("\n");
      }
      if (unrecoverableResidues.length > 0) {
        operativeSummary += "\n\n☠️ UNRECOVERABLE DAMAGE (cannot be fixed, period):\n" + unrecoverableResidues.map(r => `- ${r}`).join("\n");
      }
      
      stateContext += operativeSummary;

      // ============================================
      // SCENE HISTORY DIGEST — Anti-Repetition Memory
      // ============================================
      const allSessions = await storage.getCampaignSessions(campaign.id);
      const recentSessions = allSessions.slice(-8);
      let sceneHistoryDigest = "";
      if (recentSessions.length > 0) {
        const usedTitles = recentSessions.map(s => s.title).filter(Boolean);
        const usedLocations = recentSessions.map(s => s.location).filter(Boolean);
        const usedSceneTypes = recentSessions.map(s => (s as any).sceneType).filter(Boolean);

        const extractMotifs = (text: string): string[] => {
          const motifPatterns = /\b(runestone|altar|shrine|portal|crystal|artifact|tome|scroll|relic|idol|obelisk|monolith|totem|sigil|glyph|rune|amulet|pendant|orb|scepter|throne|fountain|well|mirror|gate|door|chest|vault|crypt|tomb|statue|pillar|tower|bridge|cave|tunnel|clearing|grove|camp|ruins|temple|library|forge|market|tavern|dock|harbor|lighthouse|watchtower|graveyard|battlefield|arena|colosseum|labyrinth|maze|garden|sanctuary|chamber|hall|corridor)\b/gi;
          const matches = text.match(motifPatterns) || [];
          return [...new Set(matches.map(m => m.toLowerCase()))];
        };

        const allNarrativeText = recentSessions.map(s => (s.narrative || "").substring(0, 500)).join(" ");
        const usedMotifs = extractMotifs(allNarrativeText).slice(0, 15);

        const recentNarrativeText = recentSessions.slice(-3).map(s => (s.narrative || "").substring(0, 500)).join(" ");
        const veryRecentMotifs = extractMotifs(recentNarrativeText).slice(0, 10);

        sceneHistoryDigest += `\n\n═══════════════════════════════════════════════════════════
SCENE HISTORY — ANTI-REPETITION MEMORY (MANDATORY):
═══════════════════════════════════════════════════════════

RECENT SCENE TITLES (DO NOT reuse or closely echo these):
${usedTitles.map(t => `- "${t}"`).join("\n")}

RECENTLY VISITED LOCATIONS (introduce NEW locations — do NOT return here without strong narrative reason):
${[...new Set(usedLocations)].map(l => `- ${l}`).join("\n")}

RECENT SCENE TYPES: ${usedSceneTypes.join(", ")}
→ Choose a DIFFERENT scene type from the most recent 2 scenes.

OVERUSED MOTIFS/OBJECTS (these have appeared in recent scenes — DO NOT USE THESE AGAIN):
${veryRecentMotifs.map(m => `- "${m}"`).join("\n")}

MOTIFS USED IN THIS CAMPAIGN ARC (use sparingly, at most once more if narratively essential):
${usedMotifs.map(m => `- "${m}"`).join("\n")}

CONTENT VARIETY RULES (STRICTLY ENFORCED):
1. EVERY scene MUST introduce at least ONE element the campaign has never seen:
   - A new NPC (name + personality + agenda)
   - A new location (not just a renamed version of a previous one)
   - A new type of challenge (if recent scenes had puzzles, try social intrigue or exploration)
   - A new narrative motif or object (if runestones were used, try something completely different: a merchant's ledger, a dying soldier's confession, a strange weather phenomenon, animal behavior, architectural clues, overheard conversations)
2. NEVER repeat the same environmental feature, puzzle element, or discovery type from the last 3 scenes
3. If the story involves a recurring theme (e.g., ancient magic), express it through DIFFERENT manifestations each time — different senses, different sources, different consequences
4. Scene titles MUST be distinct in tone and content from recent titles
5. Vary the PACING: if recent scenes were tense, allow a moment of quiet reflection or unexpected humor. If recent scenes were slow, introduce urgency or danger.
`;
      }

      // ============================================
      // CAML STORY SPINE — Narrative Compass
      // ============================================
      const totalChapters = (campaign as any).totalChapters || 5;
      const currentChapterNum = (campaign as any).currentSession || 1;
      const narrativeLog = (campaign as any).narrativeLog || [];
      const lastChapterGateEntry = [...narrativeLog].reverse().find((e: any) => e.type === 'chapter_gate');
      const lastGateMs = lastChapterGateEntry?.timestamp ? Date.parse(lastChapterGateEntry.timestamp) : NaN;
      const scenesInCurrentChapter = !isNaN(lastGateMs)
        ? allSessions.filter(s => s.createdAt && new Date(s.createdAt).getTime() > lastGateMs).length
        : allSessions.length;
      const currentGateForSpine = chapterGates.find((g: any) => g.chapter === currentChapterNum);
      const completedGates = chapterGates.filter((g: any) => g.chapter < currentChapterNum);

      let camlStorySpine = `\n\n═══════════════════════════════════════════════════════════
CAML STORY SPINE — YOUR NARRATIVE COMPASS (FOLLOW THIS):
═══════════════════════════════════════════════════════════

CAMPAIGN QUESTION (the thematic heart — every scene must relate to this):
"${(campaign as any).campaignQuestion || 'What choices define who we become?'}"
${(campaign as any).mainHook ? `\nCAMPAIGN MAIN HOOK (the central premise — weave this into every chapter):\n"${(campaign as any).mainHook}"\n` : ''}
OVERALL ARC: Chapter ${currentChapterNum} of ${totalChapters}
- Scenes played so far: ${allSessions.length}
- Scenes in current chapter: ${scenesInCurrentChapter}

SESSION CLOSURE BEATS (CRITICAL FOR PLAYER RETENTION):
- ONLY set "sessionBreakpoint": true at GENUINE NARRATIVE TRANSITIONS — moments where the story naturally pauses
- NEVER set sessionBreakpoint during active combat, mid-fight, tense action sequences, or unresolved cliffhangers
- NEVER set sessionBreakpoint more than once every 8+ scenes — the player's real-world session timer controls when it appears, not scene count alone
- Good stopping points include: arriving somewhere new, completing a sub-task, a campfire/rest moment after combat ends, reuniting with allies, receiving a quest reward, finishing a social encounter, or a quiet moment of reflection
- BAD stopping points: mid-combat, during chase scenes, while enemies are present, during urgent time-pressure moments, right after revealing a threat
- The stopping point should feel EARNED and COMPLETE — not abrupt
- End stopping point scenes with a forward hook: hint at what comes next, an unanswered question, or a new threat on the horizon
- Think of it like a TV episode ending: resolve the immediate tension, but leave threads that pull the viewer back
- If inCombat is true or combatants are present, DO NOT set sessionBreakpoint

WHEN TO SET sessionBreakpoint: true (EXAMPLES — set it at moments like these):
- After defeating a boss or completing a significant combat encounter and the dust settles
- When the party arrives at a safe haven, tavern, or town after a journey
- After completing a quest objective or solving a major puzzle
- During a campfire/rest scene where the party reflects on recent events
- After a chapter gate is met (chapterGateMet) — this is ALWAYS a good break point
- When reuniting with an NPC ally or receiving a quest reward
- After a dramatic social encounter resolves (negotiation complete, trial ended, alliance formed)
- At any calm transition between two distinct story segments

WHEN NOT TO SET sessionBreakpoint (NEVER at these moments):
- During active combat or when combatants are still alive and hostile
- Mid-chase or pursuit sequences
- When a timer or countdown is active in the narrative
- Right after revealing a major threat or cliffhanger
- When the party is in immediate danger
`;

      if (completedGates.length > 0) {
        camlStorySpine += `\nCOMPLETED CHAPTER MILESTONES (the story so far):
${completedGates.map((g: any) => `- Chapter ${g.chapter}: "${g.advanceWhen}" — ACHIEVED`).join("\n")}
`;
      }

      if (currentGateForSpine) {
        camlStorySpine += `\nCURRENT CHAPTER ${currentChapterNum} OBJECTIVE:
- What must happen: "${currentGateForSpine.advanceWhen}"
${currentGateForSpine.requiredTruth ? `- Truth to discover: "${currentGateForSpine.requiredTruth}"` : ''}
${currentGateForSpine.requiredCommitment ? `- Commitment to make: "${currentGateForSpine.requiredCommitment}"` : ''}
${currentGateForSpine.requiredBeliefChange ? `- Belief to change: "${currentGateForSpine.requiredBeliefChange}"` : ''}
`;
      }

      const upcomingGates = chapterGates.filter((g: any) => g.chapter > currentChapterNum);
      if (upcomingGates.length > 0) {
        camlStorySpine += `\nFUTURE ARC (foreshadow these, but don't resolve yet):
${upcomingGates.slice(0, 2).map((g: any) => `- Chapter ${g.chapter}: "${g.advanceWhen}"`).join("\n")}
`;
      }

      camlStorySpine += `\nSTORY SPINE RULES:
1. Each scene should plant seeds for the current chapter gate — even if indirectly
2. Foreshadow future chapters through hints, rumors, environmental storytelling
3. The campaign question should be reflected in character dilemmas and NPC motivations
4. Build toward the chapter gate through escalating revelations, not repetitive clue-finding
5. Each scene should feel like it MOVES THE STORY FORWARD — if removing this scene wouldn't change the narrative, it shouldn't exist
`;

      // ============================================
      // CHAPTER PROGRESSION NUDGING
      // ============================================
      let chapterNudge = "";
      const GENTLE_THRESHOLD = 5;
      const MODERATE_THRESHOLD = 7;
      const URGENT_THRESHOLD = 9;

      if (currentGateForSpine && scenesInCurrentChapter >= GENTLE_THRESHOLD) {
        if (scenesInCurrentChapter >= URGENT_THRESHOLD) {
          chapterNudge = `\n\n⚡ URGENT CHAPTER PROGRESSION:
This chapter has run for ${scenesInCurrentChapter} scenes — it MUST advance NOW.
THIS SCENE should directly address the chapter gate: "${currentGateForSpine.advanceWhen}"
- Present a pivotal moment, revelation, or confrontation that satisfies the gate condition
- The player's choice in this scene should determine HOW the gate is met, not WHETHER
- Do not introduce new subplots — resolve the current chapter's central question
- Include "chapterGateMet" in your response if the condition is fulfilled
`;
        } else if (scenesInCurrentChapter >= MODERATE_THRESHOLD) {
          chapterNudge = `\n\n⚠️ CHAPTER PROGRESSION — MODERATE URGENCY:
This chapter has run for ${scenesInCurrentChapter} scenes. The story should converge toward the chapter gate within the next 2-3 scenes.
- Chapter gate: "${currentGateForSpine.advanceWhen}"
- Begin closing subplots and consolidating threads toward the gate condition
- Raise the stakes — make the chapter's central tension unavoidable
- Ensure THIS scene creates momentum toward resolution, not more questions
- The next few scenes should feel like a clear crescendo, not more wandering
`;
        } else {
          chapterNudge = `\n\n📌 CHAPTER PROGRESSION — GENTLE NUDGE:
This chapter has run for ${scenesInCurrentChapter} scenes. Begin steering the narrative toward the chapter gate.
- Chapter gate: "${currentGateForSpine.advanceWhen}"
- Plant clearer clues, create situations that force the relevant truth/commitment/belief
- The story should feel like it's building toward something specific, not meandering
- Reduce tangential content — each scene should advance the chapter's arc
`;
        }
      }

      const promptWithContext = `
You are an expert Dungeon Master using OPERATIVE STATE-FIRST storytelling (CAML 2.0).
${campaignContext}
${locationContext}
Difficulty level: ${difficulty || "Normal - Balanced Challenge"}
Story direction preference: ${storyDirection || "balanced mix of combat, roleplay, and exploration"}
${stateContext}
${sceneHistoryDigest}
${camlStorySpine}
${chapterNudge}

═══════════════════════════════════════════════════════════
DM AUTHORING DOCTRINE - THESE OVERRIDE ALL OTHER RULES:
═══════════════════════════════════════════════════════════

0A. EVERY CHOICE MUST COST, CLOSE, OR ESCALATE:
   - If a choice can be repeated without cost, it is NOT a real choice — redesign it
   - Even asking questions or investigating should have social or narrative cost
   - "Take action" style choices with no consequence are BANNED

0A2. CHOICES MUST REFLECT THE NARRATIVE'S DECISION:
   - If your narrative presents a moral dilemma, ideological fork, or "choose your path" moment, at least 2 of the 4 choices MUST directly represent opposing sides of that decision
   - Do NOT write a narrative about choosing between light and dark, then offer choices like "heal wounds" and "search the area" — the player NEEDS to be able to pick a side
   - The narrative creates the tension; the choices are where the player RESOLVES it
   - Test: "Does my narrative promise a decision the player can actually make with these choices?" If not, rewrite the choices to match

0B. CAMPAIGN STAKES ARE MANDATORY:
   - EVERY choice you offer must touch at least one campaign stake (increase or decrease)
   - Include "campaignStakeUpdates" in stateChanges showing which stakes changed and why
   - If you cannot explain which stake an action touches, the action should not exist

0C. COMBAT IS CONSEQUENCE, NOT CONTENT:
   - Combat triggers because a stake crossed a threshold or a choice escalated beyond diplomacy
   - Even winning combat must worsen at least one stake or pressure meter
   - Combat is NEVER the safest option — it always costs something
   - Test: "What gets worse even if they win this fight?" If nothing, remove the fight

0C2. VICTORY IS INCOMPLETE:
   - Winning a fight must answer: What pressure increased? What opportunity closed? What new problem exists now?
   - There is no "clean" victory — every resolution creates a new complication or cost
   - Defeating an enemy should transfer their problems to the party (their debts, their secrets, their enemies)
   - Test: "After winning, is the situation simply better?" If yes, add a cost or complication

0C3. NPCs ARE AGENTS, NOT VENDING MACHINES:
   - NPCs have limited patience — each consultation costs something (time, favor, information shared)
   - Repeated asking reduces NPC attitude by 5-10 per query beyond the first on the same topic
   - NPCs have their own agendas — helping the party should advance or compromise their own goals
   - Key NPCs should occasionally REFUSE to help, demand payment, or provide misleading information based on their interests
   - "Ask until solved" is BANNED — if a player keeps asking the same NPC, that NPC becomes suspicious, annoyed, or exploitative

0C4. PROCESSES CREATE NEW PROBLEMS:
   - Every completed process (quest, ritual, combat) must leave at least one new problem in its wake
   - Include "processConsequence" thinking: What broke? What transferred? What was revealed? What cost was deferred?
   - The world is never simply "fixed" — every fix shifts the problem somewhere else

0D. CHAPTER GATE IS YOUR PRIMARY NARRATIVE GOAL:
   - The current chapter gate defines WHAT THIS CHAPTER IS ABOUT — every scene must build toward it
   - Your scenes should create situations, encounters, and choices that NATURALLY lead toward satisfying the gate condition
   - Do NOT wait for the player to stumble onto the gate — actively steer the narrative toward it through NPC actions, environmental pressures, and consequences of choices
   - PACING RULE: Do NOT trigger "chapterGateMet" in the first 3 scenes of a chapter. Early scenes should establish the chapter's themes, but don't over-delay — target 6-8 scenes per chapter (~1 hour of play).
   - When the gate condition is met (a belief changes, a truth is learned, or a commitment is made) AND the chapter has had at least 3 scenes of buildup, you MUST include "chapterGateMet" in your response
   - Include "chapterGateMet": { "gateId": chapter_number, "reason": "what truth/belief/commitment was reached" } — gateId must be a NUMBER matching the current chapter
   - NEVER generate aimless dungeon crawling or random encounters that don't connect to the chapter's purpose
   - If you're unsure how to connect the current action to the gate, have an NPC deliver urgent news, reveal a clue, or create a consequence that forces engagement with the gate theme
   - PACING TARGET: Each chapter should last approximately 6-8 scenes. After scene 5, actively create moments where the gate can be met. Do not pad chapters with filler.

0E. LOG WHY THINGS MATTER:
   - Include "narrativeLogEntry" in your response: { "xpReason": why XP was earned, "stakeReason": which stakes changed and why, "foreclosedReason": what options closed and why }

═══════════════════════════════════════════════════════════
MANDATORY OPERATIVE RULES - YOU MUST ENFORCE THESE:
═══════════════════════════════════════════════════════════

1. NPC ATTITUDE GATES ARE BINDING:
   - If an NPC is marked [ACTIVELY BLOCKING], that content is UNAVAILABLE in this scene
   - If an NPC attitude < 0, they are uncooperative, evasive, or hostile
   - If an NPC attitude >= 50 and marked [NOW UNLOCKED], reveal that content
   - Do NOT allow players to bypass gates through clever roleplay - the gate is real

2. PRESSURE METERS ARE OPERATIVE:
   - If a meter is >= 50%, increase DCs by 2 and add complications
   - If a meter is >= 80% (CRITICAL), the consequence is IMMINENT - foreshadow it
   - If a meter reaches max, the consequence HAPPENS in this scene
   - Failed stealth, reckless actions, loud combat, time passing → advance relevant meter

3. FAILURE HAS CONSEQUENCES (NEVER "TRY AGAIN"):
   - Failed roll → advance a pressure meter by 1-2
   - Failed social roll → NPC attitude drops by 10-20
   - Failure must change something: NPC learns something, alarm raised, resource lost, problem mutates

4. PATH EXCLUSIVITY:
   - If a path is marked [BLOCKED], it is NO LONGER AVAILABLE
   - When a major approach is taken, mark at least one alternative as blocked
   - Different endings are possible - not all end the same way

5. MUTUALLY EXCLUSIVE OUTCOMES:
   - Actions that help one faction often hurt another
   - Saving one thing may cost another
   - The ending should reflect accumulated choices, not just "victory"

6. WORLD DETERIORATION (THE WORLD MOVES WITHOUT THE PLAYERS):
   - Global stakes advance EVERY scene - include globalStakeUpdates in stateChanges
   - NPCs with broken trust behave according to their betrayalBehavior (lies, withdraws, antagonizes, sabotages)
   - Check if any foreclosure conditions are met - if so, that door seals PERMANENTLY
   - Inaction has consequences: if players delay or avoid the main threat, advance relevant stakes

7. NPC BREAKING POINTS:
   - If an NPC's attitude drops below their trustThreshold, they become unreliable
   - If a player triggers a breaking point action, that NPC is PERMANENTLY broken
   - Broken NPCs lie, withdraw protection, or actively work against the party

7B. NPC COMPANION INTERACTIONS (CRITICAL FOR IMMERSION):
   - If the party includes NPC companions/allies, they are LIVING CHARACTERS — not silent followers
   - In roughly 1 out of every 2-3 scenes, a companion should SPEAK, REACT, or INTERACT unprompted:
     * Comment on the surroundings, situation, or the player's recent decision
     * Offer unsolicited advice, share a personal memory, or voice a concern
     * React emotionally to story events (fear, excitement, suspicion, humor)
     * Banter with the player character or other companions
     * Notice something the player missed (a hidden detail, a suspicious NPC, a danger)
   - Companions have PERSONALITIES — a gruff warrior reacts differently than a cheerful bard
   - Their dialogue should feel natural and character-appropriate, not robotic status reports
   - In tense moments, companions might disagree with the player or urge caution
   - After major choices, companions should react (approval, worry, excitement, or disapproval)
   - Include companion dialogue directly in the narrative text with their name, e.g.: Grimshaw mutters, "I don't like the look of this place."

8. FORECLOSURE (PERMANENT LOSS):
   - When conditions are met (stakes reach threshold, attitude drops too low), foreclosures trigger
   - This is PERMANENT - acknowledge what is lost and adjust narrative accordingly
   - Some endings involve loss - the Spire may be stabilized but the library is gone

9. NORMATIVE RESIDUE (SOME THINGS CANNOT BE FIXED):
   - Residue is created by player CHOICE: failure, delay, refusal, recklessness, betrayal
   - Residue accumulates in severity (0 → 1 → 2 → 3), each level activating new effects
   - At max severity, residue is UNRECOVERABLE - no repair possible
   - Residue effects are REAL: if an effect revokes advisor status, the NPC won't advise
   - When a residue trigger condition is met, include residueUpdates in stateChanges
   - Long rest, spells, explanations, and time CANNOT remove residue

10. REPAIR IS RISKY (NOT GUARANTEED):
   - Repair pathways cost time, sacrifice, and opportunity
   - Repair can FAIL and make things WORSE (+1 severity instead of -1)
   - NPCs and institutions can REFUSE repair attempts
   - Cannot repair at max severity - that ship has sailed

Based on the player's action: "${cleanedPrompt}", generate the next part of the adventure.

BEFORE GENERATING, CHECK:
- Are any NPC gates blocking what the player wants? If so, they must work around it.
- Should this action advance a pressure meter? Which one?
- If there's a failure possibility, what specifically changes in the world?

Return your response as a JSON object with these fields:
- narrative: The descriptive text of what happens next (3-4 paragraphs). Show how world state affects the scene.
- sessionTitle: A short, engaging title for this scene
- location: The current location or setting where this scene takes place
- choices: An array of 4 objects. CRITICAL: If the narrative above presents a moral dilemma, fork, or "choose your path" moment, at least 2 choices MUST represent the opposing sides of that decision. Do NOT dodge the narrative's tension with generic utility choices. Each object has:
  - action: A short description of a possible action
  - description: A brief explanation of what this action entails 
  - icon: A simple icon identifier (use: "search", "hand-sparkles", "running", "sword", or any basic icon name)
  - requiresDiceRoll: Boolean indicating if this action requires a dice roll
  - diceType: If requiresDiceRoll is true, include the type of dice to roll ("d20" for most skill checks and attacks)
  - rollDC: If requiresDiceRoll is true, include the DC/difficulty (number to beat) for this roll
  - skillType: The skill or ability used (e.g., "perception", "persuasion", "stealth", "athletics", "investigation", "arcana", "insight", "intimidation", "deception", "acrobatics"). IMPORTANT: Use varied skills appropriate to the situation - social situations should use Persuasion/Deception/Insight, sneaking uses Stealth, searching uses Perception/Investigation, climbing/jumping uses Athletics/Acrobatics, magical knowledge uses Arcana. Don't default everything to Athletics or Strength.
  - rollPurpose: A short explanation of what the roll is for (e.g., "Perception Check", "Persuasion Check", "Stealth Check")
  - successText: Brief text to display on a successful roll
  - failureText: Brief text describing meaningful consequence - NOT "try again" but world changes (NPC becomes suspicious, alarm raised, resource lost, problem escalates)
  - failureConsequence: (REQUIRED for dice rolls) Object specifying what state changes on failure:
    - type: "pressure" | "npc_attitude" | "path_blocked" | "world_state"
    - target: The name of the meter, NPC, path, or state key affected
    - delta: Number to change by (e.g., +2 for pressure, -15 for attitude)
    - description: What happens narratively
- stateChanges: (IMPORTANT - REQUIRED) An object describing how this scene changed the world state:
  - worldStateUpdates: Array of {key, delta, reason} for any world state facts that changed (delta is number to add, e.g., +10 or -15)
  - npcAttitudeUpdates: Array of {name, delta, reason} for any NPC attitudes that changed
  - pressureMeterUpdates: Array of {name, delta, reason} for any pressure meters that advanced (MUST include at least one if action was risky or time-sensitive)
  - pathsBlocked: Array of {approach, reason} for any paths that are now closed due to this scene's events
  - globalStakeUpdates: Array of {name, delta, reason} for world deterioration (MUST include +1 for at least one stake each scene - the world moves)
  - npcsBroken: Array of {name, reason} for any NPCs whose breaking points were triggered (PERMANENT)
  - foreclosuresTriggered: Array of {name, reason} for any doors that sealed permanently this scene
  - residueUpdates: Array of {residueId, delta, reason, triggerId?} for any normative residue that increased due to player choice (failure, delay, recklessness)
  - campaignStakeUpdates: (REQUIRED) Array of {id, delta, reason} for campaign stakes touched by this action. EVERY scene MUST include at least one.
    DELTA SIZING: Use delta ±1 for minor/indirect effects. Use delta ±2 for DECISIVE player choices that clearly commit to one direction (e.g., "harness the dark power" = +2, "destroy the artifact" = -2). The player's INTENT matters — if they chose something dramatic, the world should respond dramatically.
    ANTI-OSCILLATION: Do NOT reverse a stake change in the very next scene unless something dramatically changed. If a player chose to embrace blood magic and the stake went +2, it should NOT go -1 next turn just because "the situation calmed." Momentum matters — committed choices have lasting effects.
- villainUpdate: (OPTIONAL) If villain reacted this scene: { "reactionUsed": "escalate|redirect|retaliate|accelerate", "newStep": number, "corruptionDelta": +/-N, "consequence": "what changed" }
- complicationUsed: (OPTIONAL) If a complication was injected: { "type": "moralQuandary|twist|environmentalModifier", "id": "complication_id" }
- encounterUsed: (OPTIONAL) String ID of the designed encounter used this scene
- trackingUpdates: (OPTIONAL) { "reputationDelta": +/-N, "instabilityDelta": +/-N, "corruptionDelta": +/-N } for persistent campaign tracking
- failureAdvancement: (OPTIONAL - include ONLY when player fails significantly) { "villainAdvancement": "what villain gained", "villainStepAdvance": true/false, "corruptionIncrease": N, "instabilityIncrease": N, "factionShift": "how factions changed", "worldConsequence": "visible change", "newThreat": "new danger created" }
  FAILURE RULES: When players fail, the world ADVANCES — it does NOT block. The villain gains ground, factions shift, corruption spreads. But the player gets NEW opportunities born from the failure. Never dead-end the story.
- chapterGateMet: (OPTIONAL) If the chapter gate's required truth/commitment/belief was achieved THIS scene, include: { "gateId": chapter_number, "reason": "what was learned/committed/changed" }
- sessionBreakpoint: (OPTIONAL, boolean) Set to true when this scene is a NATURAL STOPPING POINT. Trigger it after: quest completions, boss defeats, arriving at safe havens, campfire/rest scenes, chapter gate achievements, social encounter resolutions. NEVER during combat, chases, or when combatants are present. Aim for roughly once every 6-8 scenes at calm narrative transitions.
- narrativeLogEntry: (REQUIRED) Object with:
  - xpReason: Why XP was awarded this scene (or "No XP — no meaningful resolution")
  - stakeReason: Which campaign stakes changed and why (one sentence)
  - foreclosedReason: What options closed and why (or "None this scene")
  - choiceCost: What the player's choice cost, closed, or escalated (one sentence — CANNOT be empty)
- discoveredQuest: (OPTIONAL - include only when a side quest is naturally discovered) An object with:
  - title: A compelling quest name (e.g., "The Missing Merchant", "Whispers in the Well")
  - description: 2-3 sentences describing the quest objective
  - discoveryContext: How it was discovered (e.g., "A frantic villager approaches", "A weathered notice on the tavern board")
  - objectives: An array of 2-4 objective objects, each with:
    - text: A specific task to complete (e.g., "Find the missing merchant's trail", "Investigate the old well")
    - completed: false (always start as incomplete)
  - xpReward: XP reward (50-150 for easy, 100-200 for moderate, 150-300 for challenging)
  - goldReward: Gold reward (10-50 for most side quests)
  - difficultyRating: "easy", "moderate", or "challenging"
  - estimatedDuration: "1 session" or "1-2 sessions"
  - questGiver: (optional) Name of NPC who gives this quest if discovered through NPC interaction
`;

      // Generate story directly using OpenAI
      const { client: openaiClient, model: aiModel } = await getAIClient(req.user?.id);
      
      const response = await openaiClient.chat.completions.create({
        model: aiModel,
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
      
      // Create new session — use actual session count, NOT currentSession (which tracks chapter)
      const actualSessionCount = allSessions.length;
      const sessionNumber = actualSessionCount + 1;
      const sessionData = {
        campaignId: parseInt(campaignId),
        sessionNumber,
        title: storyData.sessionTitle,
        narrative: storyData.narrative,
        location: storyData.location,
        choices: storyData.choices,
        createdAt: new Date().toISOString(),
      };
      
      // Save the session
      const session = await storage.createCampaignSession(sessionData);
      
      // NOTE: Do NOT call updateCampaignSession here — currentSession tracks the CHAPTER number,
      // not the session count. Chapter advancement only happens via chapterGateMet below.
      
      // CAML 2.0: Apply state changes from the AI response
      if (storyData.stateChanges) {
        try {
          const changes = storyData.stateChanges;
          let updatedWorldState = [...worldState];
          let updatedNpcAttitudes = [...npcAttitudes];
          let updatedPressureMeters = [...pressureMeters];
          let stateWasUpdated = false;
          
          // Apply world state updates
          if (changes.worldStateUpdates && Array.isArray(changes.worldStateUpdates)) {
            for (const update of changes.worldStateUpdates) {
              const stateIndex = updatedWorldState.findIndex((s: any) => s.key === update.key);
              if (stateIndex >= 0) {
                const newValue = Math.max(-100, Math.min(100, updatedWorldState[stateIndex].value + (update.delta || 0)));
                updatedWorldState[stateIndex] = {
                  ...updatedWorldState[stateIndex],
                  value: newValue,
                  description: update.reason || updatedWorldState[stateIndex].description
                };
                stateWasUpdated = true;
                console.log(`CAML State Update: ${update.key} ${update.delta > 0 ? '+' : ''}${update.delta} (${update.reason})`);
              }
            }
          }
          
          // Apply NPC attitude updates
          if (changes.npcAttitudeUpdates && Array.isArray(changes.npcAttitudeUpdates)) {
            for (const update of changes.npcAttitudeUpdates) {
              const npcIndex = updatedNpcAttitudes.findIndex((n: any) => n.name === update.name);
              if (npcIndex >= 0) {
                const newAttitude = Math.max(-100, Math.min(100, updatedNpcAttitudes[npcIndex].attitude + (update.delta || 0)));
                updatedNpcAttitudes[npcIndex] = {
                  ...updatedNpcAttitudes[npcIndex],
                  attitude: newAttitude
                };
                stateWasUpdated = true;
                console.log(`CAML NPC Update: ${update.name} attitude ${update.delta > 0 ? '+' : ''}${update.delta} (${update.reason})`);
              }
            }
          }
          
          // Apply pressure meter updates
          if (changes.pressureMeterUpdates && Array.isArray(changes.pressureMeterUpdates)) {
            for (const update of changes.pressureMeterUpdates) {
              const meterIndex = updatedPressureMeters.findIndex((m: any) => m.name === update.name);
              if (meterIndex >= 0) {
                const newValue = Math.max(0, Math.min(updatedPressureMeters[meterIndex].max, updatedPressureMeters[meterIndex].current + (update.delta || 0)));
                updatedPressureMeters[meterIndex] = {
                  ...updatedPressureMeters[meterIndex],
                  current: newValue
                };
                stateWasUpdated = true;
                console.log(`CAML Pressure Update: ${update.name} ${update.delta > 0 ? '+' : ''}${update.delta} (${update.reason})`);
                
                // Check if pressure meter maxed out
                if (newValue >= updatedPressureMeters[meterIndex].max) {
                  console.log(`CAML CONSEQUENCE TRIGGERED: ${update.name} reached max! ${updatedPressureMeters[meterIndex].consequence}`);
                }
              }
            }
          }
          
          // Apply path blocking (CAML path exclusivity)
          let updatedAvailablePaths = [...availablePaths];
          if (changes.pathsBlocked && Array.isArray(changes.pathsBlocked)) {
            for (const blocked of changes.pathsBlocked) {
              const pathIndex = updatedAvailablePaths.findIndex((p: any) => p.approach === blocked.approach);
              if (pathIndex >= 0) {
                updatedAvailablePaths[pathIndex] = {
                  ...updatedAvailablePaths[pathIndex],
                  isBlocked: true,
                  blockedReason: blocked.reason || "This path is no longer available"
                };
                stateWasUpdated = true;
                console.log(`CAML PATH BLOCKED: ${blocked.approach} - ${blocked.reason}`);
              }
            }
          }
          
          // WORLD DETERIORATION: Apply global stake updates
          let updatedGlobalStakes = [...(campaign.globalStakes || [])];
          if (changes.globalStakeUpdates && Array.isArray(changes.globalStakeUpdates)) {
            for (const update of changes.globalStakeUpdates) {
              const stakeIndex = updatedGlobalStakes.findIndex((s: any) => s.name === update.name);
              if (stakeIndex >= 0) {
                const newValue = Math.max(0, Math.min(updatedGlobalStakes[stakeIndex].max, updatedGlobalStakes[stakeIndex].current + (update.delta || 1)));
                updatedGlobalStakes[stakeIndex] = {
                  ...updatedGlobalStakes[stakeIndex],
                  current: newValue
                };
                stateWasUpdated = true;
                console.log(`CAML GLOBAL STAKE: ${update.name} ${update.delta > 0 ? '+' : ''}${update.delta} (${update.reason})`);
                
                // Check milestones
                const stake = updatedGlobalStakes[stakeIndex];
                if (stake.milestones) {
                  for (const milestone of stake.milestones) {
                    if (newValue >= milestone.threshold) {
                      console.log(`CAML MILESTONE: ${stake.name} at ${milestone.threshold}: ${milestone.effect}`);
                    }
                  }
                }
                
                // Check if stake maxed out
                if (newValue >= stake.max) {
                  console.log(`CAML CATASTROPHE: ${stake.name} reached max! ${stake.consequence}`);
                }
              }
            }
          }
          
          // WORLD DETERIORATION: Apply NPC breaking points from AI
          let updatedUnreliableNPCs = [...(campaign.unreliableNPCs || [])];
          if (changes.npcsBroken && Array.isArray(changes.npcsBroken)) {
            for (const broken of changes.npcsBroken) {
              const npcIndex = updatedUnreliableNPCs.findIndex((n: any) => n.name === broken.name);
              if (npcIndex >= 0 && !updatedUnreliableNPCs[npcIndex].isBroken) {
                updatedUnreliableNPCs[npcIndex] = {
                  ...updatedUnreliableNPCs[npcIndex],
                  isBroken: true
                };
                stateWasUpdated = true;
                console.log(`CAML NPC BROKEN: ${broken.name} - ${broken.reason} (will now: ${updatedUnreliableNPCs[npcIndex].betrayalBehavior})`);
              }
            }
          }
          
          // AUTOMATIC SERVER-SIDE ENFORCEMENT: Advance global stakes on scene_end
          // Only auto-increment stakes that weren't already updated by AI (de-duplication)
          const aiUpdatedStakes = new Set(
            (changes.globalStakeUpdates || []).map((u: any) => u.name)
          );
          
          if (updatedGlobalStakes.length > 0) {
            for (let i = 0; i < updatedGlobalStakes.length; i++) {
              const stake = updatedGlobalStakes[i];
              const advancesOnSceneEnd = (stake.advancesOn || []).includes('scene_end');
              const wasUpdatedByAI = aiUpdatedStakes.has(stake.name);
              
              // Skip auto-increment if AI already updated this stake this scene
              if (advancesOnSceneEnd && stake.current < stake.max && !wasUpdatedByAI) {
                const newValue = Math.min(stake.max, stake.current + 1);
                updatedGlobalStakes[i] = { ...stake, current: newValue };
                stateWasUpdated = true;
                console.log(`CAML AUTO-DETERIORATION: ${stake.name} +1 on scene end (now ${newValue}/${stake.max})`);
                
                // Check milestones
                if (stake.milestones) {
                  for (const milestone of stake.milestones) {
                    if (newValue === milestone.threshold) {
                      console.log(`CAML MILESTONE REACHED: ${stake.name} at ${milestone.threshold}: ${milestone.effect}`);
                    }
                  }
                }
                
                // Check catastrophe
                if (newValue >= stake.max) {
                  console.log(`CAML CATASTROPHE: ${stake.name} maxed out! ${stake.consequence}`);
                }
              }
            }
          }
          
          // AUTOMATIC SERVER-SIDE ENFORCEMENT: Check NPC attitude vs trust threshold
          // Sync unreliable NPC attitudes with npcAttitudes array and check for unreliability
          for (let i = 0; i < updatedUnreliableNPCs.length; i++) {
            const unreliableNpc = updatedUnreliableNPCs[i];
            if (unreliableNpc.isBroken) continue; // Already broken
            
            // Find matching NPC in attitudes array to get current attitude
            const attitudeNpc = updatedNpcAttitudes.find((n: any) => n.name === unreliableNpc.name);
            if (attitudeNpc) {
              const previousAttitude = unreliableNpc.attitude;
              const newAttitude = attitudeNpc.attitude;
              updatedUnreliableNPCs[i] = { ...unreliableNpc, attitude: newAttitude };
              stateWasUpdated = true;
              
              // Check if NPC crossed below trust threshold (became unreliable)
              if (previousAttitude >= unreliableNpc.trustThreshold && newAttitude < unreliableNpc.trustThreshold) {
                console.log(`CAML NPC UNRELIABLE: ${unreliableNpc.name} dropped below trust threshold (${newAttitude} < ${unreliableNpc.trustThreshold}) - will now be evasive or misleading`);
              }
              
              // Check if attitude dropped significantly - could indicate breaking point triggered
              // Note: Breaking points are action-based and primarily detected by AI
              // But severe attitude drops (>30 points) may indicate breaking point was hit
              if (newAttitude - previousAttitude <= -30 && !unreliableNpc.isBroken) {
                console.log(`CAML POTENTIAL BREAKING POINT: ${unreliableNpc.name} attitude dropped ${previousAttitude - newAttitude} points - check if breaking point was triggered`);
              }
            }
          }
          
          // WORLD DETERIORATION: Trigger foreclosures from AI
          let updatedForeclosures = [...(campaign.foreclosures || [])];
          if (changes.foreclosuresTriggered && Array.isArray(changes.foreclosuresTriggered)) {
            for (const triggered of changes.foreclosuresTriggered) {
              const foreIndex = updatedForeclosures.findIndex((f: any) => f.name === triggered.name);
              if (foreIndex >= 0 && !updatedForeclosures[foreIndex].isSealed) {
                updatedForeclosures[foreIndex] = {
                  ...updatedForeclosures[foreIndex],
                  isSealed: true,
                  sealedReason: triggered.reason || "This is permanently lost"
                };
                stateWasUpdated = true;
                console.log(`CAML FORECLOSURE: ${triggered.name} SEALED - ${triggered.reason}. ${updatedForeclosures[foreIndex].consequence}`);
              }
            }
          }
          
          // AUTOMATIC SERVER-SIDE ENFORCEMENT: Evaluate foreclosure conditions
          // Parse sealedWhen conditions and check against current state
          const evaluateForeclosureCondition = (condition: string): boolean => {
            // Parse conditions like "arcane_instability >= 5" or "elder_trust < -50"
            const match = condition.match(/^(\w+)\s*(>=|<=|>|<|==)\s*(-?\d+)$/);
            if (!match) return false;
            
            const [, key, operator, threshold] = match;
            const thresholdNum = parseInt(threshold, 10);
            
            // Check global stakes
            const stake = updatedGlobalStakes.find((s: any) => s.name === key);
            if (stake) {
              switch (operator) {
                case '>=': return stake.current >= thresholdNum;
                case '<=': return stake.current <= thresholdNum;
                case '>': return stake.current > thresholdNum;
                case '<': return stake.current < thresholdNum;
                case '==': return stake.current === thresholdNum;
              }
            }
            
            // Check world state facts
            const stateFact = updatedWorldState.find((s: any) => s.key === key);
            if (stateFact) {
              switch (operator) {
                case '>=': return stateFact.value >= thresholdNum;
                case '<=': return stateFact.value <= thresholdNum;
                case '>': return stateFact.value > thresholdNum;
                case '<': return stateFact.value < thresholdNum;
                case '==': return stateFact.value === thresholdNum;
              }
            }
            
            // Check pressure meters
            const meter = updatedPressureMeters.find((m: any) => m.name === key);
            if (meter) {
              switch (operator) {
                case '>=': return meter.current >= thresholdNum;
                case '<=': return meter.current <= thresholdNum;
                case '>': return meter.current > thresholdNum;
                case '<': return meter.current < thresholdNum;
                case '==': return meter.current === thresholdNum;
              }
            }
            
            // Check NPC attitudes
            const npc = updatedNpcAttitudes.find((n: any) => n.name.toLowerCase().replace(/\s+/g, '_') === key || n.name === key);
            if (npc) {
              switch (operator) {
                case '>=': return npc.attitude >= thresholdNum;
                case '<=': return npc.attitude <= thresholdNum;
                case '>': return npc.attitude > thresholdNum;
                case '<': return npc.attitude < thresholdNum;
                case '==': return npc.attitude === thresholdNum;
              }
            }
            
            return false;
          };
          
          for (let i = 0; i < updatedForeclosures.length; i++) {
            const foreclosure = updatedForeclosures[i];
            if (foreclosure.isSealed) continue; // Already sealed
            
            if (foreclosure.sealedWhen && evaluateForeclosureCondition(foreclosure.sealedWhen)) {
              updatedForeclosures[i] = {
                ...foreclosure,
                isSealed: true,
                sealedReason: `Condition met: ${foreclosure.sealedWhen}`
              };
              stateWasUpdated = true;
              console.log(`CAML AUTO-FORECLOSURE: ${foreclosure.name} SEALED - ${foreclosure.sealedWhen}. ${foreclosure.consequence}`);
            }
          }
          
          // NORMATIVE RESIDUE: Process residue updates from AI
          let updatedNormativeResidues = [...(campaign.normativeResidues || [])];
          if (changes.residueUpdates && Array.isArray(changes.residueUpdates)) {
            for (const update of changes.residueUpdates) {
              const residueIndex = updatedNormativeResidues.findIndex((r: any) => r.id === update.residueId);
              if (residueIndex >= 0) {
                const residue = updatedNormativeResidues[residueIndex];
                const previousSeverity = residue.severity;
                const newSeverity = Math.max(0, Math.min(residue.maxSeverity, residue.severity + (update.delta || 1)));
                
                updatedNormativeResidues[residueIndex] = {
                  ...residue,
                  severity: newSeverity
                };
                stateWasUpdated = true;
                
                console.log(`CAML RESIDUE UPDATE: ${update.residueId} ${update.delta > 0 ? '+' : ''}${update.delta} (now ${newSeverity}/${residue.maxSeverity}) - ${update.reason}`);
                
                // Check for newly activated effects at this severity
                const newlyActivatedEffects = (residue.effects || []).filter((e: any) => 
                  e.atSeverity === newSeverity && e.atSeverity > previousSeverity
                );
                for (const effect of newlyActivatedEffects) {
                  console.log(`CAML RESIDUE EFFECT ACTIVATED: ${effect.effectType} ${effect.target} - ${effect.description}`);
                }
                
                // Check if residue reached max (unrecoverable)
                if (newSeverity >= residue.maxSeverity && previousSeverity < residue.maxSeverity) {
                  console.log(`CAML RESIDUE UNRECOVERABLE: ${update.residueId} - "${residue.description}" can no longer be repaired. The damage is permanent.`);
                }
              }
            }
          }
          
          // DM AUTHORING DOCTRINE: Apply campaignStakeUpdates from AI response
          let updatedCampaignStakes = [...((campaign as any).campaignStakes || [])];
          if (changes.campaignStakeUpdates && Array.isArray(changes.campaignStakeUpdates)) {
            for (const update of changes.campaignStakeUpdates) {
              const stakeIndex = updatedCampaignStakes.findIndex((s: any) => s.id === update.id);
              if (stakeIndex >= 0) {
                const stake = updatedCampaignStakes[stakeIndex];
                const newValue = Math.max(0, Math.min(stake.max || 5, stake.value + (update.delta || 0)));
                updatedCampaignStakes[stakeIndex] = { ...stake, value: newValue };
                stateWasUpdated = true;
                console.log(`DOCTRINE STAKE: ${update.id} ${update.delta > 0 ? '+' : ''}${update.delta} (now ${newValue}/${stake.max}) — ${update.reason}`);
              }
            }
          }
          
          // DM AUTHORING DOCTRINE: Apply passive drift (world deteriorates each scene)
          const { updatedStakes: driftedStakes, driftLog, thresholdEvents } = applyStakePassiveDrift(updatedCampaignStakes);
          if (driftLog.length > 0) {
            updatedCampaignStakes = driftedStakes;
            stateWasUpdated = true;
            driftLog.forEach(log => console.log(log));
          }
          
          // DM AUTHORING DOCTRINE: Inject threshold events into narrative context for next scene
          if (thresholdEvents.length > 0) {
            const thresholdNarrative = thresholdEvents.map((te: any) => 
              `[THRESHOLD EVENT: ${te.stakeName} hit ${te.threshold} — ${te.event}${te.irreversible ? ' (PERMANENT)' : ''}]`
            ).join('\n');
            console.log(`THRESHOLD EVENTS TRIGGERED:\n${thresholdNarrative}`);
          }
          
          // DM AUTHORING DOCTRINE: Append narrative log entry
          let updatedNarrativeLog = [...((campaign as any).narrativeLog || [])];
          if (storyData.narrativeLogEntry) {
            const logEntry = {
              ...storyData.narrativeLogEntry,
              chapter: campaign.currentSession || 1,
              scene: updatedNarrativeLog.length + 1,
              timestamp: new Date().toISOString(),
              thresholdEvents: thresholdEvents.length > 0 ? thresholdEvents : undefined
            };
            updatedNarrativeLog.push(logEntry);
            stateWasUpdated = true;
            console.log(`DOCTRINE LOG: ch${logEntry.chapter} sc${logEntry.scene} — cost: ${logEntry.choiceCost}`);
          }
          
          // DM AUTHORING DOCTRINE: Chapter gate advancement (meaning-based, not metrics-based)
          const CHAPTER_MIN_SCENES = 3;
          let chapterAdvanced = false;
          if (storyData.chapterGateMet) {
            const gate = storyData.chapterGateMet;
            const currentChapterForGate = campaign.currentSession || 1;
            const totalChaptersForGate = campaign.totalChapters || 5;
            
            if (Number(gate.gateId) === currentChapterForGate && currentChapterForGate < totalChaptersForGate) {
              if (scenesInCurrentChapter >= CHAPTER_MIN_SCENES) {
                chapterAdvanced = true;
                stateWasUpdated = true;
                console.log(`DOCTRINE CHAPTER GATE MET: Chapter ${currentChapterForGate} → ${currentChapterForGate + 1} — ${gate.reason} (after ${scenesInCurrentChapter} scenes)`);
                
                updatedNarrativeLog.push({
                  xpReason: `Chapter ${currentChapterForGate} completed`,
                  stakeReason: gate.reason,
                  foreclosedReason: `Chapter ${currentChapterForGate} closed`,
                  choiceCost: `Advanced to Chapter ${currentChapterForGate + 1}`,
                  chapter: currentChapterForGate,
                  scene: -1,
                  timestamp: new Date().toISOString(),
                  type: 'chapter_gate'
                });
              } else {
                console.log(`DOCTRINE CHAPTER GATE REJECTED (too early): Chapter ${currentChapterForGate} gate met after only ${scenesInCurrentChapter}/${CHAPTER_MIN_SCENES} minimum scenes — ${gate.reason}`);
              }
            }
          }
          
          const CHAPTER_HARD_CAP = 10;
          if (!chapterAdvanced && scenesInCurrentChapter >= CHAPTER_HARD_CAP) {
            const currentChapterForHardCap = campaign.currentSession || 1;
            const totalChaptersForHardCap = campaign.totalChapters || 5;
            if (currentChapterForHardCap < totalChaptersForHardCap) {
              chapterAdvanced = true;
              stateWasUpdated = true;
              console.log(`HARD-CAP CHAPTER ADVANCE: Chapter ${currentChapterForHardCap} → ${currentChapterForHardCap + 1} after ${scenesInCurrentChapter} sessions without gate met`);
              updatedNarrativeLog.push({
                xpReason: `Chapter ${currentChapterForHardCap} completed (narrative pressure)`,
                stakeReason: `Story momentum forced chapter progression after ${scenesInCurrentChapter} scenes`,
                foreclosedReason: `Chapter ${currentChapterForHardCap} closed by narrative pressure`,
                choiceCost: `Advanced to Chapter ${currentChapterForHardCap + 1}`,
                chapter: currentChapterForHardCap,
                scene: -1,
                timestamp: new Date().toISOString(),
                type: 'chapter_gate'
              });
            }
          }

          // CAML Campaign Architecture: Process faction updates from AI response (Route 1)
          if (storyData.factionUpdates && Array.isArray(storyData.factionUpdates)) {
            const r1CurrentFactionStrengths = { ...((campaign as any).factionStrengths || {}) };
            const r1CurrentFactionModels = (campaign as any).factionModels as any[] || [];
            
            for (const update of storyData.factionUpdates) {
              if (update.factionId && typeof update.strengthDelta === 'number') {
                const factionModel = r1CurrentFactionModels.find((f: any) => f.id === update.factionId);
                const currentStr = r1CurrentFactionStrengths[update.factionId] ?? factionModel?.strength ?? 50;
                const newStr = Math.max(0, Math.min(100, currentStr + update.strengthDelta));
                r1CurrentFactionStrengths[update.factionId] = newStr;
                stateWasUpdated = true;
                console.log(`FACTION UPDATE (R1): ${update.factionId} ${update.strengthDelta > 0 ? '+' : ''}${update.strengthDelta} (now ${newStr}/100) — ${update.action}`);
              }
            }
            (campaign as any).factionStrengths = r1CurrentFactionStrengths;
          }

          // CAML2: Process villain updates from AI response
          let updatedVillainModel = (campaign as any).villainModel ? { ...(campaign as any).villainModel } : null;
          let updatedVillainCorruption = (campaign as any).villainCorruption || 0;
          let updatedPartyReputation = (campaign as any).partyReputation || 50;
          let updatedWorldInstability = (campaign as any).worldInstability || 20;
          
          if (storyData.villainUpdate && updatedVillainModel) {
            const vu = storyData.villainUpdate;
            if (vu.reactionUsed) {
              console.log(`CAML2 VILLAIN REACTION: ${vu.reactionUsed} — ${vu.consequence || 'no details'}`);
            }
            if (typeof vu.newStep === 'number') {
              updatedVillainModel.currentStep = vu.newStep;
              console.log(`CAML2 VILLAIN PLAN: Advanced to step ${vu.newStep}`);
            }
            if (typeof vu.corruptionDelta === 'number') {
              updatedVillainCorruption = Math.max(0, Math.min(10, updatedVillainCorruption + vu.corruptionDelta));
              console.log(`CAML2 VILLAIN CORRUPTION: ${vu.corruptionDelta > 0 ? '+' : ''}${vu.corruptionDelta} (now ${updatedVillainCorruption}/10)`);
            }
            stateWasUpdated = true;
          }
          
          // CAML2: Process tracking updates from AI response
          if (storyData.trackingUpdates) {
            const tu = storyData.trackingUpdates;
            if (typeof tu.reputationDelta === 'number') {
              updatedPartyReputation = Math.max(0, Math.min(100, updatedPartyReputation + tu.reputationDelta));
              console.log(`CAML2 REPUTATION: ${tu.reputationDelta > 0 ? '+' : ''}${tu.reputationDelta} (now ${updatedPartyReputation}/100)`);
            }
            if (typeof tu.instabilityDelta === 'number') {
              updatedWorldInstability = Math.max(0, Math.min(100, updatedWorldInstability + tu.instabilityDelta));
              console.log(`CAML2 INSTABILITY: ${tu.instabilityDelta > 0 ? '+' : ''}${tu.instabilityDelta} (now ${updatedWorldInstability}/100)`);
            }
            if (typeof tu.corruptionDelta === 'number' && !storyData.villainUpdate?.corruptionDelta) {
              updatedVillainCorruption = Math.max(0, Math.min(10, updatedVillainCorruption + tu.corruptionDelta));
              console.log(`CAML2 CORRUPTION (tracking): ${tu.corruptionDelta > 0 ? '+' : ''}${tu.corruptionDelta} (now ${updatedVillainCorruption}/10)`);
            }
            stateWasUpdated = true;
          }
          
          // CAML2: Mark complications as used when AI reports using them
          let updatedComplicationsQueue = (campaign as any).complicationsQueue ? { ...(campaign as any).complicationsQueue } : null;
          if (storyData.complicationUsed && updatedComplicationsQueue) {
            const cu = storyData.complicationUsed;
            if (cu.type === 'moralQuandary' && updatedComplicationsQueue.moralQuandaries) {
              const idx = updatedComplicationsQueue.moralQuandaries.findIndex((q: any) => q.type === cu.id);
              if (idx >= 0) {
                updatedComplicationsQueue.moralQuandaries = [...updatedComplicationsQueue.moralQuandaries];
                updatedComplicationsQueue.moralQuandaries[idx] = { ...updatedComplicationsQueue.moralQuandaries[idx], isUsed: true };
                console.log(`CAML2 COMPLICATION USED: Moral quandary "${cu.id}"`);
              }
            } else if (cu.type === 'twist' && updatedComplicationsQueue.twists) {
              const idx = updatedComplicationsQueue.twists.findIndex((t: any) => t.type === cu.id);
              if (idx >= 0) {
                updatedComplicationsQueue.twists = [...updatedComplicationsQueue.twists];
                updatedComplicationsQueue.twists[idx] = { ...updatedComplicationsQueue.twists[idx], isUsed: true };
                console.log(`CAML2 COMPLICATION USED: Twist "${cu.id}"`);
              }
            } else if (cu.type === 'environmentalModifier' && updatedComplicationsQueue.environmentalModifiers) {
              const idx = updatedComplicationsQueue.environmentalModifiers.findIndex((e: any) => e.type === cu.id);
              if (idx >= 0) {
                updatedComplicationsQueue.environmentalModifiers = [...updatedComplicationsQueue.environmentalModifiers];
                updatedComplicationsQueue.environmentalModifiers[idx] = { ...updatedComplicationsQueue.environmentalModifiers[idx], isUsed: true };
                console.log(`CAML2 COMPLICATION USED: Environmental modifier "${cu.id}"`);
              }
            }
            stateWasUpdated = true;
          }
          
          // CAML2: Mark encounter designs as used
          let updatedEncounterDesigns = [...((campaign as any).encounterDesigns || [])];
          if (storyData.encounterUsed && updatedEncounterDesigns.length > 0) {
            const encIdx = updatedEncounterDesigns.findIndex((e: any) => e.id === storyData.encounterUsed);
            if (encIdx >= 0) {
              updatedEncounterDesigns[encIdx] = { ...updatedEncounterDesigns[encIdx], isUsed: true };
              console.log(`CAML2 ENCOUNTER USED: "${storyData.encounterUsed}"`);
              stateWasUpdated = true;
            }
          }
          
          // CAML2: Process failure advancement — when player fails, advance villain plan
          if (storyData.failureAdvancement) {
            const fa = storyData.failureAdvancement;
            const failureLog = [...((campaign as any).failureAdvancementLog || [])];
            failureLog.push({
              chapter: campaign.currentSession || 1,
              scene: updatedNarrativeLog.length,
              timestamp: new Date().toISOString(),
              villainAdvancement: fa.villainAdvancement,
              factionShift: fa.factionShift,
              worldConsequence: fa.worldConsequence,
              newThreat: fa.newThreat
            });
            
            if (fa.villainStepAdvance && updatedVillainModel) {
              updatedVillainModel.currentStep = Math.min(
                (updatedVillainModel.planStructure || []).length - 1,
                (updatedVillainModel.currentStep || 0) + 1
              );
              console.log(`CAML2 FAILURE ADVANCEMENT: Villain advanced to step ${updatedVillainModel.currentStep}`);
            }
            if (typeof fa.corruptionIncrease === 'number') {
              updatedVillainCorruption = Math.min(10, updatedVillainCorruption + fa.corruptionIncrease);
            }
            if (typeof fa.instabilityIncrease === 'number') {
              updatedWorldInstability = Math.min(100, updatedWorldInstability + fa.instabilityIncrease);
            }
            
            (campaign as any).failureAdvancementLog = failureLog;
            stateWasUpdated = true;
            console.log(`CAML2 FAILURE ADVANCEMENT: ${fa.worldConsequence || 'World state changed'}`);
          }

          // Save updated state to campaign
          const campaignUpdateData: any = {
            worldState: updatedWorldState,
            npcAttitudes: updatedNpcAttitudes,
            pressureMeters: updatedPressureMeters,
            availablePaths: updatedAvailablePaths,
            globalStakes: updatedGlobalStakes,
            unreliableNPCs: updatedUnreliableNPCs,
            foreclosures: updatedForeclosures,
            normativeResidues: updatedNormativeResidues,
            campaignStakes: updatedCampaignStakes,
            narrativeLog: updatedNarrativeLog,
            factionStrengths: (campaign as any).factionStrengths || undefined,
            villainModel: updatedVillainModel || undefined,
            villainCorruption: updatedVillainCorruption,
            partyReputation: updatedPartyReputation,
            worldInstability: updatedWorldInstability,
            complicationsQueue: updatedComplicationsQueue || undefined,
            encounterDesigns: updatedEncounterDesigns.length > 0 ? updatedEncounterDesigns : undefined,
            failureAdvancementLog: (campaign as any).failureAdvancementLog || undefined,
            updatedAt: new Date().toISOString()
          };
          
          if (chapterAdvanced) {
            campaignUpdateData.currentSession = (campaign.currentSession || 1) + 1;
          }
          
          if (stateWasUpdated) {
            await storage.updateCampaign(parseInt(campaignId), campaignUpdateData);
            console.log(`CAML: Updated campaign ${campaignId} state after story advancement${chapterAdvanced ? ' (CHAPTER ADVANCED)' : ''}`);
          }
          
          // PROCEDURAL QUEST GENERATION: Check triggers and generate quests from world state
          await evaluateProceduralQuestTriggers(
            parseInt(campaignId),
            campaign,
            updatedWorldState,
            updatedNpcAttitudes,
            updatedPressureMeters,
            updatedNormativeResidues,
            storyData.narrative,
            storage
          );
        } catch (stateError) {
          console.error("Failed to apply CAML state changes:", stateError);
          // Don't fail the request if state update fails
        }
      }
      
      // Handle AI-discovered side quests (CAML 2.0 compatible)
      let discoveredQuest = null;
      if (storyData.discoveredQuest) {
        const questData = storyData.discoveredQuest;
        try {
          // Format objectives for CAML compatibility
          const objectives = questData.objectives && Array.isArray(questData.objectives)
            ? questData.objectives.map((obj: any) => ({
                text: obj.text || obj.description || "Complete objective",
                completed: false
              }))
            : [{ text: questData.description?.split('.')[0] || "Complete the quest", completed: false }];
          
          discoveredQuest = await storage.createCampaignQuest({
            campaignId: parseInt(campaignId),
            title: questData.title,
            description: questData.description,
            questType: "side",
            status: "active",
            objectives: objectives, // CAML-compatible objectives array
            xpReward: questData.xpReward || 100,
            goldReward: questData.goldReward || 25,
            difficultyRating: questData.difficultyRating || "moderate",
            estimatedDuration: questData.estimatedDuration || "1 session",
            isPostedToBoard: true,
            postedAt: new Date().toISOString(),
            discoveredByAI: true,
            discoveryContext: questData.discoveryContext || "Discovered during adventure",
            questGiver: questData.questGiver || null, // CAML role assignment support
            createdAt: new Date().toISOString(),
          });
          console.log(`AI discovered side quest: "${questData.title}" for campaign ${campaignId} (CAML 2.0 compatible)`);
        } catch (questError) {
          console.error("Failed to create AI-discovered quest:", questError);
          // Don't fail the whole request if quest creation fails
        }
      }
      
      // Update procedural exploration hexes based on narrative
      try {
        const explorationState = await storage.getExplorationState(parseInt(campaignId));
        if (explorationState && storyData.narrative) {
          // Detect adventure setting for context-aware terrain generation
          // Priority: current narrative > chapter description > campaign title
          const adventureSetting = detectAdventureSetting(
            campaign.title || '', 
            campaign.description || '',
            storyData.narrative,  // Pass current narrative for immediate context
            campaign.currentChapter ? `Chapter ${campaign.currentChapter}` : undefined
          );
          const parsed = parseNarrativeForLocations(storyData.narrative, adventureSetting);
          const movement = detectMovementInNarrative(storyData.narrative);
          
          const currentQ = explorationState.currentHexQ || 0;
          const currentR = explorationState.currentHexR || 0;
          
          // If movement detected, create new hex and move player
          if (movement.hasMoved && movement.direction) {
            const newCoords = getAdjacentHexCoordinates(currentQ, currentR, movement.direction);
            
            // Mark current hex as explored with its terrain
            const currentHex = await storage.getExplorationHex(parseInt(campaignId), currentQ, currentR);
            if (currentHex && !currentHex.isExplored) {
              await storage.updateExplorationHex(currentHex.id, {
                isExplored: true,
                exploredAt: new Date().toISOString()
              });
            }
            
            // Create or update the new hex
            let newHex = await storage.getExplorationHex(parseInt(campaignId), newCoords.q, newCoords.r);
            const hexMeta = generateHexMetaFromKeywords(
              parsed.currentLocation.environmentKeywords,
              parsed.atmosphereKeywords
            );
            
            if (!newHex) {
              newHex = await storage.createExplorationHex({
                campaignId: parseInt(campaignId),
                q: newCoords.q,
                r: newCoords.r,
                terrainType: movement.newTerrainType || parsed.terrainType || "Unknown",
                locationName: movement.newLocationName || parsed.currentLocation.name,
                locationDescription: parsed.currentLocation.description,
                hexMeta: hexMeta,
                isExplored: true,
                isRevealed: true,
                exploredAt: new Date().toISOString(),
                revealedAt: new Date().toISOString(),
                narrativeContext: storyData.narrative.slice(0, 500),
                connectedDirections: []
              });
              console.log(`Created new explored hex at (${newCoords.q}, ${newCoords.r}): ${movement.newLocationName || parsed.terrainType}`);
            } else {
              await storage.updateExplorationHex(newHex.id, {
                terrainType: movement.newTerrainType || parsed.terrainType || newHex.terrainType,
                locationName: movement.newLocationName || parsed.currentLocation.name || newHex.locationName,
                locationDescription: parsed.currentLocation.description || newHex.locationDescription,
                hexMeta: hexMeta,
                isExplored: true,
                exploredAt: new Date().toISOString(),
                narrativeContext: storyData.narrative.slice(0, 500)
              });
            }
            
            // Update exploration state with new position
            await storage.updateExplorationState(parseInt(campaignId), {
              currentHexQ: newCoords.q,
              currentHexR: newCoords.r,
              exploredHexCount: (explorationState.exploredHexCount || 0) + 1,
              totalDistance: (explorationState.totalDistance || 0) + 1
            });
            console.log(`Player moved from (${currentQ}, ${currentR}) to (${newCoords.q}, ${newCoords.r})`);
          } else {
            // No movement, just update current hex with narrative context
            const currentHex = await storage.getExplorationHex(parseInt(campaignId), currentQ, currentR);
            if (currentHex) {
              const hexMeta = generateHexMetaFromKeywords(
                parsed.currentLocation.environmentKeywords,
                parsed.atmosphereKeywords
              );
              await storage.updateExplorationHex(currentHex.id, {
                terrainType: parsed.terrainType !== "Unknown" ? parsed.terrainType : currentHex.terrainType,
                locationName: parsed.currentLocation.name || currentHex.locationName,
                locationDescription: parsed.currentLocation.description || currentHex.locationDescription,
                hexMeta: hexMeta,
                narrativeContext: storyData.narrative.slice(0, 500)
              });
            }
          }
          
          // Reveal adjacent hexes based on narrative hints
          const updatedState = await storage.getExplorationState(parseInt(campaignId));
          const newCurrentQ = updatedState?.currentHexQ || currentQ;
          const newCurrentR = updatedState?.currentHexR || currentR;
          
          for (const hint of parsed.adjacentHints) {
            if (hint.distance === "adjacent" || hint.distance === "nearby") {
              const coords = getAdjacentHexCoordinates(newCurrentQ, newCurrentR, hint.direction);
              
              // Check if hex already exists
              const existingHex = await storage.getExplorationHex(parseInt(campaignId), coords.q, coords.r);
              if (!existingHex) {
                const hintHexMeta = generateHexMetaFromKeywords(hint.environmentKeywords, []);
                await storage.createExplorationHex({
                  campaignId: parseInt(campaignId),
                  q: coords.q,
                  r: coords.r,
                  terrainType: hint.environmentKeywords[0] || "Unknown",
                  locationName: hint.description.slice(0, 50),
                  locationDescription: hint.description,
                  hexMeta: hintHexMeta,
                  isExplored: false,
                  isRevealed: true,
                  revealedAt: new Date().toISOString(),
                  narrativeContext: hint.description,
                  connectedDirections: []
                });
                console.log(`Revealed new hex at (${coords.q}, ${coords.r}) from narrative: ${hint.description.slice(0, 30)}...`);
              }
            }
          }
        }
      } catch (explorationError) {
        console.error("Failed to update exploration hexes:", explorationError);
        // Don't fail the request if exploration update fails
      }
      
      res.status(201).json({ 
        ...session, 
        discoveredQuest: discoveredQuest ? {
          id: discoveredQuest.id,
          title: discoveredQuest.title,
          discoveryContext: discoveredQuest.discoveryContext
        } : null 
      });
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
      const { context, playerAction, currentLocation, hexMetadata } = req.body;

      if (!context || !playerAction) {
        return res.status(400).json({ message: "Context and player action are required" });
      }
      
      // HexMetaV2: Build environment context from hex metadata
      let hexEnvironmentContext = "";
      if (hexMetadata) {
        const parts: string[] = [];
        if (hexMetadata.regionName) parts.push(`Region: ${hexMetadata.regionName}`);
        if (hexMetadata.narrativeTone) parts.push(`Atmosphere: ${hexMetadata.narrativeTone}`);
        if (hexMetadata.environmentTags?.length > 0) {
          parts.push(`Environment: ${hexMetadata.environmentTags.join(", ")}`);
        }
        if (hexMetadata.tension) parts.push(`Tension Level: ${hexMetadata.tension}%`);
        if (hexMetadata.tooltipNote) parts.push(`Note: ${hexMetadata.tooltipNote}`);
        if (hexMetadata.affordances) {
          const aff = hexMetadata.affordances;
          const topAffordances = Object.entries(aff)
            .sort(([,a], [,b]) => (b as number) - (a as number))
            .slice(0, 2)
            .map(([k]) => k);
          parts.push(`This location favors: ${topAffordances.join(", ")} scenes`);
        }
        if (parts.length > 0) {
          hexEnvironmentContext = `\nHEX ENVIRONMENT (the player's current map tile):\n${parts.join("\n")}\nIMPORTANT: Your scene description MUST reflect these environmental details. If the hex is "frost-touched", describe icy surfaces. If the atmosphere is "Watched", hint at unseen observers. Match your narrative to the hex properties.`;
        }
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
${hexEnvironmentContext}

Current Situation: ${context}
Last Player Action: ${actionDescription}
${isWaypointTravel(actionDescription) ? `
⚡ WAYPOINT MOVE DETECTED — This is a simple travel/movement action.
USE WAYPOINT MOVE TEMPERATURE (20-35 words max). Write a brief 1-2 sentence transition describing the journey and arrival.
Do NOT generate encounters, ambushes, dramatic events, or discoveries. Do NOT use dramatic language.
Keep it grounded: terrain, weather, a passing detail, then where they arrive.
Set sceneType to "Travel".
` : ''}

${skillCheckContinuation}

${currentSession ? `Previous Scene: ${currentSession.narrative}` : ''}

${participants?.length > 0 ? `Active NPCs/Characters: ${participants.map(p => p.character?.name || 'Unknown').join(', ')}` : ''}

${SCENE_GENERATION_CONSTRAINTS}

${SCENE_CHOICE_FRAMING}

CRITICAL INSTRUCTIONS:
You must carry forward the effects of player skill checks or major decisions. If players succeeded in a skill check, those effects should influence NPC behavior, environment changes, or story progression. Do not ignore previous choices. Refer to the result and build new tension from it.

TASK: Generate the next scene for the DM to describe, including:
- Vivid location description
- NPC emotional reactions (if applicable)
- Narrative development based on the player action
- Three meaningful player options with VARIED resolution modes (not just combat)

Respond in structured JSON format for structured consequence tracking:
{
  "scene": "Detailed description of what happens next reflecting the skill check outcome (3-4 paragraphs)",
  "sceneType": "Exploration|Social|Discovery|Travel|Puzzle|Downtime|Combat",
  "npc_reactions": {
    "npc_name": "reaction description showing how they respond to the skill check result"
  },
  "environment": "Updated environment description showing changes from player actions (MUST reference hex environment tags if provided)",
  "currentRegion": "Name of the current map region (use from HEX ENVIRONMENT if provided)",
  "options": [
    {
      "label": "Action description that references the physical space (e.g., 'Examine the frost-touched altar' not 'Look around')",
      "path_type": "Exploration|Investigation|Stealth|Combat|Dialogue|Ingenuity",
      "resolutionMode": "Dialogue|Investigation|Ingenuity|Stealth|Endurance|Violence",
      "risk": "Low|Medium|High",
      "effect": "Brief description of potential outcome",
      "consequence": "Specific result of choosing this path",
      "hexDirection": "Optional: direction to adjacent hex (north|south|east|west|deeper|back) if this choice involves movement",
      "requiresDiceRoll": boolean,
      "diceType": "d20|d6|etc (if dice roll required)",
      "rollDC": number,
      "rollPurpose": "What the roll is for"
    }
  ],
  "atmosphereShift": "Optional: if the scene changes the hex atmosphere, describe the new feeling (e.g., 'The chamber grows colder')",
  "dmNotes": "Private notes for the DM about consequences, hidden information, or plot hooks arising from the skill check"
}`;

      const { client: openaiClient, model: aiModel } = await getAIClient(req.user?.id);
      
      const response = await openaiClient.chat.completions.create({
        model: aiModel,
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
      const { prompt, narrativeStyle, difficulty, storyDirection, campaignId, currentLocation, hexMetadata } = req.body;

      // Get campaign and character information for context if provided
      let campaignContext = "";
      let locationContext = "";
      
      // HexMetaV2: Build environment context from hex metadata
      let hexEnvironmentContext = "";
      if (hexMetadata) {
        const parts: string[] = [];
        if (hexMetadata.regionName) parts.push(`Region: ${hexMetadata.regionName}`);
        if (hexMetadata.narrativeTone) parts.push(`Atmosphere: ${hexMetadata.narrativeTone}`);
        if (hexMetadata.environmentTags?.length > 0) {
          parts.push(`Environment: ${hexMetadata.environmentTags.join(", ")}`);
        }
        if (hexMetadata.tension) parts.push(`Tension Level: ${hexMetadata.tension}%`);
        if (hexMetadata.tooltipNote) parts.push(`Note: ${hexMetadata.tooltipNote}`);
        if (hexMetadata.affordances) {
          const aff = hexMetadata.affordances;
          const topAffordances = Object.entries(aff)
            .sort(([,a], [,b]) => (b as number) - (a as number))
            .slice(0, 2)
            .map(([k]) => k);
          parts.push(`This location favors: ${topAffordances.join(", ")} scenes`);
        }
        if (parts.length > 0) {
          hexEnvironmentContext = `\nHEX ENVIRONMENT:\n${parts.join("\n")}\nIMPORTANT: Your narrative MUST reflect these environmental details. Match your description to the hex properties.`;
        }
      }
      
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
${hexEnvironmentContext}
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
- choices: An array of 4 objects. If the narrative presents a moral dilemma or decision fork, at least 2 choices MUST represent opposing sides of that decision — do NOT replace them with generic utility actions. Each with:
  - action: A short description of a possible action
  - description: A brief explanation of what this action entails 
  - icon: A simple icon identifier (use: "search", "hand-sparkles", "running", "sword", "door", "treasure", "key", "talk", or any basic icon name)
  - requiresDiceRoll: Boolean indicating if this action requires a dice roll
  - diceType: If requiresDiceRoll is true, include the type of dice to roll ("d20" for most skill checks)
  - rollDC: If requiresDiceRoll is true, include the DC/difficulty (10-15 for most, 16-20 for hard)
  - skillType: The skill or ability used. IMPORTANT: Match the skill to the action type:
    * Social/talking: "persuasion", "deception", "intimidation", "insight"
    * Searching/noticing: "perception", "investigation"  
    * Sneaking/hiding: "stealth"
    * Physical challenges: "athletics" (climbing, jumping, swimming), "acrobatics" (balance, tumbling)
    * Knowledge: "arcana" (magic), "history", "religion", "nature"
    * Other: "survival", "medicine", "animal_handling"
  - rollPurpose: A short explanation of what the roll is for (e.g., "Perception Check", "Persuasion Check", "Stealth Check")
  - successText: Brief text to display on a successful roll
  - failureText: Brief text to display on a failed roll
- questUpdate: Optional object with quest progress. Include if this action completes or advances a quest:
  - questCompleted: Boolean if a quest milestone was achieved
  - questTitle: Title of the completed quest
  - xpReward: XP to award (50-300 for milestones)
  - goldReward: Gold to award (10-100)
  - silverReward: Silver to award (10-50, for smaller rewards or change)
  - lootItems: Array of item names found (1-3 items like "Health Potion", "Shortsword +1", "Ruby Ring")
- treasureFound: Optional array of treasure/items discovered in this scene (only if exploration reveals treasure)
`;

      const { client: openaiClient, model: aiModel } = await getAIClient(req.user?.id);
      
      const response = await openaiClient.chat.completions.create({
        model: aiModel,
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
      
      // Get existing character names to ensure uniqueness
      const existingCharacters = await storage.getCharactersByUserId(req.user.id);
      const existingNames = existingCharacters.map(c => c.name);
      
      // Also get all character names in the database for global uniqueness
      const allCharacters = await storage.getAllCharacters();
      const allUsedNames = allCharacters.map(c => c.name);

      const characterPrompt = `
Generate a unique and compelling character concept for a Dungeons & Dragons 5th Edition game. 
${prompt ? `Additional requirements: ${prompt}` : ""}

IMPORTANT - Name Uniqueness Requirements:
- The name MUST be completely unique and NOT match any of these already-used names: ${allUsedNames.length > 0 ? allUsedNames.join(', ') : 'none yet'}
- Create an original, creative fantasy name that has never been used before
- Do NOT use common fantasy names like "Aric", "Thorin", "Elara", "Lyra" unless very distinctive
- Combine unusual syllables or draw from obscure mythologies for truly unique names

Return your response as a JSON object with these fields:
- name: A fantasy-appropriate UNIQUE name for the character (must not match any existing names listed above)
- race: A D&D race (Human, Elf, Dwarf, Halfling, etc.)
- class: A D&D class (Fighter, Wizard, Rogue, etc.)
- background: A D&D background (Soldier, Sage, Criminal, etc.)
- alignment: The character's alignment (Lawful Good, Chaotic Neutral, etc.)
- personality: A brief description of personality traits
- backstory: A short paragraph about the character's history
`;

      const { client: openaiClient, model: aiModel } = await getAIClient(req.user?.id);
      
      const response = await openaiClient.chat.completions.create({
        model: aiModel,
        messages: [{ role: "user", content: characterPrompt }],
        response_format: { type: "json_object" },
        max_tokens: 1000,
      });

      const characterData = JSON.parse(response.choices[0].message.content);
      
      // Double-check uniqueness - if name already exists, append a unique suffix
      if (allUsedNames.some(n => n.toLowerCase() === characterData.name.toLowerCase())) {
        const suffix = Math.random().toString(36).substring(2, 5);
        characterData.name = `${characterData.name} ${suffix.charAt(0).toUpperCase() + suffix.slice(1)}`;
      }
      
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

      const { client: openaiClient, model: aiModel } = await getAIClient(req.user?.id);
      
      const response = await openaiClient.chat.completions.create({
        model: aiModel,
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
            // Use campaign-specific HP/status from campaign_npcs, fallback to base NPC values
            character: {
              id: npc.id,
              name: npc.name,
              race: npc.race,
              class: npc.occupation,
              level: npc.level || 1,
              portraitUrl: npc.portraitUrl,
              hitPoints: campaignNpc.currentHp ?? npc.hitPoints,
              maxHitPoints: campaignNpc.maxHp ?? npc.maxHitPoints,
              armorClass: npc.armorClass,
              gold: npc.gold || 0,
              status: campaignNpc.status ?? npc.status,
              companionType: npc.companionType,
              occupation: npc.occupation
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
        userId: targetUserId,
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
      
      // Check if this specific character is already in the campaign
      const existingParticipant = await storage.getCampaignParticipantByCharacter(campaignId, validatedData.characterId);
      if (existingParticipant) {
        return res.status(400).json({ message: "This character is already in this campaign" });
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
  
  // Use consumable for NPC
  app.post("/api/npcs/:id/consumables/use", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "Consumable name is required" });
      }
      
      const npc = await storage.getNpc(id);
      if (!npc) {
        return res.status(404).json({ message: "NPC not found" });
      }
      
      if (npc.status === "dead") {
        return res.status(400).json({ message: "Dead NPCs cannot use items." });
      }
      
      const consumables: any[] = Array.isArray(npc.consumables) 
        ? npc.consumables 
        : (typeof npc.consumables === 'string' ? JSON.parse(npc.consumables as string) : []);
      const itemIndex = consumables.findIndex(c => c.name === name);
      
      if (itemIndex === -1) {
        return res.status(404).json({ message: "Consumable not found" });
      }
      
      const item = consumables[itemIndex];
      let resultMessage = "";
      let healedAmount = 0;
      const currentHP = npc.hitPoints ?? 0;
      const maxHP = npc.maxHitPoints ?? 10;
      let newHP = currentHP;
      let newStatus = npc.status || "conscious";
      
      // Apply effect based on healDice - check for healDice regardless of type
      // (some potions may have type "consumable" instead of "healing")
      if (item.healDice) {
        const diceRoll = rollDice(item.healDice);
        healedAmount = diceRoll + (item.healBonus || 0);
        newHP = Math.min(maxHP, currentHP + healedAmount);
        
        // If unconscious/stabilized and healed above 0, become conscious
        if (newHP > 0 && (npc.status === "unconscious" || npc.status === "stabilized")) {
          newStatus = "conscious";
          resultMessage = `${npc.name} used ${name}! Healed ${healedAmount} HP and regained consciousness! (${currentHP} → ${newHP})`;
        } else {
          resultMessage = `${npc.name} used ${name}! Healed ${healedAmount} HP (${currentHP} → ${newHP}).`;
        }
      } else {
        resultMessage = `${npc.name} used ${name}! ${item.effect}`;
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
      
      // Always update HP if healing was applied
      if (healedAmount > 0) {
        updateData.hitPoints = newHP;
        updateData.status = newStatus;
      }
      
      const updatedNpc = await storage.updateNpc(id, updateData);
      
      res.json({
        npc: updatedNpc,
        healedAmount,
        newHP,
        message: resultMessage
      });
    } catch (error: any) {
      console.error("Error using NPC consumable:", error);
      res.status(500).json({ message: "Failed to use consumable", error: error.message });
    }
  });
  
  // Transfer consumable from character to campaign NPC companion
  app.post("/api/campaigns/:campaignId/transfer-consumable", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const { fromCharacterId, toNpcId, consumableName } = req.body;
      
      if (!fromCharacterId || !toNpcId || !consumableName) {
        return res.status(400).json({ message: "fromCharacterId, toNpcId, and consumableName are required" });
      }
      
      // Get source character
      const character = await storage.getCharacter(fromCharacterId);
      if (!character) {
        return res.status(404).json({ message: "Source character not found" });
      }
      
      // Get campaign NPC
      const campaignNpc = await storage.getCampaignNpc(campaignId, toNpcId);
      if (!campaignNpc) {
        return res.status(404).json({ message: "NPC not in this campaign" });
      }
      
      if (campaignNpc.role !== 'companion' && campaignNpc.role !== 'ally') {
        return res.status(400).json({ message: "Can only give items to companion or ally NPCs" });
      }
      
      // Get the NPC details
      const npc = await storage.getNpc(toNpcId);
      if (!npc) {
        return res.status(404).json({ message: "NPC not found" });
      }
      
      // Check if character has the consumable
      const characterConsumables: any[] = Array.isArray((character as any).consumables) 
        ? (character as any).consumables 
        : [];
      const itemIndex = characterConsumables.findIndex(c => c.name === consumableName);
      
      if (itemIndex === -1) {
        return res.status(400).json({ message: "Consumable not found in character inventory" });
      }
      
      const item = { ...characterConsumables[itemIndex] };
      
      // Remove from character (reduce quantity or remove entirely)
      if (item.quantity <= 1) {
        characterConsumables.splice(itemIndex, 1);
      } else {
        characterConsumables[itemIndex].quantity -= 1;
      }
      
      // Add to NPC (campaign NPC consumables)
      const npcConsumables: any[] = Array.isArray(campaignNpc.consumables) 
        ? [...campaignNpc.consumables as any[]] 
        : [];
      
      const existingIndex = npcConsumables.findIndex(c => c.name === consumableName);
      if (existingIndex >= 0) {
        npcConsumables[existingIndex].quantity = (npcConsumables[existingIndex].quantity || 1) + 1;
      } else {
        npcConsumables.push({ ...item, quantity: 1 });
      }
      
      // Update character
      await storage.updateCharacter(fromCharacterId, {
        consumables: characterConsumables,
        updatedAt: new Date().toISOString()
      });
      
      // Update campaign NPC
      await storage.updateCampaignNpc(campaignNpc.id, {
        consumables: npcConsumables
      });
      
      res.json({
        success: true,
        message: `Gave ${consumableName} to ${npc.name}`,
        characterConsumables,
        npcConsumables
      });
    } catch (error: any) {
      console.error("Error transferring consumable:", error);
      res.status(500).json({ message: "Failed to transfer consumable", error: error.message });
    }
  });
  
  // Transfer gold from character to NPC companion
  app.post("/api/campaigns/:campaignId/transfer-gold", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const { fromCharacterId, toNpcId, amount } = req.body;
      
      if (!fromCharacterId || !toNpcId || amount === undefined) {
        return res.status(400).json({ message: "fromCharacterId, toNpcId, and amount are required" });
      }
      
      const goldAmount = parseInt(amount);
      if (isNaN(goldAmount) || goldAmount <= 0) {
        return res.status(400).json({ message: "Amount must be a positive number" });
      }
      
      // Get source character
      const character = await storage.getCharacter(fromCharacterId);
      if (!character) {
        return res.status(404).json({ message: "Source character not found" });
      }
      
      // Check if character has enough gold
      const characterGold = character.gold || 0;
      if (characterGold < goldAmount) {
        return res.status(400).json({ message: `Not enough gold. You have ${characterGold} gold.` });
      }
      
      // Get campaign NPC
      const campaignNpc = await storage.getCampaignNpc(campaignId, toNpcId);
      if (!campaignNpc) {
        return res.status(404).json({ message: "NPC not in this campaign" });
      }
      
      if (campaignNpc.role !== 'companion' && campaignNpc.role !== 'ally') {
        return res.status(400).json({ message: "Can only give gold to companion or ally NPCs" });
      }
      
      // Get the NPC details
      const npc = await storage.getNpc(toNpcId);
      if (!npc) {
        return res.status(404).json({ message: "NPC not found" });
      }
      
      // Update character gold
      await storage.updateCharacter(fromCharacterId, {
        gold: characterGold - goldAmount,
        updatedAt: new Date().toISOString()
      });
      
      // Update campaign NPC gold
      const npcGold = campaignNpc.gold || 0;
      await storage.updateCampaignNpc(campaignNpc.id, {
        gold: npcGold + goldAmount
      });
      
      res.json({
        success: true,
        message: `Gave ${goldAmount} gold to ${npc.name}`,
        characterGold: characterGold - goldAmount,
        npcGold: npcGold + goldAmount
      });
    } catch (error: any) {
      console.error("Error transferring gold:", error);
      res.status(500).json({ message: "Failed to transfer gold", error: error.message });
    }
  });
  
  // Campaign NPC Short Rest - heal 25% of max HP
  app.post("/api/campaigns/:campaignId/npcs/:npcId/short-rest", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const npcId = parseInt(req.params.npcId);
      
      // Get campaign NPC
      const campaignNpc = await storage.getCampaignNpc(campaignId, npcId);
      if (!campaignNpc) {
        return res.status(404).json({ message: "NPC not in this campaign" });
      }
      
      // Check campaign is not in combat
      const campaign = await storage.getCampaign(campaignId);
      if (campaign) {
        const storyState = typeof campaign.storyState === 'string' ? JSON.parse(campaign.storyState) : campaign.storyState;
        if (storyState?.inCombat) {
          return res.status(400).json({ message: "Cannot rest during combat" });
        }
      }
      
      const npc = await storage.getNpc(npcId);
      if (!npc) {
        return res.status(404).json({ message: "NPC not found" });
      }
      
      const currentHp = campaignNpc.currentHp ?? npc.hitPoints ?? 0;
      const maxHp = campaignNpc.maxHp ?? npc.maxHitPoints ?? 10;
      const status = campaignNpc.status || "conscious";
      
      if (status === "dead") {
        return res.status(400).json({ message: "Dead NPCs cannot rest." });
      }
      if (status === "unconscious") {
        return res.status(400).json({ message: "Unconscious NPCs must be stabilized or healed first." });
      }
      
      // Short rest: Heal 25% of max HP (minimum 1)
      const healAmount = Math.max(1, Math.floor(maxHp * 0.25));
      const newHp = Math.min(maxHp, currentHp + healAmount);
      const actualHeal = newHp - currentHp;
      
      let newStatus = status;
      if (newHp > 0 && status === "stabilized") {
        newStatus = "conscious";
      }
      
      await storage.updateCampaignNpc(campaignNpc.id, {
        currentHp: newHp,
        status: newStatus
      });
      
      res.json({
        npcId,
        npcName: npc.name,
        healedAmount: actualHeal,
        currentHp: newHp,
        maxHp,
        status: newStatus,
        message: `${npc.name} completed a short rest. Recovered ${actualHeal} HP.`
      });
    } catch (error: any) {
      console.error("Error during NPC short rest:", error);
      res.status(500).json({ message: "Failed to complete short rest", error: error.message });
    }
  });
  
  // Campaign NPC Long Rest - fully restore HP
  app.post("/api/campaigns/:campaignId/npcs/:npcId/long-rest", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const npcId = parseInt(req.params.npcId);
      
      // Get campaign NPC
      const campaignNpc = await storage.getCampaignNpc(campaignId, npcId);
      if (!campaignNpc) {
        return res.status(404).json({ message: "NPC not in this campaign" });
      }
      
      // Check campaign is not in combat
      const campaign = await storage.getCampaign(campaignId);
      if (campaign) {
        const storyState = typeof campaign.storyState === 'string' ? JSON.parse(campaign.storyState) : campaign.storyState;
        if (storyState?.inCombat) {
          return res.status(400).json({ message: "Cannot rest during combat" });
        }
      }
      
      const npc = await storage.getNpc(npcId);
      if (!npc) {
        return res.status(404).json({ message: "NPC not found" });
      }
      
      const currentHp = campaignNpc.currentHp ?? npc.hitPoints ?? 0;
      const maxHp = campaignNpc.maxHp ?? npc.maxHitPoints ?? 10;
      const actualHeal = maxHp - currentHp;
      
      await storage.updateCampaignNpc(campaignNpc.id, {
        currentHp: maxHp,
        status: "conscious"
      });
      
      res.json({
        npcId,
        npcName: npc.name,
        healedAmount: actualHeal,
        currentHp: maxHp,
        maxHp,
        status: "conscious",
        message: `${npc.name} completed a long rest. Fully restored to ${maxHp} HP.`
      });
    } catch (error: any) {
      console.error("Error during NPC long rest:", error);
      res.status(500).json({ message: "Failed to complete long rest", error: error.message });
    }
  });
  
  // Use consumable for campaign NPC (uses campaign-specific HP)
  app.post("/api/campaigns/:campaignId/npcs/:npcId/consumables/use", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const npcId = parseInt(req.params.npcId);
      const { name } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "Consumable name is required" });
      }
      
      // Get campaign NPC
      const campaignNpc = await storage.getCampaignNpc(campaignId, npcId);
      if (!campaignNpc) {
        return res.status(404).json({ message: "NPC not in this campaign" });
      }
      
      const npc = await storage.getNpc(npcId);
      if (!npc) {
        return res.status(404).json({ message: "NPC not found" });
      }
      
      const status = campaignNpc.status || "conscious";
      if (status === "dead") {
        return res.status(400).json({ message: "Dead NPCs cannot use items." });
      }
      
      // Get consumables from campaign NPC
      const consumables: any[] = Array.isArray(campaignNpc.consumables) 
        ? [...campaignNpc.consumables as any[]] 
        : [];
      const itemIndex = consumables.findIndex(c => c.name === name);
      
      if (itemIndex === -1) {
        return res.status(404).json({ message: "Consumable not found in NPC inventory" });
      }
      
      const item = consumables[itemIndex];
      let resultMessage = "";
      let healedAmount = 0;
      const currentHp = campaignNpc.currentHp ?? npc.hitPoints ?? 0;
      const maxHp = campaignNpc.maxHp ?? npc.maxHitPoints ?? 10;
      let newHp = currentHp;
      let newStatus = status;
      
      // Apply healing effect - check for healDice regardless of type
      // (some potions may have type "consumable" instead of "healing")
      if (item.healDice) {
        const diceRoll = rollDice(item.healDice);
        healedAmount = diceRoll + (item.healBonus || 0);
        newHp = Math.min(maxHp, currentHp + healedAmount);
        
        if (newHp > 0 && (status === "unconscious" || status === "stabilized")) {
          newStatus = "conscious";
          resultMessage = `${npc.name} used ${name}! Healed ${healedAmount} HP and regained consciousness! (${currentHp} → ${newHp})`;
        } else {
          resultMessage = `${npc.name} used ${name}! Healed ${healedAmount} HP (${currentHp} → ${newHp}).`;
        }
      } else {
        resultMessage = `${npc.name} used ${name}! ${item.effect || ''}`;
      }
      
      // Reduce quantity or remove
      if (item.quantity <= 1) {
        consumables.splice(itemIndex, 1);
      } else {
        consumables[itemIndex].quantity -= 1;
      }
      
      // Update campaign NPC
      await storage.updateCampaignNpc(campaignNpc.id, {
        consumables,
        currentHp: newHp,
        status: newStatus
      });
      
      res.json({
        npcId,
        npcName: npc.name,
        consumables,
        healedAmount,
        currentHp: newHp,
        maxHp,
        status: newStatus,
        message: resultMessage
      });
    } catch (error: any) {
      console.error("Error using campaign NPC consumable:", error);
      res.status(500).json({ message: "Failed to use consumable", error: error.message });
    }
  });
  
  // Add consumable to NPC (quick-buy) - deducts from NPC gold
  app.post("/api/campaigns/:campaignId/npcs/:npcId/consumables/add", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const npcId = parseInt(req.params.npcId);
      const { name, quantity = 1 } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "Consumable name is required" });
      }
      
      // Get campaign NPC
      const campaignNpc = await storage.getCampaignNpc(campaignId, npcId);
      if (!campaignNpc) {
        return res.status(404).json({ message: "NPC not in this campaign" });
      }
      
      const npc = await storage.getNpc(npcId);
      if (!npc) {
        return res.status(404).json({ message: "NPC not found" });
      }
      
      // Get the consumable info - reuse CONSUMABLE_EFFECTS from player endpoint (defined earlier in this file)
      const effectInfo = CONSUMABLE_EFFECTS[name];
      if (!effectInfo) {
        return res.status(400).json({ message: "Unknown consumable type" });
      }
      
      // Calculate total cost and check NPC gold
      const totalCost = effectInfo.price * quantity;
      const npcGold = (campaignNpc as any).gold ?? (npc as any).gold ?? 0;
      
      if (npcGold < totalCost) {
        return res.status(400).json({ 
          message: `Not enough gold! ${npc.name} needs ${totalCost} gp but only has ${npcGold} gp.`,
          required: totalCost,
          available: npcGold
        });
      }
      
      // Get current consumables from campaign NPC
      const consumables: any[] = Array.isArray(campaignNpc.consumables) 
        ? [...campaignNpc.consumables as any[]] 
        : [];
      
      const existing = consumables.find(c => c.name === name);
      
      if (existing) {
        existing.quantity += quantity;
        if (effectInfo.healDice && !existing.healDice) {
          existing.healDice = effectInfo.healDice;
        }
        if (effectInfo.healBonus !== undefined && existing.healBonus === undefined) {
          existing.healBonus = effectInfo.healBonus;
        }
      } else {
        const newConsumable: any = {
          name,
          quantity,
          type: effectInfo.type,
          effect: effectInfo.effect
        };
        if (effectInfo.healDice) {
          newConsumable.healDice = effectInfo.healDice;
        }
        if (effectInfo.healBonus !== undefined) {
          newConsumable.healBonus = effectInfo.healBonus;
        }
        consumables.push(newConsumable);
      }
      
      // Deduct gold and update campaign NPC
      const newGold = npcGold - totalCost;
      await storage.updateCampaignNpc(campaignNpc.id, {
        consumables,
        gold: newGold
      });
      
      res.json({
        npcId,
        npcName: npc.name,
        consumables,
        goldSpent: totalCost,
        goldRemaining: newGold,
        message: `${npc.name} purchased ${quantity}x ${name} for ${totalCost} gp. (${newGold} gp remaining)`
      });
    } catch (error: any) {
      console.error("Error adding consumable to campaign NPC:", error);
      res.status(500).json({ message: "Failed to add consumable", error: error.message });
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
      
      // Default healing potions for companions
      const defaultInventory = [
        {
          name: "Potion of Healing",
          type: "potion",
          rarity: "common",
          description: "Restores 2d4+2 hit points when consumed",
          properties: "Consumable, healing",
          quantity: 2
        }
      ];
      
      const campaignNpcData = insertCampaignNpcSchema.parse({
        campaignId,
        npcId,
        role: req.body.role || 'companion',
        turnOrder: req.body.turnOrder,
        isActive: true,
        joinedAt: new Date().toISOString(),
        inventory: req.body.inventory || defaultInventory
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

  app.get("/api/campaigns/:campaignId/narrative-insights", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Only DM can view narrative insights
      if (campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the DM can view narrative insights" });
      }
      
      // Return cached insights from session storyState
      const sessions = await storage.getCampaignSessions(campaignId);
      const currentSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;
      
      if (!currentSession) {
        return res.json([]);
      }
      
      const storyState = currentSession.storyState as any || {};
      const insights = storyState.narrativeInsights || [];
      
      res.json(insights);
    } catch (error) {
      console.error("Error fetching narrative insights:", error);
      res.status(500).json({ message: "Failed to fetch narrative insights" });
    }
  });
  
  // Generate new narrative insights using AI
  app.post("/api/campaigns/:campaignId/generate-narrative-insights", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Only DM can generate insights
      if (campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the DM can generate narrative insights" });
      }
      
      // Get current session and story state
      const sessions = await storage.getCampaignSessions(campaignId);
      const currentSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;
      
      if (!currentSession) {
        return res.json([]);
      }
      
      const storyState = currentSession.storyState as any || {};
      const quests = await storage.getCampaignQuests(campaignId);
      const participants = await storage.getCampaignParticipants(campaignId);
      
      // Build context for AI
      const activeQuests = [...quests.filter(q => q.status === 'active'), ...(storyState.activeQuests || [])];
      const completedQuests = quests.filter(q => q.status === 'completed');
      const partyMembers = storyState.partyMembers || [];
      const journeyLog = storyState.journeyLog || [];
      const currentLocation = storyState.currentLocation || storyState.location || 'Unknown';
      const inCombat = storyState.inCombat || false;
      const combatants = storyState.combatants || [];
      
      const prompt = `You are an expert D&D Dungeon Master analyzing a campaign to provide narrative insights.

CAMPAIGN: "${campaign.title}"
DESCRIPTION: ${campaign.description}
CURRENT CHAPTER: ${currentSession.sessionNumber} of ${campaign.totalChapters || 5}
CURRENT LOCATION: ${currentLocation}
IN COMBAT: ${inCombat}

ACTIVE QUESTS (${activeQuests.length}):
${activeQuests.map((q: any) => `- ${q.title}: ${q.description}`).join('\n') || 'None'}

COMPLETED QUESTS: ${completedQuests.length}

PARTY STATUS:
${partyMembers.map((p: any) => `- ${p.name} (${p.type}): HP ${p.currentHp}/${p.maxHp}, Status: ${p.status}`).join('\n') || 'No party data'}

${inCombat ? `ENEMIES IN COMBAT:\n${combatants.filter((c: any) => c.type === 'enemy').map((e: any) => `- ${e.name}: HP ${e.currentHp}/${e.maxHp}`).join('\n')}` : ''}

RECENT EVENTS (last 5):
${journeyLog.slice(-5).map((entry: any) => `- ${entry.text || entry.message || JSON.stringify(entry)}`).join('\n') || 'No recent events'}

Analyze this campaign state and provide 3-4 narrative insights for the DM. Each insight should be one of these types:
- "critical": Urgent narrative junctures requiring immediate DM attention
- "opportunity": Potential story developments or character moments
- "warning": Issues that could derail the story or cause problems
- "milestone": Achievements or progress worth celebrating

Return JSON array:
[
  {
    "type": "critical|opportunity|warning|milestone",
    "title": "Brief insight title",
    "description": "Detailed explanation of the insight",
    "suggestion": "Optional action the DM could take"
  }
]

Focus on:
1. Story pacing and tension
2. Quest progression
3. Party health and resource management
4. Potential plot hooks or character arcs
5. Combat tactical considerations (if in combat)`;

      const { client: openaiClient, model: aiModel } = await getAIClient(req.user?.id);
      const response = await openaiClient.chat.completions.create({
        model: aiModel,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 800,
      });
      
      let insights = [];
      try {
        const parsed = JSON.parse(response.choices[0].message.content || '{}');
        insights = Array.isArray(parsed) ? parsed : (parsed.insights || []);
      } catch (e) {
        console.error("Failed to parse narrative insights:", e);
        insights = [];
      }
      
      // Cache the insights in session storyState
      if (currentSession) {
        const currentStoryState = currentSession.storyState as any || {};
        await storage.updateSessionStoryState(campaignId, currentSession.sessionNumber, {
          ...currentStoryState,
          narrativeInsights: insights,
          insightsGeneratedAt: new Date().toISOString()
        });
      }
      
      res.json(insights);
    } catch (error) {
      console.error("Error generating narrative insights:", error);
      res.status(500).json({ message: "Failed to generate narrative insights" });
    }
  });

  // Complete Campaign Generation endpoint - generates CAML 2.0 format with retry
  app.post("/api/campaigns/generate-complete", isAuthenticated, async (req: any, res) => {
    try {
      const { type, level, length, theme, customPrompt } = req.body;

      if (!type || !level || !length || !theme) {
        return res.status(400).json({ message: "Missing required campaign parameters" });
      }

      const adventureId = `adventure.${theme.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
      const timestamp = new Date().toISOString();
      const minLevel = parseInt(level.split('-')[0]) || 1;
      const maxLevel = parseInt(level.split('-')[1]) || minLevel + 4;
      
      // Content requirements based on length
      const contentReqs = length === 'Short (1-3 sessions)' 
        ? { locations: 3, npcs: 3, processes: 2, items: 2 }
        : length === 'Medium (4-8 sessions)'
        ? { locations: 5, npcs: 5, processes: 4, items: 3 }
        : { locations: 8, npcs: 8, processes: 6, items: 5 };

      // CAML 2.0 generation with retry logic
      const maxRetries = 2;
      let lastError = '';
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const systemPrompt = `You generate CAML 2.0 format adventures with REACTIVE ARCHITECTURE. CAML 2.0 uses ontological layers, NOT flat arrays. Adventures must be reactive political/narrative simulators, NOT linear chapter-based modules.

CAML 2.0 EXACT SCHEMA (every field shown is REQUIRED):
{
  "caml_version": "2.0",
  "meta": { "id": "adventure.xxx", "title": "...", "authors": ["..."], "tags": ["..."], "levels": {"min": 1, "max": 5}, "summary": "A vivid 2-3 sentence synopsis — what players face, what's at stake, why it matters. Written like the back cover of a D&D module.", "table_of_contents": [{"chapter": 1, "title": "Evocative chapter title matching a process", "summary": "Brief description of what happens"}] },
  "doctrine": {
    "campaign_question": "A genuine dilemma, NOT a goal. E.g. 'Should the power beneath the ruins be destroyed, claimed, or passed on — and who bears the cost?' Must frame a choice with no clean answer.",
    "stakes": [
      {"id": "stake_1", "name": "...", "value": 2, "max": 5, "drift": "up", "driftRate": 0.2, "thresholdConsequence": {"at0": {"event": "...", "irreversible": false}, "at5": {"event": "...", "irreversible": true}}, "gameplayEffects": {"at2": "Description of how this stake level changes NPC behavior, access, or difficulty", "at4": "Description of severe gameplay modification at high stake level"}},
      {"id": "stake_2", "name": "...", "value": 1, "max": 5, "drift": "up", "driftRate": 0.15, "thresholdConsequence": {"at0": {"event": "...", "irreversible": false}, "at5": {"event": "...", "irreversible": true}}, "gameplayEffects": {"at2": "...", "at4": "..."}}
    ]
  },
  "villain": {
    "id": "VIL_Name",
    "name": "Villain Name",
    "archetype": "Step-Based Conspiracy|Tyrant|Corruptor|Mastermind|Destroyer",
    "goal": "What the villain wants — specific and actionable",
    "motivation": "WHY — psychological drive, not just power",
    "resources": "What the villain has at their disposal (minions, magic, political power, wealth)",
    "weakness": "A specific exploitable vulnerability (arrogance, dependency, secret shame)",
    "planStructure": ["Stage 1: Gather intelligence", "Stage 2: Manipulate key NPC", "Stage 3: Seize the objective", "Stage 4: Consolidate power"],
    "currentStep": 0,
    "reactionTree": {
      "escalate": "How villain raises the stakes when thwarted (e.g. 'Kidnaps a key NPC to force compliance')",
      "redirect": "How villain changes approach entirely (e.g. 'Abandons direct assault, begins poisoning the water supply')",
      "retaliate": "How villain strikes back at the party directly (e.g. 'Sends assassins after the party's allies')",
      "accelerate": "How villain speeds up their plan with risky shortcuts (e.g. 'Performs incomplete ritual, risking catastrophe')"
    }
  },
  "framingEvent": {
    "type": "crisis|upheaval|revelation|threat",
    "description": "The inciting incident that kicks off the adventure — visible, urgent, and connected to the villain's plan",
    "publicVisibility": "What everyone knows about this event",
    "instabilityTarget": "Which stake this event threatens",
    "villainOpportunity": "How the villain exploits this chaos"
  },
  "complicationsQueue": {
    "moralQuandaries": [
      {"type": "quandary_1", "description": "A structural moral decision with no clean answer", "tradeoff": "What you gain vs what you lose", "stakeLink": {"increases": "stake_1", "decreases": "stake_2"}, "injectionTiming": "early|midpoint|climax", "isUsed": false}
    ],
    "twists": [
      {"type": "twist_1", "description": "A revelation that recontextualizes events", "revelation": "What is revealed and how", "consequence": "How this changes the situation", "injectionTiming": "midpoint|pre_climax", "isUsed": false}
    ],
    "environmentalModifiers": [
      {"type": "env_1", "description": "An environmental change that modifies gameplay", "mechanicalEffect": "Specific D&D mechanical impact (disadvantage, difficult terrain, etc.)", "isUsed": false}
    ]
  },
  "encounterDesigns": [
    {
      "id": "enc_1",
      "objective": "What makes this fight interesting beyond 'kill enemies'",
      "stakes": "What happens if the party loses (NOT 'game over' — world advances)",
      "terrainFeatures": ["elevated_positions", "destructible_cover", "hazardous_area"],
      "combatInterest": ["time_pressure", "civilian_protection", "multi_wave", "terrain_shifts"],
      "oppositionType": "Descriptive enemy composition",
      "difficultyTarget": "easy|medium|hard|deadly",
      "chapterPlacement": 1,
      "isUsed": false
    }
  ],
  "encounterBudget": {
    "partyLevel": 3,
    "mediumThreshold": 600,
    "hardThreshold": 900,
    "dailyBudget": 4800,
    "targetStrainRatio": 0.7,
    "restWindows": 2,
    "notes": "Brief pacing guidance"
  },
  "partyGoal": {
    "primary": "The main objective — specific, measurable",
    "secondary": "Optional side goal that complicates the primary",
    "hidden": "A truth the party doesn't know yet that changes the goal's meaning",
    "successState": "What the world looks like on full success",
    "partialSuccessState": "What the world looks like on partial success (most common outcome)",
    "failureState": "What the world looks like on failure — NOT game over, but world advances with consequences"
  },
  "world": {
    "entities": {
      "characters": [
        {"id": "PC_Party", "kind": "character", "pc": true},
        {"id": "NPC_Name", "kind": "character", "name": "...", "species": "...", "class": "...", "description": "..."}
      ],
      "locations": [
        {"id": "LOC_Name", "kind": "location", "name": "...", "description": "...", "tags": ["dungeon"], "features": ["..."]}
      ],
      "items": [
        {"id": "ITEM_Name", "kind": "item", "name": "...", "rarity": "rare", "description": "...", "consequence": "What cost or risk does using this item create? E.g. 'Increases ruin instability when activated'"}
      ],
      "factions": [
        {"id": "FACTION_Name", "kind": "faction", "name": "...", "goal": "What this faction wants — specific and actionable", "resources": "What they control (territory, wealth, magic, soldiers)", "disposition": "friendly|neutral|hostile|unknown", "reactionPolicy": {"ifPlayerHelps": "How faction responds to player aid", "ifPlayerHinders": "How faction responds to player interference", "ifRivalGains": "How faction responds to a rival gaining power"}}
      ]
    },
    "connections": [
      {"id": "CONN_1", "from": "LOC_A", "to": "LOC_B", "mode": "door"}
    ]
  },
  "powerNetwork": {
    "groups": [
      {"factionId": "FACTION_Name", "influence": 3, "maxInfluence": 5, "allies": [], "rivals": ["FACTION_Other"], "controlledLocations": ["LOC_Name"], "keyNpcs": ["NPC_Name"]}
    ],
    "consequenceChains": [
      {"trigger": "Specific player action or event (e.g. 'NPC_Guard killed', 'artifact stolen from LOC_Temple')", "immediate": "What happens right away", "ripple": "How this affects other factions/locations within hours", "cascade": "How the world reorganizes within days — power vacuums, alliances shift, new threats emerge"}
    ],
    "instabilityRules": [
      {"condition": "When faction influence reaches threshold or NPC removed", "effect": "How NPCs change behavior (prices, hostility, dialogue, quest availability)", "affectedLocations": ["LOC_Name"]}
    ]
  },
  "rivalAgent": {
    "id": "RIVAL_Name",
    "name": "...",
    "allegiance": "Which faction or independent",
    "goal": "Same or opposing objective to the party — creates race/interference",
    "methods": "How they operate (stealth, manipulation, brute force, deception)",
    "currentProgress": 0,
    "interferenceActions": ["Specific ways the rival can impede the party (steal clue, turn NPC, set trap, beat party to location)"],
    "alliancePossibility": "Under what conditions the rival could temporarily ally with the party"
  },
  "meterWorldEffects": [
    {"meterId": "stake_1", "thresholds": {"at1": {"environment": "Subtle atmospheric change", "npcBehavior": "Minor NPC nervousness or excitement"}, "at3": {"environment": "Visible physical changes to locations (weather, decay, growth)", "npcBehavior": "NPCs change routines, prices shift, new dialogue", "access": "Some paths open or close"}, "at5": {"environment": "Catastrophic transformation (terrain collapse, magical corruption, planar breach)", "npcBehavior": "NPCs flee, turn hostile, or transform", "access": "Major locations locked or destroyed, new areas revealed", "encounterModifier": "All encounters in affected areas gain new hazards or phases"}}}
  ],
  "dynamicClimax": {
    "assemblyRule": "How the final encounter is determined — which surviving factions, meter values, and player approach history shape it",
    "variations": [
      {"condition": "If faction X dominant and stake_1 >= 4", "encounter": "Description of this climax variant"},
      {"condition": "If rival agent allied and stake_2 <= 1", "encounter": "Description of alternative climax"},
      {"condition": "If most factions eliminated", "encounter": "Description of power-vacuum climax"}
    ],
    "approachPaths": [
      {"objective": "Major campaign objective", "approaches": ["stealth: description and consequences", "social: description and consequences", "force: description and consequences", "manipulation: description and consequences"]}
    ]
  },
  "state": {
    "facts": [
      {"id": "STATE_NPC_Attitude", "bearer": "NPC_Name", "type": "attitude", "value": "friendly"},
      {"id": "STATE_Quest_Status", "bearer": "adventure.xxx", "type": "quest_status", "value": "active"}
    ]
  },
  "roles": {
    "assignments": [
      {"id": "ROLE_QuestGiver", "role": "QuestGiver", "holder": "NPC_Name", "revocation": {"any": []}, "notes": "..."}
    ]
  },
  "processes": {
    "catalog": [
      {
        "id": "PROC_Name", "type": "combat", "timebox": {"id": "TB_1", "label": "..."},
        "participants": ["PC_Party", "NPC_Name"], "location": "LOC_Name", "notes": "...",
        "stake_effects": [{"stake_id": "stake_1", "delta": 1, "reason": "Combat escalates the threat"}],
        "activationConditions": ["Requires: stake_stability >= 2 OR players discover clue X"],
        "outcomes": {
          "success": "What changes on success — specific stake/state effects",
          "partial": "What changes on partial success — compromise outcome",
          "failure": "What changes on failure — world advances, villain gains, new threat emerges (NEVER game over)"
        }
      }
    ]
  },
  "transitions": {
    "changes": [
      {"id": "TR_Name", "caused_by": "PROC_Name", "ops": [{"op": "update_state", "state_id": "STATE_Quest_Status", "value": "complete"}]}
    ]
  },
  "snapshots": {
    "timeline": [
      {"id": "SNAP_Initial", "time_utc": "${timestamp}", "world_hash": "initial", "state_hash": "initial", "roles_hash": "initial", "narration": "Opening scene..."},
      {"id": "SNAP_Ending_A", "time_utc": "${timestamp}", "world_hash": "final_a", "state_hash": "final_a", "roles_hash": "final_a", "narration": "Ending where one stake is resolved but the other worsens. What is better? What is worse? What cannot be undone?", "derived_from_transition": "TR_EndingA", "nextArc": "What new campaign arc emerges from this ending — never terminal"},
      {"id": "SNAP_Ending_B", "time_utc": "${timestamp}", "world_hash": "final_b", "state_hash": "final_b", "roles_hash": "final_b", "narration": "Alternative ending with different tradeoffs. The opposite stake resolves but a new cost emerges.", "derived_from_transition": "TR_EndingB", "nextArc": "What different campaign arc emerges from this ending"}
    ]
  }
}

═══════════════════════════════════════════════════════════════════
GENRE-ADAPTIVE REACTIVE ARCHITECTURE (MANDATORY — every campaign genre must produce a living world):
═══════════════════════════════════════════════════════════════════

These requirements apply to ALL genres. The specific manifestation adapts to the theme:
- Intrigue/assassination → rival guilds, target networks, political consequence chains
- Mystery/investigation → suspect circles, evidence webs, deduction pressure
- War/conquest → armies, front lines, morale/supply cascades
- Heist/theft → security forces vs underworld, crew trust, escalating countermeasures
- Exploration/survival → competing expeditions, environmental factions (tribes, beasts), resource scarcity
- Horror/curse → corruption sources, infected NPCs, spreading affliction zones
- Political → noble houses, merchant guilds, religious orders, shifting alliances

1. POWER NETWORK (generalizes factions — required for ALL genres):
   - world.entities.factions: At least 2 competing power groups with goals, resources, and reactionPolicy
   - powerNetwork.groups: Each faction has influence (1-5), allies, rivals, controlled locations, key NPCs
   - powerNetwork.consequenceChains: At least 2 chains showing trigger → immediate → ripple → cascade effects
   - powerNetwork.instabilityRules: How disrupting one faction changes NPC behavior at specific locations
   - Factions must REACT to each other and to the party — not just sit in their assigned locations
   - When a faction loses a key NPC or location, connected factions respond (power vacuum, land grab, panic)

2. VILLAIN IS A SYSTEM (not a static boss):
   - villain.planStructure: 3-5 staged plan steps, each with a TRIGGER condition (state thresholds, events, time)
   - villain.reactionTree: 4 reactions (escalate/redirect/retaliate/accelerate) — each creates NEW problems and costs villain resources
   - Villain acts OFFSCREEN between scenes — their plan progresses whether players act or not
   - Villain is NEVER "the final boss waiting in the last room"
   - Villain RACES the party — competing for the same objective from a different angle

3. RIVAL AGENT (competing force — required for ALL genres):
   - rivalAgent: A specific NPC or group pursuing similar/opposing goals, creating time pressure and interference
   - Must have interferenceActions (specific ways they impede the party) and alliancePossibility (when temporary alliance works)
   - Genre examples: rival thief crew (heist), competing investigator (mystery), opposing general (war), rival expedition leader (exploration), cultist defector (horror)
   - The rival creates URGENCY — if the party stalls, the rival advances

4. CONSEQUENCE CHAINS (every action ripples — required for ALL genres):
   - Every significant player action (killing NPC, stealing item, revealing info, making alliance, destroying location) must have a defined consequence chain
   - Each chain has: trigger → immediate effect → ripple (hours) → cascade (days)
   - Removing an NPC: faction loses key asset → retaliation or power vacuum → world reorganizes
   - Stealing an artifact: owner faction retaliates → allied factions respond → security tightens everywhere
   - Revealing information: target NPC changes behavior → faction alliances shift → new opportunities/threats emerge
   - At least 2 consequence chains must be defined in powerNetwork.consequenceChains

5. STAKES AS ACTIVE WORLD DRIVERS (not passive meters):
   - Each stake must have "gameplayEffects" at thresholds (at2, at4) describing SPECIFIC changes:
     * at2: Moderate effects — NPC attitude shifts, new rumors, environmental warnings, travel checks
     * at4: Severe effects — locations lock/unlock, NPC betrayal, encounter difficulty increases, environmental hazards activate, villain gains reinforcements
   - Stakes are the ENGINE — they MODIFY encounters, access, NPC behavior, and difficulty in real time
   - Items/actions that increase a stake must have immediate observable effects, not just counter increments

6. METER-TO-WORLD TRANSFORMATION (meters change the physical world — required for ALL genres):
   - meterWorldEffects: Each stake/meter must specify PHYSICAL environment alterations at thresholds (at1, at3, at5)
   - at1: Subtle atmospheric changes, minor NPC nervousness
   - at3: Visible physical changes to locations, NPC routine changes, prices shift, paths open/close
   - at5: Catastrophic transformation — terrain collapse, magical corruption, planar breach, mass NPC transformation
   - Curse/corruption/suspicion/morale meters MUST alter the environment, not just be narrative flavor
   - Genre examples: corruption meter warps terrain (horror), suspicion meter locks shops/closes gates (heist), morale meter causes desertion/reinforcement (war)

7. PROCESSES ARE CONDITIONAL NODES (not sequential chapters):
   - Each process MUST have "activationConditions" — state requirements, clue counts, or stake thresholds
   - Processes can be reached in MULTIPLE ORDERS — never fixed linear sequence
   - Some processes may never trigger depending on player choices
   - Each process MUST have "outcomes" with success/partial/failure results
   - At least 2 processes must have ALTERNATIVE activation paths (reachable via different prerequisites)

8. DYNAMIC CLIMAX (final encounter is NEVER predetermined):
   - dynamicClimax.assemblyRule: How the final encounter is determined from surviving factions + meter values + player approach history
   - dynamicClimax.variations: At least 3 distinct climax variants based on different world states
   - dynamicClimax.approachPaths: Every major objective must have 3+ valid approaches (stealth/social/force/manipulation) with distinct consequence profiles
   - The climax should be ASSEMBLED from the world state, not pre-written and waiting
   - Genre examples: which crime lord controls the city (intrigue), which suspect is cornered (mystery), which front held (war), which vault approach succeeded (heist)

9. ENCOUNTER DESIGN AND BUDGET:
   - encounterBudget: party level, medium/hard XP thresholds, daily XP budget, rest windows, target strain ratio
   - encounterDesigns: each combat has SPECIFIC terrain features, combat interest modifiers, and opposition type
   - Climax encounters MUST be multi-wave or multi-phase
   - At least one encounter must have "multi_wave" or "terrain_shifts" in combatInterest
   - Environmental features must be SPECIFIC: "collapsing_columns", "rising_tide", "unstable_platforms" — not generic "terrain"

10. FAILURE ADVANCES THE WORLD (never blocks):
    - Every process.outcomes.failure must: advance villain plan stage, shift a stake, create a NEW threat or opportunity
    - Failure creates NEW playable content — not a dead end
    - The campaign continues through failure, just darker and with different options

11. MORAL QUANDARY ENGINE (accumulated, not one-shot):
    - At least 1 moral decision tied to a specific stake trade-off with stakeLink
    - Moral pressure must ACCUMULATE throughout the adventure
    - Each quandary must specify which stake it increases and which it decreases

12. NON-TERMINAL ENDINGS:
    - Every ending snapshot must include "nextArc" describing what campaign emerges from this ending
    - Endings TRANSFORM the world, they don't end it
    - The most dramatic endings emerge from stake thresholds hitting 5

13. STAKE CORRUPTION MECHANICS:
    - Each stake must have specific PLAYER ACTIONS that modify it (not just drift)
    - At stake value 5: catastrophic transformation event (NOT game over — new threats, transformed geography)

14. PRESSURE SYSTEM:
    - doctrine.campaign_question MUST be a DILEMMA — NOT a goal
    - doctrine.stakes with drift, threshold consequences, AND gameplay effects
    - framingEvent: the visible inciting incident
    - partyGoal with success/partial/failure states
    - Villain must be racing the party — both want the same thing

MODULE STRUCTURE (MANDATORY):
- meta.summary: vivid 2-3 sentence hook
- meta.table_of_contents: one entry per process/chapter

REQUIRED FIELDS (validation will fail without these):
- Every character/location/item MUST have "kind" field
- Every connection MUST have "id" and "mode" fields
- Every state fact MUST have "id" field
- Every role assignment MUST use "holder" (NOT "character_id") and have "id" field
- Every process MUST have "type" (combat/social/puzzle/exploration), "participants", "location"
- transitions.changes MUST NOT be empty
- snapshots.timeline MUST have at least 2 ending snapshots (forked endings), each with "nextArc" field
- villain MUST have planStructure (array of 3-5 steps with triggers) and reactionTree (4 reactions)
- encounterDesigns MUST have at least 1 entry with terrainFeatures (specific terrain) and combatInterest (including multi_wave or terrain_shifts)
- complicationsQueue MUST have at least 1 moralQuandary (with stakeLink) and 1 twist
- partyGoal MUST have primary, success, partialSuccessState, and failureState
- Each process MUST have activationConditions and outcomes (success/partial/failure)
- Each stake MUST have gameplayEffects with specific environmental/NPC/difficulty modifications
- world.entities.factions MUST have at least 2 factions with goals, resources, and reactionPolicy
- powerNetwork MUST have groups (with influence/rivals), consequenceChains (at least 2), and instabilityRules
- rivalAgent MUST have id, goal, interferenceActions, and alliancePossibility
- meterWorldEffects MUST map each stake to physical environment changes at thresholds (at1/at3/at5)
- dynamicClimax MUST have assemblyRule, at least 3 variations, and approachPaths with 3+ approaches per objective

FORBIDDEN (CAML 1.x / linear patterns):
- "type": "AdventureModule"
- Root-level "encounters", "quests", "npcs" arrays
- "attitude" property on characters
- "encounterType", "questGiver", "gates", "outcomes" as root keys, "startsAt", "occursAt"
- Clean endings where everything resolves perfectly
- Items that only grant power with no consequence
- Static bosses that wait at the end of a linear dungeon
- Sequential chapter progression (Village → Port → Ruins → Boss in fixed order)
- Passive stakes that never modify gameplay (cosmetic meters)
- Encounters without specific terrain or tactical interest
- Terminal endings that end the story with no continuation
- Single-wave combat encounters for climax fights
- Moral decisions that only happen once at the very end
- Predetermined final encounters (climax must be dynamically assembled)
- Worlds with only one power group (need competing factions)
- Meters/trackers that don't alter the physical environment
- Missing consequence chains for significant actions
- No rival agent creating urgency/interference

${attempt > 0 ? `PREVIOUS ATTEMPT FAILED: ${lastError}. Fix these issues.` : ''}`;

        const userPrompt = `Create a ${theme} adventure for D&D levels ${level}.

REQUIREMENTS:
- Adventure ID: "${adventureId}"
- ${contentReqs.locations} locations in world.entities.locations
- ${contentReqs.npcs} NPCs in world.entities.characters (plus PC_Party)
- ${contentReqs.processes} processes in processes.catalog
- ${contentReqs.items} items in world.entities.items
- All NPC attitudes in state.facts (NOT on character objects)
- Use SRD 5.1 content only

GENRE-ADAPTIVE REACTIVE WORLD (CRITICAL — without these the output is a static linear module):

POWER NETWORK (required):
- world.entities.factions: At least 2 competing power groups appropriate to the ${theme} genre, each with goals, resources, and reactionPolicy (ifPlayerHelps/ifPlayerHinders/ifRivalGains)
- powerNetwork.groups: Each faction has influence (1-5), allies, rivals, controlled locations, and key NPCs
- powerNetwork.consequenceChains: At least 2 defined chains — trigger (specific player action) → immediate → ripple (hours) → cascade (days)
- powerNetwork.instabilityRules: When a faction is disrupted, how NPCs at specific locations change behavior (prices, hostility, dialogue, quest availability)

RIVAL AGENT (required):
- rivalAgent: A specific competing NPC/group pursuing similar/opposing objectives, genre-appropriate to ${theme}
- Must include interferenceActions (steal clue, turn NPC, set trap, beat party to location) and alliancePossibility
- The rival creates URGENCY — if the party delays, the rival advances and changes the world state

VILLAIN SYSTEM (required):
- villain: Staged plan (3-5 steps with TRIGGER conditions), reaction tree (escalate/redirect/retaliate/accelerate), specific resources and weakness
- Villain RACES the party — competing for the same objective offscreen

CONSEQUENCE CHAINS (required):
- Every significant action must ripple through the power network
- Killing an NPC → faction retaliation → alliance shifts → world reorganization
- At least 2 consequence chains defined in powerNetwork.consequenceChains

METER-TO-WORLD TRANSFORMATION (required):
- meterWorldEffects: Each stake must map to PHYSICAL environment changes at thresholds:
  * at1: Subtle atmospheric changes, minor NPC nervousness
  * at3: Visible location changes, NPC routine shifts, prices change, paths open/close
  * at5: Catastrophic transformation — terrain collapse, corruption spread, mass NPC transformation, new areas revealed
- Meters MUST alter the physical world, not just be narrative flavor

DYNAMIC CLIMAX (required — final encounter must NOT be predetermined):
- dynamicClimax.assemblyRule: How surviving factions + meter values + player approach history determine the final encounter
- dynamicClimax.variations: At least 3 distinct climax variants for different world states
- dynamicClimax.approachPaths: Every major objective has 3+ valid approaches (stealth/social/force/manipulation) with distinct consequence profiles

OTHER REACTIVE SYSTEMS (all required):
- framingEvent: Visible inciting incident connected to villain's plan
- complicationsQueue: At least 1 moral quandary with stakeLink, 1 twist, 1 environmental modifier with D&D mechanical effects
- encounterDesigns: At least 1 combat with SPECIFIC terrainFeatures and combatInterest (multi_wave or terrain_shifts for climax)
- encounterBudget: Level-appropriate XP thresholds and daily budget with rest windows
- partyGoal: Primary/secondary/hidden goals with success/partial/failure world states
- Stakes must have gameplayEffects at2/at4 — at stake 5: catastrophic transformation, NOT game over
- Every process must have activationConditions and outcomes (success/partial/failure)
- At least 2 processes must have ALTERNATIVE activation paths
- Failure outcomes must advance villain plan and create new playable content
- Moral quandaries must ACCUMULATE throughout, not just one decision at the end

NON-TERMINAL ENDINGS (required):
- Every ending snapshot must have "nextArc" describing what new campaign arc emerges
- Endings TRANSFORM the world, they don't end it
- At least 2 forked ending snapshots with tradeoffs and nextArc

PRESSURE SYSTEM (required):
- doctrine.campaign_question: Frame a DILEMMA not a goal
- doctrine.stakes: At least 2 pressure tracks with drift, threshold consequences, gameplayEffects (at2/at4), and specific player actions
- At least 3 processes must include stake_effects
- Every item must have a "consequence" field

${customPrompt ? `THEME NOTES: ${customPrompt}` : ''}

Generate a complete CAML 2.0 JSON adventure with GENRE-ADAPTIVE REACTIVE ARCHITECTURE — a living world simulator where every action cascades, factions compete, meters transform the environment, and the climax is assembled from the world state. NOT a linear module.`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          response_format: { type: "json_object" },
          temperature: attempt === 0 ? 0.7 : 0.5, // Lower temp on retry
          max_tokens: 12000
        });

        const generatedContent = JSON.parse(completion.choices[0].message.content || '{}');

        // Validate CAML 2.0 structure
        const validationErrors: string[] = [];
        
        if (generatedContent.caml_version !== '2.0') {
          validationErrors.push('Missing caml_version: "2.0"');
        }
        if (!generatedContent.world?.entities) {
          validationErrors.push('Missing world.entities');
        }
        if (!generatedContent.state?.facts) {
          validationErrors.push('Missing state.facts');
        }
        if (!generatedContent.processes?.catalog) {
          validationErrors.push('Missing processes.catalog');
        }
        if (generatedContent.encounters) {
          validationErrors.push('Contains forbidden "encounters" array (CAML 1.x)');
        }
        if (generatedContent.quests) {
          validationErrors.push('Contains forbidden "quests" array (CAML 1.x)');
        }
        if (generatedContent.npcs) {
          validationErrors.push('Contains forbidden "npcs" array (CAML 1.x)');
        }
        if (generatedContent.type === 'AdventureModule') {
          validationErrors.push('Contains forbidden "type": "AdventureModule" (CAML 1.x)');
        }
        
        // Check for attitude on NPCs
        const characters = generatedContent.world?.entities?.characters || [];
        const npcsWithAttitude = characters.filter((c: any) => c.attitude !== undefined);
        if (npcsWithAttitude.length > 0) {
          validationErrors.push(`${npcsWithAttitude.length} NPCs have attitude property (must be in state.facts)`);
        }
        
        // Check entities have required 'kind' field
        const charsWithoutKind = characters.filter((c: any) => c.kind !== 'character');
        if (charsWithoutKind.length > 0) {
          validationErrors.push(`${charsWithoutKind.length} characters missing kind: "character"`);
        }
        
        const locations = generatedContent.world?.entities?.locations || [];
        const locsWithoutKind = locations.filter((l: any) => l.kind !== 'location');
        if (locsWithoutKind.length > 0) {
          validationErrors.push(`${locsWithoutKind.length} locations missing kind: "location"`);
        }
        
        const items = generatedContent.world?.entities?.items || [];
        const itemsWithoutKind = items.filter((i: any) => i.kind !== 'item');
        if (itemsWithoutKind.length > 0) {
          validationErrors.push(`${itemsWithoutKind.length} items missing kind: "item"`);
        }
        
        // Check state facts have required 'id' field
        const stateFacts = generatedContent.state?.facts || [];
        const factsWithoutId = stateFacts.filter((f: any) => !f.id);
        if (factsWithoutId.length > 0) {
          validationErrors.push(`${factsWithoutId.length} state facts missing id field`);
        }
        
        // Check roles have required structure (holder, not character_id)
        const roleAssignments = generatedContent.roles?.assignments || [];
        const rolesWithCharacterId = roleAssignments.filter((r: any) => r.character_id && !r.holder);
        if (rolesWithCharacterId.length > 0) {
          validationErrors.push(`${rolesWithCharacterId.length} role assignments use character_id instead of holder`);
        }
        const rolesWithoutId = roleAssignments.filter((r: any) => !r.id);
        if (rolesWithoutId.length > 0) {
          validationErrors.push(`${rolesWithoutId.length} role assignments missing id field`);
        }
        
        // Check processes have required fields (type, participants, location)
        const processes = generatedContent.processes?.catalog || [];
        const processesWithoutType = processes.filter((p: any) => !p.type);
        if (processesWithoutType.length > 0) {
          validationErrors.push(`${processesWithoutType.length} processes missing type field (combat/social/puzzle/exploration)`);
        }
        const processesWithoutParticipants = processes.filter((p: any) => !p.participants || p.participants.length === 0);
        if (processesWithoutParticipants.length > 0) {
          validationErrors.push(`${processesWithoutParticipants.length} processes missing participants array`);
        }
        const processesWithoutLocation = processes.filter((p: any) => !p.location);
        if (processesWithoutLocation.length > 0) {
          validationErrors.push(`${processesWithoutLocation.length} processes missing location field`);
        }
        
        // Check connections have required fields
        const connections = generatedContent.world?.connections || [];
        const connectionsWithoutId = connections.filter((c: any) => !c.id);
        if (connectionsWithoutId.length > 0) {
          validationErrors.push(`${connectionsWithoutId.length} connections missing id field`);
        }
        const connectionsWithoutMode = connections.filter((c: any) => !c.mode);
        if (connectionsWithoutMode.length > 0) {
          validationErrors.push(`${connectionsWithoutMode.length} connections missing mode field`);
        }
        
        // Check transitions and snapshots are not empty
        const transitions = generatedContent.transitions?.changes || [];
        if (transitions.length === 0) {
          validationErrors.push('transitions.changes is empty (need at least one state change)');
        }
        
        const snapshots = generatedContent.snapshots?.timeline || [];
        if (snapshots.length === 0) {
          validationErrors.push('snapshots.timeline is empty (need initial and victory snapshots)');
        }
        
        // Recursive check for forbidden CAML 1.x keys at ROOT level only
        const forbiddenRootKeys = ['encounterType', 'questGiver', 'gates', 'startsAt', 'occursAt'];
        const foundForbiddenKeys: string[] = [];
        for (const key of Object.keys(generatedContent)) {
          if (forbiddenRootKeys.includes(key)) {
            foundForbiddenKeys.push(key);
          }
        }
        if (generatedContent.type === 'AdventureModule') {
          foundForbiddenKeys.push('type:AdventureModule');
        }
        if (foundForbiddenKeys.length > 0) {
          validationErrors.push(`Contains forbidden CAML 1.x root properties: ${foundForbiddenKeys.join(', ')}`);
        }
        
        // Validate pressure system (doctrine)
        if (!generatedContent.doctrine?.campaign_question) {
          validationErrors.push('Missing doctrine.campaign_question (must be a dilemma, not a goal)');
        }
        const doctrineStakes = generatedContent.doctrine?.stakes || [];
        if (doctrineStakes.length < 2) {
          validationErrors.push(`doctrine.stakes has ${doctrineStakes.length} entries (need at least 2 pressure tracks)`);
        }
        const processesWithStakeEffects = processes.filter((p: any) => p.stake_effects && p.stake_effects.length > 0);
        if (processesWithStakeEffects.length < 2) {
          validationErrors.push(`Only ${processesWithStakeEffects.length} processes have stake_effects (need at least 2)`);
        }
        const endingSnapshots = snapshots.filter((s: any) => s.id !== 'SNAP_Initial' && s.derived_from_transition);
        if (endingSnapshots.length < 2) {
          validationErrors.push(`Only ${endingSnapshots.length} ending snapshots (need at least 2 forked endings)`);
        }
        
        // ═══════ REACTIVE ARCHITECTURE VALIDATION ═══════
        
        // Validate villain structure
        const villain = generatedContent.villain;
        if (!villain) {
          validationErrors.push('Missing villain object (need reactive villain with planStructure and reactionTree)');
        } else {
          if (!villain.planStructure || !Array.isArray(villain.planStructure) || villain.planStructure.length < 3) {
            validationErrors.push(`villain.planStructure has ${villain.planStructure?.length || 0} steps (need at least 3)`);
          }
          if (!villain.reactionTree) {
            validationErrors.push('Missing villain.reactionTree (need escalate/redirect/retaliate/accelerate)');
          } else {
            const requiredReactions = ['escalate', 'redirect', 'retaliate', 'accelerate'];
            const missingReactions = requiredReactions.filter(r => !villain.reactionTree[r]);
            if (missingReactions.length > 0) {
              validationErrors.push(`villain.reactionTree missing: ${missingReactions.join(', ')}`);
            }
          }
          if (!villain.name) validationErrors.push('villain.name is required');
          if (!villain.goal) validationErrors.push('villain.goal is required');
        }
        
        // Validate framing event
        if (!generatedContent.framingEvent) {
          validationErrors.push('Missing framingEvent (inciting incident)');
        }
        
        // Validate complications queue
        const compQ = generatedContent.complicationsQueue;
        if (!compQ) {
          validationErrors.push('Missing complicationsQueue');
        } else {
          if (!compQ.moralQuandaries || compQ.moralQuandaries.length < 1) {
            validationErrors.push('complicationsQueue needs at least 1 moralQuandary');
          }
          if (!compQ.twists || compQ.twists.length < 1) {
            validationErrors.push('complicationsQueue needs at least 1 twist');
          }
        }
        
        // Validate encounter designs
        const encDesigns = generatedContent.encounterDesigns;
        if (!encDesigns || !Array.isArray(encDesigns) || encDesigns.length < 1) {
          validationErrors.push('encounterDesigns needs at least 1 designed encounter');
        } else {
          const designsWithTerrain = encDesigns.filter((e: any) => e.terrainFeatures && Array.isArray(e.terrainFeatures) && e.terrainFeatures.length > 0);
          if (designsWithTerrain.length < 1) {
            validationErrors.push('At least 1 encounterDesign must have terrainFeatures array with specific terrain types');
          }
          const designsWithMultiWave = encDesigns.filter((e: any) => 
            e.combatInterest && Array.isArray(e.combatInterest) && 
            e.combatInterest.some((ci: string) => ci === 'multi_wave' || ci === 'terrain_shifts')
          );
          if (designsWithMultiWave.length < 1) {
            validationErrors.push('At least 1 encounterDesign must have multi_wave or terrain_shifts in combatInterest (climax encounters must be multi-phase)');
          }
        }
        
        // Validate encounter budget
        const encBudget = generatedContent.encounterBudget;
        if (!encBudget) {
          validationErrors.push('Missing encounterBudget (need partyLevel, dailyBudget, restWindows)');
        } else {
          if (!encBudget.partyLevel && !encBudget.dailyBudget) {
            validationErrors.push('encounterBudget must have partyLevel and dailyBudget');
          }
        }
        
        // Validate party goal
        const pGoal = generatedContent.partyGoal;
        if (!pGoal) {
          validationErrors.push('Missing partyGoal');
        } else {
          if (!pGoal.failureState) validationErrors.push('partyGoal.failureState is required (failure must advance world)');
          if (!pGoal.primary) validationErrors.push('partyGoal.primary is required');
        }
        
        // Validate stakes have gameplayEffects with specific threshold effects
        const stakesWithEffects = doctrineStakes.filter((s: any) => s.gameplayEffects && Object.keys(s.gameplayEffects).length > 0);
        if (doctrineStakes.length >= 2 && stakesWithEffects.length < 1) {
          validationErrors.push('At least 1 doctrine.stake must have gameplayEffects (at2/at4 specific environmental/NPC/difficulty modifications)');
        }
        
        // Validate moral quandaries have stakeLink
        const quandaries = generatedContent.complicationsQueue?.moralQuandaries || [];
        const quandariesWithStakeLink = quandaries.filter((q: any) => q.stakeLink && (q.stakeLink.increases || q.stakeLink.decreases));
        if (quandaries.length > 0 && quandariesWithStakeLink.length < 1 && attempt > 0) {
          validationErrors.push('At least 1 moralQuandary must have stakeLink showing which stakes it affects');
        }
        
        // Validate non-terminal endings (nextArc on ending snapshots)
        const endingsWithNextArc = endingSnapshots.filter((s: any) => s.nextArc && s.nextArc.length > 5);
        if (endingSnapshots.length >= 2 && endingsWithNextArc.length < 1 && attempt > 0) {
          validationErrors.push('Ending snapshots must have nextArc field describing what new campaign arc emerges (endings must be non-terminal)');
        }
        
        // Validate process outcomes and activation conditions
        const processesWithOutcomes = processes.filter((p: any) => p.outcomes?.success && p.outcomes?.failure);
        if (processesWithOutcomes.length < Math.min(2, processes.length)) {
          validationErrors.push(`Only ${processesWithOutcomes.length} processes have outcomes (success/partial/failure) — need at least ${Math.min(2, processes.length)}`);
        }
        const processesWithConditions = processes.filter((p: any) => p.activationConditions && Array.isArray(p.activationConditions) && p.activationConditions.length > 0);
        if (processesWithConditions.length < Math.min(2, processes.length) && attempt > 0) {
          validationErrors.push(`Only ${processesWithConditions.length} processes have activationConditions — need conditional activation, not linear chapters`);
        }
        
        // ═══════ GENRE-ADAPTIVE REACTIVE WORLD VALIDATION ═══════
        
        // Validate power network (factions)
        const factions = generatedContent.world?.entities?.factions || [];
        if (factions.length < 2) {
          validationErrors.push(`Only ${factions.length} factions — need at least 2 competing power groups`);
        } else {
          const factionsWithPolicy = factions.filter((f: any) => f.reactionPolicy && (f.reactionPolicy.ifPlayerHelps || f.reactionPolicy.ifPlayerHinders));
          if (factionsWithPolicy.length < 1 && attempt > 0) {
            validationErrors.push('At least 1 faction must have reactionPolicy (ifPlayerHelps/ifPlayerHinders/ifRivalGains)');
          }
        }
        
        const powerNet = generatedContent.powerNetwork;
        if (!powerNet && attempt > 0) {
          validationErrors.push('Missing powerNetwork (need groups, consequenceChains, instabilityRules)');
        } else if (powerNet) {
          if (!powerNet.groups || powerNet.groups.length < 1) {
            validationErrors.push('powerNetwork.groups needs at least 1 faction group with influence/rivals');
          }
          const chains = powerNet.consequenceChains || [];
          if (chains.length < 2 && attempt > 0) {
            validationErrors.push(`Only ${chains.length} consequenceChains — need at least 2 (trigger → immediate → ripple → cascade)`);
          } else if (chains.length > 0) {
            const chainsWithCascade = chains.filter((c: any) => c.trigger && c.immediate && c.cascade);
            if (chainsWithCascade.length < 1) {
              validationErrors.push('consequenceChains must have trigger, immediate, and cascade fields');
            }
          }
          if ((!powerNet.instabilityRules || powerNet.instabilityRules.length < 1) && attempt > 0) {
            validationErrors.push('powerNetwork needs at least 1 instabilityRule (how faction disruption changes NPC behavior)');
          }
        }
        
        // Validate rival agent
        const rival = generatedContent.rivalAgent;
        if (!rival && attempt > 0) {
          validationErrors.push('Missing rivalAgent (need competing force creating urgency/interference)');
        } else if (rival) {
          if (!rival.goal) validationErrors.push('rivalAgent.goal is required');
          if (!rival.interferenceActions || rival.interferenceActions.length < 1) {
            validationErrors.push('rivalAgent needs at least 1 interferenceAction');
          }
        }
        
        // Validate meter-to-world effects
        const meterEffects = generatedContent.meterWorldEffects;
        if (!meterEffects && attempt > 0) {
          validationErrors.push('Missing meterWorldEffects (meters must alter the physical environment at thresholds)');
        } else if (meterEffects && Array.isArray(meterEffects)) {
          const effectsWithThresholds = meterEffects.filter((m: any) => m.thresholds && (m.thresholds.at1 || m.thresholds.at3 || m.thresholds.at5));
          if (effectsWithThresholds.length < 1 && attempt > 0) {
            validationErrors.push('meterWorldEffects must have at least 1 meter with environment-altering thresholds (at1/at3/at5)');
          }
        }
        
        // Validate dynamic climax
        const dynClimax = generatedContent.dynamicClimax;
        if (!dynClimax && attempt > 0) {
          validationErrors.push('Missing dynamicClimax (final encounter must be assembled from world state, not predetermined)');
        } else if (dynClimax) {
          if (!dynClimax.assemblyRule) {
            validationErrors.push('dynamicClimax.assemblyRule required (how surviving factions + meters determine the climax)');
          }
          if (!dynClimax.variations || dynClimax.variations.length < 2) {
            validationErrors.push(`dynamicClimax has ${dynClimax.variations?.length || 0} variations — need at least 3 distinct climax variants`);
          }
          if (!dynClimax.approachPaths || dynClimax.approachPaths.length < 1) {
            if (attempt > 0) validationErrors.push('dynamicClimax needs approachPaths with 3+ approaches per objective');
          } else {
            const pathsWithApproaches = dynClimax.approachPaths.filter((p: any) => p.approaches && p.approaches.length >= 3);
            if (pathsWithApproaches.length < 1 && attempt > 0) {
              validationErrors.push('Each approachPath needs at least 3 valid approaches (stealth/social/force/manipulation)');
            }
          }
        }
        
        // Check for placeholders
        const jsonStr = JSON.stringify(generatedContent);
        const placeholderMatches = jsonStr.match(/<[A-Z][^>]*>/g);
        if (placeholderMatches && placeholderMatches.length > 0) {
          validationErrors.push(`Contains placeholders: ${placeholderMatches.slice(0, 3).join(', ')}`);
        }
        
        if (validationErrors.length === 0) {
          // Success! Convert and return
          console.log(`Generated CAML 2.0 campaign: "${generatedContent.meta?.title}" (attempt ${attempt + 1})`);
          const legacyFormat = convertCAML2ToLegacyFormat(generatedContent);

          let coverArtUrl = '';
          try {
            const artTitle = generatedContent.meta?.title || 'Adventure';
            const artSummary = generatedContent.meta?.summary || generatedContent.doctrine?.campaign_question || '';
            const artTheme = generatedContent.meta?.tags?.join(', ') || 'fantasy';
            coverArtUrl = await generateCAMLCoverArt(artTitle, artSummary, artTheme);
          } catch (coverErr) {
            console.warn("Cover art generation failed (non-blocking):", coverErr);
          }

          return res.json({
            ...legacyFormat,
            caml2: generatedContent,
            coverArtUrl,
            villainModel: generatedContent.villain ? {
              name: generatedContent.villain.name,
              archetype: generatedContent.villain.archetype || 'Mastermind',
              goal: generatedContent.villain.goal,
              motivation: generatedContent.villain.motivation,
              resources: generatedContent.villain.resources,
              weakness: generatedContent.villain.weakness,
              planStructure: generatedContent.villain.planStructure,
              currentStep: generatedContent.villain.currentStep || 0,
              reactionTree: generatedContent.villain.reactionTree
            } : undefined,
            framingEvent: generatedContent.framingEvent,
            complicationsQueue: generatedContent.complicationsQueue,
            encounterDesigns: generatedContent.encounterDesigns,
            partyGoal: generatedContent.partyGoal,
            powerNetwork: generatedContent.powerNetwork,
            rivalAgent: generatedContent.rivalAgent,
            meterWorldEffects: generatedContent.meterWorldEffects,
            dynamicClimax: generatedContent.dynamicClimax,
            isCAML2: true
          });
        }
        
        // Failed validation, prepare for retry
        lastError = validationErrors.join('; ');
        console.warn(`CAML 2.0 validation failed (attempt ${attempt + 1}):`, validationErrors);
      }
      
      // All retries exhausted
      return res.status(422).json({
        success: false,
        message: "Failed to generate valid CAML 2.0 after multiple attempts",
        errors: lastError.split('; ')
      });
      
    } catch (error) {
      console.error("Failed to generate complete campaign:", error);
      res.status(500).json({ 
        message: "Failed to generate campaign",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Helper function to convert CAML 2.0 to legacy format for frontend display
  function convertCAML2ToLegacyFormat(caml2: any): any {
    const world = caml2.world?.entities || {};
    const state = caml2.state?.facts || [];
    const roles = caml2.roles?.assignments || [];
    const processes = caml2.processes?.catalog || [];
    const transitions = caml2.transitions?.changes || [];
    const connections = caml2.world?.connections || [];
    
    // Build a map of process outcomes from transitions
    const processOutcomes: Record<string, string[]> = {};
    transitions.forEach((t: any) => {
      if (t.caused_by) {
        if (!processOutcomes[t.caused_by]) processOutcomes[t.caused_by] = [];
        t.ops?.forEach((op: any) => {
          if (op.op === 'update_state') {
            const stateId = op.state_id || '';
            if (stateId.includes('Active') && op.value === false) {
              processOutcomes[t.caused_by].push('Defeat enemy');
            } else if (stateId.includes('Discovered') && op.value === true) {
              processOutcomes[t.caused_by].push('Discover hidden area');
            } else if (stateId.includes('quest_status') && op.value === 'completed') {
              processOutcomes[t.caused_by].push('Complete quest');
            } else if (stateId.includes('Attitude')) {
              processOutcomes[t.caused_by].push(`Change NPC attitude to ${op.value}`);
            }
          }
        });
      }
    });
    
    // Extract quests from QuestGiver roles with richer details
    const quests = roles
      .filter((r: any) => r.role === 'QuestGiver')
      .map((r: any, i: number) => {
        const questNotes = r.notes || '';
        const holderNPC = (world.characters || []).find((c: any) => c.id === r.holder);
        const questStatusFact = state.find((s: any) => s.type === 'quest_status');
        
        // Extract objectives from processes that involve this quest's NPCs
        const relatedProcesses = processes.filter((p: any) => 
          p.participants?.includes(r.holder) || questNotes.toLowerCase().includes(p.notes?.toLowerCase()?.slice(0, 20) || '')
        );
        
        const objectives = relatedProcesses.length > 0 
          ? relatedProcesses.map((p: any) => p.timebox?.label || p.notes?.slice(0, 50) || 'Complete objective')
          : ['Speak with the quest giver', 'Complete the main objective', 'Return for rewards'];
        
        return {
          title: questNotes.replace(/^Quest:\s*/i, '') || `Quest from ${holderNPC?.name || 'NPC'}`,
          type: i === 0 ? 'main' : 'side',
          description: questNotes || `A quest given by ${holderNPC?.name || 'an NPC'}`,
          objectives,
          rewards: questStatusFact ? 'Experience points and treasure' : 'Adventure rewards',
          connections: holderNPC ? `Given by ${holderNPC.name}` : 'Connected to main storyline'
        };
      });
    
    // Convert NPCs from world layer + state facts for attitude with richer details
    const npcs = (world.characters || [])
      .filter((c: any) => !c.pc)
      .map((c: any) => {
        const attitudeFact = state.find((s: any) => s.bearer === c.id && s.type === 'attitude');
        const activeFact = state.find((s: any) => s.bearer === c.id && s.type === 'active');
        const attitude = attitudeFact?.value || 'neutral';
        const isEnemy = attitude === 'hostile' || activeFact !== undefined;
        const role = isEnemy ? 'enemy' : attitude === 'friendly' ? 'ally' : 'neutral';
        
        // Find which roles this NPC holds
        const npcRoles = roles.filter((r: any) => r.holder === c.id);
        const roleDescriptions = npcRoles.map((r: any) => r.role).join(', ');
        
        // Find which processes involve this NPC
        const involvedProcesses = processes.filter((p: any) => p.participants?.includes(c.id));
        const processConnections = involvedProcesses.map((p: any) => p.timebox?.label || p.type).join(', ');
        
        return {
          name: c.name || c.id.replace('NPC_', '').replace(/_/g, ' '),
          race: c.species || 'Human',
          class: c.class || 'Commoner',
          role,
          description: c.description || `A ${c.species || 'mysterious'} ${c.class || 'figure'}`,
          personality: roleDescriptions ? `Serves as ${roleDescriptions}` : `${attitude} disposition`,
          motivations: isEnemy ? 'Opposes the party' : role === 'ally' ? 'Helps the party' : 'Has their own agenda',
          questConnections: processConnections || 'Involved in the adventure'
        };
      });
    
    // Convert locations with connection details
    const locationConnectionMap: Record<string, string[]> = {};
    connections.forEach((c: any) => {
      if (!c.from || !c.to) return;
      if (!locationConnectionMap[c.from]) locationConnectionMap[c.from] = [];
      if (!locationConnectionMap[c.to]) locationConnectionMap[c.to] = [];
      locationConnectionMap[c.from].push(`${c.mode || 'path'} to ${String(c.to).replace('LOC_', '')}`);
      locationConnectionMap[c.to].push(`${c.mode || 'path'} from ${String(c.from).replace('LOC_', '')}`);
    });
    
    const locations = (world.locations || []).map((l: any) => {
      const discoveredFact = state.find((s: any) => s.bearer === l.id && s.type === 'discovered');
      const isHidden = discoveredFact?.value === false;
      const locationProcesses = processes.filter((p: any) => p.location === l.id);
      const encounterDesc = locationProcesses.length > 0 
        ? locationProcesses.map((p: any) => `${p.type}: ${p.timebox?.label || p.notes?.slice(0, 30)}`).join('; ')
        : 'Exploration opportunities';
      
      return {
        name: l.name || (l.id ? String(l.id).replace('LOC_', '').replace(/_/g, ' ') : 'Location'),
        type: (l.tags || [])[0] || 'dungeon',
        description: (l.description || 'A mysterious location') + (isHidden ? ' (Hidden - requires discovery)' : ''),
        features: l.features || [],
        encounters: encounterDesc,
        connections: locationConnectionMap[l.id]?.join(', ') || 'Connected to other areas'
      };
    });
    
    // Convert processes to encounters with full details
    const encounters = processes.map((p: any) => {
      const locationEntity = (world.locations || []).find((l: any) => l.id === p.location);
      const participantNPCs = (p.participants || [])
        .filter((pid: string) => pid && pid !== 'PC_Party')
        .map((pid: string) => {
          const npc = (world.characters || []).find((c: any) => c.id === pid);
          return npc?.name || String(pid).replace('NPC_', '');
        });
      
      const outcomes = processOutcomes[p.id] || ['Standard resolution'];
      
      // Determine tactics based on type
      let tactics = 'Standard approach';
      if (p.type === 'combat') {
        tactics = participantNPCs.length > 0 
          ? `${participantNPCs.join(', ')} will engage in combat. Use terrain and abilities strategically.`
          : 'Enemies will use standard combat tactics.';
      } else if (p.type === 'social') {
        tactics = 'Use diplomacy, persuasion, or intimidation. Role-play the interaction.';
      } else if (p.type === 'puzzle') {
        tactics = 'Players must solve the puzzle using clues and logic.';
      } else if (p.type === 'exploration') {
        tactics = 'Investigate the area, search for clues, and discover secrets.';
      }
      
      return {
        name: p.timebox?.label || (p.id ? String(p.id).replace('PROC_', '').replace(/_/g, ' ') : 'Encounter'),
        type: p.type || 'combat',
        challengeRating: `Appropriate for level ${caml2.meta?.levels?.min || 1}-${caml2.meta?.levels?.max || 5}`,
        description: p.notes || `A ${p.type || 'standard'} encounter`,
        setup: locationEntity ? `Takes place at ${locationEntity.name}` : 'Set up as described',
        tactics,
        treasure: outcomes.join('; ') || 'Level-appropriate rewards',
        participants: participantNPCs
      };
    });
    
    // Convert items to rewards with full details
    const rewards = (world.items || []).map((i: any) => ({
      name: i.name || (i.id ? String(i.id).replace('ITEM_', '').replace(/_/g, ' ') : 'Magic Item'),
      type: 'magic_item',
      rarity: i.rarity || 'uncommon',
      description: i.description || `A ${i.rarity || 'mysterious'} item`,
      mechanics: i.rarity === 'legendary' ? 'Powerful magical properties' : 
                 i.rarity === 'rare' ? 'Notable magical properties' : 'Useful magical properties',
      questConnection: 'Obtained during the adventure'
    }));
    
    // Build main story arc from snapshots
    const initialNarration = caml2.snapshots?.timeline?.[0]?.narration || '';
    const victoryNarration = caml2.snapshots?.timeline?.find((s: any) => s.id?.includes('Victory'))?.narration || '';
    const mainStoryArc = initialNarration 
      ? `${initialNarration} The adventure culminates in ${victoryNarration || 'a dramatic conclusion'}.`
      : 'An epic adventure awaits!';
    
    return {
      title: caml2.meta?.title || 'Adventure',
      description: initialNarration || 'A D&D adventure awaits brave heroes',
      mainStoryArc,
      quests: quests.length > 0 ? quests : [{
        title: 'Main Quest',
        type: 'main',
        description: 'Complete the adventure objectives',
        objectives: processes.slice(0, 3).map((p: any) => p.timebox?.label || 'Complete objective'),
        rewards: 'Experience and treasure',
        connections: 'Main storyline'
      }],
      npcs,
      locations,
      encounters,
      rewards
    };
  }

  // Enhanced Live Session Management APIs

  // Get current session with DM context
  app.get("/api/campaigns/:campaignId/dm-session-state", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Allow DM and players to access (players need voting data)
      const participants = await storage.getCampaignParticipants(campaignId);
      const isParticipant = participants.some(p => p.userId === req.user.id);
      const isDM = campaign.userId === req.user.id;
      
      if (!isDM && !isParticipant) {
        return res.status(403).json({ message: "Only campaign members can access session state" });
      }
      
      // Get or create session state
      let sessionState = await db.select().from(dmSessionStates)
        .where(eq(dmSessionStates.campaignId, campaignId))
        .limit(1);
      
      if (sessionState.length === 0) {
        // Create new session state
        const newState = await db.insert(dmSessionStates).values({
          campaignId,
          startedAt: new Date().toISOString(),
        }).returning();
        sessionState = newState;
      }
      
      // Get participants with character data
      const participantsWithChars = await Promise.all(
        participants.map(async (p) => {
          const character = await storage.getCharacter(p.characterId);
          return { ...p, character };
        })
      );
      
      // Auto-populate entity library if empty
      let camlEntitySources = sessionState[0].camlEntitySources as any;
      if (!camlEntitySources || Object.keys(camlEntitySources).length === 0) {
        // Load campaign NPCs
        const campaignNpcs = await storage.getCampaignNpcs(campaignId);
        
        // Load campaign quests
        const campaignQuests = await storage.getCampaignQuests(campaignId);
        
        // Load items by type as potential loot
        const userItems = await storage.getItemsByType('weapon');
        const armorItems = await storage.getItemsByType('armor');
        const allItems = [...userItems, ...armorItems];
        
        // For now, use empty arrays for encounters and locations (adventure elements table may not exist)
        const encounters: any[] = [];
        const locations: any[] = [];
        
        // Build entity sources for the Live Manager sidebar
        camlEntitySources = {
          npcs: campaignNpcs.map((npc: any) => ({
            id: `npc-${npc.id}`,
            name: npc.name,
            type: 'npc',
            description: npc.description,
            race: npc.race,
            role: npc.role,
            personality: npc.personality,
            motivation: npc.motivation
          })),
          items: allItems.slice(0, 50).map((item: any) => ({
            id: `item-${item.id}`,
            name: item.name,
            type: 'item',
            description: item.description,
            itemType: item.type,
            rarity: item.rarity
          })),
          encounters: encounters.map((enc: any) => ({
            id: `encounter-${enc.id}`,
            name: enc.name,
            type: 'encounter',
            description: enc.description,
            details: enc.details
          })),
          locations: locations.map((loc: any) => ({
            id: `location-${loc.id}`,
            name: loc.name,
            type: 'location',
            description: loc.description,
            details: loc.details
          })),
          quests: campaignQuests.map((quest: any) => ({
            id: `quest-${quest.id}`,
            name: quest.title,
            type: 'quest',
            description: quest.description,
            status: quest.status,
            objectives: quest.objectives
          }))
        };
        
        // Save to session state for future loads
        await db.update(dmSessionStates)
          .set({ camlEntitySources, lastUpdatedAt: new Date().toISOString() })
          .where(eq(dmSessionStates.campaignId, campaignId));
      }
      
      // Check for expired votes and auto-resolve if needed
      let finalState = sessionState[0];
      finalState = await checkAndAutoResolveExpiredVotes(campaignId, finalState);
      
      // For players (non-DM), return only vote-related fields
      if (!isDM) {
        res.json({
          activeGroupChoices: finalState.activeGroupChoices,
          groupChoiceVotes: finalState.groupChoiceVotes,
          groupChoiceStatus: finalState.groupChoiceStatus,
          groupChoiceResolution: finalState.groupChoiceResolution,
        });
        return;
      }
      
      res.json({
        ...finalState,
        camlEntitySources,
        participantsWithChars
      });
    } catch (error) {
      console.error("Failed to get DM session state:", error);
      res.status(500).json({ message: "Failed to get DM session state" });
    }
  });

  // Update DM session state (initiative, presence, etc.)
  app.patch("/api/campaigns/:campaignId/dm-session-state", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign || campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the DM can update session state" });
      }
      
      const { initiativeOrder, presence, currentTurnIndex, roundNumber, camlEntitySources } = req.body;
      
      const updateData: any = {
        lastUpdatedAt: new Date().toISOString(),
      };
      
      if (initiativeOrder !== undefined) updateData.initiativeOrder = initiativeOrder;
      if (presence !== undefined) updateData.presence = presence;
      if (currentTurnIndex !== undefined) updateData.currentTurnIndex = currentTurnIndex;
      if (roundNumber !== undefined) updateData.roundNumber = roundNumber;
      if (camlEntitySources !== undefined) updateData.camlEntitySources = camlEntitySources;
      
      const updated = await db.update(dmSessionStates)
        .set(updateData)
        .where(eq(dmSessionStates.campaignId, campaignId))
        .returning();
      
      res.json(updated[0]);
    } catch (error) {
      console.error("Failed to update DM session state:", error);
      res.status(500).json({ message: "Failed to update session state" });
    }
  });

  // Chapter progress — current objective, scenes count, urgency, and hints
  app.get("/api/campaigns/:campaignId/chapter-progress", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });

      const allSessions = await storage.getCampaignSessions(campaignId);
      const currentChapter = (campaign as any).currentSession || 1;
      const totalChapters = (campaign as any).totalChapters || 5;
      const chapterGates = ((campaign as any).chapterGates as any[]) || [];

      // Find the current active session (highest sessionNumber, not completed)
      const activeSessions = allSessions.filter((s: any) => !s.isCompleted);
      const activeSession = activeSessions.length > 0
        ? activeSessions.reduce((latest: any, s: any) => s.sessionNumber > latest.sessionNumber ? s : latest, activeSessions[0])
        : allSessions[allSessions.length - 1];

      // Scene count = number of player choices made in this chapter session
      const choicesMade = (activeSession?.playerChoicesMade as any[] || []).length;
      // Also check storyState.sceneCount as a fallback
      let storySceneCount = 0;
      if (activeSession?.storyState) {
        try {
          const ss = typeof activeSession.storyState === 'string' ? JSON.parse(activeSession.storyState) : activeSession.storyState;
          storySceneCount = ss?.sceneCount ?? 0;
        } catch { /* ignore */ }
      }
      const scenesInChapter = Math.max(choicesMade, storySceneCount);

      const currentGate = chapterGates.find((g: any) => g.chapter === currentChapter);

      const HARD_CAP = 10;
      let urgency: string;
      if (scenesInChapter >= HARD_CAP) urgency = "hardcap";
      else if (scenesInChapter >= 9) urgency = "urgent";
      else if (scenesInChapter >= 7) urgency = "moderate";
      else if (scenesInChapter >= 5) urgency = "gentle";
      else urgency = "normal";

      // Build player-facing hints from gate conditions
      const hints: string[] = [];
      if (currentGate) {
        if (currentGate.requiredTruth) hints.push(`Discover the truth: "${currentGate.requiredTruth}"`);
        if (currentGate.requiredCommitment) hints.push(`Make a commitment: "${currentGate.requiredCommitment}"`);
        if (currentGate.requiredBeliefChange) hints.push(`Change your approach: "${currentGate.requiredBeliefChange}"`);
        if (currentGate.advanceWhen) hints.push(currentGate.advanceWhen);
      }

      res.json({
        currentChapter,
        totalChapters,
        scenesInChapter,
        hardCap: HARD_CAP,
        urgency,
        gate: currentGate ? {
          advanceWhen: currentGate.advanceWhen,
          requiredTruth: currentGate.requiredTruth,
          requiredCommitment: currentGate.requiredCommitment,
          requiredBeliefChange: currentGate.requiredBeliefChange,
        } : null,
        hints,
        campaignQuestion: (campaign as any).campaignQuestion || null,
      });
    } catch (error) {
      console.error("Failed to get chapter progress:", error);
      res.status(500).json({ message: "Failed to get chapter progress" });
    }
  });

  // Send DM message to players
  app.post("/api/campaigns/:campaignId/dm-message", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign || campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the DM can send messages" });
      }
      
      const { message, type } = req.body;
      
      // Validate required fields
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: "Message is required and must be a string" });
      }
      
      if (!type || !['narration', 'ooc', 'system'].includes(type)) {
        return res.status(400).json({ message: "Type must be 'narration', 'ooc', or 'system'" });
      }
      
      // Get current session state
      const sessionState = await db.select().from(dmSessionStates)
        .where(eq(dmSessionStates.campaignId, campaignId))
        .limit(1);
      
      if (sessionState.length === 0) {
        return res.status(404).json({ message: "No session state found" });
      }
      
      // Add message to log
      const currentMessages = (sessionState[0].dmMessages as any[]) || [];
      const newMessage = {
        message,
        type,
        timestamp: new Date().toISOString(),
      };
      
      const updated = await db.update(dmSessionStates)
        .set({
          dmMessages: [...currentMessages, newMessage],
          lastUpdatedAt: new Date().toISOString(),
        })
        .where(eq(dmSessionStates.campaignId, campaignId))
        .returning();
      
      // Broadcast to players via WebSocket
      broadcastMessage('dm-message', {
        campaignId,
        ...newMessage
      });
      
      res.json({ success: true, message: newMessage });
    } catch (error) {
      console.error("Failed to send DM message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Get table chat - available to all campaign participants during live sessions
  app.get("/api/campaigns/:campaignId/table-chat", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Check if user is DM or a participant
      const isDM = campaign.userId === req.user.id;
      const participants = await storage.getCampaignParticipants(campaignId);
      const isParticipant = participants.some(p => p.userId === req.user.id);
      
      if (!isDM && !isParticipant) {
        return res.status(403).json({ message: "Only campaign participants can access table chat" });
      }
      
      // Get session state
      const sessionState = await db.select().from(dmSessionStates)
        .where(eq(dmSessionStates.campaignId, campaignId))
        .limit(1);
      
      if (sessionState.length === 0) {
        return res.json({ tableChat: [], isActive: false });
      }
      
      const currentState = sessionState[0];
      res.json({ 
        tableChat: (currentState as any).tableChat || [],
        isActive: currentState.isActive,
        initiativeOrder: currentState.initiativeOrder,
        currentTurnIndex: currentState.currentTurnIndex,
      });
    } catch (error) {
      console.error("Failed to get table chat:", error);
      res.status(500).json({ message: "Failed to get table chat" });
    }
  });

  // Send table chat message - available to all campaign participants during live sessions
  app.post("/api/campaigns/:campaignId/table-chat", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Check if user is DM or a participant
      const isDM = campaign.userId === req.user.id;
      const participants = await storage.getCampaignParticipants(campaignId);
      const isParticipant = participants.some(p => p.userId === req.user.id);
      
      if (!isDM && !isParticipant) {
        return res.status(403).json({ message: "Only campaign participants can send table chat" });
      }
      
      const { message, senderName, characterName } = req.body;
      
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ message: "Message is required" });
      }
      
      // Get current session state
      const sessionState = await db.select().from(dmSessionStates)
        .where(eq(dmSessionStates.campaignId, campaignId))
        .limit(1);
      
      if (sessionState.length === 0) {
        return res.status(404).json({ message: "No active session found" });
      }
      
      // Create the chat message
      const chatMessage = {
        id: Date.now().toString(),
        message: message.trim(),
        senderId: req.user.id,
        senderName: senderName || req.user.username || 'Unknown',
        characterName: characterName || null,
        isDM,
        timestamp: new Date().toISOString(),
      };
      
      // Get existing table chat or initialize
      const currentState = sessionState[0];
      const tableChat = (currentState as any).tableChat || [];
      
      // Add message to table chat (keep last 100 messages)
      const updatedChat = [...tableChat, chatMessage].slice(-100);
      
      await db.update(dmSessionStates)
        .set({
          tableChat: updatedChat,
          lastUpdatedAt: new Date().toISOString(),
        })
        .where(eq(dmSessionStates.campaignId, campaignId));
      
      // Broadcast to all participants via WebSocket
      broadcastMessage('table-chat', {
        campaignId,
        ...chatMessage
      });
      
      res.json({ success: true, message: chatMessage });
    } catch (error) {
      console.error("Failed to send table chat:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // ========================================
  // GROUP CHOICE VOTING SYSTEM (Multiplayer)
  // ========================================

  // Create or update group choices (DM only)
  app.post("/api/campaigns/:campaignId/group-choices", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign || campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the DM can create group choices" });
      }
      
      const { choices, threshold, timeoutHours } = req.body;
      
      if (!choices || !Array.isArray(choices) || choices.length === 0) {
        return res.status(400).json({ message: "Choices array is required" });
      }
      
      // Validate choice format
      const formattedChoices = choices.map((choice: any, index: number) => ({
        id: choice.id || `choice-${index + 1}`,
        text: choice.text || '',
        description: choice.description || '',
        dc: choice.dc || null,
        modifier: choice.modifier || null,
        skillCheck: choice.skillCheck || null,
        createdBy: 'dm'
      }));
      
      // Calculate timeout (default 12 hours for async campaigns)
      const voteTimeoutHours = typeof timeoutHours === 'number' ? timeoutHours : 12;
      const voteStartedAt = new Date().toISOString();
      const voteExpiresAt = new Date(Date.now() + voteTimeoutHours * 60 * 60 * 1000).toISOString();
      
      await db.update(dmSessionStates)
        .set({
          activeGroupChoices: formattedChoices,
          groupChoiceVotes: [],
          groupChoiceStatus: 'pending',
          groupChoiceThreshold: threshold || 0,
          groupChoiceResolution: {
            voteStartedAt,
            voteExpiresAt,
            voteTimeoutHours
          },
          lastUpdatedAt: new Date().toISOString(),
        })
        .where(eq(dmSessionStates.campaignId, campaignId));
      
      // Broadcast to all players
      broadcastMessage('group-choices-updated', {
        campaignId,
        choices: formattedChoices,
        status: 'pending',
        votes: [],
        threshold: threshold || 0
      });
      
      res.json({ success: true, choices: formattedChoices });
    } catch (error) {
      console.error("Failed to create group choices:", error);
      res.status(500).json({ message: "Failed to create group choices" });
    }
  });

  // AI-generate group choices (DM only)
  app.post("/api/campaigns/:campaignId/group-choices/generate", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign || campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the DM can generate group choices" });
      }
      
      const { context, numChoices } = req.body;
      const choiceCount = numChoices || 4;
      
      // Get current session for context
      const session = await storage.getCampaignSession(campaignId, campaign.currentSession || 1);
      const narrative = session?.narrative || "The party stands at a crossroads.";
      
      const prompt = `You are a D&D 5e Dungeon Master. Generate ${choiceCount} meaningful choices for a party of adventurers.

Current situation: ${context || narrative}

For each choice, provide:
- text: Short action text (e.g., "Sneak past the guards")
- description: Brief description of the approach
- dc: Difficulty class if applicable (number 5-25, or null if no check needed)
- skillCheck: The skill required if DC is set (e.g., "Stealth", "Persuasion", "Athletics")
- modifier: Any situational modifier (e.g., "+2 if using cover", or null)

Return ONLY valid JSON array with ${choiceCount} choices. No markdown, no explanation.
Example: [{"text":"Sneak past","description":"Use shadows to avoid detection","dc":15,"skillCheck":"Stealth","modifier":null}]`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
      });
      
      let choices: any[] = [];
      const content = response.choices[0]?.message?.content || '[]';
      try {
        // Try to parse, handling potential markdown wrapping
        let cleaned = content.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        }
        choices = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error("Failed to parse AI choices:", parseErr);
        // Fallback to basic choices
        choices = [
          { text: "Proceed cautiously", description: "Take the careful approach", dc: null, skillCheck: null, modifier: null },
          { text: "Rush forward", description: "Act with urgency", dc: 12, skillCheck: "Athletics", modifier: null },
          { text: "Seek information", description: "Look for clues or ask around", dc: 10, skillCheck: "Investigation", modifier: null },
          { text: "Find another way", description: "Search for an alternative", dc: 14, skillCheck: "Perception", modifier: null },
        ];
      }
      
      // Format choices with IDs
      const formattedChoices = choices.map((choice: any, index: number) => ({
        id: `choice-${index + 1}`,
        text: choice.text || `Option ${index + 1}`,
        description: choice.description || '',
        dc: choice.dc || null,
        modifier: choice.modifier || null,
        skillCheck: choice.skillCheck || null,
        createdBy: 'ai'
      }));
      
      res.json({ success: true, choices: formattedChoices });
    } catch (error: any) {
      console.error("Failed to generate group choices:", error);
      console.error("Error details:", error?.message, error?.response?.data || error?.cause);
      res.status(500).json({ message: "Failed to generate choices", error: error?.message || "Unknown error" });
    }
  });

  // Cast vote on group choice (any participant)
  app.post("/api/campaigns/:campaignId/group-choices/vote", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const { choiceId, characterId, characterName } = req.body;
      
      if (!choiceId) {
        return res.status(400).json({ message: "Choice ID is required" });
      }
      
      // Get current state
      const sessionState = await db.select().from(dmSessionStates)
        .where(eq(dmSessionStates.campaignId, campaignId))
        .limit(1);
      
      if (sessionState.length === 0) {
        return res.status(404).json({ message: "No session state found" });
      }
      
      const state = sessionState[0];
      if (state.groupChoiceStatus !== 'pending') {
        return res.status(400).json({ message: "No active vote in progress" });
      }
      
      const currentVotes = (state.groupChoiceVotes as any[]) || [];
      const choices = (state.activeGroupChoices as any[]) || [];
      
      // Validate choice exists
      if (!choices.find((c: any) => c.id === choiceId)) {
        return res.status(400).json({ message: "Invalid choice ID" });
      }
      
      // Remove previous vote from same character/user
      const filteredVotes = currentVotes.filter((v: any) => 
        v.userId !== req.user.id && v.characterId !== characterId
      );
      
      // Add new vote
      const newVote = {
        choiceId,
        characterId: characterId || null,
        characterName: characterName || req.user.username,
        userId: req.user.id,
        timestamp: new Date().toISOString()
      };
      
      const updatedVotes = [...filteredVotes, newVote];
      
      await db.update(dmSessionStates)
        .set({
          groupChoiceVotes: updatedVotes,
          lastUpdatedAt: new Date().toISOString(),
        })
        .where(eq(dmSessionStates.campaignId, campaignId));
      
      // Calculate vote counts
      const voteCounts: Record<string, number> = {};
      choices.forEach((c: any) => { voteCounts[c.id] = 0; });
      updatedVotes.forEach((v: any) => { voteCounts[v.choiceId] = (voteCounts[v.choiceId] || 0) + 1; });
      
      // Broadcast updated votes
      broadcastMessage('group-choice-vote', {
        campaignId,
        votes: updatedVotes,
        voteCounts,
        latestVote: newVote
      });
      
      res.json({ success: true, votes: updatedVotes, voteCounts });
    } catch (error) {
      console.error("Failed to cast vote:", error);
      res.status(500).json({ message: "Failed to cast vote" });
    }
  });

  // Resolve group choice (DM only)
  app.post("/api/campaigns/:campaignId/group-choices/resolve", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign || campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the DM can resolve group choices" });
      }
      
      // Get current state
      const sessionState = await db.select().from(dmSessionStates)
        .where(eq(dmSessionStates.campaignId, campaignId))
        .limit(1);
      
      if (sessionState.length === 0) {
        return res.status(404).json({ message: "No session state found" });
      }
      
      const state = sessionState[0];
      const choices = (state.activeGroupChoices as any[]) || [];
      const votes = (state.groupChoiceVotes as any[]) || [];
      const initiativeOrder = (state.initiativeOrder as any[]) || [];
      
      if (choices.length === 0) {
        return res.status(400).json({ message: "No active choices to resolve" });
      }
      
      // Count votes per choice
      const voteCounts: Record<string, number> = {};
      choices.forEach((c: any) => { voteCounts[c.id] = 0; });
      votes.forEach((v: any) => { voteCounts[v.choiceId] = (voteCounts[v.choiceId] || 0) + 1; });
      
      // Find winner
      let maxVotes = 0;
      let winners: string[] = [];
      Object.entries(voteCounts).forEach(([choiceId, count]) => {
        if (count > maxVotes) {
          maxVotes = count;
          winners = [choiceId];
        } else if (count === maxVotes && count > 0) {
          winners.push(choiceId);
        }
      });
      
      let winningChoiceId: string;
      let resolutionMethod: string = 'majority';
      
      if (winners.length === 1) {
        winningChoiceId = winners[0];
      } else if (winners.length > 1 && initiativeOrder.length > 0) {
        // Tie-break by initiative order
        resolutionMethod = 'initiative';
        // Find first player in initiative who voted for a tied choice
        for (const initEntry of initiativeOrder) {
          const playerVote = votes.find((v: any) => 
            (v.characterId === initEntry.characterId || v.characterName === initEntry.name) &&
            winners.includes(v.choiceId)
          );
          if (playerVote) {
            winningChoiceId = playerVote.choiceId;
            break;
          }
        }
        // If no initiative match, pick first tied choice
        winningChoiceId = winningChoiceId! || winners[0];
      } else {
        // No votes or still tied - pick first choice
        winningChoiceId = winners[0] || choices[0]?.id;
        resolutionMethod = 'default';
      }
      
      const winningChoice = choices.find((c: any) => c.id === winningChoiceId);
      
      const resolution = {
        winningChoiceId,
        winningChoice,
        method: resolutionMethod,
        voteCounts,
        totalVotes: votes.length,
        resolvedAt: new Date().toISOString()
      };
      
      await db.update(dmSessionStates)
        .set({
          groupChoiceStatus: 'resolved',
          groupChoiceResolution: resolution,
          lastUpdatedAt: new Date().toISOString(),
        })
        .where(eq(dmSessionStates.campaignId, campaignId));
      
      // Broadcast resolution
      broadcastMessage('group-choice-resolved', {
        campaignId,
        resolution
      });
      
      res.json({ success: true, resolution });
    } catch (error) {
      console.error("Failed to resolve group choice:", error);
      res.status(500).json({ message: "Failed to resolve choice" });
    }
  });

  // Clear group choices (DM only)
  app.delete("/api/campaigns/:campaignId/group-choices", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign || campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the DM can clear group choices" });
      }
      
      await db.update(dmSessionStates)
        .set({
          activeGroupChoices: [],
          groupChoiceVotes: [],
          groupChoiceStatus: 'none',
          groupChoiceThreshold: 0,
          groupChoiceResolution: null,
          lastUpdatedAt: new Date().toISOString(),
        })
        .where(eq(dmSessionStates.campaignId, campaignId));
      
      // Broadcast clear
      broadcastMessage('group-choices-cleared', { campaignId });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to clear group choices:", error);
      res.status(500).json({ message: "Failed to clear choices" });
    }
  });

  // Add session artifact (from drag-and-drop)
  app.post("/api/campaigns/:campaignId/session-artifact", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign || campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the DM can add artifacts" });
      }
      
      const { id, type, entityId, name, data } = req.body;
      
      // Validate required fields
      if (!type || typeof type !== 'string') {
        return res.status(400).json({ message: "Type is required and must be a string" });
      }
      
      if (!entityId || typeof entityId !== 'string') {
        return res.status(400).json({ message: "EntityId is required and must be a string" });
      }
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: "Name is required and must be a string" });
      }
      
      // Get current session state
      const sessionState = await db.select().from(dmSessionStates)
        .where(eq(dmSessionStates.campaignId, campaignId))
        .limit(1);
      
      if (sessionState.length === 0) {
        return res.status(404).json({ message: "No session state found" });
      }
      
      // Add artifact
      const currentArtifacts = (sessionState[0].sessionArtifacts as any[]) || [];
      const newArtifact = {
        id,
        type,
        entityId,
        name,
        data,
        addedAt: new Date().toISOString(),
      };
      
      const updated = await db.update(dmSessionStates)
        .set({
          sessionArtifacts: [...currentArtifacts, newArtifact],
          lastUpdatedAt: new Date().toISOString(),
        })
        .where(eq(dmSessionStates.campaignId, campaignId))
        .returning();
      
      // Broadcast to players
      broadcastMessage('session-artifact-added', {
        campaignId,
        artifact: newArtifact
      });
      
      res.json({ success: true, artifact: newArtifact });
    } catch (error) {
      console.error("Failed to add session artifact:", error);
      res.status(500).json({ message: "Failed to add artifact" });
    }
  });

  // Load CAML entities into session for sidebar pre-population
  app.post("/api/campaigns/:campaignId/load-caml-entities", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign || campaign.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the DM can load CAML entities" });
      }
      
      const { camlContent, format } = req.body;
      
      let pack;
      try {
        if (format === 'yaml' || format === 'yml') {
          pack = parseCAMLYaml(camlContent);
        } else {
          pack = parseCAMLJson(camlContent);
        }
      } catch (parseError) {
        return res.status(400).json({ message: `Parse error: ${parseError}` });
      }
      
      if (!pack) {
        return res.status(400).json({ message: "Failed to parse CAML content" });
      }
      
      // Extract entities from CAML
      const entities = {
        npcs: pack.world?.characters || [],
        items: pack.world?.items || [],
        locations: pack.world?.locations || [],
        encounters: pack.processes?.filter((p: any) => p.type === 'encounter') || [],
        connections: pack.world?.connections || [],
      };
      
      // Update session state with CAML entities
      const updated = await db.update(dmSessionStates)
        .set({
          camlEntitySources: entities,
          lastUpdatedAt: new Date().toISOString(),
        })
        .where(eq(dmSessionStates.campaignId, campaignId))
        .returning();
      
      res.json({
        success: true,
        loaded: {
          npcs: entities.npcs.length,
          items: entities.items.length,
          locations: entities.locations.length,
          encounters: entities.encounters.length,
        }
      });
    } catch (error) {
      console.error("Failed to load CAML entities:", error);
      res.status(500).json({ message: "Failed to load CAML entities" });
    }
  });

  // Advance story based on player choice with continuity
  app.post("/api/campaigns/:campaignId/advance-story", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const campaignId = parseInt(req.params.campaignId);
      const { choice, rollResult, currentLocation, skipTurnCheck } = req.body;
      
      console.log(`[Advance Story] Campaign ${campaignId} - Choice: "${choice?.substring(0, 50)}..." by user ${req.user?.id}`);
      
      // Get campaign to check turn-based settings
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // DM Authoring Doctrine: Auto-improvise doctrine fields for campaigns that lack them
      const improvised = await improviseDoctrine(campaign);
      if (improvised) {
        (campaign as any).campaignQuestion = improvised.campaignQuestion;
        (campaign as any).campaignStakes = improvised.campaignStakes;
        (campaign as any).chapterGates = improvised.chapterGates;
      }
      
      // Enforce turn order in multiplayer campaigns (unless DM or skipTurnCheck is true)
      const isDM = campaign.userId === req.user.id;
      const participants = await storage.getCampaignParticipants(campaignId);
      const isMultiplayer = participants.length > 1;
      
      if (campaign.isTurnBased && isMultiplayer && !isDM && !skipTurnCheck) {
        // Check if it's this player's turn
        if (campaign.currentTurnUserId && campaign.currentTurnUserId !== req.user.id) {
          // Record the turn enforcement event
          await recordTrace(campaignId, "everdice.turnEnforced", {
            attemptedByUserId: req.user.id,
            currentTurnUserId: campaign.currentTurnUserId,
            blocked: true
          }, { who: `player.${req.user.id}` });
          
          return res.status(403).json({ 
            message: "It's not your turn. Please wait for other players to finish their turns.",
            currentTurnUserId: campaign.currentTurnUserId,
            isTurnBased: true
          });
        }
      }
      
      // Validate the player's choice against game rules
      const validationResult = validatePlayerChoice(choice, req.user, campaign, participants);
      if (!validationResult.valid) {
        await recordTrace(campaignId, "everdice.actionValidated", {
          choice,
          valid: false,
          reason: validationResult.reason
        }, { who: `player.${req.user.id}` });
        
        return res.status(400).json({
          message: validationResult.reason,
          suggestion: validationResult.suggestion
        });
      }
      
      // Record successful validation (only for non-empty choices)
      if (choice && choice.trim()) {
        await recordTrace(campaignId, "everdice.actionValidated", {
          choice,
          valid: true
        }, { who: `player.${req.user.id}` });
      }
      
      // Detect movement from choice text directly
      const detectMovementFromChoice = (choiceText: string): { isMovement: boolean; direction: string | null } => {
        const lowerChoice = choiceText.toLowerCase();
        
        // Movement patterns to detect - allow words after the direction
        const movementPatterns = [
          // Verb + direction patterns (allow anything after)
          { pattern: /\b(move|go|head|travel|walk|run|proceed|continue|venture|advance|push)\s+(north|northward)/i, direction: 'up' },
          { pattern: /\b(move|go|head|travel|walk|run|proceed|continue|venture|advance|push)\s+(south|southward)/i, direction: 'down' },
          { pattern: /\b(move|go|head|travel|walk|run|proceed|continue|venture|advance|push)\s+(east|eastward)/i, direction: 'right' },
          { pattern: /\b(move|go|head|travel|walk|run|proceed|continue|venture|advance|push)\s+(west|westward)/i, direction: 'left' },
          { pattern: /\b(move|go|head|travel|walk|run|proceed|continue|venture|advance|push)\s+(up|forward|ahead|forwards|deeper|further)/i, direction: 'up' },
          { pattern: /\b(move|go|head|travel|walk|run|proceed|continue|venture|advance|push)\s+(down|back|backward|backwards)/i, direction: 'down' },
          { pattern: /\b(move|go|head|travel|walk|run|proceed|continue|venture|advance|push)\s+(right)/i, direction: 'right' },
          { pattern: /\b(move|go|head|travel|walk|run|proceed|continue|venture|advance|push)\s+(left)/i, direction: 'left' },
          // Direction at start of choice
          { pattern: /^(north|northward)\b/i, direction: 'up' },
          { pattern: /^(south|southward)\b/i, direction: 'down' },
          { pattern: /^(east|eastward)\b/i, direction: 'right' },
          { pattern: /^(west|westward)\b/i, direction: 'left' },
          // "Enter/explore the X" patterns
          { pattern: /\benter\s+(the\s+)?(north|northern)/i, direction: 'up' },
          { pattern: /\benter\s+(the\s+)?(south|southern)/i, direction: 'down' },
          { pattern: /\benter\s+(the\s+)?(east|eastern)/i, direction: 'right' },
          { pattern: /\benter\s+(the\s+)?(west|western)/i, direction: 'left' },
          { pattern: /\bexplore\s+(the\s+)?(north|northern)/i, direction: 'up' },
          { pattern: /\bexplore\s+(the\s+)?(south|southern)/i, direction: 'down' },
          { pattern: /\bexplore\s+(the\s+)?(east|eastern)/i, direction: 'right' },
          { pattern: /\bexplore\s+(the\s+)?(west|western)/i, direction: 'left' },
          // "to the X" patterns
          { pattern: /\bto\s+the\s+(north)/i, direction: 'up' },
          { pattern: /\bto\s+the\s+(south)/i, direction: 'down' },
          { pattern: /\bto\s+the\s+(east)/i, direction: 'right' },
          { pattern: /\bto\s+the\s+(west)/i, direction: 'left' },
          // Simple directional words anywhere
          { pattern: /\bnorth\s+(passage|corridor|door|path|tunnel|room|exit|entrance|way)/i, direction: 'up' },
          { pattern: /\bsouth\s+(passage|corridor|door|path|tunnel|room|exit|entrance|way)/i, direction: 'down' },
          { pattern: /\beast\s+(passage|corridor|door|path|tunnel|room|exit|entrance|way)/i, direction: 'right' },
          { pattern: /\bwest\s+(passage|corridor|door|path|tunnel|room|exit|entrance|way)/i, direction: 'left' },
        ];
        
        for (const mp of movementPatterns) {
          if (mp.pattern.test(lowerChoice)) {
            console.log(`Movement detected: pattern ${mp.pattern} matched "${lowerChoice}", direction=${mp.direction}`);
            return { isMovement: true, direction: mp.direction };
          }
        }
        
        // Simple keyword detection
        if (lowerChoice.includes('north') || (lowerChoice.includes('move') && lowerChoice.includes('up'))) {
          return { isMovement: true, direction: 'up' };
        }
        if (lowerChoice.includes('south') || (lowerChoice.includes('move') && lowerChoice.includes('down'))) {
          return { isMovement: true, direction: 'down' };
        }
        if (lowerChoice.includes('east') || (lowerChoice.includes('move') && lowerChoice.includes('right'))) {
          return { isMovement: true, direction: 'right' };
        }
        if (lowerChoice.includes('west') || (lowerChoice.includes('move') && lowerChoice.includes('left'))) {
          return { isMovement: true, direction: 'left' };
        }
        
        return { isMovement: false, direction: null };
      };
      
      const detectedMovement = detectMovementFromChoice(choice || '');
      console.log(`Choice movement detection: "${choice}" => isMovement=${detectedMovement.isMovement}, direction=${detectedMovement.direction}`);
      
      // Fetch current dungeon map state to inform AI of map constraints
      let currentMapState = "";
      let dungeonMaps = await storage.getCampaignDungeonMaps(campaignId);
      const activeMap = dungeonMaps.find((m: any) => m.isActive) || dungeonMaps[0];
      
      if (activeMap && activeMap.mapData) {
        const mapData = typeof activeMap.mapData === 'string' ? JSON.parse(activeMap.mapData) : activeMap.mapData;
        const playerPos = mapData.playerPosition || { x: 4, y: 4 };
        const currentTile = mapData.tiles?.[playerPos.y]?.[playerPos.x];
        
        // Analyze passable directions from current position
        const directions: Record<string, { dx: number, dy: number, name: string }> = {
          north: { dx: 0, dy: -1, name: 'north' },
          south: { dx: 0, dy: 1, name: 'south' },
          east: { dx: 1, dy: 0, name: 'east' },
          west: { dx: -1, dy: 0, name: 'west' }
        };
        
        const passableExits: string[] = [];
        const blockedDirections: string[] = [];
        const exitDetails: string[] = [];
        
        for (const [dir, delta] of Object.entries(directions)) {
          const nx = playerPos.x + delta.dx;
          const ny = playerPos.y + delta.dy;
          
          if (ny >= 0 && ny < mapData.height && nx >= 0 && nx < mapData.width) {
            const tile = mapData.tiles[ny][nx];
            const tileType = tile?.type || 'wall';
            
            if (tileType !== 'wall') {
              if (tileType === 'door_locked') {
                passableExits.push(`${dir} (locked door)`);
                exitDetails.push(`${dir.toUpperCase()}: A heavy locked door blocks the way. Requires a key or lockpicking (DC 15).`);
              } else if (tileType === 'secret_door') {
                if (tile?.explored) {
                  passableExits.push(`${dir} (secret passage)`);
                  exitDetails.push(`${dir.toUpperCase()}: A hidden passage you discovered, leading deeper into darkness.`);
                } else {
                  blockedDirections.push(dir);
                }
              } else if (tileType === 'door') {
                passableExits.push(`${dir} (door)`);
                exitDetails.push(`${dir.toUpperCase()}: An open doorway leading to another chamber.`);
              } else if (tileType === 'corridor') {
                passableExits.push(`${dir} (corridor)`);
                exitDetails.push(`${dir.toUpperCase()}: A narrow corridor stretches into shadow.`);
              } else if (tileType === 'trap') {
                passableExits.push(`${dir} (trap visible)`);
                exitDetails.push(`${dir.toUpperCase()}: A suspicious section of floor - possible trap!`);
              } else if (tileType === 'treasure') {
                passableExits.push(`${dir} (treasure)`);
                exitDetails.push(`${dir.toUpperCase()}: Something glints in the darkness - treasure ahead!`);
              } else {
                passableExits.push(dir);
                exitDetails.push(`${dir.toUpperCase()}: Open passage.`);
              }
            } else {
              blockedDirections.push(dir);
            }
          } else {
            blockedDirections.push(dir);
          }
        }
        
        // Describe the current room/tile - detect theme from campaign for better descriptions
        const themeTileDescriptions: Record<string, Record<string, string>> = {
          nautical: {
            'floor': 'a section of the ship deck with weathered wooden planks',
            'corridor': 'a narrow passage between ship cabins',
            'door': 'a cabin door reinforced with iron bands',
            'treasure': 'a cargo hold filled with crates and a locked chest',
            'trap': 'loose planks that might give way',
            'stairs_up': 'a ladder leading up to the main deck',
            'stairs_down': 'a hatch leading down to the lower decks',
            'water': 'a flooded section of the bilge',
            'lava': 'a section near the ship\'s burning galley',
            'pit': 'a gaping hole in the deck exposing the hold below'
          },
          forest: {
            'floor': 'a mossy forest clearing',
            'corridor': 'a winding path through dense undergrowth',
            'door': 'a natural archway formed by twisted branches',
            'treasure': 'a hollow tree containing hidden valuables',
            'trap': 'a section of ground concealing a snare',
            'stairs_up': 'roots and rocks forming a natural climb',
            'stairs_down': 'a slope descending into a shadowy ravine',
            'water': 'a stream cutting through the forest floor',
            'lava': 'ground scorched by wildfire',
            'pit': 'a natural sinkhole covered by leaves'
          },
          urban: {
            'floor': 'a cobblestone plaza',
            'corridor': 'a narrow alleyway between buildings',
            'door': 'a heavy wooden door to a building',
            'treasure': 'a merchant\'s back room with a safe',
            'trap': 'suspicious loose cobblestones',
            'stairs_up': 'a wooden staircase ascending',
            'stairs_down': 'stone steps leading to a cellar',
            'water': 'a flooded sewer section',
            'lava': 'a smithy\'s forge area',
            'pit': 'an open sewer grate'
          },
          desert: {
            'floor': 'a sand-covered chamber with cracked sandstone walls',
            'corridor': 'a narrow passage between eroded rock formations',
            'door': 'a heavy stone slab carved with sun motifs',
            'treasure': 'an alcove behind a sand-filled urn containing buried valuables',
            'trap': 'a section of loose sand concealing a pressure plate',
            'stairs_up': 'a ramp of packed sand leading upward toward light',
            'stairs_down': 'worn steps descending into cool darkness below the dunes',
            'water': 'a hidden underground spring pooling in a basin',
            'lava': 'a vent of superheated air rising from deep below',
            'pit': 'a sand-choked sinkhole that drops into darkness'
          },
          mountain: {
            'floor': 'a rough-hewn cavern with granite walls',
            'corridor': 'a narrow mine shaft braced with timber supports',
            'door': 'a reinforced iron door set into the rock face',
            'treasure': 'a vein of precious ore glinting in the wall beside a locked strongbox',
            'trap': 'unstable rubble that could trigger a rockslide',
            'stairs_up': 'a steep switchback carved into the cliff face',
            'stairs_down': 'a spiral staircase bored deep into the mountain',
            'water': 'an underground stream fed by snowmelt',
            'lava': 'a fissure glowing with volcanic heat from below',
            'pit': 'a vertical shaft dropping into echoing darkness'
          },
          swamp: {
            'floor': 'a soggy platform of packed mud and rotting logs',
            'corridor': 'a raised boardwalk over murky, stagnant water',
            'door': 'a curtain of hanging moss and vines concealing the entrance',
            'treasure': 'a waterlogged chest half-buried in the muck',
            'trap': 'a patch of seemingly solid ground that is actually deep mud',
            'stairs_up': 'gnarled roots forming a natural ladder up a massive tree',
            'stairs_down': 'a slope descending into a flooded root cellar',
            'water': 'a pool of dark, brackish water buzzing with insects',
            'lava': 'a patch of bubbling, toxic marsh gas venting from the ground',
            'pit': 'a sinkhole of thick, sucking mud'
          },
          arctic: {
            'floor': 'a frost-covered chamber with walls of compacted snow and ice',
            'corridor': 'a narrow ice tunnel with smooth, slippery walls',
            'door': 'a thick slab of ice blocking the passage',
            'treasure': 'a frozen alcove containing items preserved in clear ice',
            'trap': 'a section of thin ice over a deep crevasse',
            'stairs_up': 'a series of icy ledges climbing toward a wind-howling opening',
            'stairs_down': 'a chute of smooth ice descending into blue-lit depths',
            'water': 'a pool of glacial meltwater, numbingly cold',
            'lava': 'a thermal vent melting the surrounding ice into steam',
            'pit': 'a deep glacial crevasse with jagged ice walls'
          },
          feywild: {
            'floor': 'a clearing carpeted with luminous wildflowers and soft clover',
            'corridor': 'a winding path between trees whose branches form a living archway',
            'door': 'a shimmering curtain of golden pollen hanging in the air',
            'treasure': 'a fairy ring surrounding a pedestal of living wood bearing gifts',
            'trap': 'an enchanting melody that lures travelers off the safe path',
            'stairs_up': 'a spiral of giant mushroom caps ascending like a staircase',
            'stairs_down': 'a rabbit hole between enormous roots leading underground',
            'water': 'a crystal-clear brook with water that changes color as it flows',
            'lava': 'a pool of liquid starlight that burns with cold fire',
            'pit': 'a gap between roots dropping into a twilight-lit hollow'
          },
          underdark: {
            'floor': 'a cavern of dark stone with phosphorescent fungi clinging to the walls',
            'corridor': 'a tight passage through dripping stalactites and stalagmites',
            'door': 'a carved stone portal with spider-silk hinges',
            'treasure': 'a drow cache hidden behind a false stalagmite',
            'trap': 'a web-covered section of floor concealing a drop',
            'stairs_up': 'a chimney of natural rock with handholds carved into the wall',
            'stairs_down': 'a spiraling descent into ever-deeper darkness',
            'water': 'an underground lake of perfectly still, black water',
            'lava': 'a magma flow visible through cracks in the cavern floor',
            'pit': 'a bottomless chasm echoing with distant, unidentifiable sounds'
          },
          planar: {
            'floor': 'a platform of shifting, translucent material floating in void',
            'corridor': 'a bridge of solidified energy spanning between floating islands',
            'door': 'a portal frame crackling with residual planar energy',
            'treasure': 'a crystallized fragment of another plane containing trapped valuables',
            'trap': 'a section where gravity reverses without warning',
            'stairs_up': 'a column of ascending force that lifts you to the next level',
            'stairs_down': 'a controlled descent through layers of thinning reality',
            'water': 'a pool of liquid that reflects a different plane of existence',
            'lava': 'a stream of raw elemental fire flowing through a channel',
            'pit': 'a tear in the fabric of the plane dropping into nothingness'
          },
          undead: {
            'floor': 'a crypt chamber with cracked flagstones and scattered bones',
            'corridor': 'a narrow passage lined with burial niches and dusty remains',
            'door': 'a heavy tomb door bearing warnings carved in old script',
            'treasure': 'a sarcophagus with funerary offerings laid around it',
            'trap': 'a section of floor that triggers a burst of necrotic gas',
            'stairs_up': 'a stairway ascending past rows of sealed crypts',
            'stairs_down': 'steps descending into the deeper catacombs',
            'water': 'a pool of dark, stagnant water with a faint sulfurous smell',
            'lava': 'braziers of unnatural green flame burning without fuel',
            'pit': 'an open mass grave with disturbed earth at the bottom'
          },
          default: {
            'floor': 'an open chamber with stone floors',
            'corridor': 'a narrow corridor',
            'door': 'a doorway',
            'treasure': 'a room with a treasure chest',
            'trap': 'a room with suspicious floor tiles',
            'stairs_up': 'a room with stairs leading up',
            'stairs_down': 'a room with stairs leading down',
            'water': 'a flooded area with water on the floor',
            'lava': 'a dangerous area near molten lava',
            'pit': 'an area with a deep pit'
          }
        };
        
        // Detect theme for tile descriptions
        const mapThemeText = `${campaign?.title || ''} ${campaign?.description || ''}`.toLowerCase();
        let mapTheme = 'default';
        const tileThemeKeywords: Record<string, string[]> = {
          nautical: ['ship', 'sea', 'ocean', 'pirate', 'sailor', 'nautical', 'harbor', 'coast', 'voyage'],
          forest: ['forest', 'wood', 'tree', 'grove', 'wilderness', 'druid', 'ranger', 'woodland'],
          urban: ['city', 'town', 'urban', 'guild', 'tavern', 'sewer', 'marketplace', 'castle'],
          desert: ['desert', 'sand', 'pyramid', 'oasis', 'dune', 'arid', 'caravan'],
          mountain: ['mountain', 'cave', 'mine', 'dwarf', 'peak', 'cliff', 'summit', 'volcano'],
          swamp: ['swamp', 'marsh', 'bog', 'bayou', 'wetland', 'mire', 'murky'],
          arctic: ['arctic', 'ice', 'snow', 'frost', 'frozen', 'tundra', 'glacier', 'blizzard'],
          feywild: ['fey', 'feywild', 'fairy', 'pixie', 'archfey', 'enchanted', 'whimsical'],
          underdark: ['underdark', 'drow', 'subterranean', 'cavern', 'illithid', 'mind flayer'],
          planar: ['plane', 'planar', 'portal', 'astral', 'ethereal', 'elemental', 'demon', 'devil'],
          undead: ['undead', 'zombie', 'skeleton', 'vampire', 'necromancer', 'graveyard', 'tomb', 'haunted'],
        };
        let mapBestScore = 0;
        for (const [theme, kws] of Object.entries(tileThemeKeywords)) {
          const score = kws.filter(kw => mapThemeText.includes(kw)).length;
          if (score >= 2 && score > mapBestScore) { mapBestScore = score; mapTheme = theme; }
        }
        
        const tileTypeDescriptions = themeTileDescriptions[mapTheme] || themeTileDescriptions.default;
        
        const currentRoomDesc = mapData.currentRoom?.description || 
          tileTypeDescriptions[currentTile?.type || 'floor'] || 
          'a stone chamber';
        
        // Get nearby entities (enemies, NPCs)
        const nearbyEntities: string[] = [];
        if (mapData.entities && mapData.entities.length > 0) {
          for (const entity of mapData.entities) {
            const dist = Math.abs(entity.x - playerPos.x) + Math.abs(entity.y - playerPos.y);
            if (dist <= 3) {
              nearbyEntities.push(`${entity.name} (${entity.type}) - ${dist === 0 ? 'in this room' : dist + ' tiles away'}`);
            }
          }
        }
        
        // Get room features from current room data
        const roomFeatures = mapData.currentRoom?.features || [];
        const featuresList = roomFeatures.length > 0 ? roomFeatures.join(', ') : 'stone walls, dusty floor';
        
        // Get lighting conditions
        const lighting = mapData.currentRoom?.lighting || 'dim torchlight';
        
        currentMapState = `
DUNGEON MAP STATE (CRITICAL - Your narrative MUST accurately describe this environment!):
═══════════════════════════════════════════════════════════════════════════════

CURRENT LOCATION:
- Position: (${playerPos.x}, ${playerPos.y})
- Room Name: ${mapData.currentRoom?.name || 'Unknown Chamber'}
- Room Description: ${currentRoomDesc}
- Lighting: ${lighting}
- Visible Features: ${featuresList}

EXITS (You MUST only reference these exits in your narrative):
${exitDetails.length > 0 ? exitDetails.join('\n') : 'No visible exits - the party is trapped!'}

BLOCKED DIRECTIONS (DO NOT mention these as options): ${blockedDirections.length > 0 ? blockedDirections.join(', ') : 'None'}

${nearbyEntities.length > 0 ? `NEARBY CREATURES:\n${nearbyEntities.join('\n')}` : ''}

═══════════════════════════════════════════════════════════════════════════════
NARRATIVE RULES (MANDATORY):
1. Your description MUST match the room description and features above
2. Only mention exits that exist in the EXITS list - DO NOT invent new passages
3. If describing movement options, only offer directions from PASSABLE EXITS
4. Blocked directions have solid walls - never suggest the party can go that way
5. Match the lighting description in your narrative (${lighting})
6. If enemies are listed above, acknowledge their presence
═══════════════════════════════════════════════════════════════════════════════
`;
      }
      
      // Chapter tracking and finale detection
      const currentChapter = campaign.currentSession || 1;
      const totalChapters = campaign.totalChapters || 5;
      const isOnFinalChapter = currentChapter >= totalChapters;
      const isCampaignCompleted = campaign.isCompleted;
      
      // Prevent progression if campaign is already completed
      if (isCampaignCompleted) {
        return res.status(400).json({
          message: "This campaign has been completed!",
          isCompleted: true,
          suggestion: "You can view your achievements or start a new adventure."
        });
      }
      
      console.log(`[Advance Story] Chapter ${currentChapter}/${totalChapters} - Final chapter: ${isOnFinalChapter}`);
      
      let currentSession = await storage.getCurrentSession(campaignId);
      if (!currentSession) {
        // Auto-create a session for the campaign if none exists
        const initialStoryState = {
          activeQuests: [],
          completedQuests: [],
          discoveredLocations: [],
          inventory: [],
          npcsEncountered: [],
          decisions: [],
          combatLog: [],
          location: "the starting area"
        };
        
        currentSession = await storage.createCampaignSession({
          campaignId,
          sessionNumber: 1,
          title: "Chapter 1: The Beginning",
          narrative: `Welcome to ${campaign.title}! Your adventure begins...`,
          choices: ["Begin your adventure", "Look around", "Check your equipment"],
          storyState: initialStoryState,
          createdAt: new Date().toISOString()
        });
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
      
      // Use participants already fetched above for turn enforcement
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
        
        await storage.advanceSessionStory(campaignId, {
          narrative: adventureEndNarrative,
          choices: [],
          title: currentSession.title,
          sessionNumber: currentSession.sessionNumber,
          storyState: {
            ...(currentSession.storyState as any || {}),
            adventureEnded: true,
            endReason: 'player_death',
            inCombat: false
          },
          actionLogEntries: [{
            type: 'narrative',
            timestamp: new Date().toISOString(),
            text: adventureEndNarrative,
            sceneType: 'Death',
          }]
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
      
      // Use campaign already fetched above for turn enforcement
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
      
      // Detect adventure theme from campaign title, description, and current narrative
      const campaignText = `${campaign?.title || ''} ${campaign?.description || ''} ${currentSession.narrative || ''}`.toLowerCase();
      
      // Theme detection with environmental vocabulary — expanded for variety
      const themeDetection: Record<string, { keywords: string[]; environments: string[]; enemies: string[]; features: string[] }> = {
        nautical: {
          keywords: ['ship', 'sea', 'ocean', 'pirate', 'sailor', 'maritime', 'naval', 'harbor', 'vessel', 'crew', 'deck', 'anchor', 'sail', 'nautical', 'kraken', 'mermaid', 'lighthouse', 'coast', 'voyage'],
          environments: ['ship deck', 'cargo hold', 'captain\'s quarters', 'crow\'s nest', 'galley', 'harbor warehouse', 'dock', 'lighthouse', 'sea cave', 'shipwreck', 'island beach', 'underwater grotto'],
          enemies: ['pirates', 'sahuagin', 'sea hags', 'merrow', 'water elementals', 'giant crabs', 'reef sharks', 'sea serpents', 'smugglers', 'kuo-toa', 'storm giants', 'aboleth'],
          features: ['wooden planks', 'rope rigging', 'salt-crusted barrels', 'navigation charts', 'ship\'s wheel', 'anchor chains', 'fishing nets', 'barnacle-covered surfaces', 'porthole windows', 'swaying lanterns']
        },
        forest: {
          keywords: ['forest', 'wood', 'tree', 'grove', 'glade', 'druid', 'nature', 'wilderness', 'hunt', 'ranger', 'elven', 'sylvan', 'woodland'],
          environments: ['ancient grove', 'forest clearing', 'tree hollow', 'overgrown ruins', 'druid circle', 'hunter\'s camp', 'animal den', 'stream crossing', 'fallen tree bridge', 'canopy walkway'],
          enemies: ['wolves', 'bears', 'giant spiders', 'goblins', 'orcs', 'bandits', 'dryads', 'treants', 'ettercaps', 'owlbears', 'displacer beasts', 'blights'],
          features: ['twisted roots', 'moss-covered stones', 'fallen logs', 'mushroom circles', 'animal tracks', 'bird nests', 'vines', 'wildflowers', 'ancient trees']
        },
        undead: {
          keywords: ['undead', 'zombie', 'skeleton', 'vampire', 'necromancer', 'graveyard', 'tomb', 'death', 'cursed', 'haunted', 'ghost', 'specter', 'lich'],
          environments: ['crypt chamber', 'bone-filled ossuary', 'vampire\'s lair', 'haunted manor', 'necromancer\'s laboratory', 'mass grave', 'mausoleum', 'embalming room', 'coffin storage'],
          enemies: ['zombies', 'skeletons', 'ghouls', 'ghosts', 'wraiths', 'wights', 'vampires', 'vampire spawn', 'necromancers', 'death knights', 'shadows', 'specters'],
          features: ['coffins', 'tombstones', 'skeletal remains', 'cobwebs', 'rotting tapestries', 'candelabras', 'burial urns', 'death masks', 'necromantic circles']
        },
        desert: {
          keywords: ['desert', 'sand', 'pyramid', 'oasis', 'scorpion', 'mummy', 'pharaoh', 'sphinx', 'sandstorm', 'dune', 'arid', 'wasteland', 'sultan', 'bazaar', 'caravan'],
          environments: ['pyramid chamber', 'buried temple', 'oasis camp', 'sand-filled tomb', 'sun-bleached ruins', 'scorpion den', 'sultan\'s palace', 'desert bazaar', 'sandstone canyon', 'nomad camp'],
          enemies: ['mummies', 'giant scorpions', 'dust mephits', 'gnolls', 'sphinxes', 'animated statues', 'sand elementals', 'yuan-ti', 'blue dragons', 'jackalweres', 'lamias'],
          features: ['hieroglyphics', 'sarcophagi', 'sand drifts', 'stone pillars', 'golden treasures', 'oil lamps', 'palm fronds', 'water jugs', 'sandstone carvings', 'sun-bleached bones']
        },
        mountain: {
          keywords: ['mountain', 'cave', 'mine', 'dwarf', 'dwarven', 'giant', 'dragon', 'peak', 'cliff', 'gorge', 'avalanche', 'volcano', 'ridge', 'summit'],
          environments: ['mine shaft', 'crystal cavern', 'dragon\'s lair', 'mountain pass', 'dwarven forge', 'giant\'s throne room', 'volcanic vent', 'cliff ledge', 'summit shrine'],
          enemies: ['giants', 'dragons', 'cave bears', 'trolls', 'kobolds', 'duergar', 'galeb duhr', 'rocs', 'yetis', 'wyverns', 'basilisks'],
          features: ['mine carts', 'gem deposits', 'stalactites', 'underground rivers', 'dwarven runes', 'forge equipment', 'crystalline formations', 'volcanic glass']
        },
        urban: {
          keywords: ['city', 'town', 'tavern', 'guild', 'noble', 'thief', 'assassin', 'sewer', 'criminal', 'marketplace', 'castle', 'politics', 'court', 'council'],
          environments: ['tavern back room', 'noble\'s mansion', 'thieves\' guild hideout', 'city sewers', 'guard barracks', 'market square', 'abandoned warehouse', 'council chamber', 'arena'],
          enemies: ['thugs', 'assassins', 'corrupt guards', 'gang members', 'wererats', 'doppelgangers', 'cultists', 'noble rivals', 'mimics', 'gargoyles'],
          features: ['wooden tables', 'wanted posters', 'merchant stalls', 'sewer grates', 'hidden doors', 'ornate furniture', 'candle chandeliers', 'cobblestone streets']
        },
        swamp: {
          keywords: ['swamp', 'marsh', 'bog', 'bayou', 'wetland', 'mire', 'fen', 'lizardfolk', 'hag', 'mangrove', 'fog', 'mist', 'murky', 'humid'],
          environments: ['murky shallows', 'sunken ruin', 'hag\'s hut on stilts', 'lizardfolk village', 'rotting boardwalk', 'drowned temple', 'fog-shrouded clearing', 'root-tangled path', 'bubbling tar pit', 'moss-draped hollow'],
          enemies: ['lizardfolk', 'green hags', 'will-o\'-wisps', 'shambling mounds', 'bullywugs', 'hydras', 'trolls', 'yuan-ti', 'giant crocodiles', 'vine blights', 'black dragons', 'catoblepas'],
          features: ['stagnant water', 'twisted mangroves', 'glowing fungi', 'decaying logs', 'insect swarms', 'hanging moss', 'bubbling mud', 'half-submerged stones', 'eerie fog', 'rotting vegetation']
        },
        arctic: {
          keywords: ['arctic', 'ice', 'snow', 'frost', 'frozen', 'tundra', 'glacier', 'blizzard', 'winter', 'cold', 'polar', 'permafrost', 'icebound'],
          environments: ['ice cave', 'frozen lake', 'glacial rift', 'snow-buried ruin', 'frost giant\'s hall', 'aurora-lit plateau', 'icebound ship', 'frozen waterfall', 'tundra camp', 'permafrost tomb'],
          enemies: ['frost giants', 'yetis', 'winter wolves', 'ice mephits', 'remorhazes', 'white dragons', 'cold-touched undead', 'ice elementals', 'crag cats', 'frost salamanders', 'ice trolls'],
          features: ['icicles', 'frozen pools', 'frost-covered runes', 'glacial walls', 'snow drifts', 'aurora reflections', 'ice pillars', 'frozen corpses', 'crystal-clear ice', 'howling wind gaps']
        },
        feywild: {
          keywords: ['fey', 'feywild', 'fairy', 'faerie', 'pixie', 'sprite', 'archfey', 'seelie', 'unseelie', 'enchanted', 'whimsical', 'otherworldly', 'glamour', 'trickster'],
          environments: ['fairy ring', 'enchanted glade', 'crystal palace', 'mushroom forest', 'twilight garden', 'archfey\'s court', 'ever-shifting maze', 'dreaming pool', 'moonlit bower', 'color-shifting meadow'],
          enemies: ['pixies', 'sprites', 'redcaps', 'quicklings', 'meenlocks', 'hags', 'eladrin', 'displacer beasts', 'blink dogs', 'green dragons', 'korreds', 'darklings'],
          features: ['glowing flowers', 'floating motes of light', 'impossible colors', 'talking animals', 'shifting paths', 'time-warped clearings', 'crystalline streams', 'sentient plants', 'musical winds', 'illusory architecture']
        },
        underdark: {
          keywords: ['underdark', 'drow', 'underground', 'cavern', 'subterranean', 'deep', 'darkness', 'illithid', 'mind flayer', 'myconid', 'fungus', 'abyss', 'duergar', 'svirfneblin'],
          environments: ['vast cavern', 'bioluminescent grotto', 'drow city', 'fungal forest', 'underground lake', 'mind flayer colony', 'crystal-studded tunnel', 'lava tube', 'myconid garden', 'aboleth\'s pool'],
          enemies: ['drow', 'mind flayers', 'driders', 'hook horrors', 'umber hulks', 'purple worms', 'myconids', 'deep gnomes', 'ropers', 'cloakers', 'intellect devourers', 'beholders'],
          features: ['bioluminescent fungus', 'stalactites and stalagmites', 'underground rivers', 'web-covered passages', 'crystal formations', 'phosphorescent pools', 'echo chambers', 'dripping ceilings', 'mineral veins', 'carved drow glyphs']
        },
        planar: {
          keywords: ['plane', 'planar', 'portal', 'astral', 'ethereal', 'elemental', 'celestial', 'infernal', 'demon', 'devil', 'angel', 'outer planes', 'inner planes', 'sigil', 'multiverse', 'limbo', 'mechanus'],
          environments: ['astral void', 'elemental nexus', 'celestial palace', 'infernal fortress', 'ethereal mist', 'floating island', 'planar crossroads', 'crystal sphere', 'chaos storm', 'divine sanctum'],
          enemies: ['demons', 'devils', 'angels', 'elementals', 'modrons', 'slaadi', 'githyanki', 'githzerai', 'night hags', 'marut', 'inevitables', 'planetar'],
          features: ['swirling portals', 'impossible geometry', 'floating debris', 'energy currents', 'planar rift marks', 'crystallized magic', 'gravity-defying structures', 'color pools', 'echoes of other worlds', 'reality fractures']
        },
        dungeon: {
          keywords: ['dungeon', 'crypt', 'ruin', 'ancient', 'temple', 'fortress', 'labyrinth', 'maze', 'catacomb'],
          environments: ['stone corridor', 'trapped hallway', 'ritual chamber', 'treasure vault', 'prison cells', 'throne room', 'armory', 'library', 'collapsed passage'],
          enemies: ['goblins', 'orcs', 'kobolds', 'minotaurs', 'gelatinous cubes', 'mimics', 'rust monsters', 'oozes', 'animated armors', 'gargoyles'],
          features: ['stone pillars', 'ancient runes', 'iron torches', 'dusty tapestries', 'crumbling statues', 'locked chests', 'pressure plates', 'iron portcullises']
        }
      };
      
      // Detect theme using weighted scoring with minimum confidence threshold
      const themeScores: Record<string, number> = {};
      for (const [themeName, themeData] of Object.entries(themeDetection)) {
        const matches = themeData.keywords.filter(kw => campaignText.includes(kw)).length;
        themeScores[themeName] = matches;
      }
      const sortedThemes = Object.entries(themeScores)
        .filter(([, score]) => score > 0)
        .sort((a, b) => b[1] - a[1]);
      
      const primaryTheme = sortedThemes[0]?.[0] || 'dungeon';
      const primaryScore = sortedThemes[0]?.[1] || 0;
      const secondaryTheme = sortedThemes[1]?.[0] || null;
      const secondaryScore = sortedThemes[1]?.[1] || 0;
      
      // Require at least 2 keyword matches for confident theme assignment
      const detectedTheme = primaryScore >= 2 ? primaryTheme : 'dungeon';
      // Blend if secondary theme has at least half the primary score
      const shouldBlend = secondaryTheme && secondaryScore >= 2 && secondaryScore >= primaryScore * 0.5;
      
      const activeTheme = themeDetection[detectedTheme] || themeDetection.dungeon;
      
      // Build theme context with blending support
      const themeDescriptions: Record<string, string> = {
        nautical: 'Use wooden decks, ship cabins, sea spray, creaking timbers, nautical equipment. Enemies should be sea creatures, pirates, or maritime threats. Describe the motion of waves, salt air, rigging sounds.',
        forest: 'Use dappled sunlight, rustling leaves, animal sounds, natural formations. Enemies should be forest creatures, fey, or wilderness threats. Describe birdsong, earthy scents, filtered light.',
        undead: 'Use decay, darkness, cold air, eerie silence. Enemies should be undead creatures, necromancers, or cursed spirits. Describe the chill of death, the stench of rot, flickering shadows.',
        desert: 'Use scorching heat, blinding sun, shifting sands, mirages. Enemies should be desert creatures, tomb guardians, or sand-dwelling threats. Describe dry wind, cracked earth, blazing sky.',
        mountain: 'Use thin air, echoing caverns, rocky terrain, dramatic vistas. Enemies should be giants, dragons, mountain predators, or subterranean threats. Describe howling wind, distant peaks, treacherous footing.',
        urban: 'Use city sounds, crowds, buildings, streets, social environments. Enemies should be criminals, corrupt officials, urban monsters, or rival factions. Describe bustling markets, shadowed alleys, political tension.',
        swamp: 'Use thick fog, stagnant water, buzzing insects, squelching mud. Enemies should be swamp creatures, hags, lizardfolk, or corrupted nature. Describe the stench of decay, croaking frogs, oppressive humidity.',
        arctic: 'Use biting cold, howling blizzards, cracking ice, blinding white. Enemies should be frost creatures, winter predators, or cold-adapted monsters. Describe freezing wind, breath clouds, treacherous ice.',
        feywild: 'Use impossible colors, shifting reality, whimsical beauty, hidden danger. Enemies should be fey creatures, tricksters, or enchanted beings. Describe time distortion, emotional landscapes, surreal beauty.',
        underdark: 'Use total darkness, bioluminescence, echoing caverns, alien landscapes. Enemies should be drow, mind flayers, aberrations, or deep creatures. Describe dripping water, phosphorescent glow, oppressive silence.',
        planar: 'Use impossible geometry, elemental forces, cosmic scale, reality-warping. Enemies should be extraplanar entities, elementals, or outsiders. Describe swirling energy, gravity shifts, dimensional echoes.',
        dungeon: 'Use stone corridors, ancient construction, hidden traps, forgotten chambers. Enemies should be dungeon-dwelling creatures, guardians, or underground threats. Describe echoing footsteps, torch flicker, dust and cobwebs.',
      };
      
      const primaryDesc = themeDescriptions[detectedTheme] || themeDescriptions.dungeon;
      const blendNote = shouldBlend && secondaryTheme
        ? `\nSECONDARY THEME INFLUENCE (${secondaryTheme.toUpperCase()}): Occasionally weave in elements of ${themeDescriptions[secondaryTheme] || ''}. About 20-30% of descriptions can draw from this secondary theme for variety.`
        : '';
      
      const themeContext = `
ADVENTURE THEME: ${detectedTheme.toUpperCase()}${shouldBlend ? ` (with ${secondaryTheme} influences)` : ''}
ENVIRONMENT CONTEXT: This adventure takes place in a ${detectedTheme} setting. Use appropriate descriptions:
- Typical environments: ${activeTheme.environments.slice(0, 5).join(', ')}
- Appropriate enemies: ${activeTheme.enemies.slice(0, 6).join(', ')}
- Environmental features: ${activeTheme.features.slice(0, 5).join(', ')}

${primaryDesc}
${blendNote}

CRITICAL: Do NOT use generic dungeon descriptions (stone corridors, ancient runes, spectral guardians) unless they fit the ${detectedTheme} theme.
Do NOT default to nautical themes (ghost sailors, kraken, shipwrecks) unless the campaign is explicitly set at sea.
Instead, describe environments that MATCH the campaign's actual setting and the ${detectedTheme} theme.
`;
      
      // Get previous scene type to prevent combat repetition
      const previousSceneType = (currentSession as any).previousSceneType || (currentSession as any).sceneType || null;
      const antiCombatRepeatNote = previousSceneType === 'Combat' 
        ? '\n\nIMPORTANT: The previous scene was Combat. This scene MUST be a different type (Exploration, Social, Discovery, Travel, Puzzle, or Downtime) unless the player explicitly initiates another fight.\n'
        : '';
      
      // Track scenes since last combat for random encounter nudging
      const sessionStoryState = (currentSession.storyState as any) || {};
      const scenesSinceCombat = sessionStoryState.scenesSinceCombat ?? 0;
      const shouldNudgeCombat = previousSceneType !== 'Combat' && scenesSinceCombat >= 4;
      
      // Build environment-aware random encounter suggestion when combat is overdue
      let randomEncounterNudge = '';
      if (shouldNudgeCombat) {
        const encounterSuggestions: Record<string, string[]> = {
          nautical: [
            'A sea serpent surfaces near the ship, drawn by noise',
            'Pirates spotted on the horizon — they\'re closing fast',
            'Sahuagin raiders emerge from the waves and scale the hull',
            'A water elemental surges up from the deep, capsizing cargo',
            'Merrow surface and attack, dragging crew toward the depths'
          ],
          forest: [
            'Wolves surround the party, drawn by the scent of provisions',
            'A band of goblins springs an ambush from the undergrowth',
            'An owlbear crashes through the trees, fiercely territorial',
            'Bandits block the forest path and demand payment',
            'Giant spiders drop from the canopy above'
          ],
          undead: [
            'Skeletons burst from the ground, reanimated by dark energy',
            'A pack of ghouls emerges from a side passage',
            'Shadows coalesce from the darkness and attack',
            'A wight leading zombie servants blocks the corridor',
            'Ghostly apparitions materialize and shriek in rage'
          ],
          desert: [
            'Giant scorpions erupt from the sand beneath the party\'s feet',
            'Gnoll raiders charge from behind a dune',
            'A mummy lord\'s servants animate and attack intruders',
            'Sand elementals whirl into form, blocking the path',
            'A blue dragon swoops down from a rocky outcrop'
          ],
          mountain: [
            'A cave troll charges from a crevice in the rock',
            'Kobolds rain stones and javelins from above',
            'A young wyvern dives from a cliff ledge',
            'An avalanche dislodges cave bears from hibernation',
            'Giants hurl boulders from a ridge above the pass'
          ],
          urban: [
            'A gang of thugs steps out from an alley, weapons drawn',
            'An assassin strikes from the rooftops',
            'Wererats pour from the sewers below',
            'Corrupt guards corner the party on false charges',
            'A doppelganger reveals its true form and attacks'
          ],
          swamp: [
            'A giant crocodile lunges from the murky water',
            'Lizardfolk warriors rise from the reeds, spears ready',
            'A shambling mound pulls itself from the bog, reaching for warmth',
            'Will-o\'-wisps lure the party into quicksand, then swarm',
            'A hydra surfaces from beneath a stagnant pool'
          ],
          arctic: [
            'A yeti bursts from a snowbank with a terrifying howl',
            'Winter wolves circle the party on a frozen lake',
            'An ice mephit swarm whirls out of a blizzard',
            'A remorhaz erupts from beneath the permafrost',
            'Frost giants emerge from a glacier crevasse'
          ],
          feywild: [
            'Quicklings dart from the underbrush, stealing and slashing',
            'A redcap charges with its iron boots clanging on stone',
            'Animated trees uproot and swing branches at intruders',
            'A displacer beast stalks from behind shimmering illusions',
            'Pixies turn hostile and unleash a storm of enchantments'
          ],
          underdark: [
            'A hook horror drops from the ceiling with a shriek',
            'Drow scouts loose poisoned crossbow bolts from the shadows',
            'A roper disguised as a stalagmite lashes out with tendrils',
            'An umber hulk bursts through the tunnel wall',
            'An intellect devourer scurries from a dark alcove'
          ],
          planar: [
            'A chain devil materializes from a swirl of brimstone',
            'Slaadi burst through a crack in reality',
            'An air elemental whips into a furious vortex around the party',
            'Githyanki raiders phase in from the astral plane',
            'A nightmare gallops through a planar rift, rider in pursuit'
          ],
          dungeon: [
            'An animated suit of armor lurches to life and attacks',
            'A gelatinous cube slides silently around the corner',
            'Goblin scouts sound the alarm and reinforcements arrive',
            'A minotaur charges down the corridor with a bellowing roar',
            'A mimic disguised as a treasure chest snaps at an unwary hand'
          ]
        };
        
        const themeEncounters = encounterSuggestions[detectedTheme] || encounterSuggestions.dungeon;
        const suggestion = themeEncounters[Math.floor(Math.random() * themeEncounters.length)];
        
        randomEncounterNudge = `
RANDOM ENCOUNTER ALERT — COMBAT IS OVERDUE:
It has been ${scenesSinceCombat} scenes since the last combat. The world should feel dangerous!
STRONGLY consider introducing a combat encounter this scene. This doesn't have to be the main plot — it can be a random but contextually appropriate threat.

Suggested encounter for this ${detectedTheme} setting: "${suggestion}"

You may use this suggestion or create your own — but it should feel natural for the environment. The encounter should:
- Be appropriate to the party's level and the adventure's tone
- Have a reason to exist (territorial creature, hostile patrol, lurking predator, etc.)
- Still allow the player to react — describe the threat appearing and let the player choose how to respond
- Set "inCombat": true and provide proper combatants in the storyState if combat begins
`;
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // SESSION 1 RETENTION CONTRACT
      // ═══════════════════════════════════════════════════════════════════
      const session1SceneCount = (currentSession.playerChoicesMade as any[] || []).length;
      const isSession1 = currentChapter === 1;
      const session1Retention = sessionStoryState.session1Retention || {
        growthObservations: [],
        toolArc: { toolName: null, firstUseScene: null, improvedUseScene: null },
        deferredConsequences: [],
        identityFormation: null,
        sceneCount: 0,
        quietReckoningTriggered: false
      };
      
      const SESSION1_RECKONING_THRESHOLD = 7;
      const shouldTriggerQuietReckoning = isSession1 && 
        session1SceneCount >= SESSION1_RECKONING_THRESHOLD && 
        !session1Retention.quietReckoningTriggered &&
        !sessionStoryState.inCombat;
      
      let session1ContractPrompt = '';
      if (isSession1 && !session1Retention.quietReckoningTriggered) {
        const isEarlySession1 = session1SceneCount <= 3;
        const isMidSession1 = session1SceneCount > 3 && session1SceneCount < SESSION1_RECKONING_THRESHOLD;
        
        session1ContractPrompt = `
═══════════════════════════════════════════════════════════════════════════════
SESSION 1 RETENTION CONTRACT (MANDATORY — This is the player's FIRST session)
═══════════════════════════════════════════════════════════════════════════════

This is Session 1. The player is forming their character's identity. Follow these rules:

RULE 1 — SHOW TRAJECTORY, NOT MASTERY:
- The character should notice themselves changing, sense direction, see difference between before and after
- At least one skill should improve subtly through use (narrate it interpretively, not numerically)
- Growth should feel like "I'm getting better at this" not "+2 stealth"

RULE 2 — TOOL COMPETENCE ARC:
${isEarlySession1 ? `- Give the character ONE simple tool early (lantern, rope, map, charm, blade, spell focus)
- Make their FIRST use of it feel clumsy, uncertain, imperfect
- The tool should feel "dumb" at first — just something they carry` : ''}
${isMidSession1 ? `- The character has been using their tools. NOW make them feel more competent with at least one.
- The same tool that felt awkward earlier should feel more effective now
- Describe the improvement narratively: "Before, it was just something you carried. Now, it's something you use."
- Current tool tracked: ${session1Retention.toolArc?.toolName || 'not yet assigned — assign one NOW'}` : ''}

RULE 3 — INTERPRETIVE GROWTH:
- Narrate growth through behavior change, not stats
- "You pause before acting — earlier, you wouldn't have" > "You gained +1 Wisdom"
- Describe first attempts as clumsy, later attempts as more deliberate

RULE 4 — TEACH THROUGH OUTCOMES:
- Patience should be rewarded (careful observation reveals secrets)
- Observation should matter (noticing details opens new paths)
- Preparation should change outcomes (planning ahead pays off)
- Rash action should leave residue (but not punishment — interesting complications)

RULE 5 — PLANT DEFERRED CONSEQUENCES:
- Create at least one consequence that is NAMED but NOT RESOLVED
- Examples: "Someone has noticed the path you took." "A decision you made has shifted something nearby."
- These should feel like seeds, not threats

SESSION 1 RETENTION TRACKING — include "session1Retention" in your JSON response:
{
  "session1Retention": {
    "growthObservations": ["one-sentence descriptions of character growth moments this scene"],
    "toolArc": {
      "toolName": "the simple tool the character is learning to use",
      "competenceLevel": "clumsy/learning/competent",
      "narrativeNote": "how the tool was used this scene"
    },
    "deferredConsequences": ["unresolved consequences planted this scene"],
    "identityFormation": "one sentence: what kind of person is the character becoming?"
  }
}
═══════════════════════════════════════════════════════════════════════════════
`;
      }
      
      // DM Authoring Doctrine: Build campaign stakes context for advance-story
      const advanceCampaignStakes = (campaign as any).campaignStakes as any[] || [];
      const advanceChapterGates = (campaign as any).chapterGates as any[] || [];
      const advanceCampaignQuestion = (campaign as any).campaignQuestion || '';
      
      let campaignDoctrineNote = '';
      if (advanceCampaignQuestion) {
        campaignDoctrineNote += `\nCAMPAIGN QUESTION: ${advanceCampaignQuestion}\n`;
      }
      if (advanceCampaignStakes.length > 0) {
        campaignDoctrineNote += `\nCAMPAIGN STAKES (every choice MUST touch at least one — stakes PASSIVELY DRIFT each scene):\n`;
        campaignDoctrineNote += advanceCampaignStakes.map((s: any) => {
          let line = `- ${s.name} [${s.id}]: ${s.value}/${s.max}`;
          if (s.lastDelta && s.lastDelta !== 0) {
            line += ` [MOMENTUM: ${s.lastDelta > 0 ? 'rising' : 'falling'} — do NOT reverse unless the player makes a decisive opposing choice]`;
          }
          if (s.passiveDrift && s.passiveDrift !== 0) {
            line += ` [DRIFTS ${s.passiveDrift > 0 ? '+' : ''}${s.passiveDrift}/scene]`;
          }
          if (s.value <= 1 && s.thresholdConsequence?.at0) {
            line += ` [CRITICAL — at 0: ${s.thresholdConsequence.at0.event}${s.thresholdConsequence.at0.irreversible ? ' IRREVERSIBLE' : ''}]`;
          } else if (s.value <= 1) {
            line += ` [CRITICAL]`;
          }
          if (s.value >= 4 && s.thresholdConsequence?.at5) {
            line += ` [HIGH — at ${s.max || 5}: ${s.thresholdConsequence.at5.event}${s.thresholdConsequence.at5.irreversible ? ' IRREVERSIBLE' : ''}]`;
          } else if (s.value >= 4) {
            line += ` [HIGH]`;
          }
          return line;
        }).join("\n");
      }
      const currentGate = advanceChapterGates.find((g: any) => g.chapter === currentChapter);
      if (currentGate) {
        campaignDoctrineNote += `\n\nCHAPTER ${currentChapter} GATE:\n`;
        campaignDoctrineNote += `- Advance when: ${currentGate.advanceWhen}\n`;
        if (currentGate.requiredTruth) campaignDoctrineNote += `- Required truth: "${currentGate.requiredTruth}"\n`;
        if (currentGate.requiredCommitment) campaignDoctrineNote += `- Required commitment: "${currentGate.requiredCommitment}"\n`;
        if (currentGate.requiredBeliefChange) campaignDoctrineNote += `- Required belief change: "${currentGate.requiredBeliefChange}"\n`;
      }
      campaignDoctrineNote += `
DM AUTHORING DOCTRINE (MANDATORY):
- Every choice must COST, CLOSE, or ESCALATE something. No free actions.
- Every choice must touch at least one campaign stake. Include "campaignStakeUpdates" in stateChanges.
- Combat is consequence, not content. What gets worse even if they win?
- VICTORY IS INCOMPLETE: Winning must answer — what pressure increased, what opportunity closed, what new problem exists?
- NPCs ARE AGENTS: Consulting costs something (time, favor, info). Repeated asking drops attitude. "Ask until solved" is BANNED.
- PROCESSES CREATE NEW PROBLEMS: Every completed quest/ritual/combat leaves at least one new problem in its wake.
- NPC COMPANION INTERACTIONS: If companions/allies travel with the party, they are LIVING CHARACTERS. In roughly every 2-3 scenes, have a companion speak, react, banter, offer advice, voice concerns, or notice something the player missed. Their dialogue should feel natural and personality-driven. After major choices, companions should visibly react (approval, worry, humor, disagreement).
- CHAPTER GATE IS YOUR PRIMARY NARRATIVE GOAL: The gate defines what this chapter is ABOUT. Every scene must build toward it.
- Do NOT generate aimless dungeon crawling or random encounters disconnected from the chapter's purpose.
- PACING RULE: Do NOT trigger "chapterGateMet" in the first 3 scenes of a chapter. Target 6-8 scenes per chapter (~1 hour of play). After scene 5, actively create moments where the gate can be met.
- SHOW CONSEQUENCES IN THE NARRATIVE: When a player makes a decisive choice (embracing dark power, betraying an ally, sacrificing something), the narrative MUST visibly reflect the change — describe physical transformations, NPC reactions, environmental shifts, or new abilities/costs. Do NOT just silently adjust stake numbers. The player should READ about the world changing because of their decision.
- If a stake is at CRITICAL level (0-1 or 4-5), the narrative should hint at impending catastrophe or breakthrough — make the player FEEL the pressure in the story text.
- Actively steer toward the gate through NPC actions, environmental pressures, and choice consequences.
- When the gate condition is met AND the chapter has had at least 4 scenes of buildup, you MUST include "chapterGateMet": { "gateId": chapter_number, "reason": "what was reached" }.
- Include "narrativeLogEntry" with: xpReason, stakeReason, foreclosedReason, choiceCost.
`;
      
      // ============================================
      // CAML CAMPAIGN ARCHITECTURE — Faction & Instability Context
      // ============================================
      let factionArchitecturePrompt = '';
      const campaignInstability = (campaign as any).campaignInstability;
      const factionModels = (campaign as any).factionModels as any[] || [];
      const factionStrengths = (campaign as any).factionStrengths as Record<string, number> || {};
      const milestoneThresholds = (campaign as any).milestoneThresholds as any[] || [];
      const sceneEligibilityPool = (campaign as any).sceneEligibility as any[] || [];

      if (campaignInstability || factionModels.length > 0) {
        factionArchitecturePrompt += `
═══════════════════════════════════════════════════════════
CAML CAMPAIGN ARCHITECTURE — LIVING WORLD (MANDATORY):
═══════════════════════════════════════════════════════════
`;
        if (campaignInstability) {
          factionArchitecturePrompt += `\nCORE INSTABILITY (the engine driving ALL events):
"${campaignInstability}"
This instability is ACTIVE and EVOLVING. Reference its effects in the scene — the world is changing whether the players act or not.\n`;
        }

        if (factionModels.length > 0) {
          factionArchitecturePrompt += `\nACTIVE FACTIONS (these are independent agents — they ACT between scenes):`;
          for (const f of factionModels) {
            const currentStrength = factionStrengths[f.id] ?? f.strength ?? 50;
            factionArchitecturePrompt += `\n- ${f.name} [${f.id}] — Strength: ${currentStrength}/100
  Public Goal: ${f.publicGoal}
  Method: ${f.operationalMethod}
  Hidden Truth: ${f.hiddenTruth}
  Vulnerability: ${f.vulnerability}
  Reaction Triggers: ${(f.reactionTriggers || []).join(', ')}`;
            const rels = f.relationships || [];
            if (rels.length > 0) {
              factionArchitecturePrompt += `\n  Relationships: ${rels.map((r: any) => `${r.factionId}: ${r.stance}`).join(', ')}`;
            }
          }

          factionArchitecturePrompt += `\n
FACTION RULES FOR THIS SCENE:
1. At least ONE faction should be visibly active or referenced in this scene
2. Faction actions should be LOGICAL based on their goals, methods, and current strength
3. If a reaction trigger condition is met, that faction MUST act (visibly or behind the scenes)
4. Faction strength shifts based on events: successful operations +5-10, setbacks -5-10
5. Report faction changes in "factionUpdates" in your response
6. Hidden truths can be partially revealed through clues, NPC gossip, or environmental evidence
`;
        }

        if (sceneEligibilityPool.length > 0) {
          const worldStateVars = (campaign as any).worldState as any[] || [];
          const eligibleScenes = sceneEligibilityPool.filter((scene: any) => {
            if (!scene.occursIf || scene.occursIf.length === 0) return true;
            return true;
          });
          if (eligibleScenes.length > 0) {
            factionArchitecturePrompt += `\nCONDITIONAL SCENE POOL (use these as inspiration — scenes unlock based on world state):`;
            for (const scene of eligibleScenes.slice(0, 5)) {
              factionArchitecturePrompt += `\n- "${scene.title}" [${scene.pillarType}] — Stakes: ${scene.stakes}
  Occurs if: ${(scene.occursIf || []).join(' AND ')}
  ${scene.blockedIf ? `Blocked if: ${scene.blockedIf.join(' OR ')}` : ''}`;
            }
            factionArchitecturePrompt += `\nUse these scenes when their conditions match the current world state. You may adapt or combine them.\n`;
          }
        }

        if (milestoneThresholds.length > 0) {
          const currentMilestone = milestoneThresholds.find((m: any) => !m.reached);
          if (currentMilestone) {
            factionArchitecturePrompt += `\nNEXT MILESTONE: "${currentMilestone.phase}" — Trigger: ${currentMilestone.trigger}
When reached, factions will react: ${(currentMilestone.factionReactions || []).map((r: any) => `${r.factionId}: ${r.action}`).join('; ')}\n`;
          }
        }
      }

      // ============================================
      // CAML2 ADVENTURE SKELETON — Villain, Complications, Encounters
      // ============================================
      let caml2AdventurePrompt = '';
      const villainModel = (campaign as any).villainModel as any;
      const framingEvent = (campaign as any).framingEvent as any;
      const complicationsQueue = (campaign as any).complicationsQueue as any;
      const encounterDesigns = (campaign as any).encounterDesigns as any[] || [];
      const partyGoal = (campaign as any).partyGoal as any;
      const villainCorruption = (campaign as any).villainCorruption || 0;
      const partyReputationVal = (campaign as any).partyReputation || 50;
      const worldInstabilityVal = (campaign as any).worldInstability || 20;

      if (villainModel || framingEvent || complicationsQueue || encounterDesigns.length > 0 || partyGoal) {
        caml2AdventurePrompt += `
═══════════════════════════════════════════════════════════
CAML2 ADVENTURE SKELETON — VILLAIN & COMPLICATIONS:
═══════════════════════════════════════════════════════════
`;
        if (villainModel) {
          const completedSteps = (villainModel.planStructure || []).slice(0, villainModel.currentStep || 0);
          const nextStep = (villainModel.planStructure || [])[villainModel.currentStep || 0];
          const remainingSteps = (villainModel.planStructure || []).slice((villainModel.currentStep || 0) + 1);
          
          caml2AdventurePrompt += `
VILLAIN: ${villainModel.name} [${villainModel.archetype}]
- Goal: ${villainModel.goal}
- Motivation: ${villainModel.motivation}
- Corruption Scale: ${villainCorruption}/10 ${villainCorruption >= 7 ? '[CRITICAL — villain is near peak power]' : villainCorruption >= 4 ? '[RISING — villain grows stronger]' : '[CONTAINED — villain is building power]'}
- Resources: ${villainModel.resources}
- Weakness: ${villainModel.weakness}
${completedSteps.length > 0 ? `- Completed Plan Steps: ${completedSteps.join('; ')}` : ''}
${nextStep ? `- CURRENT PLAN STEP: "${nextStep}" — The villain is ACTIVELY pursuing this NOW` : ''}
${remainingSteps.length > 0 ? `- Future Steps: ${remainingSteps.join('; ')}` : ''}

VILLAIN REACTION TREE (when party thwarts the villain, use ONE of these):
- ESCALATE: ${villainModel.reactionTree?.escalate || 'Raise the stakes dramatically'}
- REDIRECT: ${villainModel.reactionTree?.redirect || 'Change approach entirely'}
- RETALIATE: ${villainModel.reactionTree?.retaliate || 'Strike back at the party'}
- ACCELERATE: ${villainModel.reactionTree?.accelerate || 'Speed up timeline with dangerous shortcuts'}

VILLAIN RULES:
1. If the player's action DIRECTLY opposes the villain's current step, the villain REACTS this scene
2. Choose the reaction that makes the most narrative sense — don't always escalate
3. Each villain reaction COSTS them resources (mention what they spend/lose)
4. Each reaction creates a NEW problem for the party (never status quo)
5. Report villain changes: "villainUpdate": { "reactionUsed": "escalate|redirect|retaliate|accelerate", "newStep": number, "corruptionDelta": +/-N, "consequence": "what changed" }
`;
        }

        if (framingEvent && !framingEvent.isResolved) {
          caml2AdventurePrompt += `
FRAMING EVENT: [${framingEvent.type}] ${framingEvent.description}
- Visibility: ${framingEvent.publicVisibility}
- Destabilized: ${framingEvent.instabilityTarget}
- Villain's exploitation: ${framingEvent.villainOpportunity}
Reference the framing event's effects when narratively appropriate — it colors the world's current mood.
`;
        }

        if (partyGoal) {
          caml2AdventurePrompt += `
PARTY OBJECTIVES:
- PRIMARY: ${partyGoal.primary}
- SECONDARY: ${partyGoal.secondary || 'None set'}
${partyGoal.hidden ? `- HIDDEN (reveal through play): ${partyGoal.hidden}` : ''}
- On SUCCESS: ${partyGoal.successState}
- On PARTIAL SUCCESS: ${partyGoal.partialSuccessState}
- On FAILURE: ${partyGoal.failureState} (failure advances the world — it does NOT end the story)
`;
        }

        // Inject complications at the right pacing point
        if (complicationsQueue) {
          const unusedQuandaries = (complicationsQueue.moralQuandaries || []).filter((q: any) => !q.isUsed);
          const unusedTwists = (complicationsQueue.twists || []).filter((t: any) => !t.isUsed);
          const unusedEnvMods = (complicationsQueue.environmentalModifiers || []).filter((e: any) => !e.isUsed);
          
          const chapterProgress = scenesInChapter2 / 12;
          let timingWindow = 'early';
          if (chapterProgress > 0.6) timingWindow = 'climax';
          else if (chapterProgress > 0.3) timingWindow = 'midpoint';
          
          const readyQuandary = unusedQuandaries.find((q: any) => q.injectionTiming === timingWindow || q.injectionTiming === 'early');
          const readyTwist = unusedTwists.find((t: any) => t.injectionTiming === timingWindow || (timingWindow === 'climax' && t.injectionTiming === 'pre_climax'));
          const readyEnvMod = unusedEnvMods[0];
          
          if (readyQuandary || readyTwist || readyEnvMod) {
            caml2AdventurePrompt += `
COMPLICATIONS AVAILABLE (inject ONE of these into this scene if it fits naturally):
`;
            if (readyQuandary) {
              caml2AdventurePrompt += `- MORAL QUANDARY [${readyQuandary.type}]: ${readyQuandary.description}
  Tradeoff: ${readyQuandary.tradeoff}
  If you use this, include "complicationUsed": { "type": "moralQuandary", "id": "${readyQuandary.type}" } in response
`;
            }
            if (readyTwist) {
              caml2AdventurePrompt += `- TWIST [${readyTwist.type}]: ${readyTwist.description}
  Revealed by: ${readyTwist.revelation}
  Consequence: ${readyTwist.consequence}
  If you use this, include "complicationUsed": { "type": "twist", "id": "${readyTwist.type}" } in response
`;
            }
            if (readyEnvMod) {
              caml2AdventurePrompt += `- ENVIRONMENTAL MODIFIER [${readyEnvMod.type}]: ${readyEnvMod.description}
  Mechanical effect: ${readyEnvMod.mechanicalEffect}
  If you use this, include "complicationUsed": { "type": "environmentalModifier", "id": "${readyEnvMod.type}" } in response
`;
            }
          }
        }

        // Inject encounter design if we're in combat or a combat scene is likely
        const readyEncounter = encounterDesigns.find((e: any) => !e.isUsed && (e.chapterPlacement === currentChapter || !e.chapterPlacement));
        if (readyEncounter && (previousSceneType !== 'Combat' || shouldNudgeCombat)) {
          caml2AdventurePrompt += `
DESIGNED ENCOUNTER AVAILABLE (use if combat occurs this scene):
- "${readyEncounter.id}": ${readyEncounter.objective}
- Stakes: ${readyEncounter.stakes}
- Terrain: ${(readyEncounter.terrainFeatures || []).join(', ')}
- Combat Interest: ${(readyEncounter.combatInterest || []).join(', ')}
- Opposition: ${readyEncounter.oppositionType}
- Difficulty: ${readyEncounter.difficultyTarget}
If combat occurs, USE these terrain features and combat interest modifiers for variety!
Include "encounterUsed": "${readyEncounter.id}" in response if used.
`;
        }

        caml2AdventurePrompt += `
PERSISTENT TRACKING:
- Party Reputation: ${partyReputationVal}/100 ${partyReputationVal >= 70 ? '[RENOWNED]' : partyReputationVal >= 40 ? '[KNOWN]' : '[UNKNOWN/FEARED]'}
- World Instability: ${worldInstabilityVal}/100 ${worldInstabilityVal >= 60 ? '[UNSTABLE — world is deteriorating]' : worldInstabilityVal >= 30 ? '[TENSE — trouble brewing]' : '[STABLE]'}
- Villain Corruption: ${villainCorruption}/10
Include "trackingUpdates" in response: { "reputationDelta": +/-N, "instabilityDelta": +/-N, "corruptionDelta": +/-N }
`;
      }

      // Finale and chapter progress instructions
      const chapterProgressNote = `
CAMPAIGN PROGRESS: Chapter ${currentChapter} of ${totalChapters}
${campaignDoctrineNote}
${factionArchitecturePrompt}
${caml2AdventurePrompt}
`;
      
      // Build forked ending context from stake states
      let stakeEndingContext = '';
      if (isOnFinalChapter && advanceCampaignStakes.length > 0) {
        const endingForks = advanceCampaignStakes.map((s: any) => {
          const tc = s.thresholdConsequence;
          if (!tc) return null;
          let forkDesc = `- ${s.name} [${s.id}] is at ${s.value}/${s.max}`;
          if (s.value <= 1 && tc.at0) forkDesc += ` → NEAR COLLAPSE: ${tc.at0.event} (fork: ${tc.at0.forksTo})${tc.at0.irreversible ? ' [PERMANENT]' : ''}`;
          else if (s.value >= 4 && tc.at5) forkDesc += ` → NEAR PEAK: ${tc.at5.event} (fork: ${tc.at5.forksTo})${tc.at5.irreversible ? ' [PERMANENT]' : ''}`;
          else {
            forkDesc += ` → If it falls to 0: ${tc.at0?.event || 'catastrophe'}. If it rises to max: ${tc.at5?.event || 'extreme consequence'}.`;
          }
          return forkDesc;
        }).filter(Boolean).join('\n');
        
        if (endingForks) {
          stakeEndingContext = `
STAKE-DRIVEN ENDINGS — the campaign question must be ANSWERED differently based on where stakes landed:
${endingForks}

The ending is NOT "win or lose" — it is "which world did your choices create?"
Different stake states produce DIFFERENT endings. Reflect accumulated consequences.`;
        }
      }
      
      const finalChapterScenes = isOnFinalChapter ? ((currentSession.storyState as any)?.turnsInChapter || 0) : 0;
      const FINALE_URGENCY_THRESHOLD = 6;
      const FINALE_FORCED_DECISION = 8;
      
      let finaleUrgency = '';
      if (isOnFinalChapter && finalChapterScenes >= FINALE_FORCED_DECISION) {
        finaleUrgency = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║ ⚠️  MANDATORY CAMPAIGN ENDING — THIS IS THE FINAL SCENE (${finalChapterScenes} scenes in final chapter) ⚠️  ║
╔═══════════════════════════════════════════════════════════════════════════════╗
You MUST end the campaign THIS SCENE. Present the FINAL DECISION:
- Present exactly 3-4 choices that each represent a DIFFERENT ENDING to the campaign
- Each choice MUST be a point of no return that RESOLVES the campaign question
- One choice = sacrifice/loss, one = compromise, one = bold/risky, one = pragmatic
- After the player chooses, write the epilogue and set "isCampaignFinale": true
- Do NOT continue the story, introduce new threads, or delay the ending
- This is IT. The story ends here, one way or another.
╚═══════════════════════════════════════════════════════════════════════════════╝`;
      } else if (isOnFinalChapter && finalChapterScenes >= FINALE_URGENCY_THRESHOLD) {
        finaleUrgency = `
⚡ CAMPAIGN NEARING END — ${finalChapterScenes} scenes in final chapter. You have ${FINALE_FORCED_DECISION - finalChapterScenes} scenes 
before the campaign MUST end. Accelerate toward the climactic decision NOW. No new subplots.
Resolve lingering threads and steer toward the final confrontation.`;
      }
      
      const finaleInstructions = isOnFinalChapter ? `
═══════════════════════════════════════════════════════════════════════════════
FINAL CHAPTER - DRIVE TOWARD FORKED CONCLUSION
═══════════════════════════════════════════════════════════════════════════════
This is the FINAL CHAPTER of the campaign (${finalChapterScenes} scenes so far). You MUST:
1. Drive the narrative toward a satisfying CONCLUSION - no new plot threads
2. Resolve the main campaign conflict within the next 2-3 story beats
3. The ending must ANSWER THE CAMPAIGN QUESTION — not just "defeat the villain"
4. Present 3-4 finale choices that represent DIFFERENT ANSWERS to the campaign question:
   - Each choice should produce a fundamentally different world state
   - No choice should be "the right answer" — each has genuine costs and benefits
   - At least one choice should involve sacrifice, and another should involve compromise
5. When the climax is resolved, include "isCampaignFinale": true in your response
6. Include "endingType" in your response: a short descriptor of which fork was chosen (e.g., "sealed_gate", "controlled_power", "pyrrhic_victory")
7. Provide closure for active quests - mark them completed or failed
8. The epilogue must show CONSEQUENCES — not just "and everyone was happy"
   - What was gained? What was lost forever? What new tension was created?
9. Do NOT start new subplots, introduce new mysteries, or extend the story
${stakeEndingContext}
${finaleUrgency}

The player deserves a clear, meaningful ending — triumphant, tragic, or bittersweet based on their accumulated choices.
If they resolve the final challenge, respond with:
- A narrative conclusion that reflects stake states and accumulated decisions
- "isCampaignFinale": true
- "endingType": descriptor of the fork chosen
- Final rewards and XP
═══════════════════════════════════════════════════════════════════════════════
` : '';
      
      // ============================================
      // SCENE HISTORY DIGEST — Anti-Repetition Memory (Route 2)
      // ============================================
      const allCampaignSessions = await storage.getCampaignSessions(campaignId);
      const recentCampaignSessions = allCampaignSessions.slice(-8);
      let sceneHistoryDigest2 = "";
      if (recentCampaignSessions.length > 0) {
        const usedTitles2 = recentCampaignSessions.map(s => s.title).filter(Boolean);
        const usedLocations2 = recentCampaignSessions.map(s => s.location).filter(Boolean);
        const usedSceneTypes2 = recentCampaignSessions.map(s => (s as any).sceneType).filter(Boolean);

        const extractMotifs2 = (text: string): string[] => {
          const motifPatterns = /\b(runestone|altar|shrine|portal|crystal|artifact|tome|scroll|relic|idol|obelisk|monolith|totem|sigil|glyph|rune|amulet|pendant|orb|scepter|throne|fountain|well|mirror|gate|door|chest|vault|crypt|tomb|statue|pillar|tower|bridge|cave|tunnel|clearing|grove|camp|ruins|temple|library|forge|market|tavern|dock|harbor|lighthouse|watchtower|graveyard|battlefield|arena|colosseum|labyrinth|maze|garden|sanctuary|chamber|hall|corridor)\b/gi;
          const matches = text.match(motifPatterns) || [];
          return [...new Set(matches.map(m => m.toLowerCase()))];
        };

        const allNarrativeText2 = recentCampaignSessions.map(s => (s.narrative || "").substring(0, 500)).join(" ");
        const usedMotifs2 = extractMotifs2(allNarrativeText2).slice(0, 15);

        const recentNarrativeText2 = recentCampaignSessions.slice(-3).map(s => (s.narrative || "").substring(0, 500)).join(" ");
        const veryRecentMotifs2 = extractMotifs2(recentNarrativeText2).slice(0, 10);

        sceneHistoryDigest2 += `
═══════════════════════════════════════════════════════════
SCENE HISTORY — ANTI-REPETITION MEMORY (MANDATORY):
═══════════════════════════════════════════════════════════

RECENT SCENE TITLES (DO NOT reuse or closely echo these):
${usedTitles2.map(t => `- "${t}"`).join("\n")}

RECENTLY VISITED LOCATIONS (introduce NEW locations — do NOT return here without strong narrative reason):
${[...new Set(usedLocations2)].map(l => `- ${l}`).join("\n")}

RECENT SCENE TYPES: ${usedSceneTypes2.join(", ")}
→ Choose a DIFFERENT scene type from the most recent 2 scenes.

OVERUSED MOTIFS/OBJECTS (these have appeared in recent scenes — DO NOT USE THESE AGAIN):
${veryRecentMotifs2.map(m => `- "${m}"`).join("\n")}

MOTIFS USED IN THIS CAMPAIGN ARC (use sparingly, at most once more if narratively essential):
${usedMotifs2.map(m => `- "${m}"`).join("\n")}

CONTENT VARIETY RULES (STRICTLY ENFORCED):
1. EVERY scene MUST introduce at least ONE element the campaign has never seen:
   - A new NPC (name + personality + agenda)
   - A new location (not just a renamed version of a previous one)
   - A new type of challenge (if recent scenes had puzzles, try social intrigue or exploration)
   - A new narrative motif or object (if runestones were used, try something completely different: a merchant's ledger, a dying soldier's confession, a strange weather phenomenon, animal behavior, architectural clues, overheard conversations)
2. NEVER repeat the same environmental feature, puzzle element, or discovery type from the last 3 scenes
3. If the story involves a recurring theme (e.g., ancient magic), express it through DIFFERENT manifestations each time — different senses, different sources, different consequences
4. Scene titles MUST be distinct in tone and content from recent titles
5. Vary the PACING: if recent scenes were tense, allow a moment of quiet reflection or unexpected humor. If recent scenes were slow, introduce urgency or danger.
`;
      }

      // ============================================
      // CAML STORY SPINE — Narrative Compass (Route 2)
      // ============================================
      const advanceChapterGatesList = (campaign as any).chapterGates as any[] || [];
      const currentGateForSpine2 = advanceChapterGatesList.find((g: any) => g.chapter === currentChapter);
      const completedGates2 = advanceChapterGatesList.filter((g: any) => g.chapter < currentChapter);
      const narrativeLog2 = (campaign as any).narrativeLog || [];
      const lastGateEntry2 = [...narrativeLog2].reverse().find((e: any) => e.type === 'chapter_gate');
      const lastGateMs2 = lastGateEntry2?.timestamp ? Date.parse(lastGateEntry2.timestamp) : NaN;
      const scenesInChapter2 = !isNaN(lastGateMs2)
        ? allCampaignSessions.filter(s => s.createdAt && new Date(s.createdAt).getTime() > lastGateMs2).length
        : allCampaignSessions.length;

      let camlStorySpine2 = `
═══════════════════════════════════════════════════════════
CAML STORY SPINE — YOUR NARRATIVE COMPASS (FOLLOW THIS):
═══════════════════════════════════════════════════════════

CAMPAIGN QUESTION (the thematic heart — every scene must relate to this):
"${(campaign as any).campaignQuestion || 'What choices define who we become?'}"
${(campaign as any).mainHook ? `\nCAMPAIGN MAIN HOOK (the central premise — weave this into every chapter):\n"${(campaign as any).mainHook}"\n` : ''}
OVERALL ARC: Chapter ${currentChapter} of ${totalChapters}
- Scenes played so far: ${allCampaignSessions.length}
- Scenes in current chapter: ${scenesInChapter2}

SESSION CLOSURE BEATS (CRITICAL FOR PLAYER RETENTION):
- ONLY set "sessionBreakpoint": true at GENUINE NARRATIVE TRANSITIONS — moments where the story naturally pauses
- NEVER set sessionBreakpoint during active combat, mid-fight, tense action sequences, or unresolved cliffhangers
- NEVER set sessionBreakpoint more than once every 8+ scenes — the player's real-world session timer controls when it appears, not scene count alone
- Good stopping points include: arriving somewhere new, completing a sub-task, a campfire/rest moment after combat ends, reuniting with allies, receiving a quest reward, finishing a social encounter, or a quiet moment of reflection
- BAD stopping points: mid-combat, during chase scenes, while enemies are present, during urgent time-pressure moments, right after revealing a threat
- The stopping point should feel EARNED and COMPLETE — not abrupt
- End stopping point scenes with a forward hook: hint at what comes next, an unanswered question, or a new threat on the horizon
- Think of it like a TV episode ending: resolve the immediate tension, but leave threads that pull the viewer back
- If inCombat is true or combatants are present, DO NOT set sessionBreakpoint

WHEN TO SET sessionBreakpoint: true (EXAMPLES — set it at moments like these):
- After defeating a boss or completing a significant combat encounter and the dust settles
- When the party arrives at a safe haven, tavern, or town after a journey
- After completing a quest objective or solving a major puzzle
- During a campfire/rest scene where the party reflects on recent events
- After a chapter gate is met (chapterGateMet) — this is ALWAYS a good break point
- When reuniting with an NPC ally or receiving a quest reward
- After a dramatic social encounter resolves (negotiation complete, trial ended, alliance formed)
- At any calm transition between two distinct story segments

WHEN NOT TO SET sessionBreakpoint (NEVER at these moments):
- During active combat or when combatants are still alive and hostile
- Mid-chase or pursuit sequences
- When a timer or countdown is active in the narrative
- Right after revealing a major threat or cliffhanger
- When the party is in immediate danger
`;

      if (completedGates2.length > 0) {
        camlStorySpine2 += `\nCOMPLETED CHAPTER MILESTONES (the story so far):
${completedGates2.map((g: any) => `- Chapter ${g.chapter}: "${g.advanceWhen}" — ACHIEVED`).join("\n")}
`;
      }

      if (currentGateForSpine2) {
        camlStorySpine2 += `\nCURRENT CHAPTER ${currentChapter} OBJECTIVE:
- What must happen: "${currentGateForSpine2.advanceWhen}"
${currentGateForSpine2.requiredTruth ? `- Truth to discover: "${currentGateForSpine2.requiredTruth}"` : ''}
${currentGateForSpine2.requiredCommitment ? `- Commitment to make: "${currentGateForSpine2.requiredCommitment}"` : ''}
${currentGateForSpine2.requiredBeliefChange ? `- Belief to change: "${currentGateForSpine2.requiredBeliefChange}"` : ''}
`;
      }

      const upcomingGates2 = advanceChapterGatesList.filter((g: any) => g.chapter > currentChapter);
      if (upcomingGates2.length > 0) {
        camlStorySpine2 += `\nFUTURE ARC (foreshadow these, but don't resolve yet):
${upcomingGates2.slice(0, 2).map((g: any) => `- Chapter ${g.chapter}: "${g.advanceWhen}"`).join("\n")}
`;
      }

      camlStorySpine2 += `\nSTORY SPINE RULES:
1. Each scene should plant seeds for the current chapter gate — even if indirectly
2. Foreshadow future chapters through hints, rumors, environmental storytelling
3. The campaign question should be reflected in character dilemmas and NPC motivations
4. Build toward the chapter gate through escalating revelations, not repetitive clue-finding
5. Each scene should feel like it MOVES THE STORY FORWARD — if removing this scene wouldn't change the narrative, it shouldn't exist
`;

      // ============================================
      // CHAPTER PROGRESSION NUDGING (Route 2)
      // ============================================
      let chapterNudge2 = "";
      const GENTLE2 = 5;
      const MODERATE2 = 7;
      const URGENT2 = 9;

      if (currentGateForSpine2 && scenesInChapter2 >= GENTLE2) {
        if (scenesInChapter2 >= URGENT2) {
          chapterNudge2 = `\n⚡ URGENT CHAPTER PROGRESSION:
This chapter has run for ${scenesInChapter2} scenes — it MUST advance NOW.
THIS SCENE should directly address the chapter gate: "${currentGateForSpine2.advanceWhen}"
- Present a pivotal moment, revelation, or confrontation that satisfies the gate condition
- The player's choice in this scene should determine HOW the gate is met, not WHETHER
- Do not introduce new subplots — resolve the current chapter's central question
- Include "chapterGateMet" in your response if the condition is fulfilled
`;
        } else if (scenesInChapter2 >= MODERATE2) {
          chapterNudge2 = `\n⚠️ CHAPTER PROGRESSION — MODERATE URGENCY:
This chapter has run for ${scenesInChapter2} scenes. The story should converge toward the chapter gate within the next 2-3 scenes.
- Chapter gate: "${currentGateForSpine2.advanceWhen}"
- Begin closing subplots and consolidating threads toward the gate condition
- Raise the stakes — make the chapter's central tension unavoidable
- Ensure THIS scene creates momentum toward resolution, not more questions
`;
        } else {
          chapterNudge2 = `\n📌 CHAPTER PROGRESSION — GENTLE NUDGE:
This chapter has run for ${scenesInChapter2} scenes. Begin steering the narrative toward the chapter gate.
- Chapter gate: "${currentGateForSpine2.advanceWhen}"
- Plant clearer clues, create situations that force the relevant truth/commitment/belief
- The story should feel like it's building toward something specific, not meandering
`;
        }
      }

      // Generate story continuation based on choice and previous context
      const prompt = `
You are an expert Dungeon Master for a D&D game with a ${narrativeStyle} storytelling style.
${narrativeStyleInstructions}
Difficulty: ${difficulty}
${chapterProgressNote}
${themeContext}
${finaleInstructions}
${session1ContractPrompt}
${sceneHistoryDigest2}
${camlStorySpine2}
${chapterNudge2}

${SCENE_GENERATION_CONSTRAINTS}
${antiCombatRepeatNote}
${randomEncounterNudge}

${SCENE_CHOICE_FRAMING}

DM PHILOSOPHY (CRITICAL - Follow these core principles):
1. FACILITATOR, NOT ADVERSARY: You are rooting for the player to succeed and have fun. Create challenges that are exciting to overcome, not frustrating roadblocks. The player should feel heroic.

2. "YES, AND..." MENTALITY: When a player tries something creative or unexpected, embrace it! Build on their ideas with "yes, and..." (add something cool) or "yes, but..." (add an interesting complication). Never shut down creativity with flat rejection.

3. PLAYER AGENCY MATTERS: Player choices must meaningfully affect the story. If they choose to negotiate with enemies, some enemies should be willing to talk. If they find a clever solution, reward it. Don't force predetermined outcomes.

4. CINEMATIC DESCRIPTIONS: Describe what HAPPENS, not just numbers. "Your blade bites deep into the ogre's shoulder, black blood spraying as it roars in pain" beats "You deal 8 damage." Use all five senses.

5. SMART ENEMIES: Intelligent enemies use tactics, take cover, and retreat when losing. Beasts flee when wounded. Only mindless undead or fanatics fight to the death. Let enemies surrender, beg for mercy, or flee when appropriate.

6. CONSEQUENCES, NOT PUNISHMENT: Failed rolls should create interesting complications, not brick walls. A failed lockpick doesn't mean "impossible" - it might mean noise alerts guards, or the lock breaks with the pick inside. Keep the story moving forward.

7. PACING RHYTHM: Alternate between high-tension action and moments to breathe. After intense combat, give the player a moment of triumph or discovery. Don't make every single moment life-or-death.

8. NPCs HAVE MOTIVATIONS: Every NPC wants something, even minor ones. The guard wants to finish their shift. The merchant wants to make a sale. This makes interactions feel real.

9. COMBAT IS EXCITING: Combat should feel thrilling and dangerous. The world is full of threats — monsters roam the wilds, bandits patrol trade roads, and enemies lurk in dark places. Don't wait for the player to pick a fight; sometimes danger finds them. Fights have consequences — noise attracts attention, blood leaves evidence, and survivors spread word — which makes them dramatic and high-stakes.

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
${isWaypointTravel(choice) ? `
⚡ WAYPOINT MOVE DETECTED — This is a simple travel/movement action.
USE WAYPOINT MOVE TEMPERATURE (20-35 words max). Write a brief 1-2 sentence transition describing the journey and arrival.
Do NOT generate encounters, ambushes, dramatic events, or discoveries. Do NOT use dramatic language.
Keep it grounded: terrain, weather, a passing detail, then where they arrive.
Set sceneType to "Travel".
` : ''}
${currentMapState}
${detectedMovement.isMovement ? `
MOVEMENT DETECTED: This is a movement action!
- Direction: ${detectedMovement.direction} (${detectedMovement.direction === 'up' ? 'North' : detectedMovement.direction === 'down' ? 'South' : detectedMovement.direction === 'right' ? 'East' : 'West'})
- IMPORTANT: Set movement.occurred = true and movement.direction = "${detectedMovement.direction}" in your response
- The narrative MUST describe the party moving in this direction
- Describe what they find as they move (new corridor, room, obstacle, etc.)
- CRITICAL: Before allowing this movement, verify the direction is in PASSABLE EXITS above!
` : ''}
${skillCheckInfo}

${skillCheckContinuation}

Previous Player Actions History:
${currentSession.playerChoicesMade && currentSession.playerChoicesMade.length > 0 ? 
  currentSession.playerChoicesMade.slice(-3).map((action: any, i: number) => 
    `${i + 1}. ${action.choice} ${action.rollResult ? `(${action.rollResult.diceType}: ${action.rollResult.total})` : ''} - ${action.consequences || 'No recorded consequences'}`
  ).join('\n') : 'No previous actions recorded'}

NPC Interactions in Progress:
${JSON.stringify(currentSession.npcInteractions || {})}

${(() => {
  const storyState = currentSession.storyState as any;
  if (storyState?.inCombat && storyState?.combatants?.length > 0) {
    const enemies = storyState.combatants.filter((c: any) => c.type === 'enemy' || c.type === 'boss');
    if (enemies.length > 0) {
      return `**CURRENT COMBAT - USE THESE EXACT ENEMIES (DO NOT CHANGE NAMES)**:
${enemies.map((e: any) => `- "${e.name}" (${e.type}): HP ${e.currentHp}/${e.maxHp}, AC ${e.ac}, Status: ${e.status}`).join('\n')}
CRITICAL: Reference these enemies by their EXACT names above in your narrative and combatEffects!`;
    }
  }
  return '';
})()}

**PREVIOUS CHOICES OFFERED - DO NOT REPEAT THESE**:
${currentSession.choices && currentSession.choices.length > 0 ? 
  currentSession.choices.map((c: any) => `- "${c.text}"`).join('\n') : 
  'No previous choices'}
CRITICAL: Generate COMPLETELY NEW and DIFFERENT choices this round. Do NOT copy or paraphrase the choices above.

${(() => {
  const storyStateObj = currentSession.storyState as any || {};
  const momentousChoices = storyStateObj.momentousChoices || [];
  if (momentousChoices.length > 0) {
    return `
═══════════════════════════════════════════════════════════════════════════════
MOMENTOUS CHOICES ALREADY MADE (PERMANENT — NEVER RE-OFFER THESE):
═══════════════════════════════════════════════════════════════════════════════
The following decisions have ALREADY been made and their consequences are PERMANENT.
NEVER offer these choices again. NEVER present them as options. They are RESOLVED.
The world has CHANGED because of these decisions — reflect their ongoing consequences.

${momentousChoices.map((mc: any, i: number) => `${i + 1}. "${mc.choice}" (Scene ${mc.scene || '?'})
   → Consequence: ${mc.consequence}
   → World change: ${mc.worldChange}
   ${mc.powersGranted ? `→ Powers/abilities gained: ${mc.powersGranted}` : ''}
   ${mc.reputationEffect ? `→ Reputation effect: ${mc.reputationEffect}` : ''}`).join('\n')}

RULES FOR MOMENTOUS CHOICES:
- These choices are DONE. The character has ALREADY made these decisions.
- Reference the CONSEQUENCES of these choices in the narrative (e.g., if they took dark power, show it manifesting)
- NPCs should REACT to what the character has become because of these choices
- Do NOT offer the same decision again in any form — no "take the orb's power" if they already did
- The character's identity, abilities, and reputation are permanently altered by these choices
═══════════════════════════════════════════════════════════════════════════════
`;
  }
  return '';
})()}

MOMENTOUS CHOICE DETECTION (include in your JSON response when applicable):
When the player makes a choice that is CAMPAIGN-DEFINING — a choice that permanently transforms their character,
shifts the story's direction, or represents a point of no return — you MUST include "momentousChoiceResolution" in your response:
{
  "momentousChoiceResolution": {
    "choice": "What the player chose (e.g., 'Take the orb\\'s power as your own')",
    "consequence": "The immediate, visible consequence (e.g., 'Dark energy floods through your veins, your eyes glow with eldritch power')",
    "worldChange": "How the world permanently changed (e.g., 'The orb shatters, its power now lives within you. The cult will hunt you. The balance of power has shifted.')",
    "powersGranted": "Any new abilities, traits, or powers the character gains (null if none)",
    "reputationEffect": "How factions, NPCs, or the world at large now view the character differently",
    "isCampaignTerminus": false
  }
}

Examples of momentous choices:
- Absorbing an artifact's power
- Betraying or pledging loyalty to a faction
- Killing or sparing a major NPC
- Making a pact with a dark/divine entity
- Destroying or activating a world-altering device
- Sacrificing something irreplaceable

Set "isCampaignTerminus": true ONLY if this choice definitively ENDS the campaign arc (the main quest is resolved).
When a momentous choice happens, the narrative MUST dramatically show the transformation — describe physical changes,
power surges, NPC reactions, environmental shifts. The player must FEEL the weight of their decision.

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
- IMPORTANT: Unconscious or dead companions CANNOT take actions! Do NOT include them in companionActions
- If a companion has status "unconscious" or "dead" or currentHp <= 0, they are incapacitated and skip their turn
- Include "combatEffects" with damage for ALL combatants (player, companions, enemies)
- Include "companionActions" describing what each CONSCIOUS AI companion did this round (skip unconscious ones)
- Combat should feel dangerous and consequential
- ALWAYS populate "combatants" array with enemies when inCombat is true
- ALWAYS populate "partyMembers" array with player and companions when inCombat is true

CRITICAL - PRESERVE EXISTING COMBATANTS:
- If "combatants" array exists in the Current Story State above, you MUST use THE EXACT SAME enemy names
- Do NOT replace existing enemies with different creatures (e.g., don't replace "Corrupted Druid" with "Goblin")
- Copy enemy names EXACTLY from the story state - maintain consistency throughout the battle
- Only add NEW enemies if reinforcements arrive in the narrative
- The enemyDamage array in combatEffects MUST reference enemies by their EXACT name from combatants

COMBAT END CONDITIONS:
- Set "inCombat": false when ALL enemies are defeated, fled, or surrendered
- Combat can also end via successful disengage/retreat by the party
- Describe the combat resolution clearly in the narrative
- When combat ends in VICTORY, narrate the spoils dramatically:
  * Describe searching the fallen enemies and discovering treasure
  * For boss fights: narrate an EPIC loot discovery — a gleaming weapon, enchanted armor, or powerful artifact among the hoard
  * Mention gold coins scattered or found in pouches/chests
  * If it was a boss fight, describe it as a turning point in the story — a moment that changes everything
  * The specific loot items, gold, and XP will be provided by the system — your job is to make the discovery feel dramatic and earned

TACTICAL COMBAT OPTIONS (include diverse choices each round):
- Attack with current weapon (requires attack roll)
- Targeted attack: aim for weak spot, trip, disarm (harder DC, special effect)
- Defensive maneuver: dodge, parry, take cover
- Use the environment: throw debris, push enemy, use terrain
- Disengage/retreat (requires Athletics or Acrobatics check)  
- Use item/potion (consumes turn)
- Cast a spell (if magic user)
- Companion tactics: coordinate with allies, protect wounded party member

COMBAT CHOICE VARIETY (CRITICAL):
- Each combat round MUST have DIFFERENT choice wordings - never repeat the exact same options
- Adapt choices to the current situation: enemy position, party status, environment
- Reference specific enemies by name in attack options (e.g., "Strike the Corrupted Druid's staff")
- Include at least one creative/environmental option each round
- If the party is wounded, include defensive or healing options
- If an enemy is bloodied, include finishing move options

CRITICAL - UNCONSCIOUS/INCAPACITATED CHARACTERS:
- If the player character is UNCONSCIOUS (0 HP), they CANNOT attack, cast spells, move, or take any actions
- Unconscious characters can ONLY: make death saving throws, wait to be healed/stabilized by allies
- NEVER offer attack/combat options for unconscious characters - this is a core D&D rule
- Companions/allies should be the ones taking action when the player is down
- When a player is unconscious, focus choices on what ALLIES can do: heal the player, protect them, continue fighting

DUNGEON MAP SYNCHRONIZATION (CRITICAL):
- The dungeonState MUST reflect what you describe in the narrative
- If the narrative mentions "a corridor to the north and a door to the east", the exits array MUST include north and east
- The currentRoom name MUST match the storyState.location
- Keep room IDs consistent when the party revisits a room
- When the party moves, update currentRoom to reflect the new location
- Add features (chests, altars, etc) that you describe in the narrative to the features array
- This ensures the dungeon map visually matches your storytelling

MAP NARRATIVE INTEGRATION (IMPORTANT):
- Use mapModifications to add narrative context to map tiles that players can see
- When describing a new room/area, add an "update_narrative" modification at the player's current position
- Include NPCs, items, enemies, and events in the mapModifications data to display markers on the map
- Use "add_secret" when describing hidden passages or secret doors (mark discovered: false)
- Use "place_enemy" when enemies appear in a specific location
- Use "add_treasure" when treasure or loot is found
- Use "add_npc" when an NPC is present at a location
- The map will display icons for NPCs (green), items (cyan), enemies (red), and danger levels
- Set dangerLevel to reflect the threat: safe, low, medium, high, or deadly
- shortDescription appears as tooltip when hovering over tiles

ENVIRONMENTAL CONSTRAINTS (CRITICAL):
- ALL narratives MUST respect the physical environment: ${themeContext || 'standard dungeon setting'}
- Descriptions MUST match the campaign setting (if nautical: use ship terms, sea weather, maritime threats)
- Combat encounters MUST feature theme-appropriate enemies (pirates/sea monsters for nautical, forest creatures for wilderness)
- Physics and logic must be consistent (no teleportation, no impossible feats without magic)
- Story progression MUST reflect natural consequences of player actions
- Choices MUST be constrained by the environment (can't "climb a tree" on a ship, can't "swim away" in a desert)

WRITING STYLE REQUIREMENTS:
- Apply the ${narrativeStyle} storytelling style consistently
- Lead with what HAPPENS as a result of the player action
- Keep narrative concise — word count depends on scene temperature (30-50 for low, 60-90 for medium, 80-120 for high)
- Every sentence must advance the plot, reveal character, or show consequences — cut filler
- Do NOT pad with atmospheric descriptions that repeat what the player already knows
- Vary your pacing: not every scene needs to be dramatic. Quiet moments make dramatic ones hit harder.
- REFLECT SKILL CHECK OUTCOMES: Clearly show success or failure consequences in the narrative
- Avoid repeating phrases, imagery, or sentence structures from the previous 3 scenes

${SCENE_TEMPERATURE_SCALING}

Generate the next story segment that:
1. IMMEDIATELY shows what happened because of their specific action/roll
2. Demonstrates clear success/failure consequences from the skill check
3. Advances plot through character reactions and new developments
4. Provides 4-5 diverse choices that build directly on what just occurred

VERBAL INTERACTION EMPHASIS - These are CRITICAL for good D&D:
- Include NPCs that the player can TALK TO (not just fight)
- Create situations where WHAT YOU SAY matters for story progression
- Add interrogations, negotiations, and conversations that reveal secrets
- Present moral dilemmas resolved through dialogue, not combat
- Include riddles, puzzles, and mysteries that require thinking
- Make social skills as important as combat: persuasion, deception, insight, intimidation
- NPCs should have their own goals and can be reasoned with
- Some encounters SHOULD be avoided through clever talking
- Information from conversations should unlock new paths or reveal hidden truths

CHOICE REQUIREMENTS:
- At least 4 choices, up to 5 maximum
- AT LEAST 2 CHOICES should be DIALOGUE/SOCIAL options (talking to someone, asking questions, negotiating)
- Include variety: dialogue, exploration, action, stealth, magic/investigation
- At least 2 choices should require dice rolls
- Make choices specific to the current situation, not generic
- PRIORITIZE verbal/social choices when NPCs are present
- USE VARIED SKILLS - especially SOCIAL skills:
  * Talking/convincing NPCs: persuasion, deception, intimidation
  * Reading emotions/detecting lies: insight
  * Asking questions/gathering info: investigation
  * Looking for clues/hidden things: investigation, perception
  * Sneaking/hiding: stealth
  * Climbing/jumping/swimming: athletics
  * Balance/tumbling: acrobatics
  * Magic knowledge: arcana
  * Religious knowledge: religion
  * Nature/survival: survival, nature

Respond with JSON:
{
  "narrative": "Match word count to scene temperature: LOW 30-50, MEDIUM 60-90, HIGH 80-120. Lead with what happened, show consequences, cut filler.",
  "sceneType": "Exploration/Social/Discovery/Travel/Puzzle/Downtime/Combat - the type of scene this is",
  "dmNarrative": "Behind-the-scenes context for DM about consequences and what NPCs are thinking/planning",
  "choices": [
    {
      "text": "Action-focused choice description", 
      "type": "action/dialogue/exploration/magic/stealth/combat",
      "resolutionMode": "Dialogue/Investigation/Ingenuity/Stealth/Endurance/Violence",
      "risk": "Low/Medium/High",
      "difficulty": "easy/medium/hard",
      "requiresDiceRoll": true/false,
      "diceType": "d20/d6/etc (if roll required)",
      "rollDC": "number (if roll required)",
      "skillType": "the skill for this roll: perception/investigation/persuasion/deception/intimidation/insight/stealth/athletics/acrobatics/arcana/religion/nature/survival/medicine/animal_handling",
      "rollPurpose": "What the roll represents (e.g., Persuasion Check, Perception Check)",
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
  "campaignStakeUpdates": [{"id": "stake_id", "delta": -1, "reason": "Why this stake changed — use ±1 for minor, ±2 for decisive player commitments. Do NOT oscillate — if the player committed to a direction, maintain that momentum."}],
  "factionUpdates": [{"factionId": "faction.id", "strengthDelta": 5, "action": "What the faction did this scene (visible or behind-the-scenes)", "reason": "Why their strength changed"}],
  "villainUpdate": {"reactionUsed": "escalate|redirect|retaliate|accelerate or null", "newStep": 1, "corruptionDelta": 1, "consequence": "What changed due to villain reaction"},
  "complicationUsed": {"type": "moralQuandary|twist|environmentalModifier", "id": "complication_id"},
  "encounterUsed": "encounter_id or null",
  "trackingUpdates": {"reputationDelta": 2, "instabilityDelta": 1, "corruptionDelta": 0},
  "failureAdvancement": {"villainAdvancement": "What the villain gained", "villainStepAdvance": true, "corruptionIncrease": 1, "instabilityIncrease": 5, "factionShift": "How factions changed", "worldConsequence": "Visible world change", "newThreat": "New danger created"},
  "instabilityUpdate": {"delta": 1, "manifestation": "How the instability visibly changed this scene"},
  "chapterGateMet": {"gateId": 1, "reason": "What truth/belief/commitment was reached"},
  "sessionBreakpoint": true,
  "narrativeLogEntry": {"xpReason": "Why XP was earned", "stakeReason": "Which stakes changed and why", "foreclosedReason": "What options closed", "choiceCost": "What the choice cost/closed/escalated"},
  "movement": {
    "occurred": true/false,
    "direction": "up/down/left/right/null (if movement occurred, which direction on the map grid)",
    "description": "Brief description of where the party moved (e.g. 'entered the eastern chamber', 'descended the stairs')"
  },
  "dungeonState": {
    "currentRoom": {
      "id": "room_1",
      "name": "Room or area name matching the narrative location",
      "type": "entrance/corridor/chamber/cavern/hall/throne_room/treasure_room/trap_room/puzzle_room",
      "description": "Brief visual description for the map tooltip"
    },
    "exits": [
      {"direction": "north/south/east/west", "description": "What lies in this direction", "visible": true, "locked": false, "leadsTo": "room_2 or null if unknown"}
    ],
    "features": [
      {"type": "chest/statue/altar/pillar/fountain/trap/secret_door", "position": "center/corner/along_wall", "description": "Brief description"}
    ],
    "lighting": "bright/dim/dark",
    "dangerLevel": "safe/low/medium/high/deadly"
  },
  "mapModifications": [
    {
      "type": "update_narrative",
      "x": 4,
      "y": 4,
      "data": {
        "description": "Full narrative description of what is in this room/tile",
        "shortDescription": "One-line summary for map tooltip",
        "npcs": ["NPC names present here"],
        "items": ["Item names that can be found"],
        "enemies": ["Enemy names lurking here"],
        "events": ["Story triggers or events"],
        "dangerLevel": "safe/low/medium/high/deadly",
        "interactable": true
      }
    }
  ]
}`;

      const { client: openaiClient, model: aiModel } = await getAIClient(req.user?.id);

      const cachedNarrative = getCachedNarrative(campaignId, req.user!.id);
      let finalPrompt = prompt;
      if (cachedNarrative) {
        finalPrompt = prompt + `

═══════════════════════════════════════════════════════════════════════════════
NARRATIVE CONTINUITY LOCK (CRITICAL — HIGHEST PRIORITY):
═══════════════════════════════════════════════════════════════════════════════
The following narrative has ALREADY been shown to the player via streaming.
You MUST use this EXACT text as your "narrative" field — do NOT rewrite, rephrase, or generate different narrative text.
Generate all other fields (choices, storyState, combatEffects, quests, etc.) to be CONSISTENT with this narrative.
Your choices should follow logically from what happens in this narrative.

LOCKED NARRATIVE (copy verbatim into "narrative"):
"""
${cachedNarrative}
"""
═══════════════════════════════════════════════════════════════════════════════`;
        console.log(`[Advance Story] Using cached narrative (${cachedNarrative.length} chars) for campaign ${campaignId}`);
      }

      const response = await openaiClient.chat.completions.create({
        model: aiModel,
        messages: [{ role: "user", content: finalPrompt }],
        response_format: { type: "json_object" },
      });

      const storyAdvancement = JSON.parse(response.choices[0].message.content);
      if (cachedNarrative) {
        deleteCachedNarrative(campaignId, req.user!.id);
      }
      console.log(`[Advance Story] AI response received - narrative length: ${storyAdvancement.narrative?.length || 0}, choices: ${storyAdvancement.choices?.length || 0}${cachedNarrative ? ' (cached narrative injected)' : ''}`);

      // Calculate XP and item rewards based on story advancement
      let xpAwarded = 0;
      let itemsFound: any[] = [];
      let postCombatRewardsData: PostCombatRewards | null = null;
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
      const combatEffects = storyAdvancement.combatEffects || {};
      if (combatEffects?.lootDrops && combatEffects.lootDrops.length > 0) {
        itemsFound.push(...combatEffects.lootDrops);
      }
      
      // CRITICAL FIX: Apply player-initiated damage from rollResult directly to enemy HP
      // This ensures magic item attacks, spell attacks, and weapon attacks from the client
      // actually update enemy HP even if AI doesn't include it in enemyDamage
      const rollIsHit = rollResult?.isHit || rollResult?.hit || rollResult?.autoHit || false;
      const rollTarget = rollResult?.target || rollResult?.targetName || null;
      console.log('[Combat Debug] Processing rollResult:', JSON.stringify({
        hasDamage: !!rollResult?.damage,
        damageTotal: rollResult?.damage?.total,
        isHit: rollIsHit,
        target: rollTarget,
        type: rollResult?.type
      }));
      
      if (rollResult?.damage?.total && rollIsHit && rollTarget) {
        const targetName = rollTarget;
        const damageDealt = rollResult.damage.total;
        console.log(`[Combat Debug] Applying ${damageDealt} damage to ${targetName}`);
        
        // Find target in combatants - check BOTH AI response and current session state
        // AI might not include combatants in response, so we need to check currentStoryState too
        let combatants = storyAdvancement.storyState?.combatants || [];
        let targetIndex = combatants.findIndex(
          (c: any) => c.name === targetName && (c.type === 'enemy' || c.type === 'boss')
        );
        
        // If not found in AI response, check current session state and copy combatants
        const sessionStoryState = currentSession?.storyState as any || {};
        if (targetIndex === -1 && sessionStoryState?.combatants?.length > 0) {
          console.log(`[Combat Debug] Target not in AI response, checking session storyState`);
          // Copy combatants from current session to storyAdvancement so we can modify them
          if (!storyAdvancement.storyState) {
            storyAdvancement.storyState = {};
          }
          storyAdvancement.storyState.combatants = JSON.parse(JSON.stringify(sessionStoryState.combatants));
          combatants = storyAdvancement.storyState.combatants;
          targetIndex = combatants.findIndex(
            (c: any) => c.name === targetName && (c.type === 'enemy' || c.type === 'boss')
          );
        }
        
        if (targetIndex !== -1) {
          const target = combatants[targetIndex];
          const oldHp = target.currentHp ?? target.maxHp ?? 30;
          const newHp = Math.max(0, oldHp - damageDealt);
          const isDefeated = newHp <= 0;
          
          // Update enemy HP directly in storyState
          target.currentHp = newHp;
          const maxHp = target.maxHp ?? 30; // Default maxHp if undefined to avoid NaN comparisons
          if (isDefeated) {
            target.status = 'defeated';
          } else if (maxHp > 0 && newHp <= (maxHp * 0.25)) {
            target.status = 'bloodied';
          } else if (maxHp > 0 && newHp <= (maxHp * 0.5)) {
            target.status = 'wounded';
          }
          
          console.log(`[Player Attack] Applied ${damageDealt} damage to ${targetName}: HP ${oldHp} -> ${newHp} (status: ${target.status})`);
          
          // Add to enemyDamage array for XP calculation and frontend display
          if (!combatEffects.enemyDamage) {
            combatEffects.enemyDamage = [];
          }
          
          // Check if this enemy is already in enemyDamage (AI might have also reported it)
          const existingEntry = combatEffects.enemyDamage.find((e: any) => e.name === targetName);
          if (existingEntry) {
            // Update with accurate values from direct calculation
            existingEntry.newHp = newHp;
            existingEntry.damageTaken = (existingEntry.damageTaken || 0) + damageDealt;
            existingEntry.defeated = isDefeated;
          } else {
            combatEffects.enemyDamage.push({
              name: targetName,
              cr: target.cr || "1/4",
              damageTaken: damageDealt,
              newHp: newHp,
              maxHp: target.maxHp,
              defeated: isDefeated
            });
          }
          
          // Update storyAdvancement.combatEffects with our changes
          storyAdvancement.combatEffects = combatEffects;
        }
      }
      
      // Decrement charges for wands/staves/charged items when used
      let chargeUpdate: { itemId: number; itemName: string; currentCharges: number; maxCharges: number; destroyed?: boolean } | null = null;
      if (rollResult?.type === 'magic_item' && rollResult?.itemName && playerCharacter?.id) {
        try {
          const chargedItems = await db.execute(sql`
            SELECT id, name, current_charges, max_charges 
            FROM character_inventory 
            WHERE character_id = ${playerCharacter.id} 
              AND LOWER(name) = LOWER(${rollResult.itemName})
              AND current_charges IS NOT NULL 
              AND current_charges > 0
            LIMIT 1
          `);
          
          if (chargedItems.rows && chargedItems.rows.length > 0) {
            const item = chargedItems.rows[0] as any;
            const newCharges = Math.max(0, (item.current_charges || 0) - 1);
            
            await db.execute(sql`
              UPDATE character_inventory 
              SET current_charges = ${newCharges}
              WHERE id = ${item.id}
            `);
            
            chargeUpdate = {
              itemId: item.id,
              itemName: item.name,
              currentCharges: newCharges,
              maxCharges: item.max_charges || 0,
              destroyed: false
            };
            
            console.log(`[Charges] ${item.name}: ${item.current_charges} -> ${newCharges} charges remaining`);
            
            // D&D 5e: When the last charge is expended, roll d20 — on a 1, item crumbles to dust
            if (newCharges === 0) {
              const destructionRoll = Math.floor(Math.random() * 20) + 1;
              console.log(`[Charges] ${item.name} expended last charge - destruction roll: d20(${destructionRoll})`);
              if (destructionRoll === 1) {
                await db.execute(sql`DELETE FROM character_inventory WHERE id = ${item.id}`);
                chargeUpdate.destroyed = true;
                console.log(`[Charges] ${item.name} crumbled to dust!`);
              }
            }
          }
        } catch (chargeErr) {
          console.error('[Charges] Error decrementing charges:', chargeErr);
        }
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
        
        // CRITICAL: Update combatants in storyState with damage dealt
        // Use damageTaken to CALCULATE new HP from saved state — don't trust AI's newHp
        const savedCombatants = (currentSession.storyState as any)?.combatants || [];
        if (storyAdvancement.storyState?.combatants) {
          for (const damageEntry of combatEffects.enemyDamage) {
            const combatantIndex = storyAdvancement.storyState.combatants.findIndex(
              (c: any) => c.name === damageEntry.name
            );
            if (combatantIndex !== -1) {
              const combatant = storyAdvancement.storyState.combatants[combatantIndex];
              const savedEnemy = savedCombatants.find((c: any) => c.name === damageEntry.name);
              const savedHp = savedEnemy?.currentHp ?? combatant.maxHp ?? 20;
              const damageTakenAmount = damageEntry.damageTaken || 0;
              const calculatedHp = Math.max(0, savedHp - damageTakenAmount);
              combatant.currentHp = calculatedHp;
              if (calculatedHp <= 0 || damageEntry.defeated) {
                combatant.status = 'defeated';
                combatant.currentHp = 0;
              } else if (calculatedHp <= (combatant.maxHp * 0.25)) {
                combatant.status = 'bloodied';
              } else if (calculatedHp <= (combatant.maxHp * 0.5)) {
                combatant.status = 'wounded';
              }
              console.log(`Updated enemy ${damageEntry.name} HP: ${savedHp} - ${damageTakenAmount} = ${combatant.currentHp}/${combatant.maxHp} (AI said ${damageEntry.newHp}) (status: ${combatant.status})`);
            }
          }
          
          // CRITICAL FIX: Remove defeated enemies from combatants array to prevent reappearing
          const activeEnemies = storyAdvancement.storyState.combatants.filter(
            (c: any) => c.status !== 'defeated' && c.currentHp > 0
          );
          const defeatedCount = storyAdvancement.storyState.combatants.length - activeEnemies.length;
          
          console.log(`[Combat Debug] Active enemies: ${activeEnemies.length}, Defeated: ${defeatedCount}`);
          
          if (defeatedCount > 0) {
            console.log(`[Combat Debug] Removing ${defeatedCount} defeated enemies from combatants array`);
            storyAdvancement.storyState.combatants = activeEnemies;
            
            // If all enemies are defeated, end combat
            const remainingEnemies = activeEnemies.filter((c: any) => c.type === 'enemy' || c.type === 'boss');
            console.log(`[Combat Debug] Remaining enemy combatants: ${remainingEnemies.length}`);
            if (remainingEnemies.length === 0) {
              console.log("[Combat Debug] All enemies defeated - ending combat");
              storyAdvancement.storyState.inCombat = false;
              combatCompleted = true;
            }
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
              const { client: itemClient, model: itemModel } = await getAIClient(req.user?.id);
              const itemResponse = await itemClient.chat.completions.create({
                model: itemModel,
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
      // Use EITHER the AI's movement data OR our detected movement from choice text
      let updatedMapData = null;
      let updatedMapId: number | null = null;
      let movementActuallyOccurred = false;  // Track if movement was allowed by map
      let movementBlockedReason: string | null = null;
      const movement = storyAdvancement.movement;
      const hasAIMovement = movement && movement.occurred && movement.direction;
      const hasDetectedMovement = detectedMovement.isMovement && detectedMovement.direction;
      
      // Use detected movement if AI didn't provide it
      const effectiveDirection = hasAIMovement ? movement.direction : 
                                  (hasDetectedMovement ? detectedMovement.direction : null);
      
      // ALWAYS try to fetch the current map to return it (even without movement)
      try {
        const allMapsForReturn = await storage.getCampaignDungeonMaps(campaignId);
        const activeMapForReturn = allMapsForReturn.find((m: any) => m.isActive) || allMapsForReturn[0];
        if (activeMapForReturn && activeMapForReturn.mapData) {
          const returnMapData = typeof activeMapForReturn.mapData === 'string' 
            ? JSON.parse(activeMapForReturn.mapData) 
            : activeMapForReturn.mapData;
          updatedMapData = returnMapData;
          updatedMapId = activeMapForReturn.id;
        }
      } catch (e) {
        console.error("Failed to fetch map for return:", e);
      }
      
      if (effectiveDirection) {
        console.log(`Processing movement - AI movement: ${hasAIMovement}, Detected movement: ${hasDetectedMovement}, Direction: ${effectiveDirection}`);
        try {
          // Get the current dungeon map for this campaign - use flexible location matching
          const allMaps = await storage.getCampaignDungeonMaps(campaignId);
          
          // Find map matching the current location with flexible matching
          const locationToMatch = (currentLocation || '').toLowerCase().trim();
          
          // Try exact match first
          let dungeonMap = allMaps.find(m => 
            m.mapName?.toLowerCase().trim() === locationToMatch
          );
          
          // If no exact match, try partial match (location contains map name or vice versa)
          if (!dungeonMap && locationToMatch) {
            dungeonMap = allMaps.find(m => {
              const mapNameLower = (m.mapName || '').toLowerCase().trim();
              return locationToMatch.includes(mapNameLower) || mapNameLower.includes(locationToMatch);
            });
          }
          
          // If still no match but campaign has only one map, use that
          if (!dungeonMap && allMaps.length === 1) {
            dungeonMap = allMaps[0];
            console.log(`Using only available map for campaign ${campaignId}: ${dungeonMap.mapName}`);
          }
          
          // If still no match, use the active map
          if (!dungeonMap) {
            dungeonMap = allMaps.find(m => m.isActive);
          }
          
          console.log(`Map lookup: location="${currentLocation}", found=${dungeonMap ? dungeonMap.mapName : 'none'}`);
          
          // Update map if found
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
            
            const canonicalDirection = normalizeDirection(effectiveDirection);
            
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
            
            // Check that the new position is not a wall and handle special tile types
            const targetTile = mapData.tiles?.[newPosition.y]?.[newPosition.x];
            const tileType = targetTile?.type || 'wall';
            
            // Track if movement is allowed
            let canMove = false;
            let tileTransition = false;
            
            if (tileType === 'wall') {
              console.log(`Movement blocked: wall at ${newPosition.x},${newPosition.y}`);
              canMove = false;
              movementBlockedReason = 'wall';
            } else if (tileType === 'door_locked') {
              // Check if player has key or passed lockpicking check in the roll result
              const hasKey = storyAdvancement.narrative?.toLowerCase().includes('unlock') ||
                             storyAdvancement.narrative?.toLowerCase().includes('key') ||
                             (rollResult && rollResult.success && rollResult.purpose?.toLowerCase().includes('lock'));
              if (hasKey) {
                // Unlock the door
                mapData.tiles[newPosition.y][newPosition.x] = { 
                  ...targetTile, 
                  type: 'door',
                  explored: true 
                };
                canMove = true;
                console.log(`Locked door unlocked at ${newPosition.x},${newPosition.y}`);
              } else {
                console.log(`Movement blocked: locked door at ${newPosition.x},${newPosition.y} - need key or lockpicking`);
                canMove = false;
                movementBlockedReason = 'locked_door';
              }
            } else if (tileType === 'secret_door') {
              // Secret door revealed and entered
              mapData.tiles[newPosition.y][newPosition.x] = { 
                ...targetTile, 
                type: 'door',
                explored: true,
                visible: true 
              };
              canMove = true;
              tileTransition = true;
              console.log(`Secret door discovered and entered at ${newPosition.x},${newPosition.y}`);
            } else {
              canMove = true;
            }
            
            // Check if moving to edge of map - might trigger new area generation
            const isAtEdge = newPosition.x === 0 || newPosition.x === mapData.width - 1 ||
                            newPosition.y === 0 || newPosition.y === mapData.height - 1;
            
            if (canMove) {
              movementActuallyOccurred = true;  // Mark that movement was successful
              
              // Update player position and mark tiles as explored (NEVER reset explored tiles)
              const oldPosition = { ...mapData.playerPosition };
              mapData.playerPosition = newPosition;
              mapData.tiles = mapData.tiles.map((row: any[], y: number) =>
                row.map((tile: any, x: number) => {
                  const dist = Math.sqrt(
                    Math.pow(x - newPosition.x, 2) + 
                    Math.pow(y - newPosition.y, 2)
                  );
                  // IMPORTANT: explored flag is NEVER reset - only set to true
                  const wasExplored = tile.explored || false;
                  const nowExplored = wasExplored || dist <= 2;
                  const nowVisible = dist <= 1.5;
                  
                  return { ...tile, explored: nowExplored, visible: nowVisible };
                })
              );
              
              // Save updated map - update BOTH mapData AND the separate playerPosition column
              console.log(`Map movement: ${oldPosition.x},${oldPosition.y} -> ${newPosition.x},${newPosition.y} (direction: ${effectiveDirection})`);
              await storage.updateCampaignDungeonMap(dungeonMap.id, { 
                mapData, 
                playerPosition: newPosition // Update the separate playerPosition column too!
              });
              updatedMapData = mapData;
              updatedMapId = dungeonMap.id;
              console.log(`Map ${dungeonMap.id} updated with new position, returning in response`);
              
              // Record movement trace event
              await recordTrace(campaignId, "everdice.movement", {
                actorId: "party.main",
                from: oldPosition,
                to: newPosition,
                locationId: dungeonMap.mapName
              }, {
                sessionId: `session.${campaign.currentSession}`,
                who: "party.main",
                where: dungeonMap.mapName
              });
              
              // If at edge of map, generate connected map (for secret doors, exits, corridors at boundary)
              if (isAtEdge && (tileTransition || tileType === 'corridor' || tileType === 'floor' || tileType === 'door')) {
                console.log(`Edge transition detected at ${newPosition.x},${newPosition.y} - generating new connected area`);
                
                // Determine entry direction for new map (opposite of exit direction)
                const entryDirection = canonicalDirection === 'up' ? 'south' :
                                      canonicalDirection === 'down' ? 'north' :
                                      canonicalDirection === 'left' ? 'east' : 'west';
                
                // Generate a new connected map
                const connectedMapData = {
                  name: `${mapData.name || 'Dungeon'} - Area ${Date.now() % 1000}`,
                  width: 9,
                  height: 9,
                  tiles: Array(9).fill(null).map(() =>
                    Array(9).fill(null).map(() => ({ type: 'wall', explored: false, visible: false }))
                  ),
                  entities: [],
                  playerPosition: { 
                    x: entryDirection === 'east' ? 1 : entryDirection === 'west' ? 7 : 4,
                    y: entryDirection === 'south' ? 1 : entryDirection === 'north' ? 7 : 4
                  },
                  level: (mapData.level || 1) + 1,
                  parentMapId: dungeonMap.id,
                  entryPoint: { direction: entryDirection, x: newPosition.x, y: newPosition.y }
                };
                
                // Carve out initial room at entry point
                const entryPos = connectedMapData.playerPosition;
                for (let dy = -1; dy <= 1; dy++) {
                  for (let dx = -1; dx <= 1; dx++) {
                    const nx = entryPos.x + dx;
                    const ny = entryPos.y + dy;
                    if (nx >= 0 && nx < 9 && ny >= 0 && ny < 9) {
                      connectedMapData.tiles[ny][nx] = { type: 'floor', explored: true, visible: true };
                    }
                  }
                }
                
                // Create new connected map
                try {
                  const newConnectedMap = await storage.createCampaignDungeonMap({
                    campaignId,
                    mapName: connectedMapData.name,
                    mapData: connectedMapData,
                    playerPosition: connectedMapData.playerPosition,
                    fogOfWar: {},
                    exploredTiles: [],
                    isActive: true  // Make the new map active
                  });
                  
                  // Deactivate the old map
                  await storage.updateCampaignDungeonMap(dungeonMap.id, { isActive: false });
                  
                  // Store connection info in current map's metadata
                  mapData.connections = mapData.connections || [];
                  mapData.connections.push({
                    toMapId: newConnectedMap.id,
                    exitPosition: { x: newPosition.x, y: newPosition.y },
                    direction: canonicalDirection
                  });
                  await storage.updateCampaignDungeonMap(dungeonMap.id, { mapData });
                  
                  updatedMapData = connectedMapData;
                  updatedMapId = newConnectedMap.id;
                  console.log(`Created connected map ${newConnectedMap.id} from map ${dungeonMap.id}`);
                } catch (connectedMapError) {
                  console.error("Failed to create connected map:", connectedMapError);
                }
              }
            } else {
              console.log(`Movement blocked: target tile at ${newPosition.x},${newPosition.y} is ${tileType}`);
            }
          } else {
            console.log(`No dungeon map found for campaign ${campaignId}`);
          }
        } catch (mapError) {
          console.error("Failed to update dungeon map from story movement:", mapError);
        }
        
        // Update procedural exploration hexes based on movement
        try {
          const explorationState = await storage.getExplorationState(campaignId);
          if (explorationState) {
            const currentQ = explorationState.currentHexQ || 0;
            const currentR = explorationState.currentHexR || 0;
            
            // Convert cardinal direction to hex direction
            const cardinalToHexDir: Record<string, HexDirection> = {
              'up': 'n', 'north': 'n', 'n': 'n',
              'down': 's', 'south': 's', 's': 's',
              'right': 'se', 'east': 'se', 'e': 'se',
              'left': 'nw', 'west': 'nw', 'w': 'nw'
            };
            const hexDir = cardinalToHexDir[(effectiveDirection || '').toLowerCase()] || 'n';
            const newCoords = getAdjacentHexCoordinates(currentQ, currentR, hexDir);
            
            // Mark current hex (the one we're leaving) as explored
            let currentHex = await storage.getExplorationHex(campaignId, currentQ, currentR);
            if (currentHex) {
              // Always update to ensure it's marked as explored with proper data
              await storage.updateExplorationHex(currentHex.id, {
                isExplored: true,
                isRevealed: true,
                exploredAt: currentHex.exploredAt || new Date().toISOString()
              });
              console.log(`[Exploration] Marked previous hex at (${currentQ}, ${currentR}) as explored`);
            } else {
              // Create the source hex if it doesn't exist (shouldn't happen normally)
              currentHex = await storage.createExplorationHex({
                campaignId,
                q: currentQ,
                r: currentR,
                terrainType: "Explored Area",
                locationName: "Previous Location",
                isExplored: true,
                isRevealed: true,
                exploredAt: new Date().toISOString(),
                revealedAt: new Date().toISOString(),
                connectedDirections: []
              });
              console.log(`[Exploration] Created missing source hex at (${currentQ}, ${currentR})`);
            }
            
            // Create new hex at destination
            let newHex = await storage.getExplorationHex(campaignId, newCoords.q, newCoords.r);
            // Detect adventure setting for context-aware terrain generation
            // Priority: current narrative > chapter description > campaign title
            const adventureSetting = detectAdventureSetting(
              campaign.title || '', 
              campaign.description || '',
              storyAdvancement.narrative || '',  // Pass current narrative for immediate context
              campaign.currentChapter ? `Chapter ${campaign.currentChapter}` : undefined
            );
            const parsed = parseNarrativeForLocations(storyAdvancement.narrative || '', adventureSetting);
            const hexMeta = generateHexMetaFromKeywords(
              parsed.currentLocation.environmentKeywords,
              parsed.atmosphereKeywords
            );
            
            if (!newHex) {
              newHex = await storage.createExplorationHex({
                campaignId,
                q: newCoords.q,
                r: newCoords.r,
                terrainType: parsed.terrainType || "Unknown",
                locationName: parsed.currentLocation.name || dungeonState?.currentRoom || "Unknown",
                locationDescription: parsed.currentLocation.description,
                hexMeta,
                isExplored: true,
                isRevealed: true,
                exploredAt: new Date().toISOString(),
                revealedAt: new Date().toISOString(),
                narrativeContext: (storyAdvancement.narrative || '').slice(0, 500),
                connectedDirections: []
              });
              console.log(`[Exploration] Created new hex at (${newCoords.q}, ${newCoords.r}): ${parsed.currentLocation.name || parsed.terrainType}`);
            } else {
              await storage.updateExplorationHex(newHex.id, {
                terrainType: parsed.terrainType !== "Unknown" ? parsed.terrainType : newHex.terrainType,
                locationName: parsed.currentLocation.name || dungeonState?.currentRoom || newHex.locationName,
                locationDescription: parsed.currentLocation.description || newHex.locationDescription,
                hexMeta,
                isExplored: true,
                exploredAt: new Date().toISOString(),
                narrativeContext: (storyAdvancement.narrative || '').slice(0, 500)
              });
            }
            
            // Update exploration state with new position
            await storage.updateExplorationState(parseInt(campaignId), {
              currentHexQ: newCoords.q,
              currentHexR: newCoords.r,
              exploredHexCount: (explorationState.exploredHexCount || 0) + 1,
              totalDistance: (explorationState.totalDistance || 0) + 1
            });
            console.log(`[Exploration] Player moved from (${currentQ}, ${currentR}) to (${newCoords.q}, ${newCoords.r})`);
            
            // Reveal adjacent hexes based on narrative hints (passages, corridors, etc.)
            for (const hint of parsed.adjacentHints) {
              const adjacentCoords = getAdjacentHexCoordinates(newCoords.q, newCoords.r, hint.direction);
              let adjacentHex = await storage.getExplorationHex(campaignId, adjacentCoords.q, adjacentCoords.r);
              
              if (!adjacentHex) {
                // Create revealed but unexplored hex
                const hintMeta = generateHexMetaFromKeywords(hint.environmentKeywords, []);
                adjacentHex = await storage.createExplorationHex({
                  campaignId,
                  q: adjacentCoords.q,
                  r: adjacentCoords.r,
                  terrainType: hint.environmentKeywords[0] ? 
                    (ENVIRONMENT_KEYWORDS[hint.environmentKeywords[0]]?.terrain || "Passage") : "Passage",
                  locationName: hint.description.slice(0, 50) || "Unknown Passage",
                  locationDescription: hint.description,
                  hexMeta: hintMeta,
                  isExplored: false,
                  isRevealed: true,
                  revealedAt: new Date().toISOString(),
                  narrativeContext: hint.description,
                  connectedDirections: []
                });
                console.log(`[Exploration] Revealed adjacent hex at (${adjacentCoords.q}, ${adjacentCoords.r}) - ${hint.direction}: ${hint.description.slice(0, 40)}`);
              }
            }
            
            // Store detected entities on the current hex
            if (parsed.detectedEntities.length > 0) {
              const entityData = parsed.detectedEntities.map(e => ({
                type: e.type,
                name: e.name,
                hostile: e.hostile,
                direction: e.direction
              }));
              
              // Update hex with entities
              await storage.updateExplorationHex(newHex.id, {
                hexMeta: {
                  ...hexMeta,
                  entities: entityData
                }
              });
              console.log(`[Exploration] Detected entities on hex: ${parsed.detectedEntities.map(e => e.name).join(', ')}`);
              
              // Create revealed hexes for entities with directions
              for (const entity of parsed.detectedEntities) {
                if (entity.direction) {
                  const entityCoords = getAdjacentHexCoordinates(newCoords.q, newCoords.r, entity.direction);
                  let entityHex = await storage.getExplorationHex(campaignId, entityCoords.q, entityCoords.r);
                  
                  if (!entityHex) {
                    entityHex = await storage.createExplorationHex({
                      campaignId,
                      q: entityCoords.q,
                      r: entityCoords.r,
                      terrainType: entity.hostile ? "Danger" : "Unknown",
                      locationName: `${entity.name} Spotted`,
                      locationDescription: entity.description || `${entity.name} were seen in this direction`,
                      hexMeta: {
                        narrativeTone: entity.hostile ? "Hostile" : "Neutral",
                        hexState: "hidden",
                        entities: [{ type: entity.type, name: entity.name, hostile: entity.hostile }]
                      },
                      isExplored: false,
                      isRevealed: true,
                      revealedAt: new Date().toISOString(),
                      narrativeContext: entity.description,
                      connectedDirections: []
                    });
                    console.log(`[Exploration] Revealed entity hex at (${entityCoords.q}, ${entityCoords.r}) - ${entity.name}`);
                  }
                }
              }
            }
          }
        } catch (explorationError) {
          console.error("Failed to update exploration hexes:", explorationError);
        }
      }
      
      // Process AI's dungeonState to update map dynamically based on narrative
      // IMPORTANT: Preserve playerPosition from any movement that already occurred
      const preservedPlayerPosition = updatedMapData?.playerPosition;
      
      const dungeonState = storyAdvancement.dungeonState;
      if (dungeonState && dungeonState.currentRoom) {
        try {
          const allMaps = await storage.getCampaignDungeonMaps(campaignId);
          let dungeonMap = allMaps.find(m => m.isActive) || allMaps[0];
          
          if (dungeonMap && dungeonMap.mapData) {
            const mapData = typeof dungeonMap.mapData === 'string' 
              ? JSON.parse(dungeonMap.mapData) 
              : dungeonMap.mapData;
            
            // Preserve playerPosition from movement if it occurred
            if (preservedPlayerPosition) {
              mapData.playerPosition = preservedPlayerPosition;
            }
            
            // Update entities with room features from AI
            const newEntities: any[] = mapData.entities || [];
            
            // Add features from dungeonState
            if (dungeonState.features) {
              for (const feature of dungeonState.features) {
                const featureId = `feature_${feature.type}_${Date.now()}`;
                // Only add if not already present
                if (!newEntities.some(e => e.type === feature.type && e.description === feature.description)) {
                  const playerPos = mapData.playerPosition || { x: 4, y: 4 };
                  // Position features around the player
                  const offsetX = feature.position === 'corner' ? 1 : 0;
                  const offsetY = feature.position === 'along_wall' ? 1 : 0;
                  newEntities.push({
                    id: featureId,
                    type: feature.type,
                    name: feature.type.charAt(0).toUpperCase() + feature.type.slice(1).replace('_', ' '),
                    description: feature.description,
                    x: playerPos.x + offsetX,
                    y: playerPos.y + offsetY
                  });
                }
              }
            }
            
            // Update room info in map metadata
            mapData.entities = newEntities;
            mapData.currentRoom = dungeonState.currentRoom;
            mapData.exits = dungeonState.exits || [];
            mapData.lighting = dungeonState.lighting || 'dim';
            mapData.dangerLevel = dungeonState.dangerLevel || 'medium';
            
            // Mark tiles as passable in exit directions from current position
            const playerPos = mapData.playerPosition || { x: 4, y: 4 };
            const exitDirections: Record<string, {dx: number, dy: number}> = {
              north: { dx: 0, dy: -1 },
              south: { dx: 0, dy: 1 },
              east: { dx: 1, dy: 0 },
              west: { dx: -1, dy: 0 }
            };
            
            if (dungeonState.exits && mapData.tiles) {
              for (const exit of dungeonState.exits) {
                if (exit.visible && exitDirections[exit.direction]) {
                  const dir = exitDirections[exit.direction];
                  // Clear a path of 3 tiles in the exit direction
                  for (let i = 1; i <= 3; i++) {
                    const tx = playerPos.x + (dir.dx * i);
                    const ty = playerPos.y + (dir.dy * i);
                    if (ty >= 0 && ty < mapData.height && tx >= 0 && tx < mapData.width) {
                      if (mapData.tiles[ty][tx].type === 'wall') {
                        mapData.tiles[ty][tx] = {
                          type: exit.locked ? 'door_locked' : 'corridor',
                          explored: false,
                          visible: false,
                          exitDescription: exit.description
                        };
                      }
                    }
                  }
                }
              }
            }
            
            // Update BOTH mapData AND the separate playerPosition column
            await storage.updateCampaignDungeonMap(dungeonMap.id, { 
              mapData,
              playerPosition: mapData.playerPosition // Sync the separate column with mapData
            });
            updatedMapData = mapData;
            updatedMapId = dungeonMap.id;
            console.log(`Map updated from dungeonState: room=${dungeonState.currentRoom.name}, exits=${dungeonState.exits?.length || 0}, playerPos=${mapData.playerPosition?.x},${mapData.playerPosition?.y}`);
          }
        } catch (dungeonStateError) {
          console.error("Failed to process dungeonState:", dungeonStateError);
        }
      }
      
      // Process AI's mapModifications to update tile narrative data
      const mapModifications = storyAdvancement.mapModifications;
      if (mapModifications && Array.isArray(mapModifications) && mapModifications.length > 0) {
        try {
          const allMaps = await storage.getCampaignDungeonMaps(campaignId);
          let dungeonMap = allMaps.find(m => m.isActive) || allMaps[0];
          
          if (dungeonMap && dungeonMap.mapData) {
            const mapData = typeof dungeonMap.mapData === 'string' 
              ? JSON.parse(dungeonMap.mapData) 
              : dungeonMap.mapData;
            
            let modificationsApplied = 0;
            
            for (const mod of mapModifications) {
              const { type, x, y, data } = mod;
              
              // Validate coordinates
              if (x < 0 || y < 0 || y >= mapData.height || x >= mapData.width) {
                console.log(`Map modification skipped: coordinates (${x}, ${y}) out of bounds`);
                continue;
              }
              
              // Ensure tile exists
              if (!mapData.tiles || !mapData.tiles[y] || !mapData.tiles[y][x]) {
                continue;
              }
              
              const tile = mapData.tiles[y][x];
              
              switch (type) {
                case 'update_narrative':
                  // Update tile's narrative data
                  tile.narrative = {
                    ...tile.narrative,
                    description: data.description || tile.narrative?.description,
                    shortDescription: data.shortDescription || tile.narrative?.shortDescription,
                    npcs: data.npcs || tile.narrative?.npcs || [],
                    items: data.items || tile.narrative?.items || [],
                    enemies: data.enemies || tile.narrative?.enemies || [],
                    events: data.events || tile.narrative?.events || [],
                    dangerLevel: data.dangerLevel || tile.narrative?.dangerLevel || 'safe',
                    interactable: data.interactable !== undefined ? data.interactable : tile.narrative?.interactable,
                    discovered: true // Mark as discovered since AI is describing it
                  };
                  modificationsApplied++;
                  break;
                  
                case 'add_secret':
                  // Change tile type to secret door and add narrative
                  tile.type = 'secret_door';
                  tile.narrative = {
                    ...tile.narrative,
                    secretInfo: data.description,
                    discovered: false // Secret not yet found
                  };
                  modificationsApplied++;
                  break;
                  
                case 'place_enemy':
                  // Add enemy to tile's narrative
                  tile.narrative = {
                    ...tile.narrative,
                    enemies: [...(tile.narrative?.enemies || []), data.name || 'Unknown Enemy'],
                    dangerLevel: data.dangerLevel || 'medium',
                    discovered: true
                  };
                  modificationsApplied++;
                  break;
                  
                case 'add_treasure':
                  // Mark tile as having treasure
                  if (tile.type === 'floor' || tile.type === 'corridor') {
                    tile.type = 'treasure';
                  }
                  tile.narrative = {
                    ...tile.narrative,
                    items: [...(tile.narrative?.items || []), data.name || 'Treasure'],
                    shortDescription: data.description || 'A glittering treasure awaits',
                    interactable: true,
                    discovered: true
                  };
                  modificationsApplied++;
                  break;
                  
                case 'add_npc':
                  // Add NPC to tile's narrative
                  tile.narrative = {
                    ...tile.narrative,
                    npcs: [...(tile.narrative?.npcs || []), data.name || 'Mysterious Figure'],
                    shortDescription: data.description || tile.narrative?.shortDescription,
                    interactable: true,
                    discovered: true
                  };
                  modificationsApplied++;
                  break;
                  
                case 'trigger_event':
                  // Add event to tile
                  tile.narrative = {
                    ...tile.narrative,
                    events: [...(tile.narrative?.events || []), data.name || 'Story Event'],
                    shortDescription: data.description || tile.narrative?.shortDescription,
                    discovered: true
                  };
                  modificationsApplied++;
                  break;
              }
            }
            
            if (modificationsApplied > 0) {
              await storage.updateCampaignDungeonMap(dungeonMap.id, { mapData });
              updatedMapData = mapData;
              updatedMapId = dungeonMap.id;
              console.log(`Applied ${modificationsApplied} map modifications from AI narrative`);
            }
          }
        } catch (modError) {
          console.error("Failed to process mapModifications:", modError);
        }
      }
      
      // Auto-generate dungeon map when entering dungeon-like locations
      const dungeonKeywords = ['dungeon', 'cave', 'cavern', 'crypt', 'tomb', 'catacomb', 'lair', 'underground', 'mine', 'sewers', 'vault', 'ruins', 'temple interior', 'dark passage', 'maze', 'labyrinth'];
      const narrativeLower = (storyAdvancement.narrative || '').toLowerCase();
      
      // Safely extract location string - handle both string and object locations
      const rawLocation = storyAdvancement.storyState?.location || storyAdvancement.storyState?.currentLocation || '';
      const locationLower = typeof rawLocation === 'string' ? rawLocation.toLowerCase() : 
                           (rawLocation?.name ? String(rawLocation.name).toLowerCase() : '');
      
      const enterKeywords = ['enter', 'descend', 'step into', 'venture into', 'explore', 'delve', 'go inside', 'walk into', 'head into'];
      
      const isEnteringDungeon = dungeonKeywords.some(keyword => {
        const inNarrative = narrativeLower.includes(keyword);
        const inLocation = locationLower.includes(keyword);
        const hasEnterVerb = enterKeywords.some(verb => narrativeLower.includes(verb));
        return (inNarrative && hasEnterVerb) || inLocation;
      });
      
      if (isEnteringDungeon && !updatedMapData) {
        try {
          // Check if a dungeon map already exists for this campaign
          const existingMap = await storage.getCampaignDungeonMap(campaignId);
          
          if (!existingMap) {
            // Generate a new dungeon map
            console.log(`Auto-generating dungeon map for campaign ${campaignId} - detected dungeon entry`);
            
            // Get campaign info for naming - safely extract string from location
            const campaign = await storage.getCampaign(campaignId);
            const rawLocationName = storyAdvancement.storyState?.location || storyAdvancement.storyState?.currentLocation;
            const locationName = typeof rawLocationName === 'string' ? rawLocationName : 
                                (rawLocationName?.name ? String(rawLocationName.name) : null);
            const dungeonName = locationName || `${campaign?.title || 'Adventure'} Dungeon`;
            
            // Generate dungeon using procedural generation
            const generateDungeonMap = () => {
              const width = 25;
              const height = 18;
              const tiles: any[][] = [];
              
              // Initialize with walls
              for (let y = 0; y < height; y++) {
                const row: any[] = [];
                for (let x = 0; x < width; x++) {
                  row.push({ type: "wall", explored: false, visible: false });
                }
                tiles.push(row);
              }
              
              // Generate rooms
              const rooms: { x: number; y: number; w: number; h: number; centerX: number; centerY: number }[] = [];
              const numRooms = 5 + Math.floor(Math.random() * 3);
              
              for (let attempt = 0; attempt < numRooms * 5; attempt++) {
                if (rooms.length >= numRooms) break;
                
                const roomW = 4 + Math.floor(Math.random() * 4);
                const roomH = 4 + Math.floor(Math.random() * 4);
                const roomX = 1 + Math.floor(Math.random() * (width - roomW - 2));
                const roomY = 1 + Math.floor(Math.random() * (height - roomH - 2));
                
                let overlaps = false;
                for (const room of rooms) {
                  if (roomX - 1 < room.x + room.w && roomX + roomW + 1 > room.x &&
                      roomY - 1 < room.y + room.h && roomY + roomH + 1 > room.y) {
                    overlaps = true;
                    break;
                  }
                }
                
                if (!overlaps) {
                  const centerX = Math.floor(roomX + roomW / 2);
                  const centerY = Math.floor(roomY + roomH / 2);
                  rooms.push({ x: roomX, y: roomY, w: roomW, h: roomH, centerX, centerY });
                  
                  // Carve room
                  for (let ry = roomY; ry < roomY + roomH; ry++) {
                    for (let rx = roomX; rx < roomX + roomW; rx++) {
                      tiles[ry][rx] = { type: "floor", explored: false, visible: false };
                    }
                  }
                }
              }
              
              // Connect rooms with corridors
              for (let i = 1; i < rooms.length; i++) {
                const prev = rooms[i - 1];
                const curr = rooms[i];
                
                if (Math.random() < 0.5) {
                  // Horizontal then vertical
                  for (let x = Math.min(prev.centerX, curr.centerX); x <= Math.max(prev.centerX, curr.centerX); x++) {
                    if (tiles[prev.centerY][x].type === "wall") {
                      tiles[prev.centerY][x] = { type: "floor", explored: false, visible: false };
                    }
                  }
                  for (let y = Math.min(prev.centerY, curr.centerY); y <= Math.max(prev.centerY, curr.centerY); y++) {
                    if (tiles[y][curr.centerX].type === "wall") {
                      tiles[y][curr.centerX] = { type: "floor", explored: false, visible: false };
                    }
                  }
                } else {
                  // Vertical then horizontal
                  for (let y = Math.min(prev.centerY, curr.centerY); y <= Math.max(prev.centerY, curr.centerY); y++) {
                    if (tiles[y][prev.centerX].type === "wall") {
                      tiles[y][prev.centerX] = { type: "floor", explored: false, visible: false };
                    }
                  }
                  for (let x = Math.min(prev.centerX, curr.centerX); x <= Math.max(prev.centerX, curr.centerX); x++) {
                    if (tiles[curr.centerY][x].type === "wall") {
                      tiles[curr.centerY][x] = { type: "floor", explored: false, visible: false };
                    }
                  }
                }
              }
              
              // Add doors, treasures, and traps
              if (rooms.length > 1) {
                const lastRoom = rooms[rooms.length - 1];
                tiles[lastRoom.centerY][lastRoom.centerX] = { type: "treasure", explored: false, visible: false };
              }
              
              // Add enemies
              const entities: any[] = [];
              const enemyNames = ["Goblin", "Orc", "Skeleton", "Zombie", "Kobold"];
              for (let i = 1; i < rooms.length - 1; i++) {
                if (Math.random() < 0.5) {
                  const room = rooms[i];
                  entities.push({
                    id: `enemy-${i}`,
                    type: "enemy",
                    name: enemyNames[Math.floor(Math.random() * enemyNames.length)],
                    x: room.centerX,
                    y: room.centerY,
                    hp: 10 + Math.floor(Math.random() * 15),
                    maxHp: 25,
                  });
                }
              }
              
              // Player starts in first room
              const startRoom = rooms[0];
              const playerPos = { x: startRoom.centerX, y: startRoom.centerY };
              
              // Reveal starting area
              for (let y = Math.max(0, playerPos.y - 2); y <= Math.min(height - 1, playerPos.y + 2); y++) {
                for (let x = Math.max(0, playerPos.x - 2); x <= Math.min(width - 1, playerPos.x + 2); x++) {
                  tiles[y][x].explored = true;
                  tiles[y][x].visible = true;
                }
              }
              
              return {
                width,
                height,
                tiles,
                entities,
                playerPosition: playerPos,
                name: dungeonName,
                level: 1,
              };
            };
            
            const newMapData = generateDungeonMap();
            
            // Save to database
            await storage.createCampaignDungeonMap({
              campaignId,
              mapName: dungeonName,
              mapData: newMapData,
              playerPosition: newMapData.playerPosition,
              fogOfWar: {},
              exploredTiles: [],
            });
            
            updatedMapData = newMapData;
            console.log(`Dungeon map auto-generated for campaign ${campaignId}: ${dungeonName}`);
          }
        } catch (dungeonGenError) {
          console.error("Failed to auto-generate dungeon map:", dungeonGenError);
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
      
      // Track combat rounds — how many turns the player has been in combat
      const currentCombatRounds = currentStoryState.combatRoundCount || 0;
      const wasInCombat = currentStoryState.inCombat || false;
      const nowInCombat = storyAdvancement.storyState?.inCombat || false;
      
      // CRITICAL: Do NOT set combatCompleted just because AI says inCombat changed to false.
      // Combat can only end legitimately when:
      // 1. All enemies are actually defeated (HP <= 0), verified later in the merge step, OR
      // 2. At least 2 combat rounds have passed AND the AI says combat ended (retreat/flee)
      // This prevents the AI from narratively resolving combat in a single turn.
      if (wasInCombat && !nowInCombat && currentCombatRounds >= 2) {
        combatCompleted = true;
        console.log(`[Combat] AI ended combat after ${currentCombatRounds} rounds — allowing (retreat/disengage)`);
      } else if (wasInCombat && !nowInCombat && currentCombatRounds < 2) {
        console.log(`[Combat] AI tried to end combat after only ${currentCombatRounds} rounds — BLOCKING (too soon, requires enemy defeat or 2+ rounds)`);
        if (storyAdvancement.storyState) {
          storyAdvancement.storyState.inCombat = true;
        }
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
        
        // POST-COMBAT REWARDS ENGINE: Generate loot, bonus XP, gold, and check chapter advancement
        // ONLY trigger rewards when combat ended via VICTORY (all enemies defeated), NOT retreat/disengage
        try {
          const allCombatants = storyAdvancement.storyState?.combatants || currentStoryState.combatants || [];
          const savedEnemyCombatants = (currentStoryState.combatants || []).filter(
            (c: any) => c.type === 'enemy' || c.type === 'boss'
          );
          
          // Check if this is an actual victory: all enemy combatants must be defeated
          const allEnemiesDefeated = savedEnemyCombatants.length > 0 && savedEnemyCombatants.every(
            (c: any) => c.status === 'defeated' || c.currentHp <= 0
          );
          // Also check merged state (post-combat processing may have updated it)
          const mergedEnemyCombatants = (mergedStoryState.combatants || []).filter(
            (c: any) => c.type === 'enemy' || c.type === 'boss'
          );
          const allMergedEnemiesDefeated = mergedEnemyCombatants.length === 0 && savedEnemyCombatants.length > 0;
          
          const isVictory = allEnemiesDefeated || allMergedEnemiesDefeated || 
            ((combatEffects?.enemyDamage || []).filter((e: any) => e.defeated).length > 0 &&
             (combatEffects?.enemyDamage || []).filter((e: any) => e.defeated).length >= savedEnemyCombatants.length);
          
          if (!isVictory) {
            console.log(`[Post-Combat Rewards] Skipping rewards - combat ended without full victory (retreat/disengage)`);
          }
          
          const defeatedEnemyList: DefeatedEnemy[] = isVictory ? (combatEffects?.enemyDamage || [])
            .filter((e: any) => e.defeated)
            .map((e: any) => {
              const combatant = allCombatants.find((c: any) => c.name === e.name) ||
                savedEnemyCombatants.find((c: any) => c.name === e.name);
              return {
                name: e.name,
                cr: combatant?.cr || e.cr || "1/4",
                type: combatant?.type || 'enemy',
                maxHp: combatant?.maxHp || e.maxHp || 20,
                currentHp: 0,
                status: 'defeated'
              };
            }) : [];
          
          // Fallback: if victory is confirmed but enemyDamage didn't capture all defeated, use saved combatants
          if (isVictory && defeatedEnemyList.length === 0) {
            for (const c of savedEnemyCombatants) {
              defeatedEnemyList.push({
                name: c.name,
                cr: c.cr || "1/4",
                type: c.type,
                maxHp: c.maxHp || 20,
                currentHp: 0,
                status: 'defeated'
              });
            }
          }
          
          if (isVictory && defeatedEnemyList.length > 0) {
            const characterLevel = character?.level || 1;
            
            postCombatRewardsData = generatePostCombatRewards(
              defeatedEnemyList,
              characterLevel,
              currentChapter,
              totalChapters,
              campaign.title
            );
            
            console.log(`[Post-Combat Rewards] ${postCombatRewardsData.isBossFight ? 'BOSS FIGHT' : 'Standard encounter'} - ` +
              `XP: ${postCombatRewardsData.xpAwarded}, Gold: ${postCombatRewardsData.goldAwarded}, ` +
              `Items: ${postCombatRewardsData.lootItems.length}, Chapter advance: ${postCombatRewardsData.shouldAdvanceChapter}`);
            
            xpAwarded += postCombatRewardsData.xpAwarded;
            
            for (const lootItem of postCombatRewardsData.lootItems) {
              itemsFound.push({
                name: lootItem.name,
                type: lootItem.type,
                rarity: lootItem.rarity,
                description: lootItem.description,
                properties: lootItem.specialEffect || lootItem.properties || '',
                value: lootItem.value,
                magicBonus: lootItem.magicBonus,
                damageDice: lootItem.damageDice,
                damageType: lootItem.damageType,
                baseAC: lootItem.baseAC,
                requiresAttunement: lootItem.requiresAttunement
              });
            }
          }
        } catch (rewardsErr) {
          console.error('[Post-Combat Rewards] Error generating rewards:', rewardsErr);
        }
      }
      
      // Detect and track traps, puzzles, and discoveries from the narrative and choice
      const narrativeLowerForProgress = (storyAdvancement.narrative || '').toLowerCase();
      const choiceLowerForProgress = (choice || '').toLowerCase();
      const combinedTextForProgress = narrativeLowerForProgress + ' ' + choiceLowerForProgress;
      
      // Track trap encounters - detect trap resolution
      const trapKeywords = ['trap', 'triggered', 'disarm', 'pressure plate', 'snare', 'pitfall', 'spring'];
      const trapResolutionKeywords = ['avoid', 'disarmed', 'dodged', 'escaped', 'survived', 'triggered', 'sprung', 'activated'];
      const hasTrapEvent = trapKeywords.some(k => combinedTextForProgress.includes(k)) && 
                           trapResolutionKeywords.some(k => combinedTextForProgress.includes(k));
      
      if (hasTrapEvent && !combatCompleted) {
        updatedAdventureProgress = {
          ...updatedAdventureProgress,
          encounters: {
            ...updatedAdventureProgress.encounters,
            trap: (updatedAdventureProgress.encounters?.trap || 0) + 1,
            total: (updatedAdventureProgress.encounters?.total || 0) + 1
          }
        };
        console.log("Trap encounter resolved - incrementing counter:", updatedAdventureProgress.encounters);
      }
      
      // Track puzzle encounters - detect puzzle solving
      const puzzleKeywords = ['puzzle', 'riddle', 'mechanism', 'combination', 'sequence', 'cipher', 'code'];
      const puzzleResolutionKeywords = ['solved', 'figured out', 'unlocked', 'deciphered', 'cracked', 'completed', 'answer'];
      const hasPuzzleEvent = puzzleKeywords.some(k => combinedTextForProgress.includes(k)) && 
                             puzzleResolutionKeywords.some(k => combinedTextForProgress.includes(k));
      
      if (hasPuzzleEvent && !combatCompleted && !hasTrapEvent) {
        updatedAdventureProgress = {
          ...updatedAdventureProgress,
          puzzles: (updatedAdventureProgress.puzzles || 0) + 1
        };
        console.log("Puzzle solved - incrementing counter. Puzzles:", updatedAdventureProgress.puzzles);
      }
      
      // Track discovery encounters - detect exploration discoveries
      const discoveryKeywords = ['discover', 'found', 'uncover', 'reveal', 'secret', 'hidden', 'ancient', 'lore', 'clue'];
      const discoveryContextKeywords = ['chamber', 'passage', 'room', 'treasure', 'artifact', 'inscription', 'tome', 'scroll', 'map'];
      const hasDiscoveryEvent = discoveryKeywords.some(k => combinedTextForProgress.includes(k)) && 
                                discoveryContextKeywords.some(k => combinedTextForProgress.includes(k));
      
      if (hasDiscoveryEvent && !combatCompleted && !hasTrapEvent && !hasPuzzleEvent) {
        updatedAdventureProgress = {
          ...updatedAdventureProgress,
          discoveries: (updatedAdventureProgress.discoveries || 0) + 1
        };
        console.log("Discovery made - incrementing counter. Discoveries:", updatedAdventureProgress.discoveries);
      }
      
      // Track treasure encounters
      const treasureKeywords = ['treasure', 'chest', 'loot', 'gold coins', 'valuable', 'gems', 'jewels'];
      const treasureResolutionKeywords = ['open', 'collect', 'take', 'gather', 'claim', 'found'];
      const hasTreasureEvent = treasureKeywords.some(k => combinedTextForProgress.includes(k)) && 
                               treasureResolutionKeywords.some(k => combinedTextForProgress.includes(k));
      
      if (hasTreasureEvent && !combatCompleted && !hasTrapEvent && !hasPuzzleEvent && !hasDiscoveryEvent) {
        updatedAdventureProgress = {
          ...updatedAdventureProgress,
          encounters: {
            ...updatedAdventureProgress.encounters,
            treasure: (updatedAdventureProgress.encounters?.treasure || 0) + 1,
            total: (updatedAdventureProgress.encounters?.total || 0) + 1
          }
        };
        console.log("Treasure collected - incrementing counter:", updatedAdventureProgress.encounters);
      }
      
      // Track turns in chapter for time-based progression
      const previousTurnsInChapter = currentStoryState.turnsInChapter || 0;
      const turnsInChapter = previousTurnsInChapter + 1;
      
      // CRITICAL: Preserve existing combatants if in combat - don't let AI rename enemies
      // BUT: Use combatEffects.enemyDamage as the source of truth for HP updates
      let preservedCombatants = storyAdvancement.storyState?.combatants;
      const wasInCombatBefore = currentStoryState.inCombat;
      
      // Build a map of defeated enemies from combatEffects.enemyDamage (most accurate source)
      // CRITICAL: Use damageTaken to CALCULATE new HP from saved state, don't trust AI's newHp
      // The AI often miscalculates cumulative HP across turns (e.g., reports newHp from maxHp instead of currentHp)
      const defeatedEnemyNames = new Set<string>();
      const enemyDamageMap = new Map<string, { damageTaken: number; aiNewHp: number; maxHp: number }>();
      
      if (combatEffects?.enemyDamage) {
        for (const enemy of combatEffects.enemyDamage) {
          if (enemy.defeated || enemy.newHp <= 0) {
            defeatedEnemyNames.add(enemy.name);
            console.log(`[Combat Debug] Enemy ${enemy.name} marked as defeated in enemyDamage`);
          } else {
            enemyDamageMap.set(enemy.name, { 
              damageTaken: enemy.damageTaken || 0,
              aiNewHp: enemy.newHp,
              maxHp: enemy.maxHp || 0
            });
          }
        }
      }
      
      if (currentStoryState.inCombat && currentStoryState.combatants?.length > 0) {
        const advancementCombatants = storyAdvancement.storyState?.combatants || [];
        
        console.log(`[Combat Debug] Merging combatants: ${currentStoryState.combatants.length} existing, ${advancementCombatants.length} from advancement, ${defeatedEnemyNames.size} defeated`);
        
        preservedCombatants = currentStoryState.combatants.map((existingEnemy: any) => {
          // Check if this enemy was defeated in this turn (from enemyDamage)
          if (defeatedEnemyNames.has(existingEnemy.name)) {
            console.log(`[Combat Debug] ${existingEnemy.name}: DEFEATED - removing from combatants`);
            return { ...existingEnemy, currentHp: 0, status: 'defeated' };
          }
          
          // Check if this enemy has damage from enemyDamage — calculate HP from saved state
          const damageInfo = enemyDamageMap.get(existingEnemy.name);
          if (damageInfo) {
            const savedHp = existingEnemy.currentHp ?? existingEnemy.maxHp ?? 20;
            const calculatedHp = Math.max(0, savedHp - damageInfo.damageTaken);
            const maxHp = existingEnemy.maxHp || damageInfo.maxHp || 20;
            const hpStatus = calculatedHp <= 0 ? 'defeated' :
              calculatedHp <= (maxHp * 0.25) ? 'bloodied' :
              calculatedHp <= (maxHp * 0.5) ? 'wounded' : 'healthy';
            console.log(`[Combat Debug] ${existingEnemy.name}: HP ${savedHp} - ${damageInfo.damageTaken} damage = ${calculatedHp} (AI said ${damageInfo.aiNewHp}), status: ${hpStatus}`);
            if (calculatedHp <= 0) {
              defeatedEnemyNames.add(existingEnemy.name);
              return { ...existingEnemy, currentHp: 0, status: 'defeated' };
            }
            return { ...existingEnemy, currentHp: calculatedHp, status: hpStatus };
          }
          
          // Check if this enemy has updates in storyAdvancement
          // ONLY accept AI advancement HP if it's LOWER than saved HP (damage was dealt, not healed)
          const advancementEnemy = advancementCombatants.find(
            (ae: any) => ae.name === existingEnemy.name
          );
          if (advancementEnemy && advancementEnemy.currentHp !== undefined) {
            const savedHp = existingEnemy.currentHp ?? existingEnemy.maxHp ?? 20;
            if (advancementEnemy.currentHp < savedHp) {
              const maxHp = existingEnemy.maxHp || advancementEnemy.maxHp || 20;
              const hpStatus = advancementEnemy.currentHp <= 0 ? 'defeated' :
                advancementEnemy.currentHp <= (maxHp * 0.25) ? 'bloodied' :
                advancementEnemy.currentHp <= (maxHp * 0.5) ? 'wounded' : 'healthy';
              console.log(`[Combat Debug] ${existingEnemy.name}: HP ${savedHp} -> ${advancementEnemy.currentHp} (from advancement, accepted as lower)`);
              if (advancementEnemy.currentHp <= 0) {
                defeatedEnemyNames.add(existingEnemy.name);
                return { ...existingEnemy, currentHp: 0, status: 'defeated' };
              }
              return { ...existingEnemy, currentHp: advancementEnemy.currentHp, status: hpStatus };
            } else {
              console.log(`[Combat Debug] ${existingEnemy.name}: AI advancement HP ${advancementEnemy.currentHp} >= saved HP ${savedHp} — REJECTING (would heal enemy)`);
            }
          }
          
          return existingEnemy;
        }).filter((e: any) => e.status !== 'defeated' && (e.currentHp === undefined || e.currentHp > 0));
        
        console.log(`[Combat Debug] After filtering: ${preservedCombatants.length} active combatants remain`);
        
        // Check if all enemies are defeated - if so, end combat
        const remainingEnemies = preservedCombatants.filter((c: any) => c.type === 'enemy' || c.type === 'boss');
        if (remainingEnemies.length === 0 && wasInCombatBefore) {
          console.log(`[Combat Debug] All enemies defeated during merge - ending combat`);
          if (!storyAdvancement.storyState) storyAdvancement.storyState = {};
          storyAdvancement.storyState.inCombat = false;
          combatCompleted = true;
        }
      }
      
      // Merge the new exploration limit with the AI-generated story state
      console.log(`[Combat Debug] Final preservedCombatants before merge:`, JSON.stringify(preservedCombatants?.map((c: any) => ({ name: c.name, currentHp: c.currentHp, status: c.status })) || []));
      
      // CRITICAL: Enforce correct status based on HP for all combatants
      // This fixes cases where AI returns incorrect status (e.g., "healthy" with 2/30 HP)
      if (preservedCombatants && Array.isArray(preservedCombatants)) {
        preservedCombatants = preservedCombatants.map((c: any) => {
          const hp = c.currentHp ?? c.maxHp ?? 20;
          const maxHp = c.maxHp ?? 20;
          const hpRatio = hp / maxHp;
          
          let correctStatus: string;
          if (hp <= 0) {
            correctStatus = 'defeated';
          } else if (hpRatio <= 0.25) {
            correctStatus = 'bloodied';
          } else if (hpRatio <= 0.5) {
            correctStatus = 'wounded';
          } else {
            correctStatus = 'healthy';
          }
          
          if (c.status !== correctStatus) {
            console.log(`[Combat Debug] Correcting ${c.name} status: ${c.status} -> ${correctStatus} (HP: ${hp}/${maxHp})`);
          }
          
          return { ...c, currentHp: hp, maxHp, status: correctStatus };
        }).filter((c: any) => c.status !== 'defeated' && (c.currentHp === undefined || c.currentHp > 0));
        
        // Check if all enemies defeated after status correction
        const remainingEnemiesAfterCorrection = preservedCombatants.filter(
          (c: any) => c.type === 'enemy' || c.type === 'boss'
        );
        if (remainingEnemiesAfterCorrection.length === 0 && wasInCombatBefore) {
          console.log(`[Combat Debug] All enemies defeated after status correction - ending combat`);
          if (!storyAdvancement.storyState) storyAdvancement.storyState = {};
          storyAdvancement.storyState.inCombat = false;
          combatCompleted = true;
        }
      }
      
      // Track scenes since last combat — reset to 0 when combat occurs, increment otherwise
      const resolvedSceneType = storyAdvancement.sceneType || (storyAdvancement.storyState?.inCombat ? 'Combat' : null);
      const newScenesSinceCombat = (resolvedSceneType === 'Combat' || storyAdvancement.storyState?.inCombat) 
        ? 0 
        : (scenesSinceCombat + 1);
      
      // ═══════════════════════════════════════════════════════════════════
      // SESSION 1 RETENTION — Merge tracking data from AI response
      // ═══════════════════════════════════════════════════════════════════
      const aiRetention = storyAdvancement.session1Retention || {};
      const updatedSession1Retention = isSession1 ? {
        growthObservations: [
          ...(session1Retention.growthObservations || []),
          ...(aiRetention.growthObservations || [])
        ].slice(-10),
        toolArc: aiRetention.toolArc?.toolName ? {
          toolName: aiRetention.toolArc.toolName,
          competenceLevel: aiRetention.toolArc.competenceLevel || 'clumsy',
          narrativeNote: aiRetention.toolArc.narrativeNote || null,
          firstUseScene: session1Retention.toolArc?.firstUseScene || session1SceneCount,
          improvedUseScene: (aiRetention.toolArc.competenceLevel === 'competent' || aiRetention.toolArc.competenceLevel === 'learning')
            ? session1SceneCount : session1Retention.toolArc?.improvedUseScene
        } : session1Retention.toolArc,
        deferredConsequences: [
          ...(session1Retention.deferredConsequences || []),
          ...(aiRetention.deferredConsequences || [])
        ].slice(-5),
        identityFormation: aiRetention.identityFormation || session1Retention.identityFormation,
        sceneCount: session1SceneCount + 1,
        quietReckoningTriggered: session1Retention.quietReckoningTriggered
      } : session1Retention;
      
      // Track combat round count: increment when in combat, reset when combat ends
      const isInCombatNow = storyAdvancement.storyState?.inCombat || false;
      const newCombatRoundCount = isInCombatNow ? (currentCombatRounds + 1) : 0;
      
      const mergedStoryState = {
        ...storyAdvancement.storyState,
        combatants: preservedCombatants,
        explorationLimit: newExplorationLimit,
        startPosition: currentStoryState.startPosition || { x: 4, y: 4 },
        journeyLog: updatedJourneyLog,
        adventureProgress: updatedAdventureProgress,
        adventureRequirements: currentStoryState.adventureRequirements,
        movesWithoutStory: 0,
        turnsInChapter,
        combatRoundCount: newCombatRoundCount,
        scenesSinceCombat: newScenesSinceCombat,
        lastMovement: movement?.occurred ? {
          direction: movement.direction,
          description: movement.description,
          timestamp: new Date().toISOString()
        } : currentStoryState.lastMovement,
        session1Retention: updatedSession1Retention,
        momentousChoices: currentStoryState.momentousChoices || [],
        sessionBreakpoint: storyAdvancement.sessionBreakpoint || false
      };
      
      // ═══════════════════════════════════════════════════════════════════
      // MOMENTOUS CHOICE TRACKING — Record permanent, campaign-defining decisions
      // ═══════════════════════════════════════════════════════════════════
      if (storyAdvancement.momentousChoiceResolution) {
        const mcr = storyAdvancement.momentousChoiceResolution;
        const existingMomentous = mergedStoryState.momentousChoices || [];
        
        const isDuplicate = existingMomentous.some((mc: any) => 
          mc.choice.toLowerCase().includes(mcr.choice?.toLowerCase()?.substring(0, 20)) ||
          mcr.choice?.toLowerCase()?.includes(mc.choice?.toLowerCase()?.substring(0, 20))
        );
        
        if (!isDuplicate && mcr.choice && mcr.consequence) {
          const newMomentousChoice = {
            choice: mcr.choice,
            consequence: mcr.consequence,
            worldChange: mcr.worldChange || "The world has shifted",
            powersGranted: mcr.powersGranted || null,
            reputationEffect: mcr.reputationEffect || null,
            scene: allCampaignSessions.length,
            timestamp: new Date().toISOString(),
            isCampaignTerminus: mcr.isCampaignTerminus || false
          };
          
          mergedStoryState.momentousChoices = [...existingMomentous, newMomentousChoice];
          console.log(`[Momentous Choice] Recorded: "${mcr.choice}" for campaign ${campaignId}`);
          
          if (mcr.isCampaignTerminus && !campaign.isCompleted) {
            console.log(`[Campaign Terminus] Momentous choice triggered campaign terminus for campaign ${campaignId}`);
            storyAdvancement.isCampaignFinale = true;
            storyAdvancement.endingType = `momentous_${mcr.choice.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 30)}`;
          }
        }
      }
      
      // When combat is completed, clear all combatants so stale data doesn't persist
      if (combatCompleted) {
        console.log(`[Combat Debug] Combat completed — clearing combatants array`);
        mergedStoryState.combatants = [];
        mergedStoryState.inCombat = false;
        mergedStoryState.combatRoundCount = 0;
      } else {
        // CRITICAL: If there are still living enemy combatants, force inCombat to stay true
        // The AI sometimes incorrectly sets inCombat: false while enemies are still alive
        const livingEnemiesInMerged = (preservedCombatants || []).filter(
          (c: any) => (c.type === 'enemy' || c.type === 'boss') && c.status !== 'defeated' && (c.currentHp === undefined || c.currentHp > 0)
        );
        if (livingEnemiesInMerged.length > 0) {
          if (!mergedStoryState.inCombat) {
            console.log(`[Combat Debug] Forcing inCombat=true: ${livingEnemiesInMerged.length} living enemies still present`);
          }
          mergedStoryState.inCombat = true;
        } else if (!mergedStoryState.inCombat && wasInCombatBefore) {
          // Combat ended naturally (AI set inCombat: false and no living enemies) — clear combatants
          console.log(`[Combat Debug] Combat ended naturally — clearing combatants array`);
          mergedStoryState.combatants = [];
          mergedStoryState.combatRoundCount = 0;
        }
      }
      
      // Add movement choices if not in combat
      let finalChoices = storyAdvancement.choices || [];
      const inCombat = mergedStoryState.inCombat;
      
      // CRITICAL: Ensure ALL player characters and companions are in partyMembers during combat
      if (inCombat) {
        // Ensure partyMembers array exists
        if (!mergedStoryState.partyMembers) {
          mergedStoryState.partyMembers = [];
        }
        
        // Get ALL campaign participants (could be multiple players in multiplayer)
        const participants = await storage.getCampaignParticipants(campaignId);
        if (participants && participants.length > 0) {
          for (const participant of participants) {
            const character = await storage.getCharacter(participant.characterId);
            if (character) {
              // Check if this player is already in partyMembers
              const alreadyInParty = (mergedStoryState.partyMembers as any[]).some(
                (m: any) => m.name === character.name || (m.type === 'player' && m.characterId === character.id)
              );
              
              if (!alreadyInParty) {
                // Add player character to partyMembers
                const playerStatus = character.hitPoints <= 0 ? 'unconscious' :
                  character.hitPoints <= (character.maxHitPoints * 0.25) ? 'bloodied' :
                  character.hitPoints <= (character.maxHitPoints * 0.5) ? 'wounded' : 'healthy';
                
                (mergedStoryState.partyMembers as any[]).unshift({
                  characterId: character.id,
                  name: character.name,
                  type: 'player',
                  class: character.class,
                  maxHp: character.maxHitPoints,
                  currentHp: character.hitPoints,
                  ac: 10 + Math.floor((character.dexterity - 10) / 2),
                  status: playerStatus
                });
                console.log(`Added player ${character.name} to partyMembers for combat display`);
              }
            }
          }
        }
        
        // Also ensure NPC companions from campaign_npcs are in partyMembers
        const campaignNpcs = await storage.getCampaignNpcs(campaignId);
        for (const cn of campaignNpcs) {
          if (cn.npcId) {
            const npc = await storage.getNpc(cn.npcId);
            // Check isCompanion on the NPC record, not on campaign_npcs
            if (npc && npc.isCompanion) {
              // Check if companion is already in partyMembers with flexible name matching
              // (AI might use shortened names like "Grimshaw" for "Grimshaw the Guardian")
              const npcNameLower = npc.name.toLowerCase();
              const npcFirstName = npc.name.split(' ')[0].toLowerCase();
              const companionInParty = (mergedStoryState.partyMembers as any[]).some(
                (m: any) => {
                  const memberNameLower = (m.name || '').toLowerCase();
                  return memberNameLower === npcNameLower || 
                         memberNameLower.includes(npcFirstName) ||
                         npcNameLower.includes(memberNameLower.split(' ')[0]);
                }
              );
              if (!companionInParty) {
                const compStatus = (cn.currentHp || 0) <= 0 ? 'unconscious' :
                  (cn.currentHp || 0) <= ((cn.maxHp || 20) * 0.25) ? 'bloodied' :
                  (cn.currentHp || 0) <= ((cn.maxHp || 20) * 0.5) ? 'wounded' : 'healthy';
                
                (mergedStoryState.partyMembers as any[]).push({
                  name: npc.name,
                  type: 'companion',
                  class: npc.class || 'Warrior',
                  maxHp: cn.maxHp || 20,
                  currentHp: cn.currentHp || cn.maxHp || 20,
                  ac: 12,
                  status: compStatus
                });
                console.log(`Added companion ${npc.name} to partyMembers for combat display`);
              }
            }
          }
        }
      }
      
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
      console.log(`[Combat Debug] Saving session with combatants:`, JSON.stringify(mergedStoryState.combatants?.map((c: any) => ({ name: c.name, currentHp: c.currentHp, status: c.status })) || []));
      
      const actionLogEntries: any[] = [];
      const nowTs = new Date().toISOString();
      
      if (choice) {
        actionLogEntries.push({
          type: 'player_action',
          timestamp: nowTs,
          text: choice,
          rollResult: rollResult || null,
          sceneType: storyAdvancement.sceneType || (mergedStoryState?.inCombat ? 'Combat' : 'Exploration'),
        });
      }
      
      if (storyAdvancement.narrative) {
        actionLogEntries.push({
          type: 'narrative',
          timestamp: nowTs,
          text: storyAdvancement.narrative,
          sceneType: storyAdvancement.sceneType || (mergedStoryState?.inCombat ? 'Combat' : 'Exploration'),
        });
      }
      
      if (storyAdvancement.combatResults && Array.isArray(storyAdvancement.combatResults)) {
        for (const cr of storyAdvancement.combatResults) {
          actionLogEntries.push({
            type: 'combat',
            timestamp: nowTs,
            attacker: cr.attacker,
            target: cr.target,
            attackRoll: cr.attackRoll,
            isHit: cr.isHit,
            damage: cr.damage,
            description: cr.description || `${cr.attacker} attacks ${cr.target}`,
          });
        }
      }
      
      let updatedSession = await storage.advanceSessionStory(campaignId, {
        narrative: storyAdvancement.narrative,
        dmNarrative: storyAdvancement.dmNarrative,
        choices: finalChoices,
        storyState: mergedStoryState,
        npcInteractions: storyAdvancement.npcInteractions,
        sceneType: storyAdvancement.sceneType || (mergedStoryState?.inCombat ? 'Combat' : 'Exploration'),
        actionLogEntries,
        playerChoicesMade: [...(currentSession.playerChoicesMade || []), {
          choice,
          rollResult,
          timestamp: new Date().toISOString(),
          consequences: storyAdvancement.consequencesOfChoice,
          xpAwarded,
          itemsFound
        }]
      });
      
      console.log(`[Advance Story] Session ${updatedSession?.id} updated successfully - new narrative length: ${updatedSession?.narrative?.length || 0}`);

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
            const allWorldLocations = await storage.getWorldLocations();
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
          
          // === D&D Combat Manager Integration ===
          // Process combat with transparent mechanics for educational purposes
          let detailedCombatLogs: CombatLogEntry[] = [];
          let enhancedPartyDamage: { name: string; damageTaken: number; newHp: number; maxHp: number; defeated: boolean; attackRoll?: any; targetAC?: number; mechanicsBreakdown?: string }[] = [];
          
          // Declare variables outside combat block so they're accessible in re-save logic
          let companionCombatants: Combatant[] = [];
          let isWeaponAttack = false;
          let companionAttackResult: CombatTurnResult | null = null;
          
          // ALWAYS fetch companions when in combat (not just when combatEffects exists)
          // This ensures companion attacks are processed even if AI doesn't return combatEffects
          // CRITICAL: Check BOTH the AI response AND the merged state — AI may omit inCombat
          // from its response even though combat is still ongoing (mergedStoryState preserves it)
          const isInCombat = storyAdvancement.storyState?.inCombat === true || mergedStoryState.inCombat === true;
          
          // Get companion NPCs for this campaign - needed for combat processing
          const campaignNpcs = await storage.getCampaignNpcs(campaignId);
          const npcDetails = await Promise.all(
            campaignNpcs.map(async (cn) => {
              const npc = await storage.getNpc(cn.npcId);
              return { campaignNpc: cn, npc };
            })
          );
          
          // Build combatant list from companions (include 'ally' role as well)
          companionCombatants = npcDetails
            .filter(({ npc, campaignNpc }) => npc && campaignNpc.isActive && (campaignNpc.role === 'companion' || campaignNpc.role === 'ally'))
            .map(({ npc, campaignNpc }) => {
              const defaultStats = getCompanionDefaultStats(npc!.class || 'Fighter', 1);
              return {
                id: campaignNpc.id,
                name: npc!.name,
                type: 'companion' as const,
                currentHp: campaignNpc.currentHp ?? npc!.hitPoints ?? defaultStats.maxHp,
                maxHp: campaignNpc.maxHp ?? npc!.maxHitPoints ?? defaultStats.maxHp,
                armorClass: campaignNpc.armorClass ?? npc!.armorClass ?? defaultStats.armorClass,
                attackBonus: campaignNpc.attackBonus ?? defaultStats.attackBonus,
                damageRoll: campaignNpc.damageRoll ?? defaultStats.damageRoll,
                status: (campaignNpc.status as 'conscious' | 'unconscious' | 'dead' | 'stabilized') || 'conscious',
                class: npc!.class || undefined
              };
            });
          
          // Build enemy list from mergedStoryState combatants (which includes rollResult damage)
          // This ensures we use the most up-to-date HP values after player attacks
          const storyEnemies = mergedStoryState?.combatants || storyAdvancement.storyState?.combatants || [];
          const enemyCombatants: Combatant[] = storyEnemies
            .filter((e: any) => (e.type === 'enemy' || e.type === 'boss') && e.status !== 'defeated' && (e.currentHp > 0 || e.currentHp === undefined))
            .map((e: any, index: number) => ({
              id: index + 1000,
              name: e.name,
              type: 'enemy' as const,
              currentHp: e.currentHp ?? e.maxHp ?? 20,
              maxHp: e.maxHp ?? 20,
              armorClass: e.ac ?? 12,
              attackBonus: e.attackBonus ?? 3,
              damageRoll: e.damage || '1d6+2',
              status: (e.currentHp !== undefined && e.currentHp <= 0) ? 'unconscious' as const : 'conscious' as const
            }));
          
          if (combatEffects) {
            damageTaken = combatEffects.playerDamageTaken || 0;
            damageDealt = combatEffects.playerDamageDealt || 0;
          }
          
          // Process enemy attacks against party (player + companions) - check inCombat regardless of combatEffects
          console.log(`Combat processing check: isInCombat=${isInCombat} (AI=${storyAdvancement.storyState?.inCombat}, merged=${mergedStoryState.inCombat}), enemyCount=${enemyCombatants.length}, companionCount=${companionCombatants.length}, aiCombatEffects=${!!combatEffects}`);
          if (enemyCombatants.length > 0 && isInCombat) {
              // Fetch equipment stats for the character to calculate combat stats
              const equippedItemNames: string[] = [];
              if ((character as any).equippedWeapon) equippedItemNames.push((character as any).equippedWeapon);
              if ((character as any).equippedArmor) equippedItemNames.push((character as any).equippedArmor);
              if ((character as any).equippedShield) equippedItemNames.push((character as any).equippedShield);
              
              // Look up item stats from database
              const itemStatsMap: Record<string, ItemStats | undefined> = {};
              for (const itemName of equippedItemNames) {
                const item = await storage.getItemByName(itemName);
                if (item) {
                  itemStatsMap[itemName] = {
                    name: item.name,
                    type: item.type,
                    damageDice: item.damageDice || undefined,
                    damageType: item.damageType || undefined,
                    attackBonus: item.attackBonus || undefined,
                    magicBonus: item.magicBonus || undefined,
                    baseAC: item.baseAC || undefined,
                    armorType: item.armorType || undefined,
                    properties: item.properties || undefined
                  };
                }
              }
              
              // Calculate effective combat stats using D&D 5e rules
              const combatStats = calculateEffectiveCombatStats({
                level: character.level,
                strength: character.strength,
                dexterity: character.dexterity,
                constitution: character.constitution,
                equippedWeapon: (character as any).equippedWeapon,
                equippedArmor: (character as any).equippedArmor,
                equippedShield: (character as any).equippedShield,
                class: character.class
              }, itemStatsMap);
              
              // Add player to party members for combat with equipment-derived stats
              const playerCombatant: Combatant = {
                id: character.id,
                name: character.name,
                type: 'player',
                currentHp: character.hitPoints,
                maxHp: character.maxHitPoints,
                armorClass: combatStats.armorClass,
                attackBonus: combatStats.attackBonus,
                damageRoll: combatStats.damageRoll,
                status: 'conscious',
                level: character.level
              };
              
              const partyMembers = [playerCombatant, ...companionCombatants];
              
              // Use CombatManager to resolve enemy attacks with proper D&D mechanics
              const combatResult = processEnemyAttacks(enemyCombatants, partyMembers);
              detailedCombatLogs = combatResult.logs;
              
              // PLAYER WEAPON ATTACK: Process server-side when choice is a weapon attack
              // Only triggers when: no rollResult damage (magic items/spells handle that),
              // AI didn't already report enemy damage, and rollResult looks like an attack roll
              const aiAlreadyReportedDamage = combatEffects?.enemyDamage?.length > 0;
              isWeaponAttack = !rollResult?.damage && !rollResult?.type && 
                !aiAlreadyReportedDamage &&
                choice && /\b(attack|strike|slash|stab|swing)\b/i.test(choice) && 
                enemyCombatants.length > 0;
              
              if (isWeaponAttack) {
                // Find the target enemy from choice text or use the first active enemy
                const activeEnemies = enemyCombatants.filter(e => e.status === 'conscious' && e.currentHp > 0);
                if (activeEnemies.length > 0) {
                  // Try to match enemy name from choice text
                  let targetEnemy = activeEnemies.find(e => 
                    choice.toLowerCase().includes(e.name.toLowerCase())
                  ) || activeEnemies[0];
                  
                  const playerAttackResult = processPlayerAttack(playerCombatant, targetEnemy);
                  detailedCombatLogs = [playerAttackResult.log, ...detailedCombatLogs];
                  
                  // Update enemy combatant with damage
                  const targetIdx = enemyCombatants.findIndex(e => e.name === targetEnemy.name);
                  if (targetIdx !== -1) {
                    enemyCombatants[targetIdx] = playerAttackResult.updatedTarget;
                  }
                  
                  // Add to combatEffects.enemyDamage and update mergedStoryState
                  if (playerAttackResult.log.isHit && playerAttackResult.log.damage) {
                    const dmg = playerAttackResult.log.damage;
                    const updTarget = playerAttackResult.updatedTarget;
                    
                    if (!combatEffects) {
                      storyAdvancement.combatEffects = { enemyDamage: [] };
                    }
                    const cePlayer = storyAdvancement.combatEffects || {};
                    if (!cePlayer.enemyDamage) cePlayer.enemyDamage = [];
                    
                    const existingPlayerDmg = cePlayer.enemyDamage.find((e: any) => e.name === targetEnemy.name);
                    if (existingPlayerDmg) {
                      existingPlayerDmg.damageTaken = (existingPlayerDmg.damageTaken || 0) + dmg.total;
                      existingPlayerDmg.newHp = updTarget.currentHp;
                      existingPlayerDmg.defeated = updTarget.currentHp <= 0;
                    } else {
                      cePlayer.enemyDamage.push({
                        name: targetEnemy.name,
                        cr: (targetEnemy as any).cr || "1/4",
                        damageTaken: dmg.total,
                        newHp: updTarget.currentHp,
                        maxHp: targetEnemy.maxHp,
                        defeated: updTarget.currentHp <= 0
                      });
                    }
                    storyAdvancement.combatEffects = cePlayer;
                    
                    // Update mergedStoryState combatants
                    const mergedTarget = (mergedStoryState.combatants as any[])?.find((c: any) => c.name === targetEnemy.name);
                    if (mergedTarget) {
                      mergedTarget.currentHp = updTarget.currentHp;
                      mergedTarget.status = updTarget.currentHp <= 0 ? 'defeated' : 
                        updTarget.currentHp <= (targetEnemy.maxHp * 0.25) ? 'bloodied' :
                        updTarget.currentHp <= (targetEnemy.maxHp * 0.5) ? 'wounded' : 'healthy';
                    }
                    
                    console.log(`[Player Attack] ${playerCombatant.name} hits ${targetEnemy.name} for ${dmg.total} damage: HP ${targetEnemy.currentHp} -> ${updTarget.currentHp}`);
                  } else {
                    console.log(`[Player Attack] ${playerCombatant.name} misses ${targetEnemy.name}`);
                  }
                }
              }
              
              // Process companion attacks against enemies (companions auto-attack!)
              companionAttackResult = processCompanionAttacks(companionCombatants, enemyCombatants);
              
              // Merge companion attack logs into detailed combat logs
              detailedCombatLogs = [...detailedCombatLogs, ...companionAttackResult.logs];
              
              // Update enemy combatants with damage from companion attacks
              for (const damageEntry of companionAttackResult.enemyDamageDealt) {
                const enemyIndex = enemyCombatants.findIndex(e => e.name === damageEntry.name);
                if (enemyIndex !== -1) {
                  enemyCombatants[enemyIndex] = {
                    ...enemyCombatants[enemyIndex],
                    currentHp: damageEntry.newHp,
                    status: damageEntry.newHp <= 0 ? 'unconscious' : 'conscious'
                  };
                }
                
                // Also update the story state combatants if present
                const storyCombatant = storyAdvancement.storyState?.combatants?.find((c: any) => c.name === damageEntry.name);
                if (storyCombatant) {
                  storyCombatant.currentHp = damageEntry.newHp;
                  if (damageEntry.defeated) {
                    storyCombatant.defeated = true;
                  }
                }
                
                // CRITICAL: Add companion damage to combatEffects.enemyDamage so it's included in response
                if (!combatEffects) {
                  storyAdvancement.combatEffects = { enemyDamage: [] };
                }
                const ce = storyAdvancement.combatEffects || {};
                if (!ce.enemyDamage) ce.enemyDamage = [];
                const existingEnemyEntry = ce.enemyDamage.find((e: any) => e.name === damageEntry.name);
                if (existingEnemyEntry) {
                  existingEnemyEntry.damageTaken = (existingEnemyEntry.damageTaken || 0) + damageEntry.damageTaken;
                  existingEnemyEntry.newHp = damageEntry.newHp;
                  existingEnemyEntry.defeated = damageEntry.defeated;
                } else {
                  ce.enemyDamage.push({
                    name: damageEntry.name,
                    cr: damageEntry.cr || "1/4",
                    damageTaken: damageEntry.damageTaken,
                    newHp: damageEntry.newHp,
                    maxHp: damageEntry.maxHp,
                    defeated: damageEntry.defeated
                  });
                }
                storyAdvancement.combatEffects = ce;
                
                // CRITICAL: Update mergedStoryState.combatants with companion damage
                // The session was already saved before combat processing, so we need to keep mergedStoryState in sync
                const mergedCombatant = (mergedStoryState.combatants as any[])?.find((c: any) => c.name === damageEntry.name);
                if (mergedCombatant) {
                  mergedCombatant.currentHp = damageEntry.newHp;
                  if (damageEntry.defeated) {
                    mergedCombatant.status = 'defeated';
                  } else {
                    const maxHp = mergedCombatant.maxHp || 1;
                    const hpRatio = damageEntry.newHp / maxHp;
                    mergedCombatant.status = hpRatio <= 0.25 ? 'bloodied' : hpRatio <= 0.5 ? 'wounded' : 'healthy';
                  }
                  console.log(`[Companion Attack] Updated mergedStoryState for ${damageEntry.name}: HP -> ${damageEntry.newHp}, status: ${mergedCombatant.status}`);
                }
              }
              
              // Apply damage to player from combat result
              const playerDamageEntry = combatResult.partyDamageDealt.find(p => p.name === character.name);
              if (playerDamageEntry) {
                damageTaken = playerDamageEntry.damageTaken;
              }
              
              // Apply damage to companions and update database
              console.log(`Combat result - partyDamageDealt:`, JSON.stringify(combatResult.partyDamageDealt));
              for (const damageEntry of combatResult.partyDamageDealt) {
                console.log(`Processing damage for: ${damageEntry.name}, isCompanion: ${damageEntry.isCompanion}, damage: ${damageEntry.damageTaken}`);
                // Find the companion in our list
                const companionMatch = npcDetails.find(({ npc }) => npc?.name === damageEntry.name);
                if (companionMatch && companionMatch.campaignNpc) {
                  const cn = companionMatch.campaignNpc;
                  const newStatus = damageEntry.newHp <= 0 ? 'unconscious' : 'conscious';
                  
                  console.log(`Updating companion ${damageEntry.name} (campaign_npc id=${cn.id}): HP ${cn.currentHp} -> ${damageEntry.newHp}`);
                  
                  // Update companion HP in database
                  await db.execute(sql`
                    UPDATE campaign_npcs 
                    SET current_hp = ${damageEntry.newHp}, 
                        status = ${newStatus}
                    WHERE id = ${cn.id}
                  `);
                  console.log(`Database update complete for companion ${damageEntry.name}`);
                  
                  // Find the combat log for this companion to include mechanics
                  const logEntry = detailedCombatLogs.find(l => l.target === damageEntry.name);
                  
                  enhancedPartyDamage.push({
                    name: damageEntry.name,
                    damageTaken: damageEntry.damageTaken,
                    newHp: damageEntry.newHp,
                    maxHp: damageEntry.maxHp,
                    defeated: damageEntry.defeated,
                    attackRoll: logEntry?.attackRoll,
                    targetAC: logEntry?.targetAC,
                    mechanicsBreakdown: logEntry?.mechanicsBreakdown
                  });
                }
              }
            }
            
            // CRITICAL: Re-save session with updated combatant HP after combat processing
            // The initial save at advanceSessionStory happened BEFORE combat processing,
            // so any post-save changes (companion attacks, player weapon attacks, enemy state updates)
            // need to be persisted. Always re-save when in combat to ensure consistency.
            const hasCompanionDamage = companionAttackResult !== null && companionAttackResult.enemyDamageDealt.length > 0;
            const hasPlayerWeaponDamage = isWeaponAttack && storyAdvancement.combatEffects?.enemyDamage?.some((e: any) => e.damageTaken > 0);
            const hasCombatProcessing = isInCombat && enemyCombatants.length > 0;
            if (hasCompanionDamage || hasPlayerWeaponDamage || hasCombatProcessing) {
              console.log(`[Combat Re-save] Re-saving session - companion damage: ${hasCompanionDamage}, player weapon damage: ${hasPlayerWeaponDamage}, combat processing: ${hasCombatProcessing}`);
              // Filter out defeated enemies from mergedStoryState
              const activeCombatants = (mergedStoryState.combatants as any[])?.filter(
                (c: any) => c.status !== 'defeated' && (c.currentHp === undefined || c.currentHp > 0)
              ) || [];
              mergedStoryState.combatants = activeCombatants;
              
              // Check if all enemies defeated
              const remainingEnemies = activeCombatants.filter((c: any) => c.type === 'enemy' || c.type === 'boss');
              if (remainingEnemies.length === 0) {
                mergedStoryState.inCombat = false;
                console.log(`[Combat Re-save] All enemies defeated by companions - ending combat`);
              }
              
              const reSavedSession = await storage.advanceSessionStory(campaignId, {
                narrative: storyAdvancement.narrative,
                dmNarrative: storyAdvancement.dmNarrative,
                choices: updatedSession?.choices || storyAdvancement.choices || [],
                storyState: mergedStoryState,
                npcInteractions: storyAdvancement.npcInteractions,
                sceneType: storyAdvancement.sceneType || (mergedStoryState?.inCombat ? 'Combat' : 'Exploration'),
                actionLogEntries: [],
              });
              updatedSession = reSavedSession;
              console.log(`[Combat Re-save] Session re-saved with updated enemy HP`);
            }
            
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
          
          // Add found items to character - consumables go to consumables array, others to equipment
          const currentEquipment = character.equipment || [];
          const newEquipment = [...currentEquipment];
          const currentConsumables: any[] = (character as any).consumables || [];
          const newConsumables = [...currentConsumables];
          
          // Define consumable item patterns
          const consumablePatterns: Record<string, { type: string; healDice: string; healBonus: number; effect: string }> = {
            "healing potion": { type: "healing", healDice: "2d4", healBonus: 2, effect: "Restores 2d4+2 HP" },
            "potion of healing": { type: "healing", healDice: "2d4", healBonus: 2, effect: "Restores 2d4+2 HP" },
            "greater healing potion": { type: "healing", healDice: "4d4", healBonus: 4, effect: "Restores 4d4+4 HP" },
            "superior healing potion": { type: "healing", healDice: "8d4", healBonus: 8, effect: "Restores 8d4+8 HP" },
            "health potion": { type: "healing", healDice: "2d4", healBonus: 2, effect: "Restores 2d4+2 HP" },
          };
          
          for (const item of itemsFound) {
            if (!item.name) continue;
            
            const itemNameLower = item.name.toLowerCase();
            const consumableMatch = Object.entries(consumablePatterns).find(([pattern]) => 
              itemNameLower.includes(pattern)
            );
            
            if (consumableMatch || item.type === 'consumable') {
              // Add to consumables array
              const existingConsumable = newConsumables.find(c => c.name === item.name);
              if (existingConsumable) {
                existingConsumable.quantity = (existingConsumable.quantity || 1) + 1;
              } else {
                const consumableData = consumableMatch ? consumableMatch[1] : { type: "consumable", healDice: "", healBonus: 0, effect: item.description || "Use this item" };
                newConsumables.push({
                  name: item.name,
                  quantity: 1,
                  type: consumableData.type,
                  healDice: consumableData.healDice,
                  healBonus: consumableData.healBonus,
                  effect: consumableData.effect
                });
              }
            } else if (!newEquipment.includes(item.name)) {
              // Add to equipment for non-consumables
              newEquipment.push(item.name);
            }
          }
          
          const goldFromCombat = postCombatRewardsData?.goldAwarded || 0;
          const newGold = (character.gold || 0) + goldFromCombat;
          
          await storage.updateCharacter(characterId, {
            experience: newXP,
            level: newLevel,
            hitPoints: newHitPoints,
            maxHitPoints: newMaxHitPoints,
            gold: newGold,
            status: newStatus,
            deathSaveSuccesses,
            deathSaveFailures,
            equipment: newEquipment,
            consumables: newConsumables,
            skillProgress: updatedSkillProgress,
            updatedAt: new Date().toISOString()
          });
          
          // Record trace events for character progression
          if (xpAwarded > 0) {
            await recordTrace(campaignId, "state.set", {
              path: `character.${characterId}.experience`,
              value: newXP
            }, {
              sessionId: `session.${campaign.currentSession}`,
              who: `pc.${characterId}`,
              note: `Awarded ${xpAwarded} XP`
            });
          }
          
          if (leveledUp) {
            await recordTrace(campaignId, "dnd5e.levelUp", {
              actorId: `pc.${characterId}`,
              newLevel,
              class: character.class,
              hpGained: hpGainFromLevelUp
            }, {
              sessionId: `session.${campaign.currentSession}`,
              who: `pc.${characterId}`
            });
          }
          
          for (const item of itemsFound) {
            await recordTrace(campaignId, "item.gained", {
              itemId: item.name?.toLowerCase().replace(/\s+/g, '_') || 'unknown_item',
              by: `pc.${characterId}`,
              quantity: 1
            }, {
              sessionId: `session.${campaign.currentSession}`,
              who: `pc.${characterId}`
            });
          }
          
          if (statusChange) {
            if (statusChange === "dead") {
              await recordTrace(campaignId, "dnd5e.death", {
                actorId: `pc.${characterId}`,
                cause: "damage"
              }, {
                sessionId: `session.${campaign.currentSession}`,
                who: `pc.${characterId}`
              });
            } else if (statusChange === "stabilized") {
              await recordTrace(campaignId, "dnd5e.stabilized", {
                actorId: `pc.${characterId}`,
                method: "natural"
              }, {
                sessionId: `session.${campaign.currentSession}`,
                who: `pc.${characterId}`
              });
            }
          }
          
          characterProgression = {
            xpAwarded,
            goldAwarded: postCombatRewardsData?.goldAwarded || 0,
            newGold,
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
            postCombatRewards: postCombatRewardsData,
            // Return combat effects if we have combat data (from AI or from our internal processing)
            ...((() => { console.log(`[Combat Response] Sending combatEffects: aiEffects=${!!combatEffects}, isInCombat=${isInCombat}, logsCount=${detailedCombatLogs.length}, willSend=${!!(combatEffects || (isInCombat && detailedCombatLogs.length > 0))}`); return {}; })()),
            combatEffects: (combatEffects || (isInCombat && detailedCombatLogs.length > 0)) ? {
              damageTaken,
              damageDealt,
              newHitPoints,
              maxHitPoints: newMaxHitPoints,
              combatDescription: combatEffects?.combatDescription || (detailedCombatLogs.length > 0 ? "Combat continues!" : ""),
              enemyDamage: combatEffects?.enemyDamage || [],
              // Use enhanced party damage with D&D mechanics if available, else fallback
              partyDamage: enhancedPartyDamage.length > 0 ? enhancedPartyDamage : (combatEffects?.partyDamage || []),
              // Generate companion actions from combat logs (companions auto-attack in combat)
              companionActions: (() => {
                // Get AI-generated companion actions
                const aiActions = ((combatEffects?.companionActions) || []).filter((action: any) => {
                  const companion = companionCombatants.find(c => c.name === action.name);
                  if (companion && (companion.status === 'unconscious' || companion.status === 'dead' || companion.currentHp <= 0)) {
                    return false;
                  }
                  return true;
                });
                
                // Auto-generate actions from combat logs for companions that aren't in AI actions
                const companionLogsActions = detailedCombatLogs
                  .filter(log => log.attackerType === 'companion')
                  .map(log => ({
                    name: log.attacker,
                    action: log.isHit 
                      ? `attacks ${log.target}` 
                      : `swings at ${log.target} but misses`,
                    result: log.isHit && log.damage
                      ? `Hit for ${log.damage.total} damage${log.damage.isCritical ? ' (CRITICAL!)' : ''}`
                      : 'Missed',
                    damageDealt: log.damage?.total || 0,
                    mechanicsBreakdown: log.mechanicsBreakdown
                  }));
                
                // Merge: prefer combat log actions, add any AI actions for companions not in logs
                const companionNamesInLogs = new Set(companionLogsActions.map(a => a.name));
                const extraAiActions = aiActions.filter((a: any) => !companionNamesInLogs.has(a.name));
                
                return [...companionLogsActions, ...extraAiActions];
              })(),
              // NEW: Detailed combat logs with transparent D&D mechanics
              detailedCombatLogs: detailedCombatLogs.map(log => ({
                attacker: log.attacker,
                attackerType: log.attackerType,
                target: log.target,
                targetType: log.targetType,
                attackRoll: {
                  roll: log.attackRoll.roll,
                  modifier: log.attackRoll.modifier,
                  total: log.attackRoll.total,
                  isCritical: log.attackRoll.isCritical,
                  isCriticalMiss: log.attackRoll.isCriticalMiss
                },
                targetAC: log.targetAC,
                isHit: log.isHit,
                damage: log.damage ? {
                  diceRolls: log.damage.diceRolls,
                  diceType: log.damage.diceType,
                  modifier: log.damage.modifier,
                  total: log.damage.total,
                  isCritical: log.damage.isCritical
                } : null,
                targetNewHp: log.targetNewHp,
                targetMaxHp: log.targetMaxHp,
                targetStatus: log.targetStatus,
                description: log.description,
                mechanicsBreakdown: log.mechanicsBreakdown
              }))
            } : null
          };
        }
      }

      // Check for automatic session advancement based on story progress
      let sessionAdvanced = false;
      let newSessionData = null;
      
      // Calculate adventure completion from progress
      const adventureProgress = mergedStoryState.adventureProgress || {};
      const adventureRequirements = mergedStoryState.adventureRequirements || {};
      
      // Check completion conditions - evaluate FULL campaign state, not just this turn
      // Calculate detailed progress breakdown for frontend display
      const progressMetrics = adventureProgress.encounters || {};
      const requirementMetrics = adventureRequirements.encounters || {};
      
      // Combat encounters - lowered defaults for faster progression
      const combatRequired = requirementMetrics.combat || 2; // Default 2 combat encounters (was 3)
      const combatDone = progressMetrics.combat || 0;
      
      // Trap encounters - lowered for faster progression
      const trapRequired = requirementMetrics.trap || 1; // Default 1 trap encounter (was 2)
      const trapDone = progressMetrics.trap || 0;
      
      // Treasure encounters
      const treasureRequired = requirementMetrics.treasure || 1; // Default 1 treasure (was 2)
      const treasureDone = progressMetrics.treasure || 0;
      
      // Puzzles
      const puzzlesRequired = adventureRequirements.puzzles || 1; // Default 1 puzzle
      const puzzlesDone = adventureProgress.puzzles || 0;
      
      // Discoveries
      const discoveriesRequired = adventureRequirements.discoveries || 1; // Default 1 discovery (was 2)
      const discoveriesDone = adventureProgress.discoveries || 0;
      
      // Calculate totals (capped at required for percentage)
      const totalRequired = combatRequired + trapRequired + treasureRequired + puzzlesRequired + discoveriesRequired;
      const totalDone = Math.min(combatDone, combatRequired) + 
                        Math.min(trapDone, trapRequired) + 
                        Math.min(treasureDone, treasureRequired) + 
                        Math.min(puzzlesDone, puzzlesRequired) + 
                        Math.min(discoveriesDone, discoveriesRequired);
      
      // Calculate base goal progress percentage
      const baseProgressPercent = totalRequired > 0 ? Math.floor((totalDone / totalRequired) * 100) : 0;
      
      // Add turn-based progression bonus to make chapters advance faster
      // Soft caps: +10% at 10 turns, +20% at 20 turns, +35% at 30 turns, +50% at 40 turns
      const turnsThisChapter = mergedStoryState.turnsInChapter || 0;
      let turnBonus = 0;
      if (turnsThisChapter >= 40) turnBonus = 50;
      else if (turnsThisChapter >= 30) turnBonus = 35;
      else if (turnsThisChapter >= 20) turnBonus = 20;
      else if (turnsThisChapter >= 10) turnBonus = 10;
      else if (turnsThisChapter >= 5) turnBonus = 5;
      
      // Combined progress = goal progress + turn bonus (capped at 100%)
      const progressPercent = Math.min(100, baseProgressPercent + turnBonus);
      
      console.log(`Chapter progress: base=${baseProgressPercent}% + turnBonus=${turnBonus}% (${turnsThisChapter} turns) = ${progressPercent}%`);
      
      // Build chapter progress breakdown for frontend
      const chapterProgressBreakdown = {
        combat: { done: combatDone, required: combatRequired, complete: combatDone >= combatRequired },
        traps: { done: trapDone, required: trapRequired, complete: trapDone >= trapRequired },
        treasure: { done: treasureDone, required: treasureRequired, complete: treasureDone >= treasureRequired },
        puzzles: { done: puzzlesDone, required: puzzlesRequired, complete: puzzlesDone >= puzzlesRequired },
        discoveries: { done: discoveriesDone, required: discoveriesRequired, complete: discoveriesDone >= discoveriesRequired },
        totalPercent: progressPercent,
        totalDone,
        totalRequired,
        turnsInChapter: turnsThisChapter,
        turnBonus
      };
      
      const shouldAdvanceSession = (() => {
        // CRITICAL: NEVER advance session while in active combat with living enemies
        const combatants = mergedStoryState.combatants || [];
        const hasLivingEnemies = combatants.some((c: any) => 
          c.type === 'enemy' && c.status !== 'defeated' && (c.currentHp || 0) > 0
        );
        if (mergedStoryState.inCombat === true && hasLivingEnemies) {
          console.log(`Session advance BLOCKED: Active combat with ${combatants.filter((c: any) => c.type === 'enemy' && c.status !== 'defeated').length} living enemies`);
          return false;
        }
        
        // Get ALL active quests from story state (the full list, not just this turn's updates)
        const allQuests = mergedStoryState.activeQuests || [];
        
        // Condition 1: All required quests in story state are completed
        const allQuestsCompleted = allQuests.length > 0 && 
          allQuests.every((q: any) => q.status === 'completed');
        
        // Condition 2: Adventure progress at 100% (including turn bonus)
        const adventureComplete = progressPercent >= 100;
        
        // Condition 3: Major quest completed with decent progress (50%+)
        const majorQuestJustCompleted = completedQuests.some((q: any) => 
          q.title?.toLowerCase().includes('main') || 
          q.title?.toLowerCase().includes('boss') ||
          q.title?.toLowerCase().includes('final')
        );
        const progressThresholdMet = progressPercent >= 50; // Lowered from 75%
        const majorMilestone = majorQuestJustCompleted && progressThresholdMet;
        
        // Condition 4: Hard cap - after 50 turns, force chapter advancement if ANY progress made
        const hardCapReached = turnsThisChapter >= 50 && baseProgressPercent >= 20;
        
        // Condition 5: Soft cap - after 35 turns with 60%+ progress, advance
        const softCapReached = turnsThisChapter >= 35 && progressPercent >= 60;
        
        // Condition 6: Any quest completed with high turn count (30+ turns)
        const anyQuestWithHighTurns = completedQuests.length > 0 && turnsThisChapter >= 30;
        
        // NEW Condition 7: ALL GOALS MET - check if all required encounters are done
        const allGoalsMet = 
          combatDone >= combatRequired &&
          trapDone >= trapRequired &&
          treasureDone >= treasureRequired &&
          puzzlesDone >= puzzlesRequired &&
          discoveriesDone >= discoveriesRequired;
        
        console.log(`Session advance check: adventureComplete=${adventureComplete}, allQuestsCompleted=${allQuestsCompleted}, majorMilestone=${majorMilestone}, hardCap=${hardCapReached}, softCap=${softCapReached}, anyQuestHighTurns=${anyQuestWithHighTurns}, allGoalsMet=${allGoalsMet}`);
        
        // DM AUTHORING DOCTRINE: If chapter gates are defined, metrics-based advancement is disabled
        // Chapter advancement only happens via chapterGateMet from AI response (meaning-based gates)
        const hasChapterGates = ((campaign as any).chapterGates || []).length > 0;
        if (hasChapterGates) {
          console.log(`Session advance SKIPPED: Campaign has chapter gates — advancement is meaning-based only`);
          return false;
        }
        
        return adventureComplete || allQuestsCompleted || majorMilestone || hardCapReached || softCapReached || anyQuestWithHighTurns || allGoalsMet;
      })();
      
      if (shouldAdvanceSession) {
        try {
          // Get all completed quests from story state for the summary
          const allCompletedQuests = (mergedStoryState.activeQuests || [])
            .filter((q: any) => q.status === 'completed')
            .map((q: any) => q.title);
          
          // Get campaign details for AI-powered chapter generation
          const campaignForChapter = await storage.getCampaign(campaignId);
          if (!campaignForChapter) {
            throw new Error("Campaign not found for chapter generation");
          }
          
          // Get the campaign's ACTUAL total chapters (set at creation)
          const campaignTotalChapters = campaignForChapter.totalChapters || 4;
          
          // Check if ALL goals and quests are complete for early campaign completion
          const allGoalsComplete = 
            combatDone >= combatRequired &&
            trapDone >= trapRequired &&
            treasureDone >= treasureRequired &&
            puzzlesDone >= puzzlesRequired &&
            discoveriesDone >= discoveriesRequired;
          
          // Quest completion: either no quests exist OR all existing quests are completed
          const questsArray = (mergedStoryState.activeQuests || []) as any[];
          const allQuestsComplete = questsArray.length === 0 || 
            questsArray.every((q: any) => q.status === 'completed');
          
          const isFinalChapter = currentSession.sessionNumber >= campaignTotalChapters;
          // Early completion: all goals met AND (no quests OR all quests done) AND at least halfway through campaign
          const earlyCompletionTriggered = allGoalsComplete && allQuestsComplete && currentSession.sessionNumber >= Math.ceil(campaignTotalChapters * 0.5);
          
          // CRITICAL: Never complete a session while combat is active
          const isInActiveCombat = mergedStoryState.inCombat === true && 
            (mergedStoryState.combatants || []).some((c: any) => c.type === 'enemy' && c.status !== 'defeated' && (c.currentHp || 0) > 0);
          
          // === CAMPAIGN COMPLETE CONDITIONS ===
          // Complete if: on final chapter OR (all goals + all quests done AND at least halfway through)
          // BUT NEVER during active combat
          if ((isFinalChapter || earlyCompletionTriggered) && !isInActiveCombat) {
            console.log(`Campaign ${campaignId} COMPLETE! Session ${currentSession.sessionNumber} of ${campaignTotalChapters}. Reason: ${isFinalChapter ? 'Final chapter reached' : 'All goals & quests completed early'}`);

            
            // Mark the current session as completed
            await db
              .update(campaignSessions)
              .set({ isCompleted: true })
              .where(eq(campaignSessions.id, currentSession.id));
            
            // Generate difficulty-scaled completion rewards
            const r1DifficultyMultiplier = 
              (campaignForChapter as any).difficulty === 'Heroic' ? 2.0 :
              (campaignForChapter as any).difficulty === 'Challenging' ? 1.5 :
              (campaignForChapter as any).difficulty === 'Relaxed' ? 0.8 : 1.0;
            const completionXP = Math.round(campaignTotalChapters * 200 * r1DifficultyMultiplier);
            const goldReward = Math.round(campaignTotalChapters * 75 * r1DifficultyMultiplier);
            const silverReward = Math.round(campaignTotalChapters * 40 * r1DifficultyMultiplier);
            
            // Items will be generated by the main completion handler (themed reward items)
            const lootChestItems: any[] = [];
            
            // Record campaign completion trace
            await recordTrace(campaignId, "everdice.campaignCompleted", {
              totalChapters: campaignTotalChapters,
              completionXP,
              goldReward,
              silverReward,
              lootItems: lootChestItems.map(i => i.name)
            }, {
              sessionId: `session.${currentSession.sessionNumber}`,
              who: "system.dm"
            });
            
            // Set completion flag but DON'T advance to a new session
            sessionAdvanced = false;
            
            // Build character growth summary for post-campaign guidance
            const characterGrowth: {
              level: number;
              xpBefore: number;
              xpAfter: number;
              xpToNextLevel: number;
              goldTotal: number;
              skillsUsed: string[];
              chaptersCompleted: number;
              inventoryCount: number;
              campaignType: string;
            } = {
              level: character?.level || 1,
              xpBefore: character?.experience || 0,
              xpAfter: (character?.experience || 0) + completionXP,
              xpToNextLevel: (() => {
                const xpThresholds = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
                const currentLevel = character?.level || 1;
                const nextThreshold = xpThresholds[currentLevel] || 999999;
                return Math.max(0, nextThreshold - ((character?.experience || 0) + completionXP));
              })(),
              goldTotal: (character?.gold || 0) + goldReward,
              skillsUsed: Object.keys((character?.skillProgress as Record<string, any>) || {}),
              chaptersCompleted: campaignTotalChapters,
              inventoryCount: ((character?.inventory as any[]) || []).length + lootChestItems.length,
              campaignType: campaignForChapter.campaignLength || 'standard',
            };
            
            // Include completion data in response
            if (characterProgression) {
              characterProgression.campaignComplete = true;
              characterProgression.completionRewards = {
                xp: completionXP,
                gold: goldReward,
                silver: silverReward,
                items: lootChestItems,
                characterGrowth,
              };
            }
            
            // Skip the rest of session advancement - campaign is done!
            console.log(`Campaign completion rewards: ${completionXP} XP, ${goldReward} gold, ${lootChestItems.length} items`);
            
            // Return early from the advancement block
            throw { type: 'campaign_complete', rewards: { xp: completionXP, gold: goldReward, silver: silverReward, items: lootChestItems, characterGrowth } };
          }
          
          // Get all previous sessions to understand the story arc so far
          const previousSessions = await storage.getCampaignSessions(campaignId);
          const completedSessions = previousSessions.filter(s => s.isCompleted);
          
          // Build detailed story summaries including narrative content for AI context
          const previousChapterSummaries = completedSessions.map(s => ({
            chapter: s.sessionNumber,
            title: s.title,
            narrative: s.narrative?.slice(0, 400) || "Events unfolded...",
            location: (s.storyState as any)?.location || s.location || "Unknown"
          }));
          
          // Get the current chapter's narrative to provide full context
          const currentChapterNarrative = currentSession.narrative?.slice(0, 500) || "The adventure continues...";
          const currentLocation = (currentSession.storyState as any)?.location || currentSession.location || "Unknown";
          
          const nextChapterNumber = currentSession.sessionNumber + 1;
          
          // Use the campaign's actual total chapters, not estimated
          // But ensure we don't go past it
          const estimatedTotalChapters = campaignTotalChapters;
          
          // Only mark as climax/final if we've had enough story progression
          const isClimaxChapter = nextChapterNumber === estimatedTotalChapters - 1 && nextChapterNumber >= 3;
          const isNextChapterFinal = nextChapterNumber >= estimatedTotalChapters && nextChapterNumber >= 4;
          
          // Generate chapter content using AI
          const { client: openaiClientForChapter, model: chapterModel } = await getAIClient(req.user?.id);
          
          const chapterPrompt = `
You are an expert Dungeon Master. Generate the next chapter for this D&D campaign.

CAMPAIGN CONTEXT:
- Title: ${campaignForChapter.title}
- Description: ${campaignForChapter.description || "An epic adventure"}
- Narrative Style: ${campaignForChapter.narrativeStyle || "descriptive"}
- Difficulty: ${campaignForChapter.difficulty || "Normal"}

STORY SO FAR:
${previousChapterSummaries.length > 0 
  ? previousChapterSummaries.map(s => `
Chapter ${s.chapter} - "${s.title}" (Location: ${s.location}):
${s.narrative}
`).join('\n')
  : 'This is the start of the campaign.'}

CURRENT CHAPTER (just ending):
- Chapter ${currentSession.sessionNumber}: "${currentSession.title}"
- Location: ${currentLocation}
- Summary: ${currentChapterNarrative}
- Quests completed: ${allCompletedQuests.length > 0 ? allCompletedQuests.join(', ') : 'Various challenges overcome'}

NEXT CHAPTER:
- This will be Chapter ${nextChapterNumber} of approximately ${estimatedTotalChapters} chapters
${isClimaxChapter ? '- THIS IS THE CLIMAX CHAPTER - tension should build toward the final confrontation' : ''}
${isNextChapterFinal ? '- THIS IS THE FINAL CHAPTER - the campaign should reach its epic conclusion' : ''}

CHAPTER REQUIREMENTS:
${isNextChapterFinal ? `
- Generate the FINAL CHAPTER leading to campaign conclusion
- Title should reflect the climactic nature (e.g., "The Final Reckoning", "The Last Stand")
- Narrative should set up the ultimate confrontation or resolution
- Objectives should focus on defeating the main threat or achieving the ultimate goal
- Choices should lead to meaningful resolutions
` : isClimaxChapter ? `
- Generate a CLIMAX CHAPTER that raises stakes dramatically
- Title should reflect increasing danger (e.g., "Into the Heart of Darkness", "The Gathering Storm")
- Narrative should reveal major plot developments
- Objectives should directly challenge the main antagonist or threat
- Choices should have high stakes and consequences
` : `
- Generate a chapter that advances the main story arc
- Title should be evocative and unique (NOT just "Chapter X")
- Narrative should build on previous events and introduce new challenges
- Objectives should be concrete goals tied to the overarching campaign goal
- Choices should provide meaningful story progression
`}

Generate a JSON response with these fields:
{
  "chapterTitle": "A unique, evocative chapter title (NOT just 'Chapter X')",
  "narrative": "2-3 paragraphs setting up this chapter's situation and challenges (150-200 words)",
  "chapterObjectives": [
    { "id": "obj_1", "text": "Primary objective for this chapter", "isMain": true },
    { "id": "obj_2", "text": "Secondary objective", "isMain": false }
  ],
  "choices": [
    {
      "action": "Descriptive action text",
      "description": "What this choice leads to",
      "requiresDiceRoll": true/false,
      "diceType": "d20",
      "rollDC": 12-18,
      "rollModifier": 0,
      "rollPurpose": "Skill check type"
    }
  ],
  "activeQuests": [
    {
      "id": "quest_ch${nextChapterNumber}_main",
      "title": "Main quest for this chapter",
      "description": "What the player needs to accomplish",
      "status": "active",
      "xpReward": 200-500
    }
  ],
  "newLocation": "The primary location for this chapter's events",
  "storyHooks": ["Plot hook 1", "Plot hook 2"]
}

IMPORTANT: The chapterTitle MUST be a creative, evocative name - NEVER just "Chapter X" or generic titles.
Choices should include 4 options with at least 2 requiring dice rolls.
`;
          
          const chapterResponse = await openaiClientForChapter.chat.completions.create({
            model: chapterModel,
            messages: [{ role: "user", content: chapterPrompt }],
            response_format: { type: "json_object" },
            max_tokens: 1500,
          });
          
          let generatedChapter;
          try {
            generatedChapter = JSON.parse(chapterResponse.choices[0].message.content || '{}');
            
            // Validate the response has required fields
            if (!generatedChapter.chapterTitle || generatedChapter.chapterTitle.toLowerCase().includes('chapter ' + nextChapterNumber)) {
              // AI failed to generate a unique title, create a better one
              const titleOptions = isNextChapterFinal 
                ? ["The Final Reckoning", "The Last Stand", "Dawn of Resolution", "The Ultimate Challenge"]
                : isClimaxChapter
                ? ["The Gathering Storm", "Into the Abyss", "The Darkest Hour", "Shadows Rising"]
                : ["A New Path", "Echoes of Fate", "The Hidden Truth", "Crossing Thresholds"];
              generatedChapter.chapterTitle = titleOptions[Math.floor(Math.random() * titleOptions.length)];
            }
          } catch (parseErr) {
            console.error("Failed to parse chapter generation response:", parseErr);
            // Create meaningful fallback content that's still better than generic
            const fallbackTitles = ["The Path Forward", "Uncharted Territory", "Rising Challenges", "The Next Step"];
            generatedChapter = {
              chapterTitle: fallbackTitles[Math.floor(Math.random() * fallbackTitles.length)],
              narrative: `The echoes of your recent accomplishments still linger as new challenges emerge. The path ahead remains shrouded in mystery, but your party's resolve is unwavering. What trials await in this next phase of your adventure?`,
              choices: [
                { action: "Scout the area ahead", description: "Survey your surroundings for threats or opportunities", requiresDiceRoll: true, diceType: "d20", rollDC: 12, rollModifier: 0, rollPurpose: "Perception Check" },
                { action: "Seek local information", description: "Find someone who knows about recent events", requiresDiceRoll: false },
                { action: "Press forward boldly", description: "Continue your mission without delay", requiresDiceRoll: false },
                { action: "Take a moment to strategize", description: "Plan your next moves carefully", requiresDiceRoll: false }
              ],
              activeQuests: [
                { id: `quest_ch${nextChapterNumber}_main`, title: "Continue the Quest", description: "Advance toward your ultimate goal", status: "active", xpReward: 200 }
              ],
              newLocation: currentLocation || "Unknown Territory",
              chapterObjectives: [
                { id: "obj_1", text: "Continue progressing through the story", isMain: true }
              ]
            };
          }
          
          // Validate we have valid chapter content before proceeding
          if (!generatedChapter || !generatedChapter.chapterTitle || !generatedChapter.narrative) {
            console.error("Failed to generate valid chapter content, not advancing");
            throw new Error("Failed to generate valid chapter content");
          }
          
          // Prepare the enhanced story state BEFORE creating the session
          const enhancedStoryState = {
            ...(currentSession.storyState as any || {}),
            location: generatedChapter.newLocation || currentLocation,
            activeQuests: generatedChapter.activeQuests || [],
            chapterObjectives: generatedChapter.chapterObjectives || [],
            storyHooks: generatedChapter.storyHooks || [],
            turnsInChapter: 0,
            // Reset adventure progress for new chapter
            adventureProgress: {
              encounters: { combat: 0, trap: 0, treasure: 0, total: 0 },
              puzzles: 0,
              discoveries: 0
            }
          };
          
          const chapterSummary = `Chapter ${currentSession.sessionNumber} concluded. ${
            allCompletedQuests.length > 0 
              ? `Quests completed: ${allCompletedQuests.join(', ')}.` 
              : ''
          }`;
          
          // NOW advance to next session - we have valid content ready
          newSessionData = await storage.advanceToNextSession(campaignId, chapterSummary);
          
          // Immediately update with AI-generated content
          if (newSessionData && newSessionData.id) {
            // Update the session with proper content
            await storage.advanceSessionStory(campaignId, {
              narrative: generatedChapter.narrative,
              dmNarrative: `Chapter ${nextChapterNumber}: ${generatedChapter.chapterTitle}`,
              choices: generatedChapter.choices,
              storyState: enhancedStoryState,
              npcInteractions: [],
              playerChoicesMade: [],
              actionLogEntries: [{
                type: 'chapter_start',
                timestamp: new Date().toISOString(),
                text: `Chapter ${nextChapterNumber}: ${generatedChapter.chapterTitle}`,
                sceneType: 'Chapter',
              }]
            });
            
            // Update the session title separately
            await db
              .update(campaignSessions)
              .set({
                title: generatedChapter.chapterTitle,
                location: generatedChapter.newLocation || currentLocation
              })
              .where(eq(campaignSessions.id, newSessionData.id));
            
            // Refresh the session data with updated content
            newSessionData = await storage.getCurrentSession(campaignId);
            
            console.log(`Generated AI chapter: "${generatedChapter.chapterTitle}" for campaign ${campaignId}`);
          }
          
          // Only mark as advanced if we got valid session data
          if (newSessionData && newSessionData.id) {
            sessionAdvanced = true;
            
            // Reset turnsInChapter for the new chapter
            mergedStoryState.turnsInChapter = 0;
            
            // Record chapter advancement trace event
            await recordTrace(campaignId, "everdice.chapterAdvanced", {
              fromChapter: currentSession.sessionNumber,
              toChapter: newSessionData.sessionNumber,
              chapterTitle: newSessionData.title
            }, {
              sessionId: `session.${currentSession.sessionNumber}`,
              who: "system.dm"
            });
            
            // Record session ended event
            await recordTrace(campaignId, "session.ended", {
              sessionId: `session.${currentSession.sessionNumber}`
            }, {
              sessionId: `session.${currentSession.sessionNumber}`,
              who: "system.dm"
            });
            
            // Record session started event for new session
            await recordTrace(campaignId, "session.started", {
              sessionId: `session.${newSessionData.sessionNumber}`,
              title: newSessionData.title
            }, {
              sessionId: `session.${newSessionData.sessionNumber}`,
              who: "system.dm"
            });
            
            // Broadcast session advancement
            broadcastMessage('session_advanced', {
              campaignId,
              newSessionNumber: newSessionData.sessionNumber,
              previousSessionSummary: chapterSummary
            });
            
            console.log(`Auto-advanced campaign ${campaignId} to session ${newSessionData.sessionNumber}`);
            
            // D&D 5e: Recharge magical items at dawn (new session/chapter = new day)
            if (character?.id) {
              try {
                const sessionRecharge = await rechargeCharacterItems(character.id);
                if (sessionRecharge.recharged.length > 0 || sessionRecharge.destroyed.length > 0) {
                  // Store recharge data so it can be included in the response
                  (mergedStoryState as any).itemRechargeAtDawn = sessionRecharge;
                  console.log(`[Session Recharge] Items recharged for character ${character.id}:`, 
                    sessionRecharge.recharged.map(r => `${r.itemName}: +${r.chargesRegained}`).join(', '));
                }
              } catch (rechargeErr) {
                console.error('[Session Recharge] Error:', rechargeErr);
              }
            }
          }
        } catch (advanceError: any) {
          // Check if this is a campaign completion (not an error)
          if (advanceError?.type === 'campaign_complete') {
            console.log("Campaign completed successfully with rewards:", advanceError.rewards);
            // Set the completion rewards in characterProgression
            if (characterProgression) {
              characterProgression.campaignComplete = true;
              characterProgression.completionRewards = advanceError.rewards;
            }
            // Don't advance session, campaign is done
            sessionAdvanced = false;
          } else {
            console.error("Failed to auto-advance session:", advanceError);
            // Don't set sessionAdvanced to true, continue with original session data
          }
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
      
      // Post to Discord if campaign is deployed there
      const campaignForDiscord = await storage.getCampaign(campaignId);
      if (campaignForDiscord?.isDiscordDeployed && campaignForDiscord.discordChannelId) {
        // Post player choice first - extract numeric roll value from rollResult object
        const rollValue = rollResult?.total ?? rollResult?.result ?? (typeof rollResult === 'number' ? rollResult : null);
        const rollBreakdown = rollResult ? `${rollResult.diceType || 'd20'}(${rollResult.result || '?'}) + ${rollResult.modifier || 0} = ${rollResult.total || rollResult.result || '?'}` : null;
        postCampaignEvent(campaignForDiscord, 'player_choice', {
          characterName: playerCharacter?.name || 'A hero',
          choice: choice,
          rollResult: rollValue,
          rollBreakdown: rollBreakdown
        }).catch(err => console.log('[Discord] Failed to post player choice:', err.message));
        
        // Post narrative update with choices for interactive play
        postCampaignEvent(campaignForDiscord, 'story_update', {
          content: storyAdvancement.narrative,
          choices: storyAdvancement.choices
        }).catch(err => console.log('[Discord] Failed to post story update:', err.message));
        
        // Post combat round if in combat
        const inCombat = storyAdvancement.storyState?.inCombat || mergedStoryState?.inCombat;
        if (inCombat && storyAdvancement.storyState?.combatants?.length > 0) {
          postCampaignEvent(campaignForDiscord, 'combat_round', {
            round: storyAdvancement.storyState?.combatRound || 1,
            description: storyAdvancement.narrative?.slice(0, 500),
            combatants: storyAdvancement.storyState?.combatants
          }).catch(err => console.log('[Discord] Failed to post combat update:', err.message));
        }
      }

      // Build movement response - use actual movement result, not just intent
      const movementResponse = effectiveDirection ? {
        occurred: movementActuallyOccurred,
        direction: effectiveDirection,
        description: movementActuallyOccurred 
          ? (movement?.description || `Moved ${effectiveDirection === 'up' ? 'north' : effectiveDirection === 'down' ? 'south' : effectiveDirection === 'right' ? 'east' : 'west'}`)
          : `Movement blocked: ${movementBlockedReason || 'obstacle'}`,
        blocked: !movementActuallyOccurred,
        blockedReason: movementBlockedReason
      } : null;
      
      // Extract tile narrative for the player's current position
      let currentTileNarrative = null;
      if (updatedMapData && updatedMapData.playerPosition && updatedMapData.tiles) {
        const pos = updatedMapData.playerPosition;
        if (pos.y >= 0 && pos.y < updatedMapData.height && 
            pos.x >= 0 && pos.x < updatedMapData.width &&
            updatedMapData.tiles[pos.y] && updatedMapData.tiles[pos.y][pos.x]) {
          const tile = updatedMapData.tiles[pos.y][pos.x];
          if (tile.narrative && tile.narrative.discovered) {
            currentTileNarrative = {
              description: tile.narrative.description,
              shortDescription: tile.narrative.shortDescription,
              npcs: tile.narrative.npcs || [],
              items: tile.narrative.items || [],
              enemies: tile.narrative.enemies || [],
              events: tile.narrative.events || [],
              dangerLevel: tile.narrative.dangerLevel,
              interactable: tile.narrative.interactable
            };
          }
        }
      }
      
      // DM AUTHORING DOCTRINE: Process campaign stake updates and narrative log in main advance-story
      try {
        const doctrineUpdates: any = {};
        let doctrineChanged = false;
        
        // Apply campaign stake updates with anti-oscillation enforcement
        let currentCampaignStakes = [...((campaign as any).campaignStakes || [])];
        if (storyAdvancement.campaignStakeUpdates && Array.isArray(storyAdvancement.campaignStakeUpdates)) {
          for (const update of storyAdvancement.campaignStakeUpdates) {
            const stakeIndex = currentCampaignStakes.findIndex((s: any) => s.id === update.id);
            if (stakeIndex >= 0) {
              const stake = currentCampaignStakes[stakeIndex];
              let effectiveDelta = update.delta || 0;
              
              // ANTI-OSCILLATION: Check if the AI is reversing the previous turn's change
              const lastDelta = stake.lastDelta || 0;
              if (lastDelta !== 0 && effectiveDelta !== 0 && Math.sign(lastDelta) !== Math.sign(effectiveDelta)) {
                // AI is trying to reverse direction immediately — only allow if the delta is ≥ 2 (decisive choice)
                if (Math.abs(effectiveDelta) < 2) {
                  console.log(`DOCTRINE STAKE (main): ${update.id} BLOCKED oscillation (was ${lastDelta > 0 ? '+' : ''}${lastDelta} last turn, AI wants ${effectiveDelta > 0 ? '+' : ''}${effectiveDelta} — too small to reverse)`);
                  effectiveDelta = 0;
                }
              }
              
              const newValue = Math.max(0, Math.min(stake.max || 5, stake.value + effectiveDelta));
              currentCampaignStakes[stakeIndex] = { ...stake, value: newValue, lastDelta: effectiveDelta !== 0 ? effectiveDelta : lastDelta };
              if (effectiveDelta !== 0) {
                console.log(`DOCTRINE STAKE (main): ${update.id} ${effectiveDelta > 0 ? '+' : ''}${effectiveDelta} (now ${newValue}/${stake.max}) — ${update.reason}`);
              }
            }
          }
          doctrineChanged = true;
        }
        
        // Apply passive drift (world deteriorates each scene)
        const { updatedStakes: mainDriftedStakes, driftLog: mainDriftLog, thresholdEvents: mainThresholdEvents } = applyStakePassiveDrift(currentCampaignStakes);
        if (mainDriftLog.length > 0) {
          currentCampaignStakes = mainDriftedStakes;
          doctrineChanged = true;
          mainDriftLog.forEach(log => console.log(log));
        }
        doctrineUpdates.campaignStakes = currentCampaignStakes;
        
        // Log threshold events from passive drift AND inject them into the narrative
        if (mainThresholdEvents.length > 0) {
          const thresholdNarrative = mainThresholdEvents.map((te: any) =>
            `[THRESHOLD EVENT: ${te.stakeName} hit ${te.threshold} — ${te.event}${te.irreversible ? ' (PERMANENT)' : ''}]`
          ).join('\n');
          console.log(`THRESHOLD EVENTS TRIGGERED (main):\n${thresholdNarrative}`);
          
          // CRITICAL: Append threshold event descriptions to the narrative so the player SEES the consequence
          const thresholdDescriptions = mainThresholdEvents.map((te: any) =>
            `\n\n${te.event}${te.irreversible ? ' The change feels permanent — there is no going back.' : ''}`
          ).join('');
          if (storyAdvancement.narrative) {
            storyAdvancement.narrative += thresholdDescriptions;
          }
        }
        
        // Append narrative log entry
        const currentNarrativeLog = [...((campaign as any).narrativeLog || [])];
        if (storyAdvancement.narrativeLogEntry) {
          currentNarrativeLog.push({
            ...storyAdvancement.narrativeLogEntry,
            chapter: currentChapter,
            scene: currentNarrativeLog.length + 1,
            timestamp: new Date().toISOString()
          });
          doctrineUpdates.narrativeLog = currentNarrativeLog;
          doctrineChanged = true;
          console.log(`DOCTRINE LOG (main): ch${currentChapter} — cost: ${storyAdvancement.narrativeLogEntry.choiceCost}`);
        }
        
        // Chapter gate advancement (meaning-based) with validation against defined gates
        if (storyAdvancement.chapterGateMet) {
          const gate = storyAdvancement.chapterGateMet;
          const definedGates = (campaign as any).chapterGates || [];
          const matchingGate = definedGates.find((g: any) => g.chapter === gate.gateId);
          
          const gateValid = !matchingGate || (
            (!matchingGate.requiredTruth || gate.reason?.toLowerCase().includes(matchingGate.requiredTruth.toLowerCase().split(' ')[0])) &&
            (!matchingGate.requiredCommitment || (gate.reason && gate.reason.length > 10)) &&
            (!matchingGate.requiredBeliefChange || (gate.reason && gate.reason.length > 10))
          );
          
          const CHAPTER_MIN_SCENES_R2 = 3;
          if (Number(gate.gateId) === currentChapter && currentChapter < totalChapters && gateValid) {
            if (scenesInChapter2 >= CHAPTER_MIN_SCENES_R2) {
              doctrineUpdates.currentSession = currentChapter + 1;
              doctrineChanged = true;
              console.log(`DOCTRINE CHAPTER GATE MET (main): Chapter ${currentChapter} → ${currentChapter + 1} — ${gate.reason} (after ${scenesInChapter2} scenes)`);
              
              currentNarrativeLog.push({
                xpReason: `Chapter ${currentChapter} completed`,
                stakeReason: gate.reason,
                foreclosedReason: `Chapter ${currentChapter} closed`,
                choiceCost: `Advanced to Chapter ${currentChapter + 1}`,
                chapter: currentChapter,
                scene: -1,
                timestamp: new Date().toISOString(),
                type: 'chapter_gate'
              });
              doctrineUpdates.narrativeLog = currentNarrativeLog;
            } else {
              console.log(`DOCTRINE CHAPTER GATE REJECTED (main, too early): Chapter ${currentChapter} gate after only ${scenesInChapter2}/${CHAPTER_MIN_SCENES_R2} minimum scenes — ${gate.reason}`);
            }
          }
        }
        
        // HARD-CAP FAILSAFE: If 12+ sessions in this chapter without gate met, force-advance
        const CHAPTER_HARD_CAP_R2 = 10;
        if (!doctrineUpdates.currentSession && scenesInChapter2 >= CHAPTER_HARD_CAP_R2 && currentChapter < totalChapters) {
          doctrineUpdates.currentSession = currentChapter + 1;
          doctrineChanged = true;
          console.log(`HARD-CAP CHAPTER ADVANCE (main): Chapter ${currentChapter} → ${currentChapter + 1} after ${scenesInChapter2} sessions`);
          currentNarrativeLog.push({
            xpReason: `Chapter ${currentChapter} completed (narrative pressure)`,
            stakeReason: `Story momentum forced chapter progression after ${scenesInChapter2} scenes`,
            foreclosedReason: `Chapter ${currentChapter} closed by narrative pressure`,
            choiceCost: `Advanced to Chapter ${currentChapter + 1}`,
            chapter: currentChapter,
            scene: -1,
            timestamp: new Date().toISOString(),
            type: 'chapter_gate'
          });
          doctrineUpdates.narrativeLog = currentNarrativeLog;
        }
        
        // CAML Campaign Architecture: Process faction updates from AI response
        if (storyAdvancement.factionUpdates && Array.isArray(storyAdvancement.factionUpdates)) {
          const currentFactionStrengths = { ...((campaign as any).factionStrengths || {}) };
          const currentFactionModels = [...((campaign as any).factionModels || [])];
          
          for (const update of storyAdvancement.factionUpdates) {
            if (update.factionId && typeof update.strengthDelta === 'number') {
              const factionModel = currentFactionModels.find((f: any) => f.id === update.factionId);
              const currentStrength = currentFactionStrengths[update.factionId] ?? factionModel?.strength ?? 50;
              const newStrength = Math.max(0, Math.min(100, currentStrength + update.strengthDelta));
              currentFactionStrengths[update.factionId] = newStrength;
              console.log(`FACTION UPDATE: ${update.factionId} ${update.strengthDelta > 0 ? '+' : ''}${update.strengthDelta} (now ${newStrength}/100) — ${update.action}`);
            }
          }
          doctrineUpdates.factionStrengths = currentFactionStrengths;
          doctrineChanged = true;
        }

        // CAML2: Process villain updates from AI response (Route 2)
        let r2VillainModel = (campaign as any).villainModel ? { ...(campaign as any).villainModel } : null;
        let r2VillainCorruption = (campaign as any).villainCorruption || 0;
        let r2PartyReputation = (campaign as any).partyReputation || 50;
        let r2WorldInstability = (campaign as any).worldInstability || 20;
        
        if (storyAdvancement.villainUpdate && r2VillainModel) {
          const vu = storyAdvancement.villainUpdate;
          if (vu.reactionUsed) {
            console.log(`CAML2 VILLAIN REACTION (R2): ${vu.reactionUsed} — ${vu.consequence || 'no details'}`);
          }
          if (typeof vu.newStep === 'number') {
            r2VillainModel.currentStep = vu.newStep;
          }
          if (typeof vu.corruptionDelta === 'number') {
            r2VillainCorruption = Math.max(0, Math.min(10, r2VillainCorruption + vu.corruptionDelta));
          }
          doctrineUpdates.villainModel = r2VillainModel;
          doctrineChanged = true;
        }
        
        if (storyAdvancement.trackingUpdates) {
          const tu = storyAdvancement.trackingUpdates;
          if (typeof tu.reputationDelta === 'number') {
            r2PartyReputation = Math.max(0, Math.min(100, r2PartyReputation + tu.reputationDelta));
          }
          if (typeof tu.instabilityDelta === 'number') {
            r2WorldInstability = Math.max(0, Math.min(100, r2WorldInstability + tu.instabilityDelta));
          }
          if (typeof tu.corruptionDelta === 'number' && !storyAdvancement.villainUpdate?.corruptionDelta) {
            r2VillainCorruption = Math.max(0, Math.min(10, r2VillainCorruption + tu.corruptionDelta));
          }
          doctrineUpdates.villainCorruption = r2VillainCorruption;
          doctrineUpdates.partyReputation = r2PartyReputation;
          doctrineUpdates.worldInstability = r2WorldInstability;
          doctrineChanged = true;
        }
        
        // CAML2: Mark complications as used (Route 2)
        let r2ComplicationsQueue = (campaign as any).complicationsQueue ? { ...(campaign as any).complicationsQueue } : null;
        if (storyAdvancement.complicationUsed && r2ComplicationsQueue) {
          const cu = storyAdvancement.complicationUsed;
          if (cu.type === 'moralQuandary' && r2ComplicationsQueue.moralQuandaries) {
            const idx = r2ComplicationsQueue.moralQuandaries.findIndex((q: any) => q.type === cu.id);
            if (idx >= 0) {
              r2ComplicationsQueue.moralQuandaries = [...r2ComplicationsQueue.moralQuandaries];
              r2ComplicationsQueue.moralQuandaries[idx] = { ...r2ComplicationsQueue.moralQuandaries[idx], isUsed: true };
            }
          } else if (cu.type === 'twist' && r2ComplicationsQueue.twists) {
            const idx = r2ComplicationsQueue.twists.findIndex((t: any) => t.type === cu.id);
            if (idx >= 0) {
              r2ComplicationsQueue.twists = [...r2ComplicationsQueue.twists];
              r2ComplicationsQueue.twists[idx] = { ...r2ComplicationsQueue.twists[idx], isUsed: true };
            }
          } else if (cu.type === 'environmentalModifier' && r2ComplicationsQueue.environmentalModifiers) {
            const idx = r2ComplicationsQueue.environmentalModifiers.findIndex((e: any) => e.type === cu.id);
            if (idx >= 0) {
              r2ComplicationsQueue.environmentalModifiers = [...r2ComplicationsQueue.environmentalModifiers];
              r2ComplicationsQueue.environmentalModifiers[idx] = { ...r2ComplicationsQueue.environmentalModifiers[idx], isUsed: true };
            }
          }
          doctrineUpdates.complicationsQueue = r2ComplicationsQueue;
          doctrineChanged = true;
        }
        
        // CAML2: Mark encounter designs as used (Route 2)
        let r2EncounterDesigns = [...((campaign as any).encounterDesigns || [])];
        if (storyAdvancement.encounterUsed && r2EncounterDesigns.length > 0) {
          const encIdx = r2EncounterDesigns.findIndex((e: any) => e.id === storyAdvancement.encounterUsed);
          if (encIdx >= 0) {
            r2EncounterDesigns[encIdx] = { ...r2EncounterDesigns[encIdx], isUsed: true };
            doctrineUpdates.encounterDesigns = r2EncounterDesigns;
            doctrineChanged = true;
          }
        }
        
        // CAML2: Failure advancement (Route 2)
        if (storyAdvancement.failureAdvancement) {
          const fa = storyAdvancement.failureAdvancement;
          const failureLog = [...((campaign as any).failureAdvancementLog || [])];
          failureLog.push({
            chapter: currentChapter,
            scene: (currentNarrativeLog || []).length,
            timestamp: new Date().toISOString(),
            villainAdvancement: fa.villainAdvancement,
            factionShift: fa.factionShift,
            worldConsequence: fa.worldConsequence,
            newThreat: fa.newThreat
          });
          if (fa.villainStepAdvance && r2VillainModel) {
            r2VillainModel.currentStep = Math.min(
              (r2VillainModel.planStructure || []).length - 1,
              (r2VillainModel.currentStep || 0) + 1
            );
            doctrineUpdates.villainModel = r2VillainModel;
          }
          if (typeof fa.corruptionIncrease === 'number') {
            r2VillainCorruption = Math.min(10, r2VillainCorruption + fa.corruptionIncrease);
            doctrineUpdates.villainCorruption = r2VillainCorruption;
          }
          if (typeof fa.instabilityIncrease === 'number') {
            r2WorldInstability = Math.min(100, r2WorldInstability + fa.instabilityIncrease);
            doctrineUpdates.worldInstability = r2WorldInstability;
          }
          doctrineUpdates.failureAdvancementLog = failureLog;
          doctrineChanged = true;
        }

        if (doctrineChanged) {
          await storage.updateCampaign(campaignId, doctrineUpdates);
        }
      } catch (doctrineError) {
        console.error("Failed to apply DM Authoring Doctrine updates:", doctrineError);
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // CAMPAIGN COMPLETION — AI-triggered OR hard-cap forced
      // ═══════════════════════════════════════════════════════════════════
      const isCampaignFinale = storyAdvancement.isCampaignFinale === true;
      
      // OVERALL CAMPAIGN SCENE HARD CAP — prevents infinite cycling
      const CAMPAIGN_SCENE_HARD_CAP = (totalChapters || 5) * 10;
      const FINAL_CHAPTER_AUTO_COMPLETE = 12;
      const totalCampaignScenes = allCampaignSessions.length;
      const scenesInFinalChapter = isOnFinalChapter ? (mergedStoryState.turnsInChapter || 0) : 0;
      
      let forceCompletion = false;
      let forceReason = '';
      
      if (!campaign.isCompleted && !isCampaignFinale) {
        if (totalCampaignScenes >= CAMPAIGN_SCENE_HARD_CAP) {
          forceCompletion = true;
          forceReason = `Campaign reached overall scene limit (${totalCampaignScenes}/${CAMPAIGN_SCENE_HARD_CAP} scenes)`;
        } else if (isOnFinalChapter && scenesInFinalChapter >= FINAL_CHAPTER_AUTO_COMPLETE) {
          forceCompletion = true;
          forceReason = `Final chapter exceeded scene limit (${scenesInFinalChapter}/${FINAL_CHAPTER_AUTO_COMPLETE} scenes)`;
        }
        
        if (forceCompletion) {
          console.log(`[Campaign Force-Complete] ${forceReason} — campaign ${campaignId}`);
          storyAdvancement.isCampaignFinale = true;
          storyAdvancement.endingType = 'destiny_fulfilled';
        }
      }
      
      let campaignCompletionData = null;
      
      if ((isCampaignFinale || forceCompletion) && !campaign.isCompleted) {
        console.log(`[Campaign Completion] Marking campaign ${campaignId} as completed${forceCompletion ? ` (FORCED: ${forceReason})` : ''}`);
        
        // Difficulty-scaled reward multipliers
        const difficultyMultiplier = 
          (campaign as any).difficulty === 'Heroic' ? 2.0 :
          (campaign as any).difficulty === 'Challenging' ? 1.5 :
          (campaign as any).difficulty === 'Relaxed' ? 0.8 : 1.0;
        
        const baseXP = (totalChapters || 5) * 200;
        const completionXP = Math.round(baseXP * difficultyMultiplier);
        const totalXpAwarded = xpAwarded + completionXP;
        const completedQuestCount = ((mergedStoryState.activeQuests || []).filter((q: any) => q.status === 'completed').length) +
                                    ((mergedStoryState.completedQuests || []).length);
        const goldReward = Math.round((totalChapters || 5) * 75 * difficultyMultiplier);
        const silverReward = Math.round((totalChapters || 5) * 40 * difficultyMultiplier);
        
        // Mark the campaign as completed
        await storage.updateCampaign(campaignId, {
          isCompleted: true,
          completedAt: new Date().toISOString()
        });
        
        // ═══════════════════════════════════════════════════════════════════
        // CAMPAIGN-THEMED REWARD ITEMS — Generated based on campaign story
        // ═══════════════════════════════════════════════════════════════════
        const campaignRewardItems: { name: string; type: string; description: string; rarity: string; properties: string; specialEffect?: string; magicBonus?: number; damageDice?: string; damageType?: string; baseAC?: number }[] = [];
        
        try {
          const campaignNarrative = storyAdvancement.narrative || campaign.description || campaign.title;
          const campaignTheme = (campaign as any).narrativeStyle || 'classic_fantasy';
          const charClass = character?.class || 'adventurer';
          const endingStyle = storyAdvancement.endingType || 'standard_resolution';
          
          const itemRarities = (campaign as any).difficulty === 'Heroic' 
            ? ['very_rare', 'rare', 'rare'] 
            : (campaign as any).difficulty === 'Challenging'
            ? ['rare', 'rare', 'uncommon']
            : ['rare', 'uncommon', 'uncommon'];
          
          const thematicItems: { name: string; type: string; description: string; rarity: string; properties: string; specialEffect?: string; magicBonus?: number; damageDice?: string; damageType?: string; baseAC?: number }[] = [];
          
          const campaignTitleClean = campaign.title.replace(/['"]/g, '');
          
          const signatureWeapons: Record<string, { name: string; type: string; damageDice: string; damageType: string; description: string; specialEffect: string }> = {
            fighter: { name: `${campaignTitleClean} Greatsword`, type: 'weapon', damageDice: '2d6+2', damageType: 'slashing', description: `A mighty blade forged in the crucible of "${campaign.title}". Its edge never dulls.`, specialEffect: 'Once per day, gain advantage on your next attack roll.' },
            wizard: { name: `Staff of ${campaignTitleClean}`, type: 'weapon', damageDice: '1d8+1', damageType: 'arcane', description: `A staff pulsing with the residual magic of "${campaign.title}". Arcane runes spiral along its length.`, specialEffect: 'Once per day, recover one expended spell slot (level 3 or lower).' },
            rogue: { name: `${campaignTitleClean} Shadow Dagger`, type: 'weapon', damageDice: '1d6+2', damageType: 'piercing', description: `A blade darker than midnight, tempered by the shadows of "${campaign.title}".`, specialEffect: 'Once per day, become invisible until end of your next turn.' },
            cleric: { name: `Blessed Mace of ${campaignTitleClean}`, type: 'weapon', damageDice: '1d8+1', damageType: 'radiant', description: `A holy weapon sanctified during the trials of "${campaign.title}". It glows softly in darkness.`, specialEffect: 'Healing spells restore an additional 1d4 hit points.' },
            ranger: { name: `${campaignTitleClean} Longbow`, type: 'weapon', damageDice: '1d8+2', damageType: 'piercing', description: `A bow carved from ancient wood blessed during "${campaign.title}". Arrows fly true.`, specialEffect: 'Once per day, mark a target — your next attack has advantage and deals extra 1d6 damage.' },
            paladin: { name: `Oath Blade of ${campaignTitleClean}`, type: 'weapon', damageDice: '2d6+1', damageType: 'radiant', description: `A sacred sword that glows with divine light, sworn to the oaths of "${campaign.title}".`, specialEffect: 'Once per day, smite deals an extra 2d8 radiant damage.' },
            warlock: { name: `${campaignTitleClean} Pact Rod`, type: 'weapon', damageDice: '1d8+1', damageType: 'necrotic', description: `A rod thrumming with eldritch power from the pacts made during "${campaign.title}".`, specialEffect: 'Once per day, Eldritch Blast pushes target 20 feet instead of 10.' },
            bard: { name: `Lyre of ${campaignTitleClean}`, type: 'weapon', damageDice: '1d6+1', damageType: 'psychic', description: `A magical instrument whose melodies recall the epic saga of "${campaign.title}".`, specialEffect: 'Once per day, grant inspiration to all allies within 30 feet.' },
            druid: { name: `${campaignTitleClean} Heartwood Staff`, type: 'weapon', damageDice: '1d8+1', damageType: 'nature', description: `A living staff sprouted from the heart of the wilderness in "${campaign.title}".`, specialEffect: 'Once per day, summon a nature spirit to aid in combat (acts as a wolf).' },
            barbarian: { name: `${campaignTitleClean} War Axe`, type: 'weapon', damageDice: '1d12+2', damageType: 'slashing', description: `A fearsome axe soaked in the fury of "${campaign.title}". It hungers for battle.`, specialEffect: 'While raging, critical hits on 19-20.' },
            monk: { name: `${campaignTitleClean} Wrapped Fists`, type: 'weapon', damageDice: '1d8+1', damageType: 'bludgeoning', description: `Enchanted hand wraps imbued with ki energy from the trials of "${campaign.title}".`, specialEffect: 'Once per day, gain 2 additional ki points.' },
            sorcerer: { name: `Orb of ${campaignTitleClean}`, type: 'weapon', damageDice: '1d6+2', damageType: 'force', description: `A crystalline orb crackling with raw magical energy from "${campaign.title}".`, specialEffect: 'Once per day, apply metamagic without spending sorcery points.' },
            adventurer: { name: `${campaignTitleClean} Champion's Blade`, type: 'weapon', damageDice: '1d10+1', damageType: 'slashing', description: `A legendary weapon earned through the trials of "${campaign.title}".`, specialEffect: 'Once per day, reroll a failed attack roll.' }
          };
          
          const classKey = charClass.toLowerCase();
          const signatureWeapon = signatureWeapons[classKey] || signatureWeapons['adventurer'];
          thematicItems.push({
            ...signatureWeapon,
            rarity: itemRarities[0],
            properties: 'Magical, Campaign Reward',
            magicBonus: itemRarities[0] === 'very_rare' ? 3 : 2
          });
          
          const trinketOptions = [
            { name: `Medallion of ${campaignTitleClean}`, type: 'wondrous', description: `A gleaming medallion bearing the sigil of "${campaign.title}". It warms to the touch near allies.`, specialEffect: 'Advantage on saving throws against fear effects.', properties: 'Magical, Wondrous, Campaign Keepsake' },
            { name: `${campaignTitleClean} Ring of Resolve`, type: 'accessory', description: `A band inscribed with runes that tell the tale of "${campaign.title}". It pulses with determination.`, specialEffect: '+1 to all saving throws.', properties: 'Magical, Ring, Campaign Keepsake' },
            { name: `Cloak of the ${campaignTitleClean}`, type: 'armor', description: `A shimmering cloak woven from the threads of fate during "${campaign.title}".`, specialEffect: 'Once per day, teleport up to 30 feet as a bonus action.', properties: 'Magical, Cloak, Campaign Keepsake', baseAC: 1 },
            { name: `Amulet of ${campaignTitleClean}`, type: 'wondrous', description: `A crystalline amulet containing a fragment of the magic from "${campaign.title}".`, specialEffect: 'Resistance to one damage type of your choice (chosen at dawn).', properties: 'Magical, Amulet, Campaign Keepsake' }
          ];
          
          const trinketIndex = Math.floor(Math.random() * trinketOptions.length);
          thematicItems.push({ ...trinketOptions[trinketIndex], rarity: itemRarities[1] });
          
          const consumableOptions = [
            { name: `Elixir of ${campaignTitleClean}`, type: 'consumable', description: `A shimmering potion that captures the essence of your victory in "${campaign.title}".`, specialEffect: 'Restores all hit points and removes one condition.', properties: 'Consumable, Potion, Campaign Reward' },
            { name: `Scroll of ${campaignTitleClean} Memory`, type: 'consumable', description: `A scroll that replays a pivotal moment from "${campaign.title}", granting temporary power.`, specialEffect: 'For 1 hour, gain +2 to all ability checks.', properties: 'Consumable, Scroll, Campaign Reward' },
            { name: `${campaignTitleClean} Hearthstone`, type: 'consumable', description: `A warm stone that recalls the bonds forged during "${campaign.title}".`, specialEffect: 'Teleport your party to any previously visited location.', properties: 'Consumable, Stone, Campaign Reward' }
          ];
          
          const consumableIndex = Math.floor(Math.random() * consumableOptions.length);
          thematicItems.push({ ...consumableOptions[consumableIndex], rarity: itemRarities[2] });
          
          campaignRewardItems.push(...thematicItems);
          
          console.log(`[Campaign Completion] Generated ${campaignRewardItems.length} themed reward items for campaign "${campaign.title}"`);
        } catch (itemGenError) {
          console.error('[Campaign Completion] Failed to generate themed items, using fallback:', itemGenError);
          campaignRewardItems.push(
            { name: 'Enchanted Blade', type: 'weapon', description: 'A finely crafted blade gleaming with magical energy.', rarity: 'rare', properties: 'Magical', magicBonus: 2, damageDice: '1d10+2', damageType: 'slashing' },
            { name: 'Ring of Protection', type: 'accessory', description: 'Grants +1 to AC when worn.', rarity: 'uncommon', properties: 'Magical' },
            { name: 'Potion of Greater Healing', type: 'consumable', description: 'Restores 4d4+4 hit points.', rarity: 'uncommon', properties: 'Consumable' }
          );
        }
        
        // Add reward items to character inventory for ALL participants
        const allParticipantCharsForItems = participants && participants.length > 0 
          ? await Promise.all(participants.map(async (p: any) => {
              if (p.characterId) return storage.getCharacter(p.characterId);
              return null;
            }))
          : (character ? [character] : []);
        
        for (const pChar of allParticipantCharsForItems) {
          if (!pChar) continue;
          try {
            for (const rewardItem of campaignRewardItems) {
              await db.insert(characterInventory).values({
                characterId: pChar.id,
                name: rewardItem.name,
                description: rewardItem.description || '',
                type: rewardItem.type,
                rarity: rewardItem.rarity || 'uncommon',
                isBound: true,
                boundAt: new Date().toISOString(),
                acquiredFrom: 'campaign_completion',
                acquiredAt: new Date().toISOString(),
                magicBonus: rewardItem.magicBonus || 0,
                damageDice: rewardItem.damageDice || null,
                damageType: rewardItem.damageType || null,
                baseAC: rewardItem.baseAC || null,
                properties: rewardItem.properties ? [rewardItem.properties] : [],
                specialEffect: rewardItem.specialEffect || null,
                isEquipped: false,
                quantity: 1,
                value: rewardItem.rarity === 'very_rare' ? 5000 : rewardItem.rarity === 'rare' ? 2500 : rewardItem.rarity === 'uncommon' ? 500 : 100,
                createdAt: new Date().toISOString(),
              });
            }
            console.log(`[Campaign Completion] Added ${campaignRewardItems.length} themed items to character ${pChar.name}'s inventory`);
          } catch (invErr) {
            console.error(`[Campaign Completion] Failed to add items to character ${pChar.id}:`, invErr);
          }
        }
        
        // ═══════════════════════════════════════════════════════════════════
        // PERMANENT CHARACTER STATE CHANGES — Title, trait, level-up, rewards
        // ═══════════════════════════════════════════════════════════════════
        let earnedTitle = '';
        let earnedTrait = '';
        
        // Generate campaign completion title based on ending type
        const completionEndingType = storyAdvancement.endingType || 'standard_resolution';
        
        const titleMap: Record<string, string> = {
          'sealed_gate': 'Gatekeeper',
          'controlled_power': 'Power-Bound',
          'pyrrhic_victory': 'Scarred Victor',
          'sacrifice': 'The Selfless',
          'compromise': 'The Diplomat',
          'destiny_fulfilled': 'Destiny-Touched',
          'dark_pact': 'Pact-Sworn',
          'standard_resolution': 'Veteran'
        };
        
        const baseTitle = titleMap[completionEndingType] || 'Campaign Veteran';
        earnedTitle = `${baseTitle} of "${campaign.title}"`;
        
        // Trait based on how campaign was played
        const momentousCount = (mergedStoryState.momentousChoices || []).length;
        if (momentousCount >= 3) {
          earnedTrait = 'Fate-Forged — Your many pivotal decisions have left an indelible mark on the world';
        } else if (momentousCount >= 1) {
          earnedTrait = 'Decision-Maker — You faced a defining moment and chose your path';
        } else if (completedQuestCount >= 5) {
          earnedTrait = 'Questborne — Driven by duty, you completed quest after quest';
        } else {
          earnedTrait = 'Battle-Tested — Tempered by the trials of adventure';
        }
        
        // Apply permanent character state changes to ALL participants
        const allParticipantChars = participants && participants.length > 0 
          ? await Promise.all(participants.map(async (p: any) => {
              if (p.characterId) {
                return storage.getCharacter(p.characterId);
              }
              return null;
            }))
          : (character ? [character] : []);
        
        const xpThresholds = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
        const hitDiceMap: Record<string, number> = {
          'barbarian': 7, 'fighter': 6, 'paladin': 6, 'ranger': 6,
          'bard': 5, 'cleric': 5, 'druid': 5, 'monk': 5, 'rogue': 5, 'warlock': 5,
          'sorcerer': 4, 'wizard': 4
        };
        
        let primaryCharUpdates: any = {};
        
        for (const pChar of allParticipantChars) {
          if (!pChar) continue;
          
          const charUpdates: any = {};
          
          // XP and level-up check
          const newXP = (pChar.experience || 0) + completionXP;
          const currentLevel = pChar.level || 1;
          let newLevel = currentLevel;
          for (let lvl = currentLevel; lvl < xpThresholds.length; lvl++) {
            if (newXP >= xpThresholds[lvl]) {
              newLevel = lvl + 1;
            } else break;
          }
          const leveledUp = newLevel > currentLevel;
          
          // HP increase on level-up
          const hitDieAvg = hitDiceMap[(pChar.class || '').toLowerCase()] || 5;
          const conMod = pChar.abilityScores ? Math.floor(((pChar.abilityScores as any).constitution || 10) - 10) / 2 : 0;
          const hpGain = leveledUp ? (newLevel - currentLevel) * (hitDieAvg + Math.floor(conMod)) : 0;
          
          charUpdates.experience = newXP;
          charUpdates.gold = (pChar.gold || 0) + goldReward;
          charUpdates.silver = (pChar.silver || 0) + silverReward;
          if (leveledUp) {
            charUpdates.level = newLevel;
            charUpdates.maxHitPoints = (pChar.maxHitPoints || 10) + hpGain;
            charUpdates.hitPoints = (pChar.maxHitPoints || 10) + hpGain;
          }
          
          const completionNote = `\n\n--- Campaign Completed: "${campaign.title}" ---\nTitle Earned: ${earnedTitle}\nTrait Earned: ${earnedTrait}\nEnding: ${completionEndingType}${leveledUp ? `\nLeveled Up: ${currentLevel} → ${newLevel}` : ''}\nRewards: ${completionXP} XP, ${goldReward} gold, ${silverReward} silver`;
          charUpdates.backstory = ((pChar.backstory || '') + completionNote).slice(-3000);
          
          await db.update(characters).set(charUpdates).where(eq(characters.id, pChar.id));
          
          // Track the current player's character updates for the response
          if (character && pChar.id === character.id) {
            primaryCharUpdates = charUpdates;
          }
          
          console.log(`[Campaign Completion] Character ${pChar.name}: +${completionXP} XP, +${goldReward}g, +${silverReward}s${leveledUp ? `, LEVEL UP ${currentLevel}→${newLevel}` : ''}, title: "${earnedTitle}"`);
        }
        
        // Create adventure completion record for XP tracking
        if (participants && participants.length > 0) {
          for (const participant of participants) {
            await storage.createAdventureCompletion({
              userId: participant.userId,
              characterId: participant.characterId,
              campaignId,
              xpAwarded: totalXpAwarded,
              completedAt: new Date().toISOString(),
              notes: `Completed ${campaign.title} - Chapter ${currentChapter} of ${totalChapters}${earnedTitle ? ` — Title: ${earnedTitle}` : ''}`
            });
          }
        }
        
        // Build stake summary for completion data
        const finalStakes = doctrineUpdates.campaignStakes || (campaign as any).campaignStakes || [];
        const stakesSummary = finalStakes.map((s: any) => ({
          id: s.id,
          name: s.name,
          finalValue: s.value,
          max: s.max || 5,
          thresholdReached: s.value === 0 ? 'collapsed' : s.value >= (s.max || 5) ? 'peaked' : 'survived',
          consequence: s.value === 0 && s.thresholdConsequence?.at0 
            ? s.thresholdConsequence.at0.event 
            : s.value >= (s.max || 5) && s.thresholdConsequence?.at5 
              ? s.thresholdConsequence.at5.event 
              : null,
          irreversible: (s.value === 0 && s.thresholdConsequence?.at0?.irreversible) || 
                       (s.value >= (s.max || 5) && s.thresholdConsequence?.at5?.irreversible) || false
        }));
        
        campaignCompletionData = {
          isCompleted: true,
          completedAt: new Date().toISOString(),
          totalXpAwarded,
          completionXP,
          goldReward,
          silverReward,
          chaptersCompleted: currentChapter,
          totalChapters,
          questsCompleted: completedQuestCount,
          epilogue: storyAdvancement.narrative,
          endingType: completionEndingType,
          stakesSummary,
          earnedTitle,
          earnedTrait,
          rewardItems: campaignRewardItems,
          leveledUp: character ? (primaryCharUpdates.level > (character.level || 1)) : false,
          newLevel: primaryCharUpdates.level || (character?.level || 1),
          campaignQuestion: (campaign as any).campaignQuestion || null,
          forceCompleted: forceCompletion,
          message: `Congratulations! You have completed "${campaign.title}"!`
        };
        
        console.log(`[Campaign Completion] Campaign ${campaignId} completed successfully — ending: ${endingType}`);
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // THE QUIET RECKONING — Mandatory Session 1 ending scene
      // ═══════════════════════════════════════════════════════════════════
      let quietReckoningData: any = null;
      if (shouldTriggerQuietReckoning) {
        try {
          console.log(`[Quiet Reckoning] Triggering for campaign ${campaignId} after ${session1SceneCount} scenes`);
          
          const retention = updatedSession1Retention || session1Retention;
          const characterName = playerCharacter?.name || 'the adventurer';
          const toolName = retention.toolArc?.toolName || 'their equipment';
          const growthSummary = (retention.growthObservations || []).slice(-3).join('. ') || 'subtle changes in how they approach the world';
          const unresolvedHooks = (retention.deferredConsequences || []).slice(-2).join('. ') || 'Something unnamed stirs in the distance.';
          const identity = retention.identityFormation || 'someone still finding their way';
          
          const reckoningPrompt = `
You are writing the MANDATORY ending scene for Session 1 of a D&D campaign. This scene is called "The Quiet Reckoning."
It must be reflective, quiet, and powerful — NOT a cliffhanger. It is about the character pausing and realizing they have changed.

CHARACTER: ${characterName} (${playerCharacter?.class || 'adventurer'}, Level ${playerCharacter?.level || 1})
CAMPAIGN: ${campaign.title}
CURRENT LOCATION: ${mergedStoryState?.location || 'the adventure'}
NARRATIVE STYLE: ${narrativeStyle}

GROWTH THIS SESSION: ${growthSummary}
TOOL THEY'VE BEEN LEARNING: ${toolName} (competence: ${retention.toolArc?.competenceLevel || 'growing'})
UNRESOLVED THREADS: ${unresolvedHooks}
EMERGING IDENTITY: ${identity}

Write exactly 5 paragraphs following this structure:

1. ACKNOWLEDGE GROWTH: Reference how the character acted, what they learned, what improved. Show the difference between how they started and where they are now. Use second person ("You pause..."). This must feel earned, not generic.

2. ACKNOWLEDGE TOOL MASTERY: Reference the specific tool (${toolName}) and how it felt different now than when they first used it. "Before, it was just something you carried. Now, it's something you use."

3. NAME THE UNRESOLVED: State explicitly what consequence is still unfolding. Be concrete but mysterious. "Someone has noticed." "This will surface again." Do NOT resolve it.

4. FREEZE THE MOMENT: End before the next action. "You have the sense that the next step will matter more than the last. That is where things pause." Create tension without melodrama.

5. RETURN PROMISE: A soft out-of-world note. "This story is still unfolding. You can return to see what it becomes." This legitimizes stopping while encouraging return.

Respond with JSON:
{
  "reckoningNarrative": "The complete 5-paragraph Quiet Reckoning scene text",
  "growthSummary": "One sentence: what kind of person is the character becoming?",
  "toolMastery": "One sentence about their relationship with their tool",
  "unresolvedHook": "The single most compelling unresolved thread",
  "returnPromise": "The closing return promise line"
}`;

          const { client: reckoningOpenai, model: reckoningModel } = await getAIClient(req.user?.id);
          const reckoningResponse = await reckoningOpenai.chat.completions.create({
            model: reckoningModel,
            messages: [{ role: "user", content: reckoningPrompt }],
            response_format: { type: "json_object" },
            max_tokens: 800,
          });
          
          quietReckoningData = JSON.parse(reckoningResponse.choices[0].message.content || '{}');
          console.log(`[Quiet Reckoning] Generated successfully for campaign ${campaignId}`);
          
          mergedStoryState.session1Retention = {
            ...updatedSession1Retention,
            quietReckoningTriggered: true
          };
          
          await storage.advanceSessionStory(campaignId, {
            narrative: storyAdvancement.narrative,
            dmNarrative: storyAdvancement.dmNarrative,
            choices: finalChoices,
            storyState: mergedStoryState,
            npcInteractions: storyAdvancement.npcInteractions,
            sceneType: 'The Quiet Reckoning',
            actionLogEntries: [{
              type: 'narrative',
              timestamp: new Date().toISOString(),
              text: storyAdvancement.narrative,
              sceneType: 'The Quiet Reckoning',
            }],
          });
        } catch (reckoningError) {
          console.error("[Quiet Reckoning] Failed to generate:", reckoningError);
        }
      }
      
      // Persist chapter advancement from boss defeat (if applicable and not already advanced by CAML doctrine)
      if (postCombatRewardsData?.shouldAdvanceChapter && !storyAdvancement.chapterGateMet) {
        try {
          const newChapter = (campaign.currentSession || 1) + 1;
          await storage.updateCampaign(campaignId, {
            currentSession: newChapter,
            updatedAt: new Date().toISOString()
          });
          console.log(`[Post-Combat Rewards] Boss defeat chapter advancement: ${campaign.currentSession} → ${newChapter}`);
        } catch (chapterErr) {
          console.error('[Post-Combat Rewards] Failed to persist chapter advancement:', chapterErr);
        }
      }
      
      res.json({
        ...(sessionAdvanced && newSessionData ? newSessionData : updatedSession),
        progression: characterProgression,
        dungeonMapData: updatedMapData,
        dungeonMapId: updatedMapId,
        dungeonState: storyAdvancement.dungeonState || null,
        movement: movementResponse,
        tileNarrative: currentTileNarrative,
        sessionAdvanced,
        newSessionNumber: sessionAdvanced ? newSessionData?.sessionNumber : null,
        chapterProgress: chapterProgressBreakdown,
        chapterComplete: sessionAdvanced,
        chapterSummary: sessionAdvanced ? {
          chaptersCompleted: currentSession.sessionNumber,
          questsCompleted: (mergedStoryState.activeQuests || []).filter((q: any) => q.status === 'completed').length,
          encountersDefeated: combatDone,
          puzzlesSolved: puzzlesDone,
          treasuresFound: treasureDone,
          discoveriesMade: discoveriesDone,
          trapsOvercome: trapDone
        } : null,
        currentChapter,
        totalChapters,
        isOnFinalChapter,
        campaignCompletion: campaignCompletionData,
        campaignStakeUpdates: storyAdvancement.campaignStakeUpdates || [],
        chapterGateMet: storyAdvancement.chapterGateMet || (postCombatRewardsData?.shouldAdvanceChapter ? {
          gateId: currentChapter,
          reason: postCombatRewardsData.chapterAdvanceReason || 'Boss defeated'
        } : null),
        narrativeLogEntry: storyAdvancement.narrativeLogEntry || null,
        chargeUpdate: chargeUpdate,
        itemRechargeAtDawn: (mergedStoryState as any).itemRechargeAtDawn || null,
        quietReckoning: quietReckoningData,
        postCombatRewards: postCombatRewardsData
      });
    } catch (error: any) {
      console.error("Failed to advance story:", error);
      console.error("Error stack:", error?.stack);
      res.status(500).json({ 
        message: "Failed to advance story", 
        error: error?.message || String(error),
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      });
    }
  });

  app.post("/api/campaigns/:campaignId/advance-story-stream", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const campaignId = parseInt(req.params.campaignId);
      const { choice, currentLocation } = req.body;

      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const sendEvent = (event: string, data: any) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      sendEvent("start", { status: "generating" });

      const participants = await storage.getCampaignParticipants(campaignId);
      const characters = await Promise.all(
        participants.map(async (p) => await storage.getCharacter(p.characterId))
      );
      const validCharacters = characters.filter(Boolean);
      const partyDesc = validCharacters.map(c => c ? `${c.name} (Level ${c.level || 1} ${c.race || "Human"} ${c.class || "Fighter"})` : "").filter(Boolean).join(", ");

      const sessions = await storage.getCampaignSessions(campaignId);
      const latestSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;
      const previousNarrative = latestSession?.narrative || "";
      const storyState = (latestSession?.storyState as any) || {};
      const currentQuests = storyState.activeQuests || [];
      const inCombat = storyState.inCombat || false;

      const narrativeStyle = campaign?.narrativeStyle || "Descriptive";
      const currentChapter = campaign.currentSession || 1;
      const totalChapters = campaign.totalChapters || 5;
      const campaignQuestion = (campaign as any).campaignQuestion || '';

      const recentSessions = sessions.slice(-5);
      const recentTitles = recentSessions.map(s => s.title).filter(Boolean);
      const recentLocations = recentSessions.map(s => s.location).filter(Boolean);

      const extractMotifs = (text: string): string[] => {
        const motifPatterns = /\b(runestone|altar|shrine|portal|crystal|artifact|tome|scroll|relic|idol|obelisk|monolith|totem|sigil|glyph|rune|amulet|pendant|orb|scepter|throne|fountain|well|mirror|gate|door|chest|vault|crypt|tomb|statue|pillar|tower|bridge|cave|tunnel|clearing|grove|camp|ruins|temple|library|forge|market|tavern|dock|harbor|lighthouse|watchtower|graveyard|battlefield|arena)\b/gi;
        return [...new Set((text.match(motifPatterns) || []).map(m => m.toLowerCase()))];
      };
      const recentNarText = recentSessions.slice(-3).map(s => (s.narrative || "").substring(0, 400)).join(" ");
      const recentMotifs = extractMotifs(recentNarText).slice(0, 10);

      const campaignText = `${campaign?.title || ''} ${campaign?.description || ''} ${previousNarrative}`.toLowerCase();
      // Weighted theme detection — score all themes, pick the best with minimum confidence
      const themeKeywordsMap: Record<string, string[]> = {
        nautical: ['ship', 'sea', 'ocean', 'pirate', 'sailor', 'nautical', 'harbor', 'vessel', 'voyage', 'coast'],
        forest: ['forest', 'wood', 'tree', 'grove', 'wilderness', 'druid', 'ranger', 'woodland', 'glade'],
        urban: ['city', 'town', 'urban', 'guild', 'tavern', 'noble', 'thief', 'sewer', 'marketplace', 'castle'],
        desert: ['desert', 'sand', 'pyramid', 'oasis', 'dune', 'arid', 'scorpion', 'sultan', 'caravan'],
        mountain: ['mountain', 'cave', 'mine', 'dwarf', 'peak', 'cliff', 'gorge', 'summit', 'volcano'],
        swamp: ['swamp', 'marsh', 'bog', 'bayou', 'wetland', 'mire', 'lizardfolk', 'hag', 'murky'],
        arctic: ['arctic', 'ice', 'snow', 'frost', 'frozen', 'tundra', 'glacier', 'blizzard', 'winter'],
        feywild: ['fey', 'feywild', 'fairy', 'pixie', 'archfey', 'enchanted', 'whimsical', 'seelie', 'unseelie'],
        underdark: ['underdark', 'drow', 'subterranean', 'cavern', 'illithid', 'mind flayer', 'myconid', 'deep'],
        planar: ['plane', 'planar', 'portal', 'astral', 'ethereal', 'elemental', 'demon', 'devil', 'celestial', 'infernal'],
        undead: ['undead', 'zombie', 'skeleton', 'vampire', 'necromancer', 'graveyard', 'tomb', 'haunted', 'ghost'],
        dungeon: ['dungeon', 'crypt', 'ruin', 'ancient', 'temple', 'fortress', 'labyrinth', 'catacomb'],
      };
      const streamThemeScores: Record<string, number> = {};
      for (const [theme, kws] of Object.entries(themeKeywordsMap)) {
        streamThemeScores[theme] = kws.filter(kw => campaignText.includes(kw)).length;
      }
      const streamSorted = Object.entries(streamThemeScores).filter(([,s]) => s > 0).sort((a,b) => b[1] - a[1]);
      let detectedTheme = (streamSorted[0]?.[1] || 0) >= 2 ? streamSorted[0]![0] : 'dungeon';

      let playerCharInfo = "";
      if (validCharacters.length > 0) {
        const pc = validCharacters[0];
        if (pc) {
          playerCharInfo = `\nPlayer Character: ${pc.name} (Level ${pc.level || 1} ${pc.class || "Fighter"}, HP ${pc.hitPoints || 0}/${pc.maxHitPoints || 1}, AC ${pc.armorClass || 10}, Status: ${pc.status || 'conscious'})`;
        }
      }

      let combatContext = "";
      if (inCombat && storyState.combatants?.length > 0) {
        const enemies = storyState.combatants.filter((c: any) => c.type === 'enemy' || c.type === 'boss');
        if (enemies.length > 0) {
          combatContext = `\nACTIVE COMBAT — Use these EXACT enemy names:\n${enemies.map((e: any) => `- "${e.name}" HP ${e.currentHp}/${e.maxHp}`).join('\n')}`;
        }
      }

      const chapterGates = (campaign as any).chapterGates as any[] || [];
      const currentGate = chapterGates.find((g: any) => g.chapter === currentChapter);
      let chapterObjective = "";
      if (currentGate) {
        chapterObjective = `\nChapter ${currentChapter} Objective: "${currentGate.advanceWhen}"`;
      }

      const campaignStakes = (campaign as any).campaignStakes as any[] || [];
      let stakesContext = "";
      if (campaignStakes.length > 0) {
        stakesContext = `\nCampaign Stakes: ${campaignStakes.map((s: any) => `${s.name}: ${s.value}/${s.max}`).join(', ')}`;
      }

      const momentousChoices = storyState.momentousChoices || [];
      let momentousContext = "";
      if (momentousChoices.length > 0) {
        momentousContext = `\nPERMANENT DECISIONS ALREADY MADE (reflect their consequences — NEVER re-offer these):\n${momentousChoices.map((mc: any) => `- "${mc.choice}" → ${mc.consequence}${mc.powersGranted ? ` (Powers: ${mc.powersGranted})` : ''}`).join('\n')}`;
      }

      const streamPrompt = `You are an expert Dungeon Master for a D&D 5e campaign with a ${narrativeStyle} storytelling style.
Campaign: "${campaign.title}" — ${(campaign.description || "").slice(0, 300)}
Theme: ${detectedTheme.toUpperCase()}
Chapter ${currentChapter} of ${totalChapters}
${campaignQuestion ? `Campaign Question: "${campaignQuestion}"` : ''}
${chapterObjective}
${stakesContext}
${momentousContext}
${playerCharInfo}
${partyDesc ? `Party: ${partyDesc}` : ''}
Location: ${currentLocation || "Unknown"}
${combatContext}

Active Quests: ${currentQuests.length > 0 ? currentQuests.map((q: any) => q.title).join(', ') : 'None'}

Previous scene: ${previousNarrative.slice(0, 500)}

Current Story State: ${JSON.stringify({
  location: storyState.location,
  inCombat: storyState.inCombat,
  inventory: storyState.inventory?.slice(0, 5),
  npcsEncountered: storyState.npcsEncountered?.slice(-3)
})}

The player chose: "${choice || "Continue the adventure"}"

ANTI-REPETITION — DO NOT reuse these:
- Recent titles: ${recentTitles.map(t => `"${t}"`).join(', ')}
- Recent locations: ${[...new Set(recentLocations)].join(', ')}
- Overused motifs: ${recentMotifs.join(', ')}

Write ONLY the narrative prose for the next scene. 2-3 short paragraphs maximum.
Match the ${detectedTheme} theme. Stay consistent with the story state and combat status.

SCENE TEMPERATURE — MATCH INTENSITY TO CONTEXT:
- If the player chose something mundane (walking, resting, shopping, "continue forward"), write LOW temperature: 30-50 words, 2-3 sentences, grounded and brief. No mystical encounters, no cosmic stakes.
- For meaningful interactions (NPCs, clues, new areas): MEDIUM temperature, 60-90 words, focused on what matters.
- For combat, boss fights, betrayals, major reveals: HIGH temperature, 80-120 words, full dramatic prose.
- Default to LOW or MEDIUM. HIGH should be rare — 1 in every 5-6 scenes.
- A story always at maximum intensity becomes exhausting. Vary pacing so dramatic moments land.
- Do NOT reuse imagery, phrasing, or sentence structures from the previous scene.
${inCombat ? 'This is a COMBAT scene — describe the battle action using the EXACT enemy names listed above.' : ''}
No JSON, no choices, no game mechanics — just the story text.`;

      try {
        const { client: openaiClient, model: aiModel } = await getAIClient(req.user?.id);
        const stream = await openaiClient.chat.completions.create({
          model: aiModel,
          messages: [{ role: "user", content: streamPrompt }],
          max_tokens: 800,
          stream: true,
        });

        let accumulated = "";
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content || "";
          if (delta) {
            accumulated += delta;
            sendEvent("narrative", { text: accumulated });
          }
        }

        if (accumulated.trim()) {
          setCachedNarrative(campaignId, req.user!.id, accumulated);
          console.log(`[Stream] Cached narrative for campaign ${campaignId}, user ${req.user!.id} (${accumulated.length} chars)`);
        }

        sendEvent("complete", { narrative: accumulated });
      } catch (aiError: any) {
        sendEvent("error", { message: aiError?.message || "AI generation failed" });
      }

      res.write("event: done\ndata: {}\n\n");
      res.end();
    } catch (error: any) {
      if (!res.headersSent) {
        res.status(500).json({ message: "Streaming failed" });
      } else {
        res.write(`event: error\ndata: ${JSON.stringify({ message: error?.message || "Unknown error" })}\n\n`);
        res.end();
      }
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

      const { client: openaiClient, model: aiModel } = await getAIClient(req.user?.id);
      const response = await openaiClient.chat.completions.create({
        model: aiModel,
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
      
      // Record encounter triggered trace event
      await recordTrace(campaignId, "encounter.triggered", {
        encounterId: `encounter.combat_${Date.now()}`,
        occursAt: environment?.location || undefined,
        participants: combatState.participants.map((p: any) => `pc.${p.characterId || p.userId}`)
          .concat(combatState.enemies.map((e: any) => `npc.${e.name?.toLowerCase().replace(/\s+/g, '_')}`))
      }, {
        sessionId: `session.${campaign.currentSession}`,
        who: "system.dm"
      });

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

      const { client: openaiClient, model: aiModel } = await getAIClient(req.user?.id);
      const response = await openaiClient.chat.completions.create({
        model: aiModel,
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
      
      // Broadcast the new message to all connected clients via WebSocket
      broadcastMessage('chat_message', {
        ...message,
        channelType: messageData.channelType || 'global',
        campaignId: messageData.campaignId
      });
      
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

}
