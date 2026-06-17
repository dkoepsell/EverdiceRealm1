// Thin persistence + telemetry wrapper around the pure progression engine.
// Called once per solo turn AFTER the turn is persisted. Phase 0 = shadow mode:
// it records signals and evaluates/persists the rung, but nothing in the play
// loop consumes the rung yet (suggestion visibility is unchanged). This lets us
// validate the thresholds in §4.1 against real play before Phase 1 acts on them.
//
// MUST NOT throw into the turn flow — all work is wrapped in try/catch by the
// caller; this module also self-guards.

import { storage } from "../../storage";
import {
  RUNG_ORDER,
  type Rung,
  type RulesVerbosity,
  type ProgressionState,
  type TurnSignal,
} from "../scaffolding.types";
import { PROGRESSION_CONFIG } from "./config";
import { evaluateProgression, computeMetrics } from "./engine";
import { classifyTurn } from "./signals";
import { playerNeedsElaborationHelp } from "../suggestions/elaboration";

const asRung = (v: string | null | undefined): Rung =>
  RUNG_ORDER.includes(v as Rung) ? (v as Rung) : "GUIDED";

export interface RecordSoloTurnArgs {
  campaignId: number;
  userId: number;
  /** The player's input text for this turn. */
  choice: string;
  /** Text of the choices that were on-screen when the player acted (for menu-vs-freeform). */
  presentedChoices: string[];
  /** Whether a dice roll was attached to this turn. */
  hadRoll: boolean;
  usedHintButton?: boolean;
}

/** Telemetry emit signature (matches routes.ts recordTrace, injected to avoid a cycle). */
export type EmitTrace = (
  kind: string,
  payload: any,
  options?: { who?: string },
) => void | Promise<void>;

export interface RecordSoloTurnResult {
  rung: Rung;
  changed: boolean;
  trigger: "promotion" | "demotion" | "none";
  signal: TurnSignal;
  rungPinned: boolean;
  expertMode: boolean;
  rulesVerbosity: RulesVerbosity | null;
  invitesElaboration: boolean;
}

/**
 * Record one solo turn's signal, evaluate the rung in shadow mode, persist, and
 * emit telemetry. Returns null if anything fails (never disrupts the turn).
 */
export async function recordSoloTurn(
  args: RecordSoloTurnArgs,
  emit?: EmitTrace,
): Promise<RecordSoloTurnResult | null> {
  try {
    const { campaignId, userId } = args;
    const existing = await storage.getPlayerProgression(campaignId, userId);

    const prevSignals: TurnSignal[] = Array.isArray(existing?.turnSignals)
      ? (existing!.turnSignals as TurnSignal[])
      : [];
    const totalTurns = existing?.totalTurns ?? 0;

    const signal = classifyTurn({
      turnIndex: totalTurns,
      choice: args.choice,
      presentedChoices: args.presentedChoices,
      hadRoll: args.hadRoll,
      usedHintButton: args.usedHintButton,
    });

    const window = [...prevSignals, signal].slice(-PROGRESSION_CONFIG.WINDOW_SIZE);
    const newTotalTurns = totalTurns + 1;

    const state: ProgressionState = {
      rung: asRung(existing?.rung),
      rungPinned: existing?.rungPinned ?? false,
      expertMode: existing?.expertMode ?? false,
      rulesVerbosity: (existing?.rulesVerbosity as RulesVerbosity | null) ?? null,
      turnSignals: window,
      lastRungChangeTurn: existing?.lastRungChangeTurn ?? 0,
      totalTurns: newTotalTurns,
      confirmCount: existing?.confirmCount ?? 0,
    };

    const evaluation = evaluateProgression(state, PROGRESSION_CONFIG);
    const fromRung = state.rung;

    await storage.upsertPlayerProgression(campaignId, userId, {
      rung: evaluation.targetRung,
      turnSignals: window,
      confirmCount: evaluation.confirmCount,
      lastRungChangeTurn: evaluation.changed ? newTotalTurns : state.lastRungChangeTurn,
      totalTurns: newTotalTurns,
    });

    // Telemetry (spec §10). Fire-and-forget; failures are swallowed by caller.
    if (emit) {
      const who = `player.${userId}`;
      await emit("scaffold.turnRecorded", {
        inputMode: signal.inputMode,
        resolutionType: signal.resolutionType,
        elaborationScore: signal.elaborationScore,
        inputLength: signal.inputLength,
        struggleSignal: signal.struggleSignal,
        rung: evaluation.targetRung,
        totalTurns: newTotalTurns,
        shadowMode: true,
      }, { who });

      if (signal.inputMode === "freeform") {
        await emit("scaffold.offMenu", { resolutionType: signal.resolutionType }, { who });
      }
      if (signal.resolutionType === "improvised") {
        await emit("scaffold.improvised", { steeredBack: false }, { who });
      }
      if (evaluation.changed) {
        await emit("scaffold.rungChanged", {
          from: fromRung,
          to: evaluation.targetRung,
          trigger: evaluation.trigger,
          shadowMode: true,
        }, { who });
      }
    }

    const avgElaboration = computeMetrics(window).avgElaboration;
    return {
      rung: evaluation.targetRung,
      changed: evaluation.changed,
      trigger: evaluation.trigger,
      signal,
      rungPinned: state.rungPinned,
      expertMode: state.expertMode,
      rulesVerbosity: state.rulesVerbosity,
      invitesElaboration: playerNeedsElaborationHelp(evaluation.targetRung, avgElaboration),
    };
  } catch (error) {
    console.error("[scaffold] recordSoloTurn failed:", error);
    return null;
  }
}
