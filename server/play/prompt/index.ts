/**
 * The per-turn prompt, assembled from modules (engagement spec Phase 7,
 * promptDiet flag). Each block appears only when it applies: combat rules only
 * in combat, the finale only in the final chapter, the dungeon schema only on
 * a mapped area, one theme block, one beat paragraph. Field names in the JSON
 * contract are unchanged so the response handling in routes.ts is shared with
 * the legacy prompt.
 */
import { DM_CORE, LENGTH_GUIDE, MOVEMENT_RULES, QUEST_RULES } from "./core";
import { combatBlock } from "./combat";
import { antiRepeatBlock } from "./history";
import { responseSchema } from "./schema";
import type { PromptExtras } from "../director/turnGuidance";

export interface TurnPromptContext {
  narrativeStyle: string;
  styleInstructions: string;
  difficulty: string;
  themeContext: string;
  chapterProgressNote: string;
  storySpine: string;
  chapterNudge: string;
  finaleInstructions: string;
  session1Contract: string;
  scaffoldGuidance: string;
  isTutorial: boolean;
  /** Legacy combat nudges; empty when the beat director is on. */
  encounterNudge: string;
  extras: PromptExtras;
  ledgerBlock?: string;
  recentTitles: string[];
  recentLocations: string[];
  ledgerOn: boolean;
  previousSessionResult: unknown;
  storyState: any;
  quests: { title: string; description?: string; status?: string }[];
  narrative: string;
  playerCharacterInfo: string;
  spotlightDirective: string;
  choice: string;
  isWaypointTravel: boolean;
  mapState: string;
  movementDetected: { isMovement: boolean; direction?: string | null } | null;
  skillCheckInfo: string;
  attackIntentInfo: string;
  skillCheckContinuation: string;
  recentActions: { choice?: string; rollResult?: any; consequences?: string }[];
  npcInteractions: unknown;
  inCombat: boolean;
  previousChoices: { text?: string }[];
  momentousChoices: { choice: string; consequence?: string; worldChange?: string }[];
}

const section = (title: string, body: string | null | undefined) => (body && body.trim() ? `${title}\n${body.trim()}` : "");

/** Story state without the bulky bookkeeping the model doesn't need to see. */
function compactStoryState(state: any): string {
  if (!state || typeof state !== "object") return "{}";
  const {
    journeyLog, adventureProgress, adventureRequirements, session1Retention, director, turnNotes,
    explorationLimit, startPosition, lastMovement, momentousChoices, combatRoundCount, scenesSinceCombat,
    movesWithoutStory, ...rest
  } = state;
  return JSON.stringify(rest);
}

export function buildTurnPrompt(c: TurnPromptContext): string {
  const enemies = Array.isArray(c.storyState?.combatants)
    ? c.storyState.combatants.filter((e: any) => e?.type === "enemy" || e?.type === "boss")
    : [];
  const fighting = c.inCombat || /attack/i.test(c.attackIntentInfo);
  const mapped = !!c.mapState.trim();

  const parts = [
    DM_CORE,
    `Style: ${c.narrativeStyle}. ${c.styleInstructions.trim()}`,
    `Difficulty: ${c.difficulty}`,
    c.themeContext.trim(),
    c.chapterProgressNote.trim(),
    c.storySpine.trim(),
    c.chapterNudge.trim(),
    c.finaleInstructions.trim(),
    c.session1Contract.trim(),
    c.scaffoldGuidance.trim(),
    c.isTutorial
      ? "TUTORIAL SANDBOX: the lesson is that the player can attempt ANYTHING. Invite off-menu attempts; when they try one, make it matter and say in-fiction that their idea shaped the outcome. Gentle stakes."
      : "",
    c.encounterNudge.trim(),
    antiRepeatBlock(c.recentTitles, c.recentLocations, { ledger: c.ledgerOn }),
    c.ledgerBlock?.trim() ?? "",
    c.momentousChoices.length
      ? section(
          "DECISIONS ALREADY MADE (permanent; never offer them again; show their consequences):",
          c.momentousChoices.map((m, i) => `${i + 1}. "${m.choice}" → ${m.consequence ?? ""}${m.worldChange ? ` (${m.worldChange})` : ""}`).join("\n"),
        )
      : "",
    section("PREVIOUSLY:", c.previousSessionResult ? JSON.stringify(c.previousSessionResult) : "The adventure begins."),
    section("STORY STATE:", compactStoryState(c.storyState)),
    section(
      "QUESTS:",
      c.quests.length ? c.quests.map((q) => `- ${q.title}: ${q.description ?? ""} [${q.status ?? "active"}]`).join("\n") : "None yet: create 1–2 from the story.",
    ),
    section("THE SCENE SO FAR:", c.narrative),
    c.playerCharacterInfo.trim(),
    c.spotlightDirective.trim(),
    section(
      "RECENT PLAYER ACTIONS:",
      c.recentActions
        .slice(-3)
        .map((a, i) => `${i + 1}. ${a.choice ?? ""}${a.rollResult ? ` (rolled ${a.rollResult.total ?? "?"})` : ""}${a.consequences ? ` → ${a.consequences}` : ""}`)
        .join("\n"),
    ),
    c.npcInteractions && Object.keys(c.npcInteractions as object).length ? section("NPCS IN PLAY:", JSON.stringify(c.npcInteractions)) : "",
    `THE PLAYER NOW: "${c.choice}"`,
    c.isWaypointTravel
      ? 'This is simple travel: 20–35 words, terrain/weather/one passing detail, then where they arrive. No encounters or discoveries. sceneType "Travel".'
      : "",
    c.mapState.trim(),
    c.movementDetected?.isMovement
      ? `MOVEMENT: the player is moving ${c.movementDetected.direction}. If that exit is passable, set movement.occurred = true and movement.direction = "${c.movementDetected.direction}", and describe what they find.`
      : "",
    c.skillCheckInfo.trim(),
    c.attackIntentInfo.trim(),
    c.skillCheckContinuation.trim(),
    fighting ? combatBlock(enemies) : "",
    c.previousChoices.length
      ? `Last turn's choices (offer NEW ones, not these): ${c.previousChoices.map((ch) => `"${ch.text ?? ""}"`).join("; ")}`
      : "",
    c.extras.context.trim(),
    c.extras.choiceRules ??
      "CHOICES: offer 3–4 specific options, at least one non-violent, and one that engages the scene's central tension. Call for a roll only when the outcome is uncertain and failure would be interesting.",
    LENGTH_GUIDE,
    MOVEMENT_RULES,
    QUEST_RULES,
    responseSchema({ inCombat: fighting, mapped, extras: c.extras.schema }),
  ];
  return parts.filter((p) => p && p.trim()).join("\n\n");
}
