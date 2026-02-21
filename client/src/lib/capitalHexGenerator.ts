export interface CapitalHex {
  q: number;
  r: number;
  terrain: CapitalTerrainType;
  districtId: string;
  districtName: string;
  buildingId?: string;
  buildingName?: string;
  buildingType?: string;
  isStreet: boolean;
  isWall: boolean;
  isGate: boolean;
  gateName?: string;
}

export type CapitalTerrainType =
  | "cobblestone" | "plaza" | "garden" | "courtyard"
  | "market_ground" | "dock" | "canal" | "alley"
  | "rubble" | "cemetery" | "park" | "fountain"
  | "bridge" | "wall" | "gate";

export interface CapitalBuilding {
  id: string;
  name: string;
  type: string;
  description: string;
  q: number;
  r: number;
  district: string;
  districtName: string;
  services: string[];
  npcHint?: string;
}

export interface CapitalDistrict {
  id: string;
  name: string;
  description: string;
  centerQ: number;
  centerR: number;
  radius: number;
  color: string;
}

export interface CapitalHexLayout {
  gridWidth: number;
  gridHeight: number;
  hexes: CapitalHex[];
  buildings: CapitalBuilding[];
  districts: CapitalDistrict[];
  spawnQ: number;
  spawnR: number;
}

export const CAPITAL_TERRAIN_COLORS: Record<CapitalTerrainType, string> = {
  cobblestone: "#4a4540",
  plaza: "#5c564e",
  garden: "#2d5a2d",
  courtyard: "#504a3e",
  market_ground: "#6b5e3e",
  dock: "#3a5060",
  canal: "#2a4a6a",
  alley: "#3a3530",
  rubble: "#555048",
  cemetery: "#3a4030",
  park: "#3a6a3a",
  fountain: "#3a5a7a",
  bridge: "#5a5040",
  wall: "#6a6050",
  gate: "#8a7050",
};

export const CAPITAL_TERRAIN_LABELS: Record<CapitalTerrainType, string> = {
  cobblestone: "Cobblestone Street",
  plaza: "Open Plaza",
  garden: "Ornamental Garden",
  courtyard: "Stone Courtyard",
  market_ground: "Market Square",
  dock: "Wooden Dock",
  canal: "City Canal",
  alley: "Narrow Alley",
  rubble: "Ancient Rubble",
  cemetery: "Old Cemetery",
  park: "Public Park",
  fountain: "City Fountain",
  bridge: "Stone Bridge",
  wall: "City Wall",
  gate: "City Gate",
};

const GRID_W = 30;
const GRID_H = 30;

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const DISTRICT_DEFS = [
  { name: "Royal Quarter", desc: "Towering spires and marble halls house the seat of power.", color: "#fbbf24", terrain: "courtyard" as CapitalTerrainType },
  { name: "Grand Market", desc: "The commercial heart of the realm buzzes with trade.", color: "#f59e0b", terrain: "market_ground" as CapitalTerrainType },
  { name: "Temple Row", desc: "Sacred temples line a holy avenue of incense and prayer.", color: "#eab308", terrain: "plaza" as CapitalTerrainType },
  { name: "Thieves' Quarter", desc: "Narrow alleys wind between leaning buildings. Secrets abound.", color: "#6b7280", terrain: "alley" as CapitalTerrainType },
  { name: "Harbor Ward", desc: "Ships from distant lands crowd the docks.", color: "#3b82f6", terrain: "dock" as CapitalTerrainType },
  { name: "Artisan Heights", desc: "Master craftsmen maintain prestigious workshops here.", color: "#10b981", terrain: "cobblestone" as CapitalTerrainType },
  { name: "Scholar's Enclave", desc: "The university and libraries dominate this quiet district.", color: "#8b5cf6", terrain: "garden" as CapitalTerrainType },
  { name: "Old City", desc: "Ancient tunnels, crumbling walls, and stubborn residents.", color: "#78716c", terrain: "rubble" as CapitalTerrainType },
];

const BUILDING_DEFS = [
  { name: "The Royal Palace", type: "palace", desc: "The grand seat of the realm's sovereign.", services: ["audience", "decrees", "political_favors"], npc: "The Royal Steward", district: "Royal Quarter" },
  { name: "Royal Bank of the Realm", type: "bank", desc: "A fortified institution where the realm's wealth is stored.", services: ["deposit", "withdraw", "loans", "interest"], npc: "The Head Banker", district: "Royal Quarter" },
  { name: "Crown Estates Office", type: "real_estate", desc: "Properties throughout the capital can be purchased here.", services: ["buy_house", "sell_house", "rent", "upgrades"], npc: "A shrewd halfling estate agent", district: "Royal Quarter" },
  { name: "Royal Guard Barracks", type: "barracks", desc: "Elite soldiers who protect the crown train here.", services: ["bounties", "protection", "military_contracts"], npc: "Captain of the Royal Guard", district: "Royal Quarter" },
  { name: "The Golden Bazaar", type: "general_store", desc: "The largest general store in the realm.", services: ["supplies", "gear", "exotic_goods", "trade"], npc: "A boisterous merchant prince", district: "Grand Market" },
  { name: "Enchanted Armory", type: "magic_shop", desc: "Rare magical weapons behind shimmering wards.", services: ["magic_weapons", "magic_armor", "enchanting", "identify"], npc: "An elven arcane smith", district: "Grand Market" },
  { name: "Potioneer's Paradise", type: "apothecary", desc: "Walls lined with bubbling vials and exotic ingredients.", services: ["potions", "herbs", "custom_brews", "antidotes"], npc: "A tiefling alchemist", district: "Grand Market" },
  { name: "Curiosities & Wonders", type: "jeweler", desc: "Gemstones, enchanted trinkets, and mysterious artifacts.", services: ["gems", "appraise", "enchant", "rare_items"], npc: "A drow collector", district: "Grand Market" },
  { name: "The Auction House", type: "auction", desc: "Rare items go under the hammer weekly.", services: ["auctions", "consignment", "rare_trades"], npc: "A theatrical auctioneer", district: "Grand Market" },
  { name: "Cathedral of the Dawn", type: "temple", desc: "The grandest temple, stained glass catching sunrise.", services: ["healing", "blessings", "resurrection", "divine_guidance"], npc: "The High Priestess", district: "Temple Row" },
  { name: "Shrine of Shadows", type: "dark_temple", desc: "Followers of less conventional deities come to bargain.", services: ["dark_blessings", "curses", "forbidden_knowledge"], npc: "A hooded acolyte", district: "Temple Row" },
  { name: "The Velvet Dagger", type: "tavern", desc: "Information is the most valuable currency here.", services: ["rumors", "black_market", "assassin_contracts", "fences"], npc: "A one-eyed barkeep", district: "Thieves' Quarter" },
  { name: "Shadow Guild Hall", type: "underworld", desc: "Headquarters of the city's organized crime.", services: ["theft_contracts", "smuggling", "lockpicks", "disguises"], npc: "The Guildmaster", district: "Thieves' Quarter" },
  { name: "The Whispering Wall", type: "information_broker", desc: "Coded messages exchanged on a nondescript wall.", services: ["intelligence", "blackmail", "espionage", "rumors"], npc: "Nobody visible", district: "Thieves' Quarter" },
  { name: "The Salty Anchor", type: "tavern", desc: "The roughest tavern on the waterfront.", services: ["rest", "rumors", "recruitment", "sea_passage"], npc: "A retired pirate captain", district: "Harbor Ward" },
  { name: "Harbormaster's Office", type: "guild", desc: "All ships register here. Trade routes and cargo.", services: ["travel", "shipping", "trade_routes", "cargo"], npc: "A stern harbormaster", district: "Harbor Ward" },
  { name: "Masterwork Forge", type: "blacksmith", desc: "Finest weapons and armor crafted by guild masters.", services: ["masterwork_weapons", "masterwork_armor", "repair", "custom_orders"], npc: "A dwarven master smith", district: "Artisan Heights" },
  { name: "The Gilded Needle", type: "tailor", desc: "Fine clothing and enchanted garments.", services: ["clothing", "disguise_kits", "enchanted_garments"], npc: "A half-elf designer", district: "Artisan Heights" },
  { name: "The Grand Library", type: "library", desc: "The largest repository of knowledge in the realm.", services: ["lore", "research", "restricted_archives", "spell_scrolls"], npc: "The Head Librarian", district: "Scholar's Enclave" },
  { name: "Arcane University", type: "academy", desc: "Aspiring wizards study the arcane arts here.", services: ["training", "spell_research", "arcane_consulting"], npc: "The Archmage Provost", district: "Scholar's Enclave" },
  { name: "The Ratskeller", type: "tavern", desc: "A centuries-old tavern in a crumbling tower basement.", services: ["rest", "rumors", "underground_access", "food"], npc: "An ageless gnome barkeep", district: "Old City" },
  { name: "Undercity Entrance", type: "dungeon_entrance", desc: "A gated passage to old sewers and catacombs.", services: ["dungeon_access", "treasure_rumors", "monster_bounties"], npc: "A scarred veteran guide", district: "Old City" },
  { name: "Stables of the Sun", type: "stables", desc: "Exotic mounts and swift horses available.", services: ["mounts", "exotic_mounts", "storage", "fast_travel"], npc: "A centaur stablemaster", district: "Old City" },
];

export function generateCapitalHexMap(seed: number): CapitalHexLayout {
  const rng = seededRandom(seed);

  const districtCenters: Array<{ q: number; r: number }> = [
    { q: 15, r: 6 },   // Royal Quarter (top center)
    { q: 8, r: 12 },   // Grand Market (left middle)
    { q: 22, r: 10 },  // Temple Row (right upper)
    { q: 5, r: 20 },   // Thieves' Quarter (bottom left)
    { q: 24, r: 22 },  // Harbor Ward (bottom right)
    { q: 15, r: 15 },  // Artisan Heights (center)
    { q: 22, r: 17 },  // Scholar's Enclave (right middle)
    { q: 10, r: 24 },  // Old City (bottom center-left)
  ];

  const districts: CapitalDistrict[] = DISTRICT_DEFS.map((d, i) => ({
    id: `district-${i}`,
    name: d.name,
    description: d.desc,
    centerQ: districtCenters[i].q,
    centerR: districtCenters[i].r,
    radius: 5 + Math.floor(rng() * 2),
    color: d.color,
  }));

  const hexes: CapitalHex[] = [];

  for (let r = 0; r < GRID_H; r++) {
    for (let q = 0; q < GRID_W; q++) {
      let closestDist = 0;
      let closestDistSq = Infinity;
      for (let i = 0; i < districts.length; i++) {
        const dq = q - districts[i].centerQ;
        const dr = r - districts[i].centerR;
        const distSq = dq * dq + dr * dr + rng() * 4;
        if (distSq < closestDistSq) {
          closestDistSq = distSq;
          closestDist = i;
        }
      }

      const distFromCenter = Math.sqrt((q - 15) * (q - 15) + (r - 15) * (r - 15));
      const isWallHex = distFromCenter >= 14 && distFromCenter <= 15;
      const isOutside = distFromCenter > 15.5;

      if (isOutside) continue;

      const isGateHex = isWallHex && (
        (q === 15 && r <= 1) ||
        (q === 15 && r >= 28) ||
        (q <= 1 && r === 15) ||
        (q >= 28 && r === 15)
      );

      const distDef = DISTRICT_DEFS[closestDist];
      let terrain: CapitalTerrainType = distDef.terrain;

      if (isWallHex && !isGateHex) {
        terrain = "wall";
      } else if (isGateHex) {
        terrain = "gate";
      } else {
        const streetChance = rng();
        if (streetChance < 0.15) {
          terrain = "cobblestone";
        } else if (streetChance < 0.2) {
          const varietyRoll = rng();
          if (varietyRoll < 0.3) terrain = "garden";
          else if (varietyRoll < 0.5) terrain = "park";
          else if (varietyRoll < 0.7) terrain = "fountain";
          else terrain = "plaza";
        }
      }

      const isStreet = terrain === "cobblestone" || terrain === "plaza" || terrain === "bridge";

      hexes.push({
        q,
        r,
        terrain,
        districtId: districts[closestDist].id,
        districtName: districts[closestDist].name,
        isStreet,
        isWall: isWallHex && !isGateHex,
        isGate: isGateHex,
        gateName: isGateHex ? getGateName(q, r) : undefined,
      });
    }
  }

  const buildings: CapitalBuilding[] = [];
  const occupiedHexes = new Set<string>();

  for (const bDef of BUILDING_DEFS) {
    const distIdx = DISTRICT_DEFS.findIndex(d => d.name === bDef.district);
    if (distIdx < 0) continue;
    const dist = districts[distIdx];

    let bestQ = dist.centerQ;
    let bestR = dist.centerR;
    let placed = false;

    for (let attempt = 0; attempt < 50; attempt++) {
      const tryQ = dist.centerQ + Math.floor((rng() - 0.5) * dist.radius * 1.5);
      const tryR = dist.centerR + Math.floor((rng() - 0.5) * dist.radius * 1.5);
      const key = `${tryQ},${tryR}`;

      const hex = hexes.find(h => h.q === tryQ && h.r === tryR);
      if (!hex || hex.isWall || hex.isGate || occupiedHexes.has(key)) continue;

      bestQ = tryQ;
      bestR = tryR;
      placed = true;
      break;
    }

    if (!placed) {
      for (let dr = -3; dr <= 3 && !placed; dr++) {
        for (let dq = -3; dq <= 3 && !placed; dq++) {
          const tryQ = dist.centerQ + dq;
          const tryR = dist.centerR + dr;
          const key = `${tryQ},${tryR}`;
          const hex = hexes.find(h => h.q === tryQ && h.r === tryR);
          if (hex && !hex.isWall && !hex.isGate && !occupiedHexes.has(key)) {
            bestQ = tryQ;
            bestR = tryR;
            placed = true;
          }
        }
      }
    }

    const key = `${bestQ},${bestR}`;
    occupiedHexes.add(key);

    const building: CapitalBuilding = {
      id: `cap-bldg-${buildings.length}`,
      name: bDef.name,
      type: bDef.type,
      description: bDef.desc,
      q: bestQ,
      r: bestR,
      district: districts[distIdx].id,
      districtName: bDef.district,
      services: bDef.services,
      npcHint: bDef.npc,
    };

    buildings.push(building);

    const hexIdx = hexes.findIndex(h => h.q === bestQ && h.r === bestR);
    if (hexIdx >= 0) {
      hexes[hexIdx].buildingId = building.id;
      hexes[hexIdx].buildingName = building.name;
      hexes[hexIdx].buildingType = building.type;
    }
  }

  const spawnGate = hexes.find(h => h.isGate && h.r <= 2);
  const spawnQ = spawnGate ? spawnGate.q : 15;
  const spawnR = spawnGate ? spawnGate.r + 1 : 2;

  return {
    gridWidth: GRID_W,
    gridHeight: GRID_H,
    hexes,
    buildings,
    districts,
    spawnQ,
    spawnR,
  };
}

function getGateName(q: number, r: number): string {
  if (r <= 1) return "North Gate — King's Highway";
  if (r >= 28) return "South Gate — Old Road";
  if (q <= 1) return "West Gate — Pilgrim's Gate";
  if (q >= 28) return "East Gate — Harbor Entrance";
  return "City Gate";
}

export function getCapitalHexNeighbors(q: number, r: number): Array<{ q: number; r: number }> {
  const isOddRow = r % 2 === 1;
  if (isOddRow) {
    return [
      { q: q + 1, r: r },
      { q: q, r: r - 1 },
      { q: q + 1, r: r - 1 },
      { q: q, r: r + 1 },
      { q: q + 1, r: r + 1 },
      { q: q - 1, r: r },
    ];
  }
  return [
    { q: q + 1, r: r },
    { q: q - 1, r: r - 1 },
    { q: q, r: r - 1 },
    { q: q - 1, r: r + 1 },
    { q: q, r: r + 1 },
    { q: q - 1, r: r },
  ];
}

export function getCapitalHexesInRadius(cq: number, cr: number, radius: number): Array<{ q: number; r: number }> {
  const result: Array<{ q: number; r: number }> = [];
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dq = -radius; dq <= radius; dq++) {
      const tq = cq + dq;
      const tr = cr + dr;
      const dist = hexDistance(cq, cr, tq, tr);
      if (dist <= radius) {
        result.push({ q: tq, r: tr });
      }
    }
  }
  return result;
}

function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  const dx = Math.abs(q2 - q1);
  const dy = Math.abs(r2 - r1);
  return Math.max(dx, dy, Math.abs(dx - dy));
}
