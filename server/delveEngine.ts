
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

export const GOBLIN_WARREN: DungeonNode[] = [
  {
    nodeId: 'gw-entrance',
    q: 0, r: 0,
    type: 'entrance',
    name: 'Warren Mouth',
    description: 'A jagged fissure splits the hillside, belching the stink of rotting meat and wood smoke. Crude totems of bone and feather flank the opening — warnings to trespassers. The passage beyond slopes downward into flickering torchlight and the distant chittering of goblins.',
    adjacentNodes: ['gw-corridor-1'],
  },
  {
    nodeId: 'gw-corridor-1',
    q: 1, r: 0,
    type: 'encounter',
    name: 'Sentry Tunnel',
    description: 'The narrow tunnel widens just enough for two abreast. The walls are scratched with crude tally marks — a goblin counting game, or a kill count. Ahead, you hear the scrape of small boots on stone.',
    encounterData: {
      enemies: [
        { name: 'Goblin Scout', cr: 0.25, hp: 7, ac: 13, attackBonus: 4, damage: '1d6+2', abilities: ['Nimble Escape'] },
        { name: 'Goblin Scout', cr: 0.25, hp: 7, ac: 13, attackBonus: 4, damage: '1d6+2', abilities: ['Nimble Escape'] },
      ],
      xpReward: 50,
      tacticalNote: 'The scouts will attempt to flee and raise the alarm if reduced below half HP. Blocking the corridor prevents their escape.',
    },
    adjacentNodes: ['gw-entrance', 'gw-tripwire', 'gw-lore-walls'],
  },
  {
    nodeId: 'gw-tripwire',
    q: 2, r: 0,
    type: 'trap',
    name: 'Tripwire Passage',
    description: 'The corridor narrows to single file. Cobwebs hang thick between rough-hewn walls. Something about the floor ahead looks… deliberate. Thin cords stretch ankle-height across the passage, barely visible in the guttering torchlight.',
    trapData: {
      type: 'tripwire',
      dc: 13,
      damage: '1d6',
      effect: 'Falling rocks deal bludgeoning damage and create difficult terrain. The noise alerts nearby goblins.',
      disarmDC: 12,
      detectDC: 12,
      triggerDescription: 'A thin cord stretches across the passage at ankle height, connected to a net of loose stones wedged into the ceiling.',
    },
    adjacentNodes: ['gw-corridor-1', 'gw-warriors-den'],
  },
  {
    nodeId: 'gw-lore-walls',
    q: 1, r: 1,
    type: 'lore',
    name: 'Carved Walls',
    description: 'A dead-end alcove opens to the left. The walls here are older than the goblin tunnels — ancient stonework carved with spiraling glyphs that predate the warren by centuries. Moss clings to deep-cut runes that pulse faintly when touched.',
    loreText: 'The carvings depict a binding ritual. Something was sealed beneath this hill long before the goblins arrived — a creature of shadow and hunger. The glyphs read: "Let the Hollow King sleep, lest his whispers wake the deep." The goblins have scratched crude drawings over parts of the carving: a crowned figure with too many eyes.',
    adjacentNodes: ['gw-corridor-1'],
  },
  {
    nodeId: 'gw-warriors-den',
    q: 3, r: 0,
    type: 'encounter',
    name: 'Warriors\' Den',
    description: 'The tunnel opens into a low-ceilinged chamber reeking of unwashed bodies and stale beer. Crude bedrolls line the walls, and a cookfire smolders in the center. Three goblins in patchwork armor look up from their dice game, reaching for notched scimitars.',
    encounterData: {
      enemies: [
        { name: 'Goblin Warrior', cr: 0.5, hp: 12, ac: 14, attackBonus: 4, damage: '1d8+2', abilities: ['Pack Tactics'] },
        { name: 'Goblin Warrior', cr: 0.5, hp: 12, ac: 14, attackBonus: 4, damage: '1d8+2', abilities: ['Pack Tactics'] },
        { name: 'Goblin Warrior', cr: 0.5, hp: 10, ac: 14, attackBonus: 4, damage: '1d8+2', abilities: ['Pack Tactics'] },
      ],
      xpReward: 150,
      tacticalNote: 'The warriors fight in close formation, using Pack Tactics. Overturning the cookfire (DC 10 Athletics) creates difficult terrain and deals 1d4 fire damage to adjacent creatures.',
    },
    adjacentNodes: ['gw-tripwire', 'gw-pit-trap', 'gw-runic-door'],
  },
  {
    nodeId: 'gw-pit-trap',
    q: 3, r: 1,
    type: 'trap',
    name: 'Concealed Pit',
    description: 'The floor here is covered with a layer of packed dirt and animal hides. It looks solid enough, but the supports creak underfoot. Bones of small animals are scattered near the edges — nothing wants to walk through the center.',
    trapData: {
      type: 'pit',
      dc: 14,
      damage: '2d6',
      effect: 'A 10-foot pit opens beneath the unwary. Sharpened stakes at the bottom deal piercing damage. Climbing out requires DC 12 Athletics.',
      disarmDC: 14,
      detectDC: 13,
      triggerDescription: 'Concealed by hides and packed earth, a 10-foot-deep pit is rigged to collapse under the weight of a Medium creature.',
    },
    adjacentNodes: ['gw-warriors-den', 'gw-wolf-den'],
  },
  {
    nodeId: 'gw-runic-door',
    q: 3, r: -1,
    type: 'puzzle',
    name: 'Runic Door',
    description: 'A heavy stone door blocks the passage. Unlike the crude goblin construction elsewhere, this door is masterwork dwarven craft — ancient and unyielding. Three runic symbols glow on its surface: a flame, a mountain, and a river. Beneath them, three stone dials await alignment.',
    puzzleData: {
      type: 'combination',
      description: 'Three dwarven runes must be aligned in the correct order. The carvings on the walls nearby (if the party found the Carved Walls) hint at the sequence: "Fire forges the mountain, water carves the stone."',
      dc: 14,
      hint: 'The sequence follows the cycle of creation: Flame → Mountain → River. Characters who visited the Carved Walls lore node gain advantage on this check.',
      solutionNarrative: 'The dials click into place — flame, mountain, river. Ancient gears grind within the stone as the door slides open, exhaling air that has been sealed for centuries. Beyond lies a forgotten storeroom, untouched by goblin hands.',
      failureNarrative: 'The runes flash angry red. A pulse of arcane energy ripples outward, and the dials reset. You\'ll need to try again — but the noise may draw attention.',
      reward: 'Access to the Abandoned Storeroom (safe room with supplies)',
    },
    adjacentNodes: ['gw-warriors-den', 'gw-safe-room'],
  },
  {
    nodeId: 'gw-safe-room',
    q: 2, r: -1,
    type: 'safe',
    name: 'Abandoned Storeroom',
    description: 'Beyond the runic door lies a dwarven storeroom preserved by ancient magic. Dusty crates line the walls, their contents still intact. A clean spring trickles from a crack in the stone wall into a carved basin. The air is cool and fresh — a welcome respite from the goblin stench. No monsters will find you here.',
    adjacentNodes: ['gw-runic-door'],
  },
  {
    nodeId: 'gw-wolf-den',
    q: 3, r: 2,
    type: 'encounter',
    name: 'Wolf Kennel',
    description: 'The smell hits before the sight — a feral musk of fur and blood. Chained to iron stakes driven into the stone floor, three mangy wolves strain against their bonds, eyes reflecting the torchlight with feral hunger. Gnawed bones litter the ground. One of the chains looks ready to snap.',
    encounterData: {
      enemies: [
        { name: 'Dire Wolf', cr: 1, hp: 37, ac: 14, attackBonus: 5, damage: '2d6+3', abilities: ['Pack Tactics', 'Knockdown'] },
        { name: 'Wolf', cr: 0.25, hp: 11, ac: 13, attackBonus: 4, damage: '2d4+2', abilities: ['Pack Tactics', 'Knockdown'] },
        { name: 'Wolf', cr: 0.25, hp: 11, ac: 13, attackBonus: 4, damage: '2d4+2', abilities: ['Pack Tactics', 'Knockdown'] },
      ],
      xpReward: 200,
      tacticalNote: 'The wolves are chained (5 ft reach). A character can attempt to calm them with DC 15 Animal Handling. The dire wolf breaks free on round 2 regardless. Fighting from range is advised.',
    },
    adjacentNodes: ['gw-pit-trap', 'gw-poison-dart', 'gw-lore-journal'],
  },
  {
    nodeId: 'gw-poison-dart',
    q: 4, r: 2,
    type: 'trap',
    name: 'Poison Dart Corridor',
    description: 'The walls of this narrow passage are pocked with tiny holes at chest height — hundreds of them, forming a pattern that looks almost decorative. A faint chemical odor hangs in the air. The floor is littered with tiny feathered darts, their tips stained dark green.',
    trapData: {
      type: 'poison_dart',
      dc: 15,
      damage: '1d4',
      effect: 'Poisoned condition for 1 hour (DC 13 Constitution save). Disadvantage on attack rolls and ability checks while poisoned.',
      disarmDC: 15,
      detectDC: 11,
      triggerDescription: 'Pressure plates in the floor trigger a volley of poison-tipped darts from concealed wall apertures. The darts are coated in cave spider venom.',
    },
    adjacentNodes: ['gw-wolf-den', 'gw-shaman-sanctum'],
  },
  {
    nodeId: 'gw-lore-journal',
    q: 2, r: 2,
    type: 'lore',
    name: 'Prisoner\'s Cell',
    description: 'A small, damp cell branching off the main tunnel. Iron bars — bent and rusty — suggest someone was kept here. In the corner, scratched into the stone with a broken nail, is a message. A ragged journal lies half-buried in the straw.',
    loreText: 'The journal belongs to a dwarven prospector named Durik Stonehammer. His entries grow increasingly frantic: "Day 12 — The chieftain speaks of a \'patron\' in the deep. Something older than goblins. They feed it. Day 19 — I hear it whispering through the walls. It knows my name. Day 23 — The chieftain wears a crown of black iron now. His eyes have changed. Whatever sleeps below is waking." The final entry is just a word, carved deep: "RUN."',
    adjacentNodes: ['gw-wolf-den'],
  },
  {
    nodeId: 'gw-shaman-sanctum',
    q: 4, r: 3,
    type: 'encounter',
    name: 'Shaman\'s Sanctum',
    description: 'Fetid smoke billows from a chamber draped in totems of bone and sinew. A goblin shaman hunches over a bubbling cauldron, muttering incantations. Crude symbols painted in blood cover every surface. The air crackles with unstable magic — this goblin has tapped into something beyond its understanding.',
    encounterData: {
      enemies: [
        { name: 'Goblin Shaman', cr: 1, hp: 21, ac: 12, attackBonus: 4, damage: '1d8+2', abilities: ['Spellcasting (Hex, Shield, Burning Hands)', 'Dark Patron\'s Gift (1/day: Inflict Wounds)'] },
        { name: 'Goblin Acolyte', cr: 0.25, hp: 7, ac: 11, attackBonus: 3, damage: '1d4+1', abilities: ['Fanatical: advantage on saves vs. frightened'] },
      ],
      xpReward: 250,
      tacticalNote: 'The shaman uses Hex on the strongest-looking character, then Burning Hands if multiple targets are in range. Destroying the cauldron (AC 10, 15 HP) ends the shaman\'s Dark Patron\'s Gift. The acolyte shields the shaman with its body.',
    },
    adjacentNodes: ['gw-poison-dart', 'gw-totem-puzzle', 'gw-cache'],
  },
  {
    nodeId: 'gw-totem-puzzle',
    q: 4, r: 3,
    type: 'puzzle',
    name: 'Goblin Totem Gate',
    description: 'A crude but effective gate blocks the path deeper into the warren. Three totems — bear, snake, and raven — stand on rotating pedestals. Each totem faces a direction, and the gate\'s mechanism is connected to their alignment. Scratched into the lintel above: "The bear guards, the snake strikes, the raven watches."',
    puzzleData: {
      type: 'alignment',
      description: 'Rotate the three totems to face the correct directions. The bear must face the gate (guarding), the snake must face inward (ready to strike), and the raven must face outward (watching for threats).',
      dc: 12,
      hint: '"The bear guards" — faces the gate. "The snake strikes" — faces the interior. "The raven watches" — faces the entrance tunnel.',
      solutionNarrative: 'With a satisfying grinding of stone, the totems lock into place. The crude gate shudders and retracts into the ceiling, revealing the chieftain\'s domain beyond. The totems\' eyes glow briefly — even goblin craftsmanship can hold a spark of cleverness.',
      failureNarrative: 'The totems spin back to their original positions with a harsh clatter. A gout of acrid smoke erupts from the snake totem, filling the area. The noise echoes deeper into the warren.',
    },
    adjacentNodes: ['gw-shaman-sanctum', 'gw-boss-room'],
  },
  {
    nodeId: 'gw-cache',
    q: 5, r: 3,
    type: 'cache',
    name: 'Hidden Supply Cache',
    description: 'Behind a loose section of wall — concealed by a hanging wolf pelt — you discover a narrow alcove packed with supplies. The goblins have been hoarding: dried meat wrapped in oilcloth, clay jugs of water, bundles of torches, and a few items that clearly belonged to previous victims.',
    cacheItems: [
      { name: 'Torches (bundle)', type: 'supply', quantity: 3, value: 1 },
      { name: 'Dried Rations', type: 'supply', quantity: 2, value: 2 },
      { name: 'Healing Potion', type: 'consumable', quantity: 1, value: 50 },
      { name: 'Alchemist\'s Fire', type: 'consumable', quantity: 1, value: 50 },
      { name: 'Silver Locket (engraved "To Durik")', type: 'treasure', quantity: 1, value: 25 },
    ],
    adjacentNodes: ['gw-shaman-sanctum'],
  },
  {
    nodeId: 'gw-boss-room',
    q: 4, r: 4,
    type: 'boss',
    name: 'Chieftain\'s Throne',
    description: 'The largest chamber in the warren opens before you — a rough-hewn throne room lit by sputtering braziers. At its center, seated on a throne of lashed bones and rusted weapons, sits the Goblin Chieftain. A crown of black iron rests on its brow, and its eyes gleam with an intelligence no ordinary goblin possesses. It rises slowly, drawing a serrated blade the length of its arm. "You\'ve come far, little heroes," it rasps in broken Common. "But the deep is mine. The whispers told me you would come."',
    bossData: {
      name: 'Grak the Crowned — Goblin Chieftain',
      cr: 2,
      hp: 45,
      ac: 16,
      attackBonus: 5,
      damage: '2d6+3',
      abilities: [
        'Multiattack (2 attacks per turn)',
        'Crown of Whispers (bonus action: frighten one creature within 30 ft, DC 13 Wisdom save)',
        'Rally the Warren (1/day: summon 2 Goblin Warriors as reinforcements)',
        'Dark Patron\'s Shield (reaction: +3 AC against one attack per round)',
      ],
      phases: [
        { hpThreshold: 100, description: 'Grak fights with cold precision, testing the party\'s defenses.' },
        { hpThreshold: 50, description: 'The crown pulses with dark energy. Grak\'s eyes turn black. He grows more aggressive, using Crown of Whispers every round.' },
        { hpThreshold: 25, description: 'Desperate, Grak calls upon his patron. Shadow tendrils erupt from the ground. He gains resistance to non-magical damage and his attacks deal an additional 1d4 necrotic damage.' },
      ],
      xpReward: 450,
      lairActions: [
        'Shadows coalesce: one random party member must make DC 12 Wisdom save or be frightened until end of next turn.',
        'The ground trembles: each creature must make DC 11 Dexterity save or be knocked prone.',
        'Whispers fill the chamber: each creature must make DC 12 Intelligence save or use its reaction to move 10 ft in a random direction.',
      ],
    },
    adjacentNodes: ['gw-totem-puzzle', 'gw-chest'],
  },
  {
    nodeId: 'gw-chest',
    q: 4, r: 5,
    type: 'chest',
    name: 'Chieftain\'s Hoard',
    description: 'Behind the bone throne, a heavy iron chest sits chained to the floor. The lock is intricate — dwarven make, probably looted from the same ruins. Inside, the chieftain\'s accumulated plunder gleams in the firelight. Three distinct collections catch your eye, but the chest\'s mechanism allows only one compartment to open. Choose wisely.',
    chestRewards: [
      {
        id: 'safe-reward',
        name: 'The Proven Haul',
        description: 'A practical collection of gold and useful supplies — nothing flashy, but everything an adventurer needs.',
        rewards: [
          { type: 'gold', name: 'Gold Coins', value: 75 },
          { type: 'consumable', name: 'Potion of Healing', value: 50 },
          { type: 'consumable', name: 'Potion of Healing', value: 50 },
          { type: 'supply', name: 'Everburning Torch', value: 25 },
        ],
      },
      {
        id: 'risk-reward',
        name: 'The Black Iron Blade',
        description: 'A serrated longsword of black iron, humming with the same dark energy as the chieftain\'s crown. Power — but at what cost?',
        rewards: [
          { type: 'weapon', name: 'Whispering Blade (+1 longsword, 1d8+1 slashing + 1d4 necrotic)', value: 300 },
          { type: 'gold', name: 'Gold Coins', value: 30 },
        ],
        consequence: 'The blade whispers to its wielder during long rests. After 3 long rests, the wielder must make DC 14 Wisdom save or gain one level of exhaustion from nightmares. The whispers grow louder near the sealed chamber below the warren.',
      },
      {
        id: 'knowledge-reward',
        name: 'Durik\'s Maps & Seal',
        description: 'The dwarven prospector\'s survey maps and a signet ring bearing the seal of Clan Stonehammer. Knowledge that opens doors gold cannot.',
        rewards: [
          { type: 'quest_item', name: 'Durik\'s Survey Maps (reveals a hidden dungeon)', value: 0 },
          { type: 'quest_item', name: 'Stonehammer Signet Ring (grants access to dwarven holds)', value: 0 },
          { type: 'gold', name: 'Gold Coins', value: 20 },
          { type: 'lore', name: 'Sealed Chamber Location (hints at deeper dungeon)', value: 0 },
        ],
      },
    ],
    adjacentNodes: ['gw-boss-room'],
  },
];

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
    const bossAdjacent = targetNode.adjacentNodes.filter(id => id !== 'gw-chest');
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
  clearedNodes: string[]
): {
  narrative: string;
  respawnedNodes: string[];
  bossAdvantage: boolean;
} {
  const encounterNodes = GOBLIN_WARREN.filter(n => n.type === 'encounter' && clearedNodes.includes(n.nodeId));
  const respawnCount = Math.ceil(encounterNodes.length * 0.4);
  const respawnedNodes: string[] = [];

  const shuffled = [...encounterNodes].sort(() => Math.random() - 0.5);
  for (let i = 0; i < respawnCount && i < shuffled.length; i++) {
    respawnedNodes.push(shuffled[i].nodeId);
  }

  const bossDefeated = clearedNodes.includes('gw-boss-room');

  let narrative = 'You retreat from the Goblin Warren, retracing your steps through the dark tunnels. ';

  if (respawnedNodes.length > 0) {
    narrative += `As you flee, you hear the scrabble of clawed feet behind you — the warren is already repopulating. ${respawnedNodes.length} previously cleared rooms have been reoccupied by fresh goblin patrols. `;
  }

  if (!bossDefeated) {
    narrative += 'The Chieftain\'s mocking laughter echoes through the tunnels. "Run, little heroes! The Warren remembers. Next time, we will be ready." The goblins will be more alert on your next attempt.';
  } else {
    narrative += 'Though the chieftain has fallen, the warren\'s lesser goblins scurry to reclaim what they can. Your victory is incomplete.';
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
  const bossDefeated = run.clearedNodes.includes('gw-boss-room');
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
