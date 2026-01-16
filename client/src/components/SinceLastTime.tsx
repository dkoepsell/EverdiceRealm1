import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Sparkles } from "lucide-react";
import { getQueryFn } from "@/lib/queryClient";

interface SinceLastTimeProps {
  campaignId: number;
}

export default function SinceLastTime({ campaignId }: SinceLastTimeProps) {
  const { data, isLoading } = useQuery<{ bullets: string[]; lastLogin: string | null }>({
    queryKey: ['/api/campaigns', campaignId, 'since-last-time'],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!campaignId,
  });

  if (isLoading || !data || !data.bullets || data.bullets.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-amber-400" />
          <span className="text-amber-200">Since Last Time...</span>
          <Sparkles className="h-4 w-4 text-amber-400/60" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {data.bullets.map((bullet, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-amber-400 mt-1">•</span>
              <span className="italic">{bullet}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
