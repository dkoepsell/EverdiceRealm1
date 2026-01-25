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
  Navigation,
  Lock
} from "lucide-react";

export type TileType = 
  | "floor" 
  | "wall" 
  | "door" 
  | "door_locked"
  | "corridor"
  | "secret_door"
  | "trap" 
  | "treasure" 
  | "stairs_up" 
  | "stairs_down"
  | "water"
  | "lava"
  | "pit"
  | "fog"
  // Nature/Forest tiles
  | "grass"
  | "tree"
  | "dense_forest"
  | "path"
  | "bridge"
  | "clearing"
  // Town/Settlement tiles
  | "road"
  | "building"
  | "market"
  | "tavern"
  | "well"
  | "fence"
  // Cave/Mountain tiles
  | "rock"
  | "rubble"
  | "stalactite"
  | "underground_lake"
  // Desert tiles
  | "sand"
  | "dune"
  | "oasis"
  // Swamp tiles
  | "mud"
  | "reeds"
  | "bog";

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

// HexMetaV2 types for narrative-driven map tiles
export type NarrativeTone = 
  | "Whispering" | "Sacred" | "Watched" | "Unstable" 
  | "Forgotten" | "Hostile" | "Benevolent" | "Sealed" | "Cursed" | "Ancient";

export type HexState = "Dormant" | "Stirring" | "Active" | "Fading" | "Sealed" | "Compromised";

export type HexImportanceType = "Revelation" | "Risk" | "LostKnowledge" | "Sanctuary" | "Convergence" | "None";

export type EnvironmentTag = 
  | "frost-touched" | "overgrown" | "waterlogged" | "ash-covered"
  | "sunlit" | "moonlit" | "torch-lit" | "dark"
  | "ancient-stone" | "living-wood" | "crystalline" | "corrupted"
  | "blood-stained" | "rune-carved" | "moss-covered" | "dusty";

export interface HexAffordances {
  exploration: number;
  social: number;
  investigation: number;
  puzzle: number;
  combat: number;
}

// Narrative data stored per tile for story-map integration
export interface TileNarrativeData {
  description?: string;           // AI-generated room/tile description
  shortDescription?: string;      // One-line summary for tooltips
  npcs?: string[];                // NPC names present in this tile
  items?: string[];               // Items/loot that can be found
  enemies?: string[];             // Enemy types present
  events?: string[];              // Story events/triggers
  secretInfo?: string;            // Hidden info revealed on discovery
  dangerLevel?: 'safe' | 'low' | 'medium' | 'high' | 'deadly';
  interactable?: boolean;         // Can the player interact here
  discovered?: boolean;           // Has narrative been revealed
  // HexMetaV2 fields
  narrativeTone?: NarrativeTone;  // The promise this hex makes
  hexState?: HexState;            // Current activity level
  importanceType?: HexImportanceType; // Type of importance (not just "important")
  affordances?: HexAffordances;   // What play styles this hex supports
  tension?: number;               // 0-100 tension level
  environmentTags?: EnvironmentTag[]; // Visual/atmospheric descriptors
  regionName?: string;            // Named area for choice text
  tooltipNote?: string;           // One short sentence for hover
  glowIntensity?: number;         // 0-1 for UI glow effect
  outlineStyle?: "solid" | "dashed" | "fractured" | "glowing";
}

export interface MapTile {
  type: TileType;
  explored: boolean;
  visible: boolean;
  content?: string;
  narrative?: TileNarrativeData;  // Narrative data for this cell
}

export interface DungeonRoomInfo {
  id: string;
  name: string;
  type: string;
  description: string;
}

export interface DungeonExit {
  direction: string;
  description: string;
  visible: boolean;
  locked: boolean;
  leadsTo?: string;
}

// Map-level narrative context
export interface MapNarrativeContext {
  theme?: string;                 // Overall theme (e.g., "ancient temple", "goblin lair")
  atmosphere?: string;            // Current mood/atmosphere description
  storyHooks?: string[];          // Active story threads in this area
  discoveredLore?: string[];      // Lore pieces the party has found
  pendingReveals?: string[];      // Narrative reveals waiting to happen
}

// AI-generated map modification commands
export interface MapModification {
  type: 'add_secret' | 'place_enemy' | 'add_treasure' | 'add_npc' | 'update_narrative' | 'trigger_event';
  x: number;
  y: number;
  data: {
    name?: string;
    description?: string;
    shortDescription?: string;
    tileType?: TileType;
    narrative?: TileNarrativeData;
    npcs?: string[];
    items?: string[];
    enemies?: string[];
    events?: string[];
    dangerLevel?: 'safe' | 'low' | 'medium' | 'high' | 'deadly';
    interactable?: boolean;
  };
}

export type MapEnvironment = "dungeon" | "forest" | "cave" | "castle" | "ruins" | "swamp" | "mountain" | "desert" | "town" | "underground";

export interface DungeonMapData {
  width: number;
  height: number;
  tiles: MapTile[][];
  entities: MapEntity[];
  playerPosition: { x: number; y: number };
  name?: string;
  level?: number;
  environment?: MapEnvironment;  // Environment type for tile styling
  currentRoom?: DungeonRoomInfo;
  exits?: DungeonExit[];
  lighting?: string;
  dangerLevel?: string;
  narrativeContext?: MapNarrativeContext;  // Map-level narrative
  pendingModifications?: MapModification[]; // AI-requested changes
}

// High contrast tile colors for better visibility - with dark mode support
const TILE_COLORS: Record<TileType, { bg: string; border: string }> = {
  floor: { bg: "bg-amber-200 dark:bg-amber-700", border: "border-amber-400 dark:border-amber-500" },
  wall: { bg: "bg-stone-700 dark:bg-stone-900", border: "border-stone-500 dark:border-stone-700" },
  door: { bg: "bg-amber-500 dark:bg-amber-600", border: "border-amber-600 dark:border-amber-400" },
  door_locked: { bg: "bg-red-600 dark:bg-red-800", border: "border-red-700 dark:border-red-600" },
  corridor: { bg: "bg-amber-300 dark:bg-amber-800", border: "border-amber-400 dark:border-amber-600" },
  secret_door: { bg: "bg-stone-400 dark:bg-stone-600", border: "border-stone-500 dark:border-stone-500" },
  trap: { bg: "bg-red-400 dark:bg-red-600", border: "border-red-500 dark:border-red-400" },
  treasure: { bg: "bg-yellow-400 dark:bg-yellow-500", border: "border-yellow-500 dark:border-yellow-400" },
  stairs_up: { bg: "bg-cyan-400 dark:bg-cyan-600", border: "border-cyan-500 dark:border-cyan-400" },
  stairs_down: { bg: "bg-purple-400 dark:bg-purple-600", border: "border-purple-500 dark:border-purple-400" },
  water: { bg: "bg-blue-400 dark:bg-blue-600", border: "border-blue-500 dark:border-blue-400" },
  lava: { bg: "bg-orange-500 dark:bg-orange-600", border: "border-orange-600 dark:border-orange-400" },
  pit: { bg: "bg-gray-800 dark:bg-black", border: "border-gray-600 dark:border-gray-800" },
  fog: { bg: "bg-slate-300 dark:bg-slate-600", border: "border-slate-400 dark:border-slate-500" },
  // Nature/Forest tiles
  grass: { bg: "bg-green-300 dark:bg-green-600", border: "border-green-400 dark:border-green-500" },
  tree: { bg: "bg-green-700 dark:bg-green-900", border: "border-green-600 dark:border-green-700" },
  dense_forest: { bg: "bg-green-900 dark:bg-green-950", border: "border-green-700 dark:border-green-800" },
  path: { bg: "bg-amber-300 dark:bg-amber-700", border: "border-amber-400 dark:border-amber-600" },
  bridge: { bg: "bg-amber-600 dark:bg-amber-800", border: "border-amber-500 dark:border-amber-600" },
  clearing: { bg: "bg-lime-200 dark:bg-lime-700", border: "border-lime-300 dark:border-lime-600" },
  // Town/Settlement tiles
  road: { bg: "bg-stone-400 dark:bg-stone-600", border: "border-stone-500 dark:border-stone-500" },
  building: { bg: "bg-slate-600 dark:bg-slate-800", border: "border-slate-500 dark:border-slate-600" },
  market: { bg: "bg-orange-300 dark:bg-orange-600", border: "border-orange-400 dark:border-orange-500" },
  tavern: { bg: "bg-amber-500 dark:bg-amber-700", border: "border-amber-400 dark:border-amber-600" },
  well: { bg: "bg-cyan-300 dark:bg-cyan-600", border: "border-cyan-400 dark:border-cyan-500" },
  fence: { bg: "bg-amber-700 dark:bg-amber-900", border: "border-amber-600 dark:border-amber-700" },
  // Cave/Mountain tiles
  rock: { bg: "bg-gray-500 dark:bg-gray-700", border: "border-gray-400 dark:border-gray-600" },
  rubble: { bg: "bg-stone-500 dark:bg-stone-700", border: "border-stone-400 dark:border-stone-600" },
  stalactite: { bg: "bg-slate-500 dark:bg-slate-700", border: "border-slate-400 dark:border-slate-600" },
  underground_lake: { bg: "bg-indigo-500 dark:bg-indigo-700", border: "border-indigo-400 dark:border-indigo-600" },
  // Desert tiles
  sand: { bg: "bg-yellow-200 dark:bg-yellow-600", border: "border-yellow-300 dark:border-yellow-500" },
  dune: { bg: "bg-yellow-400 dark:bg-yellow-700", border: "border-yellow-500 dark:border-yellow-600" },
  oasis: { bg: "bg-teal-400 dark:bg-teal-600", border: "border-teal-300 dark:border-teal-500" },
  // Swamp tiles
  mud: { bg: "bg-amber-800 dark:bg-amber-900", border: "border-amber-700 dark:border-amber-800" },
  reeds: { bg: "bg-lime-600 dark:bg-lime-800", border: "border-lime-500 dark:border-lime-700" },
  bog: { bg: "bg-emerald-800 dark:bg-emerald-900", border: "border-emerald-700 dark:border-emerald-800" },
};

const ENTITY_COLORS: Record<EntityType, string> = {
  player: "text-green-400",
  ally: "text-blue-400",
  enemy: "text-red-400",
  npc: "text-yellow-400",
  boss: "text-purple-400",
};

// Narrative tone icons and colors for HexMetaV2
const NARRATIVE_TONE_ICONS: Record<NarrativeTone, { icon: string; color: string }> = {
  "Whispering": { icon: "👁", color: "text-purple-400" },
  "Sacred": { icon: "✧", color: "text-amber-400" },
  "Watched": { icon: "◉", color: "text-red-400" },
  "Unstable": { icon: "⚠", color: "text-orange-400" },
  "Forgotten": { icon: "◇", color: "text-slate-400" },
  "Hostile": { icon: "☠", color: "text-red-500" },
  "Benevolent": { icon: "♥", color: "text-green-400" },
  "Sealed": { icon: "🔒", color: "text-blue-400" },
  "Cursed": { icon: "☽", color: "text-violet-500" },
  "Ancient": { icon: "⌘", color: "text-amber-600" },
};

// Importance type outline styles
const IMPORTANCE_STYLES: Record<HexImportanceType, { outline: string; glow: string }> = {
  "Revelation": { outline: "ring-2 ring-amber-400", glow: "shadow-amber-400/50 shadow-md" },
  "Risk": { outline: "ring-2 ring-red-400 ring-dashed", glow: "shadow-red-400/40 shadow-md" },
  "LostKnowledge": { outline: "ring-1 ring-slate-400 opacity-80", glow: "shadow-slate-400/30 shadow-sm" },
  "Sanctuary": { outline: "ring-2 ring-green-400", glow: "shadow-green-400/40 shadow-md" },
  "Convergence": { outline: "ring-2 ring-purple-400 animate-pulse", glow: "shadow-purple-400/50 shadow-lg" },
  "None": { outline: "", glow: "" },
};

// Environment-specific labels for map elements
type EnvironmentType = "dungeon" | "forest" | "cave" | "castle" | "ruins" | "swamp" | "mountain" | "desert" | "town" | "underground";

const ENVIRONMENT_LABELS: Record<EnvironmentType, {
  floor: string;
  corridor: string;
  wall: string;
  door: string;
  lockedDoor: string;
  stairsUp: string;
  stairsDown: string;
  fog: string;
  enemy: string;
}> = {
  dungeon: {
    floor: "Floor",
    corridor: "Corridor", 
    wall: "Wall (blocked)",
    door: "Door (open)",
    lockedDoor: "Locked Door",
    stairsUp: "Stairs Up",
    stairsDown: "Stairs Down",
    fog: "Unexplored (fog)",
    enemy: "Enemy"
  },
  forest: {
    floor: "Clearing",
    corridor: "Forest Path",
    wall: "Dense Trees",
    door: "Passage",
    lockedDoor: "Blocked Path",
    stairsUp: "Uphill Trail",
    stairsDown: "Downhill Trail",
    fog: "Unexplored",
    enemy: "Creature"
  },
  cave: {
    floor: "Cavern Floor",
    corridor: "Tunnel",
    wall: "Rock Wall",
    door: "Cave Opening",
    lockedDoor: "Collapsed Passage",
    stairsUp: "Ascending Tunnel",
    stairsDown: "Descending Tunnel",
    fog: "Darkness",
    enemy: "Creature"
  },
  castle: {
    floor: "Stone Floor",
    corridor: "Hallway",
    wall: "Castle Wall",
    door: "Door",
    lockedDoor: "Barred Door",
    stairsUp: "Stairs Up",
    stairsDown: "Stairs Down",
    fog: "Unexplored",
    enemy: "Guard"
  },
  ruins: {
    floor: "Crumbled Floor",
    corridor: "Ruined Passage",
    wall: "Rubble",
    door: "Archway",
    lockedDoor: "Collapsed Arch",
    stairsUp: "Broken Stairs",
    stairsDown: "Descent",
    fog: "Shadows",
    enemy: "Guardian"
  },
  swamp: {
    floor: "Dry Ground",
    corridor: "Muddy Path",
    wall: "Murky Water",
    door: "Crossing",
    lockedDoor: "Impassable Bog",
    stairsUp: "Rising Ground",
    stairsDown: "Sinking Ground",
    fog: "Mist",
    enemy: "Creature"
  },
  mountain: {
    floor: "Plateau",
    corridor: "Mountain Trail",
    wall: "Cliff Face",
    door: "Pass",
    lockedDoor: "Blocked Pass",
    stairsUp: "Ascent",
    stairsDown: "Descent",
    fog: "Clouds",
    enemy: "Beast"
  },
  desert: {
    floor: "Sandy Ground",
    corridor: "Trail",
    wall: "Dunes",
    door: "Oasis",
    lockedDoor: "Sandstorm",
    stairsUp: "Dune Crest",
    stairsDown: "Valley",
    fog: "Sandstorm",
    enemy: "Creature"
  },
  town: {
    floor: "Street",
    corridor: "Alley",
    wall: "Building",
    door: "Doorway",
    lockedDoor: "Locked Door",
    stairsUp: "Steps",
    stairsDown: "Cellar Stairs",
    fog: "Unexplored",
    enemy: "Hostile"
  },
  underground: {
    floor: "Cavern",
    corridor: "Passage",
    wall: "Solid Rock",
    door: "Opening",
    lockedDoor: "Sealed Chamber",
    stairsUp: "Shaft Up",
    stairsDown: "Shaft Down",
    fog: "Darkness",
    enemy: "Denizen"
  }
};

// Helper to detect environment from map name or description
function detectEnvironment(name?: string): EnvironmentType {
  const text = (name || "").toLowerCase();
  if (text.includes("forest") || text.includes("glade") || text.includes("grove") || text.includes("wood")) return "forest";
  if (text.includes("cave") || text.includes("cavern")) return "cave";
  if (text.includes("castle") || text.includes("fortress") || text.includes("keep")) return "castle";
  if (text.includes("ruin") || text.includes("temple") || text.includes("shrine")) return "ruins";
  if (text.includes("swamp") || text.includes("marsh") || text.includes("bog")) return "swamp";
  if (text.includes("mountain") || text.includes("peak") || text.includes("cliff")) return "mountain";
  if (text.includes("desert") || text.includes("dune") || text.includes("oasis")) return "desert";
  if (text.includes("town") || text.includes("city") || text.includes("village")) return "town";
  if (text.includes("underground") || text.includes("underdark") || text.includes("depths")) return "underground";
  return "dungeon";
}

interface DungeonMapProps {
  mapData: DungeonMapData;
  onTileClick?: (x: number, y: number) => void;
  onEntityClick?: (entity: MapEntity) => void;
  onPlayerMove?: (direction: "up" | "down" | "left" | "right") => void;
  interactive?: boolean;
  showControls?: boolean;
  selectedEntity?: string | null;
  environment?: EnvironmentType;
}

export function DungeonMap({
  mapData,
  onTileClick,
  onEntityClick,
  onPlayerMove,
  interactive = true,
  showControls = true,
  selectedEntity,
  environment,
}: DungeonMapProps) {
  const [zoom, setZoom] = useState(1);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  
  // Auto-detect environment from map name if not explicitly provided
  const detectedEnv = environment || detectEnvironment(mapData.name);
  const labels = ENVIRONMENT_LABELS[detectedEnv];

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
    
    // First check for narrative markers (these overlay on top of tile type icons)
    const narrative = tile.narrative;
    
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
        // Show narrative markers for floor/corridor tiles
        if (narrative?.discovered && (tile.type === "floor" || tile.type === "corridor")) {
          // Priority: enemies > events > items > NPCs
          if (narrative.enemies && narrative.enemies.length > 0) {
            return <Skull className="w-3 h-3 text-red-400" />;
          }
          if (narrative.events && narrative.events.length > 0) {
            return <span className="text-xs">⚡</span>;
          }
          if (narrative.items && narrative.items.length > 0) {
            return <Gem className="w-3 h-3 text-cyan-400" />;
          }
          if (narrative.npcs && narrative.npcs.length > 0) {
            return <User className="w-3 h-3 text-green-400" />;
          }
        }
        return null;
    }
  };
  
  // Get narrative markers to display as overlay icons
  const getNarrativeMarkers = (tile: MapTile) => {
    if (!tile.visible && !tile.explored) return null;
    const narrative = tile.narrative;
    if (!narrative?.discovered) return null;
    
    const markers: React.ReactNode[] = [];
    
    // HexMetaV2: Narrative tone icon (top-left corner)
    if (narrative.narrativeTone && NARRATIVE_TONE_ICONS[narrative.narrativeTone]) {
      const toneData = NARRATIVE_TONE_ICONS[narrative.narrativeTone];
      markers.push(
        <div 
          key="tone"
          className={`absolute top-0 left-0 ${toneData.color} font-bold z-20 bg-black/60 rounded-full flex items-center justify-center`}
          style={{ fontSize: '10px', width: '14px', height: '14px' }}
          title={narrative.tooltipNote || narrative.narrativeTone}
        >
          {toneData.icon}
        </div>
      );
    }
    
    // Danger level indicator (corner badge)
    if (narrative.dangerLevel && narrative.dangerLevel !== 'safe') {
      const dangerColors: Record<string, string> = {
        low: 'bg-yellow-500',
        medium: 'bg-orange-500', 
        high: 'bg-red-500',
        deadly: 'bg-purple-600'
      };
      markers.push(
        <div 
          key="danger"
          className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${dangerColors[narrative.dangerLevel]} animate-pulse`}
        />
      );
    }
    
    // HexMetaV2: Tension indicator (bottom-left, if high tension)
    if (narrative.tension && narrative.tension >= 50) {
      const tensionColor = narrative.tension >= 80 ? 'bg-red-500' : 'bg-orange-400';
      markers.push(
        <div 
          key="tension"
          className={`absolute -bottom-0.5 -left-0.5 w-1.5 h-1.5 rounded-full ${tensionColor} animate-pulse`}
          title={`Tension: ${narrative.tension}%`}
        />
      );
    }
    
    // Interactable indicator
    if (narrative.interactable) {
      markers.push(
        <div 
          key="interact"
          className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 border border-white"
        />
      );
    }
    
    // HexMetaV2: Region name overlay (when zoomed in)
    if (narrative.regionName && zoom >= 1.2) {
      markers.push(
        <div 
          key="region"
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[6px] text-white/80 whitespace-nowrap font-medium drop-shadow-md"
        >
          {narrative.regionName}
        </div>
      );
    }
    
    return markers.length > 0 ? markers : null;
  };
  
  // Get importance style classes for a tile
  const getImportanceStyles = (tile: MapTile): string => {
    const importanceType = tile.narrative?.importanceType || "None";
    const styles = IMPORTANCE_STYLES[importanceType];
    return `${styles.outline} ${styles.glow}`;
  };

  // D&D Mini-style figurine component
  const MiniBase = ({ children, color, glow }: { children: React.ReactNode; color: string; glow?: string }) => (
    <div className="relative flex flex-col items-center">
      {/* Figurine body */}
      <div 
        className={`relative z-10 ${color} rounded-t-full shadow-md`}
        style={{ 
          width: '16px', 
          height: '18px',
          boxShadow: glow ? `0 0 8px 2px ${glow}` : '0 2px 4px rgba(0,0,0,0.3)'
        }}
      >
        {children}
      </div>
      {/* Mini base (like a D&D miniature stand) */}
      <div 
        className="rounded-full bg-gradient-to-b from-stone-600 to-stone-800 border border-stone-500"
        style={{ 
          width: '20px', 
          height: '6px',
          marginTop: '-2px',
          boxShadow: '0 2px 3px rgba(0,0,0,0.4)'
        }}
      />
    </div>
  );

  const getEntityIcon = (entity: MapEntity) => {
    switch (entity.type) {
      case "player":
        return (
          <MiniBase color="bg-gradient-to-b from-emerald-400 to-emerald-600" glow="rgba(52,211,153,0.5)">
            <User className="w-3 h-3 text-white absolute top-1 left-1/2 -translate-x-1/2" />
          </MiniBase>
        );
      case "ally":
        return (
          <MiniBase color="bg-gradient-to-b from-blue-400 to-blue-600" glow="rgba(96,165,250,0.4)">
            <Users className="w-3 h-3 text-white absolute top-1 left-1/2 -translate-x-1/2" />
          </MiniBase>
        );
      case "enemy":
        return (
          <MiniBase color="bg-gradient-to-b from-red-500 to-red-700" glow="rgba(239,68,68,0.5)">
            <Skull className="w-3 h-3 text-white absolute top-1 left-1/2 -translate-x-1/2" />
          </MiniBase>
        );
      case "boss":
        return (
          <div className="relative flex flex-col items-center scale-125">
            <div 
              className="relative z-10 bg-gradient-to-b from-purple-500 to-purple-800 rounded-t-full shadow-lg"
              style={{ 
                width: '18px', 
                height: '20px',
                boxShadow: '0 0 12px 3px rgba(168,85,247,0.6)'
              }}
            >
              <Skull className="w-3.5 h-3.5 text-yellow-300 absolute top-1 left-1/2 -translate-x-1/2" />
            </div>
            <div 
              className="rounded-full bg-gradient-to-b from-stone-500 to-stone-800 border-2 border-yellow-500"
              style={{ width: '22px', height: '7px', marginTop: '-2px' }}
            />
          </div>
        );
      case "npc":
        return (
          <MiniBase color="bg-gradient-to-b from-yellow-400 to-amber-600">
            <MapPin className="w-3 h-3 text-white absolute top-1 left-1/2 -translate-x-1/2" />
          </MiniBase>
        );
      default:
        return (
          <MiniBase color="bg-gradient-to-b from-gray-400 to-gray-600">
            <User className="w-3 h-3 text-white absolute top-1 left-1/2 -translate-x-1/2" />
          </MiniBase>
        );
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleReset = () => {
    setZoom(1);
    setViewOffset({ x: 0, y: 0 });
  };

  // Hex dimensions for flat-top hexagons - larger size for better visibility
  const baseHexSize = 42 * zoom;
  const hexWidth = Math.floor(baseHexSize);
  const hexHeight = Math.floor(baseHexSize * 1.15); // taller than wide for flat-top hex
  const hexHorizontalSpacing = Math.floor(hexWidth * 0.78); // horizontal overlap for hex tessellation
  const hexVerticalSpacing = Math.floor(hexHeight * 0.5); // 50% vertical overlap for rows
  const hexHorizontalOffset = Math.floor(hexHorizontalSpacing * 0.5); // offset for odd rows

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              {mapData.name || "Dungeon Map"}
              {mapData.level && (
                <Badge variant="outline" className="ml-2">
                  Level {mapData.level}
                </Badge>
              )}
            </CardTitle>
            {/* HexMetaV2: Show current region subtitle based on player position */}
            {(() => {
              const playerTile = mapData.tiles[mapData.playerPosition.y]?.[mapData.playerPosition.x];
              const regionName = playerTile?.narrative?.regionName;
              const tone = playerTile?.narrative?.narrativeTone;
              const toneIcon = tone ? NARRATIVE_TONE_ICONS[tone]?.icon : null;
              if (regionName || tone) {
                return (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    {toneIcon && <span className={NARRATIVE_TONE_ICONS[tone!]?.color}>{toneIcon}</span>}
                    <span className="italic">
                      {regionName || (tone ? `A ${tone.toLowerCase()} place` : '')}
                      {playerTile?.narrative?.tooltipNote && (
                        <span className="ml-1 opacity-70">— {playerTile.narrative.tooltipNote}</span>
                      )}
                    </span>
                  </div>
                );
              }
              return null;
            })()}
          </div>
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
        
        {/* Room Info from AI - synchronized with narrative */}
        {mapData.currentRoom && (
          <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                {mapData.currentRoom.name}
              </span>
              <Badge variant="outline" className="text-xs">
                {mapData.currentRoom.type}
              </Badge>
              {mapData.lighting && (
                <Badge variant="secondary" className="text-xs">
                  {mapData.lighting} light
                </Badge>
              )}
              {mapData.dangerLevel && mapData.dangerLevel !== 'safe' && (
                <Badge variant={mapData.dangerLevel === 'deadly' ? 'destructive' : 'outline'} className="text-xs">
                  {mapData.dangerLevel} danger
                </Badge>
              )}
            </div>
            {mapData.currentRoom.description && (
              <p className="text-xs text-muted-foreground mt-1">{mapData.currentRoom.description}</p>
            )}
            {mapData.exits && mapData.exits.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="text-xs text-muted-foreground">Exits:</span>
                {mapData.exits.map((exit, i) => (
                  <Badge key={i} variant={exit.locked ? "destructive" : "outline"} className="text-xs">
                    {exit.direction}{exit.locked && ' (locked)'}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          {/* Tabletop Frame - Wood grain effect */}
          <div 
            className="relative overflow-auto rounded-xl p-1"
            style={{ 
              maxHeight: "480px", 
              maxWidth: "100%",
              background: 'linear-gradient(135deg, #8B4513 0%, #A0522D 25%, #8B4513 50%, #6B3E0C 75%, #8B4513 100%)',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3), 0 4px 8px rgba(0,0,0,0.4)'
            }}
            data-testid="dungeon-map-grid"
          >
            {/* Inner map area with parchment-like texture */}
            <div 
              className="relative rounded-lg p-3"
              style={{
                background: 'linear-gradient(to bottom right, #e8dcc4 0%, #d4c4a8 50%, #c9b896 100%)',
                boxShadow: 'inset 0 0 20px rgba(139,69,19,0.2)'
              }}
            >
              {/* Decorative corner dice - bottom left */}
              <div className="absolute bottom-1 left-1 z-30 opacity-60">
                <div 
                  className="w-5 h-5 bg-gradient-to-br from-red-600 to-red-800 rounded-sm rotate-12 flex items-center justify-center text-white text-xs font-bold shadow-md"
                  style={{ boxShadow: '1px 1px 3px rgba(0,0,0,0.4)' }}
                >
                  20
                </div>
              </div>
              
              {/* Decorative corner dice - bottom right */}
              <div className="absolute bottom-1 right-1 z-30 opacity-60">
                <div 
                  className="w-4 h-4 bg-gradient-to-br from-blue-600 to-blue-800 rounded-sm -rotate-6 flex items-center justify-center text-white text-[10px] font-bold shadow-md"
                  style={{ boxShadow: '1px 1px 3px rgba(0,0,0,0.4)' }}
                >
                  6
                </div>
              </div>

              {/* Compass Rose Overlay - styled like antique compass */}
              <div 
                className="absolute top-2 right-2 z-20 rounded-full p-2 border-2 border-amber-700"
                style={{
                  background: 'radial-gradient(circle, #f5e6c8 0%, #d4b896 100%)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.3)'
                }}
              >
                <div className="flex flex-col items-center text-xs font-bold" style={{ fontFamily: 'serif' }}>
                  <span className="text-amber-800">N</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-amber-800">W</span>
                    <Compass className="w-5 h-5 text-amber-700" />
                    <span className="text-amber-800">E</span>
                  </div>
                  <span className="text-amber-800">S</span>
                </div>
              </div>
              
              {/* Player Position Indicator - parchment style */}
              <div 
                className="absolute top-2 left-2 z-20 rounded px-2 py-1 text-xs"
                style={{
                  background: 'linear-gradient(to bottom, #f5e6c8, #e8d4b8)',
                  border: '1px solid #a67c52',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
              >
                <span className="text-amber-900 font-medium" style={{ fontFamily: 'serif' }}>
                  ⚔ Hex ({mapData.playerPosition.x}, {mapData.playerPosition.y})
                </span>
              </div>
            
            {/* Hex Grid Container */}
            <div
              className="relative mt-8"
              style={{
                width: mapData.width * hexHorizontalSpacing + hexHorizontalOffset + hexWidth,
                height: mapData.height * hexVerticalSpacing + hexHeight,
                minWidth: '300px',
                minHeight: '200px',
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
                  
                  // Calculate hex position with offset for odd rows (honeycomb pattern)
                  const isOddRow = y % 2 === 1;
                  const hexX = x * hexHorizontalSpacing + (isOddRow ? hexHorizontalOffset : 0);
                  const hexY = y * hexVerticalSpacing;
                  
                  // HexMetaV2: Build enhanced tooltip
                  const buildTooltip = (): string | undefined => {
                    if (!tile.narrative?.discovered) return undefined;
                    const parts: string[] = [];
                    if (tile.narrative.regionName) parts.push(tile.narrative.regionName);
                    if (tile.narrative.tooltipNote) parts.push(tile.narrative.tooltipNote);
                    else if (tile.narrative.shortDescription) parts.push(tile.narrative.shortDescription);
                    if (tile.narrative.narrativeTone) parts.push(`[${tile.narrative.narrativeTone}]`);
                    return parts.join(' — ') || undefined;
                  };
                  
                  // HexMetaV2: Get importance styling
                  const importanceStyles = isExplored ? getImportanceStyles(tile) : '';

                  return (
                    <div
                      key={`${x}-${y}`}
                      className="absolute"
                      style={{ 
                        width: hexWidth, 
                        height: hexHeight,
                        left: hexX,
                        top: hexY,
                      }}
                    >
                      {/* Narrative markers outside clipPath so they're visible */}
                      {isExplored && getNarrativeMarkers(tile)}
                      
                      {/* Main hex tile with clipPath */}
                      <div
                        className={`
                          absolute inset-0 flex items-center justify-center
                          ${!isExplored ? 'bg-indigo-900/40 dark:bg-indigo-950/60' : tileColor.bg}
                          ${!isExplored ? "opacity-70" : isVisible ? "opacity-100" : "opacity-80"}
                          ${interactive && tile.type !== "wall" ? "cursor-pointer hover:brightness-110 hover:scale-105" : ""}
                          ${isSelected ? "ring-2 ring-yellow-400 ring-offset-1" : importanceStyles}
                          transition-all duration-200
                        `}
                        style={{ 
                          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                          boxShadow: isExplored ? 'inset 0 0 0 2px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.2)' : 'none',
                        }}
                        onClick={() => {
                          if (!interactive) return;
                          if (entity && onEntityClick) {
                            onEntityClick(entity);
                          } else if (onTileClick && tile.type !== "wall") {
                            onTileClick(x, y);
                          }
                        }}
                        data-testid={`tile-${x}-${y}`}
                        title={buildTooltip()}
                      >
                        {getTileIcon(tile)}
                        {entity && !isPlayerHere && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            {getEntityIcon(entity)}
                          </div>
                        )}
                        {isPlayerHere && (
                          <div className="absolute inset-0 flex items-center justify-center z-10">
                            {/* Party mini with glowing base - tabletop D&D style */}
                            <div className="relative flex flex-col items-center animate-pulse">
                              <div 
                                className="relative z-10 bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-700 rounded-t-full shadow-lg"
                                style={{ 
                                  width: '18px', 
                                  height: '20px',
                                  boxShadow: '0 0 12px 4px rgba(52,211,153,0.6), inset 0 1px 2px rgba(255,255,255,0.3)'
                                }}
                              >
                                <Navigation className="w-3.5 h-3.5 text-white absolute top-1.5 left-1/2 -translate-x-1/2 drop-shadow-sm" />
                              </div>
                              {/* Glowing mini base */}
                              <div 
                                className="rounded-full bg-gradient-to-b from-amber-500 to-amber-700 border-2 border-amber-400"
                                style={{ 
                                  width: '22px', 
                                  height: '7px', 
                                  marginTop: '-2px',
                                  boxShadow: '0 0 8px 2px rgba(251,191,36,0.5), 0 2px 4px rgba(0,0,0,0.4)'
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {showControls && interactive && onPlayerMove && (
              <>
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
              </>
            )}
            
            {/* Map Legend - Tabletop parchment style with hex shapes */}
            <div 
              className="space-y-1.5 p-2.5 rounded-lg border-2"
              style={{
                background: 'linear-gradient(to bottom, #f5e6c8, #e8d4b8)',
                borderColor: '#a67c52',
                boxShadow: '2px 2px 6px rgba(0,0,0,0.2)'
              }}
            >
              <div className="text-sm font-bold flex items-center gap-1" style={{ color: '#5c3d1e', fontFamily: 'serif' }}>
                <span>⬡</span> Hex Map Legend
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: '#5c3d1e' }}>
                {/* Mini-style party icon in legend */}
                <div className="relative flex flex-col items-center" style={{ transform: 'scale(0.8)' }}>
                  <div 
                    className="relative z-10 bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-t-full"
                    style={{ width: '14px', height: '16px', boxShadow: '0 0 6px 2px rgba(52,211,153,0.4)' }}
                  >
                    <Navigation className="w-2.5 h-2.5 text-white absolute top-1 left-1/2 -translate-x-1/2" />
                  </div>
                  <div 
                    className="rounded-full bg-gradient-to-b from-amber-500 to-amber-700 border border-amber-400"
                    style={{ width: '16px', height: '5px', marginTop: '-1px' }}
                  />
                </div>
                <span className="font-medium">You (Party)</span>
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: '#5c3d1e' }}>
                <div className="w-4 h-5 bg-amber-200 flex items-center justify-center" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.2)' }} />
                <span className="font-medium">{labels.floor}</span>
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: '#5c3d1e' }}>
                <div className="w-4 h-5 bg-amber-300 flex items-center justify-center" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.2)' }} />
                <span className="font-medium">{labels.corridor}</span>
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: '#5c3d1e' }}>
                <div className="w-4 h-5 bg-stone-700 flex items-center justify-center" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.3)' }} />
                <span className="font-medium">{labels.wall}</span>
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: '#5c3d1e' }}>
                <div className="w-4 h-5 bg-amber-500 flex items-center justify-center" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.2)' }}>
                  <DoorOpen className="w-2.5 h-2.5 text-white" />
                </div>
                <span className="font-medium">{labels.door}</span>
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: '#5c3d1e' }}>
                <div className="w-4 h-5 bg-red-600 flex items-center justify-center" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.2)' }}>
                  <Lock className="w-2.5 h-2.5 text-white" />
                </div>
                <span className="font-medium">{labels.lockedDoor}</span>
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: '#5c3d1e' }}>
                <div className="w-4 h-5 bg-yellow-400 flex items-center justify-center" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.2)' }}>
                  <Gem className="w-2.5 h-2.5 text-amber-800" />
                </div>
                <span className="font-medium">Treasure</span>
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: '#5c3d1e' }}>
                {/* Mini-style enemy icon in legend */}
                <div className="relative flex flex-col items-center" style={{ transform: 'scale(0.8)' }}>
                  <div 
                    className="relative z-10 bg-gradient-to-b from-red-500 to-red-700 rounded-t-full"
                    style={{ width: '14px', height: '16px', boxShadow: '0 0 6px 2px rgba(239,68,68,0.4)' }}
                  >
                    <Skull className="w-2.5 h-2.5 text-white absolute top-1 left-1/2 -translate-x-1/2" />
                  </div>
                  <div 
                    className="rounded-full bg-gradient-to-b from-stone-600 to-stone-800 border border-stone-500"
                    style={{ width: '16px', height: '5px', marginTop: '-1px' }}
                  />
                </div>
                <span className="font-medium">{labels.enemy}</span>
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: '#5c3d1e' }}>
                <div className="w-4 h-5 opacity-60" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', background: 'repeating-linear-gradient(45deg, #c9b896, #c9b896 2px, rgba(99,102,241,0.3) 2px, rgba(99,102,241,0.3) 4px)' }} />
                <span className="font-medium">{labels.fog}</span>
              </div>
              <p className="text-xs mt-2 italic" style={{ color: '#8b6914' }}>Movement is driven by your story choices above</p>
            </div>
          </div>
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
