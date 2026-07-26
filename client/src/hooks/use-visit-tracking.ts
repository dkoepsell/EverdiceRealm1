import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

/**
 * Pageview tracking that works for logged-OUT visitors.
 *
 * The pre-existing analytics path can't do this: `user_activity_events.user_id`
 * is NOT NULL and both ingest routes sit behind `isAuthenticated`, so anonymous
 * traffic — nearly everyone whose arrival we want to attribute — 401s. This
 * posts to the public /api/analytics/visit instead.
 *
 * Privacy: no IP is sent or stored. The two identifiers are random values this
 * module generates; they scope a browser session, and die with sessionStorage.
 */

const SESSION_KEY = "everdice_visit_session";
const ATTRIBUTION_KEY = "everdice_visit_attribution";

interface Attribution {
  referrerHost: string | null;
  referrerUrl: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  landingPath: string;
}

function randomToken(): string {
  // crypto.randomUUID needs a secure context; Math.random is a fine fallback
  // here because these tokens only have to be unique, not unguessable.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = randomToken();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile";
  return "desktop";
}

/**
 * First-touch attribution: captured once per session and replayed on every later
 * pageview. Reading document.referrer on each hit instead would credit our own
 * pages, since an in-app navigation leaves the previous Everdice URL there.
 */
function getAttribution(landingPath: string): Attribution {
  const stored = sessionStorage.getItem(ATTRIBUTION_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as Attribution;
    } catch {
      // fall through and re-derive
    }
  }

  const params = new URLSearchParams(window.location.search);
  let referrerHost: string | null = null;
  let referrerUrl: string | null = null;

  if (document.referrer) {
    try {
      const url = new URL(document.referrer);
      // Same-origin referrer means they were already here — that's direct, not a referral.
      if (url.host !== window.location.host) {
        referrerHost = url.host;
        referrerUrl = document.referrer.slice(0, 500);
      }
    } catch {
      // malformed referrer — treat as direct
    }
  }

  const attribution: Attribution = {
    referrerHost,
    referrerUrl,
    utmSource: params.get("utm_source"),
    utmMedium: params.get("utm_medium"),
    utmCampaign: params.get("utm_campaign"),
    landingPath,
  };
  sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  return attribution;
}

export function useVisitTracking() {
  const [location] = useLocation();
  // The visit currently open, so we can close it out with a dwell time.
  const openVisit = useRef<{ token: string; startedAt: number } | null>(null);

  // Close out whichever visit is open. sendBeacon so it survives the unload
  // that a tab close or an external-link click triggers; fetch+keepalive is the
  // fallback for browsers without it.
  const closeOpenVisit = useRef(() => {
    const visit = openVisit.current;
    if (!visit) return;
    openVisit.current = null;

    const durationMs = Date.now() - visit.startedAt;
    if (durationMs < 1000) return; // sub-second bounces are noise, not dwell time

    const body = JSON.stringify({ visitToken: visit.token, durationMs });
    const url = "/api/analytics/visit/close";
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      } else {
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // analytics must never surface an error to the user
    }
  });

  useEffect(() => {
    let cancelled = false;

    // Leaving the previous route ends its visit.
    closeOpenVisit.current();

    const sessionId = getSessionId();
    const isLanding = !sessionStorage.getItem(ATTRIBUTION_KEY);
    const attribution = getAttribution(location);
    const visitToken = randomToken();

    fetch("/api/analytics/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitToken,
        sessionId,
        path: location,
        isLanding,
        deviceType: getDeviceType(),
        ...attribution,
      }),
    })
      .then(() => {
        if (!cancelled) openVisit.current = { token: visitToken, startedAt: Date.now() };
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [location]);

  // Tab close / backgrounding. pagehide is the one that actually fires on
  // mobile Safari, where unload and beforeunload are unreliable.
  useEffect(() => {
    const handler = () => closeOpenVisit.current();
    window.addEventListener("pagehide", handler);
    return () => {
      window.removeEventListener("pagehide", handler);
      handler();
    };
  }, []);
}
