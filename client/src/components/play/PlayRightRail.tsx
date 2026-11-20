/**
 * The right column of the desktop play screen (design PDF): who is here and
 * how they feel, open threads and reputation, a "Before you choose" note that
 * teaches how the table works, and Rules learned progress.
 */
import { useJournal } from "./Journal";

export function PlayRightRail({
  campaignId,
  companions,
  choices,
  inspired,
  serverChecks,
  showLedger,
  showRules,
}: {
  campaignId: number;
  companions: { name: string; role?: string | null }[];
  choices: any[];
  inspired: boolean;
  serverChecks: boolean;
  showLedger: boolean;
  showRules: boolean;
}) {
  const { data } = useJournal(campaignId, showLedger || showRules);
  const latest = data ? Math.max(0, ...data.people.map((p) => p.lastSeenTurn ?? 0)) : 0;
  const here = (data?.people ?? []).filter((p) => p.lastSeenTurn === latest && p.status === "alive").slice(0, 3);
  const rollChoice = choices.find((c) => c?.requiresDiceRoll && c?.skillType !== "attack");
  const talkChoices = choices.filter((c) => !c?.requiresDiceRoll).length;
  const skillName = rollChoice?.skillType ? String(rollChoice.skillType).replace(/_/g, " ").replace(/\b\w/g, (m: string) => m.toUpperCase()) : null;
  const helper = companions[0]?.name;

  return (
    <div className="space-y-3 text-[var(--ed-ink)]" data-testid="play-right-rail">
      {(here.length > 0 || companions.length > 0) && (
        <div className="ed-card p-3">
          <div className="ed-label mb-1.5">Here now</div>
          {here.map((p) => (
            <div key={p.id + p.name} className="mb-1.5">
              <div className="flex justify-between gap-2 text-sm">
                <b>{p.name}</b>
                <span className={p.attitude >= 1 ? "text-[var(--ed-teal)]" : p.attitude <= -1 ? "text-[var(--ed-rose)]" : "ed-muted"}>{p.attitudeLabel}</span>
              </div>
              {(p.want || p.promisesMade.length > 0) && (
                <p className="text-xs ed-muted">{[p.want && `Wants ${p.want}.`, p.promisesMade[p.promisesMade.length - 1]].filter(Boolean).join(" ")}</p>
              )}
            </div>
          ))}
          {companions.slice(0, 2).map((c) => (
            <div key={c.name} className="mb-1.5">
              <div className="flex justify-between gap-2 text-sm"><b>{c.name}</b><span className="text-[var(--ed-teal)]">Companion</span></div>
              <p className="text-xs ed-muted">Can take the Help action for you once this scene.</p>
            </div>
          ))}
        </div>
      )}

      {showLedger && data && (data.threads.length > 0 || data.reputation) && (
        <div className="ed-card p-3">
          <div className="ed-label mb-1.5">Open threads</div>
          {data.threads.slice(0, 4).map((t) => (
            <p key={t.id} className="flex items-start gap-2 py-0.5 text-sm">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${t.heat >= 2 ? "bg-[var(--ed-rose)]" : "bg-[var(--ed-gold)]"}`} />
              {t.summary}
            </p>
          ))}
          {data.reputation && <p className="mt-1 text-xs text-[var(--ed-violet-ink)]">Reputation: {data.reputation.word}.</p>}
        </div>
      )}

      {choices.length > 0 && (
        <div className="rounded-[0.875rem] border border-[#4a3a63] bg-[var(--ed-violet-bg)] p-3 text-sm text-[var(--ed-violet-ink)]" data-testid="before-you-choose">
          <div className="ed-label mb-1.5 !text-[var(--ed-violet-ink)]">Before you choose</div>
          {talkChoices > 0 && (
            <p className="mb-1.5 text-[var(--ed-ink)]"><b>Talking is free.</b> The DM only calls for a roll when the outcome is uncertain and failing would matter.</p>
          )}
          {rollChoice && serverChecks && (
            <p className="text-[var(--ed-ink)]">
              <b>{skillName ?? "The"} DC is hidden</b> until you roll, as at a real table.
              {(inspired || helper) && <> {inspired ? "Your Inspiration" : ""}{inspired && helper ? " or " : ""}{helper ? `${helper}'s Help` : ""} would give advantage.</>}
            </p>
          )}
          {!rollChoice && talkChoices === 0 && <p className="text-[var(--ed-ink)]">You can always type your own action instead of picking one.</p>}
        </div>
      )}

      {showRules && data && (
        <div className="ed-card p-3" data-testid="rules-learned-rail">
          <div className="mb-1.5 flex justify-between"><span className="ed-label">Rules learned</span><span className="text-xs ed-muted">{data.rulesLearned.length} of {data.rulesTotal}</span></div>
          <div className="mb-2 h-1.5 rounded-full bg-[var(--ed-line)]">
            <div className="h-1.5 rounded-full bg-[var(--ed-gold)]" style={{ width: `${Math.round((data.rulesLearned.length / Math.max(1, data.rulesTotal)) * 100)}%` }} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.rulesLearned.slice(0, 8).map((r, i) => (
              <span key={r.id} className={`rounded-md border px-2 py-0.5 text-xs ${i === 0 && r.count === 1 ? "border-[var(--ed-gold)] ed-gold" : "border-[var(--ed-line)]"}`}>{r.name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
