/**
 * Which offered choice a submitted turn corresponds to, for the
 * turn_submitted event: its index in the menu, or "freeform" when the player
 * typed their own action. Matching is by normalized text because the client
 * sends the choice's text (or action), not its index.
 */
const norm = (v: unknown) =>
  typeof v === "string" ? v.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() : "";

export function choiceIndexOf(offered: unknown[], submitted: unknown): number | "freeform" {
  const want = norm(submitted);
  if (!want) return "freeform";
  for (let i = 0; i < offered.length; i++) {
    const c = offered[i] as any;
    const texts = typeof c === "string" ? [c] : [c?.text, c?.action, c?.displayHint, c?.hint];
    if (texts.some((t) => norm(t) === want)) return i;
  }
  return "freeform";
}
