/**
 * Starting a fight the narrator forgot to start.
 *
 * Combat only begins when the story AI sets storyState.inCombat and lists the
 * enemy in storyState.combatants. When it doesn't — it narrates a zombie
 * lurching at the party but leaves the structured state empty — a player's
 * weapon attack has nothing to land on: the damage is dropped, the creature
 * has no HP, and the fight can run forever. Hollow Crown's zombie took hits on
 * turns 113–125 and never fell.
 *
 * So a weapon attack against a named creature, outside combat, starts combat
 * with that creature using SRD-ish stats.
 */

interface StatLine { hp: number; ac: number; cr: string }

// SRD 5e average HP / AC for creatures the narrator reaches for most often.
const KNOWN: Record<string, StatLine> = {
  rat: { hp: 1, ac: 10, cr: "0" },
  "giant rat": { hp: 7, ac: 12, cr: "1/8" },
  wolf: { hp: 11, ac: 13, cr: "1/4" },
  "dire wolf": { hp: 37, ac: 14, cr: "1" },
  goblin: { hp: 7, ac: 15, cr: "1/4" },
  hobgoblin: { hp: 11, ac: 18, cr: "1/2" },
  bugbear: { hp: 27, ac: 16, cr: "1" },
  kobold: { hp: 5, ac: 12, cr: "1/8" },
  orc: { hp: 15, ac: 13, cr: "1/2" },
  gnoll: { hp: 22, ac: 15, cr: "1/2" },
  bandit: { hp: 11, ac: 12, cr: "1/8" },
  "bandit captain": { hp: 65, ac: 15, cr: "2" },
  thug: { hp: 32, ac: 11, cr: "1/2" },
  guard: { hp: 11, ac: 16, cr: "1/8" },
  cultist: { hp: 9, ac: 12, cr: "1/8" },
  skeleton: { hp: 13, ac: 13, cr: "1/4" },
  zombie: { hp: 22, ac: 8, cr: "1/4" },
  "ogre zombie": { hp: 85, ac: 8, cr: "2" },
  ghoul: { hp: 22, ac: 12, cr: "1" },
  ghast: { hp: 36, ac: 13, cr: "2" },
  shadow: { hp: 16, ac: 12, cr: "1/2" },
  specter: { hp: 22, ac: 12, cr: "1" },
  wight: { hp: 45, ac: 14, cr: "3" },
  wraith: { hp: 67, ac: 13, cr: "5" },
  "giant spider": { hp: 26, ac: 14, cr: "1" },
  ogre: { hp: 59, ac: 11, cr: "2" },
  troll: { hp: 84, ac: 15, cr: "5" },
  "gelatinous cube": { hp: 84, ac: 6, cr: "2" },
  mimic: { hp: 58, ac: 12, cr: "2" },
};

/** Stats for a creature by name: exact match, then the longest known name it contains. */
export function lookupCreatureStats(name: string, partyLevel = 1): StatLine {
  const key = name.toLowerCase().replace(/\s+/g, " ").trim();
  if (KNOWN[key]) return KNOWN[key];
  const contained = Object.keys(KNOWN)
    .filter(k => new RegExp(`\\b${k}s?\\b`).test(key))
    .sort((a, b) => b.length - a.length)[0];
  if (contained) return KNOWN[contained];
  // Unknown creature: a fair fight for one hero of the party's level.
  const lvl = Math.max(1, partyLevel);
  return { hp: 10 + lvl * 7, ac: 12 + Math.floor(lvl / 4), cr: lvl <= 2 ? "1/2" : String(Math.ceil(lvl / 2)) };
}

/** A combatant entry in the shape storyState.combatants uses. */
export function buildCombatantFor(name: string, partyLevel = 1) {
  const s = lookupCreatureStats(name, partyLevel);
  const boss = /\b(king|queen|lord|lich|dragon|boss)\b/i.test(name);
  const hp = boss ? s.hp * 2 : s.hp;
  return {
    name,
    type: boss ? "boss" : "enemy",
    maxHp: hp,
    currentHp: hp,
    ac: s.ac,
    cr: s.cr,
    status: "healthy",
  };
}

/**
 * If a weapon attack targets a creature while no fight is running and the AI
 * didn't start one, start it. Mutates and returns `storyState` (created if absent).
 * Returns null when nothing needed doing.
 */
export function ensureCombatForAttack(
  rollResult: any,
  priorState: { inCombat?: boolean; combatants?: any[] } | null | undefined,
  storyState: any,
  partyLevel = 1,
): any | null {
  if (!rollResult || rollResult.type !== "weapon_attack") return null;
  const targetName: string | undefined = rollResult.targetName || rollResult.target;
  if (!targetName || typeof targetName !== "string") return null;
  if (priorState?.inCombat && (priorState.combatants?.length ?? 0) > 0) return null;

  const state = storyState || {};
  const existing: any[] = Array.isArray(state.combatants) ? state.combatants : [];
  const hasTarget = existing.some(c => c?.name?.toLowerCase() === targetName.toLowerCase());
  state.combatants = hasTarget ? existing : [...existing, buildCombatantFor(targetName, partyLevel)];
  state.inCombat = true;
  return state;
}

/**
 * Prompt block for a declared attack. Both narrative prompts need it: the
 * streamed text is locked in as canonical, so if only the structured pass knew
 * it was an attack, the stream could narrate "The Diplomatic Approach" for
 * "attack the zombie" and the structured pass had to stay consistent with that.
 */
export function attackIntentDirective(): string {
  return `
COMBAT INITIATION — THE PLAYER IS ATTACKING:
The player's action is an ATTACK on a creature, not a social or skill attempt.
- You MUST set "inCombat": true in your response.
- You MUST populate "combatants" with the player character(s) and every hostile present, each with name, type ("player"/"ally"/"enemy"/"boss"), maxHp, currentHp, armorClass and initiative.
- Narrate the opening strike and the target's reaction. Do NOT resolve the whole fight in one paragraph, and do NOT convert this into an Intimidation, Persuasion or Athletics outcome.
- If the target is genuinely non-hostile or helpless, still honour the attack: describe the consequences (bystanders scattering, guards summoned, reputation damage) rather than refusing the action.`;
}
