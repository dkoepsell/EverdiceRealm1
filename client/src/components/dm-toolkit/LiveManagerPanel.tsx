import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDraggable,
  useDroppable,
  closestCenter,
} from "@dnd-kit/core";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Users,
  Sword,
  Package,
  MapPin,
  Skull,
  Send,
  Crown,
  Heart,
  Shield,
  ChevronRight,
  ChevronLeft,
  Plus,
  GripVertical,
  Clock,
  Circle,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  MessageSquare,
  Dice6,
  BookOpen,
  Zap,
  Target,
} from "lucide-react";

interface LiveManagerPanelProps {
  selectedCampaignId: number | null;
}

interface DraggableEntity {
  id: string;
  type: "npc" | "item" | "encounter" | "location" | "monster" | "quest";
  name: string;
  data: any;
}

interface PresenceEntry {
  userId: number;
  characterId: number;
  name: string;
  isOnline: boolean;
  lastSeen: string;
  characterName?: string;
}

interface InitiativeEntry {
  id: string;
  characterId?: number;
  name: string;
  initiative: number;
  isPlayer: boolean;
  hp: number;
  maxHp: number;
  ac: number;
  conditions: string[];
  isCurrentTurn: boolean;
}

interface SessionArtifact {
  id: string;
  type: string;
  entityId: string;
  name: string;
  data: any;
  addedAt: string;
}

function DraggableItem({ entity }: { entity: DraggableEntity }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entity.id,
    data: entity,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  const getIcon = () => {
    switch (entity.type) {
      case "npc": return <Users className="h-4 w-4" />;
      case "item": return <Package className="h-4 w-4" />;
      case "encounter": return <Sword className="h-4 w-4" />;
      case "location": return <MapPin className="h-4 w-4" />;
      case "monster": return <Skull className="h-4 w-4" />;
      case "quest": return <Target className="h-4 w-4" />;
      default: return <Circle className="h-4 w-4" />;
    }
  };

  const getTypeColor = () => {
    switch (entity.type) {
      case "npc": return "bg-blue-100 text-blue-700 border-blue-200";
      case "item": return "bg-amber-100 text-amber-700 border-amber-200";
      case "encounter": return "bg-red-100 text-red-700 border-red-200";
      case "location": return "bg-green-100 text-green-700 border-green-200";
      case "monster": return "bg-purple-100 text-purple-700 border-purple-200";
      case "quest": return "bg-orange-100 text-orange-700 border-orange-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 p-2 rounded-lg border cursor-grab active:cursor-grabbing hover:bg-muted/50 transition-colors ${getTypeColor()}`}
    >
      <GripVertical className="h-3 w-3 opacity-50" />
      {getIcon()}
      <span className="text-sm font-medium truncate flex-1">{entity.name}</span>
    </div>
  );
}

function DroppableZone({ children, id, isOver: externalIsOver }: { children: React.ReactNode; id: string; isOver?: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  const showActive = isOver || externalIsOver;

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[200px] rounded-lg border-2 transition-all duration-200 p-4 ${
        showActive 
          ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/20 border-solid" 
          : "border-muted-foreground/30 border-dashed hover:border-muted-foreground/50"
      }`}
    >
      {children}
    </div>
  );
}

interface ArcSignal {
  characterId: number;
  characterName: string;
  profiles: any[];
  recentEvents: any[];
  summary: string;
}

function ArcSignalsPanel({ campaignId }: { campaignId: number | null }) {
  const { data: arcSignals, isLoading } = useQuery<ArcSignal[]>({
    queryKey: ['/api/campaigns', campaignId, 'reputation-signals'],
    enabled: !!campaignId
  });

  if (!campaignId) {
    return null;
  }

  return (
    <Card className="border-indigo-500/20">
      <CardHeader className="p-3 pb-1">
        <CardTitle className="text-sm flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-indigo-500" />
          Arc Signals
        </CardTitle>
        <CardDescription className="text-xs">
          Character reputation patterns
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <ScrollArea className="h-[120px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : arcSignals && arcSignals.length > 0 ? (
            <div className="space-y-2">
              {arcSignals.map((signal) => (
                <div 
                  key={signal.characterId}
                  className="p-2 rounded-lg border bg-indigo-500/5 border-indigo-500/20"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-3 w-3 text-indigo-500" />
                    <span className="text-sm font-medium">{signal.characterName}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {signal.summary}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <BookOpen className="h-5 w-5 mb-2 opacity-50" />
              <p className="text-xs text-center">
                Character reputation patterns will emerge as the story unfolds
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default function LiveManagerPanel({ selectedCampaignId }: LiveManagerPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false); // Collapsed by default - "Summon Drawer"
  const [sidebarTab, setSidebarTab] = useState("npcs");
  const [dmMessage, setDmMessage] = useState("");
  const [messageType, setMessageType] = useState<"narration" | "ooc" | "system">("narration");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showInitiativeDialog, setShowInitiativeDialog] = useState(false);
  const [newInitiativeName, setNewInitiativeName] = useState("");
  const [newInitiativeRoll, setNewInitiativeRoll] = useState(10);
  const [newInitiativeHp, setNewInitiativeHp] = useState(20);
  const [newInitiativeAc, setNewInitiativeAc] = useState(12);
  const [newInitiativeIsPlayer, setNewInitiativeIsPlayer] = useState(false);
  const [sessionFocus, setSessionFocus] = useState("");
  const [editingFocus, setEditingFocus] = useState(false);
  
  // Tutorial banner - show only first time (stored in localStorage)
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dm-onboarding-dismissed') !== 'true';
    }
    return true;
  });
  const [onboardingCollapsed, setOnboardingCollapsed] = useState(false);
  
  const dismissOnboarding = () => {
    setShowOnboarding(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dm-onboarding-dismissed', 'true');
    }
  };

  const { data: dmSessionState, refetch: refetchSession } = useQuery<{
    id?: number;
    campaignId?: number;
    presence?: PresenceEntry[];
    initiativeOrder?: InitiativeEntry[];
    currentTurnIndex?: number;
    roundNumber?: number;
    pendingChoices?: any[];
    dmMessages?: any[];
    sessionArtifacts?: SessionArtifact[];
    camlEntitySources?: { npcs?: any[]; items?: any[]; encounters?: any[]; locations?: any[]; quests?: any[] };
    participantsWithChars?: any[];
  }>({
    queryKey: [`/api/campaigns/${selectedCampaignId}/dm-session-state`],
    enabled: !!selectedCampaignId,
    refetchInterval: 3000,
  });

  const { data: participants } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${selectedCampaignId}/participants`],
    enabled: !!selectedCampaignId,
  });

  const { data: liveSession } = useQuery<{
    choices?: { text: string; type?: string }[];
    narrative?: string;
    isInCombat?: boolean;
    sessionNumber?: number;
  }>({
    queryKey: [`/api/campaigns/${selectedCampaignId}/live-session`],
    enabled: !!selectedCampaignId,
    refetchInterval: 5000,
  });

  const { data: campaignNpcs } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${selectedCampaignId}/npcs`],
    enabled: !!selectedCampaignId,
  });

  const { data: items } = useQuery<any[]>({
    queryKey: ['/api/items'],
    enabled: !!selectedCampaignId,
  });

  const { data: encounters } = useQuery<any[]>({
    queryKey: ['/api/encounters'],
    enabled: !!selectedCampaignId,
  });

  const { data: monsters } = useQuery<any[]>({
    queryKey: ['/api/monsters'],
    enabled: !!selectedCampaignId,
  });

  const { data: locations } = useQuery<any[]>({
    queryKey: ['/api/locations'],
    enabled: !!selectedCampaignId,
  });

  const sendDmMessageMutation = useMutation({
    mutationFn: async ({ message, type }: { message: string; type: string }) => {
      const response = await apiRequest('POST', `/api/campaigns/${selectedCampaignId}/dm-message`, {
        message,
        type,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Message Sent", description: "Your message has been sent to players." });
      setDmMessage("");
      refetchSession();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateInitiativeMutation = useMutation({
    mutationFn: async (initiativeOrder: InitiativeEntry[]) => {
      const response = await apiRequest('PATCH', `/api/campaigns/${selectedCampaignId}/dm-session-state`, {
        initiativeOrder,
      });
      return response.json();
    },
    onSuccess: () => {
      refetchSession();
    },
  });

  const addArtifactMutation = useMutation({
    mutationFn: async (artifact: Omit<SessionArtifact, "addedAt">) => {
      const response = await apiRequest('POST', `/api/campaigns/${selectedCampaignId}/session-artifact`, artifact);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Added to Session", description: "Entity added to the active session." });
      refetchSession();
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    
    if (over && over.id === "session-dropzone") {
      const entity = active.data.current as DraggableEntity;
      addArtifactMutation.mutate({
        id: `${entity.type}-${entity.id}-${Date.now()}`,
        type: entity.type,
        entityId: entity.id,
        name: entity.name,
        data: entity.data,
      });
    }
  };

  const nextTurn = () => {
    const currentOrder = dmSessionState?.initiativeOrder || [];
    if (currentOrder.length === 0) return;
    
    const nextIndex = ((dmSessionState?.currentTurnIndex || 0) + 1) % currentOrder.length;
    const updatedOrder = currentOrder.map((entry: InitiativeEntry, idx: number) => ({
      ...entry,
      isCurrentTurn: idx === nextIndex,
    }));
    
    updateInitiativeMutation.mutate(updatedOrder);
  };

  const addToInitiative = () => {
    const newEntry: InitiativeEntry = {
      id: `init-${Date.now()}`,
      name: newInitiativeName,
      initiative: newInitiativeRoll,
      isPlayer: newInitiativeIsPlayer,
      hp: newInitiativeHp,
      maxHp: newInitiativeHp,
      ac: newInitiativeAc,
      conditions: [],
      isCurrentTurn: false,
    };
    
    const currentOrder = [...(dmSessionState?.initiativeOrder || []), newEntry];
    currentOrder.sort((a: InitiativeEntry, b: InitiativeEntry) => b.initiative - a.initiative);
    
    updateInitiativeMutation.mutate(currentOrder);
    setShowInitiativeDialog(false);
    setNewInitiativeName("");
    setNewInitiativeRoll(10);
  };

  const removeFromInitiative = (id: string) => {
    const currentOrder = (dmSessionState?.initiativeOrder || []).filter(
      (entry: InitiativeEntry) => entry.id !== id
    );
    updateInitiativeMutation.mutate(currentOrder);
  };

  const buildEntityList = (type: string): DraggableEntity[] => {
    switch (type) {
      case "npcs":
        return (campaignNpcs || []).map((npc: any) => ({
          id: `npc-${npc.id}`,
          type: "npc" as const,
          name: npc.name,
          data: npc,
        }));
      case "items":
        return (items || []).map((item: any) => ({
          id: `item-${item.id}`,
          type: "item" as const,
          name: item.name,
          data: item,
        }));
      case "encounters":
        return (encounters || []).map((enc: any) => ({
          id: `encounter-${enc.id}`,
          type: "encounter" as const,
          name: enc.title || enc.name,
          data: enc,
        }));
      case "monsters":
        return (monsters || []).map((monster: any) => ({
          id: `monster-${monster.id}`,
          type: "monster" as const,
          name: monster.name,
          data: monster,
        }));
      case "locations":
        return (locations || []).map((loc: any) => ({
          id: `location-${loc.id}`,
          type: "location" as const,
          name: loc.name,
          data: loc,
        }));
      default:
        return [];
    }
  };

  const camlEntities = dmSessionState?.camlEntitySources || {};
  const camlNpcs = (camlEntities.npcs || []).map((npc: any, idx: number) => ({
    id: `caml-npc-${idx}`,
    type: "npc" as const,
    name: npc.name || npc.id,
    data: npc,
  }));
  const camlItems = (camlEntities.items || []).map((item: any, idx: number) => ({
    id: `caml-item-${idx}`,
    type: "item" as const,
    name: item.name || item.id,
    data: item,
  }));
  const camlEncounters = (camlEntities.encounters || []).map((enc: any, idx: number) => ({
    id: `caml-encounter-${idx}`,
    type: "encounter" as const,
    name: enc.name || enc.id,
    data: enc,
  }));
  const camlLocations = (camlEntities.locations || []).map((loc: any, idx: number) => ({
    id: `caml-location-${idx}`,
    type: "location" as const,
    name: loc.name || loc.id,
    data: loc,
  }));
  const camlQuests = (camlEntities.quests || []).map((quest: any, idx: number) => ({
    id: `caml-quest-${idx}`,
    type: "quest" as const,
    name: quest.name || quest.id,
    data: quest,
  }));

  if (!selectedCampaignId) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Crown className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Campaign Selected</h3>
          <p className="text-muted-foreground">
            Select a campaign to open the Live Manager.
          </p>
        </CardContent>
      </Card>
    );
  }

  const presence: PresenceEntry[] = dmSessionState?.presence || [];
  const initiativeOrder: InitiativeEntry[] = dmSessionState?.initiativeOrder || [];
  const sessionArtifacts: SessionArtifact[] = dmSessionState?.sessionArtifacts || [];
  const dmMessages: any[] = dmSessionState?.dmMessages || [];
  const currentTurnIndex = dmSessionState?.currentTurnIndex || 0;
  const roundNumber = dmSessionState?.roundNumber || 1;

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Onboarding Hint - Collapsible, dismissable, first-time only */}
      {showOnboarding && (
        onboardingCollapsed ? (
          <div className="mb-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              onClick={() => setOnboardingCollapsed(false)}
            >
              <Sparkles className="h-3 w-3 text-amber-500" />
              Show Guide
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={dismissOnboarding}
            >
              ×
            </Button>
          </div>
        ) : (
          <div className="mb-3 p-3 rounded-lg bg-muted/30 border border-muted-foreground/10 relative">
            <div className="absolute top-2 right-2 flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setOnboardingCollapsed(true)}
                title="Collapse"
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={dismissOnboarding}
                title="Dismiss forever"
              >
                ×
              </Button>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground pr-16">
              <span className="flex items-center gap-1"><span className="text-amber-500 font-bold">1</span> Drag → Scene</span>
              <span className="flex items-center gap-1"><span className="text-purple-500 font-bold">2</span> Check Moves</span>
              <span className="flex items-center gap-1"><span className="text-amber-500 font-bold">3</span> Send</span>
            </div>
          </div>
        )
      )}

      <div className="flex h-[calc(100vh-260px)] gap-3 pb-8">
        {/* Collapsible Summon Drawer - Collapsed by default */}
        <div
          className={`transition-all duration-300 ${
            sidebarOpen ? "w-64" : "w-10"
          } flex-shrink-0`}
        >
          <Card className={`h-full ${sidebarOpen ? '' : 'bg-muted/30 border-dashed'}`}>
            <CardHeader className={`p-2 flex flex-row items-center ${sidebarOpen ? 'justify-between' : 'justify-center'}`}>
              {sidebarOpen && (
                <div>
                  <CardTitle className="text-xs font-medium">Summon</CardTitle>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                title={sidebarOpen ? "Collapse" : "Open Cast & World"}
              >
                {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              </Button>
            </CardHeader>
            
            {sidebarOpen && (
              <CardContent className="p-2 h-[calc(100%-50px)]">
                <Tabs value={sidebarTab} onValueChange={setSidebarTab}>
                  {/* Core tabs only: People, Places, Threats - hide Items/Events/Quests by default */}
                  <TabsList className="grid w-full grid-cols-3 h-7 mb-2">
                    <TabsTrigger value="npcs" className="text-xs p-1 gap-1" title="People">
                      <Users className="h-3 w-3" />
                    </TabsTrigger>
                    <TabsTrigger value="locations" className="text-xs p-1 gap-1" title="Places">
                      <MapPin className="h-3 w-3" />
                    </TabsTrigger>
                    <TabsTrigger value="monsters" className="text-xs p-1 gap-1" title="Threats">
                      <Skull className="h-3 w-3" />
                    </TabsTrigger>
                  </TabsList>

                  <ScrollArea className="h-[calc(100%-50px)] mt-2">
                    <div className="space-y-2 pr-2">
                      {/* CAML Entities Section */}
                      {(sidebarTab === "npcs" && camlNpcs.length > 0) && (
                        <>
                          <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mt-2">
                            <Sparkles className="h-3 w-3" /> From Campaign
                          </div>
                          {camlNpcs.map((entity) => (
                            <DraggableItem key={entity.id} entity={entity} />
                          ))}
                          <Separator className="my-2" />
                        </>
                      )}
                      {(sidebarTab === "items" && camlItems.length > 0) && (
                        <>
                          <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mt-2">
                            <Sparkles className="h-3 w-3" /> From Campaign
                          </div>
                          {camlItems.map((entity) => (
                            <DraggableItem key={entity.id} entity={entity} />
                          ))}
                          <Separator className="my-2" />
                        </>
                      )}
                      {(sidebarTab === "encounters" && camlEncounters.length > 0) && (
                        <>
                          <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mt-2">
                            <Sparkles className="h-3 w-3" /> From Campaign
                          </div>
                          {camlEncounters.map((entity) => (
                            <DraggableItem key={entity.id} entity={entity} />
                          ))}
                          <Separator className="my-2" />
                        </>
                      )}
                      {(sidebarTab === "locations" && camlLocations.length > 0) && (
                        <>
                          <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mt-2">
                            <Sparkles className="h-3 w-3" /> From Campaign
                          </div>
                          {camlLocations.map((entity) => (
                            <DraggableItem key={entity.id} entity={entity} />
                          ))}
                          <Separator className="my-2" />
                        </>
                      )}
                      {(sidebarTab === "quests" && camlQuests.length > 0) && (
                        <>
                          <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mt-2">
                            <Sparkles className="h-3 w-3" /> From Campaign
                          </div>
                          {camlQuests.map((entity) => (
                            <DraggableItem key={entity.id} entity={entity} />
                          ))}
                          <Separator className="my-2" />
                        </>
                      )}

                      {/* Database Entities */}
                      <div className="text-xs font-semibold text-muted-foreground mt-2">
                        Library
                      </div>
                      {buildEntityList(sidebarTab).map((entity) => (
                        <DraggableItem key={entity.id} entity={entity} />
                      ))}
                      
                      {buildEntityList(sidebarTab).length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          No {sidebarTab} available
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </Tabs>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Main Content Area - Current Scene is dominant */}
        <div className="flex-1 flex flex-col lg:flex-row gap-3">
          {/* Left Reference Column - Peripheral stats (muted, compact) */}
          <div className="lg:w-48 flex-shrink-0 space-y-2">
            {/* Compact Party Stats - muted colors */}
            <Card className="border-muted bg-muted/20">
              <CardHeader className="p-2">
                <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  Party
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-5 w-5 p-0"
                    onClick={() => refetchSession()}
                  >
                    <RefreshCw className="h-2.5 w-2.5" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 pt-0">
                <ScrollArea className="h-[120px]">
                  {participants && participants.filter((p: any) => p.character).length > 0 ? (
                    <div className="space-y-1">
                      {participants.filter((p: any) => p.character).map((p: any) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-1.5 p-1 rounded text-xs"
                        >
                          <div
                            className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                              presence.find((pr) => pr.userId === p.userId)?.isOnline
                                ? "bg-green-500"
                                : "bg-gray-400"
                            }`}
                          />
                          <span className="truncate flex-1 text-muted-foreground">{p.character.name}</span>
                          <span className="text-[10px] text-muted-foreground/60">{p.character.hitPoints}/{p.character.maxHitPoints}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground text-center py-2">
                      No party
                    </p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Initiative - Collapsed until combat, muted styling */}
            {initiativeOrder.length > 0 && (
              <Card className="border-muted bg-muted/20">
                <CardHeader className="p-2">
                  <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Turn {currentTurnIndex + 1}
                    <Dialog open={showInitiativeDialog} onOpenChange={setShowInitiativeDialog}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="ml-auto h-5 w-5 p-0">
                          <Plus className="h-2.5 w-2.5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add to Initiative</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Name</Label>
                            <Input
                              value={newInitiativeName}
                              onChange={(e) => setNewInitiativeName(e.target.value)}
                              placeholder="Character or Monster name"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label>Initiative</Label>
                              <Input
                                type="number"
                                value={newInitiativeRoll}
                                onChange={(e) => setNewInitiativeRoll(parseInt(e.target.value) || 0)}
                              />
                            </div>
                            <div>
                              <Label>HP</Label>
                              <Input
                                type="number"
                                value={newInitiativeHp}
                                onChange={(e) => setNewInitiativeHp(parseInt(e.target.value) || 1)}
                              />
                            </div>
                            <div>
                              <Label>AC</Label>
                              <Input
                                type="number"
                                value={newInitiativeAc}
                                onChange={(e) => setNewInitiativeAc(parseInt(e.target.value) || 10)}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="isPlayer"
                              checked={newInitiativeIsPlayer}
                              onChange={(e) => setNewInitiativeIsPlayer(e.target.checked)}
                            />
                            <Label htmlFor="isPlayer">Is Player Character</Label>
                          </div>
                          <Button onClick={addToInitiative} className="w-full">
                            Add to Initiative
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 pt-0">
                  <ScrollArea className="h-[100px]">
                    <div className="space-y-0.5">
                      {initiativeOrder.map((entry, idx) => (
                        <div
                          key={entry.id}
                          className={`flex items-center gap-1 p-1 rounded text-xs ${
                            idx === currentTurnIndex
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground"
                          }`}
                        >
                          {idx === currentTurnIndex && (
                            <ChevronRight className="h-2.5 w-2.5 animate-pulse" />
                          )}
                          <span className="truncate flex-1">{entry.name}</span>
                          <span className="text-[10px]">{entry.hp}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <Button onClick={nextTurn} size="sm" className="w-full h-6 mt-1 text-xs">
                    Next
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* CENTER: Current Scene - THE DOMINANT ANCHOR */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Session Focus Strip - Required orientation */}
            <div className="mb-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
              {editingFocus ? (
                <Input
                  value={sessionFocus}
                  onChange={(e) => setSessionFocus(e.target.value)}
                  onBlur={() => setEditingFocus(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingFocus(false)}
                  placeholder="What's the goal of this session?"
                  className="h-7 text-sm border-amber-500/30 bg-transparent"
                  autoFocus
                />
              ) : (
                <div 
                  className="flex items-center gap-2 cursor-pointer hover:bg-amber-500/10 rounded px-1 py-0.5 transition-colors"
                  onClick={() => setEditingFocus(true)}
                >
                  <Target className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                  <span className={`text-sm ${sessionFocus ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                    {sessionFocus || "Click to set session focus..."}
                  </span>
                </div>
              )}
            </div>

            {/* Current Scene - Enlarged, centered, strongest contrast */}
            <Card className="flex-1 ring-2 ring-amber-500/50 bg-gradient-to-b from-amber-500/10 to-transparent shadow-xl">
              <CardHeader className="p-3 pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-amber-500/30">
                    <BookOpen className="h-5 w-5 text-amber-500" />
                  </div>
                  <CardTitle className="text-base text-amber-500">Current Scene</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0 flex-1">
                <DroppableZone id="session-dropzone" isOver={!!activeId}>
                  <ScrollArea className="h-[280px]">
                    {sessionArtifacts.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {sessionArtifacts.map((artifact) => (
                          <div
                            key={artifact.id}
                            className="p-3 rounded-lg border-2 border-amber-500/20 bg-card hover:bg-amber-500/5 transition-colors"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {artifact.type === "npc" && <Users className="h-4 w-4 text-blue-500" />}
                              {artifact.type === "item" && <Package className="h-4 w-4 text-amber-500" />}
                              {artifact.type === "encounter" && <Sword className="h-4 w-4 text-red-500" />}
                              {artifact.type === "monster" && <Skull className="h-4 w-4 text-purple-500" />}
                              {artifact.type === "location" && <MapPin className="h-4 w-4 text-green-500" />}
                              <span className="font-medium text-sm">{artifact.name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                        <div className="p-4 rounded-full bg-amber-500/10 mb-4">
                          <Upload className="h-8 w-8 text-amber-500/70" />
                        </div>
                        <p className="text-base font-medium mb-1">This is your table</p>
                        <p className="text-sm text-center max-w-[220px]">
                          Drag from the left to bring characters and places into play
                        </p>
                      </div>
                    )}
                  </ScrollArea>
                </DroppableZone>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: THINK (muted) + SAY (high contrast) */}
          <div className="lg:w-72 flex-shrink-0 flex flex-col gap-3 overflow-y-auto pb-16">
            {/* THINK ZONE - Muted, analytical */}
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 px-1">Think</p>
              
              {/* Likely Player Moves - Compact, muted */}
              <Card className="border-muted bg-muted/10">
                <CardHeader className="p-2 pb-1">
                  <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-purple-400" />
                    Likely Moves
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 pt-0">
                  <ScrollArea className="h-[100px]">
                    {liveSession?.choices && liveSession.choices.length > 0 ? (
                      <div className="space-y-1">
                        {liveSession.choices.map((choice: any, idx: number) => (
                          <div key={idx} className="p-1.5 rounded text-xs text-muted-foreground border border-muted">
                            {choice.text}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground/50 text-center py-2">
                        Player options appear here
                      </p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Arc Signals - Compact */}
              <ArcSignalsPanel campaignId={selectedCampaignId} />
            </div>

            {/* SAY ZONE - High contrast, clear CTA */}
            <div className="flex-1 flex flex-col">
              <p className="text-[10px] uppercase tracking-wider text-amber-500/60 px-1 mb-2">Say</p>
              
              <Card className="flex-1 border-2 border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-transparent shadow-lg">
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-amber-500">
                    <Send className="h-4 w-4" />
                    Tell Your Story
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-2">
                  <div className="flex gap-1">
                    <Button
                      variant={messageType === "narration" ? "default" : "ghost"}
                      size="sm"
                      className={`flex-1 text-xs h-7 ${messageType === "narration" ? "bg-amber-500 hover:bg-amber-600" : ""}`}
                      onClick={() => setMessageType("narration")}
                    >
                      Narrate
                    </Button>
                    <Button
                      variant={messageType === "ooc" ? "default" : "ghost"}
                      size="sm"
                      className="flex-1 text-xs h-7"
                      onClick={() => setMessageType("ooc")}
                    >
                      OOC
                    </Button>
                    <Button
                      variant={messageType === "system" ? "default" : "ghost"}
                      size="sm"
                      className="flex-1 text-xs h-7"
                      onClick={() => setMessageType("system")}
                    >
                      System
                    </Button>
                  </div>
                  <Textarea
                    value={dmMessage}
                    onChange={(e) => setDmMessage(e.target.value)}
                    placeholder={
                      messageType === "narration"
                        ? "Describe what the players experience..."
                        : messageType === "ooc"
                        ? "Out of character message..."
                        : "Game mechanics..."
                    }
                    className="min-h-[80px] text-sm border-amber-500/30 focus:border-amber-500 bg-background/50"
                  />
                  <Button
                    onClick={() => sendDmMessageMutation.mutate({ message: dmMessage, type: messageType })}
                    disabled={!dmMessage.trim() || sendDmMessageMutation.isPending}
                    className="w-full bg-amber-500 hover:bg-amber-600 h-9"
                  >
                    {sendDmMessageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send to Players
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="p-2 rounded-lg border bg-card shadow-lg">
            <span className="text-sm font-medium">Dragging...</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
