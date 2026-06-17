// Turn-signal extraction (spec §3.2, §6.1). Deterministic baseline only —
// an optional LLM upgrade for elaboration scoring can replace scoreElaboration
// later without changing callers. No I/O here.

import type { InputMode, ResolutionType, TurnSignal } from "../scaffolding.types";

// Lightweight manner/instrument cues — adverbs and prepositional lead-ins that
// signal *how* an action is performed ("quietly", "with the dagger", "by...").
const MANNER_CUES = /\b(quietly|carefully|quickly|slowly|silently|firmly|gently|with|using|by|through|behind|under|toward|against|while|then)\b/i;
const ADVERB = /\b\w+ly\b/i;

/**
 * Baseline elaboration score 0..1 (spec §6.1).
 * Rewards presence of (verb) + (object/target) + (manner/instrument), plus a
 * small length bucket. "I attack" scores low; "I feint left then drive the
 * dagger up under his ribs" scores high.
 */
export function scoreElaboration(text: string): number {
  const trimmed = (text || "").trim();
  if (!trimmed) return 0;

  const words = trimmed.split(/\s+/);
  const wordCount = words.length;

  // Component 1: has a verb-like token (very rough — any word past a leading
  // pronoun, or a recognizable action verb). We approximate "verb present" as
  // "more than just a noun phrase": >= 2 words.
  const hasVerb = wordCount >= 2;

  // Component 2: has an object/target — a second content word beyond the verb.
  const hasObject = wordCount >= 3;

  // Component 3: manner or instrument.
  const hasManner = MANNER_CUES.test(trimmed) || ADVERB.test(trimmed);

  const components = (hasVerb ? 1 : 0) + (hasObject ? 1 : 0) + (hasManner ? 1 : 0);
  const componentScore = components / 3; // 0..1

  // Length bucket 0..1 (saturates around ~20 words).
  const lengthBucket = Math.min(wordCount / 20, 1);

  // Weight components more than raw length.
  return Math.min(1, componentScore * 0.7 + lengthBucket * 0.3);
}

/** Does the player's input match one of the presented menu choices? */
function matchesPresentedChoice(choice: string, presented: string[]): boolean {
  const norm = (s: string) => (s || "").trim().toLowerCase();
  const target = norm(choice);
  if (!target) return false;
  return presented.some((p) => norm(p) === target);
}

export interface ClassifyTurnInput {
  turnIndex: number;
  choice: string;
  /** Text of the choices that were on-screen when the player acted. */
  presentedChoices: string[];
  /** Whether a dice roll was attached to this turn. */
  hadRoll: boolean;
  usedHintButton?: boolean;
}

/**
 * Classify a completed turn into a TurnSignal (Phase 0 / shadow mode).
 *
 * Because the Everdice loop is fully generative, "scripted_edge" means the
 * player took a presented menu option and "improvised" means they typed
 * off-menu prose. The LLM-driven intent classifier (Phase 3) will refine
 * resolutionType later; this baseline is enough to validate thresholds.
 */
export function classifyTurn(input: ClassifyTurnInput): TurnSignal {
  const { turnIndex, choice, presentedChoices, hadRoll } = input;
  const text = (choice || "").trim();
  const inputLength = text.length;
  const elaborationScore = scoreElaboration(text);

  const onMenu = matchesPresentedChoice(text, presentedChoices);
  const inputMode: InputMode = onMenu ? "menu" : "freeform";
  const resolutionType: ResolutionType = onMenu ? "scripted_edge" : "improvised";

  // Struggle heuristic (refined in later phases with resolution feedback):
  // very short off-menu input with low elaboration and no roll reads as
  // confusion / floundering.
  const struggleSignal =
    inputMode === "freeform" && inputLength > 0 && inputLength < 8 && elaborationScore < 0.25 && !hadRoll;

  return {
    turnIndex,
    inputMode,
    inputLength,
    elaborationScore,
    resolutionType,
    usedHintButton: input.usedHintButton ?? false,
    struggleSignal,
  };
}
