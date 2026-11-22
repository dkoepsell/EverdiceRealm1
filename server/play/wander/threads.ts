/**
 * Wander threads: pure logic (wander-threads-spec.md, Feature A, and the
 * rumor half of Feature D). No database here; server/play/wander/store.ts
 * persists rows, and wanderRoutes.ts wires it together.
 */
import { biomeForHex, bearing, hexDistance, hexesWithin, getTerrainForHex } from "@shared/wander/terrain";
import type { WanderBiome } from "@shared/wander/terrain";
import { THREAD_TEMPLATES, getTemplate, type ThreadTemplate, type BeatText } from "./threadTemplates";

export type ThreadStatus = "rumored" | "active" | "resolved" | "abandoned" | "expired" | "debunked";
export type BeatKind = "sign" | "trace" | "approach" | "climax" | "reminder" | "debunk";

/** Beat index stored on the row: 0 sign, 1 trace, 2 approach, 3 climax reached. */
export const BEATS: BeatKind[] = ["sign", "trace", "approach", "climax"];

export interface ThreadPayload {
  name?: string;
  movesSinceAdvance?: number;
  movesAway?: number;
  reminded?: boolean;
  /** For rumored threads: whether the rumor is true. */
  truth?: boolean;
  rumorText?: string;
  rumorSource?: string;
  /** Climax attempts that failed, for the journal. */
  failedAttempts?: number;
}

export interface ThreadRow {
  id: number;
  campaignId: number;
  userId: number;
  templateId: string;
  beat: number;
  targetHexQ: number;
  targetHexR: number;
  status: ThreadStatus;
  payload: ThreadPayload | null;
}

export const MAX_OPEN_THREADS = 2;
export const MAX_RUMORS = 3;
export const THREAD_EXPIRY_MOVES = 30;
export const START_CHANCE_ON_DISCOVERY = 0.35;

export interface ThreadChoice {
  id: string;
  label: string;
  intentTag: "investigate" | "avoid" | "engage" | "retreat";
  check?: { skill: string; dc: number };
}

/** What a thread contributes to a move: an outcome card, shaped like CuratedOutcome. */
export interface ThreadOutcome {
  type: "discovery" | "quiet" | "risk";
  title: string;
  reveal: string;
  detail?: string;
  choices: ThreadChoice[];
  markerType?: string;
  thread: { id: number; templateId: string; beat: BeatKind; name?: string };
  contentId?: string;
}

// ── text helpers ──────────────────────────────────────────────────────────────

export function fill(text: string, vars: { bearing?: string; dist?: number; name?: string }): string {
  return text
    .replace(/\{bearing\}/g, vars.bearing ?? "somewhere")
    .replace(/\{dist\}/g, String(vars.dist ?? "a few"))
    .replace(/\{plural\}/g, vars.dist === 1 ? "" : "es")
    .replace(/\{name\}/g, vars.name ?? "nameless");
}

export function threadName(t: ThreadTemplate, row: ThreadRow): string | undefined {
  return row.payload?.name ?? undefined;
}

// ── starting threads ──────────────────────────────────────────────────────────

/** Pick a target 3 to 6 hexes away on a biome the template allows. Never town, never the current hex. */
export function pickTarget(
  t: ThreadTemplate,
  fromQ: number,
  fromR: number,
  rng: () => number,
  range: [number, number] = [3, 6],
): { q: number; r: number } {
  const candidates = hexesWithin(fromQ, fromR, range[1]).filter((h) => {
    const d = hexDistance(fromQ, fromR, h.q, h.r);
    return d >= range[0] && !(h.q === 0 && h.r === 0) && t.biomes.includes(biomeForHex(h.q, h.r)) && getTerrainForHex(h.q, h.r) !== "ocean";
  });
  if (candidates.length) return candidates[Math.floor(rng() * candidates.length)];
  // Fallback: any non-ocean hex at the far edge of the range.
  const ring = hexesWithin(fromQ, fromR, range[1]).filter((h) => hexDistance(fromQ, fromR, h.q, h.r) === range[1] && getTerrainForHex(h.q, h.r) !== "ocean");
  return ring.length ? ring[Math.floor(rng() * ring.length)] : { q: fromQ + range[0], r: fromR };
}

/** Templates that can start in this biome and aren't already open for this player. */
export function startableTemplates(biome: WanderBiome, open: ThreadRow[]): ThreadTemplate[] {
  const openIds = new Set(open.map((r) => r.templateId));
  return THREAD_TEMPLATES.filter((t) => t.biomes.includes(biome) && !openIds.has(t.id));
}

export function rollName(t: ThreadTemplate, rng: () => number): string | undefined {
  return t.names?.length ? t.names[Math.floor(rng() * t.names.length)] : undefined;
}

// ── outcomes ──────────────────────────────────────────────────────────────────

function beatOutcome(t: ThreadTemplate, row: ThreadRow, kind: "sign" | "trace" | "approach", atQ: number, atR: number): ThreadOutcome {
  const text: BeatText = t[kind];
  const vars = { bearing: bearing(atQ, atR, row.targetHexQ, row.targetHexR), dist: hexDistance(atQ, atR, row.targetHexQ, row.targetHexR), name: row.payload?.name };
  return {
    type: "discovery",
    title: fill(text.title, vars),
    reveal: fill(text.reveal, vars),
    detail: fill(text.detail, vars),
    markerType: t.markerType,
    thread: { id: row.id, templateId: t.id, beat: kind, name: row.payload?.name },
    contentId: `thread:${t.id}:${kind}`,
    choices: [
      { id: "study", label: kind === "approach" ? "Scout ahead carefully" : "Study the signs", intentTag: "investigate", check: { skill: t.trackSkill, dc: kind === "sign" ? 10 : kind === "trace" ? 12 : 13 } },
      { id: "note", label: `Note the bearing (${vars.bearing}) and move on`, intentTag: "avoid" },
    ],
  };
}

export function climaxOutcome(t: ThreadTemplate, row: ThreadRow): ThreadOutcome {
  const name = row.payload?.name;
  return {
    type: "risk",
    title: fill(t.climax.title, { name }),
    reveal: fill(t.climax.reveal, { name }),
    markerType: t.markerType,
    thread: { id: row.id, templateId: t.id, beat: "climax", name },
    contentId: `thread:${t.id}:climax`,
    choices: [
      ...t.climax.options.map((o): ThreadChoice => ({
        id: o.id,
        label: o.fight ? `${o.label} (costs a level of exhaustion)` : o.label,
        intentTag: o.fight ? "engage" : "investigate",
        check: o.skill && o.dc ? { skill: o.skill, dc: o.dc } : undefined,
      })),
      { id: "leave", label: "Not yet. Mark the place and come back later", intentTag: "retreat" },
    ],
  };
}

function reminderOutcome(t: ThreadTemplate, row: ThreadRow, atQ: number, atR: number): ThreadOutcome {
  const b = bearing(atQ, atR, row.targetHexQ, row.targetHexR);
  return {
    type: "quiet",
    title: "The Trail Grows Cold",
    reveal: `You have drifted away from ${t.name.toLowerCase()}. The signs pointed ${b}. Keep wandering this way and you may lose it altogether.`,
    thread: { id: row.id, templateId: t.id, beat: "reminder", name: row.payload?.name },
    choices: [
      { id: "note", label: `Remember: ${b}`, intentTag: "avoid" },
      { id: "abandon", label: "Let this one go", intentTag: "retreat" },
    ],
  };
}

function debunkOutcome(t: ThreadTemplate, row: ThreadRow): ThreadOutcome {
  return {
    type: "quiet",
    title: t.debunk.title,
    reveal: t.debunk.reveal,
    thread: { id: row.id, templateId: t.id, beat: "debunk" },
    choices: [{ id: "ok", label: "So much for that rumor", intentTag: "avoid" }],
  };
}

export function signOutcomeFor(t: ThreadTemplate, row: ThreadRow, atQ: number, atR: number): ThreadOutcome {
  return beatOutcome(t, row, "sign", atQ, atR);
}

// ── per-move logic ────────────────────────────────────────────────────────────

export interface ThreadPatch { id: number; beat?: number; status?: ThreadStatus; payload?: ThreadPayload }

export interface MoveResult {
  outcome: ThreadOutcome | null;
  patches: ThreadPatch[];
}

/**
 * Decide whether any open thread produces this move's outcome, and how every
 * open thread's bookkeeping changes. At most one thread outcome per move.
 * Rumored threads resolve on arrival at their hex; active threads advance on
 * moves toward their target and reach their climax on arrival.
 */
export function onMove(
  threads: ThreadRow[],
  move: { fromQ: number; fromR: number; toQ: number; toR: number },
  rng: () => number = Math.random,
): MoveResult {
  const patches: ThreadPatch[] = [];
  let outcome: ThreadOutcome | null = null;

  // Most recently advanced first is not tracked; order by beat so near-climax threads win.
  const ordered = [...threads].sort((a, b) => b.beat - a.beat);

  for (const row of ordered) {
    const t = getTemplate(row.templateId);
    if (!t) continue;
    const p: ThreadPayload = { ...(row.payload ?? {}) };
    const dFrom = hexDistance(move.fromQ, move.fromR, row.targetHexQ, row.targetHexR);
    const dTo = hexDistance(move.toQ, move.toR, row.targetHexQ, row.targetHexR);
    const arrived = dTo === 0;

    if (row.status === "rumored") {
      if (arrived && !outcome) {
        if (p.truth === false) {
          outcome = debunkOutcome(t, row);
          patches.push({ id: row.id, status: "debunked", payload: p });
        } else {
          const live = { ...row, status: "active" as const, beat: 3, payload: p };
          outcome = climaxOutcome(t, live);
          patches.push({ id: row.id, status: "active", beat: 3, payload: { ...p, movesSinceAdvance: 0 } });
        }
      }
      continue;
    }
    if (row.status !== "active") continue;

    p.movesSinceAdvance = (p.movesSinceAdvance ?? 0) + 1;

    if (arrived) {
      if (!outcome) {
        outcome = climaxOutcome(t, row);
        patches.push({ id: row.id, beat: 3, payload: { ...p, movesSinceAdvance: 0, movesAway: 0 } });
      } else {
        patches.push({ id: row.id, payload: p });
      }
      continue;
    }

    if (dTo < dFrom) {
      p.movesAway = 0;
      p.reminded = false;
      const chance = 0.45 + 0.15 * row.beat;
      if (!outcome && row.beat < 2 && rng() < chance) {
        const next = row.beat + 1;
        outcome = beatOutcome(t, row, BEATS[next] as "trace" | "approach", move.toQ, move.toR);
        patches.push({ id: row.id, beat: next, payload: { ...p, movesSinceAdvance: 0 } });
        continue;
      }
    } else if (dTo > dFrom) {
      p.movesAway = (p.movesAway ?? 0) + 1;
      if (!outcome && p.movesAway >= 3 && !p.reminded) {
        outcome = reminderOutcome(t, row, move.toQ, move.toR);
        p.reminded = true;
      }
    }

    if (p.movesSinceAdvance > THREAD_EXPIRY_MOVES) {
      patches.push({ id: row.id, status: "expired", payload: p });
    } else {
      patches.push({ id: row.id, payload: p });
    }
  }

  return { outcome, patches };
}

// ── rumors ────────────────────────────────────────────────────────────────────

/** A new rumored thread, pointing from town toward a target 3 to 8 hexes out. True about 70% of the time. */
export function makeRumor(open: ThreadRow[], rng: () => number = Math.random): Omit<ThreadRow, "id" | "campaignId" | "userId"> | null {
  const openIds = new Set(open.map((r) => r.templateId));
  const pool = THREAD_TEMPLATES.filter((t) => !openIds.has(t.id));
  if (!pool.length) return null;
  const t = pool[Math.floor(rng() * pool.length)];
  const target = pickTarget(t, 0, 0, rng, [3, 8]);
  const b = bearing(0, 0, target.q, target.r);
  const name = rollName(t, rng);
  return {
    templateId: t.id,
    beat: -1,
    targetHexQ: target.q,
    targetHexR: target.r,
    status: "rumored",
    payload: {
      name,
      truth: rng() < 0.7,
      rumorSource: t.rumor.source,
      rumorText: fill(t.rumor.text, { bearing: b, name }),
      movesSinceAdvance: 0,
    },
  };
}

/** Journal view of a thread, safe to send to the client (never reveals whether a rumor is true). */
export function journalEntry(row: ThreadRow, fromQ: number, fromR: number) {
  const t = getTemplate(row.templateId);
  const name = row.payload?.name;
  return {
    id: row.id,
    templateId: row.templateId,
    title: t ? fill(t.name, { name }) : row.templateId,
    status: row.status,
    beat: row.beat >= 0 ? BEATS[Math.min(3, row.beat)] : "rumor",
    bearing: bearing(fromQ, fromR, row.targetHexQ, row.targetHexR),
    distance: hexDistance(fromQ, fromR, row.targetHexQ, row.targetHexR),
    // The exact hex is only shown once you are close (approach) or for rumors, which name a place.
    target: row.status === "rumored" || row.beat >= 2 ? { q: row.targetHexQ, r: row.targetHexR } : null,
    rumor: row.status === "rumored" ? { source: row.payload?.rumorSource, text: row.payload?.rumorText } : null,
  };
}
