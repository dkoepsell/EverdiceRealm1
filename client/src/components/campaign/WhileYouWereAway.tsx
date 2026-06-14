import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Scroll, Globe, X } from "lucide-react";

interface WhileYouWereAwayData {
  show: boolean;
  lastVisitAt?: string;
  narrativeRecap?: string | null;
  worldEvents?: Array<{ title: string; description: string; severity: string; eventType: string }>;
  whispers?: string[];
}

interface Props {
  campaignId: number;
}

export function WhileYouWereAway({ campaignId }: Props) {
  const { data } = useQuery<WhileYouWereAwayData>({
    queryKey: [`/api/campaigns/${campaignId}/while-you-were-away`],
    staleTime: 5 * 60 * 1000,
  });

  const dismiss = useMutation({
    mutationFn: () => apiRequest("POST", `/api/campaigns/${campaignId}/record-visit`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/while-you-were-away`] });
    },
  });

  if (!data?.show) return null;

  const hasWorldNews = (data.worldEvents?.length ?? 0) > 0 || (data.whispers?.length ?? 0) > 0;

  return (
    <div className="mb-4 rounded-lg border border-amber-700/40 bg-amber-950/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-amber-700/30 bg-amber-900/20">
        <div className="flex items-center gap-2">
          <Scroll className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">While You Were Away</span>
        </div>
        <button
          onClick={() => dismiss.mutate()}
          className="text-amber-500/60 hover:text-amber-400 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Narrative recap / cliffhanger */}
        {data.narrativeRecap && (
          <div>
            <p className="text-xs text-amber-400/60 uppercase tracking-wider mb-1">When we last left your party...</p>
            <p className="text-sm text-amber-200/90 italic leading-relaxed">{data.narrativeRecap}</p>
          </div>
        )}

        {/* World events */}
        {hasWorldNews && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Globe className="h-3 w-3 text-amber-500/70" />
              <p className="text-xs text-amber-400/60 uppercase tracking-wider">News from the Realm</p>
            </div>
            <ul className="space-y-1">
              {data.worldEvents?.map((e, i) => (
                <li key={i} className="text-xs text-amber-300/80 pl-2 border-l border-amber-600/40 leading-snug">
                  <span className="font-medium text-amber-200/90">{e.title}:</span> {e.description}
                </li>
              ))}
              {data.whispers?.map((w, i) => (
                <li key={`w${i}`} className="text-xs text-amber-300/80 pl-2 border-l border-amber-600/40 leading-snug italic">
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
