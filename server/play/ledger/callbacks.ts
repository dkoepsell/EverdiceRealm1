/**
 * Reading the ledger (engagement spec 3.3 and 5.2): the 0–2 callbacks the DM
 * should weave into this scene, the prompt block that carries them, and the
 * templated "Previously on…" recap (no AI call).
 */
import { attitudeLabel, type Ledger, reputationOf } from "@shared/ledger";
import { overlaps } from "./merge";

export interface Callback {
  kind: "absent_npc" | "hot_thread" | "known_deed" | "changed_place";
  text: string;
  npc?: string;
}

/**
 * Up to two callbacks, in priority order:
 * 1. a changed place the party is revisiting,
 * 2. an NPC not seen for 5+ turns whose want/location touches here or an open thread,
 * 3. an open thread with heat ≥ 2,
 * 4. a past deed people here would plausibly have heard of (every few turns, not every turn).
 */
export function selectCallbacks(ledger: Ledger, ctx: { location?: string | null; max?: number }): Callback[] {
  const out: Callback[] = [];
  const max = ctx.max ?? 2;
  const turn = ledger.turn + 1;
  const here = (ctx.location ?? "").toLowerCase();
  const openThreads = ledger.threads.filter((t) => t.status === "open");

  const place = ledger.places.find((p) => p.changedSince && here && p.name.toLowerCase() === here);
  if (place) out.push({ kind: "changed_place", text: `${place.name} has changed since the party was last here: ${place.changedSince}` });

  const absent = ledger.cast
    .filter((c) => c.status === "alive" && c.timesMet > 0 && turn - c.lastSeenTurn >= 5)
    .filter((c) => (here && (c.location ?? "").toLowerCase() === here) || openThreads.some((t) => overlaps(t.summary, `${c.want} ${c.role} ${c.name}`)) || (here && overlaps(here, c.want)))
    .sort((a, b) => b.timesMet - a.timesMet || Math.abs(b.attitude) - Math.abs(a.attitude))[0];
  if (absent && out.length < max) {
    const owes = absent.promisesMade[0] ? `; ${absent.promisesMade[0]}` : "";
    out.push({
      kind: "absent_npc",
      npc: absent.name,
      text: `${absent.name}${absent.role ? ` (${absent.role})` : ""}, ${attitudeLabel(absent.attitude).toLowerCase()} toward the party${absent.want ? `, wants ${absent.want}` : ""}${owes}, could plausibly turn up here.`,
    });
  }

  const hot = [...openThreads].filter((t) => t.heat >= 2).sort((a, b) => b.heat - a.heat)[0];
  if (hot && out.length < max) out.push({ kind: "hot_thread", text: `Unresolved and pressing: ${hot.summary}` });

  const deed = [...ledger.deeds].reverse().find((d) => turn - d.turn >= 3);
  if (deed && out.length < max && turn % 3 === 0) {
    out.push({ kind: "known_deed", text: `Word has spread of the party's choice to ${deed.summary.replace(/^you\s+/i, "").replace(/\.$/, "")} (turn ${deed.turn}); someone here may know of it.` });
  }
  return out.slice(0, max);
}

/** Prompt block: callbacks + the cast/threads the DM must keep consistent + the ledgerUpdates contract. */
export function ledgerPromptBlock(ledger: Ledger, callbacks: Callback[]): string {
  const known = ledger.cast
    .filter((c) => c.status !== "dead" && c.timesMet > 0)
    .sort((a, b) => b.lastSeenTurn - a.lastSeenTurn)
    .slice(0, 8)
    .map((c) => `${c.name}${c.role ? `, ${c.role}` : ""} (${attitudeLabel(c.attitude).toLowerCase()})`);
  const open = ledger.threads.filter((t) => t.status === "open").slice(-5).map((t) => t.summary);
  const rep = reputationOf(ledger.deeds);
  const lines = [
    callbacks.length ? `CALLBACKS (use at least one naturally): ${callbacks.map((c) => c.text).join(" ")}` : "",
    known.length ? `PEOPLE THE PARTY KNOWS (reuse them; keep their names exact): ${known.join("; ")}` : "",
    open.length ? `OPEN THREADS: ${open.join(" | ")}` : "",
    rep ? `REPUTATION: the party is known as ${rep.word}. NPCs react to it.` : "",
    `LEDGER: return "ledgerUpdates" with what changed this scene: {"cast": [{"name", "role"?, "want"?, "attitudeChange" (-2..2)?, "status" ("alive"|"dead"|"missing")?, "secret"?, "promise"? (what the NPC now owes or was promised)}] for every named NPC who appears, "threadsOpened": [summary], "threadsResolved": [summary], "threadHeat": [{"summary", "heat" 0..3}], "deed": {"summary" (second person, past tense), "tag": "mercy|cruelty|cunning|bravery|greed|loyalty|betrayal|generosity|honesty|deceit|piety|curiosity"} only for a notable act, "placeChanged": {"name", "change"}, "itemOfNote": {"name", "note"}}. Express NPC goodwill or cost through attitudeChange.`,
  ];
  return lines.filter(Boolean).join("\n");
}

/** "Previously on…" — three lines templated from the ledger. */
export function buildRecap(ledger: Ledger): string[] {
  const lines: string[] = [];
  const deed = ledger.deeds[ledger.deeds.length - 1];
  if (deed) lines.push(capitalize(deed.summary.endsWith(".") ? deed.summary : `${deed.summary}.`));
  const ally = [...ledger.cast]
    .filter((c) => c.status === "alive" && (c.promisesMade.length || c.attitude >= 2))
    .sort((a, b) => b.lastSeenTurn - a.lastSeenTurn)[0];
  if (ally) {
    lines.push(ally.promisesMade.length ? `${ally.name}: ${ally.promisesMade[ally.promisesMade.length - 1]}.`.replace(/\.\.$/, ".") : `${ally.name} is ${attitudeLabel(ally.attitude).toLowerCase()} toward you.`);
  }
  const thread = ledger.threads.filter((t) => t.status === "open").sort((a, b) => b.heat - a.heat || b.openedTurn - a.openedTurn)[0];
  if (thread) lines.push(capitalize(thread.summary.endsWith("?") || thread.summary.endsWith(".") ? thread.summary : `${thread.summary}.`));
  return lines.slice(0, 3);
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The narrative-only version for the streamed prose: callbacks and who's known, no JSON contract. */
export function ledgerStreamLine(ledger: Ledger, callbacks: Callback[]): string {
  const known = ledger.cast
    .filter((c) => c.status !== "dead" && c.timesMet > 0)
    .sort((a, b) => b.lastSeenTurn - a.lastSeenTurn)
    .slice(0, 6)
    .map((c) => `${c.name} (${attitudeLabel(c.attitude).toLowerCase()})`);
  return [
    callbacks.length ? `CALLBACKS (weave at least one in naturally): ${callbacks.map((c) => c.text).join(" ")}` : "",
    known.length ? `People the party already knows (prefer them to new faces; at most one new named NPC every 3 scenes): ${known.join(", ")}` : "",
  ].filter(Boolean).join("\n");
}
