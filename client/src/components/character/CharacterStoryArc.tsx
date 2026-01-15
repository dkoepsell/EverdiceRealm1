import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, Users, Shield, Sparkles, Clock, Heart, AlertTriangle, Star } from "lucide-react";

interface CharacterStoryArcProps {
  characterId: number;
  characterName: string;
}

interface StoryArcData {
  characterId: number;
  worldPerception?: {
    trustLevel: string;
    trustDescriptor: string;
    behaviorDescriptor: string;
    tendencies: Record<string, number>;
  };
  factionStandings: Array<{
    factionId: number;
    factionName?: string;
    trustLevel: string;
    trustDescriptor: string;
  }>;
  recentDeeds: Array<{
    id: number;
    type: string;
    summary: string;
    significance: string;
    date: string;
  }>;
  summary: string;
}

function getTrustBadgeStyle(trustLevel: string): string {
  const styles: Record<string, string> = {
    'respected': 'bg-emerald-500/20 text-emerald-700 border-emerald-300',
    'trusted': 'bg-green-500/20 text-green-700 border-green-300',
    'neutral': 'bg-gray-500/20 text-gray-700 border-gray-300',
    'cautious': 'bg-amber-500/20 text-amber-700 border-amber-300',
    'distrusted': 'bg-red-500/20 text-red-700 border-red-300',
    'unknown': 'bg-slate-500/20 text-slate-600 border-slate-300'
  };
  return styles[trustLevel] || styles['unknown'];
}

function getSignificanceIcon(significance: string) {
  switch (significance) {
    case 'defining':
      return <Star className="h-4 w-4 text-amber-500" />;
    case 'major':
      return <Sparkles className="h-4 w-4 text-purple-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

function formatDeedType(type: string): string {
  const typeLabels: Record<string, string> = {
    'kept_promise': 'Kept a Promise',
    'broken_trust': 'Broke Trust',
    'showed_mercy': 'Showed Mercy',
    'used_force': 'Used Force',
    'helped_stranger': 'Helped a Stranger',
    'betrayal': 'Betrayal',
    'completed_quest': 'Completed Quest',
    'abandoned_quest': 'Abandoned Quest',
    'negotiated_peace': 'Negotiated Peace',
    'started_fight': 'Started a Fight'
  };
  return typeLabels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export default function CharacterStoryArc({ characterId, characterName }: CharacterStoryArcProps) {
  const { data: storyArc, isLoading, error } = useQuery<StoryArcData>({
    queryKey: ['/api/characters', characterId, 'story-arc'],
    enabled: !!characterId
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <BookOpen className="h-8 w-8 text-primary/40" />
          <p className="text-sm text-muted-foreground">Loading your story...</p>
        </div>
      </div>
    );
  }

  if (error || !storyArc) {
    return (
      <div className="text-center py-6">
        <BookOpen className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">
          Your story is just beginning. Adventures await!
        </p>
      </div>
    );
  }

  const hasContent = storyArc.worldPerception || 
    storyArc.factionStandings?.length > 0 || 
    storyArc.recentDeeds?.length > 0;

  if (!hasContent) {
    return (
      <div className="space-y-4">
        <div className="text-center py-6 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
          <BookOpen className="h-12 w-12 text-amber-600 mx-auto mb-3" />
          <h3 className="font-fantasy text-lg font-semibold text-amber-800 dark:text-amber-300 mb-2">
            Your Story Awaits
          </h3>
          <p className="text-amber-700 dark:text-amber-400 text-sm max-w-md mx-auto">
            The world doesn't know you yet. As you adventure, your deeds will shape how 
            factions and NPCs perceive you. Will you be trusted or feared?
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {storyArc.summary && (
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-700">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <BookOpen className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-fantasy text-base font-semibold text-amber-800 dark:text-amber-300 mb-1">
                  Your Story So Far
                </h3>
                <p className="text-amber-800/90 dark:text-amber-200/90 text-sm leading-relaxed">
                  {storyArc.summary}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {storyArc.worldPerception && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              How the World Sees You
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex items-center gap-2 mb-3">
              <Badge 
                variant="outline" 
                className={getTrustBadgeStyle(storyArc.worldPerception.trustLevel)}
              >
                {storyArc.worldPerception.trustLevel?.charAt(0).toUpperCase() + 
                 storyArc.worldPerception.trustLevel?.slice(1) || 'Unknown'}
              </Badge>
            </div>
            {storyArc.worldPerception.trustDescriptor && (
              <p className="text-sm text-muted-foreground mb-2">
                {storyArc.worldPerception.trustDescriptor}
              </p>
            )}
            {storyArc.worldPerception.behaviorDescriptor && (
              <p className="text-sm text-muted-foreground">
                {storyArc.worldPerception.behaviorDescriptor}
              </p>
            )}
            
            {storyArc.worldPerception.tendencies && (
              <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-3 gap-2">
                {Object.entries(storyArc.worldPerception.tendencies).map(([key, value]) => {
                  const labels: Record<string, [string, string]> = {
                    'cautious_vs_reckless': ['Cautious', 'Bold'],
                    'merciful_vs_ruthless': ['Merciful', 'Ruthless'],
                    'selfless_vs_selfish': ['Selfless', 'Self-focused']
                  };
                  const [low, high] = labels[key] || [key, key];
                  const percentage = Math.round(value * 100);
                  return (
                    <div key={key} className="text-xs">
                      <div className="flex justify-between text-muted-foreground mb-1">
                        <span>{low}</span>
                        <span>{high}</span>
                      </div>
                      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary/60 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {storyArc.factionStandings && storyArc.factionStandings.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Faction Standings
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-2">
              {storyArc.factionStandings.map((faction) => (
                <div 
                  key={faction.factionId}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                >
                  <span className="font-medium text-sm">
                    {faction.factionName || `Faction ${faction.factionId}`}
                  </span>
                  <Badge 
                    variant="outline"
                    className={getTrustBadgeStyle(faction.trustLevel)}
                  >
                    {faction.trustLevel?.charAt(0).toUpperCase() + 
                     faction.trustLevel?.slice(1) || 'Unknown'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {storyArc.recentDeeds && storyArc.recentDeeds.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Recent Deeds
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <ScrollArea className="max-h-48">
              <div className="space-y-3">
                {storyArc.recentDeeds.slice(0, 5).map((deed) => (
                  <div key={deed.id} className="flex gap-3 group">
                    <div className="flex-shrink-0 mt-0.5">
                      {getSignificanceIcon(deed.significance)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                          {formatDeedType(deed.type)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-snug">
                        {deed.summary}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
