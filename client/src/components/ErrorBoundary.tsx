import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

/**
 * Without a boundary, a single render-time throw unmounts the whole React tree
 * and leaves the user staring at a white page — the only way out is a manual
 * browser refresh. A player hit this twice mid-session and lost their place
 * both times, so the fallback below is deliberately recoverable: "Try again"
 * re-mounts the subtree in place, and the surrounding chrome stays usable.
 */

interface Props {
  children: ReactNode;
  /** Changing this resets a tripped boundary — we key it on the route so
   *  navigating away from a broken page isn't a dead end. */
  resetKey?: string;
  /** Named in the crash report so we can tell a page crash from a chrome crash. */
  label?: string;
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * A deploy replaces the hashed chunk files, so a tab that was already open
 * 404s the moment it lazy-loads a page it hasn't visited yet. That throws
 * straight past <Suspense> and blanks the app — and retrying in place can
 * never work, because the module registry caches the rejected import.
 * Only a hard reload fixes it.
 */
function isStaleChunkError(error: Error): boolean {
  const text = `${error?.name ?? ""} ${error?.message ?? ""}`;
  return (
    /ChunkLoadError/i.test(text) ||
    /Loading (CSS )?chunk .* failed/i.test(text) ||
    /Failed to fetch dynamically imported module/i.test(text) ||
    /Importing a module script failed/i.test(text) ||
    /error loading dynamically imported module/i.test(text)
  );
}

// Guard against a reload loop if the reload doesn't actually fix it.
const RELOAD_GUARD_KEY = "everdice:chunk-reloaded-at";

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prevProps: Props) {
    // Reset on navigation, otherwise the user stays stuck on the error screen
    // even after clicking a link to a perfectly healthy page.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", this.props.label ?? "app", error, info.componentStack);

    // Stale chunk after a deploy: reload once, automatically, so the player
    // never sees an error at all. The guard keeps a genuinely broken build
    // from putting the tab into a reload loop.
    if (isStaleChunkError(error)) {
      let reloadedRecently = false;
      try {
        const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
        reloadedRecently = Number.isFinite(last) && Date.now() - last < 30_000;
        if (!reloadedRecently) sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
      } catch {
        /* private mode / storage disabled — fall through to the manual button */
      }
      if (!reloadedRecently) {
        window.location.reload();
        return;
      }
    }
    // A crash in production currently leaves no trace anywhere, so report it.
    // Best-effort: a failure here must never re-throw out of the boundary.
    try {
      void fetch("/api/client-errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: String(error?.message ?? error),
          stack: error?.stack?.slice(0, 4000),
          componentStack: info.componentStack?.slice(0, 4000),
          boundary: this.props.label ?? "app",
          path: window.location.pathname + window.location.search,
          userAgent: navigator.userAgent,
        }),
      }).catch(() => {});
    } catch {
      /* reporting is never worth a second crash */
    }
  }

  private retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.retry);

    // Retrying in place cannot fix a stale chunk — only a reload can.
    if (isStaleChunkError(error)) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
            <RefreshCw className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h2 className="mb-1 text-lg font-semibold">Everdice was just updated</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Reload to pick up the new version. Your campaign is exactly where you left it.
            </p>
            <Button onClick={() => window.location.reload()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Reload
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-destructive/30 bg-card p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
          <h2 className="mb-1 text-lg font-semibold">This page hit a snag</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Your campaign is safe — nothing you did was lost. You can pick up right where
            you left off.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={this.retry} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
            <Button variant="outline" onClick={() => (window.location.href = "/dashboard")} className="gap-2">
              <Home className="h-4 w-4" />
              Back to safety
            </Button>
          </div>
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Technical details
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-2 text-[11px] text-muted-foreground">
              {String(error?.message ?? error)}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
