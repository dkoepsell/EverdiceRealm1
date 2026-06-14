/**
 * Generates AI innkeeper welcome greetings for returning players at the Hearth.
 * Voiced as the innkeeper of Lantern Hall — warm, slightly mystical, personal.
 */
import { getAppAI } from "./aiProvider";

export interface StreakReward {
  type: "hint" | "inspiration" | "lore_drop" | "patron_title";
  description: string;
}

/**
 * Returns the streak reward for a given return streak count.
 * Returns null if no milestone is hit.
 */
export function getStreakReward(streak: number, today: string, rewardClaimedAt?: string | null): StreakReward | null {
  // Only award once per calendar day per milestone
  if (rewardClaimedAt === today) return null;

  if (streak >= 30) {
    return {
      type: "patron_title",
      description: "You have become a Patron of the Hearth. The hall recognizes you — your name is spoken with respect.",
    };
  }
  if (streak >= 14) {
    return {
      type: "lore_drop",
      description: "A traveler presses a sealed scroll into your hands. It speaks of a secret corner of the realm few have found.",
    };
  }
  if (streak >= 7) {
    return {
      type: "inspiration",
      description: "The Hearth grants you Inspiration. Declare it at any moment today to gain advantage on a single roll.",
    };
  }
  if (streak >= 3) {
    return {
      type: "hint",
      description: "The innkeeper leans close: 'The road ahead has a turn most miss. Your DM will know what I mean.'",
    };
  }
  return null;
}

/**
 * Generate a personalized return greeting from the innkeeper.
 * Returns null if AI is unavailable.
 */
export async function generateReturnGreeting(
  characterName: string | null,
  streak: number,
  campaignTitle: string | null
): Promise<string | null> {
  try {
    const { client, model } = getAppAI();

    const systemPrompt = `You are the innkeeper of Lantern Hall, a beloved gathering place for adventurers.
Write a warm, personal welcome for a returning adventurer — exactly 2-3 sentences.
Rules:
- Use second person ("you", "your")
- Reference the character's name naturally if given
- Acknowledge the return streak by feel, not by number (e.g. "the fire has kept your seat again" not "you've returned 7 days in a row")
- Slightly mystical, never sentimental or cloying
- Never mention "streak", "points", "reward", or game mechanics
- If a campaign title is given, weave it in briefly`;

    const parts: string[] = [];
    if (characterName) parts.push(`Adventurer's name: ${characterName}`);
    if (campaignTitle) parts.push(`Current campaign: "${campaignTitle}"`);
    parts.push(`Return streak: ${streak} days`);

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: parts.join("\n") },
      ],
      max_tokens: 100,
      temperature: 0.9,
    });

    return response.choices[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}
