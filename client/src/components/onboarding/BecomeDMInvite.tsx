import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { parseOnboardingState } from "@shared/onboarding";
import { Crown, X, ArrowRight } from "lucide-react";

/**
 * Player -> DM on-ramp (Phase 4). A quiet, dismissible invitation for a player
 * who has tasted the game to graduate into running one. Links into the existing
 * DM Guide / DM Training Center rather than reinventing that content.
 *
 * Shows only once the player has some experience (parent decides, or via the
 * `force` prop) and hides permanently once dismissed or accepted
 * (onboardingState.dmInvited / dmStarted).
 */
export interface BecomeDMInviteProps {
  /** Render even if not yet flagged — e.g. inside the first-session wrap-up. */
  force?: boolean;
  className?: string;
}

export function BecomeDMInvite({ force = false, className = "" }: BecomeDMInviteProps) {
  const { user } = useAuth();
  const state = parseOnboardingState(user?.onboardingState);
  const [dismissed, setDismissed] = useState(false);

  const persist = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      await apiRequest("PATCH", "/api/user/onboarding", patch);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/user"] }),
  });

  // Already invited-and-dismissed, or already a DM — don't nag.
  if (!force && (state.dmInvited || state.dmStarted)) return null;
  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    persist.mutate({ dmInvited: true });
  };
  const accept = () => persist.mutate({ dmInvited: true, dmStarted: true });

  return (
    <div className={`relative rounded-xl border border-purple-400/40 bg-gradient-to-br from-purple-500/10 to-amber-500/5 p-4 ${className}`}>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-2 text-purple-300/50 hover:text-purple-200"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2 mb-1">
        <Crown className="h-5 w-5 text-purple-300" />
        <h3 className="font-semibold text-purple-100">Ready to run your own?</h3>
      </div>
      <p className="text-sm text-purple-100/70 mb-3">
        You've seen how a table comes alive. Learn to design and run adventures of your own — we'll
        teach you the craft, one step at a time.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/dm-guide"
          onClick={accept}
          className="inline-flex items-center gap-1 rounded-md bg-purple-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-400"
        >
          Learn to DM <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          href="/dm-toolkit"
          onClick={accept}
          className="inline-flex items-center gap-1 rounded-md border border-purple-400/40 px-3 py-1.5 text-sm font-medium text-purple-100 hover:bg-purple-500/10"
        >
          Open the DM Toolkit
        </Link>
      </div>
    </div>
  );
}

export default BecomeDMInvite;
