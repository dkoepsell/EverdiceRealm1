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
  TERRAIN_LABELS,
  GRID_DIMENSIONS,
  getHexesInRadius,
  WORLD_SEED,
  type WorldHex,
  type TerrainType,
} from "@shared/world/worldHexGenerator";
import { hexToPixel, pixelToHex } from "@shared/world/hexGeometry";
import { BADGE, INK, ROUTE, drawBadge, drawLabel, drawPennant, inkSprite, paintParchment } from "@/lib/inkSprites";
import type { TerrainCategory } from "@/components/dungeon/CampaignTerrainInk";
import { CompassRose } from "@/components/wander/WanderHexMap";

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

/** Parchment washes for each world terrain (the same family as the Wander and campaign maps). */
const WORLD_WASH: Record<TerrainType, string> = {
  deep_water: "#7fa9bd", shallow_water: "#9cc0cf", beach: "#e8d9a8",
  plains: "#cdd49a", grassland: "#bfcf8e", farmland: "#d6d89a",
  forest: "#93ad72", dense_forest: "#7f9c62", enchanted_forest: "#8aa88a",
  hills: "#d0c08e", foothills: "#d6c896",
  mountain: "#c4ad86", snow_peak: "#eef0ec", volcanic: "#b88a72",
  swamp: "#a3b292", bog: "#98a888", marsh: "#adb99a",
  desert: "#e8cf93", dunes: "#e3c582", oasis: "#b9cf8e",
  tundra: "#dfe3d8", ice: "#e8eef2",
  lava: "#d99a78", ash_wastes: "#b5a89a",
  ruins: "#cdbf9e", settlement: "#dccaa0", city: "#d6c39a",
};

/** Which inked symbol each world terrain gets. */
const WORLD_CATEGORY: Partial<Record<TerrainType, TerrainCategory>> = {
  deep_water: "coast", shallow_water: "coast", beach: "coast",
  plains: "grass", grassland: "grass", farmland: "grass",
  forest: "forest", dense_forest: "forest", enchanted_forest: "forest",
  hills: "hill", foothills: "hill",
  mountain: "mountain", snow_peak: "snow", volcanic: "lava",
  swamp: "swamp", bog: "swamp", marsh: "swamp",
  desert: "desert", dunes: "desert", oasis: "lake",
  tundra: "snow", ice: "snow", lava: "lava", ash_wastes: "lava",
  ruins: "structure", settlement: "settlement", city: "settlement",
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
    return generateWorldHexMap(regionData, locationData, WORLD_SEED);
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

  // Rivers and roads drawn as lines between touching hexes (by distance on screen,
  // which sidesteps the grid's offset-row neighbour rules).
  const waterways = useMemo(() => {
    if (!worldHexMap) return { rivers: [] as Array<[number, number, number, number]>, roads: [] as Array<[number, number, number, number]> };
    // The generator steps rivers and roads with axial neighbours, while this map draws
    // odd-r offset rows, so a step can land up to one hex apart on screen. Join hexes
    // that close, preferring true neighbours, and give each hex at most two links.
    const hexW = Math.sqrt(3) * HEX_SIZE;
    const rivers: Array<[number, number, number, number]> = [];
    const roads: Array<[number, number, number, number]> = [];
    const link = (flag: "isRiver" | "isRoad", out: Array<[number, number, number, number]>) => {
      const degree = new Map<string, number>();
      const seen = new Set<string>();
      const cands: Array<{ d: number; a: WorldHex; b: WorldHex }> = [];
      worldHexMap.forEach((hex) => {
        if (!hex[flag]) return;
        const a = hexToPixel(hex.q, hex.r, HEX_SIZE);
        for (let dq = -1; dq <= 1; dq++) for (let dr = -1; dr <= 1; dr++) {
          if (!dq && !dr) continue;
          const n = worldHexMap.get(`${hex.q + dq},${hex.r + dr}`);
          if (!n || !n[flag]) continue;
          const key = [`${hex.q},${hex.r}`, `${n.q},${n.r}`].sort().join("|");
          if (seen.has(key)) continue;
          seen.add(key);
          const b = hexToPixel(n.q, n.r, HEX_SIZE);
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d <= hexW * 1.8) cands.push({ d, a: hex, b: n });
        }
      });
      cands.sort((x, y) => x.d - y.d);
      for (const { a, b } of cands) {
        const ka = `${a.q},${a.r}`, kb = `${b.q},${b.r}`;
        if ((degree.get(ka) ?? 0) >= 2 || (degree.get(kb) ?? 0) >= 2) continue;
        degree.set(ka, (degree.get(ka) ?? 0) + 1);
        degree.set(kb, (degree.get(kb) ?? 0) + 1);
        const pa = hexToPixel(a.q, a.r, HEX_SIZE), pb = hexToPixel(b.q, b.r, HEX_SIZE);
        out.push([pa.x, pa.y, pb.x, pb.y]);
      }
    };
    link("isRiver", rivers);
    link("isRoad", roads);
    return { rivers, roads };
  }, [worldHexMap]);

  const [spriteTick, setSpriteTick] = useState(0);
  const onSprite = useCallback(() => setSpriteTick((t) => t + 1), []);

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

    paintParchment(ctx, rect.width, rect.height);

    ctx.save();
    ctx.translate(rect.width / 2 + offset.x, rect.height / 2 + offset.y);
    ctx.scale(zoom, zoom);

    const centerX = -(GRID_DIMENSIONS.width / 2) * Math.sqrt(3) * HEX_SIZE;
    const centerY = -(GRID_DIMENSIONS.height / 2) * HEX_SIZE * 1.5;
    ctx.translate(centerX, centerY);

    const corners = getHexCorners(HEX_SIZE);
    const cornerPath = new Path2D();
    cornerPath.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) cornerPath.lineTo(corners[i].x, corners[i].y);
    cornerPath.closePath();

    const viewLeft = (-offset.x - rect.width / 2) / zoom - centerX;
    const viewRight = (-offset.x + rect.width / 2) / zoom - centerX;
    const viewTop = (-offset.y - rect.height / 2) / zoom - centerY;
    const viewBottom = (-offset.y + rect.height / 2) / zoom - centerY;
    const inView = (x: number, y: number, m = HEX_SIZE * 4) => !(x < viewLeft - m || x > viewRight + m || y < viewTop - m || y > viewBottom + m);

    const hexPx = HEX_SIZE * zoom; // on-screen hex radius
    const showGrid = hexPx >= 7;
    const showSymbols = hexPx >= 12;
    const isFog = (hex: WorldHex) => !!(fogEnabled && effectiveRevealed && !effectiveRevealed.has(`${hex.q},${hex.r}`));

    const locationLabels: Array<{ x: number; y: number; name: string; type: string }> = [];
    const regionCenters = new Map<number, { sumX: number; sumY: number; count: number }>();
    const badges: Array<{ x: number; y: number; hex: WorldHex }> = [];

    // 1. watercolour washes (unknown country stays blank parchment)
    worldHexMap.forEach((hex) => {
      const { x, y } = hexToPixel(hex.q, hex.r, HEX_SIZE);
      if (!inView(x, y)) return;
      if (isFog(hex)) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = WORLD_WASH[hex.terrain] ?? WORLD_WASH.plains;
      ctx.fill(cornerPath);
      ctx.restore();
      if (hex.regionId > 0) {
        const e = regionCenters.get(hex.regionId);
        if (e) { e.sumX += x; e.sumY += y; e.count++; } else regionCenters.set(hex.regionId, { sumX: x, sumY: y, count: 1 });
      }
      if (hex.locationName) badges.push({ x, y, hex });
    });

    // 2. ink grid
    if (showGrid) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.35 / Math.max(1, zoom / 2);
      worldHexMap.forEach((hex) => {
        const { x, y } = hexToPixel(hex.q, hex.r, HEX_SIZE);
        if (!inView(x, y)) return;
        ctx.save();
        ctx.translate(x, y);
        ctx.globalAlpha = isFog(hex) ? 0.08 : 0.22;
        ctx.stroke(cornerPath);
        ctx.restore();
      });
    }

    // 3. inked terrain symbols, once you're close enough to read them
    if (showSymbols) {
      worldHexMap.forEach((hex) => {
        if (hex.locationName || isFog(hex)) return;
        const { x, y } = hexToPixel(hex.q, hex.r, HEX_SIZE);
        if (!inView(x, y)) return;
        const cat = WORLD_CATEGORY[hex.terrain];
        if (!cat) return;
        const img = inkSprite(cat, (hex.q * 7 + hex.r * 3) & 3, onSprite);
        if (!img) return;
        const s = HEX_SIZE * 1.9;
        ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
      });
    }

    // 4. rivers and roads
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const visibleSeg = (s: [number, number, number, number]) => inView(s[0], s[1]) || inView(s[2], s[3]);
    ctx.strokeStyle = "#4f86a0";
    ctx.lineWidth = Math.max(1.2, HEX_SIZE * 0.32);
    ctx.beginPath();
    for (const s of waterways.rivers) if (visibleSeg(s)) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); }
    ctx.stroke();
    ctx.strokeStyle = "#a07a4a";
    ctx.lineWidth = Math.max(0.6, HEX_SIZE * 0.14);
    ctx.setLineDash([HEX_SIZE * 0.35, HEX_SIZE * 0.25]);
    ctx.beginPath();
    for (const s of waterways.roads) if (visibleSeg(s)) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); }
    ctx.stroke();
    ctx.setLineDash([]);

    // 5. region names, in faded capitals across their land
    if (zoom > 0.8) {
      regionCenters.forEach((center, regionId) => {
        const region = regions.find((r) => r.id === regionId);
        if (!region) return;
        const size = Math.max(8, Math.min(15, 11 / zoom * 1.4));
        drawLabel(ctx, region.name.toUpperCase(), center.sumX / center.count, center.sumY / center.count - size / 2, size, { italic: true, alpha: 0.55, spacing: size * 0.18 });
      });
    }

    // 6. places: parchment badges, capitals double-ringed
    for (const { x, y, hex } of badges) {
      const isCapital = hex.locationType === "capital";
      if (zoom <= (isCapital ? 0.7 : 1.5)) continue;
      const icon = LOCATION_ICONS[hex.locationType || "landmark"] || "📍";
      drawBadge(ctx, x, y, HEX_SIZE * (isCapital ? 1.25 : 0.85), icon, isCapital);
      locationLabels.push({ x, y, name: hex.locationName!, type: hex.locationType || "landmark" });
    }
    locationLabels.forEach(({ x, y, name, type }) => {
      const isCapital = type === "capital";
      if (zoom <= (isCapital ? 0.7 : 2)) return;
      const size = isCapital ? Math.max(7, Math.min(11, 8 / zoom * 2)) : Math.max(5, Math.min(8, 6 / zoom * 2));
      drawLabel(ctx, name, x, y + HEX_SIZE * (isCapital ? 1.35 : 0.95) + 1, size, { bold: isCapital });
    });

    // 7. hover
    if (hoveredHex) {
      const { x, y } = hexToPixel(hoveredHex.q, hoveredHex.r, HEX_SIZE);
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = "rgba(155,28,28,0.12)";
      ctx.fill(cornerPath);
      ctx.strokeStyle = ROUTE;
      ctx.lineWidth = 1.2 / Math.max(1, zoom / 2);
      ctx.stroke(cornerPath);
      ctx.restore();
    }

    // 8. a trek in progress: the red dotted route
    if (trekPath && trekPath.length > 1) {
      ctx.strokeStyle = ROUTE;
      ctx.lineWidth = Math.max(1.4, HEX_SIZE * 0.28);
      ctx.setLineDash([0.1, HEX_SIZE * 0.6]);
      ctx.beginPath();
      trekPath.forEach((p, i) => {
        const tp = hexToPixel(p.q, p.r, HEX_SIZE);
        if (i === 0) ctx.moveTo(tp.x, tp.y); else ctx.lineTo(tp.x, tp.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      const dest = trekPath[trekPath.length - 1];
      const dp = hexToPixel(dest.q, dest.r, HEX_SIZE);
      ctx.strokeStyle = ROUTE;
      ctx.lineWidth = HEX_SIZE * 0.22;
      const k = HEX_SIZE * 0.5;
      ctx.beginPath();
      ctx.moveTo(dp.x - k, dp.y - k); ctx.lineTo(dp.x + k, dp.y + k);
      ctx.moveTo(dp.x + k, dp.y - k); ctx.lineTo(dp.x - k, dp.y + k);
      ctx.stroke();
      if (typeof trekStep === "number" && trekStep < trekPath.length) {
        const sp = hexToPixel(trekPath[trekStep].q, trekPath[trekStep].r, HEX_SIZE);
        ctx.lineWidth = 1.2;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, HEX_SIZE * 1.05, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 9. other parties' pennants, then yours
    if (partyPositions && partyPositions.length > 0) {
      const partyColors = ["#2f6f8a", "#6b3f8a", "#2f7a4f", "#b0601e", "#a03a6a", "#8a7a1e"];
      const groups = new Map<string, Array<{ party: PartyPosition; idx: number }>>();
      partyPositions.forEach((party, idx) => {
        const key = `${party.hexQ},${party.hexR}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push({ party, idx });
      });
      groups.forEach((group) => {
        group.forEach(({ party, idx }, local) => {
          const pp = hexToPixel(party.hexQ, party.hexR, HEX_SIZE);
          const spread = group.length > 1 ? HEX_SIZE * 0.45 : 0;
          const a = (local * Math.PI * 2) / group.length;
          const mx = pp.x + Math.cos(a) * spread, my = pp.y + Math.sin(a) * spread;
          drawPennant(ctx, mx, my, HEX_SIZE * 1.3, party.isOwner ? ROUTE : partyColors[idx % partyColors.length]);
          if (zoom > 1.2) drawLabel(ctx, party.campaignTitle, mx, my + HEX_SIZE * 0.7, Math.max(4, Math.min(7, 5 / zoom * 2)));
        });
      });
    }
    if (playerPosition) {
      const p = hexToPixel(playerPosition.q, playerPosition.r, HEX_SIZE);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.strokeStyle = ROUTE;
      ctx.lineWidth = 1.6 / Math.max(1, zoom / 2);
      ctx.stroke(cornerPath);
      ctx.restore();
      drawPennant(ctx, p.x, p.y, HEX_SIZE * 1.5);
    }

    ctx.restore();

    drawMinimap(ctx, rect.width, rect.height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldHexMap, zoom, offset, hoveredHex, playerPosition, fogEnabled, effectiveRevealed, regions, trekPath, trekStep, partyPositions, waterways, spriteTick]);

  const drawMinimap = useCallback((ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number) => {
    if (!worldHexMap) return;

    const mmW = compact ? 80 : 120;
    const mmH = compact ? 80 : 120;
    const mmX = canvasW - mmW - 10;
    const mmY = canvasH - mmH - 34;

    ctx.fillStyle = BADGE;
    ctx.fillRect(mmX, mmY, mmW, mmH);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mmX, mmY, mmW, mmH);

    const scale = mmW / GRID_DIMENSIONS.width;
    regions.forEach((region) => {
      const gridX = (region.gridX || 0) - 1;
      const gridY = (region.gridY || 0) - 1;
      const w = (region.width || 1) * 8;
      const h = (region.height || 1) * 8;
      ctx.fillStyle = WORLD_WASH[(region.terrain as TerrainType) || "plains"] ?? WORLD_WASH.plains;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(mmX + gridX * 8 * scale, mmY + gridY * 8 * scale, w * scale, h * scale);
      ctx.globalAlpha = 1;
    });

    const viewCenterX = (-offset.x / zoom) / (GRID_DIMENSIONS.width * Math.sqrt(3) * HEX_SIZE) * mmW + mmW / 2;
    const viewCenterY = (-offset.y / zoom) / (GRID_DIMENSIONS.height * 1.5 * HEX_SIZE) * mmH + mmH / 2;
    const viewW = (canvasW / zoom) / (GRID_DIMENSIONS.width * Math.sqrt(3) * HEX_SIZE) * mmW;
    const viewH = (canvasH / zoom) / (GRID_DIMENSIONS.height * 1.5 * HEX_SIZE) * mmH;
    ctx.strokeStyle = ROUTE;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(mmX + viewCenterX - viewW / 2, mmY + viewCenterY - viewH / 2, viewW, viewH);

    if (playerPosition) {
      const px = mmX + (playerPosition.q / GRID_DIMENSIONS.width) * mmW;
      const py = mmY + (playerPosition.r / GRID_DIMENSIONS.height) * mmH;
      ctx.fillStyle = ROUTE;
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
      <div className="flex items-center justify-center h-64 bg-[#ecdfbd] rounded-xl border-[3px] border-[#5a3e22]">
        <div className="text-[#4a3722] text-sm font-[Alegreya,serif] italic">Unrolling the map...</div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden border-[3px] border-[#5a3e22] bg-[#ecdfbd] shadow-[inset_0_0_40px_rgba(60,35,10,0.5)]" data-testid="world-hex-map">
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
          className="h-7 w-7 bg-[#f3e9cf]/90 border-[#5a3e22]/60 text-[#3b2a17] hover:bg-[#f3e9cf]"
          onClick={() => setZoom(z => Math.min(MAX_ZOOM, z * 1.3))}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-7 w-7 bg-[#f3e9cf]/90 border-[#5a3e22]/60 text-[#3b2a17] hover:bg-[#f3e9cf]"
          onClick={() => setZoom(z => Math.max(MIN_ZOOM, z * 0.7))}
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-7 w-7 bg-[#f3e9cf]/90 border-[#5a3e22]/60 text-[#3b2a17] hover:bg-[#f3e9cf]"
          onClick={centerOnPlayer}
        >
          <Compass className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-7 w-7 bg-[#f3e9cf]/90 border-[#5a3e22]/60 text-[#3b2a17] hover:bg-[#f3e9cf]"
          onClick={() => { setZoom(1.2); setOffset({ x: 0, y: 0 }); }}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className={`h-7 w-7 border-[#5a3e22]/60 text-[#3b2a17] hover:bg-[#f3e9cf] ${
            fogEnabled ? 'bg-[#d9c59a]' : 'bg-[#f3e9cf]/90'
          }`}
          onClick={() => setFogEnabled(f => !f)}
          title={fogEnabled ? "Hide fog of war" : "Show fog of war"}
        >
          {fogEnabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {hoveredHex && (
        <div className="absolute bottom-3 left-3 bg-[#f3e9cf]/95 border border-[#5a3e22]/70 rounded-md shadow-md p-2 text-xs text-[#4a3722] max-w-52 pointer-events-none font-[Alegreya,serif]">
          <div className="font-[Cinzel,serif] font-bold text-[#3b2a17]">
            {hoveredHex.locationName || TERRAIN_LABELS[hoveredHex.terrain] || hoveredHex.terrain}
          </div>
          <div className="text-[#4a3722]/80">
            {hoveredHex.regionName} ({hoveredHex.q}, {hoveredHex.r})
          </div>
          {hoveredHex.locationName && hoveredHex.locationType && (
            <Badge variant="outline" className="text-[10px] mt-1 border-[#5a3e22]/50 text-[#3b2a17]">
              {hoveredHex.locationType}
            </Badge>
          )}
          {hoveredHex.isRiver && (
            <Badge variant="outline" className="text-[10px] mt-1 border-[#2f5f78]/50 text-[#2f5f78] ml-1">
              River
            </Badge>
          )}
          {hoveredHex.isRoad && (
            <Badge variant="outline" className="text-[10px] mt-1 border-[#a07a4a]/60 text-[#7a5a2a] ml-1">
              Road
            </Badge>
          )}
        </div>
      )}

      {selectedHex && (
        <div className="absolute top-3 left-3 bg-[#f3e9cf]/95 border border-[#5a3e22]/70 rounded-md shadow-md p-3 text-sm text-[#4a3722] max-w-72 font-[Alegreya,serif]" data-testid="world-hex-selected">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{selectedHex.locationName ? (LOCATION_ICONS[selectedHex.locationType || "landmark"] || "📍") : "🗺️"}</span>
            <div>
              <div className="font-[Cinzel,serif] font-bold text-[#3b2a17]">{selectedHex.locationName || TERRAIN_LABELS[selectedHex.terrain] || selectedHex.terrain}</div>
              <div className="text-[10px] text-[#4a3722]/70">{selectedHex.regionName} ({selectedHex.q}, {selectedHex.r})</div>
            </div>
          </div>
          {selectedHex.locationType && (
            <Badge variant="outline" className="text-[10px] border-[#5a3e22]/50 text-[#3b2a17] mb-2">
              {selectedHex.locationType}
            </Badge>
          )}
          <div className="flex gap-1.5 mt-2">
            {selectedHex.locationName && selectedHex.locationId && ["city", "town", "village", "capital"].includes(selectedHex.locationType || "") && onEnterLocation && (
              <Button
                size="sm"
                className="h-7 text-xs bg-[#9b1c1c] hover:bg-[#b02424] text-white"
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
                className="h-7 text-xs border-[#5a3e22]/60 text-[#3b2a17] bg-transparent hover:bg-[#e9dbb5]"
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
            className="absolute top-1 right-1 h-5 w-5 p-0 text-[#4a3722]/60 hover:text-[#3b2a17]"
            onClick={() => setSelectedHex(null)}
          >
            ×
          </Button>
        </div>
      )}

      <div className="absolute top-3 right-14 pointer-events-none opacity-90 scale-90 origin-top-right"><CompassRose /></div>
      <div className="absolute bottom-3 right-3 bg-[#f3e9cf]/90 border border-[#5a3e22]/50 rounded px-2 py-0.5 text-[10px] text-[#3b2a17]">
        Zoom: {(zoom * 100).toFixed(0)}%
      </div>
    </div>
  );
}
