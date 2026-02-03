import type { HexMetaV2, NarrativeTone, HexState, HexImportanceType, HexAffordances, EnvironmentTag } from "@shared/schema";

export type HexDirection = "n" | "ne" | "se" | "s" | "sw" | "nw";

export interface DirectionalHint {
  direction: HexDirection;
  description: string;
  environmentKeywords: string[];
  distance?: "adjacent" | "nearby" | "distant";
}

export interface ParsedNarrativeLocations {
  currentLocation: {
    name: string;
    description: string;
    environmentKeywords: string[];
  };
  adjacentHints: DirectionalHint[];
  terrainType: string;
  atmosphereKeywords: string[];
}

const DIRECTION_PATTERNS: Record<HexDirection, RegExp[]> = {
  n: [
    /to the north/i, /northward/i, /ahead lies/i, /before you/i,
    /in front of you/i, /further ahead/i, /straight ahead/i
  ],
  ne: [
    /to the northeast/i, /northeast/i
  ],
  se: [
    /to the southeast/i, /southeast/i
  ],
  s: [
    /to the south/i, /southward/i, /behind you/i, /the way you came/i
  ],
  sw: [
    /to the southwest/i, /southwest/i
  ],
  nw: [
    /to the northwest/i, /northwest/i
  ]
};

const LATERAL_PATTERNS = {
  left: ["nw", "sw"] as HexDirection[],
  right: ["ne", "se"] as HexDirection[]
};

const ENVIRONMENT_KEYWORDS: Record<string, { terrain: string; tags: EnvironmentTag[] }> = {
  forest: { terrain: "Forest", tags: ["overgrown", "living-wood"] },
  woods: { terrain: "Forest", tags: ["overgrown", "living-wood"] },
  trees: { terrain: "Forest", tags: ["living-wood"] },
  clearing: { terrain: "Clearing", tags: ["sunlit"] },
  glade: { terrain: "Clearing", tags: ["sunlit", "living-wood"] },
  cave: { terrain: "Cave", tags: ["dark", "ancient-stone"] },
  cavern: { terrain: "Cavern", tags: ["dark", "ancient-stone"] },
  tunnel: { terrain: "Tunnel", tags: ["dark"] },
  mountain: { terrain: "Mountain", tags: ["ancient-stone"] },
  peak: { terrain: "Peak", tags: ["frost-touched"] },
  river: { terrain: "River", tags: ["waterlogged"] },
  stream: { terrain: "Stream", tags: ["waterlogged"] },
  lake: { terrain: "Lake", tags: ["waterlogged"] },
  swamp: { terrain: "Swamp", tags: ["waterlogged", "overgrown"] },
  marsh: { terrain: "Marsh", tags: ["waterlogged"] },
  bog: { terrain: "Bog", tags: ["waterlogged", "corrupted"] },
  desert: { terrain: "Desert", tags: ["ash-covered", "sunlit"] },
  dunes: { terrain: "Dunes", tags: ["sunlit"] },
  ruins: { terrain: "Ruins", tags: ["ancient-stone", "dusty"] },
  temple: { terrain: "Temple", tags: ["ancient-stone", "rune-carved"] },
  shrine: { terrain: "Shrine", tags: ["ancient-stone"] },
  village: { terrain: "Village", tags: ["torch-lit"] },
  town: { terrain: "Town", tags: ["torch-lit"] },
  tavern: { terrain: "Tavern", tags: ["torch-lit"] },
  road: { terrain: "Road", tags: ["dusty"] },
  path: { terrain: "Path", tags: [] },
  bridge: { terrain: "Bridge", tags: ["ancient-stone"] },
  tower: { terrain: "Tower", tags: ["ancient-stone", "dark"] },
  castle: { terrain: "Castle", tags: ["ancient-stone", "torch-lit"] },
  dungeon: { terrain: "Dungeon", tags: ["dark", "ancient-stone"] },
  crypt: { terrain: "Crypt", tags: ["dark", "ancient-stone", "dusty"] },
  graveyard: { terrain: "Graveyard", tags: ["dark", "moss-covered"] },
  cemetery: { terrain: "Cemetery", tags: ["dark", "moss-covered"] },
  battlefield: { terrain: "Battlefield", tags: ["blood-stained", "ash-covered"] },
  camp: { terrain: "Camp", tags: ["torch-lit"] },
  grassland: { terrain: "Grassland", tags: ["sunlit"] },
  plains: { terrain: "Plains", tags: ["sunlit"] },
  meadow: { terrain: "Meadow", tags: ["sunlit", "overgrown"] },
  cliff: { terrain: "Cliff", tags: ["ancient-stone"] },
  coast: { terrain: "Coast", tags: ["waterlogged"] },
  beach: { terrain: "Beach", tags: ["sunlit"] },
  island: { terrain: "Island", tags: ["waterlogged"] },
  volcano: { terrain: "Volcano", tags: ["ash-covered"] },
  ice: { terrain: "Glacier", tags: ["frost-touched"] },
  glacier: { terrain: "Glacier", tags: ["frost-touched"] },
  tundra: { terrain: "Tundra", tags: ["frost-touched"] },
  library: { terrain: "Library", tags: ["dusty", "torch-lit"] },
  throne: { terrain: "Throne Room", tags: ["ancient-stone", "torch-lit"] },
  garden: { terrain: "Garden", tags: ["overgrown", "sunlit"] },
  courtyard: { terrain: "Courtyard", tags: ["ancient-stone"] }
};

const ATMOSPHERE_KEYWORDS: Record<string, NarrativeTone> = {
  whisper: "Whispering",
  whispers: "Whispering",
  murmur: "Whispering",
  voices: "Whispering",
  sacred: "Sacred",
  holy: "Sacred",
  divine: "Sacred",
  blessed: "Sacred",
  watch: "Watched",
  watched: "Watched",
  eyes: "Watched",
  observed: "Watched",
  unstable: "Unstable",
  shaking: "Unstable",
  crumbling: "Unstable",
  trembling: "Unstable",
  forgotten: "Forgotten",
  abandoned: "Forgotten",
  ancient: "Ancient",
  old: "Ancient",
  primordial: "Ancient",
  hostile: "Hostile",
  dangerous: "Hostile",
  threatening: "Hostile",
  menacing: "Hostile",
  safe: "Benevolent",
  peaceful: "Benevolent",
  welcoming: "Benevolent",
  warm: "Benevolent",
  sealed: "Sealed",
  locked: "Sealed",
  blocked: "Sealed",
  cursed: "Cursed",
  corrupted: "Cursed",
  tainted: "Cursed",
  dark: "Cursed"
};

export function parseNarrativeForLocations(narrative: string): ParsedNarrativeLocations {
  const adjacentHints: DirectionalHint[] = [];
  const atmosphereKeywords: string[] = [];
  let terrainType = "Unknown";
  const currentLocationKeywords: string[] = [];
  
  const sentences = narrative.split(/[.!?]+/).filter(s => s.trim());
  
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    
    for (const [direction, patterns] of Object.entries(DIRECTION_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(sentence)) {
          const envKeywords = extractEnvironmentKeywords(sentence);
          if (envKeywords.length > 0 || sentence.length > 20) {
            adjacentHints.push({
              direction: direction as HexDirection,
              description: sentence.trim(),
              environmentKeywords: envKeywords,
              distance: determineDistance(lowerSentence)
            });
          }
          break;
        }
      }
    }
    
    if (/to (?:your |the )?(?:left|right)/i.test(sentence)) {
      const isLeft = /left/i.test(sentence);
      const directions = isLeft ? LATERAL_PATTERNS.left : LATERAL_PATTERNS.right;
      const envKeywords = extractEnvironmentKeywords(sentence);
      adjacentHints.push({
        direction: directions[Math.random() < 0.5 ? 0 : 1],
        description: sentence.trim(),
        environmentKeywords: envKeywords,
        distance: "adjacent"
      });
    }
    
    for (const [keyword, atmosphere] of Object.entries(ATMOSPHERE_KEYWORDS)) {
      if (lowerSentence.includes(keyword)) {
        atmosphereKeywords.push(atmosphere);
      }
    }
  }
  
  for (const [keyword, envData] of Object.entries(ENVIRONMENT_KEYWORDS)) {
    if (narrative.toLowerCase().includes(keyword)) {
      currentLocationKeywords.push(keyword);
      if (terrainType === "Unknown") {
        terrainType = envData.terrain;
      }
    }
  }
  
  const locationMatch = narrative.match(/(?:You (?:are|stand|find yourself) (?:in|at|on|within) (?:a |an |the )?([^,.]+))/i);
  const locationName = locationMatch ? locationMatch[1].trim() : terrainType;
  
  return {
    currentLocation: {
      name: locationName,
      description: narrative.slice(0, 200),
      environmentKeywords: currentLocationKeywords
    },
    adjacentHints: deduplicateHints(adjacentHints),
    terrainType,
    atmosphereKeywords: Array.from(new Set(atmosphereKeywords))
  };
}

function extractEnvironmentKeywords(text: string): string[] {
  const keywords: string[] = [];
  const lowerText = text.toLowerCase();
  
  for (const keyword of Object.keys(ENVIRONMENT_KEYWORDS)) {
    if (lowerText.includes(keyword)) {
      keywords.push(keyword);
    }
  }
  
  return keywords;
}

function determineDistance(text: string): "adjacent" | "nearby" | "distant" {
  if (/distant|far|horizon|miles away|days? (?:journey|travel)/i.test(text)) {
    return "distant";
  }
  if (/nearby|close|short walk|hour|nearby/i.test(text)) {
    return "nearby";
  }
  return "adjacent";
}

function deduplicateHints(hints: DirectionalHint[]): DirectionalHint[] {
  const seen: Map<HexDirection, DirectionalHint> = new Map();
  for (const hint of hints) {
    if (!seen.has(hint.direction) || hint.environmentKeywords.length > (seen.get(hint.direction)?.environmentKeywords.length || 0)) {
      seen.set(hint.direction, hint);
    }
  }
  const result: DirectionalHint[] = [];
  seen.forEach((value) => result.push(value));
  return result;
}

export function generateHexMetaFromKeywords(
  keywords: string[],
  atmosphereKeywords: string[],
  tension: number = 30
): HexMetaV2 {
  let environmentTags: EnvironmentTag[] = [];
  let narrativeTone: NarrativeTone = "Ancient";
  let affordances: HexAffordances = {
    exploration: 3,
    social: 2,
    investigation: 2,
    puzzle: 1,
    combat: 2
  };
  
  for (const keyword of keywords) {
    const envData = ENVIRONMENT_KEYWORDS[keyword];
    if (envData) {
      environmentTags.push(...envData.tags);
      
      if (["Village", "Town", "Tavern", "Camp"].includes(envData.terrain)) {
        affordances = { exploration: 2, social: 4, investigation: 3, puzzle: 1, combat: 1 };
      } else if (["Dungeon", "Crypt", "Cave", "Cavern"].includes(envData.terrain)) {
        affordances = { exploration: 4, social: 1, investigation: 3, puzzle: 3, combat: 4 };
      } else if (["Temple", "Shrine", "Library"].includes(envData.terrain)) {
        affordances = { exploration: 3, social: 2, investigation: 5, puzzle: 4, combat: 1 };
      } else if (["Ruins", "Battlefield", "Graveyard"].includes(envData.terrain)) {
        affordances = { exploration: 4, social: 1, investigation: 4, puzzle: 2, combat: 3 };
      }
    }
  }
  
  if (atmosphereKeywords.length > 0) {
    narrativeTone = atmosphereKeywords[0] as NarrativeTone;
  }
  
  environmentTags = Array.from(new Set(environmentTags)).slice(0, 3) as EnvironmentTag[];
  if (environmentTags.length === 0) {
    environmentTags = ["dusty"];
  }
  
  let importanceType: HexImportanceType = "None";
  if (keywords.some(k => ["temple", "shrine", "library", "ruins"].includes(k))) {
    importanceType = "Revelation";
  } else if (keywords.some(k => ["dungeon", "crypt", "battlefield"].includes(k))) {
    importanceType = "Risk";
  } else if (keywords.some(k => ["village", "town", "tavern", "camp"].includes(k))) {
    importanceType = "Sanctuary";
  }
  
  return {
    narrativeTone,
    currentState: "Dormant",
    importanceType,
    affordances,
    tension,
    environmentTags,
    regionName: keywords[0] ? ENVIRONMENT_KEYWORDS[keywords[0]]?.terrain : undefined,
    regionDescription: keywords.length > 0 ? `A ${keywords.join(", ")} area` : undefined
  };
}

export function getAdjacentHexCoordinates(
  q: number,
  r: number,
  direction: HexDirection
): { q: number; r: number } {
  const offsets: Record<HexDirection, { dq: number; dr: number }> = {
    n: { dq: 0, dr: -1 },
    ne: { dq: 1, dr: -1 },
    se: { dq: 1, dr: 0 },
    s: { dq: 0, dr: 1 },
    sw: { dq: -1, dr: 1 },
    nw: { dq: -1, dr: 0 }
  };
  
  const offset = offsets[direction];
  return { q: q + offset.dq, r: r + offset.dr };
}

export function getAllAdjacentCoordinates(q: number, r: number): Array<{ q: number; r: number; direction: HexDirection }> {
  const directions: HexDirection[] = ["n", "ne", "se", "s", "sw", "nw"];
  return directions.map(dir => ({
    ...getAdjacentHexCoordinates(q, r, dir),
    direction: dir
  }));
}
