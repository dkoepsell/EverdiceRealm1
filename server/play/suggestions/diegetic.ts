// Diegetic suggestion rendering (spec §5.2). Suggestions must never read as a
// bare list of second-person imperatives ("Search the desk"); they read as the
// character's own noticing or impulse ("The desk drawer sits slightly ajar").
//
// Strategy (per decision): the advance-story LLM emits a diegetic `hint` per
// choice. This module is the authoritative guard — it lints that hint for
// second-person imperatives (acceptance criterion #7) and, if the hint is
// missing or fails the lint, falls back to a deterministic transform that is
// guaranteed imperative-free. So whatever the client renders at a suggestion
// rung is always lint-clean.

// A small but high-coverage set of action verbs that commonly open an
// imperative suggestion. The lint is intentionally conservative: it only needs
// to catch the "bare command" shape, not parse English.
const IMPERATIVE_VERBS = [
  "search", "look", "examine", "inspect", "investigate", "go", "move", "walk",
  "run", "draw", "attack", "strike", "hit", "talk", "speak", "ask", "tell",
  "open", "close", "grab", "take", "pick", "push", "pull", "climb", "jump",
  "cast", "use", "drink", "eat", "throw", "shoot", "fire", "hide", "sneak",
  "follow", "approach", "enter", "leave", "flee", "fight", "defend", "block",
  "listen", "touch", "read", "light", "break", "kick", "turn", "head", "step",
  "check", "try", "attempt", "find", "explore", "wait", "rest", "help", "call",
];

const VERB_ALTERNATION = IMPERATIVE_VERBS.join("|");

// Sentence-leading bare imperative: optional connective ("then", "and", "or",
// "now") then a command verb at the start of the string or a sentence.
const LEADING_IMPERATIVE = new RegExp(
  `(^|[.;!?]\\s+)(then\\s+|and\\s+|or\\s+|now\\s+)?(${VERB_ALTERNATION})\\b`,
  "i",
);
// Explicit second person directed at the player ("you search", "you must go").
const SECOND_PERSON_DIRECTIVE = new RegExp(
  `\\byou\\s+(can\\s+|could\\s+|should\\s+|must\\s+|may\\s+|might\\s+|will\\s+)?(${VERB_ALTERNATION})\\b`,
  "i",
);

/** True if the text reads as a second-person imperative / command (fails §5.2). */
export function containsImperative(text: string): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  return LEADING_IMPERATIVE.test(t) || SECOND_PERSON_DIRECTIVE.test(t);
}

type ChoiceLike = {
  text?: string;
  action?: string;
  hint?: string;
  type?: string;
  skillType?: string;
};

const choiceText = (c: ChoiceLike): string => (c.action || c.text || "").trim();

/**
 * Deterministic, guaranteed imperative-free fallback. Reframes the action as an
 * impulse/pull rather than a command. Not as evocative as an LLM hint, but it
 * never reads as a button label and always passes the lint.
 */
export function deterministicDiegetic(c: ChoiceLike): string {
  const raw = choiceText(c).replace(/[.!]+$/, "");
  if (!raw) return "Something here invites your attention.";

  // Lowercase the leading word so it becomes an infinitive-style impulse rather
  // than a sentence-initial command ("Search ..." -> "search ...").
  const lowered = raw.charAt(0).toLowerCase() + raw.slice(1);

  const kind = (c.type || c.skillType || "").toLowerCase();
  if (/(perception|investigat|search|insight|explor)/.test(kind)) {
    return `Something about this pulls at your attention — a reason to ${lowered}.`;
  }
  if (/(persuasion|deception|intimidat|social|dialogue|talk)/.test(kind)) {
    return `There's an opening here, if you cared to ${lowered}.`;
  }
  if (/(combat|attack|violence|athletics)/.test(kind)) {
    return `Your instincts tense — the urge to ${lowered} rises unbidden.`;
  }
  if (/(stealth|sneak|hide)/.test(kind)) {
    return `The shadows seem to offer a chance to ${lowered}.`;
  }
  return `You feel a quiet pull to ${lowered}.`;
}

/**
 * Authoritative diegetic string for a choice: the LLM hint when present and
 * lint-clean, otherwise the deterministic fallback. Always imperative-free.
 */
export function renderDiegetic(c: ChoiceLike): string {
  const hint = (c.hint || "").trim();
  if (hint && !containsImperative(hint)) return hint;
  return deterministicDiegetic(c);
}
