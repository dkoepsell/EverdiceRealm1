/**
 * Danger spec wiring for the two turn handlers (advance-story and
 * advance-story-stream), so routes.ts only calls in. Both handlers must tell
 * the narrator the same thing, so everything random here is seeded from the
 * turn, never Math.random:
 *
 *  - which beat this turn plays (a clock that fills into a fight becomes a
 *    planned skirmish when dangerPacing is on);
 *  - the prompt lines for a skirmish or hazard beat;
 *  - the outcome of last scene's hazard, resolved from the player's saving throw.
 */
import { PACING_PROFILES, type EngagementFlags, type Pacing } from "@shared/engagementFlags";
import { type Beat, type DirectorState } from "./beats";
import {
  type HazardOutcome, type HazardPlan, type SkirmishPlan, hazardPromptLine, planHazard, planSkirmish, resolveHazard, skirmishPromptLine,
} from "./danger";

/** A small deterministic PRNG (mulberry32) seeded from a string. */
export function seededRng(key: string): () => number {
  let h = 1779033703 ^ key.length;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PlanContext {
  campaignId: number;
  chapter: number;
  /** Scenes played in the chapter so far (makes the seed unique per scene). */
  sceneIndex: number;
  level: number;
  partySize: number;
  pacing: Pacing;
  locationText?: string | null;
  climax?: boolean;
}

/** Plan the threat for a dealt danger beat. Seeded, so replaying the same turn plans the same thing. */
export function planFor(beat: Beat, ctx: PlanContext, salt = ""): SkirmishPlan | HazardPlan | null {
  const rng = seededRng(`${ctx.campaignId}:${ctx.chapter}:${ctx.sceneIndex}:${beat}:${salt}`);
  if (beat === "skirmish") {
    return planSkirmish({ level: ctx.level, partySize: ctx.partySize, pacing: ctx.pacing, locationText: ctx.locationText, climax: ctx.climax, rng });
  }
  if (beat === "hazard") {
    return planHazard({ level: ctx.level, pacing: ctx.pacing, locationText: ctx.locationText, rng });
  }
  return null;
}

export interface DangerTurn {
  /** The beat this turn plays, after a fight-clock trigger is turned into a planned skirmish. */
  beat: Beat;
  /** The skirmish or hazard this scene stages (null for other beats). */
  plan: SkirmishPlan | HazardPlan | null;
  /** Last scene's hazard resolved by this turn's saving throw (null if not resolved). */
  hazardOutcome: HazardOutcome | null;
  /** Prompt lines for both narrators. */
  promptLine: string;
}

/**
 * Decide this turn's danger. `baseBeat` is what beatForTurn / a clock trigger
 * chose; `trigger` is the fired clock, if any.
 */
export function dangerTurn(
  flags: EngagementFlags,
  director: DirectorState,
  baseBeat: Beat,
  opts: { trigger?: { beat: string; clockName: string } | null; rollResult?: any; ctx: PlanContext; telegraphs?: unknown },
): DangerTurn {
  if (!flags.dangerPacing) return { beat: baseBeat, plan: null, hazardOutcome: null, promptLine: "" };
  let beat = baseBeat;
  let plan: SkirmishPlan | HazardPlan | null = null;
  // A threat clock that fills into a fight: stage it as a planned skirmish, so the
  // enemies come from the encounter budget instead of being invented.
  if (opts.trigger && opts.trigger.beat === "combat" && baseBeat === "combat") {
    beat = "skirmish";
    plan = planFor("skirmish", opts.ctx, opts.trigger.clockName);
  } else if (beat === "skirmish" || beat === "hazard") {
    const stored = director.plan && director.plan.kind === beat ? director.plan : null;
    plan = stored ?? planFor(beat, opts.ctx);
  }

  const lines: string[] = [];
  let hazardOutcome: HazardOutcome | null = null;
  const armed = director.armedHazard as HazardPlan | undefined;
  if (armed && opts.rollResult) {
    const rng = seededRng(`${opts.ctx.campaignId}:hazard:${armed.id}:${armed.armedAtTurn ?? 0}:${(opts.rollResult.dice ?? []).join(",")}:${opts.rollResult.total}`);
    hazardOutcome = resolveHazard(armed, opts.rollResult, rng);
    if (hazardOutcome) {
      lines.push(
        `HAZARD RESULT (decided by the game, narrate exactly this): ${hazardOutcome.text} ${hazardOutcome.damage > 0 ? `The character takes ${hazardOutcome.damage} damage.` : "The character comes through unharmed."}`,
      );
    }
  }
  if (Array.isArray(opts.telegraphs) && opts.telegraphs.length) {
    lines.push(
      `WARNING SIGNS FROM LAST ROUND (the game resolves these after the player acts; describe the danger building, do not resolve it): ${opts.telegraphs.map(String).join(" ")}`,
    );
  }
  if (plan?.kind === "skirmish") lines.push(skirmishPromptLine(plan));
  if (plan?.kind === "hazard") lines.push(hazardPromptLine(plan));
  return { beat, plan, hazardOutcome, promptLine: lines.join("\n") };
}

/** The optional JSON field the structured pass may return for the clocks (danger spec 1.4). */
export const LOCATION_DANGER_SCHEMA = `"locationDanger": "safe|uneasy|hostile"  // how dangerous the place the party is in NOW is: safe (a friendly town, a locked room), uneasy (the road, the wild, a place where trouble is possible), hostile (an enemy camp, a monster's lair, a dungeon)`;

export function parseLocationDanger(v: unknown): "safe" | "uneasy" | "hostile" {
  return v === "safe" || v === "hostile" ? v : "uneasy";
}

export function alarmSegmentsFor(pacing: Pacing): 4 | 6 | 8 {
  return PACING_PROFILES[pacing].alarmSegments;
}
