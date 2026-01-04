import type { DungeonMapData, MapTile, MapEntity, TileType } from "./DungeonMap";

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
  enemyDensity?: number; // 0-1
  treasureDensity?: number; // 0-1
  trapDensity?: number; // 0-1
  secretDoorChance?: number; // 0-1
}

const DEFAULT_CONFIG: DungeonConfig = {
  width: 30,
  height: 20,
  minRoomSize: 4,
  maxRoomSize: 8,
  maxRooms: 8,
  enemyDensity: 0.4,
  treasureDensity: 0.2,
  trapDensity: 0.1,
  secretDoorChance: 0.1,
};

export function generateDungeon(config: Partial<DungeonConfig> = {}): DungeonMapData {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Initialize tiles with walls
  const tiles: MapTile[][] = [];
  for (let y = 0; y < cfg.height; y++) {
    const row: MapTile[] = [];
    for (let x = 0; x < cfg.width; x++) {
      row.push({
        type: "wall",
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
      carveRoom(tiles, newRoom);
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
      carveHorizontalCorridor(tiles, prevRoom.centerX, currentRoom.centerX, prevRoom.centerY);
      carveVerticalCorridor(tiles, prevRoom.centerY, currentRoom.centerY, currentRoom.centerX);
    } else {
      // Vertical first, then horizontal
      carveVerticalCorridor(tiles, prevRoom.centerY, currentRoom.centerY, prevRoom.centerX);
      carveHorizontalCorridor(tiles, prevRoom.centerX, currentRoom.centerX, currentRoom.centerY);
    }
  }
  
  // Add doors at room entrances
  placeDoors(tiles, rooms, cfg.secretDoorChance || 0.1);
  
  // Add traps
  placeTraps(tiles, rooms, cfg.trapDensity || 0.1);
  
  // Add treasure
  placeTreasure(tiles, rooms);
  
  // Generate entities
  const entities = generateEntities(rooms, cfg);
  
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
    name: cfg.dungeonName || generateDungeonName(),
    level: cfg.dungeonLevel || 1,
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

function carveRoom(tiles: MapTile[][], room: Room): void {
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      tiles[y][x] = {
        type: "floor",
        explored: false,
        visible: false,
      };
    }
  }
}

function carveHorizontalCorridor(tiles: MapTile[][], x1: number, x2: number, y: number): void {
  const start = Math.min(x1, x2);
  const end = Math.max(x1, x2);
  for (let x = start; x <= end; x++) {
    if (tiles[y][x].type === "wall") {
      tiles[y][x] = {
        type: "floor",
        explored: false,
        visible: false,
      };
    }
  }
}

function carveVerticalCorridor(tiles: MapTile[][], y1: number, y2: number, x: number): void {
  const start = Math.min(y1, y2);
  const end = Math.max(y1, y2);
  for (let y = start; y <= end; y++) {
    if (tiles[y][x].type === "wall") {
      tiles[y][x] = {
        type: "floor",
        explored: false,
        visible: false,
      };
    }
  }
}

function placeDoors(tiles: MapTile[][], rooms: Room[], secretDoorChance: number): void {
  for (const room of rooms) {
    // Check all border cells for corridor connections
    const borders = [
      ...Array.from({ length: room.width }, (_, i) => ({ x: room.x + i, y: room.y - 1 })), // Top
      ...Array.from({ length: room.width }, (_, i) => ({ x: room.x + i, y: room.y + room.height })), // Bottom
      ...Array.from({ length: room.height }, (_, i) => ({ x: room.x - 1, y: room.y + i })), // Left
      ...Array.from({ length: room.height }, (_, i) => ({ x: room.x + room.width, y: room.y + i })), // Right
    ];
    
    for (const pos of borders) {
      if (pos.x > 0 && pos.x < tiles[0].length - 1 && pos.y > 0 && pos.y < tiles.length - 1) {
        const tile = tiles[pos.y][pos.x];
        if (tile.type === "floor") {
          // This is a corridor entrance - place a door
          if (Math.random() < 0.5) {
            const doorType: TileType = Math.random() < secretDoorChance ? "secret_door" : "door";
            tiles[pos.y][pos.x] = {
              type: doorType,
              explored: false,
              visible: false,
            };
          }
        }
      }
    }
  }
}

function placeTraps(tiles: MapTile[][], rooms: Room[], trapDensity: number): void {
  for (const room of rooms) {
    if (room.type === "entrance" || room.type === "exit") continue;
    
    const numTraps = Math.floor((room.width * room.height) * trapDensity * 0.5);
    for (let i = 0; i < numTraps; i++) {
      const x = randomInt(room.x + 1, room.x + room.width - 2);
      const y = randomInt(room.y + 1, room.y + room.height - 2);
      
      if (tiles[y][x].type === "floor" && 
          !(x === room.centerX && y === room.centerY)) {
        tiles[y][x] = {
          type: "trap",
          explored: false,
          visible: false,
        };
      }
    }
  }
}

function placeTreasure(tiles: MapTile[][], rooms: Room[]): void {
  for (const room of rooms) {
    if (room.type === "treasure" || room.type === "boss") {
      // Place treasure in corner
      const corners = [
        { x: room.x + 1, y: room.y + 1 },
        { x: room.x + room.width - 2, y: room.y + 1 },
        { x: room.x + 1, y: room.y + room.height - 2 },
        { x: room.x + room.width - 2, y: room.y + room.height - 2 },
      ];
      
      const corner = corners[randomInt(0, corners.length - 1)];
      if (tiles[corner.y][corner.x].type === "floor") {
        tiles[corner.y][corner.x] = {
          type: "treasure",
          explored: false,
          visible: false,
        };
      }
    }
  }
}

function generateEntities(rooms: Room[], cfg: DungeonConfig): MapEntity[] {
  const entities: MapEntity[] = [];
  const enemyNames = ["Goblin", "Orc", "Skeleton", "Zombie", "Kobold", "Hobgoblin", "Bugbear", "Gnoll"];
  const bossNames = ["Ogre Chief", "Vampire Lord", "Necromancer", "Beholder", "Mind Flayer", "Dragon Wyrmling"];
  
  for (const room of rooms) {
    if (room.type === "entrance") continue;
    
    if (room.type === "boss") {
      // Place boss enemy
      entities.push({
        id: `boss-${room.centerX}-${room.centerY}`,
        type: "boss",
        name: bossNames[randomInt(0, bossNames.length - 1)],
        x: room.centerX,
        y: room.centerY,
        hp: randomInt(50, 80),
        maxHp: 80,
      });
    } else if (room.type !== "treasure") {
      // Regular enemies
      const numEnemies = Math.random() < (cfg.enemyDensity || 0.4) ? randomInt(1, 3) : 0;
      
      for (let i = 0; i < numEnemies; i++) {
        const x = randomInt(room.x + 1, room.x + room.width - 2);
        const y = randomInt(room.y + 1, room.y + room.height - 2);
        
        // Don't place enemy in center (reserved for player movement)
        if (x !== room.centerX || y !== room.centerY) {
          entities.push({
            id: `enemy-${x}-${y}`,
            type: "enemy",
            name: enemyNames[randomInt(0, enemyNames.length - 1)],
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

function generateDungeonName(): string {
  const prefixes = ["Forgotten", "Ancient", "Dark", "Cursed", "Haunted", "Lost", "Hidden", "Abandoned"];
  const types = ["Crypt", "Dungeon", "Lair", "Cavern", "Catacombs", "Vault", "Tomb", "Maze"];
  const suffixes = ["of Shadows", "of the Dead", "of Doom", "of the Damned", "of Despair", "of Secrets"];
  
  const prefix = prefixes[randomInt(0, prefixes.length - 1)];
  const type = types[randomInt(0, types.length - 1)];
  const suffix = Math.random() < 0.5 ? ` ${suffixes[randomInt(0, suffixes.length - 1)]}` : "";
  
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
  const blockingTypes: TileType[] = ["wall", "pit", "lava"];
  
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
