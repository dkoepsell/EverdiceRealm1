import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Skull, 
  DoorOpen, 
  Gem, 
  Flame, 
  User, 
  Users, 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Compass,
  Navigation
} from "lucide-react";

export type TileType = 
  | "floor" 
  | "wall" 
  | "door" 
  | "secret_door"
  | "trap" 
  | "treasure" 
  | "stairs_up" 
  | "stairs_down"
  | "water"
  | "lava"
  | "pit"
  | "fog";

export type EntityType = 
  | "player" 
  | "ally" 
  | "enemy" 
  | "npc" 
  | "boss";

export interface MapEntity {
  id: string;
  type: EntityType;
  name: string;
  x: number;
  y: number;
  icon?: string;
  hp?: number;
  maxHp?: number;
}

export interface MapTile {
  type: TileType;
  explored: boolean;
  visible: boolean;
  content?: string;
}

export interface DungeonMapData {
  width: number;
  height: number;
  tiles: MapTile[][];
  entities: MapEntity[];
  playerPosition: { x: number; y: number };
  name?: string;
  level?: number;
}

// High contrast tile colors for better visibility - with dark mode support
const TILE_COLORS: Record<TileType, { bg: string; border: string }> = {
  floor: { bg: "bg-amber-200 dark:bg-amber-700", border: "border-amber-400 dark:border-amber-500" },
  wall: { bg: "bg-stone-700 dark:bg-stone-900", border: "border-stone-500 dark:border-stone-700" },
  door: { bg: "bg-amber-500 dark:bg-amber-600", border: "border-amber-600 dark:border-amber-400" },
  secret_door: { bg: "bg-stone-400 dark:bg-stone-600", border: "border-stone-500 dark:border-stone-500" },
  trap: { bg: "bg-red-400 dark:bg-red-600", border: "border-red-500 dark:border-red-400" },
  treasure: { bg: "bg-yellow-400 dark:bg-yellow-500", border: "border-yellow-500 dark:border-yellow-400" },
  stairs_up: { bg: "bg-cyan-400 dark:bg-cyan-600", border: "border-cyan-500 dark:border-cyan-400" },
  stairs_down: { bg: "bg-purple-400 dark:bg-purple-600", border: "border-purple-500 dark:border-purple-400" },
  water: { bg: "bg-blue-400 dark:bg-blue-600", border: "border-blue-500 dark:border-blue-400" },
  lava: { bg: "bg-orange-500 dark:bg-orange-600", border: "border-orange-600 dark:border-orange-400" },
  pit: { bg: "bg-gray-800 dark:bg-black", border: "border-gray-600 dark:border-gray-800" },
  fog: { bg: "bg-slate-300 dark:bg-slate-600", border: "border-slate-400 dark:border-slate-500" },
};

const ENTITY_COLORS: Record<EntityType, string> = {
  player: "text-green-400",
  ally: "text-blue-400",
  enemy: "text-red-400",
  npc: "text-yellow-400",
  boss: "text-purple-400",
};

interface DungeonMapProps {
  mapData: DungeonMapData;
  onTileClick?: (x: number, y: number) => void;
  onEntityClick?: (entity: MapEntity) => void;
  onPlayerMove?: (direction: "up" | "down" | "left" | "right") => void;
  interactive?: boolean;
  showControls?: boolean;
  selectedEntity?: string | null;
}

export function DungeonMap({
  mapData,
  onTileClick,
  onEntityClick,
  onPlayerMove,
  interactive = true,
  showControls = true,
  selectedEntity,
}: DungeonMapProps) {
  const [zoom, setZoom] = useState(1);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!interactive || !onPlayerMove) return;
    
    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        e.preventDefault();
        onPlayerMove("up");
        break;
      case "ArrowDown":
      case "s":
      case "S":
        e.preventDefault();
        onPlayerMove("down");
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        e.preventDefault();
        onPlayerMove("left");
        break;
      case "ArrowRight":
      case "d":
      case "D":
        e.preventDefault();
        onPlayerMove("right");
        break;
    }
  }, [interactive, onPlayerMove]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const getTileIcon = (tile: MapTile) => {
    if (!tile.visible && !tile.explored) return null;
    
    switch (tile.type) {
      case "door":
        return <DoorOpen className="w-4 h-4 text-amber-400" />;
      case "secret_door":
        return tile.explored ? <DoorOpen className="w-4 h-4 text-stone-500" /> : null;
      case "trap":
        return tile.explored ? <Flame className="w-4 h-4 text-red-400" /> : null;
      case "treasure":
        return <Gem className="w-4 h-4 text-yellow-400" />;
      case "stairs_up":
        return <ChevronUp className="w-4 h-4 text-blue-400" />;
      case "stairs_down":
        return <ChevronDown className="w-4 h-4 text-purple-400" />;
      default:
        return null;
    }
  };

  const getEntityIcon = (entity: MapEntity) => {
    const colorClass = ENTITY_COLORS[entity.type];
    
    switch (entity.type) {
      case "player":
        return <User className={`w-5 h-5 ${colorClass}`} />;
      case "ally":
        return <Users className={`w-5 h-5 ${colorClass}`} />;
      case "enemy":
        return <Skull className={`w-5 h-5 ${colorClass}`} />;
      case "boss":
        return <Skull className={`w-6 h-6 ${colorClass}`} />;
      case "npc":
        return <MapPin className={`w-5 h-5 ${colorClass}`} />;
      default:
        return <User className={`w-5 h-5 ${colorClass}`} />;
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleReset = () => {
    setZoom(1);
    setViewOffset({ x: 0, y: 0 });
  };

  const tileSize = Math.floor(32 * zoom);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            {mapData.name || "Dungeon Map"}
            {mapData.level && (
              <Badge variant="outline" className="ml-2">
                Level {mapData.level}
              </Badge>
            )}
          </CardTitle>
          {showControls && (
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleZoomOut}
                data-testid="button-zoom-out"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleZoomIn}
                data-testid="button-zoom-in"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleReset}
                data-testid="button-reset-view"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          <div 
            className="relative overflow-auto border-2 border-amber-500 dark:border-amber-700 rounded-lg bg-stone-200 dark:bg-stone-950 p-3"
            style={{ maxHeight: "450px", maxWidth: "100%" }}
            data-testid="dungeon-map-grid"
          >
            {/* Compass Rose Overlay */}
            <div className="absolute top-2 right-2 z-20 bg-white/90 dark:bg-stone-900/90 rounded-lg p-2 border border-amber-500 dark:border-amber-600 shadow-md">
              <div className="flex flex-col items-center text-xs font-bold">
                <span className="text-amber-600 dark:text-amber-400">N</span>
                <div className="flex items-center gap-2">
                  <span className="text-amber-600 dark:text-amber-400">W</span>
                  <Compass className="w-6 h-6 text-amber-600 dark:text-amber-500" />
                  <span className="text-amber-600 dark:text-amber-400">E</span>
                </div>
                <span className="text-amber-600 dark:text-amber-400">S</span>
              </div>
            </div>
            
            {/* Player Position Indicator */}
            <div className="absolute top-2 left-2 z-20 bg-white/90 dark:bg-stone-900/90 rounded-lg px-2 py-1 border border-emerald-500 dark:border-emerald-600 text-xs shadow-md">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                Position: ({mapData.playerPosition.x}, {mapData.playerPosition.y})
              </span>
            </div>
            
            <div
              className="grid gap-0.5 mt-8"
              style={{
                gridTemplateColumns: `repeat(${mapData.width}, ${tileSize}px)`,
                gridTemplateRows: `repeat(${mapData.height}, ${tileSize}px)`,
              }}
            >
              {mapData.tiles.map((row, y) =>
                row.map((tile, x) => {
                  const entity = mapData.entities.find(e => e.x === x && e.y === y);
                  const isPlayerHere = mapData.playerPosition.x === x && mapData.playerPosition.y === y;
                  const tileColor = TILE_COLORS[tile.type];
                  const isExplored = tile.explored || tile.visible;
                  const isVisible = tile.visible;
                  const isSelected = entity && entity.id === selectedEntity;

                  return (
                    <div
                      key={`${x}-${y}`}
                      className={`
                        relative flex items-center justify-center
                        ${!isExplored ? 'bg-slate-800 dark:bg-slate-950' : tileColor.bg} ${tileColor.border} border
                        ${!isExplored ? "opacity-50" : isVisible ? "opacity-100" : "opacity-80"}
                        ${interactive && tile.type !== "wall" ? "cursor-pointer hover:ring-2 hover:ring-primary/50" : ""}
                        ${isSelected ? "ring-2 ring-yellow-400" : ""}
                        transition-all duration-200
                      `}
                      style={{ width: tileSize, height: tileSize }}
                      onClick={() => {
                        if (!interactive) return;
                        if (entity && onEntityClick) {
                          onEntityClick(entity);
                        } else if (onTileClick && tile.type !== "wall") {
                          onTileClick(x, y);
                        }
                      }}
                      data-testid={`tile-${x}-${y}`}
                    >
                      {getTileIcon(tile)}
                      {entity && !isPlayerHere && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          {getEntityIcon(entity)}
                        </div>
                      )}
                      {isPlayerHere && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                          <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/50 ring-2 ring-white animate-pulse">
                            <Navigation className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {showControls && interactive && onPlayerMove && (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium text-muted-foreground mb-1">Movement</div>
              <div className="grid grid-cols-3 gap-1">
                <div />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onPlayerMove("up")}
                  data-testid="button-move-up"
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <div />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onPlayerMove("left")}
                  data-testid="button-move-left"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="w-9 h-9 flex items-center justify-center text-xs text-muted-foreground">
                  WASD
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onPlayerMove("right")}
                  data-testid="button-move-right"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <div />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onPlayerMove("down")}
                  data-testid="button-move-down"
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
                <div />
              </div>
              
              <div className="mt-4 space-y-1.5 bg-stone-100 dark:bg-stone-900 p-2 rounded-lg border border-stone-300 dark:border-stone-700">
                <div className="text-sm font-bold text-stone-800 dark:text-stone-200">Map Legend</div>
                <div className="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300">
                  <div className="w-4 h-4 bg-amber-200 dark:bg-amber-700 border-2 border-amber-400 dark:border-amber-500 rounded-sm" />
                  <span className="font-medium">Floor (explored)</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300">
                  <div className="w-4 h-4 bg-stone-700 dark:bg-stone-900 border-2 border-stone-500 dark:border-stone-700 rounded-sm" />
                  <span className="font-medium">Wall</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300">
                  <div className="w-4 h-4 bg-amber-500 dark:bg-amber-600 border-2 border-amber-600 dark:border-amber-400 rounded-sm flex items-center justify-center">
                    <DoorOpen className="w-3 h-3 text-white" />
                  </div>
                  <span className="font-medium">Door</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300">
                  <div className="w-4 h-4 bg-yellow-400 dark:bg-yellow-500 border-2 border-yellow-500 dark:border-yellow-400 rounded-sm flex items-center justify-center">
                    <Gem className="w-3 h-3 text-amber-800 dark:text-amber-900" />
                  </div>
                  <span className="font-medium">Treasure</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300">
                  <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center ring-2 ring-white shadow">
                    <Navigation className="w-3 h-3 text-white" />
                  </div>
                  <span className="font-medium">You (Party)</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300">
                  <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                    <Skull className="w-3 h-3 text-white" />
                  </div>
                  <span className="font-medium">Enemy</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300">
                  <div className="w-4 h-4 bg-slate-800 dark:bg-slate-950 opacity-50 border border-slate-600 dark:border-slate-700 rounded-sm" />
                  <span className="font-medium">Unexplored</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function generateEmptyMap(width: number, height: number): DungeonMapData {
  const tiles: MapTile[][] = [];
  
  for (let y = 0; y < height; y++) {
    const row: MapTile[] = [];
    for (let x = 0; x < width; x++) {
      const isEdge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      row.push({
        type: isEdge ? "wall" : "floor",
        explored: true,
        visible: true,
      });
    }
    tiles.push(row);
  }

  return {
    width,
    height,
    tiles,
    entities: [],
    playerPosition: { x: Math.floor(width / 2), y: Math.floor(height / 2) },
  };
}

export function generateSimpleDungeon(width: number, height: number): DungeonMapData {
  const tiles: MapTile[][] = [];
  
  for (let y = 0; y < height; y++) {
    const row: MapTile[] = [];
    for (let x = 0; x < width; x++) {
      row.push({
        type: "wall",
        explored: false,
        visible: false,
      });
    }
    tiles.push(row);
  }

  const rooms: { x: number; y: number; w: number; h: number }[] = [];
  const numRooms = Math.floor(Math.random() * 4) + 3;

  for (let i = 0; i < numRooms; i++) {
    const roomW = Math.floor(Math.random() * 4) + 3;
    const roomH = Math.floor(Math.random() * 4) + 3;
    const roomX = Math.floor(Math.random() * (width - roomW - 2)) + 1;
    const roomY = Math.floor(Math.random() * (height - roomH - 2)) + 1;

    let overlaps = false;
    for (const room of rooms) {
      if (
        roomX < room.x + room.w + 1 &&
        roomX + roomW + 1 > room.x &&
        roomY < room.y + room.h + 1 &&
        roomY + roomH + 1 > room.y
      ) {
        overlaps = true;
        break;
      }
    }

    if (!overlaps) {
      rooms.push({ x: roomX, y: roomY, w: roomW, h: roomH });
      
      for (let ry = roomY; ry < roomY + roomH; ry++) {
        for (let rx = roomX; rx < roomX + roomW; rx++) {
          tiles[ry][rx] = { type: "floor", explored: true, visible: true };
        }
      }
    }
  }

  for (let i = 1; i < rooms.length; i++) {
    const prev = rooms[i - 1];
    const curr = rooms[i];
    const prevCenterX = Math.floor(prev.x + prev.w / 2);
    const prevCenterY = Math.floor(prev.y + prev.h / 2);
    const currCenterX = Math.floor(curr.x + curr.w / 2);
    const currCenterY = Math.floor(curr.y + curr.h / 2);

    if (Math.random() < 0.5) {
      for (let x = Math.min(prevCenterX, currCenterX); x <= Math.max(prevCenterX, currCenterX); x++) {
        tiles[prevCenterY][x] = { type: "floor", explored: true, visible: true };
      }
      for (let y = Math.min(prevCenterY, currCenterY); y <= Math.max(prevCenterY, currCenterY); y++) {
        tiles[y][currCenterX] = { type: "floor", explored: true, visible: true };
      }
    } else {
      for (let y = Math.min(prevCenterY, currCenterY); y <= Math.max(prevCenterY, currCenterY); y++) {
        tiles[y][prevCenterX] = { type: "floor", explored: true, visible: true };
      }
      for (let x = Math.min(prevCenterX, currCenterX); x <= Math.max(prevCenterX, currCenterX); x++) {
        tiles[currCenterY][x] = { type: "floor", explored: true, visible: true };
      }
    }
  }

  for (let i = 1; i < rooms.length; i++) {
    const prev = rooms[i - 1];
    const curr = rooms[i];
    const prevCenterX = Math.floor(prev.x + prev.w / 2);
    const prevCenterY = Math.floor(prev.y + prev.h / 2);
    const currCenterX = Math.floor(curr.x + curr.w / 2);
    const currCenterY = Math.floor(curr.y + curr.h / 2);

    const doorPositions = [
      { x: prevCenterX, y: prev.y + prev.h },
      { x: prevCenterX, y: prev.y - 1 },
      { x: prev.x + prev.w, y: prevCenterY },
      { x: prev.x - 1, y: prevCenterY },
      { x: currCenterX, y: curr.y + curr.h },
      { x: currCenterX, y: curr.y - 1 },
      { x: curr.x + curr.w, y: currCenterY },
      { x: curr.x - 1, y: currCenterY },
    ];

    for (const pos of doorPositions) {
      if (
        pos.x >= 0 && pos.x < width &&
        pos.y >= 0 && pos.y < height &&
        tiles[pos.y][pos.x].type === "floor" &&
        Math.random() < 0.3
      ) {
        tiles[pos.y][pos.x] = { type: "door", explored: true, visible: true };
        break;
      }
    }
  }

  if (rooms.length > 0) {
    const lastRoom = rooms[rooms.length - 1];
    const treasureX = Math.floor(lastRoom.x + lastRoom.w / 2);
    const treasureY = Math.floor(lastRoom.y + lastRoom.h / 2);
    tiles[treasureY][treasureX] = { type: "treasure", explored: true, visible: true };
  }

  const entities: MapEntity[] = [];
  
  for (let i = 1; i < rooms.length - 1; i++) {
    if (Math.random() < 0.6) {
      const room = rooms[i];
      const enemyX = Math.floor(room.x + room.w / 2);
      const enemyY = Math.floor(room.y + room.h / 2);
      
      entities.push({
        id: `enemy-${i}`,
        type: "enemy",
        name: ["Goblin", "Orc", "Skeleton", "Zombie"][Math.floor(Math.random() * 4)],
        x: enemyX,
        y: enemyY,
        hp: Math.floor(Math.random() * 15) + 5,
        maxHp: 20,
      });
    }
  }

  const firstRoom = rooms[0];
  const playerX = Math.floor(firstRoom.x + firstRoom.w / 2);
  const playerY = Math.floor(firstRoom.y + firstRoom.h / 2);

  return {
    width,
    height,
    tiles,
    entities,
    playerPosition: { x: playerX, y: playerY },
    name: "Generated Dungeon",
    level: 1,
  };
}
