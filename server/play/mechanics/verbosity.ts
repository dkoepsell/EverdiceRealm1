// Mechanics transparency (spec §8). Teach *transferable* D&D, not "how to use
// Everdice." When a check/roll happens, narrate the rule reasoning at a verbosity
// derived from rung (overridable via player_progression.rulesVerbosity):
//
//   verbose (GUIDED) -> "Climbing the wet rope is a Strength (Athletics) check —
//                        roll a d20 and add your Athletics. Need 12+."
//   terse   (HYBRID) -> "Athletics check (DC 12)…"
//   off     (OPEN,PURE) -> (just narrate the outcome)
//
// Implemented as guidance injected into the resolution prompt so the single LLM
// pass narrates at the right level — no separate formatter call.

import type { RulesVerbosity } from "../scaffolding.types";

/** Prompt guidance for how transparently to explain the rules around a roll. */
export function rollVerbosityGuidance(verbosity: RulesVerbosity): string {
  switch (verbosity) {
    case "verbose":
      return (
        "RULES TRANSPARENCY (verbose): When a check or roll occurs, briefly teach the underlying D&D 5e rule in-line — " +
        "name the ability + skill, that it's a d20 check, and the DC to beat (e.g. \"Climbing the wet rope is a Strength " +
        "(Athletics) check — roll a d20 and add your Athletics; you need 12+\"). Keep it one clause, woven into the prose."
      );
    case "terse":
      return (
        "RULES TRANSPARENCY (terse): When a check or roll occurs, name it compactly only (e.g. \"Athletics check (DC 12)…\"). " +
        "No full rule explanation."
      );
    case "off":
    default:
      return "RULES TRANSPARENCY (off): Do NOT surface dice, DCs, skill names, or rule mechanics. Narrate only the outcome in fiction.";
  }
}
