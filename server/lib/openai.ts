import OpenAI from "openai";
import { getAIClient } from "./aiProvider";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user

export interface CampaignGenerationRequest {
  theme?: string;
  difficulty?: string;
  narrativeStyle?: string;
  numberOfSessions?: number;
}

// CAML 2.0 State-First Types
export interface WorldStateFact {
  key: string; // e.g., "village_trust", "merchant_suspicion", "cult_awareness"
  value: number; // -100 to 100 scale (negative = hostile/low, positive = friendly/high)
  description: string; // Human-readable description of current state
}

export interface NPCAttitude {
  name: string;
  role: string; // Their role in the story
  attitude: number; // -100 to 100 (hostile to friendly)
  secrets: string[]; // What they know that players don't
  wants: string; // What they want
  blocksAccess?: string; // What scene/info they can block
  unlocksAccess?: string; // What scene/info they unlock when friendly
}

export interface PressureMeter {
  name: string; // e.g., "Corruption", "Town Stability", "Cult Awareness"
  current: number; // Current value (0-10)
  max: number; // Maximum before consequences trigger
  consequence: string; // What happens when maxed
  triggers: string[]; // What actions increase this meter
}

export interface AlternativePath {
  approach: string; // Name of the approach
  description: string; // How it works
  requirements: string; // State conditions needed
  consequences: string; // What changes if this path is taken
  exclusiveWith?: string[]; // Other path names that become BLOCKED if this is chosen
  isBlocked: boolean; // Whether this path is currently available
  blockedReason?: string; // Why this path is blocked (if it is)
}

// Global Stakes Track - world-level deterioration that advances regardless of player action
export interface GlobalStake {
  name: string; // e.g., "arcane_instability", "enemy_progress", "village_corruption"
  current: number; // Current value (starts at 0)
  max: number; // Maximum before catastrophic consequence
  advancesOn: string[]; // What causes this to increase: "scene_end", "failed_check", "inaction", specific actions
  consequence: string; // What happens when maxed (permanent world change)
  milestones?: { threshold: number; effect: string }[]; // Effects at intermediate values
}

// Enhanced NPC with reliability conditions - NPCs can become unreliable or hostile
export interface UnreliableNPC {
  name: string;
  role: string;
  attitude: number; // -100 to 100
  trustThreshold: number; // Below this, NPC becomes unreliable
  breakingPoints: string[]; // Actions that permanently break trust
  secretAgenda: string; // Hidden motivation that may conflict with players
  betrayalBehavior: "lies" | "withdraws" | "antagonizes" | "sabotages"; // What they do when trust broken
  isBroken: boolean; // Whether breaking point has been reached
  secrets: string[];
  wants: string;
  blocksAccess?: string;
  unlocksAccess?: string;
}

// Foreclosure - doors that seal permanently, knowledge that becomes inaccessible
export interface Foreclosure {
  name: string; // e.g., "Library Access", "Elder's Knowledge", "Sacred Grove"
  sealedWhen: string; // Condition that triggers foreclosure (e.g., "arcane_instability >= 5")
  consequence: string; // What is permanently lost
  isSealed: boolean; // Whether this has been foreclosed
  sealedReason?: string; // Why it was sealed (for narrative)
}

// Normative Residue - irreversible consequences that persist and constrain future play
export interface NormativeResidue {
  id: string; // e.g., "RES_TRUST_ELORIA"
  bearer: string; // Who carries the residue (NPC name, faction, place, institution, "party")
  bearerType: "npc" | "faction" | "place" | "institution" | "party";
  domain: "social" | "institutional" | "metaphysical" | "political" | "arcane";
  description: string; // Human-readable description
  severity: number; // Current severity level (starts at 0)
  maxSeverity: number; // Maximum before unrecoverable (usually 3)
  enduring: boolean; // Whether it persists across sessions
  visibleToPlayers: boolean; // Whether players know about this
  // Effects at each severity level
  effects: ResidueEffect[];
  // Non-reset constraints - what CANNOT remove this residue
  cannotBeRemovedBy: string[]; // e.g., ["long_rest", "spell", "explanation", "time_passage"]
}

export interface ResidueEffect {
  atSeverity: number; // At what severity level this effect activates
  effectType: "revoke_role" | "lock_access" | "flip_attitude" | "enable_process" | "block_path";
  target: string; // What is affected (role name, location, NPC, process, path)
  description: string; // What happens narratively
}

export interface ResidueTrigger {
  id: string; // e.g., "RT_LIBRARY_DESECRATION"
  causedBy: string; // Process, action, or condition that causes this
  condition: "failure" | "delay" | "refusal" | "recklessness" | "betrayal"; // Type of cause
  producesResidueId: string; // Which residue this creates/increases
  delta: number; // How much severity increases (+1, +2, etc.)
  reason: string; // Narrative reason for the residue
}

export interface RepairPathway {
  id: string; // e.g., "REPAIR_RECONCILE_ELORIA"
  targetsResidueId: string; // Which residue this can repair
  cost: {
    time?: string; // e.g., "1_session", "downtime"
    sacrifice?: string; // e.g., "ITEM_RARE", "opportunity"
    risk?: string; // What you're risking
  };
  requiresSeverityAtMost: number; // Cannot repair if severity exceeds this
  successChance: number; // 0-100% base success chance
  outcomes: {
    onSuccess: { delta: number; narrative: string }; // e.g., -1 severity
    onFailure: { delta: number; narrative: string }; // e.g., +1 severity (makes it worse)
  };
  canBeRefused: boolean; // NPC/institution can refuse to even try
}

// Procedural Quest Generation - quests generated from world state conditions
export interface QuestTrigger {
  id: string; // e.g., "QT_HIGH_SUSPICION"
  triggerType: "state_threshold" | "npc_attitude" | "pressure_meter" | "player_action" | "location_visit" | "residue_level";
  condition: {
    stateKey?: string; // For state_threshold: which worldState key
    npcName?: string; // For npc_attitude: which NPC
    meterName?: string; // For pressure_meter: which meter
    residueId?: string; // For residue_level: which residue
    operator: ">=" | "<=" | "==" | ">" | "<";
    threshold: number;
  };
  questTemplateId: string; // Which template to generate from
  priority: number; // Higher priority triggers first (1-10)
  cooldownScenes: number; // How many scenes before this can trigger again
  maxGenerations: number; // Maximum times this trigger can fire (0 = unlimited)
  generationCount?: number; // Current count of times triggered
}

export interface QuestTemplate {
  id: string; // e.g., "TEMPLATE_INVESTIGATE_CORRUPTION"
  category: "investigation" | "rescue" | "retrieval" | "escort" | "elimination" | "negotiation" | "exploration" | "defense";
  titlePatterns: string[]; // e.g., ["The Missing {NPC}", "{LOCATION} Mystery", "Shadows in {LOCATION}"]
  descriptionPattern: string; // Template with placeholders
  objectivePatterns: string[]; // Templates for objectives
  contextRequirements: {
    requiresActiveNPC?: boolean; // Needs an NPC to reference
    requiresLocation?: boolean; // Needs a specific location
    requiresItem?: boolean; // Needs a specific item
    requiresThreat?: boolean; // Needs an active threat/enemy
  };
  rewards: {
    xpBase: number;
    goldBase: number;
    stateChanges?: { key: string; delta: number }[]; // State changes on completion
    npcAttitudeChanges?: { name: string; delta: number }[]; // NPC attitude changes
  };
  difficulty: "easy" | "moderate" | "challenging" | "deadly";
  estimatedDuration: string; // "1 session", "2-3 sessions"
}

export interface ProceduralQuestConfig {
  triggers: QuestTrigger[];
  templates: QuestTemplate[];
  globalSettings: {
    maxActiveProceduralQuests: number; // Cap on how many procedural quests can be active
    minScenesBetweenQuests: number; // Minimum scenes between procedural quest generation
    questChanceModifier: number; // 0-100, affects probability of quest generation
  };
}

export interface CampaignStake {
  id: string;
  name: string;
  value: number;
  max: number;
  description: string;
  worsensWhen: string[];
  improvesWhen: string[];
}

export interface ChapterGate {
  chapter: number;
  advanceWhen: string;
  requiredTruth?: string;
  requiredCommitment?: string;
  requiredBeliefChange?: string;
}

export interface CampaignGenerationResponse {
  title: string;
  description: string;
  difficulty: string;
  narrativeStyle: string;
  startingLocation: string;
  mainNPC: string;
  mainQuest: string;
  sideQuests: string[];
  suggestedLevel: number;
  // DM Authoring Doctrine - Campaign Spine
  campaignQuestion: string;
  campaignStakes: CampaignStake[];
  chapterGates: ChapterGate[];
  // CAML 2.0 State-First Adventure Fields
  worldState: WorldStateFact[];
  npcAttitudes: NPCAttitude[];
  pressureMeters: PressureMeter[];
  availablePaths: AlternativePath[];
  // CAML 2.0 World Deterioration Fields
  globalStakes: GlobalStake[];
  unreliableNPCs: UnreliableNPC[];
  foreclosures: Foreclosure[];
  // CAML 2.0 Normative Residue System
  normativeResidues: NormativeResidue[];
  residueTriggers: ResidueTrigger[];
  repairPathways: RepairPathway[];
  // Procedural Quest Generation System
  proceduralQuestConfig: ProceduralQuestConfig;
}

export async function generateCampaign(req: CampaignGenerationRequest, userId?: number): Promise<CampaignGenerationResponse> {
  try {
    const { client: openai, model } = await getAIClient(userId);

    const prompt = `
You are designing a STATE-FIRST adventure using CAML (Canonical Adventure Markup Language) principles.
The key principle: Design facts that can change, then make scenes care about them. If nothing changes, nothing branches.

Create a D&D campaign with the following parameters:
${req.theme ? `Theme: ${req.theme}` : 'Theme: Fantasy (create a suitable theme if none specified)'}
${req.difficulty ? `Difficulty: ${req.difficulty}` : 'Difficulty: Normal (balanced challenge)'}
${req.narrativeStyle ? `Narrative Style: ${req.narrativeStyle}` : 'Narrative Style: Descriptive'}
${req.numberOfSessions ? `Expected Number of Sessions: ${req.numberOfSessions}` : 'Expected Number of Sessions: 5'}

═══════════════════════════════════════════════════════════════════════════════
DM AUTHORING DOCTRINE (MANDATORY - These are not suggestions, they are constraints)
═══════════════════════════════════════════════════════════════════════════════

RULE 1 — WRITE THE CAMPAIGN QUESTION FIRST:
Before NPCs, maps, or lore, answer: "What is the player actually deciding about the world?"
If you cannot state this in one sentence, the adventure will drift.

RULE 2 — DECLARE STAKES BEFORE PLAY:
- 2-4 stakes ONLY, each ranges 0-5
- Each can go UP or DOWN based on player choices
- Every meaningful action MUST touch at least one stake
- If an action does not change a stake, it should not exist

RULE 3 — BAN FREE ACTIONS:
If a choice can be repeated without cost, it is NOT a choice.
Every action must: Cost something, Close something, or Escalate something.
Even asking questions should have social or narrative cost.

RULE 4 — COMBAT IS CONSEQUENCE, NOT MODE:
Combat must: Trigger because of stakes, Advance stakes even when won, Never be the safest option.
Test: "What gets worse even if they win this fight?" If the answer is "nothing", the fight shouldn't exist.

RULE 5 — CHAPTERS ADVANCE BY MEANING, NOT TIME:
Chapters advance when: A belief changes, A truth is learned, A commitment is made.
NEVER advance chapters because "enough stuff happened".

RULE 6 — LOG WHY THINGS MATTER:
Always annotate: Why XP was awarded, Why a chapter advanced, Why an option disappeared.

═══════════════════════════════════════════════════════════════════════════════

Generate a complete D&D campaign in JSON format with these fields:

BASIC INFO:
- title: A catchy title for the campaign
- description: A compelling 3-4 sentence description that outlines the main themes and hooks
- difficulty: The campaign difficulty (Easy, Normal, Hard)
- narrativeStyle: The narrative style (Descriptive, Dramatic, Humorous, etc.)
- startingLocation: Where the adventure begins
- mainNPC: The key non-player character that drives the plot
- mainQuest: The primary objective of the campaign
- sideQuests: An array of 3 side quests that complement the main story
- suggestedLevel: Recommended starting character level (1-10)

CAMPAIGN SPINE (NEW - REQUIRED):

- campaignQuestion: A ONE SENTENCE question that defines what the player is deciding about the world.
  Example: "What is failing beneath Eldermoor, who is responsible for maintaining it, and what breaks if the wards are restored, repurposed, or ignored?"
  This question must be answerable through play, and every chapter must move it forward.

- campaignStakes: An array of 2-4 campaign stakes (NOT the same as globalStakes). Each has:
  - id: Snake_case identifier (e.g., "ward_integrity", "spirit_alignment")
  - name: Human-readable name (e.g., "Ward Integrity")
  - value: Starting value (0-5, usually 2-3 to allow movement in both directions)
  - max: Always 5
  - description: Current state in plain language
  - worsensWhen: Array of 2-3 player actions or conditions that decrease this stake
  - improvesWhen: Array of 2-3 player actions or conditions that increase this stake
  Every choice the AI generates MUST touch at least one stake. Stakes that reach 0 or 5 should trigger consequences.

- chapterGates: An array with one entry per chapter. Each has:
  - chapter: Chapter number (1, 2, 3, etc.)
  - advanceWhen: One-sentence description of what must be understood/committed to advance
  - requiredTruth: (optional) A truth the player must discover (e.g., "The guardians are intentional, not accidental")
  - requiredCommitment: (optional) A commitment the player must make (e.g., "Choose to help or abandon the village")
  - requiredBeliefChange: (optional) A belief that must shift (e.g., "The forest's silence is maintained, not natural")
  Each gate must have at least one of requiredTruth, requiredCommitment, or requiredBeliefChange.

CAML STATE-FIRST FIELDS:

- worldState: An array of 4-6 state facts that CAN CHANGE during play. Each has:
  - key: Snake_case identifier (e.g., "village_trust", "cult_awareness", "guard_suspicion")
  - value: Starting value from -100 to 100 (negative=hostile/low, positive=friendly/high)
  - description: Current state in plain language (e.g., "The villagers are wary of outsiders")
  Focus on: trust, suspicion, fear, corruption, stability, awareness, who knows what, who owes whom

- npcAttitudes: An array of 3-4 key NPCs who are DECISION-MAKERS. Each has:
  - name: NPC name
  - role: Their role in the story
  - attitude: Starting attitude -100 to 100 (hostile to friendly)
  - secrets: Array of 1-2 things they know that players don't
  - wants: What they want (drives their behavior)
  - blocksAccess: (optional) What scene/info they can block if hostile
  - unlocksAccess: (optional) What scene/info they unlock when friendly
  
- pressureMeters: An array of 2-3 pressure clocks that create urgency. Each has:
  - name: Clock name (e.g., "Corruption Spreading", "Town Stability", "Cult Ritual Progress")
  - current: Starting value (0-3)
  - max: Maximum before consequences (usually 10)
  - consequence: What happens when maxed out
  - triggers: Array of 2-3 actions that increase this meter
  
- availablePaths: An array of 2-3 different approaches to the main problem. Each has:
  - approach: Name of this path (e.g., "Diplomatic Solution", "Direct Confrontation", "Stealth Infiltration")
  - description: How this approach works
  - requirements: What state conditions make this path viable
  - consequences: What changes if this path is taken
  - exclusiveWith: Array of other path names that become BLOCKED if this path is chosen (for mutually exclusive outcomes)
  - isBlocked: false (always start as available)

WORLD DETERIORATION (The world moves without the players):

- globalStakes: An array of 1-2 world-level deterioration tracks that advance REGARDLESS of player action. Each has:
  - name: Snake_case identifier (e.g., "arcane_instability", "enemy_progress", "plague_spread")
  - current: Starting value (always 0)
  - max: Maximum before catastrophic consequence (usually 10)
  - advancesOn: Array of what causes this to increase: "scene_end" (every scene), "inaction", "failed_check", or specific actions
  - consequence: What happens when maxed (PERMANENT world change - can't be undone)
  - milestones: Array of intermediate effects at thresholds, e.g., [{ threshold: 3, effect: "Strange sounds echo" }, { threshold: 6, effect: "The ground trembles" }]
  
- unreliableNPCs: Pick 1-2 key NPCs and make them CONDITIONALLY UNRELIABLE. Each has:
  - name: NPC name (should match an NPC from npcAttitudes)
  - role: Their role
  - attitude: Starting attitude
  - trustThreshold: Below this attitude value, NPC becomes unreliable (-20 to 20)
  - breakingPoints: Array of 1-2 actions that PERMANENTLY break trust (e.g., "Accuse them publicly", "Discover their secret and threaten exposure")
  - secretAgenda: Hidden motivation that may conflict with players
  - betrayalBehavior: What they do when trust broken: "lies", "withdraws", "antagonizes", or "sabotages"
  - isBroken: false (always start as not broken)
  - secrets, wants, blocksAccess, unlocksAccess: Same as npcAttitudes

- foreclosures: An array of 2-3 doors that can SEAL PERMANENTLY. Each has:
  - name: What can be lost (e.g., "Library Access", "Elder's Blessing", "Peaceful Resolution")
  - sealedWhen: Condition that triggers foreclosure (e.g., "arcane_instability >= 5", "elder_trust < -50", "guard_suspicion >= 80")
  - consequence: What is PERMANENTLY lost - be specific (e.g., "The ancient scrolls are destroyed, their knowledge lost forever")
  - isSealed: false (always start as available)

NORMATIVE RESIDUE (Some things cannot be fixed):

- normativeResidues: An array of 1-2 lasting consequences that persist and constrain future play. Each has:
  - id: Unique identifier (e.g., "RES_TRUST_ELORIA", "RES_TEMPLE_DESECRATION")
  - bearer: Who carries this residue (NPC name, faction, place, "party")
  - bearerType: "npc" | "faction" | "place" | "institution" | "party"
  - domain: "social" | "institutional" | "metaphysical" | "political" | "arcane"
  - description: What this residue represents (e.g., "Loss of Archmage Eloria's trust due to recklessness")
  - severity: 0 (always start at 0)
  - maxSeverity: 3 (when reached, this is UNRECOVERABLE)
  - enduring: true
  - visibleToPlayers: true or false
  - effects: Array of effects that activate at each severity level:
    - { atSeverity: 1, effectType: "revoke_role", target: "Advisor", description: "No longer trusted as advisor" }
    - { atSeverity: 2, effectType: "lock_access", target: "Sanctum", description: "Access to inner sanctum denied" }
    - { atSeverity: 3, effectType: "flip_attitude", target: "hostile", description: "NPC becomes openly hostile" }
  - cannotBeRemovedBy: ["long_rest", "spell", "explanation", "time_passage"] (what CANNOT fix this)

- residueTriggers: An array of 2-3 conditions that CREATE or INCREASE residue. Each has:
  - id: Unique identifier (e.g., "RT_LIBRARY_DESECRATION")
  - causedBy: What triggers this (action, failure, delay) - MUST be tied to player CHOICE
  - condition: "failure" | "delay" | "refusal" | "recklessness" | "betrayal"
  - producesResidueId: Which residue this affects
  - delta: How much severity increases (+1 or +2)
  - reason: Narrative explanation

- repairPathways: An array of 1-2 costly, risky ways to reduce residue. Each has:
  - id: Unique identifier
  - targetsResidueId: Which residue this can repair
  - cost: { time: "1_session" or "downtime", sacrifice: "ITEM_RARE" or "opportunity", risk: "what you're risking" }
  - requiresSeverityAtMost: 2 (cannot repair at max severity)
  - successChance: 50-70 (repair can FAIL)
  - outcomes: { onSuccess: { delta: -1, narrative: "..." }, onFailure: { delta: +1, narrative: "..." } }
  - canBeRefused: true (NPC/institution can refuse to even try)

MINIMAL COMPLIANCE: Every adventure MUST have at least one residue that can reach an unrecoverable state (severity 3) with at least one trigger that can generate it.

PROCEDURAL QUEST GENERATION (Quests that emerge from world state):

- proceduralQuestConfig: A configuration object for generating quests dynamically based on world state. Contains:
  - triggers: Array of 3-5 quest triggers that fire when conditions are met. Each has:
    - id: Unique identifier (e.g., "QT_HIGH_CORRUPTION", "QT_NPC_HOSTILE")
    - triggerType: One of "state_threshold", "npc_attitude", "pressure_meter", "residue_level"
    - condition: Object with:
      - stateKey or npcName or meterName or residueId (depending on triggerType)
      - operator: ">=" | "<=" | ">" | "<" | "=="
      - threshold: Number value to compare against
    - questTemplateId: Which template to use (reference a template id below)
    - priority: 1-10 (higher fires first)
    - cooldownScenes: 3-5 (scenes before can trigger again)
    - maxGenerations: 1-3 (max times this can fire, 0 = unlimited)
  
  - templates: Array of 3-4 quest templates that can be instantiated. Each has:
    - id: Unique identifier (e.g., "TEMPLATE_INVESTIGATE", "TEMPLATE_RESCUE")
    - category: "investigation" | "rescue" | "retrieval" | "escort" | "elimination" | "negotiation" | "exploration" | "defense"
    - titlePatterns: Array of 2-3 title templates with {NPC}, {LOCATION}, {THREAT} placeholders
    - descriptionPattern: Template for quest description with placeholders
    - objectivePatterns: Array of 2-3 objective templates
    - contextRequirements: { requiresActiveNPC: true/false, requiresLocation: true/false, requiresThreat: true/false }
    - rewards: { xpBase: 50-200, goldBase: 25-100, stateChanges: [{ key: "state_key", delta: +/-10 }] }
    - difficulty: "easy" | "moderate" | "challenging" | "deadly"
    - estimatedDuration: "1 session" or "2-3 sessions"
  
  - globalSettings: Object with:
    - maxActiveProceduralQuests: 3 (cap on active procedural quests)
    - minScenesBetweenQuests: 2 (minimum scenes between procedural quests)
    - questChanceModifier: 70 (percentage chance when trigger fires)

DESIGN GUIDELINES FOR PROCEDURAL QUESTS:
- Triggers should respond to INTERESTING states (high corruption leads to investigation, hostile NPC leads to negotiation/rescue)
- Templates should be SPECIFIC to the adventure's theme and location
- Quests should have MEANINGFUL consequences (state changes, NPC attitude shifts)
- Avoid generic "fetch X" quests - tie them to the narrative

Format the response as a valid JSON object without explanation.
`;

    const response = await openai.chat.completions.create({
      model: model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result as CampaignGenerationResponse;
  } catch (error) {
    console.error("Error generating campaign with OpenAI:", error);
    throw new Error("Failed to generate campaign. Please try again later.");
  }
}