/**
 * Turn order for multiplayer campaigns.
 *
 * Everything here is pure so the rules can be reasoned about (and tested) on
 * their own, away from the database and Express. Two facts drive them:
 *
 *   1. Parties play asynchronously. Someone takes their turn and then doesn't
 *      come back for two days. A rotation that can only be advanced by a player
 *      who is present is a rotation that freezes the campaign — so an open turn
 *      always expires, after which anyone at the table may take it.
 *   2. Parties also play synchronously. In a live session nobody wants to click
 *      "end turn", so taking a story action *is* ending your turn.
 *
 * Turn order covers human players only, one seat per player, and is enforced
 * only when the campaign is explicitly turn-based AND more than one human is
 * seated. Solo play — with or without NPC companions — is never gated.
 */

/** One seat in the rotation. Seats belong to players, not to characters. */
export interface TurnRosterEntry {
  participantId: number;
  userId: number;
  characterId: number;
  turnOrder: number | null;
}

/**
 * Backstop for campaigns whose DM chose "no time limit": the turn still expires
 * eventually, so a player who walks away can never strand the table for good.
 */
export const TURN_STALL_FALLBACK_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface TurnState {
  /** Rotation is switched on and there is more than one human at the table. */
  enforced: boolean;
  isTurnBased: boolean;
  playerCount: number;
  currentTurnUserId: number | null;
  startedAt: string | null;
  /** Seconds a player holds the turn exclusively; null = the DM set no limit. */
  timeLimitSeconds: number | null;
  /** When the exclusive hold lapses and anyone may take over. */
  expiresAt: string | null;
  /** The open turn has outlived its hold; any player may take it. */
  isStale: boolean;
  isYourTurn: boolean;
  isDM: boolean;
  /** May this user take a story action right now? */
  canAct: boolean;
  /** Player-readable explanation when `canAct` is false. */
  blockedReason: string | null;
}

/** Shape of the campaign fields the rules read. */
export interface TurnCampaignFields {
  userId: number;
  isTurnBased?: boolean | null;
  currentTurnUserId?: number | null;
  turnStartedAt?: string | null;
  turnTimeLimit?: number | null;
}

/**
 * Collapse raw participant rows into the rotation.
 *
 * Deduplicated by user: a player with two characters in the party occupies a
 * single seat (their earliest), otherwise they would get two turns per round
 * for the crime of bringing a second character. Rows with no turn order sort to
 * the end, so a mid-campaign joiner queues behind the players who already
 * rolled initiative instead of jumping the line.
 */
export function orderRoster(rows: Array<{
  id: number;
  userId: number | null;
  characterId: number;
  turnOrder?: number | null;
}>): TurnRosterEntry[] {
  const seatByUser = new Map<number, TurnRosterEntry>();

  for (const row of rows) {
    if (row.userId == null) continue;
    const candidate: TurnRosterEntry = {
      participantId: row.id,
      userId: row.userId,
      characterId: row.characterId,
      turnOrder: row.turnOrder ?? null,
    };
    const existing = seatByUser.get(row.userId);
    if (!existing) {
      seatByUser.set(row.userId, candidate);
      continue;
    }
    const existingOrder = existing.turnOrder ?? Number.MAX_SAFE_INTEGER;
    const candidateOrder = candidate.turnOrder ?? Number.MAX_SAFE_INTEGER;
    if (candidateOrder < existingOrder ||
        (candidateOrder === existingOrder && candidate.participantId < existing.participantId)) {
      seatByUser.set(row.userId, candidate);
    }
  }

  return Array.from(seatByUser.values()).sort((a, b) => {
    const orderA = a.turnOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.turnOrder ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.participantId - b.participantId;
  });
}

/**
 * Index of the seat that follows `anchorUserId`. An unknown or absent anchor —
 * a player who left the party mid-turn, say — restarts at the top rather than
 * leaving the rotation stuck on a seat nobody occupies.
 */
export function nextSeatIndex(roster: TurnRosterEntry[], anchorUserId?: number | null): number {
  if (roster.length === 0) return -1;
  if (anchorUserId == null) return 0;
  const currentIndex = roster.findIndex(seat => seat.userId === anchorUserId);
  if (currentIndex === -1) return 0;
  return (currentIndex + 1) % roster.length;
}

/**
 * The rules, evaluated for one viewer. `now` is injectable so expiry behaviour
 * can be tested without waiting seven days.
 */
export function buildTurnState(
  campaign: TurnCampaignFields,
  roster: TurnRosterEntry[],
  userId: number,
  now: number = Date.now()
): TurnState {
  const isDM = campaign.userId === userId;
  const isTurnBased = !!campaign.isTurnBased;
  const playerCount = roster.length;
  const currentTurnUserId = campaign.currentTurnUserId ?? null;
  // A turn is only *open* when someone holds it and it has a start time;
  // ending a turn clears the start time but keeps the holder as a bookmark.
  const startedAt = campaign.turnStartedAt ?? null;
  const turnOpen = currentTurnUserId != null && startedAt != null;
  const timeLimitSeconds = campaign.turnTimeLimit ?? null;

  let expiresAt: string | null = null;
  let isStale = false;
  if (turnOpen) {
    const holdSeconds = timeLimitSeconds ?? TURN_STALL_FALLBACK_SECONDS;
    const startedMs = Date.parse(startedAt!);
    if (!Number.isNaN(startedMs)) {
      const expiryMs = startedMs + holdSeconds * 1000;
      expiresAt = new Date(expiryMs).toISOString();
      isStale = now >= expiryMs;
    }
  }

  const enforced = isTurnBased && playerCount > 1;
  const isYourTurn = turnOpen && currentTurnUserId === userId;

  let canAct = true;
  let blockedReason: string | null = null;
  if (enforced && !isDM && turnOpen && !isYourTurn && !isStale) {
    canAct = false;
    blockedReason = "It's another player's turn.";
  }

  return {
    enforced,
    isTurnBased,
    playerCount,
    currentTurnUserId,
    startedAt,
    timeLimitSeconds,
    expiresAt,
    isStale,
    isYourTurn,
    isDM,
    canAct,
    blockedReason,
  };
}
