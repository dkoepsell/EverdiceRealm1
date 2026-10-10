import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Trophy, ScrollText } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { hasSeenCompletion } from "@/lib/completionSeen";

/**
 * The dashboard only offers campaigns still in play, so a party member who
 * wasn't at the table for the finale would never open the finished campaign
 * and never see their ending. This points them at it, and at the Chronicles
 * where finished adventures can be read again.
 */
export function FinishedAdventureNotice({ campaigns }: { campaigns: any[] | undefined }) {
  const { user } = useAuth();
  if (!user || !campaigns?.length) return null;

  const finished = campaigns.filter((c) => c.isCompleted);
  if (!finished.length) return null;

  const unseen = finished.find((c) => c.worldState?.completion && !hasSeenCompletion(c.id, user.id));

  if (unseen) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 sm:flex-row sm:items-center" data-testid="finished-adventure-notice">
        <Trophy className="h-6 w-6 flex-shrink-0 text-amber-500" />
        <div className="flex-1">
          <p className="font-semibold">Your party finished "{unseen.title}"</p>
          <p className="text-sm text-muted-foreground">Your rewards are waiting. Come and see how it ended.</p>
        </div>
        <Link href={`/campaigns?open=${unseen.id}`}>
          <Button className="bg-amber-500 text-slate-900 hover:bg-amber-600">See your rewards</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end">
      <Link href="/chronicles">
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" data-testid="link-chronicles">
          <ScrollText className="mr-1.5 h-4 w-4" />
          Read your finished adventures ({finished.length})
        </Button>
      </Link>
    </div>
  );
}
