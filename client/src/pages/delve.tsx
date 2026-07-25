import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAnalytics } from "@/hooks/use-analytics";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sword,
  Shield,
  Skull,
  BookOpen,
  Gem,
  Flame,
  MapPin,
  AlertTriangle,
  Eye,
  Footprints,
  Compass,
  ArrowLeft,
  Heart,
  Clock,
  Star,
  Trophy,
  ChevronRight,
  Dices,
  Hand,
  PuzzleIcon,
  Package,
  Sparkles,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Campaign } from "@shared/schema";

interface DungeonDef {
  id: number;
  name: string;
  description: string;
  themeTags: string[];
  recommendedLevelMin: number;
  recommendedLevelMax: number;
}

interface DungeonNode {
  nodeId: string;
  q: number;
  r: number;
  type: 'entrance' | 'encounter' | 'trap' | 'puzzle' | 'lore' | 'cache' | 'safe' | 'boss' | 'chest';
  name: string;
  description: string;
  adjacentNodes: string[];
  encounterData?: any;
  trapData?: any;
  puzzleData?: any;
  loreText?: string;
  cacheItems?: any[];
  bossData?: any;
  chestRewards?: any[];
}

interface NodeResolution {
  narration: {
    title: string;
    description: string;
    options: Array<{
      id: string;
      label: string;
      resolutionType: 'combat' | 'check' | 'choice' | 'loot' | 'lore';
      dc?: number;
      successText?: string;
      failText?: string;
    }>;
  };
  combatData?: any;
  trapCheck?: { dc: number; type: string };
  puzzleData?: any;
}

interface DungeonRun {
  id: number;
  userId: number;
  campaignId: number;
  characterId: number;
  dungeonId: number;
  currentQ: number;
  currentR: number;
  revealedCoords: Array<{ q: number; r: number }>;
  clearedNodes: string[];
  disarmedTraps: string[];
  solvedPuzzles: string[];
  lightTicks: number;
  supplies: number;
  status: string;
  flags: any;
  startedAt: string;
  endedAt: string | null;
}

interface ActionResult {
  success: boolean;
  narrative: string;
  rewards?: Array<{ name: string; type: string; value?: number }>;
  damage?: number;
  statusEffect?: string;
  nodeCleared: boolean;
  combatTriggered: boolean;
  combatData?: any;
  diceRoll?: number;
}

interface DelveSummary {
  nodesExplored: number;
  totalNodes: number;
  trapsDisarmed: number;
  puzzlesSolved: number;
  bossDefeated: boolean;
  rating: string;
  rewards: any[];
  dungeonName?: string;
  status?: string;
}

interface ChestOption {
  id: string;
  name: string;
  description: string;
  rewards: Array<{ type: string; name: string; value?: number }>;
  consequence?: string;
}

const TAG_COLORS: Record<string, string> = {
  goblin: "bg-green-700/60 text-green-200 border-green-600",
  underdark: "bg-purple-700/60 text-purple-200 border-purple-600",
  starter: "bg-blue-700/60 text-blue-200 border-blue-600",
  undead: "bg-gray-700/60 text-gray-200 border-gray-600",
  dragon: "bg-red-700/60 text-red-200 border-red-600",
  dungeon: "bg-stone-700/60 text-stone-200 border-stone-600",
  forest: "bg-emerald-700/60 text-emerald-200 border-emerald-600",
  cave: "bg-amber-700/60 text-amber-200 border-amber-600",
};

const NODE_STYLES: Record<string, { fill: string; stroke: string; icon: string }> = {
  entrance: { fill: "#065f46", stroke: "#10b981", icon: "🚪" },
  encounter: { fill: "#7f1d1d", stroke: "#ef4444", icon: "⚔" },
  trap: { fill: "#78350f", stroke: "#f59e0b", icon: "⚠" },
  puzzle: { fill: "#4c1d95", stroke: "#8b5cf6", icon: "🧩" },
  lore: { fill: "#1e3a5f", stroke: "#3b82f6", icon: "📖" },
  cache: { fill: "#713f12", stroke: "#eab308", icon: "💎" },
  safe: { fill: "#14532d", stroke: "#22c55e", icon: "🛡" },
  boss: { fill: "#450a0a", stroke: "#dc2626", icon: "💀" },
  chest: { fill: "#713f12", stroke: "#f59e0b", icon: "🏆" },
};

const CLEARED_STYLE = { fill: "#1e293b", stroke: "#475569" };

function axialToPixel(q: number, r: number, size: number) {
  const x = size * Math.sqrt(3) * (q + r / 2);
  const y = size * 1.5 * r;
  return { x, y };
}

function hexPoints(cx: number, cy: number, size: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    return `${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`;
  }).join(' ');
}

function getActionIcon(type: string) {
  switch (type) {
    case 'combat': return <Sword className="h-4 w-4" />;
    case 'check': return <Dices className="h-4 w-4" />;
    case 'choice': return <Hand className="h-4 w-4" />;
    case 'loot': return <Gem className="h-4 w-4" />;
    case 'lore': return <BookOpen className="h-4 w-4" />;
    default: return <ChevronRight className="h-4 w-4" />;
  }
}

function getActionStyle(type: string) {
  switch (type) {
    case 'combat': return "bg-red-900/80 hover:bg-red-800 border-red-600 text-red-100";
    case 'check': return "bg-blue-900/80 hover:bg-blue-800 border-blue-600 text-blue-100";
    case 'choice': return "bg-amber-900/80 hover:bg-amber-800 border-amber-600 text-amber-100";
    case 'loot': return "bg-yellow-900/80 hover:bg-yellow-800 border-yellow-600 text-yellow-100";
    case 'lore': return "bg-purple-900/80 hover:bg-purple-800 border-purple-600 text-purple-100";
    default: return "bg-stone-700 hover:bg-stone-600 border-stone-500 text-stone-100";
  }
}

function getLightColor(ticks: number): string {
  if (ticks > 12) return "text-green-400";
  if (ticks > 5) return "text-yellow-400";
  return "text-red-400";
}

function getLightBg(ticks: number): string {
  if (ticks > 12) return "bg-green-500";
  if (ticks > 5) return "bg-yellow-500";
  return "bg-red-500";
}

function DungeonHexMap({
  revealedNodes,
  allRevealedCoords,
  currentQ,
  currentR,
  clearedNodes,
  onNodeClick,
}: {
  revealedNodes: DungeonNode[];
  allRevealedCoords: Array<{ q: number; r: number }>;
  currentQ: number;
  currentR: number;
  clearedNodes: string[];
  onNodeClick: (node: DungeonNode) => void;
}) {
  const hexSize = 26;
  const padding = 50;

  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const lastTouchDist = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);

  const positions = revealedNodes.map(n => axialToPixel(n.q, n.r, hexSize));
  const allPositions = allRevealedCoords.map(c => axialToPixel(c.q, c.r, hexSize));

  const allXs = [...positions, ...allPositions].map(p => p.x);
  const allYs = [...positions, ...allPositions].map(p => p.y);

  const minX = Math.min(...allXs, 0) - padding;
  const maxX = Math.max(...allXs, 0) + padding;
  const minY = Math.min(...allYs, 0) - padding;
  const maxY = Math.max(...allYs, 0) + padding;

  const svgWidth = maxX - minX;
  const svgHeight = maxY - minY;

  const currentNode = revealedNodes.find(n => n.q === currentQ && n.r === currentR);
  const adjacentIds = currentNode ? new Set(currentNode.adjacentNodes) : new Set<string>();

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.min(4, Math.max(0.5, z * delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const getTouchDist = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      lastTouchDist.current = getTouchDist(e.touches[0], e.touches[1]);
      lastTouchCenter.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    } else if (e.touches.length === 1) {
      setIsPanning(true);
      panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, panX: pan.x, panY: pan.y };
    }
  }, [pan]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDist.current !== null) {
      e.preventDefault();
      const newDist = getTouchDist(e.touches[0], e.touches[1]);
      const scale = newDist / lastTouchDist.current;
      setZoom(z => Math.min(4, Math.max(0.5, z * scale)));
      lastTouchDist.current = newDist;

      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      if (lastTouchCenter.current) {
        setPan(p => ({
          x: p.x + (cx - lastTouchCenter.current!.x),
          y: p.y + (cy - lastTouchCenter.current!.y),
        }));
      }
      lastTouchCenter.current = { x: cx, y: cy };
    } else if (e.touches.length === 1 && isPanning) {
      const dx = e.touches[0].clientX - panStart.current.x;
      const dy = e.touches[0].clientY - panStart.current.y;
      setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
    }
  }, [isPanning]);

  const handleTouchEnd = useCallback(() => {
    lastTouchDist.current = null;
    lastTouchCenter.current = null;
    setIsPanning(false);
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
        <button
          onClick={() => setZoom(z => Math.min(4, z * 1.25))}
          className="w-7 h-7 rounded bg-stone-800/90 border border-stone-600 text-stone-300 hover:bg-stone-700 text-sm font-bold flex items-center justify-center"
        >+</button>
        <button
          onClick={() => setZoom(z => Math.max(0.5, z * 0.8))}
          className="w-7 h-7 rounded bg-stone-800/90 border border-stone-600 text-stone-300 hover:bg-stone-700 text-sm font-bold flex items-center justify-center"
        >−</button>
        <button
          onClick={resetView}
          className="w-7 h-7 rounded bg-stone-800/90 border border-stone-600 text-stone-300 hover:bg-stone-700 text-xs flex items-center justify-center"
          title="Reset view"
        >⊙</button>
      </div>
      <div className="absolute bottom-2 left-2 z-10 text-[10px] text-stone-500 bg-stone-900/80 px-2 py-0.5 rounded">
        {Math.round(zoom * 100)}% — scroll/pinch to zoom, drag to pan
      </div>
      <div
        ref={containerRef}
        className="w-full h-full overflow-hidden"
        style={{ cursor: isPanning ? 'grabbing' : 'grab', touchAction: 'none' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <svg
          viewBox={`${minX} ${minY} ${svgWidth} ${svgHeight}`}
          className="w-full h-full"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isPanning ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          <defs>
            <filter id="glow-current">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-adjacent">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {revealedNodes.flatMap(node =>
            node.adjacentNodes
              .map(adjId => {
                const adjNode = revealedNodes.find(n => n.nodeId === adjId);
                if (!adjNode) return null;
                if (node.nodeId > adjNode.nodeId) return null;
                const from = axialToPixel(node.q, node.r, hexSize);
                const to = axialToPixel(adjNode.q, adjNode.r, hexSize);
                return (
                  <line
                    key={`edge-${node.nodeId}-${adjNode.nodeId}`}
                    x1={from.x} y1={from.y}
                    x2={to.x} y2={to.y}
                    stroke="#475569"
                    strokeWidth="1.5"
                    strokeDasharray="4,4"
                    opacity={0.5}
                  />
                );
              })
              .filter(Boolean)
          )}

          {revealedNodes.map(node => {
            const { x, y } = axialToPixel(node.q, node.r, hexSize);
            const isCurrentPos = node.q === currentQ && node.r === currentR;
            const isCleared = clearedNodes.includes(node.nodeId);
            const isAdjacent = adjacentIds.has(node.nodeId) && !isCurrentPos;
            const style = isCleared ? CLEARED_STYLE : NODE_STYLES[node.type] || NODE_STYLES.entrance;
            const isBoss = node.type === 'boss';
            const nodeHexSize = isBoss ? hexSize * 1.15 : hexSize;
            const canClick = isAdjacent && !isCurrentPos;

            return (
              <g
                key={node.nodeId}
                onClick={(e) => { if (canClick) { e.stopPropagation(); onNodeClick(node); } }}
                style={{ cursor: canClick ? 'pointer' : 'default' }}
              >
                {isCurrentPos && (
                  <polygon
                    points={hexPoints(x, y, nodeHexSize + 5)}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    filter="url(#glow-current)"
                    opacity={0.8}
                  />
                )}
                {isAdjacent && !isCurrentPos && (
                  <polygon
                    points={hexPoints(x, y, nodeHexSize + 3)}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="1"
                    filter="url(#glow-adjacent)"
                    opacity={0.6}
                    strokeDasharray="5,3"
                  />
                )}
                <polygon
                  points={hexPoints(x, y, nodeHexSize)}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth={isCurrentPos ? 2.5 : 1.5}
                  opacity={isCleared ? 0.5 : 1}
                />
                <text
                  x={x}
                  y={y + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={isBoss ? 14 : 11}
                  opacity={isCleared ? 0.4 : 1}
                >
                  {isCleared ? "✓" : (NODE_STYLES[node.type]?.icon || "?")}
                </text>
                <text
                  x={x}
                  y={y + nodeHexSize + 9}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={7}
                  fill={isCleared ? "#64748b" : "#cbd5e1"}
                  fontWeight={isCurrentPos ? "bold" : "normal"}
                >
                  {node.name.length > 14 ? node.name.slice(0, 12) + "…" : node.name}
                </text>
                {isCurrentPos && (
                  <circle cx={x} cy={y - nodeHexSize - 5} r={3} fill="#f59e0b">
                    <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function DelvePage() {
  const { toast } = useToast();
  const { trackPageView, trackFeatureUse } = useAnalytics();
  const [phase, setPhase] = useState<'select' | 'crawl' | 'summary' | 'chest'>('select');

  useEffect(() => {
    trackPageView('delve');
  }, [trackPageView]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  const [activeRunData, setActiveRunData] = useState<{
    run: DungeonRun;
    revealedNodes: DungeonNode[];
    currentNode: DungeonNode | null;
  } | null>(null);
  const [currentNodeResolution, setCurrentNodeResolution] = useState<NodeResolution | null>(null);
  const [lastActionResult, setLastActionResult] = useState<ActionResult | null>(null);
  const [resourceWarnings, setResourceWarnings] = useState<string[]>([]);
  const [summaryData, setSummaryData] = useState<DelveSummary | null>(null);
  const [chestOptions, setChestOptions] = useState<ChestOption[]>([]);
  const [showCombatModal, setShowCombatModal] = useState(false);
  const [combatData, setCombatData] = useState<any>(null);
  const [showRetreatConfirm, setShowRetreatConfirm] = useState(false);
  const [showChestConsequence, setShowChestConsequence] = useState<ChestOption | null>(null);
  const [diceRollDisplay, setDiceRollDisplay] = useState<number | null>(null);

  const { data: campaigns } = useQuery<Campaign[]>({
    queryKey: ['/api/campaigns'],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: characters } = useQuery<any[]>({
    queryKey: ['/api/characters'],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: dungeons, isLoading: dungeonsLoading } = useQuery<DungeonDef[]>({
    queryKey: ['/api/delve/dungeons'],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: activeRunCheck } = useQuery<{ run: DungeonRun | null }>({
    queryKey: ['/api/delve/active', selectedCampaignId],
    queryFn: async () => {
      const res = await fetch(`/api/delve/active/${selectedCampaignId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to check active run');
      return res.json();
    },
    enabled: !!selectedCampaignId,
  });

  useEffect(() => {
    if (activeRunCheck?.run && activeRunCheck.run.status === 'active') {
      loadExistingRun(activeRunCheck.run.id);
    }
  }, [activeRunCheck]);

  const loadExistingRun = useCallback(async (runId: number) => {
    try {
      const res = await apiRequest('GET', `/api/delve/run/${runId}`);
      const data = await res.json();
      setActiveRunData({
        run: data.run,
        revealedNodes: data.revealedNodes || [],
        currentNode: data.currentNode || null,
      });
      if (data.currentNode) {
        const resolution = buildResolutionFromNode(data.currentNode, data.run);
        setCurrentNodeResolution(resolution);
      }
      setPhase('crawl');
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }, [toast]);

  const buildResolutionFromNode = (node: DungeonNode, run: DungeonRun): NodeResolution | null => {
    if ((run.clearedNodes || []).includes(node.nodeId)) return null;
    return null;
  };

  const startMutation = useMutation({
    mutationFn: async (data: { campaignId: number; characterId: number; dungeonId: number }) => {
      const res = await apiRequest('POST', '/api/delve/start', data);
      return res.json();
    },
    onSuccess: (data) => {
      setActiveRunData({
        run: data.run,
        revealedNodes: data.revealedNodes || [],
        currentNode: data.currentNode || null,
      });
      setCurrentNodeResolution(null);
      setLastActionResult(null);
      setPhase('crawl');
      toast({ title: "Delve Begun!", description: "You enter the depths..." });
      queryClient.invalidateQueries({ queryKey: ['/api/delve/active', selectedCampaignId] });
    },
    onError: async (err: any) => {
      const msg = err.message || "Failed to start delve";
      if (msg.includes("active dungeon run already exists")) {
        toast({ title: "Active Run Found", description: "Loading your existing run..." });
        queryClient.invalidateQueries({ queryKey: ['/api/delve/active', selectedCampaignId] });
      } else {
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    },
  });

  const moveMutation = useMutation({
    mutationFn: async (data: { runId: number; toQ: number; toR: number }) => {
      const res = await apiRequest('POST', '/api/delve/move', data);
      return res.json();
    },
    onSuccess: (data) => {
      setActiveRunData(prev => {
        if (!prev) return prev;
        const existingNodeIds = new Set(prev.revealedNodes.map(n => n.nodeId));
        const newNodes = (data.revealedNodes || []).filter((n: DungeonNode) => !existingNodeIds.has(n.nodeId));
        return {
          run: data.run,
          revealedNodes: [...prev.revealedNodes, ...newNodes],
          currentNode: null,
        };
      });
      setCurrentNodeResolution(data.nodeResolution || null);
      setLastActionResult(null);
      setResourceWarnings(data.resourceWarnings || []);
      if (data.resourceWarnings?.length) {
        data.resourceWarnings.forEach((w: string) => {
          toast({ title: "Warning", description: w, variant: "destructive" });
        });
      }
    },
    onError: (err: any) => {
      toast({ title: "Cannot Move", description: err.message, variant: "destructive" });
    },
  });

  const actionMutation = useMutation({
    mutationFn: async (data: { runId: number; nodeId: string; optionId: string; diceRoll?: number }) => {
      const res = await apiRequest('POST', '/api/delve/action', data);
      return res.json();
    },
    onSuccess: (data) => {
      const resolution = data.resolution;
      setLastActionResult({
        success: resolution.success,
        narrative: resolution.narrative,
        rewards: resolution.rewards,
        damage: resolution.damage,
        statusEffect: resolution.statusEffect,
        nodeCleared: resolution.nodeCleared,
        combatTriggered: resolution.combatTriggered,
        combatData: resolution.combatData || data.combatData,
      });
      if (data.run) {
        setActiveRunData(prev => prev ? { ...prev, run: data.run } : prev);
      }
      if (resolution.nodeCleared) {
        setCurrentNodeResolution(null);
      }
      if (resolution.combatTriggered || data.combatTriggered) {
        setCombatData(resolution.combatData || data.combatData);
        setShowCombatModal(true);
      }

      const currentNode = activeRunData?.revealedNodes.find(
        n => n.q === activeRunData.run.currentQ && n.r === activeRunData.run.currentR
      );
      if (currentNode?.type === 'chest' && resolution.nodeCleared) {
        setPhase('chest');
      }
    },
    onError: (err: any) => {
      toast({ title: "Action Failed", description: err.message, variant: "destructive" });
    },
  });

  const restMutation = useMutation({
    mutationFn: async (data: { runId: number }) => {
      const res = await apiRequest('POST', '/api/delve/rest', data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.run) {
        setActiveRunData(prev => prev ? { ...prev, run: data.run } : prev);
      }
      toast({ title: "Rested", description: data.restResult?.narrative || "You feel refreshed." });
    },
    onError: (err: any) => {
      toast({ title: "Cannot Rest", description: err.message, variant: "destructive" });
    },
  });

  const retreatMutation = useMutation({
    mutationFn: async (data: { runId: number }) => {
      const res = await apiRequest('POST', '/api/delve/retreat', data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Retreated", description: data.narrative || "You flee the depths..." });
      if (data.run) {
        endMutation.mutate({ runId: data.run.id });
      }
    },
    onError: (err: any) => {
      toast({ title: "Retreat Failed", description: err.message, variant: "destructive" });
    },
  });

  const endMutation = useMutation({
    mutationFn: async (data: { runId: number }) => {
      const res = await apiRequest('POST', '/api/delve/end', data);
      return res.json();
    },
    onSuccess: (data) => {
      setSummaryData({
        nodesExplored: data.summary?.nodesExplored || 0,
        totalNodes: data.summary?.totalNodes || 0,
        trapsDisarmed: data.summary?.trapsDisarmed || 0,
        puzzlesSolved: data.summary?.puzzlesSolved || 0,
        bossDefeated: data.summary?.bossDefeated || false,
        rating: data.summary?.rating || "novice",
        rewards: data.rewards || [],
        status: data.run?.status,
      });
      setPhase('summary');
      queryClient.invalidateQueries({ queryKey: ['/api/delve/active', selectedCampaignId] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const chestMutation = useMutation({
    mutationFn: async (data: { runId: number; rewardChoiceId: string }) => {
      const res = await apiRequest('POST', '/api/delve/chest', data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Reward Claimed!", description: "Your treasure awaits in your inventory." });
      setShowChestConsequence(null);
      if (activeRunData) {
        endMutation.mutate({ runId: activeRunData.run.id });
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleNodeClick = useCallback((node: DungeonNode) => {
    if (!activeRunData) return;
    moveMutation.mutate({
      runId: activeRunData.run.id,
      toQ: node.q,
      toR: node.r,
    });
  }, [activeRunData, moveMutation]);

  const handleAction = useCallback((optionId: string, resolutionType: string) => {
    if (!activeRunData) return;
    const currentNode = activeRunData.revealedNodes.find(
      n => n.q === activeRunData.run.currentQ && n.r === activeRunData.run.currentR
    );
    if (!currentNode) return;

    if (resolutionType === 'check') {
      const roll = Math.floor(Math.random() * 20) + 1;
      setDiceRollDisplay(roll);
      setTimeout(() => {
        actionMutation.mutate({
          runId: activeRunData.run.id,
          nodeId: currentNode.nodeId,
          optionId,
          diceRoll: roll,
        });
      }, 800);
    } else {
      actionMutation.mutate({
        runId: activeRunData.run.id,
        nodeId: currentNode.nodeId,
        optionId,
      });
    }
  }, [activeRunData, actionMutation]);

  const handleStartDelve = (dungeonId: number) => {
    if (!selectedCampaignId || !selectedCharacterId) {
      toast({ title: "Select Required", description: "Choose a campaign and character first.", variant: "destructive" });
      return;
    }
    startMutation.mutate({ campaignId: selectedCampaignId, characterId: selectedCharacterId, dungeonId });
  };

  const handleRetreat = () => {
    if (!activeRunData) return;
    setShowRetreatConfirm(false);
    retreatMutation.mutate({ runId: activeRunData.run.id });
  };

  const handleClaimChest = (option: ChestOption) => {
    if (option.consequence) {
      setShowChestConsequence(option);
    } else {
      if (activeRunData) {
        chestMutation.mutate({ runId: activeRunData.run.id, rewardChoiceId: option.id });
      }
    }
  };

  const handleConfirmChestClaim = () => {
    if (!activeRunData || !showChestConsequence) return;
    chestMutation.mutate({ runId: activeRunData.run.id, rewardChoiceId: showChestConsequence.id });
  };

  const resetToSelect = () => {
    setPhase('select');
    setActiveRunData(null);
    setCurrentNodeResolution(null);
    setLastActionResult(null);
    setSummaryData(null);
    setChestOptions([]);
    setResourceWarnings([]);
    setCombatData(null);
    setDiceRollDisplay(null);
    queryClient.invalidateQueries({ queryKey: ['/api/delve/active', selectedCampaignId] });
  };

  const currentRunNode = activeRunData?.revealedNodes.find(
    n => n.q === activeRunData.run.currentQ && n.r === activeRunData.run.currentR
  );

  const ratingStars = (rating: string) => {
    const count = rating === 'master' ? 4 : rating === 'veteran' ? 3 : rating === 'adventurer' ? 2 : 1;
    return Array.from({ length: 4 }, (_, i) => (
      <Star key={i} className={`h-5 w-5 ${i < count ? 'text-amber-400 fill-amber-400' : 'text-stone-600'}`} />
    ));
  };

  if (phase === 'select') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950">
        <div className="container mx-auto px-4 py-8">
          <motion.section
            className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-stone-800/80 to-stone-900/80 border border-amber-900/30 p-8 md:p-12 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-red-500/5 rounded-full blur-3xl -ml-12 -mb-12" />
            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-400 px-4 py-2 rounded-full text-sm font-medium mb-4">
                <Compass className="h-4 w-4" />
                Dungeon Crawl
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
                Enter the Depths
              </h1>
              <p className="text-stone-400 text-lg">
                Choose your dungeon and descend into danger. Every step deeper brings greater peril — and greater reward.
              </p>
            </div>
          </motion.section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div>
              <label className="block text-sm font-medium text-stone-400 mb-2">Campaign</label>
              <Select
                value={selectedCampaignId?.toString() || ""}
                onValueChange={v => setSelectedCampaignId(parseInt(v))}
              >
                <SelectTrigger className="bg-stone-800 border-stone-700 text-stone-200">
                  <SelectValue placeholder="Select a campaign" />
                </SelectTrigger>
                <SelectContent className="bg-stone-800 border-stone-700">
                  {campaigns?.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()} className="text-stone-200">
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-400 mb-2">Character</label>
              <Select
                value={selectedCharacterId?.toString() || ""}
                onValueChange={v => setSelectedCharacterId(parseInt(v))}
              >
                <SelectTrigger className="bg-stone-800 border-stone-700 text-stone-200">
                  <SelectValue placeholder="Select a character" />
                </SelectTrigger>
                <SelectContent className="bg-stone-800 border-stone-700">
                  {characters?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id.toString()} className="text-stone-200" disabled={!!c.engagement}>
                      {c.name} — Lv.{c.level || 1} {c.class || ''}
                      {c.engagement ? ` (${c.engagement.label})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {dungeonsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse bg-stone-800/50 border-stone-700">
                  <CardHeader><div className="h-6 bg-stone-700 rounded w-3/4" /></CardHeader>
                  <CardContent><div className="space-y-3"><div className="h-4 bg-stone-700 rounded" /><div className="h-4 bg-stone-700 rounded w-2/3" /></div></CardContent>
                </Card>
              ))}
            </div>
          ) : dungeons && dungeons.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dungeons.map((dungeon, idx) => (
                <motion.div
                  key={dungeon.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <Card className="bg-stone-800/70 border-stone-700/80 hover:border-amber-700/60 transition-all duration-300 overflow-hidden group">
                    <CardHeader className="bg-gradient-to-r from-stone-800 to-stone-900 border-b border-stone-700/50 pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-amber-200 text-lg">{dungeon.name}</CardTitle>
                        <Badge className="bg-stone-700 text-stone-300 text-xs shrink-0">
                          Lv.{dungeon.recommendedLevelMin}–{dungeon.recommendedLevelMax}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <p className="text-stone-400 text-sm line-clamp-3">{dungeon.description}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(dungeon.themeTags || []).map(tag => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className={`text-xs ${TAG_COLORS[tag] || "bg-stone-700/60 text-stone-300 border-stone-600"}`}
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <Button
                        className="w-full bg-gradient-to-r from-amber-700 to-orange-700 hover:from-amber-600 hover:to-orange-600 text-white border-0"
                        onClick={() => handleStartDelve(dungeon.id)}
                        disabled={!selectedCampaignId || !selectedCharacterId || startMutation.isPending}
                      >
                        {startMutation.isPending ? (
                          <><span className="animate-spin mr-2">⟳</span> Entering...</>
                        ) : (
                          <><Footprints className="h-4 w-4 mr-2" /> Enter the Dungeon</>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Compass className="h-12 w-12 text-stone-600 mx-auto mb-4" />
              <p className="text-stone-500">No dungeons available yet.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'crawl' && activeRunData) {
    const run = activeRunData.run;

    return (
      <div className="min-h-screen bg-stone-950">
        <div className="flex flex-col lg:flex-row h-screen">
          <div className="lg:w-[55%] h-[45vh] lg:h-full bg-gradient-to-b from-stone-900 to-stone-950 border-b lg:border-b-0 lg:border-r border-stone-800 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800 bg-stone-900/80">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-amber-400" />
                <span className="text-stone-300 text-sm font-medium">
                  {currentRunNode?.name || "Dungeon Map"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-stone-500">
                  {activeRunData.revealedNodes.length} nodes revealed
                </span>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
              <DungeonHexMap
                revealedNodes={activeRunData.revealedNodes}
                allRevealedCoords={run.revealedCoords || []}
                currentQ={run.currentQ}
                currentR={run.currentR}
                clearedNodes={(run.clearedNodes as string[]) || []}
                onNodeClick={handleNodeClick}
              />
            </div>
          </div>

          <div className="lg:w-[45%] flex flex-col overflow-y-auto bg-stone-950">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-800 bg-stone-900/50">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 ${getLightColor(run.lightTicks)}`}>
                <Flame className="h-4 w-4" />
                <span className="text-sm font-bold">{run.lightTicks}</span>
                <span className="text-xs text-stone-500">light</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 text-sky-400">
                <Package className="h-4 w-4" />
                <span className="text-sm font-bold">{run.supplies}</span>
                <span className="text-xs text-stone-500">supply</span>
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-1">
                <Progress
                  value={(run.lightTicks / 20) * 100}
                  className="w-20 h-2"
                />
              </div>
            </div>

            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              <AnimatePresence mode="wait">
                {currentNodeResolution && !lastActionResult && (
                  <motion.div
                    key="resolution"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <Card className="bg-stone-900/80 border-stone-700">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-amber-200 text-lg flex items-center gap-2">
                          {currentRunNode && NODE_STYLES[currentRunNode.type] && (
                            <span className="text-xl">{NODE_STYLES[currentRunNode.type].icon}</span>
                          )}
                          {currentNodeResolution.narration.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-stone-300 text-sm leading-relaxed">
                          {currentNodeResolution.narration.description}
                        </p>
                        <div className="space-y-2">
                          {currentNodeResolution.narration.options.map(option => (
                            <Button
                              key={option.id}
                              className={`w-full justify-start text-left border ${getActionStyle(option.resolutionType)}`}
                              variant="outline"
                              onClick={() => handleAction(option.id, option.resolutionType)}
                              disabled={actionMutation.isPending}
                            >
                              <span className="mr-2">{getActionIcon(option.resolutionType)}</span>
                              <span className="flex-1">{option.label}</span>
                              {option.dc && (
                                <Badge variant="outline" className="ml-2 text-xs bg-stone-800 border-stone-600">
                                  DC {option.dc}
                                </Badge>
                              )}
                            </Button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {diceRollDisplay !== null && (
                  <motion.div
                    key="dice"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    className="flex justify-center py-4"
                    onAnimationComplete={() => setTimeout(() => setDiceRollDisplay(null), 1200)}
                  >
                    <div className={`w-20 h-20 rounded-xl flex items-center justify-center text-3xl font-bold shadow-xl border-2 ${
                      diceRollDisplay >= 15 ? 'bg-green-900 border-green-500 text-green-300' :
                      diceRollDisplay >= 10 ? 'bg-amber-900 border-amber-500 text-amber-300' :
                      'bg-red-900 border-red-500 text-red-300'
                    }`}>
                      {diceRollDisplay}
                    </div>
                  </motion.div>
                )}

                {lastActionResult && (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className={`border ${lastActionResult.success ? 'bg-green-950/40 border-green-800' : 'bg-red-950/40 border-red-800'}`}>
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center gap-2">
                          {lastActionResult.success ? (
                            <Badge className="bg-green-800 text-green-200">Success</Badge>
                          ) : (
                            <Badge className="bg-red-800 text-red-200">Failed</Badge>
                          )}
                          {lastActionResult.combatTriggered && (
                            <Badge className="bg-red-700 text-red-100">
                              <Sword className="h-3 w-3 mr-1" /> Combat!
                            </Badge>
                          )}
                        </div>
                        <p className="text-stone-300 text-sm leading-relaxed">
                          {lastActionResult.narrative}
                        </p>
                        {lastActionResult.rewards && lastActionResult.rewards.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-amber-400 text-xs font-medium">Rewards:</p>
                            {lastActionResult.rewards.map((r, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs text-stone-400">
                                <Gem className="h-3 w-3 text-amber-400" />
                                <span>{r.name} {r.value ? `(${r.value})` : ''}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {lastActionResult.statusEffect && (
                          <div className="text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {lastActionResult.statusEffect}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {!currentNodeResolution && !lastActionResult && currentRunNode && (
                  <motion.div
                    key="cleared"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <Card className="bg-stone-900/50 border-stone-800">
                      <CardContent className="pt-4 text-center space-y-3">
                        <div className="text-2xl">{NODE_STYLES[currentRunNode.type]?.icon || "📍"}</div>
                        <h3 className="text-stone-300 font-medium">{currentRunNode.name}</h3>
                        <p className="text-stone-500 text-sm">
                          {(run.clearedNodes || []).includes(currentRunNode.nodeId)
                            ? "This area has been cleared. Move to an adjacent node."
                            : currentRunNode.description
                          }
                        </p>
                        <p className="text-stone-600 text-xs">Click an adjacent hex on the map to move.</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="border-t border-stone-800 p-3 bg-stone-900/50 flex items-center gap-2">
              {currentRunNode?.type === 'safe' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-green-700 text-green-400 hover:bg-green-900/50"
                  onClick={() => restMutation.mutate({ runId: run.id })}
                  disabled={restMutation.isPending}
                >
                  <Shield className="h-4 w-4 mr-1" /> Rest
                </Button>
              )}
              <div className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                className="border-red-800 text-red-400 hover:bg-red-900/50"
                onClick={() => setShowRetreatConfirm(true)}
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Retreat
              </Button>
            </div>
          </div>
        </div>

        <Dialog open={showCombatModal} onOpenChange={setShowCombatModal}>
          <DialogContent className="bg-stone-900 border-red-800 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-red-400 flex items-center gap-2">
                <Sword className="h-5 w-5" /> Combat Engaged!
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {combatData?.enemies ? (
                <>
                  <p className="text-stone-400 text-sm">Enemies:</p>
                  {combatData.enemies.map((e: any, i: number) => (
                    <Card key={i} className="bg-stone-800 border-stone-700">
                      <CardContent className="py-3 flex items-center justify-between">
                        <div>
                          <p className="text-red-300 font-medium text-sm">{e.name}</p>
                          <p className="text-stone-500 text-xs">CR {e.cr} • {e.damage}</p>
                        </div>
                        <div className="flex gap-3 text-xs text-stone-400">
                          <span><Heart className="h-3 w-3 inline text-red-400" /> {e.hp}</span>
                          <span><Shield className="h-3 w-3 inline text-blue-400" /> {e.ac}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {combatData.tacticalNote && (
                    <p className="text-stone-500 text-xs italic">{combatData.tacticalNote}</p>
                  )}
                  {combatData.xpReward && (
                    <p className="text-amber-400 text-xs">XP Reward: {combatData.xpReward}</p>
                  )}
                </>
              ) : combatData?.name ? (
                <Card className="bg-red-950/50 border-red-800">
                  <CardContent className="py-3 space-y-2">
                    <p className="text-red-300 font-bold">{combatData.name}</p>
                    <div className="flex gap-3 text-xs text-stone-400">
                      <span><Heart className="h-3 w-3 inline text-red-400" /> {combatData.hp}</span>
                      <span><Shield className="h-3 w-3 inline text-blue-400" /> {combatData.ac}</span>
                      <span>CR {combatData.cr}</span>
                    </div>
                    {combatData.abilities?.map((a: string, i: number) => (
                      <p key={i} className="text-xs text-stone-500">• {a}</p>
                    ))}
                    {combatData.phases?.map((p: any, i: number) => (
                      <div key={i} className="text-xs text-stone-500">
                        <span className="text-red-400">Phase ({p.hpThreshold}% HP):</span> {p.description}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <p className="text-stone-500 text-sm">Combat has been initiated. Resolve it with your party!</p>
              )}
              <p className="text-stone-500 text-xs">
                Phase 1: Combat outcome is resolved automatically. Full combat integration coming soon.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                className="border-stone-700 text-stone-300"
                onClick={() => {
                  setShowCombatModal(false);
                  if (activeRunData && currentRunNode) {
                    const clearedNodes = [...((run.clearedNodes as string[]) || [])];
                    if (!clearedNodes.includes(currentRunNode.nodeId)) {
                      clearedNodes.push(currentRunNode.nodeId);
                    }
                    setActiveRunData(prev => prev ? {
                      ...prev,
                      run: { ...prev.run, clearedNodes }
                    } : prev);
                    setCurrentNodeResolution(null);
                    setLastActionResult(prev => prev ? { ...prev, nodeCleared: true } : prev);
                  }
                }}
              >
                Combat Resolved — Continue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showRetreatConfirm} onOpenChange={setShowRetreatConfirm}>
          <DialogContent className="bg-stone-900 border-stone-700 max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-amber-300">Retreat from the Dungeon?</DialogTitle>
              <DialogDescription className="text-stone-400">
                Retreating ends your run. Some cleared nodes may respawn. You keep what you've found so far, but cannot return to this instance.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" className="border-stone-600" onClick={() => setShowRetreatConfirm(false)}>
                Stay
              </Button>
              <Button
                className="bg-red-800 hover:bg-red-700 text-white"
                onClick={handleRetreat}
                disabled={retreatMutation.isPending}
              >
                {retreatMutation.isPending ? "Retreating..." : "Retreat"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (phase === 'chest' && activeRunData) {
    const chestNode = activeRunData.revealedNodes.find(
      n => n.q === activeRunData.run.currentQ && n.r === activeRunData.run.currentR
    );
    const options: ChestOption[] = chestNode?.chestRewards || [];

    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-950 via-amber-950/10 to-stone-950 flex items-center justify-center p-4">
        <motion.div
          className="max-w-4xl w-full space-y-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🏆</div>
            <h2 className="text-3xl font-bold text-amber-300 mb-2">The Hoard Awaits</h2>
            <p className="text-stone-400">Choose your reward wisely. You may only claim one.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {options.map((option, idx) => (
              <motion.div
                key={option.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.15 }}
              >
                <Card className="bg-stone-900/80 border-2 border-amber-700/50 hover:border-amber-500/80 transition-all duration-300 cursor-pointer group overflow-hidden">
                  <CardHeader className="bg-gradient-to-b from-amber-900/30 to-transparent pb-3">
                    <CardTitle className="text-amber-200 text-base">{option.name}</CardTitle>
                    <CardDescription className="text-stone-400 text-xs">{option.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      {option.rewards.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-stone-300">
                          <Gem className="h-3 w-3 text-amber-400 shrink-0" />
                          <span>{r.name} {r.value ? `(${r.value})` : ''}</span>
                        </div>
                      ))}
                    </div>
                    {option.consequence && (
                      <div className="flex items-start gap-1.5 text-xs text-red-400 bg-red-950/30 rounded p-2 border border-red-900/50">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>{option.consequence}</span>
                      </div>
                    )}
                    <Button
                      className="w-full bg-gradient-to-r from-amber-700 to-yellow-700 hover:from-amber-600 hover:to-yellow-600 text-white border-0"
                      onClick={() => handleClaimChest(option)}
                      disabled={chestMutation.isPending}
                    >
                      <Sparkles className="h-4 w-4 mr-2" /> Claim
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {options.length === 0 && (
            <div className="text-center">
              <p className="text-stone-500 mb-4">No chest options available.</p>
              <Button
                variant="outline"
                className="border-stone-600"
                onClick={() => {
                  if (activeRunData) endMutation.mutate({ runId: activeRunData.run.id });
                }}
              >
                End Run
              </Button>
            </div>
          )}
        </motion.div>

        <Dialog open={!!showChestConsequence} onOpenChange={() => setShowChestConsequence(null)}>
          <DialogContent className="bg-stone-900 border-amber-800 max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-amber-300">Claim with Consequence?</DialogTitle>
              <DialogDescription className="text-stone-400">
                This reward comes with a cost:
              </DialogDescription>
            </DialogHeader>
            <div className="text-sm text-red-400 bg-red-950/30 p-3 rounded border border-red-900/50">
              {showChestConsequence?.consequence}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" className="border-stone-600" onClick={() => setShowChestConsequence(null)}>
                Choose Another
              </Button>
              <Button
                className="bg-amber-700 hover:bg-amber-600 text-white"
                onClick={handleConfirmChestClaim}
                disabled={chestMutation.isPending}
              >
                Claim Anyway
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (phase === 'summary' && summaryData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 flex items-center justify-center p-4">
        <motion.div
          className="max-w-lg w-full"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="bg-stone-900/90 border-stone-700 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-amber-900/30 to-stone-900 text-center pb-4 border-b border-stone-800">
              <div className="text-4xl mb-2">
                {summaryData.bossDefeated ? '🏆' : summaryData.status === 'retreated' ? '🏃' : '📜'}
              </div>
              <CardTitle className="text-2xl text-amber-300">
                {summaryData.bossDefeated ? 'Victory!' :
                 summaryData.status === 'retreated' ? 'Tactical Retreat' :
                 'Dungeon Run Complete'}
              </CardTitle>
              <div className="flex justify-center gap-1 mt-2">
                {ratingStars(summaryData.rating)}
              </div>
              <p className="text-stone-400 text-sm mt-1 capitalize">{summaryData.rating}</p>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-stone-800/60 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-stone-200">{summaryData.nodesExplored}</p>
                  <p className="text-xs text-stone-500">/ {summaryData.totalNodes} Explored</p>
                </div>
                <div className="bg-stone-800/60 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-400">{summaryData.trapsDisarmed}</p>
                  <p className="text-xs text-stone-500">Traps Disarmed</p>
                </div>
                <div className="bg-stone-800/60 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-purple-400">{summaryData.puzzlesSolved}</p>
                  <p className="text-xs text-stone-500">Puzzles Solved</p>
                </div>
                <div className="bg-stone-800/60 rounded-lg p-3 text-center">
                  <p className={`text-2xl font-bold ${summaryData.bossDefeated ? 'text-green-400' : 'text-red-400'}`}>
                    {summaryData.bossDefeated ? 'Yes' : 'No'}
                  </p>
                  <p className="text-xs text-stone-500">Boss Defeated</p>
                </div>
              </div>

              {summaryData.rewards && summaryData.rewards.length > 0 && (
                <div className="space-y-2">
                  <p className="text-amber-400 text-sm font-medium flex items-center gap-1.5">
                    <Trophy className="h-4 w-4" /> Rewards Earned
                  </p>
                  {summaryData.rewards.map((r: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-stone-300 bg-stone-800/40 rounded px-3 py-1.5">
                      <Gem className="h-3 w-3 text-amber-400" />
                      <span>{r.goldValue ? `${r.goldValue} Gold` : ''} {r.xpValue ? `${r.xpValue} XP` : ''}</span>
                    </div>
                  ))}
                </div>
              )}

              <Button
                className="w-full bg-gradient-to-r from-amber-700 to-orange-700 hover:from-amber-600 hover:to-orange-600 text-white"
                onClick={resetToSelect}
              >
                <Compass className="h-4 w-4 mr-2" /> Return to Map
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center">
      <div className="text-center text-stone-500">
        <Compass className="h-12 w-12 mx-auto mb-4 animate-spin" />
        <p>Loading dungeon...</p>
      </div>
    </div>
  );
}