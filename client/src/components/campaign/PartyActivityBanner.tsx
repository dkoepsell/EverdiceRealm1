import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Users, ArrowRight } from "lucide-react";

interface PartyActivityCampaign {
  campaignId: number;
  campaignTitle: string;
  unseenCount: number;
  latestTurnId: number;
  lastActorName: string | null;
  lastTurnAt: string | null;
}

function relativeWhen(iso: string | null) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

/**
 * The sign-in notice.
 *
 * A player at an asynchronous table needs to learn that the party moved *before*
 * they decide where to go — otherwise the news is only ever found by whoever
 * happens to open the right campaign. This sits at the top of the dashboard and
 * names the table, the player, and how many turns are waiting to be read.
 */
export function PartyActivityBanner() {
  const queryClient = useQueryClient();
  const queryKey = ["/api/me/party-activity"];

  // The app's global staleTime is Infinity; a notice about other people has to
  // opt back into refetching or it will be stale the moment it renders.
  const { data } = useQuery<{ campaigns: PartyActivityCampaign[]; totalUnseen: number }>({
    queryKey,
    staleTime: 30 * 1000,
    refetchInterval: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const onPartyTurn = () => queryClient.invalidateQueries({ queryKey });
    window.addEventListener("party_turn_recorded", onPartyTurn);
    return () => window.removeEventListener("party_turn_recorded", onPartyTurn);
  }, [queryClient]);

  const campaigns = data?.campaigns ?? [];
  if (campaigns.length === 0) return null;

  return (
    <div className="container mx-auto px-4 pt-6">
      <div
        className="rounded-lg border border-emerald-600/40 bg-emerald-950/25 p-4"
        data-testid="banner-party-activity"
      >
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-emerald-400" />
          <h2 className="font-semibold text-emerald-200" data-testid="text-party-activity-headline">
            {data!.totalUnseen === 1
              ? "A player took a turn while you were away"
              : `${data!.totalUnseen} turns were taken while you were away`}
          </h2>
        </div>

        <ul className="mt-3 space-y-2">
          {campaigns.map((c) => (
            <li
              key={c.campaignId}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-black/20 px-3 py-2"
              data-testid={`party-activity-campaign-${c.campaignId}`}
            >
              <span className="font-medium text-emerald-100">{c.campaignTitle}</span>
              <span className="text-sm text-emerald-300/80">
                {c.lastActorName
                  ? `${c.lastActorName} moved ${relativeWhen(c.lastTurnAt)}`
                  : `${c.unseenCount} new turn${c.unseenCount === 1 ? "" : "s"}`}
              </span>
              {c.lastActorName && c.unseenCount > 1 && (
                <span className="text-xs text-emerald-400/70">
                  · {c.unseenCount} turns to read
                </span>
              )}
              <Link href={`/campaigns?open=${c.campaignId}`} className="ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-emerald-300 hover:text-emerald-100"
                  data-testid={`button-read-party-turns-${c.campaignId}`}
                >
                  Read it
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
