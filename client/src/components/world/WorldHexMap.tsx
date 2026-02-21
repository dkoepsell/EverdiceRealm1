import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ZoomIn, ZoomOut, Maximize2, Compass, Eye, EyeOff, Building2, Navigation
} from "lucide-react";
import type { WorldRegion, WorldLocation, UserWorldProgress } from "@shared/schema";
import {
  generateWorldHexMap,
  TERRAIN_COLORS,
  TERRAIN_LABELS,
  GRID_DIMENSIONS,
  getHexesInRadius,
  type WorldHex,
  type TerrainType,
} from "@/lib/worldHexGenerator";

export interface PartyPosition {
  campaignId: number;
  campaignTitle: string;
  hexQ: number;
  hexR: number;
  isOwner: boolean;
}

interface WorldHexMapProps {
  campaignId?: number;
  revealedHexes?: Set<string>;
  playerPosition?: { q: number; r: number };
  onHexClick?: (hex: WorldHex) => void;
  onEnterLocation?: (hex: WorldHex) => void;
  onTrekTo?: (hex: WorldHex) => void;
  trekPath?: Array<{ q: number; r: number }>;
  trekStep?: number;
  partyPositions?: PartyPosition[];
  compact?: boolean;
  showFogByDefault?: boolean;
}

const HEX_SIZE = 8;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;

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
    corners.push({
      x: size * Math.cos(angle),
      y: size * Math.sin(angle),
    });
  }
  return corners;
}

const LOCATION_ICONS: Record<string, string> = {
  city: "🏰",
  town: "🏘️",
  village: "🏠",
  capital: "👑",
  dungeon: "💀",
  ruins: "🏚️",
  shrine: "⛩️",
  landmark: "📍",
  cave: "🕳️",
  tower: "🗼",
};

export default function WorldHexMap({
  campaignId,
  revealedHexes,
  playerPosition,
  onHexClick,
  onEnterLocation,
  onTrekTo,
  trekPath,
  trekStep,
  partyPositions,
  compact = false,
  showFogByDefault = false,
}: WorldHexMapProps) {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1.2);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredHex, setHoveredHex] = useState<WorldHex | null>(null);
  const [selectedHex, setSelectedHex] = useState<WorldHex | null>(null);
  const [fogEnabled, setFogEnabled] = useState(showFogByDefault);
  const animFrameRef = useRef<number>(0);

  const { data: regions = [] } = useQuery<WorldRegion[]>({
    queryKey: ["/api/world/regions"],
  });

  const { data: locations = [] } = useQuery<WorldLocation[]>({
    queryKey: ["/api/world/locations"],
  });

  const { data: myProgress = [] } = useQuery<UserWorldProgress[]>({
    queryKey: ["/api/world/progress"],
    enabled: !!user,
  });

  const worldHexMap = useMemo(() => {
    if (regions.length === 0) return null;
    const regionData = regions.map(r => ({
      id: r.id,
      name: r.name,
      terrain: r.terrain || "plains",
      gridX: r.gridX || 0,
      gridY: r.gridY || 0,
      width: r.width || 1,
      height: r.height || 1,
      color: r.color || "#4a5568",
      dangerLevel: r.dangerLevel || 1,
    }));
    const locationData = locations.map(l => ({
      id: l.id,
      regionId: l.regionId,
      name: l.name,
      locationType: l.locationType || "landmark",
      posX: l.posX || 50,
      posY: l.posY || 50,
    }));
    return generateWorldHexMap(regionData, locationData, 42);
  }, [regions, locations]);

  const effectiveRevealed = useMemo(() => {
    if (!fogEnabled) return null;
    if (revealedHexes && revealedHexes.size > 0) return revealedHexes;

    if (!worldHexMap) return null;
    const revealed = new Set<string>();

    const discoveredRegionIds = new Set(
      myProgress
        .filter(p => p.regionId && (p.hasDiscovered || p.hasVisited))
        .map(p => p.regionId!)
    );

    const visitedLocationIds = new Set(
      myProgress
        .filter(p => p.locationId && (p.hasDiscovered || p.hasVisited))
        .map(p => p.locationId!)
    );

    worldHexMap.forEach((hex, key) => {
      if (discoveredRegionIds.has(hex.regionId)) {
        revealed.add(key);
        return;
      }
      if (hex.locationId && visitedLocationIds.has(hex.locationId)) {
        revealed.add(key);
        getHexesInRadius(hex.q, hex.r, 4).forEach(h => {
          if (h.q >= 0 && h.q < GRID_DIMENSIONS.width && h.r >= 0 && h.r < GRID_DIMENSIONS.height) {
            revealed.add(`${h.q},${h.r}`);
          }
        });
      }
    });

    if (playerPosition) {
      getHexesInRadius(playerPosition.q, playerPosition.r, 5).forEach(h => {
        if (h.q >= 0 && h.q < GRID_DIMENSIONS.width && h.r >= 0 && h.r < GRID_DIMENSIONS.height) {
          revealed.add(`${h.q},${h.r}`);
        }
      });
    }

    if (revealed.size === 0) {
      getHexesInRadius(50, 50, 8).forEach(h => {
        revealed.add(`${h.q},${h.r}`);
      });
    }

    return revealed;
  }, [fogEnabled, revealedHexes, playerPosition, worldHexMap, myProgress]);

  const drawMap = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !worldHexMap) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(rect.width / 2 + offset.x, rect.height / 2 + offset.y);
    ctx.scale(zoom, zoom);

    const centerX = -(GRID_DIMENSIONS.width / 2) * Math.sqrt(3) * HEX_SIZE;
    const centerY = -(GRID_DIMENSIONS.height / 2) * HEX_SIZE * 1.5;
    ctx.translate(centerX, centerY);

    const corners = getHexCorners(HEX_SIZE);
    const cornerPath = new Path2D();
    cornerPath.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) {
      cornerPath.lineTo(corners[i].x, corners[i].y);
    }
    cornerPath.closePath();

    const viewLeft = (-offset.x - rect.width / 2) / zoom - centerX;
    const viewRight = (-offset.x + rect.width / 2) / zoom - centerX;
    const viewTop = (-offset.y - rect.height / 2) / zoom - centerY;
    const viewBottom = (-offset.y + rect.height / 2) / zoom - centerY;

    const margin = HEX_SIZE * 4;
    const regionLabels: Array<{ x: number; y: number; name: string; regionId: number }> = [];
    const locationLabels: Array<{ x: number; y: number; name: string; icon: string; type: string }> = [];

    const regionCenters = new Map<number, { sumX: number; sumY: number; count: number }>();

    worldHexMap.forEach((hex) => {
      const { x, y } = hexToPixel(hex.q, hex.r, HEX_SIZE);

      if (x < viewLeft - margin || x > viewRight + margin || y < viewTop - margin || y > viewBottom + margin) {
        return;
      }

      const isFogged = fogEnabled && effectiveRevealed && !effectiveRevealed.has(`${hex.q},${hex.r}`);

      ctx.save();
      ctx.translate(x, y);

      if (isFogged) {
        ctx.fillStyle = "#0f1520";
        ctx.fill(cornerPath);
        ctx.strokeStyle = "#1a2030";
        ctx.lineWidth = 0.3;
        ctx.stroke(cornerPath);
      } else {
        let color = TERRAIN_COLORS[hex.terrain] || TERRAIN_COLORS.plains;

        if (hex.isRoad && !hex.isRiver && !hex.locationId) {
          const base = TERRAIN_COLORS[hex.terrain] || TERRAIN_COLORS.plains;
          ctx.fillStyle = blendColor(base, "#8a7a5a", 0.4);
        } else {
          ctx.fillStyle = color;
        }
        ctx.fill(cornerPath);

        if (hex.isRiver) {
          ctx.strokeStyle = "#3a7aba";
          ctx.lineWidth = 0.8;
        } else {
          ctx.strokeStyle = "rgba(0,0,0,0.2)";
          ctx.lineWidth = 0.3;
        }
        ctx.stroke(cornerPath);

        if (hex.locationName) {
          const isCapital = hex.locationType === "capital";
          const minZoom = isCapital ? 0.7 : 1.5;
          if (zoom > minZoom) {
            const icon = LOCATION_ICONS[hex.locationType || "landmark"] || "📍";
            const iconScale = isCapital ? 1.4 : 0.8;
            ctx.font = `${Math.max(6, HEX_SIZE * iconScale)}px serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            if (isCapital) {
              ctx.save();
              ctx.fillStyle = "rgba(168, 85, 247, 0.35)";
              ctx.beginPath();
              ctx.arc(0, 0, HEX_SIZE * 1.2, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = "rgba(168, 85, 247, 0.7)";
              ctx.lineWidth = 1;
              ctx.stroke();
              ctx.restore();
            }
            ctx.fillText(icon, 0, 0);
            locationLabels.push({ x, y, name: hex.locationName, icon, type: hex.locationType || "landmark" });
          }
        }

        if (hex.regionId > 0) {
          const entry = regionCenters.get(hex.regionId);
          if (entry) {
            entry.sumX += x;
            entry.sumY += y;
            entry.count++;
          } else {
            regionCenters.set(hex.regionId, { sumX: x, sumY: y, count: 1 });
          }
        }
      }

      if (playerPosition && hex.q === playerPosition.q && hex.r === playerPosition.r) {
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(0, 0, HEX_SIZE * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#000";
        ctx.font = `${HEX_SIZE * 0.6}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⚔", 0, 1);
      }

      if (hoveredHex && hex.q === hoveredHex.q && hex.r === hoveredHex.r) {
        ctx.strokeStyle = "rgba(255,215,0,0.8)";
        ctx.lineWidth = 1.5;
        ctx.stroke(cornerPath);
      }

      ctx.restore();
    });

    if (zoom > 0.8) {
      regionCenters.forEach((center, regionId) => {
        const region = regions.find(r => r.id === regionId);
        if (!region) return;
        const cx = center.sumX / center.count;
        const cy = center.sumY / center.count;

        const fontSize = Math.max(8, Math.min(14, 10 / zoom));
        ctx.font = `bold ${fontSize}px 'Cinzel', 'Georgia', serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(255,240,200,0.5)";
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 2;
        ctx.strokeText(region.name, cx, cy);
        ctx.fillText(region.name, cx, cy);
      });
    }

    locationLabels.forEach(({ x, y, name, type }) => {
      const isCapital = type === "capital";
      const minLabelZoom = isCapital ? 0.7 : 2;
      if (zoom <= minLabelZoom) return;
      const fontSize = isCapital
        ? Math.max(7, Math.min(11, 8 / zoom * 2))
        : Math.max(5, Math.min(8, 6 / zoom * 2));
      ctx.font = `${isCapital ? 'bold ' : ''}${fontSize}px 'Georgia', serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = isCapital ? "rgba(216,180,254,0.95)" : "rgba(255,240,200,0.9)";
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 2;
      ctx.strokeText(name, x, y + HEX_SIZE + 2);
      ctx.fillText(name, x, y + HEX_SIZE + 2);
    });

    if (trekPath && trekPath.length > 1) {
      ctx.strokeStyle = "rgba(255,200,50,0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (let i = 0; i < trekPath.length; i++) {
        const tp = hexToPixel(trekPath[i].q, trekPath[i].r, HEX_SIZE);
        if (i === 0) ctx.moveTo(tp.x, tp.y);
        else ctx.lineTo(tp.x, tp.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      const dest = trekPath[trekPath.length - 1];
      const dp = hexToPixel(dest.q, dest.r, HEX_SIZE);
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(dp.x, dp.y, HEX_SIZE * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `${HEX_SIZE * 0.6}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✕", dp.x, dp.y + 1);

      if (typeof trekStep === "number" && trekStep < trekPath.length) {
        const sp = hexToPixel(trekPath[trekStep].q, trekPath[trekStep].r, HEX_SIZE);
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, HEX_SIZE * 0.9, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (partyPositions && partyPositions.length > 0) {
      const partyColors = ["#22d3ee", "#a78bfa", "#34d399", "#fb923c", "#f472b6", "#facc15"];
      const hexGroups = new Map<string, Array<{ party: PartyPosition; globalIdx: number }>>();
      partyPositions.forEach((party, idx) => {
        const key = `${party.hexQ},${party.hexR}`;
        if (!hexGroups.has(key)) hexGroups.set(key, []);
        hexGroups.get(key)!.push({ party, globalIdx: idx });
      });

      hexGroups.forEach((group) => {
        group.forEach(({ party, globalIdx }, localIdx) => {
          const pp = hexToPixel(party.hexQ, party.hexR, HEX_SIZE);
          const color = partyColors[globalIdx % partyColors.length];
          const markerRadius = HEX_SIZE * 0.65;
          const spread = group.length > 1 ? HEX_SIZE * 0.35 : 0;
          const offsetAngle = (localIdx * Math.PI * 2) / group.length;
          const mx = pp.x + Math.cos(offsetAngle) * spread;
          const my = pp.y + Math.sin(offsetAngle) * spread;

          ctx.save();
          ctx.shadowColor = color;
          ctx.shadowBlur = 6;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(mx, my, markerRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          ctx.fillStyle = "#000";
          ctx.font = `bold ${markerRadius * 1.1}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("⚑", mx, my + 0.5);

          const labelSize = Math.max(4, Math.min(7, 5 / zoom * 2));
          ctx.font = `bold ${labelSize}px 'Georgia', serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = color;
          ctx.strokeStyle = "rgba(0,0,0,0.8)";
          ctx.lineWidth = 2;
          ctx.strokeText(party.campaignTitle, mx, my + markerRadius + 2);
          ctx.fillText(party.campaignTitle, mx, my + markerRadius + 2);
          ctx.restore();
        });
      });
    }

    ctx.restore();

    drawMinimap(ctx, rect.width, rect.height);
  }, [worldHexMap, zoom, offset, hoveredHex, playerPosition, fogEnabled, effectiveRevealed, regions, trekPath, trekStep, partyPositions]);

  const drawMinimap = useCallback((ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number) => {
    if (!worldHexMap) return;

    const mmW = compact ? 80 : 120;
    const mmH = compact ? 80 : 120;
    const mmX = canvasW - mmW - 10;
    const mmY = canvasH - mmH - 10;

    ctx.fillStyle = "rgba(10,14,26,0.85)";
    ctx.strokeStyle = "rgba(255,200,100,0.3)";
    ctx.lineWidth = 1;
    ctx.fillRect(mmX, mmY, mmW, mmH);
    ctx.strokeRect(mmX, mmY, mmW, mmH);

    const scale = mmW / GRID_DIMENSIONS.width;

    regions.forEach(region => {
      const gridX = (region.gridX || 0) - 1;
      const gridY = (region.gridY || 0) - 1;
      const w = (region.width || 1) * 8;
      const h = (region.height || 1) * 8;

      ctx.fillStyle = region.color || "#4a5568";
      ctx.globalAlpha = 0.4;
      ctx.fillRect(
        mmX + gridX * 8 * scale,
        mmY + gridY * 8 * scale,
        w * scale,
        h * scale
      );
      ctx.globalAlpha = 1;
    });

    const viewCenterX = (-offset.x / zoom) / (GRID_DIMENSIONS.width * Math.sqrt(3) * HEX_SIZE) * mmW + mmW / 2;
    const viewCenterY = (-offset.y / zoom) / (GRID_DIMENSIONS.height * 1.5 * HEX_SIZE) * mmH + mmH / 2;

    ctx.strokeStyle = "rgba(255,215,0,0.6)";
    ctx.lineWidth = 1;
    const viewW = (canvasW / zoom) / (GRID_DIMENSIONS.width * Math.sqrt(3) * HEX_SIZE) * mmW;
    const viewH = (canvasH / zoom) / (GRID_DIMENSIONS.height * 1.5 * HEX_SIZE) * mmH;
    ctx.strokeRect(
      mmX + viewCenterX - viewW / 2,
      mmY + viewCenterY - viewH / 2,
      viewW,
      viewH
    );

    if (playerPosition) {
      const px = mmX + (playerPosition.q / GRID_DIMENSIONS.width) * mmW;
      const py = mmY + (playerPosition.r / GRID_DIMENSIONS.height) * mmH;
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [worldHexMap, zoom, offset, playerPosition, regions, compact]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(drawMap);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [drawMap]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }

    if (!worldHexMap || !canvasRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const worldX = (mx - rect.width / 2 - offset.x) / zoom;
    const worldY = (my - rect.height / 2 - offset.y) / zoom;

    const centerX = (GRID_DIMENSIONS.width / 2) * Math.sqrt(3) * HEX_SIZE;
    const centerY = (GRID_DIMENSIONS.height / 2) * 1.5 * HEX_SIZE;
    const adjustedX = worldX + centerX;
    const adjustedY = worldY + centerY;

    const { q, r } = pixelToHex(adjustedX, adjustedY, HEX_SIZE);
    const key = `${q},${r}`;
    const hex = worldHexMap.get(key) || null;
    setHoveredHex(hex);
  }, [isDragging, dragStart, offset, zoom, worldHexMap]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!worldHexMap || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const worldX = (mx - rect.width / 2 - offset.x) / zoom;
    const worldY = (my - rect.height / 2 - offset.y) / zoom;

    const centerX = (GRID_DIMENSIONS.width / 2) * Math.sqrt(3) * HEX_SIZE;
    const centerY = (GRID_DIMENSIONS.height / 2) * 1.5 * HEX_SIZE;
    const { q, r } = pixelToHex(worldX + centerX, worldY + centerY, HEX_SIZE);
    const key = `${q},${r}`;
    const hex = worldHexMap.get(key) || null;
    if (hex) {
      setSelectedHex(hex);
      onHexClick?.(hex);
    }
  }, [worldHexMap, offset, zoom, onHexClick]);

  const centerOnPlayer = useCallback(() => {
    if (!playerPosition) {
      setOffset({ x: 0, y: 0 });
      setZoom(1.2);
      return;
    }
    const { x, y } = hexToPixel(playerPosition.q, playerPosition.r, HEX_SIZE);
    const centerX = (GRID_DIMENSIONS.width / 2) * Math.sqrt(3) * HEX_SIZE;
    const centerY = (GRID_DIMENSIONS.height / 2) * HEX_SIZE * 1.5;
    setOffset({
      x: -(x - centerX) * zoom,
      y: -(y - centerY) * zoom,
    });
    setZoom(3);
  }, [playerPosition, zoom]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - offset.x,
        y: e.touches[0].clientY - offset.y,
      });
    }
  }, [offset]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1) {
      setOffset({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (!worldHexMap || regions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-black/30 rounded-xl border border-amber-500/20">
        <div className="text-amber-100/50 text-sm">Loading realm map...</div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden border-2 border-amber-800/50 bg-[#0a0e1a]">
      <div
        ref={containerRef}
        className={compact ? "h-[300px]" : "h-[500px] md:h-[600px]"}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        <canvas
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="w-full h-full"
        />
      </div>

      <div className="absolute top-3 right-3 flex flex-col gap-1">
        <Button
          size="icon"
          variant="outline"
          className="h-7 w-7 bg-black/60 border-amber-500/30 text-amber-200 hover:bg-amber-500/20"
          onClick={() => setZoom(z => Math.min(MAX_ZOOM, z * 1.3))}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-7 w-7 bg-black/60 border-amber-500/30 text-amber-200 hover:bg-amber-500/20"
          onClick={() => setZoom(z => Math.max(MIN_ZOOM, z * 0.7))}
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-7 w-7 bg-black/60 border-amber-500/30 text-amber-200 hover:bg-amber-500/20"
          onClick={centerOnPlayer}
        >
          <Compass className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-7 w-7 bg-black/60 border-amber-500/30 text-amber-200 hover:bg-amber-500/20"
          onClick={() => { setZoom(1.2); setOffset({ x: 0, y: 0 }); }}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className={`h-7 w-7 border-amber-500/30 text-amber-200 hover:bg-amber-500/20 ${
            fogEnabled ? 'bg-amber-500/30' : 'bg-black/60'
          }`}
          onClick={() => setFogEnabled(f => !f)}
          title={fogEnabled ? "Hide fog of war" : "Show fog of war"}
        >
          {fogEnabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {hoveredHex && (
        <div className="absolute bottom-3 left-3 bg-black/80 border border-amber-500/30 rounded-lg p-2 text-xs text-amber-100 max-w-52 pointer-events-none">
          <div className="font-semibold text-amber-200">
            {hoveredHex.locationName || TERRAIN_LABELS[hoveredHex.terrain] || hoveredHex.terrain}
          </div>
          <div className="text-amber-100/60">
            {hoveredHex.regionName} ({hoveredHex.q}, {hoveredHex.r})
          </div>
          {hoveredHex.locationName && hoveredHex.locationType && (
            <Badge variant="outline" className="text-[10px] mt-1 border-amber-500/30 text-amber-200">
              {hoveredHex.locationType}
            </Badge>
          )}
          {hoveredHex.isRiver && (
            <Badge variant="outline" className="text-[10px] mt-1 border-blue-500/30 text-blue-200 ml-1">
              River
            </Badge>
          )}
          {hoveredHex.isRoad && (
            <Badge variant="outline" className="text-[10px] mt-1 border-yellow-500/30 text-yellow-200 ml-1">
              Road
            </Badge>
          )}
        </div>
      )}

      {selectedHex && (
        <div className="absolute top-3 left-3 bg-black/85 border border-amber-500/40 rounded-lg p-3 text-sm text-amber-100 max-w-72">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{selectedHex.locationName ? (LOCATION_ICONS[selectedHex.locationType || "landmark"] || "📍") : "🗺️"}</span>
            <div>
              <div className="font-semibold text-amber-200">{selectedHex.locationName || TERRAIN_LABELS[selectedHex.terrain] || selectedHex.terrain}</div>
              <div className="text-[10px] text-amber-100/50">{selectedHex.regionName} ({selectedHex.q}, {selectedHex.r})</div>
            </div>
          </div>
          {selectedHex.locationType && (
            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-200 mb-2">
              {selectedHex.locationType}
            </Badge>
          )}
          <div className="flex gap-1.5 mt-2">
            {selectedHex.locationName && selectedHex.locationId && ["city", "town", "village", "capital"].includes(selectedHex.locationType || "") && onEnterLocation && (
              <Button
                size="sm"
                className="h-7 text-xs bg-amber-600 hover:bg-amber-500 text-white"
                onClick={() => onEnterLocation(selectedHex)}
              >
                <Building2 className="w-3 h-3 mr-1" />
                Enter
              </Button>
            )}
            {onTrekTo && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-amber-500/40 text-amber-200 hover:bg-amber-500/20"
                onClick={() => { onTrekTo(selectedHex); setSelectedHex(null); }}
              >
                <Navigation className="w-3 h-3 mr-1" />
                Trek Here
              </Button>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="absolute top-1 right-1 h-5 w-5 p-0 text-amber-100/50 hover:text-amber-100"
            onClick={() => setSelectedHex(null)}
          >
            ×
          </Button>
        </div>
      )}

      <div className="absolute bottom-3 right-3 bg-black/70 border border-amber-500/20 rounded-lg px-2 py-1 text-[10px] text-amber-100/50">
        Zoom: {(zoom * 100).toFixed(0)}%
      </div>
    </div>
  );
}

function blendColor(c1: string, c2: string, t: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16);
  const g1 = parseInt(c1.slice(3, 5), 16);
  const b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16);
  const g2 = parseInt(c2.slice(3, 5), 16);
  const b2 = parseInt(c2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}
