import type { WorldHex, TerrainType } from "./worldHexGenerator";
import { hexCenter } from "./hexGeometry";
import {
  TERRAIN_PROFILES, BLOCK_INDEX, WATER_LEVEL,
  type BlockKind,
} from "./blockPalette";

/**
 * Turns the hex world into a square grid of block columns.
 *
 * The hex map is the source of truth for what is where, but a hex grid does
 * not look like a block world. So each hex is rasterised into a small square
 * patch (BLOCKS_PER_HEX across), giving a continuous heightmap whose terrain
 * boundaries are jagged in the way a voxel world's are.
 *
 * The output is flat typed arrays rather than objects: at ~80k columns, an
 * array of objects costs far more to build, serialise and walk than four
 * parallel arrays, and the renderer wants them in this shape anyway.
 */

/** Square blocks across one hex. 3 keeps 100x100 hexes near 80k columns. */
export const BLOCKS_PER_HEX = 3;

export interface VoxelWorld {
  /** Columns across (x) and deep (z). */
  width: number;
  depth: number;
  /** Per column, row-major (z * width + x). */
  height: Int16Array;
  /** Index into BLOCK_KINDS for the surface block. */
  surface: Uint8Array;
  /** Index into BLOCK_KINDS for the block beneath. */
  subsurface: Uint8Array;
  /** 1 where the column is under water. */
  submerged: Uint8Array;
  /** Tree canopy block index, or 255 for none. */
  canopy: Uint8Array;
  /** Height of the tree trunk where canopy !== 255. */
  treeHeight: Uint8Array;
  waterLevel: number;
  /** Which hex each column came from, for picking. */
  hexQ: Int16Array;
  hexR: Int16Array;
}

/** Cheap deterministic hash, so the same world always voxelises identically. */
function hash2(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Value noise over the block grid, for relief within a single terrain. */
function vnoise(x: number, z: number, seed: number): number {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi, seed), b = hash2(xi + 1, zi, seed);
  const c = hash2(xi, zi + 1, seed), d = hash2(xi + 1, zi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export interface VoxelizeOptions {
  seed?: number;
  blocksPerHex?: number;
  /** Only voxelise hexes passing this test (e.g. explored-only). */
  include?: (hex: WorldHex) => boolean;
}

export function voxelizeWorld(
  hexes: readonly WorldHex[],
  options: VoxelizeOptions = {},
): VoxelWorld {
  const seed = options.seed ?? 42;
  const bph = options.blocksPerHex ?? BLOCKS_PER_HEX;
  const include = options.include;

  // Lay the hexes out with the same geometry the 2D map uses, then scale so a
  // hex spans bph blocks. Using the shared hexCenter keeps the 3D world and
  // the web map in the same coordinate space.
  const HEX_SIZE = bph / Math.sqrt(3);

  const list: WorldHex[] = [];
  let maxX = 0, maxZ = 0;
  for (let k = 0; k < hexes.length; k++) {
    const h = hexes[k];
    if (include && !include(h)) continue;
    list.push(h);
    const c = hexCenter(h.q, h.r, HEX_SIZE);
    if (c.x > maxX) maxX = c.x;
    if (c.y > maxZ) maxZ = c.y;
  }

  const pad = bph + 1;
  const width = Math.ceil(maxX) + pad;
  const depth = Math.ceil(maxZ) + pad;
  const n = width * depth;

  const height = new Int16Array(n);
  const surface = new Uint8Array(n);
  const subsurface = new Uint8Array(n);
  const submerged = new Uint8Array(n);
  const canopy = new Uint8Array(n).fill(255);
  const treeHeight = new Uint8Array(n);
  const hexQ = new Int16Array(n).fill(-1);
  const hexR = new Int16Array(n).fill(-1);

  // Rasterise: stamp each hex over the columns nearest its centre. Columns are
  // claimed by whichever hex centre is closest, so boundaries land where the
  // hex edges are rather than in a grid-aligned line.
  const claimDist = new Float32Array(n).fill(Infinity);
  const radius = Math.ceil(bph * 0.75) + 1;

  for (let k = 0; k < list.length; k++) {
    const h = list[k];
    const profile = TERRAIN_PROFILES[h.terrain as TerrainType];
    if (!profile) continue;
    const c = hexCenter(h.q, h.r, HEX_SIZE);
    const cx = c.x, cz = c.y;
    const x0 = Math.max(0, Math.floor(cx) - radius);
    const x1 = Math.min(width - 1, Math.floor(cx) + radius);
    const z0 = Math.max(0, Math.floor(cz) - radius);
    const z1 = Math.min(depth - 1, Math.floor(cz) + radius);

    const sIdx = BLOCK_INDEX[profile.surface];
    const subIdx = BLOCK_INDEX[profile.subsurface];

    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, dz = z + 0.5 - cz;
        const d = dx * dx + dz * dz;
        const i = z * width + x;
        if (d >= claimDist[i]) continue;
        claimDist[i] = d;

        // Relief: two octaves so slopes read as terrain, not as noise.
        const nA = vnoise(x * 0.11, z * 0.11, seed);
        const nB = vnoise(x * 0.31, z * 0.31, seed + 17);
        const rise = (nA * 0.7 + nB * 0.3) * profile.relief;
        let hgt = Math.round(profile.baseHeight + rise);

        // A river cuts its channel below the local land.
        if (h.isRiver && !profile.submerged) hgt = Math.min(hgt, WATER_LEVEL - 1);

        height[i] = hgt;
        surface[i] = sIdx;
        subsurface[i] = subIdx;
        submerged[i] = profile.submerged || h.isRiver || hgt < WATER_LEVEL ? 1 : 0;
        hexQ[i] = h.q;
        hexR[i] = h.r;

        // Trees: deterministic per column so the world is stable across loads.
        if (profile.treeDensity && profile.canopy && !submerged[i]) {
          if (hash2(x, z, seed + 991) < profile.treeDensity) {
            canopy[i] = BLOCK_INDEX[profile.canopy as BlockKind];
            treeHeight[i] = 3 + Math.floor(hash2(x, z, seed + 77) * 3);
          } else {
            canopy[i] = 255;
          }
        } else {
          canopy[i] = 255;
        }
      }
    }
  }

  return { width, depth, height, surface, subsurface, submerged, canopy, treeHeight, waterLevel: WATER_LEVEL, hexQ, hexR };
}
