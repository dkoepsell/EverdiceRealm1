/**
 * Fixed landmarks on the Wander map (wander-threads-spec.md, Feature C).
 *
 * About one hex in eleven has a landmark, chosen by a hash of its coordinates
 * so every player in every campaign sees the same broken tower in the same
 * place. Landmarks show on the map from a distance (see travel.sightRadius),
 * which gives players something to walk toward. Some are water sources, where
 * you can refill.
 */
import { getTerrainForHex, hexHash, type WanderTerrain } from "./terrain";

export interface Landmark {
  q: number;
  r: number;
  key: string;
  name: string;
  /** Short line for the map tooltip when seen from afar. */
  distant: string;
  glyph: string;
  water?: boolean;
  /** Set for landmarks that belong to a thread or rumor rather than the map itself. */
  threadId?: number;
}

type Entry = Omit<Landmark, "q" | "r" | "key">;

const BY_TERRAIN: Record<WanderTerrain, Entry[]> = {
  plains: [
    { name: "Standing Stones", distant: "a ring of grey stones on a rise", glyph: "🗿" },
    { name: "Burned Farmstead", distant: "a blackened chimney against the sky", glyph: "🏚️" },
    { name: "Shepherd's Well", distant: "a stone well-head and a lone tree", glyph: "💧", water: true },
    { name: "Old Milestone", distant: "a tall carved marker by a buried road", glyph: "🪨" },
  ],
  forest: [
    { name: "The Hollow Oak", distant: "a vast oak rising above the canopy", glyph: "🌳" },
    { name: "Woodcutter's Clearing", distant: "a gap in the trees and a thread of smoke", glyph: "🪓" },
    { name: "Clear Spring", distant: "birdsong and the sound of running water", glyph: "💧", water: true },
    { name: "Moss-Grown Shrine", distant: "a pale stone roof among the trees", glyph: "⛩️" },
  ],
  mountain: [
    { name: "Broken Watchtower", distant: "a broken tower on a crag", glyph: "🗼" },
    { name: "Eagle's Saddle", distant: "a high pass between two peaks", glyph: "🦅" },
    { name: "Snowmelt Falls", distant: "a white thread of falling water", glyph: "💧", water: true },
    { name: "Dwarven Door", distant: "a square shadow cut into a cliff", glyph: "🚪" },
  ],
  swamp: [
    { name: "Drowned Bell Tower", distant: "a leaning belfry above the reeds", glyph: "🔔" },
    { name: "Witch-Lights", distant: "green lights drifting over the water", glyph: "✨" },
    { name: "Stilt Hut", distant: "a hut on poles, a lamp in the window", glyph: "🛖" },
  ],
  desert: [
    { name: "Palm Oasis", distant: "a smudge of green on the dunes", glyph: "🌴", water: true },
    { name: "Half-Buried Colossus", distant: "a giant stone hand jutting from the sand", glyph: "🗿" },
    { name: "Glass Field", distant: "something on the horizon flashing in the sun", glyph: "💎" },
  ],
  ocean: [
    { name: "Wrecked Galley", distant: "the ribs of a ship on the rocks", glyph: "⚓" },
    { name: "Lighthouse Stump", distant: "a stub of white stone at the water's edge", glyph: "🗼" },
    { name: "Freshwater Creek Mouth", distant: "a creek running down to the sea", glyph: "💧", water: true },
  ],
};

export const TOWN: Landmark = {
  q: 0, r: 0, key: "0,0", name: "Town", distant: "rooftops and the smoke of home", glyph: "🏘️", water: true,
};

export function landmarkAt(q: number, r: number): Landmark | null {
  if (q === 0 && r === 0) return TOWN;
  const h = hexHash(q, r, 17);
  if (h % 100 >= 9) return null;
  const list = BY_TERRAIN[getTerrainForHex(q, r)];
  const e = list[Math.floor(h / 100) % list.length];
  return { ...e, q, r, key: `${q},${r}` };
}
