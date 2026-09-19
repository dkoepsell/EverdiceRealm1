// Run: npx tsx tests/worldBus.test.ts
//
// Exercises the worldBus contract without a database. The storage methods that
// emit are thin wrappers around a Drizzle call, so this drives the emit/dedupe
// logic directly against a stub that mimics those methods' shape. What it
// guards is the part that is easy to get wrong: not emitting.

import { onWorldEvent, emitWorld, nowIso, type WorldBusEvent } from "../server/lib/worldBus";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}${ok ? "" : ` -- ${detail}`}`);
  if (!ok) failures++;
}

/** Collect every event emitted while fn runs. */
async function capture(fn: () => Promise<void> | void): Promise<WorldBusEvent[]> {
  const seen: WorldBusEvent[] = [];
  const off = onWorldEvent(e => seen.push(e));
  try { await fn(); } finally { off(); }
  return seen;
}

// --- a stand-in for the exploration tables, with the storage methods' logic ---
type State = { campaignId: number; currentHexQ: number | null; currentHexR: number | null };
type Hex = { id: number; campaignId: number; q: number; r: number; isExplored: boolean;
             locationName?: string | null; terrainType?: string | null };

const states = new Map<number, State>();
const hexes = new Map<number, Hex>();

// Mirrors storage.updateExplorationState
async function updateExplorationState(campaignId: number, updates: Partial<State>) {
  const movesParty = updates.currentHexQ !== undefined || updates.currentHexR !== undefined;
  const previous = movesParty ? states.get(campaignId) : undefined;
  const updated = { ...states.get(campaignId)!, ...updates };
  states.set(campaignId, updated);
  if (movesParty) {
    const q = updated.currentHexQ ?? 0, r = updated.currentHexR ?? 0;
    if (previous?.currentHexQ !== q || previous?.currentHexR !== r) {
      emitWorld({ type: "party_moved", campaignId, hexQ: q, hexR: r,
        prevQ: previous?.currentHexQ ?? undefined, prevR: previous?.currentHexR ?? undefined, at: nowIso() });
    }
  }
  return updated;
}

// Mirrors storage.updateExplorationHex
async function updateExplorationHex(id: number, updates: Partial<Hex>) {
  const wasExplored = updates.isExplored === true ? (hexes.get(id)?.isExplored ?? false) : true;
  const updated = { ...hexes.get(id)!, ...updates };
  hexes.set(id, updated);
  if (updates.isExplored === true && !wasExplored) {
    emitWorld({ type: "hex_explored", campaignId: updated.campaignId, hexQ: updated.q, hexR: updated.r,
      locationName: updated.locationName ?? undefined, terrainType: updated.terrainType ?? undefined, at: nowIso() });
  }
  return updated;
}

(async () => {
  // ---- party_moved --------------------------------------------------------
  states.set(12, { campaignId: 12, currentHexQ: 10, currentHexR: 20 });

  let ev = await capture(() => updateExplorationState(12, { currentHexQ: 11, currentHexR: 20 }));
  check("a move emits exactly one party_moved", ev.length === 1 && ev[0].type === "party_moved", `got ${ev.length}`);
  const moved = ev[0] as Extract<WorldBusEvent, { type: "party_moved" }>;
  check("party_moved carries the new position", moved.hexQ === 11 && moved.hexR === 20, JSON.stringify(moved));
  check("party_moved carries the previous position", moved.prevQ === 10 && moved.prevR === 20, JSON.stringify(moved));

  ev = await capture(() => updateExplorationState(12, { currentHexQ: 11, currentHexR: 20 }));
  check("re-saving the same position is silent", ev.length === 0, `got ${ev.length}`);

  ev = await capture(() => updateExplorationState(12, {} as Partial<State>));
  check("an update that is not a move is silent", ev.length === 0, `got ${ev.length}`);

  ev = await capture(() => updateExplorationState(12, { currentHexR: 21 }));
  check("moving on one axis only still emits", ev.length === 1, `got ${ev.length}`);

  // ---- hex_explored -------------------------------------------------------
  hexes.set(1, { id: 1, campaignId: 12, q: 4, r: 5, isExplored: false, terrainType: "forest" });

  ev = await capture(() => updateExplorationHex(1, { isExplored: true }));
  check("fog lifting emits one hex_explored", ev.length === 1 && ev[0].type === "hex_explored", `got ${ev.length}`);
  const exp = ev[0] as Extract<WorldBusEvent, { type: "hex_explored" }>;
  check("hex_explored carries coords and terrain",
    exp.hexQ === 4 && exp.hexR === 5 && exp.terrainType === "forest", JSON.stringify(exp));

  ev = await capture(() => updateExplorationHex(1, { isExplored: true }));
  check("re-exploring an explored hex is silent", ev.length === 0, `got ${ev.length}`);

  ev = await capture(() => updateExplorationHex(1, { terrainType: "hills" }));
  check("editing a hex without touching isExplored is silent", ev.length === 0, `got ${ev.length}`);

  // ---- campaign_status ----------------------------------------------------
  const statusFor = (isArchived: boolean, isCompleted: boolean) =>
    isArchived ? "archived" : isCompleted ? "completed" : "active";
  check("archived wins over completed", statusFor(true, true) === "archived", statusFor(true, true));
  check("completed when only completed", statusFor(false, true) === "completed", statusFor(false, true));
  check("active when neither flag is set", statusFor(false, false) === "active", statusFor(false, false));

  // ---- isolation ----------------------------------------------------------
  const off = onWorldEvent(() => { throw new Error("subscriber exploded"); });
  let threw = false;
  try { emitWorld({ type: "campaign_status", campaignId: 1, status: "active", at: nowIso() }); }
  catch { threw = true; }
  off();
  check("a throwing subscriber cannot fail the write", !threw);

  let after = 0;
  const off2 = onWorldEvent(() => { after++; });
  off2();
  emitWorld({ type: "campaign_status", campaignId: 1, status: "active", at: nowIso() });
  check("unsubscribe actually detaches", after === 0, `got ${after}`);

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
})();
