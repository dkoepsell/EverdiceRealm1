/**
 * Downtime between adventures (engagement spec 6.2): research, carousing and
 * training are real ability checks that leave a hook — a rumor, a contact, a
 * new proficiency — which the next campaign picks up.
 */
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Character } from "@shared/schema";

const ACTIVITIES = [
  { id: "research", label: "Research", blurb: "Chase a rumor worth following (Investigation)." },
  { id: "carousing", label: "Carousing", blurb: "Make a contact, or a complication (Persuasion)." },
  { id: "training", label: "Training", blurb: "Work toward a tool or language (5 sessions)." },
];

export function DowntimeHooksCard() {
  const { data: characters = [] } = useQuery<Character[]>({ queryKey: ["/api/characters"] });
  const [charId, setCharId] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const character = characters.find((c) => c.id === charId) ?? characters[0];
  const run = useMutation({
    mutationFn: async (activity: string) => (await apiRequest("POST", `/api/characters/${character!.id}/downtime-hook`, { activity })).json(),
    onSuccess: (r: any) => {
      setResult(`${r.breakdown}. ${r.message}`);
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
    },
    onError: (e: Error) => setResult(e.message.replace(/^\d+:\s*/, "")),
  });
  if (!character) return null;
  const hooks: { text: string; used?: boolean }[] = Array.isArray((character.downtimeState as any)?.hooks) ? (character.downtimeState as any).hooks : [];
  const pending = hooks.filter((h) => !h.used);
  return (
    <div className="w-full max-w-sm rounded-xl border border-amber-700/50 bg-black/70 p-4 text-stone-100" data-testid="downtime-hooks">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-serif text-lg text-amber-200">Between adventures</span>
        {characters.length > 1 && (
          <select className="rounded bg-stone-800 px-1 text-sm" value={character.id} onChange={(e) => setCharId(Number(e.target.value))}>
            {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>
      <div className="space-y-1.5">
        {ACTIVITIES.map((a) => (
          <button key={a.id} type="button" disabled={run.isPending} onClick={() => run.mutate(a.id)}
            className="w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-left hover:border-amber-500 disabled:opacity-50">
            <span className="font-semibold">{a.label}</span> <span className="text-sm text-stone-400">{a.blurb}</span>
          </button>
        ))}
      </div>
      {result && <p className="mt-2 text-sm text-amber-100" data-testid="downtime-result">{result}</p>}
      {pending.length > 0 && (
        <div className="mt-3 text-sm">
          <p className="text-xs uppercase tracking-wider text-stone-400">Waiting for your next adventure</p>
          {pending.map((h) => <p key={h.text} className="text-stone-300">• {h.text}</p>)}
        </div>
      )}
    </div>
  );
}
