import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Users, Check } from "lucide-react";
import { PartyChronicle, PartyTurnEntry, type PartyTurn } from "./PartyChronicle";

interface UnseenTurnsResponse {
  turns: PartyTurn[];
  count: number;
  latestTurnId: number;
  lastSeenTurnId: number;
}

/**
 * The explicit "somebody else moved" notice.
 *
 * An asynchronous table breaks down quietly: a player takes their turn on
 * Tuesday, and the next player opens the campaign on Thursday to a world that
 * changed with no account of who changed it. This panel is the account — named,
 * unabridged, and shown on arrival rather than buried in a log.
 *
 * It is deliberately *not* time-gated the way "While you were away" is. One turn
 * taken ten minutes ago still counts as news to the player who did not take it.
 */
export function PartyTurnsSinceYouLeft({ campaignId }: { campaignId: number }) {
  const queryClient = useQueryClient();
  const queryKey = [`/api/campaigns/${campaignId}/turns/unseen`];

  // The app sets a global staleTime of Infinity, which would freeze this panel on
  // whatever it saw the first time. A live view has to opt back out.
  const { data } = useQuery<UnseenTurnsResponse>({
    queryKey,
    staleTime: 15 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // A turn taken elsewhere reaches the socket long before the next poll.
  useEffect(() => {
    const onPartyTurn = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      // The socket is not per-campaign; ignore turns from other tables.
      if (detail?.campaignId && detail.campaignId !== campaignId) return;
      queryClient.invalidateQueries({ queryKey });
    };
    window.addEventListener("party_turn_recorded", onPartyTurn);
    return () => window.removeEventListener("party_turn_recorded", onPartyTurn);
  }, [campaignId, queryClient]);

  const markSeen = useMutation({
    mutationFn: async (lastTurnId: number) =>
      apiRequest("POST", `/api/campaigns/${campaignId}/turns/seen`, { lastTurnId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const turns = data?.turns ?? [];
  if (turns.length === 0) return null;

  // Mark read only as far as what was actually rendered. The unseen feed is
  // capped, so acknowledging `latestTurnId` would silently bury turns beyond the
  // cap that this player never saw.
  const readThrough = turns[turns.length - 1].id;

  const actors = Array.from(
    new Set(turns.map((t) => t.characterName || t.actorName)),
  );
  const who =
    actors.length === 1
      ? actors[0]
      : actors.length === 2
        ? `${actors[0]} and ${actors[1]}`
        : `${actors.slice(0, -1).join(", ")}, and ${actors[actors.length - 1]}`;

  return (
    <div
      className="mb-4 rounded-lg border border-emerald-700/40 bg-emerald-950/25 p-4"
      data-testid="panel-party-turns-since-you-left"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Users className="h-4 w-4 shrink-0 text-emerald-400" />
        <h3 className="font-semibold text-emerald-200" data-testid="text-party-turns-headline">
          {turns.length === 1
            ? `${who} took a turn while you were away`
            : `${turns.length} turns were taken while you were away`}
        </h3>
        <div className="ml-auto flex items-center gap-1">
          <PartyChronicle campaignId={campaignId} />
          <Button
            variant="ghost"
            size="sm"
            className="text-emerald-300/80 hover:text-emerald-100"
            disabled={markSeen.isPending}
            onClick={() => markSeen.mutate(readThrough)}
            data-testid="button-mark-party-turns-read"
          >
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Caught up
          </Button>
        </div>
      </div>

      {turns.length > 1 && (
        <p className="mt-1 text-xs text-emerald-400/70">by {who}</p>
      )}

      <div className="mt-3 space-y-2">
        {turns.map((turn) => (
          <PartyTurnEntry key={turn.id} turn={turn} highlight />
        ))}
      </div>
    </div>
  );
}
