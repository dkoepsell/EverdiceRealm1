/**
 * A real 5e fight in Wander or Delve (server/play/skirmish). Pick a target,
 * an action, and optionally a bonus action; the server rolls everything and
 * shows its working.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Swords, Shield, Eye, Footprints, Wind, Sparkles, Heart, Loader2, Skull, Trophy, ChevronDown, ChevronRight, Dices } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Enemy { id: string; name: string; ac: number; hp: number; maxHp: number; status: "active" | "down" | "fled"; creatureType: string }
interface LogEntry { round: number; who: "pc" | "enemy" | "system"; text: string; detail?: string[] }
export interface SkirmishView {
  round: number;
  status: "active" | "won" | "lost" | "fled";
  surprise: string;
  pc: { name: string; hp: number; maxHp: number; ac: number; prone: boolean };
  enemies: Enemy[];
  classCombat: { rageRoundsLeft?: number; dodging?: boolean; hidden?: boolean };
  log: LogEntry[];
  encounterNote: string;
  rating: string;
  xpEarned: number;
}
interface Options {
  weapon: string;
  attacksPerAction: number;
  bonusActions: string[];
  actionSurge: number | null;
  recklessAttack: boolean;
  smiteSlots: number[];
  slots: number[];
  spells: Array<{ id: string; name: string; level: number; bonusAction: boolean; text: string }>;
  raging: boolean;
  hidden: boolean;
}
interface Response { state: SkirmishView | null; options: Options | null; xpAwarded?: number; payoff?: { text?: string; kind?: string; name?: string } | null; resolution?: unknown; run?: unknown }

const RATING_TONE: Record<string, string> = {
  trivial: "border-slate-500 text-slate-300", easy: "border-emerald-500 text-emerald-300", medium: "border-amber-500 text-amber-300",
  hard: "border-orange-500 text-orange-300", deadly: "border-red-500 text-red-300",
};

const BONUS_LABEL: Record<string, string> = {
  second_wind: "Second Wind", rage: "Rage", cunning_dash: "Cunning: Dash", cunning_disengage: "Cunning: Disengage", cunning_hide: "Cunning: Hide",
  flurry_of_blows: "Flurry of Blows", patient_defense: "Patient Defense", step_of_the_wind: "Step of the Wind",
};

function HpBar({ hp, max, tone }: { hp: number; max: number; tone: string }) {
  const pct = Math.max(0, Math.min(100, (hp / Math.max(1, max)) * 100));
  return (
    <div className="h-1.5 w-full rounded bg-slate-800 overflow-hidden">
      <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function SkirmishPanel({
  mode, runId, onDone,
}: {
  mode: "wander" | "delve";
  runId: number;
  onDone: (result: { status: string; xp: number; payoff?: Response["payoff"]; resolution?: unknown; run?: unknown }) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = ["/api/skirmish", mode, runId];
  const { data } = useQuery<Response>({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(`/api/skirmish/${mode}/${runId}`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to load fight");
      return res.json();
    },
  });
  const [last, setLast] = useState<Response | null>(null);
  const start = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/skirmish/start", { mode, runId })).json() as Promise<Response>,
    onSuccess: (d) => { setLast(d); qc.setQueryData(key, d); },
    onError: (e: Error) => toast({ title: "Couldn't start the fight", description: e.message, variant: "destructive" }),
  });
  const turn = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await apiRequest("POST", "/api/skirmish/turn", { mode, runId, ...body })).json() as Promise<Response>,
    onSuccess: (d) => { setLast(d); qc.setQueryData(key, d); },
    onError: (e: Error) => toast({ title: "Not allowed", description: e.message.replace(/^\d+:\s*/, ""), variant: "destructive" }),
  });

  // Start automatically if the server says a fight is waiting.
  useEffect(() => {
    if (data && !data.state && !start.isPending && !start.isSuccess) start.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const view = last ?? data;
  const s = view?.state ?? null;
  const o = view?.options ?? null;
  const [targetId, setTargetId] = useState<string | null>(null);
  const [bonus, setBonus] = useState<string | null>(null);
  const [reckless, setReckless] = useState(false);
  const [surge, setSurge] = useState(false);
  const [smite, setSmite] = useState<number | null>(null);
  const [slot, setSlot] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<Record<number, boolean>>({});

  const live = useMemo(() => (s?.enemies ?? []).filter((e) => e.status === "active"), [s]);
  const target = live.find((e) => e.id === targetId) ?? live[0];
  const busy = turn.isPending || start.isPending;

  if (!s) {
    return (
      <Card className="border-red-500/40 bg-slate-900/70">
        <CardContent className="py-8 flex items-center justify-center gap-2 text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" /> Rolling initiative...
        </CardContent>
      </Card>
    );
  }

  const go = (action: string, extra: Record<string, unknown> = {}) => {
    const isBonusSpell = bonus?.startsWith("spell:");
    turn.mutate({
      action,
      targetId: target?.id,
      bonus: bonus && !isBonusSpell ? bonus : null,
      bonusSpellId: isBonusSpell ? bonus!.slice(6) : null,
      reckless, actionSurge: surge, smiteSlot: smite,
      ...extra,
    });
    setBonus(null); setSurge(false); setSmite(null);
  };

  const ended = s.status !== "active";
  const lastLog = [...s.log].reverse().slice(0, 12);
  const pcTone = s.pc.hp <= s.pc.maxHp / 4 ? "bg-red-500" : s.pc.hp <= s.pc.maxHp / 2 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <Card className="border-red-500/40 bg-slate-900/80" data-testid="skirmish-panel">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Swords className="h-4 w-4 text-red-400" />
          <CardTitle className="text-base text-white">{ended ? (s.status === "won" ? "Victory" : s.status === "fled" ? "You got away" : "Knocked out") : `Round ${s.round}`}</CardTitle>
          <Badge variant="outline" className={`text-[10px] uppercase ${RATING_TONE[s.rating] ?? ""}`} title={s.encounterNote}>{s.rating}</Badge>
        </div>
        <p className="text-[11px] text-slate-500">{s.encounterNote}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* You */}
        <div className="p-2 rounded bg-slate-800/60 border border-slate-700/60">
          <div className="flex items-center gap-2 text-sm">
            <Heart className="h-3.5 w-3.5 text-red-400" />
            <span className="text-white font-medium">{s.pc.name}</span>
            <span className="text-slate-300 ml-auto">{s.pc.hp}/{s.pc.maxHp} HP · AC {s.pc.ac}</span>
          </div>
          <div className="mt-1.5"><HpBar hp={s.pc.hp} max={s.pc.maxHp} tone={pcTone} /></div>
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {s.pc.prone && <Badge variant="outline" className="text-[10px] border-orange-500/60 text-orange-300">Prone</Badge>}
            {s.classCombat.hidden && <Badge variant="outline" className="text-[10px] border-sky-500/60 text-sky-300">Hidden</Badge>}
            {s.classCombat.dodging && <Badge variant="outline" className="text-[10px] border-sky-500/60 text-sky-300">Dodging</Badge>}
            {(s.classCombat.rageRoundsLeft ?? 0) > 0 && <Badge variant="outline" className="text-[10px] border-red-500/60 text-red-300">Raging</Badge>}
          </div>
        </div>

        {/* Them */}
        <div className="space-y-1.5">
          {s.enemies.map((e) => {
            const selected = target?.id === e.id && e.status === "active";
            const bloodied = e.status === "active" && e.hp <= e.maxHp / 2;
            return (
              <button key={e.id} type="button" disabled={e.status !== "active" || ended}
                onClick={() => setTargetId(e.id)}
                className={`w-full text-left p-2 rounded border transition-colors ${selected ? "border-red-400 bg-red-950/40" : "border-slate-700/60 bg-slate-800/40"} ${e.status !== "active" ? "opacity-50" : "hover:border-red-400/60"}`}
                data-testid={`skirmish-enemy-${e.id}`}
              >
                <div className="flex items-center gap-2 text-sm">
                  {e.status === "down" ? <Skull className="h-3.5 w-3.5 text-slate-500" /> : <Swords className="h-3.5 w-3.5 text-red-300" />}
                  <span className="text-slate-100">{e.name}</span>
                  <span className="text-[11px] text-slate-400 ml-auto">
                    {e.status === "down" ? "down" : e.status === "fled" ? "fled" : bloodied ? "bloodied" : e.hp < e.maxHp ? "hurt" : "unhurt"} · AC {e.ac}
                  </span>
                </div>
                {e.status === "active" && <div className="mt-1"><HpBar hp={e.hp} max={e.maxHp} tone={bloodied ? "bg-orange-500" : "bg-red-500"} /></div>}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        {!ended && o && (
          <div className="space-y-2" data-testid="skirmish-actions">
            {o.bonusActions.length + o.spells.filter((x) => x.bonusAction).length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[11px] text-slate-400 w-full">Bonus action (optional)</span>
                {o.bonusActions.map((b) => (
                  <button key={b} onClick={() => setBonus(bonus === b ? null : b)}
                    className={`px-2 py-0.5 text-[11px] rounded border ${bonus === b ? "border-amber-400 bg-amber-900/40 text-amber-200" : "border-slate-600 text-slate-300"}`}>
                    {BONUS_LABEL[b] ?? b}
                  </button>
                ))}
                {o.spells.filter((x) => x.bonusAction && (x.level === 0 || o.slots.length)).map((sp) => (
                  <button key={sp.id} title={sp.text} onClick={() => setBonus(bonus === `spell:${sp.id}` ? null : `spell:${sp.id}`)}
                    className={`px-2 py-0.5 text-[11px] rounded border ${bonus === `spell:${sp.id}` ? "border-violet-400 bg-violet-900/40 text-violet-200" : "border-slate-600 text-slate-300"}`}>
                    {sp.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
              {o.recklessAttack && <label className="flex items-center gap-1"><input type="checkbox" checked={reckless} onChange={(e) => setReckless(e.target.checked)} /> Reckless Attack</label>}
              {!!o.actionSurge && <label className="flex items-center gap-1"><input type="checkbox" checked={surge} onChange={(e) => setSurge(e.target.checked)} /> Action Surge ({o.actionSurge})</label>}
              {o.smiteSlots.length > 0 && (
                <label className="flex items-center gap-1">Smite on hit:
                  <select className="bg-slate-900 border border-slate-700 rounded px-1" value={smite ?? ""} onChange={(e) => setSmite(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">no</option>
                    {o.smiteSlots.map((l) => <option key={l} value={l}>level {l}</option>)}
                  </select>
                </label>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" className="bg-red-700 hover:bg-red-600 text-white col-span-2" disabled={busy || !target} onClick={() => go("attack")} data-testid="skirmish-attack">
                {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Swords className="h-4 w-4 mr-1" />}
                Attack {target?.name ?? ""} ({o.weapon}{o.attacksPerAction > 1 ? ` x${o.attacksPerAction}` : ""})
              </Button>
              {o.spells.filter((x) => !x.bonusAction).map((sp) => {
                const usable = sp.level === 0 || o.slots.some((l) => l >= sp.level);
                const lvl = slot[sp.id] ?? o.slots.find((l) => l >= sp.level) ?? sp.level;
                return (
                  <div key={sp.id} className="flex gap-1">
                    <Button size="sm" variant="outline" className="flex-1 border-violet-500/50 text-violet-200" disabled={busy || !usable} title={sp.text}
                      onClick={() => go("spell", { spellId: sp.id, slotLevel: sp.level ? lvl : null })} data-testid={`skirmish-spell-${sp.id}`}>
                      <Sparkles className="h-3.5 w-3.5 mr-1" />{sp.name}
                    </Button>
                    {sp.level > 0 && o.slots.filter((l) => l >= sp.level).length > 1 && (
                      <select className="bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-300" value={lvl} onChange={(e) => setSlot({ ...slot, [sp.id]: Number(e.target.value) })}>
                        {o.slots.filter((l) => l >= sp.level).map((l) => <option key={l} value={l}>L{l}</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
              <Button size="sm" variant="outline" className="border-slate-600 text-slate-200" disabled={busy} onClick={() => go("dodge")} title="Attacks against you have disadvantage until your next turn.">
                <Shield className="h-3.5 w-3.5 mr-1" />Dodge
              </Button>
              <Button size="sm" variant="outline" className="border-slate-600 text-slate-200" disabled={busy} onClick={() => go("hide")} title="Stealth against their best passive Perception. Hidden: your next attack has advantage, theirs have disadvantage.">
                <Eye className="h-3.5 w-3.5 mr-1" />Hide
              </Button>
              <Button size="sm" variant="outline" className="border-sky-600/60 text-sky-200" disabled={busy} onClick={() => go("disengage", { flee: true })} title="Disengage and leave: no opportunity attacks, but anything faster than you can follow.">
                <Footprints className="h-3.5 w-3.5 mr-1" />Flee (Disengage)
              </Button>
              <Button size="sm" variant="outline" className="border-sky-600/60 text-sky-200" disabled={busy} onClick={() => go("dash", { flee: true })} title="Dash away at double speed, but everything next to you gets an opportunity attack.">
                <Wind className="h-3.5 w-3.5 mr-1" />Flee (Dash)
              </Button>
            </div>
          </div>
        )}

        {ended && (
          <div className="space-y-2">
            {s.status === "won" && <p className="text-sm text-emerald-300 flex items-center gap-1"><Trophy className="h-4 w-4" /> {s.xpEarned} XP earned.</p>}
            {view?.payoff?.text && <p className="text-sm text-amber-200">{view.payoff.text}</p>}
            {s.status === "lost" && <p className="text-sm text-red-300">You come to later with 1 hit point. Rest before you go looking for more trouble.</p>}
            <Button size="sm" className="w-full" onClick={() => onDone({ status: s.status, xp: s.xpEarned, payoff: view?.payoff, resolution: view?.resolution, run: view?.run })} data-testid="skirmish-continue">
              Continue
            </Button>
          </div>
        )}

        {/* Log */}
        <div className="space-y-1 max-h-72 overflow-y-auto pr-1" data-testid="skirmish-log">
          {lastLog.map((l, i) => {
            const idx = s.log.length - 1 - i;
            const isOpen = open[idx] ?? i < 2;
            return (
              <div key={idx} className={`text-xs rounded px-2 py-1 border ${l.who === "pc" ? "border-emerald-800/60 bg-emerald-950/30" : l.who === "enemy" ? "border-red-900/60 bg-red-950/20" : "border-slate-800 bg-slate-950/40"}`}>
                <button className="flex items-start gap-1 w-full text-left" onClick={() => setOpen({ ...open, [idx]: !isOpen })}>
                  {l.detail?.length ? (isOpen ? <ChevronDown className="h-3 w-3 mt-0.5 shrink-0" /> : <ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />) : <span className="w-3" />}
                  <span className="text-slate-200">{l.text}</span>
                </button>
                {isOpen && l.detail?.map((d, j) => (
                  <div key={j} className="flex gap-1 pl-4 mt-0.5 font-mono text-[10px] text-slate-400"><Dices className="h-3 w-3 shrink-0" />{d}</div>
                ))}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default SkirmishPanel;
