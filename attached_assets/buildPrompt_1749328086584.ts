
// server/lib/buildPrompt.ts

import { DMContext } from "./openai";
import { storage } from '../storage';

interface Session {
  id: number;
  title: string;
  narrative: string;
  location: string;
  themes?: string;
  unresolvedHooks?: string[];
  npcs?: string[];
  playerActions?: string[];
  createdAt: string;
}

// Utility Functions

export function parseModifier(modifier: string): number {
  const match = modifier.trim().match(/([-+]?\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export function checkForStalling(narrative: string): boolean {
  const lines = narrative.split(/\n|\.\s/).map(l => l.trim()).filter(Boolean);
  const unique = new Set(lines);
  const repetitionRatio = (lines.length - unique.size) / lines.length;
  return repetitionRatio > 0.4 || narrative.toLowerCase().includes("you find yourself where you started");
}

// Prompt Builder

async function getCharacterProgression(campaignId: number) {
  const participants = await storage.getCampaignParticipants(campaignId);
  return participants.map(p => ({
    name: p.character.name,
    class: p.character.class,
    level: p.character.level || 1,
    recentActions: [],
    skillProficiencies: [],
    equipment: p.character.equipment || []
  }));
}

async function getActiveStoryArcs(campaignId: number) {
  return [
    {
      name: "Grove Corruption Mystery",
      status: "active",
      keyElements: ["corrupted guardian", "ancient altar", "Elowen's guidance"],
      nextMilestones: ["discover corruption source", "restore grove balance"]
    }
  ];
}

async function buildConsequencesTracker(sessionHistory: any[]) {
  const consequences = {
    unresolved: [],
    environmental: [],
    character: []
  };

  sessionHistory.forEach(session => {
    if (session.combatOutcome === 'victory') {
      consequences.environmental.push(`Defeated ${session.enemiesDefeated || 'creatures'} in ${session.location}`);
    }
    if (session.skillChecks?.some((check: any) => check.success)) {
      consequences.character.push(`Successfully used ${session.skillChecks.find((c: any) => c.success).abilityType} in ${session.location}`);
    }
  });

  return consequences;
}

export function buildEnhancedPrompt(context: any): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = \`You are an expert Dungeon Master for D&D 5e running "\${context.campaign.title}".

CORE PRINCIPLES:
- Respond to player actions with meaningful consequences that affect the world
- Integrate dice roll results naturally into the narrative and story progression
- Advance the story based on character choices, successes, and failures
- Build continuity from previous sessions rather than resetting scenarios
- Create escalating tension and meaningful character development

CURRENT CONTEXT:
Campaign: \${context.campaign.title}
Location: \${context.location}
Characters: \${context.characters.map((c: any) => c.name + " (level " + c.level + " " + c.class + ")").join(", ")}\`;

  let userPrompt = "";

  if (context.previousSession) {
    userPrompt += \`The last session ended with this scene:\n\${context.previousSession.narrative}\n\n\`;
  }

  if (context.lastRolls?.length) {
    userPrompt += "Recent skill checks:\n";
    context.lastRolls.forEach((roll: any) => {
      userPrompt += \`- \${roll.playerName} attempted a \${roll.skillName} check and rolled \${roll.result}.\n\`;
    });
    userPrompt += "\n";
  }

  if (context.unresolvedThreads?.length) {
    userPrompt += "Unresolved narrative threads:\n";
    context.unresolvedThreads.forEach((t: string) => {
      userPrompt += \`- \${t}\n\`;
    });
    userPrompt += "\n";
  }

  userPrompt += "Continue the narrative from the previous point, resolving relevant threads and responding to player actions.";

  return { systemPrompt, userPrompt };
}
