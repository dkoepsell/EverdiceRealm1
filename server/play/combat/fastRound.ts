/**
 * Fast combat rounds (danger spec Phase 5). A routine round in a fight (the
 * player acted from the combat panel, so their turn is already resolved and
 * signed) needs no model call: the numbers are decided in code and the
 * monsters' answer comes from monsterRound.ts. Skipping both model calls
 * (the streamed prose and the structured pass) turns a 10-20 second wait into
 * an immediate round, with the dice shown in the combat log.
 *
 * The model still narrates the moments that matter: the fight's opening scene
 * (a planned skirmish or a clock), anything typed as a free action, and the
 * aftermath once the fight is over (the next turn out of combat is a normal turn).
 */
import type { EngagementFlags } from "@shared/engagementFlags";

export function isFastRound(
  flags: EngagementFlags,
  storyState: any,
  rollResult: any,
  opts: { plannedThreat?: boolean; clockFired?: boolean } = {},
): boolean {
  return !!(
    flags.dangerPacing &&
    flags.fastCombatRounds &&
    storyState?.inCombat &&
    rollResult?.type === "class_turn" &&
    rollResult?.serverResolved &&
    !opts.plannedThreat &&
    !opts.clockFired
  );
}

const pick = <T,>(xs: T[], seed: number) => xs[Math.abs(seed) % xs.length];

/**
 * One or two sentences for the round: what the player did, and whether the
 * target went down. `combatants` is the fight before the player's damage lands.
 */
export function fastRoundNarrative(rollResult: any, combatants: any[] | null | undefined, bark = ""): string {
  const summary = String(rollResult?.summary ?? "").trim() || "You press the attack.";
  const target = rollResult?.targetName
    ? (combatants ?? []).find((c: any) => c?.name === rollResult.targetName)
    : null;
  const before = Number(target?.currentHp ?? target?.maxHp);
  const dealt = Number(rollResult?.damage?.total ?? 0) + (Array.isArray(rollResult?.extraDamage) ? 0 : 0);
  const seed = (summary.length * 31 + dealt * 7) | 0;
  let tail = "";
  if (target && Number.isFinite(before) && dealt > 0 && before - dealt <= 0) {
    tail = ` ${pick([`${target.name} goes down.`, `${target.name} crumples and doesn't get up.`, `That's the end of ${target.name}.`], seed)}`;
  } else if (target && rollResult?.hit === false) {
    tail = ` ${pick([`${target.name} twists aside.`, `${target.name} turns the blow.`, `Not this time.`], seed)}`;
  }
  const extra = Array.isArray(rollResult?.extraDamage) && rollResult.extraDamage.length
    ? ` ${rollResult.extraDamage.map((x: any) => `${x.name} is caught too (${x.amount}).`).join(" ")}`
    : "";
  return `${summary}${tail}${extra}${bark ? `\n\n${bark}` : ""}`;
}

/** The structured result a fast round stands in for the model's JSON. */
export function fastRoundAdvancement(storyState: any, narrative: string) {
  const state = JSON.parse(JSON.stringify(storyState ?? {}));
  delete state.turnNotes;
  return {
    narrative,
    sceneType: "Combat",
    choices: [] as any[],
    storyState: state,
    combatEffects: {},
    consequencesOfChoice: "",
    fastRound: true,
  };
}
