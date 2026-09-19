// Run: npx tsx tests/worldTerrain.test.ts
//
// Guards the terrain fallthrough bug: getTerrainForRegion had no cases for
// tundra / shallow_water / deep_water / hills / ruins, so five seeded regions
// fell through to `default` and rendered as plains. Also guards river routing,
// which drains toward regions whose terrain counts as water -- when that filter
// matched only "ocean" it found nothing and rivers aimed at the grid's bottom edge.
//
// The region list mirrors the world seed in server/storage.ts. If that seed
// changes, update this fixture.

import { generateWorldHexMap } from "../shared/world/worldHexGenerator";

const regions = [
  { id: 1,  name: "The Pale Tundra",     terrain: "tundra",        gridX: 1,  gridY: 1,  width: 8,  height: 2,  color: "#8a9aaa" },
  { id: 2,  name: "The Ironspire Range", terrain: "mountain",      gridX: 9,  gridY: 1,  width: 4,  height: 4,  color: "#6a6a6a" },
  { id: 3,  name: "Thornwood Reach",     terrain: "forest",        gridX: 1,  gridY: 3,  width: 3,  height: 5,  color: "#2d6a1e" },
  { id: 4,  name: "The Grimfen Marshes", terrain: "swamp",         gridX: 4,  gridY: 3,  width: 3,  height: 3,  color: "#3a5a3a" },
  { id: 5,  name: "Stormveil Peaks",     terrain: "mountain",      gridX: 7,  gridY: 3,  width: 2,  height: 3,  color: "#5a5a7a" },
  { id: 6,  name: "The Heartlands",      terrain: "plains",        gridX: 3,  gridY: 6,  width: 5,  height: 3,  color: "#7db46c" },
  { id: 7,  name: "The Greywood",        terrain: "forest",        gridX: 8,  gridY: 5,  width: 3,  height: 3,  color: "#4a7a5a" },
  { id: 8,  name: "Crestfell Hills",     terrain: "hills",         gridX: 8,  gridY: 8,  width: 2,  height: 3,  color: "#8a7a4a" },
  { id: 9,  name: "Shatterstone Ruins",  terrain: "ruins",         gridX: 10, gridY: 5,  width: 3,  height: 4,  color: "#6a5a4a" },
  { id: 10, name: "Azure Shore",         terrain: "shallow_water", gridX: 1,  gridY: 7,  width: 2,  height: 4,  color: "#1e5799" },
  { id: 11, name: "Dustwall Desert",     terrain: "desert",        gridX: 3,  gridY: 9,  width: 5,  height: 2,  color: "#c4a43a" },
  { id: 12, name: "Ember Wastes",        terrain: "volcanic",      gridX: 10, gridY: 9,  width: 3,  height: 3,  color: "#5a1a0a" },
  { id: 13, name: "The Abyssal Deep",    terrain: "deep_water",    gridX: 1,  gridY: 11, width: 12, height: 2,  color: "#0a2463" },
];

let failures = 0;
function check(label: string, ok: boolean, detail: string) {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}${ok ? "" : ` -- ${detail}`}`);
  if (!ok) failures++;
}

const map = generateWorldHexMap(regions, [], 42);
const hexes = [...map.values()] as any[];

// Terrain histogram per region.
const share = (regionId: number, terrains: string[]) => {
  const inRegion = hexes.filter(h => h.regionId === regionId);
  if (!inRegion.length) return 0;
  const n = inRegion.filter(h => terrains.includes(h.terrain)).length;
  return n / inRegion.length;
};

// Each previously-broken region must now be mostly its own terrain family,
// not plains. Thresholds are loose -- they catch a fallthrough, not a retune.
check("tundra region is tundra/ice",
  share(1, ["tundra", "ice"]) > 0.8, `got ${share(1, ["tundra", "ice"]).toFixed(2)}`);
check("hills region is hills/foothills/grassland",
  share(8, ["hills", "foothills", "grassland"]) > 0.8, `got ${share(8, ["hills", "foothills", "grassland"]).toFixed(2)}`);
check("ruins region is ruins/ash_wastes",
  share(9, ["ruins", "ash_wastes"]) > 0.6, `got ${share(9, ["ruins", "ash_wastes"]).toFixed(2)}`);
check("shallow_water region is water/beach",
  share(10, ["shallow_water", "beach", "deep_water"]) > 0.8, `got ${share(10, ["shallow_water", "beach", "deep_water"]).toFixed(2)}`);
check("deep_water region is water",
  share(13, ["deep_water", "shallow_water", "beach"]) > 0.8, `got ${share(13, ["deep_water", "shallow_water", "beach"]).toFixed(2)}`);

// None of the five may be majority plains -- the exact symptom of the bug.
for (const id of [1, 8, 9, 10, 13]) {
  const name = regions.find(r => r.id === id)!.name;
  check(`${name} is not majority plains`,
    share(id, ["plains", "grassland"]) <= 0.5, `got ${share(id, ["plains", "grassland"]).toFixed(2)}`);
}

// Rivers must leave their mountain sources and reach a water region, rather
// than stalling in a meander cycle or running off the grid's bottom edge.
const riverHexes = hexes.filter(h => h.isRiver);
const waterRegionIds = new Set(regions.filter(r =>
  ["ocean", "shallow_water", "deep_water"].includes(r.terrain)).map(r => r.id));
const riversAtCoast = riverHexes.filter(h => waterRegionIds.has(h.regionId)).length;
const sourceRegionIds = new Set(riverHexes.map(h => h.regionId));

check("rivers exist", riverHexes.length > 50, `got ${riverHexes.length} hexes`);
check("rivers reach a water region", riversAtCoast > 0, `got ${riversAtCoast} hexes in water regions`);
check("rivers cross multiple regions", sourceRegionIds.size >= 3, `got ${sourceRegionIds.size}`);

console.log(failures === 0
  ? `\nAll checks passed (${riverHexes.length} river hexes, ${riversAtCoast} at the coast).`
  : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
