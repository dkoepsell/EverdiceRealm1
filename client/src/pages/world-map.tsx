import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  Map, MapPin, Mountain, Trees, Waves, Skull, Flame, Building2, 
  Castle, Landmark, Compass, ChevronLeft, User, Crown,
  CircleDot, Eye, CheckCircle2, Lock, Swords, Users,
  Scroll, AlertTriangle, Shield, Sparkles, Globe, Clock, 
  TrendingUp, TrendingDown, Activity, Zap, BookOpen, Hexagon,
  Navigation, X, Footprints, Loader2, Package
} from "lucide-react";
import { useState, useCallback, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import type { WorldRegion, WorldLocation, UserWorldProgress, WorldEvent, WorldDiscovery, Campaign } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import parchmentFrame from "@assets/image_1768600727955.png";
import worldMapBackground from "@assets/image_1768601537026.png";
import WorldHexMap from "@/components/world/WorldHexMap";
import type { PartyPosition } from "@/components/world/WorldHexMap";
import CityMap from "@/components/world/CityMap";
import type { WorldHex } from "@/lib/worldHexGenerator";

const terrainIcons: Record<string, typeof Mountain> = {
  mountain: Mountain,
  forest: Trees,
  ocean: Waves,
  swamp: Skull,
  desert: Flame,
  plains: Landmark
};

const dangerColors: Record<number, string> = {
  1: "bg-green-500",
  2: "bg-lime-500",
  3: "bg-yellow-500",
  4: "bg-orange-500",
  5: "bg-red-500"
};

const locationIcons: Record<string, typeof Castle> = {
  city: Building2,
  capital: Crown,
  village: Building2,
  dungeon: Skull,
  ruins: Castle,
  shrine: CircleDot,
  tower: Landmark,
  landmark: MapPin,
  cave: Mountain
};

const eventTypeIcons: Record<string, typeof Swords> = {
  conflict: Swords,
  supernatural: Skull,
  diplomatic: Shield,
  discovery: Sparkles,
  heroic_feat: Zap,
  campaign_completion: Crown,
  stake_threshold: AlertTriangle,
  narrative: BookOpen,
};

const eventTypeColors: Record<string, string> = {
  conflict: "text-red-400 bg-red-500/10 border-red-500/30",
  supernatural: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  diplomatic: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  discovery: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  heroic_feat: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  campaign_completion: "text-green-400 bg-green-500/10 border-green-500/30",
  stake_threshold: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  narrative: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
};

const severityColors: Record<string, string> = {
  minor: "bg-green-500/20 text-green-300 border-green-500/30",
  moderate: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  major: "bg-red-500/20 text-red-300 border-red-500/30",
};

interface DiscoverySummary {
  regionDiscoveries: Array<{
    regionId: number | null;
    count: number;
    types: string[];
    latestDiscovery: string;
  }>;
  regions: Array<{
    id: number;
    name: string;
    instability: number | null;
    danger: number | null;
    opportunity: number | null;
    mystery: number | null;
    currentMood: string | null;
  }>;
  totalExploredHexes: number;
}

function PressureBar({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof Activity; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-3 w-3 ${color} flex-shrink-0`} />
      <span className="text-xs text-amber-100/60 w-16">{label}</span>
      <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${color.replace('text-', 'bg-')}`}
          style={{ width: `${Math.min(value || 0, 100)}%` }}
        />
      </div>
      <span className="text-xs text-amber-100/50 w-6 text-right">{value || 0}</span>
    </div>
  );
}

function WorldEventCard({ event }: { event: WorldEvent }) {
  const Icon = eventTypeIcons[event.eventType] || Globe;
  const colorClass = eventTypeColors[event.eventType] || "text-gray-400 bg-gray-500/10 border-gray-500/30";
  const severityClass = severityColors[event.severity] || severityColors.minor;
  const effects = event.pressureEffects as Record<string, number> | null;

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className={`p-3 rounded-lg border ${colorClass} transition-all hover:brightness-110`}>
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold truncate">{event.title}</h4>
            <Badge className={`text-[10px] px-1.5 py-0 ${severityClass}`}>
              {event.severity}
            </Badge>
          </div>
          <p className="text-xs opacity-70 line-clamp-2">{event.description}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] opacity-50 flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {timeAgo(event.createdAt)}
            </span>
            {event.sourceCharacterName && (
              <span className="text-[10px] opacity-50 flex items-center gap-1">
                <User className="h-2.5 w-2.5" />
                {event.sourceCharacterName}
              </span>
            )}
          </div>
          {effects && Object.keys(effects).length > 0 && (
            <div className="flex items-center gap-2 mt-1.5">
              {Object.entries(effects).map(([key, val]) => (
                <span key={key} className={`text-[10px] flex items-center gap-0.5 ${(val as number) > 0 ? 'text-red-300' : 'text-green-300'}`}>
                  {(val as number) > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                  {key} {(val as number) > 0 ? '+' : ''}{val as number}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorldMapPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedRegion, setSelectedRegion] = useState<WorldRegion | null>(null);
  const [sidePanel, setSidePanel] = useState<'regions' | 'events' | 'discoveries'>('regions');
  const [mapView, setMapView] = useState<'illustrated' | 'hex'>('illustrated');
  const [cityMapOpen, setCityMapOpen] = useState<{ locationId: number; locationName: string } | null>(null);
  const [activeEncounter, setActiveEncounter] = useState<{
    id: string;
    type: string;
    description: string;
    hook: string;
    sceneType: string;
    narrativeCategory: string;
    step: number;
    hexQ: number;
    hexR: number;
    destinationName: string;
  } | null>(null);

  const { data: userCampaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    enabled: !!user,
  });

  const activeCampaignId = useMemo(() => {
    if (!userCampaigns.length) return null;
    const active = userCampaigns.find((c: any) => c.status === 'active' || c.isActive);
    return active?.id || userCampaigns[0]?.id || null;
  }, [userCampaigns]);

  const { data: activeTrek } = useQuery<{
    id: number;
    path: Array<{ q: number; r: number }>;
    currentStep: number;
    destinationName: string | null;
    status: string;
    pendingEncounter: {
      id: string;
      type: string;
      description: string;
      hook: string;
      sceneType: string;
      narrativeCategory: string;
      step: number;
      hexQ: number;
      hexR: number;
      destinationName: string;
    } | null;
  } | null>({
    queryKey: [`/api/campaigns/${activeCampaignId}/trek/active`],
    enabled: !!activeCampaignId,
  });

  useEffect(() => {
    if (activeTrek?.status === 'encounter' && activeTrek.pendingEncounter && !activeEncounter) {
      setActiveEncounter(activeTrek.pendingEncounter);
    }
  }, [activeTrek?.status, activeTrek?.pendingEncounter]);

  const trekStartMutation = useMutation({
    mutationFn: (data: { destinationQ: number; destinationR: number; destinationName?: string }) => {
      if (!activeCampaignId) return Promise.reject(new Error("No active campaign"));
      return apiRequest("POST", `/api/campaigns/${activeCampaignId}/trek/start`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${activeCampaignId}/trek/active`] });
      toast({ title: "Trek Started", description: "Your journey has begun! Take steps to travel across the map." });
    },
    onError: () => {
      toast({ title: "Trek Failed", description: "Could not start the trek. Make sure you have an active campaign.", variant: "destructive" });
    },
  });

  const trekStepMutation = useMutation({
    mutationFn: () => {
      if (!activeCampaignId) return Promise.reject(new Error("No active campaign"));
      return apiRequest("POST", `/api/campaigns/${activeCampaignId}/trek/step`);
    },
    onSuccess: async (res) => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${activeCampaignId}/trek/active`] });
      const data = await res.json();
      if (data.encounter) {
        setActiveEncounter(data.encounter);
      }
      if (data.completed) {
        const lootSummary = data.lootFound?.length 
          ? ` Found ${data.lootFound.length} item(s) along the way!` 
          : '';
        toast({ 
          title: "Trek Complete — Returned to Origin", 
          description: `Your party has returned safely to where you started.${lootSummary}` 
        });
      }
      if (data.encounter?.type === "loot_find" && data.encounter?.loot) {
        const loot = data.encounter.loot;
        toast({
          title: `Loot Found: ${loot.item.name}`,
          description: `${loot.item.rarity} ${loot.item.type} (${loot.item.value}gp) + ${loot.goldDrop} gold`,
        });
      }
    },
    onError: (error: any) => {
      const msg = error?.message || "Failed to take step";
      if (msg.includes("encounter")) {
        toast({ title: "Encounter Active", description: msg, variant: "destructive" });
      }
    },
  });

  const enterNarrativeMutation = useMutation({
    mutationFn: (encounter: typeof activeEncounter) => {
      if (!activeCampaignId || !encounter) return Promise.reject(new Error("Missing data"));
      return apiRequest("POST", `/api/campaigns/${activeCampaignId}/trek/enter-narrative`, { encounter });
    },
    onSuccess: async (res) => {
      const data = await res.json();
      setActiveEncounter(null);
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${activeCampaignId}/trek/active`] });
      if (activeCampaignId) {
        localStorage.setItem('activeCampaignId', activeCampaignId.toString());
        queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${activeCampaignId}/sessions`] });
      }
      navigate("/play");
    },
    onError: () => {
      toast({ title: "Narrative Generation Failed", description: "Could not generate the encounter narrative. Try again.", variant: "destructive" });
    },
  });

  const dismissEncounterMutation = useMutation({
    mutationFn: () => {
      if (!activeCampaignId) return Promise.reject(new Error("No active campaign"));
      return apiRequest("POST", `/api/campaigns/${activeCampaignId}/trek/dismiss-encounter`);
    },
    onSuccess: () => {
      setActiveEncounter(null);
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${activeCampaignId}/trek/active`] });
      toast({ title: "Encounter Passed", description: "You continue on your journey." });
    },
  });

  const trekCancelMutation = useMutation({
    mutationFn: () => {
      if (!activeCampaignId) return Promise.reject(new Error("No active campaign"));
      return apiRequest("POST", `/api/campaigns/${activeCampaignId}/trek/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${activeCampaignId}/trek/active`] });
      toast({ title: "Trek Cancelled", description: "You have abandoned your journey." });
    },
  });

  const { data: partyPositions = [] } = useQuery<PartyPosition[]>({
    queryKey: ["/api/world/party-positions"],
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: regions = [], isLoading: regionsLoading } = useQuery<WorldRegion[]>({
    queryKey: ["/api/world/regions"],
  });

  const { data: locations = [] } = useQuery<WorldLocation[]>({
    queryKey: ["/api/world/locations"],
  });

  const { data: myProgress = [] } = useQuery<UserWorldProgress[]>({
    queryKey: ["/api/world/progress"],
    enabled: !!user,
  });

  const { data: worldEventsList = [] } = useQuery<WorldEvent[]>({
    queryKey: ["/api/world/events"],
    refetchInterval: 60000,
  });

  const { data: discoveries = [] } = useQuery<WorldDiscovery[]>({
    queryKey: ["/api/world/discoveries"],
    refetchInterval: 60000,
  });

  const { data: discoverySummary } = useQuery<DiscoverySummary>({
    queryKey: ["/api/world/discoveries/summary"],
    refetchInterval: 60000,
  });

  const { data: regionEvents = [] } = useQuery<WorldEvent[]>({
    queryKey: ["/api/world/events", selectedRegion?.id],
    enabled: !!selectedRegion,
  });

  interface WorldActivity {
    regionActivity: Record<number, { campaigns: any[], adventurerCount: number }>;
    locationActivity: Record<number, { campaigns: any[], adventurerCount: number }>;
  }
  const { data: worldActivity } = useQuery<WorldActivity>({
    queryKey: ["/api/world/activity"],
  });

  const generateEventsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/world/events/generate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/world/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/world/discoveries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/world/discoveries/summary"] });
    },
  });

  const getRegionActivity = (regionId: number) => {
    return worldActivity?.regionActivity?.[regionId] || { campaigns: [], adventurerCount: 0 };
  };

  const getRegionProgress = (regionId: number): UserWorldProgress | undefined => {
    return myProgress.find(p => p.regionId === regionId);
  };

  const getLocationProgress = (locationId: number): UserWorldProgress | undefined => {
    return myProgress.find(p => p.locationId === locationId);
  };

  const getProgressState = (progress?: UserWorldProgress): 'undiscovered' | 'discovered' | 'in_progress' | 'completed' => {
    if (!progress) return 'undiscovered';
    return (progress.completionState as 'undiscovered' | 'discovered' | 'in_progress' | 'completed') || 'undiscovered';
  };

  const getProgressIcon = (state: string) => {
    switch (state) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case 'in_progress': return <Eye className="h-4 w-4 text-yellow-400" />;
      case 'discovered': return <Eye className="h-4 w-4 text-blue-400" />;
      default: return <Lock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getRegionDiscoveryCount = (regionId: number) => {
    return discoverySummary?.regionDiscoveries?.find(d => d.regionId === regionId)?.count || 0;
  };

  const getRegionPressure = (regionId: number) => {
    return discoverySummary?.regions?.find(r => r.id === regionId);
  };

  const getRegionEventCount = (regionId: number) => {
    return worldEventsList.filter(e => e.affectedRegionIds?.includes(regionId)).length;
  };

  const regionLocations = selectedRegion 
    ? locations.filter(l => l.regionId === selectedRegion.id)
    : [];

  const regionDiscoveries = selectedRegion
    ? discoveries.filter(d => d.regionId === selectedRegion.id)
    : [];

  if (regionsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Map className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">The Realm of Everdice</h1>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-cyan-900/40 via-blue-900/30 to-slate-900/40 border border-cyan-500/20 p-8 mb-8">
          <div 
            className="absolute inset-0 opacity-25 rounded-xl"
            style={{
              backgroundImage: `url(${parchmentFrame})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              mixBlendMode: 'overlay'
            }}
          />
          <div className="absolute top-4 right-8 opacity-10">
            <Globe className="h-20 w-20 text-cyan-300" />
          </div>
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm">
                    <Compass className="h-3 w-3" />
                    <span>A Living, Shared World</span>
                  </div>
                  {worldEventsList.length > 0 && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm animate-pulse">
                      <Activity className="h-3 w-3" />
                      <span>{worldEventsList.length} Active Events</span>
                    </div>
                  )}
                </div>
                <h1 className="text-2xl md:text-3xl font-fantasy font-bold text-white mb-2">The Realm of Everdice</h1>
                <p className="text-white/60">Every campaign shapes this world. Your choices ripple across the realm.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1 bg-white/10 border-white/20 text-white">
                  <User className="h-3 w-3" />
                  {user?.username || "Guest"}
                </Badge>
                <Badge variant="secondary" className="gap-1 bg-cyan-500/20 text-cyan-300 border-cyan-500/30">
                  <CheckCircle2 className="h-3 w-3" />
                  {myProgress.filter(p => p.completionState === 'completed').length} / {regions.length + locations.length} Explored
                </Badge>
                <Badge variant="secondary" className="gap-1 bg-amber-500/20 text-amber-300 border-amber-500/30">
                  <Sparkles className="h-3 w-3" />
                  {discoverySummary?.totalExploredHexes || 0} Hexes Charted
                </Badge>
                <div className="flex gap-1 p-0.5 bg-black/30 rounded-lg border border-white/10">
                  <button
                    onClick={() => setMapView('illustrated')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-all ${
                      mapView === 'illustrated'
                        ? 'bg-amber-500/30 text-amber-100 border border-amber-400/50'
                        : 'text-white/50 hover:text-white/80 border border-transparent'
                    }`}
                  >
                    <Map className="h-3 w-3" />
                    <span className="hidden sm:inline">Illustrated</span>
                  </button>
                  <button
                    onClick={() => setMapView('hex')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-all ${
                      mapView === 'hex'
                        ? 'bg-amber-500/30 text-amber-100 border border-amber-400/50'
                        : 'text-white/50 hover:text-white/80 border border-transparent'
                    }`}
                  >
                    <Hexagon className="h-3 w-3" />
                    <span className="hidden sm:inline">Hex Map</span>
                  </button>
                </div>
                {user && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="gap-1 bg-white/5 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20"
                    onClick={() => generateEventsMutation.mutate()}
                    disabled={generateEventsMutation.isPending}
                  >
                    <Activity className="h-3 w-3" />
                    {generateEventsMutation.isPending ? "Scanning..." : "Scan World"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="container mx-auto px-4 pb-6">
        <div className="flex gap-4">
          <div className="flex-1 space-y-4">
            {mapView === 'hex' ? (
              <div className="space-y-2">
                <WorldHexMap
                  campaignId={activeCampaignId || undefined}
                  onEnterLocation={(hex: WorldHex) => {
                    if (hex.locationId && hex.locationName && activeCampaignId) {
                      setCityMapOpen({ locationId: hex.locationId, locationName: hex.locationName });
                    } else if (!activeCampaignId) {
                      toast({ title: "No Campaign", description: "Create or join a campaign to enter locations.", variant: "destructive" });
                    }
                  }}
                  onTrekTo={(hex: WorldHex) => {
                    if (!activeCampaignId) {
                      toast({ title: "No Campaign", description: "Create or join a campaign to trek across the map.", variant: "destructive" });
                      return;
                    }
                    trekStartMutation.mutate({
                      destinationQ: hex.q,
                      destinationR: hex.r,
                      destinationName: hex.locationName || `Hex (${hex.q}, ${hex.r})`,
                    });
                  }}
                  trekPath={activeTrek?.path}
                  trekStep={activeTrek?.currentStep}
                  partyPositions={partyPositions}
                />
                {activeTrek && (activeTrek.status === 'active' || activeTrek.status === 'encounter') && (
                  <div className="flex items-center gap-3 p-3 bg-amber-900/30 rounded-lg border border-amber-500/30">
                    <Footprints className="h-5 w-5 text-amber-400" />
                    <div className="flex-1">
                      <span className="text-sm text-amber-100 font-medium">
                        Trekking to {activeTrek.destinationName || 'destination'}
                      </span>
                      <span className="text-xs text-amber-100/60 ml-2">
                        Step {activeTrek.currentStep} / {activeTrek.path.length}
                      </span>
                    </div>
                    {activeTrek.status === 'encounter' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 bg-red-500/20 border-red-500/40 text-red-200 hover:bg-red-500/30 animate-pulse"
                        onClick={() => {
                          if (activeEncounter) {
                            setActiveEncounter(activeEncounter);
                          } else {
                            toast({ title: "Encounter Active", description: "An encounter is blocking your path. Resolve or dismiss it to continue.", variant: "destructive" });
                          }
                        }}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        Encounter!
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 bg-amber-500/20 border-amber-500/40 text-amber-200 hover:bg-amber-500/30"
                        onClick={() => trekStepMutation.mutate()}
                        disabled={trekStepMutation.isPending}
                      >
                        <Navigation className="h-3 w-3" />
                        {trekStepMutation.isPending ? "Moving..." : "Take Step"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => trekCancelMutation.mutate()}
                      disabled={trekCancelMutation.isPending}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ) : (
            <div 
              className="relative rounded-2xl overflow-hidden border-4 border-amber-800/50 shadow-2xl"
              style={{
                backgroundImage: `url(${worldMapBackground})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                aspectRatio: '3/2'
              }}
            >
              <div className="absolute inset-0 pointer-events-none" style={{
                boxShadow: 'inset 0 0 80px rgba(0,0,0,0.4)'
              }} />

              {regions.map((region) => {
                const activity = getRegionActivity(region.id);
                const discoveryCount = getRegionDiscoveryCount(region.id);
                const eventCount = getRegionEventCount(region.id);
                const pressure = getRegionPressure(region.id);
                const isSelected = selectedRegion?.id === region.id;

                const left = `${((region.gridX || 0) / 10) * 100}%`;
                const top = `${(((region.gridY || 0) / 10) * 100) + 8}%`;

                return (
                  <Tooltip key={region.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setSelectedRegion(isSelected ? null : region)}
                        className={`absolute z-10 transition-all duration-200 group ${isSelected ? 'scale-125' : 'hover:scale-110'}`}
                        style={{ left, top, transform: 'translate(-50%, -50%)' }}
                      >
                        <div className={`relative w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all
                          ${isSelected 
                            ? 'bg-amber-500/60 border-amber-300 shadow-lg shadow-amber-500/30' 
                            : 'bg-black/50 border-amber-500/40 hover:bg-amber-500/30 hover:border-amber-400'
                          }`}
                        >
                          {(() => {
                            const TerrainIcon = terrainIcons[region.terrain || 'plains'] || Landmark;
                            return <TerrainIcon className="h-4 w-4 text-amber-200" />;
                          })()}
                          {activity.adventurerCount > 0 && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse border border-black" />
                          )}
                          {eventCount > 0 && (
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-red-400 rounded-full border border-black text-[8px] flex items-center justify-center text-white font-bold">
                              !
                            </div>
                          )}
                          {discoveryCount > 0 && (
                            <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-amber-400 rounded-full border border-black text-[8px] flex items-center justify-center text-black font-bold">
                              {discoveryCount}
                            </div>
                          )}
                        </div>
                        <span className="absolute top-full mt-1 left-1/2 -translate-x-1/2 text-[10px] text-amber-200/80 whitespace-nowrap font-medium pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                          {region.name}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-gray-950 border-amber-500/50 max-w-64 shadow-xl shadow-black/50">
                      <div className="space-y-1.5">
                        <div className="font-semibold text-amber-100">{region.name}</div>
                        <div className="text-xs text-amber-100/60">{region.description}</div>
                        <div className="flex gap-2 flex-wrap">
                          <Badge className={`text-[10px] ${dangerColors[region.dangerLevel || 1]} text-white`}>
                            Danger {region.dangerLevel}/5
                          </Badge>
                          <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-200">
                            Lvl {region.levelRange}
                          </Badge>
                          {discoveryCount > 0 && (
                            <Badge className="text-[10px] bg-amber-500/20 text-amber-300 border-amber-500/30">
                              {discoveryCount} discoveries
                            </Badge>
                          )}
                        </div>
                        {pressure && (
                          <div className="space-y-1 pt-1">
                            <PressureBar label="Instab." value={pressure.instability || 0} icon={AlertTriangle} color="text-red-400" />
                            <PressureBar label="Danger" value={pressure.danger || 0} icon={Swords} color="text-orange-400" />
                            <PressureBar label="Opport." value={pressure.opportunity || 0} icon={Sparkles} color="text-green-400" />
                            <PressureBar label="Mystery" value={pressure.mystery || 0} icon={Eye} color="text-purple-400" />
                          </div>
                        )}
                        {activity.adventurerCount > 0 && (
                          <div className="text-[10px] text-green-300 flex items-center gap-1">
                            <Users className="h-2.5 w-2.5" />
                            {activity.adventurerCount} adventurers active
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
            )}

            {worldEventsList.length > 0 && (
              <Card className="border-2 border-amber-500/30 bg-black/40 backdrop-blur-sm">
                <CardHeader className="pb-2 border-b border-amber-500/20">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2 text-amber-100">
                      <Scroll className="h-4 w-4 text-amber-400" />
                      World Events Chronicle
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-200">
                      {worldEventsList.length} events
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
                    {worldEventsList.slice(0, 9).map((event) => (
                      <WorldEventCard key={event.id} event={event} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {worldEventsList.length === 0 && (
              <Card className="border-2 border-amber-500/20 bg-black/30 backdrop-blur-sm">
                <CardContent className="py-8 text-center">
                  <Globe className="h-10 w-10 text-amber-400/30 mx-auto mb-3" />
                  <h3 className="text-amber-100/70 font-medium mb-1">The World Awaits</h3>
                  <p className="text-amber-100/40 text-sm max-w-md mx-auto">
                    As adventurers explore, make choices, and shape their campaigns, world events will emerge here — affecting every campaign in the realm.
                  </p>
                  {user && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="mt-4 gap-1 bg-white/5 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                      onClick={() => generateEventsMutation.mutate()}
                      disabled={generateEventsMutation.isPending}
                    >
                      <Activity className="h-3 w-3" />
                      {generateEventsMutation.isPending ? "Scanning..." : "Scan for World Events"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="w-80 space-y-4">
            <div className="flex gap-1 p-1 bg-black/30 rounded-lg border border-amber-500/20">
              {[
                { key: 'regions' as const, icon: Compass, label: 'Regions' },
                { key: 'events' as const, icon: Scroll, label: 'Events' },
                { key: 'discoveries' as const, icon: Sparkles, label: 'Discoveries' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setSidePanel(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-all
                    ${sidePanel === tab.key 
                      ? 'bg-amber-500/30 text-amber-100 border border-amber-400/50' 
                      : 'text-amber-100/50 hover:text-amber-100/80 hover:bg-amber-500/10 border border-transparent'
                    }`}
                >
                  <tab.icon className="h-3 w-3" />
                  {tab.label}
                </button>
              ))}
            </div>

            {sidePanel === 'regions' && (
              <>
                <Card className="border-2 border-amber-500/30 bg-black/40 backdrop-blur-sm">
                  <CardHeader className="pb-2 border-b border-amber-500/20">
                    <CardTitle className="text-sm flex items-center gap-2 text-amber-100">
                      <Compass className="h-4 w-4 text-amber-400" />
                      Regions of the Realm
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3">
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {regions.map((region) => {
                        const progress = getRegionProgress(region.id);
                        const progressState = getProgressState(progress);
                        const isSelected = selectedRegion?.id === region.id;
                        const TerrainIcon = terrainIcons[region.terrain || 'plains'] || Landmark;
                        const discoveryCount = getRegionDiscoveryCount(region.id);
                        const eventCount = getRegionEventCount(region.id);
                        
                        return (
                          <button
                            key={region.id}
                            onClick={() => setSelectedRegion(isSelected ? null : region)}
                            className={`
                              w-full text-left p-2 rounded-lg transition-all flex items-center gap-2
                              ${isSelected 
                                ? 'bg-amber-500/30 border border-amber-400' 
                                : 'hover:bg-amber-900/30 border border-transparent hover:border-amber-500/30'
                              }
                              ${progressState === 'undiscovered' ? 'opacity-60' : ''}
                            `}
                          >
                            <TerrainIcon className="h-4 w-4 text-amber-400 flex-shrink-0" />
                            <span className="flex-1 text-sm font-medium text-amber-100 truncate">
                              {region.name}
                            </span>
                            <div className="flex items-center gap-1">
                              {eventCount > 0 && (
                                <div className="w-4 h-4 bg-red-500/20 rounded-full flex items-center justify-center">
                                  <AlertTriangle className="h-2.5 w-2.5 text-red-400" />
                                </div>
                              )}
                              {discoveryCount > 0 && (
                                <Badge className="text-[10px] bg-amber-500/20 text-amber-300 border-amber-500/30 px-1 py-0">
                                  {discoveryCount}
                                </Badge>
                              )}
                              {getProgressIcon(progressState)}
                              <Badge 
                                className={`text-[10px] ${dangerColors[region.dangerLevel || 1]} text-white px-1.5 py-0`}
                              >
                                {region.dangerLevel}
                              </Badge>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {selectedRegion && (
                  <Card className="border-2 border-amber-500/30 bg-black/40 backdrop-blur-sm">
                    <CardHeader className="pb-3 border-b border-amber-500/20">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg text-amber-100">{selectedRegion.name}</CardTitle>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedRegion(null)}
                          className="text-amber-200 hover:text-amber-100"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="border-amber-500/30 text-amber-200">Lvl {selectedRegion.levelRange}</Badge>
                        <Badge className={`${dangerColors[selectedRegion.dangerLevel || 1]} text-white`}>
                          Danger {selectedRegion.dangerLevel}/5
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      <p className="text-sm text-amber-100/70">{selectedRegion.description}</p>
                      
                      {selectedRegion.lore && (
                        <div className="p-3 bg-amber-900/30 rounded-lg text-sm italic text-amber-100/60">
                          {selectedRegion.lore}
                        </div>
                      )}

                      {(() => {
                        const pressure = getRegionPressure(selectedRegion.id);
                        if (!pressure) return null;
                        return (
                          <div className="p-3 bg-black/30 rounded-lg border border-amber-500/20 space-y-1.5">
                            <h4 className="text-xs font-semibold text-amber-300 mb-2 flex items-center gap-1">
                              <Activity className="h-3 w-3" />
                              Regional Pressure
                            </h4>
                            <PressureBar label="Instab." value={pressure.instability || 0} icon={AlertTriangle} color="text-red-400" />
                            <PressureBar label="Danger" value={pressure.danger || 0} icon={Swords} color="text-orange-400" />
                            <PressureBar label="Opport." value={pressure.opportunity || 0} icon={Sparkles} color="text-green-400" />
                            <PressureBar label="Mystery" value={pressure.mystery || 0} icon={Eye} color="text-purple-400" />
                          </div>
                        );
                      })()}

                      {regionEvents.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-amber-300 flex items-center gap-1">
                            <Scroll className="h-3 w-3" />
                            Recent Events ({regionEvents.length})
                          </h4>
                          {regionEvents.slice(0, 3).map(event => (
                            <WorldEventCard key={event.id} event={event} />
                          ))}
                        </div>
                      )}

                      {regionDiscoveries.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-amber-300 flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            Community Discoveries ({regionDiscoveries.length})
                          </h4>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {regionDiscoveries.map(disc => (
                              <div key={disc.id} className="p-2 bg-amber-900/20 rounded-lg border border-amber-500/20 text-xs">
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="h-3 w-3 text-amber-400 flex-shrink-0" />
                                  <span className="font-medium text-amber-100">{disc.title}</span>
                                </div>
                                {disc.discoveredByCharacterName && (
                                  <span className="text-amber-100/40 text-[10px] ml-4">
                                    Found by {disc.discoveredByCharacterName}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(() => {
                        const activity = getRegionActivity(selectedRegion.id);
                        if (activity.campaigns.length === 0) return null;
                        return (
                          <div className="p-3 bg-amber-900/20 border border-amber-700/30 rounded-lg">
                            <h4 className="font-semibold mb-2 flex items-center gap-2 text-amber-300 text-xs">
                              <Swords className="h-3 w-3" />
                              Active Adventures ({activity.campaigns.length})
                            </h4>
                            <div className="space-y-1.5">
                              {activity.campaigns.slice(0, 5).map((campaign: any) => (
                                <div key={campaign.id} className="flex items-center gap-2 text-xs text-amber-100/80">
                                  <div className={`w-2 h-2 rounded-full ${campaign.isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
                                  <span className="flex-1 truncate">{campaign.title}</span>
                                  <div className="flex items-center gap-1 text-amber-100/60">
                                    <Users className="h-2.5 w-2.5" />
                                    <span className="text-[10px]">{campaign.adventurerCount}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2 text-amber-100 text-xs">
                          <MapPin className="h-3 w-3 text-amber-400" />
                          Locations ({regionLocations.length})
                        </h4>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {regionLocations.map((location) => {
                            const LocationIcon = locationIcons[location.locationType || 'landmark'] || MapPin;
                            const progress = getLocationProgress(location.id);
                            const progressState = getProgressState(progress);
                            
                            return (
                              <div 
                                key={location.id}
                                className={`
                                  p-2 rounded-lg border transition-all
                                  ${progressState === 'undiscovered' ? 'opacity-60 bg-black/30' : 'bg-amber-900/20'}
                                  ${location.isMainQuest ? 'border-amber-500/50' : 'border-amber-500/20'}
                                `}
                              >
                                <div className="flex items-center gap-2">
                                  <LocationIcon className="h-3 w-3 text-amber-400" />
                                  <span className="font-medium text-xs flex-1 text-amber-100">{location.name}</span>
                                  {getProgressIcon(progressState)}
                                  {location.isMainQuest && <Crown className="h-3 w-3 text-amber-400" />}
                                </div>
                                <p className="text-[10px] text-amber-100/60 mt-0.5 ml-5">{location.description}</p>
                              </div>
                            );
                          })}
                          {regionLocations.length === 0 && (
                            <p className="text-xs text-amber-100/50 italic">No known locations yet.</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {sidePanel === 'events' && (
              <Card className="border-2 border-amber-500/30 bg-black/40 backdrop-blur-sm">
                <CardHeader className="pb-2 border-b border-amber-500/20">
                  <CardTitle className="text-sm flex items-center gap-2 text-amber-100">
                    <Scroll className="h-4 w-4 text-amber-400" />
                    All World Events
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3">
                  {worldEventsList.length === 0 ? (
                    <div className="text-center py-6">
                      <Globe className="h-8 w-8 text-amber-400/20 mx-auto mb-2" />
                      <p className="text-xs text-amber-100/40">No world events yet. Play campaigns to generate them!</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                      {worldEventsList.map(event => (
                        <WorldEventCard key={event.id} event={event} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {sidePanel === 'discoveries' && (
              <Card className="border-2 border-amber-500/30 bg-black/40 backdrop-blur-sm">
                <CardHeader className="pb-2 border-b border-amber-500/20">
                  <CardTitle className="text-sm flex items-center gap-2 text-amber-100">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    Community Discoveries
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3">
                  {discoveries.length === 0 ? (
                    <div className="text-center py-6">
                      <MapPin className="h-8 w-8 text-amber-400/20 mx-auto mb-2" />
                      <p className="text-xs text-amber-100/40">No discoveries yet. Explore campaigns to reveal the world!</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                      {discoveries.map(disc => {
                        const region = regions.find(r => r.id === disc.regionId);
                        return (
                          <div key={disc.id} className="p-2.5 bg-amber-900/15 rounded-lg border border-amber-500/20">
                            <div className="flex items-center gap-2 mb-1">
                              <MapPin className="h-3 w-3 text-amber-400 flex-shrink-0" />
                              <span className="text-sm font-medium text-amber-100">{disc.title}</span>
                            </div>
                            {disc.description && (
                              <p className="text-[10px] text-amber-100/50 ml-5 line-clamp-2">{disc.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1.5 ml-5">
                              {region && (
                                <Badge className="text-[10px] bg-cyan-500/10 text-cyan-300 border-cyan-500/20 px-1.5 py-0">
                                  {region.name}
                                </Badge>
                              )}
                              {disc.terrainType && (
                                <Badge variant="outline" className="text-[10px] border-amber-500/20 text-amber-200/60 px-1.5 py-0">
                                  {disc.terrainType}
                                </Badge>
                              )}
                              {disc.discoveredByCharacterName && (
                                <span className="text-[10px] text-amber-100/30 flex items-center gap-0.5">
                                  <User className="h-2 w-2" />
                                  {disc.discoveredByCharacterName}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="border-2 border-amber-500/30 bg-black/40 backdrop-blur-sm">
              <CardHeader className="pb-2 border-b border-amber-500/20">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-100">
                  <User className="h-4 w-4 text-amber-400" />
                  Your Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-amber-100/60">Regions Discovered</span>
                    <span className="font-medium text-amber-100">
                      {myProgress.filter(p => p.regionId && p.hasDiscovered).length} / {regions.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-100/60">Locations Found</span>
                    <span className="font-medium text-amber-100">
                      {myProgress.filter(p => p.locationId && p.hasDiscovered).length} / {locations.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-100/60">Areas Completed</span>
                    <span className="font-medium text-green-400">
                      {myProgress.filter(p => p.completionState === 'completed').length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {partyPositions.length > 0 && (
              <Card className="border-2 border-amber-500/30 bg-black/40 backdrop-blur-sm">
                <CardHeader className="pb-2 border-b border-amber-500/20">
                  <CardTitle className="text-sm flex items-center gap-2 text-amber-100">
                    <Navigation className="h-4 w-4 text-cyan-400" />
                    Your Parties
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3">
                  <div className="space-y-2">
                    {partyPositions.map((party, idx) => {
                      const colors = ["text-cyan-400", "text-violet-400", "text-emerald-400", "text-orange-400", "text-pink-400", "text-yellow-400"];
                      const bgColors = ["bg-cyan-500/15", "bg-violet-500/15", "bg-emerald-500/15", "bg-orange-500/15", "bg-pink-500/15", "bg-yellow-500/15"];
                      const borderColors = ["border-cyan-500/30", "border-violet-500/30", "border-emerald-500/30", "border-orange-500/30", "border-pink-500/30", "border-yellow-500/30"];
                      const color = colors[idx % colors.length];
                      const bg = bgColors[idx % bgColors.length];
                      const border = borderColors[idx % borderColors.length];
                      return (
                        <div key={party.campaignId} className={`flex items-center gap-2 p-2 rounded-lg ${bg} border ${border}`}>
                          <div className={`w-3 h-3 rounded-full ${color.replace('text-', 'bg-')} animate-pulse`} />
                          <div className="flex-1 min-w-0">
                            <span className={`text-xs font-medium ${color} truncate block`}>
                              {party.campaignTitle}
                            </span>
                            <span className="text-[10px] text-amber-100/40">
                              Hex ({party.hexQ}, {party.hexR})
                              {party.isOwner && " · DM"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-amber-100/30 mt-2 italic">
                    Switch to Hex Map view to see party locations
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
    {cityMapOpen && activeCampaignId && (
      <CityMap
        campaignId={activeCampaignId}
        locationId={cityMapOpen.locationId}
        locationName={cityMapOpen.locationName}
        onClose={() => setCityMapOpen(null)}
      />
    )}

    <Dialog open={!!activeEncounter} onOpenChange={(open) => {
      if (!open && !enterNarrativeMutation.isPending) {
        setActiveEncounter(null);
      }
    }}>
      <DialogContent className="max-w-2xl bg-gradient-to-b from-gray-900 via-gray-900 to-black border-2 border-amber-500/40 text-amber-50 max-h-[85vh] overflow-y-auto">
        {activeEncounter && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  activeEncounter.narrativeCategory === 'combat' ? 'bg-red-500/20 border border-red-500/40' :
                  activeEncounter.narrativeCategory === 'quest' ? 'bg-violet-500/20 border border-violet-500/40' :
                  'bg-emerald-500/20 border border-emerald-500/40'
                }`}>
                  {activeEncounter.narrativeCategory === 'combat' ? <Swords className="h-5 w-5 text-red-400" /> :
                   activeEncounter.narrativeCategory === 'quest' ? <Scroll className="h-5 w-5 text-violet-400" /> :
                   <Compass className="h-5 w-5 text-emerald-400" />}
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-amber-100">
                    {activeEncounter.type.charAt(0).toUpperCase() + activeEncounter.type.slice(1)} Encounter
                  </DialogTitle>
                  <DialogDescription className="text-amber-100/50 text-xs">
                    Hex ({activeEncounter.hexQ}, {activeEncounter.hexR}) · Step {activeEncounter.step} · En route to {activeEncounter.destinationName}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <div className="p-4 rounded-lg bg-black/40 border border-amber-500/20">
                <p className="text-sm leading-relaxed text-amber-100/90 italic">
                  "{activeEncounter.description}"
                </p>
              </div>

              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs text-amber-200/80">
                  <Sparkles className="h-3 w-3 inline mr-1 text-amber-400" />
                  {activeEncounter.hook}
                </p>
              </div>

              {activeEncounter.type === 'loot_find' && (activeEncounter as any).loot && (
                <div className="p-3 rounded-lg bg-gradient-to-r from-yellow-900/30 to-amber-900/20 border border-yellow-500/30">
                  <p className="text-xs font-bold text-yellow-300 mb-2 flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" /> Loot Found
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-100">{(activeEncounter as any).loot.item.name}</p>
                      <p className="text-xs text-amber-200/60">
                        {(activeEncounter as any).loot.item.rarity} {(activeEncounter as any).loot.item.type}
                        {(activeEncounter as any).loot.item.specialEffect && ` — ${(activeEncounter as any).loot.item.specialEffect}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-yellow-300 font-bold">+{(activeEncounter as any).loot.goldDrop} gold</p>
                      <p className="text-xs text-amber-200/50">Value: {(activeEncounter as any).loot.item.value}gp</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-amber-100/40">
                <Badge variant="outline" className={`text-[10px] ${
                  activeEncounter.sceneType === 'combat' ? 'border-red-500/40 text-red-300' :
                  activeEncounter.sceneType === 'social' ? 'border-violet-500/40 text-violet-300' :
                  'border-emerald-500/40 text-emerald-300'
                }`}>
                  {activeEncounter.sceneType}
                </Badge>
                <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-300">
                  {activeEncounter.type}
                </Badge>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold gap-2"
                  onClick={() => enterNarrativeMutation.mutate(activeEncounter)}
                  disabled={enterNarrativeMutation.isPending}
                >
                  {enterNarrativeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating Narrative...
                    </>
                  ) : (
                    <>
                      <BookOpen className="h-4 w-4" />
                      Enter Narrative
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="border-amber-500/30 text-amber-200 hover:bg-amber-500/10"
                  onClick={() => dismissEncounterMutation.mutate()}
                  disabled={dismissEncounterMutation.isPending || enterNarrativeMutation.isPending}
                >
                  Pass By
                </Button>
              </div>
            </div>
          </>
        )}

      </DialogContent>
    </Dialog>

    </TooltipProvider>
  );
}
