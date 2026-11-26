/**
 * Phase 4 per-turn bookkeeping for the advance-story handler, in one place so
 * routes.ts only wires it in: threat clocks before and after the turn,
 * encounter objectives and morale during it, and the class-combat conditions
 * the enemies' attacks must respect.
 */
import type { EngagementFlags } from "@shared/engagementFlags";
import {
  type Clock, clockNearFull, clocksPromptLine, fireFullClock, parseClocks, tickClocks,
} from "../clocks";
import {
  type EncounterState, assignObjective, checkMorale, evaluateEncounter, looksLikeEscape, objectivePromptLine,
} from "../encounters";
import type { ClassCombatState } from "./classTurn";

export interface PreTurn {
  clocks: Clock[];
  /** A clock that filled last turn and fires now. */
  trigger: { beat: "combat" | "pressure"; directive: string; clockName: string } | null;
  encounter: EncounterState | null;
  promptLine: string;
  nearFull: boolean;
}

export function preTurn(flags: EngagementFlags, state: any, campaign: any): PreTurn {
  const encounter: EncounterState | null = flags.classCombat || flags.clocks ? state?.encounter ?? null : null;
  if (!flags.clocks) {
    return { clocks: [], trigger: null, encounter, promptLine: objectivePromptLine(state?.inCombat ? encounter : null), nearFull: false };
  }
  const pressure = Array.isArray(campaign?.pressureMeters) ? campaign.pressureMeters[0] : null;
  const clocks = parseClocks(state?.clocks, { pressureName: pressure?.name ?? null, villainGoal: campaign?.villainModel?.goal ?? null });
  const trigger = state?.clockTrigger && typeof state.clockTrigger.directive === "string" ? state.clockTrigger : null;
  const lines = [clocksPromptLine(clocks), trigger?.directive ?? "", objectivePromptLine(state?.inCombat ? encounter : null)];
  return { clocks, trigger, encounter, promptLine: lines.filter(Boolean).join("\n"), nearFull: clockNearFull(clocks) };
}

/** Conditions the player's class actions put on them for the enemies' attacks this round. */
export function playerCombatConditions(state: any): string[] {
  const cc: ClassCombatState = state?.classCombat ?? {};
  const out: string[] = [];
  if (cc.dodging) out.push("dodging");
  if ((cc.rageRoundsLeft ?? 0) > 0) out.push("raging");
  if (cc.reckless) out.push("reckless");
  return out;
}

export interface MidTurn {
  combatants: any[] | null;
  inCombat: boolean | null;
  encounter: EncounterState | null;
  objectiveWon: boolean;
  objectiveLost: boolean;
  notes: string[];
}

/**
 * After the player's damage is applied: start an encounter's objective when a
 * fight begins, check morale, and decide the outcome in code.
 */
export function midTurn(
  flags: EngagementFlags,
  prev: any,
  next: any,
  ctx: { choice?: string | null; classCombat?: ClassCombatState | null; rollSucceeded?: boolean; partyDown: boolean; rng?: () => number },
): MidTurn {
  const none: MidTurn = { combatants: null, inCombat: null, encounter: prev?.encounter ?? null, objectiveWon: false, objectiveLost: false, notes: [] };
  if (!flags.classCombat && !flags.clocks) return none;
  const inCombat = !!(next?.inCombat ?? prev?.inCombat);
  if (!inCombat) return { ...none, encounter: null };
  const all: any[] = Array.isArray(next?.combatants) && next.combatants.length ? next.combatants : Array.isArray(prev?.combatants) ? prev.combatants : [];
  const enemies = all.filter((c) => c?.type === "enemy" || c?.type === "boss");
  let encounter: EncounterState = prev?.encounter && !prev.encounter.outcome
    ? { ...prev.encounter, round: (prev.encounter.round ?? 0) + 1 }
    : { objective: assignObjective({ isBoss: enemies.some((e) => e.type === "boss"), rng: ctx.rng }), round: 0, outcome: null };
  const notes: string[] = [];
  const afterMorale = checkMorale(enemies, ctx.rng ? () => 1 + Math.floor(ctx.rng!() * 20) : undefined);
  for (const e of afterMorale) {
    const before = enemies.find((x) => x.name === e.name);
    if (before && before.status !== e.status && (e.status === "fled" || e.status === "surrendered")) notes.push(`${e.name} ${e.status === "fled" ? "breaks and flees" : "throws down its weapon and surrenders"}.`);
  }
  const escaped = encounter.objective.kind === "escape" && looksLikeEscape(ctx.choice) && (!!ctx.classCombat?.disengaged || !!ctx.rollSucceeded);
  encounter = evaluateEncounter(encounter, { enemies: afterMorale, partyDown: ctx.partyDown, playerEscaped: escaped });
  const byName = new Map(afterMorale.map((e) => [e.name, e]));
  let combatants = all.map((c) => byName.get(c.name) ?? c);
  let stillFighting: boolean | null = null;
  if (encounter.outcome === "won") {
    // The objective is met: anyone still standing gives up the field.
    combatants = combatants.map((c) =>
      (c.type === "enemy" || c.type === "boss") && !["defeated", "fled", "surrendered"].includes(c.status) && (c.currentHp ?? 1) > 0
        ? { ...c, status: encounter.objective.kind === "escape" ? "evaded" : "fled" }
        : c,
    );
    stillFighting = false;
    notes.push(`Objective met: ${encounter.objective.description}`);
  } else if (encounter.outcome === "lost" && encounter.objective.kind === "stop_ritual") {
    notes.push("The ritual completes.");
  }
  return {
    combatants,
    inCombat: stillFighting,
    encounter,
    objectiveWon: encounter.outcome === "won",
    objectiveLost: encounter.outcome === "lost",
    notes,
  };
}

export interface PostTurn {
  clocks: Clock[];
  clockTrigger: { beat: "combat" | "pressure"; directive: string; clockName: string } | null;
  ticks: { id: string; by: number; why: string }[];
  classCombat: ClassCombatState | undefined;
}

/** Tick the clocks with this turn's signals; a clock that fills fires on the NEXT turn (both prompts see it). */
export function postTurn(
  flags: EngagementFlags,
  pre: PreTurn,
  state: any,
  s: {
    sceneType?: string | null; choice?: string | null; roll?: any; scenesInChapter?: number; inCombat: boolean;
    locationDanger?: "safe" | "uneasy" | "hostile" | null; moved?: boolean; alarmSegments?: 4 | 6 | 8;
  },
): PostTurn {
  const cc: ClassCombatState | undefined = state?.classCombat
    ? { ...state.classCombat, dodging: false, reckless: false, disengaged: false }
    : undefined;
  if (!flags.clocks) return { clocks: [], clockTrigger: null, ticks: [], classCombat: cc };
  const ticked = tickClocks(pre.clocks, { ...s });
  const fired = fireFullClock(ticked.clocks);
  return {
    clocks: fired.clocks,
    clockTrigger: fired.trigger ? { beat: fired.trigger.beat, directive: fired.trigger.directive, clockName: fired.trigger.clock.name } : null,
    ticks: ticked.ticks,
    classCombat: cc,
  };
}
