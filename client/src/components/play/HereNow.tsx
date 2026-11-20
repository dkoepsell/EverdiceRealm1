/**
 * "Here now / Open threads" (design PDF desktop rail): who is in the scene,
 * how they feel about the party, and what's unresolved — read from the
 * Campaign Ledger, shown just above the choices.
 */
import { useJournal } from "./Journal";

export function HereNow({ campaignId }: { campaignId: number }) {
  const { data } = useJournal(campaignId, true);
  if (!data) return null;
  const latest = Math.max(0, ...data.people.map((p) => p.lastSeenTurn ?? 0));
  const here = data.people.filter((p) => p.lastSeenTurn === latest && p.status === "alive").slice(0, 3);
  const threads = data.threads.slice(0, 2);
  if (!here.length && !threads.length) return null;
  return (
    <div className="mb-3 grid gap-2 rounded-xl border border-stone-700/70 bg-stone-900/60 p-3 text-sm sm:grid-cols-2" data-testid="here-now">
      {here.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-stone-400">Here now</p>
          {here.map((p) => (
            <p key={p.id + p.name} className="text-stone-200">
              <b>{p.name}</b> <span className={p.attitude >= 1 ? "text-emerald-300" : p.attitude <= -1 ? "text-red-300" : "text-stone-400"}>{p.attitudeLabel}</span>
              {p.want ? <span className="block text-xs text-stone-400">Wants {p.want}.</span> : null}
            </p>
          ))}
        </div>
      )}
      {threads.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-stone-400">Open threads</p>
          {threads.map((t) => (
            <p key={t.id} className="flex items-center gap-2 text-stone-200">
              <span className={`h-2 w-2 shrink-0 rounded-full ${t.heat >= 2 ? "bg-red-400" : "bg-amber-400"}`} />{t.summary}
            </p>
          ))}
          {data.reputation && <p className="mt-1 text-xs text-purple-300">Reputation: {data.reputation.word}.</p>}
        </div>
      )}
    </div>
  );
}
