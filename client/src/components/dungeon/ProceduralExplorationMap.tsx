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

const HEX_SIZE = 40;
const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
const HEX_HEIGHT = 2 * HEX_SIZE;

function axialToPixel(q: number, r: number): { x: number; y: number } {
  const x = HEX_WIDTH * (q + r / 2);
  const y = HEX_HEIGHT * 0.75 * r;
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
  if (terrain.includes("forest") || terrain.includes("glade") || terrain.includes("meadow")) {
    return "fill-green-800/60 stroke-green-600";
  }
  if (terrain.includes("mountain") || terrain.includes("cave") || terrain.includes("rock")) {
    return "fill-stone-700/60 stroke-stone-500";
  }
  if (terrain.includes("water") || terrain.includes("lake") || terrain.includes("river")) {
    return "fill-blue-800/60 stroke-blue-500";
  }
  if (terrain.includes("village") || terrain.includes("town") || terrain.includes("tavern")) {
    return "fill-amber-900/60 stroke-amber-600";
  }
  if (terrain.includes("dungeon") || terrain.includes("crypt") || terrain.includes("ruin")) {
    return "fill-purple-900/60 stroke-purple-600";
  }
  if (terrain.includes("desert") || terrain.includes("sand")) {
    return "fill-yellow-800/60 stroke-yellow-600";
  }
  
  return "fill-slate-600/60 stroke-slate-500";
}

function HexTile({ 
  hex, 
  isCurrentPosition, 
  isAdjacent,
  onClick,
  onHover,
  interactive
}: { 
  hex: ExplorationHex; 
  isCurrentPosition: boolean;
  isAdjacent: boolean;
  onClick?: () => void;
  onHover?: (hex: ExplorationHex | null) => void;
  interactive?: boolean;
}) {
  const { x, y } = axialToPixel(hex.q, hex.r);
  const colorClass = getHexColor(hex, isCurrentPosition);
  const canClick = interactive && isAdjacent && hex.isRevealed && !isCurrentPosition;
  
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const px = HEX_SIZE * Math.cos(angle);
    const py = HEX_SIZE * Math.sin(angle);
    points.push(`${px},${py}`);
  }
  
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
        className={`${colorClass} stroke-2 transition-all duration-200 ${canClick ? "hover:brightness-125" : ""}`}
      />
      
      {hex.isRevealed && (
        <g className="pointer-events-none">
          {isCurrentPosition && (
            <circle r="8" className="fill-white animate-pulse" />
          )}
          
          {!isCurrentPosition && hex.isExplored && (
            <g className="opacity-70">
              {getTerrainIcon(hex.terrainType)}
            </g>
          )}
          
          {!isCurrentPosition && !hex.isExplored && isAdjacent && (
            <text 
              textAnchor="middle" 
              dominantBaseline="middle" 
              className="fill-slate-400 text-xs font-bold"
            >
              ?
            </text>
          )}
        </g>
      )}
      
      {!hex.isRevealed && (
        <g className="pointer-events-none opacity-30">
          <EyeOff className="h-3 w-3" />
        </g>
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
  
  const bounds = useMemo(() => {
    if (hexes.length === 0) return { minX: -100, maxX: 100, minY: -100, maxY: 100 };
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const hex of hexes) {
      const { x, y } = axialToPixel(hex.q, hex.r);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    
    const padding = HEX_SIZE * 2;
    return {
      minX: minX - padding,
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding
    };
  }, [hexes]);
  
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
        <div className={`relative ${compact ? "h-48" : "h-64"} bg-slate-950 rounded-lg overflow-hidden`}>
          <svg 
            viewBox={`${bounds.minX} ${bounds.minY} ${viewBoxWidth} ${viewBoxHeight}`}
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {hexes.map((hex) => (
              <HexTile
                key={`${hex.q},${hex.r}`}
                hex={hex}
                isCurrentPosition={hex.q === state?.currentHexQ && hex.r === state?.currentHexR}
                isAdjacent={adjacentCoords.has(`${hex.q},${hex.r}`)}
                onClick={() => handleHexClick(hex)}
                onHover={setHoveredHex}
                interactive={interactive && !isMoving}
              />
            ))}
          </svg>
          
          {isMoving && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
            </div>
          )}
        </div>
        
        {hoveredHex && hoveredHex.isRevealed && (
          <div className="mt-2 p-2 bg-slate-800/80 rounded text-sm">
            <div className="font-medium text-amber-300">
              {hoveredHex.locationName || hoveredHex.terrainType}
            </div>
            {hoveredHex.locationDescription && (
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                {hoveredHex.locationDescription}
              </p>
            )}
            {!hoveredHex.isExplored && adjacentCoords.has(`${hoveredHex.q},${hoveredHex.r}`) && (
              <p className="text-xs text-amber-400 mt-1">
                Click to explore this area
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ProceduralExplorationMap;
