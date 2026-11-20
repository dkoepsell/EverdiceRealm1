/**
 * What the rules did this turn, shown with the narrative (engagement spec
 * Phase 2; design PDF "The Ferry Landing at Dusk"): the scene's beat chip, a
 * passive-check notice ("Your sharp eye (Passive Insight 14)"), the cost of a
 * failed roll, Inspiration earned, and "The rule underneath" for rules the
 * player is still learning (auto-expanded the first few times each fires).
 */
import { useState } from "react";
import { Eye, Star, AlertTriangle, ChevronRight } from "lucide-react";
import { AUTO_EXPAND_UNTIL } from "@shared/rules/ruleExplainers";

export interface TurnNotesData {
  beat?: string | null;
  passiveNoticed?: { skill: string; score: number; dc: number; text: string; breakdown: string } | null;
  inspirationAwarded?: string | null;
  failureCost?: { kind: string; detail: string } | null;
  rulesFired?: { id: string; name: string; body: string; count: number; detail?: string }[];
  clockFired?: string | null;
  encounterNotes?: string[];
}

const BEAT_LABEL: Record<string, string> = {
  momentum: "Momentum",
  open_question: "Open question",
  conversation: "Conversation",
  discovery: "Discovery",
  quiet: "Quiet moment",
  pressure: "Pressure",
  combat: "Combat",
};

const PASSIVE_FLAVOR: Record<string, string> = {
  perception: "Your keen eye",
  insight: "Your sharp eye",
  investigation: "Your careful mind",
};

export function BeatChip({ beat, returning }: { beat?: string | null; returning?: string | null }) {
  if (!beat && !returning) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-2" data-testid="beat-chip">
      {beat && BEAT_LABEL[beat] && (
        <span className="rounded-md bg-amber-500 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-stone-950">{BEAT_LABEL[beat]}</span>
      )}
      {returning && (
        <span className="rounded-md bg-purple-900/60 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-purple-200">Returning: {returning}</span>
      )}
    </div>
  );
}

export function RuleUnderneath({ rule, forceOpen }: { rule: NonNullable<TurnNotesData["rulesFired"]>[number]; forceOpen?: boolean }) {
  const [open, setOpen] = useState(forceOpen ?? rule.count <= AUTO_EXPAND_UNTIL);
  return (
    <div className="rounded-xl border border-stone-700 bg-stone-900/70" data-testid={`rule-underneath-${rule.id}`}>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-amber-300">
        <ChevronRight className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} />
        The rule underneath: {rule.name.toLowerCase()}
      </button>
      {open && (
        <div className="space-y-1 px-3 pb-3 text-sm text-stone-300">
          {rule.detail && <p className="font-medium text-stone-200">{rule.detail}</p>}
          <p>{rule.body}</p>
        </div>
      )}
    </div>
  );
}

export function TurnNotes({ notes, showRules = true }: { notes?: TurnNotesData | null; showRules?: boolean }) {
  if (!notes) return null;
  const { passiveNoticed, failureCost, inspirationAwarded, rulesFired, clockFired, encounterNotes } = notes;
  const passiveRule = rulesFired?.find((r) => r.id === "passive_check");
  const otherRules = (rulesFired ?? []).filter((r) => r.id !== "passive_check");
  if (!passiveNoticed && !failureCost && !inspirationAwarded && !clockFired && !encounterNotes?.length && !(showRules && otherRules.length)) return null;
  return (
    <div className="mt-3 space-y-2" data-testid="turn-notes">
      {passiveNoticed && (
        <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/40 p-3 text-sm text-emerald-50" data-testid="passive-chip">
          <p>
            <Eye className="mr-1 inline h-4 w-4 text-emerald-300" />
            <b>
              {PASSIVE_FLAVOR[passiveNoticed.skill] ?? "You notice"} (Passive {passiveNoticed.skill.charAt(0).toUpperCase() + passiveNoticed.skill.slice(1)} {passiveNoticed.score}):
            </b>{" "}
            {passiveNoticed.text}
          </p>
          {showRules && passiveRule && (
            <div className="mt-2">
              <RuleUnderneath rule={{ ...passiveRule, detail: passiveNoticed.breakdown }} />
            </div>
          )}
        </div>
      )}
      {clockFired && (
        <div className="rounded-xl border border-orange-700/60 bg-orange-950/40 p-3 text-sm text-orange-100" data-testid="clock-fired">
          <b>The clock ran out:</b> {clockFired}.
        </div>
      )}
      {encounterNotes?.map((n) => (
        <p key={n} className="text-sm text-amber-200" data-testid="encounter-note">{n}</p>
      ))}
      {failureCost && (
        <div className="flex items-start gap-2 rounded-xl border border-red-800/50 bg-red-950/30 p-3 text-sm text-red-100" data-testid="failure-cost">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          <span><b>The cost:</b> {failureCost.detail}</span>
        </div>
      )}
      {inspirationAwarded && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-600/50 bg-amber-950/30 p-3 text-sm text-amber-100" data-testid="inspiration-awarded">
          <Star className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <span><b>Inspiration earned:</b> {inspirationAwarded} Spend it for advantage on a roll.</span>
        </div>
      )}
      {showRules && otherRules.map((r) => <RuleUnderneath key={r.id} rule={r} />)}
    </div>
  );
}
