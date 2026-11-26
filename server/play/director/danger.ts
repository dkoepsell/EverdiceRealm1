/**
 * Danger plans (danger spec Phases 1 and 6). When the director deals a
 * `skirmish` or `hazard` beat, the threat is decided HERE, in code, from the
 * party's level, the campaign's pacing and where the party is, and stored on
 * the director state so both prompts for that turn (the streamed narrative
 * and the structured pass) describe the same thing:
 *
 *  - skirmish: an encounter built with the DMG budget (shared/rules/monsters.ts)
 *    from a roster that fits the place, with SRD stat blocks. The game, not the
 *    model, puts these combatants into the fight.
 *  - hazard: a trap or natural hazard with a saving throw, a DC and damage set
 *    by severity and level (DMG "Traps": setback / dangerous; deadly is never
 *    dealt at random). The game, not the model, applies the damage.
 */
import { PACING_PROFILES, type Pacing } from "@shared/engagementFlags";
import type { AbilityName } from "@shared/rules/abilities";
import { MONSTERS, THEME_ROSTERS, adjustedXp, buildEncounter, xpThresholds, type MonsterStats } from "@shared/rules/monsters";

type Rng = () => number;

// ── Where are we? ────────────────────────────────────────────────────────────

export type Terrain = "crypt" | "cave" | "forest" | "swamp" | "coast" | "desert" | "mountain" | "snow" | "town" | "ruin" | "road";

const TERRAIN_WORDS: [Terrain, RegExp][] = [
  ["crypt", /\b(crypt|tomb|grave|catacomb|barrow|ossuary|mausoleum|necropolis|haunted)\b/i],
  ["cave", /\b(cave|cavern|underdark|tunnel|mine|grotto|burrow)\b/i],
  ["swamp", /\b(swamp|marsh|bog|fen|mire|bayou)\b/i],
  ["coast", /\b(coast|sea|shore|reef|harbou?r|beach|dock|pier|cove|lighthouse)\b/i],
  ["desert", /\b(desert|dune|sand|oasis|badlands|wastes?)\b/i],
  ["snow", /\b(snow|ice|icy|tundra|winter|frozen|glacier)\b/i],
  ["mountain", /\b(mountain|peak|cliff|crag|pass|summit|ridge|highlands?)\b/i],
  ["forest", /\b(forest|wood|woods|grove|thicket|glade|jungle)\b/i],
  ["ruin", /\b(ruin|ruins|dungeon|keep|castle|tower|fortress|vault|temple|sanctum)\b/i],
  ["town", /\b(town|city|village|street|alley|market|tavern|inn|square|district|guild|manor|hall)\b/i],
  ["road", /\b(road|trail|path|bridge|crossing|camp|caravan)\b/i],
];

export function terrainFor(text: string | null | undefined): Terrain {
  const t = String(text ?? "");
  for (const [terrain, re] of TERRAIN_WORDS) if (re.test(t)) return terrain;
  return "road";
}

/** Rosters that fit each terrain, most fitting first (keys of THEME_ROSTERS). */
const TERRAIN_THEMES: Record<Terrain, string[]> = {
  crypt: ["undead", "skeleton_guardian"],
  cave: ["kobold", "goblin", "darkmantle", "cave_fisher", "ettercap"],
  forest: ["wolf_pack", "goblin", "ettercap", "owlbear", "bandit"],
  swamp: ["lizardfolk", "green_hag", "undead"],
  coast: ["sahuagin", "bandit"],
  desert: ["desert_bandit", "elemental", "giant_scorpion", "gnoll"],
  mountain: ["goblin", "gnoll", "wolf_pack", "owlbear", "stone_giant", "wyvern"],
  snow: ["wolf_pack", "winter_wolf"],
  town: ["tavern_brawl", "bandit"],
  ruin: ["goblin", "skeleton_guardian", "kobold", "bandit"],
  road: ["bandit", "goblin", "wolf_pack", "gnoll"],
};

// ── Skirmish ─────────────────────────────────────────────────────────────────

export interface PlannedCombatant {
  key: string;
  name: string;
  maxHp: number;
  ac: number;
  attackBonus: number;
  damage: string;
  damageType: string;
  attacks: number;
  cr: number;
}

export interface SkirmishPlan {
  kind: "skirmish";
  theme: string;
  terrain: Terrain;
  difficulty: "easy" | "medium" | "hard";
  combatants: PlannedCombatant[];
  /** "3 wolves: 150 XP x2 = 300 adjusted XP. A medium fight..." (the DMG math, for the rules panel). */
  note: string;
}

function pickDifficulty(pacing: Pacing, rng: Rng, climax: boolean): "easy" | "medium" | "hard" {
  if (climax) return "hard";
  const [e, m] = PACING_PROFILES[pacing].difficultyMix;
  const r = rng();
  return r < e ? "easy" : r < e + m ? "medium" : "hard";
}

/** A theme is usable if even its weakest member doesn't blow the hard budget on its own. */
function themeFits(theme: string, level: number, partySize: number): boolean {
  const roster = (THEME_ROSTERS[theme] ?? []).map((k) => MONSTERS[k]).filter(Boolean) as MonsterStats[];
  if (!roster.length) return false;
  const weakest = roster.reduce((a, b) => (a.xp <= b.xp ? a : b));
  return adjustedXp([weakest], partySize) <= xpThresholds(level, partySize).hard;
}

export function planSkirmish(opts: {
  level: number;
  partySize?: number;
  pacing: Pacing;
  locationText?: string | null;
  climax?: boolean;
  rng?: Rng;
}): SkirmishPlan {
  const rng = opts.rng ?? Math.random;
  const level = Math.max(1, Math.floor(opts.level || 1));
  const partySize = Math.max(1, Math.floor(opts.partySize || 1));
  const terrain = terrainFor(opts.locationText);
  const fitting = TERRAIN_THEMES[terrain].filter((t) => themeFits(t, level, partySize));
  const pool = fitting.length ? fitting : ["bandit"];
  // Favour the first (most fitting) themes, but keep some surprise.
  const theme = rng() < 0.6 ? pool[0] : pool[Math.floor(rng() * pool.length)];
  const difficulty = pickDifficulty(opts.pacing, rng, !!opts.climax);
  const built = buildEncounter(theme, level, difficulty, rng, partySize);
  const counts: Record<string, number> = {};
  for (const m of built.monsters) counts[m.key] = (counts[m.key] ?? 0) + 1;
  const seen: Record<string, number> = {};
  const combatants = built.monsters.map((m) => {
    seen[m.key] = (seen[m.key] ?? 0) + 1;
    const name = counts[m.key] > 1 ? `${m.name} ${seen[m.key]}` : m.name;
    const first = m.attacks[0];
    return {
      key: m.key,
      name,
      maxHp: m.hp,
      ac: m.ac,
      attackBonus: first?.bonus ?? 3,
      damage: first?.damage ?? "1d6",
      damageType: first?.damageType ?? "bludgeoning",
      attacks: m.attacks.length,
      cr: m.cr,
    };
  });
  return { kind: "skirmish", theme, terrain, difficulty, combatants, note: built.note };
}

/** Combatant entries in the shape storyState.combatants uses. */
export function skirmishCombatants(plan: SkirmishPlan) {
  return plan.combatants.map((c) => ({
    name: c.name,
    type: "enemy",
    maxHp: c.maxHp,
    currentHp: c.maxHp,
    ac: c.ac,
    armorClass: c.ac,
    attackBonus: c.attackBonus,
    damage: c.damage,
    damageType: c.damageType,
    cr: String(c.cr),
    srdKey: c.key,
    status: "healthy",
  }));
}

/**
 * Make the planned fight real: whatever the model wrote, the fight starts and
 * the planned enemies are in it with their SRD numbers. Enemies the model
 * added beyond the plan are dropped (the encounter budget is the game's call);
 * party entries it listed are kept.
 */
export function applySkirmishPlan(storyState: any, plan: SkirmishPlan): any {
  const state = storyState && typeof storyState === "object" ? storyState : {};
  const existing: any[] = Array.isArray(state.combatants) ? state.combatants : [];
  const party = existing.filter((c) => c && c.type !== "enemy" && c.type !== "boss");
  state.combatants = [...party, ...skirmishCombatants(plan)];
  state.inCombat = true;
  return state;
}

export function skirmishPromptLine(plan: SkirmishPlan): string {
  const list = plan.combatants.map((c) => `${c.name} (AC ${c.ac}, ${c.maxHp} HP)`).join(", ");
  return `DANGER THIS SCENE (decided by the game): a fight breaks out. The enemies are exactly: ${list}. Make their arrival fit this place and the story so far (an ambush, a patrol, something that was hunting the party, the consequence of an earlier choice). The game starts combat with these enemies and their real stats: set "inCombat": true and list them in "combatants" by these exact names. Do not add other enemies and do not resolve the fight; end the scene with the enemies closing in and offer 2-4 tactical choices.`;
}

// ── Hazard ───────────────────────────────────────────────────────────────────

export type Severity = "setback" | "dangerous";

interface HazardDef {
  id: string;
  name: string;
  terrains: Terrain[] | "any";
  /** Is it a built trap (can be spotted and disarmed) or a natural hazard? */
  trap: boolean;
  ability: AbilityName;
  damageType: string;
  halfOnSuccess: boolean;
  /** How it shows itself, for the narrator. */
  setup: string;
  /** The face-it-head-on choice offered to the player. */
  saveChoice: string;
}

const HAZARDS: HazardDef[] = [
  { id: "pit", name: "Hidden pit", terrains: ["ruin", "cave", "crypt"], trap: true, ability: "dexterity", damageType: "bludgeoning", halfOnSuccess: false, setup: "a section of floor gives way over a pit", saveChoice: "Throw yourself clear of the falling floor" },
  { id: "needle", name: "Poison needle", terrains: ["ruin", "crypt", "town"], trap: true, ability: "constitution", damageType: "poison", halfOnSuccess: true, setup: "a needle springs from a lock or handle the character is touching", saveChoice: "Grit your teeth and fight off the poison" },
  { id: "blade", name: "Swinging blade", terrains: ["ruin", "crypt"], trap: true, ability: "dexterity", damageType: "slashing", halfOnSuccess: true, setup: "a pressure plate clicks and a blade scythes out of the wall", saveChoice: "Duck under the swinging blade" },
  { id: "glyph", name: "Fire glyph", terrains: ["ruin", "crypt"], trap: true, ability: "dexterity", damageType: "fire", halfOnSuccess: true, setup: "a carved rune on the floor flares as someone steps on it", saveChoice: "Dive away from the flaring rune" },
  { id: "ceiling", name: "Collapsing ceiling", terrains: ["ruin", "cave", "crypt"], trap: false, ability: "dexterity", damageType: "bludgeoning", halfOnSuccess: true, setup: "the ceiling groans and stone starts to fall", saveChoice: "Sprint out from under the falling stone" },
  { id: "gas", name: "Poison gas", terrains: ["cave", "crypt", "swamp"], trap: false, ability: "constitution", damageType: "poison", halfOnSuccess: true, setup: "a pocket of foul gas bursts up around the party", saveChoice: "Hold your breath and push through the gas" },
  { id: "rockslide", name: "Rockslide", terrains: ["mountain", "road", "cave"], trap: false, ability: "dexterity", damageType: "bludgeoning", halfOnSuccess: true, setup: "rocks break loose from the slope above and come crashing down", saveChoice: "Leap aside as the rocks come down" },
  { id: "current", name: "Strong current", terrains: ["coast", "swamp", "forest", "road"], trap: false, ability: "strength", damageType: "bludgeoning", halfOnSuccess: false, setup: "the water crossing is deeper and faster than it looked and it drags at the party", saveChoice: "Fight the current and keep your footing" },
  { id: "ice", name: "Thin ice", terrains: ["snow"], trap: false, ability: "dexterity", damageType: "cold", halfOnSuccess: false, setup: "the ice cracks underfoot", saveChoice: "Throw your weight flat before the ice gives way" },
  { id: "quicksand", name: "Sinking mire", terrains: ["swamp", "desert"], trap: false, ability: "strength", damageType: "bludgeoning", halfOnSuccess: false, setup: "the ground turns to sucking mud and the character sinks to the knees", saveChoice: "Haul yourself free of the mire" },
  { id: "lightning", name: "Lightning storm", terrains: ["mountain", "coast", "desert", "road"], trap: false, ability: "dexterity", damageType: "lightning", halfOnSuccess: true, setup: "a storm breaks overhead and lightning starts hitting the high ground", saveChoice: "Get low and away from the strike" },
  { id: "fire", name: "Spreading fire", terrains: ["town", "forest"], trap: false, ability: "dexterity", damageType: "fire", halfOnSuccess: true, setup: "fire catches and spreads faster than anyone expected", saveChoice: "Run through the gap before the flames close" },
  { id: "cart", name: "Runaway cart", terrains: ["town", "road"], trap: false, ability: "dexterity", damageType: "bludgeoning", halfOnSuccess: true, setup: "a heavy cart breaks loose and careers straight at the party", saveChoice: "Throw yourself out of the cart's path" },
  { id: "balcony", name: "Collapsing balcony", terrains: ["town"], trap: false, ability: "dexterity", damageType: "bludgeoning", halfOnSuccess: true, setup: "old timbers split and a balcony or walkway starts to fall", saveChoice: "Grab for something solid as it falls" },
  { id: "spores", name: "Choking spores", terrains: ["forest", "cave", "swamp"], trap: false, ability: "constitution", damageType: "poison", halfOnSuccess: true, setup: "disturbed fungus bursts in a cloud of choking spores", saveChoice: "Cover your face and force your way through" },
  { id: "net", name: "Snare and spikes", terrains: ["forest", "road"], trap: true, ability: "dexterity", damageType: "piercing", halfOnSuccess: true, setup: "a hunter's snare yanks tight and swings the victim toward sharpened stakes", saveChoice: "Twist free before the stakes" },
];

export interface HazardPlan {
  kind: "hazard";
  id: string;
  name: string;
  trap: boolean;
  severity: Severity;
  ability: AbilityName;
  dc: number;
  /** Passive Perception or Investigation to spot it first (built traps only). */
  noticeDc: number | null;
  damage: string;
  damageType: string;
  halfOnSuccess: boolean;
  setup: string;
  saveChoice: string;
  /** Set when the hazard's scene is played, so the next turn's save resolves it. */
  armedAtTurn?: number;
}

/** DMG trap guidance: save DC by severity, damage by severity and level tier. */
export function hazardNumbers(level: number, severity: Severity, rng: Rng = Math.random): { dc: number; damage: string } {
  const tier = level <= 4 ? 0 : level <= 10 ? 1 : 2;
  const dice = severity === "setback" ? ["1d10", "2d10", "4d10"][tier] : ["2d10", "4d10", "10d10"][tier];
  const dc = severity === "setback" ? 10 + Math.floor(rng() * 2) : 12 + Math.floor(rng() * 4);
  return { dc, damage: dice };
}

export function planHazard(opts: { level: number; pacing: Pacing; locationText?: string | null; rng?: Rng }): HazardPlan {
  const rng = opts.rng ?? Math.random;
  const terrain = terrainFor(opts.locationText);
  const fitting = HAZARDS.filter((h) => h.terrains === "any" || h.terrains.includes(terrain));
  const pool = fitting.length ? fitting : HAZARDS.filter((h) => !h.trap);
  const def = pool[Math.floor(rng() * pool.length)];
  const dangerousOdds = opts.pacing === "action" ? 0.6 : opts.pacing === "balanced" ? 0.35 : 0.1;
  const severity: Severity = rng() < dangerousOdds ? "dangerous" : "setback";
  const { dc, damage } = hazardNumbers(opts.level, severity, rng);
  return {
    kind: "hazard",
    id: def.id,
    name: def.name,
    trap: def.trap,
    severity,
    ability: def.ability,
    dc,
    noticeDc: def.trap ? dc : null,
    damage,
    damageType: def.damageType,
    halfOnSuccess: def.halfOnSuccess,
    setup: def.setup,
    saveChoice: def.saveChoice,
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function saveLabel(ability: AbilityName): string {
  return `${cap(ability)} saving throw`;
}

export function hazardPromptLine(plan: HazardPlan): string {
  const notice = plan.trap
    ? ` It is a built trap: a character whose passive Perception or Investigation is ${plan.noticeDc} or higher spots it just in time (report it in "passiveNoticed" with dc ${plan.noticeDc}) and can try to avoid or disarm it instead.`
    : "";
  return `DANGER THIS SCENE (decided by the game): ${plan.name}. In this scene ${plan.setup}.${notice} It is not a fight: no enemies. Offer 2-3 choices. One choice MUST face it with a ${saveLabel(plan.ability)}: give it "requiresDiceRoll": true, "skillType": "${saveLabel(plan.ability)}", "rollDC": ${plan.dc}. Other choices may avoid it another way (an Athletics or Acrobatics check, a clever use of the scene) with a cost. Do NOT apply damage yourself: the game rolls ${plan.damage} ${plan.damageType} damage on a failed save${plan.halfOnSuccess ? " and half on a success" : ""}.`;
}

/** The save choice, added by the game if the model forgot it. */
export function hazardSaveChoice(plan: HazardPlan) {
  return {
    text: plan.saveChoice,
    action: plan.saveChoice,
    type: "hazard",
    requiresDiceRoll: true,
    skillType: saveLabel(plan.ability),
    rollDC: plan.dc,
    rollPurpose: saveLabel(plan.ability),
    diceType: "d20",
  };
}

/** Make sure the hazard scene offers its saving throw. */
export function ensureHazardChoice<T extends Record<string, any>>(choices: T[], plan: HazardPlan): T[] {
  const label = saveLabel(plan.ability).toLowerCase();
  const has = choices.some((c) => String(c?.skillType ?? c?.rollPurpose ?? "").toLowerCase().includes(label.split(" ")[0]) && /save|saving/i.test(String(c?.skillType ?? c?.rollPurpose ?? "")));
  if (has) {
    // Hold the model to the game's DC.
    return choices.map((c) =>
      /save|saving/i.test(String(c?.skillType ?? c?.rollPurpose ?? "")) ? { ...c, rollDC: plan.dc, requiresDiceRoll: true } : c,
    );
  }
  return [hazardSaveChoice(plan) as unknown as T, ...choices].slice(0, 3);
}

function rollDice(expr: string, rng: Rng): { total: number; rolls: number[] } {
  const m = expr.match(/^(\d+)d(\d+)(?:\s*\+\s*(\d+))?$/);
  if (!m) return { total: 0, rolls: [] };
  const n = Number(m[1]);
  const sides = Number(m[2]);
  const rolls = Array.from({ length: n }, () => 1 + Math.floor(rng() * sides));
  return { total: rolls.reduce((a, b) => a + b, 0) + Number(m[3] ?? 0), rolls };
}

export interface HazardOutcome {
  damage: number;
  saved: boolean;
  text: string;
}

/**
 * Resolve the armed hazard against the roll the player made. Only the
 * hazard's own saving throw resolves it; choosing another way out (no roll,
 * or a different check) leaves the damage to the story's failure cost.
 */
export function resolveHazard(plan: HazardPlan | null | undefined, rollResult: any, rng: Rng = Math.random): HazardOutcome | null {
  if (!plan || !rollResult) return null;
  const skill = String(rollResult.skill ?? rollResult.purpose ?? "").toLowerCase();
  if (!skill.includes(plan.ability) || !/save/.test(skill)) return null;
  const saved = !!rollResult.success || (typeof rollResult.total === "number" && rollResult.total >= plan.dc);
  const roll = rollDice(plan.damage, rng);
  const damage = saved ? (plan.halfOnSuccess ? Math.floor(roll.total / 2) : 0) : roll.total;
  const how = saved
    ? plan.halfOnSuccess
      ? `Saved: half of ${plan.damage} (${roll.total}) = ${damage} ${plan.damageType} damage.`
      : "Saved: no damage."
    : `Failed: ${plan.damage} (${roll.rolls.join(" + ")}) = ${damage} ${plan.damageType} damage.`;
  return { damage, saved, text: `${plan.name}, ${saveLabel(plan.ability)} DC ${plan.dc}. ${how}` };
}
