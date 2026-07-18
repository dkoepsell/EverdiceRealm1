/**
 * Shape + helpers for `users.onboardingState` (jsonb).
 *
 * This single jsonb column backs the whole new-player journey so that NONE of
 * the onboarding / teaching / re-engagement features require a schema
 * migration (db:push is dangerous on this deploy — it can drop the session
 * table). Everything additive lives here.
 *
 * Shared by client and server; import from "@shared/onboarding".
 */

export type FunnelStep = "character" | "tone" | "playing" | "done";

export interface FunnelState {
  step: FunnelStep;
  startedAt?: string;
  completedAt?: string;
  characterId?: number;
  campaignId?: number;
  /** Chosen pregen archetype id + tone seed, for analytics. */
  archetype?: string;
  tone?: string;
}

export interface EmailState {
  /** User has opted out of gentle re-engagement email. */
  optOut?: boolean;
  /** Opaque token used for one-click unsubscribe links. */
  unsubscribeToken?: string;
  /** ISO timestamp of the last re-engagement email we sent. */
  lastReengagementAt?: string;
  /** How many re-engagement emails we've ever sent this user. */
  reengagementCount?: number;
}

export interface OnboardingState {
  /** First-run funnel progress. */
  funnel?: FunnelState;
  /** IDs of one-time contextual tips the user has seen/dismissed. */
  seenTips?: string[];
  /** User dismissed the in-play "need a hand?" coach-mark for good. */
  coachDismissed?: boolean;
  /** Email re-engagement prefs + throttling. */
  email?: EmailState;
  /** Player has been invited to try DMing (Phase 4 on-ramp). */
  dmInvited?: boolean;
  /** Player accepted the DM on-ramp. */
  dmStarted?: boolean;
}

/** Coerce an unknown jsonb value into a safe OnboardingState object. */
export function parseOnboardingState(raw: unknown): OnboardingState {
  if (!raw || typeof raw !== "object") return {};
  return raw as OnboardingState;
}

/** Shallow-merge a patch into a state, with one level of nesting for known objects. */
export function mergeOnboardingState(
  prev: OnboardingState | null | undefined,
  patch: Partial<OnboardingState>,
): OnboardingState {
  const base = parseOnboardingState(prev);
  const next: OnboardingState = { ...base, ...patch };
  if (patch.funnel) next.funnel = { ...base.funnel, ...patch.funnel } as FunnelState;
  if (patch.email) next.email = { ...base.email, ...patch.email };
  if (patch.seenTips) {
    // union, preserve order, dedupe
    next.seenTips = Array.from(new Set([...(base.seenTips ?? []), ...patch.seenTips]));
  }
  return next;
}

export function hasSeenTip(state: OnboardingState | null | undefined, tipId: string): boolean {
  return parseOnboardingState(state).seenTips?.includes(tipId) ?? false;
}
