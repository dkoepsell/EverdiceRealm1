import { useState, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Compass, 
  Footprints,
  Sparkles,
  Navigation,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2,
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

type TerrainCategory = 
  | "forest" | "grass" | "swamp" | "mountain" | "hill" | "cave" 
  | "water" | "lake" | "coast" | "desert" | "snow" | "lava"
  | "path" | "settlement" | "structure" | "sacred" | "dungeon" 
  | "underground" | "danger" | "unknown";

interface TerrainStyle {
  fill: string;
  stroke: string;
  gradientId: string;
}

const TERRAIN_STYLES: Record<TerrainCategory, TerrainStyle> = {
  forest:      { fill: "#1a4a1a", stroke: "#2d7a2d", gradientId: "grad-forest" },
  grass:       { fill: "#3d6b2e", stroke: "#5a9a3f", gradientId: "grad-grass" },
  swamp:       { fill: "#1a3a2e", stroke: "#2a5a4a", gradientId: "grad-swamp" },
  mountain:    { fill: "#5a5a5a", stroke: "#7a7a7a", gradientId: "grad-mountain" },
  hill:        { fill: "#7a6a3a", stroke: "#9a8a5a", gradientId: "grad-hill" },
  cave:        { fill: "#2a2a2a", stroke: "#4a4a4a", gradientId: "grad-cave" },
  water:       { fill: "#1a4a7a", stroke: "#3a7aba", gradientId: "grad-water" },
  lake:        { fill: "#1a3a6a", stroke: "#2a5a9a", gradientId: "grad-lake" },
  coast:       { fill: "#3a7a8a", stroke: "#5a9aaa", gradientId: "grad-coast" },
  desert:      { fill: "#9a8a3a", stroke: "#baaa5a", gradientId: "grad-desert" },
  snow:        { fill: "#b0c4de", stroke: "#d0e4fe", gradientId: "grad-snow" },
  lava:        { fill: "#6a1a0a", stroke: "#aa3a1a", gradientId: "grad-lava" },
  path:        { fill: "#6a5a2a", stroke: "#8a7a4a", gradientId: "grad-path" },
  settlement:  { fill: "#6a4a2a", stroke: "#9a7a4a", gradientId: "grad-settlement" },
  structure:   { fill: "#4a4a5a", stroke: "#6a6a7a", gradientId: "grad-structure" },
  sacred:      { fill: "#4a2a6a", stroke: "#7a4a9a", gradientId: "grad-sacred" },
  dungeon:     { fill: "#2a1a3a", stroke: "#5a3a6a", gradientId: "grad-dungeon" },
  underground: { fill: "#3a3a3a", stroke: "#5a5a5a", gradientId: "grad-underground" },
  danger:      { fill: "#5a1a1a", stroke: "#8a3a3a", gradientId: "grad-danger" },
  unknown:     { fill: "#3a3a4a", stroke: "#5a5a6a", gradientId: "grad-unknown" },
};

function classifyTerrain(terrainType: string): TerrainCategory {
  const t = terrainType.toLowerCase();
  if (t.includes("forest") || t.includes("wood") || t.includes("grove") || t.includes("thicket") || t.includes("tree")) return "forest";
  if (t.includes("grass") || t.includes("meadow") || t.includes("field") || t.includes("plains") || t.includes("clearing") || t.includes("glade") || t.includes("garden") || t.includes("orchard")) return "grass";
  if (t.includes("swamp") || t.includes("marsh") || t.includes("bog")) return "swamp";
  if (t.includes("mountain") || t.includes("peak") || t.includes("cliff") || t.includes("ridge") || t.includes("canyon")) return "mountain";
  if (t.includes("hill") || t.includes("slope") || t.includes("valley")) return "hill";
  if (t.includes("cave") || t.includes("cavern") || t.includes("mine")) return "cave";
  if (t.includes("river") || t.includes("stream") || t.includes("brook") || t.includes("creek") || t.includes("waterfall")) return "water";
  if (t.includes("lake") || t.includes("pond") || t.includes("pool")) return "lake";
  if (t.includes("coast") || t.includes("shore") || t.includes("beach") || t.includes("island") || t.includes("dock") || t.includes("pier") || t.includes("harbor")) return "coast";
  if (t.includes("desert") || t.includes("dune") || t.includes("sand")) return "desert";
  if (t.includes("ice") || t.includes("glacier") || t.includes("snow") || t.includes("tundra")) return "snow";
  if (t.includes("volcano") || t.includes("lava")) return "lava";
  if (t.includes("road") || t.includes("path") || t.includes("trail") || t.includes("track") || t.includes("crossroads") || t.includes("bridge")) return "path";
  if (t.includes("village") || t.includes("town") || t.includes("city") || t.includes("market") || t.includes("square") || t.includes("plaza") || t.includes("street") || t.includes("tavern") || t.includes("inn") || t.includes("shop") || t.includes("camp") || t.includes("house") || t.includes("cabin") || t.includes("cottage") || t.includes("hut") || t.includes("building") || t.includes("stable")) return "settlement";
  if (t.includes("castle") || t.includes("fortress") || t.includes("keep") || t.includes("tower") || t.includes("wall") || t.includes("gate") || t.includes("rampart") || t.includes("battlement") || t.includes("ruin")) return "structure";
  if (t.includes("temple") || t.includes("shrine") || t.includes("altar") || t.includes("sanctuary") || t.includes("chapel") || t.includes("cathedral")) return "sacred";
  if (t.includes("dungeon") || t.includes("crypt") || t.includes("tomb") || t.includes("catacomb") || t.includes("graveyard") || t.includes("cemetery")) return "dungeon";
  if (t.includes("tunnel") || t.includes("corridor") || t.includes("passage") || t.includes("hall") || t.includes("chamber") || t.includes("room") || t.includes("cellar") || t.includes("basement")) return "underground";
  if (t.includes("danger") || t.includes("hostile") || t.includes("battlefield")) return "danger";
  return "unknown";
}

function isFeatureHex(category: TerrainCategory): boolean {
  return ["settlement", "structure", "sacred", "dungeon"].includes(category);
}

function getFeatureIcon(terrainType: string): string | null {
  const t = terrainType.toLowerCase();
  if (t.includes("castle") || t.includes("fortress") || t.includes("keep")) return "🏰";
  if (t.includes("tower")) return "🗼";
  if (t.includes("village") || t.includes("town") || t.includes("city")) return "🏘️";
  if (t.includes("tavern") || t.includes("inn")) return "🍺";
  if (t.includes("shop") || t.includes("market")) return "🛒";
  if (t.includes("temple") || t.includes("shrine") || t.includes("altar") || t.includes("sanctuary")) return "⛩️";
  if (t.includes("chapel") || t.includes("cathedral")) return "⛪";
  if (t.includes("dungeon") || t.includes("crypt") || t.includes("tomb") || t.includes("catacomb")) return "💀";
  if (t.includes("graveyard") || t.includes("cemetery")) return "🪦";
  if (t.includes("ruin")) return "🏚️";
  if (t.includes("camp")) return "⛺";
  if (t.includes("gate")) return "⛩️";
  if (t.includes("library")) return "📚";
  if (t.includes("throne")) return "👑";
  return null;
}

const LEGEND_TERRAIN: Array<{ category: TerrainCategory; label: string }> = [
  { category: "grass", label: "Grassland" },
  { category: "forest", label: "Forest" },
  { category: "hill", label: "Hills" },
  { category: "mountain", label: "Mountains" },
  { category: "water", label: "River" },
  { category: "lake", label: "Lake" },
  { category: "coast", label: "Coast" },
  { category: "swamp", label: "Swamp" },
  { category: "desert", label: "Desert" },
  { category: "snow", label: "Snow/Ice" },
  { category: "cave", label: "Cave" },
  { category: "path", label: "Path/Road" },
  { category: "underground", label: "Underground" },
];

const LEGEND_FEATURES: Array<{ icon: string; label: string }> = [
  { icon: "🏘️", label: "Settlement" },
  { icon: "🏰", label: "Stronghold" },
  { icon: "⛩️", label: "Sacred Site" },
  { icon: "💀", label: "Dungeon" },
  { icon: "⚔️", label: "Hostile" },
  { icon: "👤", label: "NPC" },
];

function HexTile({ 
  hex, 
  isCurrentPosition, 
  isAdjacent,
  onClick,
  onHover,
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
  const category = classifyTerrain(hex.terrainType);
  const style = TERRAIN_STYLES[category];
  const canClick = false;
  
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const px = hexSize * Math.cos(angle);
    const py = hexSize * Math.sin(angle);
    points.push(`${px},${py}`);
  }
  
  let fillColor = style.fill;
  let strokeColor = style.stroke;
  let strokeWidth = 1;
  
  if (isCurrentPosition) {
    fillColor = "#d97706";
    strokeColor = "#fbbf24";
    strokeWidth = 2.5;
  } else if (!hex.isRevealed) {
    fillColor = "#0f172a";
    strokeColor = "#1e293b";
  } else if (!hex.isExplored) {
    fillColor = "#334155";
    strokeColor = "#475569";
  }
  
  const useGradient = hex.isExplored && !isCurrentPosition && hex.isRevealed;
  const featureIcon = hex.isExplored ? getFeatureIcon(hex.terrainType) : null;
  const showFeatureIcon = featureIcon && isFeatureHex(category);
  const hasEntities = hex.hexMeta?.entities && hex.hexMeta.entities.length > 0;
  const hasHostile = hex.hexMeta?.entities?.some(e => e.hostile);
  
  return (
    <g 
      transform={`translate(${x}, ${y})`}
      onClick={canClick ? onClick : undefined}
      onMouseEnter={() => onHover?.(hex)}
      onMouseLeave={() => onHover?.(null)}
      style={{ cursor: canClick ? "pointer" : "default" }}
    >
      <polygon
        points={points.join(" ")}
        fill={useGradient ? `url(#${style.gradientId})` : fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        opacity={hex.isRevealed ? 0.9 : 0.7}
        style={{ transition: "all 0.2s ease" }}
      />
      
      {hex.isRevealed && (
        <g style={{ pointerEvents: "none" }}>
          {isCurrentPosition && (
            <>
              <circle r={hexSize * 0.3} fill="white" opacity={0.9}>
                <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle r={hexSize * 0.45} fill="none" stroke="#fcd34d" strokeWidth={1.5} opacity={0.6}>
                <animate attributeName="r" values={`${hexSize * 0.35};${hexSize * 0.5};${hexSize * 0.35}`} dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite" />
              </circle>
            </>
          )}
          
          {!isCurrentPosition && hex.isExplored && (
            <>
              {showFeatureIcon && (
                <text 
                  textAnchor="middle" 
                  dominantBaseline="middle"
                  style={{ fontSize: compact ? '10px' : '13px' }}
                >
                  {featureIcon}
                </text>
              )}
              {hasEntities && (
                <g transform={`translate(${hexSize * 0.35}, ${-hexSize * 0.3})`}>
                  <circle r={compact ? 4 : 6} fill={hasHostile ? "#991b1b" : "#1e40af"} stroke={hasHostile ? "#ef4444" : "#60a5fa"} strokeWidth={1} />
                  <text 
                    textAnchor="middle" 
                    dominantBaseline="middle"
                    style={{ fontSize: compact ? '6px' : '8px' }}
                  >
                    {hasHostile ? "⚔️" : "👤"}
                  </text>
                </g>
              )}
            </>
          )}
          
          {!isCurrentPosition && !hex.isExplored && hex.isRevealed && hasEntities && (
            <text 
              textAnchor="middle" 
              dominantBaseline="middle"
              style={{ fontSize: compact ? '10px' : '13px' }}
            >
              {hasHostile ? "⚠️" : "❓"}
            </text>
          )}
          
          {!isCurrentPosition && !hex.isExplored && isAdjacent && !hasEntities && (
            <text 
              textAnchor="middle" 
              dominantBaseline="middle" 
              fill="#fbbf24"
              opacity={0.7}
              style={{ fontSize: compact ? "6px" : "10px" }}
            >
              ?
            </text>
          )}
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
  const [hoveredTerrainCategory, setHoveredTerrainCategory] = useState<TerrainCategory | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  
  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const svgRef = useCallback((node: SVGSVGElement | null) => {
    if (node) {
      svgElementRef.current = node;
    }
  }, []);
  const svgElementRef = useRef<SVGSVGElement | null>(null);
  
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev * 1.3, 4));
  }, []);
  
  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev / 1.3, 0.25));
  }, []);
  
  const handleResetView = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  }, [panOffset]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  }, [isPanning, panStart]);
  
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * delta, 0.25), 4));
  }, []);
  
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
  
  const handleHexHover = useCallback((hex: ExplorationHex | null) => {
    setHoveredHex(hex);
    if (hex && hex.isRevealed && hex.terrainType !== "unknown") {
      setHoveredTerrainCategory(classifyTerrain(hex.terrainType));
    } else {
      setHoveredTerrainCategory(null);
    }
  }, []);

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
        <div 
          className={`relative ${compact ? "h-44" : "h-64"} bg-slate-950 rounded-lg overflow-hidden border border-slate-800 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <svg 
            ref={svgRef}
            viewBox={`${bounds.minX} ${bounds.minY} ${viewBoxWidth} ${viewBoxHeight}`}
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
            style={{
              transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
              transformOrigin: 'center center'
            }}
          >
            <defs>
              {Object.entries(TERRAIN_STYLES).map(([key, s]) => (
                <radialGradient key={key} id={s.gradientId} cx="40%" cy="35%" r="70%">
                  <stop offset="0%" stopColor={s.stroke} stopOpacity="0.9" />
                  <stop offset="100%" stopColor={s.fill} stopOpacity="0.85" />
                </radialGradient>
              ))}
            </defs>
            {allHexesWithFog.map((hex) => (
              <HexTile
                key={`${hex.q},${hex.r}`}
                hex={hex}
                isCurrentPosition={hex.q === state?.currentHexQ && hex.r === state?.currentHexR}
                isAdjacent={adjacentCoords.has(`${hex.q},${hex.r}`)}
                onClick={() => handleHexClick(hex)}
                onHover={handleHexHover}
                interactive={interactive && !isMoving && !isPanning}
                hexSize={hexSize}
                compact={compact}
              />
            ))}
          </svg>
          
          {/* Zoom Controls */}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            <Button
              size="icon"
              variant="secondary"
              className="h-7 w-7 bg-slate-800/90 hover:bg-slate-700 border border-slate-600"
              onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-7 w-7 bg-slate-800/90 hover:bg-slate-700 border border-slate-600"
              onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-7 w-7 bg-slate-800/90 hover:bg-slate-700 border border-slate-600"
              onClick={(e) => { e.stopPropagation(); handleResetView(); }}
              title="Reset View"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Zoom indicator */}
          {zoom !== 1 && (
            <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-slate-800/90 rounded text-xs text-slate-300 border border-slate-600">
              {Math.round(zoom * 100)}%
            </div>
          )}
          
          {isMoving && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
            </div>
          )}
        </div>
        
        {/* Map Legend */}
        <div className="mt-2 p-2 bg-slate-800/80 rounded text-xs border border-slate-700">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-slate-400 font-medium">Terrain</span>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-amber-500 border border-amber-400"></div>
              <span className="text-slate-300">You</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-x-3 gap-y-1">
            {LEGEND_TERRAIN.map(({ category, label }) => {
              const s = TERRAIN_STYLES[category];
              const isHighlighted = hoveredTerrainCategory === category;
              return (
                <div 
                  key={category}
                  className={`flex items-center gap-1.5 px-1 py-0.5 rounded transition-all duration-150 ${
                    isHighlighted ? "bg-white/10 ring-1 ring-amber-400/50" : ""
                  }`}
                >
                  <div 
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ 
                      background: `linear-gradient(135deg, ${s.stroke}, ${s.fill})`,
                      border: `1px solid ${s.stroke}`,
                      boxShadow: isHighlighted ? `0 0 4px ${s.stroke}` : "none"
                    }}
                  />
                  <span className={`${isHighlighted ? "text-amber-300 font-medium" : "text-slate-300"} truncate`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="border-t border-slate-700/50 mt-1.5 pt-1.5">
            <span className="text-slate-400 font-medium text-[10px] uppercase tracking-wide">Features</span>
            <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 mt-0.5">
              {LEGEND_FEATURES.map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-1">
                  <span className="text-[10px]">{icon}</span>
                  <span className="text-slate-400">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {hoveredHex && (hoveredHex.isRevealed || adjacentCoords.has(`${hoveredHex.q},${hoveredHex.r}`)) && (
          <div className="mt-2 p-2 bg-slate-800/90 rounded text-sm border border-slate-700">
            <div className="flex items-center gap-2">
              {(() => {
                const cat = classifyTerrain(hoveredHex.terrainType);
                const s = TERRAIN_STYLES[cat];
                return (
                  <div 
                    className="w-5 h-5 rounded flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${s.stroke}, ${s.fill})`, border: `1px solid ${s.stroke}` }}
                  />
                );
              })()}
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
