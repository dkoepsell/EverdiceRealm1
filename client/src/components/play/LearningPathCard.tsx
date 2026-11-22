/**
 * "Learn the game by playing" (engagement spec guiding priority 5; design PDF
 * Home): short one-shots, each built around one 5e mechanic, in order and
 * skippable. A lesson counts as learned once its rules have fired in play.
 */
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, Lock, Swords } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface LessonRow {
  id: string;
  title: string;
  pitch: string;
  minutes: number;
  state: "learned" | "next" | "locked";
  skipped: boolean;
  campaign: Record<string, unknown>;
}

export function useEngagementFlags() {
  return useQuery<Record<string, boolean>>({ queryKey: ["/api/engagement/flags"], staleTime: 5 * 60 * 1000 });
}

export function LearningPathCard({ characterId, onStarted }: { characterId: number | null; onStarted: (campaignId: number) => void }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const { data } = useQuery<{ learned: number; total: number; lessons: LessonRow[] }>({ queryKey: ["/api/learning-path"], staleTime: 0 });
  // Pages without a character in hand (the Hearth) fall back to the player's first character.
  const { data: chars = [] } = useQuery<{ id: number }[]>({ queryKey: ["/api/characters"], enabled: characterId == null });
  const heroId = characterId ?? chars[0]?.id ?? null;

  const start = useMutation({
    mutationFn: async (lesson: LessonRow) => {
      if (!heroId) throw new Error("Create a character first.");
      // Lesson campaigns have fixed titles ("Lesson: …") and the server allows one
      // campaign per title, so a lesson already started comes back as a 409 with
      // its id. Resume that one instead of failing.
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...lesson.campaign, characterId: heroId }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409 && body?.code === "DUPLICATE_CAMPAIGN_TITLE" && body.existingCampaignId) {
        return body.existingCampaignId as number;
      }
      if (!res.ok) throw new Error(body?.message || res.statusText);
      await apiRequest("POST", `/api/campaigns/${body.id}/participants`, { characterId: heroId, role: "player" });
      return body.id as number;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      onStarted(id);
    },
    onError: (e: Error) => toast({ title: "Couldn't start the lesson", description: e.message.replace(/^\d+:\s*/, ""), variant: "destructive" }),
  });
  const skip = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/learning-path/${id}/skip`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/learning-path"] }),
  });

  if (!data) return null;
  const nextIdx = data.lessons.findIndex((l) => l.state === "next");
  // Show the learned ones before "next", "next" itself, and one locked after it (all when expanded).
  const visible = expanded ? data.lessons : data.lessons.filter((_, i) => nextIdx < 0 || i <= nextIdx + 1);

  return (
    <div className="mb-6 ed-panel p-4" data-testid="learning-path">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="ed-title text-xl">Learn the game by playing</h2>
        <span className="text-sm text-stone-400">{data.learned} of {data.total}</span>
      </div>
      <div className="space-y-2">
        {visible.map((l) =>
          l.state === "learned" ? (
            <div key={l.id} className="flex items-center gap-3 rounded-xl ed-card px-3 py-2.5">
              <Check className="h-4 w-4 text-emerald-300" /> {l.title}{l.skipped && <span className="text-xs text-stone-500">(skipped)</span>}
            </div>
          ) : l.state === "next" ? (
            <div key={l.id} className="rounded-[0.875rem] border border-[var(--ed-gold)] bg-[var(--ed-card)] p-3">
              <button type="button" className="flex w-full items-center gap-3 text-left" disabled={start.isPending} onClick={() => start.mutate(l)} data-testid={`lesson-start-${l.id}`}>
                <Swords className="h-5 w-5 shrink-0 text-amber-300" />
                <span className="flex-1">
                  <span className="block font-semibold">Next: {l.title}</span>
                  <span className="block text-sm text-stone-400">A {l.minutes}-minute one-shot. {l.pitch}</span>
                </span>
                <ChevronRight className="h-5 w-5 text-amber-300" />
              </button>
              <button type="button" className="mt-1 text-xs text-stone-500 hover:text-stone-300" onClick={() => skip.mutate(l.id)}>I know this one, skip it</button>
            </div>
          ) : (
            <button key={l.id} type="button" onClick={() => start.mutate(l)} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-[var(--ed-line)] px-3 py-2.5 text-left text-[var(--ed-muted)] hover:text-[var(--ed-ink)]">
              <Lock className="h-4 w-4" /> {l.title}
            </button>
          ),
        )}
      </div>
      {!expanded && data.lessons.length > visible.length && (
        <button type="button" className="mt-2 text-sm text-amber-300 hover:text-amber-200" onClick={() => setExpanded(true)}>Show all {data.total} lessons</button>
      )}
    </div>
  );
}
