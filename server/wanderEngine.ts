import {
  getRandomAnalyticPuzzle,
  generateExplorationChest,
  generateExplorationTrap,
} from "./lib/explorationPuzzles";

export interface CuratedOutcome {
  type: 'discovery' | 'quiet' | 'risk' | 'none';
  title: string;
  reveal: string;
  detail?: string;
  choices: Array<{
    id: string;
    label: string;
    intentTag: 'investigate' | 'avoid' | 'engage' | 'retreat' | 'camp' | 'solve';
    mechanicalEffects?: Record<string, any>;
    /** For 'solve' (analytic puzzle) choices: marks the correct answer option. */
    isPuzzleSolution?: boolean;
  }>;
  rewards?: Array<{
    kind: 'knowledge' | 'consumable' | 'trinket' | 'key_fragment' | 'faction_token';
    name: string;
    quantity: number;
  }>;
  /** Present for analytic-puzzle outcomes — reasoning revealed after answering. */
  puzzleExplanation?: string;
  markerType?: 'landmark' | 'trace' | 'hazard' | 'resource' | 'npc_echo' | 'opportunity';
  combatSeed?: {
    encounterType: 'ambush' | 'pursuit' | 'lair_scout';
    enemyTheme: string;
    difficulty: 'easy' | 'medium' | 'hard';
    battlefieldTag: string;
    stakes: string;
    fleeAllowed: boolean;
  };
}

export type BiomeKey = 'forest' | 'grass' | 'swamp' | 'mountain' | 'hill' | 'cave' | 'desert' | 'snow' | 'coast' | 'ruins' | 'settlement';

const BIOME_BASE_DANGER: Record<BiomeKey, number> = {
  forest: 20,
  grass: 10,
  swamp: 40,
  mountain: 35,
  hill: 15,
  cave: 50,
  desert: 30,
  snow: 35,
  coast: 15,
  ruins: 45,
  settlement: 5,
};

const CURATED_OUTCOMES: Record<BiomeKey, CuratedOutcome[]> = {
  forest: [
    {
      type: 'discovery',
      title: 'Ancient Druid Circle',
      reveal: 'Moss-covered standing stones hum with residual magic, arranged in a perfect circle beneath the canopy.',
      detail: 'The stones are inscribed with Sylvan script describing seasonal rites. A shallow basin at the center holds clear rainwater that glows faintly under moonlight. Druids once gathered here to commune with the forest spirit Verdanthis. The magic is dormant but not dead—someone with the right words could awaken it.',
      choices: [
        { id: 'f_d1_inv', label: 'Read the Sylvan inscriptions', intentTag: 'investigate' },
        { id: 'f_d1_eng', label: 'Touch the glowing water', intentTag: 'engage' },
        { id: 'f_d1_avoid', label: 'Sketch the runes and move on', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'knowledge', name: 'Druid Circle Location', quantity: 1 }],
      markerType: 'landmark',
    },
    {
      type: 'discovery',
      title: 'Hollow Oak Cache',
      reveal: 'A massive oak tree split by lightning reveals a leather-wrapped bundle wedged deep inside the heartwood.',
      detail: 'The bundle contains a tarnished silver compass that always points toward the nearest ley line, three dried herbs of unknown potency, and a charcoal sketch of a woman with antlers. The tree itself still lives—sap weeps slowly around the cache as if the oak is trying to heal over its secret.',
      choices: [
        { id: 'f_d2_inv', label: 'Examine the compass closely', intentTag: 'investigate' },
        { id: 'f_d2_eng', label: 'Take the entire bundle', intentTag: 'engage' },
        { id: 'f_d2_avoid', label: 'Leave it undisturbed', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'trinket', name: 'Ley-Line Compass', quantity: 1 }],
      markerType: 'resource',
    },
    {
      type: 'quiet',
      title: 'Dappled Glade',
      reveal: 'Sunlight filters through the canopy onto a bed of soft clover. Birdsong fills the air and the wind carries the scent of wildflowers.',
      detail: 'This clearing feels untouched by the worries of the wider world. Deer tracks cross the clover but the animals themselves have moved on. A fallen log offers a perfect seat for rest. The peace here is genuine—no predator lurks, no trap waits.',
      choices: [
        { id: 'f_q1_camp', label: 'Rest here a while', intentTag: 'camp' },
        { id: 'f_q1_inv', label: 'Search for useful herbs', intentTag: 'investigate' },
        { id: 'f_q1_avoid', label: 'Enjoy the moment and continue', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'consumable', name: 'Handful of Healing Herbs', quantity: 1 }],
    },
    {
      type: 'quiet',
      title: 'Whispering Brook',
      reveal: 'A clear stream babbles over smooth stones. The water tastes sweet and cold, carrying faint mineral sparkle.',
      choices: [
        { id: 'f_q2_camp', label: 'Fill waterskins and rest', intentTag: 'camp' },
        { id: 'f_q2_inv', label: 'Follow the brook upstream', intentTag: 'investigate' },
        { id: 'f_q2_avoid', label: 'Cross and keep moving', intentTag: 'avoid' },
      ],
      markerType: 'resource',
    },
    {
      type: 'risk',
      title: 'Ettercap Webbing',
      reveal: 'Thick, sticky webs stretch between the trees ahead. Something large scuttles in the branches above.',
      detail: 'The webs belong to a nest of ettercaps—twisted spider-like fey that set ambushes for travelers. Bundled cocoons hang from higher branches; some are animal-sized, others disturbingly humanoid. The creatures are territorial but not mindlessly aggressive—they want food, not war.',
      choices: [
        { id: 'f_r1_eng', label: 'Burn the webs with a torch', intentTag: 'engage' },
        { id: 'f_r1_ret', label: 'Back away slowly', intentTag: 'retreat' },
        { id: 'f_r1_inv', label: 'Check the cocoons for survivors', intentTag: 'investigate' },
      ],
      markerType: 'hazard',
      combatSeed: {
        encounterType: 'ambush',
        enemyTheme: 'ettercap',
        difficulty: 'medium',
        battlefieldTag: 'dense_forest_webs',
        stakes: 'The ettercaps defend their nest and larder',
        fleeAllowed: true,
      },
    },
    {
      type: 'risk',
      title: 'Hungry Owlbear',
      reveal: 'A deep, rumbling growl echoes from a thicket. Claw marks gouge the bark of nearby trees at shoulder height.',
      detail: 'An owlbear has claimed this stretch of forest as hunting ground. It is lean and hungry—the scratches on the trees are fresh, marking territory with increasing desperation. It will charge if it catches your scent but might be distracted by thrown food.',
      choices: [
        { id: 'f_r2_eng', label: 'Stand your ground and fight', intentTag: 'engage' },
        { id: 'f_r2_ret', label: 'Retreat downwind quietly', intentTag: 'retreat' },
        { id: 'f_r2_avoid', label: 'Toss rations as a distraction', intentTag: 'avoid' },
      ],
      markerType: 'hazard',
      combatSeed: {
        encounterType: 'pursuit',
        enemyTheme: 'owlbear',
        difficulty: 'hard',
        battlefieldTag: 'forest_clearing',
        stakes: 'A starving owlbear will not stop easily',
        fleeAllowed: true,
      },
    },
    {
      type: 'discovery',
      title: 'Ranger\'s Waymarker',
      reveal: 'A carved wooden post bears directional symbols and a ranger\'s glyph warning of danger to the north.',
      detail: 'The waymarker is part of a network maintained by the Order of the Silver Hart. The symbols indicate safe water sources, a nearby shelter, and a goblin warren three leagues north. A small compartment at the base holds a sealed note addressed to "any friend of the wood."',
      choices: [
        { id: 'f_d3_inv', label: 'Read the sealed note', intentTag: 'investigate' },
        { id: 'f_d3_eng', label: 'Add your own mark to the post', intentTag: 'engage' },
        { id: 'f_d3_avoid', label: 'Note the directions and move on', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'knowledge', name: 'Ranger Network Intel', quantity: 1 }],
      markerType: 'trace',
    },
    {
      type: 'risk',
      title: 'Bandit Lookout',
      reveal: 'A crude platform is lashed to a tree above the trail. A figure watches the path with a shortbow ready.',
      detail: 'This is an outer picket for a bandit gang operating in the forest. The lookout will whistle an alarm if spotted. Their camp is somewhere deeper in the woods, holding stolen goods and possibly captives. Negotiation is possible—these are desperate folk, not monsters.',
      choices: [
        { id: 'f_r3_eng', label: 'Confront the lookout', intentTag: 'engage' },
        { id: 'f_r3_ret', label: 'Circle around unseen', intentTag: 'retreat' },
        { id: 'f_r3_inv', label: 'Observe their signal patterns', intentTag: 'investigate' },
      ],
      markerType: 'hazard',
      combatSeed: {
        encounterType: 'ambush',
        enemyTheme: 'bandit',
        difficulty: 'easy',
        battlefieldTag: 'forest_trail',
        stakes: 'Bandits fight to protect their hidden camp',
        fleeAllowed: true,
      },
    },
    {
      type: 'discovery',
      title: 'Fey Mushroom Ring',
      reveal: 'A perfect circle of luminescent mushrooms pulses with soft violet light on the forest floor.',
      detail: 'This is a fairy ring—a thin place where the Feywild bleeds into the material plane. Stepping inside brings a rush of euphoria and strange visions. Those who linger too long may lose hours without realizing it. A tiny door in a nearby tree trunk suggests pixies use this crossing regularly.',
      choices: [
        { id: 'f_d4_inv', label: 'Step carefully into the ring', intentTag: 'investigate', mechanicalEffects: { feyTouched: true } },
        { id: 'f_d4_eng', label: 'Knock on the tiny door', intentTag: 'engage' },
        { id: 'f_d4_avoid', label: 'Admire from a safe distance', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'trinket', name: 'Fey-Touched Mushroom', quantity: 2 }],
      markerType: 'landmark',
    },
  ],

  grass: [
    {
      type: 'discovery',
      title: 'Abandoned Shepherd\'s Hut',
      reveal: 'A stone hut with a collapsed thatch roof sits alone on the hillside, its door hanging open.',
      detail: 'Inside: a rusted iron stove, a straw pallet, and charcoal drawings of constellations on the walls. A loose stone in the hearth conceals a small leather pouch with three silver coins and a folded letter describing "the light that appears on the eastern ridge at midwinter."',
      choices: [
        { id: 'g_d1_inv', label: 'Search the hut thoroughly', intentTag: 'investigate' },
        { id: 'g_d1_camp', label: 'Shelter here for a rest', intentTag: 'camp' },
        { id: 'g_d1_avoid', label: 'Note the location and move on', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'trinket', name: 'Star-Chart Sketch', quantity: 1 }],
      markerType: 'landmark',
    },
    {
      type: 'discovery',
      title: 'Merchant\'s Broken Wagon',
      reveal: 'A merchant wagon lies overturned in the tall grass, one wheel shattered. Scattered goods trail eastward.',
      detail: 'The wagon belonged to a tinker named Harwin—his name is stenciled on the side. Most valuable cargo was taken, but overlooked items remain: a potion of minor healing wedged under the seat, a set of fine lockpicks, and a map marking three trading posts. The tracks leading away suggest the merchant fled on foot.',
      choices: [
        { id: 'g_d2_inv', label: 'Follow the merchant\'s tracks', intentTag: 'investigate' },
        { id: 'g_d2_eng', label: 'Salvage what remains', intentTag: 'engage' },
        { id: 'g_d2_avoid', label: 'Leave it be', intentTag: 'avoid' },
      ],
      rewards: [
        { kind: 'consumable', name: 'Potion of Minor Healing', quantity: 1 },
        { kind: 'trinket', name: 'Trade Route Map', quantity: 1 },
      ],
      markerType: 'trace',
    },
    {
      type: 'quiet',
      title: 'Rolling Hills at Golden Hour',
      reveal: 'The grasslands stretch endlessly under a sky painted in amber and rose. A warm breeze carries the scent of earth.',
      choices: [
        { id: 'g_q1_camp', label: 'Make camp and enjoy the view', intentTag: 'camp' },
        { id: 'g_q1_inv', label: 'Scan the horizon for landmarks', intentTag: 'investigate' },
        { id: 'g_q1_avoid', label: 'Press on while light remains', intentTag: 'avoid' },
      ],
    },
    {
      type: 'quiet',
      title: 'Grazing Herd',
      reveal: 'A herd of wild horses grazes peacefully in the tall grass. They watch you with cautious curiosity.',
      detail: 'The lead mare is a dappled grey with intelligent eyes. These horses are unbranded and free—descendants of cavalry mounts lost in some forgotten war. They are wary but not hostile. A skilled hand with animals might earn their trust.',
      choices: [
        { id: 'g_q2_eng', label: 'Approach slowly with open hands', intentTag: 'engage' },
        { id: 'g_q2_inv', label: 'Watch their behavior patterns', intentTag: 'investigate' },
        { id: 'g_q2_avoid', label: 'Give them space and pass by', intentTag: 'avoid' },
      ],
      markerType: 'npc_echo',
    },
    {
      type: 'risk',
      title: 'Prairie Wolves',
      reveal: 'Low shapes move through the grass in a coordinated pattern. Yellow eyes gleam in the fading light.',
      detail: 'A pack of six wolves has been following your scent. They are not starving—this is territorial aggression. The alpha is a scarred grey beast twice the size of the others. Fire and loud noise may drive them off, but turning your back invites a chase.',
      choices: [
        { id: 'g_r1_eng', label: 'Face them with weapon drawn', intentTag: 'engage' },
        { id: 'g_r1_ret', label: 'Build a fire and hold position', intentTag: 'retreat' },
        { id: 'g_r1_avoid', label: 'Make yourself look large and shout', intentTag: 'avoid' },
      ],
      markerType: 'hazard',
      combatSeed: {
        encounterType: 'pursuit',
        enemyTheme: 'wolf_pack',
        difficulty: 'medium',
        battlefieldTag: 'open_grassland',
        stakes: 'The pack hunts as one—flanking is their specialty',
        fleeAllowed: true,
      },
    },
    {
      type: 'risk',
      title: 'Sinkhole',
      reveal: 'The ground suddenly gives way underfoot. A hidden sinkhole yawns open, revealing darkness below.',
      detail: 'The sinkhole drops fifteen feet into a natural limestone chamber. The edges are crumbly and treacherous. Below, you can see old bones, a rusted shield, and what might be a tunnel leading deeper underground. The air rising from below is cool and damp.',
      choices: [
        { id: 'g_r2_inv', label: 'Rope down to explore', intentTag: 'investigate' },
        { id: 'g_r2_ret', label: 'Mark it and back away', intentTag: 'retreat' },
        { id: 'g_r2_avoid', label: 'Skirt around carefully', intentTag: 'avoid' },
      ],
      markerType: 'hazard',
    },
    {
      type: 'discovery',
      title: 'Standing Stone',
      reveal: 'A single menhir rises from the grass, covered in weather-worn carvings of spirals and celestial symbols.',
      detail: 'The stone predates any known civilization in this region. At its base, offerings of dried flowers and polished stones suggest someone still visits. The carvings depict a map of stars that doesn\'t match the current night sky—perhaps showing the heavens as they appeared millennia ago.',
      choices: [
        { id: 'g_d3_inv', label: 'Study the star map carvings', intentTag: 'investigate' },
        { id: 'g_d3_eng', label: 'Leave an offering', intentTag: 'engage' },
        { id: 'g_d3_avoid', label: 'Record the symbols in your journal', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'knowledge', name: 'Ancient Star Chart', quantity: 1 }],
      markerType: 'landmark',
    },
    {
      type: 'discovery',
      title: 'Halfling Caravan Trail',
      reveal: 'Deep wheel ruts and small footprints mark a well-traveled route through the grass. Colorful ribbons flutter from stakes.',
      detail: 'A halfling merchant caravan passed through recently—within the last day. The ribbons are trail markers in their tradition: blue means safe water ahead, red means caution, green means good campsite. Following the trail might lead to trade opportunities or friendly company.',
      choices: [
        { id: 'g_d4_inv', label: 'Follow the caravan trail', intentTag: 'investigate' },
        { id: 'g_d4_eng', label: 'Read the ribbon messages', intentTag: 'engage' },
        { id: 'g_d4_avoid', label: 'Note the trail and continue', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'knowledge', name: 'Halfling Trail Markers', quantity: 1 }],
      markerType: 'trace',
    },
  ],

  swamp: [
    {
      type: 'discovery',
      title: 'Sunken Shrine',
      reveal: 'Half-submerged stone walls form a rectangular outline beneath the murky water. A carved face peers from the algae.',
      detail: 'This was once a shrine to a forgotten river god. The carved face depicts a bearded deity with fish-scale skin and kelp hair. Beneath the waterline, offerings of corroded coins and clay vessels litter the silted floor. Something glints deeper—possibly gold, possibly just fool\'s pyrite.',
      choices: [
        { id: 's_d1_inv', label: 'Dive down to investigate', intentTag: 'investigate' },
        { id: 's_d1_eng', label: 'Offer a coin to the old god', intentTag: 'engage' },
        { id: 's_d1_avoid', label: 'Sketch the face and move on', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'key_fragment', name: 'River God\'s Token', quantity: 1 }],
      markerType: 'landmark',
    },
    {
      type: 'discovery',
      title: 'Will-o\'-Wisp Trail',
      reveal: 'Pale blue lights bob and weave between the twisted trees, always staying just ahead of you.',
      detail: 'Will-o\'-wisps are dangerous—they lure travelers into deep water and quicksand. But these lights seem different. They move in a deliberate pattern, tracing a path that avoids the most treacherous ground. Perhaps they guard something, or perhaps they are the souls of those who knew the safe route through.',
      choices: [
        { id: 's_d2_inv', label: 'Follow the lights carefully', intentTag: 'investigate' },
        { id: 's_d2_avoid', label: 'Ignore them completely', intentTag: 'avoid' },
        { id: 's_d2_ret', label: 'Turn back—nothing good here', intentTag: 'retreat' },
      ],
      rewards: [{ kind: 'knowledge', name: 'Wisp-Guided Path', quantity: 1 }],
      markerType: 'trace',
    },
    {
      type: 'quiet',
      title: 'Dry Hummock',
      reveal: 'A raised patch of solid ground rises above the waterline, covered in thick moss and a single gnarled willow.',
      choices: [
        { id: 's_q1_camp', label: 'Rest on the dry ground', intentTag: 'camp' },
        { id: 's_q1_inv', label: 'Check the willow for carvings', intentTag: 'investigate' },
        { id: 's_q1_avoid', label: 'Refill water and press on', intentTag: 'avoid' },
      ],
      markerType: 'resource',
    },
    {
      type: 'quiet',
      title: 'Croaking Chorus',
      reveal: 'Hundreds of frogs sing from the lily pads around you. The sound is almost musical, rhythmic and strange.',
      detail: 'A grippli herbalist once told you that frogs sing louder when the water is safe to drink. The chorus here is deafening. Among the ordinary bullfrogs, you notice a few with unusual golden markings—possibly rare, possibly magical.',
      choices: [
        { id: 's_q2_inv', label: 'Try to catch a golden frog', intentTag: 'investigate' },
        { id: 's_q2_camp', label: 'Sit and listen to the chorus', intentTag: 'camp' },
        { id: 's_q2_avoid', label: 'Wade on through the noise', intentTag: 'avoid' },
      ],
    },
    {
      type: 'risk',
      title: 'Quicksand Patch',
      reveal: 'The ground ahead looks solid but has a faint shimmer. A half-submerged pack lies abandoned at the edge.',
      detail: 'Quicksand—the real kind, not the dramatic sort from bard\'s tales. It won\'t swallow you whole but it will trap you until something worse finds you. The abandoned pack might hold clues about who fell victim last. Circling around adds time but guarantees safety.',
      choices: [
        { id: 's_r1_inv', label: 'Probe the ground with a pole', intentTag: 'investigate' },
        { id: 's_r1_ret', label: 'Find another route around', intentTag: 'retreat' },
        { id: 's_r1_eng', label: 'Reach for the abandoned pack', intentTag: 'engage' },
      ],
      markerType: 'hazard',
    },
    {
      type: 'risk',
      title: 'Lizardfolk Hunting Party',
      reveal: 'Scaled figures rise silently from the water, spears leveled. Their eyes are cold and calculating.',
      detail: 'Three lizardfolk hunters have been tracking you for the last mile. They serve a shaman who demands tribute from all who cross their territory. They don\'t want battle—they want payment. Refuse, and they\'ll harry you through terrain they know far better than you.',
      choices: [
        { id: 's_r2_eng', label: 'Negotiate a fair tribute', intentTag: 'engage' },
        { id: 's_r2_ret', label: 'Flee to drier ground', intentTag: 'retreat' },
        { id: 's_r2_inv', label: 'Show strength to earn respect', intentTag: 'investigate' },
      ],
      markerType: 'hazard',
      combatSeed: {
        encounterType: 'ambush',
        enemyTheme: 'lizardfolk',
        difficulty: 'medium',
        battlefieldTag: 'shallow_swamp',
        stakes: 'Lizardfolk defend their hunting grounds with cunning',
        fleeAllowed: true,
      },
    },
    {
      type: 'risk',
      title: 'Bog Hag\'s Territory',
      reveal: 'The trees here are draped with fetishes made of bone and hair. A sweet, cloying smell fills the air.',
      detail: 'A green hag has claimed this stretch of swamp. The fetishes are warnings and wards. Somewhere nearby is her hut, built on stilts above the water. She trades in secrets and curses—approaching her is dangerous but potentially very rewarding. She always wants something in return.',
      choices: [
        { id: 's_r3_inv', label: 'Seek out the hag\'s hut', intentTag: 'investigate' },
        { id: 's_r3_ret', label: 'Leave an offering and flee', intentTag: 'retreat' },
        { id: 's_r3_avoid', label: 'Remove a fetish as proof', intentTag: 'avoid' },
      ],
      markerType: 'hazard',
      combatSeed: {
        encounterType: 'lair_scout',
        enemyTheme: 'green_hag',
        difficulty: 'hard',
        battlefieldTag: 'hag_lair_swamp',
        stakes: 'The hag fights with illusions and curses, not claws',
        fleeAllowed: false,
      },
    },
    {
      type: 'discovery',
      title: 'Herbalist\'s Garden',
      reveal: 'Planted rows of rare swamp herbs grow on raised beds between the pools. Someone tends this place.',
      detail: 'A reclusive herbalist has cultivated this hidden garden. Deathbell, swamp lily, and witchgrass grow in careful rows. A basket of harvested components sits under a waxed tarp. The gardener is absent but their tools suggest they\'ll return soon.',
      choices: [
        { id: 's_d3_inv', label: 'Identify the rare plants', intentTag: 'investigate' },
        { id: 's_d3_eng', label: 'Harvest some herbs carefully', intentTag: 'engage' },
        { id: 's_d3_avoid', label: 'Wait for the herbalist', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'consumable', name: 'Rare Swamp Herbs', quantity: 3 }],
      markerType: 'resource',
    },
  ],

  mountain: [
    {
      type: 'discovery',
      title: 'Dwarven Trail Markers',
      reveal: 'Geometric symbols are chiseled into the rock face at regular intervals, marking an ancient dwarven road.',
      detail: 'The markers follow a system used by Clan Ironforge over three centuries ago. They indicate elevation, distance to the nearest shelter, and the quality of stone for mining. One marker is scratched with a newer addition in Common: "Beware the windward pass—giant territory." The trail leads toward a collapsed mine entrance.',
      choices: [
        { id: 'm_d1_inv', label: 'Decode the full marker system', intentTag: 'investigate' },
        { id: 'm_d1_eng', label: 'Follow the markers upward', intentTag: 'engage' },
        { id: 'm_d1_avoid', label: 'Copy the symbols and move on', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'knowledge', name: 'Dwarven Road Map', quantity: 1 }],
      markerType: 'landmark',
    },
    {
      type: 'discovery',
      title: 'Eagle\'s Nest Overlook',
      reveal: 'A massive eagle\'s nest crowns a rocky spire. From this height, the land spreads out in breathtaking detail.',
      detail: 'Giant eagle territory. The nest is unoccupied but recently used—fresh bones litter the edge. From this vantage, you can see for leagues in every direction: a river winding through a valley to the south, smoke from a settlement to the west, and a dark patch of dead forest to the north that seems unnatural.',
      choices: [
        { id: 'm_d2_inv', label: 'Map everything you can see', intentTag: 'investigate' },
        { id: 'm_d2_eng', label: 'Search the nest for items', intentTag: 'engage' },
        { id: 'm_d2_avoid', label: 'Enjoy the view and descend', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'knowledge', name: 'Aerial Survey Notes', quantity: 1 }],
      markerType: 'landmark',
    },
    {
      type: 'quiet',
      title: 'Sheltered Ledge',
      reveal: 'A natural rock overhang provides shelter from the wind. Old ashes from a campfire suggest others rested here.',
      choices: [
        { id: 'm_q1_camp', label: 'Make camp in the shelter', intentTag: 'camp' },
        { id: 'm_q1_inv', label: 'Check the ashes for clues', intentTag: 'investigate' },
        { id: 'm_q1_avoid', label: 'Keep climbing while you can', intentTag: 'avoid' },
      ],
      markerType: 'resource',
    },
    {
      type: 'quiet',
      title: 'Mountain Spring',
      reveal: 'Ice-cold water trickles from a crack in the granite, pooling in a natural basin before cascading down the cliff.',
      choices: [
        { id: 'm_q2_camp', label: 'Drink deeply and refill supplies', intentTag: 'camp' },
        { id: 'm_q2_inv', label: 'Examine minerals in the water', intentTag: 'investigate' },
        { id: 'm_q2_avoid', label: 'Splash your face and press on', intentTag: 'avoid' },
      ],
    },
    {
      type: 'risk',
      title: 'Rockslide Zone',
      reveal: 'Loose scree and cracked boulders loom above the narrow path. The mountain groans with each gust of wind.',
      detail: 'The trail ahead crosses an unstable slope. One wrong step—or one loud noise—could send tons of rock cascading down. You can see where previous travelers were caught: a crushed pack frame and scattered coins glint among the debris. There may be a safer path higher up.',
      choices: [
        { id: 'm_r1_inv', label: 'Scout for a safer route', intentTag: 'investigate' },
        { id: 'm_r1_eng', label: 'Cross quickly and carefully', intentTag: 'engage' },
        { id: 'm_r1_ret', label: 'Turn back and find another way', intentTag: 'retreat' },
      ],
      markerType: 'hazard',
    },
    {
      type: 'risk',
      title: 'Stone Giant Patrol',
      reveal: 'The ground trembles rhythmically. Between the peaks, an enormous figure moves with deliberate, earth-shaking steps.',
      detail: 'A stone giant walks its patrol route along the ridge. It carries a boulder the size of a cottage on one shoulder—a thrown weapon of devastating power. The giant hasn\'t noticed you yet, but it will if you remain on this path. Giants have excellent hearing but poor eyesight in fog.',
      choices: [
        { id: 'm_r2_ret', label: 'Hide and wait for it to pass', intentTag: 'retreat' },
        { id: 'm_r2_eng', label: 'Attempt to communicate', intentTag: 'engage' },
        { id: 'm_r2_avoid', label: 'Crawl silently to cover', intentTag: 'avoid' },
      ],
      markerType: 'hazard',
      combatSeed: {
        encounterType: 'pursuit',
        enemyTheme: 'stone_giant',
        difficulty: 'hard',
        battlefieldTag: 'mountain_ridge',
        stakes: 'A single thrown boulder could end everything',
        fleeAllowed: true,
      },
    },
    {
      type: 'discovery',
      title: 'Abandoned Mine Entrance',
      reveal: 'Timber-framed tunnel mouth gapes in the mountainside. Rails for ore carts lead into the darkness.',
      detail: 'A mine, abandoned perhaps twenty years ago. The timbers are rotting but the stone walls are solid. Inside the first chamber, you find rusted tools, empty lantern hooks, and a faded map pinned to a support beam showing three levels of tunnels. Something scratched "SEALED FOR GOOD REASON" across the entrance to the second level.',
      choices: [
        { id: 'm_d3_inv', label: 'Study the mine map', intentTag: 'investigate' },
        { id: 'm_d3_eng', label: 'Enter the first level', intentTag: 'engage' },
        { id: 'm_d3_ret', label: 'Respect the warning and leave', intentTag: 'retreat' },
      ],
      rewards: [{ kind: 'knowledge', name: 'Mine Tunnel Map', quantity: 1 }],
      markerType: 'opportunity',
    },
    {
      type: 'risk',
      title: 'Wyvern Roost',
      reveal: 'Acid-scarred rock and enormous talon marks surround a cliff ledge. The stench of venom hangs in the air.',
      detail: 'A wyvern nests here—a lesser dragon-kin with a poisoned tail stinger. The creature is currently away hunting, but it will return before nightfall. The nest contains bones, gems from previous victims, and two large eggs. Wyvern eggs fetch enormous prices, but the mother will hunt anyone who takes them relentlessly.',
      choices: [
        { id: 'm_r3_inv', label: 'Search the nest quickly', intentTag: 'investigate' },
        { id: 'm_r3_ret', label: 'Get far away before it returns', intentTag: 'retreat' },
        { id: 'm_r3_eng', label: 'Set a trap for the wyvern', intentTag: 'engage' },
      ],
      markerType: 'hazard',
      combatSeed: {
        encounterType: 'lair_scout',
        enemyTheme: 'wyvern',
        difficulty: 'hard',
        battlefieldTag: 'cliff_ledge',
        stakes: 'The wyvern\'s venom can paralyze in seconds',
        fleeAllowed: true,
      },
    },
  ],

  hill: [
    {
      type: 'discovery',
      title: 'Burial Mound',
      reveal: 'A low, grass-covered mound rises from the hillside. A stone door is set into its southern face.',
      detail: 'This barrow belongs to a chieftain of the Bright Spear tribe, dead for over five hundred years. The stone door bears protective runes that have faded with time. Local legends say the dead chief was buried with his enchanted spear and a crown of bronze antlers. The barrow has been sealed—but not well enough to stop determined grave robbers.',
      choices: [
        { id: 'h_d1_inv', label: 'Examine the protective runes', intentTag: 'investigate' },
        { id: 'h_d1_eng', label: 'Try to open the stone door', intentTag: 'engage' },
        { id: 'h_d1_avoid', label: 'Pay respects and move on', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'key_fragment', name: 'Barrow Rune Rubbing', quantity: 1 }],
      markerType: 'landmark',
    },
    {
      type: 'discovery',
      title: 'Hilltop Beacon',
      reveal: 'A stone tower stands on the highest point, its iron brazier cold. Signal flags hang limp in still air.',
      detail: 'Part of an old warning network, this beacon tower was used to signal orc raids across the hills. The mechanism still works—oil and kindling are stored in a locked chest inside. The watchman\'s log, protected from rain, contains entries from three months ago. The last entry reads: "Movement on the north ridge. Not orcs. Something else."',
      choices: [
        { id: 'h_d2_inv', label: 'Read the watchman\'s log', intentTag: 'investigate' },
        { id: 'h_d2_eng', label: 'Light the beacon', intentTag: 'engage' },
        { id: 'h_d2_avoid', label: 'Climb the tower for the view', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'knowledge', name: 'Beacon Network Chart', quantity: 1 }],
      markerType: 'landmark',
    },
    {
      type: 'quiet',
      title: 'Wildflower Meadow',
      reveal: 'The hillside explodes with color—purple heather, golden buttercups, and white clover carpet every surface.',
      choices: [
        { id: 'h_q1_camp', label: 'Rest among the flowers', intentTag: 'camp' },
        { id: 'h_q1_inv', label: 'Gather medicinal flowers', intentTag: 'investigate' },
        { id: 'h_q1_avoid', label: 'Walk through and enjoy them', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'consumable', name: 'Medicinal Wildflowers', quantity: 2 }],
    },
    {
      type: 'quiet',
      title: 'Shepherd\'s Cairn',
      reveal: 'Stacked stones mark a trail junction. Wool scraps caught on nearby bushes show this path is still used.',
      choices: [
        { id: 'h_q2_inv', label: 'Follow the freshest tracks', intentTag: 'investigate' },
        { id: 'h_q2_camp', label: 'Wait by the cairn for travelers', intentTag: 'camp' },
        { id: 'h_q2_avoid', label: 'Add a stone and continue', intentTag: 'avoid' },
      ],
      markerType: 'trace',
    },
    {
      type: 'risk',
      title: 'Gnoll Raiders',
      reveal: 'Hyena-like laughter echoes from behind the next hill. The stench of carrion drifts on the breeze.',
      detail: 'A warband of gnolls—five strong—has made camp in a hollow. They\'ve been raiding nearby farms and their camp is littered with stolen goods and grisly trophies. They haven\'t spotted you yet. Their hyena companions have keen noses, though.',
      choices: [
        { id: 'h_r1_eng', label: 'Ambush them first', intentTag: 'engage' },
        { id: 'h_r1_ret', label: 'Circle wide around them', intentTag: 'retreat' },
        { id: 'h_r1_inv', label: 'Count their numbers and gear', intentTag: 'investigate' },
      ],
      markerType: 'hazard',
      combatSeed: {
        encounterType: 'ambush',
        enemyTheme: 'gnoll',
        difficulty: 'medium',
        battlefieldTag: 'rolling_hills',
        stakes: 'Gnolls fight to the death when cornered',
        fleeAllowed: true,
      },
    },
    {
      type: 'risk',
      title: 'Unstable Ground',
      reveal: 'The hill path narrows along a rain-eroded slope. Deep cracks web the earth and stones shift underfoot.',
      choices: [
        { id: 'h_r2_inv', label: 'Test the ground ahead carefully', intentTag: 'investigate' },
        { id: 'h_r2_ret', label: 'Find a way around the slope', intentTag: 'retreat' },
        { id: 'h_r2_eng', label: 'Sprint across before it gives', intentTag: 'engage' },
      ],
      markerType: 'hazard',
    },
    {
      type: 'discovery',
      title: 'Fox Den with Trinkets',
      reveal: 'A fox\'s burrow entrance is surrounded by an odd collection: coins, buttons, a silver ring, and glass beads.',
      detail: 'Foxes are notorious collectors of shiny things. This den mother has assembled quite a hoard—mostly worthless baubles, but the silver ring bears an engraved crest belonging to a minor noble house. The fox watches you from inside with bright, intelligent eyes.',
      choices: [
        { id: 'h_d3_inv', label: 'Examine the noble\'s ring', intentTag: 'investigate' },
        { id: 'h_d3_eng', label: 'Trade food for the ring', intentTag: 'engage' },
        { id: 'h_d3_avoid', label: 'Leave the fox her treasures', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'trinket', name: 'Noble House Signet Ring', quantity: 1 }],
      markerType: 'trace',
    },
    {
      type: 'discovery',
      title: 'Hermit\'s Hilltop Garden',
      reveal: 'Terraced plots climb the hillside, growing vegetables, herbs, and strange crystalline flowers.',
      detail: 'An elderly half-elf hermit tends these gardens. She\'s been here for forty years, growing food and cultivating alchemical ingredients. She\'s friendly but wary—too many "adventurers" have trampled her plants. She\'ll trade potions for news of the outside world or help with her harvest.',
      choices: [
        { id: 'h_d4_eng', label: 'Offer to help with the harvest', intentTag: 'engage' },
        { id: 'h_d4_inv', label: 'Ask about her crystal flowers', intentTag: 'investigate' },
        { id: 'h_d4_avoid', label: 'Wave and pass by respectfully', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'consumable', name: 'Hermit\'s Healing Salve', quantity: 1 }],
      markerType: 'npc_echo',
    },
  ],

  cave: [
    {
      type: 'discovery',
      title: 'Phosphorescent Cavern',
      reveal: 'The cave walls glow with natural phosphorescence, casting everything in an eerie blue-green light.',
      detail: 'Bioluminescent fungi and mineral deposits create a natural light source. The cavern is vast—your footsteps echo for seconds. Formations of crystal grow from the ceiling like frozen chandeliers. In the center, a pool of perfectly still water reflects the glow, creating the illusion of stars below your feet.',
      choices: [
        { id: 'c_d1_inv', label: 'Harvest glowing fungi samples', intentTag: 'investigate' },
        { id: 'c_d1_eng', label: 'Wade into the crystal pool', intentTag: 'engage' },
        { id: 'c_d1_avoid', label: 'Map the cavern and continue', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'consumable', name: 'Bioluminescent Moss', quantity: 3 }],
      markerType: 'landmark',
    },
    {
      type: 'discovery',
      title: 'Ancient Dwarven Forge',
      reveal: 'A stone forge with a still-intact anvil sits in an alcove. Dwarven runes glow faintly on the bellows.',
      detail: 'This forge was built by master smiths of Clan Deepdelve. The enchantments on the bellows keep the forge at perfect working temperature—they still function after centuries. Unfinished projects sit on a workbench: a half-shaped mithral ring and ingots of an unknown blue-tinged metal. The forge could be reactivated with the right fuel.',
      choices: [
        { id: 'c_d2_inv', label: 'Examine the blue-tinged metal', intentTag: 'investigate' },
        { id: 'c_d2_eng', label: 'Try to restart the forge', intentTag: 'engage' },
        { id: 'c_d2_avoid', label: 'Take notes on the runes', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'trinket', name: 'Unfinished Mithral Ring', quantity: 1 }],
      markerType: 'landmark',
    },
    {
      type: 'quiet',
      title: 'Underground Stream',
      reveal: 'A stream of cool, clear water flows through a channel it has carved over millennia. The sound is soothing.',
      choices: [
        { id: 'c_q1_camp', label: 'Rest beside the stream', intentTag: 'camp' },
        { id: 'c_q1_inv', label: 'Follow the stream deeper', intentTag: 'investigate' },
        { id: 'c_q1_avoid', label: 'Drink and keep exploring', intentTag: 'avoid' },
      ],
    },
    {
      type: 'quiet',
      title: 'Bat Colony',
      reveal: 'Thousands of bats hang from the ceiling, their wings folded like leather umbrellas. The guano is deep.',
      detail: 'The colony is enormous but harmless. The guano, while unpleasant, is excellent fertilizer and a component in certain alchemical formulas. Among the common cave bats, you notice a few with unusual red markings—fire bats, prized by wizards as familiars.',
      choices: [
        { id: 'c_q2_inv', label: 'Try to attract a fire bat', intentTag: 'investigate' },
        { id: 'c_q2_avoid', label: 'Move through quietly', intentTag: 'avoid' },
        { id: 'c_q2_camp', label: 'Collect guano for trade', intentTag: 'camp' },
      ],
    },
    {
      type: 'risk',
      title: 'Cave Fisher Ambush',
      reveal: 'A sticky filament descends silently from the darkness above. Something large lurks on the ceiling.',
      detail: 'A cave fisher—a giant crab-like predator—has positioned itself above a chokepoint. Its adhesive filament is nearly invisible and strong enough to haul a grown human to the ceiling. The creature is patient and will wait for the perfect moment to strike. Others have fallen here—the floor is littered with picked-clean bones.',
      choices: [
        { id: 'c_r1_eng', label: 'Cut the filament and fight', intentTag: 'engage' },
        { id: 'c_r1_ret', label: 'Back out of range', intentTag: 'retreat' },
        { id: 'c_r1_inv', label: 'Find a way to lure it down', intentTag: 'investigate' },
      ],
      markerType: 'hazard',
      combatSeed: {
        encounterType: 'ambush',
        enemyTheme: 'cave_fisher',
        difficulty: 'medium',
        battlefieldTag: 'narrow_cavern',
        stakes: 'The fisher has the high ground—literally',
        fleeAllowed: true,
      },
    },
    {
      type: 'risk',
      title: 'Flooded Passage',
      reveal: 'The tunnel ahead dips below the waterline. Dark water fills the passage for at least twenty feet.',
      detail: 'The water is cold, still, and opaque. You can\'t see what\'s in it or how deep it goes. Air bubbles suggest the passage opens up on the other side, but there\'s no guarantee. Sounds echo strangely—something may be living in the flooded section. An old rope is tied to a spike on this side, trailing into the water.',
      choices: [
        { id: 'c_r2_inv', label: 'Tug the rope to test it', intentTag: 'investigate' },
        { id: 'c_r2_eng', label: 'Hold your breath and swim', intentTag: 'engage' },
        { id: 'c_r2_ret', label: 'Find another path', intentTag: 'retreat' },
      ],
      markerType: 'hazard',
    },
    {
      type: 'risk',
      title: 'Darkmantle Nest',
      reveal: 'The ceiling seems oddly low here—then you realize the "stalactites" are moving.',
      detail: 'Darkmantles—squid-like aberrations that cling to ceilings and drop onto prey, smothering them in magical darkness. At least four hang above you, disguised as rock formations. They attack by extinguishing all light sources first, then dropping en masse. Fire is their weakness.',
      choices: [
        { id: 'c_r3_eng', label: 'Strike with fire before they drop', intentTag: 'engage' },
        { id: 'c_r3_ret', label: 'Back away before they notice', intentTag: 'retreat' },
        { id: 'c_r3_avoid', label: 'Move through fast with light high', intentTag: 'avoid' },
      ],
      markerType: 'hazard',
      combatSeed: {
        encounterType: 'ambush',
        enemyTheme: 'darkmantle',
        difficulty: 'medium',
        battlefieldTag: 'low_ceiling_cave',
        stakes: 'Total darkness and grasping tentacles',
        fleeAllowed: true,
      },
    },
    {
      type: 'discovery',
      title: 'Mineral Vein',
      reveal: 'A streak of gleaming ore runs through the cave wall—copper, with traces of something richer beneath.',
      detail: 'The vein is mostly copper, but deeper examination reveals threads of gold and what might be adamantine. Mining it properly would take days and specialized tools, but surface samples can be chipped free with any hard implement. This find could be worth a fortune to the right buyer—or draw unwanted attention.',
      choices: [
        { id: 'c_d3_inv', label: 'Chip free some ore samples', intentTag: 'investigate' },
        { id: 'c_d3_eng', label: 'Mark the location secretly', intentTag: 'engage' },
        { id: 'c_d3_avoid', label: 'Note it and keep exploring', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'trinket', name: 'Ore Sample (possible gold)', quantity: 2 }],
      markerType: 'resource',
    },
  ],

  desert: [
    {
      type: 'discovery',
      title: 'Half-Buried Temple',
      reveal: 'Stone columns rise from the sand, the top of a temple buried by centuries of dunes shifting overhead.',
      detail: 'Only the upper colonnade remains visible. Hieroglyphs on the columns describe a sun god and a ceremony of "eternal light." A narrow gap between columns leads to a sand-choked stairway descending into darkness. The air rising from below is surprisingly cool and carries the scent of ancient incense.',
      choices: [
        { id: 'd_d1_inv', label: 'Descend the buried stairway', intentTag: 'investigate' },
        { id: 'd_d1_eng', label: 'Translate the hieroglyphs', intentTag: 'engage' },
        { id: 'd_d1_avoid', label: 'Record the location and leave', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'key_fragment', name: 'Sun Temple Glyph Rubbing', quantity: 1 }],
      markerType: 'landmark',
    },
    {
      type: 'discovery',
      title: 'Desert Oasis',
      reveal: 'Palm trees and green grass surround a pool of crystal water. It seems almost too perfect to be real.',
      detail: 'The oasis is genuine—fed by an underground spring. Date palms heavy with fruit ring the pool, and a family of desert foxes watches from the shade. Stone blocks at the water\'s edge suggest this was once a waystation on a caravan route. Names and dates are carved into the stones, some very old indeed.',
      choices: [
        { id: 'd_d2_camp', label: 'Rest and resupply at the oasis', intentTag: 'camp' },
        { id: 'd_d2_inv', label: 'Read the carved names and dates', intentTag: 'investigate' },
        { id: 'd_d2_eng', label: 'Gather dates and fill waterskins', intentTag: 'engage' },
      ],
      rewards: [{ kind: 'consumable', name: 'Fresh Dates and Water', quantity: 3 }],
      markerType: 'resource',
    },
    {
      type: 'quiet',
      title: 'Windswept Ridge',
      reveal: 'The wind sculpts the sand into hypnotic ripples. The silence is vast and ancient, broken only by gusts.',
      choices: [
        { id: 'd_q1_camp', label: 'Shelter behind the ridge', intentTag: 'camp' },
        { id: 'd_q1_inv', label: 'Scan the desert from the ridge', intentTag: 'investigate' },
        { id: 'd_q1_avoid', label: 'Continue through the wind', intentTag: 'avoid' },
      ],
    },
    {
      type: 'quiet',
      title: 'Petrified Forest',
      reveal: 'Stone trees stand where living ones grew millennia ago. Their mineral branches cast blue-grey shadows.',
      detail: 'The petrification happened so slowly that even the bark grain is preserved. Some "trees" have broken, revealing rings of agate and jasper inside. It\'s beautiful and melancholy—a forest frozen in death. Small desert creatures have made homes in the hollow trunks.',
      choices: [
        { id: 'd_q2_inv', label: 'Collect agate fragments', intentTag: 'investigate' },
        { id: 'd_q2_camp', label: 'Rest in the shade of stone', intentTag: 'camp' },
        { id: 'd_q2_avoid', label: 'Pass through in reverence', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'trinket', name: 'Polished Agate Fragment', quantity: 1 }],
    },
    {
      type: 'risk',
      title: 'Giant Scorpion Burrow',
      reveal: 'A ring of disturbed sand surrounds a dark hole large enough to swallow a horse. Clicking sounds emerge.',
      detail: 'A monstrous scorpion has dug its lair here. The burrow system is extensive—you can feel vibrations from multiple creatures below. The largest is at least eight feet long with pincers that could sever a limb. They hunt at night and are sluggish in the midday heat. Their venom sacs are valuable alchemical components.',
      choices: [
        { id: 'd_r1_eng', label: 'Lure one out in the heat', intentTag: 'engage' },
        { id: 'd_r1_ret', label: 'Give the burrow wide berth', intentTag: 'retreat' },
        { id: 'd_r1_inv', label: 'Study their patrol patterns', intentTag: 'investigate' },
      ],
      markerType: 'hazard',
      combatSeed: {
        encounterType: 'lair_scout',
        enemyTheme: 'giant_scorpion',
        difficulty: 'medium',
        battlefieldTag: 'desert_sands',
        stakes: 'Venomous pincers and burrowing ambush tactics',
        fleeAllowed: true,
      },
    },
    {
      type: 'risk',
      title: 'Sandstorm Approaching',
      reveal: 'The horizon darkens with a wall of swirling sand. You have minutes before it hits.',
      detail: 'Desert sandstorms strip flesh from bone and erase all landmarks. You need shelter immediately. A rocky outcrop to the east might provide cover, or you could try to outrun it to the south where the land dips into a wadi. Staying exposed means certain injury and possible death.',
      choices: [
        { id: 'd_r2_eng', label: 'Race to the rocky outcrop', intentTag: 'engage' },
        { id: 'd_r2_ret', label: 'Dig a shelter in the sand', intentTag: 'retreat' },
        { id: 'd_r2_inv', label: 'Run for the wadi to the south', intentTag: 'investigate' },
      ],
      markerType: 'hazard',
    },
    {
      type: 'risk',
      title: 'Desert Bandits',
      reveal: 'Riders emerge from behind the dunes, their faces wrapped against the sun. Steel glints in their hands.',
      detail: 'Five mounted bandits who prey on travelers crossing the wastes. Their leader, a scarred tiefling woman, demands your water and valuables. They\'re experienced desert fighters who use hit-and-run tactics. Negotiation is possible—they respect strength and bold words.',
      choices: [
        { id: 'd_r3_eng', label: 'Challenge the leader directly', intentTag: 'engage' },
        { id: 'd_r3_ret', label: 'Offer water as a peace gesture', intentTag: 'retreat' },
        { id: 'd_r3_inv', label: 'Bluff about backup coming', intentTag: 'investigate' },
      ],
      markerType: 'hazard',
      combatSeed: {
        encounterType: 'pursuit',
        enemyTheme: 'desert_bandit',
        difficulty: 'medium',
        battlefieldTag: 'open_desert',
        stakes: 'Mounted raiders with nowhere to hide',
        fleeAllowed: false,
      },
    },
    {
      type: 'discovery',
      title: 'Nomad Trail Signs',
      reveal: 'Stacked pebbles and scratched symbols mark a path only desert nomads can read.',
      detail: 'The signs are from the Sandwalker tribe—notoriously reclusive but legendary traders. The symbols indicate safe water within a day\'s walk, a warning about "the glass fields" to the west, and an invitation to trade for anyone who brings iron tools. The Sandwalkers know every hidden spring and cave in the desert.',
      choices: [
        { id: 'd_d3_inv', label: 'Decode all the trail signs', intentTag: 'investigate' },
        { id: 'd_d3_eng', label: 'Follow toward the water source', intentTag: 'engage' },
        { id: 'd_d3_avoid', label: 'Copy the symbols for later', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'knowledge', name: 'Sandwalker Trail Cipher', quantity: 1 }],
      markerType: 'trace',
    },
  ],

  snow: [
    {
      type: 'discovery',
      title: 'Frozen Waterfall',
      reveal: 'A cascade of ice hangs suspended mid-flow, a frozen waterfall glittering like a wall of diamonds.',
      detail: 'Behind the ice curtain, a shallow cave provides shelter from the wind. Previous visitors left a cache of firewood and dried meat wrapped in oilskin. The ice itself contains trapped air bubbles that whisper when the wind blows—an acoustic trick that has spawned ghost stories for generations.',
      choices: [
        { id: 'sn_d1_inv', label: 'Explore behind the ice wall', intentTag: 'investigate' },
        { id: 'sn_d1_camp', label: 'Use the cache and make camp', intentTag: 'camp' },
        { id: 'sn_d1_avoid', label: 'Admire it and press onward', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'consumable', name: 'Cached Supplies', quantity: 2 }],
      markerType: 'resource',
    },
    {
      type: 'discovery',
      title: 'Mammoth Graveyard',
      reveal: 'Enormous curved tusks and weathered bones rise from the snow. This is where mammoths came to die.',
      detail: 'Dozens of mammoth skeletons lie in a depression, some partially embedded in permafrost. The ivory is valuable but heavy. Among the bones, you find tools and jewelry from an ancient tribe that revered these creatures—carved bone amulets depicting the mammoth spirit. A shaman\'s staff, cracked but still faintly magical, leans against the largest skull.',
      choices: [
        { id: 'sn_d2_inv', label: 'Examine the shaman\'s staff', intentTag: 'investigate' },
        { id: 'sn_d2_eng', label: 'Collect ivory and amulets', intentTag: 'engage' },
        { id: 'sn_d2_avoid', label: 'Honor the dead and leave', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'trinket', name: 'Mammoth Bone Amulet', quantity: 1 }],
      markerType: 'landmark',
    },
    {
      type: 'quiet',
      title: 'Snow-Blanketed Silence',
      reveal: 'Fresh snow covers everything. The world is hushed and still, every sound muffled to a whisper.',
      choices: [
        { id: 'sn_q1_camp', label: 'Build a snow shelter and rest', intentTag: 'camp' },
        { id: 'sn_q1_inv', label: 'Look for animal tracks', intentTag: 'investigate' },
        { id: 'sn_q1_avoid', label: 'Keep moving to stay warm', intentTag: 'avoid' },
      ],
    },
    {
      type: 'quiet',
      title: 'Hot Spring',
      reveal: 'Steam rises from a pool of heated water amid the ice. The warmth is a gift from the earth itself.',
      detail: 'Volcanic activity deep underground heats this spring to a comfortable temperature. Mineral deposits have built terraces of white and orange around the edges. The warmth extends in a small radius, melting the snow and encouraging hardy mosses and even a few flowers to grow. It\'s a perfect place to recover from the cold.',
      choices: [
        { id: 'sn_q2_camp', label: 'Soak and warm your bones', intentTag: 'camp' },
        { id: 'sn_q2_inv', label: 'Collect mineral deposits', intentTag: 'investigate' },
        { id: 'sn_q2_avoid', label: 'Warm up briefly and continue', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'consumable', name: 'Thermal Mineral Salts', quantity: 2 }],
      markerType: 'resource',
    },
    {
      type: 'risk',
      title: 'Frost Wolves',
      reveal: 'White shapes move through the blizzard—wolves with ice-blue eyes and frost-rimed fur.',
      detail: 'Winter wolves—magical beasts that breathe cones of freezing cold. A pack of four has caught your scent. They are cunning enough to set ambushes and patient enough to follow prey for days. Their pelts are extraordinarily valuable. They fear fire above all else.',
      choices: [
        { id: 'sn_r1_eng', label: 'Light a fire and stand firm', intentTag: 'engage' },
        { id: 'sn_r1_ret', label: 'Seek shelter immediately', intentTag: 'retreat' },
        { id: 'sn_r1_avoid', label: 'Leave food and back away', intentTag: 'avoid' },
      ],
      markerType: 'hazard',
      combatSeed: {
        encounterType: 'pursuit',
        enemyTheme: 'winter_wolf',
        difficulty: 'hard',
        battlefieldTag: 'frozen_tundra',
        stakes: 'Their frost breath can freeze you solid',
        fleeAllowed: true,
      },
    },
    {
      type: 'risk',
      title: 'Thin Ice',
      reveal: 'The frozen lake ahead creaks and groans. Cracks spider-web from where you stand.',
      detail: 'The ice is thick near the shore but thins dangerously toward the center. You can see dark water moving beneath. Crossing would save hours of travel around the lake, but a fall into freezing water in this climate is a death sentence without immediate fire and shelter. Marks on the far shore suggest others have crossed—not all successfully.',
      choices: [
        { id: 'sn_r2_inv', label: 'Test the ice with a pole', intentTag: 'investigate' },
        { id: 'sn_r2_ret', label: 'Go around the long way', intentTag: 'retreat' },
        { id: 'sn_r2_eng', label: 'Crawl across to spread weight', intentTag: 'engage' },
      ],
      markerType: 'hazard',
    },
    {
      type: 'discovery',
      title: 'Ice Troll Cave',
      reveal: 'A cave mouth ringed with icicles holds the remnants of a troll\'s hoard—the beast is nowhere to be seen.',
      detail: 'The troll that lived here has been slain—by adventurers or rivals, it\'s unclear. What remains is a pile of "treasure" by troll standards: copper coins, a dented helm, animal pelts, and—surprisingly—a well-preserved spellbook wrapped in bear hide. The troll couldn\'t read it but liked the shiny cover.',
      choices: [
        { id: 'sn_d3_inv', label: 'Examine the spellbook', intentTag: 'investigate' },
        { id: 'sn_d3_eng', label: 'Gather all the salvageable loot', intentTag: 'engage' },
        { id: 'sn_d3_ret', label: 'Check for other trolls first', intentTag: 'retreat' },
      ],
      rewards: [{ kind: 'trinket', name: 'Frost-Preserved Spellbook', quantity: 1 }],
      markerType: 'opportunity',
    },
    {
      type: 'risk',
      title: 'Avalanche Path',
      reveal: 'The slope above is loaded with fresh snow. Distant rumbling suggests it could release at any time.',
      detail: 'An avalanche zone. The snowpack above is unstable—any loud noise or vibration could trigger a deadly slide. The safe route below adds three hours to your journey. A quick dash across the danger zone is risky but possible if you move fast and stay quiet.',
      choices: [
        { id: 'sn_r3_eng', label: 'Sprint across the danger zone', intentTag: 'engage' },
        { id: 'sn_r3_ret', label: 'Take the safe route below', intentTag: 'retreat' },
        { id: 'sn_r3_inv', label: 'Look for a way to trigger it safely', intentTag: 'investigate' },
      ],
      markerType: 'hazard',
    },
  ],

  coast: [
    {
      type: 'discovery',
      title: 'Shipwreck on the Rocks',
      reveal: 'The broken hull of a merchant vessel lies wedged between sea rocks, its cargo scattered by the waves.',
      detail: 'The ship was called the Maiden\'s Fortune—the name is still legible on a brass plate. She went down in a storm perhaps a month ago. Most of the cargo was mundane goods ruined by saltwater, but the captain\'s cabin is still mostly intact. A locked strongbox sits bolted to the floor, and a navigation chart pinned to the wall shows a route to an island not on any standard map.',
      choices: [
        { id: 'co_d1_inv', label: 'Try to open the strongbox', intentTag: 'investigate' },
        { id: 'co_d1_eng', label: 'Copy the mysterious chart', intentTag: 'engage' },
        { id: 'co_d1_avoid', label: 'Salvage what you can carry', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'knowledge', name: 'Secret Island Chart', quantity: 1 }],
      markerType: 'landmark',
    },
    {
      type: 'discovery',
      title: 'Tide Pool Garden',
      reveal: 'Vibrant tide pools teem with starfish, anemones, and small crabs. Strange shells glimmer with inner light.',
      detail: 'These tide pools contain species found nowhere else on the coast. The glowing shells are moonshells—they absorb moonlight and release it slowly. Alchemists pay well for them. Among the pools, you find a perfectly preserved glass bottle containing a rolled parchment sealed with wax.',
      choices: [
        { id: 'co_d2_inv', label: 'Open the sealed bottle', intentTag: 'investigate' },
        { id: 'co_d2_eng', label: 'Collect moonshells', intentTag: 'engage' },
        { id: 'co_d2_avoid', label: 'Enjoy the beauty and move on', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'trinket', name: 'Moonshell', quantity: 3 }],
      markerType: 'resource',
    },
    {
      type: 'quiet',
      title: 'Driftwood Cove',
      reveal: 'A sheltered cove with a beach of dark sand and sun-bleached driftwood. The waves lap gently here.',
      choices: [
        { id: 'co_q1_camp', label: 'Build a driftwood fire and rest', intentTag: 'camp' },
        { id: 'co_q1_inv', label: 'Search the debris line', intentTag: 'investigate' },
        { id: 'co_q1_avoid', label: 'Walk the shore and continue', intentTag: 'avoid' },
      ],
    },
    {
      type: 'quiet',
      title: 'Fisherman\'s Shrine',
      reveal: 'A small stone shrine stands above the waterline, decorated with nets and offerings of fish and flowers.',
      detail: 'Coastal folk leave offerings to the Sea Mother here for safe voyages and good catches. The shrine is well-maintained—someone visits regularly. A weathered sign reads "Take nothing, leave something." Fresh flowers suggest a visit within the last day or two.',
      choices: [
        { id: 'co_q2_eng', label: 'Leave an offering of your own', intentTag: 'engage' },
        { id: 'co_q2_inv', label: 'Read the prayer inscriptions', intentTag: 'investigate' },
        { id: 'co_q2_avoid', label: 'Bow respectfully and pass by', intentTag: 'avoid' },
      ],
      markerType: 'npc_echo',
    },
    {
      type: 'risk',
      title: 'Sahuagin Scouts',
      reveal: 'Webbed footprints emerge from the surf. Guttural clicks echo from behind the rocks ahead.',
      detail: 'Sahuagin—fishlike humanoids that raid coastal settlements. Three scouts are observing the shore, likely planning a raid on a nearby village. They are vicious fighters in water but less effective on dry land. Alerting the nearest settlement could save lives. Fighting them here might prevent the raid entirely.',
      choices: [
        { id: 'co_r1_eng', label: 'Ambush them on dry land', intentTag: 'engage' },
        { id: 'co_r1_ret', label: 'Warn the nearest village', intentTag: 'retreat' },
        { id: 'co_r1_inv', label: 'Observe their numbers and plans', intentTag: 'investigate' },
      ],
      markerType: 'hazard',
      combatSeed: {
        encounterType: 'ambush',
        enemyTheme: 'sahuagin',
        difficulty: 'medium',
        battlefieldTag: 'rocky_shoreline',
        stakes: 'Stop the scouts before they report back',
        fleeAllowed: true,
      },
    },
    {
      type: 'risk',
      title: 'Rising Tide',
      reveal: 'Water is rushing into the cave you entered from the beach. The tide is coming in fast.',
      detail: 'You didn\'t notice the watermarks on the walls until now. This cave floods completely at high tide—and the tide is coming in fast. The entrance you used is already knee-deep. There might be a higher exit deeper in the cave, or you could try to wade out before the water rises too high.',
      choices: [
        { id: 'co_r2_eng', label: 'Wade out through the rising water', intentTag: 'engage' },
        { id: 'co_r2_inv', label: 'Search for a higher exit', intentTag: 'investigate' },
        { id: 'co_r2_ret', label: 'Climb to the highest point inside', intentTag: 'retreat' },
      ],
      markerType: 'hazard',
    },
    {
      type: 'discovery',
      title: 'Smuggler\'s Cave',
      reveal: 'Behind a curtain of hanging seaweed, a cave mouth opens. Inside: crates stamped with foreign marks.',
      detail: 'This is an active smuggling cache. The crates contain bolts of silk, bottles of exotic wine, and small packets of a rare spice called dragon pepper. A logbook records deliveries and pickups—the next one is scheduled in three days. The smugglers aren\'t necessarily villains—they may be evading unjust tariffs.',
      choices: [
        { id: 'co_d3_inv', label: 'Read the smuggler\'s logbook', intentTag: 'investigate' },
        { id: 'co_d3_eng', label: 'Help yourself to some goods', intentTag: 'engage' },
        { id: 'co_d3_avoid', label: 'Close the cave and leave', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'consumable', name: 'Dragon Pepper Packet', quantity: 2 }],
      markerType: 'opportunity',
    },
    {
      type: 'discovery',
      title: 'Sea Glass Beach',
      reveal: 'The beach is covered in smoothed glass fragments in every color. Some pieces are warm to the touch.',
      detail: 'This beach collects glass from a glassworks that once operated upcoast—destroyed in a fire decades ago. Most pieces are ordinary, but the warm ones contain traces of elemental fire magic, residue from enchanted items that were being crafted when the fire struck. A collector or wizard would pay handsomely for these.',
      choices: [
        { id: 'co_d4_inv', label: 'Sort the magical from mundane', intentTag: 'investigate' },
        { id: 'co_d4_eng', label: 'Gather a pouchful of warm glass', intentTag: 'engage' },
        { id: 'co_d4_avoid', label: 'Take a few pretty pieces', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'trinket', name: 'Enchanted Sea Glass', quantity: 3 }],
      markerType: 'resource',
    },
  ],

  ruins: [
    {
      type: 'discovery',
      title: 'Collapsed Library',
      reveal: 'Fallen shelves and scattered pages cover the floor of what was once a grand reading hall. Some books survive.',
      detail: 'Most volumes are ruined by water and time, but a section built into the wall—a sealed archive—remains intact. Inside: three scrolls in excellent condition, a bestiary of creatures that no longer exist (or do they?), and a map of the city as it appeared before the cataclysm. One scroll radiates faint divination magic.',
      choices: [
        { id: 'ru_d1_inv', label: 'Read the magical scroll', intentTag: 'investigate' },
        { id: 'ru_d1_eng', label: 'Take everything you can carry', intentTag: 'engage' },
        { id: 'ru_d1_avoid', label: 'Photograph and catalog the finds', intentTag: 'avoid' },
      ],
      rewards: [
        { kind: 'knowledge', name: 'Pre-Cataclysm City Map', quantity: 1 },
        { kind: 'trinket', name: 'Divination Scroll', quantity: 1 },
      ],
      markerType: 'landmark',
    },
    {
      type: 'discovery',
      title: 'Intact Mosaic Floor',
      reveal: 'Beneath the rubble, a pristine mosaic depicts a battle between mortals and celestial beings.',
      detail: 'The mosaic tells a story: mortals wielding weapons of light against winged beings of shadow. The central figure holds a crown that splits into seven fragments. Each fragment is depicted in a different location—some recognizable, others mysterious. This might be a historical record or a prophetic vision.',
      choices: [
        { id: 'ru_d2_inv', label: 'Study the seven locations', intentTag: 'investigate' },
        { id: 'ru_d2_eng', label: 'Pry loose a mosaic tile', intentTag: 'engage' },
        { id: 'ru_d2_avoid', label: 'Sketch the complete scene', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'key_fragment', name: 'Crown Fragment Clue', quantity: 1 }],
      markerType: 'landmark',
    },
    {
      type: 'quiet',
      title: 'Overgrown Courtyard',
      reveal: 'Nature has reclaimed this space. Vines climb broken columns and wildflowers push through cracked stone.',
      choices: [
        { id: 'ru_q1_camp', label: 'Rest in the sheltered courtyard', intentTag: 'camp' },
        { id: 'ru_q1_inv', label: 'Look for surviving inscriptions', intentTag: 'investigate' },
        { id: 'ru_q1_avoid', label: 'Pass through appreciatively', intentTag: 'avoid' },
      ],
    },
    {
      type: 'quiet',
      title: 'Echo Chamber',
      reveal: 'A domed room amplifies every sound to startling volume. Your heartbeat sounds like a drum.',
      detail: 'The acoustics were intentional—this was a council chamber where whispered arguments could be heard by all. The effect is disorienting but fascinating. Words spoken at the center carry to every point of the dome. Names are scratched into the seats: senators, councillors, merchants—the power structure of a dead civilization.',
      choices: [
        { id: 'ru_q2_inv', label: 'Record the names on the seats', intentTag: 'investigate' },
        { id: 'ru_q2_eng', label: 'Test the acoustics yourself', intentTag: 'engage' },
        { id: 'ru_q2_avoid', label: 'Move through quietly', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'knowledge', name: 'Ancient Senate Records', quantity: 1 }],
    },
    {
      type: 'risk',
      title: 'Skeletal Sentinels',
      reveal: 'Armored skeletons stand motionless in alcoves along the hall. Their eye sockets flicker with pale light.',
      detail: 'Undead guardians bound to protect this place even in death. They will animate if anyone crosses an invisible threshold—a line of silver dust on the floor, barely visible. There are six of them, armed with ancient but still-sharp weapons. Their binding magic weakens in sunlight, but down here there is none.',
      choices: [
        { id: 'ru_r1_inv', label: 'Search for the activation trigger', intentTag: 'investigate' },
        { id: 'ru_r1_eng', label: 'Charge through before they wake', intentTag: 'engage' },
        { id: 'ru_r1_ret', label: 'Find another way around', intentTag: 'retreat' },
      ],
      markerType: 'hazard',
      combatSeed: {
        encounterType: 'ambush',
        enemyTheme: 'skeleton_guardian',
        difficulty: 'medium',
        battlefieldTag: 'ancient_hall',
        stakes: 'They do not tire and they do not fear',
        fleeAllowed: true,
      },
    },
    {
      type: 'risk',
      title: 'Collapsing Ceiling',
      reveal: 'Dust rains from cracks above. A low groan reverberates through the stone. This room is failing.',
      detail: 'Centuries of erosion have weakened the load-bearing columns. The ceiling could come down at any moment. Crossing the room quickly is possible but risky—a stumble could be fatal. The alternative route through the basement adds significant time and is flooded to the waist.',
      choices: [
        { id: 'ru_r2_eng', label: 'Sprint across the room', intentTag: 'engage' },
        { id: 'ru_r2_ret', label: 'Take the flooded basement', intentTag: 'retreat' },
        { id: 'ru_r2_inv', label: 'Shore up a column temporarily', intentTag: 'investigate' },
      ],
      markerType: 'hazard',
    },
    {
      type: 'risk',
      title: 'Trapped Vault Door',
      reveal: 'A massive iron door stands ajar, its lock mechanisms exposed. Scratch marks suggest others tried to force it.',
      detail: 'The vault is trapped—poison needle mechanisms line the lock, and a pressure plate behind the door triggers a portcullis. The previous intruders tripped the portcullis but avoided the needles. Whatever is inside was important enough to protect this heavily. You can see the glint of metal through the gap.',
      choices: [
        { id: 'ru_r3_inv', label: 'Disarm the remaining traps', intentTag: 'investigate' },
        { id: 'ru_r3_eng', label: 'Reach through the gap carefully', intentTag: 'engage' },
        { id: 'ru_r3_ret', label: 'Leave it—not worth the risk', intentTag: 'retreat' },
      ],
      markerType: 'hazard',
    },
    {
      type: 'discovery',
      title: 'Alchemist\'s Laboratory',
      reveal: 'Glass apparatus lines the shelves—retorts, alembics, and flasks of colored liquids still sealed.',
      detail: 'The alchemist who worked here left in a hurry. Notes scattered on the bench describe experiments with "essence of starlight" and "distilled shadow." Several potions remain viable, identifiable by their color: blue for healing, red for fire resistance, and a mysterious black one labeled only with a question mark.',
      choices: [
        { id: 'ru_d3_inv', label: 'Read the research notes', intentTag: 'investigate' },
        { id: 'ru_d3_eng', label: 'Take the viable potions', intentTag: 'engage' },
        { id: 'ru_d3_avoid', label: 'Study the apparatus design', intentTag: 'avoid' },
      ],
      rewards: [
        { kind: 'consumable', name: 'Ancient Healing Potion', quantity: 1 },
        { kind: 'consumable', name: 'Fire Resistance Elixir', quantity: 1 },
      ],
      markerType: 'resource',
    },
  ],

  settlement: [
    {
      type: 'discovery',
      title: 'Town Notice Board',
      reveal: 'The notice board outside the tavern is plastered with bounties, requests, and warnings from locals.',
      detail: 'Among the usual lost-cat notices and harvest festival announcements, three stand out: a bounty for a goblin war chief (50 gold, alive), a request from a widow to retrieve her husband\'s sword from a monster\'s lair, and a cryptic note in Elvish promising "truth for the worthy" at midnight by the old well.',
      choices: [
        { id: 'se_d1_inv', label: 'Read every notice carefully', intentTag: 'investigate' },
        { id: 'se_d1_eng', label: 'Take the bounty notice', intentTag: 'engage' },
        { id: 'se_d1_avoid', label: 'Check the tavern instead', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'knowledge', name: 'Local Quest Leads', quantity: 3 }],
      markerType: 'opportunity',
    },
    {
      type: 'discovery',
      title: 'Traveling Merchant',
      reveal: 'A colorful wagon parked in the square bears the sign: "Curious Goods from Distant Lands."',
      detail: 'Zara the merchant—a gnome with wild hair and wilder stories—sells items from across the continent. Her wares include a compass that points to your heart\'s desire (100gp, probably cursed), healing potions at fair prices, and a collection of maps. She also buys unusual items and pays well for monster parts and rare herbs.',
      choices: [
        { id: 'se_d2_inv', label: 'Browse her unusual wares', intentTag: 'investigate' },
        { id: 'se_d2_eng', label: 'Sell your collected trinkets', intentTag: 'engage' },
        { id: 'se_d2_avoid', label: 'Ask about news from afar', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'knowledge', name: 'Distant Lands Rumors', quantity: 1 }],
      markerType: 'npc_echo',
    },
    {
      type: 'quiet',
      title: 'Warm Tavern Hearth',
      reveal: 'The tavern is warm and lively. A bard plays a lute in the corner while locals share stories over ale.',
      choices: [
        { id: 'se_q1_camp', label: 'Get a room for the night', intentTag: 'camp' },
        { id: 'se_q1_inv', label: 'Listen for rumors and gossip', intentTag: 'investigate' },
        { id: 'se_q1_eng', label: 'Buy a round for the locals', intentTag: 'engage' },
      ],
    },
    {
      type: 'quiet',
      title: 'Village Temple',
      reveal: 'A modest temple offers healing, blessings, and a moment of peace to all who enter.',
      detail: 'The temple serves Chauntea, goddess of agriculture. The priestess, a stout halfling named Mira, offers minor healing for a small donation and greater healing for those in true need. She also keeps records of local births, deaths, and strange occurrences—a valuable source of information.',
      choices: [
        { id: 'se_q2_eng', label: 'Request a healing blessing', intentTag: 'engage', mechanicalEffects: { healing: true } },
        { id: 'se_q2_inv', label: 'Ask about strange occurrences', intentTag: 'investigate' },
        { id: 'se_q2_avoid', label: 'Offer a donation and leave', intentTag: 'avoid' },
      ],
      markerType: 'npc_echo',
    },
    {
      type: 'risk',
      title: 'Bar Brawl',
      reveal: 'Tensions boil over in the tavern. A chair flies, and suddenly fists are swinging everywhere.',
      detail: 'Two rival groups—miners and loggers—are fighting over water rights. The tavern keeper is hiding behind the bar. You\'re caught in the middle. Taking sides will earn you allies and enemies. Breaking it up might earn everyone\'s grudging respect. Or you could slip out the back.',
      choices: [
        { id: 'se_r1_eng', label: 'Try to break up the fight', intentTag: 'engage' },
        { id: 'se_r1_ret', label: 'Slip out the back door', intentTag: 'retreat' },
        { id: 'se_r1_inv', label: 'Listen to both sides first', intentTag: 'investigate' },
      ],
      markerType: 'npc_echo',
      combatSeed: {
        encounterType: 'ambush',
        enemyTheme: 'tavern_brawl',
        difficulty: 'easy',
        battlefieldTag: 'tavern_interior',
        stakes: 'Pride and local politics—no one wants to kill',
        fleeAllowed: true,
      },
    },
    {
      type: 'risk',
      title: 'Pickpocket in the Market',
      reveal: 'Your coin purse feels lighter. A small figure darts through the crowd ahead.',
      detail: 'A young halfling urchin has lifted some of your gold. She\'s fast and knows every alley in town. Chasing her might lead you into her gang\'s territory—or it might reveal a network of street children who know everything that happens in this settlement. The local guard won\'t help; they have bigger problems.',
      choices: [
        { id: 'se_r2_eng', label: 'Chase the pickpocket', intentTag: 'engage' },
        { id: 'se_r2_inv', label: 'Ask around about the urchins', intentTag: 'investigate' },
        { id: 'se_r2_avoid', label: 'Accept the loss and move on', intentTag: 'avoid' },
      ],
      markerType: 'npc_echo',
    },
    {
      type: 'discovery',
      title: 'Blacksmith\'s Special Stock',
      reveal: 'The village blacksmith beckons you over, glancing around nervously. "I\'ve got something special."',
      detail: 'Old Gareth has been holding a weapon he found in a collapsed cellar—a short sword with a blade that never dulls and a faint blue shimmer along the edge. He doesn\'t know its value and wants it gone before someone with "connections" comes looking. He\'ll sell it for a fraction of its worth if you buy today.',
      choices: [
        { id: 'se_d3_inv', label: 'Examine the blade with Arcana', intentTag: 'investigate' },
        { id: 'se_d3_eng', label: 'Make an offer immediately', intentTag: 'engage' },
        { id: 'se_d3_avoid', label: 'Politely decline', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'trinket', name: 'Shimmer-Edge Short Sword', quantity: 1 }],
      markerType: 'opportunity',
    },
    {
      type: 'discovery',
      title: 'Elderly Sage\'s Request',
      reveal: 'An old woman approaches you at the well. "You have the look of someone who ventures into wild places."',
      detail: 'Elara was once a court wizard, now retired. She needs a specific mushroom that grows only in deep caves—ember cap, glowing orange, about the size of a fist. She\'ll trade a potion of greater healing and share her knowledge of local magical phenomena. She also hints at a "disturbance" in the old ruins nearby.',
      choices: [
        { id: 'se_d4_eng', label: 'Accept her quest', intentTag: 'engage' },
        { id: 'se_d4_inv', label: 'Ask about the disturbance', intentTag: 'investigate' },
        { id: 'se_d4_avoid', label: 'Politely decline the task', intentTag: 'avoid' },
      ],
      rewards: [{ kind: 'knowledge', name: 'Local Magical Phenomena', quantity: 1 }],
      markerType: 'npc_echo',
    },
  ],
};

const NOTHING_OUTCOME: CuratedOutcome = {
  type: 'none',
  title: 'Uneventful Stretch',
  reveal: 'The path ahead is quiet. Nothing stirs except the wind and your own thoughts.',
  choices: [
    { id: 'none_continue', label: 'Press onward', intentTag: 'investigate' },
    { id: 'none_camp', label: 'Take a short rest', intentTag: 'camp' },
  ],
};

export function mapBiomeFromTerrain(terrainType: string): BiomeKey {
  const t = terrainType.toLowerCase();
  if (t.includes('forest') || t.includes('wood') || t.includes('grove') || t.includes('thicket') || t.includes('tree')) return 'forest';
  if (t.includes('grass') || t.includes('meadow') || t.includes('field') || t.includes('plains') || t.includes('clearing') || t.includes('glade') || t.includes('garden') || t.includes('orchard')) return 'grass';
  if (t.includes('swamp') || t.includes('marsh') || t.includes('bog')) return 'swamp';
  if (t.includes('mountain') || t.includes('peak') || t.includes('cliff') || t.includes('ridge') || t.includes('canyon')) return 'mountain';
  if (t.includes('hill') || t.includes('slope') || t.includes('valley')) return 'hill';
  if (t.includes('cave') || t.includes('cavern') || t.includes('mine') || t.includes('tunnel') || t.includes('underground') || t.includes('corridor') || t.includes('passage') || t.includes('chamber') || t.includes('cellar') || t.includes('basement')) return 'cave';
  if (t.includes('desert') || t.includes('dune') || t.includes('sand') || t.includes('lava') || t.includes('volcano')) return 'desert';
  if (t.includes('ice') || t.includes('glacier') || t.includes('snow') || t.includes('tundra') || t.includes('frozen')) return 'snow';
  if (t.includes('coast') || t.includes('shore') || t.includes('beach') || t.includes('island') || t.includes('dock') || t.includes('pier') || t.includes('harbor') || t.includes('river') || t.includes('stream') || t.includes('lake') || t.includes('pond') || t.includes('pool') || t.includes('water') || t.includes('brook') || t.includes('creek') || t.includes('waterfall')) return 'coast';
  if (t.includes('ruin') || t.includes('castle') || t.includes('fortress') || t.includes('keep') || t.includes('tower') || t.includes('wall') || t.includes('gate') || t.includes('dungeon') || t.includes('crypt') || t.includes('tomb') || t.includes('catacomb') || t.includes('graveyard') || t.includes('cemetery') || t.includes('temple') || t.includes('shrine') || t.includes('altar') || t.includes('sanctuary') || t.includes('chapel') || t.includes('cathedral')) return 'ruins';
  if (t.includes('village') || t.includes('town') || t.includes('city') || t.includes('market') || t.includes('square') || t.includes('plaza') || t.includes('street') || t.includes('tavern') || t.includes('inn') || t.includes('shop') || t.includes('camp') || t.includes('house') || t.includes('cabin') || t.includes('cottage') || t.includes('hut') || t.includes('building') || t.includes('stable') || t.includes('settlement') || t.includes('road') || t.includes('path') || t.includes('trail') || t.includes('track') || t.includes('crossroads') || t.includes('bridge')) return 'settlement';
  return 'grass';
}

export function calculateDangerRating(params: {
  biome: string;
  proximityToLairs: number;
  ticksSinceRest: number;
  partyLevel: number;
  isHot: boolean;
}): number {
  const biomeKey = (Object.keys(BIOME_BASE_DANGER).includes(params.biome) ? params.biome : 'grass') as BiomeKey;
  let danger = BIOME_BASE_DANGER[biomeKey];

  danger += Math.round(params.proximityToLairs * 30);

  if (params.ticksSinceRest > 10) {
    danger += Math.min((params.ticksSinceRest - 10) * 2, 20);
  }

  if (params.partyLevel <= 2) {
    danger += 10;
  } else if (params.partyLevel >= 8) {
    danger -= 10;
  }

  if (params.isHot) {
    danger += 15;
  }

  return Math.max(0, Math.min(100, danger));
}

// ─── Structured exploration encounters (chest / trap / analytic puzzle) ───────
// These reuse wander's existing choice→intentTag flow, so they render and resolve
// with NO new UI: the player just clicks a choice button.

function mapChestReward(items?: string[], gold?: number): CuratedOutcome['rewards'] {
  const rewards: CuratedOutcome['rewards'] = [];
  (items || []).forEach((name) => rewards!.push({ kind: 'trinket', name, quantity: 1 }));
  if (gold) rewards!.push({ kind: 'faction_token', name: `${gold} gold`, quantity: gold });
  return rewards;
}

/** A hidden chest/cache the player can inspect for traps, force open, or leave. */
function buildChestOutcome(level: number): CuratedOutcome {
  const chest = generateExplorationChest({ level });
  return {
    type: 'discovery',
    title: 'A Hidden Cache',
    reveal: chest.description,
    detail: chest.trapped ? 'Something about the lid seam makes you wary.' : undefined,
    choices: [
      { id: 'inspect', label: `Check it for traps first (Investigation)`, intentTag: 'investigate' },
      { id: 'force', label: chest.locked ? `Force the lock open` : `Open it`, intentTag: 'engage' },
      { id: 'leave', label: 'Leave it be', intentTag: 'avoid' },
    ],
    rewards: mapChestReward(chest.reward.items, chest.reward.gold),
    markerType: 'resource',
  } as CuratedOutcome;
}

/** A concealed trap the player can spot & disarm, rush past, or carefully probe. */
function buildTrapOutcome(level: number): CuratedOutcome {
  const trap = generateExplorationTrap({ level });
  return {
    type: 'risk',
    title: 'A Concealed Hazard',
    reveal: `${trap.triggerDescription} It has the marks of a ${trap.trapType.replace(/_/g, ' ')} trap.`,
    detail: trap.disarmHint,
    choices: [
      { id: 'disarm', label: `Disarm it (Thieves' Tools DC ${trap.disarmDC})`, intentTag: 'investigate' },
      { id: 'rush', label: 'Rush past and risk it', intentTag: 'engage' },
      { id: 'back', label: 'Back away carefully', intentTag: 'retreat' },
    ],
  } as CuratedOutcome;
}

/**
 * An analytic puzzle rendered as multiple choice — the player must reason out the
 * answer and pick the correct option. Correct → reward; wrong → the reasoning is
 * revealed. Uses only puzzles that carry explicit choices.
 */
function buildPuzzleOutcome(level: number): CuratedOutcome | null {
  // Only multiple-choice puzzles can render as clickable options without a text box.
  let puzzle = getRandomAnalyticPuzzle({ maxDifficulty: level + 2 });
  for (let i = 0; i < 6 && !(puzzle.choices && puzzle.choices.length); i++) {
    puzzle = getRandomAnalyticPuzzle();
  }
  if (!puzzle.choices || !puzzle.choices.length) return null;

  const choices = puzzle.choices.map((c) => ({
    id: c.id,
    label: c.text,
    intentTag: 'solve' as const,
    isPuzzleSolution:
      c.id.toLowerCase() === puzzle.answer.toLowerCase() ||
      c.text.toLowerCase() === puzzle.answer.toLowerCase(),
  }));

  return {
    type: 'discovery',
    title: 'A Warded Riddle',
    reveal: puzzle.description,
    detail: puzzle.hint,
    choices,
    rewards: mapChestReward(puzzle.reward.items, puzzle.reward.gold),
    puzzleExplanation: puzzle.explanation,
  } as CuratedOutcome;
}

export function rollOutcome(params: {
  biome: string;
  dangerRating: number;
  lastOutcomeType: string | null;
  tick: number;
}): CuratedOutcome {
  const biomeKey = (Object.keys(CURATED_OUTCOMES).includes(params.biome) ? params.biome : 'grass') as BiomeKey;
  const outcomes = CURATED_OUTCOMES[biomeKey];

  // Roughly 1-in-4 explorations surfaces a structured chest / trap / analytic puzzle,
  // giving standalone wander the chests, traps, and reasoning challenges it lacked.
  const encounterLevel = 3;
  {
    const encRoll = Math.random();
    if (encRoll < 0.10) {
      const puzzle = buildPuzzleOutcome(encounterLevel);
      if (puzzle) return puzzle;
    }
    if (encRoll < 0.20) return buildChestOutcome(encounterLevel);
    if (encRoll < 0.28) return buildTrapOutcome(encounterLevel);
  }

  let pDiscovery = 0.45;
  let pQuiet = 0.25;
  let pRisk = 0.20;
  let pNothing = 0.10;

  const dangerShift = (params.dangerRating - 30) / 200;
  pRisk += dangerShift;
  pDiscovery -= dangerShift * 0.5;
  pQuiet -= dangerShift * 0.5;

  if (params.lastOutcomeType === 'none') {
    pNothing = 0;
    const redistribute = 0.10;
    pDiscovery += redistribute * 0.5;
    pQuiet += redistribute * 0.3;
    pRisk += redistribute * 0.2;
  }

  if (params.tick <= 2) {
    pRisk = Math.max(0, pRisk - 0.10);
    pDiscovery += 0.10;
  }

  const total = pDiscovery + pQuiet + pRisk + pNothing;
  pDiscovery /= total;
  pQuiet /= total;
  pRisk /= total;
  pNothing /= total;

  const roll = Math.random();
  let chosenType: 'discovery' | 'quiet' | 'risk' | 'none';

  if (roll < pDiscovery) {
    chosenType = 'discovery';
  } else if (roll < pDiscovery + pQuiet) {
    chosenType = 'quiet';
  } else if (roll < pDiscovery + pQuiet + pRisk) {
    chosenType = 'risk';
  } else {
    chosenType = 'none';
  }

  if (chosenType === 'none') {
    return { ...NOTHING_OUTCOME };
  }

  const matching = outcomes.filter(o => o.type === chosenType);
  if (matching.length === 0) {
    const fallback = outcomes.filter(o => o.type === 'discovery');
    if (fallback.length === 0) {
      return { ...NOTHING_OUTCOME };
    }
    return { ...fallback[Math.floor(Math.random() * fallback.length)] };
  }

  return { ...matching[Math.floor(Math.random() * matching.length)] };
}

export function resolveChoice(choice: {
  intentTag: string;
  outcome: CuratedOutcome;
  characterLevel: number;
  fatigue: number;
  /** Which choice the player picked — needed to grade analytic ('solve') puzzles. */
  choiceId?: string;
}): {
  narrativeResult: string;
  rewards: Array<{ kind: string; name: string; quantity: number }>;
  fatigueChange: number;
  dangerChange: number;
  markerToCreate?: { type: string; title: string; blurb: string; tags: string[] };
  combatTriggered: boolean;
  combatSeed?: any;
} {
  const { intentTag, outcome, characterLevel, fatigue, choiceId } = choice;
  let narrativeResult = '';
  let rewards: Array<{ kind: string; name: string; quantity: number }> = [];
  let fatigueChange = 0;
  let dangerChange = 0;
  let markerToCreate: { type: string; title: string; blurb: string; tags: string[] } | undefined;
  let combatTriggered = false;
  let combatSeed: any = undefined;

  switch (intentTag) {
    case 'investigate': {
      narrativeResult = outcome.detail
        ? outcome.detail
        : `You examine ${outcome.title} more closely. ${outcome.reveal}`;
      if (outcome.rewards) {
        rewards = [...outcome.rewards];
      }
      fatigueChange = 1;
      dangerChange = outcome.type === 'risk' ? 5 : -2;

      if (outcome.markerType) {
        markerToCreate = {
          type: outcome.markerType,
          title: outcome.title,
          blurb: outcome.reveal,
          tags: [outcome.type, intentTag, outcome.markerType],
        };
      }

      if (outcome.type === 'risk' && outcome.combatSeed) {
        const combatChance = 0.3 + (fatigue > 5 ? 0.15 : 0);
        if (Math.random() < combatChance) {
          combatTriggered = true;
          combatSeed = { ...outcome.combatSeed };
        }
      }
      break;
    }

    case 'engage': {
      narrativeResult = `You step forward boldly. `;
      if (outcome.type === 'discovery') {
        narrativeResult += `Your direct approach to ${outcome.title} yields immediate results. ${outcome.detail || outcome.reveal}`;
        if (outcome.rewards) {
          rewards = outcome.rewards.map(r => ({ ...r, quantity: r.quantity + (characterLevel >= 5 ? 1 : 0) }));
        }
      } else if (outcome.type === 'risk') {
        narrativeResult += `You confront the danger head-on. ${outcome.detail || outcome.reveal}`;
        if (outcome.combatSeed) {
          combatTriggered = true;
          combatSeed = { ...outcome.combatSeed };
        }
      } else {
        narrativeResult += outcome.detail || outcome.reveal;
        if (outcome.rewards) {
          rewards = [...outcome.rewards];
        }
      }
      fatigueChange = 2;
      dangerChange = outcome.type === 'risk' ? 10 : 0;

      if (outcome.markerType) {
        markerToCreate = {
          type: outcome.markerType,
          title: outcome.title,
          blurb: outcome.reveal,
          tags: [outcome.type, intentTag, outcome.markerType],
        };
      }
      break;
    }

    case 'avoid': {
      narrativeResult = `You choose caution over curiosity. ${outcome.title} fades behind you as you continue onward, leaving it undisturbed.`;
      fatigueChange = 0;
      dangerChange = -5;
      if (outcome.rewards && outcome.rewards.length > 0 && Math.random() < 0.3) {
        rewards = [outcome.rewards[0]];
        narrativeResult += ` Though you didn't linger, you managed to glean something useful in passing.`;
      }
      break;
    }

    case 'retreat': {
      narrativeResult = `Wisdom prevails over bravado. You pull back from ${outcome.title} and find a safer path forward. The memory lingers, but the danger does not follow.`;
      fatigueChange = 1;
      dangerChange = -10;
      break;
    }

    case 'camp': {
      narrativeResult = `You settle in near ${outcome.title}, resting your weary limbs. The respite restores some energy and clarity of mind.`;
      fatigueChange = -3;
      dangerChange = -5;
      if (outcome.rewards && outcome.rewards.length > 0) {
        rewards = [outcome.rewards[0]];
      }
      break;
    }

    case 'solve': {
      // Analytic puzzle: grade the chosen option. Correct → reward + reasoning; wrong → reasoning revealed.
      const picked = outcome.choices.find(c => c.id === choiceId);
      const isCorrect = !!picked?.isPuzzleSolution;
      fatigueChange = 1;
      if (isCorrect) {
        narrativeResult = `Correct. ${outcome.puzzleExplanation || ''}`.trim();
        if (outcome.rewards) rewards = [...outcome.rewards];
        dangerChange = -3;
      } else {
        narrativeResult = `That isn't it. ${outcome.puzzleExplanation || ''}`.trim();
        dangerChange = 2;
      }
      break;
    }

    default: {
      narrativeResult = outcome.detail || outcome.reveal;
      fatigueChange = 1;
      dangerChange = 0;
      break;
    }
  }

  return {
    narrativeResult,
    rewards,
    fatigueChange,
    dangerChange,
    markerToCreate,
    combatTriggered,
    combatSeed,
  };
}

export function generateWanderSummary(
  outcomes: any[],
  totalTicks: number,
  markersCreated: number
): {
  totalMoves: number;
  discoveries: number;
  combatEncounters: number;
  markersPlaced: number;
  totalRewards: any[];
  duration: string;
} {
  let discoveries = 0;
  let combatEncounters = 0;
  const allRewards: any[] = [];

  for (const outcome of outcomes) {
    if (outcome.type === 'discovery') discoveries++;
    if (outcome.combatTriggered || outcome.combatSeed) combatEncounters++;
    if (outcome.rewards) {
      for (const r of outcome.rewards) {
        const existing = allRewards.find(
          (ar: any) => ar.kind === r.kind && ar.name === r.name
        );
        if (existing) {
          existing.quantity += r.quantity;
        } else {
          allRewards.push({ ...r });
        }
      }
    }
  }

  let duration: string;
  if (totalTicks <= 5) {
    duration = 'A brief excursion';
  } else if (totalTicks <= 15) {
    duration = 'A half-day\'s wander';
  } else if (totalTicks <= 30) {
    duration = 'A full day of exploration';
  } else {
    duration = `A ${Math.ceil(totalTicks / 20)}-day expedition`;
  }

  return {
    totalMoves: totalTicks,
    discoveries,
    combatEncounters,
    markersPlaced: markersCreated,
    totalRewards: allRewards,
    duration,
  };
}
