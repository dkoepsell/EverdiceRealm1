interface WorldRegionData {
  id: number;
  name: string;
  terrain: string;
  gridX: number;
  gridY: number;
  width: number;
  height: number;
  color: string;
  dangerLevel?: number;
}

interface WorldLocationData {
  id: number;
  regionId: number;
  name: string;
  locationType: string;
  posX: number;
  posY: number;
}

export interface WorldHex {
  q: number;
  r: number;
  terrain: TerrainType;
  regionId: number;
  regionName: string;
  locationId?: number;
  locationName?: string;
  locationType?: string;
  elevation: number;
  moisture: number;
  isRiver: boolean;
  isRoad: boolean;
  isCoast: boolean;
  isBorder: boolean;
}

export type TerrainType =
  | "deep_water" | "shallow_water" | "beach"
  | "plains" | "grassland" | "farmland"
  | "forest" | "dense_forest" | "enchanted_forest"
  | "hills" | "foothills"
  | "mountain" | "snow_peak" | "volcanic"
  | "swamp" | "bog" | "marsh"
  | "desert" | "dunes" | "oasis"
  | "tundra" | "ice"
  | "lava" | "ash_wastes"
  | "ruins" | "settlement" | "city";

export const TERRAIN_COLORS: Record<TerrainType, string> = {
  deep_water: "#0a2463",
  shallow_water: "#1e5799",
  beach: "#d4b483",
  plains: "#7db46c",
  grassland: "#5a9e4b",
  farmland: "#8bc34a",
  forest: "#2d6a1e",
  dense_forest: "#1a4a12",
  enchanted_forest: "#1a5a3a",
  hills: "#8a7a4a",
  foothills: "#9a8a5a",
  mountain: "#6a6a6a",
  snow_peak: "#c8d8e8",
  volcanic: "#5a1a0a",
  swamp: "#3a5a3a",
  bog: "#2a4a2a",
  marsh: "#4a6a4a",
  desert: "#c4a43a",
  dunes: "#b89a2a",
  oasis: "#4a8a3a",
  tundra: "#8a9aaa",
  ice: "#b8d0e8",
  lava: "#aa3a0a",
  ash_wastes: "#4a4040",
  ruins: "#6a5a4a",
  settlement: "#8a6a3a",
  city: "#a07030",
};

export const TERRAIN_LABELS: Record<TerrainType, string> = {
  deep_water: "Deep Water",
  shallow_water: "Shallow Water",
  beach: "Beach",
  plains: "Plains",
  grassland: "Grassland",
  farmland: "Farmland",
  forest: "Forest",
  dense_forest: "Dense Forest",
  enchanted_forest: "Enchanted Forest",
  hills: "Hills",
  foothills: "Foothills",
  mountain: "Mountain",
  snow_peak: "Snow Peak",
  volcanic: "Volcanic",
  swamp: "Swamp",
  bog: "Bog",
  marsh: "Marsh",
  desert: "Desert",
  dunes: "Sand Dunes",
  oasis: "Oasis",
  tundra: "Tundra",
  ice: "Ice",
  lava: "Lava",
  ash_wastes: "Ash Wastes",
  ruins: "Ruins",
  settlement: "Settlement",
  city: "City",
};

const GRID_SIZE = 100;
const REGION_SCALE = 8;

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function simplexNoise2D(seed: number) {
  const rng = seededRandom(seed);
  const perm = new Array(512);
  const p = new Array(256);
  for (let i = 0; i < 256; i++) p[i] = Math.floor(rng() * 256);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const grad3 = [
    [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
    [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
    [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1],
  ];

  function dot(g: number[], x: number, y: number) {
    return g[0] * x + g[1] * y;
  }

  return (xin: number, yin: number): number => {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1: number, j1: number;
    if (x0 > y0) { i1 = 1; j1 = 0; }
    else { i1 = 0; j1 = 1; }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;
    const gi0 = perm[ii + perm[jj]] % 12;
    const gi1 = perm[ii + i1 + perm[jj + j1]] % 12;
    const gi2 = perm[ii + 1 + perm[jj + 1]] % 12;

    let n0: number, n1: number, n2: number;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) n0 = 0.0;
    else { t0 *= t0; n0 = t0 * t0 * dot(grad3[gi0], x0, y0); }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) n1 = 0.0;
    else { t1 *= t1; n1 = t1 * t1 * dot(grad3[gi1], x1, y1); }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) n2 = 0.0;
    else { t2 *= t2; n2 = t2 * t2 * dot(grad3[gi2], x2, y2); }

    return 70.0 * (n0 + n1 + n2);
  };
}

function fbm(noise: (x: number, y: number) => number, x: number, y: number, octaves: number = 4): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    value += noise(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / maxValue;
}

interface RegionBounds {
  minQ: number;
  maxQ: number;
  minR: number;
  maxR: number;
}

function getRegionBounds(region: WorldRegionData): RegionBounds {
  return {
    minQ: (region.gridX - 1) * REGION_SCALE,
    maxQ: (region.gridX - 1 + region.width) * REGION_SCALE - 1,
    minR: (region.gridY - 1) * REGION_SCALE,
    maxR: (region.gridY - 1 + region.height) * REGION_SCALE - 1,
  };
}

function findRegionForHex(q: number, r: number, regions: WorldRegionData[]): WorldRegionData | null {
  for (const region of regions) {
    const bounds = getRegionBounds(region);
    if (q >= bounds.minQ && q <= bounds.maxQ && r >= bounds.minR && r <= bounds.maxR) {
      return region;
    }
  }
  return null;
}

function getTerrainForRegion(
  region: WorldRegionData,
  localQ: number,
  localR: number,
  elevation: number,
  moisture: number,
  rng: () => number
): TerrainType {
  const terrain = region.terrain || "plains";

  switch (terrain) {
    case "plains":
      if (elevation > 0.6) return "hills";
      if (moisture > 0.7) return "farmland";
      if (moisture > 0.4) return "grassland";
      return "plains";

    case "forest":
      if (elevation > 0.7) return "hills";
      if (moisture > 0.6) return "enchanted_forest";
      if (elevation > 0.3) return "dense_forest";
      return "forest";

    case "mountain":
      if (elevation > 0.8) return "snow_peak";
      if (elevation > 0.5) return "mountain";
      if (elevation > 0.3) return "foothills";
      return "hills";

    case "desert":
      if (moisture > 0.7) return "oasis";
      if (elevation > 0.6) return "dunes";
      return "desert";

    case "swamp":
      if (moisture > 0.7) return "bog";
      if (elevation > 0.5) return "marsh";
      return "swamp";

    case "ocean":
      if (elevation > 0.6) return "beach";
      if (elevation > 0.3) return "shallow_water";
      return "deep_water";

    default:
      if (region.name.includes("Volcanic") || region.name.includes("Ember")) {
        if (elevation > 0.7) return "volcanic";
        if (elevation > 0.4) return "ash_wastes";
        return "lava";
      }
      if (region.name.includes("Blight") || region.name.includes("Waste")) {
        if (elevation > 0.6) return "ruins";
        if (moisture > 0.5) return "ash_wastes";
        return "desert";
      }
      return "plains";
  }
}

function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
}

export function generateWorldHexMap(
  regions: WorldRegionData[],
  locations: WorldLocationData[],
  seed: number = 42
): Map<string, WorldHex> {
  const hexMap = new Map<string, WorldHex>();
  const elevationNoise = simplexNoise2D(seed);
  const moistureNoise = simplexNoise2D(seed + 1000);
  const detailNoise = simplexNoise2D(seed + 2000);
  const rng = seededRandom(seed + 3000);

  const locationHexPositions = new Map<number, { q: number; r: number }>();
  for (const loc of locations) {
    const region = regions.find(r => r.id === loc.regionId);
    if (!region) continue;
    const bounds = getRegionBounds(region);
    const regionWidth = bounds.maxQ - bounds.minQ;
    const regionHeight = bounds.maxR - bounds.minR;
    const hexQ = Math.round(bounds.minQ + (loc.posX / 100) * regionWidth);
    const hexR = Math.round(bounds.minR + (loc.posY / 100) * regionHeight);
    locationHexPositions.set(loc.id, {
      q: Math.max(bounds.minQ, Math.min(bounds.maxQ, hexQ)),
      r: Math.max(bounds.minR, Math.min(bounds.maxR, hexR))
    });
  }

  const roadHexes = new Set<string>();
  const locationPositions = Array.from(locationHexPositions.entries());
  for (let i = 0; i < locationPositions.length; i++) {
    let nearestDist = Infinity;
    let nearestIdx = -1;
    for (let j = 0; j < locationPositions.length; j++) {
      if (i === j) continue;
      const d = hexDistance(
        locationPositions[i][1].q, locationPositions[i][1].r,
        locationPositions[j][1].q, locationPositions[j][1].r
      );
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = j;
      }
    }
    if (nearestIdx >= 0 && nearestDist < 30) {
      const from = locationPositions[i][1];
      const to = locationPositions[nearestIdx][1];
      const steps = Math.max(Math.abs(to.q - from.q), Math.abs(to.r - from.r));
      for (let s = 0; s <= steps; s++) {
        const t = steps === 0 ? 0 : s / steps;
        const rq = Math.round(from.q + (to.q - from.q) * t);
        const rr = Math.round(from.r + (to.r - from.r) * t);
        roadHexes.add(`${rq},${rr}`);
      }
    }
  }

  const riverPaths: Set<string> = new Set();
  const mountainRegions = regions.filter(r => r.terrain === "mountain");
  const coastRegions = regions.filter(r => r.terrain === "ocean");
  for (const mtn of mountainRegions) {
    const mtnBounds = getRegionBounds(mtn);
    const startQ = Math.round((mtnBounds.minQ + mtnBounds.maxQ) / 2);
    const startR = Math.round((mtnBounds.minR + mtnBounds.maxR) / 2);

    let targetQ = startQ;
    let targetR = GRID_SIZE - 1;
    if (coastRegions.length > 0) {
      const coast = coastRegions[0];
      const coastBounds = getRegionBounds(coast);
      targetQ = Math.round((coastBounds.minQ + coastBounds.maxQ) / 2);
      targetR = Math.round((coastBounds.minR + coastBounds.maxR) / 2);
    }

    let cq = startQ;
    let cr = startR;
    const maxSteps = 120;
    for (let s = 0; s < maxSteps; s++) {
      riverPaths.add(`${cq},${cr}`);
      if (cq === targetQ && cr === targetR) break;
      const dq = targetQ - cq;
      const dr = targetR - cr;
      const noise = detailNoise(cq * 0.3, cr * 0.3);
      if (Math.abs(dq) > Math.abs(dr)) {
        cq += dq > 0 ? 1 : -1;
        if (noise > 0.2) cr += dr > 0 ? 1 : (dr < 0 ? -1 : 0);
      } else {
        cr += dr > 0 ? 1 : -1;
        if (noise > 0.2) cq += dq > 0 ? 1 : (dq < 0 ? -1 : 0);
      }
      cq = Math.max(0, Math.min(GRID_SIZE - 1, cq));
      cr = Math.max(0, Math.min(GRID_SIZE - 1, cr));
    }
  }

  for (let q = 0; q < GRID_SIZE; q++) {
    for (let r = 0; r < GRID_SIZE; r++) {
      const region = findRegionForHex(q, r, regions);
      const key = `${q},${r}`;

      const elevation = (fbm(elevationNoise, q * 0.04, r * 0.04, 5) + 1) / 2;
      const moisture = (fbm(moistureNoise, q * 0.05, r * 0.05, 4) + 1) / 2;
      const isRiver = riverPaths.has(key);
      const isRoad = roadHexes.has(key);

      if (!region) {
        hexMap.set(key, {
          q, r,
          terrain: elevation > 0.5 ? "plains" : "shallow_water",
          regionId: 0,
          regionName: "Unclaimed Wilds",
          elevation, moisture,
          isRiver, isRoad,
          isCoast: false,
          isBorder: false,
        });
        continue;
      }

      const bounds = getRegionBounds(region);
      const localQ = (q - bounds.minQ) / (bounds.maxQ - bounds.minQ);
      const localR = (r - bounds.minR) / (bounds.maxR - bounds.minR);

      let terrain: TerrainType;
      if (isRiver) {
        terrain = "shallow_water";
      } else {
        terrain = getTerrainForRegion(region, localQ, localR, elevation, moisture, rng);
      }

      let locationId: number | undefined;
      let locationName: string | undefined;
      let locationType: string | undefined;
      for (const loc of locations) {
        const pos = locationHexPositions.get(loc.id);
        if (pos && pos.q === q && pos.r === r) {
          locationId = loc.id;
          locationName = loc.name;
          locationType = loc.locationType;
          if (loc.locationType === "city") terrain = "city";
          else if (["town", "village"].includes(loc.locationType)) terrain = "settlement";
          else if (loc.locationType === "ruins") terrain = "ruins";
          break;
        }
      }

      const isEdge = q === bounds.minQ || q === bounds.maxQ || r === bounds.minR || r === bounds.maxR;
      const isCoast = region.terrain === "ocean" && elevation > 0.55;

      hexMap.set(key, {
        q, r,
        terrain,
        regionId: region.id,
        regionName: region.name,
        locationId,
        locationName,
        locationType,
        elevation,
        moisture,
        isRiver,
        isRoad,
        isCoast,
        isBorder: isEdge,
      });
    }
  }

  return hexMap;
}

export function getHexNeighbors(q: number, r: number): Array<{ q: number; r: number }> {
  return [
    { q: q + 1, r: r },
    { q: q - 1, r: r },
    { q: q, r: r + 1 },
    { q: q, r: r - 1 },
    { q: q + 1, r: r - 1 },
    { q: q - 1, r: r + 1 },
  ];
}

export function getHexesInRadius(centerQ: number, centerR: number, radius: number): Array<{ q: number; r: number }> {
  const results: Array<{ q: number; r: number }> = [];
  for (let dq = -radius; dq <= radius; dq++) {
    for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
      results.push({ q: centerQ + dq, r: centerR + dr });
    }
  }
  return results;
}

export const GRID_DIMENSIONS = { width: GRID_SIZE, height: GRID_SIZE };
