/**
 * Final-chapter steering for the streamed narrative.
 *
 * The structured /advance-story prompt already escalates in the final chapter
 * (urgency at 6 scenes, a mandatory ending at 8). But the streamed text is
 * what players read and it is locked in verbatim, so the structured pass can
 * only tag an ending the stream actually wrote. The stream was never told it
 * was in the finale: Hollow Crown's party put the crown on, renounced it,
 * dropped it and smashed it across five scenes with no epilogue, until the
 * 12-scene backstop force-completed the campaign mid-scene.
 */

/** Scenes spent in the final chapter: turns since the last chapter gate (turnsInChapter is cumulative). */
export function scenesInFinalChapter(narrativeLog: any[], turnsInChapter: number): number {
  const lastGate = [...narrativeLog].reverse()
    .find((e: any) => e?.type === 'chapter_gate' && typeof e.turnsAtGate === 'number')?.turnsAtGate;
  return typeof lastGate === 'number' ? Math.max(0, turnsInChapter - lastGate) : turnsInChapter;
}

export const FINALE_URGENCY_THRESHOLD = 6;
export const FINALE_FORCED_DECISION = 8;

export function streamFinaleDirective(isFinalChapter: boolean, scenes: number): string {
  if (!isFinalChapter) return "";
  if (scenes >= FINALE_FORCED_DECISION) {
    return `
FINAL CHAPTER — THE CAMPAIGN ENDS NOW (${scenes} scenes into the finale):
- If the climax has already been decided (the artifact used, claimed, renounced or destroyed; the villain fallen or bargained with), write the EPILOGUE now: the consequence of that choice for the world and for each hero by name, closing every open thread. Do not re-stage the climax or invite more fiddling with it.
- If it hasn't, this scene IS the final confrontation: bring it to a decisive point and end on the last irreversible choice.
- No new mysteries, rooms, NPCs or subplots.`;
  }
  return `
FINAL CHAPTER (${scenes} scenes in): drive toward the climax. No new subplots, rooms or NPCs; every beat should close a thread or force the final choice closer.${scenes >= FINALE_URGENCY_THRESHOLD ? ` Only ${FINALE_FORCED_DECISION - scenes} scene(s) remain before the campaign must end.` : ""}`;
}
