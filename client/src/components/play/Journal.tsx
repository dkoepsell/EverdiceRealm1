/**
 * Journal (engagement spec 3.4; design PDF "Journal"): the people the party
 * knows and how they feel, open threads, the party's reputation, and the 5e
 * rules this player has used — visible memory, and a visible "I'm learning
 * D&D" progress bar.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface JournalData {
  people: { id: string; name: string; role: string; want: string; attitude: number; attitudeLabel: string; timesMet: number; lastSeenTurn: number; location: string | null; promisesMade: string[]; status: string }[];
  threads: { id: string; summary: string; heat: number }[];
  resolvedThreads: { id: string; summary: string }[];
  reputation: { word: string; count: number } | null;
  deeds: { turn: number; summary: string; tag: string }[];
  recap: string[];
  rulesLearned: { id: string; name: string; count: number; firstSeenAt: string }[];
  rulesTotal: number;
}

type Tab = "people" | "threads" | "rules";

const attitudeColor = (a: number) => (a >= 1 ? "text-emerald-300" : a <= -1 ? "text-red-300" : "text-stone-400");

export function useJournal(campaignId: number, enabled: boolean) {
  return useQuery<JournalData>({
    queryKey: [`/api/campaigns/${campaignId}/ledger`],
    enabled,
    // Global staleTime is Infinity; the journal changes every turn.
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function JournalButton({ campaignId, showLedger, showRules }: { campaignId: number; showLedger: boolean; showRules: boolean }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(showLedger ? "people" : "rules");
  const { data, isLoading } = useJournal(campaignId, open);
  const tabs: Tab[] = [...(showLedger ? (["people", "threads"] as Tab[]) : []), ...(showRules ? (["rules"] as Tab[]) : [])];
  const newestRule = data?.rulesLearned.length
    ? [...data.rulesLearned].sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt))[0]?.id
    : null;

  return (
    <>
      <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setOpen(true)} data-testid="journal-button">
        <BookOpen className="h-3.5 w-3.5" /> Journal
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-stone-700 bg-stone-950 text-stone-100" data-testid="journal">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-amber-100">Journal</DialogTitle>
            <DialogDescription className="sr-only">People, open threads and the rules you've learned.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            {tabs.map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${tab === t ? "bg-amber-500 text-stone-950" : "border border-stone-700 bg-stone-900 text-stone-300"}`}>
                {{ people: "People", threads: "Threads", rules: "Rules learned" }[t]}
              </button>
            ))}
          </div>
          {isLoading || !data ? (
            <p className="py-6 text-center text-stone-400">Opening your journal…</p>
          ) : tab === "people" ? (
            <div className="space-y-2">
              {data.people.length === 0 && <p className="text-stone-400">No one of note yet. The people you meet will be remembered here.</p>}
              {data.people.map((p) => (
                <div key={p.id + p.name} className="flex gap-3 rounded-xl border border-stone-700 bg-stone-900 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-800 font-serif text-lg text-amber-200">{p.name.charAt(0)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{p.name}</span>
                      <span className={`text-sm ${p.status !== "alive" ? "text-stone-500" : attitudeColor(p.attitude)}`}>{p.status !== "alive" ? p.status : p.attitudeLabel}</span>
                    </div>
                    {(p.want || p.promisesMade.length > 0) && (
                      <p className="text-sm text-stone-300">{[p.want && `Wants ${p.want}.`, p.promisesMade[p.promisesMade.length - 1]].filter(Boolean).join(" ")}</p>
                    )}
                    <p className="text-xs text-stone-500">Met {p.timesMet === 1 ? "once" : `${p.timesMet} times`}{p.location ? ` · last seen at ${p.location}` : ""}</p>
                  </div>
                </div>
              ))}
              {data.reputation && (
                <div className="rounded-xl border border-purple-800/60 bg-purple-950/40 p-3 text-sm text-purple-100">
                  <b>Your reputation:</b> known as {data.reputation.word}. People here react to it.
                </div>
              )}
            </div>
          ) : tab === "threads" ? (
            <div className="space-y-2">
              {data.threads.length === 0 && <p className="text-stone-400">No open threads right now.</p>}
              {data.threads.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-stone-700 bg-stone-900 p-3">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${t.heat >= 2 ? "bg-red-400" : "bg-amber-400"}`} />
                  <span className="flex-1">{t.summary}</span>
                  <span className={`text-sm ${t.heat >= 2 ? "text-red-300" : "text-stone-400"}`}>{t.heat >= 2 ? "Urgent" : "Open"}</span>
                </div>
              ))}
              {data.resolvedThreads.length > 0 && (
                <div className="pt-2">
                  <p className="mb-1 text-xs uppercase tracking-wider text-stone-500">Resolved</p>
                  {data.resolvedThreads.map((t) => <p key={t.id} className="text-sm text-stone-500 line-through">{t.summary}</p>)}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-sm"><span className="text-stone-300">Rules you've used</span><span className="text-stone-400">{data.rulesLearned.length} of {data.rulesTotal}</span></div>
                <div className="h-2 rounded-full bg-stone-800"><div className="h-2 rounded-full bg-amber-500" style={{ width: `${Math.round((data.rulesLearned.length / Math.max(1, data.rulesTotal)) * 100)}%` }} /></div>
              </div>
              {data.rulesLearned.length === 0 && <p className="text-stone-400">As rules come up in play, they'll be collected here.</p>}
              <div className="grid grid-cols-2 gap-2">
                {data.rulesLearned.map((r) => (
                  <div key={r.id} className={`rounded-xl border p-3 ${r.id === newestRule ? "border-amber-500" : "border-stone-700"} bg-stone-900`}>
                    <div className="font-semibold">{r.name}</div>
                    <div className={`text-sm ${r.id === newestRule ? "text-amber-300" : "text-stone-400"}`}>{r.id === newestRule && r.count === 1 ? "New" : `Used ${r.count} time${r.count === 1 ? "" : "s"}`}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
