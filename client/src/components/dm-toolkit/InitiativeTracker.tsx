import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { 
  Play, 
  Pause, 
  SkipForward, 
  RotateCcw, 
  Plus, 
  Dice6,
  Clock,
  Target,
  Users,
  Swords,
  Trash2
} from "lucide-react";

interface InitiativeEntry {
  id: string;
  name: string;
  type: 'player' | 'npc' | 'monster';
  initiative: number;
  hp: number;
  maxHp: number;
  ac: number;
  conditions: string[];
  isActive: boolean;
  hasActed: boolean;
  characterId?: number;
}

interface InitiativeTrackerProps {
  campaignId: number;
}

export default function InitiativeTracker({ campaignId }: InitiativeTrackerProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [round, setRound] = useState(1);
  const [turnTimer, setTurnTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [newEntry, setNewEntry] = useState({
    name: '',
    type: 'monster' as const,
    initiative: 0,
    hp: 1,
    maxHp: 1,
    ac: 10
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch initiative order
  const { data: initiatives = [], isLoading } = useQuery<InitiativeEntry[]>({
    queryKey: [`/api/campaigns/${campaignId}/initiative`],
    refetchInterval: isActive ? 2000 : false,
    enabled: !!campaignId
  });

  // Turn timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && turnTimer > 0) {
      interval = setInterval(() => {
        setTurnTimer(prev => {
          if (prev <= 1) {
            setTimerActive(false);
            toast({
              title: "Turn Timer Expired",
              description: "Time's up for this turn!",
              variant: "destructive"
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, turnTimer, toast]);

  // Add entry mutation
  const addEntryMutation = useMutation({
    mutationFn: async (entry: typeof newEntry) => {
      return apiRequest(`/api/campaigns/${campaignId}/initiative`, {
        method: 'POST',
        body: JSON.stringify(entry)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/initiative`] });
      setNewEntry({
        name: '',
        type: 'monster',
        initiative: 0,
        hp: 1,
        maxHp: 1,
        ac: 10
      });
      toast({
        title: "Entry Added",
        description: "Combat participant added to initiative"
      });
    }
  });

  // Start combat mutation
  const startCombatMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/campaigns/${campaignId}/initiative/start`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      setIsActive(true);
      setCurrentTurn(0);
      setRound(1);
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/initiative`] });
      toast({
        title: "Combat Started",
        description: "Initiative order is now active"
      });
    }
  });

  // Next turn mutation
  const nextTurnMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/campaigns/${campaignId}/initiative/next-turn`, {
        method: 'POST',
        body: JSON.stringify({ currentTurn, round })
      });
    },
    onSuccess: (data) => {
      setCurrentTurn(data.nextTurn);
      setRound(data.round);
      setTurnTimer(60); // Reset timer to 60 seconds
      setTimerActive(true);
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/initiative`] });
    }
  });

  // End combat mutation
  const endCombatMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/campaigns/${campaignId}/initiative/end`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      setIsActive(false);
      setCurrentTurn(0);
      setRound(1);
      setTimerActive(false);
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/initiative`] });
      toast({
        title: "Combat Ended",
        description: "Initiative tracker has been reset"
      });
    }
  });

  // Roll initiative for all
  const rollInitiativeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/campaigns/${campaignId}/initiative/roll-all`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/initiative`] });
      toast({
        title: "Initiative Rolled",
        description: "New initiative order generated"
      });
    }
  });

  const sortedInitiatives = [...initiatives].sort((a, b) => b.initiative - a.initiative);
  const currentEntry = sortedInitiatives[currentTurn];

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold">Initiative Tracker</h3>
          {isActive && (
            <Badge variant="secondary">
              Round {round} • Turn {currentTurn + 1}
            </Badge>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {timerActive && (
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span className="font-mono text-sm">
                {formatTime(turnTimer)}
              </span>
              <Progress 
                value={(turnTimer / 60) * 100} 
                className="w-16 h-2"
              />
            </div>
          )}

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Combat Participant</DialogTitle>
                <DialogDescription>
                  Add a new character, NPC, or monster to initiative
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    value={newEntry.name}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Character name"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <select
                    value={newEntry.type}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full p-2 border rounded"
                  >
                    <option value="player">Player</option>
                    <option value="npc">NPC</option>
                    <option value="monster">Monster</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Initiative</label>
                    <Input
                      type="number"
                      value={newEntry.initiative}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, initiative: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">AC</label>
                    <Input
                      type="number"
                      value={newEntry.ac}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, ac: Number(e.target.value) }))}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Current HP</label>
                    <Input
                      type="number"
                      value={newEntry.hp}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, hp: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Max HP</label>
                    <Input
                      type="number"
                      value={newEntry.maxHp}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, maxHp: Number(e.target.value) }))}
                    />
                  </div>
                </div>
                
                <Button
                  onClick={() => addEntryMutation.mutate(newEntry)}
                  disabled={!newEntry.name || addEntryMutation.isPending}
                  className="w-full"
                >
                  {addEntryMutation.isPending ? 'Adding...' : 'Add to Initiative'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="sm"
            onClick={() => rollInitiativeMutation.mutate()}
            disabled={rollInitiativeMutation.isPending}
          >
            <Dice6 className="h-4 w-4 mr-1" />
            Roll All
          </Button>

          {!isActive ? (
            <Button
              onClick={() => startCombatMutation.mutate()}
              disabled={sortedInitiatives.length === 0 || startCombatMutation.isPending}
            >
              <Play className="h-4 w-4 mr-1" />
              Start Combat
            </Button>
          ) : (
            <div className="flex space-x-2">
              <Button
                onClick={() => nextTurnMutation.mutate()}
                disabled={nextTurnMutation.isPending}
              >
                <SkipForward className="h-4 w-4 mr-1" />
                Next Turn
              </Button>
              <Button
                variant="destructive"
                onClick={() => endCombatMutation.mutate()}
                disabled={endCombatMutation.isPending}
              >
                <Pause className="h-4 w-4 mr-1" />
                End Combat
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Initiative Order */}
      <div className="space-y-2">
        {sortedInitiatives.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                No participants in initiative. Add characters to begin combat.
              </p>
            </CardContent>
          </Card>
        ) : (
          sortedInitiatives.map((entry, index) => (
            <Card 
              key={entry.id}
              className={`transition-all ${
                isActive && index === currentTurn 
                  ? 'border-primary bg-primary/5 shadow-md' 
                  : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex flex-col items-center">
                      <Badge variant={entry.type === 'player' ? 'default' : 'secondary'}>
                        {entry.initiative}
                      </Badge>
                      <span className="text-xs text-muted-foreground mt-1">
                        Initiative
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium">{entry.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {entry.type.toUpperCase()}
                        </Badge>
                        {isActive && index === currentTurn && (
                          <Badge variant="default" className="text-xs">
                            ACTIVE
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                        <span>AC {entry.ac}</span>
                        <span>HP {entry.hp}/{entry.maxHp}</span>
                        {entry.conditions.length > 0 && (
                          <div className="flex space-x-1">
                            {entry.conditions.map((condition, i) => (
                              <Badge key={i} variant="destructive" className="text-xs">
                                {condition}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Progress 
                      value={(entry.hp / entry.maxHp) * 100}
                      className="w-16 h-2"
                    />
                    
                    {entry.hasActed && isActive && (
                      <Badge variant="secondary" className="text-xs">
                        Acted
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Current Turn Info */}
      {isActive && currentEntry && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-sm">
              <Target className="h-4 w-4 inline mr-2" />
              Current Turn: {currentEntry.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm">
              <div>
                <p>Round {round} • Initiative {currentEntry.initiative}</p>
                <p className="text-muted-foreground">
                  HP: {currentEntry.hp}/{currentEntry.maxHp} • AC: {currentEntry.ac}
                </p>
              </div>
              {timerActive && (
                <div className="text-right">
                  <p className="font-mono text-lg">{formatTime(turnTimer)}</p>
                  <p className="text-xs text-muted-foreground">Time remaining</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}