import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import QuickPlayerInvitation from "./QuickPlayerInvitation";
import UniversalChat from "@/components/chat/UniversalChat";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  PlayCircle,
  Users,
  BookOpen,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  Target,
  Lightbulb,
  Shield,
  Zap,
  Loader2,
  Eye,
  Activity,
  Sparkles,
  Coins,
  Package,
  Star,
  Gift,
  Sword,
  Crown,
  Dice6,
  Swords,
  MapPin,
  RefreshCw,
  Send,
  Wand2,
} from "lucide-react";

interface EnhancedLiveSessionManagerProps {
  selectedCampaignId: number | null;
}

export default function EnhancedLiveSessionManager({ selectedCampaignId }: EnhancedLiveSessionManagerProps) {
  const [activeTab, setActiveTab] = useState("session-view");
  
  // Live session management states
  const [playerChoice, setPlayerChoice] = useState("");
  const [rollResult, setRollResult] = useState<any>(null);
  const [dmNotes, setDmNotes] = useState("");
  
  // Quick content generation states
  const [showQuickContentDialog, setShowQuickContentDialog] = useState(false);
  const [quickContentType, setQuickContentType] = useState("");
  const [quickContentParams, setQuickContentParams] = useState<any>({});
  
  // Combat management states
  const [showCombatDialog, setShowCombatDialog] = useState(false);
  const [combatEnemies, setCombatEnemies] = useState<any[]>([{ name: "", maxHp: 10, ac: 12, type: "custom" }]);
  const [combatEnvironment, setCombatEnvironment] = useState("");
  const [selectedMonsters, setSelectedMonsters] = useState<any[]>([]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Live session data with DM context
  const { data: liveSession, refetch: refetchLiveSession } = useQuery({
    queryKey: [`/api/campaigns/${selectedCampaignId}/live-session`],
    enabled: !!selectedCampaignId,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const { data: participants } = useQuery({
    queryKey: [`/api/campaigns/${selectedCampaignId}/participants`],
    enabled: !!selectedCampaignId,
  });

  const { data: selectedCampaign } = useQuery({
    queryKey: [`/api/campaigns/${selectedCampaignId}`],
    enabled: !!selectedCampaignId,
  });

  const { data: availableMonsters } = useQuery({
    queryKey: ['/api/monsters'],
    enabled: showCombatDialog,
  });

  // Story advancement mutation
  const advanceStoryMutation = useMutation({
    mutationFn: async ({ choice, rollResult }: { choice: string; rollResult?: any }) => {
      const response = await fetch(`/api/campaigns/${selectedCampaignId}/advance-story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ choice, rollResult }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to advance story');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Story Advanced",
        description: "The narrative has been updated based on player choice.",
      });
      refetchLiveSession();
      setPlayerChoice("");
      setRollResult(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Quick content generation mutation
  const generateQuickContentMutation = useMutation({
    mutationFn: async ({ contentType, parameters }: { contentType: string; parameters: any }) => {
      const response = await fetch(`/api/campaigns/${selectedCampaignId}/generate-quick-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ contentType, parameters }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate content');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Content Generated",
        description: `${data.type} has been added to your session.`,
      });
      setShowQuickContentDialog(false);
      refetchLiveSession();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Combat management mutations
  const startCombatMutation = useMutation({
    mutationFn: async ({ enemies, environment }: { enemies: any[]; environment: string }) => {
      const response = await fetch(`/api/campaigns/${selectedCampaignId}/start-combat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enemies, environment }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start combat');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Combat Started",
        description: "Initiative has been rolled and combat begins!",
      });
      setShowCombatDialog(false);
      refetchLiveSession();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const combatActionMutation = useMutation({
    mutationFn: async ({ action, target, rollResult }: { action: string; target?: string; rollResult?: any }) => {
      const response = await fetch(`/api/campaigns/${selectedCampaignId}/combat-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, target, rollResult }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to process combat action');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Combat Action",
        description: data.narrative,
      });
      refetchLiveSession();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAdvanceStory = () => {
    if (!playerChoice.trim()) {
      toast({
        title: "Missing Choice",
        description: "Please enter what the player chose to do.",
        variant: "destructive",
      });
      return;
    }
    
    advanceStoryMutation.mutate({ choice: playerChoice, rollResult });
  };

  const handleGenerateQuickContent = () => {
    generateQuickContentMutation.mutate({
      contentType: quickContentType,
      parameters: quickContentParams,
    });
  };

  // Handle adding existing monsters to combat
  const handleAddMonster = (monster: any) => {
    const monsterEnemy = {
      name: monster.name,
      maxHp: monster.hitPoints || 30,
      ac: monster.armorClass || 12,
      type: "monster",
      monsterId: monster.id,
      challengeRating: monster.challengeRating,
      actions: monster.actions,
      abilities: {
        strength: monster.strength,
        dexterity: monster.dexterity,
        constitution: monster.constitution,
        intelligence: monster.intelligence,
        wisdom: monster.wisdom,
        charisma: monster.charisma
      }
    };
    
    setSelectedMonsters([...selectedMonsters, monsterEnemy]);
  };

  // Handle removing monster from combat
  const handleRemoveMonster = (index: number) => {
    const newSelectedMonsters = selectedMonsters.filter((_, i) => i !== index);
    setSelectedMonsters(newSelectedMonsters);
  };

  const handleStartCombat = () => {
    const customEnemies = combatEnemies.filter(e => e.name && e.type === "custom");
    const allEnemies = [...customEnemies, ...selectedMonsters];
    
    if (allEnemies.length === 0) {
      toast({
        title: "No Enemies",
        description: "Please add at least one enemy or monster to start combat.",
        variant: "destructive",
      });
      return;
    }
    
    startCombatMutation.mutate({ enemies: allEnemies, environment: combatEnvironment });
  };

  if (!selectedCampaignId) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Campaign Selected</h3>
          <p className="text-muted-foreground">
            Select a campaign to begin live session management.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="session-view">Live Session</TabsTrigger>
          <TabsTrigger value="story-control">Story Control</TabsTrigger>
          <TabsTrigger value="quick-content">Quick Content</TabsTrigger>
          <TabsTrigger value="combat">Combat Manager</TabsTrigger>
          <TabsTrigger value="invitations">Invite Players</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
        </TabsList>

        {/* Live Session View - Issue #2: DM visibility into what players see */}
        <TabsContent value="session-view" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Player View */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Player View
                </CardTitle>
                <CardDescription>
                  What your players are currently seeing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {liveSession ? (
                  <>
                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2">Current Narrative</h4>
                      <p className="text-sm leading-relaxed">
                        {liveSession.narrative || "No active narrative"}
                      </p>
                    </div>
                    
                    {liveSession.choices && liveSession.choices.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Available Choices</h4>
                        <div className="space-y-2">
                          {liveSession.choices.map((choice: any, index: number) => (
                            <div key={index} className="p-3 border rounded-lg">
                              <p className="text-sm font-medium">{choice.text}</p>
                              {choice.type && (
                                <Badge variant="secondary" className="mt-1 text-xs">
                                  {choice.type}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">No active session</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* DM View */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5" />
                  DM Context
                </CardTitle>
                <CardDescription>
                  Enhanced information for dungeon masters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {liveSession?.dmView ? (
                  <>
                    <div className="p-4 bg-primary/10 rounded-lg">
                      <h4 className="font-medium mb-2">DM Narrative</h4>
                      <p className="text-sm leading-relaxed">
                        {liveSession.dmView.dmNarrative || liveSession.narrative}
                      </p>
                    </div>
                    
                    {liveSession.dmView.storyState && (
                      <div>
                        <h4 className="font-medium mb-2">Story State</h4>
                        <div className="text-xs space-y-1">
                          <p><strong>Location:</strong> {liveSession.dmView.storyState.location || "Unknown"}</p>
                          <p><strong>Active NPCs:</strong> {liveSession.dmView.storyState.activeNPCs?.join(", ") || "None"}</p>
                          <p><strong>Plot Points:</strong> {liveSession.dmView.storyState.plotPoints?.join(", ") || "None"}</p>
                        </div>
                      </div>
                    )}
                    
                    {liveSession.dmView.playerChoicesMade && liveSession.dmView.playerChoicesMade.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Recent Player Choices</h4>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {liveSession.dmView.playerChoicesMade.slice(-3).map((choice: any, index: number) => (
                            <div key={index} className="p-2 bg-muted rounded text-xs">
                              <p><strong>Choice:</strong> {choice.choice}</p>
                              {choice.rollResult && (
                                <p><strong>Roll:</strong> {choice.rollResult.total}</p>
                              )}
                              <p><strong>Result:</strong> {choice.consequences}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Crown className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">No DM context available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Session Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Session Status
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchLiveSession()}
                  className="ml-auto"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{participants?.length || 0}</div>
                  <div className="text-sm text-muted-foreground">Players</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {liveSession?.isInCombat ? "Combat" : "Exploration"}
                  </div>
                  <div className="text-sm text-muted-foreground">Mode</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {liveSession?.sessionNumber || 1}
                  </div>
                  <div className="text-sm text-muted-foreground">Session</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {liveSession?.dmView?.quickContentGenerated?.length || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Quick Items</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Story Control - Issue #1: Story continuity based on player choices */}
        <TabsContent value="story-control" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Story Advancement Control
              </CardTitle>
              <CardDescription>
                Advance the story based on player choices and dice rolls
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="player-choice">Player Choice Made</Label>
                  <Textarea
                    id="player-choice"
                    placeholder="Describe what the player(s) chose to do..."
                    value={playerChoice}
                    onChange={(e) => setPlayerChoice(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="dice-type">Dice Roll (Optional)</Label>
                    <Select onValueChange={(value) => setRollResult({...rollResult, diceType: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select dice" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="d20">d20</SelectItem>
                        <SelectItem value="d12">d12</SelectItem>
                        <SelectItem value="d10">d10</SelectItem>
                        <SelectItem value="d8">d8</SelectItem>
                        <SelectItem value="d6">d6</SelectItem>
                        <SelectItem value="d4">d4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="roll-result">Roll Result</Label>
                    <Input
                      id="roll-result"
                      type="number"
                      placeholder="Roll result"
                      onChange={(e) => setRollResult({...rollResult, result: parseInt(e.target.value)})}
                    />
                  </div>

                  <div>
                    <Label htmlFor="modifier">Modifier</Label>
                    <Input
                      id="modifier"
                      type="number"
                      placeholder="0"
                      onChange={(e) => setRollResult({...rollResult, modifier: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleAdvanceStory}
                  disabled={advanceStoryMutation.isPending || !playerChoice.trim()}
                  className="w-full"
                >
                  {advanceStoryMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Advance Story Based on Choice
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quick Content Generation - Issue #3: Generate content on the fly */}
        <TabsContent value="quick-content" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={() => {
                setQuickContentType("encounter");
                setShowQuickContentDialog(true);
              }}
              className="h-20 flex-col"
            >
              <Swords className="h-8 w-8 mb-2" />
              Generate Encounter
            </Button>

            <Button
              onClick={() => {
                setQuickContentType("loot");
                setShowQuickContentDialog(true);
              }}
              className="h-20 flex-col"
            >
              <Package className="h-8 w-8 mb-2" />
              Generate Loot
            </Button>

            <Button
              onClick={() => {
                setQuickContentType("npc");
                setShowQuickContentDialog(true);
              }}
              className="h-20 flex-col"
            >
              <Users className="h-8 w-8 mb-2" />
              Generate NPC
            </Button>
          </div>

          {/* Show generated content */}
          {liveSession?.dmView?.quickContentGenerated && liveSession.dmView.quickContentGenerated.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recently Generated Content</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {liveSession.dmView.quickContentGenerated.slice(-5).map((content: any, index: number) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge>{content.type}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(content.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      {content.type === "encounter" && (
                        <div>
                          <h4 className="font-medium">{content.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{content.description}</p>
                        </div>
                      )}
                      
                      {content.type === "loot" && (
                        <div>
                          <h4 className="font-medium">Treasure Found</h4>
                          <div className="text-sm mt-1">
                            {content.items?.map((item: any, idx: number) => (
                              <div key={idx} className="flex justify-between">
                                <span>{item.name}</span>
                                <span className="text-muted-foreground">{item.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {content.type === "npc" && (
                        <div>
                          <h4 className="font-medium">{content.name}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{content.appearance}</p>
                          <p className="text-sm mt-1"><strong>Attitude:</strong> {content.attitude}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Combat Manager - Issue #4: Combat scenarios with AI help */}
        <TabsContent value="combat" className="space-y-4">
          {!liveSession?.isInCombat ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sword className="h-5 w-5" />
                  Start Combat Encounter
                </CardTitle>
                <CardDescription>
                  Initialize a combat scenario for your players
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={() => setShowCombatDialog(true)}
                  className="w-full"
                >
                  <Sword className="h-4 w-4 mr-2" />
                  Configure and Start Combat
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Active Combat
                </CardTitle>
                <CardDescription>
                  Manage the ongoing combat encounter
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {liveSession.combatState && (
                  <div>
                    <h4 className="font-medium mb-2">Initiative Order</h4>
                    <div className="space-y-2">
                      {liveSession.combatState.participants?.map((participant: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded">
                          <span>{participant.character?.name || participant.name}</span>
                          <div className="flex items-center gap-2">
                            <Badge>{participant.initiative}</Badge>
                            <span className="text-sm">{participant.hp}/{participant.maxHp} HP</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Button
                    onClick={() => combatActionMutation.mutate({ action: "next_turn" })}
                    disabled={combatActionMutation.isPending}
                  >
                    Next Turn
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => combatActionMutation.mutate({ action: "end_combat" })}
                    disabled={combatActionMutation.isPending}
                  >
                    End Combat
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Player Invitations Tab - Quick player invitation system */}
        <TabsContent value="invitations" className="space-y-4">
          {selectedCampaign && (
            <QuickPlayerInvitation 
              campaignId={selectedCampaignId}
              campaignTitle={selectedCampaign.title}
            />
          )}
        </TabsContent>

        {/* Chat Tab - Universal chat system */}
        <TabsContent value="chat" className="space-y-4">
          <div className="flex justify-center">
            <UniversalChat 
              currentCampaignId={selectedCampaignId || undefined}
              currentCampaignTitle={selectedCampaign?.title}
              className="w-full max-w-4xl"
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Quick Content Generation Dialog */}
      <Dialog open={showQuickContentDialog} onOpenChange={setShowQuickContentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate {quickContentType}</DialogTitle>
            <DialogDescription>
              Customize the parameters for content generation
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {quickContentType === "encounter" && (
              <>
                <div>
                  <Label>Party Level</Label>
                  <Select onValueChange={(value) => setQuickContentParams({...quickContentParams, partyLevel: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select level range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-3">Level 1-3</SelectItem>
                      <SelectItem value="4-6">Level 4-6</SelectItem>
                      <SelectItem value="7-10">Level 7-10</SelectItem>
                      <SelectItem value="11-15">Level 11-15</SelectItem>
                      <SelectItem value="16-20">Level 16-20</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Difficulty</Label>
                  <Select onValueChange={(value) => setQuickContentParams({...quickContentParams, difficulty: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                      <SelectItem value="deadly">Deadly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            
            {quickContentType === "loot" && (
              <>
                <div>
                  <Label>Value Tier</Label>
                  <Select onValueChange={(value) => setQuickContentParams({...quickContentParams, tier: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select value tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="common">Common</SelectItem>
                      <SelectItem value="uncommon">Uncommon</SelectItem>
                      <SelectItem value="rare">Rare</SelectItem>
                      <SelectItem value="very-rare">Very Rare</SelectItem>
                      <SelectItem value="legendary">Legendary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            
            {quickContentType === "npc" && (
              <>
                <div>
                  <Label>NPC Role</Label>
                  <Select onValueChange={(value) => setQuickContentParams({...quickContentParams, role: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select NPC role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="helpful">Helpful</SelectItem>
                      <SelectItem value="neutral">Neutral</SelectItem>
                      <SelectItem value="suspicious">Suspicious</SelectItem>
                      <SelectItem value="hostile">Hostile</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            
            <Button
              onClick={handleGenerateQuickContent}
              disabled={generateQuickContentMutation.isPending}
              className="w-full"
            >
              {generateQuickContentMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 mr-2" />
              )}
              Generate Content
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Combat Setup Dialog */}
      <Dialog open={showCombatDialog} onOpenChange={setShowCombatDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Combat Configuration</DialogTitle>
            <DialogDescription>
              Set up enemies and environment for the combat encounter
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Environment</Label>
              <Input
                placeholder="Describe the combat environment..."
                value={combatEnvironment}
                onChange={(e) => setCombatEnvironment(e.target.value)}
              />
            </div>
            
            {/* Existing Monsters Section */}
            <div>
              <Label>Add Existing Monsters</Label>
              <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2">
                {availableMonsters && availableMonsters.length > 0 ? (
                  availableMonsters.map((monster: any) => (
                    <div key={monster.id} className="flex items-center justify-between p-2 border rounded hover:bg-muted/50">
                      <div className="flex-1">
                        <div className="font-medium">{monster.name}</div>
                        <div className="text-sm text-muted-foreground">
                          CR {monster.challengeRating} • HP {monster.hitPoints} • AC {monster.armorClass}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddMonster(monster)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    No monsters available
                  </div>
                )}
              </div>
            </div>

            {/* Selected Monsters Display */}
            {selectedMonsters.length > 0 && (
              <div>
                <Label>Selected Monsters</Label>
                <div className="space-y-2">
                  {selectedMonsters.map((monster, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded bg-blue-50">
                      <div>
                        <div className="font-medium">{monster.name}</div>
                        <div className="text-sm text-muted-foreground">
                          HP {monster.maxHp} • AC {monster.ac} • CR {monster.challengeRating}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveMonster(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>Custom Enemies</Label>
              <div className="space-y-2">
                {combatEnemies.map((enemy, index) => (
                  <div key={index} className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder="Enemy name"
                      value={enemy.name}
                      onChange={(e) => {
                        const newEnemies = [...combatEnemies];
                        newEnemies[index].name = e.target.value;
                        setCombatEnemies(newEnemies);
                      }}
                    />
                    <Input
                      placeholder="Max HP"
                      type="number"
                      value={enemy.maxHp}
                      onChange={(e) => {
                        const newEnemies = [...combatEnemies];
                        newEnemies[index].maxHp = parseInt(e.target.value) || 10;
                        setCombatEnemies(newEnemies);
                      }}
                    />
                    <Input
                      placeholder="AC"
                      type="number"
                      value={enemy.ac}
                      onChange={(e) => {
                        const newEnemies = [...combatEnemies];
                        newEnemies[index].ac = parseInt(e.target.value) || 12;
                        setCombatEnemies(newEnemies);
                      }}
                    />
                  </div>
                ))}
              </div>
              
              <Button
                variant="outline"
                onClick={() => setCombatEnemies([...combatEnemies, { name: "", maxHp: 10, ac: 12, type: "custom" }])}
                className="w-full mt-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Custom Enemy
              </Button>
            </div>
            
            <Button
              onClick={handleStartCombat}
              disabled={startCombatMutation.isPending}
              className="w-full"
            >
              {startCombatMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sword className="h-4 w-4 mr-2" />
              )}
              Start Combat
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}