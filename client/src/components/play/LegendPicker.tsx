/**
 * "Who will you meet again?" (engagement spec 6.1): at campaign end the player
 * keeps their reputation and picks one person to recur in the next campaign.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useJournal } from "./Journal";

export function LegendPicker({ campaignId, characterId }: { campaignId: number; characterId?: number | null }) {
  const { data } = useJournal(campaignId, true);
  const [chosen, setChosen] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (npcName: string | null) => apiRequest("POST", `/api/characters/${characterId}/legend`, { campaignId, npcName }),
  });
  if (!data || !characterId) return null;
  const people = data.people.filter((p) => p.status === "alive").slice(0, 4);
  if (!people.length && !data.reputation) return null;
  return (
    <div className="rounded-xl border border-purple-700/50 bg-purple-950/30 p-4 text-left" data-testid="legend-picker">
      <p className="font-serif text-lg text-purple-100">Your legend carries on</p>
      {data.reputation && <p className="text-sm text-purple-200">You'll be known as <b>{data.reputation.word}</b> in your next adventure.</p>}
      {people.length > 0 && (
        save.isSuccess ? (
          <p className="mt-2 text-sm text-emerald-300">{chosen ? `${chosen} will cross your path again.` : "Saved."}</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-stone-300">Who will you meet again?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {people.map((p) => (
                <button key={p.id + p.name} type="button" disabled={save.isPending}
                  onClick={() => { setChosen(p.name); save.mutate(p.name); }}
                  className="rounded-lg border border-stone-600 bg-stone-900 px-3 py-1.5 text-sm hover:border-purple-400">
                  {p.name} <span className="text-stone-400">({p.attitudeLabel.toLowerCase()})</span>
                </button>
              ))}
              <button type="button" className="px-2 text-sm text-stone-400 hover:text-stone-200" disabled={save.isPending} onClick={() => { setChosen(null); save.mutate(null); }}>No one</button>
            </div>
          </>
        )
      )}
    </div>
  );
}
