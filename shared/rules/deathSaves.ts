/**
 * Death saving throws (SRD 5.1): d20, no modifiers. 10+ is a success, below 10
 * a failure. A natural 20 means you regain 1 hit point; a natural 1 counts as
 * two failures. Three successes stabilize you; three failures and you die.
 */
export interface DeathSaveResult {
  successes: number;
  failures: number;
  outcome: "regain_1hp" | "stable" | "dead" | null;
  message: string;
}

export function applyDeathSave(roll: number, successes: number, failures: number): DeathSaveResult {
  if (roll === 20) return { successes: 0, failures: 0, outcome: "regain_1hp", message: "Natural 20! You regain 1 HP and are conscious!" };
  let s = successes;
  let f = failures;
  let message: string;
  if (roll === 1) {
    f += 2;
    message = "Natural 1: two death save failures.";
  } else if (roll >= 10) {
    s += 1;
    message = `Success (${roll})! ${Math.min(3, s)}/3 successes.`;
  } else {
    f += 1;
    message = `Failure (${roll}). ${Math.min(3, f)}/3 failures.`;
  }
  if (f >= 3) return { successes: s, failures: Math.min(3, f), outcome: "dead", message: "You have died." };
  if (s >= 3) return { successes: 3, failures: f, outcome: "stable", message: "Stabilized! You are no longer dying." };
  return { successes: s, failures: f, outcome: null, message };
}
