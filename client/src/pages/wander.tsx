import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Compass,
  Footprints,
  Shield,
  Sword,
  MapPin,
  AlertTriangle,
  BookOpen,
  ArrowLeft,
  Sparkles,
  Eye,
  Clock,
  Heart,
  ChevronDown,
  ChevronUp,
  Loader2,
  Trophy,
  Star,
  Flame,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface WanderRun {
  id: number;
  userId: number;
  campaignId: number;
  characterId: number;
  currentHexQ: number;
  currentHexR: number;
  tick: number;
  fatigue: number;
  status: string;
  lastOutcomeType?: string;
  startedAt?: string;
  endedAt?: string;
}

interface OutcomeChoice {
  id: string;
  label: string;
  intentTag: string;
  mechanicalEffects?: Record<string, any>;
}

interface OutcomeReward {
  kind: string;
  name: string;
  quantity: number;
}

interface CuratedOutcome {
  type: "discovery" | "quiet" | "risk" | "none";
  title: string;
  reveal: string;
  detail?: string;
  choices: OutcomeChoice[];
  rewards?: OutcomeReward[];
  markerType?: string;
  combatSeed?: any;
}

interface JournalEntry {
  tick: number;
  hexQ: number;
  hexR: number;
  outcomeType: string;
  title: string;
  rewards?: OutcomeReward[];
}

interface WanderMarker {
  id?: number;
  campaignId: number;
  hexQ: number;
  hexR: number;
  markerType: string;
  title: string;
  blurb?: string;
}

interface WanderSummary {
  totalMoves: number;
  discoveries: number;
  combatEncounters: number;
  markersPlaced: number;
  rewards: OutcomeReward[];
}

function axialToPixel(q: number, r: number, size: number) {
  const x = size * Math.sqrt(3) * (q + r / 2);
  const y = size * 1.5 * r;
  return { x, y };
}

function hexPoints(cx: number, cy: number, size: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    return `${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`;
  }).join(" ");
}

function hexDistance(q1: number, r1: number, q2: number, r2: number) {
  return Math.max(Math.abs(q1 - q2), Math.abs(r1 - r2), Math.abs(q1 + r1 - q2 - r2));
}

const HEX_DIRECTIONS = [
  { dq: 1, dr: 0 },
  { dq: 1, dr: -1 },
  { dq: 0, dr: -1 },
  { dq: -1, dr: 0 },
  { dq: -1, dr: 1 },
  { dq: 0, dr: 1 },
];

const OUTCOME_STYLES: Record<string, { border: string; bg: string; icon: typeof Sparkles; iconColor: string }> = {
  discovery: { border: "border-amber-500/60", bg: "bg-amber-950/40", icon: Sparkles, iconColor: "text-amber-400" },
  quiet: { border: "border-blue-500/40", bg: "bg-blue-950/30", icon: Eye, iconColor: "text-blue-400" },
  risk: { border: "border-red-500/50", bg: "bg-red-950/30", icon: AlertTriangle, iconColor: "text-red-400" },
  none: { border: "border-slate-600/40", bg: "bg-slate-900/30", icon: Compass, iconColor: "text-slate-400" },
};

const MARKER_ICONS: Record<string, string> = {
  landmark: "🏛️",
  trace: "👣",
  hazard: "⚠️",
  resource: "💎",
  npc_echo: "👤",
  opportunity: "✨",
};

const TERRAIN_TYPES = ['plains', 'forest', 'mountain', 'swamp', 'desert', 'ocean'] as const;
type TerrainType = typeof TERRAIN_TYPES[number];

const TERRAIN_COLORS: Record<TerrainType, { fill: string; stroke: string; exploredFill: string; label: string; icon: string }> = {
  plains:   { fill: "#1a2a1a", stroke: "#3a5a3a", exploredFill: "#2a3d1e", label: "Plains",   icon: "🌾" },
  forest:   { fill: "#0f2a1a", stroke: "#1e5a3a", exploredFill: "#1a3d28", label: "Forest",   icon: "🌲" },
  mountain: { fill: "#2a2530", stroke: "#5a4f6a", exploredFill: "#3a3545", label: "Mountain", icon: "⛰️" },
  swamp:    { fill: "#1a2520", stroke: "#3a5a50", exploredFill: "#253830", label: "Swamp",    icon: "🌿" },
  desert:   { fill: "#2a2518", stroke: "#5a4f30", exploredFill: "#3d3520", label: "Desert",   icon: "🏜️" },
  ocean:    { fill: "#0f1a2a", stroke: "#1e3a5a", exploredFill: "#1a2840", label: "Ocean",    icon: "🌊" },
};

function getTerrainForHex(q: number, r: number): TerrainType {
  let h = ((q * 374761393 + r * 668265263) ^ 0x5f3759df) >>> 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = ((h >> 16) ^ h) >>> 0;
  const idx = h % 100;
  if (idx < 35) return 'plains';
  if (idx < 60) return 'forest';
  if (idx < 75) return 'mountain';
  if (idx < 85) return 'swamp';
  if (idx < 93) return 'desert';
  return 'ocean';
}

function getDangerColor(rating: number) {
  if (rating < 20) return "bg-emerald-500";
  if (rating < 40) return "bg-yellow-500";
  if (rating < 60) return "bg-orange-500";
  return "bg-red-500";
}

function getDangerLabel(rating: number) {
  if (rating < 20) return "Safe";
  if (rating < 40) return "Cautious";
  if (rating < 60) return "Dangerous";
  return "Deadly";
}

export default function WanderPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>("");
  const [activeRun, setActiveRun] = useState<WanderRun | null>(null);
  const [currentOutcome, setCurrentOutcome] = useState<CuratedOutcome | null>(null);
  const [currentDangerRating, setCurrentDangerRating] = useState(0);
  const [exploredHexes, setExploredHexes] = useState<Set<string>>(new Set(["0,0"]));
  const [markers, setMarkers] = useState<WanderMarker[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [wanderSummary, setWanderSummary] = useState<WanderSummary | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  const { data: campaigns, isLoading: campaignsLoading } = useQuery<any[]>({
    queryKey: ["/api/campaigns"],
  });

  const { data: characters, isLoading: charactersLoading } = useQuery<any[]>({
    queryKey: ["/api/characters"],
  });

  const campaignId = selectedCampaignId ? parseInt(selectedCampaignId) : null;

  const { data: existingRun } = useQuery<WanderRun | null>({
    queryKey: ["/api/wander/active", campaignId],
    queryFn: async () => {
      if (!campaignId) return null;
      const res = await fetch(`/api/wander/active/${campaignId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!campaignId,
  });

  const { data: fetchedMarkers } = useQuery<WanderMarker[]>({
    queryKey: ["/api/wander/markers", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const res = await fetch(`/api/wander/markers/${campaignId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!campaignId && !!activeRun,
  });

  const { data: fetchedHexes } = useQuery<any[]>({
    queryKey: ["/api/wander/hexes", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const res = await fetch(`/api/wander/hexes/${campaignId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!campaignId && !!activeRun,
  });

  useState(() => {
    if (existingRun && existingRun.status === "active" && !activeRun) {
      setActiveRun(existingRun);
      if (fetchedHexes) {
        const hexSet = new Set<string>();
        fetchedHexes.forEach((h: any) => hexSet.add(`${h.hexQ},${h.hexR}`));
        if (hexSet.size > 0) setExploredHexes(hexSet);
      }
      if (fetchedMarkers) {
        setMarkers(fetchedMarkers);
      }
    }
  });

  const startMutation = useMutation({
    mutationFn: async (data: { campaignId: number; characterId: number; startHexQ: number; startHexR: number }) => {
      const res = await apiRequest("POST", "/api/wander/start", data);
      return res.json();
    },
    onSuccess: (run: WanderRun) => {
      setActiveRun(run);
      setExploredHexes(new Set(["0,0"]));
      setMarkers([]);
      setJournalEntries([]);
      setCurrentOutcome(null);
      setCurrentDangerRating(0);
      queryClient.invalidateQueries({ queryKey: ["/api/wander/active", campaignId] });
      toast({ title: "Journey Begins", description: "You step into the wilds..." });
    },
    onError: (error: any) => {
      const msg = error?.message || "";
      if (msg.includes("already exists")) {
        toast({ title: "Active Run Found", description: "Loading your existing wander run..." });
        if (existingRun) {
          setActiveRun(existingRun);
        }
      } else {
        toast({ title: "Failed to Start", description: msg, variant: "destructive" });
      }
    },
  });

  const moveMutation = useMutation({
    mutationFn: async (data: { runId: number; toHexQ: number; toHexR: number; terrainType?: string }) => {
      const res = await apiRequest("POST", "/api/wander/move", data);
      return res.json();
    },
    onSuccess: (data: { run: WanderRun; outcome: CuratedOutcome; dangerRating: number }) => {
      setActiveRun(data.run);
      setCurrentOutcome(data.outcome);
      setCurrentDangerRating(data.dangerRating);
      setExploredHexes((prev) => {
        const next = new Set(prev);
        next.add(`${data.run.currentHexQ},${data.run.currentHexR}`);
        return next;
      });
      setJournalEntries((prev) => [
        ...prev,
        {
          tick: data.run.tick,
          hexQ: data.run.currentHexQ,
          hexR: data.run.currentHexR,
          outcomeType: data.outcome.type,
          title: data.outcome.title,
          rewards: data.outcome.rewards,
        },
      ]);
      setIsMoving(false);
    },
    onError: (error: Error) => {
      setIsMoving(false);
      toast({ title: "Move Failed", description: error.message, variant: "destructive" });
    },
  });

  const chooseMutation = useMutation({
    mutationFn: async (data: { runId: number; choiceId: string; outcomeData: CuratedOutcome }) => {
      const res = await apiRequest("POST", "/api/wander/choose", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.markerCreated && currentOutcome) {
        const newMarker: WanderMarker = {
          campaignId: activeRun!.campaignId,
          hexQ: activeRun!.currentHexQ,
          hexR: activeRun!.currentHexR,
          markerType: currentOutcome.markerType || "trace",
          title: currentOutcome.title,
        };
        setMarkers((prev) => [...prev, newMarker]);
      }
      if (data.resolution) {
        const fatigueDelta = data.resolution.fatigueChange || 0;
        if (activeRun) {
          setActiveRun((prev) =>
            prev ? { ...prev, fatigue: Math.max(0, prev.fatigue + fatigueDelta) } : prev
          );
        }
      }
      setCurrentOutcome(null);
      toast({
        title: "Choice Made",
        description: data.resolution?.narrativeResult || "Your decision echoes through the wilds.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Choice Failed", description: error.message, variant: "destructive" });
    },
  });

  const endMutation = useMutation({
    mutationFn: async (data: { runId: number }) => {
      const res = await apiRequest("POST", "/api/wander/end", data);
      return res.json();
    },
    onSuccess: (data: { summary: WanderSummary; run: WanderRun }) => {
      setWanderSummary(data.summary);
      setShowSummary(true);
      setActiveRun(null);
      setCurrentOutcome(null);
      queryClient.invalidateQueries({ queryKey: ["/api/wander/active", campaignId] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to End Run", description: error.message, variant: "destructive" });
    },
  });

  const handleStartWander = () => {
    if (!campaignId || !selectedCharacterId) return;
    startMutation.mutate({
      campaignId,
      characterId: parseInt(selectedCharacterId),
      startHexQ: 0,
      startHexR: 0,
    });
  };

  const handleMove = useCallback(
    (q: number, r: number) => {
      if (!activeRun || isMoving) return;
      setIsMoving(true);
      const terrain = getTerrainForHex(q, r);
      const terrainToBiome: Record<TerrainType, string> = {
        plains: 'grass', forest: 'forest', mountain: 'mountain',
        swamp: 'swamp', desert: 'desert', ocean: 'coast',
      };
      moveMutation.mutate({
        runId: activeRun.id,
        toHexQ: q,
        toHexR: r,
        terrainType: terrainToBiome[terrain],
      });
    },
    [activeRun, isMoving, moveMutation]
  );

  const handleChoice = (choiceId: string) => {
    if (!activeRun || !currentOutcome) return;
    chooseMutation.mutate({
      runId: activeRun.id,
      choiceId,
      outcomeData: currentOutcome,
    });
  };

  const handleEndWander = () => {
    if (!activeRun) return;
    endMutation.mutate({ runId: activeRun.id });
  };

  const gridHexes = useMemo(() => {
    if (!activeRun) return [];
    const centerQ = activeRun.currentHexQ;
    const centerR = activeRun.currentHexR;
    const radius = 7;
    const hexes: Array<{ q: number; r: number; explored: boolean; isCurrent: boolean; isAdjacent: boolean; terrain: TerrainType; marker?: WanderMarker }> = [];

    for (let dq = -radius; dq <= radius; dq++) {
      for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
        const q = centerQ + dq;
        const r = centerR + dr;
        const key = `${q},${r}`;
        const explored = exploredHexes.has(key);
        const isCurrent = q === centerQ && r === centerR;
        const isAdjacent = hexDistance(q, r, centerQ, centerR) === 1;
        const marker = markers.find((m) => m.hexQ === q && m.hexR === r);
        const terrain = getTerrainForHex(q, r);
        hexes.push({ q, r, explored, isCurrent, isAdjacent, terrain, marker });
      }
    }
    return hexes;
  }, [activeRun, exploredHexes, markers]);

  const hexSize = 28;

  const svgBounds = useMemo(() => {
    if (gridHexes.length === 0) return { minX: -200, maxX: 200, minY: -200, maxY: 200 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const hex of gridHexes) {
      const { x, y } = axialToPixel(hex.q, hex.r, hexSize);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const pad = hexSize * 2;
    return { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad };
  }, [gridHexes, hexSize]);

  const adjacentSet = useMemo(() => {
    if (!activeRun) return new Set<string>();
    const s = new Set<string>();
    for (const dir of HEX_DIRECTIONS) {
      s.add(`${activeRun.currentHexQ + dir.dq},${activeRun.currentHexR + dir.dr}`);
    }
    return s;
  }, [activeRun]);

  const selectedCampaign = campaigns?.find((c: any) => c.id === campaignId);
  const selectedCharacter = characters?.find((c: any) => c.id === parseInt(selectedCharacterId));

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-6">
        <motion.section
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-900/20 to-orange-900/20 border border-amber-500/20 p-6 md:p-10 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-500/5 rounded-full blur-3xl -ml-12 -mb-12" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-400 px-4 py-2 rounded-full text-sm font-medium mb-3">
              <Compass className="h-4 w-4" />
              Free Exploration
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
              Wander the Wilds
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl">
              Explore uncharted territory hex by hex. Discover landmarks, face dangers, and chart the unknown.
            </p>
          </div>
        </motion.section>

        {!activeRun && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <Card className="border-amber-500/20 bg-card/50 backdrop-blur mb-6">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-amber-400" />
                  Prepare Your Journey
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Campaign</label>
                    <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                      <SelectTrigger>
                        <SelectValue placeholder={campaignsLoading ? "Loading..." : "Select a campaign"} />
                      </SelectTrigger>
                      <SelectContent>
                        {campaigns?.map((c: any) => (
                          <SelectItem key={c.id} value={c.id.toString()}>
                            {c.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Character</label>
                    <Select value={selectedCharacterId} onValueChange={setSelectedCharacterId}>
                      <SelectTrigger>
                        <SelectValue placeholder={charactersLoading ? "Loading..." : "Select a character"} />
                      </SelectTrigger>
                      <SelectContent>
                        {characters?.map((c: any) => (
                          <SelectItem key={c.id} value={c.id.toString()}>
                            {c.name} — Lv. {c.level || 1} {c.class || ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedCampaignId && selectedCharacterId && (
                  <Button
                    size="lg"
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-orange-500/25 text-white"
                    onClick={handleStartWander}
                    disabled={startMutation.isPending}
                  >
                    {startMutation.isPending ? (
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    ) : (
                      <Footprints className="h-5 w-5 mr-2" />
                    )}
                    Begin Wandering
                  </Button>
                )}

                {existingRun && existingRun.status === "active" && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full mt-3 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                    onClick={() => {
                      setActiveRun(existingRun);
                      if (fetchedHexes) {
                        const hexSet = new Set<string>();
                        fetchedHexes.forEach((h: any) => hexSet.add(`${h.hexQ},${h.hexR}`));
                        if (hexSet.size > 0) setExploredHexes(hexSet);
                      }
                      if (fetchedMarkers) setMarkers(fetchedMarkers);
                    }}
                  >
                    <ArrowLeft className="h-5 w-5 mr-2" />
                    Resume Active Journey
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeRun && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {selectedCampaign && (
                  <Badge variant="outline" className="text-xs bg-primary/10 border-primary/30">
                    {selectedCampaign.title}
                  </Badge>
                )}
                {selectedCharacter && (
                  <Badge variant="outline" className="text-xs bg-amber-500/10 border-amber-500/30">
                    {selectedCharacter.name}
                  </Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-red-500/40 text-red-400 hover:bg-red-500/10"
                onClick={handleEndWander}
                disabled={endMutation.isPending}
              >
                {endMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ArrowLeft className="h-4 w-4 mr-1" />}
                Head Back
              </Button>
            </div>

            <Card className="mb-4 border-slate-700/50 bg-slate-900/50">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-300">
                      Tick <span className="font-bold text-white">{activeRun.tick}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-red-400" />
                    <span className="text-sm text-slate-300">
                      Fatigue <span className="font-bold text-white">{activeRun.fatigue}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                    <Shield className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-300 mr-2">Danger</span>
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden max-w-[120px]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${getDangerColor(currentDangerRating)}`}
                        style={{ width: `${Math.min(100, currentDangerRating)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400">{getDangerLabel(currentDangerRating)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-amber-400" />
                    <span className="text-sm text-slate-300">
                      ({activeRun.currentHexQ}, {activeRun.currentHexR})
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3">
                <Card className="bg-slate-900/80 border-slate-700 overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
                      <Compass className="h-4 w-4" />
                      Exploration Map
                      <Badge variant="outline" className="ml-auto text-xs bg-amber-500/20 border-amber-500/50">
                        <Footprints className="h-3 w-3 mr-1" />
                        {exploredHexes.size} explored
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 px-2 pb-2">
                      {TERRAIN_TYPES.map(t => (
                        <div key={t} className="flex items-center gap-1 text-[10px] text-slate-400">
                          <span className="inline-block w-3 h-3 rounded-sm border border-slate-600" style={{ background: TERRAIN_COLORS[t].exploredFill }} />
                          <span>{TERRAIN_COLORS[t].icon}</span>
                          <span>{TERRAIN_COLORS[t].label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="relative h-[400px] md:h-[500px] bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
                      <svg
                        viewBox={`${svgBounds.minX} ${svgBounds.minY} ${svgBounds.maxX - svgBounds.minX} ${svgBounds.maxY - svgBounds.minY}`}
                        className="w-full h-full"
                        preserveAspectRatio="xMidYMid meet"
                      >
                        {gridHexes.map((hex) => {
                          const { x, y } = axialToPixel(hex.q, hex.r, hexSize);
                          const pts = hexPoints(x, y, hexSize);
                          const dist = activeRun ? hexDistance(hex.q, hex.r, activeRun.currentHexQ, activeRun.currentHexR) : 999;
                          const tc = TERRAIN_COLORS[hex.terrain];

                          let fill = "#0a0e1a";
                          let stroke = "#1a1f2e";
                          let strokeWidth = 0.5;
                          let opacity = 0.3;
                          let cursor = "default";

                          if (hex.isCurrent) {
                            fill = tc.exploredFill;
                            stroke = "#fbbf24";
                            strokeWidth = 2.5;
                            opacity = 1;
                          } else if (hex.explored) {
                            fill = tc.exploredFill;
                            stroke = tc.stroke;
                            strokeWidth = 1;
                            opacity = 0.85;
                          } else if (hex.isAdjacent) {
                            fill = tc.fill;
                            stroke = tc.stroke;
                            strokeWidth = 1;
                            opacity = 0.7;
                            cursor = "pointer";
                          } else if (dist <= 3) {
                            fill = tc.fill;
                            stroke = tc.stroke;
                            strokeWidth = 0.5;
                            opacity = 0.35;
                          }

                          return (
                            <g key={`${hex.q},${hex.r}`}>
                              <polygon
                                points={pts}
                                fill={fill}
                                stroke={stroke}
                                strokeWidth={strokeWidth}
                                opacity={opacity}
                                style={{ cursor, transition: "all 0.2s ease" }}
                                onClick={() => {
                                  if (hex.isAdjacent && !hex.isCurrent && !isMoving && !currentOutcome) {
                                    handleMove(hex.q, hex.r);
                                  }
                                }}
                              />
                              {hex.explored && !hex.isCurrent && !hex.marker && (
                                <text
                                  x={x}
                                  y={y}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  style={{ fontSize: "9px", pointerEvents: "none", opacity: 0.5 }}
                                >
                                  {tc.icon}
                                </text>
                              )}
                              {hex.isCurrent && (
                                <>
                                  <circle cx={x} cy={y} r={hexSize * 0.3} fill="white" opacity={0.9}>
                                    <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
                                  </circle>
                                  <circle cx={x} cy={y} r={hexSize * 0.45} fill="none" stroke="#fcd34d" strokeWidth={1.5} opacity={0.6}>
                                    <animate
                                      attributeName="r"
                                      values={`${hexSize * 0.35};${hexSize * 0.5};${hexSize * 0.35}`}
                                      dur="2s"
                                      repeatCount="indefinite"
                                    />
                                    <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite" />
                                  </circle>
                                </>
                              )}
                              {hex.marker && !hex.isCurrent && (
                                <text
                                  x={x}
                                  y={y}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  style={{ fontSize: "12px", pointerEvents: "none" }}
                                >
                                  {MARKER_ICONS[hex.marker.markerType] || "📍"}
                                </text>
                              )}
                              {hex.isAdjacent && !hex.explored && !hex.isCurrent && (
                                <text
                                  x={x}
                                  y={y + 1}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  fill="#fbbf24"
                                  opacity={0.5}
                                  style={{ fontSize: "8px", pointerEvents: "none" }}
                                >
                                  {tc.icon}
                                </text>
                              )}
                            </g>
                          );
                        })}
                      </svg>

                      {isMoving && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <div className="flex items-center gap-2 bg-slate-900/90 px-4 py-2 rounded-full border border-amber-500/30">
                            <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                            <span className="text-sm text-amber-200">Traveling...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2">
                <AnimatePresence mode="wait">
                  {currentOutcome ? (
                    <motion.div key="outcome" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <OutcomeCard
                        outcome={currentOutcome}
                        onChoice={handleChoice}
                        onHeadBack={handleEndWander}
                        isPending={chooseMutation.isPending}
                        isEndPending={endMutation.isPending}
                      />
                    </motion.div>
                  ) : (
                    <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Card className="border-slate-700/50 bg-slate-900/50">
                        <CardContent className="py-12 text-center">
                          <Compass className="h-12 w-12 text-amber-400/40 mx-auto mb-4" />
                          <h3 className="text-lg font-semibold text-slate-300 mb-2">Ready to Explore</h3>
                          <p className="text-sm text-slate-500 max-w-xs mx-auto">
                            Click an adjacent hex on the map to move. Each step reveals new encounters and discoveries.
                          </p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mt-4">
                  <Button
                    variant="ghost"
                    className="w-full flex items-center justify-between text-sm text-slate-400 hover:text-slate-200"
                    onClick={() => setJournalOpen(!journalOpen)}
                  >
                    <span className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Journal ({journalEntries.length} entries)
                    </span>
                    {journalOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>

                  <AnimatePresence>
                    {journalOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <Card className="border-slate-700/50 bg-slate-900/50 mt-2 max-h-[300px] overflow-y-auto">
                          <CardContent className="py-3 px-3">
                            {journalEntries.length === 0 ? (
                              <p className="text-sm text-slate-500 text-center py-4">No entries yet. Start exploring!</p>
                            ) : (
                              <div className="space-y-2">
                                {[...journalEntries].reverse().map((entry, i) => {
                                  const style = OUTCOME_STYLES[entry.outcomeType] || OUTCOME_STYLES.none;
                                  const Icon = style.icon;
                                  return (
                                    <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-slate-800/50">
                                      <div className="flex-shrink-0 mt-0.5">
                                        <Icon className={`h-4 w-4 ${style.iconColor}`} />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                          <span className="text-xs text-slate-500">#{entry.tick}</span>
                                          <span className="text-xs text-slate-600">
                                            ({entry.hexQ}, {entry.hexR})
                                          </span>
                                        </div>
                                        <p className="text-sm text-slate-200 truncate">{entry.title}</p>
                                        {entry.rewards && entry.rewards.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {entry.rewards.map((r, ri) => (
                                              <Badge key={ri} variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/30 text-amber-300">
                                                {r.name} x{r.quantity}
                                              </Badge>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <Dialog open={showSummary} onOpenChange={setShowSummary}>
        <DialogContent className="sm:max-w-lg bg-slate-900 border-amber-500/30">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              Journey Complete
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {wanderSummary && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <SummaryStat icon={Footprints} label="Total Moves" value={wanderSummary.totalMoves} />
                  <SummaryStat icon={Sparkles} label="Discoveries" value={wanderSummary.discoveries} />
                  <SummaryStat icon={Sword} label="Combat Encounters" value={wanderSummary.combatEncounters} />
                  <SummaryStat icon={MapPin} label="Markers Placed" value={wanderSummary.markersPlaced} />
                </div>
                {wanderSummary.rewards && wanderSummary.rewards.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-amber-400" />
                      Rewards Earned
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {wanderSummary.rewards.map((r, i) => (
                        <Badge key={i} className="bg-amber-500/20 border-amber-500/40 text-amber-200">
                          {r.name} x{r.quantity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            <Button
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
              onClick={() => {
                setShowSummary(false);
                setActiveRun(null);
                setWanderSummary(null);
                setJournalEntries([]);
                setExploredHexes(new Set(["0,0"]));
                setMarkers([]);
              }}
            >
              <Compass className="h-4 w-4 mr-2" />
              Return to Map
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OutcomeCard({
  outcome,
  onChoice,
  onHeadBack,
  isPending,
  isEndPending,
}: {
  outcome: CuratedOutcome;
  onChoice: (choiceId: string) => void;
  onHeadBack: () => void;
  isPending: boolean;
  isEndPending: boolean;
}) {
  const style = OUTCOME_STYLES[outcome.type] || OUTCOME_STYLES.none;
  const Icon = style.icon;

  return (
    <Card className={`${style.border} ${style.bg} border-2 overflow-hidden`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-5 w-5 ${style.iconColor}`} />
          <Badge
            variant="outline"
            className={`text-[10px] uppercase tracking-wider ${
              outcome.type === "discovery"
                ? "border-amber-500/50 text-amber-300"
                : outcome.type === "risk"
                  ? "border-red-500/50 text-red-300"
                  : outcome.type === "quiet"
                    ? "border-blue-500/50 text-blue-300"
                    : "border-slate-500/50 text-slate-300"
            }`}
          >
            {outcome.type}
          </Badge>
        </div>
        <CardTitle className="text-xl text-white">{outcome.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-300 leading-relaxed">{outcome.reveal}</p>

        {outcome.detail && <p className="text-xs text-slate-400 leading-relaxed italic">{outcome.detail}</p>}

        {outcome.rewards && outcome.rewards.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {outcome.rewards.map((r, i) => (
              <Badge key={i} className="bg-amber-500/20 border-amber-500/40 text-amber-200 text-xs">
                <Star className="h-3 w-3 mr-1" />
                {r.name} x{r.quantity}
              </Badge>
            ))}
          </div>
        )}

        {outcome.combatSeed && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-900/30 border border-red-500/30">
            <Flame className="h-4 w-4 text-red-400" />
            <span className="text-xs text-red-300">Combat may be triggered</span>
          </div>
        )}

        <div className="space-y-2 pt-2">
          {outcome.choices.map((choice) => (
            <Button
              key={choice.id}
              variant="outline"
              className={`w-full justify-start text-left h-auto py-2.5 px-3 ${
                choice.intentTag === "engage"
                  ? "border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
                  : choice.intentTag === "retreat"
                    ? "border-red-500/40 text-red-200 hover:bg-red-500/10"
                    : choice.intentTag === "investigate"
                      ? "border-blue-500/40 text-blue-200 hover:bg-blue-500/10"
                      : choice.intentTag === "camp"
                        ? "border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
                        : "border-slate-600/40 text-slate-200 hover:bg-slate-600/10"
              }`}
              onClick={() => onChoice(choice.id)}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {choice.label}
            </Button>
          ))}

          <Button
            variant="ghost"
            className="w-full text-slate-500 hover:text-red-400 hover:bg-red-500/10 mt-1"
            onClick={onHeadBack}
            disabled={isEndPending}
          >
            {isEndPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowLeft className="h-4 w-4 mr-2" />}
            Head Back
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryStat({ icon: Icon, label, value }: { icon: typeof Footprints; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
      <Icon className="h-5 w-5 text-amber-400" />
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-lg font-bold text-white">{value}</p>
      </div>
    </div>
  );
}
