/**
 * Generates AI "cliffhanger hooks" — a 1-2 sentence DM-voice teaser shown
 * on the campaign card to lure the player back into an unfinished session.
 */
import { getAppAI } from "./aiProvider";

/**
 * Generate a cliffhanger hook for a campaign session.
 *
 * @param lastNarrative  - The most recent narrative text shown to the player.
 * @param storyState     - Parsed storyState JSON from the session (used for context).
 * @param campaignTitle  - Campaign name for flavor.
 * @returns A 1-2 sentence hook string, or null if generation fails.
 */
export async function generateCliffhangerHook(
  lastNarrative: string,
  storyState: any,
  campaignTitle: string
): Promise<string | null> {
  try {
    const { client, model } = getAppAI();

    // Build a brief context excerpt from the last narrative (cap at 600 chars)
    const narrativeExcerpt = lastNarrative?.slice(-600) || "";

    // Pull the unresolved tension from storyState if available
    const pendingHook =
      storyState?.activeHook ||
      storyState?.openQuestion ||
      storyState?.chapterObjective ||
      "";

    const systemPrompt = `You are a Dungeon Master ending a session note. Write exactly 1-2 sentences in evocative, past-tense second-person DM voice. End on unresolved tension — a threat not yet faced, a question not yet answered, a choice not yet made. Do not resolve anything. Maximum 80 words. No quotation marks around the whole thing.`;

    const userPrompt = `Campaign: "${campaignTitle}"

Last scene:
${narrativeExcerpt}

${pendingHook ? `Unresolved thread: ${pendingHook}` : ""}

Write the cliffhanger hook.`;

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 120,
      temperature: 0.85,
    });

    const hook = response.choices[0]?.message?.content?.trim();
    return hook || null;
  } catch (err) {
    console.error("[Cliffhanger] Generation failed:", err);
    return null;
  }
}
