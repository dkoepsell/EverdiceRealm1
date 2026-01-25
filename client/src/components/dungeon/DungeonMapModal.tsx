import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Map, AlertTriangle, Swords, Package, Loader2, MessageCircle, HelpCircle, Scroll } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DungeonMap, type DungeonMapData, type MapEntity } from "./DungeonMap";
import { generateDungeon, movePlayer } from "./DungeonGenerator";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface EncounterChoice {
  id: string;
  text: string;
  type?: string;
  rollRequired: { type: string; skill: string } | null;
}

interface DialogueBranch {
  id: string;
  text: string;
  response: string;
  consequence: string;
  reward?: any;
}

interface PendingEncounter {
  type: 'trap' | 'treasure' | 'combat' | 'puzzle' | 'social' | 'exploration' | 'riddle' | 'dialogue';
  description: string;
  choices: EncounterChoice[];
  enemies?: any[];
  resolved: boolean;
  answer?: string;
  alternateAnswers?: string[];
  hint?: string;
  successNarrative?: string;
  failureNarrative?: string;
  reward?: any;
  hintGiven?: boolean;
  attempts?: number;
  npcName?: string;
  initialDialogue?: string;
  branches?: DialogueBranch[];
}

interface DungeonMapModalProps {
  campaignId?: number;
  campaignName?: string;
  dungeonLevel?: number;
  mapId?: number | null;
  onTileInteraction?: (x: number, y: number, tileType: string) => void;
  onEntityInteraction?: (entity: MapEntity) => void;
  onExitDungeon?: () => void;
  initialMapData?: DungeonMapData | null;
  onMapDataChange?: (mapData: DungeonMapData) => void;
  pendingEncounter?: PendingEncounter | null;
  readOnly?: boolean;
}

export function DungeonMapModal({
  campaignId,
  campaignName,
  dungeonLevel = 1,
  mapId,
  onTileInteraction,
  onEntityInteraction,
  onExitDungeon,
  initialMapData,
  onMapDataChange,
  pendingEncounter: externalPendingEncounter,
  readOnly = false,
}: DungeonMapModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mapData, setMapData] = useState<DungeonMapData | null>(initialMapData || null);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [pendingEncounter, setPendingEncounter] = useState<PendingEncounter | null>(null);
  const [narrativeMessage, setNarrativeMessage] = useState<string | null>(null);
  const [riddleAnswer, setRiddleAnswer] = useState("");
  const [riddleHint, setRiddleHint] = useState<string | null>(null);
  const [dialogueResponse, setDialogueResponse] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (initialMapData) {
      setMapData(initialMapData);
    }
  }, [initialMapData]);

  useEffect(() => {
    if (externalPendingEncounter) {
      setPendingEncounter(externalPendingEncounter);
      // Clear riddle/dialogue state when new encounter starts
      setRiddleHint(null);
      setRiddleAnswer("");
      setDialogueResponse(null);
    }
  }, [externalPendingEncounter]);

  const moveMutation = useMutation({
    mutationFn: async (data: { 
      direction: string; 
      currentPosition: { x: number; y: number }; 
      newPosition: { x: number; y: number }; 
      tileType: string;
      nearbyEntities: any[];
      mapData: DungeonMapData;
    }) => {
      const res = await apiRequest('POST', `/api/campaigns/${campaignId}/dungeon-move`, {
        ...data,
        mapId,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.encounterTriggered && data.encounter) {
        setPendingEncounter(data.encounter);
        toast({
          title: data.encounter.type === 'combat' ? "Combat!" : data.encounter.type === 'trap' ? "Trap!" : "Discovery!",
          description: data.encounter.description,
          variant: data.encounter.type === 'combat' || data.encounter.type === 'trap' ? "destructive" : "default",
        });
      } else if (data.narrativeEvent) {
        setNarrativeMessage(data.narrativeEvent);
        toast({
          title: "As you explore...",
          description: data.narrativeEvent,
        });
      }
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/sessions`] });
    },
    onError: (error: any) => {
      if (error.message?.includes("resolve the current encounter")) {
        toast({
          title: "Cannot Move",
          description: "You must resolve the current encounter before moving!",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Movement Failed",
          description: error.message || "Failed to move",
          variant: "destructive",
        });
      }
    }
  });

  // Track the last submitted choice for riddle state updates
  const [lastChoiceId, setLastChoiceId] = useState<string | null>(null);
  
  const resolveMutation = useMutation({
    mutationFn: async (data: { choiceId: string; rollResult?: number; riddleAnswer?: string }) => {
      setLastChoiceId(data.choiceId); // Track what we're submitting
      const res = await apiRequest('POST', `/api/campaigns/${campaignId}/dungeon-resolve`, data);
      return res.json();
    },
    onSuccess: (data) => {
      const submittedChoiceId = lastChoiceId;
      
      // Check if this is a riddle that can be retried
      if (data.outcome.canRetry && pendingEncounter?.type === 'riddle') {
        // Update the pendingEncounter with new state (hintGiven, attempts)
        const wasHintRequest = submittedChoiceId === 'request_hint';
        const wasAnswerAttempt = submittedChoiceId === 'answer_riddle';
        
        setPendingEncounter(prev => prev ? {
          ...prev,
          hintGiven: wasHintRequest ? true : prev.hintGiven,
          attempts: wasAnswerAttempt ? (prev.attempts || 0) + 1 : prev.attempts
        } : null);
        
        // If this was a hint request, display the hint in the UI
        if (wasHintRequest) {
          setRiddleHint(data.outcome.narrative);
        }
        
        setRiddleAnswer(""); // Clear input for retry
        toast({
          title: wasHintRequest ? "Hint" : (data.outcome.success ? "Correct!" : "Not quite..."),
          description: data.outcome.narrative,
          variant: wasHintRequest ? "default" : (data.outcome.success ? "default" : "destructive"),
        });
        return;
      }
      
      // Handle dialogue responses - show NPC response before clearing
      if (pendingEncounter?.type === 'dialogue' && data.outcome.narrative) {
        setDialogueResponse(data.outcome.narrative);
        // Delay clearing the encounter to show the response
        setTimeout(() => {
          setDialogueResponse(null);
          setPendingEncounter(null);
        }, 100);
      } else {
        setPendingEncounter(null);
      }
      
      setNarrativeMessage(data.outcome.narrative);
      setRiddleAnswer("");
      setRiddleHint(null);
      setLastChoiceId(null);
      
      // Show quest hooks or intel from dialogue
      const description = data.outcome.questHook 
        ? `${data.outcome.narrative}\n\nNew objective: ${data.outcome.questHook}`
        : data.outcome.intel
          ? `${data.outcome.narrative}\n\nYou learned: ${data.outcome.intel}`
          : data.outcome.narrative;
      
      toast({
        title: data.outcome.success ? "Success!" : "Outcome",
        description,
        variant: data.outcome.success ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/sessions`] });
    },
    onError: (error: any) => {
      setLastChoiceId(null);
      toast({
        title: "Error",
        description: error.message || "Failed to resolve encounter",
        variant: "destructive",
      });
    }
  });

  const handleGenerateNewDungeon = () => {
    const newMap = generateDungeon({
      width: 25,
      height: 18,
      maxRooms: 6,
      dungeonLevel,
      dungeonName: campaignName ? `${campaignName} - Level ${dungeonLevel}` : undefined,
    });
    setMapData(newMap);
    onMapDataChange?.(newMap);
    setPendingEncounter(null);
    setNarrativeMessage(null);
    toast({
      title: "Dungeon Generated",
      description: `Welcome to ${newMap.name}!`,
    });
  };

  const handlePlayerMove = async (direction: "up" | "down" | "left" | "right") => {
    if (!mapData) return;
    if (pendingEncounter && !pendingEncounter.resolved) {
      toast({
        title: "Cannot Move",
        description: "You must resolve the current encounter first!",
        variant: "destructive",
      });
      return;
    }
    
    // Prevent movement while a move is in progress
    if (moveMutation.isPending) return;
    
    const currentPosition = mapData.playerPosition;
    
    // Calculate proposed new position without updating state
    const directionOffsets = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    const offset = directionOffsets[direction];
    const proposedPosition = {
      x: currentPosition.x + offset.x,
      y: currentPosition.y + offset.y,
    };
    
    // Check bounds
    if (proposedPosition.x < 0 || proposedPosition.x >= mapData.width ||
        proposedPosition.y < 0 || proposedPosition.y >= mapData.height) {
      return;
    }
    
    // Check for walls locally (quick reject)
    const proposedTile = mapData.tiles[proposedPosition.y]?.[proposedPosition.x];
    if (!proposedTile || proposedTile.type === "wall") {
      return;
    }
    
    const nearbyEntities = mapData.entities.filter(e => {
      const dist = Math.sqrt(
        Math.pow(e.x - proposedPosition.x, 2) + 
        Math.pow(e.y - proposedPosition.y, 2)
      );
      return dist <= 1.5;
    });
    
    if (campaignId) {
      // Send move request to backend - do NOT update local state until confirmed
      moveMutation.mutate({
        direction,
        currentPosition,
        newPosition: proposedPosition,
        tileType: proposedTile.type,
        nearbyEntities,
        mapData: mapData,
      }, {
        onSuccess: (data) => {
          // Only update local map state after backend confirms movement
          if (data.success && data.newPosition) {
            const updatedMapData = {
              ...mapData,
              playerPosition: data.newPosition,
              tiles: mapData.tiles.map((row, y) =>
                row.map((tile, x) => {
                  // Mark tiles as explored when player moves near them
                  const dist = Math.sqrt(
                    Math.pow(x - data.newPosition.x, 2) + 
                    Math.pow(y - data.newPosition.y, 2)
                  );
                  if (dist <= 2) {
                    return { ...tile, explored: true, visible: dist <= 1.5 };
                  }
                  return { ...tile, visible: false };
                })
              ),
            };
            setMapData(updatedMapData);
            onMapDataChange?.(updatedMapData);
          }
        }
      });
    } else {
      // Standalone mode without campaign - allow local movement
      const updatedMapData = movePlayer(mapData, direction);
      setMapData(updatedMapData);
      onMapDataChange?.(updatedMapData);
      
      if (proposedTile.type === "trap") {
        toast({
          title: "Trap!",
          description: "You've triggered a trap! Roll a Dexterity saving throw.",
          variant: "destructive",
        });
        onTileInteraction?.(proposedPosition.x, proposedPosition.y, "trap");
      } else if (proposedTile.type === "treasure") {
        toast({
          title: "Treasure Found!",
          description: "You've discovered a treasure chest!",
        });
        onTileInteraction?.(proposedPosition.x, proposedPosition.y, "treasure");
      }
      
      const enemies = nearbyEntities.filter(e => e.type === "enemy" || e.type === "boss");
      if (enemies.length > 0) {
        toast({
          title: "Combat!",
          description: `${enemies.map(e => e.name).join(", ")} ${enemies.length > 1 ? "are" : "is"} nearby!`,
          variant: "destructive",
        });
        enemies.forEach(e => onEntityInteraction?.(e));
      }
    }
  };

  const handleChoiceClick = (choice: EncounterChoice) => {
    if (choice.rollRequired) {
      const roll = Math.floor(Math.random() * 20) + 1;
      toast({
        title: `Rolling ${choice.rollRequired.skill}...`,
        description: `You rolled a ${roll}!`,
      });
      resolveMutation.mutate({ choiceId: choice.id, rollResult: roll });
    } else {
      resolveMutation.mutate({ choiceId: choice.id });
    }
  };

  const handleTileClick = (x: number, y: number) => {
    if (!mapData) return;
    const tile = mapData.tiles[y][x];
    onTileInteraction?.(x, y, tile.type);
  };

  const handleEntityClick = (entity: MapEntity) => {
    setSelectedEntity(entity.id === selectedEntity ? null : entity.id);
    onEntityInteraction?.(entity);
  };

  // In campaign mode with readOnly=true, movement is controlled by narrative choices only
  const isMovementBlocked = readOnly || (pendingEncounter && !pendingEncounter.resolved) || moveMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2"
          data-testid="button-open-dungeon-map"
          data-dungeon-map-trigger="true"
        >
          <Map className="w-4 h-4" />
          Dungeon Map
          {pendingEncounter && !pendingEncounter.resolved && (
            <Badge variant="destructive" className="ml-1">!</Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Map className="w-5 h-5" />
            {mapData?.name || "Dungeon Explorer"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!mapData ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <p className="text-muted-foreground text-center">
                {readOnly 
                  ? "The dungeon map will appear as your adventure progresses through story choices."
                  : "No dungeon map loaded. Generate a new dungeon to explore!"}
              </p>
              {!readOnly && (
                <Button 
                  onClick={handleGenerateNewDungeon}
                  data-testid="button-generate-dungeon"
                >
                  Generate Dungeon
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <DungeonMap
                  mapData={mapData}
                  onTileClick={handleTileClick}
                  onEntityClick={handleEntityClick}
                  onPlayerMove={isMovementBlocked ? undefined : handlePlayerMove}
                  interactive={!isMovementBlocked}
                  showControls={!isMovementBlocked}
                  selectedEntity={selectedEntity}
                />
                
                {isMovementBlocked && (
                  <div className={`mt-2 p-2 border rounded text-sm text-center flex items-center justify-center gap-2 ${
                    readOnly 
                      ? "bg-blue-900/30 border-blue-700 text-blue-300" 
                      : "bg-red-900/30 border-red-700 text-red-300"
                  }`}>
                    {moveMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing movement...
                      </>
                    ) : readOnly ? (
                      <>
                        <Map className="w-4 h-4" />
                        Movement is driven by your story choices above
                      </>
                    ) : (
                      "Movement blocked - resolve the encounter first!"
                    )}
                  </div>
                )}
                
                {narrativeMessage && !pendingEncounter && (
                  <div className="mt-2 p-3 bg-amber-900/30 border border-amber-700 rounded text-amber-200 text-sm italic">
                    {narrativeMessage}
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                {pendingEncounter && !pendingEncounter.resolved && (
                  <Card className={`border ${
                    pendingEncounter.type === 'combat' ? 'border-red-700 bg-red-950/30' :
                    pendingEncounter.type === 'trap' ? 'border-orange-700 bg-orange-950/30' :
                    pendingEncounter.type === 'riddle' ? 'border-purple-700 bg-purple-950/30' :
                    pendingEncounter.type === 'dialogue' ? 'border-blue-700 bg-blue-950/30' :
                    pendingEncounter.type === 'social' ? 'border-green-700 bg-green-950/30' :
                    'border-amber-700 bg-amber-950/30'
                  }`}>
                    <CardHeader className="pb-2">
                      <CardTitle className={`text-lg flex items-center gap-2 ${
                        pendingEncounter.type === 'combat' ? 'text-red-300' :
                        pendingEncounter.type === 'trap' ? 'text-orange-300' :
                        pendingEncounter.type === 'riddle' ? 'text-purple-300' :
                        pendingEncounter.type === 'dialogue' ? 'text-blue-300' :
                        pendingEncounter.type === 'social' ? 'text-green-300' :
                        'text-amber-300'
                      }`}>
                        {pendingEncounter.type === 'combat' && <Swords className="w-5 h-5" />}
                        {pendingEncounter.type === 'trap' && <AlertTriangle className="w-5 h-5" />}
                        {pendingEncounter.type === 'treasure' && <Package className="w-5 h-5" />}
                        {pendingEncounter.type === 'riddle' && <HelpCircle className="w-5 h-5" />}
                        {pendingEncounter.type === 'dialogue' && <MessageCircle className="w-5 h-5" />}
                        {pendingEncounter.type === 'social' && <MessageCircle className="w-5 h-5" />}
                        {pendingEncounter.type === 'puzzle' && <Scroll className="w-5 h-5" />}
                        {pendingEncounter.type === 'exploration' && <Map className="w-5 h-5" />}
                        {pendingEncounter.type === 'combat' ? 'Combat!' : 
                         pendingEncounter.type === 'trap' ? 'Trap!' :
                         pendingEncounter.type === 'riddle' ? 'Riddle' :
                         pendingEncounter.type === 'dialogue' ? (pendingEncounter.npcName || 'Encounter') :
                         pendingEncounter.type === 'social' ? 'Social Encounter' :
                         pendingEncounter.type === 'puzzle' ? 'Puzzle' :
                         pendingEncounter.type === 'exploration' ? 'Discovery' : 'Discovery!'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-gray-300">{pendingEncounter.description}</p>
                      
                      {pendingEncounter.type === 'dialogue' && pendingEncounter.initialDialogue && (
                        <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded italic text-blue-200 text-sm">
                          {pendingEncounter.initialDialogue}
                        </div>
                      )}
                      
                      {dialogueResponse && pendingEncounter.type === 'dialogue' && (
                        <div className="p-3 bg-green-900/20 border border-green-700/50 rounded text-green-200 text-sm">
                          <span className="font-semibold">{pendingEncounter.npcName || 'NPC'}:</span> {dialogueResponse}
                        </div>
                      )}
                      
                      {pendingEncounter.type === 'riddle' && (
                        <div className="space-y-3">
                          {riddleHint && (
                            <div className="p-3 bg-purple-900/30 border border-purple-600/50 rounded text-purple-200 text-sm italic">
                              <span className="font-semibold">Hint:</span> {riddleHint}
                            </div>
                          )}
                          {pendingEncounter.attempts && pendingEncounter.attempts > 0 && (
                            <div className="text-xs text-purple-400">
                              Attempts: {pendingEncounter.attempts}/3
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Input
                              placeholder="Type your answer..."
                              value={riddleAnswer}
                              onChange={(e) => setRiddleAnswer(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && riddleAnswer.trim()) {
                                  resolveMutation.mutate({ choiceId: 'answer_riddle', riddleAnswer: riddleAnswer.trim() });
                                }
                              }}
                              className="bg-purple-900/20 border-purple-700/50"
                              disabled={resolveMutation.isPending}
                            />
                            <Button
                              onClick={() => resolveMutation.mutate({ choiceId: 'answer_riddle', riddleAnswer: riddleAnswer.trim() })}
                              disabled={!riddleAnswer.trim() || resolveMutation.isPending}
                              className="bg-purple-600 hover:bg-purple-700"
                            >
                              {resolveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit'}
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resolveMutation.mutate({ choiceId: 'request_hint' })}
                              disabled={resolveMutation.isPending || pendingEncounter.hintGiven}
                              className="flex-1"
                            >
                              <HelpCircle className="w-4 h-4 mr-1" />
                              {pendingEncounter.hintGiven ? 'Hint Used' : 'Ask for Hint'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resolveMutation.mutate({ choiceId: 'skip_riddle' })}
                              disabled={resolveMutation.isPending}
                              className="flex-1"
                            >
                              Leave
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {pendingEncounter.type !== 'riddle' && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground font-medium">
                            {pendingEncounter.type === 'dialogue' ? 'How do you respond?' : 'What do you do?'}
                          </p>
                          {pendingEncounter.choices.map((choice) => (
                            <Button
                              key={choice.id}
                              variant="outline"
                              size="sm"
                              className={`w-full justify-start text-left h-auto py-2 ${
                                pendingEncounter.type === 'dialogue' ? 'border-blue-700/50 hover:bg-blue-900/30' : ''
                              }`}
                              onClick={() => handleChoiceClick(choice)}
                              disabled={resolveMutation.isPending}
                              data-testid={`choice-${choice.id}`}
                            >
                              {resolveMutation.isPending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : null}
                              <span className="text-sm">{choice.text}</span>
                            </Button>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
                
                <div className="p-3 border rounded bg-muted/30">
                  <div className="text-sm font-medium mb-2">Status</div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Position: ({mapData.playerPosition.x}, {mapData.playerPosition.y})</div>
                    <div>Enemies nearby: {mapData.entities.filter(e => e.type === "enemy" || e.type === "boss").length}</div>
                  </div>
                </div>
                
                {/* Only show dungeon controls in standalone mode, not during campaign play */}
                {!readOnly && (
                  <div className="flex flex-col gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleGenerateNewDungeon}
                      data-testid="button-regenerate-dungeon"
                    >
                      New Dungeon
                    </Button>
                    {onExitDungeon && (
                      <Button 
                        variant="secondary" 
                        size="sm"
                        onClick={() => {
                          onExitDungeon();
                          setIsOpen(false);
                        }}
                        data-testid="button-exit-dungeon"
                      >
                        Exit Dungeon
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
