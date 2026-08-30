import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { MapPin, Users, Flame } from "lucide-react";
import { Link } from "wouter";

/** Mirrors the server's WorldContext (server/lib/worldContext.ts). */
export interface WorldContextPayload {
  regionId: number;
  regionName: string;
  regionDescription: string | null;
  terrain: string | null;
  levelRange: string | null;
  instability: number;
  danger: number;
  mood: string;
  locationId: number | null;
  locationName: string | null;
  locationType: string | null;
  knownLocations: string[];
  events: string[];
  rumors: string[];
  otherTravelers: string[];
  otherTravelerCount: number;
}

/** Danger reads as a colour so the region's character registers without being read. */
function dangerTone(danger: number): string {
  if (danger >= 60) return "text-red-500 dark:text-red-400";
  if (danger >= 35) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}

/**
 * "You are here", on the play surface.
 *
 * The world map lives on its own route that drew 4 sessions in 30 days, so the party's
 * place in the shared world was effectively invisible while playing. This puts the region,
 * its current mood, and — crucially — the other people who have walked the same ground
 * directly above the story.
 */
export default function WorldPlaceStrip({ campaignId }: { campaignId: number }) {
  const { data: ctx } = useQuery<WorldContextPayload | null>({
    queryKey: [`/api/campaigns/${campaignId}/world-context`],
    // The region's mood and its traveler list change as other people play, so this must
    // not inherit the global staleTime: Infinity.
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  // Unanchored campaigns render nothing rather than an empty shell.
  if (!ctx?.regionName) return null;

  const place = ctx.locationName ? `${ctx.locationName}, ${ctx.regionName}` : ctx.regionName;
  const others = ctx.otherTravelerCount;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
      <span className="flex items-center gap-1.5 font-medium">
        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>{place}</span>
      </span>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="cursor-default gap-1 font-normal">
              <Flame className={`h-3 w-3 ${dangerTone(ctx.danger)}`} aria-hidden="true" />
              <span className="capitalize">{ctx.mood}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              Danger {ctx.danger}/100 · Instability {ctx.instability}/100
              {ctx.levelRange ? ` · Levels ${ctx.levelRange}` : ""}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {others > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex cursor-default items-center gap-1.5 text-muted-foreground">
                <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {others === 1 ? "1 other has" : `${others} others have`} travelled here
                </span>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {ctx.otherTravelers.length
                  ? ctx.otherTravelers.slice(0, 5).join(", ")
                  : "Their names are not recorded."}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {ctx.rumors.length > 0 && (
        <span className="w-full text-xs italic text-muted-foreground">
          {ctx.rumors[0]}
        </span>
      )}

      <Link
        href="/world-map"
        className="ml-auto text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        View the realm
      </Link>
    </div>
  );
}
