import type { HexMetaV2, NarrativeTone, HexState, HexImportanceType, HexAffordances, EnvironmentTag } from "@shared/schema";

export type HexDirection = "n" | "ne" | "se" | "s" | "sw" | "nw";

export interface DirectionalHint {
  direction: HexDirection;
  description: string;
  environmentKeywords: string[];
  distance?: "adjacent" | "nearby" | "distant";
}

export interface DetectedEntity {
  type: "monster" | "npc" | "object" | "hazard";
  name: string;
  description?: string;
  hostile: boolean;
  direction?: HexDirection;
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
  detectedEntities: DetectedEntity[];
}

const MONSTER_PATTERNS: Array<{ pattern: RegExp; name: string; hostile: boolean }> = [
  { pattern: /kobolds?/i, name: "Kobolds", hostile: true },
  { pattern: /goblins?/i, name: "Goblins", hostile: true },
  { pattern: /orcs?/i, name: "Orcs", hostile: true },
  { pattern: /skeletons?/i, name: "Skeletons", hostile: true },
  { pattern: /zombies?/i, name: "Zombies", hostile: true },
  { pattern: /wolves?|wolve?s/i, name: "Wolves", hostile: true },
  { pattern: /spiders?/i, name: "Spiders", hostile: true },
  { pattern: /rats?/i, name: "Rats", hostile: true },
  { pattern: /bats?/i, name: "Bats", hostile: false },
  { pattern: /dragons?/i, name: "Dragon", hostile: true },
  { pattern: /ogres?/i, name: "Ogre", hostile: true },
  { pattern: /trolls?/i, name: "Troll", hostile: true },
  { pattern: /bandits?/i, name: "Bandits", hostile: true },
  { pattern: /guards?/i, name: "Guards", hostile: false },
  { pattern: /merchants?/i, name: "Merchant", hostile: false },
  { pattern: /villagers?/i, name: "Villagers", hostile: false },
  { pattern: /cultists?/i, name: "Cultists", hostile: true },
  { pattern: /undead/i, name: "Undead", hostile: true },
  { pattern: /ghosts?|spectr/i, name: "Ghost", hostile: true },
  { pattern: /mimics?/i, name: "Mimic", hostile: true },
  { pattern: /slimes?|oozes?/i, name: "Slime", hostile: true },
];

const DIRECTION_PATTERNS: Record<HexDirection, RegExp[]> = {
  n: [
    /to the north/i, /northward/i, /ahead lies/i, /before you/i,
    /in front of you/i, /further ahead/i, /straight ahead/i,
    /passage (?:to the )?north/i, /corridor (?:to the )?north/i, /door (?:to the )?north/i
  ],
  ne: [
    /to the northeast/i, /northeast/i, /passage (?:to the )?northeast/i
  ],
  se: [
    /to the southeast/i, /southeast/i, /passage (?:to the )?southeast/i,
    /to the east/i, /eastward/i, /passage (?:to the )?east/i, /corridor (?:to the )?east/i, /door (?:to the )?east/i
  ],
  s: [
    /to the south/i, /southward/i, /behind you/i, /the way you came/i,
    /passage (?:to the )?south/i, /corridor (?:to the )?south/i, /door (?:to the )?south/i
  ],
  sw: [
    /to the southwest/i, /southwest/i, /passage (?:to the )?southwest/i
  ],
  nw: [
    /to the northwest/i, /northwest/i, /passage (?:to the )?northwest/i,
    /to the west/i, /westward/i, /passage (?:to the )?west/i, /corridor (?:to the )?west/i, /door (?:to the )?west/i
  ]
};

const LATERAL_PATTERNS = {
  left: ["nw", "sw"] as HexDirection[],
  right: ["ne", "se"] as HexDirection[]
};

export const ENVIRONMENT_KEYWORDS: Record<string, { terrain: string; tags: EnvironmentTag[] }> = {
  // Natural terrain - vegetation
  forest: { terrain: "Forest", tags: ["overgrown", "living-wood"] },
  woods: { terrain: "Forest", tags: ["overgrown", "living-wood"] },
  trees: { terrain: "Forest", tags: ["living-wood"] },
  grove: { terrain: "Grove", tags: ["living-wood", "sunlit"] },
  thicket: { terrain: "Thicket", tags: ["overgrown", "living-wood"] },
  clearing: { terrain: "Clearing", tags: ["sunlit"] },
  glade: { terrain: "Clearing", tags: ["sunlit", "living-wood"] },
  grass: { terrain: "Grassland", tags: ["sunlit"] },
  grassland: { terrain: "Grassland", tags: ["sunlit"] },
  plains: { terrain: "Plains", tags: ["sunlit"] },
  meadow: { terrain: "Meadow", tags: ["sunlit", "overgrown"] },
  field: { terrain: "Field", tags: ["sunlit"] },
  farmland: { terrain: "Farmland", tags: ["sunlit"] },
  garden: { terrain: "Garden", tags: ["overgrown", "sunlit"] },
  orchard: { terrain: "Orchard", tags: ["living-wood", "sunlit"] },
  
  // Natural terrain - elevation
  hill: { terrain: "Hills", tags: ["sunlit"] },
  hills: { terrain: "Hills", tags: ["sunlit"] },
  hillside: { terrain: "Hillside", tags: ["sunlit"] },
  slope: { terrain: "Slope", tags: [] },
  mountain: { terrain: "Mountain", tags: ["ancient-stone"] },
  peak: { terrain: "Peak", tags: ["frost-touched"] },
  cliff: { terrain: "Cliff", tags: ["ancient-stone"] },
  ridge: { terrain: "Ridge", tags: ["ancient-stone"] },
  valley: { terrain: "Valley", tags: ["sunlit"] },
  ravine: { terrain: "Ravine", tags: ["dark"] },
  canyon: { terrain: "Canyon", tags: ["ancient-stone"] },
  
  // Underground
  cave: { terrain: "Cave", tags: ["dark", "ancient-stone"] },
  cavern: { terrain: "Cavern", tags: ["dark", "ancient-stone"] },
  tunnel: { terrain: "Tunnel", tags: ["dark"] },
  passage: { terrain: "Passage", tags: ["dark"] },
  corridor: { terrain: "Corridor", tags: ["dark"] },
  mine: { terrain: "Mine", tags: ["dark", "ancient-stone"] },
  shaft: { terrain: "Shaft", tags: ["dark"] },
  
  // Water features
  river: { terrain: "River", tags: ["waterlogged"] },
  stream: { terrain: "Stream", tags: ["waterlogged"] },
  brook: { terrain: "Brook", tags: ["waterlogged"] },
  creek: { terrain: "Creek", tags: ["waterlogged"] },
  lake: { terrain: "Lake", tags: ["waterlogged"] },
  pond: { terrain: "Pond", tags: ["waterlogged"] },
  pool: { terrain: "Pool", tags: ["waterlogged"] },
  waterfall: { terrain: "Waterfall", tags: ["waterlogged"] },
  swamp: { terrain: "Swamp", tags: ["waterlogged", "overgrown"] },
  marsh: { terrain: "Marsh", tags: ["waterlogged"] },
  bog: { terrain: "Bog", tags: ["waterlogged", "corrupted"] },
  coast: { terrain: "Coast", tags: ["waterlogged"] },
  beach: { terrain: "Beach", tags: ["sunlit"] },
  shore: { terrain: "Shore", tags: ["waterlogged"] },
  island: { terrain: "Island", tags: ["waterlogged"] },
  
  // Harsh terrain
  desert: { terrain: "Desert", tags: ["ash-covered", "sunlit"] },
  dunes: { terrain: "Dunes", tags: ["sunlit"] },
  volcano: { terrain: "Volcano", tags: ["ash-covered"] },
  lava: { terrain: "Lava Field", tags: ["ash-covered"] },
  ice: { terrain: "Glacier", tags: ["frost-touched"] },
  glacier: { terrain: "Glacier", tags: ["frost-touched"] },
  tundra: { terrain: "Tundra", tags: ["frost-touched"] },
  snow: { terrain: "Snowfield", tags: ["frost-touched"] },
  
  // Paths and roads
  road: { terrain: "Road", tags: ["dusty"] },
  path: { terrain: "Path", tags: [] },
  trail: { terrain: "Trail", tags: [] },
  track: { terrain: "Track", tags: ["dusty"] },
  bridge: { terrain: "Bridge", tags: ["ancient-stone"] },
  ford: { terrain: "Ford", tags: ["waterlogged"] },
  crossroads: { terrain: "Crossroads", tags: [] },
  
  // Structures and buildings
  building: { terrain: "Building", tags: ["torch-lit"] },
  house: { terrain: "House", tags: ["torch-lit"] },
  hut: { terrain: "Hut", tags: [] },
  cabin: { terrain: "Cabin", tags: ["torch-lit"] },
  cottage: { terrain: "Cottage", tags: ["torch-lit"] },
  hall: { terrain: "Hall", tags: ["torch-lit", "ancient-stone"] },
  tower: { terrain: "Tower", tags: ["ancient-stone", "dark"] },
  keep: { terrain: "Keep", tags: ["ancient-stone"] },
  castle: { terrain: "Castle", tags: ["ancient-stone", "torch-lit"] },
  fortress: { terrain: "Fortress", tags: ["ancient-stone"] },
  wall: { terrain: "Wall", tags: ["ancient-stone"] },
  gate: { terrain: "Gate", tags: ["ancient-stone"] },
  gatehouse: { terrain: "Gatehouse", tags: ["ancient-stone"] },
  rampart: { terrain: "Rampart", tags: ["ancient-stone"] },
  battlements: { terrain: "Battlements", tags: ["ancient-stone"] },
  
  // Settlements
  village: { terrain: "Village", tags: ["torch-lit"] },
  town: { terrain: "Town", tags: ["torch-lit"] },
  city: { terrain: "City", tags: ["torch-lit"] },
  market: { terrain: "Market", tags: ["torch-lit"] },
  square: { terrain: "Square", tags: ["ancient-stone"] },
  plaza: { terrain: "Plaza", tags: ["ancient-stone"] },
  street: { terrain: "Street", tags: ["dusty"] },
  alley: { terrain: "Alley", tags: ["dark"] },
  courtyard: { terrain: "Courtyard", tags: ["ancient-stone"] },
  tavern: { terrain: "Tavern", tags: ["torch-lit"] },
  inn: { terrain: "Inn", tags: ["torch-lit"] },
  shop: { terrain: "Shop", tags: ["torch-lit"] },
  stable: { terrain: "Stable", tags: [] },
  warehouse: { terrain: "Warehouse", tags: ["dusty"] },
  
  // Religious/magical
  temple: { terrain: "Temple", tags: ["ancient-stone", "rune-carved"] },
  shrine: { terrain: "Shrine", tags: ["ancient-stone"] },
  altar: { terrain: "Altar", tags: ["ancient-stone", "rune-carved"] },
  sanctuary: { terrain: "Sanctuary", tags: ["ancient-stone", "rune-carved"] },
  chapel: { terrain: "Chapel", tags: ["torch-lit"] },
  cathedral: { terrain: "Cathedral", tags: ["ancient-stone", "torch-lit"] },
  
  // Dark places
  dungeon: { terrain: "Dungeon", tags: ["dark", "ancient-stone"] },
  crypt: { terrain: "Crypt", tags: ["dark", "ancient-stone", "dusty"] },
  tomb: { terrain: "Tomb", tags: ["dark", "ancient-stone"] },
  graveyard: { terrain: "Graveyard", tags: ["dark", "moss-covered"] },
  cemetery: { terrain: "Cemetery", tags: ["dark", "moss-covered"] },
  catacomb: { terrain: "Catacomb", tags: ["dark", "ancient-stone"] },
  ruins: { terrain: "Ruins", tags: ["ancient-stone", "dusty"] },
  
  // Other structures
  battlefield: { terrain: "Battlefield", tags: ["blood-stained", "ash-covered"] },
  camp: { terrain: "Camp", tags: ["torch-lit"] },
  campsite: { terrain: "Campsite", tags: [] },
  library: { terrain: "Library", tags: ["dusty", "torch-lit"] },
  throne: { terrain: "Throne Room", tags: ["ancient-stone", "torch-lit"] },
  chamber: { terrain: "Chamber", tags: ["torch-lit"] },
  room: { terrain: "Room", tags: ["torch-lit"] },
  cellar: { terrain: "Cellar", tags: ["dark"] },
  basement: { terrain: "Basement", tags: ["dark"] },
  attic: { terrain: "Attic", tags: ["dusty"] },
  dock: { terrain: "Dock", tags: ["waterlogged"] },
  pier: { terrain: "Pier", tags: ["waterlogged"] },
  harbor: { terrain: "Harbor", tags: ["waterlogged"] }
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

// Adventure setting types for context-aware terrain generation
export type AdventureSetting = "outdoor" | "indoor" | "dungeon" | "library" | "underground" | "urban";

// Keywords that indicate indoor/structure settings
const INDOOR_SETTING_KEYWORDS = [
  "library", "tower", "spire", "castle", "dungeon", "crypt", "temple",
  "hall", "chamber", "room", "corridor", "passage", "basement", "cellar",
  "attic", "building", "keep", "fortress", "sanctuary", "cathedral"
];

// Keywords that indicate outdoor settings  
const OUTDOOR_SETTING_KEYWORDS = [
  "forest", "mountain", "plains", "desert", "tundra", "swamp", "marsh",
  "beach", "coast", "ocean", "field", "meadow", "grassland", "valley"
];

// Terrain types appropriate for different settings
const SETTING_APPROPRIATE_TERRAIN: Record<AdventureSetting, string[]> = {
  indoor: ["Hall", "Chamber", "Room", "Corridor", "Passage", "Gallery", "Antechamber", "Vestibule"],
  library: ["Reading Room", "Archive", "Study", "Scriptorium", "Catalog Hall", "Stack Wing", "Restricted Section", "Scholar's Alcove", "Tome Vault", "Index Chamber"],
  dungeon: ["Dungeon", "Cell", "Crypt", "Catacomb", "Tomb", "Chamber", "Passage", "Vault"],
  underground: ["Cave", "Cavern", "Tunnel", "Passage", "Chamber", "Grotto", "Shaft"],
  urban: ["Street", "Alley", "Square", "Market", "Plaza", "Courtyard", "Building"],
  outdoor: [] // No restrictions for outdoor - use detected keywords
};

// Environment transition patterns - detect when narrative indicates moving between settings
const ENVIRONMENT_TRANSITION_PATTERNS: { pattern: RegExp; setting: AdventureSetting }[] = [
  // Library/Archive transitions
  { pattern: /(?:enter|step into|find yourself in|arrive at|reach|explore)\s+(?:the |a |an )?(?:library|archive|scriptorium|reading room|book|tome|scroll|manuscript)/i, setting: "library" },
  { pattern: /(?:rows of |towering |dusty )?(?:bookshelves|shelves of books|stacks of tomes|ancient texts)/i, setting: "library" },
  
  // Dungeon transitions
  { pattern: /(?:enter|descend into|find yourself in|step into)\s+(?:the |a |an )?(?:dungeon|crypt|tomb|catacomb|prison|cell)/i, setting: "dungeon" },
  { pattern: /(?:dark|damp|cold)\s+(?:stone\s+)?(?:corridors?|passages?|cells?)/i, setting: "dungeon" },
  
  // Underground transitions
  { pattern: /(?:enter|descend into|find yourself in|step into)\s+(?:the |a |an )?(?:cave|cavern|tunnel|mine|grotto|underground)/i, setting: "underground" },
  { pattern: /(?:stalactites?|stalagmites?|natural\s+rock\s+formations?)/i, setting: "underground" },
  
  // Urban transitions
  { pattern: /(?:enter|arrive at|reach|walk through)\s+(?:the |a |an )?(?:city|town|village|market|square|plaza|street|alley)/i, setting: "urban" },
  { pattern: /(?:bustling|crowded|busy)\s+(?:streets?|markets?|squares?)/i, setting: "urban" },
  
  // Indoor/Structure transitions
  { pattern: /(?:enter|step into|find yourself in|arrive at)\s+(?:the |a |an )?(?:hall|chamber|room|tower|castle|keep|temple|fortress|sanctuary)/i, setting: "indoor" },
  { pattern: /(?:grand|great|main|throne)\s+(?:hall|chamber|room)/i, setting: "indoor" },
  
  // Outdoor transitions
  { pattern: /(?:exit|leave|step outside|emerge from|step out into)\s+(?:the |a |an )?(?:building|structure|tower|cave|dungeon)/i, setting: "outdoor" },
  { pattern: /(?:open\s+air|under\s+the\s+sky|beneath\s+the\s+(?:stars?|sun|moon)|fresh\s+air)/i, setting: "outdoor" },
  { pattern: /(?:enter|step into|find yourself in|arrive at)\s+(?:the |a |an )?(?:forest|woods|meadow|field|plains?|mountain|valley|swamp)/i, setting: "outdoor" },
];

// Detect adventure setting from campaign/adventure context AND current narrative
export function detectAdventureSetting(
  adventureTitle: string, 
  campaignDescription?: string,
  currentNarrative?: string,
  chapterDescription?: string
): AdventureSetting {
  // PRIORITY 1: Check current narrative for environment transitions (most specific/immediate context)
  if (currentNarrative) {
    for (const { pattern, setting } of ENVIRONMENT_TRANSITION_PATTERNS) {
      if (pattern.test(currentNarrative)) {
        return setting;
      }
    }
    
    // Also check for strong environmental keywords in the immediate narrative
    const narrativeLower = currentNarrative.toLowerCase();
    
    // Strong library indicators in narrative
    if (/\b(?:bookshelves?|tomes?|scrolls?|manuscripts?|librarian|reading\s+room|archive|scriptorium)\b/.test(narrativeLower)) {
      return "library";
    }
    
    // Strong dungeon indicators
    if (/\b(?:cell|prison|shackles?|chains?|torture|crypt|sarcophag)/i.test(narrativeLower)) {
      return "dungeon";
    }
    
    // Strong cave/underground indicators
    if (/\b(?:stalactite|stalagmite|cavern\s+walls?|underground\s+river|mining\s+cart)/i.test(narrativeLower)) {
      return "underground";
    }
  }
  
  // PRIORITY 2: Check chapter description for setting context
  if (chapterDescription) {
    const chapterLower = chapterDescription.toLowerCase();
    
    if (/\b(?:library|archive|scriptorium|tome|book)\b/.test(chapterLower)) return "library";
    if (/\b(?:dungeon|crypt|tomb|catacomb)\b/.test(chapterLower)) return "dungeon";
    if (/\b(?:cave|cavern|underground|mine)\b/.test(chapterLower)) return "underground";
    if (/\b(?:city|town|village|street|market)\b/.test(chapterLower)) return "urban";
    if (/\b(?:tower|castle|keep|temple|fortress|hall)\b/.test(chapterLower)) return "indoor";
  }
  
  // PRIORITY 3: Fall back to campaign title/description (broadest context)
  const text = `${adventureTitle} ${campaignDescription || ""}`.toLowerCase();
  
  if (text.includes("library") || text.includes("spire") || text.includes("archive") || text.includes("tome")) {
    return "library";
  }
  if (text.includes("dungeon") || text.includes("crypt") || text.includes("tomb") || text.includes("catacomb")) {
    return "dungeon";
  }
  if (text.includes("cave") || text.includes("cavern") || text.includes("underground") || text.includes("mine")) {
    return "underground";
  }
  if (text.includes("city") || text.includes("town") || text.includes("village") || text.includes("street")) {
    return "urban";
  }
  if (text.includes("tower") || text.includes("castle") || text.includes("keep") || text.includes("temple") || text.includes("fortress")) {
    return "indoor";
  }
  
  // Check for outdoor indicators
  for (const keyword of OUTDOOR_SETTING_KEYWORDS) {
    if (text.includes(keyword)) return "outdoor";
  }
  
  // Default to outdoor for wilderness adventures
  return "outdoor";
}

// Get contextually appropriate terrain type
function getContextualTerrainType(detectedKeywords: string[], setting: AdventureSetting): string {
  // For outdoor settings, use detected keywords directly
  if (setting === "outdoor") {
    for (const keyword of detectedKeywords) {
      const envData = ENVIRONMENT_KEYWORDS[keyword.toLowerCase()];
      if (envData) return envData.terrain;
    }
    return "Unknown";
  }
  
  // For indoor settings, filter to only appropriate terrain
  const appropriateTerrain = SETTING_APPROPRIATE_TERRAIN[setting];
  
  // First, check if any detected keyword matches indoor-appropriate terrain
  for (const keyword of detectedKeywords) {
    const envData = ENVIRONMENT_KEYWORDS[keyword.toLowerCase()];
    if (envData && (appropriateTerrain.length === 0 || appropriateTerrain.some(t => t.toLowerCase() === envData.terrain.toLowerCase()))) {
      return envData.terrain;
    }
  }
  
  // For library setting, look for library-specific keywords even if not in ENVIRONMENT_KEYWORDS
  if (setting === "library") {
    const libraryKeywordMap: Record<string, string> = {
      "reading": "Reading Room", "archive": "Archive", "study": "Study",
      "scriptorium": "Scriptorium", "catalog": "Catalog Hall", "stack": "Stack Wing",
      "restricted": "Restricted Section", "alcove": "Scholar's Alcove", "vault": "Tome Vault",
      "index": "Index Chamber", "shelf": "Stack Wing", "shelves": "Stack Wing",
      "books": "Reading Room", "scrolls": "Archive", "manuscripts": "Scriptorium"
    };
    for (const keyword of detectedKeywords) {
      const match = libraryKeywordMap[keyword.toLowerCase()];
      if (match) return match;
    }
  }
  
  // If no appropriate terrain found, return a default for the setting
  if (appropriateTerrain.length > 0) {
    return appropriateTerrain[0]; // Default to first appropriate terrain
  }
  
  return "Unknown";
}

export function parseNarrativeForLocations(narrative: string, adventureSetting?: AdventureSetting): ParsedNarrativeLocations {
  const adjacentHints: DirectionalHint[] = [];
  const atmosphereKeywords: string[] = [];
  const detectedEntities: DetectedEntity[] = [];
  let terrainType = "Unknown";
  const currentLocationKeywords: string[] = [];
  const setting = adventureSetting || "outdoor";
  
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
    
    // Detect monsters and entities in each sentence
    for (const monster of MONSTER_PATTERNS) {
      if (monster.pattern.test(sentence)) {
        // Try to determine direction from context
        let entityDirection: HexDirection | undefined;
        for (const [dir, patterns] of Object.entries(DIRECTION_PATTERNS)) {
          for (const pattern of patterns) {
            if (pattern.test(sentence)) {
              entityDirection = dir as HexDirection;
              break;
            }
          }
          if (entityDirection) break;
        }
        
        // Avoid duplicates
        if (!detectedEntities.some(e => e.name === monster.name)) {
          detectedEntities.push({
            type: monster.hostile ? "monster" : "npc",
            name: monster.name,
            description: sentence.trim(),
            hostile: monster.hostile,
            direction: entityDirection
          });
        }
      }
    }
  }
  
  // Extract all environment keywords from narrative
  for (const [keyword, envData] of Object.entries(ENVIRONMENT_KEYWORDS)) {
    if (narrative.toLowerCase().includes(keyword)) {
      currentLocationKeywords.push(keyword);
    }
  }
  
  // Use contextual terrain type based on adventure setting
  terrainType = getContextualTerrainType(currentLocationKeywords, setting);
  
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
    atmosphereKeywords: Array.from(new Set(atmosphereKeywords)),
    detectedEntities
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

export interface MovementDetection {
  hasMoved: boolean;
  direction: HexDirection | null;
  newLocationName: string | null;
  newTerrainType: string | null;
}

export function detectMovementInNarrative(narrative: string): MovementDetection {
  const movementPatterns = [
    /(?:you |the party |your group )?(?:step|walk|move|enter|pass|go|proceed|travel|venture|head|push|climb|descend|cross|wade)(?:s|ed|ing)?\s+(?:through|into|in|to|toward|towards|across|down|up|over|past)/i,
    /(?:you |the party )?(?:open|push open|swing open)(?:s|ed)?\s+(?:the |a )?\s*(?:door|gate|portal|entrance)/i,
    /(?:entering|stepping into|walking into|moving into|going through)/i,
    /(?:you |the party )?(?:arrive|reach|find yourself|now stand|emerge)(?:s|d)?\s+(?:at|in|inside)/i,
    /(?:the door|the gate|the portal|the passage)\s+(?:opens|leads|reveals)/i,
  ];
  
  const lowerNarrative = narrative.toLowerCase();
  let hasMoved = false;
  
  for (const pattern of movementPatterns) {
    if (pattern.test(narrative)) {
      hasMoved = true;
      break;
    }
  }
  
  if (!hasMoved) return { hasMoved: false, direction: null, newLocationName: null, newTerrainType: null };
  
  let direction: HexDirection = "n";
  for (const [dir, patterns] of Object.entries(DIRECTION_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(narrative)) {
        direction = dir as HexDirection;
        break;
      }
    }
  }
  
  let newTerrainType: string | null = null;
  for (const [keyword, envData] of Object.entries(ENVIRONMENT_KEYWORDS)) {
    if (lowerNarrative.includes(keyword)) {
      newTerrainType = envData.terrain;
      break;
    }
  }
  
  const locationMatch = narrative.match(/(?:into|in|to|at|inside)\s+(?:a |an |the )?([^,.!?]+?)(?:\.|,|!|\?|$)/i);
  const newLocationName = locationMatch ? locationMatch[1].trim().slice(0, 50) : newTerrainType;
  
  return {
    hasMoved,
    direction,
    newLocationName,
    newTerrainType
  };
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
