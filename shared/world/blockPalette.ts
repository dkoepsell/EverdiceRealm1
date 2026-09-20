import type { TerrainType } from "./worldHexGenerator";

/**
 * The block kinds the voxel world is built from, and how each world terrain
 * maps onto them.
 *
 * Colours only. There is no Minecraft export, so a block is a name and a
 * colour and nothing else -- no namespaced ids, no block states to keep in
 * sync with a server version.
 */
export type BlockKind =
  | "grass" | "dark_grass" | "jungle_grass" | "dirt" | "farmland"
  | "sand" | "red_sand" | "gravel" | "clay"
  | "stone" | "dark_stone" | "granite" | "obsidian" | "basalt"
  | "snow" | "ice" | "packed_ice"
  | "water" | "deep_water"
  | "mud" | "peat" | "ash" | "magma"
  | "mossy_stone" | "cracked_stone" | "planks" | "thatch"
  | "oak_log" | "oak_leaves" | "pine_leaves" | "dead_log";

export const BLOCK_COLORS: Record<BlockKind, string> = {
  grass: "#6a9b41", dark_grass: "#4a7233", jungle_grass: "#3f7d3a",
  dirt: "#7a5a3c", farmland: "#8a6842",
  sand: "#d9c98f", red_sand: "#b06d3f", gravel: "#857f7c", clay: "#9a8f87",
  stone: "#8a8a8a", dark_stone: "#5f5f63", granite: "#9b7a6a",
  obsidian: "#2a2436", basalt: "#4a4a4f",
  snow: "#f2f6fa", ice: "#b9dcea", packed_ice: "#8cc0d8",
  water: "#2f6fa8", deep_water: "#173f6b",
  mud: "#5a4a34", peat: "#40351f", ash: "#6e6660", magma: "#c1440e",
  mossy_stone: "#6d7a5a", cracked_stone: "#7d7873",
  planks: "#a1763f", thatch: "#c2aa55",
  oak_log: "#6b4f2f", oak_leaves: "#4f7a33", pine_leaves: "#2f5730",
  dead_log: "#5a4a3f",
};

/** How a terrain builds a column: what it is made of and how tall it sits. */
export interface TerrainProfile {
  /** Block at the top of the column. */
  surface: BlockKind;
  /** Block immediately beneath the surface. */
  subsurface: BlockKind;
  /** Base height in blocks above the world floor. */
  baseHeight: number;
  /** How much the terrain's own noise is allowed to move the height. */
  relief: number;
  /** Submerged terrains render a water surface at WATER_LEVEL. */
  submerged?: boolean;
  /** Chance per column of a tree, 0..1. */
  treeDensity?: number;
  /** Canopy block for trees on this terrain. */
  canopy?: BlockKind;
}

/** Water sits at a fixed level so every sea and lake lines up. */
export const WATER_LEVEL = 8;

export const TERRAIN_PROFILES: Record<TerrainType, TerrainProfile> = {
  deep_water:       { surface: "gravel", subsurface: "stone", baseHeight: 2,  relief: 1, submerged: true },
  shallow_water:    { surface: "sand",   subsurface: "clay",  baseHeight: 6,  relief: 1, submerged: true },
  beach:            { surface: "sand",   subsurface: "sand",  baseHeight: 9,  relief: 1 },
  plains:           { surface: "grass",  subsurface: "dirt",  baseHeight: 11, relief: 2, treeDensity: 0.01, canopy: "oak_leaves" },
  grassland:        { surface: "grass",  subsurface: "dirt",  baseHeight: 12, relief: 3, treeDensity: 0.02, canopy: "oak_leaves" },
  farmland:         { surface: "farmland", subsurface: "dirt", baseHeight: 11, relief: 1 },
  forest:           { surface: "dark_grass", subsurface: "dirt", baseHeight: 13, relief: 3, treeDensity: 0.16, canopy: "oak_leaves" },
  dense_forest:     { surface: "dark_grass", subsurface: "dirt", baseHeight: 14, relief: 4, treeDensity: 0.30, canopy: "pine_leaves" },
  enchanted_forest: { surface: "jungle_grass", subsurface: "peat", baseHeight: 14, relief: 4, treeDensity: 0.24, canopy: "pine_leaves" },
  hills:            { surface: "grass",  subsurface: "dirt",  baseHeight: 17, relief: 6, treeDensity: 0.05, canopy: "oak_leaves" },
  foothills:        { surface: "dark_grass", subsurface: "gravel", baseHeight: 21, relief: 7, treeDensity: 0.04, canopy: "pine_leaves" },
  mountain:         { surface: "stone",  subsurface: "dark_stone", baseHeight: 28, relief: 14 },
  snow_peak:        { surface: "snow",   subsurface: "stone", baseHeight: 38, relief: 16 },
  volcanic:         { surface: "basalt", subsurface: "magma", baseHeight: 24, relief: 10 },
  swamp:            { surface: "mud",    subsurface: "peat",  baseHeight: 9,  relief: 1, treeDensity: 0.08, canopy: "pine_leaves" },
  bog:              { surface: "peat",   subsurface: "mud",   baseHeight: 9,  relief: 1, treeDensity: 0.04, canopy: "pine_leaves" },
  marsh:            { surface: "mud",    subsurface: "clay",  baseHeight: 9,  relief: 1 },
  desert:           { surface: "sand",   subsurface: "sand",  baseHeight: 12, relief: 3 },
  dunes:            { surface: "sand",   subsurface: "sand",  baseHeight: 15, relief: 6 },
  oasis:            { surface: "grass",  subsurface: "sand",  baseHeight: 10, relief: 1, treeDensity: 0.12, canopy: "oak_leaves" },
  tundra:           { surface: "snow",   subsurface: "dirt",  baseHeight: 13, relief: 3 },
  ice:              { surface: "packed_ice", subsurface: "ice", baseHeight: 12, relief: 2 },
  lava:             { surface: "magma",  subsurface: "basalt", baseHeight: 10, relief: 1 },
  ash_wastes:       { surface: "ash",    subsurface: "basalt", baseHeight: 14, relief: 4 },
  ruins:            { surface: "cracked_stone", subsurface: "mossy_stone", baseHeight: 16, relief: 4 },
  settlement:       { surface: "planks", subsurface: "dirt",  baseHeight: 13, relief: 1 },
  city:             { surface: "stone",  subsurface: "stone", baseHeight: 14, relief: 1 },
};

/** Stable index for each block kind, so the wire format can use numbers. */
export const BLOCK_KINDS = Object.keys(BLOCK_COLORS) as BlockKind[];
export const BLOCK_INDEX: Record<BlockKind, number> = BLOCK_KINDS.reduce(
  (acc, k, i) => { acc[k] = i; return acc; },
  {} as Record<BlockKind, number>,
);
