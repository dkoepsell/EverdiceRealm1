/**
 * Emergent side quests: occasionally, mid-campaign, someone the party meets (or a
 * rumor, a found letter, a bounty notice...) offers an optional job with its own
 * reward. These land in campaign_quests — the table the Play > Quests tab reads.
 *
 * The per-turn flow has two concurrent AI calls: /advance-story-stream writes the
 * prose the player reads, and /advance-story does the JSON bookkeeping against that
 * same prose. Both must agree on whether THIS turn carries a quest hook, so the
 * decision is a pure function of the pre-turn story state (no Math.random()).
 */

export type QuestHookFlavor = {
  key: string;
  /** Line for the narrator: how the offer enters the scene. */
  narratorLine: (npc: string | null) => string;
  /** Short label stored as the quest's discovery context prefix. */
  label: string;
};

const FLAVORS: QuestHookFlavor[] = [
  {
    key: "npc_request",
    label: "A request",
    narratorLine: (npc) =>
      npc
        ? `${npc}, or someone close to them, quietly asks the party for help with a personal problem unrelated to the main plot.`
        : "Someone the party has just met asks them, a little desperately, for help with a personal problem unrelated to the main plot.",
  },
  {
    key: "overheard",
    label: "Overheard",
    narratorLine: () => "The party overhears a conversation (gossip, an argument, a whispered deal) that hints at a job, a wrong to right, or a prize to claim.",
  },
  {
    key: "found_clue",
    label: "Found",
    narratorLine: () => "The party comes across something that points elsewhere: a sealed letter, a torn map, a dropped ledger, a strange key.",
  },
  {
    key: "bounty",
    label: "Posted bounty",
    narratorLine: () => "A posted notice, town crier, or official offers a bounty or reward for a specific task nearby.",
  },
  {
    key: "stranger",
    label: "A stranger",
    narratorLine: () => "A stranger (a traveler, a child, a wounded messenger, a mysterious patron) approaches the party with an unusual offer.",
  },
  {
    key: "faction",
    label: "A faction's offer",
    narratorLine: () => "An agent of a local guild, temple, or faction sizes the party up and offers them paid work.",
  },
];

/** How many turns must pass between quest offers. */
const MIN_GAP = 5;
/** After this many turns without an offer, one is guaranteed (if otherwise eligible). */
const FORCE_GAP = 12;
/** Chance per eligible turn once MIN_GAP has passed. */
const CHANCE = 0.22;
/** Don't pile up open side quests. */
const MAX_OPEN_SIDE_QUESTS = 3;
/** No hooks in the first few turns; the opening belongs to the main plot. */
const FIRST_ELIGIBLE_TURN = 3;

export type QuestHookState = { turn: number; lastOfferTurn: number };

export function readQuestHookState(storyState: any): QuestHookState {
  const q = storyState?.questHook;
  return {
    turn: Number.isFinite(q?.turn) ? q.turn : 0,
    lastOfferTurn: Number.isFinite(q?.lastOfferTurn) ? q.lastOfferTurn : 0,
  };
}

/** Small deterministic hash → [0,1). */
function unitHash(...parts: (string | number)[]): number {
  let h = 2166136261;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export type QuestHookDecision = {
  offer: boolean;
  /** The turn number this decision is for (pre-turn counter + 1). */
  turn: number;
  flavor: QuestHookFlavor | null;
  npc: string | null;
};

export function isOpenSideQuest(q: any): boolean {
  return !!q?.discoveredByAI && q.questType !== "main" && (q.status === "active" || q.status === "in_progress");
}

export function decideQuestHook(opts: {
  campaignId: number;
  storyState: any;
  openSideQuests: number;
  inCombat: boolean;
  attackIntent?: boolean;
}): QuestHookDecision {
  const { turn: prevTurn, lastOfferTurn } = readQuestHookState(opts.storyState);
  const turn = prevTurn + 1;
  const none: QuestHookDecision = { offer: false, turn, flavor: null, npc: null };
  if (opts.inCombat || opts.attackIntent) return none;
  if (turn < FIRST_ELIGIBLE_TURN) return none;
  if (opts.openSideQuests >= MAX_OPEN_SIDE_QUESTS) return none;
  const gap = turn - lastOfferTurn;
  if (lastOfferTurn > 0 && gap < MIN_GAP) return none;
  const roll = unitHash(opts.campaignId, turn, "offer");
  const offer = gap >= FORCE_GAP || roll < CHANCE;
  if (!offer) return none;

  const npcs: string[] = (Array.isArray(opts.storyState?.npcsEncountered) ? opts.storyState.npcsEncountered : [])
    .map((n: any) => (typeof n === "string" ? n : n?.name))
    .filter((n: any) => typeof n === "string" && n.trim().length > 0)
    .slice(-4);
  const flavor = FLAVORS[Math.floor(unitHash(opts.campaignId, turn, "flavor") * FLAVORS.length)];
  const npc = flavor.key === "npc_request" && npcs.length > 0
    ? npcs[Math.floor(unitHash(opts.campaignId, turn, "npc") * npcs.length)]
    : null;
  return { offer: true, turn, flavor, npc };
}

/** Line for the narrative-stream prompt. */
export function questHookStreamLine(d: QuestHookDecision): string {
  if (!d.offer || !d.flavor) return "";
  return `OPTIONAL SIDE QUEST HOOK (this scene): ${d.flavor.narratorLine(d.npc)} Weave it in naturally after the main action, in one or two sentences. Make clear there is a reward, and leave the party free to take it up or ignore it.`;
}

/** Block for the bookkeeping (JSON) prompt. */
export function questHookBookkeepingBlock(d: QuestHookDecision, openQuests: any[]): string {
  const lines: string[] = [];
  if (openQuests.length > 0) {
    lines.push(
      `OPEN SIDE QUESTS (report progress in "questUpdates" using these exact ids):`,
      ...openQuests.map((q) => {
        const objs = Array.isArray(q.objectives) ? q.objectives.map((o: any) => (typeof o === "string" ? o : o?.text)).filter(Boolean).join("; ") : "";
        return `- id "sq_${q.id}": ${q.title}${q.questGiver ? ` (for ${q.questGiver})` : ""}${objs ? ` — ${objs}` : ""}`;
      }),
      `Mark one "completed" only when the narrative shows the party actually finishing it.`,
    );
  }
  if (d.offer && d.flavor) {
    lines.push(
      `NEW SIDE QUEST THIS TURN: the narrative introduces an optional job (${d.flavor.label.toLowerCase()}${d.npc ? `, involving ${d.npc}` : ""}). Add a top-level "newQuest" field describing it, matching what the narrative says:`,
      `"newQuest": {"title": "Short evocative title", "description": "2-3 sentences: what is wanted, why, and where", "questGiver": "Name of who offered it, or null", "hook": "One sentence: how the party learned of it", "objectives": ["2-3 concrete steps"], "difficulty": "easy|moderate|challenging|deadly", "specialReward": {"name": "A distinctive item, favor, or boon", "description": "One sentence"}}`,
      `Offer one choice that pursues the new quest, alongside the usual choices.`,
    );
  }
  return lines.length ? `\n${lines.join("\n")}\n` : "";
}

const DIFFICULTIES = ["easy", "moderate", "challenging", "deadly"] as const;

/** Rewards are set in code from party level and difficulty, never by the model. */
export function questRewards(level: number, difficulty: string) {
  const lvl = Math.max(1, Math.min(20, Math.round(level || 1)));
  const mult = { easy: 0.75, moderate: 1, challenging: 1.5, deadly: 2 }[difficulty as (typeof DIFFICULTIES)[number]] ?? 1;
  return {
    xpReward: Math.round(lvl * 100 * mult / 25) * 25,
    goldReward: Math.round(lvl * 20 * mult / 5) * 5,
  };
}

/** Normalizes the model's newQuest into a campaign_quests insert, or null if unusable. */
export function buildQuestInsert(raw: any, ctx: { campaignId: number; partyLevel: number; decision: QuestHookDecision }) {
  if (!raw || typeof raw !== "object") return null;
  const title = typeof raw.title === "string" ? raw.title.trim().slice(0, 120) : "";
  const description = typeof raw.description === "string" ? raw.description.trim().slice(0, 1000) : "";
  if (!title || !description) return null;
  const difficulty = DIFFICULTIES.includes(raw.difficulty) ? raw.difficulty : "moderate";
  const objectives = (Array.isArray(raw.objectives) ? raw.objectives : [])
    .map((o: any) => (typeof o === "string" ? o : o?.text))
    .filter((o: any) => typeof o === "string" && o.trim())
    .slice(0, 4)
    .map((text: string) => ({ text: text.trim().slice(0, 200), completed: false }));
  const special = raw.specialReward && typeof raw.specialReward === "object" && typeof raw.specialReward.name === "string"
    ? raw.specialReward.name.trim().slice(0, 100)
    : typeof raw.specialReward === "string" ? raw.specialReward.trim().slice(0, 100) : "";
  const questGiver = typeof raw.questGiver === "string" && raw.questGiver.trim() && raw.questGiver !== "null"
    ? raw.questGiver.trim().slice(0, 100)
    : ctx.decision.npc;
  const hook = typeof raw.hook === "string" ? raw.hook.trim().slice(0, 300) : "";
  const now = new Date().toISOString();
  return {
    campaignId: ctx.campaignId,
    title,
    description,
    questType: "side",
    status: "active",
    objectives,
    ...questRewards(ctx.partyLevel, difficulty),
    lootRewards: special ? [special] : [],
    difficultyRating: difficulty,
    estimatedDuration: "1 session",
    isPostedToBoard: true,
    postedAt: now,
    discoveredByAI: true,
    discoveryContext: hook || `${ctx.decision.flavor?.label ?? "Discovered"} during play`,
    questGiver: questGiver ?? null,
    createdAt: now,
  };
}

/** Pulls "sq_<id>" completions for campaign_quests out of the model's questUpdates. */
export function completedSideQuestIds(questUpdates: any[], openQuests: any[]): number[] {
  const open = new Set(openQuests.map((q) => q.id));
  const ids: number[] = [];
  for (const u of questUpdates) {
    if (u?.newStatus !== "completed") continue;
    const m = /^sq_(\d+)$/.exec(String(u?.questId ?? "").trim());
    const id = m ? Number(m[1]) : NaN;
    if (open.has(id) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}
