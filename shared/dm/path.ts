/**
 * The DM path: learning to run D&D by making real things. Seven steps, each
 * an exercise that produces something (a fight, an NPC, a mystery, a playable
 * dungeon, a session-zero plan) and ends with running a game for someone else.
 *
 * Also here: "behind the screen" notes that explain the DM craft behind what
 * just happened in play, and the five-room dungeon builder (a widely used
 * structure for short adventures: guardian, puzzle, setback, climax, reward),
 * which turns a design into a Delve dungeon you can playtest.
 */
import { MONSTERS, THEME_ROSTERS, adjustedXp, buildEncounter, rateEncounter, xpThresholds, type MonsterStats } from "../rules/monsters";

// ── steps ─────────────────────────────────────────────────────────────────────

export type DmStepId = "dm_job" | "fair_fight" | "npc" | "three_clues" | "five_room" | "session_zero" | "run_a_game";

export interface DmStep {
  id: DmStepId;
  title: string;
  pitch: string;
  minutes: number;
  /** The short lesson, in plain paragraphs. */
  lesson: string[];
  /** What you do to complete it. */
  exercise: string;
}

export const DM_STEPS: DmStep[] = [
  {
    id: "dm_job", title: "What a DM actually does", minutes: 5,
    pitch: "Describe, ask, adjudicate. And make it fun for the table.",
    lesson: [
      "A DM's loop is simple: describe the situation, ask the players what they do, and decide what happens. The rules help with the deciding, but they don't replace your judgement.",
      "Only call for a roll when the outcome is uncertain and failure would be interesting. If the rogue has all day to pick a simple lock, they just open it.",
      "Your job is the game, not victory. Monsters should play to win within reason, but you're on the players' side: you want them to have a story worth telling.",
      "You've been watching a DM work all along. Turn on \"Behind the screen\" notes in Wander and Delve to see the choices behind what happens.",
    ],
    exercise: "Read this, then mark it done.",
  },
  {
    id: "fair_fight", title: "Build a fair fight", minutes: 10,
    pitch: "The DMG's encounter math, and why a fight should be a decision.",
    lesson: [
      "Each monster is worth XP. Add it up, then multiply for numbers: two monsters count as 1.5x, three to six as 2x, because more attacks and more targets matter more than raw hit points. Parties of fewer than three use the next multiplier up.",
      "Compare the total with the party's thresholds (per character: level 1 is 25 easy, 50 medium, 75 hard, 100 deadly). A day of adventuring is several medium and hard fights, not one deadly one.",
      "Give the fight a reason and a way out: an objective other than killing, terrain worth using, monsters that flee when they're losing. Wander's fights do all three.",
    ],
    exercise: "Use the encounter builder to make a Medium encounter for four level 2 characters.",
  },
  {
    id: "npc", title: "Make an NPC people remember", minutes: 10,
    pitch: "A want, a secret, and one thing the players will imitate.",
    lesson: [
      "Players don't remember stat blocks; they remember what an NPC wanted from them. Give every important NPC a want they'll pursue whether or not the players help.",
      "A secret gives players something to discover. A voice or a habit (Tamsin's feathered hat, Brannoc talking to his goat) makes them easy to bring back.",
      "Track attitude. An NPC the players helped should greet them differently next time. That's what the Campaign Ledger does for you.",
    ],
    exercise: "Write an NPC with a name, a want, a secret, a voice, and a starting attitude.",
  },
  {
    id: "three_clues", title: "Clues that can't be missed", minutes: 10,
    pitch: "The three clue rule: for every conclusion, three ways to reach it.",
    lesson: [
      "Players will miss clues, misread them, or never go into the room where you hid one. For every conclusion they need to reach, plant at least three clues, in different places, found in different ways.",
      "Wander's trails do this: tracks, a raided wagon, drums at dusk, each pointing the same way. Rumors can be wrong, too; mixing true and false information is fine as long as the true path has redundancy.",
      "Clues should be things players find, not checks they pass. A failed Investigation roll can cost time or add danger, but it shouldn't end the mystery.",
    ],
    exercise: "Write a conclusion and three clues that each point to it, found in different places.",
  },
  {
    id: "five_room", title: "Design a five-room dungeon", minutes: 20,
    pitch: "Guardian, puzzle, setback, climax, reward. Then play it.",
    lesson: [
      "A short adventure fits in five rooms. 1: a guardian at the entrance, explaining why it's not been looted. 2: a puzzle or a roleplaying challenge. 3: a trick or setback that raises the tension. 4: the big fight. 5: the reward, ideally with a twist.",
      "Each room should give players a different kind of thing to do. A dungeon of five fights is a slog; a dungeon of five puzzles is a quiz.",
      "When it's built, play it yourself in Delve. Playtesting is how DMs find the room that's too hard or the puzzle nobody can solve.",
    ],
    exercise: "Build a five-room dungeon, then playtest it in Delve.",
  },
  {
    id: "session_zero", title: "Session zero and table safety", minutes: 10,
    pitch: "Agree on the game before you play it.",
    lesson: [
      "Before the first real session, get everyone together to agree what kind of game it is: tone, how much combat versus talking, how dark things get, how often you'll meet.",
      "Ask about lines (things that won't appear at all) and veils (things that can happen off-screen). Offer a simple way to pause or skip content during play, like an X-card that anyone can tap without explaining why.",
      "Make characters together so they have reasons to know each other. Collect a bond from each player: those are your best adventure hooks.",
    ],
    exercise: "Fill in a session-zero checklist for a game you'd like to run.",
  },
  {
    id: "run_a_game", title: "Run your first game", minutes: 120,
    pitch: "One other player is enough. Start with a one-shot.",
    lesson: [
      "Your first game doesn't need to be long or perfect. A one-shot of your five-room dungeon, for one or two friends, is a real game of D&D.",
      "Use the Live Session Manager in the DM Toolkit: invite players to a campaign you create, then run the session. Post it on Find a Game if you need players.",
      "Afterwards, ask your players one thing they enjoyed and one thing they'd change. Then run another.",
    ],
    exercise: "Run a session as DM with at least one other player. It completes on its own when you have.",
  },
];

export function getStep(id: string): DmStep | undefined {
  return DM_STEPS.find((s) => s.id === id);
}

// ── behind the screen ─────────────────────────────────────────────────────────

export type ScreenNoteId =
  | "encounter_math" | "surprise" | "morale" | "breadcrumbs" | "many_solutions" | "false_rumor"
  | "doom_clock" | "recurring_npc" | "landmark" | "personal_hook" | "knock_out" | "rest_pressure";

export interface ScreenNote { id: ScreenNoteId; title: string; text: string; step: DmStepId }

export const SCREEN_NOTES: Record<ScreenNoteId, ScreenNote> = {
  encounter_math: { id: "encounter_math", step: "fair_fight", title: "How this fight was built", text: "The DM added up the monsters' XP, multiplied for their numbers, and compared it with your level's thresholds. That's the line above the fight: it's how DMs make fights hard but fair." },
  surprise: { id: "surprise", step: "fair_fight", title: "Why someone was surprised", text: "The DM compared the monsters' Stealth with your passive Perception. It rewards careful travel and makes the choice of pace matter, without asking you to roll." },
  morale: { id: "morale", step: "fair_fight", title: "Why it ran away", text: "Real creatures don't fight to the death. The DMG's morale rule ends fights before they become a slog, and gives you prisoners and survivors to deal with." },
  breadcrumbs: { id: "breadcrumbs", step: "three_clues", title: "Why there's always another clue", text: "This trail has several clues pointing the same way, so missing one doesn't end it. DMs call it the three clue rule." },
  many_solutions: { id: "many_solutions", step: "five_room", title: "Why there's more than one way through", text: "A good climax can be fought, sneaked past or talked down. Offering several approaches lets every kind of player and character shine." },
  false_rumor: { id: "false_rumor", step: "three_clues", title: "Why rumors lie", text: "Not every rumor is true, and that's fine, as long as the real leads have backup. A little uncertainty makes the true ones feel earned." },
  doom_clock: { id: "doom_clock", step: "dm_job", title: "Why the world moved on", text: "DMs keep clocks for threats the players ignore. When one runs out, the world changes. It makes choices matter, and it's counted in game days, not real ones." },
  recurring_npc: { id: "recurring_npc", step: "npc", title: "Why they remember you", text: "This character has a want and remembers how you treated them. Recurring NPCs with wants are the cheapest way for a DM to make a world feel alive." },
  landmark: { id: "landmark", step: "dm_job", title: "Why you can see it from here", text: "Giving players something on the horizon turns wandering into a decision. In a hexcrawl, visible landmarks are how DMs say \"there's something over there\"." },
  personal_hook: { id: "personal_hook", step: "session_zero", title: "Why this one is personal", text: "This trail comes from your character's background. DMs collect bonds at session zero precisely so they can do this." },
  knock_out: { id: "knock_out", step: "dm_job", title: "Why you're not dead", text: "The rules let an attacker knock a creature out instead of killing it. DMs use it when death would end the story rather than raise the stakes." },
  rest_pressure: { id: "rest_pressure", step: "fair_fight", title: "Why resting is a choice", text: "Rests restore you, but they cost time, food and water. DMs use that cost to make the adventuring day a series of decisions." },
};

// ── session zero ──────────────────────────────────────────────────────────────

export const SESSION_ZERO_ITEMS = [
  { id: "pitch", label: "A one-paragraph pitch: what the game is about" },
  { id: "tone", label: "Tone agreed: heroic, gritty, funny, spooky..." },
  { id: "pillars", label: "The mix of combat, exploration and roleplay" },
  { id: "lines_veils", label: "Lines and veils asked for and written down" },
  { id: "pause_tool", label: "A way to pause or skip content (an X-card or similar)" },
  { id: "schedule", label: "When and how often you'll play, and for how long" },
  { id: "characters", label: "Characters made together, each with a reason to be in the party" },
  { id: "bonds", label: "A bond collected from each player to use as a hook" },
] as const;

// ── the encounter exercise ────────────────────────────────────────────────────

export const FAIR_FIGHT_GOAL = { partyLevel: 2, partySize: 4, rating: "medium" as const };

export function rateMonsterList(keys: Array<{ key: string; count: number }>, partyLevel: number, partySize: number) {
  const monsters: MonsterStats[] = [];
  for (const k of keys) {
    const m = MONSTERS[k.key];
    if (!m) continue;
    for (let i = 0; i < Math.max(0, Math.min(12, Math.floor(k.count))); i++) monsters.push(m);
  }
  const adj = adjustedXp(monsters, partySize);
  const raw = monsters.reduce((s, m) => s + m.xp, 0);
  return { count: monsters.length, raw, adjusted: adj, rating: monsters.length ? rateEncounter(adj, partyLevel, partySize) : "trivial", thresholds: xpThresholds(partyLevel, partySize) };
}

// ── NPC and clue exercises ────────────────────────────────────────────────────

export interface NpcDraft { name: string; want: string; secret: string; voice: string; attitude: number }
export interface ClueDraft { conclusion: string; clues: Array<{ clue: string; where: string }> }

const clean = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function checkNpc(d: Partial<NpcDraft>): { ok: boolean; draft: NpcDraft; tips: string[] } {
  const draft: NpcDraft = { name: clean(d.name, 60), want: clean(d.want, 200), secret: clean(d.secret, 200), voice: clean(d.voice, 160), attitude: Math.max(-3, Math.min(3, Math.round(Number(d.attitude) || 0))) };
  const tips: string[] = [];
  if (!draft.want) tips.push("Give them a want: something they'll pursue whether or not the players help.");
  if (!draft.secret) tips.push("Give them a secret, so there's something for players to discover.");
  if (!draft.voice) tips.push("Give them a voice or a habit, so you can bring them back and players recognise them.");
  if (draft.want && /^(to )?(help|be nice|be helpful)/i.test(draft.want)) tips.push("\"To help\" isn't much of a want. What do they want for themselves?");
  return { ok: !!(draft.name && draft.want && draft.secret && draft.voice), draft, tips };
}

export function checkClues(d: Partial<ClueDraft>): { ok: boolean; draft: ClueDraft; tips: string[] } {
  const clues = (Array.isArray(d.clues) ? d.clues : []).slice(0, 6).map((c) => ({ clue: clean(c?.clue, 200), where: clean(c?.where, 120) })).filter((c) => c.clue);
  const draft: ClueDraft = { conclusion: clean(d.conclusion, 200), clues };
  const tips: string[] = [];
  if (!draft.conclusion) tips.push("Start with the conclusion players need to reach.");
  if (clues.length < 3) tips.push(`You have ${clues.length} clue${clues.length === 1 ? "" : "s"}. The rule is at least three.`);
  const places = new Set(clues.map((c) => c.where.toLowerCase()).filter(Boolean));
  if (clues.length >= 3 && places.size < 3) tips.push("Put the clues in different places, so skipping one room or one NPC doesn't lose them all.");
  if (clues.some((c) => !c.where)) tips.push("Say where each clue is found.");
  return { ok: !!draft.conclusion && clues.length >= 3 && places.size >= 3 && clues.every((c) => c.where), draft, tips };
}

// ── five-room dungeon builder ─────────────────────────────────────────────────

export const FIVE_ROOM_THEMES = ["goblin", "kobold", "bandit", "undead", "beast", "gnoll", "lizardfolk", "elemental", "ettercap"] as const;
export const PUZZLE_SKILLS = ["investigation", "arcana", "history", "religion", "nature", "insight", "persuasion", "perception", "athletics"] as const;
export const TRAP_SAVES = ["dexterity", "constitution", "strength", "wisdom"] as const;

export interface FiveRoomDraft {
  title: string;
  theme: string;
  partyLevel: number;
  rooms: {
    guardian: { name: string; description: string; difficulty: "easy" | "medium" | "hard" };
    puzzle: { name: string; description: string; skill: string; dc: number; hint: string; solution: string };
    setback: { name: string; description: string; save: string; dc: number; damageDice: number };
    climax: { name: string; description: string; bossName: string; difficulty: "medium" | "hard" | "deadly" };
    reward: { name: string; description: string; twist: string };
  };
}

export interface FiveRoomCheck { ok: boolean; draft: FiveRoomDraft; tips: string[]; ratings: { guardian: string; climax: string } }

const dcLabel = (dc: number) => (dc <= 7 ? "very easy" : dc <= 12 ? "easy to medium" : dc <= 17 ? "medium to hard" : dc <= 22 ? "hard" : "nearly impossible");

/** Clean a draft and give feedback in DMG terms. */
export function checkFiveRoom(raw: any): FiveRoomCheck {
  const r = raw?.rooms ?? {};
  const level = Math.max(1, Math.min(10, Math.round(Number(raw?.partyLevel) || 1)));
  const theme = (FIVE_ROOM_THEMES as readonly string[]).includes(raw?.theme) ? raw.theme : "goblin";
  const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => ((list as readonly string[]).includes(String(v)) ? (v as T) : d);
  const num = (v: unknown, lo: number, hi: number, d: number) => Math.max(lo, Math.min(hi, Math.round(Number(v) || d)));
  const draft: FiveRoomDraft = {
    title: clean(raw?.title, 60) || "Untitled Dungeon",
    theme,
    partyLevel: level,
    rooms: {
      guardian: { name: clean(r.guardian?.name, 60), description: clean(r.guardian?.description, 600), difficulty: oneOf(r.guardian?.difficulty, ["easy", "medium", "hard"] as const, "easy") },
      puzzle: { name: clean(r.puzzle?.name, 60), description: clean(r.puzzle?.description, 600), skill: oneOf(r.puzzle?.skill, PUZZLE_SKILLS, "investigation"), dc: num(r.puzzle?.dc, 5, 30, 12), hint: clean(r.puzzle?.hint, 300), solution: clean(r.puzzle?.solution, 400) },
      setback: { name: clean(r.setback?.name, 60), description: clean(r.setback?.description, 600), save: oneOf(r.setback?.save, TRAP_SAVES, "dexterity"), dc: num(r.setback?.dc, 5, 30, 12), damageDice: num(r.setback?.damageDice, 1, 10, 2) },
      climax: { name: clean(r.climax?.name, 60), description: clean(r.climax?.description, 600), bossName: clean(r.climax?.bossName, 60), difficulty: oneOf(r.climax?.difficulty, ["medium", "hard", "deadly"] as const, "hard") },
      reward: { name: clean(r.reward?.name, 60), description: clean(r.reward?.description, 600), twist: clean(r.reward?.twist, 300) },
    },
  };
  const tips: string[] = [];
  const R = draft.rooms;
  for (const [k, room] of Object.entries(R)) if (!(room as any).name || !(room as any).description) tips.push(`Room ${["guardian", "puzzle", "setback", "climax", "reward"].indexOf(k) + 1} (${k}) needs a name and a description.`);
  if (!R.puzzle.hint) tips.push("Give the puzzle a hint. Stuck players should have a way in, even if it costs them something.");
  if (!R.puzzle.solution) tips.push("Write down the solution, so you'll know it when a player says it.");
  if (R.puzzle.dc >= 20) tips.push(`DC ${R.puzzle.dc} is ${dcLabel(R.puzzle.dc)} for a level ${level} character. The DMG's ladder: 10 easy, 15 medium, 20 hard.`);
  if (R.setback.damageDice > level * 2) tips.push(`${R.setback.damageDice}d10 is a lot of trap damage at level ${level}. The DMG's setback trap for levels 1 to 4 is about 1d10 to 2d10.`);
  if (!R.reward.twist) tips.push("Add a twist to the reward: the treasure is cursed, the prisoner is the villain's child, the map leads somewhere worse.");
  const guard = buildEncounter(theme, level, R.guardian.difficulty, () => 0.5, 4);
  const climaxDifficulty = R.climax.difficulty === "deadly" ? "hard" : R.climax.difficulty;
  const climaxEnc = buildEncounter(theme, level, climaxDifficulty, () => 0.5, 4);
  if (R.climax.difficulty === "deadly") tips.push("A deadly climax can end the campaign. Make sure players have a way to retreat, bargain or win without a straight fight.");
  if (R.guardian.difficulty === "hard" && R.climax.difficulty !== "deadly") tips.push("The guardian is as hard as the climax. Usually the entrance is a warm-up.");
  return { ok: tips.every((t) => !/needs a name/.test(t)), draft, tips, ratings: { guardian: guard.rating, climax: R.climax.difficulty === "deadly" ? "deadly" : climaxEnc.rating } };
}

/** Delve stat block from an SRD monster. */
function delveBlock(m: MonsterStats) {
  const abilities = [
    ...(m.attacks.length > 1 ? [`Multiattack (${m.attacks.length} attacks)`] : []),
    ...(m.traits.includes("pack_tactics") ? ["Pack Tactics"] : []),
    ...(m.traits.includes("nimble_escape") ? ["Nimble Escape"] : []),
  ];
  return { name: m.name, cr: m.cr, hp: m.hp, ac: m.ac, attackBonus: m.attacks[0].bonus, damage: m.attacks[0].damage, abilities };
}

/**
 * Turn a five-room design into Delve nodes: entrance, guardian (encounter),
 * puzzle, setback (trap), climax (boss), reward (chest), in a line.
 * Monsters come from the DMG budget for a party of four at the given level.
 */
export function fiveRoomToNodes(d: FiveRoomDraft): any[] {
  const R = d.rooms;
  const guard = buildEncounter(d.theme, d.partyLevel, R.guardian.difficulty, () => 0.5, 4);
  const climaxEnc = buildEncounter(d.theme, d.partyLevel, R.climax.difficulty === "deadly" ? "hard" : R.climax.difficulty, () => 0.5, 4);
  const strongest = [...climaxEnc.monsters].sort((a, b) => b.xp - a.xp)[0] ?? MONSTERS[(THEME_ROSTERS[d.theme] ?? ["goblin"])[0]];
  const bossScale = R.climax.difficulty === "deadly" ? 2 : 1.5;
  const boss = { ...delveBlock(strongest), name: R.climax.bossName || `${strongest.name} Chief`, hp: Math.round(strongest.hp * bossScale) };
  const ids = ["pm-0", "pm-1", "pm-2", "pm-3", "pm-4", "pm-5"];
  const adj = (i: number) => [ids[i - 1], ids[i + 1]].filter(Boolean) as string[];
  return [
    { nodeId: ids[0], q: 0, r: 0, type: "entrance", name: `${d.title}: Entrance`, description: `The way into ${d.title}.`, adjacentNodes: adj(0) },
    { nodeId: ids[1], q: 1, r: 0, type: "encounter", name: R.guardian.name, description: R.guardian.description, adjacentNodes: adj(1),
      encounterData: { enemies: guard.monsters.map(delveBlock), xpReward: guard.monsters.reduce((s, m) => s + m.xp, 0), tacticalNote: guard.note } },
    { nodeId: ids[2], q: 2, r: 0, type: "puzzle", name: R.puzzle.name, description: R.puzzle.description, adjacentNodes: adj(2),
      puzzleData: { type: R.puzzle.skill, description: R.puzzle.description, dc: R.puzzle.dc, hint: R.puzzle.hint, solutionNarrative: R.puzzle.solution || "You work it out.", failureNarrative: "It resists you, for now." } },
    { nodeId: ids[3], q: 3, r: 0, type: "trap", name: R.setback.name, description: R.setback.description, adjacentNodes: adj(3),
      trapData: { type: R.setback.save, dc: R.setback.dc, damage: `${R.setback.damageDice}d10`, disarmDC: R.setback.dc, detectDC: Math.max(5, R.setback.dc - 2), triggerDescription: R.setback.description } },
    { nodeId: ids[4], q: 4, r: 0, type: "boss", name: R.climax.name, description: R.climax.description, adjacentNodes: adj(4),
      bossData: { ...boss, phases: [], xpReward: Math.round(strongest.xp * bossScale) } },
    { nodeId: ids[5], q: 5, r: 0, type: "chest", name: R.reward.name, description: `${R.reward.description}${R.reward.twist ? ` ${R.reward.twist}` : ""}`, adjacentNodes: adj(5) },
  ];
}

// ── live-play nudges ──────────────────────────────────────────────────────────

export interface NudgeFacts {
  maxCharacterLevel: number;
  lessonsLearned: number;
  trailsResolved: number;
  dmStepsDone: DmStepId[];
  hasRunGame: boolean;
  openToPlay: boolean;
}

export interface Nudge { id: string; title: string; text: string; actions: Array<{ label: string; href: string }> }

/**
 * Milestone nudges toward the table. Each shows once, can be dismissed, and
 * links to places that already exist (Find a Game, guilds, the DM path).
 * Nothing here contacts anyone on the player's behalf.
 */
export function nudgesFor(f: NudgeFacts): Nudge[] {
  const out: Nudge[] = [];
  const done = new Set(f.dmStepsDone);
  if (f.maxCharacterLevel >= 3 && !f.openToPlay) out.push({
    id: "table_ready", title: "You're ready for a real table",
    text: "Level 3 is where most groups start. Playing with people is the best part of D&D: Find a Game lists open seats, and guilds are groups who play together.",
    actions: [{ label: "Find a game", href: "/community?tab=find-a-game" }, { label: "Browse guilds", href: "/community?tab=guilds" }, { label: "Say you're open to play", href: "/dm-path#play-together" }],
  });
  if ((f.lessonsLearned >= 3 || f.trailsResolved >= 2 || f.maxCharacterLevel >= 4) && done.size === 0) out.push({
    id: "dm_curious", title: "Ever thought of running a game?",
    text: "You've seen a lot of what a DM does. The DM path teaches it by doing: build a fair fight, write an NPC, design a dungeon you can play yourself.",
    actions: [{ label: "Start the DM path", href: "/dm-path" }],
  });
  if (done.has("five_room") && !f.hasRunGame) out.push({
    id: "run_your_dungeon", title: "Run your dungeon for someone",
    text: "You've designed and playtested a dungeon. A one-shot for one or two friends is a real game, and it's the last step of the DM path.",
    actions: [{ label: "Post a one-shot", href: "/dm-path#run" }, { label: "Open the DM Toolkit", href: "/dm-toolkit" }],
  });
  if (f.maxCharacterLevel >= 5) out.push({
    id: "tier_two", title: "Tier two: heroes of the realm",
    text: "From level 5, characters change the world around them. It's a great time to join a long-running group, or start one.",
    actions: [{ label: "Find a campaign", href: "/community?tab=find-a-game" }],
  });
  return out;
}

// ── play together ─────────────────────────────────────────────────────────────

export const PLAY_SLOTS = ["weekday mornings", "weekday afternoons", "weekday evenings", "weekend mornings", "weekend afternoons", "weekend evenings"] as const;
export const PLAY_ROLES = ["player", "dm", "either"] as const;
export const PLAY_STYLES = ["roleplay", "combat", "exploration", "mixed", "beginner-friendly"] as const;
