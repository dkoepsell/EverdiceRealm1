import { useState } from "react";
import { X, Swords } from "lucide-react";

const DISMISS_KEY = "coadmin-banner-dismissed-v1";

// Slim, dismissible site-wide banner recruiting a volunteer co-admin.
export default function CoAdminBanner() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem(DISMISS_KEY) === "true";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch {
      // ignore storage failures — still hide for this session
    }
    setDismissed(true);
  };

  return (
    <div className="relative z-20 border-b border-amber-500/30 bg-gradient-to-r from-amber-600/15 via-orange-600/10 to-amber-600/15">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-10 py-2 text-center">
        <Swords className="hidden h-4 w-4 shrink-0 text-amber-500 sm:block" />
        <p className="text-xs sm:text-sm text-amber-100">
          <span className="font-semibold">Passionate about D&amp;D?</span>{" "}
          I'm looking for a co-admin to help improve Everdice and grow the community.{" "}
          <a
            href="mailto:drkoepsell@gmail.com?subject=Everdice%20Co-Admin%20Interest&body=Tell%20me%20a%20bit%20about%20your%20D%26D%20experience%20and%20why%20you'd%20like%20to%20help%20grow%20Everdice."
            className="font-semibold text-amber-300 underline underline-offset-2 hover:text-amber-200"
          >
            Get in touch →
          </a>
        </p>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-200/70 transition-colors hover:text-amber-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
