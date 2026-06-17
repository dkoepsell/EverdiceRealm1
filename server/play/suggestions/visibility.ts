// Suggestion visibility by rung (spec §5.1). Phase 1 acts on the rung using the
// *existing* suggestion text — diegetic rendering of that text is Phase 2.
//
// The server attaches a SuggestionVisibility descriptor to the play response; the
// client honors it (how many to show, reveal behavior, whether a nudge button
// exists). Sending the descriptor (rather than hard-trimming) keeps old clients
// backward-compatible and lets OPEN reveal hidden suggestions on demand.

import type { Rung, RulesVerbosity } from "../scaffolding.types";
import { deriveVerbosityFromRung } from "../progression/config";

export type RevealMode =
  | "persistent" // shown immediately, always
  | "soft" // shown behind a light "ideas?" disclosure
  | "on-demand" // hidden until the player presses the nudge button
  | "none"; // never shown, no button

export interface SuggestionVisibility {
  rung: Rung;
  /** Max suggestions to present at this rung (client trims to this). */
  maxSuggestions: number;
  revealMode: RevealMode;
  /** Whether to render the "Need a nudge?" button (OPEN only). */
  showNudgeButton: boolean;
  /** How prominent the freeform prose input should be. */
  inputProminence: "secondary" | "primary";
}

const VISIBILITY: Record<Rung, SuggestionVisibility> = {
  GUIDED: { rung: "GUIDED", maxSuggestions: 4, revealMode: "persistent", showNudgeButton: false, inputProminence: "secondary" },
  HYBRID: { rung: "HYBRID", maxSuggestions: 3, revealMode: "soft", showNudgeButton: false, inputProminence: "primary" },
  OPEN: { rung: "OPEN", maxSuggestions: 2, revealMode: "on-demand", showNudgeButton: true, inputProminence: "primary" },
  PURE: { rung: "PURE", maxSuggestions: 0, revealMode: "none", showNudgeButton: false, inputProminence: "primary" },
};

export function getSuggestionVisibility(rung: Rung): SuggestionVisibility {
  return VISIBILITY[rung] ?? VISIBILITY.GUIDED;
}

/** Effective rung for presentation: expert mode always presents as PURE (§9). */
export function resolveEffectiveRung(p: { rung: string; expertMode?: boolean }): Rung {
  if (p.expertMode) return "PURE";
  const r = p.rung as Rung;
  return r === "GUIDED" || r === "HYBRID" || r === "OPEN" || r === "PURE" ? r : "GUIDED";
}

/** Full scaffolding block attached to a play response. */
export interface ScaffoldingResponse {
  rung: Rung;
  pinned: boolean;
  expertMode: boolean;
  rulesVerbosity: RulesVerbosity;
  visibility: SuggestionVisibility;
}

export function buildScaffoldingResponse(p: {
  rung: string;
  rungPinned?: boolean;
  expertMode?: boolean;
  rulesVerbosity?: string | null;
}): ScaffoldingResponse {
  const rung = resolveEffectiveRung(p);
  const rulesVerbosity =
    (p.rulesVerbosity as RulesVerbosity | null | undefined) ?? deriveVerbosityFromRung(rung);
  return {
    rung,
    pinned: !!p.rungPinned,
    expertMode: !!p.expertMode,
    rulesVerbosity,
    visibility: getSuggestionVisibility(rung),
  };
}
