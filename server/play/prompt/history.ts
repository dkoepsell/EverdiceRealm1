/**
 * Anti-repetition, by memory rather than prohibition (engagement spec 3.3/7):
 * the recent titles and places, and a rule about new NPCs. Shared by the JSON
 * prompt and the streamed narrative so they no longer carry two different ban
 * lists. The motif ban list is gone: it produced churn ("a new NPC every
 * scene") instead of a world with a recurring cast.
 */
export function antiRepeatBlock(recentTitles: (string | null | undefined)[], recentLocations: (string | null | undefined)[], opts: { ledger: boolean }): string {
  const titles = Array.from(new Set(recentTitles.filter((t): t is string => !!t))).slice(-8);
  const places = Array.from(new Set(recentLocations.filter((p): p is string => !!p))).slice(-8);
  const lines: string[] = [];
  if (titles.length) lines.push(`Recent scene titles (don't reuse or echo): ${titles.map((t) => `"${t}"`).join(", ")}`);
  if (places.length) lines.push(`Places visited recently: ${places.join(", ")}. Return to one only for a story reason, and show what has changed.`);
  lines.push(
    opts.ledger
      ? "Prefer the returning cast (see CALLBACKS). Introduce a brand-new named NPC at most once every 3 scenes."
      : "Don't repeat the previous scene's imagery or set pieces. Introduce a brand-new named NPC at most once every 3 scenes; bring back people the player already met.",
  );
  return `CONTINUITY:\n${lines.join("\n")}`;
}
