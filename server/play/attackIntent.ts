// Detects when a freely-typed player action is an attempt to attack a creature.
//
// Why this exists: /api/campaigns/:id/assess-action used to classify every typed
// action into one of the 18 D&D skills. "I attack the guard" has no skill that
// fits, so the model reliably picked Intimidation — the player could never
// actually swing at anyone. Attacks must bypass the skill-check path entirely and
// route into combat instead.

const ATTACK_VERBS = [
  "attack", "attacks", "attacking",
  "strike", "strikes", "striking",
  "swing", "swings", "swinging",
  "stab", "stabs", "stabbing",
  "slash", "slashes", "slashing",
  "shoot", "shoots", "shooting",
  "fire at", "fires at", "firing at",
  "hit", "hits", "hitting",
  "punch", "punches", "punching",
  "kick", "kicks", "kicking",
  "kill", "kills", "killing",
  "slay", "slays", "slaying",
  "charge", "charges", "charging",
  "lunge", "lunges", "lunging",
  "stomp", "stomps", "smash", "smashes",
  "bash", "bashes", "impale", "impales",
  "behead", "beheads", "cut down", "cuts down",
  "open fire", "loose an arrow", "let fly",
];

const ATTACK_VERB_RE = new RegExp(
  `\\b(${ATTACK_VERBS.map((v) => v.replace(/ /g, "\\s+")).join("|")})\\b`,
  "i",
);

// "draw my sword and ...", "ready my bow", "raise my axe"
const WEAPON_READY_RE =
  /\b(draw|drawing|unsheathe|unsheathes|ready|readies|raise|raises|nock|nocks|level)\b[^.!?]{0,24}\b(sword|blade|axe|dagger|bow|crossbow|mace|hammer|spear|staff|weapon|knife|rapier|scimitar|halberd|glaive)\b/i;

// "cast fireball at the ogre", "cast magic missile on him"
const OFFENSIVE_CAST_RE =
  /\bcast(s|ing)?\b[^.!?]{0,40}\b(at|on|against|toward|towards)\b\s+(the\s+|that\s+|him|her|them|it)/i;

// Phrases that look aggressive but are explicitly NOT an attack — the player is
// posturing, negotiating, or describing something they are choosing not to do.
const NEGATION_RE =
  /\b(don'?t|do not|won'?t|will not|without|instead of|rather than|refuse to|hold (my|the) (fire|attack)|stand down|lower (my|the) weapon|no longer|stop)\b/i;

// Pure threat/posture = genuinely an Intimidation check, not an attack.
const THREAT_ONLY_RE =
  /\b(threaten|threatens|threatening|intimidate|intimidates|intimidating|menace|menaces|scare|scares|bluff|bluffs|warn|warns)\b/i;

export interface AttackIntent {
  isAttack: boolean;
  /** Best-effort target name pulled from the phrasing, e.g. "the guard". */
  target?: string;
}

/**
 * Cheap, deterministic pre-check run before the LLM assessment call.
 * Conservative by design: when it says `isAttack`, we skip the skill roll and go
 * to combat, so false positives are worse than false negatives. Anything it
 * misses still gets a second chance from the LLM's `actionType` field.
 */
export function detectAttackIntent(action: string): AttackIntent {
  const text = (action || "").trim();
  if (!text) return { isAttack: false };

  if (NEGATION_RE.test(text)) return { isAttack: false };

  const hasAttackVerb = ATTACK_VERB_RE.test(text);
  const hasWeaponReady = WEAPON_READY_RE.test(text);
  const hasOffensiveCast = OFFENSIVE_CAST_RE.test(text);

  if (!hasAttackVerb && !hasWeaponReady && !hasOffensiveCast) {
    return { isAttack: false };
  }

  // "I threaten to attack him" is posturing, not a swing.
  if (THREAT_ONLY_RE.test(text) && !hasWeaponReady) {
    return { isAttack: false };
  }

  return { isAttack: true, target: extractTarget(text) };
}

function extractTarget(text: string): string | undefined {
  const m = text.match(
    /\b(?:attack|strike|swing at|stab|slash|shoot|fire at|hit|punch|kick|kill|slay|charge|lunge at|smash|bash|impale)\w*\s+(?:at\s+)?(the\s+\w+(?:\s+\w+)?|[A-Z][a-z]+)/i,
  );
  return m ? m[1].trim() : undefined;
}
