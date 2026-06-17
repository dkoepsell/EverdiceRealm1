// Elaboration invitation & mirroring (spec §6.1). The teaching core: at the
// lower rungs, a vague state-affecting action ("I attack") earns one in-fiction
// "with what? how?" before it resolves, so the player learns that richer input
// yields richer outcomes. Once their trailing-window elaboration is healthy, the
// scaffold stops inviting.
//
// Because the play loop streams narrative optimistically (the stream starts
// before the main resolve returns), the *invitation* fires PRE-SUBMIT on the
// client. The server's job here is just to tell the client whether the player
// still needs that help (based on their trailing average) and to MIRROR detail
// in the resolution prompt. So this module exposes the gate predicate + the
// prompt instruction; the in-fiction nudge text lives client-side.

import type { Rung } from "../scaffolding.types";
import { PROGRESSION_CONFIG } from "../progression/config";

/**
 * Does the player still benefit from elaboration nudges? Only at the teaching
 * rungs (GUIDED/HYBRID) and only until their trailing-window elaboration is
 * healthy (≥ stop threshold) — at which point the scaffold has done its job.
 */
export function playerNeedsElaborationHelp(rung: Rung, avgElaboration: number): boolean {
  if (rung !== "GUIDED" && rung !== "HYBRID") return false;
  return avgElaboration < PROGRESSION_CONFIG.ELABORATION_STOP_INVITING_AT;
}

/** Prompt fragment that makes narration richness mirror the player's input detail (§6.1). */
export const MIRROR_INSTRUCTION =
  "MIRROR THE PLAYER'S DETAIL: match the specificity and richness of your narration to the detail in the player's action. A terse action gets a brief beat; a vivid, specific action earns vivid, specific consequences. This teaches that input quality drives output quality.";
