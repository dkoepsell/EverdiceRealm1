/**
 * Inked terrain symbols for the campaign exploration map (Play mode and the
 * Live Manager). Campaign hexes come from the story, so they cover more kinds
 * of place than Wander: hills, rivers, lakes, caves, snow, lava, roads,
 * underground passages, and built places (settlements, strongholds, shrines,
 * dungeons). The six wilderness kinds reuse Wander's symbols so the two maps
 * read the same.
 */
import { TerrainInk } from "@/components/wander/WanderHexMap";
import type { WanderTerrain } from "@shared/wander/terrain";

export type TerrainCategory =
  | "forest" | "grass" | "swamp" | "mountain" | "hill" | "cave"
  | "water" | "lake" | "coast" | "desert" | "snow" | "lava"
  | "path" | "settlement" | "structure" | "sacred" | "dungeon"
  | "underground" | "danger" | "unknown";

export const CATEGORY_WASH: Record<TerrainCategory, string> = {
  grass: "#cdd49a", forest: "#93ad72", swamp: "#a3b292", mountain: "#c4ad86", hill: "#d0c08e",
  cave: "#b8a688", water: "#a9cbd4", lake: "#93bccb", coast: "#a9c6cf", desert: "#e8cf93",
  snow: "#eef0ec", lava: "#d99a78", path: "#dccb9c", settlement: "#dccaa0", structure: "#cdbf9e",
  sacred: "#e3d9c3", dungeon: "#b9a98d", underground: "#bdb19a", danger: "#d9b4a2", unknown: "#e2d6b6",
};

export const CATEGORY_LABEL: Record<TerrainCategory, string> = {
  grass: "Grassland", forest: "Forest", swamp: "Swamp", mountain: "Mountains", hill: "Hills",
  cave: "Cave", water: "River", lake: "Lake", coast: "Coast", desert: "Desert", snow: "Snow & ice",
  lava: "Volcanic", path: "Road", settlement: "Settlement", structure: "Stronghold or ruin",
  sacred: "Sacred site", dungeon: "Dungeon or crypt", underground: "Underground", danger: "Danger", unknown: "Unknown",
};

const AS_WANDER: Partial<Record<TerrainCategory, WanderTerrain>> = {
  forest: "forest", grass: "plains", swamp: "swamp", mountain: "mountain", desert: "desert", coast: "ocean",
};

export function isBuiltPlace(c: TerrainCategory) {
  return c === "settlement" || c === "structure" || c === "sacred" || c === "dungeon";
}

/** One inked symbol, centred on (0,0), for a hex of the given category. */
export function CampaignTerrainInk({ category, q, r, ink = "#3b2a17", pencil = false }: { category: TerrainCategory; q: number; r: number; ink?: string; pencil?: boolean }) {
  const w = 0.75;
  const wander = AS_WANDER[category];
  if (wander) return <TerrainInk terrain={wander} q={q} r={r} ink={ink} wash={pencil ? "none" : undefined} />;
  const fill = (c: string) => (pencil ? "none" : c);

  switch (category) {
    case "hill":
      return (
        <g fill="none" stroke={ink} strokeWidth={w} strokeLinecap="round">
          {[{ x: -7, y: 3, s: 1 }, { x: 5, y: 6, s: 0.8 }, { x: 2, y: -5, s: 0.7 }].map((h, i) => (
            <g key={i} transform={`translate(${h.x},${h.y}) scale(${h.s})`}>
              <path d="M-9,2 Q0,-10 9,2" fill={fill("#c2ad7c")} />
              <path d="M2,-3 L4,1 M4.5,-2 L6,1.5" strokeWidth={0.5} opacity={0.7} />
            </g>
          ))}
        </g>
      );
    case "cave":
      return (
        <g stroke={ink} strokeWidth={w} strokeLinejoin="round">
          <path d="M-13,7 Q-9,-10 0,-10 Q9,-10 13,7 Z" fill={fill("#a89070")} />
          <path d="M-5,7 Q-5,-3 0,-3 Q5,-3 5,7 Z" fill={pencil ? "none" : "#2a1d10"} />
          <path d="M-9,-3 L-7,-1 M8,-4 L9,-1" strokeWidth={0.5} opacity={0.7} />
        </g>
      );
    case "water":
      return (
        <g fill="none" strokeLinecap="round">
          <path d="M-22,-6 C-12,-14 -6,6 2,0 S14,-8 22,4" stroke={pencil ? ink : "#4f86a0"} strokeWidth={pencil ? 1 : 3.2} />
          {!pencil && <path d="M-22,-6 C-12,-14 -6,6 2,0 S14,-8 22,4" stroke="#c9e0e6" strokeWidth={1} />}
          {!pencil && <path d="M-6,9 Q-4.5,7.5 -3,9 T0,9" stroke="#2f5f78" strokeWidth={0.6} />}
        </g>
      );
    case "lake":
      return (
        <g fill="none" stroke={pencil ? ink : "#2f5f78"} strokeWidth={w} strokeLinecap="round">
          <ellipse cx={0} cy={1} rx={14} ry={8} fill={fill("#7fb0c3")} stroke={ink} />
          <path d="M-7,0 Q-5.5,-1.6 -4,0 T-1,0 M2,3 Q3.5,1.4 5,3 T8,3" />
        </g>
      );
    case "snow":
      return (
        <g stroke={ink} strokeWidth={w} strokeLinejoin="round">
          <path d="M-12,7 L-3,-9 L5,7 Z" fill={fill("#f7f6f1")} />
          <path d="M1,7 L8,-4 L14,7 Z" fill={fill("#eef0ec")} />
          {[[-10, -8], [10, -9], [-14, 0], [12, 1]].map(([x, y], i) => (
            <g key={i} transform={`translate(${x},${y})`} strokeWidth={0.5}><path d="M-1.4,0 H1.4 M0,-1.4 V1.4" /></g>
          ))}
        </g>
      );
    case "lava":
      return (
        <g strokeLinecap="round" fill="none">
          <path d="M-10,7 L0,-9 L10,7 Z" fill={fill("#8a5a3a")} stroke={ink} strokeWidth={w} />
          <path d="M0,-9 L-1.5,-2 L1,2 L-1,7" stroke={pencil ? ink : "#d9461c"} strokeWidth={1.4} />
          <path d="M-2,-12 Q-4,-15 -1,-17 Q2,-19 0,-22" stroke={ink} strokeWidth={0.5} opacity={0.6} />
        </g>
      );
    case "path":
      return (
        <g fill="none" stroke={ink} strokeLinecap="round">
          <path d="M-24,4 C-10,-6 6,10 24,-2" strokeWidth={4.5} stroke={pencil ? "none" : "#c9ad78"} />
          <path d="M-24,1.8 C-10,-8.2 6,7.8 24,-4.2 M-24,6.2 C-10,-3.8 6,12.2 24,0.2" strokeWidth={0.6} />
        </g>
      );
    case "underground":
      return (
        <g fill={fill("#a99b82")} stroke={ink} strokeWidth={0.6}>
          {[-7, -1, 5].map((y, row) =>
            [-12, -4, 4, 12].map((x) => <rect key={`${x},${y}`} x={x - 3.6 + (row % 2) * 3.6} y={y - 2.6} width={7.2} height={5.2} />),
          )}
        </g>
      );
    case "danger":
      return (
        <g stroke={ink} strokeWidth={1.1} strokeLinecap="round">
          <path d="M-8,-8 L8,8 M8,-8 L-8,8" />
          <path d="M-9,-5 L-5,-9 M9,-5 L5,-9" strokeWidth={0.8} />
        </g>
      );
    case "settlement": {
      const house = (x: number, y: number, k: number, roof: string) => (
        <g key={`${x}`} transform={`translate(${x},${y}) scale(${k})`}>
          <rect x={-4} y={-2.5} width={8} height={5} fill={fill("#ead8b0")} stroke={ink} strokeWidth={0.6} />
          <path d="M-5,-2.5 L0,-7 L5,-2.5 Z" fill={fill(roof)} stroke={ink} strokeWidth={0.6} strokeLinejoin="round" />
        </g>
      );
      return <g>{house(-7, -3, 1, "#9c4f2e")}{house(5, -5, 0.9, "#7d5b3a")}{house(0, 5, 1.1, "#a8663a")}</g>;
    }
    case "structure":
      return (
        <g stroke={ink} strokeWidth={0.7}>
          <rect x={-5} y={-11} width={10} height={17} fill={fill("#d9cba6")} />
          <path d="M-5,-11 v-2.5 h2.5 v2.5 h2.5 v-2.5 h2.5 v2.5 h2.5 v-2.5" fill="none" />
          <path d="M-1.5,6 v-4 a1.5,1.5 0 0 1 3,0 v4" fill={pencil ? "none" : ink} />
          <path d="M-14,6 L-9,6 L-9,-2 L-14,-2 Z M9,6 L14,6 L14,0 L9,0 Z" fill={fill("#cdbf9e")} />
        </g>
      );
    case "sacred":
      return (
        <g stroke={ink} strokeWidth={0.7}>
          <rect x={-7} y={-2} width={14} height={9} fill={fill("#f1e6c8")} />
          <path d="M-8.5,-2 L0,-8 L8.5,-2 Z" fill={fill("#7a8fa3")} strokeLinejoin="round" />
          <path d="M0,-8 L0,-15 M-2,-12.5 L2,-12.5" strokeWidth={0.9} />
        </g>
      );
    case "dungeon":
      return (
        <g stroke={ink} strokeWidth={0.8}>
          <path d="M-11,7 L-11,-4 Q0,-14 11,-4 L11,7 Z" fill={fill("#a89878")} />
          <path d="M-5,7 L-5,-1 Q0,-7 5,-1 L5,7 Z" fill={pencil ? "none" : "#1f160c"} />
          <path d="M-11,-4 L-7,-2 M11,-4 L7,-2 M0,-9 L0,-6" strokeWidth={0.5} />
        </g>
      );
    default:
      return (
        <text textAnchor="middle" dominantBaseline="central" fontFamily="Alegreya, serif" fontStyle="italic" fontSize={12} fill={ink} opacity={0.6}>?</text>
      );
  }
}

/** Sort a story or map-builder terrain name ("Ruined watchtower", "Forest road") into a category. */
export function classifyTerrain(terrainType: string): TerrainCategory {
  const t = terrainType.toLowerCase();
  // Before the mountain test: "bridge" contains "ridge".
  if (t.includes("bridge")) return "path";
  if (t.includes("forest") || t.includes("wood") || t.includes("grove") || t.includes("thicket") || t.includes("tree")) return "forest";
  if (t.includes("grass") || t.includes("meadow") || t.includes("field") || t.includes("plains") || t.includes("clearing") || t.includes("glade") || t.includes("garden") || t.includes("orchard")) return "grass";
  if (t.includes("swamp") || t.includes("marsh") || t.includes("bog")) return "swamp";
  if (t.includes("mountain") || t.includes("peak") || t.includes("cliff") || t.includes("ridge") || t.includes("canyon")) return "mountain";
  if (t.includes("hill") || t.includes("slope") || t.includes("valley")) return "hill";
  if (t.includes("cave") || t.includes("cavern") || t.includes("mine")) return "cave";
  if (t.includes("river") || t.includes("stream") || t.includes("brook") || t.includes("creek") || t.includes("waterfall")) return "water";
  if (t.includes("lake") || t.includes("pond") || t.includes("pool")) return "lake";
  if (t.includes("coast") || t.includes("shore") || t.includes("beach") || t.includes("island") || t.includes("dock") || t.includes("pier") || t.includes("harbor")) return "coast";
  if (t.includes("desert") || t.includes("dune") || t.includes("sand")) return "desert";
  if (t.includes("ice") || t.includes("glacier") || t.includes("snow") || t.includes("tundra")) return "snow";
  if (t.includes("volcano") || t.includes("lava")) return "lava";
  if (t.includes("road") || t.includes("path") || t.includes("trail") || t.includes("track") || t.includes("crossroads") || t.includes("bridge")) return "path";
  if (t.includes("village") || t.includes("town") || t.includes("city") || t.includes("market") || t.includes("square") || t.includes("plaza") || t.includes("street") || t.includes("tavern") || t.includes("inn") || t.includes("shop") || t.includes("camp") || t.includes("house") || t.includes("cabin") || t.includes("cottage") || t.includes("hut") || t.includes("building") || t.includes("stable")) return "settlement";
  if (t.includes("castle") || t.includes("fortress") || t.includes("keep") || t.includes("tower") || t.includes("wall") || t.includes("gate") || t.includes("rampart") || t.includes("battlement") || t.includes("ruin")) return "structure";
  if (t.includes("temple") || t.includes("shrine") || t.includes("altar") || t.includes("sanctuary") || t.includes("chapel") || t.includes("cathedral")) return "sacred";
  if (t.includes("dungeon") || t.includes("crypt") || t.includes("tomb") || t.includes("catacomb") || t.includes("graveyard") || t.includes("cemetery")) return "dungeon";
  if (t.includes("tunnel") || t.includes("corridor") || t.includes("passage") || t.includes("hall") || t.includes("chamber") || t.includes("room") || t.includes("cellar") || t.includes("basement")) return "underground";
  if (t.includes("danger") || t.includes("hostile") || t.includes("battlefield")) return "danger";
  return "unknown";
}
