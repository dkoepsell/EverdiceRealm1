/**
 * Level Up dialog (engagement spec Phase 1.3; design PDF "Thessaly reaches Level 4").
 * Walks only the steps that apply: Hit points → Ability scores (ASI levels) →
 * Subclass (at the class's subclass level) → What changed. The server rolls
 * the hit die and validates every choice; this component only collects them.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { audioEngine } from "@/lib/audio/engine";
import { ABILITY_ABBR, ABILITY_NAMES, type AbilityName } from "@shared/rules/abilities";
import type { AsiChoice, LevelUpPlan } from "@shared/rules/leveling";

interface LevelUpInfo {
  pending: LevelUpPlan | null;
  reason: string | null;
  character: {
    id: number;
    name: string;
    class: string;
    level: number;
    maxHitPoints: number;
    abilityScores: Record<AbilityName, number>;
  };
}

type Step = "hp" | "asi" | "subclass" | "changes";

const mod = (score: number) => Math.floor((score - 10) / 2);
const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

function reasonLabel(reason: string | null, from: number): string {
  if (!reason) return "Level up";
  if (reason.startsWith("chapter_gate")) {
    const ch = reason.split(":")[2];
    return ch ? `Milestone reached: Chapter ${ch} complete` : "Milestone reached";
  }
  if (reason.startsWith("campaign_complete")) return "Milestone reached: adventure complete";
  return `Enough experience for level ${from + 1}`;
}

export function LevelUpDialog({
  characterId,
  open,
  onOpenChange,
}: {
  characterId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useQuery<LevelUpInfo>({
    queryKey: [`/api/characters/${characterId}/level-up`],
    enabled: open && !!characterId,
    staleTime: 0,
  });
  const plan = data?.pending ?? null;
  const steps = useMemo<Step[]>(() => {
    if (!plan) return [];
    return ["hp", ...(plan.needsAsi ? (["asi"] as Step[]) : []), ...(plan.needsSubclass ? (["subclass"] as Step[]) : []), "changes"];
  }, [plan]);

  const [stepIdx, setStepIdx] = useState(0);
  const [hpMode, setHpMode] = useState<"average" | "roll">("average");
  const [asi, setAsi] = useState<AsiChoice | null>(null);
  const [asiPicks, setAsiPicks] = useState<AbilityName[]>([]);
  const [subclass, setSubclass] = useState<string | null>(null);
  const [result, setResult] = useState<{ gain: number; rolled: number | null; morePending: boolean } | null>(null);

  useEffect(() => {
    if (open) {
      setStepIdx(0);
      setHpMode("average");
      setAsi(null);
      setAsiPicks([]);
      setSubclass(null);
      setResult(null);
    }
  }, [open, plan?.toLevel]);

  const submit = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/characters/${characterId}/level-up`, {
        hpMode,
        ...(asi ? { asi } : {}),
        ...(subclass ? { subclass } : {}),
      });
      return res.json();
    },
    onSuccess: (body: any) => {
      if (body?.hp?.rolled != null) audioEngine.playSfx("dice");
      audioEngine.playSfx("reward");
      setResult({ gain: body?.character?.maxHitPoints - (data?.character.maxHitPoints ?? 0), rolled: body?.hp?.rolled ?? null, morePending: !!body?.morePending });
      // Character data is nested in several queries (character lists, campaign
      // participants, the level-up plan itself); refresh every one of them.
      queryClient.invalidateQueries({
        predicate: (q) => /\/characters|\/participants/.test(String(q.queryKey[0] ?? "")),
      });
    },
  });

  const step = steps[stepIdx];
  const scores = data?.character.abilityScores;

  function togglePick(a: AbilityName) {
    if (!scores) return;
    let next = asiPicks.includes(a) ? asiPicks.filter((x) => x !== a) : [...asiPicks, a];
    if (next.length > 2) next = next.slice(-2);
    setAsiPicks(next);
    if (next.length === 1 && scores[a] + 2 <= 20) setAsi({ type: "plus2", ability: next[0] });
    else if (next.length === 2) setAsi({ type: "plus1x2", abilities: [next[0], next[1]] });
    else setAsi(null);
  }
  const asiValid = !!asi;
  const canNext = step === "hp" || (step === "asi" && asiValid) || (step === "subclass" && !!subclass);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-stone-950 border-amber-700/40 text-stone-100" data-testid="level-up-dialog">
        {isLoading || !data ? (
          <div className="py-10 text-center text-stone-400">Loading…</div>
        ) : !plan ? (
          <div className="py-10 text-center text-stone-400">No level-up is waiting right now.</div>
        ) : result ? (
          <div className="space-y-4 py-2">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl text-amber-200">
                {data.character.name} is now level {plan.toLevel}
              </DialogTitle>
            </DialogHeader>
            <p className="text-stone-300">
              Max HP {data.character.maxHitPoints} → <span className="font-semibold text-amber-300">{data.character.maxHitPoints + result.gain}</span>
              {result.rolled != null && <> (you rolled a {result.rolled} on your d{plan.hitDie})</>}.
            </p>
            {result.morePending && <p className="text-amber-300">You have another level waiting.</p>}
            <Button className="w-full bg-purple-700 hover:bg-purple-600" onClick={() => (result.morePending ? setResult(null) : onOpenChange(false))}>
              {result.morePending ? "Next level" : "Back to the adventure"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <DialogHeader>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">{reasonLabel(data.reason, plan.fromLevel)}</p>
              <DialogTitle className="font-serif text-2xl text-amber-100">
                {data.character.name} reaches Level {plan.toLevel}
              </DialogTitle>
              <DialogDescription className="sr-only">Choose how your character grows this level.</DialogDescription>
            </DialogHeader>

            <div className="flex gap-2">
              {steps.map((s, i) => (
                <div key={s} className={`flex-1 rounded-md px-2 py-1 text-center text-xs font-semibold ${i === stepIdx ? "bg-amber-500 text-stone-950" : "bg-stone-800 text-stone-400"}`}>
                  {i + 1} · {{ hp: "Hit points", asi: "Ability scores", subclass: "Path", changes: "What changed" }[s]}
                </div>
              ))}
            </div>

            {step === "hp" && (
              <div className="space-y-3">
                <p className="font-serif text-lg text-stone-200">
                  Each level, a {plan.className} gains one Hit Die (d{plan.hitDie}) of hit points, plus your Constitution modifier ({signed(plan.conMod)}).
                </p>
                <button type="button" onClick={() => setHpMode("average")} className={`w-full rounded-xl border p-3 text-left ${hpMode === "average" ? "border-amber-500 bg-stone-800" : "border-stone-700 bg-stone-900"}`}>
                  <div className="font-semibold">Take the average: {plan.hitDie / 2 + 1} {signed(plan.conMod)} = {plan.averageGain} HP</div>
                  <div className="text-sm text-stone-400">Steady and safe. Most tables allow this.</div>
                </button>
                <button type="button" onClick={() => setHpMode("roll")} className={`w-full rounded-xl border p-3 text-left ${hpMode === "roll" ? "border-amber-500 bg-stone-800" : "border-stone-700 bg-stone-900"}`}>
                  <div className="font-semibold">Roll the d{plan.hitDie} {signed(plan.conMod)}</div>
                  <div className="text-sm text-stone-400">
                    Could be {Math.max(1, 1 + plan.conMod)}, could be {plan.hitDie + plan.conMod}. Your call.
                  </div>
                </button>
                {hpMode === "average" && (
                  <p className="text-stone-300">
                    Max HP: {data.character.maxHitPoints} → <span className="font-semibold text-amber-300">{data.character.maxHitPoints + plan.averageGain}</span>
                  </p>
                )}
                {plan.proficiencyBonus.to > plan.proficiencyBonus.from && (
                  <p className="text-sm text-emerald-300">Your proficiency bonus rises to +{plan.proficiencyBonus.to}.</p>
                )}
              </div>
            )}

            {step === "asi" && scores && (
              <div className="space-y-3">
                <p className="font-serif text-lg text-stone-200">
                  Ability Score Improvement: raise one score by 2, or two scores by 1 each. No score can go above 20.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {ABILITY_NAMES.map((a) => {
                    const picked = asiPicks.includes(a);
                    const bump = asi?.type === "plus2" && asi.ability === a ? 2 : picked ? 1 : 0;
                    const after = scores[a] + bump;
                    return (
                      <button key={a} type="button" onClick={() => togglePick(a)} disabled={scores[a] >= 20}
                        className={`rounded-lg border p-2 text-center ${picked ? "border-amber-500 bg-stone-800" : "border-stone-700 bg-stone-900"} disabled:opacity-40`}>
                        <div className="text-xs text-stone-400">{ABILITY_ABBR[a]}</div>
                        <div className="font-semibold">{scores[a]}{bump ? <span className="text-amber-300"> → {after}</span> : null}</div>
                        <div className="text-xs text-stone-400">{signed(mod(after))}</div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-sm text-stone-400">Tap one ability for +2, or two for +1 each. An odd score becoming even raises its modifier.</p>
              </div>
            )}

            {step === "subclass" && plan.subclassOption && (
              <div className="space-y-3">
                <p className="font-serif text-lg text-stone-200">Choose your {plan.subclassOption.label}.</p>
                <button type="button" onClick={() => setSubclass(plan.subclassOption!.id)}
                  className={`w-full rounded-xl border p-3 text-left ${subclass ? "border-amber-500 bg-stone-800" : "border-stone-700 bg-stone-900"}`}>
                  <div className="font-semibold">{plan.subclassOption.name}</div>
                  <div className="text-sm text-stone-400">{plan.subclassOption.pitch}</div>
                </button>
                <p className="text-xs text-stone-500">Everdice uses the subclasses in the free 5e System Reference Document.</p>
              </div>
            )}

            {step === "changes" && (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {plan.newFeatures.length === 0 ? (
                  <p className="text-stone-400">
                    {plan.beyondEncodedData ? "Your class's higher-level features aren't in Everdice yet. You still gain hit points and proficiency." : "No new class features this level, but you're tougher than before."}
                  </p>
                ) : (
                  plan.newFeatures.map((f) => (
                    <div key={f.id} className="rounded-xl border border-stone-700 bg-stone-900 p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold text-amber-200">{f.name}</span>
                        <span className="text-xs text-stone-400">{f.improves ? "improves" : { action: "action", bonusAction: "bonus action", reaction: "reaction", passive: "always on", resource: "resource" }[f.kind]}</span>
                      </div>
                      <p className="text-sm text-stone-300">{f.summary}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {submit.isError && (
              <p className="text-sm text-red-400">{(submit.error as Error)?.message?.replace(/^\d+:\s*/, "") || "Couldn't apply the level-up."}</p>
            )}

            <div className="flex gap-2">
              {stepIdx > 0 && (
                <Button variant="outline" className="flex-1" onClick={() => setStepIdx(stepIdx - 1)}>Back</Button>
              )}
              {step !== "changes" ? (
                <Button className="flex-1 bg-purple-700 hover:bg-purple-600" disabled={!canNext} onClick={() => setStepIdx(stepIdx + 1)}>Next</Button>
              ) : (
                <Button className="flex-1 bg-purple-700 hover:bg-purple-600" disabled={submit.isPending} onClick={() => submit.mutate()} data-testid="level-up-confirm">
                  {submit.isPending ? "Applying…" : hpMode === "roll" ? `Roll d${plan.hitDie} and level up` : "Level up"}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Glowing button shown wherever a character with a pending level-up appears. */
export function LevelUpButton({ characterId, pendingLevelUp, className = "" }: { characterId: number; pendingLevelUp: unknown; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!pendingLevelUp) return null;
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} data-testid="level-up-button"
        className={`animate-pulse bg-amber-500 font-semibold text-stone-950 shadow-[0_0_12px_rgba(245,158,11,0.6)] hover:bg-amber-400 ${className}`}>
        ★ Level up
      </Button>
      <LevelUpDialog characterId={characterId} open={open} onOpenChange={setOpen} />
    </>
  );
}
