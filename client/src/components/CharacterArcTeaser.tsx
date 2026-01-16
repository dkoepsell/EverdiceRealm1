import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Eye, TrendingUp, AlertCircle, Heart, Compass } from "lucide-react";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CharacterArcInsight } from "@shared/schema";

interface CharacterArcTeaserProps {
  characterId: number;
  campaignId?: number;
  showRevealed?: boolean;
}

const insightTypeIcons: Record<string, any> = {
  turning_point: AlertCircle,
  pattern_emerging: TrendingUp,
  crossroads: Compass,
  growth_moment: Heart,
};

const insightTypeColors: Record<string, string> = {
  turning_point: "text-amber-400",
  pattern_emerging: "text-blue-400",
  crossroads: "text-purple-400",
  growth_moment: "text-green-400",
};

export default function CharacterArcTeaser({ characterId, campaignId, showRevealed = false }: CharacterArcTeaserProps) {
  const { toast } = useToast();

  const { data: insights = [], isLoading } = useQuery<CharacterArcInsight[]>({
    queryKey: ['/api/characters', characterId, 'arc-insights', showRevealed ? 'all' : 'unrevealed'],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!characterId,
  });

  const revealInsightMutation = useMutation({
    mutationFn: async (insightId: number) => {
      const response = await apiRequest("PATCH", `/api/arc-insights/${insightId}/reveal`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters', characterId, 'arc-insights'] });
      toast({
        title: "Insight Revealed",
        description: "The full insight has been unlocked.",
      });
    },
  });

  if (isLoading) {
    return (
      <Card className="border-amber-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-amber-400" />
            <span>Character Arc</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (insights.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-amber-400" />
          <span className="text-amber-200">Character Arc Insights</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {insights.map((insight) => {
            const Icon = insightTypeIcons[insight.insightType] || Sparkles;
            const colorClass = insightTypeColors[insight.insightType] || "text-amber-400";
            
            return (
              <div 
                key={insight.id} 
                className="border border-amber-500/20 rounded-lg p-3 bg-amber-500/5 hover:bg-amber-500/10 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded bg-amber-500/10">
                      <Icon className={`h-4 w-4 ${colorClass}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs capitalize border-amber-500/30 text-amber-400">
                          {insight.insightType.replace("_", " ")}
                        </Badge>
                        {insight.isRevealed && (
                          <Badge variant="secondary" className="text-xs">
                            Revealed
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm italic text-amber-200/80">
                        "{insight.teaser}"
                      </p>
                      {insight.isRevealed && insight.fullInsight && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {insight.fullInsight}
                        </p>
                      )}
                    </div>
                  </div>
                  {!insight.isRevealed && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => revealInsightMutation.mutate(insight.id)}
                      disabled={revealInsightMutation.isPending}
                      className="text-amber-400 hover:text-amber-300"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
