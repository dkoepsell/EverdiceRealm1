
export interface EncounterData {
  enemies: Array<{
    name: string;
    cr: number;
    hp: number;
    ac: number;
    attackBonus: number;
    damage: string;
    abilities?: string[];
  }>;
  xpReward: number;
  tacticalNote?: string;
}

export interface TrapData {
  type: string;
  dc: number;
  damage: string;
  effect?: string;
  disarmDC: number;
  detectDC: number;
  triggerDescription: string;
}

export interface PuzzleData {
  type: string;
  description: string;
  dc: number;
  hint: string;
  solutionNarrative: string;
  failureNarrative: string;
  reward?: string;
}

export interface CacheItem {
  name: string;
  type: string;
  quantity: number;
  value?: number;
}

export interface BossData {
  name: string;
  cr: number;
  hp: number;
  ac: number;
  attackBonus: number;
  damage: string;
  abilities: string[];
  phases: Array<{
    hpThreshold: number;
    description: string;
    newAbility?: string;
  }>;
  xpReward: number;
  lairActions?: string[];
}

export interface ChestReward {
  id: string;
  name: string;
  description: string;
  rewards: Array<{ type: string; name: string; value?: number }>;
  consequence?: string;
}

export interface DungeonNode {
  nodeId: string;
  q: number;
  r: number;
  type: 'entrance' | 'encounter' | 'trap' | 'puzzle' | 'lore' | 'cache' | 'safe' | 'boss' | 'chest';
  name: string;
  description: string;
  encounterData?: EncounterData;
  trapData?: TrapData;
  puzzleData?: PuzzleData;
  loreText?: string;
  cacheItems?: CacheItem[];
  bossData?: BossData;
  chestRewards?: ChestReward[];
  adjacentNodes: string[];
}

export interface NodeResolution {
  narration: {
    title: string;
    description: string;
    options: Array<{
      id: string;
      label: string;
      resolutionType: 'combat' | 'check' | 'choice' | 'loot' | 'lore';
      dc?: number;
      successText?: string;
      failText?: string;
    }>;
  };
  combatData?: any;
  trapCheck?: { dc: number; type: string };
  puzzleData?: any;
}

export const GOBLIN_WARREN: DungeonNode[] = [];

const HEX_NEIGHBORS: Array<{ dq: number; dr: number }> = [
  { dq: 1, dr: 0 }, { dq: 1, dr: -1 }, { dq: 0, dr: -1 },
  { dq: -1, dr: 0 }, { dq: -1, dr: 1 }, { dq: 0, dr: 1 },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ENCOUNTER_POOL: Array<{ name: string; description: string; encounterData: EncounterData }> = [
  {
    name: 'Sentry Tunnel',
    description: 'The narrow tunnel widens just enough for two abreast. Crude tally marks scratch the walls. Ahead, you hear the scrape of small boots on stone.',
    encounterData: { enemies: [{ name: 'Goblin Scout', cr: 0.25, hp: 7, ac: 13, attackBonus: 4, damage: '1d6+2', abilities: ['Nimble Escape'] }, { name: 'Goblin Scout', cr: 0.25, hp: 7, ac: 13, attackBonus: 4, damage: '1d6+2', abilities: ['Nimble Escape'] }], xpReward: 50, tacticalNote: 'The scouts flee if reduced below half HP. Block the corridor to prevent escape.' },
  },
  {
    name: "Warriors' Den",
    description: 'A low-ceilinged chamber reeking of unwashed bodies and stale beer. Crude bedrolls line the walls, and a cookfire smolders in the center. Goblins in patchwork armor look up from their dice game.',
    encounterData: { enemies: [{ name: 'Goblin Warrior', cr: 0.5, hp: 12, ac: 14, attackBonus: 4, damage: '1d8+2', abilities: ['Pack Tactics'] }, { name: 'Goblin Warrior', cr: 0.5, hp: 12, ac: 14, attackBonus: 4, damage: '1d8+2', abilities: ['Pack Tactics'] }, { name: 'Goblin Warrior', cr: 0.5, hp: 10, ac: 14, attackBonus: 4, damage: '1d8+2', abilities: ['Pack Tactics'] }], xpReward: 150, tacticalNote: 'The warriors fight in close formation using Pack Tactics. Overturning the cookfire (DC 10 Athletics) creates difficult terrain.' },
  },
  {
    name: 'Wolf Kennel',
    description: 'The smell hits before the sight — feral musk of fur and blood. Wolves strain against chains, eyes reflecting torchlight with feral hunger. Gnawed bones litter the ground.',
    encounterData: { enemies: [{ name: 'Dire Wolf', cr: 1, hp: 37, ac: 14, attackBonus: 5, damage: '2d6+3', abilities: ['Pack Tactics', 'Knockdown'] }, { name: 'Wolf', cr: 0.25, hp: 11, ac: 13, attackBonus: 4, damage: '2d4+2', abilities: ['Pack Tactics'] }, { name: 'Wolf', cr: 0.25, hp: 11, ac: 13, attackBonus: 4, damage: '2d4+2', abilities: ['Pack Tactics'] }], xpReward: 200, tacticalNote: 'DC 15 Animal Handling to calm them. The dire wolf breaks free on round 2.' },
  },
  {
    name: "Shaman's Sanctum",
    description: 'Fetid smoke billows from a chamber draped in totems of bone and sinew. A goblin shaman hunches over a bubbling cauldron, muttering incantations. The air crackles with unstable magic.',
    encounterData: { enemies: [{ name: 'Goblin Shaman', cr: 1, hp: 21, ac: 12, attackBonus: 4, damage: '1d8+2', abilities: ['Spellcasting (Hex, Shield, Burning Hands)', "Dark Patron's Gift (1/day: Inflict Wounds)"] }, { name: 'Goblin Acolyte', cr: 0.25, hp: 7, ac: 11, attackBonus: 3, damage: '1d4+1', abilities: ['Fanatical: advantage on saves vs. frightened'] }], xpReward: 250, tacticalNote: 'Destroying the cauldron (AC 10, 15 HP) ends the Dark Patron\'s Gift. The acolyte shields the shaman.' },
  },
  {
    name: 'Fungal Grotto',
    description: 'Bioluminescent mushrooms cast an eerie blue-green glow across this damp chamber. Spore clouds drift lazily through the air. Something moves among the towering fungal stalks.',
    encounterData: { enemies: [{ name: 'Violet Fungus', cr: 0.25, hp: 18, ac: 5, attackBonus: 2, damage: '1d8+1', abilities: ['Rotting Touch'] }, { name: 'Violet Fungus', cr: 0.25, hp: 18, ac: 5, attackBonus: 2, damage: '1d8+1', abilities: ['Rotting Touch'] }, { name: 'Myconid Sprout', cr: 0, hp: 7, ac: 10, attackBonus: 1, damage: '1d4', abilities: ['Spore Cloud (DC 11 Con)'] }], xpReward: 75, tacticalNote: 'The violet fungi attack anyone within 10 ft. Fire damage is effective. Spore clouds obscure vision.' },
  },
  {
    name: 'Spider Nest',
    description: 'Thick webs choke the passage, shimmering faintly in the torchlight. Wrapped bundles hang from the ceiling — some still twitching. Many-legged shadows skitter across the walls.',
    encounterData: { enemies: [{ name: 'Giant Spider', cr: 1, hp: 26, ac: 14, attackBonus: 5, damage: '1d8+3', abilities: ['Web (Restrained, DC 12)', 'Spider Climb', 'Poison Bite (DC 11 Con, 2d6 poison)'] }, { name: 'Swarm of Spiders', cr: 0.5, hp: 22, ac: 12, attackBonus: 3, damage: '2d4', abilities: ['Swarm', 'Spider Climb'] }], xpReward: 175, tacticalNote: 'The giant spider ambushes from the ceiling. Fire instantly destroys webs but may damage loot in the bundles.' },
  },
];

const TRAP_POOL: Array<{ name: string; description: string; trapData: TrapData }> = [
  {
    name: 'Tripwire Passage',
    description: 'The corridor narrows to single file. Something about the floor ahead looks deliberate. Thin cords stretch ankle-height across the passage.',
    trapData: { type: 'tripwire', dc: 13, damage: '1d6', effect: 'Falling rocks deal bludgeoning damage and create difficult terrain.', disarmDC: 12, detectDC: 12, triggerDescription: 'A thin cord at ankle height connected to loose stones in the ceiling.' },
  },
  {
    name: 'Concealed Pit',
    description: 'The floor is covered with packed dirt and animal hides. It looks solid enough, but supports creak underfoot. Bones of small animals scatter near the edges.',
    trapData: { type: 'pit', dc: 14, damage: '2d6', effect: 'A 10-foot pit with sharpened stakes. DC 12 Athletics to climb out.', disarmDC: 14, detectDC: 13, triggerDescription: 'Concealed by hides and earth, a 10-foot pit collapses under Medium creatures.' },
  },
  {
    name: 'Poison Dart Corridor',
    description: 'The walls are pocked with tiny holes at chest height. A faint chemical odor hangs in the air. Tiny feathered darts litter the floor, their tips stained dark green.',
    trapData: { type: 'poison_dart', dc: 15, damage: '1d4', effect: 'Poisoned condition for 1 hour (DC 13 Con save). Disadvantage on attacks and checks.', disarmDC: 15, detectDC: 11, triggerDescription: 'Pressure plates trigger poison-tipped darts from wall apertures.' },
  },
  {
    name: 'Collapsing Ceiling',
    description: 'Cracks web across the ceiling above, and thin streams of dust trickle down. The support timbers are rotted through. One wrong step could bring it all down.',
    trapData: { type: 'collapse', dc: 14, damage: '2d8', effect: 'Buried creatures are restrained (DC 14 Strength to escape). Creates difficult terrain.', disarmDC: 16, detectDC: 12, triggerDescription: 'Weakened support beams collapse when disturbed, dropping tons of rock.' },
  },
  {
    name: 'Gas Vent',
    description: 'A foul yellow-green vapor seeps from cracks in the stone floor. The air tastes metallic and makes your eyes water. Small dead insects litter the ground.',
    trapData: { type: 'gas', dc: 13, damage: '1d6', effect: 'Blinded for 1 minute (DC 12 Con save at end of each turn to recover).', disarmDC: 13, detectDC: 10, triggerDescription: 'Stepping on loose flagstones releases trapped volcanic gas from underground vents.' },
  },
];

const PUZZLE_POOL: Array<{ name: string; description: string; puzzleData: PuzzleData }> = [
  {
    name: 'Runic Door',
    description: 'A heavy stone door blocks the passage. Three runic symbols glow on its surface: a flame, a mountain, and a river. Three stone dials await alignment.',
    puzzleData: { type: 'combination', description: 'Align three dwarven runes in the correct order based on the cycle of creation.', dc: 14, hint: 'The sequence follows: Flame forges the Mountain, Water carves the Stone.', solutionNarrative: 'The dials click into place. Ancient gears grind as the door slides open, exhaling sealed air.', failureNarrative: 'The runes flash angry red. A pulse of energy ripples outward, and the dials reset.' },
  },
  {
    name: 'Totem Gate',
    description: 'Three totems — bear, snake, and raven — stand on rotating pedestals. The gate mechanism connects to their alignment. Scratched above: "The bear guards, the snake strikes, the raven watches."',
    puzzleData: { type: 'alignment', description: 'Rotate the three totems to face correct directions based on their nature.', dc: 12, hint: '"The bear guards" — faces the gate. "The snake strikes" — faces inward. "The raven watches" — faces outward.', solutionNarrative: 'The totems lock into place. The gate shudders and retracts into the ceiling.', failureNarrative: 'The totems spin back with a harsh clatter. Acrid smoke erupts, echoing deeper into the warren.' },
  },
  {
    name: 'Pressure Tile Maze',
    description: 'The chamber floor is a grid of stone tiles, each carved with different symbols. Some tiles are slightly raised. A crushed skeleton lies partway across — it chose poorly.',
    puzzleData: { type: 'sequence', description: 'Step on the correct sequence of tiles to cross the chamber safely.', dc: 13, hint: 'The wall mural shows the symbols in order: sun, moon, star, mountain, river. Follow the path.', solutionNarrative: 'You step carefully across the correct tiles. Each glows softly green as you pass. The far door opens.', failureNarrative: 'A wrong tile depresses with a click. Crossbow bolts fire from the walls — take 1d6 piercing damage!' },
  },
];

const LORE_POOL: Array<{ name: string; description: string; loreText: string }> = [
  {
    name: 'Carved Walls',
    description: 'A dead-end alcove with walls older than the tunnels — ancient stonework carved with spiraling glyphs. Moss clings to deep-cut runes that pulse faintly when touched.',
    loreText: 'The carvings depict a binding ritual. Something was sealed beneath this hill — a creature of shadow and hunger. The glyphs read: "Let the Hollow King sleep, lest his whispers wake the deep."',
  },
  {
    name: "Prisoner's Cell",
    description: 'A small, damp cell with bent iron bars. In the corner, a message scratched into stone with a broken nail. A ragged journal lies half-buried in straw.',
    loreText: 'The journal belongs to a dwarven prospector. Entries grow frantic: "The chieftain speaks of a patron in the deep. Something older than goblins. They feed it." The final entry is just: "RUN."',
  },
  {
    name: 'Faded Mural',
    description: 'A crumbling mural covers the far wall, depicting scenes in faded pigments. Though goblins have defaced parts with crude drawings, the original artistry speaks of an older civilization.',
    loreText: 'The mural shows a prosperous underground city, its inhabitants tall and graceful. The final panel depicts a great darkness consuming the city from below. One figure stands against the tide, holding a crystalline key.',
  },
  {
    name: 'Bone Shrine',
    description: 'Bones arranged with disturbing precision form a crude altar. Candle wax pools around yellowed skulls. Fresh bloodstains darken the stone beneath.',
    loreText: 'Among the offerings, you find crude pictographic prayers. The goblins worship something they call "The Whisperer Below." Their devotion has been rewarded — the chieftain now speaks with unnatural intelligence, and the warren has flourished.',
  },
];

const BOSS_POOL: Array<{ name: string; description: string; bossData: BossData }> = [
  {
    name: "Chieftain's Throne",
    description: 'The largest chamber opens before you. At its center, seated on a throne of lashed bones, sits the Goblin Chieftain. A crown of black iron rests on its brow, eyes gleaming with unnatural intelligence. "You\'ve come far, little heroes. But the deep is mine."',
    bossData: { name: 'Grak the Crowned', cr: 2, hp: 45, ac: 16, attackBonus: 5, damage: '2d6+3', abilities: ['Multiattack (2 attacks)', 'Crown of Whispers (frighten, DC 13 Wis)', 'Rally (1/day: summon 2 Goblin Warriors)', "Dark Shield (reaction: +3 AC)"], phases: [{ hpThreshold: 100, description: 'Grak fights with cold precision, testing defenses.' }, { hpThreshold: 50, description: 'The crown pulses dark. His eyes turn black. Crown of Whispers every round.' }, { hpThreshold: 25, description: 'Shadow tendrils erupt. Resistance to non-magical damage, +1d4 necrotic.' }], xpReward: 450, lairActions: ['Shadows: DC 12 Wis save or frightened.', 'Tremor: DC 11 Dex save or prone.', 'Whispers: DC 12 Int save or move 10ft randomly.'] },
  },
  {
    name: 'The Brood Mother',
    description: 'A vast cavern draped in webbing. At the center, a monstrous spider the size of a horse hangs from silken threads. Its many eyes track your movements with terrible patience. Egg sacs pulse along the walls.',
    bossData: { name: 'Shelob the Brood Mother', cr: 3, hp: 52, ac: 15, attackBonus: 6, damage: '2d8+4', abilities: ['Web Spray (30ft cone, DC 14 Dex, Restrained)', 'Poison Bite (DC 13 Con, 3d6 poison)', 'Spider Climb', 'Hatchling Swarm (1/day: burst 2 egg sacs)'], phases: [{ hpThreshold: 100, description: 'The Brood Mother watches from the ceiling, spitting web to restrain targets.' }, { hpThreshold: 50, description: 'She descends to the floor, attacking with savage fury. Egg sacs begin to pulse.' }, { hpThreshold: 25, description: 'Two egg sacs burst, releasing swarms. She fights with desperate maternal rage.' }], xpReward: 550, lairActions: ['Web lines tighten: DC 12 Dex save or Restrained until freed.', 'Spiderlings swarm: 1d4 piercing to all non-Restrained creatures.', 'Darkness falls: her silk blocks light sources for 1 round.'] },
  },
];

const CACHE_POOL: Array<CacheItem[]> = [
  [
    { name: 'Torches (bundle)', type: 'supply', quantity: 3, value: 1 },
    { name: 'Dried Rations', type: 'supply', quantity: 2, value: 2 },
    { name: 'Healing Potion', type: 'consumable', quantity: 1, value: 50 },
    { name: "Alchemist's Fire", type: 'consumable', quantity: 1, value: 50 },
    { name: 'Silver Locket', type: 'treasure', quantity: 1, value: 25 },
  ],
  [
    { name: 'Rope (50 ft)', type: 'supply', quantity: 1, value: 1 },
    { name: 'Antitoxin', type: 'consumable', quantity: 2, value: 50 },
    { name: 'Oil Flask', type: 'supply', quantity: 3, value: 1 },
    { name: 'Gem (Moonstone)', type: 'treasure', quantity: 1, value: 50 },
  ],
];

const ENTRANCE_POOL = [
  { name: 'Warren Mouth', description: 'A jagged fissure splits the hillside, belching rot and wood smoke. Crude totems of bone and feather flank the opening. The passage slopes downward into flickering torchlight and distant chittering.' },
  { name: 'Collapsed Mine', description: 'Rusted rails and shattered pit props mark the entrance to an abandoned mine. Something has taken up residence — fresh claw marks gouge the support beams, and a guttural chanting echoes from below.' },
  { name: 'Sinkhole Maw', description: 'The earth has collapsed here, revealing a natural cave system below. Rope marks on the rim show others have descended. The smell of damp stone and something foul rises from the darkness.' },
];

const SAFE_POOL = [
  { name: 'Abandoned Storeroom', description: 'A dwarven storeroom preserved by ancient magic. Dusty crates line the walls. A clean spring trickles from the stone wall into a carved basin. No monsters will find you here.' },
  { name: 'Hidden Alcove', description: 'Behind a concealed door, a small chamber offers respite. Carved symbols of warding glow faintly on the walls. The air is clean and still — a pocket of safety in the depths.' },
];

const CHEST_POOL = [
  { name: "Chieftain's Hoard", description: 'A heavy iron chest sits chained to the floor. Inside, accumulated plunder gleams in the firelight. Three distinct compartments catch your eye, but the mechanism allows only one to open.' },
  { name: 'Ancient Vault', description: 'A stone sarcophagus has been repurposed as a treasure vault. Three separate offerings rest within: practical wealth, dangerous power, and forbidden knowledge.' },
];

export function generateProceduralDungeon(theme: string = 'goblin'): DungeonNode[] {
  const nodeCount = 13 + Math.floor(Math.random() * 5);
  const encounterCount = 3 + Math.floor(Math.random() * 2);
  const trapCount = 2 + Math.floor(Math.random() * 2);
  const puzzleCount = 1 + Math.floor(Math.random() * 2);
  const loreCount = 1 + Math.floor(Math.random() * 2);

  const typeSequence: DungeonNode['type'][] = ['entrance'];
  for (let i = 0; i < encounterCount; i++) typeSequence.push('encounter');
  for (let i = 0; i < trapCount; i++) typeSequence.push('trap');
  for (let i = 0; i < puzzleCount; i++) typeSequence.push('puzzle');
  for (let i = 0; i < loreCount; i++) typeSequence.push('lore');
  typeSequence.push('cache', 'safe', 'boss', 'chest');
  while (typeSequence.length < nodeCount) {
    typeSequence.push(pickRandom(['encounter', 'trap', 'lore']));
  }

  const usedCoords = new Map<string, number>();
  const nodes: DungeonNode[] = [];
  let idCounter = 0;

  function coordKey(q: number, r: number) { return `${q},${r}`; }

  function getAvailableNeighbors(q: number, r: number): Array<{ q: number; r: number }> {
    return HEX_NEIGHBORS
      .map(d => ({ q: q + d.dq, r: r + d.dr }))
      .filter(c => !usedCoords.has(coordKey(c.q, c.r)));
  }

  const entrance = pickRandom(ENTRANCE_POOL);
  const entranceId = `proc-${idCounter++}`;
  usedCoords.set(coordKey(0, 0), 0);
  nodes.push({
    nodeId: entranceId,
    q: 0, r: 0,
    type: 'entrance',
    name: entrance.name,
    description: entrance.description,
    adjacentNodes: [],
  });

  const mainPathLength = 5 + Math.floor(Math.random() * 3);
  const mainPath: number[] = [0];

  for (let i = 1; i < mainPathLength; i++) {
    const prevNode = nodes[mainPath[mainPath.length - 1]];
    const available = getAvailableNeighbors(prevNode.q, prevNode.r);
    if (available.length === 0) break;

    const preferred = available.filter(c => c.q >= prevNode.q || c.r >= prevNode.r);
    const chosen = preferred.length > 0 ? pickRandom(preferred) : pickRandom(available);

    const nodeIdx = nodes.length;
    const nodeId = `proc-${idCounter++}`;
    usedCoords.set(coordKey(chosen.q, chosen.r), nodeIdx);
    nodes.push({
      nodeId,
      q: chosen.q, r: chosen.r,
      type: 'encounter',
      name: '',
      description: '',
      adjacentNodes: [],
    });

    prevNode.adjacentNodes.push(nodeId);
    nodes[nodeIdx].adjacentNodes.push(prevNode.nodeId);
    mainPath.push(nodeIdx);
  }

  const branchPoints = shuffleArray(mainPath.slice(1, -1));
  let remaining = typeSequence.length - nodes.length;
  let branchIdx = 0;

  while (remaining > 0 && branchIdx < branchPoints.length) {
    const parentIdx = branchPoints[branchIdx];
    const parent = nodes[parentIdx];
    const branchLen = 1 + Math.floor(Math.random() * 2);
    let currentParent = parent;

    for (let b = 0; b < branchLen && remaining > 0; b++) {
      const available = getAvailableNeighbors(currentParent.q, currentParent.r);
      if (available.length === 0) break;
      const chosen = pickRandom(available);
      const nodeIdx = nodes.length;
      const nodeId = `proc-${idCounter++}`;
      usedCoords.set(coordKey(chosen.q, chosen.r), nodeIdx);
      nodes.push({
        nodeId,
        q: chosen.q, r: chosen.r,
        type: 'encounter',
        name: '',
        description: '',
        adjacentNodes: [],
      });
      currentParent.adjacentNodes.push(nodeId);
      nodes[nodeIdx].adjacentNodes.push(currentParent.nodeId);
      currentParent = nodes[nodeIdx];
      remaining--;
    }
    branchIdx++;
  }

  while (nodes.length < typeSequence.length) {
    const existingNodes = shuffleArray([...nodes]);
    let added = false;
    for (const parent of existingNodes) {
      const available = getAvailableNeighbors(parent.q, parent.r);
      if (available.length > 0) {
        const chosen = pickRandom(available);
        const nodeIdx = nodes.length;
        const nodeId = `proc-${idCounter++}`;
        usedCoords.set(coordKey(chosen.q, chosen.r), nodeIdx);
        nodes.push({
          nodeId,
          q: chosen.q, r: chosen.r,
          type: 'encounter',
          name: '',
          description: '',
          adjacentNodes: [],
        });
        parent.adjacentNodes.push(nodeId);
        nodes[nodeIdx].adjacentNodes.push(parent.nodeId);
        added = true;
        break;
      }
    }
    if (!added) break;
  }

  const bossIdx = mainPath[mainPath.length - 1];
  let chestIdx = -1;
  const bossNode = nodes[bossIdx];
  const bossNeighbors = getAvailableNeighbors(bossNode.q, bossNode.r);
  if (bossNeighbors.length > 0) {
    const chosen = pickRandom(bossNeighbors);
    chestIdx = nodes.length;
    const chestId = `proc-${idCounter++}`;
    usedCoords.set(coordKey(chosen.q, chosen.r), chestIdx);
    nodes.push({
      nodeId: chestId,
      q: chosen.q, r: chosen.r,
      type: 'chest',
      name: '',
      description: '',
      adjacentNodes: [bossNode.nodeId],
    });
    bossNode.adjacentNodes.push(chestId);
  }

  const puzzleNodeIdx = bossIdx > 1 ? mainPath[mainPath.length - 2] : mainPath[Math.max(0, mainPath.length - 2)];

  const assignableTypes = typeSequence.slice(1);
  const shuffledTypes = shuffleArray(assignableTypes);

  const fixedAssignments = new Map<number, DungeonNode['type']>();
  fixedAssignments.set(bossIdx, 'boss');
  if (chestIdx >= 0) fixedAssignments.set(chestIdx, 'chest');
  fixedAssignments.set(puzzleNodeIdx, 'puzzle');

  const unassigned = nodes
    .map((_, i) => i)
    .filter(i => i !== 0 && !fixedAssignments.has(i));

  const typesToAssign = shuffledTypes.filter(t => t !== 'entrance' && t !== 'boss' && t !== 'chest' && t !== 'puzzle');
  const puzzlesNeeded = shuffledTypes.filter(t => t === 'puzzle').length - 1;
  for (let p = 0; p < puzzlesNeeded && unassigned.length > 0; p++) {
    const idx = unassigned.shift()!;
    fixedAssignments.set(idx, 'puzzle');
  }

  let typeIdx = 0;
  for (const nodeIdx of unassigned) {
    if (typeIdx < typesToAssign.length) {
      fixedAssignments.set(nodeIdx, typesToAssign[typeIdx]);
      typeIdx++;
    } else {
      fixedAssignments.set(nodeIdx, pickRandom(['encounter', 'lore', 'trap']));
    }
  }

  fixedAssignments.forEach((type, idx) => {
    nodes[idx].type = type;
  });

  const encounters = shuffleArray([...ENCOUNTER_POOL]);
  const traps = shuffleArray([...TRAP_POOL]);
  const puzzles = shuffleArray([...PUZZLE_POOL]);
  const lores = shuffleArray([...LORE_POOL]);
  const bosses = shuffleArray([...BOSS_POOL]);
  const safes = shuffleArray([...SAFE_POOL]);
  const caches = shuffleArray([...CACHE_POOL]);
  const chests = shuffleArray([...CHEST_POOL]);

  let ei = 0, ti = 0, pi = 0, li = 0;

  for (const node of nodes) {
    switch (node.type) {
      case 'encounter': {
        const data = encounters[ei % encounters.length];
        ei++;
        node.name = data.name;
        node.description = data.description;
        node.encounterData = data.encounterData;
        break;
      }
      case 'trap': {
        const data = traps[ti % traps.length];
        ti++;
        node.name = data.name;
        node.description = data.description;
        node.trapData = data.trapData;
        break;
      }
      case 'puzzle': {
        const data = puzzles[pi % puzzles.length];
        pi++;
        node.name = data.name;
        node.description = data.description;
        node.puzzleData = data.puzzleData;
        break;
      }
      case 'lore': {
        const data = lores[li % lores.length];
        li++;
        node.name = data.name;
        node.description = data.description;
        node.loreText = data.loreText;
        break;
      }
      case 'boss': {
        const data = bosses[0];
        node.name = data.name;
        node.description = data.description;
        node.bossData = data.bossData;
        break;
      }
      case 'safe': {
        const data = safes[0];
        node.name = data.name;
        node.description = data.description;
        break;
      }
      case 'cache': {
        node.name = 'Hidden Supply Cache';
        node.description = 'Behind a concealed section of wall, you discover an alcove packed with supplies and a few items that clearly belonged to previous victims.';
        node.cacheItems = caches[0];
        break;
      }
      case 'chest': {
        const data = chests[0];
        node.name = data.name;
        node.description = data.description;
        break;
      }
    }
  }

  return nodes;
}

// ─── Fog of War ──────────────────────────────────────────────────────────────

export function getRevealedNodes(
  currentCoord: { q: number; r: number },
  revealedCoords: Array<{ q: number; r: number }>,
  allNodes: DungeonNode[]
): DungeonNode[] {
  const coordSet = new Set(revealedCoords.map(c => `${c.q},${c.r}`));
  coordSet.add(`${currentCoord.q},${currentCoord.r}`);

  return allNodes.filter(node => coordSet.has(`${node.q},${node.r}`));
}

export function revealAdjacentNodes(
  currentCoord: { q: number; r: number },
  allNodes: DungeonNode[]
): Array<{ q: number; r: number }> {
  const currentNode = allNodes.find(n => n.q === currentCoord.q && n.r === currentCoord.r);
  if (!currentNode) return [];

  const revealed: Array<{ q: number; r: number }> = [{ q: currentCoord.q, r: currentCoord.r }];

  for (const adjId of currentNode.adjacentNodes) {
    const adjNode = allNodes.find(n => n.nodeId === adjId);
    if (adjNode) {
      revealed.push({ q: adjNode.q, r: adjNode.r });
    }
  }

  return revealed;
}

// ─── Movement Validation ─────────────────────────────────────────────────────

export function canMoveTo(
  fromNode: DungeonNode,
  toNodeId: string,
  clearedNodes: string[],
  dungeonNodes: DungeonNode[]
): { allowed: boolean; reason?: string } {
  if (!fromNode.adjacentNodes.includes(toNodeId)) {
    return { allowed: false, reason: 'That path does not connect to your current location.' };
  }

  const targetNode = dungeonNodes.find(n => n.nodeId === toNodeId);
  if (!targetNode) {
    return { allowed: false, reason: 'Unknown destination — the darkness hides this path.' };
  }

  if (targetNode.type === 'boss') {
    const chestNodeIds = new Set(dungeonNodes.filter(n => n.type === 'chest').map(n => n.nodeId));
    const bossAdjacent = targetNode.adjacentNodes.filter(id => !chestNodeIds.has(id));
    const allGatesCleared = bossAdjacent.every(id => {
      const gateNode = dungeonNodes.find(n => n.nodeId === id);
      if (!gateNode) return true;
      if (gateNode.type === 'puzzle') return clearedNodes.includes(id);
      return true;
    });
    if (!allGatesCleared) {
      return { allowed: false, reason: 'A gate blocks your path. You must solve the puzzle to proceed.' };
    }
  }

  if (targetNode.type === 'chest') {
    const bossNodes = dungeonNodes.filter(n => n.type === 'boss');
    const bossDefeated = bossNodes.every(b => clearedNodes.includes(b.nodeId));
    if (!bossDefeated) {
      return { allowed: false, reason: 'The chieftain guards the way to his hoard. Defeat the boss first.' };
    }
  }

  return { allowed: true };
}

// ─── Node Resolution Engine ──────────────────────────────────────────────────

export function resolveNodeEntry(
  node: DungeonNode,
  run: { clearedNodes: string[]; disarmedTraps: string[]; solvedPuzzles: string[] }
): NodeResolution | null {
  if (run.clearedNodes.includes(node.nodeId)) {
    return null;
  }

  switch (node.type) {
    case 'entrance':
      return {
        narration: {
          title: node.name,
          description: node.description,
          options: [
            { id: 'proceed', label: 'Descend into the Warren', resolutionType: 'choice' },
            { id: 'search', label: 'Search the entrance for clues', resolutionType: 'check', dc: 10, successText: 'You notice scratch marks and a faint trail of blood leading deeper — something was dragged inside recently.', failText: 'The entrance reveals nothing beyond filth and goblin stink.' },
          ],
        },
      };

    case 'encounter':
      return {
        narration: {
          title: node.name,
          description: node.description,
          options: [
            { id: 'fight', label: 'Draw weapons and attack', resolutionType: 'combat' },
            { id: 'stealth', label: 'Attempt to sneak past', resolutionType: 'check', dc: 14, successText: 'You slip through the shadows undetected, leaving the enemies none the wiser.', failText: 'A loose stone clatters underfoot. The enemies whip around — combat is unavoidable!' },
            { id: 'intimidate', label: 'Attempt to intimidate', resolutionType: 'check', dc: 13, successText: 'Your fearsome display sends the creatures scrambling. They flee deeper into the warren, leaving their meager possessions behind.', failText: 'The creatures snarl defiantly. Your bluff has been called — steel must speak now.' },
          ],
        },
        combatData: node.encounterData,
      };

    case 'trap':
      if (run.disarmedTraps.includes(node.nodeId)) return null;
      return {
        narration: {
          title: node.name,
          description: node.description,
          options: [
            { id: 'disarm', label: 'Attempt to disarm the trap', resolutionType: 'check', dc: node.trapData!.disarmDC, successText: 'With careful hands, you neutralize the mechanism. The trap clicks harmlessly.', failText: 'The trap triggers! You weren\'t quick enough.' },
            { id: 'avoid', label: 'Carefully step around it', resolutionType: 'check', dc: node.trapData!.dc, successText: 'You navigate the hazard with practiced caution.', failText: 'Your foot catches — the trap springs!' },
            { id: 'trigger', label: 'Trigger it intentionally from a distance', resolutionType: 'choice', successText: 'The trap fires harmlessly as you watch from safety. Clever — but you won\'t recover any components.' },
          ],
        },
        trapCheck: { dc: node.trapData!.dc, type: node.trapData!.type },
      };

    case 'puzzle':
      if (run.solvedPuzzles.includes(node.nodeId)) return null;
      return {
        narration: {
          title: node.name,
          description: node.description,
          options: [
            { id: 'solve', label: 'Attempt to solve the puzzle', resolutionType: 'check', dc: node.puzzleData!.dc, successText: node.puzzleData!.solutionNarrative, failText: node.puzzleData!.failureNarrative },
            { id: 'force', label: 'Try to force it open', resolutionType: 'check', dc: node.puzzleData!.dc + 5, successText: 'With brute strength, you bypass the mechanism — though you feel you may have missed something.', failText: 'The mechanism resists your efforts completely. Finesse may be required.' },
            { id: 'examine', label: 'Study the puzzle carefully', resolutionType: 'lore', successText: node.puzzleData!.hint },
          ],
        },
        puzzleData: node.puzzleData,
      };

    case 'lore':
      return {
        narration: {
          title: node.name,
          description: node.description,
          options: [
            { id: 'read', label: 'Read and study the writings', resolutionType: 'lore', successText: node.loreText },
            { id: 'search', label: 'Search the area thoroughly', resolutionType: 'check', dc: 12, successText: 'Among the dust and debris, you find a small trinket — a carved stone figurine worth a few coins, but more importantly, it confirms the lore you\'ve uncovered.', failText: 'Nothing else of interest reveals itself.' },
          ],
        },
      };

    case 'cache':
      return {
        narration: {
          title: node.name,
          description: node.description,
          options: [
            { id: 'loot', label: 'Take the supplies', resolutionType: 'loot' },
            { id: 'search-more', label: 'Search for hidden compartments', resolutionType: 'check', dc: 15, successText: 'Behind a false panel, you discover an additional stash — the goblins were more cunning than you thought.', failText: 'The cache appears to hold everything. Nothing else is hidden here.' },
          ],
        },
      };

    case 'safe':
      return {
        narration: {
          title: node.name,
          description: node.description,
          options: [
            { id: 'rest', label: 'Take a short rest', resolutionType: 'choice', successText: 'You barricade the door and rest. The cool water from the spring restores your spirits, and you tend your wounds in relative safety.' },
            { id: 'search', label: 'Search the storeroom', resolutionType: 'check', dc: 11, successText: 'Among the ancient crates, you find a few usable supplies that have survived the centuries.', failText: 'The crates hold only dust and the ghosts of dwarven industry.' },
          ],
        },
      };

    case 'boss':
      return {
        narration: {
          title: node.name,
          description: node.description,
          options: [
            { id: 'fight', label: 'Challenge the Chieftain', resolutionType: 'combat' },
            { id: 'parley', label: 'Attempt to negotiate', resolutionType: 'check', dc: 18, successText: 'The chieftain pauses, crown flickering. "You are... strong. Perhaps we can bargain." The negotiation is tense, but the chieftain agrees to release its prisoners — though it keeps the crown.', failText: '"Negotiate? With meat?" The chieftain hurls its blade. Combat begins.' },
          ],
        },
        combatData: node.bossData,
      };

    case 'chest':
      return {
        narration: {
          title: node.name,
          description: node.description,
          options: (node.chestRewards || []).map(reward => ({
            id: reward.id,
            label: reward.name,
            resolutionType: 'loot' as const,
            successText: reward.description,
            failText: reward.consequence,
          })),
        },
      };

    default:
      return null;
  }
}

// ─── Action Resolution ───────────────────────────────────────────────────────

export function resolveAction(params: {
  node: DungeonNode;
  optionId: string;
  characterLevel: number;
  skillModifier: number;
  diceRoll: number;
}): {
  success: boolean;
  narrative: string;
  rewards?: Array<{ name: string; type: string; value?: number }>;
  damage?: number;
  statusEffect?: string;
  nodeCleared: boolean;
  combatTriggered: boolean;
  combatData?: any;
} {
  const { node, optionId, characterLevel, skillModifier, diceRoll } = params;
  const totalRoll = diceRoll + skillModifier;

  if (optionId === 'fight') {
    return {
      success: true,
      narrative: `You steel yourself for battle in ${node.name}. Roll for initiative!`,
      nodeCleared: false,
      combatTriggered: true,
      combatData: node.type === 'boss' ? node.bossData : node.encounterData,
    };
  }

  if (optionId === 'trigger') {
    return {
      success: true,
      narrative: 'You trigger the trap from a safe distance. The mechanism fires harmlessly, filling the corridor with debris. The way is now safe to pass.',
      nodeCleared: true,
      combatTriggered: false,
    };
  }

  if (optionId === 'proceed') {
    return {
      success: true,
      narrative: 'You descend into the darkness of the Goblin Warren. The air grows thick with the stench of rot and smoke. There is no turning back easily now.',
      nodeCleared: true,
      combatTriggered: false,
    };
  }

  if (optionId === 'read') {
    return {
      success: true,
      narrative: node.loreText || 'You study the writings carefully, committing the knowledge to memory.',
      nodeCleared: true,
      combatTriggered: false,
    };
  }

  if (optionId === 'rest') {
    const hpRestored = Math.max(1, characterLevel) * 2 + 4;
    return {
      success: true,
      narrative: `You barricade the entrance and rest in the ancient storeroom. The spring water is pure and refreshing. You recover ${hpRestored} hit points and feel your resolve strengthen.`,
      rewards: [{ name: 'Short Rest', type: 'healing', value: hpRestored }],
      nodeCleared: true,
      combatTriggered: false,
    };
  }

  if (optionId === 'loot') {
    if (node.type === 'cache' && node.cacheItems) {
      return {
        success: true,
        narrative: 'You gather the supplies, stuffing useful items into your pack. The healing potion gleams with a reassuring crimson glow, and the silver locket bears the name "Durik" — perhaps someone is looking for this.',
        rewards: node.cacheItems.map(item => ({ name: item.name, type: item.type, value: item.value })),
        nodeCleared: true,
        combatTriggered: false,
      };
    }
    if (node.type === 'chest' && node.chestRewards) {
      const chosen = node.chestRewards.find(r => r.id === optionId) || node.chestRewards[0];
      return {
        success: true,
        narrative: `You open the ${chosen.name} compartment. ${chosen.description}`,
        rewards: chosen.rewards,
        statusEffect: chosen.consequence,
        nodeCleared: true,
        combatTriggered: false,
      };
    }
    return { success: true, narrative: 'You gather what you can.', nodeCleared: true, combatTriggered: false };
  }

  if (node.type === 'chest' && node.chestRewards) {
    const chosen = node.chestRewards.find(r => r.id === optionId);
    if (chosen) {
      return {
        success: true,
        narrative: `You choose the ${chosen.name}. ${chosen.description}${chosen.consequence ? ` Warning: ${chosen.consequence}` : ''}`,
        rewards: chosen.rewards,
        statusEffect: chosen.consequence,
        nodeCleared: true,
        combatTriggered: false,
      };
    }
  }

  const resolution = resolveNodeEntry(node, { clearedNodes: [], disarmedTraps: [], solvedPuzzles: [] });
  if (!resolution) {
    return { success: true, narrative: 'Nothing remains to challenge you here.', nodeCleared: true, combatTriggered: false };
  }

  const option = resolution.narration.options.find(o => o.id === optionId);
  if (!option) {
    return { success: false, narrative: 'You hesitate, unsure of what to do.', nodeCleared: false, combatTriggered: false };
  }

  if (option.resolutionType === 'lore') {
    return {
      success: true,
      narrative: option.successText || 'You uncover ancient knowledge.',
      nodeCleared: true,
      combatTriggered: false,
    };
  }

  if (option.resolutionType === 'check' && option.dc) {
    const success = totalRoll >= option.dc;

    if (success) {
      const result: ReturnType<typeof resolveAction> = {
        success: true,
        narrative: option.successText || 'You succeed.',
        nodeCleared: true,
        combatTriggered: false,
      };

      if (node.type === 'encounter' && optionId === 'intimidate') {
        result.rewards = [{ name: 'Scattered Coins', type: 'gold', value: 10 + characterLevel * 2 }];
      }
      if (node.type === 'trap' && optionId === 'disarm') {
        result.rewards = [{ name: 'Trap Components', type: 'crafting', value: 5 }];
      }

      return result;
    } else {
      const result: ReturnType<typeof resolveAction> = {
        success: false,
        narrative: option.failText || 'You fail.',
        nodeCleared: false,
        combatTriggered: false,
      };

      if (node.type === 'trap' && node.trapData) {
        const diceMatch = node.trapData.damage.match(/(\d+)d(\d+)/);
        let dmg = 0;
        if (diceMatch) {
          const count = parseInt(diceMatch[1]);
          const sides = parseInt(diceMatch[2]);
          for (let i = 0; i < count; i++) {
            dmg += Math.floor(Math.random() * sides) + 1;
          }
        }
        result.damage = dmg;
        result.statusEffect = node.trapData.effect;
        result.nodeCleared = true;
      }

      if (node.type === 'encounter' && (optionId === 'stealth' || optionId === 'intimidate')) {
        result.combatTriggered = true;
        result.combatData = node.encounterData;
      }

      return result;
    }
  }

  if (option.resolutionType === 'choice') {
    return {
      success: true,
      narrative: option.successText || 'You make your choice.',
      nodeCleared: true,
      combatTriggered: false,
    };
  }

  return { success: true, narrative: 'You proceed.', nodeCleared: true, combatTriggered: false };
}

// ─── Resource Pressure ───────────────────────────────────────────────────────

export function consumeResources(
  action: 'move' | 'search' | 'rest' | 'combat',
  currentLight: number,
  currentSupplies: number
): {
  lightTicks: number;
  supplies: number;
  warnings: string[];
  darkness: boolean;
  starving: boolean;
} {
  const costs: Record<string, { light: number; supplies: number }> = {
    move: { light: 1, supplies: 0 },
    search: { light: 1, supplies: 0 },
    rest: { light: 2, supplies: 1 },
    combat: { light: 2, supplies: 1 },
  };

  const cost = costs[action];
  const newLight = Math.max(0, currentLight - cost.light);
  const newSupplies = Math.max(0, currentSupplies - cost.supplies);
  const warnings: string[] = [];

  if (newLight <= 3 && newLight > 0) {
    warnings.push('Your torch sputters and dims. The shadows press closer. Find more light soon.');
  }
  if (newLight === 0 && currentLight > 0) {
    warnings.push('Your last light source dies. Darkness swallows you whole. All checks are made at disadvantage. Creatures with darkvision hunt freely.');
  }
  if (newSupplies <= 2 && newSupplies > 0) {
    warnings.push('Your stomach growls. Supplies are running dangerously low.');
  }
  if (newSupplies === 0 && currentSupplies > 0) {
    warnings.push('You are out of supplies. Exhaustion will set in soon. Each hour without food costs 1 level of exhaustion.');
  }

  return {
    lightTicks: newLight,
    supplies: newSupplies,
    warnings,
    darkness: newLight === 0,
    starving: newSupplies === 0,
  };
}

export function restInSafeRoom(
  currentLight: number,
  currentSupplies: number,
  fatigue: number
): {
  lightTicks: number;
  supplies: number;
  hpRestored: number;
  narrative: string;
} {
  const supplyCost = 2;
  const lightCost = 3;
  const newSupplies = Math.max(0, currentSupplies - supplyCost);
  const newLight = Math.max(0, currentLight - lightCost);
  const hpRestored = Math.max(4, 10 - fatigue);

  let narrative = 'You barricade the door and settle in for a rest. ';

  if (newSupplies > 0) {
    narrative += `You eat a modest meal and tend your wounds, recovering ${hpRestored} hit points. `;
  } else {
    narrative += `Without food, the rest is fitful. You recover only ${Math.floor(hpRestored / 2)} hit points. `;
  }

  if (newLight <= 2) {
    narrative += 'Your light source burns low — you should find more torches before venturing deeper.';
  } else {
    narrative += 'Feeling refreshed, you prepare to press onward.';
  }

  return {
    lightTicks: newLight,
    supplies: newSupplies,
    hpRestored: newSupplies > 0 ? hpRestored : Math.floor(hpRestored / 2),
    narrative,
  };
}

// ─── Retreat Logic ───────────────────────────────────────────────────────────

export function processRetreat(
  currentNode: DungeonNode,
  clearedNodes: string[],
  dungeonNodes: DungeonNode[] = []
): {
  narrative: string;
  respawnedNodes: string[];
  bossAdvantage: boolean;
} {
  const allNodes = dungeonNodes.length > 0 ? dungeonNodes : [currentNode];
  const encounterNodes = allNodes.filter(n => n.type === 'encounter' && clearedNodes.includes(n.nodeId));
  const respawnCount = Math.ceil(encounterNodes.length * 0.4);
  const respawnedNodes: string[] = [];

  const shuffled = [...encounterNodes].sort(() => Math.random() - 0.5);
  for (let i = 0; i < respawnCount && i < shuffled.length; i++) {
    respawnedNodes.push(shuffled[i].nodeId);
  }

  const bossNodes = allNodes.filter(n => n.type === 'boss');
  const bossDefeated = bossNodes.every(b => clearedNodes.includes(b.nodeId));

  let narrative = 'You retreat from the depths, retracing your steps through the dark tunnels. ';

  if (respawnedNodes.length > 0) {
    narrative += `As you flee, you hear the scrabble of clawed feet behind you — the dungeon is already repopulating. ${respawnedNodes.length} previously cleared rooms have been reoccupied. `;
  }

  if (!bossDefeated) {
    narrative += 'Mocking laughter echoes through the tunnels. "Run, little heroes! Next time, we will be ready." The creatures will be more alert on your next attempt.';
  } else {
    narrative += 'Though the boss has fallen, lesser creatures scurry to reclaim what they can. Your victory is incomplete.';
  }

  return {
    narrative,
    respawnedNodes,
    bossAdvantage: !bossDefeated,
  };
}

// ─── Post-Run Summary ────────────────────────────────────────────────────────

export function generateDelveSummary(
  run: {
    clearedNodes: string[];
    disarmedTraps: string[];
    solvedPuzzles: string[];
    lightTicks: number;
    supplies: number;
    status: string;
  },
  dungeonNodes: DungeonNode[]
): {
  nodesExplored: number;
  nodesCleared: number;
  trapsDisarmed: number;
  puzzlesSolved: number;
  bossDefeated: boolean;
  completionPercent: number;
  rating: 'novice' | 'adventurer' | 'veteran' | 'master';
} {
  const totalNodes = dungeonNodes.length;
  const nodesCleared = run.clearedNodes.length;
  const trapsDisarmed = run.disarmedTraps.length;
  const puzzlesSolved = run.solvedPuzzles.length;
  const bossNodeIds = dungeonNodes.filter(n => n.type === 'boss').map(n => n.nodeId);
  const bossDefeated = bossNodeIds.length > 0 && bossNodeIds.every(id => run.clearedNodes.includes(id));
  const completionPercent = Math.round((nodesCleared / totalNodes) * 100);

  const totalTraps = dungeonNodes.filter(n => n.type === 'trap').length;
  const totalPuzzles = dungeonNodes.filter(n => n.type === 'puzzle').length;

  let score = completionPercent;
  if (bossDefeated) score += 15;
  if (trapsDisarmed === totalTraps) score += 10;
  if (puzzlesSolved === totalPuzzles) score += 10;
  if (run.lightTicks > 0) score += 5;
  if (run.supplies > 0) score += 5;
  if (run.status === 'victory') score += 10;

  let rating: 'novice' | 'adventurer' | 'veteran' | 'master';
  if (score >= 90) rating = 'master';
  else if (score >= 70) rating = 'veteran';
  else if (score >= 40) rating = 'adventurer';
  else rating = 'novice';

  return {
    nodesExplored: nodesCleared,
    nodesCleared,
    trapsDisarmed,
    puzzlesSolved,
    bossDefeated,
    completionPercent,
    rating,
  };
}

// ─── Chest Reward System ─────────────────────────────────────────────────────

export function getChestOptions(
  dungeonId: number,
  characterLevel: number
): Array<{
  id: string;
  name: string;
  description: string;
  rewards: Array<{ type: string; name: string; value?: number }>;
  consequence?: string;
}> {
  const levelScale = Math.max(1, characterLevel);
  const goldBase = 50 + levelScale * 15;

  return [
    {
      id: 'safe-reward',
      name: 'The Proven Haul',
      description: `A solid collection of practical adventuring supplies — ${goldBase} gold coins, two potions of healing, and a reliable everburning torch. Nothing cursed, nothing tricky. Just good, honest plunder.`,
      rewards: [
        { type: 'gold', name: 'Gold Coins', value: goldBase },
        { type: 'consumable', name: 'Potion of Healing', value: 50 },
        { type: 'consumable', name: 'Potion of Healing', value: 50 },
        { type: 'supply', name: 'Everburning Torch', value: 25 },
      ],
    },
    {
      id: 'risk-reward',
      name: 'The Forbidden Prize',
      description: `A weapon of dark power hums with malevolent energy. Its blade is sharper than anything you've wielded — but the whispers that emanate from it speak of a hungry intelligence within.`,
      rewards: [
        { type: 'weapon', name: `Shadowforged Blade (+${Math.min(3, Math.ceil(levelScale / 3))} weapon)`, value: 200 + levelScale * 50 },
        { type: 'gold', name: 'Gold Coins', value: Math.floor(goldBase * 0.4) },
      ],
      consequence: `The weapon whispers during long rests. After 3 long rests, DC ${12 + Math.floor(levelScale / 2)} Wisdom save or gain one level of exhaustion. The whispers reveal useful information about nearby dangers — but at a cost to your sanity.`,
    },
    {
      id: 'knowledge-reward',
      name: 'The Scholar\'s Bounty',
      description: 'Maps, journals, and a signet ring that could open doors no amount of gold can purchase. Knowledge is the true treasure for those wise enough to claim it.',
      rewards: [
        { type: 'quest_item', name: 'Ancient Survey Maps (reveals hidden dungeon entrance)', value: 0 },
        { type: 'quest_item', name: 'Faction Signet Ring (grants audience with regional powers)', value: 0 },
        { type: 'gold', name: 'Gold Coins', value: Math.floor(goldBase * 0.3) },
        { type: 'lore', name: 'Sealed Chamber Location (deeper dungeon hook)', value: 0 },
      ],
    },
  ];
}
