import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { parseOnboardingState, hasSeenTip } from "@shared/onboarding";
import { Lightbulb, X, ArrowRight } from "lucide-react";

/**
 * A gentle, one-time contextual coach-mark shown inside play. It teaches at the
 * moment of friction and then gets out of the way: once dismissed (or its
 * "learn more" link is followed) the tip is recorded in the user's
 * onboardingState.seenTips and never nags again.
 *
 * The PARENT decides WHEN to render this (e.g. tutorial campaign + the DM's
 * scaffolding signalled the player could use a hand). This component only
 * handles presentation + remembering that it's been seen.
 */
export interface CoachTipProps {
  /** Stable id used to remember dismissal, e.g. "play.stuck". */
  tipId: string;
  /** Short, friendly message. */
  message: string;
  /** Optional deep link into the Learn Center, e.g. "/learn?tab=practice". */
  learnHref?: string;
  learnLabel?: string;
}

export function CoachTip({ tipId, message, learnHref, learnLabel = "Learn how" }: CoachTipProps) {
  const { user } = useAuth();
  const alreadySeen = hasSeenTip(user?.onboardingState, tipId);
  const [dismissed, setDismissed] = useState(false);

  const persist = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", "/api/user/onboarding", { seenTips: [tipId] });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/user"] }),
  });

  if (alreadySeen || dismissed) return null;

  const remember = () => {
    setDismissed(true);
    persist.mutate();
  };

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100 my-2">
      <Lightbulb className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
      <div className="flex-1 min-w-0">
        <span>{message}</span>
        {learnHref && (
          <Link
            href={learnHref}
            onClick={remember}
            className="inline-flex items-center gap-1 ml-2 font-medium text-amber-300 hover:text-amber-200 underline underline-offset-2"
          >
            {learnLabel} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <button
        onClick={remember}
        aria-label="Dismiss tip"
        className="shrink-0 text-amber-300/60 hover:text-amber-200"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default CoachTip;

/** Convenience: read the current user's parsed onboarding state. */
export function useOnboardingState() {
  const { user } = useAuth();
  return parseOnboardingState(user?.onboardingState);
}
