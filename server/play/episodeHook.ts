/**
 * End-of-turn hook for Phase 5 (episodes flag): track the episode, grant one
 * option-opening SRD magic item when a chapter turns, and build the episode
 * card at a good break point. Runs after the turn is saved, so it re-reads and
 * patches the current session's storyState.
 */
import { storage } from "../storage";
import type { Character } from "@shared/schema";
import { normalizeCampaignLength, pacingForLength } from "@shared/rules/campaignLength";
import { pickChapterItem, type MagicItem } from "@shared/rules/magicItems";
import { hitDieFor } from "@shared/rules/leveling";
import { getAbilityModifier } from "@shared/rules/xp";
import { parseClocks } from "./clocks";
import {
  type EpisodeCard, clockAtRisk, lastSentence, minutesLeft, nextEpisode, parseEpisode, shouldEndEpisode, trackEpisode,
} from "./episodes";

const parseState = (raw: unknown): any => {
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return {}; } }
  return raw && typeof raw === "object" ? raw : {};
};

export interface EpisodeHookResult {
  episode: { number: number; minutesLeft: number } | null;
  episodeEnd: EpisodeCard | null;
  lootItem: MagicItem | null;
}

export async function finishTurnEpisode(o: {
  campaignId: number;
  campaign: any;
  characterId: number | null;
  chapterAdvanced: boolean;
  inCombat: boolean;
  sessionBreakpoint: boolean;
  beat: string | null;
  items: string[];
  allies: string[];
  rules: string[];
  narrative: string;
  cliffhanger: string | null;
  title: string;
  /** The episode as it stood before this turn (a new chapter's session starts without one). */
  prevEpisode?: unknown;
}): Promise<EpisodeHookResult> {
  const pacing = pacingForLength(normalizeCampaignLength(o.campaign?.campaignLength));
  let lootItem: MagicItem | null = null;
  let character: Character | undefined = o.characterId ? await storage.getCharacter(o.characterId) : undefined;

  // Loot that changes play: one SRD magic item per chapter (spec 5.3).
  if (o.chapterAdvanced && character) {
    const owned = Array.isArray(character.equipment) ? (character.equipment as string[]) : [];
    lootItem = pickChapterItem(owned);
    if (lootItem) {
      character = (await storage.updateCharacter(character.id, { equipment: [...owned, lootItem.name] } as Partial<Character>)) ?? character;
    }
  }

  const session = await storage.getCurrentSession(o.campaignId);
  if (!session) return { episode: null, episodeEnd: null, lootItem };
  const state = parseState(session.storyState);
  let ep = trackEpisode(parseEpisode(state.episode ?? o.prevEpisode), {
    items: [...o.items, ...(lootItem ? [lootItem.name] : [])],
    allies: o.allies,
    rules: o.rules,
  });
  let card: EpisodeCard | null = null;
  if (shouldEndEpisode(ep, { inCombat: o.inCombat, chapterAdvanced: o.chapterAdvanced, sessionBreakpoint: o.sessionBreakpoint, beat: o.beat, targetScenes: pacing.episodeScenes })) {
    const level = character?.level || 1;
    card = {
      number: ep.number,
      title: o.title.replace(/^(Session|Chapter)\s*\d+:\s*/i, ""),
      cliffhanger: o.cliffhanger || lastSentence(o.narrative),
      gains: ep.gains,
      nextClock: clockAtRisk(parseClocks(state.clocks)),
      rest: character
        ? {
            hp: character.hitPoints,
            maxHp: character.maxHitPoints,
            hitDiceLeft: typeof character.hitDiceRemaining === "number" ? character.hitDiceRemaining : level,
            hitDie: hitDieFor(character.class),
            conMod: getAbilityModifier(character.constitution),
          }
        : null,
    };
    ep = nextEpisode(ep);
  }
  await storage.updateSessionStoryState(o.campaignId, session.sessionNumber, { ...state, episode: ep });
  return { episode: { number: ep.number, minutesLeft: minutesLeft(ep, pacing.episodeScenes) }, episodeEnd: card, lootItem };
}
