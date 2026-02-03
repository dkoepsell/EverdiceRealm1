import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Compass, 
  MapPin, 
  Eye, 
  EyeOff, 
  Footprints,
  Mountain,
  Trees,
  Home,
  Skull,
  Sparkles,
  HelpCircle,
  Navigation,
  Loader2
} from "lucide-react";

interface HexEntity {
  type: "monster" | "npc" | "object" | "hazard";
  name: string;
  hostile: boolean;
  direction?: string;
}

interface HexMeta {
  narrativeTone?: string;
  currentState?: string;
  importanceType?: string;
  affordances?: {
    exploration: number;
    social: number;
    investigation: number;
    puzzle: number;
    combat: number;
  };
  tension?: number;
  environmentTags?: string[];
  regionName?: string;
  regionDescription?: string;
  entities?: HexEntity[];
}

interface ExplorationHex {
  id: number;
  campaignId: number;
  q: number;
  r: number;
  terrainType: string;
  locationName?: string;
  locationDescription?: string;
  hexMeta?: HexMeta;
  isExplored: boolean;
  isRevealed: boolean;
  exploredAt?: string;
  revealedAt?: string;
  narrativeContext?: string;
}

interface ExplorationState {
  currentHexQ: number;
  currentHexR: number;
  exploredHexCount: number;
  totalDistance: number;
}

interface ProceduralExplorationMapProps {
  campaignId: number;
  onHexMove?: (hex: ExplorationHex, needsNarrative: boolean) => void;
  interactive?: boolean;
  compact?: boolean;
}

const HEX_SIZE_NORMAL = 32;
const HEX_SIZE_COMPACT = 18;

function axialToPixel(q: number, r: number, hexSize: number): { x: number; y: number } {
  const hexWidth = Math.sqrt(3) * hexSize;
  const hexHeight = 2 * hexSize;
  const x = hexWidth * (q + r / 2);
  const y = hexHeight * 0.75 * r;
  return { x, y };
}

function getTerrainIcon(terrainType: string) {
  const terrain = terrainType.toLowerCase();
  if (terrain.includes("forest") || terrain.includes("tree") || terrain.includes("wood")) {
    return <Trees className="h-4 w-4" />;
  }
  if (terrain.includes("mountain") || terrain.includes("cave") || terrain.includes("rock")) {
    return <Mountain className="h-4 w-4" />;
  }
  if (terrain.includes("village") || terrain.includes("town") || terrain.includes("tavern")) {
    return <Home className="h-4 w-4" />;
  }
  if (terrain.includes("dungeon") || terrain.includes("crypt") || terrain.includes("ruin")) {
    return <Skull className="h-4 w-4" />;
  }
  if (terrain.includes("temple") || terrain.includes("shrine")) {
    return <Sparkles className="h-4 w-4" />;
  }
  return <HelpCircle className="h-4 w-4" />;
}

function getHexColor(hex: ExplorationHex, isCurrentPosition: boolean): string {
  if (isCurrentPosition) {
    return "fill-amber-500/80 stroke-amber-400";
  }
  if (!hex.isRevealed) {
    return "fill-slate-900/90 stroke-slate-800";
  }
  if (!hex.isExplored) {
    return "fill-slate-700/60 stroke-slate-600 hover:fill-slate-600/80 cursor-pointer";
  }
  
  const terrain = hex.terrainType.toLowerCase();
  
  // Vegetation - greens
  if (terrain.includes("forest") || terrain.includes("wood") || terrain.includes("grove") || terrain.includes("thicket")) {
    return "fill-green-900/70 stroke-green-600";
  }
  if (terrain.includes("grass") || terrain.includes("meadow") || terrain.includes("field") || terrain.includes("plains") || terrain.includes("clearing") || terrain.includes("glade")) {
    return "fill-lime-800/60 stroke-lime-500";
  }
  if (terrain.includes("garden") || terrain.includes("orchard")) {
    return "fill-emerald-800/60 stroke-emerald-500";
  }
  if (terrain.includes("swamp") || terrain.includes("marsh") || terrain.includes("bog")) {
    return "fill-teal-900/60 stroke-teal-600";
  }
  
  // Elevation - browns/grays
  if (terrain.includes("mountain") || terrain.includes("peak") || terrain.includes("cliff") || terrain.includes("ridge") || terrain.includes("canyon")) {
    return "fill-stone-700/70 stroke-stone-500";
  }
  if (terrain.includes("hill") || terrain.includes("slope") || terrain.includes("valley")) {
    return "fill-amber-800/50 stroke-amber-600";
  }
  if (terrain.includes("cave") || terrain.includes("cavern") || terrain.includes("mine")) {
    return "fill-stone-800/70 stroke-stone-600";
  }
  
  // Water - blues
  if (terrain.includes("river") || terrain.includes("stream") || terrain.includes("brook") || terrain.includes("creek") || terrain.includes("waterfall")) {
    return "fill-blue-700/60 stroke-blue-400";
  }
  if (terrain.includes("lake") || terrain.includes("pond") || terrain.includes("pool")) {
    return "fill-blue-800/70 stroke-blue-500";
  }
  if (terrain.includes("coast") || terrain.includes("shore") || terrain.includes("beach") || terrain.includes("island")) {
    return "fill-cyan-800/60 stroke-cyan-500";
  }
  if (terrain.includes("dock") || terrain.includes("pier") || terrain.includes("harbor")) {
    return "fill-slate-700/60 stroke-blue-500";
  }
  
  // Harsh terrain
  if (terrain.includes("desert") || terrain.includes("dune") || terrain.includes("sand")) {
    return "fill-yellow-700/60 stroke-yellow-500";
  }
  if (terrain.includes("volcano") || terrain.includes("lava")) {
    return "fill-orange-900/70 stroke-red-600";
  }
  if (terrain.includes("ice") || terrain.includes("glacier") || terrain.includes("snow") || terrain.includes("tundra")) {
    return "fill-sky-200/60 stroke-sky-400";
  }
  
  // Paths - tan/brown
  if (terrain.includes("road") || terrain.includes("path") || terrain.includes("trail") || terrain.includes("track") || terrain.includes("crossroads")) {
    return "fill-amber-700/50 stroke-amber-500";
  }
  if (terrain.includes("bridge")) {
    return "fill-stone-600/60 stroke-stone-400";
  }
  
  // Buildings & structures
  if (terrain.includes("castle") || terrain.includes("fortress") || terrain.includes("keep") || terrain.includes("tower")) {
    return "fill-slate-600/70 stroke-slate-400";
  }
  if (terrain.includes("wall") || terrain.includes("gate") || terrain.includes("rampart") || terrain.includes("battlement")) {
    return "fill-stone-600/70 stroke-stone-400";
  }
  if (terrain.includes("house") || terrain.includes("cabin") || terrain.includes("cottage") || terrain.includes("hut") || terrain.includes("building")) {
    return "fill-amber-800/60 stroke-amber-600";
  }
  
  // Settlements - warm amber/orange
  if (terrain.includes("village") || terrain.includes("town") || terrain.includes("city")) {
    return "fill-amber-900/70 stroke-amber-600";
  }
  if (terrain.includes("market") || terrain.includes("square") || terrain.includes("plaza") || terrain.includes("street")) {
    return "fill-orange-900/60 stroke-orange-600";
  }
  if (terrain.includes("tavern") || terrain.includes("inn") || terrain.includes("shop")) {
    return "fill-amber-800/60 stroke-amber-500";
  }
  if (terrain.includes("camp")) {
    return "fill-orange-800/50 stroke-orange-500";
  }
  
  // Religious/magical - purples
  if (terrain.includes("temple") || terrain.includes("shrine") || terrain.includes("altar") || terrain.includes("sanctuary") || terrain.includes("chapel") || terrain.includes("cathedral")) {
    return "fill-violet-900/60 stroke-violet-500";
  }
  
  // Dark places - deep purples/grays
  if (terrain.includes("dungeon") || terrain.includes("crypt") || terrain.includes("tomb") || terrain.includes("catacomb")) {
    return "fill-purple-950/70 stroke-purple-700";
  }
  if (terrain.includes("graveyard") || terrain.includes("cemetery")) {
    return "fill-slate-800/70 stroke-slate-600";
  }
  if (terrain.includes("ruin")) {
    return "fill-stone-700/60 stroke-stone-500";
  }
  
  // Underground passages
  if (terrain.includes("tunnel") || terrain.includes("corridor") || terrain.includes("passage") || terrain.includes("hall") || terrain.includes("chamber") || terrain.includes("room")) {
    return "fill-stone-600/60 stroke-stone-400";
  }
  if (terrain.includes("cellar") || terrain.includes("basement")) {
    return "fill-stone-700/60 stroke-stone-500";
  }
  
  // Danger
  if (terrain.includes("danger") || terrain.includes("hostile") || terrain.includes("battlefield")) {
    return "fill-red-900/60 stroke-red-600";
  }
  
  // Fallback
  if (terrain.includes("explored") || terrain.includes("previous")) {
    return "fill-slate-500/60 stroke-slate-400";
  }
  
  return "fill-slate-600/60 stroke-slate-500";
}

function getTerrainEmoji(terrainType: string): string {
  const terrain = terrainType.toLowerCase();
  // Vegetation
  if (terrain.includes("forest") || terrain.includes("wood") || terrain.includes("grove") || terrain.includes("thicket")) return "🌲";
  if (terrain.includes("tree")) return "🌳";
  if (terrain.includes("grass") || terrain.includes("meadow") || terrain.includes("field") || terrain.includes("plains")) return "🌾";
  if (terrain.includes("garden") || terrain.includes("orchard")) return "🌻";
  if (terrain.includes("clearing") || terrain.includes("glade")) return "☀️";
  // Elevation
  if (terrain.includes("mountain") || terrain.includes("peak")) return "⛰️";
  if (terrain.includes("hill")) return "🏔️";
  if (terrain.includes("cliff") || terrain.includes("ridge") || terrain.includes("canyon")) return "🪨";
  if (terrain.includes("valley")) return "🏞️";
  // Underground
  if (terrain.includes("cave") || terrain.includes("cavern")) return "🕳️";
  if (terrain.includes("tunnel") || terrain.includes("passage") || terrain.includes("corridor")) return "🚪";
  if (terrain.includes("mine") || terrain.includes("shaft")) return "⛏️";
  // Water
  if (terrain.includes("river") || terrain.includes("stream") || terrain.includes("brook") || terrain.includes("creek")) return "🌊";
  if (terrain.includes("lake") || terrain.includes("pond") || terrain.includes("pool")) return "💧";
  if (terrain.includes("waterfall")) return "💦";
  if (terrain.includes("swamp") || terrain.includes("marsh") || terrain.includes("bog")) return "🌿";
  if (terrain.includes("coast") || terrain.includes("shore") || terrain.includes("beach")) return "🏖️";
  if (terrain.includes("island")) return "🏝️";
  if (terrain.includes("dock") || terrain.includes("pier") || terrain.includes("harbor")) return "⚓";
  // Harsh terrain
  if (terrain.includes("desert") || terrain.includes("dune") || terrain.includes("sand")) return "🏜️";
  if (terrain.includes("volcano") || terrain.includes("lava")) return "🌋";
  if (terrain.includes("ice") || terrain.includes("glacier") || terrain.includes("snow") || terrain.includes("tundra")) return "❄️";
  // Paths
  if (terrain.includes("road") || terrain.includes("path") || terrain.includes("trail") || terrain.includes("track")) return "🛤️";
  if (terrain.includes("bridge")) return "🌉";
  if (terrain.includes("crossroads")) return "✚";
  // Buildings
  if (terrain.includes("castle") || terrain.includes("fortress") || terrain.includes("keep")) return "🏰";
  if (terrain.includes("tower")) return "🗼";
  if (terrain.includes("wall") || terrain.includes("gate") || terrain.includes("rampart") || terrain.includes("battlement")) return "🧱";
  if (terrain.includes("house") || terrain.includes("cabin") || terrain.includes("cottage") || terrain.includes("hut") || terrain.includes("building")) return "🏠";
  if (terrain.includes("hall") || terrain.includes("chamber") || terrain.includes("room")) return "🚪";
  // Settlements
  if (terrain.includes("village") || terrain.includes("town") || terrain.includes("city")) return "🏘️";
  if (terrain.includes("market") || terrain.includes("square") || terrain.includes("plaza")) return "🏛️";
  if (terrain.includes("street") || terrain.includes("alley")) return "🏙️";
  if (terrain.includes("tavern") || terrain.includes("inn")) return "🍺";
  if (terrain.includes("shop")) return "🛒";
  if (terrain.includes("stable")) return "🐴";
  // Religious
  if (terrain.includes("temple") || terrain.includes("shrine") || terrain.includes("altar") || terrain.includes("sanctuary")) return "⛩️";
  if (terrain.includes("chapel") || terrain.includes("cathedral")) return "⛪";
  // Dark places
  if (terrain.includes("dungeon") || terrain.includes("crypt") || terrain.includes("tomb") || terrain.includes("catacomb")) return "💀";
  if (terrain.includes("graveyard") || terrain.includes("cemetery")) return "🪦";
  if (terrain.includes("ruin")) return "🏚️";
  // Other
  if (terrain.includes("camp")) return "⛺";
  if (terrain.includes("library")) return "📚";
  if (terrain.includes("throne")) return "👑";
  if (terrain.includes("battlefield")) return "⚔️";
  if (terrain.includes("cellar") || terrain.includes("basement")) return "🪜";
  return "❓";
}

function HexTile({ 
  hex, 
  isCurrentPosition, 
  isAdjacent,
  onClick,
  onHover,
  interactive,
  hexSize,
  compact
}: { 
  hex: ExplorationHex; 
  isCurrentPosition: boolean;
  isAdjacent: boolean;
  onClick?: () => void;
  onHover?: (hex: ExplorationHex | null) => void;
  interactive?: boolean;
  hexSize: number;
  compact?: boolean;
}) {
  const { x, y } = axialToPixel(hex.q, hex.r, hexSize);
  const colorClass = getHexColor(hex, isCurrentPosition);
  const canClick = false;
  
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const px = hexSize * Math.cos(angle);
    const py = hexSize * Math.sin(angle);
    points.push(`${px},${py}`);
  }
  
  const iconSize = compact ? 8 : 12;
  const fontSize = compact ? "6px" : "10px";
  
  return (
    <g 
      transform={`translate(${x}, ${y})`}
      onClick={canClick ? onClick : undefined}
      onMouseEnter={() => onHover?.(hex)}
      onMouseLeave={() => onHover?.(null)}
      className={canClick ? "cursor-pointer" : ""}
    >
      <polygon
        points={points.join(" ")}
        className={`${colorClass} stroke-[1.5] transition-all duration-200 ${canClick ? "hover:brightness-125 hover:stroke-amber-400" : ""}`}
      />
      
      {hex.isRevealed && (
        <g className="pointer-events-none">
          {isCurrentPosition && (
            <>
              <circle r={hexSize * 0.25} className="fill-white animate-pulse" />
              <circle r={hexSize * 0.4} className="fill-none stroke-amber-300 stroke-1 animate-ping" style={{ animationDuration: '2s' }} />
            </>
          )}
          
          {!isCurrentPosition && hex.isExplored && (
            <>
              <text 
                textAnchor="middle" 
                dominantBaseline="middle"
                style={{ fontSize: compact ? '10px' : '14px' }}
              >
                {getTerrainEmoji(hex.terrainType)}
              </text>
              {/* Entity markers */}
              {hex.hexMeta?.entities && hex.hexMeta.entities.length > 0 && (
                <g transform={`translate(${hexSize * 0.4}, ${-hexSize * 0.3})`}>
                  {hex.hexMeta.entities.some(e => e.hostile) ? (
                    <text 
                      textAnchor="middle" 
                      dominantBaseline="middle"
                      style={{ fontSize: compact ? '8px' : '10px' }}
                    >
                      ⚔️
                    </text>
                  ) : (
                    <text 
                      textAnchor="middle" 
                      dominantBaseline="middle"
                      style={{ fontSize: compact ? '8px' : '10px' }}
                    >
                      👤
                    </text>
                  )}
                </g>
              )}
            </>
          )}
          
          {/* Revealed but unexplored hex with entities (monsters sighted) */}
          {!isCurrentPosition && !hex.isExplored && hex.isRevealed && hex.hexMeta?.entities && hex.hexMeta.entities.length > 0 && (
            <text 
              textAnchor="middle" 
              dominantBaseline="middle"
              style={{ fontSize: compact ? '10px' : '14px' }}
            >
              {hex.hexMeta.entities.some(e => e.hostile) ? "⚠️" : "❓"}
            </text>
          )}
          
          {!isCurrentPosition && !hex.isExplored && isAdjacent && !(hex.hexMeta?.entities && hex.hexMeta.entities.length > 0) && (
            <text 
              textAnchor="middle" 
              dominantBaseline="middle" 
              className="fill-amber-400/80"
              style={{ fontSize }}
            >
              ?
            </text>
          )}
        </g>
      )}
      
      {!hex.isRevealed && (
        <text 
          textAnchor="middle" 
          dominantBaseline="middle" 
          className="fill-slate-600/40"
          style={{ fontSize: compact ? '8px' : '12px' }}
        >
          ☁️
        </text>
      )}
    </g>
  );
}

export function ProceduralExplorationMap({ 
  campaignId, 
  onHexMove,
  interactive = true,
  compact = false
}: ProceduralExplorationMapProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [hoveredHex, setHoveredHex] = useState<ExplorationHex | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  
  const { data: explorationData, isLoading, refetch } = useQuery<{
    state: ExplorationState;
    hexes: ExplorationHex[];
  }>({
    queryKey: [`/api/campaigns/${campaignId}/exploration`],
    refetchInterval: 10000
  });
  
  const initializeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/campaigns/${campaignId}/exploration/initialize`, {});
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/exploration`] });
      toast({ title: "Exploration initialized", description: "Your journey begins!" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to initialize", description: error.message, variant: "destructive" });
    }
  });
  
  const moveMutation = useMutation({
    mutationFn: async ({ targetQ, targetR }: { targetQ: number; targetR: number }) => {
      const response = await apiRequest('POST', `/api/campaigns/${campaignId}/exploration/move`, {
        targetQ,
        targetR
      });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/exploration`] });
      setIsMoving(false);
      
      if (data.needsNarrative && onHexMove) {
        onHexMove(data.targetHex, true);
      }
    },
    onError: (error: Error) => {
      setIsMoving(false);
      toast({ title: "Move failed", description: error.message, variant: "destructive" });
    }
  });
  
  const state = explorationData?.state;
  const hexes = explorationData?.hexes || [];
  
  const adjacentCoords = useMemo(() => {
    if (!state) return new Set<string>();
    const currentQ = state.currentHexQ;
    const currentR = state.currentHexR;
    const directions = [
      { dq: 0, dr: -1 },
      { dq: 1, dr: -1 },
      { dq: 1, dr: 0 },
      { dq: 0, dr: 1 },
      { dq: -1, dr: 1 },
      { dq: -1, dr: 0 }
    ];
    const coords = new Set<string>();
    for (const dir of directions) {
      coords.add(`${currentQ + dir.dq},${currentR + dir.dr}`);
    }
    return coords;
  }, [state]);
  
  const handleHexClick = useCallback((hex: ExplorationHex) => {
    if (isMoving) return;
    if (!adjacentCoords.has(`${hex.q},${hex.r}`)) return;
    
    setIsMoving(true);
    moveMutation.mutate({ targetQ: hex.q, targetR: hex.r });
  }, [adjacentCoords, isMoving, moveMutation]);
  
  const hexSize = compact ? HEX_SIZE_COMPACT : HEX_SIZE_NORMAL;
  
  const allHexesWithFog = useMemo(() => {
    const hexMap = new Map<string, ExplorationHex>();
    for (const h of hexes) {
      hexMap.set(`${h.q},${h.r}`, h);
    }
    
    if (state) {
      const directions = [
        { dq: 0, dr: -1 }, { dq: 1, dr: -1 }, { dq: 1, dr: 0 },
        { dq: 0, dr: 1 }, { dq: -1, dr: 1 }, { dq: -1, dr: 0 }
      ];
      
      for (const h of hexes) {
        for (const dir of directions) {
          const nq = h.q + dir.dq;
          const nr = h.r + dir.dr;
          const key = `${nq},${nr}`;
          if (!hexMap.has(key)) {
            hexMap.set(key, {
              id: -1,
              campaignId,
              q: nq,
              r: nr,
              terrainType: "unknown",
              isExplored: false,
              isRevealed: false
            });
          }
        }
      }
    }
    
    return Array.from(hexMap.values());
  }, [hexes, state, campaignId]);
  
  const bounds = useMemo(() => {
    if (allHexesWithFog.length === 0) return { minX: -100, maxX: 100, minY: -100, maxY: 100 };
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const hex of allHexesWithFog) {
      const { x, y } = axialToPixel(hex.q, hex.r, hexSize);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    
    const padding = hexSize * 2;
    return {
      minX: minX - padding,
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding
    };
  }, [allHexesWithFog, hexSize]);
  
  if (isLoading) {
    return (
      <Card className={`bg-slate-900/80 border-slate-700 ${compact ? "" : "h-64"}`}>
        <CardContent className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
        </CardContent>
      </Card>
    );
  }
  
  if (hexes.length === 0) {
    return (
      <Card className={`bg-slate-900/80 border-slate-700 ${compact ? "" : ""}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
            <Compass className="h-4 w-4" />
            Exploration Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400 mb-3">
            Begin your journey to reveal the world around you.
          </p>
          <Button 
            size="sm"
            className="w-full gap-2 bg-amber-600 hover:bg-amber-500"
            onClick={() => initializeMutation.mutate()}
            disabled={initializeMutation.isPending}
          >
            {initializeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
            Initialize Exploration
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  const viewBoxWidth = bounds.maxX - bounds.minX;
  const viewBoxHeight = bounds.maxY - bounds.minY;
  
  return (
    <Card className={`bg-slate-900/80 border-slate-700 ${compact ? "" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
            <Compass className="h-4 w-4" />
            Exploration Map
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-amber-500/20 border-amber-500/50">
              <Footprints className="h-3 w-3 mr-1" />
              {state?.exploredHexCount || 0} explored
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        <div className={`relative ${compact ? "h-32" : "h-64"} bg-slate-950 rounded-lg overflow-hidden border border-slate-800`}>
          <svg 
            viewBox={`${bounds.minX} ${bounds.minY} ${viewBoxWidth} ${viewBoxHeight}`}
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {allHexesWithFog.map((hex) => (
              <HexTile
                key={`${hex.q},${hex.r}`}
                hex={hex}
                isCurrentPosition={hex.q === state?.currentHexQ && hex.r === state?.currentHexR}
                isAdjacent={adjacentCoords.has(`${hex.q},${hex.r}`)}
                onClick={() => handleHexClick(hex)}
                onHover={setHoveredHex}
                interactive={interactive && !isMoving}
                hexSize={hexSize}
                compact={compact}
              />
            ))}
          </svg>
          
          {isMoving && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
            </div>
          )}
        </div>
        
        {/* Map Legend */}
        <div className="mt-2 p-2 bg-slate-800/80 rounded text-xs border border-slate-700">
          <div className="text-slate-400 mb-1 font-medium">Legend</div>
          <div className="grid grid-cols-3 gap-x-2 gap-y-1">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-amber-500/80 border border-amber-400"></div>
              <span className="text-slate-300">You</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-green-900/70 border border-green-600"></div>
              <span className="text-slate-300">🌲 Forest</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-lime-800/60 border border-lime-500"></div>
              <span className="text-slate-300">🌾 Grass</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-stone-700/70 border border-stone-500"></div>
              <span className="text-slate-300">⛰️ Mountain</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-amber-800/50 border border-amber-600"></div>
              <span className="text-slate-300">🏔️ Hills</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-stone-800/70 border border-stone-600"></div>
              <span className="text-slate-300">🕳️ Cave</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-blue-700/60 border border-blue-400"></div>
              <span className="text-slate-300">🌊 River</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-blue-800/70 border border-blue-500"></div>
              <span className="text-slate-300">💧 Lake</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-amber-700/50 border border-amber-500"></div>
              <span className="text-slate-300">🛤️ Path</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-amber-900/70 border border-amber-600"></div>
              <span className="text-slate-300">🏘️ Town</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-slate-600/70 border border-slate-400"></div>
              <span className="text-slate-300">🏰 Castle</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-stone-600/70 border border-stone-400"></div>
              <span className="text-slate-300">🧱 Wall</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-purple-950/70 border border-purple-700"></div>
              <span className="text-slate-300">💀 Dungeon</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-stone-600/60 border border-stone-400"></div>
              <span className="text-slate-300">🚪 Passage</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-red-900/60 border border-red-600"></div>
              <span className="text-slate-300">⚔️ Danger</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-slate-700/60 border border-slate-600"></div>
              <span className="text-slate-300">? Unexplored</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-slate-900/90 border border-slate-800"></div>
              <span className="text-slate-300">☁️ Unknown</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-sky-200/60 border border-sky-400"></div>
              <span className="text-slate-300">❄️ Ice</span>
            </div>
          </div>
        </div>
        
        {hoveredHex && (hoveredHex.isRevealed || adjacentCoords.has(`${hoveredHex.q},${hoveredHex.r}`)) && (
          <div className="mt-2 p-2 bg-slate-800/90 rounded text-sm border border-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-lg">{getTerrainEmoji(hoveredHex.terrainType)}</span>
              <div>
                <div className="font-medium text-amber-300">
                  {hoveredHex.locationName || (hoveredHex.isExplored ? hoveredHex.terrainType : "Unexplored")}
                </div>
                {hoveredHex.isExplored && (
                  <span className="text-xs text-slate-500 capitalize">{hoveredHex.terrainType}</span>
                )}
              </div>
            </div>
            {hoveredHex.locationDescription && (
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                {hoveredHex.locationDescription}
              </p>
            )}
            {hoveredHex.hexMeta?.narrativeTone && (
              <div className="text-xs text-purple-400 mt-1 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> {hoveredHex.hexMeta.narrativeTone}
              </div>
            )}
            {hoveredHex.hexMeta?.entities && hoveredHex.hexMeta.entities.length > 0 && (
              <div className="text-xs mt-1 flex flex-wrap gap-1">
                {hoveredHex.hexMeta.entities.map((entity, idx) => (
                  <span 
                    key={idx}
                    className={`px-1.5 py-0.5 rounded ${entity.hostile ? 'bg-red-900/60 text-red-300' : 'bg-blue-900/60 text-blue-300'}`}
                  >
                    {entity.hostile ? '⚔️' : '👤'} {entity.name}
                  </span>
                ))}
              </div>
            )}
            {!hoveredHex.isExplored && adjacentCoords.has(`${hoveredHex.q},${hoveredHex.r}`) && (
              <p className="text-xs text-slate-400 mt-1 italic">
                Advance the story to explore this area
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ProceduralExplorationMap;
