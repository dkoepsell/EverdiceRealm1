/**
 * Milestone nudges toward live play and the DM path. One at a time,
 * dismissible, never repeated once dismissed.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Nudge } from "@shared/dm/path";

export function Nudges({ className = "" }: { className?: string }) {
  const qc = useQueryClient();
  const { data } = useQuery<{ nudges: Nudge[] }>({ queryKey: ["/api/dm-path/nudges"], staleTime: 5 * 60_000 });
  const dismiss = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/dm-path/nudges/${id}/dismiss`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/dm-path/nudges"] }),
  });
  const n = data?.nudges?.[0];
  if (!n) return null;
  return (
    <Card className={`border-violet-500/40 bg-violet-950/20 ${className}`} data-testid={`nudge-${n.id}`}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start gap-2">
          <Users className="h-4 w-4 text-violet-300 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-violet-100 text-sm">{n.title}</p>
            <p className="text-xs text-violet-200/80 mt-1 leading-relaxed">{n.text}</p>
          </div>
          <button onClick={() => dismiss.mutate(n.id)} className="text-violet-300/60 hover:text-violet-200" title="Not now" data-testid="nudge-dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 pl-6">
          {n.actions.map((a) => (
            <Link key={a.href} href={a.href}>
              <Button size="sm" variant="outline" className="h-7 text-xs border-violet-500/50 text-violet-100">{a.label}</Button>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default Nudges;
