/**
 * Merge a turn's `ledgerUpdates` from the model into the campaign ledger
 * (engagement spec 3.2). Everything the model sends is validated; NPCs are
 * deduped by normalized name ("Mira" and "Mira the ferrywoman" are one
 * person); lists are capped (cast 30, threads 12, deeds 40) by dropping the
 * least salient entries.
 */
import {
  type CastMember, type DeedTag, DEED_TAGS, type Ledger, type Thread, parseLedger,
} from "@shared/ledger";

export const CAPS = { cast: 30, threads: 12, deeds: 40, places: 30, items: 15 } as const;

const TITLE_WORDS = new Set(["the", "a", "an", "old", "young", "captain", "brother", "sister", "lady", "lord", "sir", "dame", "master", "mistress", "mother", "father", "elder", "mayor", "king", "queen", "prince", "princess", "doctor", "dr"]);

/** "Captain Korrin the Grey" → ["korrin", "grey"]; "Mira, ferrywoman" → ["mira", "ferrywoman"]. */
export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !TITLE_WORDS.has(t));
}

/** Same person? Exact token match, or the same first name where one side is just the first name. */
export function sameName(a: string, b: string): boolean {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return false;
  if (ta.join(" ") === tb.join(" ")) return true;
  return ta[0] === tb[0] && (ta.length === 1 || tb.length === 1);
}

const clampInt = (v: unknown, lo: number, hi: number, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
};
const str = (v: unknown, max = 160) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const slug = (s: string) => nameTokens(s).join("_").slice(0, 40) || `x${Math.random().toString(36).slice(2, 8)}`;

function wordsOf(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
}
export function overlaps(a: string, b: string): boolean {
  const wb = wordsOf(b);
  return Array.from(wordsOf(a)).some((w) => wb.has(w));
}

export interface MergeResult {
  ledger: Ledger;
  /** Cast members who came back this turn after being away (for the "Returning:" chip). */
  returning: string[];
  /** New named NPCs introduced this turn. */
  introduced: string[];
}

export function mergeLedgerUpdates(raw: unknown, updates: any, ctx: { location?: string | null }): MergeResult {
  const ledger = parseLedger(raw);
  const turn = ledger.turn + 1;
  const location = ctx.location ? str(ctx.location, 80) : null;
  const cast = ledger.cast.map((c) => ({ ...c }));
  const threads = ledger.threads.map((t) => ({ ...t }));
  const deeds = [...ledger.deeds];
  const places = ledger.places.map((p) => ({ ...p }));
  const items = [...ledger.itemsOfNote];
  const returning: string[] = [];
  const introduced: string[] = [];
  const u = updates && typeof updates === "object" ? updates : {};

  for (const raw of Array.isArray(u.cast) ? u.cast.slice(0, 8) : []) {
    const name = str(raw?.name, 60);
    if (!name) continue;
    let member = cast.find((c) => sameName(c.name, name));
    if (member) {
      if (member.lastSeenTurn < turn - 1 && member.status === "alive") returning.push(member.name);
      if (member.lastSeenTurn !== turn) member.timesMet += 1;
      member.lastSeenTurn = turn;
      // Keep the fuller name ("Mira" → "Mira, ferrywoman" if the model got more specific).
      if (nameTokens(name).length > nameTokens(member.name).length) member.name = name;
    } else {
      member = {
        id: slug(name), name, role: "", want: "", attitude: 0, firstSeenTurn: turn, lastSeenTurn: turn,
        location: null, status: "alive", secrets: [], promisesMade: [], timesMet: 1,
      };
      cast.push(member);
      introduced.push(name);
    }
    if (str(raw?.role)) member.role = str(raw.role, 80);
    if (str(raw?.want)) member.want = str(raw.want);
    if (raw?.attitudeChange != null) member.attitude = clampInt(member.attitude + clampInt(raw.attitudeChange, -2, 2, 0), -3, 3, member.attitude);
    if (raw?.attitude != null && raw?.attitudeChange == null) member.attitude = clampInt(raw.attitude, -3, 3, member.attitude);
    if (["alive", "dead", "missing"].includes(raw?.status)) member.status = raw.status;
    member.location = str(raw?.location, 80) || location || member.location;
    const secret = str(raw?.secret);
    if (secret && !member.secrets.includes(secret)) member.secrets = [...member.secrets, secret].slice(-5);
    const promise = str(raw?.promise);
    if (promise && !member.promisesMade.includes(promise)) member.promisesMade = [...member.promisesMade, promise].slice(-5);
  }

  for (const summary of Array.isArray(u.threadsOpened) ? u.threadsOpened.slice(0, 3) : []) {
    const s = str(summary, 140);
    if (!s || threads.some((t) => t.status === "open" && (t.summary.toLowerCase() === s.toLowerCase()))) continue;
    threads.push({ id: `t${turn}_${threads.length}`, summary: s, openedTurn: turn, status: "open", heat: 1 });
  }
  const findThread = (ref: unknown): Thread | undefined => {
    const r = str(ref, 140).toLowerCase();
    if (!r) return undefined;
    return threads.find((t) => t.id === r) ?? threads.find((t) => t.summary.toLowerCase() === r) ?? threads.find((t) => t.status === "open" && overlaps(t.summary, r));
  };
  for (const ref of Array.isArray(u.threadsResolved) ? u.threadsResolved : []) {
    const t = findThread(typeof ref === "object" ? ref?.id ?? ref?.summary : ref);
    if (t) t.status = "resolved";
  }
  for (const h of Array.isArray(u.threadHeat) ? u.threadHeat : []) {
    const t = findThread(h?.id ?? h?.summary);
    if (t) t.heat = clampInt(h?.heat, 0, 3, t.heat);
  }

  if (u.deed && str(u.deed.summary)) {
    const tag = (DEED_TAGS as string[]).includes(u.deed.tag) ? (u.deed.tag as DeedTag) : null;
    if (tag) deeds.push({ turn, summary: str(u.deed.summary), tag, location });
  }

  if (location) {
    const p = places.find((pl) => pl.name.toLowerCase() === location.toLowerCase());
    if (p) {
      p.lastVisitedTurn = turn;
      p.changedSince = null; // seen it now
    } else {
      places.push({ name: location, lastVisitedTurn: turn, changedSince: null });
    }
  }
  if (u.placeChanged && str(u.placeChanged.name)) {
    const name = str(u.placeChanged.name, 80);
    const p = places.find((pl) => pl.name.toLowerCase() === name.toLowerCase());
    if (p && p.name.toLowerCase() !== location?.toLowerCase()) p.changedSince = str(u.placeChanged.change) || p.changedSince;
  }
  if (u.itemOfNote && str(u.itemOfNote.name)) {
    const name = str(u.itemOfNote.name, 60);
    if (!items.some((i) => i.name.toLowerCase() === name.toLowerCase())) items.push({ name, note: str(u.itemOfNote.note) });
  }

  return {
    ledger: {
      turn,
      cast: capCast(cast, turn),
      threads: capThreads(threads),
      deeds: deeds.slice(-CAPS.deeds),
      places: places.sort((a, b) => b.lastVisitedTurn - a.lastVisitedTurn).slice(0, CAPS.places),
      itemsOfNote: items.slice(-CAPS.items),
    },
    returning,
    introduced,
  };
}

function castSalience(c: CastMember, turn: number): number {
  return c.timesMet * 2 + Math.abs(c.attitude) + c.promisesMade.length * 2 + (c.status === "alive" ? 2 : 0) - (turn - c.lastSeenTurn) * 0.1;
}

function capCast(cast: CastMember[], turn: number): CastMember[] {
  if (cast.length <= CAPS.cast) return cast;
  const keep = new Set([...cast].sort((a, b) => castSalience(b, turn) - castSalience(a, turn)).slice(0, CAPS.cast).map((c) => c.id + c.name));
  return cast.filter((c) => keep.has(c.id + c.name));
}

function capThreads(threads: Thread[]): Thread[] {
  if (threads.length <= CAPS.threads) return threads;
  // Drop closed threads first (oldest first), then the coolest open ones.
  const rank = (t: Thread) => (t.status === "open" ? 10 + t.heat : 0) + t.openedTurn / 1000;
  const keep = new Set([...threads].sort((a, b) => rank(b) - rank(a)).slice(0, CAPS.threads).map((t) => t.id));
  return threads.filter((t) => keep.has(t.id));
}

/** Seed a new ledger from the campaign's generated decision-makers (npcAttitudes, -100..100). */
export function seedLedgerFromCampaign(npcAttitudes: unknown): Ledger {
  const cast: CastMember[] = [];
  for (const n of Array.isArray(npcAttitudes) ? npcAttitudes.slice(0, 8) : []) {
    const name = str(n?.name, 60);
    if (!name) continue;
    cast.push({
      id: slug(name), name, role: str(n?.role, 80), want: str(n?.wants), attitude: clampInt(Number(n?.attitude) / 34, -3, 3, 0),
      firstSeenTurn: 0, lastSeenTurn: 0, location: null, status: "alive",
      secrets: Array.isArray(n?.secrets) ? n.secrets.map((x: unknown) => str(x)).filter(Boolean).slice(0, 3) : [],
      promisesMade: [], timesMet: 0,
    });
  }
  return { turn: 0, cast, threads: [], deeds: [], places: [], itemsOfNote: [] };
}
