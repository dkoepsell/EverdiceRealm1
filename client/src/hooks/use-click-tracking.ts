import { useEffect } from "react";
import { trackClick } from "@/lib/analytics";

/**
 * Feeds the admin "Click Analytics" panel.
 *
 * That panel reads user_activity_events rows with event_name = 'click', which
 * only `trackClick()` in lib/analytics.ts ever produces — and until now nothing
 * in the client called it, so the panel had no data to show by construction.
 * Rather than sprinkle handlers across hundreds of components, this listens once
 * at the document and lets clicks bubble up to it.
 *
 * The ingest route is authenticated, so these are signed-in clicks only;
 * anonymous pageviews go through use-visit-tracking instead.
 */

/** Prefer stable identifiers over text, which changes with copy edits and i18n. */
function identify(el: HTMLElement): string {
  return (
    el.getAttribute("data-testid") ||
    el.id ||
    el.getAttribute("aria-label") ||
    el.getAttribute("name") ||
    (el.tagName === "A" ? el.getAttribute("href") : null) ||
    el.textContent?.trim().slice(0, 60) ||
    el.tagName.toLowerCase()
  );
}

export function useClickTracking() {
  useEffect(() => {
    // Clicks are bursty (double-clicks, drag starts). Collapse repeats of the
    // same target inside a short window so one intent is one row.
    let lastKey = "";
    let lastAt = 0;

    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest) return;

      const el = target.closest<HTMLElement>(
        "button, a, [role='button'], [role='tab'], [role='menuitem'], [data-track]",
      );
      if (!el) return;

      const elementType = el.getAttribute("data-track")
        ? "tracked"
        : el.tagName === "A"
          ? "link"
          : el.getAttribute("role") || "button";
      const elementId = identify(el);

      const key = `${elementType}:${elementId}`;
      const now = Date.now();
      if (key === lastKey && now - lastAt < 750) return;
      lastKey = key;
      lastAt = now;

      // trackClick swallows its own failures; never let analytics break a click.
      void trackClick(elementType, elementId, el.textContent?.trim(), {
        page: window.location.pathname,
      });
    };

    // Capture phase: still records the click when a handler calls
    // stopPropagation(), which plenty of the Radix primitives do.
    document.addEventListener("click", handler, { capture: true, passive: true });
    return () => document.removeEventListener("click", handler, { capture: true });
  }, []);
}
