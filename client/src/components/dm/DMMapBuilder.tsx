import { useState, useCallback, useMemo, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { CATEGORY_WASH, CampaignTerrainInk, classifyTerrain } from "@/components/dungeon/CampaignTerrainInk";
import { CompassRose } from "@/components/wander/WanderHexMap";
import {
  Map as MapIcon,
  Paintbrush,
  Sparkles,
  Eraser,
  Save,
  Download,
  Undo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Loader2,
  Wand2
} from "lucide-react";

interface HexTile {
  q: number;
  r: number;
  terrainType: string;
  terrainEmoji: string;
  isExplored?: boolean;
  isRevealed?: boolean;
}

interface TerrainType {
  id: string;
  name: string;
  emoji: string;
  color: string;
  category: string;
}

const TERRAIN_PALETTE: TerrainType[] = [
  { id: "grass", name: "Grass", emoji: "🌾", color: "bg-lime-700", category: "Nature" },
  { id: "forest", name: "Forest", emoji: "🌲", color: "bg-green-800", category: "Nature" },
  { id: "grove", name: "Grove", emoji: "🌳", color: "bg-green-700", category: "Nature" },
  { id: "meadow", name: "Meadow", emoji: "🌻", color: "bg-lime-600", category: "Nature" },
  { id: "clearing", name: "Clearing", emoji: "☀️", color: "bg-yellow-600", category: "Nature" },
  { id: "swamp", name: "Swamp", emoji: "🌿", color: "bg-teal-800", category: "Nature" },
  
  { id: "mountain", name: "Mountain", emoji: "⛰️", color: "bg-stone-600", category: "Terrain" },
  { id: "hill", name: "Hill", emoji: "🏔️", color: "bg-amber-700", category: "Terrain" },
  { id: "cliff", name: "Cliff", emoji: "🪨", color: "bg-stone-500", category: "Terrain" },
  { id: "valley", name: "Valley", emoji: "🏞️", color: "bg-emerald-700", category: "Terrain" },
  { id: "cave", name: "Cave", emoji: "🕳️", color: "bg-stone-800", category: "Terrain" },
  { id: "desert", name: "Desert", emoji: "🏜️", color: "bg-yellow-600", category: "Terrain" },
  { id: "snow", name: "Snow", emoji: "❄️", color: "bg-sky-200", category: "Terrain" },
  
  { id: "river", name: "River", emoji: "🌊", color: "bg-blue-600", category: "Water" },
  { id: "lake", name: "Lake", emoji: "💧", color: "bg-blue-700", category: "Water" },
  { id: "waterfall", name: "Waterfall", emoji: "💦", color: "bg-blue-500", category: "Water" },
  { id: "coast", name: "Coast", emoji: "🏖️", color: "bg-cyan-600", category: "Water" },
  { id: "bridge", name: "Bridge", emoji: "🌉", color: "bg-stone-500", category: "Water" },
  
  { id: "path", name: "Path", emoji: "🛤️", color: "bg-amber-600", category: "Roads" },
  { id: "road", name: "Road", emoji: "🛣️", color: "bg-amber-700", category: "Roads" },
  { id: "crossroads", name: "Crossroads", emoji: "✖️", color: "bg-amber-500", category: "Roads" },
  
  { id: "village", name: "Village", emoji: "🏘️", color: "bg-amber-800", category: "Settlements" },
  { id: "town", name: "Town", emoji: "🏙️", color: "bg-orange-800", category: "Settlements" },
  { id: "tavern", name: "Tavern", emoji: "🍺", color: "bg-amber-700", category: "Settlements" },
  { id: "market", name: "Market", emoji: "🏪", color: "bg-orange-700", category: "Settlements" },
  { id: "house", name: "House", emoji: "🏠", color: "bg-amber-600", category: "Settlements" },
  { id: "camp", name: "Camp", emoji: "🏕️", color: "bg-orange-600", category: "Settlements" },
  
  { id: "castle", name: "Castle", emoji: "🏰", color: "bg-slate-600", category: "Structures" },
  { id: "tower", name: "Tower", emoji: "🗼", color: "bg-slate-500", category: "Structures" },
  { id: "wall", name: "Wall", emoji: "🧱", color: "bg-stone-600", category: "Structures" },
  { id: "gate", name: "Gate", emoji: "⛩️", color: "bg-stone-500", category: "Structures" },
  { id: "ruins", name: "Ruins", emoji: "🏚️", color: "bg-stone-700", category: "Structures" },
  
  { id: "temple", name: "Temple", emoji: "⛪", color: "bg-violet-800", category: "Sacred" },
  { id: "shrine", name: "Shrine", emoji: "🕍", color: "bg-violet-700", category: "Sacred" },
  { id: "altar", name: "Altar", emoji: "✨", color: "bg-purple-700", category: "Sacred" },
  
  { id: "dungeon", name: "Dungeon", emoji: "⚔️", color: "bg-purple-900", category: "Danger" },
  { id: "crypt", name: "Crypt", emoji: "💀", color: "bg-slate-800", category: "Danger" },
  { id: "graveyard", name: "Graveyard", emoji: "⚰️", color: "bg-slate-700", category: "Danger" },
  { id: "battlefield", name: "Battlefield", emoji: "🗡️", color: "bg-red-800", category: "Danger" },
  
  { id: "tunnel", name: "Tunnel", emoji: "🚪", color: "bg-stone-700", category: "Underground" },
  { id: "corridor", name: "Corridor", emoji: "🚶", color: "bg-stone-600", category: "Underground" },
  { id: "chamber", name: "Chamber", emoji: "🔲", color: "bg-stone-500", category: "Underground" },
];

const TERRAIN_CATEGORIES = ["Nature", "Terrain", "Water", "Roads", "Settlements", "Structures", "Sacred", "Danger", "Underground"];

const HEX_SIZE = 28;

function axialToPixel(q: number, r: number): { x: number; y: number } {
  const hexWidth = Math.sqrt(3) * HEX_SIZE;
  const hexHeight = 2 * HEX_SIZE;
  const x = hexWidth * (q + r / 2);
  const y = hexHeight * 0.75 * r;
  return { x, y };
}

function hexPoints(size: number): string {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i - 30;
    const angleRad = (Math.PI / 180) * angleDeg;
    points.push(`${size * Math.cos(angleRad)},${size * Math.sin(angleRad)}`);
  }
  return points.join(" ");
}


interface DMMapBuilderProps {
  campaignId: number;
  onSave?: (hexes: HexTile[]) => void;
}

export function DMMapBuilder({ campaignId, onSave }: DMMapBuilderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [hexes, setHexes] = useState<Map<string, HexTile>>(new Map());
  const [selectedTerrain, setSelectedTerrain] = useState<TerrainType>(TERRAIN_PALETTE[0]);
  const [tool, setTool] = useState<"paint" | "erase">("paint");
  const [isDragging, setIsDragging] = useState(false);
  const [history, setHistory] = useState<Map<string, HexTile>[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  const gridSize = 8;
  
  const gridHexes = useMemo(() => {
    const result: Array<{ q: number; r: number; key: string }> = [];
    for (let r = -gridSize; r <= gridSize; r++) {
      for (let q = -gridSize; q <= gridSize; q++) {
        if (Math.abs(q + r) <= gridSize) {
          result.push({ q, r, key: `${q},${r}` });
        }
      }
    }
    return result;
  }, [gridSize]);
  
  const bounds = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const hex of gridHexes) {
      const { x, y } = axialToPixel(hex.q, hex.r);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const padding = HEX_SIZE * 2;
    return { minX: minX - padding, maxX: maxX + padding, minY: minY - padding, maxY: maxY + padding };
  }, [gridHexes]);
  
  const saveToHistory = useCallback(() => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(new Map(hexes));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [hexes, history, historyIndex]);
  
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setHexes(new Map(history[historyIndex - 1]));
    }
  }, [history, historyIndex]);
  
  const handleHexInteraction = useCallback((q: number, r: number) => {
    const key = `${q},${r}`;
    setHexes(prev => {
      const next = new Map(prev);
      if (tool === "paint") {
        next.set(key, {
          q, r,
          terrainType: selectedTerrain.id,
          terrainEmoji: selectedTerrain.emoji,
          isExplored: true,
          isRevealed: true
        });
      } else {
        next.delete(key);
      }
      return next;
    });
  }, [tool, selectedTerrain]);
  
  const handleMouseDown = useCallback((q: number, r: number, e: React.MouseEvent) => {
    if (e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }
    saveToHistory();
    setIsDragging(true);
    handleHexInteraction(q, r);
  }, [handleHexInteraction, panOffset, saveToHistory]);
  
  const handleMouseEnter = useCallback((q: number, r: number) => {
    if (isDragging) {
      handleHexInteraction(q, r);
    }
  }, [isDragging, handleHexInteraction]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsPanning(false);
  }, []);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  }, [isPanning, panStart]);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * delta, 0.3), 3));
  }, []);
  
  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.3, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.3, 0.3));
  const handleResetView = () => { setZoom(1); setPanOffset({ x: 0, y: 0 }); };
  
  const generateAIMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const response = await apiRequest('POST', `/api/campaigns/${campaignId}/generate-map`, { prompt });
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.hexes) {
        saveToHistory();
        const newHexes = new Map<string, HexTile>();
        data.hexes.forEach((hex: HexTile) => {
          newHexes.set(`${hex.q},${hex.r}`, hex);
        });
        setHexes(newHexes);
        toast({ title: "Map Generated", description: `Created ${data.hexes.length} hexes from your description.` });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    }
  });
  
  const handleAIGenerate = () => {
    if (!aiPrompt.trim()) return;
    generateAIMutation.mutate(aiPrompt);
  };
  
  const handleSave = () => {
    const hexArray = Array.from(hexes.values());
    if (onSave) {
      onSave(hexArray);
    }
    toast({ title: "Map Saved", description: `Saved ${hexArray.length} hexes to campaign.` });
  };
  
  const viewBoxWidth = bounds.maxX - bounds.minX;
  const viewBoxHeight = bounds.maxY - bounds.minY;
  
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapIcon className="h-5 w-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-amber-400">Map Builder</h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {hexes.size} tiles placed
          </Badge>
        </div>
      </div>
      
      <Tabs defaultValue="manual" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-800">
          <TabsTrigger value="manual" className="gap-2">
            <Paintbrush className="h-4 w-4" />
            Manual Build
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Wand2 className="h-4 w-4" />
            AI Generate
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="manual" className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant={tool === "paint" ? "default" : "outline"}
              className={tool === "paint" ? "bg-amber-600 hover:bg-amber-500" : ""}
              onClick={() => setTool("paint")}
            >
              <Paintbrush className="h-4 w-4 mr-1" />
              Paint
            </Button>
            <Button
              size="sm"
              variant={tool === "erase" ? "default" : "outline"}
              className={tool === "erase" ? "bg-red-600 hover:bg-red-500" : ""}
              onClick={() => setTool("erase")}
            >
              <Eraser className="h-4 w-4 mr-1" />
              Erase
            </Button>
            <div className="h-6 w-px bg-slate-600 mx-1" />
            <Button size="sm" variant="outline" onClick={undo} disabled={historyIndex <= 0}>
              <Undo2 className="h-4 w-4 mr-1" />
              Undo
            </Button>
          </div>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm text-slate-300">Terrain Palette</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <ScrollArea className="h-44">
                {TERRAIN_CATEGORIES.map(category => (
                  <div key={category} className="mb-2">
                    <div className="text-xs text-slate-500 mb-1">{category}</div>
                    <div className="flex flex-wrap gap-1">
                      {TERRAIN_PALETTE.filter(t => t.category === category).map(terrain => (
                        <button
                          key={terrain.id}
                          onClick={() => setSelectedTerrain(terrain)}
                          className={`flex flex-col items-center gap-0.5 rounded p-0.5 transition-all ${
                            selectedTerrain.id === terrain.id ? "ring-2 ring-amber-400 bg-amber-500/10" : "hover:bg-slate-700"
                          }`}
                          title={terrain.name}
                          data-testid={`palette-${terrain.id}`}
                        >
                          <svg viewBox="-16 -14 32 28" className="w-9 h-8 rounded-sm" style={{ background: "#ecdfbd" }} aria-hidden>
                            <polygon points={hexPoints(14)} fill={CATEGORY_WASH[classifyTerrain(terrain.name)]} />
                            <g transform="scale(0.6)"><CampaignTerrainInk category={classifyTerrain(terrain.name)} q={terrain.id.length} r={terrain.name.length} /></g>
                          </svg>
                          <span className="text-[10px] text-slate-300 leading-none">{terrain.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
          
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="px-2 py-1 bg-slate-800 rounded">Selected: {selectedTerrain.name}</span>
            <span className="text-slate-500">Click to place, drag to paint, right-click to pan</span>
          </div>
        </TabsContent>
        
        <TabsContent value="ai" className="space-y-3">
          <div className="space-y-2">
            <Label className="text-sm text-slate-300">Describe the area you want to generate</Label>
            <Textarea
              placeholder="e.g., A small forest clearing with a path leading to a mysterious temple in the north. There's a river running through the east side with a stone bridge."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="min-h-[80px] bg-slate-800 border-slate-600"
            />
          </div>
          <Button
            className="w-full gap-2 bg-violet-600 hover:bg-violet-500"
            onClick={handleAIGenerate}
            disabled={generateAIMutation.isPending || !aiPrompt.trim()}
          >
            {generateAIMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Map
              </>
            )}
          </Button>
          <p className="text-xs text-slate-500">
            The AI will create a hex layout based on your description. You can then edit the result manually.
          </p>
        </TabsContent>
      </Tabs>
      
      <Card className="bg-slate-900/80 border-slate-700">
        <CardContent className="p-2">
          <div 
            className={`relative h-[28rem] rounded-lg overflow-hidden border-[3px] border-[#5a3e22] shadow-[inset_0_0_30px_rgba(60,35,10,0.5)] bg-[#ecdfbd] ${isPanning ? 'cursor-grabbing' : ''}`}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onMouseMove={handleMouseMove}
            onWheel={handleWheel}
            onContextMenu={(e) => e.preventDefault()}
          >
            <svg
              viewBox={`${bounds.minX} ${bounds.minY} ${viewBoxWidth} ${viewBoxHeight}`}
              className="w-full h-full"
              preserveAspectRatio="xMidYMid meet"
              style={{
                transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
                transformOrigin: 'center center'
              }}
            >
              <defs>
                <filter id="dmb-paper" x="0" y="0" width="100%" height="100%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={3} seed={4} result="n" />
                  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.33  0 0 0 0 0.18  0 0 0 0.16 0" />
                </filter>
                <filter id="dmb-wash" x="-10%" y="-10%" width="120%" height="120%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves={2} seed={2} result="n" />
                  <feDisplacementMap in="SourceGraphic" in2="n" scale={3} />
                </filter>
              </defs>
              <rect x={bounds.minX - viewBoxWidth} y={bounds.minY - viewBoxHeight} width={viewBoxWidth * 3} height={viewBoxHeight * 3} fill="#ecdfbd" />
              <rect x={bounds.minX - viewBoxWidth} y={bounds.minY - viewBoxHeight} width={viewBoxWidth * 3} height={viewBoxHeight * 3} filter="url(#dmb-paper)" />
              {/* painted washes */}
              <g filter="url(#dmb-wash)" style={{ pointerEvents: "none" }}>
                {gridHexes.map(({ q, r, key }) => {
                  const tile = hexes.get(key);
                  if (!tile) return null;
                  const { x, y } = axialToPixel(q, r);
                  return <polygon key={`w${key}`} transform={`translate(${x}, ${y})`} points={hexPoints(HEX_SIZE * 0.98)} fill={CATEGORY_WASH[classifyTerrain(tile.terrainType)]} opacity={0.95} />;
                })}
              </g>
              {/* grid, symbols, and the paint targets */}
              {gridHexes.map(({ q, r, key }) => {
                const { x, y } = axialToPixel(q, r);
                const tile = hexes.get(key);
                return (
                  <g
                    key={key}
                    transform={`translate(${x}, ${y})`}
                    onMouseDown={(e) => handleMouseDown(q, r, e)}
                    onMouseEnter={() => handleMouseEnter(q, r)}
                    className="cursor-pointer group"
                    data-testid={`builder-hex-${q}-${r}`}
                  >
                    <polygon points={hexPoints(HEX_SIZE)} fill="rgba(0,0,0,0)" stroke="#3b2a17" strokeWidth={tile ? 0.6 : 0.4} opacity={tile ? 0.5 : 0.25}
                      className="group-hover:[fill:rgba(155,28,28,0.10)]" />
                    {tile && (
                      <g className="pointer-events-none" transform="scale(1.1)">
                        <CampaignTerrainInk category={classifyTerrain(tile.terrainType)} q={q} r={r} />
                      </g>
                    )}
                    {!tile && q === 0 && r === 0 && (
                      <text textAnchor="middle" dominantBaseline="middle" className="pointer-events-none" fill="#7d6b52" style={{ fontSize: "10px" }}>⊙</text>
                    )}
                  </g>
                );
              })}
            </svg>
            
            <div className="absolute top-2 left-2 pointer-events-none opacity-90 scale-75 origin-top-left"><CompassRose /></div>
            <div className="absolute top-2 right-2 flex flex-col gap-1">
              <Button size="icon" variant="secondary" className="h-7 w-7 bg-[#f3e9cf]/90 text-[#3b2a17] border border-[#5a3e22]/60" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="secondary" className="h-7 w-7 bg-[#f3e9cf]/90 text-[#3b2a17] border border-[#5a3e22]/60" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="secondary" className="h-7 w-7 bg-[#f3e9cf]/90 text-[#3b2a17] border border-[#5a3e22]/60" onClick={handleResetView}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
            
            {zoom !== 1 && (
              <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-[#f3e9cf]/90 rounded text-xs text-[#3b2a17] border border-[#5a3e22]/50">
                {Math.round(zoom * 100)}%
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <div className="flex gap-2">
        <Button className="flex-1 gap-2 bg-amber-600 hover:bg-amber-500" onClick={handleSave}>
          <Save className="h-4 w-4" />
          Save Map
        </Button>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>
    </div>
  );
}
