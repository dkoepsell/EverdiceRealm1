import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Map, MapPin, Mountain, Trees, Waves, Skull, Flame, Building2, 
  Castle, Landmark, Compass, ChevronLeft, ChevronRight, User, Crown,
  CircleDot, Eye, CheckCircle2, Lock, Swords, Users
} from "lucide-react";
import { useState } from "react";
import type { WorldRegion, WorldLocation, UserWorldProgress } from "@shared/schema";
import parchmentFrame from "@assets/image_1768600727955.png";
import worldMapBackground from "@assets/image_1768601537026.png";

const terrainIcons: Record<string, typeof Mountain> = {
  mountain: Mountain,
  forest: Trees,
  ocean: Waves,
  swamp: Skull,
  desert: Flame,
  plains: Landmark
};

const terrainColors: Record<string, string> = {
  mountain: "from-blue-400/20 to-slate-600/30",
  forest: "from-green-500/20 to-green-700/30",
  ocean: "from-cyan-400/20 to-blue-600/30",
  swamp: "from-gray-500/20 to-gray-700/30",
  desert: "from-yellow-400/20 to-orange-500/30",
  plains: "from-green-300/20 to-green-500/30"
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
  village: Building2,
  dungeon: Skull,
  ruins: Castle,
  shrine: CircleDot,
  tower: Landmark,
  landmark: MapPin,
  cave: Mountain
};

export default function WorldMapPage() {
  const { user } = useAuth();
  const [selectedRegion, setSelectedRegion] = useState<WorldRegion | null>(null);
  const [viewingUserId, setViewingUserId] = useState<number | null>(null);

  const { data: regions = [], isLoading: regionsLoading } = useQuery<WorldRegion[]>({
    queryKey: ["/api/world/regions"],
  });

  const { data: locations = [], isLoading: locationsLoading } = useQuery<WorldLocation[]>({
    queryKey: ["/api/world/locations"],
  });

  const { data: myProgress = [] } = useQuery<UserWorldProgress[]>({
    queryKey: ["/api/world/progress"],
    enabled: !!user,
  });

  // Fetch active adventures/campaigns per region and location
  interface WorldActivity {
    regionActivity: Record<number, { campaigns: any[], adventurerCount: number }>;
    locationActivity: Record<number, { campaigns: any[], adventurerCount: number }>;
  }
  const { data: worldActivity } = useQuery<WorldActivity>({
    queryKey: ["/api/world/activity"],
  });

  const getRegionActivity = (regionId: number) => {
    return worldActivity?.regionActivity?.[regionId] || { campaigns: [], adventurerCount: 0 };
  };

  const getLocationActivity = (locationId: number) => {
    return worldActivity?.locationActivity?.[locationId] || { campaigns: [], adventurerCount: 0 };
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

  const regionLocations = selectedRegion 
    ? locations.filter(l => l.regionId === selectedRegion.id)
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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section - Matching Groups page style */}
      <div className="container mx-auto px-4 py-8">
        <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-cyan-900/40 via-blue-900/30 to-slate-900/40 border border-cyan-500/20 p-8 mb-8">
          {/* Parchment background texture */}
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
            <Map className="h-20 w-20 text-cyan-300" />
          </div>
          <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm">
                  <Compass className="h-3 w-3" />
                  <span>Explore the Realm</span>
                </div>
              </div>
              <h1 className="text-2xl md:text-3xl font-fantasy font-bold text-white mb-2">The Realm of Everdice</h1>
              <p className="text-white/60">Explore the world and track your adventures</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1 bg-white/10 border-white/20 text-white">
                <User className="h-3 w-3" />
                {user?.username || "Guest"}
              </Badge>
              <Badge variant="secondary" className="gap-1 bg-cyan-500/20 text-cyan-300 border-cyan-500/30">
                <CheckCircle2 className="h-3 w-3" />
                {myProgress.filter(p => p.completionState === 'completed').length} / {regions.length + locations.length} Explored
              </Badge>
            </div>
          </div>
        </div>
        </section>
      </div>

      {/* Main content - Direct map interaction */}
      <div className="container mx-auto px-4 pb-6">
        <div className="flex gap-4">
          {/* The Map - Direct interaction */}
          <div className="flex-1">
            <div 
              className="relative rounded-2xl overflow-hidden border-4 border-amber-800/50 shadow-2xl"
              style={{
                backgroundImage: `url(${worldMapBackground})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                aspectRatio: '3/2'
              }}
            >
              {/* Inner vignette effect */}
              <div className="absolute inset-0 pointer-events-none" style={{
                boxShadow: 'inset 0 0 80px rgba(0,0,0,0.4)'
              }} />
              
              {/* Floating Legend - top left */}
              <div className="absolute top-3 left-3 z-20 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-amber-500/30">
                <div className="flex flex-wrap gap-3 text-xs text-amber-100/90">
                  <div className="flex items-center gap-1">
                    <Lock className="h-3 w-3 text-gray-400" />
                    <span>Undiscovered</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="h-3 w-3 text-blue-400" />
                    <span>Discovered</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-400" />
                    <span>Completed</span>
                  </div>
                </div>
              </div>

              {/* Transparent clickable region hotspots - positioned exactly on text labels */}
              {regions.map((region) => {
                const progress = getRegionProgress(region.id);
                const progressState = getProgressState(progress);
                const isSelected = selectedRegion?.id === region.id;
                
                // Precise positions matching where text labels appear on the map
                const labelPositions: Record<string, { left: string; top: string; width: string; height: string }> = {
                  'The Frostpeak Mountains': { left: '4%', top: '6%', width: '14%', height: '8%' },
                  'The Whispering Woods': { left: '30%', top: '10%', width: '18%', height: '6%' },
                  'Shadowfen Marshes': { left: '62%', top: '8%', width: '18%', height: '6%' },
                  'The Verdant Heartlands': { left: '25%', top: '42%', width: '18%', height: '8%' },
                  'The Blighted Wastes': { left: '56%', top: '38%', width: '18%', height: '6%' },
                  'Crystal Bay': { left: '10%', top: '80%', width: '12%', height: '6%' },
                  'Sunfire Desert': { left: '36%', top: '68%', width: '14%', height: '6%' },
                  'Ember Volcanic Isles': { left: '62%', top: '80%', width: '18%', height: '6%' },
                };
                
                const pos = labelPositions[region.name] || { left: '0%', top: '0%', width: '10%', height: '5%' };
                
                return (
                  <Tooltip key={region.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setSelectedRegion(isSelected ? null : region)}
                        className={`
                          absolute transition-all duration-200 cursor-pointer rounded
                          hover:bg-amber-500/30 hover:backdrop-blur-[2px]
                          ${isSelected ? 'bg-amber-500/40 ring-2 ring-amber-400 shadow-lg shadow-amber-500/20' : 'bg-transparent'}
                          ${progressState === 'undiscovered' ? 'opacity-60' : ''}
                        `}
                        style={{
                          left: pos.left,
                          top: pos.top,
                          width: pos.width,
                          height: pos.height,
                        }}
                        data-testid={`region-${region.id}`}
                      >
                        {/* Progress indicator */}
                        <div className="absolute -top-1 -left-1 bg-black/70 rounded-full p-0.5">
                          {getProgressIcon(progressState)}
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs bg-black/90 border-amber-500/30">
                      <div className="space-y-1">
                        <p className="font-bold text-amber-100">{region.name}</p>
                        <p className="text-xs text-amber-100/70">{region.description}</p>
                        <div className="flex gap-2 text-xs">
                          <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-200">
                            Lvl {region.levelRange}
                          </Badge>
                          <Badge 
                            className={`text-xs ${dangerColors[region.dangerLevel || 1]} text-white`}
                          >
                            Danger: {region.dangerLevel}/5
                          </Badge>
                        </div>
                        <p className="text-xs italic text-amber-100/60">{region.knownFor}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>

              {/* Region Details Panel */}
              <div className="w-80">
                  {selectedRegion ? (
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
                      <CardContent className="space-y-4">
                        <p className="text-sm text-amber-100/70">
                          {selectedRegion.description}
                        </p>
                
                        {selectedRegion.lore && (
                          <div className="p-3 bg-amber-900/30 rounded-lg text-sm italic text-amber-100/60">
                            {selectedRegion.lore}
                          </div>
                        )}

                        {/* Active Adventures in this Region */}
                        {(() => {
                          const activity = getRegionActivity(selectedRegion.id);
                          if (activity.campaigns.length === 0) return null;
                          return (
                            <div className="p-3 bg-amber-900/20 border border-amber-700/30 rounded-lg">
                              <h4 className="font-semibold mb-2 flex items-center gap-2 text-amber-300">
                                <Swords className="h-4 w-4" />
                                Active Adventures ({activity.campaigns.length})
                              </h4>
                              <div className="space-y-2">
                                {activity.campaigns.slice(0, 5).map((campaign: any) => (
                                  <div key={campaign.id} className="flex items-center gap-2 text-sm text-amber-100/80">
                                    <div className={`w-2 h-2 rounded-full ${campaign.isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
                                    <span className="flex-1 truncate">{campaign.title}</span>
                                    <div className="flex items-center gap-1 text-amber-100/60">
                                      <Users className="h-3 w-3" />
                                      <span className="text-xs">{campaign.adventurerCount}</span>
                                    </div>
                                  </div>
                                ))}
                                {activity.campaigns.length > 5 && (
                                  <p className="text-xs text-amber-100/50">
                                    +{activity.campaigns.length - 5} more adventures...
                                  </p>
                                )}
                              </div>
                              <div className="mt-2 pt-2 border-t border-amber-700/30 flex items-center gap-2 text-xs text-amber-200">
                                <Users className="h-3 w-3" />
                                {activity.adventurerCount} adventurers exploring this region
                              </div>
                            </div>
                          );
                        })()}

                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2 text-amber-100">
                            <MapPin className="h-4 w-4 text-amber-400" />
                            Locations ({regionLocations.length})
                          </h4>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
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
                                  data-testid={`location-${location.id}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <LocationIcon className="h-4 w-4 text-amber-400" />
                                    <span className="font-medium text-sm flex-1 text-amber-100">{location.name}</span>
                                    {getProgressIcon(progressState)}
                                    {location.isMainQuest && (
                                      <Crown className="h-3 w-3 text-amber-400" />
                                    )}
                                  </div>
                                  <p className="text-xs text-amber-100/60 mt-1">
                                    {location.description}
                                  </p>
                                  {(() => {
                                    const locActivity = getLocationActivity(location.id);
                                    if (locActivity.campaigns.length === 0) return null;
                                    return (
                                      <div className="mt-1 flex items-center gap-1">
                                        <Badge variant="secondary" className="text-xs bg-amber-600/30 text-amber-200 border-amber-600/50">
                                          <Swords className="h-3 w-3 mr-1" />
                                          {locActivity.campaigns.length} active
                                        </Badge>
                                        <span className="text-xs text-amber-100/50">
                                          ({locActivity.adventurerCount} adventurers)
                                        </span>
                                      </div>
                                    );
                                  })()}
                                </div>
                              );
                            })}
                            {regionLocations.length === 0 && (
                              <p className="text-sm text-amber-100/50 italic">
                                No known locations in this region yet.
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-2 border-dashed border-amber-500/30 bg-black/40 backdrop-blur-sm">
                      <CardContent className="py-12 text-center">
                        <MapPin className="h-12 w-12 mx-auto text-amber-400/50 mb-4" />
                        <h3 className="font-semibold mb-2 text-amber-100">Select a Region</h3>
                        <p className="text-sm text-amber-100/60">
                          Click on any region on the map to view its details and locations.
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Progress Summary */}
                  <Card className="mt-4 border-2 border-amber-500/30 bg-black/40 backdrop-blur-sm">
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
                </div>
              </div>
            </div>
          </div>
  );
}
