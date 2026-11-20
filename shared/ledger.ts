/**
 * Campaign Ledger types and display helpers (engagement spec Phase 3). The
 * ledger is structured memory of who matters, what's unresolved and what the
 * player has done — how a human DM avoids repetition without churning out a
 * new NPC every scene. Shared so the client Journal reads the same shapes.
 */
export type CastStatus = "alive" | "dead" | "missing";
export type ThreadStatus = "open" | "resolved" | "abandoned";
export type DeedTag =
  | "mercy" | "cruelty" | "cunning" | "bravery" | "greed" | "loyalty"
  | "betrayal" | "generosity" | "honesty" | "deceit" | "piety" | "curiosity";

export const DEED_TAGS: DeedTag[] = [
  "mercy", "cruelty", "cunning", "bravery", "greed", "loyalty",
  "betrayal", "generosity", "honesty", "deceit", "piety", "curiosity",
];

export interface CastMember {
  id: string;
  name: string;
  role: string;
  want: string;
  /** -3 (hostile) .. +3 (devoted). */
  attitude: number;
  firstSeenTurn: number;
  lastSeenTurn: number;
  location: string | null;
  status: CastStatus;
  secrets: string[];
  promisesMade: string[];
  timesMet: number;
}

export interface Thread {
  id: string;
  summary: string;
  openedTurn: number;
  status: ThreadStatus;
  /** 0..3: how pressing it is. */
  heat: number;
}

export interface Deed {
  turn: number;
  summary: string;
  tag: DeedTag;
  location: string | null;
}

export interface Place {
  name: string;
  lastVisitedTurn: number;
  changedSince: string | null;
}

export interface ItemOfNote {
  name: string;
  note: string;
}

export interface Ledger {
  turn: number;
  cast: CastMember[];
  threads: Thread[];
  deeds: Deed[];
  places: Place[];
  itemsOfNote: ItemOfNote[];
}

export const EMPTY_LEDGER: Ledger = { turn: 0, cast: [], threads: [], deeds: [], places: [], itemsOfNote: [] };

/** 5e attitudes (hostile / indifferent / friendly) with a little nuance either side. */
export function attitudeLabel(attitude: number): string {
  if (attitude <= -3) return "Hostile";
  if (attitude === -2) return "Unfriendly";
  if (attitude === -1) return "Wary";
  if (attitude === 0) return "Indifferent";
  if (attitude === 1) return "Friendly";
  if (attitude === 2) return "Trusting";
  return "Devoted";
}

const REPUTATION_WORD: Record<DeedTag, string> = {
  mercy: "merciful", cruelty: "cruel", cunning: "cunning", bravery: "brave", greed: "greedy", loyalty: "loyal",
  betrayal: "treacherous", generosity: "generous", honesty: "honest", deceit: "a liar", piety: "devout", curiosity: "curious",
};

/** "known as merciful" from the player's recent deeds (needs a tag seen at least twice). */
export function reputationOf(deeds: Deed[]): { word: string; tag: DeedTag; count: number } | null {
  const recent = deeds.slice(-10);
  const counts = new Map<DeedTag, number>();
  for (const d of recent) counts.set(d.tag, (counts.get(d.tag) ?? 0) + 1);
  let best: { tag: DeedTag; count: number } | null = null;
  for (const [tag, count] of Array.from(counts.entries())) if (count >= 2 && (!best || count > best.count)) best = { tag, count };
  return best ? { word: REPUTATION_WORD[best.tag], tag: best.tag, count: best.count } : null;
}

export function parseLedger(raw: unknown): Ledger {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Ledger>;
  return {
    turn: typeof r.turn === "number" ? r.turn : 0,
    cast: Array.isArray(r.cast) ? r.cast : [],
    threads: Array.isArray(r.threads) ? r.threads : [],
    deeds: Array.isArray(r.deeds) ? r.deeds : [],
    places: Array.isArray(r.places) ? r.places : [],
    itemsOfNote: Array.isArray(r.itemsOfNote) ? r.itemsOfNote : [],
  };
}
