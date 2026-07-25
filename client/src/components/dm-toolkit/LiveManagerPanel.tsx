import React, { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SiDiscord } from "react-icons/si";
import DMControlBar, { SessionMode, NarrativeMode } from "./DMControlBar";
import EventQueue, { PendingEvent } from "./EventQueue";
import { GroupChoicePanel } from "./GroupChoicePanel";
import AIWhisperPanel, { AIWhisper } from "./AIWhisperPanel";
import DMDiceRoller, { DiceRoll } from "./DMDiceRoller";
import RollQueue, { RollRequest } from "./RollQueue";
import InitiativeTracker, { InitiativeCombatant } from "./InitiativeTracker";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Users,
  User,
  Bot,
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
  ChevronDown,
  ChevronUp,
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
  Swords,
  Map,
  AlertTriangle,
  TrendingUp,
  Flame,
  Eye,
  EyeOff,
  Activity,
  Gauge,
} from "lucide-react";
import { ProceduralExplorationMap } from "@/components/dungeon/ProceduralExplorationMap";

interface LiveManagerPanelProps {
  selectedCampaignId: number | null;
}

interface DraggableEntity {
  id: string;
  type: "npc" | "character" | "item" | "encounter" | "location" | "monster" | "quest";
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
      case "character": return <Shield className="h-4 w-4" />;
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
      case "npc": return "bg-blue-500/10 text-blue-300 border-blue-500/30 hover:bg-blue-500/20";
      case "character": return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20";
      case "item": return "bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20";
      case "encounter": return "bg-red-500/10 text-red-300 border-red-500/30 hover:bg-red-500/20";
      case "location": return "bg-green-500/10 text-green-300 border-green-500/30 hover:bg-green-500/20";
      case "monster": return "bg-purple-500/10 text-purple-300 border-purple-500/30 hover:bg-purple-500/20";
      case "quest": return "bg-orange-500/10 text-orange-300 border-orange-500/30 hover:bg-orange-500/20";
      default: return "bg-slate-500/10 text-slate-300 border-slate-500/30 hover:bg-slate-500/20";
    }
  };

  const getSubtitle = () => {
    if (entity.type === "npc") return entity.data?.race || entity.data?.role || "NPC";
    if (entity.type === "character") return `Lv${entity.data?.level || '?'} ${entity.data?.class || entity.data?.characterClass || ''}`;
    if (entity.type === "monster") return entity.data?.challengeRating ? `CR ${entity.data.challengeRating}` : entity.data?.type || "Monster";
    if (entity.type === "location") return entity.data?.type || "Location";
    if (entity.type === "item") return entity.data?.type || entity.data?.rarity || "Item";
    if (entity.type === "encounter") return entity.data?.difficulty || "Encounter";
    if (entity.type === "quest") return entity.data?.status || "Quest";
    return "";
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-grab active:cursor-grabbing transition-colors ${getTypeColor()}`}
    >
      <GripVertical className="h-3.5 w-3.5 opacity-40 flex-shrink-0" />
      {getIcon()}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate block">{entity.name}</span>
        {getSubtitle() && (
          <span className="text-[10px] opacity-60 truncate block">{getSubtitle()}</span>
        )}
      </div>
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

interface DMPressure {
  id: string;
  name: string;
  stage: number;
  maxStages: number;
  trigger: string;
  daysToAdvance: number;
  createdAt: string;
  source?: string;
}

interface DMClock {
  id: string;
  name: string;
  stage: number;
  maxStages: number;
  trigger: string;
  daysToAdvance: number;
  createdAt: string;
}

interface SuggestedPressure {
  name: string;
  stage: number;
  maxStages: number;
  trigger: string;
  daysToAdvance: number;
}

interface SuggestedWorldEvent {
  title: string;
  description: string;
  impact: string;
}

interface WorldPressureData {
  activePressures: string[];
  stakes: { name: string; value: number; maxValue: number }[];
  unresolvedThreads: { id: number; description: string; urgency: string; createdAt: string }[];
  powerNetwork: any;
  rivalAgent: any;
  meterWorldEffects: any;
  dynamicClimax: any;
  doNothingForecast: string[];
  dmPressures: DMPressure[];
  dmClocks: DMClock[];
  suggestedPressures: SuggestedPressure[];
  suggestedWorldEvents: SuggestedWorldEvent[];
}

function ClockDisplay({ clock, onAdvance, onRemove }: { clock: DMClock; onAdvance?: () => void; onRemove?: () => void }) {
  const isNearComplete = clock.stage >= clock.maxStages - 1;
  const isComplete = clock.stage >= clock.maxStages;

  return (
    <div className={`p-2 rounded-lg border ${isNearComplete ? 'border-red-500/30 bg-red-500/5' : 'border-slate-700 bg-slate-800/50'}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Clock className={`h-3.5 w-3.5 flex-shrink-0 ${isNearComplete ? 'text-red-400' : 'text-amber-400'}`} />
        <span className="text-xs font-medium flex-1 truncate">{clock.name}</span>
        <div className="flex gap-1">
          {onAdvance && !isComplete && (
            <button onClick={onAdvance} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors" title="Advance clock">+1</button>
          )}
          {onRemove && (
            <button onClick={onRemove} className="text-[10px] px-1 py-0.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Remove">x</button>
          )}
        </div>
      </div>
      <div className="flex gap-0.5 mb-1">
        {Array.from({ length: clock.maxStages }).map((_, j) => (
          <div key={j} className={`h-2.5 flex-1 rounded-sm transition-colors ${
            j < clock.stage
              ? (clock.stage >= clock.maxStages - 1 ? 'bg-red-400' : clock.stage >= Math.ceil(clock.maxStages / 2) ? 'bg-amber-400' : 'bg-emerald-400')
              : 'bg-slate-700'
          }`} />
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Stage {clock.stage}/{clock.maxStages}</span>
        {clock.daysToAdvance > 0 && (
          <span className={isNearComplete ? 'text-red-400' : 'text-amber-400/70'}>
            Advances in {clock.daysToAdvance}d
          </span>
        )}
      </div>
      {clock.trigger && (
        <p className="text-[10px] text-muted-foreground/70 mt-0.5 italic">Trigger: {clock.trigger}</p>
      )}
    </div>
  );
}

const SPARK_OPTIONS = [
  { key: "political", label: "Political Intrigue", icon: Crown, color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/20" },
  { key: "natural", label: "Natural Disaster", icon: Flame, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20" },
  { key: "faction", label: "Faction Conflict", icon: Swords, color: "text-red-400 bg-red-500/10 border-red-500/20 hover:bg-red-500/20" },
  { key: "religious", label: "Religious Tension", icon: BookOpen, color: "text-blue-400 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20" },
  { key: "criminal", label: "Criminal Underworld", icon: EyeOff, color: "text-slate-300 bg-slate-500/10 border-slate-500/20 hover:bg-slate-500/20" },
  { key: "arcane", label: "Arcane Anomaly", icon: Sparkles, color: "text-purple-400 bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20" },
];

function WorldPressureOverview({ campaignId }: { campaignId: number | null }) {
  const [expanded, setExpanded] = useState(true);
  const [showAddPressure, setShowAddPressure] = useState(false);
  const [showAddClock, setShowAddClock] = useState(false);
  const [showSparks, setShowSparks] = useState(false);
  const [newPressureName, setNewPressureName] = useState("");
  const [newPressureTrigger, setNewPressureTrigger] = useState("");
  const [newClockName, setNewClockName] = useState("");
  const [newClockTrigger, setNewClockTrigger] = useState("");
  const [newClockStages, setNewClockStages] = useState(5);
  const [newClockDays, setNewClockDays] = useState(3);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pressure, isLoading } = useQuery<WorldPressureData>({
    queryKey: ['/api/campaigns', campaignId, 'world-pressure'],
    enabled: !!campaignId,
    refetchInterval: 10000,
  });

  const addPressureMutation = useMutation({
    mutationFn: async (p: { name: string; trigger?: string; stage?: number; maxStages?: number; daysToAdvance?: number }) => {
      const res = await apiRequest('POST', `/api/campaigns/${campaignId}/dm-pressures`, { pressure: p });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'world-pressure'] });
      setNewPressureName(""); setNewPressureTrigger(""); setShowAddPressure(false);
      toast({ title: "Pressure added", description: "Your world pressure is now active." });
    },
  });

  const removePressureMutation = useMutation({
    mutationFn: async (pressureId: string) => {
      const res = await apiRequest('DELETE', `/api/campaigns/${campaignId}/dm-pressures/${pressureId}`);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'world-pressure'] }),
  });

  const addClockMutation = useMutation({
    mutationFn: async (c: { name: string; trigger?: string; maxStages?: number; daysToAdvance?: number; stage?: number }) => {
      const res = await apiRequest('POST', `/api/campaigns/${campaignId}/dm-clocks`, { clock: c });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'world-pressure'] });
      setNewClockName(""); setNewClockTrigger(""); setNewClockStages(5); setNewClockDays(3); setShowAddClock(false);
      toast({ title: "Clock created", description: "Escalation clock is now ticking." });
    },
  });

  const advanceClockMutation = useMutation({
    mutationFn: async ({ clockId, newStage }: { clockId: string; newStage: number }) => {
      const res = await apiRequest('PATCH', `/api/campaigns/${campaignId}/dm-clocks/${clockId}`, { stage: newStage });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'world-pressure'] }),
  });

  const removeClockMutation = useMutation({
    mutationFn: async (clockId: string) => {
      const res = await apiRequest('DELETE', `/api/campaigns/${campaignId}/dm-clocks/${clockId}`);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'world-pressure'] }),
  });

  const sparkMutation = useMutation({
    mutationFn: async (sparkType: string) => {
      const res = await apiRequest('POST', `/api/campaigns/${campaignId}/spark`, { sparkType });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'world-pressure'] });
      setShowSparks(false);
      toast({ title: "World disturbed", description: `${data.pressures?.length || 0} pressures and clocks seeded. A hidden variable stirs beneath the surface.` });
    },
  });

  if (!campaignId) return null;

  const dmPressures = pressure?.dmPressures || [];
  const dmClocks = pressure?.dmClocks || [];
  const hasDMContent = dmPressures.length > 0 || dmClocks.length > 0;
  const criticalStakes = pressure?.stakes?.filter(s => s.value >= 4) || [];
  const highThreads = pressure?.unresolvedThreads?.filter(t => t.urgency === "high" || t.urgency === "critical") || [];
  const urgencyCount = criticalStakes.length + highThreads.length + dmClocks.filter(c => c.stage >= c.maxStages - 1).length;
  const visibleSuggestions = (pressure?.suggestedPressures || []).filter(s => !dismissedSuggestions.has(s.name));

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="mb-2 rounded-lg border border-red-500/20 bg-gradient-to-r from-red-500/5 via-amber-500/5 to-transparent overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-2 p-2 hover:bg-red-500/5 transition-colors text-left">
            <Activity className="h-4 w-4 text-red-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-red-400">World Pressure</span>
            {urgencyCount > 0 && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">
                {urgencyCount} critical
              </Badge>
            )}
            {(dmPressures.length > 0 || dmClocks.length > 0) && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-slate-600/50 text-slate-300 border-slate-500/30">
                {dmPressures.length + dmClocks.length} active
              </Badge>
            )}
            {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />}
            {!isLoading && (expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground ml-auto" /> : <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />)}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-2 pb-2 space-y-2">
            {/* DM's own clocks - always first and prominent */}
            {dmClocks.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" /> Your Clocks
                </div>
                {dmClocks.map(clock => (
                  <ClockDisplay
                    key={clock.id}
                    clock={clock}
                    onAdvance={() => advanceClockMutation.mutate({ clockId: clock.id, newStage: Math.min(clock.stage + 1, clock.maxStages) })}
                    onRemove={() => removeClockMutation.mutate(clock.id)}
                  />
                ))}
              </div>
            )}

            {/* DM's own pressures */}
            {dmPressures.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <Flame className="h-2.5 w-2.5" /> Your Pressures
                </div>
                {dmPressures.map(p => (
                  <div key={p.id} className="flex items-center gap-2 text-xs group">
                    <Flame className="h-3 w-3 text-orange-400 flex-shrink-0" />
                    <span className="flex-1 truncate">{p.name}</span>
                    {p.daysToAdvance > 0 && <span className="text-[10px] text-muted-foreground">{p.daysToAdvance}d</span>}
                    <button onClick={() => removePressureMutation.mutate(p.id)} className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-500 hover:text-red-400 transition-all">x</button>
                  </div>
                ))}
              </div>
            )}

            {/* Primary actions: Create your own */}
            <div className="flex gap-1.5 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                onClick={() => { setShowAddPressure(!showAddPressure); setShowAddClock(false); }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Pressure
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                onClick={() => { setShowAddClock(!showAddClock); setShowAddPressure(false); }}
              >
                <Clock className="h-3 w-3 mr-1" />
                Add Clock
              </Button>
            </div>

            {/* Add Pressure Form */}
            {showAddPressure && (
              <div className="p-2 rounded-lg border border-amber-500/30 bg-slate-800/70 space-y-2">
                <Input
                  placeholder="What's happening in the world?"
                  value={newPressureName}
                  onChange={(e) => setNewPressureName(e.target.value)}
                  className="h-8 text-xs bg-slate-900/50 border-slate-600"
                  autoFocus
                />
                <Input
                  placeholder="What triggers escalation? (optional)"
                  value={newPressureTrigger}
                  onChange={(e) => setNewPressureTrigger(e.target.value)}
                  className="h-8 text-xs bg-slate-900/50 border-slate-600"
                />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-7 text-xs bg-amber-500/20 border-amber-500/30 text-amber-400 hover:bg-amber-500/30" variant="outline"
                    onClick={() => addPressureMutation.mutate({ name: newPressureName, trigger: newPressureTrigger })}
                    disabled={!newPressureName.trim() || addPressureMutation.isPending}
                  >
                    {addPressureMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAddPressure(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {/* Add Clock Form */}
            {showAddClock && (
              <div className="p-2 rounded-lg border border-red-500/30 bg-slate-800/70 space-y-2">
                <Input
                  placeholder="What's counting down? (e.g., 'Cult Ritual')"
                  value={newClockName}
                  onChange={(e) => setNewClockName(e.target.value)}
                  className="h-8 text-xs bg-slate-900/50 border-slate-600"
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">Stages</label>
                    <Input type="number" min={2} max={10} value={newClockStages} onChange={e => setNewClockStages(parseInt(e.target.value) || 5)} className="h-7 text-xs bg-slate-900/50 border-slate-600" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Days to advance</label>
                    <Input type="number" min={0} max={30} value={newClockDays} onChange={e => setNewClockDays(parseInt(e.target.value) || 0)} className="h-7 text-xs bg-slate-900/50 border-slate-600" />
                  </div>
                </div>
                <Input
                  placeholder="What advances it? (optional)"
                  value={newClockTrigger}
                  onChange={(e) => setNewClockTrigger(e.target.value)}
                  className="h-8 text-xs bg-slate-900/50 border-slate-600"
                />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-7 text-xs bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30" variant="outline"
                    onClick={() => addClockMutation.mutate({ name: newClockName, trigger: newClockTrigger, maxStages: newClockStages, daysToAdvance: newClockDays })}
                    disabled={!newClockName.trim() || addClockMutation.isPending}
                  >
                    {addClockMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create Clock"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAddClock(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {/* Campaign stakes from CAML data */}
            {pressure?.stakes && pressure.stakes.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Campaign Stakes</div>
                {pressure.stakes.map((stake, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Gauge className={`h-3 w-3 flex-shrink-0 ${stake.value >= 4 ? 'text-red-400' : stake.value >= 2 ? 'text-amber-400' : 'text-green-400'}`} />
                    <span className="text-xs flex-1 truncate">{stake.name}</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: stake.maxValue || 5 }).map((_, j) => (
                        <div key={j} className={`h-1.5 w-3 rounded-sm ${j < stake.value ? (stake.value >= 4 ? 'bg-red-400' : stake.value >= 2 ? 'bg-amber-400' : 'bg-green-400') : 'bg-muted-foreground/20'}`} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pressure?.activePressures && pressure.activePressures.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Active Tensions</div>
                {pressure.activePressures.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <Flame className="h-3 w-3 text-orange-400 flex-shrink-0" />
                    <span className="text-muted-foreground">{p}</span>
                  </div>
                ))}
              </div>
            )}

            {pressure?.rivalAgent && (
              <div className="p-1.5 rounded bg-purple-500/10 border border-purple-500/20">
                <div className="flex items-center gap-1.5">
                  <Eye className="h-3 w-3 text-purple-400" />
                  <span className="text-xs font-medium text-purple-300">
                    Rival: {pressure.rivalAgent.name || pressure.rivalAgent.id || "Unknown"}
                  </span>
                </div>
                {pressure.rivalAgent.nextAction && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 ml-4.5">
                    Next move: {typeof pressure.rivalAgent.nextAction === 'string' ? pressure.rivalAgent.nextAction : pressure.rivalAgent.nextAction?.description || 'Plotting...'}
                  </p>
                )}
              </div>
            )}

            {highThreads.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Urgent Threads</div>
                {highThreads.slice(0, 3).map((thread) => (
                  <div key={thread.id} className="flex items-center gap-2 text-xs">
                    <AlertTriangle className="h-3 w-3 text-red-400 flex-shrink-0" />
                    <span className="text-muted-foreground truncate">{thread.description}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Suggested pressures - only when DM has created nothing */}
            {visibleSuggestions.length > 0 && !hasDMContent && (
              <div className="space-y-1.5 pt-1 border-t border-dashed border-slate-700">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" /> Suggested — adopt or dismiss
                </div>
                {visibleSuggestions.map((sp, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs group p-1.5 rounded bg-slate-800/30 border border-dashed border-slate-700">
                    <Flame className="h-3 w-3 text-slate-500 flex-shrink-0" />
                    <span className="flex-1 text-slate-400 truncate">{sp.name}</span>
                    <button
                      className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                      onClick={() => addPressureMutation.mutate({ name: sp.name, trigger: sp.trigger, stage: sp.stage, maxStages: sp.maxStages, daysToAdvance: sp.daysToAdvance })}
                    >Adopt</button>
                    <button
                      className="text-[10px] px-1 py-0.5 rounded text-slate-500 hover:text-red-400 transition-colors"
                      onClick={() => setDismissedSuggestions(prev => new Set(prev).add(sp.name))}
                    >x</button>
                  </div>
                ))}
              </div>
            )}

            {/* Need inspiration? - Spark buttons */}
            <Collapsible open={showSparks} onOpenChange={setShowSparks}>
              <CollapsibleTrigger asChild>
                <button className="w-full text-left text-[10px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 pt-1">
                  <Sparkles className="h-2.5 w-2.5" />
                  {showSparks ? "Hide inspiration" : "Need inspiration? Choose a spark to disturb the world"}
                  {showSparks ? <ChevronUp className="h-2.5 w-2.5 ml-auto" /> : <ChevronDown className="h-2.5 w-2.5 ml-auto" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-2 gap-1.5 pt-1.5">
                  {SPARK_OPTIONS.map(spark => {
                    const SparkIcon = spark.icon;
                    return (
                      <button
                        key={spark.key}
                        className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-all ${spark.color}`}
                        onClick={() => sparkMutation.mutate(spark.key)}
                        disabled={sparkMutation.isPending}
                      >
                        {sparkMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <SparkIcon className="h-3 w-3" />}
                        {spark.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-600 mt-1.5 text-center">One tap seeds 2 clocks + 1 hidden variable — fully editable</p>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function DoNothingForecast({ campaignId }: { campaignId: number | null }) {
  const [visible, setVisible] = useState(false);
  const { data: pressure } = useQuery<WorldPressureData>({
    queryKey: ['/api/campaigns', campaignId, 'world-pressure'],
    enabled: !!campaignId,
    refetchInterval: 10000,
  });

  const forecasts = pressure?.doNothingForecast || [];
  if (!campaignId || forecasts.length === 0) return null;

  return (
    <Collapsible open={visible} onOpenChange={setVisible}>
      <div className="mb-2 rounded-lg border border-amber-500/20 bg-amber-500/5 overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-2 p-2 hover:bg-amber-500/10 transition-colors text-left">
            <TrendingUp className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
            <span className="text-xs font-medium text-amber-400">If the party does nothing...</span>
            {visible ? <ChevronUp className="h-3 w-3 text-muted-foreground ml-auto" /> : <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-2 pb-2 space-y-1">
            {forecasts.map((forecast, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-amber-500 font-mono text-[10px] mt-0.5">{i + 1}.</span>
                <span className="text-muted-foreground">{forecast}</span>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
  
  // DM Control Bar state
  const [isPaused, setIsPaused] = useState(false);
  const [sessionMode, setSessionMode] = useState<SessionMode>("exploration");
  const [narrativeMode, setNarrativeMode] = useState<NarrativeMode>("manual");
  const [checkpoints, setCheckpoints] = useState<Array<{ id: string; name: string; timestamp: Date; state: any }>>([]);
  const [undoStack, setUndoStack] = useState<any[]>([]);
  const [pendingEvents, setPendingEvents] = useState<PendingEvent[]>([]);
  const [processingEventId, setProcessingEventId] = useState<string | null>(null);
  const [aiWhispers, setAiWhispers] = useState<AIWhisper[]>([]);
  
  // Dice rolling and initiative state
  const [diceRolls, setDiceRolls] = useState<DiceRoll[]>([]);
  const [rollRequests, setRollRequests] = useState<RollRequest[]>([]);
  const [combatants, setCombatants] = useState<InitiativeCombatant[]>([]);
  const [isInCombat, setIsInCombat] = useState(false);
  const [currentTurnCombatantId, setCurrentTurnCombatantId] = useState<string | null>(null);
  const [roundNum, setRoundNum] = useState(1);
  const [lastVisibleRoll, setLastVisibleRoll] = useState<DiceRoll | null>(null);

  // Compute current turn index from combatant ID
  const sortedCombatants = [...combatants].sort((a, b) => b.initiative - a.initiative);
  const currentTurnIdx = currentTurnCombatantId 
    ? sortedCombatants.findIndex(c => c.id === currentTurnCombatantId)
    : 0;
  
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
    activeGroupChoices?: any[];
    groupChoiceVotes?: any[];
    groupChoiceStatus?: string;
    groupChoiceThreshold?: number;
    groupChoiceResolution?: any;
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

  const { data: campaign } = useQuery<{
    id: number;
    name: string;
    discordGuildId?: string | null;
    discordChannelId?: string | null;
  }>({
    queryKey: [`/api/campaigns/${selectedCampaignId}`],
    enabled: !!selectedCampaignId,
  });

  const { data: worldPressureData } = useQuery<WorldPressureData>({
    queryKey: ['/api/campaigns', selectedCampaignId, 'world-pressure'],
    enabled: !!selectedCampaignId,
    refetchInterval: 10000,
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

  // DM Control Bar handlers
  const handlePauseToggle = useCallback(() => {
    setIsPaused(prev => !prev);
    toast({
      title: isPaused ? "Session Resumed" : "Session Paused",
      description: isPaused ? "Players can now continue." : "All input is paused until you resume.",
    });
  }, [isPaused, toast]);

  const handleModeChange = useCallback((mode: SessionMode) => {
    setSessionMode(mode);
    toast({ title: "Mode Changed", description: `Session mode set to ${mode}.` });
  }, [toast]);

  const handleNarrativeModeChange = useCallback((mode: NarrativeMode) => {
    setNarrativeMode(mode);
    toast({ 
      title: mode === "autopilot" ? "AI Autopilot Enabled" : "Manual DM Mode",
      description: mode === "autopilot" 
        ? "AI will generate narrative responses automatically." 
        : "You control the narrative. Write your own responses.",
    });
  }, [toast]);

  const handleUndo = useCallback(() => {
    if (undoStack.length > 0) {
      const lastState = undoStack[undoStack.length - 1];
      setUndoStack(prev => prev.slice(0, -1));
      toast({ title: "Undo Successful", description: "Last action has been reversed." });
    }
  }, [undoStack, toast]);

  const handleCheckpoint = useCallback((name: string) => {
    const newCheckpoint = {
      id: `cp-${Date.now()}`,
      name,
      timestamp: new Date(),
      state: { 
        sessionArtifacts: dmSessionState?.sessionArtifacts,
        initiativeOrder: dmSessionState?.initiativeOrder,
        dmMessages: dmSessionState?.dmMessages,
      },
    };
    setCheckpoints(prev => [...prev, newCheckpoint]);
  }, [dmSessionState]);

  const handleRestoreCheckpoint = useCallback((checkpoint: { id: string; name: string; timestamp: Date; state: any }) => {
    toast({ title: "Checkpoint Restored", description: `Restored to "${checkpoint.name}"` });
  }, [toast]);

  const handleInjectNarration = useCallback((text: string) => {
    sendDmMessageMutation.mutate({ message: text, type: "narration" });
  }, [sendDmMessageMutation]);

  const handleForceStateChange = useCallback((change: { type: string; target: string; value: any }) => {
    toast({ 
      title: "State Override Applied", 
      description: `Set ${change.target}'s ${change.type} to ${change.value}` 
    });
  }, [toast]);

  const handleApproveEvent = useCallback((eventId: string) => {
    setProcessingEventId(eventId);
    setTimeout(() => {
      setPendingEvents(prev => prev.filter(e => e.id !== eventId));
      setProcessingEventId(null);
      toast({ title: "Event Approved", description: "The action has been executed." });
    }, 500);
  }, [toast]);

  const handleRejectEvent = useCallback((eventId: string) => {
    setPendingEvents(prev => prev.filter(e => e.id !== eventId));
    toast({ title: "Event Rejected", description: "The action has been discarded." });
  }, [toast]);

  const handleModifyEvent = useCallback((eventId: string, updatedEvent: PendingEvent) => {
    setPendingEvents(prev => prev.map(e => e.id === eventId ? updatedEvent : e));
    toast({ title: "Event Updated", description: `"${updatedEvent.title}" has been modified.` });
  }, [toast]);

  const handleAddEvent = useCallback((event: PendingEvent) => {
    setPendingEvents(prev => [...prev, event]);
    toast({ title: "Event Added", description: `"${event.title}" added to the queue.` });
  }, [toast]);

  const handleReorderEvents = useCallback((reorderedEvents: PendingEvent[]) => {
    setPendingEvents(reorderedEvents);
  }, []);

  const handleDismissWhisper = useCallback((whisperId: string) => {
    setAiWhispers(prev => prev.filter(w => w.id !== whisperId));
  }, []);

  const handleUseWhisperAsInspiration = useCallback((whisper: AIWhisper) => {
    setDmMessage(whisper.content);
    setAiWhispers(prev => prev.filter(w => w.id !== whisper.id));
    toast({ title: "Inspiration Added", description: "AI suggestion added to your message." });
  }, [toast]);

  // Dice rolling handlers
  const handleDiceRoll = useCallback((roll: DiceRoll) => {
    setDiceRolls(prev => [...prev, roll]);
    if (roll.isPublic) {
      setLastVisibleRoll(roll);
      setTimeout(() => setLastVisibleRoll(null), 5000);
    }
  }, []);

  const handleClearRolls = useCallback(() => {
    setDiceRolls([]);
  }, []);

  const handleRequestRoll = useCallback((request: Omit<RollRequest, "id" | "createdAt" | "status">) => {
    const newRequest: RollRequest = {
      ...request,
      id: `req-${Date.now()}`,
      status: "pending",
      createdAt: new Date(),
    };
    setRollRequests(prev => [...prev, newRequest]);
    toast({ title: "Roll Requested", description: `Waiting for ${request.targetPlayer} to roll.` });
  }, [toast]);

  const handleApproveRollRequest = useCallback((requestId: string) => {
    setRollRequests(prev => prev.map(r => 
      r.id === requestId ? { ...r, status: "completed" as const } : r
    ));
  }, []);

  const handleSkipRollRequest = useCallback((requestId: string) => {
    setRollRequests(prev => prev.map(r => 
      r.id === requestId ? { ...r, status: "skipped" as const } : r
    ));
  }, []);

  // Initiative handlers
  const handleStartCombat = useCallback(() => {
    const sorted = [...combatants].sort((a, b) => b.initiative - a.initiative);
    setIsInCombat(true);
    setCurrentTurnCombatantId(sorted.length > 0 ? sorted[0].id : null);
    setRoundNum(1);
    setSessionMode("combat");
    toast({ title: "Combat Started!", description: "Initiative order is now active." });
  }, [toast, combatants]);

  const handleEndCombat = useCallback(() => {
    setIsInCombat(false);
    setCurrentTurnCombatantId(null);
    setSessionMode("exploration");
    toast({ title: "Combat Ended", description: "Returning to exploration mode." });
  }, [toast]);

  const handleNextTurn = useCallback(() => {
    const sorted = [...combatants].sort((a, b) => b.initiative - a.initiative);
    if (sorted.length === 0) return;
    
    const currentIdx = currentTurnCombatantId 
      ? sorted.findIndex(c => c.id === currentTurnCombatantId)
      : -1;
    const nextIdx = (currentIdx + 1) % sorted.length;
    
    if (nextIdx === 0) {
      setRoundNum(prev => prev + 1);
    }
    setCurrentTurnCombatantId(sorted[nextIdx].id);
  }, [combatants, currentTurnCombatantId]);

  const handleAddCombatant = useCallback((combatant: Omit<InitiativeCombatant, "id" | "isCurrentTurn">) => {
    const newCombatant: InitiativeCombatant = {
      ...combatant,
      id: `comb-${Date.now()}`,
      isCurrentTurn: false,
    };
    setCombatants(prev => [...prev, newCombatant]);
  }, []);

  const handleRemoveCombatant = useCallback((id: string) => {
    setCombatants(prev => {
      const filtered = prev.filter(c => c.id !== id);
      if (id === currentTurnCombatantId && filtered.length > 0) {
        const sorted = [...filtered].sort((a, b) => b.initiative - a.initiative);
        const removedIdx = prev.sort((a, b) => b.initiative - a.initiative).findIndex(c => c.id === id);
        const nextCombatant = sorted[Math.min(removedIdx, sorted.length - 1)];
        setCurrentTurnCombatantId(nextCombatant?.id || null);
      } else if (filtered.length === 0) {
        setCurrentTurnCombatantId(null);
      }
      return filtered;
    });
  }, [currentTurnCombatantId]);

  const handleUpdateCombatant = useCallback((id: string, updates: Partial<InitiativeCombatant>) => {
    setCombatants(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const handleRollInitiativeForAll = useCallback(() => {
    const participantsWithChars = dmSessionState?.participantsWithChars || participants || [];
    const newCombatants: InitiativeCombatant[] = [];
    
    participantsWithChars.forEach((p: any) => {
      if (p.character) {
        const dexMod = Math.floor(((p.character.dexterity || 10) - 10) / 2);
        const roll = Math.floor(Math.random() * 20) + 1 + dexMod;
        newCombatants.push({
          id: `comb-${p.character.id}`,
          name: p.character.name,
          initiative: roll,
          isPlayer: true,
          characterId: p.character.id,
          hp: p.character.hitPoints || 10,
          maxHp: p.character.maxHitPoints || 10,
          ac: p.character.armorClass || 10,
          conditions: [],
          isCurrentTurn: false,
        });
        
        setDiceRolls(prev => [...prev, {
          id: `init-${p.character.id}-${Date.now()}`,
          dice: "1d20",
          result: roll - dexMod,
          breakdown: [roll - dexMod],
          modifier: dexMod,
          total: roll,
          roller: p.character.name,
          rollerType: "player",
          isPublic: true,
          isCritical: (roll - dexMod) === 20,
          isFumble: (roll - dexMod) === 1,
          timestamp: new Date(),
          purpose: "Initiative",
        }]);
      }
    });
    
    setCombatants(newCombatants);
    toast({ title: "Initiative Rolled!", description: `${newCombatants.length} combatants added.` });
  }, [dmSessionState?.participantsWithChars, participants, toast]);

  // Generate sample AI whispers based on session state
  useEffect(() => {
    const artifacts = dmSessionState?.sessionArtifacts || [];
    if (selectedCampaignId && liveSession?.narrative && aiWhispers.length === 0) {
      const sampleWhispers: AIWhisper[] = [];
      if (artifacts.length > 0) {
        sampleWhispers.push({
          id: `whisper-${Date.now()}-1`,
          type: "hook",
          content: "Consider introducing a consequence from earlier choices.",
          priority: "medium",
          timestamp: new Date(),
        });
      }
      if (liveSession.isInCombat || isInCombat) {
        sampleWhispers.push({
          id: `whisper-${Date.now()}-2`,
          type: "pacing",
          content: "Combat has been active for a while. Consider offering a dramatic resolution.",
          priority: "low",
          timestamp: new Date(),
        });
      }
      if (sampleWhispers.length > 0) {
        setAiWhispers(sampleWhispers);
      }
    }
  }, [selectedCampaignId, liveSession, dmSessionState?.sessionArtifacts?.length, aiWhispers.length, isInCombat]);

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
      {/* DM Control Bar - Collapsed to bottom by default */}

      {/* Discord Channel Link */}
      <div className="mb-2 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/20">
        <SiDiscord className="h-4 w-4 text-[#5865F2]" />
        {campaign?.discordChannelId && campaign?.discordGuildId ? (
          <a
            href={`https://discord.com/channels/${campaign.discordGuildId}/${campaign.discordChannelId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#5865F2] hover:underline flex items-center gap-1"
          >
            Open Discord Channel
            <ChevronRight className="h-3 w-3" />
          </a>
        ) : (
          <a
            href="/dm-toolkit?tab=discord"
            className="text-sm text-[#5865F2] hover:underline flex items-center gap-1"
          >
            Connect Discord Channel
            <Plus className="h-3 w-3" />
          </a>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {campaign?.discordChannelId ? "Linked" : "Not linked"}
        </span>
      </div>

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
        {/* Cast & World Panel - The DM's entity library */}
        <div
          className={`transition-all duration-300 ${
            sidebarOpen ? "w-72" : "w-12"
          } flex-shrink-0`}
        >
          <div className={`h-full rounded-xl overflow-hidden ${sidebarOpen ? 'border-2 border-blue-500/30 bg-slate-900/80' : 'border border-dashed border-slate-600 bg-muted/20'}`}>
            {/* Header */}
            <div
              className={`flex items-center gap-2 cursor-pointer select-none ${
                sidebarOpen
                  ? 'px-3 py-2.5 bg-gradient-to-r from-blue-500/15 via-blue-500/10 to-transparent border-b border-blue-500/20'
                  : 'flex-col py-3 px-1'
              }`}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? (
                <>
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-500/20 border border-blue-500/30">
                    <Package className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-bold tracking-wide text-blue-300 uppercase">Cast & World</span>
                    <span className="text-[10px] text-blue-400/50 ml-2">Drag to table</span>
                  </div>
                  <ChevronLeft className="h-4 w-4 text-blue-400/60" />
                </>
              ) : (
                <>
                  <Package className="h-4 w-4 text-blue-400/70 mb-1" />
                  <span className="text-[9px] font-bold text-blue-400/70 uppercase tracking-wider writing-mode-vertical" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                    Cast & World
                  </span>
                  <ChevronRight className="h-3 w-3 text-blue-400/40 mt-1" />
                </>
              )}
            </div>
            
            {sidebarOpen && (
              <div className="p-2 h-[calc(100%-46px)]">
                <Tabs value={sidebarTab} onValueChange={setSidebarTab}>
                  <TabsList className="grid w-full grid-cols-4 h-8 mb-2 bg-slate-800/80">
                    <TabsTrigger value="npcs" className="text-[11px] p-1 gap-1 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300" title="People & Characters">
                      <Users className="h-3 w-3" />
                      <span className="hidden sm:inline">People</span>
                    </TabsTrigger>
                    <TabsTrigger value="locations" className="text-[11px] p-1 gap-1 data-[state=active]:bg-green-500/20 data-[state=active]:text-green-300" title="Places & Locations">
                      <MapPin className="h-3 w-3" />
                      <span className="hidden sm:inline">Places</span>
                    </TabsTrigger>
                    <TabsTrigger value="monsters" className="text-[11px] p-1 gap-1 data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300" title="Monsters & Threats">
                      <Skull className="h-3 w-3" />
                      <span className="hidden sm:inline">Threats</span>
                    </TabsTrigger>
                    <TabsTrigger value="map" className="text-[11px] p-1 gap-1 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300" title="Exploration Map">
                      <Map className="h-3 w-3" />
                      <span className="hidden sm:inline">Map</span>
                    </TabsTrigger>
                  </TabsList>

                  <ScrollArea className="h-[calc(100%-50px)] mt-2">
                    <div className="space-y-1.5 pr-2">
                      {/* Party Characters - always show on People tab */}
                      {sidebarTab === "npcs" && participants && participants.filter((p: any) => p.character).length > 0 && (
                        <>
                          <div className="text-[11px] font-bold text-emerald-400/80 flex items-center gap-1.5 mt-1 mb-1 uppercase tracking-wider">
                            <Shield className="h-3 w-3" /> Party Characters
                          </div>
                          {participants.filter((p: any) => p.character).map((p: any) => (
                            <DraggableItem
                              key={`char-${p.character.id}`}
                              entity={{
                                id: `character-${p.character.id}`,
                                type: "character" as const,
                                name: p.character.name,
                                data: p.character,
                              }}
                            />
                          ))}
                          <Separator className="my-2 bg-slate-700/50" />
                        </>
                      )}

                      {/* CAML Entities Section */}
                      {(sidebarTab === "npcs" && camlNpcs.length > 0) && (
                        <>
                          <div className="text-[11px] font-bold text-amber-400/80 flex items-center gap-1.5 mt-1 mb-1 uppercase tracking-wider">
                            <Sparkles className="h-3 w-3" /> Campaign NPCs
                          </div>
                          {camlNpcs.map((entity) => (
                            <DraggableItem key={entity.id} entity={entity} />
                          ))}
                          <Separator className="my-2 bg-slate-700/50" />
                        </>
                      )}
                      {(sidebarTab === "items" && camlItems.length > 0) && (
                        <>
                          <div className="text-[11px] font-bold text-amber-400/80 flex items-center gap-1.5 mt-1 mb-1 uppercase tracking-wider">
                            <Sparkles className="h-3 w-3" /> Campaign Items
                          </div>
                          {camlItems.map((entity) => (
                            <DraggableItem key={entity.id} entity={entity} />
                          ))}
                          <Separator className="my-2 bg-slate-700/50" />
                        </>
                      )}
                      {(sidebarTab === "encounters" && camlEncounters.length > 0) && (
                        <>
                          <div className="text-[11px] font-bold text-amber-400/80 flex items-center gap-1.5 mt-1 mb-1 uppercase tracking-wider">
                            <Sparkles className="h-3 w-3" /> Campaign Encounters
                          </div>
                          {camlEncounters.map((entity) => (
                            <DraggableItem key={entity.id} entity={entity} />
                          ))}
                          <Separator className="my-2 bg-slate-700/50" />
                        </>
                      )}
                      {(sidebarTab === "locations" && camlLocations.length > 0) && (
                        <>
                          <div className="text-[11px] font-bold text-amber-400/80 flex items-center gap-1.5 mt-1 mb-1 uppercase tracking-wider">
                            <Sparkles className="h-3 w-3" /> Campaign Locations
                          </div>
                          {camlLocations.map((entity) => (
                            <DraggableItem key={entity.id} entity={entity} />
                          ))}
                          <Separator className="my-2 bg-slate-700/50" />
                        </>
                      )}
                      {(sidebarTab === "quests" && camlQuests.length > 0) && (
                        <>
                          <div className="text-[11px] font-bold text-amber-400/80 flex items-center gap-1.5 mt-1 mb-1 uppercase tracking-wider">
                            <Sparkles className="h-3 w-3" /> Campaign Quests
                          </div>
                          {camlQuests.map((entity) => (
                            <DraggableItem key={entity.id} entity={entity} />
                          ))}
                          <Separator className="my-2 bg-slate-700/50" />
                        </>
                      )}

                      {/* Database Entities */}
                      {sidebarTab !== "map" && (
                        <>
                          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 mt-1 mb-1 uppercase tracking-wider">
                            Library
                          </div>
                          {buildEntityList(sidebarTab).map((entity) => (
                            <DraggableItem key={entity.id} entity={entity} />
                          ))}
                        </>
                      )}
                      
                      {buildEntityList(sidebarTab).length === 0 && sidebarTab !== "map" && (
                        <div className="text-center py-6 px-2">
                          <div className="text-muted-foreground/40 mb-2">
                            {sidebarTab === "npcs" && <Users className="h-8 w-8 mx-auto" />}
                            {sidebarTab === "locations" && <MapPin className="h-8 w-8 mx-auto" />}
                            {sidebarTab === "monsters" && <Skull className="h-8 w-8 mx-auto" />}
                          </div>
                          <p className="text-xs text-muted-foreground/60">
                            No {sidebarTab === "npcs" ? "NPCs" : sidebarTab === "monsters" ? "monsters" : sidebarTab} in your library yet
                          </p>
                          <p className="text-[10px] text-muted-foreground/40 mt-1">
                            Create them in the DM Toolkit generators
                          </p>
                        </div>
                      )}
                      
                      {/* Map Tab Content */}
                      {sidebarTab === "map" && selectedCampaignId && (
                        <div className="space-y-2">
                          <div className="text-[11px] font-bold text-amber-400/80 flex items-center gap-1.5 uppercase tracking-wider">
                            <Map className="h-3 w-3" /> Live Exploration Map
                          </div>
                          <div className="h-48 border rounded-lg border-slate-700 overflow-hidden">
                            <ProceduralExplorationMap 
                              campaignId={selectedCampaignId} 
                              interactive={true}
                              compact={true}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground/60 text-center">
                            Click adjacent hexes to move party
                          </p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </Tabs>
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area - Current Scene is dominant */}
        <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 overflow-hidden">
          {/* Left Reference Column - Peripheral stats (muted, compact) */}
          <div className="lg:w-52 flex-shrink-0 space-y-2 overflow-y-auto max-h-full">
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

            {/* Exploration Map - Compact DM view */}
            {selectedCampaignId && (
              <div className="rounded overflow-hidden bg-slate-900/50 border border-muted">
                <ProceduralExplorationMap
                  campaignId={selectedCampaignId}
                  interactive={false}
                  compact={true}
                />
              </div>
            )}

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

          {/* CENTER: World Tension First, Table Below */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* World Pressure Overview - replaces Session Focus */}
            <WorldPressureOverview campaignId={selectedCampaignId} />
            <DoNothingForecast campaignId={selectedCampaignId} />

            {/* Scene Stakes Header */}
            <div className="mb-2 flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold text-amber-400">Your Table</span>
              </div>
              {narrativeMode === "manual" && (
                <Badge variant="outline" className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30">
                  <User className="h-2.5 w-2.5 mr-0.5" />
                  DM Control
                </Badge>
              )}
              {narrativeMode === "autopilot" && (
                <Badge variant="outline" className="text-[10px] bg-purple-500/20 text-purple-400 border-purple-500/30">
                  <Bot className="h-2.5 w-2.5 mr-0.5" />
                  AI Autopilot
                </Badge>
              )}
              {isInCombat && (
                <Badge variant="outline" className="text-[10px] bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">
                  <Swords className="h-2.5 w-2.5 mr-0.5" />
                  Round {roundNum}
                </Badge>
              )}
              {sessionArtifacts.length > 0 && (
                <span className="text-[10px] text-muted-foreground ml-auto">{sessionArtifacts.length} on table</span>
              )}
            </div>

            {/* The VTT Table - Map as background, drag-and-drop surface */}
            <Card className="flex-1 ring-2 ring-amber-500/50 shadow-xl relative overflow-hidden">
              {/* Dramatic Roll Display Overlay */}
              {lastVisibleRoll && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
                  <div className={`p-8 rounded-xl text-center transform animate-in zoom-in-95 duration-300 ${
                    lastVisibleRoll.isCritical ? "bg-gradient-to-br from-green-500/30 to-green-900/50 border-2 border-green-500 shadow-2xl shadow-green-500/30" :
                    lastVisibleRoll.isFumble ? "bg-gradient-to-br from-red-500/30 to-red-900/50 border-2 border-red-500 shadow-2xl shadow-red-500/30" :
                    "bg-gradient-to-br from-amber-500/30 to-slate-900/50 border-2 border-amber-500/50 shadow-2xl"
                  }`}>
                    <div className="flex items-center justify-center gap-2 mb-2 text-slate-400">
                      <Crown className="h-4 w-4 text-amber-400" />
                      <span className="text-sm font-medium">{lastVisibleRoll.roller}</span>
                    </div>
                    <div className="text-sm text-slate-400 mb-1">
                      {lastVisibleRoll.dice} {lastVisibleRoll.purpose && `• ${lastVisibleRoll.purpose}`}
                    </div>
                    <div className={`text-7xl font-black mb-2 ${
                      lastVisibleRoll.isCritical ? "text-green-400 animate-pulse" :
                      lastVisibleRoll.isFumble ? "text-red-400" :
                      "text-white"
                    }`}>
                      {lastVisibleRoll.total}
                    </div>
                    {lastVisibleRoll.isCritical && (
                      <div className="text-green-400 text-lg font-bold tracking-wider animate-pulse">
                        CRITICAL HIT!
                      </div>
                    )}
                    {lastVisibleRoll.isFumble && (
                      <div className="text-red-400 text-lg font-bold tracking-wider">
                        NATURAL 1...
                      </div>
                    )}
                    <div className="text-xs text-slate-500 mt-2">
                      [{lastVisibleRoll.breakdown.join(", ")}]
                      {lastVisibleRoll.modifier !== 0 && ` ${lastVisibleRoll.modifier > 0 ? "+" : ""}${lastVisibleRoll.modifier}`}
                    </div>
                  </div>
                </div>
              )}

              {/* Map Background Layer */}
              <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
                {selectedCampaignId && (
                  <ProceduralExplorationMap
                    campaignId={selectedCampaignId}
                    interactive={false}
                    compact={true}
                  />
                )}
              </div>

              <CardContent className="p-3 flex-1 relative z-10">
                <DroppableZone id="session-dropzone" isOver={!!activeId}>
                  <ScrollArea className="h-[280px]">
                    {sessionArtifacts.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {sessionArtifacts.map((artifact) => (
                          <div
                            key={artifact.id}
                            className="p-3 rounded-lg border-2 border-amber-500/20 bg-card/90 backdrop-blur-sm hover:bg-amber-500/10 transition-colors shadow-sm"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {artifact.type === "npc" && <Users className="h-4 w-4 text-blue-500" />}
                              {artifact.type === "item" && <Package className="h-4 w-4 text-amber-500" />}
                              {artifact.type === "encounter" && <Sword className="h-4 w-4 text-red-500" />}
                              {artifact.type === "monster" && <Skull className="h-4 w-4 text-purple-500" />}
                              {artifact.type === "location" && <MapPin className="h-4 w-4 text-green-500" />}
                              {artifact.type === "quest" && <Target className="h-4 w-4 text-orange-500" />}
                              <span className="font-medium text-sm">{artifact.name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                        <div className="p-4 rounded-full bg-amber-500/10 backdrop-blur-sm mb-4">
                          <Upload className="h-8 w-8 text-amber-500/70" />
                        </div>
                        <p className="text-base font-medium mb-1">Your table awaits</p>
                        <p className="text-sm text-center max-w-[250px]">
                          Drag encounters, NPCs, items and locations from the drawer to bring them into play
                        </p>
                      </div>
                    )}
                  </ScrollArea>
                </DroppableZone>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Fixed Sidebar with Tabs - Extends to footer */}
          <div className="lg:w-72 flex-shrink-0 h-full">
            <Card className="h-full bg-slate-900/50 border-slate-700 overflow-hidden">
              {/* Tabbed Header */}
              <Tabs defaultValue="queue" className="h-full flex flex-col [&>[data-state=active]]:flex-1 [&>[data-state=active]]:flex [&>[data-state=active]]:flex-col">
                <TabsList className="grid w-full grid-cols-4 h-9 bg-slate-800 rounded-b-none">
                  <TabsTrigger value="queue" className="text-xs gap-1 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                    <Flame className="h-3 w-3" />
                    Ripples
                    {(pendingEvents.length > 0 || (liveSession?.choices?.length || 0) > 0) && (
                      <Badge variant="outline" className="h-4 px-1 text-[10px] bg-amber-500/30 border-amber-500/50">
                        {pendingEvents.length || liveSession?.choices?.length || 0}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="dice" className="text-xs gap-1 data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400">
                    <Dice6 className="h-3 w-3" />
                    Dice
                    {isInCombat && (
                      <Badge variant="outline" className="h-4 px-1 text-[10px] bg-red-500/30 border-red-500/50 animate-pulse">
                        R{roundNum}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="whisper" className="text-xs gap-1 data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
                    <MessageSquare className="h-3 w-3" />
                    AI
                    {aiWhispers.length > 0 && (
                      <Badge variant="outline" className="h-4 px-1 text-[10px] bg-purple-500/30 border-purple-500/50">
                        {aiWhispers.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="say" className="text-xs gap-1 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                    <Send className="h-3 w-3" />
                    Say
                  </TabsTrigger>
                </TabsList>

                {/* EMERGING CONSEQUENCES Tab */}
                {/* Sized by the parent flex column (`flex-1` + `min-h-0`), not by
                    `calc(100% - 36px)`: that magic number silently tracked the
                    TabsList's h-9 and resolved to auto whenever an ancestor had
                    no definite height, collapsing the panel to nothing. */}
                <TabsContent value="queue" className="min-h-0 flex flex-col p-3 mt-0 overflow-hidden space-y-3">
                  {/* Group Choice Voting Panel */}
                  <GroupChoicePanel
                    campaignId={selectedCampaignId}
                    activeChoices={dmSessionState?.activeGroupChoices || []}
                    votes={dmSessionState?.groupChoiceVotes || []}
                    status={dmSessionState?.groupChoiceStatus || 'none'}
                    resolution={dmSessionState?.groupChoiceResolution}
                    participantCount={(dmSessionState?.participantsWithChars || participants || []).length}
                    isDM={true}
                  />
                  <EventQueue
                    events={pendingEvents.length > 0 ? pendingEvents : (
                      liveSession?.choices?.map((choice: any, idx: number) => ({
                        id: `choice-${idx}`,
                        source: "player" as const,
                        type: "narrative" as const,
                        intent: choice.type === "combat" ? "combat" as const : 
                               choice.type === "dialogue" ? "dialogue" as const : 
                               "investigation" as const,
                        title: choice.text?.substring(0, 50) || "Player Action",
                        description: choice.text || "",
                        impact: "Advances the narrative",
                        affectedEntities: [],
                        timestamp: new Date(),
                        isReversible: true,
                      })) || []
                    )}
                    onApprove={handleApproveEvent}
                    onReject={handleRejectEvent}
                    onModify={handleModifyEvent}
                    onAddEvent={handleAddEvent}
                    onReorder={handleReorderEvents}
                    isProcessing={processingEventId}
                    suggestedWorldEvents={worldPressureData?.suggestedWorldEvents}
                  />
                </TabsContent>

                {/* DICE Tab - Roll dice, manage initiative */}
                <TabsContent value="dice" className="min-h-0 p-3 mt-0 overflow-y-auto space-y-3">
                  <DMDiceRoller onRoll={handleDiceRoll} />
                  <InitiativeTracker
                    combatants={combatants}
                    currentTurnIndex={currentTurnIdx}
                    roundNumber={roundNum}
                    isInCombat={isInCombat}
                    onStartCombat={handleStartCombat}
                    onEndCombat={handleEndCombat}
                    onNextTurn={handleNextTurn}
                    onAddCombatant={handleAddCombatant}
                    onRemoveCombatant={handleRemoveCombatant}
                    onUpdateCombatant={handleUpdateCombatant}
                    onRollInitiativeForAll={handleRollInitiativeForAll}
                    participants={participants}
                  />
                  <RollQueue
                    rolls={diceRolls}
                    requests={rollRequests}
                    onRequestRoll={handleRequestRoll}
                    onClearRolls={handleClearRolls}
                    onApproveRequest={handleApproveRollRequest}
                    onSkipRequest={handleSkipRollRequest}
                    participants={participants}
                  />
                </TabsContent>

                {/* AI WHISPER Tab */}
                <TabsContent value="whisper" className="min-h-0 p-3 mt-0 overflow-y-auto">
                  <AIWhisperPanel
                    whispers={aiWhispers}
                    onDismiss={handleDismissWhisper}
                    onUseAsInspiration={handleUseWhisperAsInspiration}
                  />
                  <div className="mt-3">
                    <ArcSignalsPanel campaignId={selectedCampaignId} />
                  </div>
                </TabsContent>

                {/* SAY Tab - Tell Your Story */}
                <TabsContent value="say" className="min-h-0 p-3 mt-0 overflow-y-auto">
                  <Card className="flex-1 border-2 border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-transparent">
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
                        className="min-h-[120px] text-sm border-amber-500/30 focus:border-amber-500 bg-background/50"
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
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </div>

      {/* DM Command Center - Always visible at bottom */}
      <div className="mt-3 rounded-xl border-2 border-amber-500/40 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 overflow-hidden shadow-lg shadow-amber-500/5">
        <div className="flex items-center gap-2.5 px-4 py-2 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border-b border-amber-500/20">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-amber-500/20 border border-amber-500/30">
            <Shield className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <span className="text-sm font-bold tracking-wide text-amber-300 uppercase">Command Center</span>
          {isPaused && (
            <Badge variant="outline" className="h-5 px-2 text-[11px] font-semibold bg-red-500/20 text-red-400 border-red-500/40 animate-pulse">
              Session Paused
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] font-medium text-amber-400/60 uppercase tracking-wider">
              {sessionMode}
            </span>
            <span className="text-amber-500/30">|</span>
            <span className="text-[11px] font-medium text-amber-400/60 uppercase tracking-wider">
              {narrativeMode === 'manual' ? 'DM Control' : 'AI Assist'}
            </span>
          </div>
        </div>
        <DMControlBar
          campaignId={selectedCampaignId}
          isPaused={isPaused}
          onPauseToggle={handlePauseToggle}
          sessionMode={sessionMode}
          onModeChange={handleModeChange}
          narrativeMode={narrativeMode}
          onNarrativeModeChange={handleNarrativeModeChange}
          onUndo={handleUndo}
          canUndo={undoStack.length > 0}
          onCheckpoint={handleCheckpoint}
          onRestoreCheckpoint={handleRestoreCheckpoint}
          checkpoints={checkpoints}
          onInjectNarration={handleInjectNarration}
          onForceStateChange={handleForceStateChange}
        />
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
