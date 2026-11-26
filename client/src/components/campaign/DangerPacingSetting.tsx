/**
 * "How much danger?" (danger spec 1.1). Saves straight away: the pacing lives
 * in the campaign's engagement_flags (PATCH /api/campaigns/:id/engagement-flags),
 * and the director reads it at the end of every turn.
 */
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PACINGS, PACING_PROFILES, type Pacing, resolvePacing } from "@shared/engagementFlags";

export function DangerPacingSetting({ campaign }: { campaign: { id: number; engagementFlags?: unknown } }) {
  const { toast } = useToast();
  const [pacing, setPacing] = useState<Pacing>(resolvePacing(campaign as any));
  useEffect(() => setPacing(resolvePacing(campaign as any)), [campaign.id, (campaign as any).engagementFlags]);

  const save = useMutation({
    mutationFn: async (next: Pacing) => {
      const res = await apiRequest("PATCH", `/api/campaigns/${campaign.id}/engagement-flags`, { pacing: next });
      return res.json();
    },
    onSuccess: (_data, next) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}`] });
      toast({ title: `Danger: ${PACING_PROFILES[next].label}`, description: "Takes effect from the next scene." });
    },
    onError: (err: any, _next) => {
      setPacing(resolvePacing(campaign as any));
      toast({ title: "Couldn't change the danger level", description: String(err?.message ?? "Only the campaign's owner can change this."), variant: "destructive" });
    },
  });

  return (
    <fieldset className="space-y-2" data-testid="danger-pacing">
      <legend className="text-sm font-semibold" style={{ color: "#0f172a" }}>
        How much danger?
      </legend>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {PACINGS.map((p) => {
          const on = p === pacing;
          return (
            <button
              key={p}
              type="button"
              aria-pressed={on}
              disabled={save.isPending}
              onClick={() => {
                if (p === pacing) return;
                setPacing(p);
                save.mutate(p);
              }}
              className={`text-left rounded-lg border-2 p-3 min-h-[44px] transition-colors ${
                on
                  ? "border-amber-600 bg-amber-50 dark:bg-amber-900/30"
                  : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-amber-400"
              }`}
              data-testid={`danger-pacing-${p}`}
            >
              <span className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                {PACING_PROFILES[p].label}
                {on && save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              </span>
              <span className="block text-xs text-slate-600 dark:text-slate-300 mt-1">{PACING_PROFILES[p].description}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
