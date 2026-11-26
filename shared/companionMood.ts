/**
 * Companion approval points (-10..10) to the 5e attitudes shown to players
 * (companions spec). Shared so the server's approval maths and the play
 * screen's mood chips agree.
 */
export function attitudeFromPoints(points: number): number {
  if (points >= 8) return 3;
  if (points >= 5) return 2;
  if (points >= 2) return 1;
  if (points >= -1) return 0;
  if (points >= -4) return -1;
  if (points >= -7) return -2;
  return -3;
}

export const MOOD_WORDS: Record<number, string> = {
  3: "Devoted", 2: "Trusting", 1: "Friendly", 0: "Indifferent", [-1]: "Wary", [-2]: "Unfriendly", [-3]: "Hostile",
};

export function moodFromPoints(points: number): string {
  return MOOD_WORDS[attitudeFromPoints(points)];
}
