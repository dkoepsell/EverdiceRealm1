// Pure progression state machine (spec §4). No side effects, no I/O.
// Given the rolling window of TurnSignals + config + current state, compute
// the target rung. Persistence and telemetry live in the wrapper (recordTurn.ts).

import {
  RUNG_ORDER,
  type Rung,
  type TurnSignal,
  type ProgressionState,
  type ProgressionEvaluation,
} from "../scaffolding.types";
import { PROGRESSION_CONFIG } from "./config";

type Config = typeof PROGRESSION_CONFIG;

export interface WindowMetrics {
  freeformRate: number;
  avgElaboration: number;
  consecutiveFreeform: number;
  struggleRate: number;
}

const isFreeform = (s: TurnSignal): boolean =>
  s.inputMode === "freeform" || s.inputMode === "affordance";

/** Compute the rolling-window metrics the thresholds are evaluated against. */
export function computeMetrics(
  signals: readonly TurnSignal[],
  config: Config = PROGRESSION_CONFIG,
): WindowMetrics {
  const window = signals.slice(-config.WINDOW_SIZE);
  const n = window.length;

  if (n === 0) {
    return { freeformRate: 0, avgElaboration: 0, consecutiveFreeform: 0, struggleRate: 0 };
  }

  const freeformCount = window.filter(isFreeform).length;
  const freeformRate = freeformCount / n;
  const avgElaboration =
    window.reduce((sum, s) => sum + (s.elaborationScore || 0), 0) / n;

  // Trailing run of freeform turns.
  let consecutiveFreeform = 0;
  for (let i = window.length - 1; i >= 0; i--) {
    if (isFreeform(window[i])) consecutiveFreeform++;
    else break;
  }

  const struggleWindow = signals.slice(-config.STRUGGLE_WINDOW);
  const struggleRate =
    struggleWindow.length === 0
      ? 0
      : struggleWindow.filter((s) => s.struggleSignal).length / struggleWindow.length;

  return { freeformRate, avgElaboration, consecutiveFreeform, struggleRate };
}

const rungIndex = (rung: Rung): number => RUNG_ORDER.indexOf(rung);
const nextRung = (rung: Rung): Rung =>
  RUNG_ORDER[Math.min(rungIndex(rung) + 1, RUNG_ORDER.length - 1)];
const prevRung = (rung: Rung): Rung =>
  RUNG_ORDER[Math.max(rungIndex(rung) - 1, 0)];

/** Does the current rung's promotion threshold currently hold? (spec §4.1 promote table) */
export function meetsPromotionThreshold(rung: Rung, m: WindowMetrics, config: Config): boolean {
  const p = config.promote;
  switch (rung) {
    case "GUIDED": {
      // either condition
      const t = p.GUIDED_TO_HYBRID;
      return m.freeformRate >= t.freeformRate || m.consecutiveFreeform >= t.consecutiveFreeform;
    }
    case "HYBRID": {
      // both conditions
      const t = p.HYBRID_TO_OPEN;
      return m.freeformRate >= t.freeformRate && m.avgElaboration >= t.avgElaboration;
    }
    case "OPEN": {
      // both conditions
      const t = p.OPEN_TO_PURE;
      return m.freeformRate >= t.freeformRate && m.avgElaboration >= t.avgElaboration;
    }
    case "PURE":
      return false; // top rung
  }
}

/**
 * Evaluate one turn (spec §4.2). Runs after the turn is recorded.
 * Returns the target rung, whether it changed, and the carry-forward confirm counter.
 * Pure: the caller persists the result and emits telemetry.
 */
export function evaluateProgression(
  state: ProgressionState,
  config: Config = PROGRESSION_CONFIG,
): ProgressionEvaluation {
  const prevConfirmCount = state.confirmCount;

  const noChange = (confirmCount: number): ProgressionEvaluation => ({
    targetRung: state.rung,
    changed: false,
    trigger: "none",
    confirmCount,
  });

  // 1. Pinned or expert -> no auto-change (expert is pinned to PURE elsewhere).
  if (state.rungPinned || state.expertMode) {
    return noChange(0);
  }

  // 2. Cooldown / hysteresis.
  if (state.totalTurns - state.lastRungChangeTurn < config.COOLDOWN_TURNS) {
    return noChange(prevConfirmCount);
  }

  // 3. Metrics over window.
  const m = computeMetrics(state.turnSignals, config);

  // 4. Demotion first.
  if (m.struggleRate >= config.demote.struggleRate && state.rung !== "GUIDED") {
    return {
      targetRung: prevRung(state.rung),
      changed: true,
      trigger: "demotion",
      confirmCount: 0,
    };
  }

  // 5. Promotion (requires CONFIRM_EVALS consecutive qualifying evals).
  if (meetsPromotionThreshold(state.rung, m, config)) {
    const confirmCount = prevConfirmCount + 1;
    if (confirmCount >= config.CONFIRM_EVALS && state.rung !== "PURE") {
      return {
        targetRung: nextRung(state.rung),
        changed: true,
        trigger: "promotion",
        confirmCount: 0,
      };
    }
    return noChange(confirmCount);
  }

  // Threshold not met this eval -> reset confirm counter.
  return noChange(0);
}
