/**
 * "Round 2 · Your turn" (engagement spec 4.3; design PDF Combat screen): the
 * objective, enemies with AC and morale, the action economy (Action, Bonus,
 * Move, Reaction), the attack with its real numbers (+5 to hit vs AC 12,
 * 1d6 + 3 + Sneak Attack 2d6), class bonus actions with uses left, and why a
 * feature applies. Resolved on the server; the signed result submits the turn.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flag, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { audioEngine } from "@/lib/audio/engine";

export interface ClassTurnResult {
  ok: boolean;
  summary: string;
  breakdown: string[];
  targetName: string | null;
  hit: boolean;
  damageTotal: number;
  token: string;
  rulesFired: { id: string; name: string; body: string; count: number }[];
}

interface Options {
  weapon: { name: string; finesse: boolean; ranged: boolean; damageDice: string; damageType: string };
  attacksPerAction: number;
  bonusActions: { id: string; usesLeft: number | null }[];
  actionSurge: number | null;
  recklessAttack: boolean;
  smiteSlots: number[];
  sneakAttack: { dice: string; eligible: boolean; reason: string } | null;
  raging: { roundsLeft: number; damageBonus: number } | null;
  hidden: boolean;
  enemies: { name: string; ac?: number; currentHp?: number; maxHp?: number; status?: string; zone?: string }[];
  encounter: { objective: { kind: string; description: string; rounds?: number }; round: number } | null;
}

const BONUS_LABEL: Record<string, string> = {
  second_wind: "Second Wind", rage: "Rage", cunning_dash: "Dash", cunning_disengage: "Disengage", cunning_hide: "Hide",
  flurry_of_blows: "Flurry of Blows", patient_defense: "Patient Defense", step_of_the_wind: "Step of the Wind",
  bardic_inspiration: "Bardic Inspiration", offhand_attack: "Off-hand attack",
};

export function CombatTurnPanel({
  campaignId,
  characterId,
  disabled,
  attackBonus,
  abilityMod,
  onResolved,
}: {
  campaignId: number;
  characterId?: number | null;
  disabled?: boolean;
  attackBonus?: number;
  abilityMod?: number;
  onResolved: (actionText: string, r: ClassTurnResult) => void;
}) {
  const qs = characterId ? `?characterId=${characterId}` : "";
  const { data: opt } = useQuery<Options>({ queryKey: [`/api/campaigns/${campaignId}/combat-action/options${qs}`], staleTime: 0 });
  const [target, setTarget] = useState<string | null>(null);
  const [bonus, setBonus] = useState<string | null>(null);
  const [reckless, setReckless] = useState(false);
  const [surge, setSurge] = useState(false);
  const [smite, setSmite] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!opt) return null;

  const live = opt.enemies.filter((e) => !["defeated", "fled", "surrendered", "evaded"].includes(String(e.status)) && (e.currentHp ?? 1) > 0);
  const tgt = live.find((e) => e.name === target) ?? live[0];
  const roundsLeft = opt.encounter?.objective.rounds ? Math.max(0, opt.encounter.objective.rounds - opt.encounter.round) : null;
  const bonusSneakWithHide = bonus === "cunning_hide";

  async function act(action: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/combat-action`, {
        action, bonus, targetName: tgt?.name, reckless, actionSurge: surge, smiteSlot: smite, characterId,
      });
      const body = (await res.json()) as ClassTurnResult;
      audioEngine.playSfx(body.hit ? "hit" : action === "attack" ? "miss" : "dice");
      const text = action === "attack" ? `Attack ${tgt?.name ?? "the enemy"} with ${opt!.weapon.name}${bonus ? ` (${BONUS_LABEL[bonus]})` : ""}` : `${action.charAt(0).toUpperCase()}${action.slice(1)}${bonus ? ` and ${BONUS_LABEL[bonus]}` : ""}`;
      onResolved(text, body);
      setBonus(null); setReckless(false); setSurge(false); setSmite(null);
    } catch (e) {
      setError((e as Error)?.message?.replace(/^\d+:\s*/, "") || "Couldn't resolve your turn.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3 space-y-3 rounded-xl border border-stone-700 bg-stone-950/80 p-3 text-stone-100" data-testid="combat-turn-panel">
      {opt.encounter && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-600/60 bg-amber-950/30 p-2 text-sm">
          <Flag className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <span><b>Objective:</b> {opt.encounter.objective.description}{roundsLeft != null && <span className="text-amber-300"> {roundsLeft} round{roundsLeft === 1 ? "" : "s"} left.</span>}</span>
        </div>
      )}

      <div className="space-y-1.5">
        {live.map((e) => {
          const pct = e.maxHp ? Math.max(0, Math.min(100, Math.round(((e.currentHp ?? 0) / e.maxHp) * 100))) : 100;
          const selected = e.name === tgt?.name;
          return (
            <button key={e.name} type="button" onClick={() => setTarget(e.name)}
              className={`w-full rounded-lg border p-2 text-left ${selected ? "border-red-500" : "border-stone-700"} bg-stone-900`}>
              <div className="flex justify-between text-sm"><span className="font-semibold">{e.name}{e.zone ? ` · ${e.zone}` : ""}</span><span className="text-stone-400">AC {e.ac ?? "?"}</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-stone-800"><div className="h-1.5 rounded-full bg-red-500" style={{ width: `${pct}%` }} /></div>
              {pct <= 50 && <p className="mt-1 text-xs text-stone-400">Bloodied · may flee or surrender if another falls</p>}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
        {[["Action", surge ? "2 (Surge)" : "ready"], ["Bonus", bonus ? BONUS_LABEL[bonus] : "ready"], ["Move", "30 ft"], ["Reaction", "held"]].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-stone-700 bg-stone-900 py-1.5"><div className="font-semibold">{k}</div><div className="text-stone-400">{v}</div></div>
        ))}
      </div>

      {opt.bonusActions.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-stone-400">Bonus action</p>
          <div className="flex flex-wrap gap-1.5">
            {opt.bonusActions.map((b) => (
              <Button key={b.id} size="sm" variant={bonus === b.id ? "default" : "outline"} disabled={b.usesLeft === 0}
                onClick={() => setBonus(bonus === b.id ? null : b.id)} className="h-8">
                {BONUS_LABEL[b.id] ?? b.id}{b.usesLeft != null ? ` (${b.usesLeft})` : ""}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-stone-400">Action</p>
        <button type="button" disabled={disabled || busy || !tgt} onClick={() => act("attack")} data-testid="combat-attack"
          className="w-full rounded-xl border-2 border-amber-500 bg-stone-900 p-3 text-left disabled:opacity-50">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold"><Swords className="mr-1 inline h-4 w-4" />Attack with {opt.weapon.name}{opt.attacksPerAction > 1 ? ` ×${opt.attacksPerAction * (surge ? 2 : 1)}` : surge ? " ×2" : ""}</span>
            {attackBonus != null && tgt && <span className="text-sm text-amber-300">{attackBonus >= 0 ? "+" : ""}{attackBonus} to hit vs AC {tgt.ac ?? "?"}</span>}
          </div>
          <p className="text-sm text-stone-300">
            {opt.weapon.damageDice}{abilityMod != null ? ` ${abilityMod >= 0 ? "+" : "−"} ${Math.abs(abilityMod)}` : ""} {opt.weapon.damageType}
            {opt.raging && <> <b className="text-amber-300">+ {opt.raging.damageBonus} rage</b></>}
            {opt.sneakAttack && (opt.sneakAttack.eligible || bonusSneakWithHide) && <> <b className="text-amber-300">+ Sneak Attack {opt.sneakAttack.dice}</b> {bonusSneakWithHide && !opt.sneakAttack.eligible ? "(if your Hide succeeds)" : `(${opt.sneakAttack.reason.toLowerCase()})`}</>}
          </p>
        </button>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {["dodge", "disengage", "dash", "help", "shove"].map((a) => (
            <Button key={a} size="sm" variant="outline" className="h-8 capitalize" disabled={disabled || busy} onClick={() => act(a)}>{a}</Button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-sm text-stone-300">
          {opt.recklessAttack && <label className="flex items-center gap-1"><input type="checkbox" checked={reckless} onChange={(e) => setReckless(e.target.checked)} />Reckless Attack</label>}
          {opt.actionSurge != null && <label className={`flex items-center gap-1 ${opt.actionSurge ? "" : "opacity-40"}`}><input type="checkbox" disabled={!opt.actionSurge} checked={surge} onChange={(e) => setSurge(e.target.checked)} />Action Surge ({opt.actionSurge})</label>}
          {opt.smiteSlots.length > 0 && (
            <label className="flex items-center gap-1">Divine Smite on a hit:
              <select className="rounded bg-stone-800 px-1" value={smite ?? ""} onChange={(e) => setSmite(e.target.value ? Number(e.target.value) : null)}>
                <option value="">no</option>
                {opt.smiteSlots.map((s) => <option key={s} value={s}>level {s} slot ({Math.min(5, s + 1)}d8)</option>)}
              </select>
            </label>
          )}
        </div>
      </div>

      {opt.sneakAttack?.eligible && (
        <div className="rounded-lg border border-purple-800/60 bg-purple-950/40 p-2 text-sm text-purple-100">
          <b>Why Sneak Attack works here:</b> once per turn, a Rogue adds extra damage with a finesse or ranged weapon if they have advantage, or if an ally is within 5 feet of the target and they don't have disadvantage. {opt.sneakAttack.reason}
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

/** Pie dial for a threat clock (design PDF: "Guards stirring 4 of 6"). */
export function ClockDial({ name, filled, segments }: { name: string; filled: number; segments: number }) {
  const r = 14;
  const slices = Array.from({ length: segments }, (_, i) => {
    const a0 = (i / segments) * 2 * Math.PI - Math.PI / 2;
    const a1 = ((i + 1) / segments) * 2 * Math.PI - Math.PI / 2;
    const d = `M16 16 L${16 + r * Math.cos(a0)} ${16 + r * Math.sin(a0)} A${r} ${r} 0 0 1 ${16 + r * Math.cos(a1)} ${16 + r * Math.sin(a1)} Z`;
    return <path key={i} d={d} className={i < filled ? "fill-orange-500" : "fill-stone-800"} stroke="currentColor" strokeWidth={0.75} />;
  });
  return (
    <div className="flex items-center gap-2 text-stone-300" data-testid="clock-dial" title={`${name}: ${filled} of ${segments}`}>
      <svg viewBox="0 0 32 32" className="h-7 w-7 text-stone-950">{slices}</svg>
      <div className="leading-tight"><div className="text-xs font-semibold text-stone-200">{name}</div><div className="text-xs text-stone-400">{filled} of {segments}</div></div>
    </div>
  );
}
