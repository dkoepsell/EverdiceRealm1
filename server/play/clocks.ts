/**
 * Threat clocks (engagement spec Phase 4.1). They replace the "3 scenes
 * without combat → nudge, 6 → force" timer: danger arrives because the player
 * made noise, lingered, travelled or rested somewhere unsafe, and the player
 * can SEE it coming on a pie dial, which makes avoiding or provoking a fight a
 * real decision.
 *
 * Stored on the session's storyState.clocks (no migration needed).
 */
export type ClockKind = "alarm" | "villain_plan" | "wilderness_danger";

export interface Clock {
  id: ClockKind;
  name: string;
  segments: 4 | 6 | 8;
  filled: number;
  /** What happens when it fills. */
  consequence: string;
}

export interface ClockTrigger {
  clock: Clock;
  /** combat for alarm/wilderness, pressure (a world change) for the villain's plan. */
  beat: "combat" | "pressure";
  directive: string;
}

export function seedClocks(opts: { villainGoal?: string | null; pressureName?: string | null } = {}): Clock[] {
  return [
    { id: "alarm", name: "Alarm raised", segments: 6, filled: 0, consequence: "Whoever is watching comes looking: guards, sentries or the creatures that live here arrive." },
    {
      id: "villain_plan",
      name: opts.pressureName || (opts.villainGoal ? `The enemy's plan` : "The enemy's plan"),
      segments: 8,
      filled: 0,
      consequence: opts.villainGoal ? `The villain moves a step closer to ${opts.villainGoal}.` : "The villain's plan takes a visible step forward.",
    },
    { id: "wilderness_danger", name: "Wilderness danger", segments: 6, filled: 0, consequence: "Something in the wild finds the party." },
  ];
}

export function parseClocks(raw: unknown, seed: Parameters<typeof seedClocks>[0] = {}): Clock[] {
  if (!Array.isArray(raw) || !raw.length) return seedClocks(seed);
  const valid = raw.filter((c: any) => c && typeof c.id === "string" && typeof c.filled === "number" && [4, 6, 8].includes(c.segments));
  return valid.length ? (valid as Clock[]) : seedClocks(seed);
}

export interface TickSignals {
  /** sceneType of the scene just played. */
  sceneType?: string | null;
  /** The player's action text. */
  choice?: string | null;
  /** The roll this turn (server-resolved when available). */
  roll?: { skill?: string; purpose?: string; success?: boolean; total?: number; dc?: number } | null;
  /** A rest was taken: "safe" resets wilderness; "unsafe" ticks the villain and wilderness. */
  rest?: "safe" | "unsafe" | null;
  /** Scenes played in the chapter (the villain's plan advances every 3). */
  scenesInChapter?: number;
  inCombat?: boolean;
}

const LOUD = /\b(shout|yell|scream|smash|break down|kick (open|down)|explode|blast|fire(ball)?|bang|crash|ring the bell|blow the horn|attack|fight|charge)\b/i;
const LINGER = /\b(wait|linger|search (the|every)|take (our|my) time|rest here|camp here|loiter)\b/i;

/** One step of the clocks. Returns the new clocks and why each ticked (for the UI). */
export function tickClocks(clocks: Clock[], s: TickSignals): { clocks: Clock[]; ticks: { id: ClockKind; by: number; why: string }[] } {
  const ticks: { id: ClockKind; by: number; why: string }[] = [];
  const add = (id: ClockKind, by: number, why: string) => ticks.push({ id, by, why });
  const choice = s.choice ?? "";
  const failedRoll = s.roll && (s.roll.success === false || (typeof s.roll.total === "number" && typeof s.roll.dc === "number" && s.roll.total < s.roll.dc));
  const stealthy = /stealth|sleight/i.test(`${s.roll?.skill ?? ""} ${s.roll?.purpose ?? ""}`);
  if (!s.inCombat) {
    if (failedRoll && stealthy) add("alarm", 2, "A failed Stealth check");
    else if (LOUD.test(choice)) add("alarm", 1, "Making noise");
    if (LINGER.test(choice)) add("alarm", 1, "Lingering");
    if (/travel/i.test(s.sceneType ?? "")) add("wilderness_danger", 1, "Travelling");
  }
  if (s.scenesInChapter && s.scenesInChapter % 3 === 0) add("villain_plan", 1, "Time passes");
  if (s.rest === "unsafe") {
    add("villain_plan", 1, "Resting gives the enemy time");
    add("wilderness_danger", 1, "Resting in the open");
  }
  const next = clocks.map((c) => {
    let filled = c.filled + ticks.filter((t) => t.id === c.id).reduce((a, t) => a + t.by, 0);
    if (c.id === "wilderness_danger" && s.rest === "safe") filled = 0;
    return { ...c, filled: Math.max(0, Math.min(c.segments, filled)) };
  });
  return { clocks: next, ticks };
}

/** A full clock fires once, then resets (the villain's plan escalates its consequence). */
export function fireFullClock(clocks: Clock[]): { clocks: Clock[]; trigger: ClockTrigger | null } {
  const full = clocks.find((c) => c.filled >= c.segments);
  if (!full) return { clocks, trigger: null };
  const beat: ClockTrigger["beat"] = full.id === "villain_plan" ? "pressure" : "combat";
  const directive =
    beat === "combat"
      ? `CLOCK FILLED: "${full.name}". ${full.consequence} Start the fight now: set storyState.inCombat = true with combatants that fit the place. Give it an objective other than killing everyone if the fiction allows.`
      : `CLOCK FILLED: "${full.name}". ${full.consequence} Show the world changing because of it in this scene, and make the cost of delay felt.`;
  return { clocks: clocks.map((c) => (c.id === full.id ? { ...c, filled: 0 } : c)), trigger: { clock: full, beat, directive } };
}

export function clockNearFull(clocks: Clock[]): boolean {
  return clocks.some((c) => c.segments - c.filled <= 1);
}

/** Prompt line so the DM can foreshadow what's coming. */
export function clocksPromptLine(clocks: Clock[]): string {
  const live = clocks.filter((c) => c.filled > 0);
  if (!live.length) return "";
  return `THREAT CLOCKS (foreshadow these; the game fires them, not you): ${live.map((c) => `${c.name} ${c.filled}/${c.segments}`).join(", ")}.`;
}
