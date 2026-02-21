import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ZoomIn, ZoomOut, Maximize2, ChevronLeft, X, Eye,
  Building2, Store, Shield, BookOpen, Hammer, Heart,
  Scroll, Sword, FlaskConical, Gem, Crown, Lock,
  Sparkles, Users, Star, Landmark, Home, Skull,
  Compass, Coins, Wheat, ArrowDownToLine, ArrowUpFromLine,
  MapPin, Footprints
} from "lucide-react";
import {
  generateCapitalHexMap,
  CAPITAL_TERRAIN_COLORS,
  CAPITAL_TERRAIN_LABELS,
  getCapitalHexNeighbors,
  type CapitalHex,
  type CapitalHexLayout,
  type CapitalBuilding,
  type CapitalTerrainType,
} from "@/lib/capitalHexGenerator";

interface CapitalHexMapProps {
  campaignId: number;
  locationId: number;
  locationName: string;
  onClose: () => void;
}

const HEX_SIZE = 18;
const MIN_ZOOM = 0.8;
const MAX_ZOOM = 4;

const buildingIcons: Record<string, typeof Building2> = {
  tavern: Store, blacksmith: Hammer, magic_shop: Sparkles, general_store: Store,
  temple: Heart, guild: Shield, library: BookOpen, stables: Wheat,
  barracks: Sword, apothecary: FlaskConical, jeweler: Gem, arena: Sword,
  underworld: Eye, cartographer: MapPin, palace: Crown, bank: Landmark,
  real_estate: Home, dark_temple: Skull, information_broker: Compass,
  auction: Coins, academy: BookOpen, dungeon_entrance: Skull, tailor: Star,
};

const buildingColors: Record<string, string> = {
  tavern: "#d97706", blacksmith: "#6b7280", magic_shop: "#7c3aed", general_store: "#059669",
  temple: "#eab308", guild: "#2563eb", library: "#0891b2", stables: "#84cc16",
  barracks: "#dc2626", apothecary: "#10b981", jeweler: "#f59e0b", arena: "#ef4444",
  underworld: "#4b5563", cartographer: "#0ea5e9", palace: "#fbbf24", bank: "#14b8a6",
  real_estate: "#a78bfa", dark_temple: "#6b21a8", information_broker: "#64748b",
  auction: "#f59e0b", academy: "#3b82f6", dungeon_entrance: "#991b1b", tailor: "#f472b6",
};

function hexToPixel(q: number, r: number, size: number): { x: number; y: number } {
  const hexWidth = Math.sqrt(3) * size;
  const hexHeight = 2 * size;
  const x = q * hexWidth + (r % 2 === 1 ? hexWidth / 2 : 0);
  const y = r * hexHeight * 0.75;
  return { x, y };
}

function pixelToHex(px: number, py: number, size: number): { q: number; r: number } {
  const hexWidth = Math.sqrt(3) * size;
  const hexHeight = 2 * size;
  const r = Math.round(py / (hexHeight * 0.75));
  const xOffset = r % 2 === 1 ? hexWidth / 2 : 0;
  const q = Math.round((px - xOffset) / hexWidth);
  return { q, r };
}

function getHexCorners(size: number): Array<{ x: number; y: number }> {
  const corners: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    corners.push({ x: size * Math.cos(angle), y: size * Math.sin(angle) });
  }
  return corners;
}

export default function CapitalHexMap({ campaignId, locationId, locationName, onClose }: CapitalHexMapProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(2.0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredHex, setHoveredHex] = useState<{ q: number; r: number } | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<CapitalBuilding | null>(null);
  const [encounterPopup, setEncounterPopup] = useState<{ type: string; desc: string } | null>(null);

  const seed = campaignId * 1000 + locationId;
  const capitalLayout = useMemo(() => generateCapitalHexMap(seed), [seed]);

  const hexMap = useMemo(() => {
    const map = new Map<string, CapitalHex>();
    for (const hex of capitalLayout.hexes) {
      map.set(`${hex.q},${hex.r}`, hex);
    }
    return map;
  }, [capitalLayout]);

  const buildingMap = useMemo(() => {
    const map = new Map<string, CapitalBuilding>();
    for (const b of capitalLayout.buildings) {
      map.set(`${b.q},${b.r}`, b);
    }
    return map;
  }, [capitalLayout]);

  const { data: exploration } = useQuery<any>({
    queryKey: ['/api/campaigns', campaignId, 'capital', locationId, 'exploration'],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/capital/${locationId}/exploration`, { credentials: 'include' });
      return res.json();
    },
  });

  const enterMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/capital/${locationId}/enter`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'capital', locationId, 'exploration'] });
    },
  });

  const moveMutation = useMutation({
    mutationFn: async (target: { targetQ: number; targetR: number }) => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/capital/${locationId}/move`, target);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'capital', locationId, 'exploration'] });
      if (data.newlyDiscovered?.length > 0) {
        const names = data.discoveredBuildingDetails?.map((b: any) => b.name).join(', ');
        toast({ title: "Location Discovered!", description: names || "You found something new." });
      }
      if (data.questEncounter) {
        setEncounterPopup(data.questEncounter);
      }
    },
  });

  useEffect(() => {
    if (exploration === null) {
      enterMutation.mutate();
    }
  }, [exploration]);

  const revealedSet = useMemo(() => {
    if (!exploration?.revealedHexes) return new Set<string>();
    return new Set((exploration.revealedHexes as Array<{q: number; r: number}>).map(h => `${h.q},${h.r}`));
  }, [exploration?.revealedHexes]);

  const discoveredSet = useMemo(() => {
    if (!exploration?.discoveredBuildings) return new Set<string>();
    return new Set(exploration.discoveredBuildings as string[]);
  }, [exploration?.discoveredBuildings]);

  const playerQ = exploration?.currentQ ?? capitalLayout.spawnQ;
  const playerR = exploration?.currentR ?? capitalLayout.spawnR;

  useEffect(() => {
    if (exploration) {
      const pp = hexToPixel(playerQ, playerR, HEX_SIZE);
      const canvas = canvasRef.current;
      if (canvas) {
        setOffset({
          x: canvas.width / 2 - pp.x * zoom,
          y: canvas.height / 2 - pp.y * zoom,
        });
      }
    }
  }, [exploration?.id]);

  const corners = useMemo(() => getHexCorners(HEX_SIZE), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    const w = rect.width;
    const h = rect.height;

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    for (const hex of capitalLayout.hexes) {
      const key = `${hex.q},${hex.r}`;
      const isRevealed = revealedSet.has(key);
      const pp = hexToPixel(hex.q, hex.r, HEX_SIZE);

      ctx.beginPath();
      ctx.moveTo(pp.x + corners[0].x, pp.y + corners[0].y);
      for (let i = 1; i < 6; i++) {
        ctx.lineTo(pp.x + corners[i].x, pp.y + corners[i].y);
      }
      ctx.closePath();

      if (!isRevealed) {
        ctx.fillStyle = "#111118";
        ctx.fill();
        ctx.strokeStyle = "rgba(50,50,60,0.3)";
        ctx.lineWidth = 0.3;
        ctx.stroke();
        continue;
      }

      const terrainColor = CAPITAL_TERRAIN_COLORS[hex.terrain] || "#3a3530";
      ctx.fillStyle = terrainColor;
      ctx.fill();

      if (hex.districtName) {
        const dist = capitalLayout.districts.find(d => d.id === hex.districtId);
        if (dist) {
          ctx.fillStyle = `${dist.color}15`;
          ctx.fill();
        }
      }

      const isHovered = hoveredHex?.q === hex.q && hoveredHex?.r === hex.r;
      if (isHovered) {
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fill();
      }

      ctx.strokeStyle = hex.isWall ? "rgba(120,100,80,0.7)" : hex.isGate ? "rgba(200,170,100,0.8)" : "rgba(80,70,60,0.4)";
      ctx.lineWidth = hex.isWall ? 1.5 : 0.5;
      ctx.stroke();

      if (hex.buildingId && isRevealed) {
        const isDiscovered = discoveredSet.has(hex.buildingId);
        const bColor = buildingColors[hex.buildingType || ""] || "#9ca3af";
        if (isDiscovered) {
          ctx.fillStyle = `${bColor}55`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(pp.x, pp.y, HEX_SIZE * 0.35, 0, Math.PI * 2);
          ctx.fillStyle = `${bColor}cc`;
          ctx.fill();
          ctx.strokeStyle = bColor;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = "#fff";
          ctx.font = `bold ${HEX_SIZE * 0.35}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const icon = hex.buildingType === "palace" ? "♛" : hex.buildingType === "tavern" ? "🍺" : hex.buildingType === "temple" ? "✝" : hex.buildingType === "bank" ? "$" : hex.buildingType === "guild" ? "⚔" : "■";
          ctx.fillText(icon, pp.x, pp.y);
        } else {
          ctx.beginPath();
          ctx.arc(pp.x, pp.y, HEX_SIZE * 0.25, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(80,80,80,0.6)";
          ctx.fill();
          ctx.strokeStyle = "rgba(100,100,100,0.4)";
          ctx.lineWidth = 0.8;
          ctx.stroke();
          ctx.fillStyle = "rgba(150,150,150,0.5)";
          ctx.font = `${HEX_SIZE * 0.3}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("?", pp.x, pp.y);
        }
      }

      if (hex.isGate && isRevealed) {
        ctx.fillStyle = "rgba(200,170,100,0.7)";
        ctx.font = `bold ${HEX_SIZE * 0.35}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⛩", pp.x, pp.y);
      }
    }

    const playerPx = hexToPixel(playerQ, playerR, HEX_SIZE);
    ctx.beginPath();
    ctx.arc(playerPx.x, playerPx.y, HEX_SIZE * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(34,211,238,0.3)";
    ctx.fill();
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#22d3ee";
    ctx.font = `bold ${HEX_SIZE * 0.55}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⬤", playerPx.x, playerPx.y);

    const neighbors = getCapitalHexNeighbors(playerQ, playerR);
    for (const n of neighbors) {
      const nh = hexMap.get(`${n.q},${n.r}`);
      if (!nh || nh.isWall) continue;
      const np = hexToPixel(n.q, n.r, HEX_SIZE);
      ctx.beginPath();
      ctx.arc(np.x, np.y, HEX_SIZE * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(34,211,238,0.15)";
      ctx.fill();
      ctx.strokeStyle = "rgba(34,211,238,0.3)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    if (zoom >= 1.5) {
      ctx.font = `${Math.max(4, HEX_SIZE * 0.25)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (const hex of capitalLayout.hexes) {
        const key = `${hex.q},${hex.r}`;
        if (!revealedSet.has(key)) continue;
        if (hex.buildingId && discoveredSet.has(hex.buildingId)) {
          const pp = hexToPixel(hex.q, hex.r, HEX_SIZE);
          ctx.fillStyle = "rgba(255,255,255,0.6)";
          ctx.fillText(hex.buildingName || "", pp.x, pp.y + HEX_SIZE * 0.5);
        }
      }
    }

    ctx.restore();
  }, [capitalLayout, zoom, offset, hoveredHex, revealedSet, discoveredSet, playerQ, playerR, corners, hexMap]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const worldX = (mx - offset.x) / zoom;
    const worldY = (my - offset.y) / zoom;
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
    setZoom(newZoom);
    setOffset({ x: mx - worldX * newZoom, y: my - worldY * newZoom });
  }, [zoom, offset]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = (e.clientX - rect.left - offset.x) / zoom;
    const my = (e.clientY - rect.top - offset.y) / zoom;
    const hex = pixelToHex(mx, my, HEX_SIZE);
    setHoveredHex(hex);
  }, [isDragging, dragStart, offset, zoom]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isDragging) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = (e.clientX - rect.left - offset.x) / zoom;
    const my = (e.clientY - rect.top - offset.y) / zoom;
    const clickedHex = pixelToHex(mx, my, HEX_SIZE);
    const key = `${clickedHex.q},${clickedHex.r}`;

    const hexData = hexMap.get(key);
    if (!hexData) return;

    if (hexData.isWall) {
      toast({ title: "City Wall", description: "The massive stone wall blocks your path." });
      return;
    }

    const neighbors = getCapitalHexNeighbors(playerQ, playerR);
    const isNeighbor = neighbors.some(n => n.q === clickedHex.q && n.r === clickedHex.r);

    if (isNeighbor && !moveMutation.isPending) {
      moveMutation.mutate({ targetQ: clickedHex.q, targetR: clickedHex.r });
    } else if (clickedHex.q === playerQ && clickedHex.r === playerR) {
      const building = buildingMap.get(key);
      if (building && discoveredSet.has(building.id)) {
        setSelectedBuilding(building);
      }
    } else if (hexData.buildingId && discoveredSet.has(hexData.buildingId)) {
      const building = capitalLayout.buildings.find(b => b.id === hexData.buildingId);
      if (building) setSelectedBuilding(building);
    }
  }, [isDragging, offset, zoom, playerQ, playerR, hexMap, buildingMap, discoveredSet, moveMutation, capitalLayout, toast]);

  const hoveredHexData = hoveredHex ? hexMap.get(`${hoveredHex.q},${hoveredHex.r}`) : null;
  const isHoveredRevealed = hoveredHex ? revealedSet.has(`${hoveredHex.q},${hoveredHex.r}`) : false;

  const totalBuildings = capitalLayout.buildings.length;
  const discoveredCount = discoveredSet.size;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="max-w-7xl w-full max-h-[92vh] flex gap-3">
        <Card className="flex-1 bg-zinc-950/95 border-purple-500/30 overflow-hidden flex flex-col">
          <CardHeader className="pb-2 flex flex-row items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-400 hover:text-white">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div>
                <CardTitle className="text-purple-200 flex items-center gap-2">
                  <Crown className="w-5 h-5 text-purple-400" />
                  {locationName}
                </CardTitle>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Explore the capital · {discoveredCount}/{totalBuildings} locations discovered
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-purple-300 border-purple-500/30 text-xs">
                <Footprints className="w-3 h-3 mr-1" />
                {discoveredCount}/{totalBuildings}
              </Badge>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.min(MAX_ZOOM, z * 1.2))}><ZoomIn className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.max(MIN_ZOOM, z * 0.83))}><ZoomOut className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                  const pp = hexToPixel(playerQ, playerR, HEX_SIZE);
                  const canvas = canvasRef.current;
                  if (canvas) {
                    const rect = canvas.getBoundingClientRect();
                    setOffset({ x: rect.width / 2 - pp.x * zoom, y: rect.height / 2 - pp.y * zoom });
                  }
                }}><Maximize2 className="h-3.5 w-3.5" /></Button>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-400"><X className="w-4 h-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-2 min-h-0">
            <div className="relative w-full h-full rounded-lg overflow-hidden border border-purple-500/20">
              <canvas
                ref={canvasRef}
                className="w-full h-full cursor-crosshair"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={handleClick}
              />

              {hoveredHexData && isHoveredRevealed && (
                <div className="absolute top-3 left-3 bg-black/80 border border-purple-500/20 rounded-lg px-3 py-2 text-xs pointer-events-none">
                  <p className="text-purple-200 font-medium">
                    {hoveredHexData.buildingName && discoveredSet.has(hoveredHexData.buildingId || "") ? hoveredHexData.buildingName : CAPITAL_TERRAIN_LABELS[hoveredHexData.terrain]}
                  </p>
                  <p className="text-zinc-500">{hoveredHexData.districtName}</p>
                  {hoveredHexData.isGate && <p className="text-amber-400 text-[10px]">{hoveredHexData.gateName}</p>}
                </div>
              )}

              {moveMutation.isPending && (
                <div className="absolute bottom-3 left-3 bg-cyan-900/60 border border-cyan-500/30 rounded-lg px-3 py-1.5 text-xs text-cyan-200">
                  Moving...
                </div>
              )}

              <div className="absolute bottom-3 right-3 bg-black/70 border border-purple-500/20 rounded-lg px-2 py-1 text-[10px] text-zinc-500">
                Zoom: {(zoom * 100).toFixed(0)}% · Click adjacent hex to move
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="w-72 bg-zinc-950/95 border-purple-500/30 overflow-hidden flex flex-col shrink-0">
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="text-sm text-purple-200">
              {selectedBuilding ? selectedBuilding.name : "Explore the Capital"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-3 min-h-0">
            <ScrollArea className="h-full">
              {selectedBuilding ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const Icon = buildingIcons[selectedBuilding.type] || Building2;
                      const color = buildingColors[selectedBuilding.type] || "#9ca3af";
                      return <Icon className="w-5 h-5" style={{ color }} />;
                    })()}
                    <Badge variant="outline" className="text-xs capitalize border-purple-500/30">
                      {selectedBuilding.type.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-300">{selectedBuilding.description}</p>
                  {selectedBuilding.npcHint && (
                    <div className="flex items-start gap-2 p-2 rounded bg-zinc-800/50 border border-zinc-700/50">
                      <Users className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-zinc-400">{selectedBuilding.npcHint} awaits inside</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Services</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedBuilding.services.map(s => (
                        <Badge key={s} variant="secondary" className="text-[10px] capitalize bg-zinc-800 text-zinc-300">
                          {s.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-zinc-800">
                    <p className="text-xs text-zinc-500">District: {selectedBuilding.districtName}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="w-full text-xs text-zinc-500" onClick={() => setSelectedBuilding(null)}>
                    Close Details
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <Footprints className="w-8 h-8 text-purple-500/40 mx-auto mb-2" />
                    <p className="text-sm text-zinc-400">Click adjacent hexes to walk through the capital</p>
                    <p className="text-xs text-zinc-600 mt-1">Discover buildings by walking near them</p>
                  </div>

                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Districts</p>
                    <div className="space-y-1">
                      {capitalLayout.districts.map(d => (
                        <div key={d.id} className="flex items-center gap-2 px-2 py-1 rounded text-xs">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                          <span className="text-zinc-400">{d.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {discoveredCount > 0 && (
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Discovered</p>
                      <div className="space-y-1">
                        {capitalLayout.buildings.filter(b => discoveredSet.has(b.id)).map(b => {
                          const color = buildingColors[b.type] || "#9ca3af";
                          return (
                            <button
                              key={b.id}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left hover:bg-zinc-800/50 transition-colors"
                              onClick={() => setSelectedBuilding(b)}
                            >
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                              <span className="text-zinc-300 truncate">{b.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {encounterPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={() => setEncounterPopup(null)}>
          <Card className="max-w-md bg-zinc-900 border-amber-500/40 shadow-2xl" onClick={e => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-amber-200 flex items-center gap-2 text-base">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Street Encounter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-zinc-300">{encounterPopup.desc}</p>
              <Button className="w-full bg-amber-600 hover:bg-amber-500" onClick={() => setEncounterPopup(null)}>
                Continue Exploring
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
