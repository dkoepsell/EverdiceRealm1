/**
 * Where a character is right now: in town, out wandering, deep in a dungeon,
 * or in the field with a campaign. Out-of-town characters get a Resume link
 * and a "Call back" button that ends the outing (with a confirmation) via
 * POST /api/characters/:id/return-to-town.
 */
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Compass, Castle, Map as MapIcon, Home, Loader2, Undo2, Play } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { CharacterEngagement } from "@shared/schema";

interface Who {
  id: number;
  name: string;
  engagement?: CharacterEngagement | null;
}

const KIND = {
  wander: { icon: Compass, tone: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300", short: "Wandering" },
  delve: { icon: Castle, tone: "border-violet-500/50 bg-violet-500/10 text-violet-300", short: "In a dungeon" },
  campaign: { icon: MapIcon, tone: "border-sky-500/50 bg-sky-500/10 text-sky-300", short: "On a campaign" },
} as const;

function sinceText(since: string | null) {
  if (!since) return "";
  const d = new Date(since);
  return isNaN(d.getTime()) ? "" : `for ${formatDistanceToNow(d)}`;
}

export function resumeHref(e: CharacterEngagement): string {
  if (e.kind === "wander") return e.campaignId ? `/wander?campaign=${e.campaignId}&resume=1` : "/wander";
  if (e.kind === "delve") return e.campaignId ? `/delve?campaign=${e.campaignId}` : "/delve";
  return `/campaigns`;
}

function consequence(e: CharacterEngagement, name: string) {
  if (e.kind === "wander") return `${name} ends the journey and heads home. Experience and items already earned are kept, and the explored map stays.`;
  if (e.kind === "delve") return `${name} leaves the dungeon and this run ends. Anything already earned or claimed is kept.`;
  return `${name} steps out of the field. The campaign stays exactly where it is and you can rejoin it any time.`;
}

export function useCallBack(who: Who) {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/characters/${who.id}/return-to-town`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wander/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/delve/active"] });
      toast({ title: `${who.name} is back in town`, description: "Free to wander, delve, or visit the tavern." });
    },
    onError: (err: Error) => toast({ title: "Couldn't call them back", description: err.message, variant: "destructive" }),
  });
}

/** Compact status badge: "In town" or "Wandering · for 2 days". */
export function WhereaboutsBadge({ who }: { who: Who }) {
  const e = who.engagement;
  if (!e) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-stone-500/40 bg-stone-500/10 px-2 py-0.5 text-[11px] text-stone-300" data-testid={`whereabouts-${who.id}`}>
        <Home className="h-3 w-3" /> In town
      </span>
    );
  }
  const k = KIND[e.kind];
  const Icon = k.icon;
  const since = sinceText(e.since);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${k.tone}`} title={`${who.name} is ${e.label}`} data-testid={`whereabouts-${who.id}`}>
      <Icon className="h-3 w-3" /> {k.short}{since ? ` · ${since}` : ""}
    </span>
  );
}

/** Resume and Call back buttons for a character who is out of town. Renders nothing when in town. */
export function WhereaboutsActions({ who, compact = false }: { who: Who; compact?: boolean }) {
  const e = who.engagement;
  const callBack = useCallBack(who);
  if (!e) return null;
  return (
    <div className="flex items-center gap-2">
      <Button asChild size="sm" variant="outline" className={compact ? "h-7 px-2 text-xs" : ""} data-testid={`resume-${who.id}`}>
        <Link href={resumeHref(e)}><Play className="h-3.5 w-3.5 mr-1" />Resume</Link>
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="outline" className={`border-amber-500/50 text-amber-300 hover:bg-amber-500/10 ${compact ? "h-7 px-2 text-xs" : ""}`} disabled={callBack.isPending} data-testid={`call-back-${who.id}`}>
            {callBack.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Undo2 className="h-3.5 w-3.5 mr-1" />}
            Call back
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Call {who.name} back to town?</AlertDialogTitle>
            <AlertDialogDescription>
              {who.name} is {e.label}. {consequence(e, who.name)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay out there</AlertDialogCancel>
            <AlertDialogAction onClick={() => callBack.mutate()} data-testid={`confirm-call-back-${who.id}`}>Call back</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * For the Wander and Delve setup screens: lists the characters who are away,
 * so it's clear why they can't be picked, with Resume and Call back for each.
 */
export function AwayRoster({ characters, className = "" }: { characters?: Who[] | null; className?: string }) {
  const away = (characters ?? []).filter((c) => !!c.engagement);
  if (!away.length) return null;
  return (
    <div className={`rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 space-y-2 ${className}`} data-testid="away-roster">
      <p className="text-xs text-amber-200/80">
        A character can only be in one place at a time. These are away and can't set out until they return:
      </p>
      {away.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-sm text-amber-100 truncate">{c.name}</span>
            <WhereaboutsBadge who={c} />
          </div>
          <WhereaboutsActions who={c} compact />
        </div>
      ))}
    </div>
  );
}
