import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Trash2, 
  Sparkles, 
  Vote, 
  Check, 
  Loader2, 
  Users,
  Target,
  X
} from "lucide-react";

interface Choice {
  id: string;
  text: string;
  description: string;
  dc: number | null;
  skillCheck: string | null;
  modifier: string | null;
  createdBy: string;
}

interface GroupVote {
  choiceId: string;
  characterId: number | null;
  characterName: string;
  userId: number;
  timestamp: string;
}

interface GroupChoicePanelProps {
  campaignId: number;
  activeChoices: Choice[];
  votes: GroupVote[];
  status: string; // 'none' | 'pending' | 'resolved'
  resolution?: {
    winningChoiceId: string;
    winningChoice: Choice;
    method: string;
    voteCounts: Record<string, number>;
    totalVotes: number;
  };
  participantCount: number;
  isDM: boolean;
}

export function GroupChoicePanel({
  campaignId,
  activeChoices,
  votes,
  status,
  resolution,
  participantCount,
  isDM
}: GroupChoicePanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [choices, setChoices] = useState<Partial<Choice>[]>([
    { text: "", description: "", dc: null, skillCheck: null }
  ]);
  const [context, setContext] = useState("");

  // Calculate vote counts
  const voteCounts: Record<string, number> = {};
  activeChoices.forEach(c => { voteCounts[c.id] = 0; });
  votes.forEach(v => { voteCounts[v.choiceId] = (voteCounts[v.choiceId] || 0) + 1; });

  // Create choices mutation
  const createChoicesMutation = useMutation({
    mutationFn: async (choicesData: Partial<Choice>[]) => {
      const response = await apiRequest('POST', `/api/campaigns/${campaignId}/group-choices`, {
        choices: choicesData.filter(c => c.text?.trim())
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Choices Created", description: "Players can now vote on the choices" });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/dm-session-state`] });
      setIsCreating(false);
      setChoices([{ text: "", description: "", dc: null, skillCheck: null }]);
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    }
  });

  // Generate choices mutation
  const generateChoicesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/campaigns/${campaignId}/group-choices/generate`, {
        context,
        numChoices: 4
      });
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.choices) {
        setChoices(data.choices);
        toast({ title: "Choices Generated", description: "Review and edit before publishing" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Generate", description: error.message, variant: "destructive" });
    }
  });

  // Resolve vote mutation
  const resolveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/campaigns/${campaignId}/group-choices/resolve`, {});
      return await response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Vote Resolved", 
        description: `"${data.resolution.winningChoice?.text}" wins by ${data.resolution.method}`
      });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/dm-session-state`] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Resolve", description: error.message, variant: "destructive" });
    }
  });

  // Clear choices mutation
  const clearMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', `/api/campaigns/${campaignId}/group-choices`);
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Choices Cleared" });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/dm-session-state`] });
    }
  });

  const addChoice = () => {
    setChoices([...choices, { text: "", description: "", dc: null, skillCheck: null }]);
  };

  const removeChoice = (index: number) => {
    setChoices(choices.filter((_, i) => i !== index));
  };

  const updateChoice = (index: number, field: string, value: any) => {
    const updated = [...choices];
    updated[index] = { ...updated[index], [field]: value };
    setChoices(updated);
  };

  // Show resolved state
  if (status === 'resolved' && resolution) {
    return (
      <Card className="p-3 bg-green-900/20 border-green-700">
        <div className="flex items-center gap-2 mb-2">
          <Check className="h-4 w-4 text-green-400" />
          <span className="font-medium text-green-300">Vote Resolved</span>
        </div>
        <div className="p-2 rounded bg-green-900/30 border border-green-700 mb-2">
          <div className="font-medium text-green-200">{resolution.winningChoice?.text}</div>
          {resolution.winningChoice?.description && (
            <div className="text-xs text-green-300/70 mt-1">{resolution.winningChoice.description}</div>
          )}
          <div className="text-xs text-green-400 mt-1">
            Won by {resolution.method} ({resolution.totalVotes} votes)
          </div>
        </div>
        {isDM && (
          <Button size="sm" variant="outline" className="w-full" onClick={() => clearMutation.mutate()}>
            Clear & Create New
          </Button>
        )}
      </Card>
    );
  }

  // Show active voting
  if (status === 'pending' && activeChoices.length > 0) {
    return (
      <Card className="p-3 bg-amber-900/20 border-amber-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Vote className="h-4 w-4 text-amber-400" />
            <span className="font-medium text-amber-300">Group Vote Active</span>
          </div>
          <Badge variant="outline" className="text-xs bg-amber-500/20 border-amber-500/50">
            {votes.length}/{participantCount} voted
          </Badge>
        </div>
        
        <div className="space-y-2 mb-3">
          {activeChoices.map((choice) => (
            <div 
              key={choice.id}
              className="p-2 rounded bg-slate-800/50 border border-slate-700 hover:border-amber-500/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{choice.text}</div>
                  {choice.description && (
                    <div className="text-xs text-muted-foreground mt-0.5">{choice.description}</div>
                  )}
                  {choice.dc && (
                    <div className="text-xs text-amber-400 mt-1">
                      <Target className="h-3 w-3 inline mr-1" />
                      DC {choice.dc} {choice.skillCheck}
                      {choice.modifier && ` (${choice.modifier})`}
                    </div>
                  )}
                </div>
                <Badge 
                  variant="outline" 
                  className={`text-xs shrink-0 ${voteCounts[choice.id] > 0 ? 'bg-amber-500/30 border-amber-500' : 'bg-slate-700'}`}
                >
                  {voteCounts[choice.id]} vote{voteCounts[choice.id] !== 1 ? 's' : ''}
                </Badge>
              </div>
              {/* Show who voted for this */}
              {votes.filter(v => v.choiceId === choice.id).length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {votes.filter(v => v.choiceId === choice.id).map((vote, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] h-4 px-1">
                      {vote.characterName}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {isDM && (
          <div className="flex gap-2">
            <Button 
              size="sm" 
              className="flex-1 bg-amber-600 hover:bg-amber-500"
              onClick={() => resolveMutation.mutate()}
              disabled={resolveMutation.isPending || votes.length === 0}
            >
              {resolveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Resolve Vote"}
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </Card>
    );
  }

  // Show creation UI for DM
  if (isDM) {
    if (!isCreating) {
      return (
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full gap-2 border-dashed"
          onClick={() => setIsCreating(true)}
        >
          <Users className="h-4 w-4" />
          Create Group Choice
        </Button>
      );
    }

    return (
      <Card className="p-3 bg-slate-800/50 border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium text-sm">Create Group Choices</span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsCreating(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* AI Generation */}
        <div className="mb-3 p-2 rounded bg-purple-900/20 border border-purple-700/50">
          <Textarea
            placeholder="Optional: Describe the situation for AI to generate choices..."
            value={context}
            onChange={(e) => setContext(e.target.value)}
            className="text-xs min-h-[60px] bg-transparent border-none resize-none focus-visible:ring-0 p-0"
          />
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-2 gap-1 border-purple-500/50 text-purple-300 hover:bg-purple-500/20"
            onClick={() => generateChoicesMutation.mutate()}
            disabled={generateChoicesMutation.isPending}
          >
            {generateChoicesMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            Generate with AI
          </Button>
        </div>

        {/* Manual choices */}
        <div className="space-y-2 mb-3">
          {choices.map((choice, index) => (
            <div key={index} className="p-2 rounded bg-slate-900/50 border border-slate-600">
              <div className="flex gap-2 mb-1">
                <Input
                  placeholder="Choice text..."
                  value={choice.text || ""}
                  onChange={(e) => updateChoice(index, "text", e.target.value)}
                  className="text-xs h-7"
                />
                {choices.length > 1 && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeChoice(index)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <Input
                placeholder="Description (optional)"
                value={choice.description || ""}
                onChange={(e) => updateChoice(index, "description", e.target.value)}
                className="text-xs h-6 mb-1"
              />
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="DC"
                  value={choice.dc || ""}
                  onChange={(e) => updateChoice(index, "dc", e.target.value ? parseInt(e.target.value) : null)}
                  className="text-xs h-6 w-16"
                />
                <Input
                  placeholder="Skill check"
                  value={choice.skillCheck || ""}
                  onChange={(e) => updateChoice(index, "skillCheck", e.target.value)}
                  className="text-xs h-6 flex-1"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={addChoice}>
            <Plus className="h-3 w-3" />
            Add
          </Button>
          <Button 
            size="sm" 
            className="flex-1 gap-1 bg-amber-600 hover:bg-amber-500"
            onClick={() => createChoicesMutation.mutate(choices)}
            disabled={createChoicesMutation.isPending || !choices.some(c => c.text?.trim())}
          >
            {createChoicesMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Vote className="h-3 w-3" />
            )}
            Start Vote
          </Button>
        </div>
      </Card>
    );
  }

  // Non-DM with no active vote
  return null;
}
