// Shared exploration encounter content: analytic puzzles, chests, and traps.
//
// This is the single source of truth for "puzzles requiring actual analytic thinking"
// used across every exploration surface — campaign dungeon-move (server/routes.ts),
// standalone delves (server/delveEngine.ts), and wander (server/wanderEngine.ts).
//
// Unlike skill-check "puzzles" (roll d20 vs a DC), these have a DEFINITIVE, checkable
// answer the player must reason out and type in. checkPuzzleAnswer() does the grading.

export interface PuzzleReward {
  gold?: number;
  xp?: number;
  items?: string[];
}

export type PuzzleCategory =
  | 'riddle' | 'logic' | 'sequence' | 'cipher' | 'math' | 'deduction' | 'lateral' | 'anagram';

export interface AnalyticPuzzle {
  id: string;
  category: PuzzleCategory;
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** The puzzle prompt, framed as an in-world encounter. */
  description: string;
  /** Canonical answer (compared case/punctuation-insensitively). */
  answer: string;
  /** Accepted answer variants. */
  alternateAnswers: string[];
  /** Optional multiple-choice options; the player may answer with the letter or the text. */
  choices?: { id: string; text: string }[];
  hint: string;
  /** The reasoning, revealed once the puzzle is solved or attempts are exhausted. */
  explanation: string;
  successNarrative: string;
  failureNarrative: string;
  reward: PuzzleReward;
}

// ─────────────────────────────────────────────────────────────────────────────
// Answer normalization + checking
// ─────────────────────────────────────────────────────────────────────────────

/** Lowercase, strip punctuation, drop leading articles, collapse whitespace. */
function normalizeAnswer(raw: string): string {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(a|an|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract the first signed integer from a string, or null. */
function extractNumber(raw: string): number | null {
  const m = String(raw ?? '').match(/-?\d+/);
  return m ? parseInt(m[0], 10) : null;
}

/**
 * Grade a typed answer against a puzzle. Handles free-text (with article/punctuation
 * tolerance and synonym lists), numeric answers, and multiple-choice (letter or text).
 */
export function checkPuzzleAnswer(
  puzzle: Pick<AnalyticPuzzle, 'answer' | 'alternateAnswers' | 'choices'>,
  playerAnswer: string
): { correct: boolean } {
  const guess = normalizeAnswer(playerAnswer);
  if (!guess) return { correct: false };

  const accepted = [puzzle.answer, ...(puzzle.alternateAnswers || [])].map(normalizeAnswer);

  // Multiple-choice: accept the option letter (a/b/c…) or index (1/2/3…) or the option text.
  if (puzzle.choices && puzzle.choices.length) {
    const answerIdx = puzzle.choices.findIndex(
      (c) => normalizeAnswer(c.id) === normalizeAnswer(puzzle.answer) ||
             normalizeAnswer(c.text) === normalizeAnswer(puzzle.answer)
    );
    if (answerIdx >= 0) {
      const letter = String.fromCharCode(97 + answerIdx); // a, b, c…
      const byLetter = guess === letter || guess === `option ${letter}`;
      const byNumber = extractNumber(guess) === answerIdx + 1;
      const byText = normalizeAnswer(puzzle.choices[answerIdx].text) === guess;
      if (byLetter || byNumber || byText) return { correct: true };
    }
  }

  // Direct / synonym match.
  if (accepted.includes(guess)) return { correct: true };

  // Numeric answers: compare by value so "13", "thirteen items", etc. all work.
  const answerNum = extractNumber(puzzle.answer);
  if (answerNum !== null) {
    const guessNum = extractNumber(guess);
    if (guessNum !== null && guessNum === answerNum) return { correct: true };
  }

  // Word-number tolerance for small values (answer "3" vs guess "three").
  const WORD_NUMS: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
    seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  };
  if (answerNum !== null && WORD_NUMS[guess] === answerNum) return { correct: true };

  return { correct: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// The analytic puzzle pool
// ─────────────────────────────────────────────────────────────────────────────

export const ANALYTIC_PUZZLES: AnalyticPuzzle[] = [
  // ── Riddles (lateral/knowledge) ──────────────────────────────────────────
  {
    id: 'riddle-map', category: 'riddle', difficulty: 2,
    description: 'A stone guardian blocks the passage, its eyes glowing as it speaks: "I have cities, but no houses. I have mountains, but no trees. I have water, but no fish. What am I?"',
    answer: 'map', alternateAnswers: ['a map', 'maps'],
    hint: 'It shows places without being the places themselves.',
    explanation: 'A map depicts cities, mountains, and water without containing any of the real things.',
    successNarrative: 'The guardian nods slowly. "Wisdom opens doors that strength cannot." It steps aside, revealing a hidden alcove.',
    failureNarrative: 'The guardian shakes its head. "Ponder more deeply, traveler."',
    reward: { gold: 50, xp: 40, items: ['Ring of Minor Protection'] },
  },
  {
    id: 'riddle-echo', category: 'riddle', difficulty: 2,
    description: 'A sphinx-like statue animates: "I speak without a mouth and hear without ears. I have no body, but I come alive with the wind. What am I?"',
    answer: 'echo', alternateAnswers: ['an echo', 'echoes'],
    hint: 'You hear it answer you in the mountains.',
    explanation: 'An echo repeats sound with no body of its own.',
    successNarrative: 'The sphinx purrs. "Your mind is sharp." A compartment opens in its base.',
    failureNarrative: 'The sphinx closes its eyes. "Listen more carefully to the world."',
    reward: { gold: 30, xp: 45 },
  },
  {
    id: 'riddle-footsteps', category: 'lateral', difficulty: 2,
    description: 'An ancient spirit intones: "The more you take, the more you leave behind. What am I?"',
    answer: 'footsteps', alternateAnswers: ['steps', 'footprints', 'tracks'],
    hint: 'Consider what a journey on foot creates.',
    explanation: 'The more steps you take, the more footprints you leave behind you.',
    successNarrative: 'The spirit smiles. "The journey matters as much as the destination." It leaves a glowing orb.',
    failureNarrative: 'The spirit waits. "The answer walks with you always."',
    reward: { xp: 35, items: ['Orb of Insight'] },
  },
  {
    id: 'riddle-candle', category: 'riddle', difficulty: 3,
    description: 'A voice from a sealed brazier asks: "I am tall when I am young, and short when I am old. The wind is my enemy. What am I?"',
    answer: 'candle', alternateAnswers: ['a candle', 'candles', 'wax candle'],
    hint: 'It gives light and melts as it ages.',
    explanation: 'A candle burns down — tall when new, short when spent — and wind snuffs it out.',
    successNarrative: 'The brazier flares to life, and a warm light reveals a hidden switch.',
    failureNarrative: 'The brazier stays cold and dark.',
    reward: { gold: 45, xp: 40 },
  },

  // ── Number sequences (pattern recognition) ───────────────────────────────
  {
    id: 'seq-primes', category: 'sequence', difficulty: 3,
    description: 'Six pressure plates are carved with numbers: 2, 3, 5, 7, 11, and a blank. A voice hisses: "Speak the number that completes the pattern of the indivisible."',
    answer: '13', alternateAnswers: ['thirteen'],
    hint: 'Each number is divisible only by 1 and itself.',
    explanation: 'These are the prime numbers in order: 2, 3, 5, 7, 11, 13.',
    successNarrative: 'You press the 13th plate. The wall grinds open.',
    failureNarrative: 'The plates flash red and reset.',
    reward: { gold: 60, xp: 50 },
  },
  {
    id: 'seq-fib', category: 'sequence', difficulty: 3,
    description: 'Glowing runes count upward on the door: 1, 1, 2, 3, 5, 8, and then a flickering unknown. "Name the next," whispers the door.',
    answer: '13', alternateAnswers: ['thirteen'],
    hint: 'Each number is the sum of the two before it.',
    explanation: 'The Fibonacci sequence: 5 + 8 = 13.',
    successNarrative: 'The final rune ignites and the door swings wide.',
    failureNarrative: 'The runes dim and rearrange themselves.',
    reward: { gold: 55, xp: 55, items: ['Scroll of Comprehend Languages'] },
  },
  {
    id: 'seq-squares', category: 'sequence', difficulty: 2,
    description: 'A mosaic shows tiles numbered 1, 4, 9, 16, and one shattered tile. An inscription reads: "Restore the broken square."',
    answer: '25', alternateAnswers: ['twenty five', 'twentyfive'],
    hint: 'Each number is a whole number multiplied by itself.',
    explanation: 'The perfect squares: 1, 4, 9, 16, 25 (that is 5×5).',
    successNarrative: 'The mosaic reassembles into a shimmering archway.',
    failureNarrative: 'The tiles crack further and stay dark.',
    reward: { gold: 40, xp: 35 },
  },
  {
    id: 'seq-double', category: 'sequence', difficulty: 2,
    description: 'A row of six candles must be lit in the right count: 3, 6, 12, 24, 48, ? "How many flames complete the ritual?"',
    answer: '96', alternateAnswers: ['ninety six', 'ninetysix'],
    hint: 'Each number is twice the one before it.',
    explanation: 'The sequence doubles each step: 48 × 2 = 96.',
    successNarrative: 'The final candle blazes and a passage is revealed.',
    failureNarrative: 'The candles gutter out together.',
    reward: { gold: 45, xp: 40 },
  },

  // ── Ciphers (decoding) ───────────────────────────────────────────────────
  {
    id: 'cipher-caesar3', category: 'cipher', difficulty: 3,
    description: 'A slab bears scratched letters: "KHOOR". Beneath, a note: "Each letter has wandered three steps forward in the alphabet. Speak the true word."',
    answer: 'hello', alternateAnswers: ['hallo'],
    hint: 'Shift every letter back by three: K→H, H→E…',
    explanation: 'A Caesar cipher with shift 3. K→H, H→E, O→L, O→L, R→O spells HELLO.',
    successNarrative: 'You speak the word and the slab slides aside.',
    failureNarrative: 'The letters rearrange into new nonsense.',
    reward: { gold: 65, xp: 55, items: ['Cipher Wheel'] },
  },
  {
    id: 'cipher-reverse', category: 'cipher', difficulty: 2,
    description: 'Water ripples spell a word backward across the pool\'s surface: "NEPO". "Read against the current," a voice murmurs.',
    answer: 'open', alternateAnswers: [],
    hint: 'Read the letters from right to left.',
    explanation: 'NEPO reversed is OPEN.',
    successNarrative: 'The pool drains, revealing stone steps downward.',
    failureNarrative: 'The ripples scatter the letters again.',
    reward: { gold: 35, xp: 30 },
  },

  // ── Logic / deduction ────────────────────────────────────────────────────
  {
    id: 'logic-mislabeled', category: 'deduction', difficulty: 4,
    description: 'Three chests sit before you. One holds gold, one holds serpents, one is empty. Their labels read GOLD, SERPENTS, and EMPTY — but a plaque warns: "Every label is wrong." You may open exactly one chest. The chest labeled SERPENTS: what does it truly hold?',
    answer: 'gold', alternateAnswers: ['the gold', 'treasure', 'a'],
    choices: [
      { id: 'a', text: 'Gold' },
      { id: 'b', text: 'Serpents' },
      { id: 'c', text: 'Nothing (empty)' },
    ],
    hint: 'Since every label is wrong, the SERPENTS chest cannot hold serpents.',
    explanation: 'All labels are wrong, so SERPENTS holds gold or is empty. If you reason through the constraint that each label is wrong, the SERPENTS-labeled chest safely holds the gold.',
    successNarrative: 'You open the SERPENTS chest and gold spills out — the labels lied, as promised.',
    failureNarrative: 'You hesitate; the chests\' locks click shut for a while.',
    reward: { gold: 120, xp: 70 },
  },
  {
    id: 'logic-knights', category: 'logic', difficulty: 4,
    description: 'Two spectral wardens guard two doors. One always tells the truth, one always lies — you do not know which. The left warden says: "The safe door is the right one." The right warden says: "One of us is lying." Which door is safe?',
    answer: 'right', alternateAnswers: ['the right door', 'right door', 'b'],
    choices: [
      { id: 'a', text: 'The left door' },
      { id: 'b', text: 'The right door' },
    ],
    hint: 'The right warden\'s statement is true whether it lies or not — so it must be the truth-teller.',
    explanation: 'A liar cannot truthfully say "one of us is lying," yet with one liar the statement is factually true — so the right warden tells the truth, and its... the left warden\'s claim that the right door is safe therefore holds. The safe door is the right one.',
    successNarrative: 'You step through the right door unharmed.',
    failureNarrative: 'You pause, unwilling to guess. The wardens fade and reform.',
    reward: { gold: 80, xp: 75, items: ['Amulet of Truth'] },
  },
  {
    id: 'logic-bridge-weight', category: 'math', difficulty: 3,
    description: 'A rune-bridge holds only when the counterweight equals TWICE the number of party members plus one. Your party numbers four. What weight-number opens the bridge?',
    answer: '9', alternateAnswers: ['nine'],
    hint: 'Compute two times four, then add one.',
    explanation: '(2 × 4) + 1 = 9.',
    successNarrative: 'The counterweight settles and the bridge locks solid.',
    failureNarrative: 'The bridge trembles and refuses to hold.',
    reward: { gold: 50, xp: 45 },
  },
  {
    id: 'logic-guards-gold', category: 'math', difficulty: 3,
    description: 'A vault mechanism demands a number: "I am thinking of a number. Half of it, plus ten, equals thirty. What is my number?"',
    answer: '40', alternateAnswers: ['forty'],
    hint: 'If half the number plus ten is thirty, then half the number is twenty.',
    explanation: 'x/2 + 10 = 30 → x/2 = 20 → x = 40.',
    successNarrative: 'The vault dial spins to 40 and the lock releases.',
    failureNarrative: 'The dial resists and spins back to zero.',
    reward: { gold: 70, xp: 50 },
  },

  // ── Anagrams / wordplay ──────────────────────────────────────────────────
  {
    id: 'anagram-listen', category: 'anagram', difficulty: 3,
    description: 'Six stone tiles bear the letters S, I, L, E, N, T. A whisper says: "Rearrange us into the very thing you must do to hear the key turn."',
    answer: 'listen', alternateAnswers: ['enlist', 'tinsel'],
    hint: 'The same six letters spell what you do with your ears.',
    explanation: 'SILENT is an anagram of LISTEN.',
    successNarrative: 'You slide the tiles into LISTEN and a lock clicks open.',
    failureNarrative: 'The tiles scramble themselves once more.',
    reward: { gold: 45, xp: 45 },
  },
  {
    id: 'anagram-heart', category: 'anagram', difficulty: 3,
    description: 'Glowing letters hover: E, A, R, T, H. "Rearrange the ground beneath you into the thing that beats within you."',
    answer: 'heart', alternateAnswers: ['hater', 'rathe'],
    hint: 'The letters of EARTH rearrange into an organ in your chest.',
    explanation: 'EARTH is an anagram of HEART.',
    successNarrative: 'The letters snap into HEART and a warm glow floods the chamber.',
    failureNarrative: 'The letters drift apart again.',
    reward: { gold: 40, xp: 40 },
  },

  // ── Lateral thinking ─────────────────────────────────────────────────────
  {
    id: 'lateral-stamp', category: 'lateral', difficulty: 3,
    description: 'A mischievous fey giggles: "What can travel around the world while staying in a corner?"',
    answer: 'stamp', alternateAnswers: ['a stamp', 'postage stamp', 'stamps'],
    hint: 'Think about letters and the mail.',
    explanation: 'A postage stamp sits in the corner of an envelope yet travels the world.',
    successNarrative: 'The fey claps. "Clever, clever!" and tosses you a pouch.',
    failureNarrative: 'The fey pouts. "Think smaller — think paper!"',
    reward: { gold: 40, xp: 30 },
  },
  {
    id: 'lateral-hole', category: 'lateral', difficulty: 3,
    description: 'A dwarf-ghost poses a wager: "What gets bigger the more you take away from it?"',
    answer: 'hole', alternateAnswers: ['a hole', 'holes', 'pit'],
    hint: 'Dig, and it only grows.',
    explanation: 'The more earth you remove, the bigger the hole becomes.',
    successNarrative: 'The dwarf-ghost roars with laughter and reveals a buried cache.',
    failureNarrative: 'The dwarf-ghost harrumphs and folds his arms.',
    reward: { gold: 50, xp: 40 },
  },
];

/** Pick a random analytic puzzle, optionally filtered and avoiding recent repeats. */
export function getRandomAnalyticPuzzle(opts?: {
  excludeIds?: string[];
  maxDifficulty?: number;
  category?: PuzzleCategory;
}): AnalyticPuzzle {
  const exclude = new Set(opts?.excludeIds || []);
  let pool = ANALYTIC_PUZZLES.filter((p) => !exclude.has(p.id));
  if (opts?.maxDifficulty) pool = pool.filter((p) => p.difficulty <= opts.maxDifficulty!);
  if (opts?.category) pool = pool.filter((p) => p.category === opts.category);
  if (pool.length === 0) pool = ANALYTIC_PUZZLES;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─────────────────────────────────────────────────────────────────────────────
// Chests
// ─────────────────────────────────────────────────────────────────────────────

export interface ExplorationChest {
  type: 'chest';
  chestType: 'wooden' | 'iron' | 'ornate' | 'ancient';
  locked: boolean;
  trapped: boolean;
  /** DC to pick the lock (Thieves' tools / Dexterity). */
  lockDC: number;
  /** DC to spot the trap, if trapped. */
  trapDetectDC: number;
  /** DC to disarm the trap, if trapped. */
  trapDisarmDC: number;
  trapDamage?: string;
  description: string;
  reward: PuzzleReward;
  /** Some chests are sealed by a puzzle instead of a lock. */
  puzzleLock?: AnalyticPuzzle;
}

const CHEST_ITEM_TIERS: Record<number, string[]> = {
  1: ['Potion of Healing', 'Torch', 'Rope (50 ft)', "Traveler's Rations", 'Silver Ring'],
  2: ['Potion of Healing', 'Scroll of Shield', 'Fine Dagger', 'Jade Figurine', 'Cloak of Warmth'],
  3: ['Potion of Greater Healing', 'Wand of Magic Missiles', 'Boots of Elvenkind', 'Ruby', 'Bag of Holding'],
  4: ['Ring of Protection', 'Cloak of Displacement', 'Flame Tongue Shard', 'Star Sapphire', 'Amulet of Health'],
};

/** Generate a structured chest, scaled to party level. */
export function generateExplorationChest(opts?: {
  level?: number;
  forceTrapped?: boolean;
  forceLocked?: boolean;
  puzzleSealChance?: number;
  excludePuzzleIds?: string[];
}): ExplorationChest {
  const level = Math.max(1, Math.min(4, opts?.level ?? 2));
  const roll = Math.random();
  const chestType: ExplorationChest['chestType'] =
    roll < 0.4 ? 'wooden' : roll < 0.7 ? 'iron' : roll < 0.9 ? 'ornate' : 'ancient';

  const trapped = opts?.forceTrapped ?? Math.random() < 0.35;
  const locked = opts?.forceLocked ?? Math.random() < 0.5;
  const puzzleSealed = Math.random() < (opts?.puzzleSealChance ?? 0.2);

  const items = CHEST_ITEM_TIERS[level] || CHEST_ITEM_TIERS[2];
  const loot: PuzzleReward = {
    gold: (10 + Math.floor(Math.random() * 20)) * level,
    xp: 10 * level,
    items: [items[Math.floor(Math.random() * items.length)]],
  };
  // Rarer double-item for ornate/ancient chests.
  if ((chestType === 'ornate' || chestType === 'ancient') && Math.random() < 0.5) {
    loot.items!.push(items[Math.floor(Math.random() * items.length)]);
    loot.gold = (loot.gold || 0) + 25 * level;
  }

  return {
    type: 'chest',
    chestType,
    locked: puzzleSealed ? true : locked,
    trapped,
    lockDC: 10 + level * 2 + (chestType === 'ancient' ? 3 : 0),
    trapDetectDC: 12 + level,
    trapDisarmDC: 12 + level,
    trapDamage: trapped ? `${level}d6` : undefined,
    description:
      `A ${chestType} chest rests here` +
      (trapped ? ', its lid ringed with a faint, suspicious seam' : '') +
      (puzzleSealed ? '. No keyhole marks it — instead, a riddle is etched across the lid.' : '.'),
    reward: loot,
    puzzleLock: puzzleSealed
      ? getRandomAnalyticPuzzle({ maxDifficulty: level + 1, excludeIds: opts?.excludePuzzleIds })
      : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Traps
// ─────────────────────────────────────────────────────────────────────────────

export interface ExplorationTrap {
  type: 'trap';
  trapType: string;
  detectDC: number;
  disarmDC: number;
  /** DC of the save if the trap triggers. */
  saveDC: number;
  saveAbility: string;
  damage: string;
  effect: string;
  triggerDescription: string;
  disarmHint: string;
}

const TRAP_TEMPLATES: Array<Omit<ExplorationTrap, 'type' | 'detectDC' | 'disarmDC' | 'saveDC' | 'damage'> & { baseDamage: string; }> = [
  {
    trapType: 'poison_dart', saveAbility: 'Dexterity', baseDamage: '1d6',
    effect: 'poison', triggerDescription: 'Tiny holes line the wall at chest height.',
    disarmHint: 'Wedge the firing slots shut before crossing.',
  },
  {
    trapType: 'pit', saveAbility: 'Dexterity', baseDamage: '2d6',
    effect: 'fall', triggerDescription: 'A section of floor sounds hollow underfoot.',
    disarmHint: 'Find the trigger stone and pin the trapdoor.',
  },
  {
    trapType: 'scything_blade', saveAbility: 'Dexterity', baseDamage: '2d8',
    effect: 'slashing', triggerDescription: 'A thin groove runs across the corridor floor.',
    disarmHint: 'Jam the blade\'s pendulum housing in the wall.',
  },
  {
    trapType: 'gas_vent', saveAbility: 'Constitution', baseDamage: '1d8',
    effect: 'poison gas', triggerDescription: 'Greenish residue crusts a grate in the floor.',
    disarmHint: 'Seal the vent grate before it hisses open.',
  },
  {
    trapType: 'rune_glyph', saveAbility: 'Intelligence', baseDamage: '2d6',
    effect: 'psychic', triggerDescription: 'A glowing sigil is half-hidden beneath dust.',
    disarmHint: 'Scuff away one stroke of the glyph to break it.',
  },
];

/** Generate a structured trap scaled to party level. */
export function generateExplorationTrap(opts?: { level?: number }): ExplorationTrap {
  const level = Math.max(1, opts?.level ?? 2);
  const t = TRAP_TEMPLATES[Math.floor(Math.random() * TRAP_TEMPLATES.length)];
  const dmgDice = t.baseDamage.split('d');
  const count = Math.min(6, parseInt(dmgDice[0], 10) + Math.floor(level / 2));
  return {
    type: 'trap',
    trapType: t.trapType,
    detectDC: 11 + level,
    disarmDC: 12 + level,
    saveDC: 11 + level,
    saveAbility: t.saveAbility,
    damage: `${count}d${dmgDice[1]}`,
    effect: t.effect,
    triggerDescription: t.triggerDescription,
    disarmHint: t.disarmHint,
  };
}
