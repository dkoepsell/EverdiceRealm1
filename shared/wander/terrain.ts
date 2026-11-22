/**
 * Wander hex terrain, shared by client and server.
 *
 * Wander's map is not the campaign world map: terrain is a pure function of
 * the hex coordinates (the hash below was previously private to wander.tsx).
 * Moving it here lets the server work out terrain for itself instead of
 * trusting the `terrainType` the client sends, and lets it reason about hexes
 * the player has not visited (landmarks, thread targets, getting lost).
 *
 * Every run starts at (0,0), which we treat as town.
 */

export const WANDER_TERRAINS = ["plains", "forest", "mountain", "swamp", "desert", "ocean"] as const;
export type WanderTerrain = typeof WANDER_TERRAINS[number];

/** Biome keys used by wanderEngine's outcome tables. */
export type WanderBiome = "grass" | "forest" | "mountain" | "swamp" | "desert" | "coast";

export const TERRAIN_TO_BIOME: Record<WanderTerrain, WanderBiome> = {
  plains: "grass",
  forest: "forest",
  mountain: "mountain",
  swamp: "swamp",
  desert: "desert",
  ocean: "coast",
};

export function getTerrainForHex(q: number, r: number): WanderTerrain {
  let h = ((q * 374761393 + r * 668265263) ^ 0x5f3759df) >>> 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = ((h >> 16) ^ h) >>> 0;
  const idx = h % 100;
  if (idx < 35) return "plains";
  if (idx < 60) return "forest";
  if (idx < 75) return "mountain";
  if (idx < 85) return "swamp";
  if (idx < 93) return "desert";
  return "ocean";
}

export function biomeForHex(q: number, r: number): WanderBiome {
  return TERRAIN_TO_BIOME[getTerrainForHex(q, r)];
}

export const WANDER_HEX_DIRECTIONS = [
  { dq: 1, dr: 0 }, { dq: 1, dr: -1 }, { dq: 0, dr: -1 },
  { dq: -1, dr: 0 }, { dq: -1, dr: 1 }, { dq: 0, dr: 1 },
];

export function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  return Math.max(Math.abs(q1 - q2), Math.abs(r1 - r2), Math.abs(q1 + r1 - q2 - r2));
}

/** All hexes at exactly `radius` from (q, r). */
export function hexRing(q: number, r: number, radius: number): Array<{ q: number; r: number }> {
  const out: Array<{ q: number; r: number }> = [];
  for (let dq = -radius; dq <= radius; dq++) {
    for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
      if (hexDistance(0, 0, dq, dr) === radius) out.push({ q: q + dq, r: r + dr });
    }
  }
  return out;
}

/** All hexes within `radius` of (q, r), including it. */
export function hexesWithin(q: number, r: number, radius: number): Array<{ q: number; r: number }> {
  const out: Array<{ q: number; r: number }> = [];
  for (let d = 0; d <= radius; d++) out.push(...hexRing(q, r, d));
  return out;
}

const COMPASS = ["east", "northeast", "north", "northwest", "west", "southwest", "south", "southeast"];

/**
 * Eight-point compass bearing from one hex to another, as it appears on the
 * Wander map (pointy-top hexes, north is up).
 */
export function bearing(fromQ: number, fromR: number, toQ: number, toR: number): string {
  const dq = toQ - fromQ, dr = toR - fromR;
  if (dq === 0 && dr === 0) return "here";
  const x = Math.sqrt(3) * (dq + dr / 2);
  const y = -1.5 * dr; // screen y grows downward; flip so north is positive
  const a = (Math.atan2(y, x) * 180) / Math.PI;
  const idx = Math.round(((a + 360) % 360) / 45) % 8;
  return COMPASS[idx];
}

/** Small deterministic hash for per-hex content (landmarks, etc). */
export function hexHash(q: number, r: number, salt = 0): number {
  let h = (q * 73856093) ^ (r * 19349663) ^ (salt * 83492791);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}
