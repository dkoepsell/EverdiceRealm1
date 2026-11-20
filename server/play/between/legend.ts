/**
 * A character's life between campaigns (engagement spec Phase 6), kept in
 * characters.downtime_state under `legend` and `hooks` (no migration):
 * - legend: the reputation earned last campaign and one NPC chosen to recur;
 * - hooks: rumors, contacts and training from downtime between adventures.
 * Both are seeded into the next campaign's ledger on its first turn, so the
 * callback selector brings them back.
 */
import type { DeedTag, Ledger } from "@shared/ledger";
import { DEED_TAGS } from "@shared/ledger";

export interface LegendNpc { name: string; role: string; want: string; attitude: number }
export interface Legend { reputation: DeedTag | null; recurringNpc: LegendNpc | null; fromCampaign: string | null }
export interface DowntimeHook { kind: "rumor" | "contact" | "training"; text: string; npc?: LegendNpc; createdAt: string; used?: boolean }

export function readLegend(downtimeState: unknown): { legend: Legend | null; hooks: DowntimeHook[] } {
  const d = (downtimeState && typeof downtimeState === "object" ? downtimeState : {}) as any;
  const legend = d.legend && typeof d.legend === "object" ? (d.legend as Legend) : null;
  const hooks = Array.isArray(d.hooks) ? (d.hooks as DowntimeHook[]).filter((h) => h && typeof h.text === "string") : [];
  return { legend, hooks };
}

/** Seed a brand-new campaign ledger with what the seated characters bring with them. */
export function seedFromLegends(ledger: Ledger, entries: { legend: Legend | null; hooks: DowntimeHook[] }[]): { ledger: Ledger; usedHooks: number } {
  if (ledger.turn !== 0) return { ledger, usedHooks: 0 };
  const cast = [...ledger.cast];
  const deeds = [...ledger.deeds];
  const threads = [...ledger.threads];
  let used = 0;
  const addNpc = (n: LegendNpc, timesMet: number) => {
    if (cast.some((c) => c.name.toLowerCase() === n.name.toLowerCase())) return;
    cast.push({
      id: n.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"), name: n.name, role: n.role, want: n.want,
      attitude: Math.max(-3, Math.min(3, n.attitude)), firstSeenTurn: -1, lastSeenTurn: -5, location: null,
      status: "alive", secrets: [], promisesMade: [], timesMet,
    });
  };
  for (const e of entries) {
    if (e.legend?.recurringNpc) addNpc(e.legend.recurringNpc, 2);
    if (e.legend?.reputation && (DEED_TAGS as string[]).includes(e.legend.reputation)) {
      const from = e.legend.fromCampaign ? ` in ${e.legend.fromCampaign}` : "";
      deeds.push({ turn: 0, summary: `You were known as ${e.legend.reputation}-minded${from}`, tag: e.legend.reputation, location: null });
      deeds.push({ turn: 0, summary: `Stories of your ${e.legend.reputation} travelled ahead of you`, tag: e.legend.reputation, location: null });
    }
    for (const h of e.hooks.filter((x) => !x.used).slice(-3)) {
      used++;
      if (h.kind === "rumor") threads.push({ id: `hook_${threads.length}`, summary: h.text, openedTurn: 0, status: "open", heat: 2 });
      if (h.kind === "contact" && h.npc) addNpc(h.npc, 1);
    }
  }
  return { ledger: { ...ledger, cast, deeds, threads }, usedHooks: used };
}
