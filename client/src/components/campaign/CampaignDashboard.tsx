import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Campaign, CampaignSession, Character } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Target,
  Users,
  Heart,
  Shield,
  Sword,
  Scroll,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  Calendar,
  TrendingUp,
  Zap,
  BookOpen,
  MapPin,
  Coins,
  Package,
  RefreshCw
} from "lucide-react";

interface CampaignDashboardProps {
  campaign: Campaign;
  currentSession: CampaignSession | null;
  participants: any[];
  campaignNpcs: any[];
  campaignQuests: any[];
}

interface NarrativeInsight {
  type: 'critical' | 'opportunity' | 'warning' | 'milestone';
  title: string;
  description: string;
  suggestion?: string;
}

interface PartyMemberStatus {
  name: string;
  type: 'player' | 'companion';
  currentHp: number;
  maxHp: number;
  status: string;
  class?: string;
  level?: number;
  portraitUrl?: string | null;
  conditions?: string[];
}

export default function CampaignDashboard({
  campaign,
  currentSession,
  participants,
  campaignNpcs,
  campaignQuests
}: CampaignDashboardProps) {
  const { toast } = useToast();
  const [insightsOpen, setInsightsOpen] = useState(true);
  const [questsOpen, setQuestsOpen] = useState(true);
  const [partyOpen, setPartyOpen] = useState(true);
  const [eventsOpen, setEventsOpen] = useState(true);

  const storyState = currentSession?.storyState as any || {};
  const partyMembers = storyState.partyMembers || [];
  const combatants = storyState.combatants || [];
  const activeQuestsFromState = storyState.activeQuests || [];
  const storyHooks = storyState.storyHooks || [];
  const currentLocation = storyState.currentLocation || storyState.location || 'Unknown';
  const inCombat = storyState.inCombat || false;

  const { data: narrativeInsights, isLoading: insightsLoading, refetch: refetchInsights } = useQuery<NarrativeInsight[]>({
    queryKey: [`/api/campaigns/${campaign.id}/narrative-insights`],
    enabled: !!campaign.id && !!currentSession,
    staleTime: 60000,
  });

  const generateInsightsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/campaigns/${campaign.id}/generate-narrative-insights`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/narrative-insights`] });
      toast({
        title: 'Insights Generated',
        description: 'AI has analyzed your campaign and provided new insights'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to generate insights',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const allQuests = [...campaignQuests, ...activeQuestsFromState.filter((q: any) => 
    !campaignQuests.some((cq: any) => cq.id === q.id)
  )];

  const activeQuests = allQuests.filter((q: any) => q.status === 'active' || q.status === 'in_progress');
  const completedQuests = allQuests.filter((q: any) => q.status === 'completed');
  const failedQuests = allQuests.filter((q: any) => q.status === 'failed');

  const getPartyStatuses = (): PartyMemberStatus[] => {
    const statuses: PartyMemberStatus[] = [];
    
    for (const p of participants) {
      if (p.character) {
        const maxHp = p.character.maxHitPoints ?? 10;
        statuses.push({
          name: p.character.name,
          type: 'player',
          currentHp: p.character.hitPoints ?? maxHp,
          maxHp: maxHp,
          status: p.character.status || 'conscious',
          class: p.character.class,
          level: p.character.level,
          portraitUrl: p.character.portraitUrl,
          conditions: []
        });
      }
    }
    
    for (const pm of partyMembers) {
      if (pm.type === 'companion' && !statuses.some(s => s.name === pm.name)) {
        const maxHp = pm.maxHp ?? 20;
        statuses.push({
          name: pm.name,
          type: 'companion',
          currentHp: pm.currentHp ?? maxHp,
          maxHp: maxHp,
          status: pm.status || 'conscious',
          class: pm.class,
          level: pm.level,
          conditions: []
        });
      }
    }
    
    return statuses;
  };

  const partyStatuses = getPartyStatuses();
  const averagePartyHp = partyStatuses.length > 0 
    ? Math.round(partyStatuses.reduce((sum, p) => sum + (p.currentHp / p.maxHp) * 100, 0) / partyStatuses.length)
    : 100;

  const getHpColor = (current: number, max: number) => {
    const percent = (current / max) * 100;
    if (percent <= 25) return 'bg-red-500';
    if (percent <= 50) return 'bg-orange-500';
    if (percent <= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'dead':
        return <Badge variant="destructive">Dead</Badge>;
      case 'unconscious':
        return <Badge variant="destructive">Unconscious</Badge>;
      case 'stabilized':
        return <Badge variant="secondary">Stabilized</Badge>;
      case 'bloodied':
        return <Badge className="bg-orange-500">Bloodied</Badge>;
      default:
        return <Badge variant="outline" className="text-green-600 border-green-600">Healthy</Badge>;
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'opportunity':
        return <Sparkles className="h-4 w-4 text-amber-500" />;
      case 'warning':
        return <Clock className="h-4 w-4 text-orange-500" />;
      case 'milestone':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return <Zap className="h-4 w-4 text-blue-500" />;
    }
  };

  const getInsightBorderColor = (type: string) => {
    switch (type) {
      case 'critical':
        return 'border-l-red-500';
      case 'opportunity':
        return 'border-l-amber-500';
      case 'warning':
        return 'border-l-orange-500';
      case 'milestone':
        return 'border-l-green-500';
      default:
        return 'border-l-blue-500';
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-indigo-600" />
            Campaign Dashboard
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Overview for DMs - Track quests, party status, and narrative insights
          </p>
        </div>
        {currentSession && (
          <div className="text-right">
            <Badge variant="outline" className="text-indigo-600 border-indigo-600">
              Chapter {currentSession.sessionNumber} of {campaign.totalChapters || 5}
            </Badge>
            {inCombat && (
              <Badge variant="destructive" className="ml-2">
                <Sword className="h-3 w-3 mr-1" />
                In Combat
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Active Quests</p>
                <p className="text-2xl font-bold text-indigo-600">{activeQuests.length}</p>
              </div>
              <Target className="h-8 w-8 text-indigo-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Party Health</p>
                <p className="text-2xl font-bold text-green-600">{averagePartyHp}%</p>
              </div>
              <Heart className="h-8 w-8 text-green-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Party Size</p>
                <p className="text-2xl font-bold text-amber-600">{partyStatuses.length}</p>
              </div>
              <Users className="h-8 w-8 text-amber-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/40">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Story Hooks</p>
                <p className="text-2xl font-bold text-purple-600">{storyHooks.length}</p>
              </div>
              <Scroll className="h-8 w-8 text-purple-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Collapsible open={insightsOpen} onOpenChange={setInsightsOpen}>
        <Card className="border-2 border-indigo-200 dark:border-indigo-800">
          <CardHeader className="pb-2">
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600" />
                AI Narrative Insights
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    generateInsightsMutation.mutate();
                  }}
                  disabled={generateInsightsMutation.isPending}
                >
                  {generateInsightsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span className="ml-1 hidden sm:inline">Refresh</span>
                </Button>
                {insightsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CollapsibleTrigger>
            <CardDescription>
              AI-powered analysis highlighting critical narrative junctures
            </CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              {insightsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : narrativeInsights && narrativeInsights.length > 0 ? (
                <div className="space-y-3">
                  {narrativeInsights.map((insight, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border-l-4 bg-slate-50 dark:bg-slate-900 ${getInsightBorderColor(insight.type)}`}
                    >
                      <div className="flex items-start gap-2">
                        {getInsightIcon(insight.type)}
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {insight.title}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            {insight.description}
                          </p>
                          {insight.suggestion && (
                            <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-2 italic">
                              Suggestion: {insight.suggestion}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-slate-500">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No insights available yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => generateInsightsMutation.mutate()}
                    disabled={generateInsightsMutation.isPending}
                  >
                    Generate Insights
                  </Button>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <div className="grid gap-4 md:grid-cols-2">
        <Collapsible open={questsOpen} onOpenChange={setQuestsOpen}>
          <Card>
            <CardHeader className="pb-2">
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-amber-600" />
                  Quest Tracker
                </CardTitle>
                {questsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <ScrollArea className="h-64">
                  {activeQuests.length === 0 && completedQuests.length === 0 && failedQuests.length === 0 ? (
                    <p className="text-center text-slate-500 py-4">No quests tracked yet</p>
                  ) : (
                    <div className="space-y-4">
                      {activeQuests.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm text-amber-600 mb-2 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Active ({activeQuests.length})
                          </h4>
                          {activeQuests.map((quest: any, index: number) => (
                            <div key={quest.id || index} className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded mb-2">
                              <p className="font-medium text-slate-900 dark:text-slate-100">{quest.title}</p>
                              <p className="text-xs text-slate-600 dark:text-slate-400">{quest.description}</p>
                              {quest.xpReward && (
                                <Badge variant="outline" className="mt-1 text-xs">
                                  <Coins className="h-3 w-3 mr-1" /> {quest.xpReward} XP
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {completedQuests.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm text-green-600 mb-2 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Completed ({completedQuests.length})
                          </h4>
                          {completedQuests.slice(0, 3).map((quest: any, index: number) => (
                            <div key={quest.id || index} className="p-2 bg-green-50 dark:bg-green-950/30 rounded mb-2 opacity-75">
                              <p className="font-medium text-slate-700 dark:text-slate-300 line-through">{quest.title}</p>
                            </div>
                          ))}
                          {completedQuests.length > 3 && (
                            <p className="text-xs text-slate-500">+{completedQuests.length - 3} more completed</p>
                          )}
                        </div>
                      )}
                      
                      {failedQuests.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm text-red-600 mb-2 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Failed ({failedQuests.length})
                          </h4>
                          {failedQuests.map((quest: any, index: number) => (
                            <div key={quest.id || index} className="p-2 bg-red-50 dark:bg-red-950/30 rounded mb-2 opacity-75">
                              <p className="font-medium text-slate-700 dark:text-slate-300">{quest.title}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <Collapsible open={partyOpen} onOpenChange={setPartyOpen}>
          <Card>
            <CardHeader className="pb-2">
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600" />
                  Party Status
                </CardTitle>
                {partyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <ScrollArea className="h-64">
                  {partyStatuses.length === 0 ? (
                    <p className="text-center text-slate-500 py-4">No party members</p>
                  ) : (
                    <div className="space-y-3">
                      {partyStatuses.map((member, index) => (
                        <div key={index} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                                {member.portraitUrl ? (
                                  <img src={member.portraitUrl} alt={member.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-sm font-bold">{member.name[0]}</span>
                                )}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-slate-100">
                                  {member.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {member.type === 'companion' ? 'Companion' : 'Player'} 
                                  {member.class && ` • ${member.class}`}
                                  {member.level && ` Lv${member.level}`}
                                </p>
                              </div>
                            </div>
                            {getStatusBadge(member.status)}
                          </div>
                          <div className="flex items-center gap-2">
                            <Heart className="h-4 w-4 text-red-500" />
                            <div className="flex-1">
                              <Progress 
                                value={(member.currentHp / member.maxHp) * 100} 
                                className={`h-2 ${getHpColor(member.currentHp, member.maxHp)}`}
                              />
                            </div>
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                              {member.currentHp}/{member.maxHp}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      <Collapsible open={eventsOpen} onOpenChange={setEventsOpen}>
        <Card>
          <CardHeader className="pb-2">
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-600" />
                Story Hooks & Upcoming Events
              </CardTitle>
              {eventsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-semibold text-sm text-purple-600 mb-2 flex items-center gap-1">
                    <Scroll className="h-4 w-4" /> Current Story Hooks
                  </h4>
                  {storyHooks.length > 0 ? (
                    <div className="space-y-2">
                      {storyHooks.map((hook: string, index: number) => (
                        <div key={index} className="p-2 bg-purple-50 dark:bg-purple-950/30 rounded border-l-2 border-purple-400">
                          <p className="text-sm text-slate-700 dark:text-slate-300">{hook}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No active story hooks</p>
                  )}
                </div>
                
                <div>
                  <h4 className="font-semibold text-sm text-indigo-600 mb-2 flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> Current Location
                  </h4>
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{currentLocation}</p>
                    {combatants.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-slate-500 mb-1">Enemies Present:</p>
                        <div className="flex flex-wrap gap-1">
                          {combatants.filter((c: any) => c.type === 'enemy').map((enemy: any, i: number) => (
                            <Badge key={i} variant="destructive" className="text-xs">
                              {enemy.name} ({enemy.currentHp}/{enemy.maxHp})
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
