/**
 * "The DM calls for a roll" (engagement spec Phase 2; design PDF Roll screen).
 * Shows the real math (d20 + ability + proficiency vs DC), lets the player
 * spend Inspiration or ask a companion to Help (advantage), then rolls ON THE
 * SERVER. The DC stays hidden until the roll, as at a real table. The signed
 * token in the result is what the turn routes trust.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { audioEngine } from "@/lib/audio/engine";
import { RuleUnderneath } from "./TurnNotes";

export interface ServerRollResult {
  dice: number[];
  kept: number;
  mode: "normal" | "advantage" | "disadvantage";
  total: number;
  dc: number;
  dcLabel: string;
  success: boolean;
  natural20: boolean;
  natural1: boolean;
  description: string;
  modifier: { total: number; label: string; skill: string };
  advantageReasons: string[];
  disadvantageReasons: string[];
  token: string;
  rulesFired: { id: string; name: string; body: string; count: number; detail?: string }[];
}

interface Preview {
  label: string;
  modifier: { abilityMod: number; proficiency: number; proficient: boolean; expertise: boolean; total: number; ability: string };
  inspiration: boolean;
  inspirationSource: string | null;
  helper: string | null;
  advantageReasons: string[];
  disadvantageReasons: string[];
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export function RollDialog({
  open,
  campaignId,
  characterId,
  choice,
  onCancel,
  onResolved,
}: {
  open: boolean;
  campaignId: number;
  characterId?: number | null;
  choice: { text: string; skillType?: string; rollPurpose?: string; rollDC?: number } | null;
  onCancel: () => void;
  onResolved: (result: ServerRollResult) => void;
}) {
  const action = choice?.text ?? "";
  const skill = choice?.skillType || choice?.rollPurpose || "";
  const qs = new URLSearchParams({ action, skill, ...(choice?.rollDC ? { dc: String(choice.rollDC) } : {}), ...(characterId ? { characterId: String(characterId) } : {}) });
  const { data: preview } = useQuery<Preview>({
    queryKey: [`/api/campaigns/${campaignId}/roll-check/preview?${qs.toString()}`],
    enabled: open && !!choice,
    staleTime: 0,
  });
  const [useInspiration, setUseInspiration] = useState(false);
  const [useHelp, setUseHelp] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<ServerRollResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUseInspiration(false);
      setUseHelp(false);
      setResult(null);
      setError(null);
    }
  }, [open, action]);

  async function roll() {
    setRolling(true);
    setError(null);
    try {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/roll-check`, {
        action, skill, dc: choice?.rollDC, characterId, useInspiration, useHelp,
      });
      const body = (await res.json()) as ServerRollResult;
      audioEngine.playSfx(body.natural20 ? "diceCrit" : body.natural1 ? "diceFumble" : "dice");
      setResult(body);
    } catch (e) {
      setError((e as Error)?.message?.replace(/^\d+:\s*/, "") || "The roll failed. Try again.");
    } finally {
      setRolling(false);
    }
  }

  const m = preview?.modifier;
  const abilityName = m?.ability ? m.ability.charAt(0).toUpperCase() + m.ability.slice(1) : "Ability";
  const willHaveAdvantage = useInspiration || useHelp || (preview?.advantageReasons.length ?? 0) > 0;
  const willHaveDisadvantage = (preview?.disadvantageReasons.length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !rolling) (result ? onResolved(result) : onCancel()); }}>
      <DialogContent className="max-w-md bg-stone-950 border-stone-700 text-stone-100" data-testid="roll-dialog">
        <DialogHeader>
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">The DM calls for a roll</p>
          <DialogTitle className="font-serif text-2xl text-amber-100">{preview?.label ?? "Ability check"}</DialogTitle>
          <DialogDescription className="font-serif text-base text-stone-300">{action}</DialogDescription>
        </DialogHeader>

        {m && (
          <div className="flex items-center justify-between rounded-xl border border-stone-700 bg-stone-900 px-4 py-3 text-center" data-testid="roll-math">
            <div><div className="text-2xl font-bold">{result ? result.kept : "d20"}</div><div className="text-xs text-stone-400">{result && result.dice.length > 1 ? `kept of ${result.dice.join(" / ")}` : "the die"}</div></div>
            <span className="text-stone-500">{m.abilityMod >= 0 ? "+" : "−"}</span>
            <div><div className="text-2xl font-bold">{Math.abs(m.abilityMod)}</div><div className="text-xs text-stone-400">{abilityName}</div></div>
            {m.proficiency > 0 && (
              <>
                <span className="text-stone-500">+</span>
                <div><div className="text-2xl font-bold">{m.proficiency}</div><div className="text-xs text-stone-400">{m.expertise ? "Expertise" : m.proficient ? "Proficient" : "Jack of All Trades"}</div></div>
              </>
            )}
            <span className="text-stone-500">vs</span>
            <div><div className="text-2xl font-bold text-amber-300">{result ? result.dc : "?"}</div><div className="text-xs text-stone-400">{result ? `DC (${result.dcLabel})` : "DC hidden"}</div></div>
          </div>
        )}

        {!result && preview && (
          <div className="space-y-2">
            {preview.inspiration && (
              <button type="button" onClick={() => setUseInspiration(!useInspiration)} data-testid="spend-inspiration"
                className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left ${useInspiration ? "border-amber-500 bg-stone-800" : "border-stone-700 bg-stone-900"}`}>
                <Star className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                <div>
                  <div className="font-semibold">Spend Inspiration for advantage</div>
                  {preview.inspirationSource && <div className="text-sm text-stone-400">Earned by playing to: "{preview.inspirationSource}"</div>}
                </div>
              </button>
            )}
            {preview.helper && (
              <button type="button" onClick={() => setUseHelp(!useHelp)} data-testid="ask-help"
                className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left ${useHelp ? "border-emerald-500 bg-stone-800" : "border-stone-700 bg-stone-900"}`}>
                <Users className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                <div>
                  <div className="font-semibold">Ask {preview.helper} to help</div>
                  <div className="text-sm text-stone-400">{preview.helper} takes the Help action: you roll with advantage. Once per scene.</div>
                </div>
              </button>
            )}
            {preview.advantageReasons.map((r) => <p key={r} className="text-sm text-emerald-300">Advantage: {r}</p>)}
            {preview.disadvantageReasons.map((r) => <p key={r} className="text-sm text-red-300">Disadvantage: {r}</p>)}
            {willHaveAdvantage && willHaveDisadvantage && <p className="text-sm text-stone-400">Advantage and disadvantage cancel out: you'll roll one d20.</p>}
            {willHaveAdvantage && !willHaveDisadvantage && <p className="text-sm text-stone-400">You'll roll two d20s and keep the higher.</p>}
          </div>
        )}

        {result && (
          <div className="space-y-2 text-center">
            <p className={`font-serif text-2xl font-bold ${result.success ? "text-emerald-300" : "text-red-300"}`} data-testid="roll-outcome">
              {result.total} — {result.success ? "Success" : "Failure"}
            </p>
            <p className="text-sm text-stone-400">{result.description}</p>
            <div className="space-y-2 text-left">
              {result.rulesFired.filter((r) => r.id !== "ability_check" || r.count <= 3).map((r) => <RuleUnderneath key={r.id} rule={r} />)}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        {result ? (
          <Button className="w-full bg-purple-700 hover:bg-purple-600" onClick={() => onResolved(result)} data-testid="roll-continue">See what happens</Button>
        ) : (
          <Button className="w-full bg-purple-700 hover:bg-purple-600" disabled={rolling || !preview} onClick={roll} data-testid="roll-d20">
            {rolling ? "Rolling…" : willHaveAdvantage && !willHaveDisadvantage ? "Roll 2d20 (advantage)" : willHaveDisadvantage && !willHaveAdvantage ? "Roll 2d20 (disadvantage)" : "Roll d20"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
