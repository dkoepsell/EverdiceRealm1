/**
 * Parameterized analytic puzzles (engagement spec 6.4): each template yields
 * many instances with different numbers, symbols and names, and the answer is
 * computed in code. Output matches AnalyticPuzzle so Wander renders them like
 * the hand-written ones (multiple choice).
 */
import type { AnalyticPuzzle } from "../../lib/explorationPuzzles";

type Rng = () => number;
const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = <T>(rng: Rng, a: T[]) => a[Math.floor(rng() * a.length)];
const shuffle = <T>(rng: Rng, a: T[]) => a.map((v) => [rng(), v] as const).sort((x, y) => x[0] - y[0]).map(([, v]) => v);

function choicesFor(rng: Rng, answer: number, spread: number): { id: string; text: string }[] {
  const wrong = new Set<number>();
  while (wrong.size < 3) {
    const w = answer + (rng() < 0.5 ? -1 : 1) * int(rng, 1, spread);
    if (w !== answer && w > 0) wrong.add(w);
  }
  return shuffle(rng, [answer, ...Array.from(wrong)]).map((v, i) => ({ id: "abcd"[i], text: String(v) }));
}

const GUARDIANS = ["A stone guardian", "A brass automaton", "A spectral scribe", "A riddling gargoyle", "A sphinx carved into the cliff"];
const reward = (rng: Rng) => ({ gold: int(rng, 20, 60), xp: int(rng, 30, 60) });

function arithmetic(rng: Rng): AnalyticPuzzle {
  const start = int(rng, 2, 20);
  const step = int(rng, 3, 9);
  const seq = Array.from({ length: 5 }, (_, i) => start + i * step);
  const answer = start + 5 * step;
  const who = pick(rng, GUARDIANS);
  return {
    id: `gen-arith-${start}-${step}`, category: "sequence", difficulty: 1,
    description: `${who} has carved numbers into the door: ${seq.join(", ")}, … "Speak the next," it says.`,
    answer: String(answer), alternateAnswers: [], choices: choicesFor(rng, answer, step),
    hint: "Look at the gap between each pair of numbers.",
    explanation: `Each number is ${step} more than the last: ${seq[4]} + ${step} = ${answer}.`,
    successNarrative: "The carved numbers glow and the door grinds open.",
    failureNarrative: "The numbers dim. The door stays shut, for now.",
    reward: reward(rng),
  };
}

function geometric(rng: Rng): AnalyticPuzzle {
  const start = int(rng, 1, 4);
  const ratio = int(rng, 2, 3);
  const seq = Array.from({ length: 4 }, (_, i) => start * ratio ** i);
  const answer = start * ratio ** 4;
  return {
    id: `gen-geo-${start}-${ratio}`, category: "sequence", difficulty: 2,
    description: `Lanterns along the wall burn in groups: ${seq.join(", ")}, and one dark bracket waits. How many flames belong there?`,
    answer: String(answer), alternateAnswers: [], choices: choicesFor(rng, answer, Math.max(2, answer / 3 | 0)),
    hint: "Each group isn't added to; it's multiplied.",
    explanation: `Each group is ${ratio} times the last: ${seq[3]} × ${ratio} = ${answer}.`,
    successNarrative: "The last bracket flares to life and a hidden panel slides aside.",
    failureNarrative: "The lanterns gutter. Something in the walls clicks, then resets.",
    reward: reward(rng),
  };
}

function balance(rng: Rng): AnalyticPuzzle {
  const a = int(rng, 2, 9);
  const b = int(rng, 2, 9);
  const items = pick(rng, [["skull", "candle"], ["coin", "feather"], ["ruby", "acorn"], ["key", "bell"]]);
  // 2 of item0 balance with 1 of item0 + b of item1  → 1 item0 = b item1 ; question: a item0 = ? item1
  const answer = a * b;
  return {
    id: `gen-balance-${a}-${b}-${items[0]}`, category: "logic", difficulty: 2,
    description: `An old merchant's scale stands by the gate. A note reads: "One ${items[0]} weighs as much as ${b} ${items[1]}s. How many ${items[1]}s balance ${a} ${items[0]}s?"`,
    answer: String(answer), alternateAnswers: [], choices: choicesFor(rng, answer, b + 2),
    hint: `Work out one ${items[0]} first, then multiply.`,
    explanation: `${a} × ${b} = ${answer} ${items[1]}s.`,
    successNarrative: "The scale settles level and the gate's lock releases.",
    failureNarrative: "The scale tips with a clang. Try again.",
    reward: reward(rng),
  };
}

const WORDS = ["LANTERN", "RIVER", "SHADOW", "CROWN", "FERRY", "EMBER", "GROVE", "THRONE", "MIRROR", "ARROW"];
function cipher(rng: Rng): AnalyticPuzzle {
  const word = pick(rng, WORDS);
  const shift = int(rng, 1, 4);
  const enc = word.replace(/[A-Z]/g, (ch) => String.fromCharCode(((ch.charCodeAt(0) - 65 + shift) % 26) + 65));
  // Same-length words first (harder to rule out by length), never repeated.
  const sameLen = shuffle(rng, WORDS.filter((w) => w !== word && w.length === word.length));
  const others = shuffle(rng, WORDS.filter((w) => w !== word && w.length !== word.length));
  const decoys = [...sameLen, ...others].slice(0, 3);
  const choices = shuffle(rng, [word, ...decoys]).map((t, i) => ({ id: "abcd"[i], text: t }));
  return {
    id: `gen-cipher-${word}-${shift}`, category: "cipher", difficulty: 3,
    description: `Scratched above the lock: "${enc}". Below it, a smaller mark: every letter has stepped ${shift} forward. What's the password?`,
    answer: word, alternateAnswers: [word.toLowerCase()], choices,
    hint: `Step each letter ${shift} back in the alphabet.`,
    explanation: `${enc} with each letter moved back ${shift} reads ${word}.`,
    successNarrative: "You speak the word and the lock falls open.",
    failureNarrative: "Nothing happens. The letters seem to mock you.",
    reward: reward(rng),
  };
}

const GENERATORS = [arithmetic, geometric, balance, cipher];

export function generatePuzzle(rng: Rng = Math.random, exclude: Set<string> = new Set()): AnalyticPuzzle {
  for (let i = 0; i < 12; i++) {
    const p = pick(rng, GENERATORS)(rng);
    if (!exclude.has(p.id)) return p;
  }
  return pick(rng, GENERATORS)(rng);
}
