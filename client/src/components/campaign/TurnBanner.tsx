import { Clock, Users, ArrowRight, Hourglass, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  useCampaignTurn,
  seatLabel,
  formatDuration,
  type TurnSeat,
} from '@/hooks/use-campaign-turn';

interface TurnBannerProps {
  campaignId: number;
  /** Hidden while combat runs its own initiative order, to avoid two turn UIs. */
  hidden?: boolean;
}

function SeatPips({ seats }: { seats: TurnSeat[] }) {
  if (seats.length < 2) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {seats.map((seat) => (
        <span
          key={seat.userId}
          title={seatLabel(seat)}
          className={[
            'px-2 py-0.5 rounded-full text-[11px] border transition-colors',
            seat.isCurrent
              ? 'bg-amber-500/20 border-amber-400/60 text-amber-200 font-semibold'
              : 'bg-slate-800/60 border-slate-600/40 text-slate-400',
          ].join(' ')}
        >
          {seat.characterName || seat.displayName || seat.username}
          {seat.isYou && <span className="ml-1 opacity-70">(you)</span>}
        </span>
      ))}
    </div>
  );
}

/**
 * The always-visible answer to "whose turn is it, and what can I do about it?"
 *
 * Deliberately renders nothing for solo tables and for multiplayer campaigns
 * that never switched turn order on — a party playing free-for-all shouldn't
 * have to look at turn chrome.
 */
export default function TurnBanner({ campaignId, hidden }: TurnBannerProps) {
  const { toast } = useToast();
  const {
    turn,
    heldForSeconds,
    secondsUntilOpen,
    isStale,
    passTurn,
    claimTurn,
  } = useCampaignTurn(campaignId, { enabled: !hidden });

  if (hidden || !turn?.enforced) return null;

  const current = turn.currentPlayer;
  const next = turn.nextPlayer;
  const yourTurn = turn.isYourTurn;
  const noOneUp = !turn.active;

  const onPass = () => {
    passTurn.mutate(undefined, {
      onSuccess: (data: any) => {
        toast({
          title: 'Turn passed',
          description: `${seatLabel(data?.currentPlayer)} is up next.`,
        });
      },
      onError: (error: Error) =>
        toast({ title: 'Could not pass the turn', description: error.message, variant: 'destructive' }),
    });
  };

  const onClaim = () => {
    claimTurn.mutate(undefined, {
      onSuccess: () =>
        toast({ title: "You've taken the turn", description: 'The story is yours to move.' }),
      onError: (error: Error) =>
        toast({ title: 'Could not take the turn', description: error.message, variant: 'destructive' }),
    });
  };

  const tone = yourTurn
    ? 'border-emerald-500/40 bg-emerald-950/30'
    : isStale || noOneUp
      ? 'border-sky-500/40 bg-sky-950/30'
      : 'border-amber-500/30 bg-amber-950/20';

  return (
    <div className={`rounded-lg border p-3 mb-4 ${tone}`} data-testid="turn-banner">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          {yourTurn ? (
            <Sparkles className="h-4 w-4 mt-0.5 text-emerald-300 shrink-0" />
          ) : noOneUp || isStale ? (
            <Hourglass className="h-4 w-4 mt-0.5 text-sky-300 shrink-0" />
          ) : (
            <Clock className="h-4 w-4 mt-0.5 text-amber-300 shrink-0" />
          )}

          <div className="min-w-0">
            {yourTurn && (
              <>
                <p className="text-sm font-semibold text-emerald-200">It's your turn</p>
                <p className="text-xs text-emerald-300/70">
                  Take an action below — that ends your turn and passes to {seatLabel(next)}.
                </p>
              </>
            )}

            {!yourTurn && noOneUp && (
              <>
                <p className="text-sm font-semibold text-sky-200">The table is open</p>
                <p className="text-xs text-sky-300/70">
                  No one holds the turn. Act now and it's yours.
                </p>
              </>
            )}

            {!yourTurn && !noOneUp && !isStale && (
              <>
                <p className="text-sm font-semibold text-amber-200">
                  Waiting on {seatLabel(current)}
                </p>
                <p className="text-xs text-amber-300/70">
                  Their turn has been open {formatDuration(heldForSeconds)}
                  {secondsUntilOpen !== null && (
                    <> — anyone can take over in {formatDuration(secondsUntilOpen)}.</>
                  )}
                  {secondsUntilOpen === null && <>. You're up after them.</>}
                </p>
              </>
            )}

            {!yourTurn && !noOneUp && isStale && (
              <>
                <p className="text-sm font-semibold text-sky-200">
                  {seatLabel(current)} ran out of time
                </p>
                <p className="text-xs text-sky-300/70">
                  Their turn has been open {formatDuration(heldForSeconds)}. Anyone can move the
                  story on now.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {yourTurn && (
            <Button
              size="sm"
              variant="outline"
              onClick={onPass}
              disabled={passTurn.isPending}
              className="text-xs border-emerald-500/40 text-emerald-200 hover:bg-emerald-900/30"
              data-testid="turn-pass"
            >
              <ArrowRight className="h-3.5 w-3.5 mr-1" />
              Pass to {next?.characterName || next?.displayName || next?.username || 'next'}
            </Button>
          )}

          {!yourTurn && (isStale || noOneUp) && (
            <Button
              size="sm"
              onClick={onClaim}
              disabled={claimTurn.isPending}
              className="text-xs bg-sky-600 hover:bg-sky-500"
              data-testid="turn-claim"
            >
              Take the turn
            </Button>
          )}

          {!yourTurn && !noOneUp && !isStale && turn.isDM && (
            <Button
              size="sm"
              variant="outline"
              onClick={onPass}
              disabled={passTurn.isPending}
              className="text-xs border-amber-500/40 text-amber-200 hover:bg-amber-900/30"
              data-testid="turn-skip"
            >
              Skip to next
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-white/5">
        <Users className="h-3 w-3 text-slate-500 shrink-0" />
        <SeatPips seats={turn.seats} />
        {turn.timeLimitSeconds === null && (
          <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-700">
            no turn timer
          </Badge>
        )}
      </div>
    </div>
  );
}
