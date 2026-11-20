/**
 * The play screen's top bar (design PDF, both play screens): campaign title in
 * small caps, "Chapter 2 of 3 · goal · Episode 4, about 12 minutes left",
 * threat-clock dials, and the Inspiration / Journal / rules controls.
 */
import type { ReactNode } from "react";
import { ClockDial } from "@/components/combat/CombatTurnPanel";

export interface HeaderClock { id: string; name: string; filled: number; segments: number }

export function PlayHeader({
  title,
  chapter,
  totalChapters,
  goal,
  episode,
  clocks,
  inspired,
  showRules,
  onToggleRules,
  actions,
}: {
  title: string;
  chapter: number;
  totalChapters: number;
  goal?: string | null;
  episode?: { number: number; minutesLeft: number } | null;
  clocks?: HeaderClock[];
  inspired?: boolean;
  showRules?: boolean | null;
  onToggleRules?: (v: boolean) => void;
  actions?: ReactNode;
}) {
  const live = (clocks ?? []).filter((c) => c.filled > 0);
  const sub = [
    `Chapter ${chapter} of ${totalChapters}`,
    goal ? goal : null,
    episode ? `Episode ${episode.number}, about ${episode.minutesLeft} minutes left` : null,
  ].filter(Boolean).join(" · ");
  return (
    <div id="story-chapter" className="ed-panel scroll-mt-24 px-4 py-3" data-testid="play-header">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="ed-title text-xl leading-tight sm:text-2xl">{title}</h2>
          <p className="text-sm ed-muted" data-testid="episode-info">{sub}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {inspired && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--ed-gold)] px-3 py-1 text-sm ed-gold" data-testid="inspired-badge" title="Spend Inspiration for advantage on a roll">
              ☆ Inspiration ready
            </span>
          )}
          {actions}
          {onToggleRules && showRules != null && (
            <label className="hidden cursor-pointer items-center gap-1.5 text-sm ed-muted sm:flex">
              <input type="checkbox" checked={showRules} onChange={(e) => onToggleRules(e.target.checked)} className="accent-[var(--ed-purple)]" />
              Show the rules underneath
            </label>
          )}
        </div>
      </div>
      {live.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-5 border-t border-[var(--ed-line)] pt-3" data-testid="clock-row">
          {live.map((c) => <ClockDial key={c.id} name={c.name} filled={c.filled} segments={c.segments} />)}
        </div>
      )}
      <div className="mt-3 flex gap-1" aria-label={`Chapter ${chapter} of ${totalChapters}`}>
        {Array.from({ length: totalChapters }).map((_, i) => (
          <div key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < chapter - 1 ? "var(--ed-gold)" : i === chapter - 1 ? "var(--ed-gold-soft)" : "var(--ed-line)" }} />
        ))}
      </div>
    </div>
  );
}
