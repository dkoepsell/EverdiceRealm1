/**
 * Friends play companions: the campaign owner hands a companion to someone
 * at the table; that friend tells the game what the companion says or does,
 * and in a fight whom they attack or whether they Dodge. The next story turn
 * carries it out.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Users } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface CompanionRow {
  campaignNpcId: number;
  name: string;
  race: string;
  className: string;
  hp: number;
  maxHp: number;
  mood: string;
  controlledBy: number | null;
  controllerName: string | null;
  isMine: boolean;
  pending: { text?: string; order?: { action: "attack" | "dodge"; target?: string } } | null;
}

interface CompanionsData {
  isOwner: boolean;
  seats: { userId: number; name: string }[];
  inCombat: boolean;
  enemies: string[];
  companions: CompanionRow[];
}

export function CompanionControl({ campaignId, refreshKey }: { campaignId: number; refreshKey?: unknown }) {
  const key = [`/api/campaigns/${campaignId}/companions`];
  const { data } = useQuery<CompanionsData>({ queryKey: key, staleTime: 0, refetchOnWindowFocus: false });
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: key });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  if (!data || !data.companions.length) return null;
  const mine = data.companions.filter((c) => c.isMine);
  const showOwner = data.isOwner && data.seats.length > 0;
  if (!mine.length && !showOwner) return null;

  return (
    <div className="mt-3 space-y-2" data-testid="companion-control">
      {mine.map((c) => <PlayAsCompanion key={c.campaignNpcId} campaignId={campaignId} c={c} inCombat={data.inCombat} enemies={data.enemies} />)}
      {showOwner && (
        <details className="rounded-xl border border-stone-700 bg-stone-900/60 p-3 text-sm text-stone-200">
          <summary className="flex cursor-pointer items-center gap-2 font-semibold"><Users className="h-4 w-4" aria-hidden="true" /> Let a friend play a companion</summary>
          <div className="mt-2 space-y-2">
            {data.companions.map((c) => <HandOff key={c.campaignNpcId} campaignId={campaignId} c={c} seats={data.seats} />)}
            <p className="text-xs text-stone-400">They need a seat in this campaign first (send them an invite link). They'll tell the game what {data.companions[0].name} says and does.</p>
          </div>
        </details>
      )}
    </div>
  );
}

function HandOff({ campaignId, c, seats }: { campaignId: number; c: CompanionRow; seats: CompanionsData["seats"] }) {
  const { toast } = useToast();
  const set = useMutation({
    mutationFn: async (userId: number | null) => (await apiRequest("POST", `/api/campaigns/${campaignId}/companions/${c.campaignNpcId}/controller`, { userId })).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/companions`] }),
    onError: (err: any) => toast({ title: "Couldn't hand over", description: err.message, variant: "destructive" }),
  });
  return (
    <label className="flex items-center justify-between gap-2">
      <span><b>{c.name}</b> <span className="text-stone-400">({c.race} {c.className})</span></span>
      <select
        className="rounded-md border border-stone-600 bg-stone-950 px-2 py-1 text-sm"
        value={c.controlledBy ?? ""}
        disabled={set.isPending}
        onChange={(e) => set.mutate(e.target.value ? Number(e.target.value) : null)}
        aria-label={`Who plays ${c.name}`}
      >
        <option value="">The game plays them</option>
        {seats.map((s) => <option key={s.userId} value={s.userId}>{s.name}</option>)}
      </select>
    </label>
  );
}

function PlayAsCompanion({ campaignId, c, inCombat, enemies }: { campaignId: number; c: CompanionRow; inCombat: boolean; enemies: string[] }) {
  const { toast } = useToast();
  const [text, setText] = useState(c.pending?.text ?? "");
  const [target, setTarget] = useState(c.pending?.order?.target ?? enemies[0] ?? "");
  const save = useMutation({
    mutationFn: async (body: any) => (await apiRequest("POST", `/api/campaigns/${campaignId}/companions/${c.campaignNpcId}/intent`, body)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/companions`] });
      toast({ title: `${c.name} is ready`, description: "It happens on the next turn, whoever takes it." });
    },
    onError: (err: any) => toast({ title: "Couldn't save", description: err.message, variant: "destructive" }),
  });
  return (
    <div className="rounded-xl border border-amber-700/60 bg-amber-950/20 p-3 text-sm text-stone-100" data-testid={`play-as-${c.name}`}>
      <p className="font-semibold text-amber-200">You're playing {c.name} <span className="font-normal text-stone-400">({c.race} {c.className}, {c.hp}/{c.maxHp} HP, feels {c.mood.toLowerCase()})</span></p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={400}
        rows={2}
        placeholder={`What does ${c.name} say or do next?`}
        className="mt-2 w-full rounded-md border border-stone-600 bg-stone-950 p-2"
        aria-label={`What ${c.name} says or does`}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={save.isPending || !text.trim()} onClick={() => save.mutate({ text })}>
          {save.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />} Save
        </Button>
        {inCombat && enemies.length > 0 && (
          <>
            <span className="text-stone-400">In the fight:</span>
            <select className="rounded-md border border-stone-600 bg-stone-950 px-2 py-1" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Target">
              {enemies.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => save.mutate({ order: { action: "attack", target } })}>Attack</Button>
            <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => save.mutate({ order: { action: "dodge" } })}>Dodge</Button>
          </>
        )}
      </div>
      {c.pending && (
        <p className="mt-2 text-xs text-stone-400">
          Waiting for the next turn: {[c.pending.text && `"${c.pending.text}"`, c.pending.order && (c.pending.order.action === "dodge" ? "Dodge" : `attack ${c.pending.order.target ?? "the nearest enemy"}`)].filter(Boolean).join(", ")}
        </p>
      )}
    </div>
  );
}
