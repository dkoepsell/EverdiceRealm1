import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRightIcon, Clock, Crown, Users } from 'lucide-react';
import { useCampaignTurn, seatLabel, formatDuration } from '@/hooks/use-campaign-turn';

interface TurnManagerProps {
  campaignId: number;
  isTurnBased: boolean;
  isDM: boolean;
  /** Kept for callers that also mirror the flag into their own campaign cache. */
  onToggleTurnBased?: (enabled: boolean) => void;
}

/**
 * How long a player may hold the turn before anyone else at the table can take
 * over. The point of the limit is async play: without one, a party waits on
 * whoever logged off last. "No timer" still has a seven-day server backstop.
 */
const TIME_LIMIT_OPTIONS: Array<{ value: string; label: string; seconds: number | null }> = [
  { value: 'none', label: 'No timer (7-day backstop)', seconds: null },
  { value: '300', label: '5 minutes — live session', seconds: 300 },
  { value: '1800', label: '30 minutes', seconds: 1800 },
  { value: '7200', label: '2 hours', seconds: 7200 },
  { value: '86400', label: '24 hours — play-by-post', seconds: 86400 },
  { value: '259200', label: '3 days — relaxed', seconds: 259200 },
];

/**
 * Turn-order settings and roster for the party panel. The live "it's your turn"
 * prompt lives with the story itself (see TurnBanner) — this is the control
 * surface: switch turn order on, choose how long a turn may sit, see the order.
 */
export default function TurnManager({ campaignId, isTurnBased, isDM, onToggleTurnBased }: TurnManagerProps) {
  const { toast } = useToast();
  const {
    turn,
    isLoading,
    heldForSeconds,
    secondsUntilOpen,
    isStale,
    passTurn,
    claimTurn,
    setTurnMode,
  } = useCampaignTurn(campaignId);

  const turnBasedOn = turn?.isTurnBased ?? isTurnBased;
  const playerCount = turn?.playerCount ?? 0;

  // Turn order is meaningless at a table of one, and the panel would only
  // confuse a solo player, so it stays out of the way until a second human joins.
  if (isLoading || (playerCount < 2 && !turnBasedOn)) return null;

  const currentValue = turn?.timeLimitSeconds == null ? 'none' : String(turn.timeLimitSeconds);
  const knownOption = TIME_LIMIT_OPTIONS.some(o => o.value === currentValue);

  const handleToggle = (enabled: boolean) => {
    setTurnMode.mutate(
      { enabled },
      {
        onSuccess: () => {
          onToggleTurnBased?.(enabled);
          toast({
            title: enabled ? 'Turn order on' : 'Turn order off',
            description: enabled
              ? 'Players now act one at a time, in order.'
              : 'Anyone at the table can act whenever they like.',
          });
        },
        onError: (error: Error) =>
          toast({ title: 'Could not change turn order', description: error.message, variant: 'destructive' }),
      }
    );
  };

  const handleTimeLimit = (value: string) => {
    const option = TIME_LIMIT_OPTIONS.find(o => o.value === value);
    setTurnMode.mutate(
      { enabled: true, timeLimitSeconds: option ? option.seconds : null },
      {
        onSuccess: () =>
          toast({
            title: 'Turn timer updated',
            description: option?.seconds
              ? `A turn opens up to the rest of the party after ${formatDuration(option.seconds)}.`
              : 'Turns have no timer; the seven-day backstop still applies.',
          }),
        onError: (error: Error) =>
          toast({ title: 'Could not set the timer', description: error.message, variant: 'destructive' }),
      }
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Turn order
        </CardTitle>
        <CardDescription>
          {turnBasedOn
            ? 'Players act one at a time. Taking an action ends your turn and passes to the next player.'
            : 'Everyone can act whenever they like. Switch this on if the party would rather take it in turns.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isDM ? (
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="turn-based-switch">Take it in turns</Label>
              <p className="text-xs text-muted-foreground">
                {playerCount} player{playerCount === 1 ? '' : 's'} seated
              </p>
            </div>
            <Switch
              id="turn-based-switch"
              checked={turnBasedOn}
              disabled={setTurnMode.isPending}
              onCheckedChange={handleToggle}
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {turnBasedOn ? 'Turn order is on for this campaign.' : 'The party is playing free-for-all.'}
            {' '}Only the DM can change this.
          </p>
        )}

        {turnBasedOn && isDM && (
          <div className="space-y-1.5">
            <Label htmlFor="turn-time-limit">Hold a turn for</Label>
            <Select
              value={knownOption ? currentValue : 'none'}
              onValueChange={handleTimeLimit}
              disabled={setTurnMode.isPending}
            >
              <SelectTrigger id="turn-time-limit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_LIMIT_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              After this, anyone in the party can take the turn — so one player going quiet never
              stalls the campaign.
            </p>
          </div>
        )}

        {turnBasedOn && turn && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Order
            </div>
            <ol className="space-y-1">
              {turn.seats.map(seat => (
                <li
                  key={seat.userId}
                  className={[
                    'flex items-center justify-between rounded-md px-2 py-1.5 text-sm border',
                    seat.isCurrent ? 'border-amber-500/40 bg-amber-500/10' : 'border-transparent',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground w-4 shrink-0">{seat.position}</span>
                    <span className="truncate">{seatLabel(seat)}</span>
                    {seat.isYou && <Badge variant="outline" className="text-[10px]">you</Badge>}
                  </span>
                  {seat.isCurrent && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      <Crown className="h-3 w-3 mr-1" />
                      up now
                    </Badge>
                  )}
                </li>
              ))}
            </ol>

            {turn.active && (
              <p className="text-xs text-muted-foreground">
                {seatLabel(turn.currentPlayer)} has held the turn for {formatDuration(heldForSeconds)}
                {secondsUntilOpen !== null && !isStale && (
                  <> — it opens to the party in {formatDuration(secondsUntilOpen)}.</>
                )}
                {isStale && <> — it's now open to anyone.</>}
              </p>
            )}
            {!turn.active && (
              <p className="text-xs text-muted-foreground">
                No turn is open. The next player to act takes it.
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {(isDM || turn.isYourTurn || isStale) && turn.active && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    passTurn.mutate(undefined, {
                      onError: (error: Error) =>
                        toast({ title: 'Could not advance the turn', description: error.message, variant: 'destructive' }),
                    })
                  }
                  disabled={passTurn.isPending}
                >
                  <ArrowRightIcon className="h-3.5 w-3.5 mr-1" />
                  {turn.isYourTurn ? 'Pass my turn' : 'Skip to next player'}
                </Button>
              )}
              {!turn.isYourTurn && (isStale || !turn.active) && (
                <Button
                  size="sm"
                  onClick={() =>
                    claimTurn.mutate(undefined, {
                      onError: (error: Error) =>
                        toast({ title: 'Could not take the turn', description: error.message, variant: 'destructive' }),
                    })
                  }
                  disabled={claimTurn.isPending}
                >
                  Take the turn
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
