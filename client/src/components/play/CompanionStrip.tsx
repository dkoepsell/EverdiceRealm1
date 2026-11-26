/**
 * Who's travelling with you (companions spec): each companion's mood toward
 * the player (their approval, as a 5e attitude) and a "Talk to" button that
 * starts a conversation with them. Reads storyState.companionBonds.
 */
import { MessageCircle } from "lucide-react";
import { attitudeFromPoints, moodFromPoints } from "@shared/companionMood";

interface Bond { points: number; left?: boolean }

const MOOD_STYLE: Record<number, string> = {
  3: "bg-emerald-900/60 text-emerald-200 border-emerald-700",
  2: "bg-emerald-900/40 text-emerald-200 border-emerald-800",
  1: "bg-sky-900/40 text-sky-200 border-sky-800",
  0: "bg-stone-800 text-stone-200 border-stone-600",
  [-1]: "bg-amber-900/40 text-amber-200 border-amber-800",
  [-2]: "bg-orange-900/50 text-orange-200 border-orange-800",
  [-3]: "bg-red-900/60 text-red-200 border-red-800",
};

export function CompanionStrip({
  bonds,
  moment,
  disabled,
  onTalk,
}: {
  bonds?: Record<string, Bond> | null;
  moment?: string | null;
  disabled?: boolean;
  onTalk: (name: string) => void;
}) {
  const names = Object.entries(bonds ?? {}).filter(([, b]) => b && !b.left);
  if (!names.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2" data-testid="companion-strip" aria-label="Your companions">
      {names.map(([name, b]) => {
        const a = attitudeFromPoints(Number(b.points) || 0);
        return (
          <div key={name} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm ${MOOD_STYLE[a]} ${moment === name ? "ring-2 ring-amber-400" : ""}`}>
            <span className="font-semibold">{name}</span>
            <span className="text-xs opacity-90">{moodFromPoints(Number(b.points) || 0)}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onTalk(name)}
              className="ml-1 inline-flex min-h-[32px] items-center gap-1 rounded-md bg-black/25 px-2 text-xs font-medium hover:bg-black/40 disabled:opacity-50"
              aria-label={`Talk to ${name}`}
              data-testid={`talk-${name}`}
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Talk
            </button>
          </div>
        );
      })}
    </div>
  );
}
