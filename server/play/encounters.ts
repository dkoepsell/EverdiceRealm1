/**
 * Encounter objectives and morale (engagement spec Phase 4.2). At least half
 * of fights are about something other than killing everyone, and intelligent
 * foes flee, surrender or negotiate. Victory is decided here, in code, not by
 * the model.
 *
 * Stored on the session's storyState.encounter.
 */
export type ObjectiveKind = "defeat" | "escape" | "protect" | "hold_until" | "stop_ritual" | "capture" | "parley";

export interface Objective {
  kind: ObjectiveKind;
  /** Rounds to survive (hold_until) or to stop the ritual within (stop_ritual). */
  rounds?: number;
  description: string;
}

export interface EncounterState {
  objective: Objective;
  round: number;
  outcome: "won" | "lost" | null;
}

const NON_KILL: ObjectiveKind[] = ["escape", "protect", "hold_until", "stop_ritual", "capture", "parley"];

/** Pick an objective. ≥50% non-kill; bosses default to a straight fight unless the fiction says otherwise. */
export function assignObjective(opts: { isBoss?: boolean; rng?: () => number } = {}): Objective {
  const rng = opts.rng ?? Math.random;
  if (opts.isBoss && rng() < 0.6) return { kind: "defeat", description: "Defeat them." };
  if (rng() < 0.4) return { kind: "defeat", description: "Defeat or drive off your foes." };
  const kind = NON_KILL[Math.floor(rng() * NON_KILL.length)];
  switch (kind) {
    case "escape": return { kind, description: "Get away. You don't need to win, just break contact." };
    case "protect": return { kind, description: "Keep someone or something safe until the threat is gone." };
    case "hold_until": return { kind, rounds: 3, description: "Hold your ground for 3 rounds. You don't need to defeat everyone." };
    case "stop_ritual": return { kind, rounds: 4, description: "Stop what they're doing within 4 rounds, or it completes." };
    case "capture": return { kind, description: "Take one of them alive. They know something." };
    case "parley": return { kind, description: "They can be talked down. Find out what they want." };
    default: return { kind: "defeat", description: "Defeat them." };
  }
}

export interface EnemyLike {
  name: string;
  type?: string;
  currentHp?: number;
  maxHp?: number;
  status?: string;
  /** Mindless creatures (undead, constructs, oozes) never check morale. */
  mindless?: boolean;
}

const MINDLESS = /\b(zombie|skeleton|ooze|golem|construct|undead|animated|mindless|swarm)\b/i;
const out = (e: EnemyLike) => ["defeated", "fled", "surrendered", "dead"].includes(String(e.status)) || (e.currentHp ?? 1) <= 0;

/**
 * Morale (a common 5e table practice; the SRD leaves it to the DM): when an
 * ally has fallen and a creature is bloodied (≤ half HP), it checks — on a
 * failed DC 10 roll it flees, or surrenders if cornered or it's the last one.
 */
export function checkMorale(enemies: EnemyLike[], d20: () => number = () => 1 + Math.floor(Math.random() * 20)): EnemyLike[] {
  const anyFallen = enemies.some(out);
  return enemies.map((e, _i, all) => {
    if (out(e) || e.type === "boss" || e.mindless || MINDLESS.test(e.name)) return e;
    const bloodied = (e.currentHp ?? 0) <= (e.maxHp ?? 0) / 2;
    if (!anyFallen || !bloodied) return e;
    if (d20() >= 10) return e;
    const standing = all.filter((x) => !out(x)).length;
    return { ...e, status: standing <= 1 ? "surrendered" : "fled" };
  });
}

/** Decide the fight's outcome from state, not from the model. */
export function evaluateEncounter(
  enc: EncounterState,
  ctx: { enemies: EnemyLike[]; partyDown: boolean; playerEscaped?: boolean; capturedOne?: boolean; parleyAgreed?: boolean },
): EncounterState {
  if (enc.outcome) return enc;
  const allOut = ctx.enemies.length > 0 && ctx.enemies.every(out);
  if (ctx.partyDown) return { ...enc, outcome: "lost" };
  const o = enc.objective;
  let outcome: EncounterState["outcome"] = null;
  if (allOut) outcome = "won";
  else if (o.kind === "escape" && ctx.playerEscaped) outcome = "won";
  else if (o.kind === "hold_until" && enc.round >= (o.rounds ?? 3)) outcome = "won";
  else if (o.kind === "stop_ritual" && enc.round >= (o.rounds ?? 4)) outcome = "lost";
  else if (o.kind === "capture" && (ctx.capturedOne || ctx.enemies.some((e) => e.status === "surrendered"))) outcome = "won";
  else if (o.kind === "parley" && ctx.parleyAgreed) outcome = "won";
  return { ...enc, outcome };
}

export function objectivePromptLine(enc: EncounterState | null | undefined): string {
  if (!enc) return "";
  const left = enc.objective.rounds ? ` ${Math.max(0, enc.objective.rounds - enc.round)} round(s) left.` : "";
  return `ENCOUNTER OBJECTIVE: ${enc.objective.description}${left} Enemies with low morale may flee, surrender or offer terms. The game decides when the objective is met; narrate toward it.`;
}

const ESCAPE = /\b(flee|run|escape|retreat|disengage|get away|break away|cast off|leave)\b/i;
export function looksLikeEscape(choice: string | null | undefined): boolean {
  return ESCAPE.test(choice ?? "");
}
