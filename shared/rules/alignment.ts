/**
 * Alignment as a compass, not a cage (5e: alignment is a shorthand for
 * personality; the 2024 rules make it optional and say it never restricts
 * choices). Two things here:
 *
 *  - the narrator is told the character's alignment so NPCs and factions who
 *    care can react, and is told never to refuse an action because of it;
 *  - the Journal shows what the player's recent deeds say (the ledger's deed
 *    tags mapped onto the law/chaos and good/evil axes), and offers to update
 *    the alignment when the two drift apart. The player always decides.
 */
import type { DeedTag } from "../ledger";

export type Axis = -1 | 0 | 1;
export interface AlignmentAxes { law: Axis; good: Axis }

export const ALIGNMENTS = [
  "Lawful Good", "Neutral Good", "Chaotic Good",
  "Lawful Neutral", "Neutral", "Chaotic Neutral",
  "Lawful Evil", "Neutral Evil", "Chaotic Evil",
] as const;
export type Alignment = (typeof ALIGNMENTS)[number];

/** Read "Chaotic Good", "CG", "true neutral", "neutral good" into axes. */
export function parseAlignment(raw: unknown): AlignmentAxes | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const t = raw.trim().toLowerCase();
  const abbr = t.match(/^([lnc])([gne])$/);
  if (abbr) {
    return { law: abbr[1] === "l" ? 1 : abbr[1] === "c" ? -1 : 0, good: abbr[2] === "g" ? 1 : abbr[2] === "e" ? -1 : 0 };
  }
  const law: Axis = /\blawful\b/.test(t) ? 1 : /\bchaotic\b/.test(t) ? -1 : 0;
  const good: Axis = /\bgood\b/.test(t) ? 1 : /\bevil\b/.test(t) ? -1 : 0;
  if (!law && !good && !/\bneutral\b/.test(t)) return null;
  return { law, good };
}

export function alignmentLabel(a: AlignmentAxes): Alignment {
  const l = a.law === 1 ? "Lawful" : a.law === -1 ? "Chaotic" : "Neutral";
  const g = a.good === 1 ? "Good" : a.good === -1 ? "Evil" : "Neutral";
  if (l === "Neutral" && g === "Neutral") return "Neutral";
  return `${l} ${g}` as Alignment;
}

/**
 * Where each kind of deed leans. Half-weights where a deed only leans:
 * honesty and loyalty are lawful, mercy and generosity good, deceit chaotic,
 * cruelty evil, betrayal both chaotic and evil, greed a little evil.
 */
export const DEED_AXES: Record<DeedTag, { law: number; good: number }> = {
  mercy: { law: 0, good: 1 },
  generosity: { law: 0, good: 1 },
  cruelty: { law: 0, good: -1 },
  greed: { law: 0, good: -0.5 },
  honesty: { law: 1, good: 0.5 },
  loyalty: { law: 1, good: 0 },
  piety: { law: 0.5, good: 0 },
  deceit: { law: -1, good: 0 },
  cunning: { law: -0.5, good: 0 },
  betrayal: { law: -1, good: -1 },
  bravery: { law: 0, good: 0 },
  curiosity: { law: 0, good: 0 },
};

export interface Drift {
  /** What the recent deeds say, when there are enough of them. */
  label: Alignment | null;
  axes: AlignmentAxes | null;
  law: number;
  good: number;
  considered: number;
  /** The deed kinds that pushed hardest, for the Journal's explanation. */
  because: DeedTag[];
}

const lean = (n: number): Axis => (n >= 2 ? 1 : n <= -2 ? -1 : 0);

/** The last `window` deeds, summed on both axes. Needs at least 4 deeds to say anything. */
export function driftFromDeeds(deeds: { tag: DeedTag }[], window = 10): Drift {
  const recent = deeds.slice(-window);
  let law = 0;
  let good = 0;
  const weight: Partial<Record<DeedTag, number>> = {};
  for (const d of recent) {
    const ax = DEED_AXES[d.tag];
    if (!ax) continue;
    law += ax.law;
    good += ax.good;
    weight[d.tag] = (weight[d.tag] ?? 0) + Math.abs(ax.law) + Math.abs(ax.good);
  }
  const because = (Object.entries(weight) as [DeedTag, number][]).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t]) => t);
  if (recent.length < 4) return { label: null, axes: null, law, good, considered: recent.length, because };
  const axes: AlignmentAxes = { law: lean(law), good: lean(good) };
  return { label: alignmentLabel(axes), axes, law, good, considered: recent.length, because };
}

/** True when the deeds have moved at least one step on an axis away from the chosen alignment. */
export function hasDrifted(chosen: AlignmentAxes | null, drift: Drift): boolean {
  if (!chosen || !drift.axes) return false;
  return chosen.law !== drift.axes.law || chosen.good !== drift.axes.good;
}

/** One prompt line: who the character is, and the rule that it never restricts them. */
export function alignmentPromptLine(alignment: unknown, ideal?: string | null): string {
  const axes = parseAlignment(alignment);
  if (!axes) return "";
  const label = alignmentLabel(axes);
  return `ALIGNMENT: ${label}. Use it as the character's moral compass and let people who care react to it (a temple warms to the good-hearted, a thieves' guild trusts the chaotic sooner, a knightly order notices the lawful). It is a compass, not a cage: NEVER refuse, warn against or soften a player's action because it doesn't fit their alignment.${ideal ? ` Their ideal: "${ideal}".` : ""}`;
}
