// Oracle / generative-friction engine (spec §9). For expert players the menu is
// gone; the oracle replaces it with unpredictability — a yes/yes-but/no/no-and
// answer to a yes-or-no question, plus the occasional complication or twist.
// This is the Mythic GME / Ironsworn tradition: not fewer features, a different
// engine flavor.
//
// Pure + deterministic given an injected RNG (default Math.random), so it's
// testable and side-effect-free. Narration is the caller's job; this returns a
// structured result + a ready-to-show in-fiction phrase.

export type OracleLikelihood =
  | "impossible"
  | "unlikely"
  | "fifty-fifty"
  | "likely"
  | "certain";

export type OracleAnswer = "yes" | "no";
export type OracleModifier = "plain" | "and" | "but";

export interface OracleResult {
  answer: OracleAnswer;
  modifier: OracleModifier; // and = emphatic/exceptional; but = with a complication
  phrase: string; // "Yes, and…", "No, but…" — ready to display
  roll: number; // the d100 that decided it
  likelihood: OracleLikelihood;
  /** A complication / scene twist seed when one is triggered (else undefined). */
  twist?: string;
}

type Rng = () => number;

const YES_TARGET: Record<OracleLikelihood, number> = {
  impossible: 15,
  unlikely: 35,
  "fifty-fifty": 50,
  likely: 65,
  certain: 85,
};

// Complication/twist seeds — deliberately open-ended so the player (or a later
// LLM pass) narrates them into the current scene.
const TWISTS = [
  "an unexpected witness or arrival",
  "a hidden cost surfaces",
  "someone's true motive shows through",
  "the environment shifts against you",
  "a familiar face, in the wrong place",
  "time is suddenly shorter than you thought",
  "an old debt comes due",
  "what you wanted is here — but changed",
  "a rival is already a step ahead",
  "a rule of this place reveals itself",
];

const d100 = (rng: Rng) => Math.floor(rng() * 100) + 1; // 1..100

function phraseFor(answer: OracleAnswer, modifier: OracleModifier): string {
  const base = answer === "yes" ? "Yes" : "No";
  if (modifier === "and") return `${base}, and…`;
  if (modifier === "but") return `${base}, but…`;
  return `${base}.`;
}

/**
 * Consult the oracle. `likelihood` weights the odds of "yes". Extreme rolls
 * produce an emphatic "and"; a separate complication roll can attach a "but"
 * with a twist. A doubles roll (11,22,…) always injects a twist.
 */
export function consultOracle(
  likelihood: OracleLikelihood = "fifty-fifty",
  rng: Rng = Math.random,
): OracleResult {
  const target = YES_TARGET[likelihood];
  const roll = d100(rng);
  const answer: OracleAnswer = roll <= target ? "yes" : "no";

  // Emphatic band: lowest fifth of a "yes" range, or highest fifth of a "no".
  const exceptionalYes = Math.max(1, Math.ceil(target / 5));
  const exceptionalNo = 100 - Math.max(1, Math.ceil((100 - target) / 5));

  let modifier: OracleModifier = "plain";
  if (answer === "yes" && roll <= exceptionalYes) modifier = "and";
  else if (answer === "no" && roll >= exceptionalNo) modifier = "and";

  // Twist: on doubles, or on a ~1-in-6 complication roll for plain results.
  const isDoubles = roll % 11 === 0 && roll <= 99; // 11,22,…,99
  let twist: string | undefined;
  if (isDoubles || (modifier === "plain" && d100(rng) <= 17)) {
    twist = TWISTS[Math.floor(rng() * TWISTS.length)];
    if (modifier === "plain") modifier = "but";
  }

  return { answer, modifier, phrase: phraseFor(answer, modifier), roll, likelihood, twist };
}

export const ORACLE_LIKELIHOODS: OracleLikelihood[] = [
  "impossible",
  "unlikely",
  "fifty-fifty",
  "likely",
  "certain",
];
