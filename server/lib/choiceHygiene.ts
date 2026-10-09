/**
 * Player-facing choices must be actions in the fiction, not engine labels.
 * The AI sometimes copies a chapter gate's internal `requiredCommitment`
 * ("Make the defining choice") or a placeholder ("Take action") straight into
 * a button; Hollow Crown's turn 130 was submitted as literally "Make the
 * defining choice".
 */
const PLACEHOLDER = /^(take (an )?action|make (the|a) (defining|final|key) (choice|decision)|continue|proceed|do something|choose)\.?$/i;

export function cleanChoices(choices: any[], gateLabels: string[] = []): any[] {
  if (!Array.isArray(choices)) return choices;
  const labels = new Set(gateLabels.filter(Boolean).map(l => l.trim().toLowerCase()));
  return choices
    .filter(c => {
      const text = (typeof c === "string" ? c : (c?.text || c?.action || "")).trim();
      if (!text) return false;
      return !PLACEHOLDER.test(text) && !labels.has(text.toLowerCase());
    })
    // The client submits `action` for dice-roll choices; make sure it's there.
    .map(c => (c && typeof c === "object" && !c.action && c.text ? { ...c, action: c.text } : c));
}
