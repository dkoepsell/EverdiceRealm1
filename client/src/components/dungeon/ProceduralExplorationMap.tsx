import { useState, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CompassRose } from "@/components/wander/WanderHexMap";
import { CATEGORY_LABEL, CATEGORY_WASH, CampaignTerrainInk, classifyTerrain, isBuiltPlace, type TerrainCategory } from "./CampaignTerrainInk";
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


const INK = "#3b2a17";
const PENCIL = "#7d6b52";
const ROUTE = "#9b1c1c";

function hexPoints(s: number) {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${(s * Math.cos(a)).toFixed(2)},${(s * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

/** Short label for a place name on the map. */
function shortName(name: string, max: number) {
  const n = name.replace(/^the\s+/i, "");
  return n.length > max ? `${n.slice(0, max - 1).trimEnd()}…` : n;
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
  
  // Frame the places you know (explored or revealed), not the blank ring of fog around them.
  const bounds = useMemo(() => {
    const known = allHexesWithFog.filter((h) => h.isExplored || h.isRevealed);
    const list = known.length ? known : allHexesWithFog;
    if (list.length === 0) return { minX: -100, maxX: 100, minY: -100, maxY: 100 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const hex of list) {
      const { x, y } = axialToPixel(hex.q, hex.r, hexSize);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const padding = hexSize * 1.25;
    return { minX: minX - padding, maxX: maxX + padding, minY: minY - padding, maxY: maxY + padding };
  }, [allHexesWithFog, hexSize]);
  
  // Route: explored places in the order they were reached, joined where they touch.
  const routeSegments = useMemo(() => {
    const steps = hexes.filter((h) => h.isExplored).sort((a, b) => String(a.exploredAt ?? "").localeCompare(String(b.exploredAt ?? "")) || a.id - b.id);
    const segs: string[] = [];
    let path = "";
    let prev: ExplorationHex | null = null;
    for (const h of steps) {
      const { x, y } = axialToPixel(h.q, h.r, hexSize);
      const d = prev ? Math.max(Math.abs(prev.q - h.q), Math.abs(prev.r - h.r), Math.abs(prev.q + prev.r - h.q - h.r)) : 99;
      if (d === 1) path += ` L${x.toFixed(1)},${y.toFixed(1)}`;
      else {
        if (path.includes("L")) segs.push(path);
        path = `M${x.toFixed(1)},${y.toFixed(1)}`;
      }
      prev = h;
    }
    if (path.includes("L")) segs.push(path);
    return segs;
  }, [hexes, hexSize]);

  const legendCategories = useMemo(() => {
    const seen = new Set<TerrainCategory>();
    for (const h of hexes) if (h.isExplored || h.isRevealed) seen.add(classifyTerrain(h.terrainType));
    seen.delete("unknown");
    return Array.from(seen);
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
  const k = hexSize / 28; // symbol scale: symbols are drawn for a 28px hex
  const cur = state ? { q: state.currentHexQ, r: state.currentHexR } : null;
  const ordered = [...allHexesWithFog].sort((a, b) => a.r - b.r || a.q - b.q);
  const hovered = hoveredHex && (hoveredHex.isRevealed || adjacentCoords.has(`${hoveredHex.q},${hoveredHex.r}`)) ? hoveredHex : null;

  return (
    <Card className="bg-slate-900/80 border-slate-700" data-testid="campaign-exploration-map">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
            <Compass className="h-4 w-4" />
            Exploration Map
          </CardTitle>
          <Badge variant="outline" className="text-xs bg-amber-500/20 border-amber-500/50">
            <Footprints className="h-3 w-3 mr-1" />
            {state?.exploredHexCount || 0} explored
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        <div
          className={`relative ${compact ? "h-56" : "h-72"} rounded-lg overflow-hidden border-[3px] border-[#5a3e22] shadow-[inset_0_0_30px_rgba(60,35,10,0.5)] bg-[#ecdfbd] ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <svg
            ref={svgRef}
            viewBox={`${bounds.minX} ${bounds.minY} ${viewBoxWidth} ${viewBoxHeight}`}
            className="w-full h-full select-none"
            preserveAspectRatio="xMidYMid meet"
            style={{ transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`, transformOrigin: "center center" }}
          >
            <defs>
              <filter id={`cem-paper-${campaignId}`} x="0" y="0" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={3} seed={4} result="n" />
                <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.33  0 0 0 0 0.18  0 0 0 0.16 0" />
              </filter>
              <filter id={`cem-wash-${campaignId}`} x="-10%" y="-10%" width="120%" height="120%">
                <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves={2} seed={2} result="n" />
                <feDisplacementMap in="SourceGraphic" in2="n" scale={3 * k} />
              </filter>
            </defs>
            <rect x={bounds.minX - viewBoxWidth} y={bounds.minY - viewBoxHeight} width={viewBoxWidth * 3} height={viewBoxHeight * 3} fill="#ecdfbd" />
            <rect x={bounds.minX - viewBoxWidth} y={bounds.minY - viewBoxHeight} width={viewBoxWidth * 3} height={viewBoxHeight * 3} filter={`url(#cem-paper-${campaignId})`} />

            {/* washes: explored strong, revealed faint, unknown blank */}
            <g filter={`url(#cem-wash-${campaignId})`}>
              {ordered.map((h) => {
                if (!h.isRevealed && !h.isExplored) return null;
                const { x, y } = axialToPixel(h.q, h.r, hexSize);
                const c = classifyTerrain(h.terrainType);
                return (
                  <polygon key={`w${h.q},${h.r}`} transform={`translate(${x},${y})`} points={hexPoints(hexSize * 0.98)}
                    fill={CATEGORY_WASH[c]} opacity={h.isExplored ? 0.95 : 0.35} />
                );
              })}
            </g>

            {/* grid */}
            <g fill="none" stroke={INK}>
              {ordered.map((h) => {
                const { x, y } = axialToPixel(h.q, h.r, hexSize);
                return <polygon key={`g${h.q},${h.r}`} transform={`translate(${x},${y})`} points={hexPoints(hexSize)} strokeWidth={0.6 * k} opacity={h.isExplored ? 0.5 : h.isRevealed ? 0.3 : 0.14} />;
              })}
            </g>

            {/* terrain symbols: inked where explored, pencilled where only seen */}
            {ordered.map((h) => {
              if (!h.isRevealed && !h.isExplored) return null;
              const c = classifyTerrain(h.terrainType);
              if (c === "unknown" && !h.isExplored) return null;
              const { x, y } = axialToPixel(h.q, h.r, hexSize);
              return (
                <g key={`t${h.q},${h.r}`} transform={`translate(${x},${y}) scale(${k * 1.15})`} opacity={h.isExplored ? 1 : 0.5} style={{ pointerEvents: "none" }}>
                  <CampaignTerrainInk category={c} q={h.q} r={h.r} ink={h.isExplored ? INK : PENCIL} pencil={!h.isExplored} />
                </g>
              );
            })}

            {/* the party's route, in the order places were explored */}
            <g fill="none" stroke={ROUTE} strokeWidth={2.2 * k} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`0.1 ${4.2 * k}`} opacity={0.85} style={{ pointerEvents: "none" }}>
              {routeSegments.map((d, i) => <path key={i} d={d} />)}
            </g>

            {/* NPCs and threats */}
            {ordered.map((h) => {
              const ents = h.hexMeta?.entities ?? [];
              if (!ents.length || (!h.isExplored && !h.isRevealed)) return null;
              if (cur && h.q === cur.q && h.r === cur.r) return null;
              const hostile = ents.some((e) => e.hostile);
              const { x, y } = axialToPixel(h.q, h.r, hexSize);
              return (
                <g key={`e${h.q},${h.r}`} transform={`translate(${x + hexSize * 0.42},${y - hexSize * 0.38}) scale(${k})`} style={{ pointerEvents: "none" }}>
                  <circle r={6.5} fill={hostile ? "#f3d9cf" : "#dbe6f0"} stroke={hostile ? ROUTE : "#2f4f78"} strokeWidth={1} />
                  <text textAnchor="middle" dominantBaseline="central" style={{ fontSize: 7.5 }}>{h.isExplored ? (hostile ? "⚔️" : "👤") : hostile ? "!" : "?"}</text>
                </g>
              );
            })}

            {/* place names */}
            {ordered.map((h) => {
              if (!h.isExplored || !h.locationName) return null;
              const c = classifyTerrain(h.terrainType);
              const isCur = cur && h.q === cur.q && h.r === cur.r;
              // Narrow map: only where you are. Wide map: where you are and every built place.
              if (!isCur && (compact || !isBuiltPlace(c))) return null;
              const { x, y } = axialToPixel(h.q, h.r, hexSize);
              return (
                <text key={`n${h.q},${h.r}`} x={x} y={y + hexSize * 0.82} textAnchor="middle" fontFamily="Cinzel, serif" fontWeight={700}
                  fontSize={compact ? 7.5 * k : 5.6 * k} fill={INK} stroke="#ecdfbd" strokeWidth={2 * k} paintOrder="stroke" style={{ pointerEvents: "none" }}>
                  {shortName(h.locationName, compact ? 20 : 13)}
                </text>
              );
            })}

            {/* hover targets, and the next steps the story can take */}
            {ordered.map((h) => {
              const { x, y } = axialToPixel(h.q, h.r, hexSize);
              const adj = adjacentCoords.has(`${h.q},${h.r}`) && !h.isExplored;
              const on = hoveredHex?.q === h.q && hoveredHex?.r === h.r;
              return (
                <polygon key={`h${h.q},${h.r}`} transform={`translate(${x},${y})`} points={hexPoints(hexSize - 1.5 * k)}
                  fill={on ? "rgba(155,28,28,0.10)" : "rgba(0,0,0,0)"}
                  stroke={adj ? INK : on ? ROUTE : "none"} strokeWidth={(adj ? 0.9 : 1.4) * k} strokeDasharray={adj ? `${3 * k} ${2.5 * k}` : undefined} opacity={0.85}
                  onMouseEnter={() => handleHexHover(h)} onMouseLeave={() => handleHexHover(null)} />
              );
            })}

            {/* the party: a pennant */}
            {cur && (() => {
              const { x, y } = axialToPixel(cur.q, cur.r, hexSize);
              return (
                <g transform={`translate(${x},${y}) scale(${k})`} style={{ pointerEvents: "none" }}>
                  <polygon points={hexPoints(26.5)} fill="none" stroke={ROUTE} strokeWidth={2} />
                  <ellipse cx={0} cy={8} rx={6} ry={2} fill={INK} opacity={0.3} />
                  <line x1={-1} y1={8} x2={-1} y2={-13} stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
                  <path d="M-0.4,-13 L11,-9.5 L-0.4,-5.5 Z" fill={ROUTE} stroke={INK} strokeWidth={0.6}>
                    <animate attributeName="d" dur="2.4s" repeatCount="indefinite" values="M-0.4,-13 L11,-9.5 L-0.4,-5.5 Z;M-0.4,-13 Q5,-10.5 10,-8.5 L-0.4,-5.5 Z;M-0.4,-13 L11,-9.5 L-0.4,-5.5 Z" />
                  </path>
                  <circle cx={-1} cy={-13.5} r={1.2} fill="#d4a017" stroke={INK} strokeWidth={0.4} />
                </g>
              );
            })()}
          </svg>

          <div className="absolute top-2 left-2 pointer-events-none opacity-90 scale-75 origin-top-left"><CompassRose /></div>

          {/* Zoom Controls */}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            {[
              { icon: ZoomIn, fn: handleZoomIn, t: "Zoom in" },
              { icon: ZoomOut, fn: handleZoomOut, t: "Zoom out" },
              { icon: Maximize2, fn: handleResetView, t: "Reset view" },
            ].map(({ icon: Icon, fn, t }) => (
              <Button key={t} size="icon" variant="secondary" title={t}
                className="h-7 w-7 bg-[#f3e9cf]/90 hover:bg-[#f3e9cf] text-[#3b2a17] border border-[#5a3e22]/60"
                onClick={(e) => { e.stopPropagation(); fn(); }} onMouseDown={(e) => e.stopPropagation()}>
                <Icon className="h-4 w-4" />
              </Button>
            ))}
          </div>

          {zoom !== 1 && (
            <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-[#f3e9cf]/90 rounded text-xs text-[#3b2a17] border border-[#5a3e22]/50">
              {Math.round(zoom * 100)}%
            </div>
          )}

          {isMoving && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-amber-700" />
            </div>
          )}
        </div>

        {/* What's under the cursor */}
        {hovered ? (
          <div className="mt-2 rounded-md border border-[#5a3e22]/60 bg-[#f3e9cf] px-3 py-2" data-testid="campaign-map-hover">
            {(() => {
              const c = classifyTerrain(hovered.terrainType);
              return (
                <div className="flex items-center gap-2">
                  <svg viewBox="-16 -14 32 28" className="w-8 h-7 rounded-sm flex-shrink-0" style={{ background: "#ecdfbd" }} aria-hidden>
                    <polygon points={hexPoints(14)} fill={CATEGORY_WASH[c]} />
                    <g transform="scale(0.6)"><CampaignTerrainInk category={c} q={hovered.q} r={hovered.r} /></g>
                  </svg>
                  <div className="min-w-0">
                    <p className="font-[Cinzel,serif] text-xs font-bold text-[#3b2a17] truncate">
                      {hovered.locationName || (hovered.isExplored ? CATEGORY_LABEL[c] : "Unexplored")}
                    </p>
                    {hovered.isExplored && <p className="font-[Alegreya,serif] text-[11px] text-[#4a3722] capitalize">{hovered.terrainType}</p>}
                  </div>
                </div>
              );
            })()}
            {hovered.locationDescription && <p className="font-[Alegreya,serif] text-[12px] leading-snug text-[#4a3722] mt-1 line-clamp-3">{hovered.locationDescription}</p>}
            {hovered.hexMeta?.narrativeTone && (
              <p className="text-[11px] text-[#6b3f8a] mt-1 flex items-center gap-1"><Sparkles className="h-3 w-3" /> {hovered.hexMeta.narrativeTone}</p>
            )}
            {!!hovered.hexMeta?.entities?.length && (
              <div className="text-[11px] mt-1 flex flex-wrap gap-1">
                {hovered.hexMeta.entities.map((e, i) => (
                  <span key={i} className={`px-1.5 py-0.5 rounded border ${e.hostile ? "border-red-800/40 bg-red-100 text-red-900" : "border-blue-800/30 bg-blue-50 text-blue-900"}`}>
                    {e.hostile ? "⚔️" : "👤"} {e.name}
                  </span>
                ))}
              </div>
            )}
            {!hovered.isExplored && adjacentCoords.has(`${hovered.q},${hovered.r}`) && (
              <p className="font-[Alegreya,serif] italic text-[11px] text-[#4a3722] mt-1">Advance the story to explore this area.</p>
            )}
          </div>
        ) : null}

        {/* Legend: only what's on this map */}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 px-1" data-testid="campaign-map-legend">
          {legendCategories.map((c) => (
            <div key={c} className={`flex items-center gap-1.5 text-[11px] rounded px-0.5 ${hoveredTerrainCategory === c ? "ring-1 ring-amber-400/60 text-amber-200" : "text-slate-300"}`}>
              <svg viewBox="-16 -14 32 28" className="w-6 h-5 rounded-sm" style={{ background: "#ecdfbd" }} aria-hidden>
                <polygon points={hexPoints(14)} fill={CATEGORY_WASH[c]} opacity={0.9} />
                <g transform="scale(0.6)"><CampaignTerrainInk category={c} q={3} r={5} /></g>
              </svg>
              <span>{CATEGORY_LABEL[c]}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
            <svg viewBox="0 0 24 10" className="w-6 h-3" aria-hidden><path d="M2,5 L22,5" stroke={ROUTE} strokeWidth={2} strokeDasharray="0.1 4" strokeLinecap="round" /></svg>
            <span>Your route</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-300"><span>👤</span><span>NPC</span><span className="ml-1.5">⚔️</span><span>Hostile</span></div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ProceduralExplorationMap;
