// Progression engine tunables. All thresholds live here so shadow-mode
// telemetry (Phase 0) can validate them against real play before Phase 1
// acts on the rung. See spec §4.1.

import type { Rung } from "../scaffolding.types";

export const PROGRESSION_CONFIG = {
  WINDOW_SIZE: 12, // turns in rolling window
  STRUGGLE_WINDOW: 6,
  COOLDOWN_TURNS: 5, // min turns between rung changes (hysteresis)
  CONFIRM_EVALS: 2, // consecutive evals meeting threshold before promotion

  promote: {
    // either condition promotes
    GUIDED_TO_HYBRID: { freeformRate: 0.3, consecutiveFreeform: 3 },
    // both conditions required
    HYBRID_TO_OPEN: { freeformRate: 0.6, avgElaboration: 0.4 },
    OPEN_TO_PURE: { freeformRate: 0.85, avgElaboration: 0.6 },
  },
  demote: {
    struggleRate: 0.4, // over STRUGGLE_WINDOW -> drop one rung (floor GUIDED)
  },

  // Phase 4 use; defined here so all tunables live in one place.
  IMPROV_MAX_CONSECUTIVE: 3,
  ELABORATION_INVITE_BELOW: 0.3,
  ELABORATION_STOP_INVITING_AT: 0.4,
  LEGIBILITY_MOMENTS_ENABLED: false,
} as const;

/** Default rules-transparency verbosity derived from rung (spec §8). */
export function deriveVerbosityFromRung(rung: Rung): "verbose" | "terse" | "off" {
  switch (rung) {
    case "GUIDED":
      return "verbose";
    case "HYBRID":
      return "terse";
    case "OPEN":
    case "PURE":
      return "off";
  }
}
