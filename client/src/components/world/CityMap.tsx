import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Store, Shield, BookOpen, Hammer, Heart,
  Scroll, Sword, FlaskConical, Gem, Map as MapIcon,
  DoorOpen, ChevronLeft, Eye, Lock, Sparkles, Users,
  X, Star, ShoppingBag, Wheat
} from "lucide-react";

interface CityBuilding {
  id: string;
  name: string;
  type: string;
  description: string;
  x: number;
  y: number;
  size: number;
  district: string;
  services: string[];
  npcHint?: string;
}

interface CityDistrict {
  id: string;
  name: string;
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CityLayout {
  districts: CityDistrict[];
  buildings: CityBuilding[];
  gates: Array<{ id: string; name: string; x: number; y: number; direction: string }>;
  size: string;
}

interface CityMapData {
  id: number;
  campaignId: number;
  worldLocationId: number;
  locationName: string;
  layout: CityLayout;
  discoveredBuildings: string[];
}

const buildingIcons: Record<string, typeof Building2> = {
  tavern: Store,
  blacksmith: Hammer,
  magic_shop: Sparkles,
  general_store: ShoppingBag,
  temple: Heart,
  guild: Shield,
  library: BookOpen,
  stables: Wheat,
  barracks: Sword,
  apothecary: FlaskConical,
  jeweler: Gem,
  arena: Sword,
  underworld: Eye,
  cartographer: MapIcon,
};

const buildingColors: Record<string, string> = {
  tavern: "#d97706",
  blacksmith: "#6b7280",
  magic_shop: "#7c3aed",
  general_store: "#059669",
  temple: "#eab308",
  guild: "#2563eb",
  library: "#0891b2",
  stables: "#84cc16",
  barracks: "#dc2626",
  apothecary: "#10b981",
  jeweler: "#f59e0b",
  arena: "#ef4444",
  underworld: "#4b5563",
  cartographer: "#0ea5e9",
};

const districtColors = [
  "rgba(217, 119, 6, 0.08)",
  "rgba(37, 99, 235, 0.08)",
  "rgba(16, 185, 129, 0.08)",
  "rgba(124, 58, 237, 0.08)",
  "rgba(239, 68, 68, 0.08)",
  "rgba(234, 179, 8, 0.08)",
];

interface CityMapProps {
  campaignId: number;
  locationId: number;
  locationName: string;
  onClose: () => void;
  onViewQuests?: () => void;
}

export default function CityMap({ campaignId, locationId, locationName, onClose, onViewQuests }: CityMapProps) {
  const { toast } = useToast();
  const [selectedBuilding, setSelectedBuilding] = useState<CityBuilding | null>(null);
  const [hoveredBuilding, setHoveredBuilding] = useState<string | null>(null);

  const { data: cityMapData, isLoading } = useQuery<CityMapData>({
    queryKey: ["/api/campaigns", campaignId, "city-map", locationId],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/city-map/${locationId}`);
      if (res.status === 404) {
        const enterRes = await apiRequest("POST", `/api/campaigns/${campaignId}/enter-location/${locationId}`);
        const data = await enterRes.json();
        return data.cityMap;
      }
      return res.json();
    },
  });

  const discoverMutation = useMutation({
    mutationFn: async (buildingId: string) => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/city-map/${locationId}/discover`, { buildingId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "city-map", locationId] });
    },
  });

  const layout = cityMapData?.layout;
  const discovered = useMemo(() => new Set(cityMapData?.discoveredBuildings || []), [cityMapData?.discoveredBuildings]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
        <Card className="w-96 bg-zinc-900 border-amber-500/30">
          <CardContent className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-amber-200">Generating city map for {locationName}...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!layout) return null;

  const mapWidth = 520;
  const mapHeight = 520;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
      <div className="max-w-6xl w-full max-h-[90vh] flex gap-4">
        <Card className="flex-1 bg-zinc-900/95 border-amber-500/30 overflow-hidden">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-400 hover:text-white">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div>
                <CardTitle className="text-amber-200 flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  {locationName}
                </CardTitle>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {layout.size} settlement · {layout.districts.length} districts · {layout.buildings.length} buildings
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                {discovered.size}/{layout.buildings.length} discovered
              </Badge>
              {onViewQuests && (
                <Button variant="outline" size="sm" onClick={onViewQuests} className="text-amber-400 border-amber-500/30">
                  <Scroll className="w-4 h-4 mr-1" />
                  Quest Board
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-400">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <TooltipProvider>
              <div
                className="relative mx-auto rounded-lg overflow-hidden"
                style={{
                  width: mapWidth,
                  height: mapHeight,
                  background: "linear-gradient(135deg, #1a1510 0%, #2a1f15 50%, #1a1510 100%)",
                  border: "2px solid rgba(217, 119, 6, 0.3)",
                }}
              >
                {layout.districts.map((district, i) => (
                  <div
                    key={district.id}
                    className="absolute rounded-lg border border-dashed"
                    style={{
                      left: district.x,
                      top: district.y,
                      width: district.width,
                      height: district.height,
                      backgroundColor: districtColors[i % districtColors.length],
                      borderColor: "rgba(255,255,255,0.1)",
                    }}
                  >
                    <span className="absolute top-1 left-2 text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                      {district.name}
                    </span>
                  </div>
                ))}

                {layout.gates.map(gate => (
                  <Tooltip key={gate.id}>
                    <TooltipTrigger asChild>
                      <div
                        className="absolute w-6 h-6 flex items-center justify-center cursor-pointer"
                        style={{ left: gate.x - 12, top: gate.y - 12 }}
                      >
                        <DoorOpen className="w-5 h-5 text-amber-700/60" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-zinc-800 border-amber-500/30">
                      <p className="text-xs">{gate.name}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}

                {layout.buildings.map(building => {
                  const isDiscovered = discovered.has(building.id);
                  const isHovered = hoveredBuilding === building.id;
                  const isSelected = selectedBuilding?.id === building.id;
                  const IconComponent = buildingIcons[building.type] || Building2;
                  const color = buildingColors[building.type] || "#9ca3af";

                  return (
                    <Tooltip key={building.id}>
                      <TooltipTrigger asChild>
                        <div
                          className="absolute flex items-center justify-center cursor-pointer transition-all duration-200"
                          style={{
                            left: building.x - building.size / 2,
                            top: building.y - building.size / 2,
                            width: building.size,
                            height: building.size,
                            transform: isHovered || isSelected ? "scale(1.3)" : "scale(1)",
                            zIndex: isHovered || isSelected ? 10 : 1,
                          }}
                          onClick={() => {
                            setSelectedBuilding(building);
                            if (!isDiscovered) {
                              discoverMutation.mutate(building.id);
                            }
                          }}
                          onMouseEnter={() => setHoveredBuilding(building.id)}
                          onMouseLeave={() => setHoveredBuilding(null)}
                        >
                          <div
                            className="w-full h-full rounded-md flex items-center justify-center shadow-lg"
                            style={{
                              backgroundColor: isDiscovered ? `${color}33` : "rgba(30,30,30,0.8)",
                              border: `2px solid ${isDiscovered ? color : "rgba(100,100,100,0.4)"}`,
                              boxShadow: isSelected ? `0 0 12px ${color}66` : "none",
                            }}
                          >
                            {isDiscovered ? (
                              <IconComponent className="w-4 h-4" style={{ color }} />
                            ) : (
                              <Lock className="w-3 h-3 text-zinc-600" />
                            )}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-zinc-800 border-amber-500/30">
                        <p className="text-xs font-medium">{isDiscovered ? building.name : "Unknown Building"}</p>
                        <p className="text-[10px] text-zinc-400">{isDiscovered ? building.type : "Click to discover"}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
          </CardContent>
        </Card>

        <Card className="w-80 bg-zinc-900/95 border-amber-500/30 overflow-hidden flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-200">
              {selectedBuilding ? selectedBuilding.name : "Select a Building"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {selectedBuilding ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const Icon = buildingIcons[selectedBuilding.type] || Building2;
                      const color = buildingColors[selectedBuilding.type] || "#9ca3af";
                      return <Icon className="w-5 h-5" style={{ color }} />;
                    })()}
                    <Badge variant="outline" className="text-xs capitalize">
                      {selectedBuilding.type.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-300">{selectedBuilding.description}</p>
                  {selectedBuilding.npcHint && (
                    <div className="flex items-start gap-2 p-2 rounded bg-zinc-800/50 border border-zinc-700/50">
                      <Users className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-zinc-400">{selectedBuilding.npcHint} awaits inside</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Services</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedBuilding.services.map(service => (
                        <Badge key={service} variant="secondary" className="text-xs capitalize bg-zinc-800 text-zinc-300">
                          {service.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-zinc-800">
                    <p className="text-xs text-zinc-500 mb-2">
                      District: {layout?.districts.find(d => d.id === selectedBuilding.district)?.name || "Unknown"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Building2 className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                  <p className="text-sm text-zinc-500">Click a building on the map to explore it</p>
                  <p className="text-xs text-zinc-600 mt-1">Undiscovered buildings appear as locked icons</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}