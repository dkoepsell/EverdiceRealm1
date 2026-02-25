import { Express, Response } from "express";
import OpenAI from "openai";

interface RevealContext {
  choice: string;
  location: string;
  inCombat: boolean;
  theme: string;
}

const REVEAL_TEMPLATES: Record<string, string[]> = {
  combat: [
    "You steel yourself and act. The clash of battle shifts around you, and something changes in the enemy's stance.",
    "Your weapon finds its mark — or misses. Either way, the fight is not over yet.",
    "The air crackles with tension as you commit to the action. Your opponent reacts.",
    "Adrenaline surges as you make your move. The battlefield holds its breath.",
    "Your muscles coil and release. For a heartbeat, the outcome hangs in the balance.",
  ],
  exploration: [
    "You move forward. The environment shifts subtly around you, as if the world is responding to your presence.",
    "You take the path ahead. The air changes, and new details emerge from the shadows.",
    "Your footsteps carry you onward. Something ahead demands your attention.",
    "Curiosity pulls you deeper. The landscape unfolds with each careful step.",
    "The ground beneath you tells a story of its own. You press on, watchful.",
    "A distant sound catches your ear. The path ahead twists into the unknown.",
  ],
  social: [
    "You speak. The words hang in the air between you, and you watch for a reaction.",
    "Your voice carries weight here. The response comes slowly, measured.",
    "A conversation begins — or shifts. What follows depends on what you said.",
    "Eyes meet. There's a pause, heavy with meaning, before anyone responds.",
    "Your words ripple outward. Someone listens more carefully than you expected.",
  ],
  waypoint: [
    "The road stretches ahead. You walk on, steady and unhurried.",
    "Your boots find the familiar rhythm of travel. The landscape shifts quietly around you.",
    "The path continues. Wind and dust are your only companions for now.",
    "You press forward. The terrain changes gradually as you cover ground.",
    "One step after another. The journey is uneventful, the destination drawing closer.",
    "The trail bends ahead. You follow it without incident.",
  ],
  default: [
    "You act decisively. The world responds, though not all consequences are yet visible.",
    "Your choice resonates through the moment. Something is about to change.",
    "You commit to the action. The outcome begins to unfold.",
    "A decision made. The threads of fate adjust around you, unseen but felt.",
    "The moment crystallizes. What comes next will reveal whether fortune favors you.",
  ],
};

const WAYPOINT_TRAVEL_RE = /\b(walk|continue|head\s+(north|south|east|west|forward|back|onward)|travel|proceed|move\s+(on|forward|ahead|along)|go\s+(to|forward|north|south|east|west|ahead|on)|keep\s+(going|walking|moving)|press\s+(on|forward|ahead)|march|trek|follow\s+the\s+(path|road|trail|river)|take\s+the\s+(path|road|trail)|carry\s+on|advance|wander|stroll|ride\s+(on|forward|ahead)|set\s+off|set\s+out|leave|depart|make\s+(my|our)\s+way)\b/i;

function isWaypointTravel(action: string): boolean {
  if (!action) return false;
  const lower = action.toLowerCase().trim();
  if (WAYPOINT_TRAVEL_RE.test(lower)) {
    if (/\b(attack|fight|strike|cast|shoot|fire|slash|stab|kill|ambush|charge)\b/i.test(lower)) return false;
    if (/\b(talk|speak|ask|persuade|negotiate|interrogate|convince|intimidate|bribe)\b/i.test(lower)) return false;
    if (/\b(search|examine|inspect|investigate|study|analyze|read|decipher|open|pick\s+lock|disarm)\b/i.test(lower)) return false;
    return true;
  }
  return false;
}

function getRevealCategory(choice: string, inCombat: boolean): string {
  if (inCombat) return 'combat';
  const lower = choice.toLowerCase();
  if (/\b(attack|strike|slash|fight|cast|fire|shoot)\b/.test(lower)) return 'combat';
  if (/\b(talk|speak|ask|persuade|negotiate|say|tell|convince|intimidate)\b/.test(lower)) return 'social';
  if (isWaypointTravel(choice)) return 'waypoint';
  if (/\b(move|go|explore|enter|travel|walk|search|look|investigate)\b/.test(lower)) return 'exploration';
  return 'default';
}

function getTemplateReveal(context: RevealContext): string {
  const category = getRevealCategory(context.choice, context.inCombat);
  const templates = REVEAL_TEMPLATES[category] || REVEAL_TEMPLATES.default;
  return templates[Math.floor(Math.random() * templates.length)];
}

export function registerStreamingRoutes(app: Express) {
  app.post("/api/campaigns/:campaignId/story-reveal", async (req: any, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { choice, inCombat, location, campaignTitle } = req.body;

      if (!choice) {
        return res.status(400).json({ message: "Choice is required" });
      }

      let theme = 'dungeon';
      const titleLower = (campaignTitle || '').toLowerCase();
      if (/ship|sea|ocean|pirate|nautical|harbor/i.test(titleLower)) theme = 'nautical';
      else if (/forest|wood|tree|grove|wilderness/i.test(titleLower)) theme = 'forest';
      else if (/city|town|urban|guild|tavern/i.test(titleLower)) theme = 'urban';
      else if (/desert|sand|pyramid|oasis/i.test(titleLower)) theme = 'desert';
      else if (/mountain|cave|mine|dwarf/i.test(titleLower)) theme = 'mountain';

      const context: RevealContext = {
        choice,
        location: location || 'Unknown',
        inCombat: inCombat || false,
        theme
      };

      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const openerStyles = [
          "Start with the player's physical action in a vivid, specific way",
          "Start with an environmental reaction to the player's choice",
          "Start with a sensory detail (sound, smell, temperature) before describing the action",
          "Start mid-action, as if cutting into the moment cinematically",
          "Start with a short, punchy sentence fragment, then expand",
        ];
        const sensePool = ["sound", "light or shadow", "temperature or wind", "smell or taste", "texture or vibration"];
        const hookStyles = [
          "end with something unseen reacting",
          "end with a brief silence that feels meaningful",
          "end with a subtle environmental shift",
          "end with the hint of a presence watching",
          "end with a question implied by the environment",
        ];
        const opener = openerStyles[Math.floor(Math.random() * openerStyles.length)];
        const sense = sensePool[Math.floor(Math.random() * sensePool.length)];
        const hook = hookStyles[Math.floor(Math.random() * hookStyles.length)];

        const isWaypoint = isWaypointTravel(choice);

        const waypointPrompt = `You are a D&D narrator writing a BRIEF travel transition (max 20 words). The player is simply moving — no encounters, no drama.

Player action: "${choice}"
Location: ${context.location}
Setting: ${context.theme}

Write 1 sentence describing the journey in passing — terrain, weather, a small grounded detail. No mysteries, no tension, no glowing anything.
Max 20 words. Narrative text only, no JSON, no quotes.`;

        const fullPrompt = `You are a D&D narrator writing a 2-3 sentence teaser (max 40 words). Acknowledge the player's action and build tension.

Player action: "${choice}"
Location: ${context.location}
In combat: ${context.inCombat}
Setting: ${context.theme}

STYLE for this one:
- ${opener}
- Include a ${sense} detail
- ${hook}

RULES:
- Do NOT name specific NPCs, enemies, or outcomes
- Do NOT mention damage numbers, loot, or combat results
- Do NOT start new plot threads
- NEVER start with "You step forward" — vary your openings
- Max 40 words. Narrative text only, no JSON, no quotes.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{
            role: "user",
            content: isWaypoint ? waypointPrompt : fullPrompt
          }],
          max_tokens: isWaypoint ? 40 : 80,
          temperature: isWaypoint ? 0.5 : 0.9,
        });

        const revealText = response.choices[0]?.message?.content?.trim() || getTemplateReveal(context);
        return res.json({ revealText });
      } catch (aiError) {
        console.error('[Reveal] AI generation failed, using template:', aiError);
        return res.json({ revealText: getTemplateReveal(context) });
      }

    } catch (error) {
      console.error('[Reveal] Fatal error:', error);
      return res.status(500).json({ message: 'Reveal generation failed' });
    }
  });
}
