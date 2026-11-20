/**
 * "Learn the game by playing" (engagement spec, guiding priority 5; design PDF
 * Home): short one-shots, each built around one 5e mechanic, unlocked in
 * order and skippable. A lesson is learned once the player has seen its rules
 * fire in play (user_rules_seen), wherever that happened.
 */
export interface Lesson {
  id: string;
  title: string;
  /** One line under the title on the Home card. */
  pitch: string;
  minutes: number;
  /** Rule ids (shared/rules/ruleExplainers.ts) that mean this lesson is learned. */
  ruleIds: string[];
  /** The one-shot's premise, built so the mechanic comes up naturally. */
  hook: string;
  /** What the DM is asked to make happen. */
  dmFocus: string;
}

export const LESSONS: Lesson[] = [
  {
    id: "ability_checks", title: "Ability checks and DCs", pitch: "When the DM calls for a roll, and what the number means.", minutes: 10,
    ruleIds: ["ability_check"],
    hook: "A locked archive, a suspicious clerk and a ledger someone wants hidden.",
    dmFocus: "Create 2–3 moments where the outcome is uncertain and failure would be interesting (a lock, a lie, a climb), and several where the character simply succeeds without a roll.",
  },
  {
    id: "advantage", title: "Advantage and disadvantage", pitch: "Two d20s, keep the better (or worse).", minutes: 10,
    ruleIds: ["advantage", "help"],
    hook: "A storm-battered bridge crossing with a companion who knows the way.",
    dmFocus: "Offer clear sources of advantage (preparation, a companion's Help, high ground) and one source of disadvantage (darkness, a slick surface).",
  },
  {
    id: "combat_turn", title: "Your turn in combat", pitch: "Action, bonus action, movement, reaction.", minutes: 10,
    ruleIds: ["action_economy", "opportunity_attack"],
    hook: "Hold a river landing against a few bandits until the ferry casts off.",
    dmFocus: "One short fight with a non-kill objective, where moving away provokes an opportunity attack and a bonus action matters.",
  },
  {
    id: "spell_slots", title: "Spell slots and concentration", pitch: "Why casters choose when to cast.", minutes: 10,
    ruleIds: ["concentration", "long_rest"],
    hook: "A haunted chapel where a ward must be held up while the party searches.",
    dmFocus: "Make spending resources a real choice, and have damage threaten something the character is concentrating on.",
  },
  {
    id: "resting", title: "Resting and Hit Dice", pitch: "Short rests, long rests, and what comes back.", minutes: 8,
    ruleIds: ["short_rest", "long_rest"],
    hook: "A two-day trek through the hills with a pursuer behind you.",
    dmFocus: "Put the party hurt between encounters and make resting a decision: it costs time, and the pursuit gains ground.",
  },
  {
    id: "death_saves", title: "Death saving throws", pitch: "What happens at 0 hit points.", minutes: 8,
    ruleIds: ["death_saves"],
    hook: "A collapsing mine and a companion who might not get you out in time.",
    dmFocus: "A dangerous scene where dropping to 0 HP is possible but survivable; companions can stabilize.",
  },
  {
    id: "social", title: "Social encounters and attitudes", pitch: "Persuasion, Insight, and NPCs who want things.", minutes: 10,
    ruleIds: ["passive_check", "inspiration"],
    hook: "A tense negotiation between a ferrywoman, a bandit captain and you.",
    dmFocus: "NPCs with clear wants and attitudes; talking is free, rolls only when someone resists; reward playing to the character's ideal or bond.",
  },
  {
    id: "leveling", title: "Leveling up", pitch: "Hit Dice, class features and your first big choice.", minutes: 8,
    ruleIds: ["level_up"],
    hook: "A short job that ends at a milestone.",
    dmFocus: "Reach a clear turning point quickly so the character levels up by milestone.",
  },
];

export function lessonById(id: unknown): Lesson | undefined {
  return typeof id === "string" ? LESSONS.find((l) => l.id === id) : undefined;
}

export interface LessonProgress {
  lesson: Lesson;
  learned: boolean;
  /** The first unlearned lesson is "next"; later ones are locked (but can still be played). */
  state: "learned" | "next" | "locked";
}

export function learningProgress(rulesSeen: Set<string>, skipped: Set<string> = new Set()): LessonProgress[] {
  let nextGiven = false;
  return LESSONS.map((lesson) => {
    const learned = skipped.has(lesson.id) || lesson.ruleIds.some((r) => rulesSeen.has(r));
    if (learned) return { lesson, learned, state: "learned" };
    if (!nextGiven) {
      nextGiven = true;
      return { lesson, learned, state: "next" };
    }
    return { lesson, learned, state: "locked" };
  });
}

export function lessonPromptLine(lesson: Lesson): string {
  return `LESSON ONE-SHOT: "${lesson.title}". ${lesson.dmFocus} When the mechanic comes up, use its real 5e name in the narration. Keep the whole adventure to about ${lesson.minutes} minutes.`;
}
