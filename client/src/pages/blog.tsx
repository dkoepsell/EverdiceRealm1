import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

// Soro-hosted blog. The script renders the post list into the #soro-blog div below.
const SORO_EMBED_SRC =
  "https://app.trysoro.com/api/embed/c3c17e93-9212-440a-afe4-fd345ebb68b6";

export default function BlogPage() {
  // "loading" until the embed paints something, then "ready" or "unavailable".
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    const mount = document.getElementById("soro-blog");

    const script = document.createElement("script");
    script.src = SORO_EMBED_SRC;
    script.async = true;
    script.onerror = () => setStatus("unavailable");
    document.body.appendChild(script);

    // The embed can return a 200 that renders nothing (e.g. when it's turned off in
    // the Soro dashboard), so onerror alone can't tell us it worked — watch the mount.
    const observer = mount
      ? new MutationObserver(() => {
          if (mount.childElementCount > 0) setStatus("ready");
        })
      : null;
    observer?.observe(mount!, { childList: true, subtree: true });

    const timeout = window.setTimeout(() => {
      setStatus((s) =>
        s === "loading" && !mount?.childElementCount ? "unavailable" : s,
      );
    }, 8000);

    return () => {
      window.clearTimeout(timeout);
      observer?.disconnect();
      script.remove();
      if (mount) mount.innerHTML = "";
    };
  }, []);

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="text-center mb-10">
        <h1 className="font-fantasy text-4xl font-bold mb-4">The Everdice Journal</h1>
        <p className="text-lg text-muted-foreground">
          News from the realm, design notes, and tales from the table.
        </p>
      </div>

      <div id="soro-blog" className="min-h-[40vh]" />

      {status === "loading" && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      )}

      {status === "unavailable" && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="mb-2">The journal isn't loading right now.</p>
          <p className="text-sm">
            Please check back shortly — new entries are on their way.
          </p>
        </div>
      )}
    </div>
  );
}
