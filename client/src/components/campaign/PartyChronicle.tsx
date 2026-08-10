import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { BookOpen, Dices } from "lucide-react";

export interface PartyTurn {
  id: number;
  userId: number | null;
  actorName: string;
  characterName: string | null;
  choice: string | null;
  narrative: string | null;
  rollResult: any;
  sceneType: string | null;
  chapterNumber: number | null;
  createdAt: string;
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function rollSummary(roll: any): string | null {
  if (!roll) return null;
  if (typeof roll === "string") return roll;
  if (typeof roll !== "object") return null;
  const parts: string[] = [];
  if (roll.skill || roll.type) parts.push(String(roll.skill || roll.type));
  if (roll.total != null) parts.push(`= ${roll.total}`);
  else if (roll.roll != null) parts.push(`= ${roll.roll}`);
  if (roll.dc != null) parts.push(`vs DC ${roll.dc}`);
  if (roll.success != null) parts.push(roll.success ? "(success)" : "(failure)");
  return parts.length ? parts.join(" ") : null;
}

/**
 * One turn as it is read back later: who acted, in their own words, and the full
 * text the table saw in reply. Deliberately unabridged — a summary is exactly the
 * thing an absent player cannot reconstruct.
 */
export function PartyTurnEntry({ turn, highlight = false }: { turn: PartyTurn; highlight?: boolean }) {
  const roll = rollSummary(turn.rollResult);

  return (
    <div
      className={`rounded-md border p-3 ${
        highlight
          ? "border-amber-600/40 bg-amber-950/20"
          : "border-amber-900/30 bg-black/20"
      }`}
      data-testid={`party-turn-${turn.id}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-semibold text-amber-200">
          {turn.characterName || turn.actorName}
        </span>
        {turn.characterName && (
          <span className="text-xs text-amber-500/70">played by {turn.actorName}</span>
        )}
        <span className="ml-auto text-xs text-amber-500/60">{formatWhen(turn.createdAt)}</span>
      </div>

      {turn.choice && (
        <p className="mt-2 border-l-2 border-amber-600/50 pl-3 text-sm italic text-amber-100/90">
          {turn.choice}
        </p>
      )}

      {roll && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-400/80">
          <Dices className="h-3 w-3" />
          {roll}
        </p>
      )}

      {turn.narrative && (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-amber-100/70">
          {turn.narrative}
        </p>
      )}
    </div>
  );
}

/**
 * The lasting trace. Every turn the party has ever taken, attributed, newest
 * first, paged backwards for as far as the campaign goes.
 */
export function PartyChronicle({
  campaignId,
  trigger,
}: {
  campaignId: number;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [beforeId, setBeforeId] = useState<number | null>(null);
  const [loaded, setLoaded] = useState<PartyTurn[]>([]);

  const { data, isFetching } = useQuery<{ entries: PartyTurn[]; hasMore: boolean }>({
    queryKey: [
      `/api/campaigns/${campaignId}/turn-log`,
      beforeId ? `?limit=50&beforeId=${beforeId}` : "?limit=50",
    ],
    queryFn: async () => {
      const qs = beforeId ? `?limit=50&beforeId=${beforeId}` : "?limit=50";
      const res = await fetch(`/api/campaigns/${campaignId}/turn-log${qs}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load the party chronicle");
      const page = await res.json();
      setLoaded((prev) => {
        // De-duplicate by id: a page boundary can overlap if a turn lands mid-read.
        const seen = new Set(prev.map((t) => t.id));
        return [...prev, ...page.entries.filter((e: PartyTurn) => !seen.has(e.id))];
      });
      return page;
    },
    enabled: open,
    staleTime: 30 * 1000,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setBeforeId(null);
          setLoaded([]);
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="sm"
            className="text-amber-400/80 hover:text-amber-200"
            data-testid="button-open-party-chronicle"
          >
            <BookOpen className="mr-1.5 h-3.5 w-3.5" />
            Party chronicle
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] max-w-2xl border-amber-800/40 bg-[#1a1410]">
        <DialogHeader>
          <DialogTitle className="text-amber-200">Party chronicle</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-amber-500/70">
          Every turn this party has taken, and who took it.
        </p>

        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-2">
            {loaded.length === 0 && !isFetching && (
              <p className="py-6 text-center text-sm text-amber-500/60">
                No turns have been recorded yet.
              </p>
            )}
            {loaded.map((turn) => (
              <PartyTurnEntry key={turn.id} turn={turn} />
            ))}
          </div>

          {data?.hasMore && (
            <div className="pt-3 text-center">
              <Button
                variant="outline"
                size="sm"
                disabled={isFetching}
                onClick={() => {
                  const oldest = loaded[loaded.length - 1];
                  if (oldest) setBeforeId(oldest.id);
                }}
                data-testid="button-chronicle-load-more"
              >
                {isFetching ? "Loading…" : "Earlier turns"}
              </Button>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
