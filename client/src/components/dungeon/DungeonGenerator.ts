import type { 
  DungeonMapData, MapTile, MapEntity, TileType, MapEnvironment,
  NarrativeTone, HexState, HexImportanceType, HexAffordances, EnvironmentTag, TileNarrativeData
} from "./DungeonMap";

interface Room {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  type: "standard" | "treasure" | "boss" | "entrance" | "exit";
}

interface DungeonConfig {
  width: number;
  height: number;
  minRoomSize: number;
  maxRoomSize: number;
  maxRooms: number;
  dungeonName?: string;
  dungeonLevel?: number;
  environment?: MapEnvironment;
  enemyDensity?: number; // 0-1
  treasureDensity?: number; // 0-1
  trapDensity?: number; // 0-1
  secretDoorChance?: number; // 0-1
}

// Environment-specific tile mappings
const ENVIRONMENT_TILES: Record<MapEnvironment, {
  impassable: TileType;       // What blocks movement (walls, trees, buildings)
  passable: TileType;         // Main walkable area (floor, grass, road)
  corridor: TileType;         // Connection paths
  door: TileType;             // Entrance/exit points
  hazard?: TileType;          // Environmental hazard
  feature?: TileType;         // Special environmental feature
  decoration?: TileType[];    // Random decorative elements
}> = {
  dungeon: {
    impassable: "wall",
    passable: "floor",
    corridor: "corridor",
    door: "door",
    hazard: "trap",
    feature: "treasure",
  },
  forest: {
    impassable: "dense_forest",
    passable: "grass",
    corridor: "path",
    door: "clearing",
    hazard: "trap",
    feature: "treasure",
    decoration: ["tree", "water"],
  },
  cave: {
    impassable: "rock",
    passable: "floor",
    corridor: "corridor",
    door: "door",
    hazard: "pit",
    feature: "stalactite",
    decoration: ["rubble", "underground_lake"],
  },
  castle: {
    impassable: "wall",
    passable: "floor",
    corridor: "corridor",
    door: "door",
    hazard: "trap",
    feature: "treasure",
  },
  ruins: {
    impassable: "rubble",
    passable: "floor",
    corridor: "corridor",
    door: "door",
    hazard: "pit",
    feature: "treasure",
    decoration: ["rubble"],
  },
  swamp: {
    impassable: "bog",
    passable: "mud",
    corridor: "path",
    door: "bridge",
    hazard: "trap",
    feature: "treasure",
    decoration: ["reeds", "water"],
  },
  mountain: {
    impassable: "rock",
    passable: "path",
    corridor: "path",
    door: "clearing",
    hazard: "pit",
    feature: "treasure",
    decoration: ["rubble"],
  },
  desert: {
    impassable: "dune",
    passable: "sand",
    corridor: "path",
    door: "oasis",
    hazard: "pit",
    feature: "oasis",
    decoration: ["sand"],
  },
  town: {
    impassable: "building",
    passable: "road",
    corridor: "road",
    door: "door",
    hazard: "fence",
    feature: "well",
    decoration: ["market", "tavern"],
  },
  underground: {
    impassable: "rock",
    passable: "floor",
    corridor: "corridor",
    door: "door",
    hazard: "pit",
    feature: "underground_lake",
    decoration: ["stalactite", "rubble"],
  },
};

// Helper to detect environment from name
function detectEnvironmentFromName(name?: string): MapEnvironment {
  const text = (name || "").toLowerCase();
  if (text.includes("forest") || text.includes("glade") || text.includes("grove") || text.includes("wood")) return "forest";
  if (text.includes("cave") || text.includes("cavern")) return "cave";
  if (text.includes("castle") || text.includes("fortress") || text.includes("keep")) return "castle";
  if (text.includes("ruin") || text.includes("temple") || text.includes("shrine")) return "ruins";
  if (text.includes("swamp") || text.includes("marsh") || text.includes("bog")) return "swamp";
  if (text.includes("mountain") || text.includes("peak") || text.includes("cliff")) return "mountain";
  if (text.includes("desert") || text.includes("dune") || text.includes("sand")) return "desert";
  if (text.includes("town") || text.includes("city") || text.includes("village")) return "town";
  if (text.includes("underground") || text.includes("underdark") || text.includes("depths")) return "underground";
  return "dungeon";
}

const DEFAULT_CONFIG: DungeonConfig = {
  width: 30,
  height: 20,
  minRoomSize: 4,
  maxRoomSize: 8,
  maxRooms: 8,
  environment: "dungeon",
  enemyDensity: 0.4,
  treasureDensity: 0.2,
  trapDensity: 0.1,
  secretDoorChance: 0.1,
};

// HexMetaV2: Narrative tone assignments by room type and environment
const ROOM_NARRATIVE_TONES: Record<Room["type"], NarrativeTone[]> = {
  entrance: ["Benevolent", "Sacred", "Ancient"],
  exit: ["Unstable", "Sealed", "Watched"],
  treasure: ["Watched", "Sealed", "Ancient"],
  boss: ["Hostile", "Cursed", "Watched"],
  standard: ["Forgotten", "Whispering", "Ancient", "Unstable"],
};

const ENVIRONMENT_TONES: Record<MapEnvironment, NarrativeTone[]> = {
  dungeon: ["Whispering", "Cursed", "Forgotten", "Watched"],
  forest: ["Whispering", "Sacred", "Benevolent", "Ancient"],
  cave: ["Unstable", "Forgotten", "Sealed", "Cursed"],
  castle: ["Watched", "Ancient", "Hostile", "Sacred"],
  ruins: ["Forgotten", "Ancient", "Cursed", "Whispering"],
  swamp: ["Cursed", "Hostile", "Unstable", "Whispering"],
  mountain: ["Sacred", "Ancient", "Unstable", "Watched"],
  desert: ["Forgotten", "Ancient", "Sealed", "Cursed"],
  town: ["Watched", "Benevolent", "Whispering", "Hostile"],
  underground: ["Sealed", "Cursed", "Forgotten", "Whispering"],
};

// Environment tags by environment type
const ENVIRONMENT_TAG_POOLS: Record<MapEnvironment, EnvironmentTag[]> = {
  dungeon: ["dusty", "torch-lit", "ancient-stone", "blood-stained", "rune-carved"],
  forest: ["overgrown", "sunlit", "living-wood", "moss-covered", "moonlit"],
  cave: ["crystalline", "dark", "waterlogged", "ancient-stone", "moss-covered"],
  castle: ["ancient-stone", "torch-lit", "dusty", "rune-carved", "blood-stained"],
  ruins: ["overgrown", "ancient-stone", "dusty", "moss-covered", "corrupted"],
  swamp: ["waterlogged", "overgrown", "corrupted", "dark", "moss-covered"],
  mountain: ["frost-touched", "sunlit", "ancient-stone", "dark", "crystalline"],
  desert: ["sunlit", "dusty", "ash-covered", "ancient-stone", "rune-carved"],
  town: ["torch-lit", "dusty", "ancient-stone", "sunlit", "moonlit"],
  underground: ["dark", "crystalline", "corrupted", "waterlogged", "rune-carved"],
};

// Generate region names by environment
const REGION_NAME_PARTS: Record<MapEnvironment, { prefixes: string[]; suffixes: string[] }> = {
  dungeon: { prefixes: ["The", "Old", "Dark"], suffixes: ["Hall", "Chamber", "Vault", "Passage", "Gallery"] },
  forest: { prefixes: ["The", "Ancient", "Twilight"], suffixes: ["Glade", "Grove", "Clearing", "Hollow", "Dell"] },
  cave: { prefixes: ["The", "Deep", "Crystal"], suffixes: ["Grotto", "Hollow", "Pool", "Chamber", "Chasm"] },
  castle: { prefixes: ["The", "Royal", "Great"], suffixes: ["Hall", "Chamber", "Gallery", "Throne Room", "Armory"] },
  ruins: { prefixes: ["The", "Fallen", "Lost"], suffixes: ["Sanctuary", "Altar", "Hall", "Archive", "Shrine"] },
  swamp: { prefixes: ["The", "Murky", "Still"], suffixes: ["Pool", "Mire", "Crossing", "Shallows", "Bog"] },
  mountain: { prefixes: ["The", "High", "Wind-swept"], suffixes: ["Ledge", "Peak", "Pass", "Outlook", "Ridge"] },
  desert: { prefixes: ["The", "Burning", "Lost"], suffixes: ["Oasis", "Dunes", "Wastes", "Sands", "Plateau"] },
  town: { prefixes: ["The", "Old", "Hidden"], suffixes: ["Square", "Alley", "Market", "Quarter", "Lane"] },
  underground: { prefixes: ["The", "Deep", "Forgotten"], suffixes: ["Depths", "Passage", "Cavern", "Abyss", "Void"] },
};

// Generate affordances based on room type
function generateAffordances(roomType: Room["type"], tileType: TileType): HexAffordances {
  const base: HexAffordances = { exploration: 2, social: 1, investigation: 2, puzzle: 1, combat: 2 };
  
  switch (roomType) {
    case "entrance":
      return { exploration: 3, social: 4, investigation: 2, puzzle: 1, combat: 1 };
    case "exit":
      return { exploration: 4, social: 2, investigation: 3, puzzle: 2, combat: 2 };
    case "treasure":
      return { exploration: 2, social: 1, investigation: 5, puzzle: 4, combat: 2 };
    case "boss":
      return { exploration: 1, social: 2, investigation: 2, puzzle: 1, combat: 5 };
    case "standard":
    default:
      // Vary based on tile type
      if (tileType === "treasure") return { exploration: 2, social: 1, investigation: 5, puzzle: 3, combat: 1 };
      if (tileType === "trap") return { exploration: 3, social: 0, investigation: 4, puzzle: 4, combat: 1 };
      if (tileType === "door" || tileType === "door_locked") return { exploration: 4, social: 2, investigation: 3, puzzle: 2, combat: 1 };
      return base;
  }
}

// Assign importance type based on room and position
function assignImportanceType(room: Room, isCenter: boolean, tileType: TileType): HexImportanceType {
  if (room.type === "boss" && isCenter) return "Risk";
  if (room.type === "treasure" && (tileType === "treasure" || isCenter)) return "Revelation";
  if (room.type === "exit" && isCenter) return "Convergence";
  if (room.type === "entrance" && isCenter) return "Sanctuary";
  if (tileType === "secret_door") return "LostKnowledge";
  if (tileType === "treasure") return "Revelation";
  return "None";
}

// Generate tooltip note based on narrative properties
function generateTooltipNote(tone: NarrativeTone, roomType: Room["type"], environment: MapEnvironment): string {
  const toneNotes: Record<NarrativeTone, string[]> = {
    "Whispering": ["Echoes of old secrets linger here.", "Something stirs at the edge of hearing.", "The shadows seem to murmur."],
    "Sacred": ["An air of reverence pervades this space.", "Old prayers still hang in the air.", "This place was once held holy."],
    "Watched": ["Unseen eyes follow your movements.", "You feel observed.", "Something is aware of your presence."],
    "Unstable": ["The ground feels uncertain.", "Reality seems thin here.", "Danger lurks in the stonework."],
    "Forgotten": ["Time has erased much from this place.", "Dust and silence reign here.", "This area has been abandoned long."],
    "Hostile": ["Malevolence permeates the air.", "This place means you harm.", "Danger is imminent."],
    "Benevolent": ["A sense of safety pervades.", "This space feels protective.", "Warmth lingers despite the cold."],
    "Sealed": ["Something was locked away here.", "Wards still hold, barely.", "An old binding persists."],
    "Cursed": ["A dark enchantment taints this place.", "Foul magic lingers.", "Something went terribly wrong here."],
    "Ancient": ["These stones have stood for ages.", "History weighs heavily here.", "The past is palpable."],
  };
  
  const notes = toneNotes[tone] || toneNotes["Forgotten"];
  return notes[randomInt(0, notes.length - 1)];
}

// Generate region name
function generateRegionName(room: Room, roomIndex: number, environment: MapEnvironment): string {
  const parts = REGION_NAME_PARTS[environment];
  const prefix = parts.prefixes[roomIndex % parts.prefixes.length];
  const suffix = parts.suffixes[randomInt(0, parts.suffixes.length - 1)];
  return `${prefix} ${suffix}`;
}

// Find which room contains a given coordinate
function findRoomContaining(rooms: Room[], x: number, y: number): { room: Room; index: number } | null {
  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    if (x >= room.x && x < room.x + room.width && y >= room.y && y < room.y + room.height) {
      return { room, index: i };
    }
  }
  return null;
}

// Assign narrative metadata to all tiles in the map
function assignNarrativeMetadataToMap(tiles: MapTile[][], rooms: Room[], environment: MapEnvironment): void {
  const impassableTypes: TileType[] = ["wall", "rock", "dense_forest", "building", "rubble", "bog", "dune"];
  
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) {
      const tile = tiles[y][x];
      
      // Skip impassable tiles
      if (impassableTypes.includes(tile.type)) continue;
      
      const roomData = findRoomContaining(rooms, x, y);
      assignNarrativeMetadata(tile, roomData?.room || null, roomData?.index || 0, environment, x, y);
    }
  }
}

// Assign narrative metadata to a tile
function assignNarrativeMetadata(
  tile: MapTile, 
  room: Room | null, 
  roomIndex: number,
  environment: MapEnvironment,
  x: number, 
  y: number
): void {
  if (!room) {
    // Corridor tiles get simpler metadata
    tile.narrative = {
      narrativeTone: ENVIRONMENT_TONES[environment][randomInt(0, ENVIRONMENT_TONES[environment].length - 1)],
      hexState: "Dormant",
      importanceType: "None",
      affordances: { exploration: 3, social: 1, investigation: 2, puzzle: 1, combat: 2 },
      tension: randomInt(10, 30),
      environmentTags: [ENVIRONMENT_TAG_POOLS[environment][randomInt(0, ENVIRONMENT_TAG_POOLS[environment].length - 1)]],
    };
    return;
  }
  
  const isCenter = x === room.centerX && y === room.centerY;
  const distFromCenter = Math.sqrt(Math.pow(x - room.centerX, 2) + Math.pow(y - room.centerY, 2));
  
  // Blend room type tones with environment tones
  const roomTones = ROOM_NARRATIVE_TONES[room.type];
  const envTones = ENVIRONMENT_TONES[environment];
  const allTones = [...roomTones, ...envTones];
  const tone = allTones[randomInt(0, allTones.length - 1)];
  
  // Assign environment tags (1-2 per tile)
  const numTags = randomInt(1, 2);
  const tagPool = ENVIRONMENT_TAG_POOLS[environment];
  const tags: EnvironmentTag[] = [];
  for (let i = 0; i < numTags; i++) {
    const tag = tagPool[randomInt(0, tagPool.length - 1)];
    if (!tags.includes(tag)) tags.push(tag);
  }
  
  // Calculate tension based on room type and distance from center
  let baseTension = 20;
  if (room.type === "boss") baseTension = 70;
  else if (room.type === "treasure") baseTension = 50;
  else if (room.type === "exit") baseTension = 40;
  else if (room.type === "entrance") baseTension = 10;
  
  const tension = Math.min(100, Math.max(0, baseTension + randomInt(-10, 10) + Math.floor(distFromCenter * 5)));
  
  tile.narrative = {
    narrativeTone: tone,
    hexState: room.type === "boss" ? "Active" : (room.type === "entrance" ? "Dormant" : "Stirring"),
    importanceType: assignImportanceType(room, isCenter, tile.type),
    affordances: generateAffordances(room.type, tile.type),
    tension,
    environmentTags: tags,
    regionName: isCenter ? generateRegionName(room, roomIndex, environment) : undefined,
    tooltipNote: isCenter || distFromCenter < 2 ? generateTooltipNote(tone, room.type, environment) : undefined,
    glowIntensity: isCenter ? 0.6 : (distFromCenter < 2 ? 0.3 : 0),
  };
}

export function generateDungeon(config: Partial<DungeonConfig> = {}): DungeonMapData {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Detect environment from name if not specified
  const environment = cfg.environment || detectEnvironmentFromName(cfg.dungeonName);
  const envTiles = ENVIRONMENT_TILES[environment];
  
  // Initialize tiles with environment-appropriate impassable tiles
  const tiles: MapTile[][] = [];
  for (let y = 0; y < cfg.height; y++) {
    const row: MapTile[] = [];
    for (let x = 0; x < cfg.width; x++) {
      row.push({
        type: envTiles.impassable,
        explored: false,
        visible: false,
      });
    }
    tiles.push(row);
  }

  const rooms: Room[] = [];
  
  // Generate rooms using BSP-inspired approach
  for (let attempt = 0; attempt < cfg.maxRooms * 3; attempt++) {
    if (rooms.length >= cfg.maxRooms) break;
    
    const roomWidth = randomInt(cfg.minRoomSize, cfg.maxRoomSize);
    const roomHeight = randomInt(cfg.minRoomSize, cfg.maxRoomSize);
    const roomX = randomInt(1, cfg.width - roomWidth - 1);
    const roomY = randomInt(1, cfg.height - roomHeight - 1);
    
    // Check for overlaps
    let overlaps = false;
    for (const room of rooms) {
      if (roomsOverlap(
        { x: roomX, y: roomY, width: roomWidth, height: roomHeight },
        room,
        2 // Padding between rooms
      )) {
        overlaps = true;
        break;
      }
    }
    
    if (!overlaps) {
      const newRoom: Room = {
        x: roomX,
        y: roomY,
        width: roomWidth,
        height: roomHeight,
        centerX: Math.floor(roomX + roomWidth / 2),
        centerY: Math.floor(roomY + roomHeight / 2),
        type: "standard",
      };
      
      rooms.push(newRoom);
      carveRoom(tiles, newRoom, envTiles.passable);
    }
  }
  
  // Designate special rooms
  if (rooms.length > 0) {
    rooms[0].type = "entrance";
  }
  if (rooms.length > 1) {
    rooms[rooms.length - 1].type = "exit";
    tiles[rooms[rooms.length - 1].centerY][rooms[rooms.length - 1].centerX] = {
      type: "stairs_down",
      explored: false,
      visible: false,
    };
  }
  if (rooms.length > 2) {
    // Find room furthest from entrance for boss
    let maxDist = 0;
    let bossRoomIndex = 1;
    for (let i = 1; i < rooms.length - 1; i++) {
      const dist = distance(rooms[0], rooms[i]);
      if (dist > maxDist) {
        maxDist = dist;
        bossRoomIndex = i;
      }
    }
    rooms[bossRoomIndex].type = "boss";
    
    // Treasure room near exit
    if (rooms.length > 3) {
      rooms[rooms.length - 2].type = "treasure";
    }
  }
  
  // Connect rooms with corridors
  for (let i = 1; i < rooms.length; i++) {
    const prevRoom = rooms[i - 1];
    const currentRoom = rooms[i];
    
    // Use L-shaped corridors
    if (Math.random() < 0.5) {
      // Horizontal first, then vertical
      carveHorizontalCorridor(tiles, prevRoom.centerX, currentRoom.centerX, prevRoom.centerY, envTiles);
      carveVerticalCorridor(tiles, prevRoom.centerY, currentRoom.centerY, currentRoom.centerX, envTiles);
    } else {
      // Vertical first, then horizontal
      carveVerticalCorridor(tiles, prevRoom.centerY, currentRoom.centerY, prevRoom.centerX, envTiles);
      carveHorizontalCorridor(tiles, prevRoom.centerX, currentRoom.centerX, currentRoom.centerY, envTiles);
    }
  }
  
  // Add doors at room entrances
  placeDoors(tiles, rooms, cfg.secretDoorChance || 0.1, envTiles.door);
  
  // Add traps/hazards using environment-specific hazard
  placeTraps(tiles, rooms, cfg.trapDensity || 0.1, envTiles.hazard || "trap");
  
  // Add treasure
  placeTreasure(tiles, rooms);
  
  // Add environmental decorations
  addEnvironmentalDecorations(tiles, rooms, envTiles);
  
  // HexMetaV2: Assign narrative metadata to all tiles
  assignNarrativeMetadataToMap(tiles, rooms, environment);
  
  // Generate entities with environment context
  const entities = generateEntities(rooms, cfg, environment);
  
  // Player starts in entrance room
  const startRoom = rooms[0];
  const playerPosition = { x: startRoom.centerX, y: startRoom.centerY };
  
  // Reveal starting room
  revealArea(tiles, playerPosition.x, playerPosition.y, 3);
  
  return {
    width: cfg.width,
    height: cfg.height,
    tiles,
    entities,
    playerPosition,
    name: cfg.dungeonName || generateDungeonName(environment),
    level: cfg.dungeonLevel || 1,
    environment,
  };
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function roomsOverlap(a: { x: number; y: number; width: number; height: number }, b: Room, padding: number): boolean {
  return (
    a.x - padding < b.x + b.width &&
    a.x + a.width + padding > b.x &&
    a.y - padding < b.y + b.height &&
    a.y + a.height + padding > b.y
  );
}

function distance(a: Room, b: Room): number {
  return Math.sqrt(Math.pow(a.centerX - b.centerX, 2) + Math.pow(a.centerY - b.centerY, 2));
}

function carveRoom(tiles: MapTile[][], room: Room, floorType: TileType): void {
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      tiles[y][x] = {
        type: floorType,
        explored: false,
        visible: false,
      };
    }
  }
}

function carveHorizontalCorridor(tiles: MapTile[][], x1: number, x2: number, y: number, envTiles: typeof ENVIRONMENT_TILES[MapEnvironment]): void {
  const start = Math.min(x1, x2);
  const end = Math.max(x1, x2);
  const impassableTypes: TileType[] = ["wall", "rock", "dense_forest", "building", "rubble", "bog", "dune"];
  
  for (let x = start; x <= end; x++) {
    if (impassableTypes.includes(tiles[y][x].type)) {
      tiles[y][x] = {
        type: envTiles.corridor,
        explored: false,
        visible: false,
      };
    }
  }
}

function carveVerticalCorridor(tiles: MapTile[][], y1: number, y2: number, x: number, envTiles: typeof ENVIRONMENT_TILES[MapEnvironment]): void {
  const start = Math.min(y1, y2);
  const end = Math.max(y1, y2);
  const impassableTypes: TileType[] = ["wall", "rock", "dense_forest", "building", "rubble", "bog", "dune"];
  
  for (let y = start; y <= end; y++) {
    if (impassableTypes.includes(tiles[y][x].type)) {
      tiles[y][x] = {
        type: envTiles.corridor,
        explored: false,
        visible: false,
      };
    }
  }
}

function placeDoors(tiles: MapTile[][], rooms: Room[], secretDoorChance: number, doorType: TileType): void {
  const passableTypes: TileType[] = ["floor", "grass", "road", "path", "sand", "mud", "corridor"];
  
  for (const room of rooms) {
    const borders = [
      ...Array.from({ length: room.width }, (_, i) => ({ x: room.x + i, y: room.y - 1 })), // Top
      ...Array.from({ length: room.width }, (_, i) => ({ x: room.x + i, y: room.y + room.height })), // Bottom
      ...Array.from({ length: room.height }, (_, i) => ({ x: room.x - 1, y: room.y + i })), // Left
      ...Array.from({ length: room.height }, (_, i) => ({ x: room.x + room.width, y: room.y + i })), // Right
    ];
    
    for (const pos of borders) {
      if (pos.x > 0 && pos.x < tiles[0].length - 1 && pos.y > 0 && pos.y < tiles.length - 1) {
        const tile = tiles[pos.y][pos.x];
        if (passableTypes.includes(tile.type)) {
          if (Math.random() < 0.5) {
            const finalDoorType: TileType = Math.random() < secretDoorChance ? "secret_door" : doorType;
            tiles[pos.y][pos.x] = {
              type: finalDoorType,
              explored: false,
              visible: false,
            };
          }
        }
      }
    }
  }
}

function placeTraps(tiles: MapTile[][], rooms: Room[], trapDensity: number, hazardType: TileType): void {
  const passableTypes: TileType[] = ["floor", "grass", "road", "path", "sand", "mud", "corridor"];
  
  for (const room of rooms) {
    if (room.type === "entrance" || room.type === "exit") continue;
    
    const numTraps = Math.floor((room.width * room.height) * trapDensity * 0.5);
    for (let i = 0; i < numTraps; i++) {
      const x = randomInt(room.x + 1, room.x + room.width - 2);
      const y = randomInt(room.y + 1, room.y + room.height - 2);
      
      if (passableTypes.includes(tiles[y][x].type) && 
          !(x === room.centerX && y === room.centerY)) {
        tiles[y][x] = {
          type: hazardType,
          explored: false,
          visible: false,
        };
      }
    }
  }
}

function addEnvironmentalDecorations(tiles: MapTile[][], rooms: Room[], envTiles: typeof ENVIRONMENT_TILES[MapEnvironment]): void {
  if (!envTiles.decoration || envTiles.decoration.length === 0) return;
  
  const passableTypes: TileType[] = ["floor", "grass", "road", "path", "sand", "mud", "corridor"];
  
  for (const room of rooms) {
    if (room.type === "entrance") continue;
    
    const numDecorations = randomInt(1, 3);
    for (let i = 0; i < numDecorations; i++) {
      const x = randomInt(room.x, room.x + room.width - 1);
      const y = randomInt(room.y, room.y + room.height - 1);
      
      if (passableTypes.includes(tiles[y][x].type) && 
          !(x === room.centerX && y === room.centerY)) {
        const decoration = envTiles.decoration[randomInt(0, envTiles.decoration.length - 1)];
        if (decoration !== "water" && decoration !== "underground_lake") {
          tiles[y][x] = {
            type: decoration,
            explored: false,
            visible: false,
          };
        }
      }
    }
  }
}

function placeTreasure(tiles: MapTile[][], rooms: Room[]): void {
  const passableTypes: TileType[] = ["floor", "grass", "road", "path", "sand", "mud", "corridor"];
  
  for (const room of rooms) {
    if (room.type === "treasure" || room.type === "boss") {
      const corners = [
        { x: room.x + 1, y: room.y + 1 },
        { x: room.x + room.width - 2, y: room.y + 1 },
        { x: room.x + 1, y: room.y + room.height - 2 },
        { x: room.x + room.width - 2, y: room.y + room.height - 2 },
      ];
      
      const corner = corners[randomInt(0, corners.length - 1)];
      if (passableTypes.includes(tiles[corner.y][corner.x].type)) {
        tiles[corner.y][corner.x] = {
          type: "treasure",
          explored: false,
          visible: false,
        };
      }
    }
  }
}

// Environment-specific enemy names
const ENVIRONMENT_ENEMIES: Record<MapEnvironment, { regular: string[]; boss: string[] }> = {
  dungeon: {
    regular: ["Goblin", "Orc", "Skeleton", "Zombie", "Kobold", "Hobgoblin", "Bugbear", "Gnoll"],
    boss: ["Ogre", "Vampire", "Lich", "Mummy Lord", "Wight Lord", "Young Dragon"],
  },
  forest: {
    regular: ["Wolf", "Giant Spider", "Owlbear Cub", "Satyr", "Dryad", "Pixie", "Bandit", "Dire Wolf"],
    boss: ["Owlbear", "Treant", "Giant Eagle", "Unicorn", "Green Hag"],
  },
  cave: {
    regular: ["Bat Swarm", "Giant Rat", "Cave Fisher", "Troglodyte", "Piercer", "Darkmantle"],
    boss: ["Cave Bear", "Cloaker", "Roper", "Purple Worm", "Xorn"],
  },
  castle: {
    regular: ["Guard", "Knight", "Cultist", "Animated Armor", "Flying Sword", "Specter"],
    boss: ["Death Knight", "Wraith Lord", "Vampire Spawn", "Banshee"],
  },
  ruins: {
    regular: ["Skeleton", "Ghoul", "Shadow", "Specter", "Will-o-Wisp", "Gargoyle"],
    boss: ["Mummy Lord", "Wraith", "Bone Naga", "Stone Golem"],
  },
  swamp: {
    regular: ["Giant Frog", "Crocodile", "Lizardfolk", "Poisonous Snake", "Shambling Mound"],
    boss: ["Black Dragon Wyrmling", "Hydra", "Froghemoth", "Green Hag"],
  },
  mountain: {
    regular: ["Harpy", "Griffon", "Giant Goat", "Peryton", "Stone Giant"],
    boss: ["Roc", "Cloud Giant", "Adult Dragon", "Storm Giant"],
  },
  desert: {
    regular: ["Giant Scorpion", "Dust Mephit", "Jackalwere", "Mummy", "Sphinx"],
    boss: ["Blue Dragon Wyrmling", "Mummy Lord", "Giant Sandworm", "Lamia"],
  },
  town: {
    regular: ["Thug", "Bandit", "Spy", "Assassin", "Cultist", "Wererat"],
    boss: ["Bandit Captain", "Assassin Leader", "Crime Lord", "Vampire Spawn"],
  },
  underground: {
    regular: ["Duergar", "Myconid", "Hook Horror", "Grick", "Grimlock"],
    boss: ["Elder Brain", "Drow Matron", "Aboleth", "Purple Worm"],
  },
};

function generateEntities(rooms: Room[], cfg: DungeonConfig, environment: MapEnvironment): MapEntity[] {
  const entities: MapEntity[] = [];
  const envEnemies = ENVIRONMENT_ENEMIES[environment];
  
  for (const room of rooms) {
    if (room.type === "entrance") continue;
    
    if (room.type === "boss") {
      entities.push({
        id: `boss-${room.centerX}-${room.centerY}`,
        type: "boss",
        name: envEnemies.boss[randomInt(0, envEnemies.boss.length - 1)],
        x: room.centerX,
        y: room.centerY,
        hp: randomInt(50, 80),
        maxHp: 80,
      });
    } else if (room.type !== "treasure") {
      const numEnemies = Math.random() < (cfg.enemyDensity || 0.4) ? randomInt(1, 3) : 0;
      
      for (let i = 0; i < numEnemies; i++) {
        const x = randomInt(room.x + 1, room.x + room.width - 2);
        const y = randomInt(room.y + 1, room.y + room.height - 2);
        
        if (x !== room.centerX || y !== room.centerY) {
          entities.push({
            id: `enemy-${x}-${y}`,
            type: "enemy",
            name: envEnemies.regular[randomInt(0, envEnemies.regular.length - 1)],
            x,
            y,
            hp: randomInt(10, 25),
            maxHp: 25,
          });
        }
      }
    }
  }
  
  return entities;
}

function revealArea(tiles: MapTile[][], centerX: number, centerY: number, radius: number): void {
  for (let y = Math.max(0, centerY - radius); y <= Math.min(tiles.length - 1, centerY + radius); y++) {
    for (let x = Math.max(0, centerX - radius); x <= Math.min(tiles[0].length - 1, centerX + radius); x++) {
      const dist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
      if (dist <= radius) {
        tiles[y][x].explored = true;
        tiles[y][x].visible = true;
      }
    }
  }
}

// Environment-specific location names
const ENVIRONMENT_NAMES: Record<MapEnvironment, { prefixes: string[]; types: string[]; suffixes: string[] }> = {
  dungeon: {
    prefixes: ["Forgotten", "Ancient", "Dark", "Cursed", "Haunted", "Lost", "Hidden", "Abandoned"],
    types: ["Crypt", "Dungeon", "Lair", "Catacombs", "Vault", "Tomb", "Maze"],
    suffixes: ["of Shadows", "of the Dead", "of Doom", "of the Damned", "of Despair", "of Secrets"],
  },
  forest: {
    prefixes: ["Whispering", "Enchanted", "Ancient", "Shadowed", "Misty", "Twilight", "Wild"],
    types: ["Woods", "Grove", "Glade", "Thicket", "Forest", "Woodland", "Copse"],
    suffixes: ["of Whispers", "of the Fey", "of Eternal Night", "of the Ancients", "of Lost Souls"],
  },
  cave: {
    prefixes: ["Deep", "Crystal", "Echoing", "Dark", "Hidden", "Frozen", "Glowing"],
    types: ["Cavern", "Grotto", "Cave", "Hollow", "Chasm", "Tunnel", "Den"],
    suffixes: ["of Echoes", "of the Deep", "of Crystals", "of Shadows", "of the Lost"],
  },
  castle: {
    prefixes: ["Fallen", "Haunted", "Ancient", "Crumbling", "Iron", "Shadow", "Storm"],
    types: ["Castle", "Keep", "Fortress", "Citadel", "Stronghold", "Tower", "Bastion"],
    suffixes: ["of Kings", "of Sorrow", "of the Damned", "of Storms", "of Shadows"],
  },
  ruins: {
    prefixes: ["Forgotten", "Crumbling", "Ancient", "Cursed", "Lost", "Sacred", "Sunken"],
    types: ["Ruins", "Temple", "Shrine", "Monastery", "Cathedral", "Palace", "Altar"],
    suffixes: ["of the Fallen", "of Ages Past", "of the Gods", "of Sacrifice", "of Power"],
  },
  swamp: {
    prefixes: ["Murky", "Festering", "Haunted", "Black", "Rotting", "Misty", "Cursed"],
    types: ["Swamp", "Marsh", "Bog", "Mire", "Fen", "Wetlands", "Bayou"],
    suffixes: ["of Decay", "of Shadows", "of Lost Souls", "of the Hag", "of Pestilence"],
  },
  mountain: {
    prefixes: ["Frozen", "Storm", "Thunder", "Cloud", "Iron", "Wind-swept", "Jagged"],
    types: ["Peak", "Summit", "Pass", "Ridge", "Cliff", "Heights", "Spire"],
    suffixes: ["of Giants", "of the Eagle", "of the Gods", "of Storms", "of the Winds"],
  },
  desert: {
    prefixes: ["Burning", "Lost", "Endless", "Scorching", "Golden", "Silent", "Ancient"],
    types: ["Sands", "Dunes", "Wastes", "Expanse", "Desert", "Badlands", "Oasis"],
    suffixes: ["of the Sun", "of Mirages", "of the Pharaoh", "of Bones", "of Fire"],
  },
  town: {
    prefixes: ["Shadowy", "Bustling", "Quiet", "Hidden", "Old", "Midnight", "Forgotten"],
    types: ["District", "Quarter", "Streets", "Market", "Ward", "Alley", "Square"],
    suffixes: ["of Thieves", "of Whispers", "of the Night", "of Secrets", "of Intrigue"],
  },
  underground: {
    prefixes: ["Deep", "Dark", "Forgotten", "Eternal", "Abyssal", "Shadow", "Lost"],
    types: ["Depths", "Underdark", "Tunnels", "Abyss", "Underworld", "Caverns", "Labyrinth"],
    suffixes: ["of Darkness", "of the Void", "of Nightmares", "of the Deep", "of Silence"],
  },
};

function generateDungeonName(environment: MapEnvironment): string {
  const names = ENVIRONMENT_NAMES[environment];
  
  const prefix = names.prefixes[randomInt(0, names.prefixes.length - 1)];
  const type = names.types[randomInt(0, names.types.length - 1)];
  const suffix = Math.random() < 0.5 ? ` ${names.suffixes[randomInt(0, names.suffixes.length - 1)]}` : "";
  
  return `The ${prefix} ${type}${suffix}`;
}

export function updateVisibility(mapData: DungeonMapData, viewRadius: number = 4): DungeonMapData {
  const { tiles, playerPosition } = mapData;
  const newTiles = tiles.map((row, y) =>
    row.map((tile, x) => {
      const dist = Math.sqrt(
        Math.pow(x - playerPosition.x, 2) + Math.pow(y - playerPosition.y, 2)
      );
      
      if (dist <= viewRadius) {
        return { ...tile, explored: true, visible: true };
      } else if (tile.explored) {
        return { ...tile, visible: false };
      }
      return tile;
    })
  );
  
  return { ...mapData, tiles: newTiles };
}

export function canMoveTo(mapData: DungeonMapData, x: number, y: number): boolean {
  if (x < 0 || x >= mapData.width || y < 0 || y >= mapData.height) {
    return false;
  }
  
  const tile = mapData.tiles[y][x];
  const blockingTypes: TileType[] = [
    "wall", "pit", "lava",
    "dense_forest", "building", "rock", "dune", "bog",
    "fence", "tree"
  ];
  
  return !blockingTypes.includes(tile.type);
}

export function movePlayer(
  mapData: DungeonMapData,
  direction: "up" | "down" | "left" | "right"
): DungeonMapData {
  const { playerPosition } = mapData;
  let newX = playerPosition.x;
  let newY = playerPosition.y;
  
  switch (direction) {
    case "up":
      newY -= 1;
      break;
    case "down":
      newY += 1;
      break;
    case "left":
      newX -= 1;
      break;
    case "right":
      newX += 1;
      break;
  }
  
  if (canMoveTo(mapData, newX, newY)) {
    const newMapData = {
      ...mapData,
      playerPosition: { x: newX, y: newY },
    };
    
    return updateVisibility(newMapData);
  }
  
  return mapData;
}

export function getEntitiesInRange(mapData: DungeonMapData, range: number): MapEntity[] {
  const { entities, playerPosition } = mapData;
  
  return entities.filter((entity) => {
    const dist = Math.sqrt(
      Math.pow(entity.x - playerPosition.x, 2) + Math.pow(entity.y - playerPosition.y, 2)
    );
    return dist <= range;
  });
}
