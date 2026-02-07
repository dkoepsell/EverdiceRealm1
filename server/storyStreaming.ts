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
  ],
  exploration: [
    "You move forward. The environment shifts subtly around you, as if the world is responding to your presence.",
    "You take the path ahead. The air changes, and new details emerge from the shadows.",
    "Your footsteps carry you onward. Something ahead demands your attention.",
  ],
  social: [
    "You speak. The words hang in the air between you, and you watch for a reaction.",
    "Your voice carries weight here. The response comes slowly, measured.",
    "A conversation begins — or shifts. What follows depends on what you said.",
  ],
  default: [
    "You act decisively. The world responds, though not all consequences are yet visible.",
    "Your choice resonates through the moment. Something is about to change.",
    "You commit to the action. The outcome begins to unfold.",
  ],
};

function getRevealCategory(choice: string, inCombat: boolean): string {
  if (inCombat) return 'combat';
  const lower = choice.toLowerCase();
  if (/\b(attack|strike|slash|fight|cast|fire|shoot)\b/.test(lower)) return 'combat';
  if (/\b(talk|speak|ask|persuade|negotiate|say|tell|convince|intimidate)\b/.test(lower)) return 'social';
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

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{
            role: "user",
            content: `You are a D&D narrator. Generate exactly 2-3 SHORT sentences (max 40 words total) that acknowledge the player's action and create tension.

Player action: "${choice}"
Location: ${context.location}
In combat: ${context.inCombat}
Setting: ${context.theme}

RULES (critical):
- Confirm the action was taken ("You step forward", "You speak up", "Your blade arcs")
- Add one sensory detail (sound, light, temperature, smell)
- End with a tension hook that implies consequence WITHOUT specifying it
- Do NOT name specific NPCs, enemies, or outcomes
- Do NOT mention combat results, damage, or specific loot
- Do NOT start new plot threads
- Keep it under 40 words

Respond with ONLY the narrative text, no JSON, no quotes.`
          }],
          max_tokens: 80,
          temperature: 0.7,
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
