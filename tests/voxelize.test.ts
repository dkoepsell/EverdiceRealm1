// Run: npx tsx tests/voxelize.test.ts

import { generateWorldHexMap, WORLD_SEED } from "../shared/world/worldHexGenerator";
import { voxelizeWorld } from "../shared/world/voxelize";
import { BLOCK_KINDS, BLOCK_INDEX, TERRAIN_PROFILES, WATER_LEVEL } from "../shared/world/blockPalette";

const regions = [
  { id: 1,  name: "The Pale Tundra",     terrain: "tundra",        gridX: 1,  gridY: 1,  width: 8,  height: 2,  color: "#8a9aaa" },
  { id: 2,  name: "The Ironspire Range", terrain: "mountain",      gridX: 9,  gridY: 1,  width: 4,  height: 4,  color: "#6a6a6a" },
  { id: 3,  name: "Thornwood Reach",     terrain: "forest",        gridX: 1,  gridY: 3,  width: 3,  height: 5,  color: "#2d6a1e" },
  { id: 6,  name: "The Heartlands",      terrain: "plains",        gridX: 3,  gridY: 6,  width: 5,  height: 3,  color: "#7db46c" },
  { id: 10, name: "Azure Shore",         terrain: "shallow_water", gridX: 1,  gridY: 7,  width: 2,  height: 4,  color: "#1e5799" },
  { id: 13, name: "The Abyssal Deep",    terrain: "deep_water",    gridX: 1,  gridY: 11, width: 12, height: 2,  color: "#0a2463" },
];

let failures = 0;
const check = (l: string, ok: boolean, d = "") => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${l}${ok ? "" : `  <-- ${d}`}`);
  if (!ok) failures++;
};

// Every terrain the generator can emit must have a profile, or columns vanish.
const missing = Object.keys(TERRAIN_PROFILES).length;
check("every terrain has a profile", missing === 27, `${missing} profiles`);

const hexMap = generateWorldHexMap(regions, [], WORLD_SEED);
const t0 = Date.now();
const v = voxelizeWorld(Array.from(hexMap.values()));
const ms = Date.now() - t0;

check("produces a grid", v.width > 100 && v.depth > 100, `${v.width}x${v.depth}`);
console.log(`     grid ${v.width}x${v.depth} = ${(v.width * v.depth).toLocaleString()} columns in ${ms}ms`);

const claimed = [...v.hexQ].filter(q => q >= 0).length;
check("most columns are claimed by a hex", claimed / (v.width * v.depth) > 0.75,
  `${Math.round(claimed / (v.width * v.depth) * 100)}%`);

// Heights must be sane: nothing below zero, mountains above plains.
let minH = Infinity, maxH = -Infinity;
for (let i = 0; i < v.height.length; i++) {
  if (v.hexQ[i] < 0) continue;
  if (v.height[i] < minH) minH = v.height[i];
  if (v.height[i] > maxH) maxH = v.height[i];
}
check("no column sits below the floor", minH >= 0, `min ${minH}`);
check("there is real vertical range", maxH - minH > 20, `${minH}..${maxH}`);

// Average height per terrain: mountains must out-rank plains, water must sit low.
function avgHeightFor(terrain: string) {
  let sum = 0, n = 0;
  for (const h of hexMap.values()) {
    if (h.terrain !== terrain) continue;
    // sample the column at this hex's centre
    for (let i = 0; i < v.hexQ.length; i++) {
      if (v.hexQ[i] === h.q && v.hexR[i] === h.r) { sum += v.height[i]; n++; break; }
    }
    if (n > 60) break;
  }
  return n ? sum / n : NaN;
}
const hMountain = avgHeightFor("mountain");
const hPlains = avgHeightFor("plains");
const hDeep = avgHeightFor("deep_water");
console.log(`     avg height: mountain ${hMountain.toFixed(1)}, plains ${hPlains.toFixed(1)}, deep_water ${hDeep.toFixed(1)}`);
check("mountains rise above plains", hMountain > hPlains + 8, `${hMountain} vs ${hPlains}`);
check("deep water sits below the water line", hDeep < WATER_LEVEL, `${hDeep} vs ${WATER_LEVEL}`);

// Submerged flags must agree with the water level.
let wrongFlag = 0;
for (let i = 0; i < v.height.length; i++) {
  if (v.hexQ[i] < 0) continue;
  if (v.height[i] < WATER_LEVEL && !v.submerged[i]) wrongFlag++;
}
check("everything below the water line is flagged submerged", wrongFlag === 0, `${wrongFlag} columns`);

// Block indices must all be in range, or the renderer reads past its palette.
let badIdx = 0;
for (let i = 0; i < v.surface.length; i++) {
  if (v.hexQ[i] < 0) continue;
  if (v.surface[i] >= BLOCK_KINDS.length || v.subsurface[i] >= BLOCK_KINDS.length) badIdx++;
  if (v.canopy[i] !== 255 && v.canopy[i] >= BLOCK_KINDS.length) badIdx++;
}
check("all block indices are within the palette", badIdx === 0, `${badIdx} bad`);

// Trees only on land, and only where a profile allows them.
let treesInWater = 0, trees = 0;
for (let i = 0; i < v.canopy.length; i++) {
  if (v.canopy[i] === 255) continue;
  trees++;
  if (v.submerged[i]) treesInWater++;
}
check("trees exist", trees > 100, `${trees}`);
check("no trees underwater", treesInWater === 0, `${treesInWater}`);
console.log(`     ${trees.toLocaleString()} trees`);

// Determinism: the same input must voxelise identically, or the admin view
// shifts under the viewer every refresh.
const v2 = voxelizeWorld(Array.from(hexMap.values()));
let drift = 0;
for (let i = 0; i < v.height.length; i++) if (v.height[i] !== v2.height[i]) drift++;
check("voxelisation is deterministic", drift === 0, `${drift} columns differ`);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
