/**
 * Fixed sites on the Wander map: dungeon entrances and settlements.
 *
 * Like landmarks, sites are chosen by a hash of the hex, so every player sees
 * the same village in the same place. Each site takes its character from the
 * terrain it sits in: a fishing port on the coast, a stilt village in the
 * swamp, a hold cut into the mountain, an oasis town in the desert.
 *
 * Settlements have a small map of their own (districts on a hex grid), sized
 * by kind: a village is 7 hexes, a town 19, a city 37. Home (hex 0,0) is a town.
 */
import { getTerrainForHex, hexDistance, hexHash, hexesWithin, type WanderTerrain } from "./terrain";

export type SettlementKind = "village" | "town" | "city";
export type SiteKind = "dungeon" | SettlementKind;
export type DungeonTheme = "goblin" | "undead" | "beast" | "kobold" | "cultist" | "lizardfolk" | "bandit";

export interface Site {
  q: number;
  r: number;
  key: string;
  kind: SiteKind;
  name: string;
  /** The terrain the site sits in, which shapes its look and content. */
  flavor: WanderTerrain;
  glyph: string;
  /** What you see from a distance. */
  distant: string;
  /** One or two sentences on arrival. */
  arrival: string;
  /** How far away the site can be seen, in hexes. */
  seenFrom: number;
  theme?: DungeonTheme;
  home?: boolean;
}

const pick = <T,>(list: readonly T[], h: number) => list[h % list.length];

// ── names ─────────────────────────────────────────────────────────────────────

const NAME_PARTS: Record<WanderTerrain, { a: string[]; b: string[] }> = {
  plains: { a: ["Barley", "Mill", "Oak", "Kings", "Raven", "Sheaf", "Long", "Wheat", "Hollow", "Green"], b: ["ford", "brook", "field", "stead", "ton", "wick", "bury", "dale"] },
  forest: { a: ["Elm", "Ash", "Briar", "Moss", "Fern", "Thorn", "Deer", "Owl"], b: ["wood", "hollow", "glade", "shaw", "grove", "holt"] },
  mountain: { a: ["Iron", "Stone", "Grey", "High", "Frost", "Copper", "Anvil", "Crag"], b: ["hold", "gate", "peak", "forge", "watch", "fell"] },
  swamp: { a: ["Reed", "Mire", "Fen", "Bog", "Heron", "Murk", "Eel", "Willow"], b: ["stilts", "moor", "marsh", "landing", "pool", "holm"] },
  desert: { a: ["Sun", "Sand", "Amber", "Salt", "Dune", "Mirage", "Scorpion", "Palm"], b: ["well", "spring", "rest", "crossing", "oasis", "gate"] },
  ocean: { a: ["Gull", "Salt", "Anchor", "Tide", "Brine", "Kelp", "Storm", "Pearl"], b: ["haven", "port", "harbor", "cove", "mouth", "quay"] },
};

function settlementName(flavor: WanderTerrain, h: number) {
  const p = NAME_PARTS[flavor];
  const a = pick(p.a, h >>> 3);
  const b = pick(p.b, h >>> 9);
  // "Swamp" names read better as two words ("Reed Landing"); the rest as one ("Millbrook").
  return flavor === "swamp" || flavor === "desert" ? `${a} ${b[0].toUpperCase()}${b.slice(1)}` : `${a}${b}`;
}

// ── settlements ───────────────────────────────────────────────────────────────

const SETTLEMENT_FLAVOR: Record<WanderTerrain, { glyph: Record<SettlementKind, string>; look: Record<SettlementKind, string>; arrive: string }> = {
  plains: {
    glyph: { village: "🏡", town: "🏘️", city: "🏰" },
    look: { village: "a cluster of thatched roofs among the fields", town: "a walled market town and its mill", city: "towers and a great wall above the farmland" },
    arrive: "Carts rattle in from the fields, and the smell of bread drifts over the lane.",
  },
  forest: {
    glyph: { village: "🛖", town: "🏘️", city: "🏰" },
    look: { village: "woodsmoke rising through the trees", town: "a palisade town in a wide clearing", city: "a city of timber halls among giant trees" },
    arrive: "Axes ring in the distance, and hunters' hides hang drying on the fences.",
  },
  mountain: {
    glyph: { village: "⛺", town: "🏘️", city: "🏯" },
    look: { village: "a few stone huts clinging to the slope", town: "a hold of stone houses cut into the mountainside", city: "a carved gate as tall as a tower in the cliff face" },
    arrive: "The ring of hammers echoes off the rock, and the air smells of coal and cold stone.",
  },
  swamp: {
    glyph: { village: "🛖", town: "🏘️", city: "🏰" },
    look: { village: "huts on stilts above the black water", town: "a raised town of boardwalks and lanterns", city: "a sprawl of bridges and towers over the fen" },
    arrive: "Boardwalks creak underfoot, and flat-bottomed boats nose between the stilts.",
  },
  desert: {
    glyph: { village: "⛺", town: "🏘️", city: "🕌" },
    look: { village: "tents and palms around a well", town: "an oasis town of white walls and shade", city: "domes and minarets shimmering in the heat" },
    arrive: "Camels drowse in the shade, and the well is busy with water-sellers.",
  },
  ocean: {
    glyph: { village: "🛖", town: "⚓", city: "🏰" },
    look: { village: "fishing boats pulled up on the shingle", town: "a harbor town of masts and gulls", city: "a great port with a lighthouse and a forest of masts" },
    arrive: "Gulls wheel over the nets, and the quay smells of tar and fish.",
  },
};

const KIND_WORD: Record<SettlementKind, string> = { village: "village", town: "town", city: "city" };

// ── dungeons ──────────────────────────────────────────────────────────────────

const DUNGEONS: Record<WanderTerrain, Array<{ name: string; theme: DungeonTheme; distant: string; arrival: string }>> = {
  plains: [
    { name: "The {A} Warren", theme: "goblin", distant: "a dark hole under a lone hill", arrival: "A burrow mouth gapes in the hillside, ringed with gnawed bones and crude goblin marks." },
    { name: "Barrow of the {A} King", theme: "undead", distant: "a grassy mound with a stone door", arrival: "A long barrow rises from the grass. Its stone door stands ajar, and the air inside is cold." },
  ],
  forest: [
    { name: "The {A} Barrow", theme: "undead", distant: "a mound under the oldest trees", arrival: "Roots have split the capstone of an ancient barrow. Steps lead down into the dark." },
    { name: "The {A} Den", theme: "beast", distant: "a cave mouth half-hidden by ferns", arrival: "Claw marks score the rock around a cave mouth, and something large has worn a path through the ferns." },
  ],
  mountain: [
    { name: "The Old {A} Mine", theme: "kobold", distant: "a timbered shaft on the scree", arrival: "Rotting timbers frame an old mine entrance. Tiny clawed footprints lead in and out." },
    { name: "Cave of the {A} Wind", theme: "beast", distant: "a black cleft in the cliff", arrival: "Cold air breathes from a cleft in the rock, carrying the smell of something living deep inside." },
  ],
  swamp: [
    { name: "The Sunken Temple of {A}", theme: "lizardfolk", distant: "a mossy roof sinking into the bog", arrival: "A temple has half sunk into the fen. Its doorway is just above the waterline, and fresh scale-marks streak the mud." },
    { name: "The Drowned {A} Crypt", theme: "undead", distant: "grave-markers poking out of the reeds", arrival: "Gravestones lean out of the water around a crypt door. Bubbles rise from the dark below." },
  ],
  desert: [
    { name: "The Buried Tomb of {A}", theme: "undead", distant: "a stone lintel in the sand", arrival: "Wind has scoured the sand from the top of a buried doorway carved with the names of forgotten kings." },
    { name: "The {A} Sanctum", theme: "cultist", distant: "a ruined shrine among the dunes", arrival: "Fresh offerings lie before a ruined shrine, and a stair beneath it leads down into the cool dark." },
  ],
  ocean: [
    { name: "The {A} Sea Cave", theme: "bandit", distant: "a cave at the foot of the cliffs", arrival: "At low tide a sea cave opens at the cliff's foot. Someone has hidden a boat inside and posted no guard you can see." },
    { name: "The {A} Grotto", theme: "beast", distant: "a sea-arch over dark water", arrival: "Waves boom in a grotto beneath a sea-arch. Something has dragged seal carcasses inside." },
  ],
};

const DUNGEON_WORDS = ["Black", "Hollow", "Whispering", "Red", "Broken", "Silent", "Grey", "Bone", "Ash", "Iron", "Crooked", "Weeping"];

// ── placement ────────────────────────────────────────────────────────────────

/** Home: where every journey starts. */
export const HOME_SITE: Site = {
  q: 0, r: 0, key: "0,0", kind: "town", name: "Home", flavor: "plains", glyph: "🏘️",
  distant: "rooftops and the smoke of home",
  arrival: "The familiar streets of home. The inn's lamp is lit, and the notice board has fresh papers.",
  seenFrom: 6, home: true,
};

/**
 * The site on a hex, if any. Roughly: a city in 1 of 170 hexes (5+ from home),
 * a town in 1 of 55 (3+ from home), a village in 1 of 22 and a dungeon entrance
 * in 1 of 16 (2+ from home). Sites never sit right next to home.
 */
export function siteAt(q: number, r: number): Site | null {
  if (q === 0 && r === 0) return HOME_SITE;
  const dist = hexDistance(0, 0, q, r);
  if (dist < 2) return null;
  const h = hexHash(q, r, 31);
  const roll = h % 1000;
  const flavor = getTerrainForHex(q, r);
  const key = `${q},${r}`;

  let kind: SiteKind | null = null;
  if (roll < 6 && dist >= 5) kind = "city";
  else if (roll >= 6 && roll < 24 && dist >= 3) kind = "town";
  else if (roll >= 24 && roll < 70) kind = "village";
  else if (roll >= 70 && roll < 132) kind = "dungeon";
  if (!kind) return null;

  if (kind === "dungeon") {
    const d = pick(DUNGEONS[flavor], h >>> 4);
    const word = pick(DUNGEON_WORDS, h >>> 11);
    return {
      q, r, key, kind, flavor, theme: d.theme,
      name: d.name.replace("{A}", word),
      glyph: "🕳️", distant: d.distant, arrival: d.arrival, seenFrom: 1,
    };
  }

  const f = SETTLEMENT_FLAVOR[flavor];
  const name = settlementName(flavor, h);
  return {
    q, r, key, kind, flavor, name,
    glyph: f.glyph[kind],
    distant: f.look[kind],
    arrival: `You reach ${name}, a ${KIND_WORD[kind]}. ${f.arrive}`,
    seenFrom: kind === "city" ? 6 : kind === "town" ? 5 : 4,
  };
}

/** Sites a party at (q,r) can see: within each site's own sighting range. */
export function sitesInView(q: number, r: number, radius = 7): Site[] {
  const out: Site[] = [];
  for (const h of hexesWithin(q, r, radius)) {
    const s = siteAt(h.q, h.r);
    if (s && hexDistance(q, r, s.q, s.r) <= s.seenFrom) out.push(s);
  }
  return out;
}

export function isSettlement(s: Site | null | undefined): s is Site & { kind: SettlementKind } {
  return !!s && s.kind !== "dungeon";
}

// ── settlement maps ───────────────────────────────────────────────────────────

export type DistrictKind =
  | "gate" | "square" | "tavern" | "inn" | "temple" | "market" | "smithy" | "notice"
  | "well" | "homes" | "stables" | "guild" | "library" | "noble" | "slums" | "keep"
  | "docks" | "fishmarket" | "forge" | "mine" | "caravanserai" | "cistern"
  | "ferry" | "boardwalk" | "lumberyard" | "lodge" | "fields";

export interface District {
  q: number;
  r: number;
  kind: DistrictKind;
  name: string;
  glyph: string;
}

export const DISTRICT_INFO: Record<DistrictKind, { label: string; glyph: string }> = {
  gate: { label: "Gate", glyph: "🚪" },
  square: { label: "Square", glyph: "⛲" },
  tavern: { label: "Tavern", glyph: "🍺" },
  inn: { label: "Inn", glyph: "🛏️" },
  temple: { label: "Temple", glyph: "🕯️" },
  market: { label: "Market", glyph: "🧺" },
  smithy: { label: "Smithy", glyph: "⚒️" },
  notice: { label: "Notice board", glyph: "📜" },
  well: { label: "Well", glyph: "🪣" },
  homes: { label: "Houses", glyph: "🏠" },
  stables: { label: "Stables", glyph: "🐴" },
  guild: { label: "Guildhall", glyph: "🏛️" },
  library: { label: "Library", glyph: "📚" },
  noble: { label: "Noble quarter", glyph: "👑" },
  slums: { label: "Slums", glyph: "🏚️" },
  keep: { label: "Keep", glyph: "🏰" },
  docks: { label: "Docks", glyph: "⚓" },
  fishmarket: { label: "Fish market", glyph: "🐟" },
  forge: { label: "Deep forge", glyph: "🔥" },
  mine: { label: "Mine head", glyph: "⛏️" },
  caravanserai: { label: "Caravanserai", glyph: "🐪" },
  cistern: { label: "Cistern", glyph: "💧" },
  ferry: { label: "Ferry landing", glyph: "🛶" },
  boardwalk: { label: "Boardwalks", glyph: "🪵" },
  lumberyard: { label: "Lumberyard", glyph: "🪓" },
  lodge: { label: "Hunters' lodge", glyph: "🦌" },
  fields: { label: "Fields", glyph: "🌾" },
};

/** The landmark district a terrain adds to every settlement there. */
const FLAVOR_DISTRICTS: Record<WanderTerrain, DistrictKind[]> = {
  plains: ["fields", "stables"],
  forest: ["lumberyard", "lodge"],
  mountain: ["forge", "mine"],
  swamp: ["ferry", "boardwalk"],
  desert: ["caravanserai", "cistern"],
  ocean: ["docks", "fishmarket"],
};

const LAYOUT: Record<SettlementKind, DistrictKind[]> = {
  // Must fill 7, 19 and 37 hexes (radius 1, 2, 3) with gate and square placed separately.
  village: ["tavern", "temple", "well", "homes"],
  town: ["tavern", "inn", "temple", "market", "smithy", "notice", "well", "homes", "homes", "homes", "homes", "stables"],
  city: [
    "tavern", "tavern", "inn", "inn", "temple", "temple", "market", "market", "smithy", "notice", "well",
    "guild", "library", "noble", "noble", "slums", "slums", "keep", "stables",
    "homes", "homes", "homes", "homes", "homes", "homes", "homes", "homes", "homes",
  ],
};

export const SETTLEMENT_RADIUS: Record<SettlementKind, number> = { village: 1, town: 2, city: 3 };

/** The gate is always on the south edge, where the road comes in. */
export function gateHex(kind: SettlementKind) {
  return { q: 0, r: SETTLEMENT_RADIUS[kind] };
}

/** The districts of a settlement, laid out the same way every time. */
export function settlementLayout(site: Site): District[] {
  if (!isSettlement(site)) return [];
  const radius = SETTLEMENT_RADIUS[site.kind];
  const gate = gateHex(site.kind);
  const cells = hexesWithin(0, 0, radius).filter((c) => !(c.q === 0 && c.r === 0) && !(c.q === gate.q && c.r === gate.r));
  const flavorKinds = FLAVOR_DISTRICTS[site.flavor].slice(0, site.kind === "village" ? 1 : 2);
  const kinds = [...flavorKinds, ...LAYOUT[site.kind]];
  while (kinds.length < cells.length) kinds.push("homes");
  kinds.length = cells.length;

  // Deterministic shuffle of the cells.
  let s = hexHash(site.q, site.r, 53) || 1;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const order = cells.map((c) => ({ c, k: rand() })).sort((a, b) => a.k - b.k).map((x) => x.c);

  const out: District[] = [
    { q: 0, r: 0, kind: "square", name: site.kind === "village" ? "Village green" : DISTRICT_INFO.square.label, glyph: DISTRICT_INFO.square.glyph },
    { q: gate.q, r: gate.r, kind: "gate", name: site.kind === "village" ? "Village lane" : "Main gate", glyph: DISTRICT_INFO.gate.glyph },
  ];
  order.forEach((c, i) => {
    const kind = kinds[i];
    out.push({ q: c.q, r: c.r, kind, name: DISTRICT_INFO[kind].label, glyph: DISTRICT_INFO[kind].glyph });
  });
  return out;
}

export function districtAt(site: Site, q: number, r: number): District | null {
  return settlementLayout(site).find((d) => d.q === q && d.r === r) ?? null;
}
