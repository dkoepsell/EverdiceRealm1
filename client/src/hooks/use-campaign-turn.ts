import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';

/**
 * One seat in the campaign's turn rotation, as the server describes it.
 */
export interface TurnSeat {
  position: number;
  userId: number;
  username: string;
  displayName: string | null;
  characterId: number;
  characterName: string | null;
  isYou: boolean;
  isCurrent: boolean;
}

export interface CampaignTurn {
  /** Turn order is switched on AND more than one human is at the table. */
  enforced: boolean;
  isTurnBased: boolean;
  playerCount: number;
  /** A turn is genuinely open right now. */
  active: boolean;
  currentTurnUserId: number | null;
  startedAt: string | null;
  timeLimitSeconds: number | null;
  /** When the current holder's exclusive claim lapses. */
  expiresAt: string | null;
  /** The open turn has outlived its hold — anyone at the table may take it. */
  isStale: boolean;
  isYourTurn: boolean;
  isDM: boolean;
  canAct: boolean;
  blockedReason: string | null;
  seats: TurnSeat[];
  currentPlayer: TurnSeat | null;
  nextPlayer: TurnSeat | null;
}

export function seatLabel(seat: TurnSeat | null | undefined): string {
  if (!seat) return 'nobody';
  const player = seat.displayName || seat.username || 'A player';
  return seat.characterName ? `${player} (${seat.characterName})` : player;
}

/** "3 minutes", "2 hours", "4 days" — coarse on purpose; async tables don't count seconds. */
export function formatDuration(seconds: number): string {
  const abs = Math.max(0, Math.floor(seconds));
  if (abs < 60) return `${abs}s`;
  if (abs < 3600) {
    const m = Math.floor(abs / 60);
    return `${m} minute${m === 1 ? '' : 's'}`;
  }
  if (abs < 86400) {
    const h = Math.floor(abs / 3600);
    return `${h} hour${h === 1 ? '' : 's'}`;
  }
  const d = Math.floor(abs / 86400);
  return `${d} day${d === 1 ? '' : 's'}`;
}

/**
 * Live view of a campaign's turn rotation, plus the actions a player can take
 * on it.
 *
 * Refreshes on a timer *and* on the `turn_changed` websocket event: the socket
 * keeps a live table in sync instantly, while the poll covers async players
 * whose socket dropped hours ago and whose turn may simply have expired on the
 * clock with nobody around to announce it.
 */
export function useCampaignTurn(campaignId: number | undefined, options?: { enabled?: boolean }) {
  const enabled = (options?.enabled ?? true) && !!campaignId;
  const queryKey = [`/api/campaigns/${campaignId}/turns/current`];

  const { data, isLoading, refetch } = useQuery<CampaignTurn>({
    queryKey,
    enabled,
    // The global default staleTime is Infinity; turn state is the opposite of
    // static, so it opts out explicitly.
    staleTime: 0,
    refetchInterval: enabled ? 15000 : false,
  });

  useEffect(() => {
    if (!enabled) return;
    const onTurnChanged = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.campaignId && detail.campaignId !== campaignId) return;
      queryClient.invalidateQueries({ queryKey });
    };
    window.addEventListener('turn_changed', onTurnChanged);
    return () => window.removeEventListener('turn_changed', onTurnChanged);
  }, [enabled, campaignId]);

  // Local ticker so the "held for 12 minutes" line advances without refetching.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled || !data?.active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enabled, data?.active, data?.startedAt]);

  const timing = useMemo(() => {
    if (!data?.active || !data.startedAt) {
      return { heldForSeconds: 0, secondsUntilOpen: null as number | null, isStale: false };
    }
    const startedMs = Date.parse(data.startedAt);
    const heldForSeconds = Number.isNaN(startedMs) ? 0 : Math.max(0, (now - startedMs) / 1000);
    let secondsUntilOpen: number | null = null;
    if (data.expiresAt) {
      const expiryMs = Date.parse(data.expiresAt);
      if (!Number.isNaN(expiryMs)) secondsUntilOpen = Math.max(0, (expiryMs - now) / 1000);
    }
    // Trust the local clock between polls so the takeover option appears on
    // time rather than up to a poll interval late.
    const isStale = data.isStale || (secondsUntilOpen !== null && secondsUntilOpen <= 0);
    return { heldForSeconds, secondsUntilOpen, isStale };
  }, [data?.active, data?.startedAt, data?.expiresAt, data?.isStale, now]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const passTurn = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/campaigns/${campaignId}/turns/next`);
      return await res.json();
    },
    onSuccess: invalidate,
  });

  const claimTurn = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/campaigns/${campaignId}/turns/claim`);
      return await res.json();
    },
    onSuccess: invalidate,
  });

  const setTurnMode = useMutation({
    mutationFn: async (vars: { enabled: boolean; timeLimitSeconds?: number | null }) => {
      const res = await apiRequest('POST', `/api/campaigns/${campaignId}/turns/mode`, vars);
      return await res.json();
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}`] });
    },
  });

  return {
    turn: data,
    isLoading,
    refetch,
    ...timing,
    passTurn,
    claimTurn,
    setTurnMode,
  };
}
