import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Loader2, 
  Play, 
  Pause, 
  Users, 
  Swords, 
  Heart, 
  Shield, 
  Zap, 
  Target,
  Plus,
  Dice6,
  Clock,
  MapPin,
  Sparkles,
  Send
} from "lucide-react";

interface CombatParticipant {
  id: string;
  name: string;
  type: 'player' | 'npc' | 'monster';
  hp: number;
  maxHp: number;
  ac: number;
  initiative: number;
  status: string[];
  notes: string;
}

interface LiveCampaignManagerTabProps {
  selectedCampaignId: number | null;
}

export default function LiveCampaignManagerTab({ selectedCampaignId }: LiveCampaignManagerTabProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("combat");
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [round, setRound] = useState(1);
  const [combatants, setCombatants] = useState<CombatParticipant[]>([]);
  const [quickPrompt, setQuickPrompt] = useState("");

  // Fetch campaign data
  const { data: campaign } = useQuery<any>({
    queryKey: [`/api/campaigns/${selectedCampaignId}`],
    enabled: !!selectedCampaignId
  });

  // Fetch current session state
  const { data: sessionState } = useQuery<any>({
    queryKey: [`/api/campaigns/${selectedCampaignId}/session-state`],
    enabled: !!selectedCampaignId,
    refetchInterval: 5000 // Refresh every 5 seconds during live play
  });

  // Fetch campaign participants
  const { data: participants = [] } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${selectedCampaignId}/participants`],
    enabled: !!selectedCampaignId
  });

  // Quick AI generation mutation
  const quickGenerateMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const response = await apiRequest('POST', '/api/dm-toolkit/quick-generate', {
        prompt,
        campaignId: selectedCampaignId,
        context: 'live-session'
      });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Content Generated",
        description: "AI has generated content for your session."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate content.",
        variant: "destructive"
      });
    }
  });

  // Advance story mutation
  const advanceStoryMutation = useMutation({
    mutationFn: async (storyData: any) => {
      const response = await apiRequest('POST', '/api/campaigns/advance-story', storyData);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Story Advanced",
        description: "The story has been advanced successfully."
      });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${selectedCampaignId}/sessions`] });
    },
    onError: (error: any) => {
      toast({
        title: "Story Advancement Failed",
        description: error.message || "Failed to advance the story.",
        variant: "destructive"
      });
    }
  });

  const handleQuickGenerate = () => {
    if (!quickPrompt.trim()) return;
    quickGenerateMutation.mutate(quickPrompt);
    setQuickPrompt("");
  };

  const handleAdvanceStory = (prompt: string) => {
    if (!selectedCampaignId) return;
    
    advanceStoryMutation.mutate({
      campaignId: selectedCampaignId,
      prompt,
      narrativeStyle: campaign?.narrativeStyle || "descriptive",
      difficulty: campaign?.difficulty || "Normal",
      storyDirection: "balanced"
    });
  };

  const addCombatant = () => {
    const newCombatant: CombatParticipant = {
      id: Date.now().toString(),
      name: "",
      type: 'monster',
      hp: 10,
      maxHp: 10,
      ac: 12,
      initiative: 10,
      status: [],
      notes: ""
    };
    setCombatants([...combatants, newCombatant]);
  };

  const updateCombatant = (id: string, updates: Partial<CombatParticipant>) => {
    setCombatants(combatants.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const removeCombatant = (id: string) => {
    setCombatants(combatants.filter(c => c.id !== id));
  };

  const nextTurn = () => {
    if (combatants.length === 0) return;
    
    const nextTurnIndex = (currentTurn + 1) % combatants.length;
    if (nextTurnIndex === 0) {
      setRound(round + 1);
    }
    setCurrentTurn(nextTurnIndex);
  };

  const sortCombatantsByInitiative = () => {
    const sorted = [...combatants].sort((a, b) => b.initiative - a.initiative);
    setCombatants(sorted);
    setCurrentTurn(0);
  };

  if (!selectedCampaignId) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Campaign Selected</h3>
            <p className="text-muted-foreground">
              Select a campaign from the dropdown above to start live management
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Campaign Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Live Campaign: {campaign?.title}
              </CardTitle>
              <CardDescription>
                Real-time campaign management and AI assistance
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isSessionActive ? "default" : "secondary"}>
                {isSessionActive ? "Session Active" : "Session Paused"}
              </Badge>
              <Button
                variant={isSessionActive ? "destructive" : "default"}
                onClick={() => setIsSessionActive(!isSessionActive)}
              >
                {isSessionActive ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                {isSessionActive ? "Pause Session" : "Start Session"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Quick AI Generation */}
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Quick AI generation (e.g., 'Generate a tavern encounter', 'Create mysterious NPC')"
              value={quickPrompt}
              onChange={(e) => setQuickPrompt(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleQuickGenerate()}
            />
            <Button 
              onClick={handleQuickGenerate}
              disabled={quickGenerateMutation.isPending || !quickPrompt.trim()}
            >
              {quickGenerateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="combat">Combat Tracker</TabsTrigger>
          <TabsTrigger value="players">Player Status</TabsTrigger>
          <TabsTrigger value="story">Story Tools</TabsTrigger>
          <TabsTrigger value="quick">Quick Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="combat" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Swords className="h-5 w-5" />
                  Combat Tracker
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Round {round}</Badge>
                  <Button onClick={sortCombatantsByInitiative} variant="outline" size="sm">
                    Sort by Initiative
                  </Button>
                  <Button onClick={addCombatant} size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Combatant
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {combatants.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No combatants added yet. Click "Add Combatant" to start combat.
                </div>
              ) : (
                <div className="space-y-2">
                  {combatants.map((combatant, index) => (
                    <div 
                      key={combatant.id} 
                      className={`border rounded-lg p-3 ${index === currentTurn ? 'border-primary bg-primary/5' : ''}`}
                    >
                      <div className="grid grid-cols-8 gap-2 items-center">
                        <Input
                          placeholder="Name"
                          value={combatant.name}
                          onChange={(e) => updateCombatant(combatant.id, { name: e.target.value })}
                          className="col-span-2"
                        />
                        <Select 
                          value={combatant.type} 
                          onValueChange={(value: 'player' | 'npc' | 'monster') => 
                            updateCombatant(combatant.id, { type: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="player">Player</SelectItem>
                            <SelectItem value="npc">NPC</SelectItem>
                            <SelectItem value="monster">Monster</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1">
                          <Heart className="h-4 w-4" />
                          <Input
                            type="number"
                            value={combatant.hp}
                            onChange={(e) => updateCombatant(combatant.id, { hp: parseInt(e.target.value) || 0 })}
                            className="w-16"
                          />
                          /
                          <Input
                            type="number"
                            value={combatant.maxHp}
                            onChange={(e) => updateCombatant(combatant.id, { maxHp: parseInt(e.target.value) || 0 })}
                            className="w-16"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <Shield className="h-4 w-4" />
                          <Input
                            type="number"
                            value={combatant.ac}
                            onChange={(e) => updateCombatant(combatant.id, { ac: parseInt(e.target.value) || 0 })}
                            className="w-16"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <Zap className="h-4 w-4" />
                          <Input
                            type="number"
                            value={combatant.initiative}
                            onChange={(e) => updateCombatant(combatant.id, { initiative: parseInt(e.target.value) || 0 })}
                            className="w-16"
                          />
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => removeCombatant(combatant.id)}
                        >
                          Remove
                        </Button>
                      </div>
                      {index === currentTurn && (
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="default">Current Turn</Badge>
                          <Button onClick={nextTurn} size="sm">
                            Next Turn
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="players" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Player Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {participants.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No players in this campaign yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {participants.map((participant: any) => (
                    <div key={participant.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">Player {participant.userId}</h4>
                        <Badge variant={participant.isActive ? "default" : "secondary"}>
                          {participant.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Role: {participant.role}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="story" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Story Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  onClick={() => handleAdvanceStory("Continue the story based on recent player actions")}
                  disabled={advanceStoryMutation.isPending}
                  className="w-full"
                >
                  {advanceStoryMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Advance Story
                </Button>
                <Button
                  onClick={() => handleAdvanceStory("Generate a random encounter appropriate for this location")}
                  disabled={advanceStoryMutation.isPending}
                  variant="outline"
                  className="w-full"
                >
                  Random Encounter
                </Button>
                <Button
                  onClick={() => handleAdvanceStory("Introduce a plot twist or complication")}
                  disabled={advanceStoryMutation.isPending}
                  variant="outline"
                  className="w-full"
                >
                  Plot Twist
                </Button>
                <Button
                  onClick={() => handleAdvanceStory("Present the party with a moral dilemma or choice")}
                  disabled={advanceStoryMutation.isPending}
                  variant="outline"
                  className="w-full"
                >
                  Moral Choice
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quick" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Button variant="outline" className="h-16 flex-col">
                  <Dice6 className="h-6 w-6 mb-1" />
                  Roll Dice
                </Button>
                <Button variant="outline" className="h-16 flex-col">
                  <Users className="h-6 w-6 mb-1" />
                  Add NPC
                </Button>
                <Button variant="outline" className="h-16 flex-col">
                  <MapPin className="h-6 w-6 mb-1" />
                  Change Location
                </Button>
                <Button variant="outline" className="h-16 flex-col">
                  <Swords className="h-6 w-6 mb-1" />
                  Start Combat
                </Button>
                <Button variant="outline" className="h-16 flex-col">
                  <Heart className="h-6 w-6 mb-1" />
                  Heal Party
                </Button>
                <Button variant="outline" className="h-16 flex-col">
                  <Clock className="h-6 w-6 mb-1" />
                  Time Skip
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}