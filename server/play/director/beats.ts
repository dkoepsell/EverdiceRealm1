/**
 * Scene beat director (engagement spec Phase 2.1). Turn rhythm is decided in
 * code, not by a prompt that demanded "4–5 choices, 2 social, 2 rolls" every
 * single turn whether the party was in a tavern, a chase or a vault.
 *
 * The beat for the NEXT scene is picked at the end of each turn and stored in
 * the session's storyState.director, so both prompts for that next turn (the
 * streamed narrative and the structured JSON pass, which run concurrently)
 * read the same beat. Player aggression and live combat override it.
 */

export type Beat = "momentum" | "open_question" | "conversation" | "discovery" | "quiet" | "pressure" | "combat";

export interface BeatSpec {
  choices: [number, number];
  maxRolls: number;
  length: "short" | "medium";
  instruction: string;
}

export const BEATS: Record<Exclude<Beat, "combat">, BeatSpec> = {
  momentum: {
    choices: [2, 3],
    maxRolls: 1,
    length: "short",
    instruction:
      "Something is moving fast (a chase, a fall, a collapsing bridge). Offer 2–3 terse choices. One may call for a roll; the clock is ticking, so keep the prose short.",
  },
  open_question: {
    choices: [3, 4],
    maxRolls: 1,
    length: "medium",
    instruction:
      "A new place or situation opens up. Offer 3–4 choices and make it clear the player can try anything else. At most one choice needs a roll.",
  },
  conversation: {
    choices: [3, 3],
    maxRolls: 1,
    length: "medium",
    instruction:
      "An NPC with a want is in front of the party. Offer 3 choices written as things the character might SAY, in quotes. Talking is free: call for Insight/Persuasion/Deception/Intimidation only if the NPC is genuinely resisting.",
  },
  discovery: {
    choices: [2, 3],
    maxRolls: 0,
    length: "medium",
    instruction:
      "Pay off an earlier clue or reveal something the party earned. Offer 2–3 choices about what to do with what they now know. No rolls this scene.",
  },
  quiet: {
    choices: [2, 3],
    maxRolls: 0,
    length: "short",
    instruction:
      "A breather: camp, travel, or a talk with a companion. Offer 2–3 low-stakes choices that reveal character or plan ahead. No rolls this scene.",
  },
  pressure: {
    choices: [3, 3],
    maxRolls: 2,
    length: "short",
    instruction:
      "A threat is about to land. Offer 3 choices, each with a visible cost or risk. One or two may call for a roll.",
  },
};

/** Map the model's sceneType vocabulary onto beats, for rhythm history. */
export function beatFromSceneType(sceneType: unknown): Beat {
  const t = String(sceneType ?? "").toLowerCase();
  if (t.includes("combat")) return "combat";
  if (t.includes("social") || t.includes("conversation")) return "conversation";
  if (t.includes("discover") || t.includes("puzzle")) return "discovery";
  if (t.includes("downtime") || t.includes("travel") || t.includes("rest")) return "quiet";
  if (t.includes("chase") || t.includes("momentum")) return "momentum";
  return "open_question";
}

export interface DirectorState {
  /** Beat chosen for the next scene. */
  nextBeat?: Beat;
  /** Last beats played, most recent last (max 6). */
  recent: Beat[];
  /** Beats played in the current chapter. */
  chapterBeats: Beat[];
  chapter: number;
}

export function parseDirectorState(raw: unknown, chapter: number): DirectorState {
  const r = (raw && typeof raw === "object" ? raw : {}) as any;
  const isBeat = (b: unknown): b is Beat => typeof b === "string" && (b === "combat" || b in BEATS);
  const recent = Array.isArray(r.recent) ? r.recent.filter(isBeat).slice(-6) : [];
  const sameChapter = r.chapter === chapter;
  return {
    nextBeat: isBeat(r.nextBeat) ? r.nextBeat : undefined,
    recent,
    chapterBeats: sameChapter && Array.isArray(r.chapterBeats) ? r.chapterBeats.filter(isBeat) : [],
    chapter,
  };
}

/**
 * The beat for THIS turn. Live combat and an attack declared by the player
 * always win (combat only ever comes from the fiction or the player); otherwise
 * the beat chosen at the end of last turn, defaulting to an open question.
 */
export function beatForTurn(state: DirectorState, opts: { inCombat: boolean; attackIntent: boolean; clockFull?: boolean }): Beat {
  if (opts.inCombat || opts.attackIntent) return "combat";
  if (opts.clockFull) return "pressure";
  return state.nextBeat ?? "open_question";
}

const BASE_WEIGHTS: Record<Exclude<Beat, "combat">, number> = {
  momentum: 2,
  open_question: 3,
  conversation: 3,
  discovery: 2,
  quiet: 1.5,
  pressure: 0.75,
};

/**
 * Pick the beat for the next scene. Rules enforced here, not in the prompt:
 * - never the same beat three times in a row;
 * - at least one quiet or discovery beat per chapter (forced after 4 beats without one);
 * - combat is never dealt from the deck;
 * - after a fight, favour an aftermath (quiet/discovery);
 * - a clock close to full (Phase 4) raises the odds of pressure.
 */
export function pickNextBeat(
  state: DirectorState,
  played: Beat,
  opts: { clockNearFull?: boolean; rng?: () => number } = {},
): DirectorState {
  const rng = opts.rng ?? Math.random;
  const recent = [...state.recent, played].slice(-6);
  const chapterBeats = [...state.chapterBeats, played];
  const weights = { ...BASE_WEIGHTS };
  if (played === "combat") {
    weights.quiet *= 2.5;
    weights.discovery *= 2;
    weights.pressure = 0;
  }
  if (opts.clockNearFull) weights.pressure *= 4;
  const lastTwo = recent.slice(-2);
  if (lastTwo.length === 2 && lastTwo[0] === lastTwo[1] && lastTwo[0] !== "combat") {
    weights[lastTwo[0] as keyof typeof weights] = 0;
  }
  // Don't deal the same beat twice running unless nothing else is possible.
  if (played !== "combat" && played in weights) weights[played as keyof typeof weights] *= 0.35;
  const hadBreather = chapterBeats.some((b) => b === "quiet" || b === "discovery");
  let pool = Object.entries(weights) as [Exclude<Beat, "combat">, number][];
  if (!hadBreather && chapterBeats.length >= 4) pool = pool.filter(([b]) => b === "quiet" || b === "discovery");
  pool = pool.filter(([, w]) => w > 0);
  const total = pool.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  let next: Beat = pool[pool.length - 1]?.[0] ?? "open_question";
  for (const [b, w] of pool) {
    roll -= w;
    if (roll < 0) {
      next = b;
      break;
    }
  }
  return { nextBeat: next, recent, chapterBeats, chapter: state.chapter };
}

/** One paragraph for the prompt (replaces the fixed "4–5 choices, 2 rolls" block). */
export function beatPromptLine(beat: Beat): string {
  if (beat === "combat") {
    return "BEAT: combat. Resolve the fight's next moment. Offer 2–4 tactical choices (attack, a class feature, a clever use of the scene, a way out).";
  }
  const spec = BEATS[beat];
  return `BEAT: ${beat.replace("_", " ")}. ${spec.instruction} Call for a roll ONLY if the outcome is genuinely uncertain AND failure would be interesting; otherwise the character simply does it. Narrative length: ${spec.length}.`;
}

export interface ClampedChoice {
  requiresDiceRoll?: boolean;
  [k: string]: unknown;
}

/**
 * Make the model's choices fit the beat: truncate to the beat's maximum and
 * drop the roll requirement on rolls beyond the beat's roll budget (the choice
 * stays, it just happens without dice). Never fails the turn, never pads.
 */
export function clampToBeat<T extends ClampedChoice>(choices: T[], beat: Beat): T[] {
  if (beat === "combat" || !Array.isArray(choices)) return choices;
  const spec = BEATS[beat];
  const kept = choices.slice(0, spec.choices[1]);
  let rolls = 0;
  return kept.map((c) => {
    if (!c?.requiresDiceRoll) return c;
    if (String((c as any).skillType ?? "").toLowerCase() === "attack") return c; // an attack is never a free action
    rolls++;
    if (rolls <= spec.maxRolls) return c;
    const { rollDC, diceType, skillType, rollPurpose, successText, failureText, ...rest } = c as any;
    return { ...rest, requiresDiceRoll: false } as T;
  });
}
