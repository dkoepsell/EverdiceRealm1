// Progressive Scaffolding & Imagination Engine — shared types
// See: everdice-progressive-scaffolding-spec.md (Phase 0)
//
// The scaffolding system teaches new solo players the grammar of
// theater-of-the-mind play, then progressively removes the suggestion
// menu as they demonstrate competence. These types are the contract
// shared between the progression engine, suggestions, and telemetry.

/** The player's current scaffolding level. Order matters: GUIDED < HYBRID < OPEN < PURE. */
export type Rung = "GUIDED" | "HYBRID" | "OPEN" | "PURE";

export const RUNG_ORDER: readonly Rung[] = ["GUIDED", "HYBRID", "OPEN", "PURE"] as const;

/** How the player supplied input this turn. */
export type InputMode = "menu" | "affordance" | "freeform";

/**
 * What the engine did with the input.
 * NOTE: the Everdice solo loop is fully LLM-generative — there is no authored
 * CAML node graph walked at play time (see Phase 0 recon). So "scripted_edge"
 * here means "the player took one of the presented menu options" and
 * "improvised" means "the player typed off-menu prose the LLM responded to".
 */
export type ResolutionType =
  | "scripted_edge"
  | "resolved_intent"
  | "improvised"
  | "info"
  | "invalid";

export type RulesVerbosity = "verbose" | "terse" | "off";

/** Recorded every solo turn; the rolling window of these drives rung evaluation. */
export interface TurnSignal {
  turnIndex: number;
  inputMode: InputMode;
  inputLength: number; // chars
  elaborationScore: number; // 0..1, see §6.1
  resolutionType: ResolutionType;
  usedHintButton: boolean;
  struggleSignal: boolean; // short+invalid, repeated hint use, confusion
}

/** Shape of the persisted progression row, decoupled from the Drizzle select type. */
export interface ProgressionState {
  rung: Rung;
  rungPinned: boolean;
  expertMode: boolean;
  rulesVerbosity: RulesVerbosity | null; // null = derive from rung
  turnSignals: TurnSignal[]; // last WINDOW_SIZE
  lastRungChangeTurn: number;
  totalTurns: number;
  confirmCount: number; // consecutive evals meeting the promotion threshold
}

/** Result of a single progression evaluation pass (pure). */
export interface ProgressionEvaluation {
  targetRung: Rung;
  changed: boolean;
  trigger: "promotion" | "demotion" | "none";
  /** Confirm counter to carry forward across evals (promotion requires CONFIRM_EVALS). */
  confirmCount: number;
}
