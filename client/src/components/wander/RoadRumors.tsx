/**
 * Road rumors in the Tavern (wander-threads-spec.md, Feature D). Each rumor
 * points to a place on the Wander map; going there confirms or debunks it.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Compass, Loader2, MapPin } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { JournalThread } from "./WanderTravelUI";

interface RumorsResponse {
  campaignId: number | null;
  campaignTitle: string | null;
  rumors: JournalThread[];
  message?: string;
}

export function RoadRumors() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<RumorsResponse>({
    queryKey: ["/api/wander/rumors"],
    queryFn: async () => {
      const res = await fetch("/api/wander/rumors", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load road rumors");
      return res.json();
    },
  });
  const hear = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/wander/rumors/hear", {})).json() as Promise<RumorsResponse>,
    onSuccess: (d) => qc.setQueryData(["/api/wander/rumors"], d),
  });
  const shown = hear.data ?? data;

  if (isLoading) return null;
  return (
    <Card className="border-amber-300/40 dark:border-amber-700/40" data-testid="road-rumors">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-amber-600" />
          <h4 className="font-semibold">Road news</h4>
          {shown?.campaignTitle && <span className="text-xs text-muted-foreground">for {shown.campaignTitle}</span>}
        </div>
        <p className="text-sm text-muted-foreground">
          Travellers' talk about places out in the wilds. Some of it is even true. Go and look, from the Wander page.
        </p>
        {(shown?.rumors ?? []).map((r) => (
          <div key={r.id} className="rounded-md border border-border p-3">
            <p className="text-sm italic">"{r.rumor?.text}"</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {r.rumor?.source}. {r.bearing.charAt(0).toUpperCase() + r.bearing.slice(1)} of town, about {r.distance} hexes.
            </p>
          </div>
        ))}
        {(hear.data?.message ?? shown?.message) && (
          <p className="text-xs text-muted-foreground">{hear.data?.message ?? shown?.message}</p>
        )}
        <div className="flex gap-2">
          {shown?.campaignId != null && (
            <Button variant="outline" size="sm" onClick={() => hear.mutate()} disabled={hear.isPending} data-testid="road-rumors-hear">
              {hear.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Ask about the roads
            </Button>
          )}
          <Link href="/wander"><Button variant="ghost" size="sm">Go wandering</Button></Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default RoadRumors;
