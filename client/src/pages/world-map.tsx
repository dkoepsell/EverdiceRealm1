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
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-slate-900 via-cyan-900/20 to-slate-900 py-8 md:py-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-transparent"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl"></div>
        <div className="absolute top-6 right-8 md:right-16 opacity-15">
          <Map className="h-14 w-14 md:h-20 md:w-20 text-cyan-400" />
        </div>
        <div className="absolute top-16 right-20 md:right-40 opacity-10">
          <Compass className="h-10 w-10 md:h-16 md:w-16 text-blue-300 rotate-12" />
        </div>
        <div className="absolute bottom-6 right-12 md:right-28 opacity-10">
          <MapPin className="h-12 w-12 md:h-16 md:w-16 text-cyan-300" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
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

      <div className="container mx-auto p-6">
      <div className="flex gap-6">
        {/* World Map Grid */}
        <div className="flex-1">
          <Card className="overflow-hidden border-2 border-primary/20">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10 py-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Compass className="h-5 w-5" />
                World Map
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {/* Map Legend */}
              <div className="flex flex-wrap gap-4 mb-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className={`w-3 h-3 rounded ${dangerColors[1]}`} />
                  <span>Safe (1-3)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-3 h-3 rounded ${dangerColors[3]}`} />
                  <span>Moderate (4-7)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-3 h-3 rounded ${dangerColors[5]}`} />
                  <span>Deadly (8+)</span>
                </div>
                <div className="flex items-center gap-1 ml-auto">
                  <Lock className="h-3 w-3 text-gray-500" />
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

              {/* The Map Grid - 9x7 grid with regions placed */}
              <div 
                className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-lg p-4"
                style={{ minHeight: "400px" }}
              >
                {/* Grid overlay */}
                <div 
                  className="absolute inset-4 grid"
                  style={{ 
                    gridTemplateColumns: "repeat(9, 1fr)",
                    gridTemplateRows: "repeat(7, 1fr)",
                    gap: "4px"
                  }}
                >
                  {regions.map((region) => {
                    const TerrainIcon = terrainIcons[region.terrain || 'plains'] || Landmark;
                    const progress = getRegionProgress(region.id);
                    const progressState = getProgressState(progress);
                    const isSelected = selectedRegion?.id === region.id;
                    
                    return (
                      <Tooltip key={region.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setSelectedRegion(isSelected ? null : region)}
                            className={`
                              relative rounded-lg transition-all duration-300 cursor-pointer
                              bg-gradient-to-br ${terrainColors[region.terrain || 'plains']}
                              hover:scale-105 hover:z-10 hover:shadow-xl
                              ${isSelected ? 'ring-2 ring-primary scale-105 z-10' : ''}
                              ${progressState === 'undiscovered' ? 'opacity-60' : ''}
                            `}
                            style={{
                              gridColumn: `${region.gridX} / span ${region.width}`,
                              gridRow: `${region.gridY} / span ${region.height}`,
                            }}
                            data-testid={`region-${region.id}`}
                          >
                            {/* Danger indicator */}
                            <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${dangerColors[region.dangerLevel || 1]}`} />
                            
                            {/* Progress indicator */}
                            <div className="absolute top-1 left-1">
                              {getProgressIcon(progressState)}
                            </div>
                            
                            {/* Region content */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                              <TerrainIcon 
                                className="h-6 w-6 mb-1" 
                                style={{ color: region.color || '#888' }}
                              />
                              <span className="text-xs font-medium text-center line-clamp-2 text-white drop-shadow-md">
                                {region.name}
                              </span>
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-1">
                            <p className="font-bold">{region.name}</p>
                            <p className="text-xs text-muted-foreground">{region.description}</p>
                            <div className="flex gap-2 text-xs">
                              <Badge variant="outline" className="text-xs">
                                Lvl {region.levelRange}
                              </Badge>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${dangerColors[region.dangerLevel || 1]} text-white`}
                              >
                                Danger: {region.dangerLevel}/5
                              </Badge>
                            </div>
                            <p className="text-xs italic">{region.knownFor}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Region Details Panel */}
        <div className="w-80">
          {selectedRegion ? (
            <Card className="border-2 border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{selectedRegion.name}</CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedRegion(null)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">Lvl {selectedRegion.levelRange}</Badge>
                  <Badge className={`${dangerColors[selectedRegion.dangerLevel || 1]} text-white`}>
                    Danger {selectedRegion.dangerLevel}/5
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {selectedRegion.description}
                </p>
                
                {selectedRegion.lore && (
                  <div className="p-3 bg-muted/50 rounded-lg text-sm italic">
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
                          <div key={campaign.id} className="flex items-center gap-2 text-sm">
                            <div className={`w-2 h-2 rounded-full ${campaign.isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
                            <span className="flex-1 truncate">{campaign.title}</span>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Users className="h-3 w-3" />
                              <span className="text-xs">{campaign.adventurerCount}</span>
                            </div>
                          </div>
                        ))}
                        {activity.campaigns.length > 5 && (
                          <p className="text-xs text-muted-foreground">
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
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
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
                            ${progressState === 'undiscovered' ? 'opacity-60 bg-muted/30' : 'bg-muted/50'}
                            ${location.isMainQuest ? 'border-amber-500/50' : 'border-transparent'}
                          `}
                          data-testid={`location-${location.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <LocationIcon className="h-4 w-4 text-primary" />
                            <span className="font-medium text-sm flex-1">{location.name}</span>
                            {getProgressIcon(progressState)}
                            {location.isMainQuest && (
                              <Crown className="h-3 w-3 text-amber-400" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
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
                                <span className="text-xs text-muted-foreground">
                                  ({locActivity.adventurerCount} adventurers)
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                    {regionLocations.length === 0 && (
                      <p className="text-sm text-muted-foreground italic">
                        No known locations in this region yet.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-2 border-dashed border-muted">
              <CardContent className="py-12 text-center">
                <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Select a Region</h3>
                <p className="text-sm text-muted-foreground">
                  Click on any region on the map to view its details and locations.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Progress Summary */}
          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Your Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Regions Discovered</span>
                  <span className="font-medium">
                    {myProgress.filter(p => p.regionId && p.hasDiscovered).length} / {regions.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Locations Found</span>
                  <span className="font-medium">
                    {myProgress.filter(p => p.locationId && p.hasDiscovered).length} / {locations.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Areas Completed</span>
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
