import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
  // CAML 2.0 State-First Adventure Fields
  worldState: WorldStateFact[]; // Initial state facts that can change
  npcAttitudes: NPCAttitude[]; // Key NPCs with attitudes and goals
  pressureMeters: PressureMeter[]; // Tension clocks that drive urgency
  availablePaths: AlternativePath[]; // Multiple approaches to the main obstacle
}

export async function generateCampaign(req: CampaignGenerationRequest): Promise<CampaignGenerationResponse> {
  try {
    const prompt = `
You are designing a STATE-FIRST adventure using CAML (Canonical Adventure Markup Language) principles.
The key principle: Design facts that can change, then make scenes care about them. If nothing changes, nothing branches.

Create a D&D campaign with the following parameters:
${req.theme ? `Theme: ${req.theme}` : 'Theme: Fantasy (create a suitable theme if none specified)'}
${req.difficulty ? `Difficulty: ${req.difficulty}` : 'Difficulty: Normal (balanced challenge)'}
${req.narrativeStyle ? `Narrative Style: ${req.narrativeStyle}` : 'Narrative Style: Descriptive'}
${req.numberOfSessions ? `Expected Number of Sessions: ${req.numberOfSessions}` : 'Expected Number of Sessions: 5'}

DESIGN PHILOSOPHY:
- Scenes are tests of current state, not fixed chapters
- Failure should change the world, never just "try again"
- NPCs must be decision-makers with wants and attitudes
- Design multiple paths, not plots - let state decide which remain available
- Pressure meters create urgency and consequences

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

Format the response as a valid JSON object without explanation.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
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