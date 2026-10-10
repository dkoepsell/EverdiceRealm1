// A finished campaign's rewards screen is shown once per player. The marker is
// per-browser: worst case a player sees their ending twice, never zero times.

const key = (campaignId: number, userId: number) => `everdice.completionSeen.${campaignId}.${userId}`;

export function hasSeenCompletion(campaignId: number, userId: number): boolean {
  try { return !!localStorage.getItem(key(campaignId, userId)); } catch { return false; }
}

export function markCompletionSeen(campaignId: number, userId: number): void {
  try { localStorage.setItem(key(campaignId, userId), '1'); } catch {}
}
