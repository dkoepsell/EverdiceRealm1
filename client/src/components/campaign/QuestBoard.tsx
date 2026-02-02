import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  Scroll, 
  Plus, 
  Coins, 
  Star, 
  Clock, 
  Shield, 
  Swords, 
  Check, 
  X, 
  AlertTriangle,
  Trophy,
  Users,
  Map,
  MessageSquare
} from 'lucide-react';

interface QuestBoardProps {
  campaignId: number;
  isDM: boolean;
  activeCharacter?: any;
  userId?: number;
}

interface BoardQuest {
  id: number;
  title: string;
  description: string;
  questType: string;
  status: string;
  xpReward: number;
  goldReward: number;
  silverReward?: number;
  lootRewards?: string[];
  objectives?: { text: string; completed: boolean }[];
  difficultyRating: string;
  estimatedDuration?: string;
  prerequisites?: string;
  isPostedToBoard: boolean;
  postedAt?: string;
  acceptedByCharacterId?: number;
  acceptedByUserId?: number;
  acceptedAt?: string;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  moderate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  challenging: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  deadly: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
};

const QUEST_TYPE_ICONS: Record<string, React.ReactNode> = {
  main: <Star className="h-4 w-4" />,
  side: <Map className="h-4 w-4" />,
  combat: <Swords className="h-4 w-4" />,
  exploration: <Map className="h-4 w-4" />,
  social: <MessageSquare className="h-4 w-4" />
};

export function QuestBoard({ campaignId, isDM, activeCharacter, userId }: QuestBoardProps) {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newQuest, setNewQuest] = useState({
    title: '',
    description: '',
    questType: 'side',
    xpReward: 100,
    goldReward: 50,
    difficultyRating: 'moderate',
    estimatedDuration: '1 session',
    prerequisites: ''
  });

  const { data: boardQuests, isLoading, isError, refetch } = useQuery<BoardQuest[]>({
    queryKey: ['/api/campaigns', campaignId, 'quest-board'],
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/quest-board`);
      if (!response.ok) throw new Error('Failed to fetch quest board');
      return response.json();
    }
  });

  const createQuestMutation = useMutation({
    mutationFn: async (questData: typeof newQuest) => {
      return apiRequest('POST', `/api/campaigns/${campaignId}/quest-board`, questData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'quest-board'] });
      setIsCreateOpen(false);
      setNewQuest({
        title: '',
        description: '',
        questType: 'side',
        xpReward: 100,
        goldReward: 50,
        difficultyRating: 'moderate',
        estimatedDuration: '1 session',
        prerequisites: ''
      });
      toast({ title: 'Quest Posted', description: 'Your quest has been added to the board!' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to post quest', variant: 'destructive' });
    }
  });

  const acceptQuestMutation = useMutation({
    mutationFn: async (questId: number) => {
      return apiRequest('POST', `/api/campaigns/${campaignId}/quests/${questId}/accept`, {
        characterId: activeCharacter?.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'quest-board'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'quests'] });
      toast({ title: 'Quest Accepted!', description: 'Good luck on your adventure!' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to accept quest', variant: 'destructive' });
    }
  });

  const abandonQuestMutation = useMutation({
    mutationFn: async (questId: number) => {
      return apiRequest('POST', `/api/campaigns/${campaignId}/quests/${questId}/abandon`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'quest-board'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'quests'] });
      toast({ title: 'Quest Abandoned', description: 'The quest is available for others again.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to abandon quest', variant: 'destructive' });
    }
  });

  const removeFromBoardMutation = useMutation({
    mutationFn: async (questId: number) => {
      return apiRequest('POST', `/api/campaigns/${campaignId}/quests/${questId}/remove-from-board`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'quest-board'] });
      toast({ title: 'Quest Removed', description: 'Quest has been removed from the board.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to remove quest', variant: 'destructive' });
    }
  });

  const availableQuests = boardQuests?.filter(q => !q.acceptedByUserId) || [];
  const acceptedQuests = boardQuests?.filter(q => q.acceptedByUserId) || [];
  const myAcceptedQuests = acceptedQuests.filter(q => q.acceptedByUserId === userId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
          <h4 className="text-lg font-medium text-red-700 dark:text-red-300">Failed to Load Quest Board</h4>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1 mb-4">
            There was an error loading the quest board. Please try again.
          </p>
          <Button onClick={() => refetch()} variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <Scroll className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Quest Board</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {availableQuests.length} quest{availableQuests.length !== 1 ? 's' : ''} available
            </p>
          </div>
        </div>
        
        {isDM && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-amber-500 hover:bg-amber-600 text-slate-900">
                <Plus className="h-4 w-4 mr-2" />
                Post Quest
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Scroll className="h-5 w-5 text-amber-500" />
                  Post New Quest
                </DialogTitle>
                <DialogDescription>
                  Create a quest for your players to discover and accept.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Quest Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Clear the Goblin Camp"
                    value={newQuest.title}
                    onChange={(e) => setNewQuest({ ...newQuest, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the quest and its objectives..."
                    value={newQuest.description}
                    onChange={(e) => setNewQuest({ ...newQuest, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quest Type</Label>
                    <Select
                      value={newQuest.questType}
                      onValueChange={(value) => setNewQuest({ ...newQuest, questType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="main">Main Quest</SelectItem>
                        <SelectItem value="side">Side Quest</SelectItem>
                        <SelectItem value="combat">Combat</SelectItem>
                        <SelectItem value="exploration">Exploration</SelectItem>
                        <SelectItem value="social">Social</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Difficulty</Label>
                    <Select
                      value={newQuest.difficultyRating}
                      onValueChange={(value) => setNewQuest({ ...newQuest, difficultyRating: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="challenging">Challenging</SelectItem>
                        <SelectItem value="deadly">Deadly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="xpReward">XP Reward</Label>
                    <Input
                      id="xpReward"
                      type="number"
                      value={newQuest.xpReward}
                      onChange={(e) => setNewQuest({ ...newQuest, xpReward: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="goldReward">Gold Reward</Label>
                    <Input
                      id="goldReward"
                      type="number"
                      value={newQuest.goldReward}
                      onChange={(e) => setNewQuest({ ...newQuest, goldReward: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Estimated Duration</Label>
                  <Input
                    id="duration"
                    placeholder="e.g., 1-2 sessions"
                    value={newQuest.estimatedDuration}
                    onChange={(e) => setNewQuest({ ...newQuest, estimatedDuration: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prerequisites">Prerequisites (optional)</Label>
                  <Input
                    id="prerequisites"
                    placeholder="e.g., Level 3+, Completed 'The Lost Key'"
                    value={newQuest.prerequisites}
                    onChange={(e) => setNewQuest({ ...newQuest, prerequisites: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createQuestMutation.mutate(newQuest)}
                  disabled={!newQuest.title || !newQuest.description || createQuestMutation.isPending}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-900"
                >
                  {createQuestMutation.isPending ? 'Posting...' : 'Post Quest'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {myAcceptedQuests.length > 0 && (
        <>
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-slate-900 dark:text-white">
              <Trophy className="h-5 w-5 text-amber-500" />
              Your Active Quests
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {myAcceptedQuests.map((quest) => (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                  isDM={isDM}
                  isAccepted
                  isOwn
                  onAbandon={() => abandonQuestMutation.mutate(quest.id)}
                  isLoading={abandonQuestMutation.isPending}
                />
              ))}
            </div>
          </div>
          <Separator />
        </>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-slate-900 dark:text-white">
          <Shield className="h-5 w-5 text-amber-500" />
          Available Quests
        </h3>
        {availableQuests.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-300 dark:border-slate-700">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Scroll className="h-12 w-12 text-slate-400 mb-4" />
              <h4 className="text-lg font-medium text-slate-600 dark:text-slate-400">No Quests Available</h4>
              <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
                {isDM ? 'Post a quest for your players to discover!' : 'Check back later for new adventures.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {availableQuests.map((quest) => (
              <QuestCard
                key={quest.id}
                quest={quest}
                isDM={isDM}
                onAccept={() => acceptQuestMutation.mutate(quest.id)}
                onRemove={() => removeFromBoardMutation.mutate(quest.id)}
                isLoading={acceptQuestMutation.isPending || removeFromBoardMutation.isPending}
                canAccept={!!activeCharacter}
              />
            ))}
          </div>
        )}
      </div>

      {acceptedQuests.filter(q => q.acceptedByUserId !== userId).length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <Users className="h-5 w-5" />
              Quests In Progress (Other Players)
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {acceptedQuests.filter(q => q.acceptedByUserId !== userId).map((quest) => (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                  isDM={isDM}
                  isAccepted
                  onRemove={isDM ? () => removeFromBoardMutation.mutate(quest.id) : undefined}
                  isLoading={removeFromBoardMutation.isPending}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface QuestCardProps {
  quest: BoardQuest;
  isDM: boolean;
  isAccepted?: boolean;
  isOwn?: boolean;
  onAccept?: () => void;
  onAbandon?: () => void;
  onRemove?: () => void;
  isLoading?: boolean;
  canAccept?: boolean;
}

function QuestCard({ quest, isDM, isAccepted, isOwn, onAccept, onAbandon, onRemove, isLoading, canAccept = true }: QuestCardProps) {
  return (
    <Card className={`transition-all hover:shadow-md ${isAccepted ? 'border-amber-500/50 bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-amber-500">
              {QUEST_TYPE_ICONS[quest.questType] || <Scroll className="h-4 w-4" />}
            </span>
            <CardTitle className="text-base">{quest.title}</CardTitle>
          </div>
          <Badge className={DIFFICULTY_COLORS[quest.difficultyRating] || DIFFICULTY_COLORS.moderate}>
            {quest.difficultyRating}
          </Badge>
        </div>
        <CardDescription className="line-clamp-2 mt-1">
          {quest.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="flex flex-wrap gap-2 text-sm">
          <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
            <Star className="h-3.5 w-3.5" />
            <span>{quest.xpReward} XP</span>
          </div>
          {quest.goldReward > 0 && (
            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Coins className="h-3.5 w-3.5" />
              <span>{quest.goldReward} gold</span>
            </div>
          )}
          {quest.estimatedDuration && (
            <div className="flex items-center gap-1 text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              <span>{quest.estimatedDuration}</span>
            </div>
          )}
        </div>
        {quest.prerequisites && (
          <div className="mt-2 flex items-start gap-1.5 text-xs text-orange-600 dark:text-orange-400">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{quest.prerequisites}</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-2">
        {isAccepted && isOwn && onAbandon && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAbandon}
            disabled={isLoading}
            className="w-full border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
          >
            <X className="h-4 w-4 mr-2" />
            Abandon Quest
          </Button>
        )}
        {!isAccepted && !isDM && onAccept && (
          <Button
            size="sm"
            onClick={onAccept}
            disabled={isLoading || !canAccept}
            className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900"
          >
            <Check className="h-4 w-4 mr-2" />
            {!canAccept ? 'Select a character first' : 'Accept Quest'}
          </Button>
        )}
        {isDM && onRemove && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRemove}
            disabled={isLoading}
            className="w-full"
          >
            <X className="h-4 w-4 mr-2" />
            Remove from Board
          </Button>
        )}
        {isAccepted && !isOwn && !isDM && (
          <div className="text-sm text-slate-500 italic w-full text-center">
            Quest in progress...
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
