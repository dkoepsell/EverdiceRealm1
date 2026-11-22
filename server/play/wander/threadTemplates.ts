/**
 * Authored Wander threads (wander-threads-spec.md, Feature A).
 *
 * A thread is a short chain of beats spread over several moves:
 *   sign -> trace -> approach -> climax -> payoff
 * Sign, trace and approach fire on moves toward the thread's target hex. The
 * climax fires when the player enters the target hex. Its options resolve with
 * real checks (shared/rules/checks.ts); the payoff is applied by the server.
 *
 * Text slots: {bearing} (compass direction to the target), {dist} (hexes),
 * {name} (the thread's rolled name, e.g. a warren's).
 */
import type { WanderBiome } from "@shared/wander/terrain";

export interface BeatText {
  title: string;
  reveal: string;
  /** Shown when the player studies the signs and succeeds. */
  detail: string;
}

export interface ClimaxOption {
  id: string;
  label: string;
  /** Skill for the check; omitted for a straight fight. */
  skill?: string;
  dc?: number;
  success: string;
  failure?: string;
  /** A fight: always reaches the payoff, but costs a level of exhaustion. */
  fight?: boolean;
}

export type Payoff =
  | { kind: "delve"; dungeonName: string; themeTags: string[]; text: string }
  | { kind: "npc"; npc: { name: string; role: string; want: string }; rewards: Reward[]; food?: number; water?: number; text: string }
  | { kind: "cache"; rewards: Reward[]; food?: number; water?: number; text: string };

export interface Reward {
  kind: "knowledge" | "consumable" | "trinket" | "key_fragment" | "faction_token";
  name: string;
  quantity: number;
}

export interface ThreadTemplate {
  id: string;
  name: string;
  biomes: WanderBiome[];
  markerType: "trace" | "landmark" | "opportunity" | "npc_echo";
  /** Skill used to read the signs at sign / trace / approach beats. */
  trackSkill: string;
  sign: BeatText;
  trace: BeatText;
  approach: BeatText;
  climax: { title: string; reveal: string; options: ClimaxOption[] };
  combatSeed: { encounterType: "ambush" | "pursuit" | "lair_scout"; enemyTheme: string; difficulty: "easy" | "medium" | "hard"; battlefieldTag: string; stakes: string; fleeAllowed: boolean };
  payoff: Payoff;
  /** What a Tavern regular says. */
  rumor: { source: string; text: string };
  /** When a rumor about this turns out false. */
  debunk: { title: string; reveal: string };
  /** Posted to the campaign's rumor pool when the thread is resolved. */
  completionRumor: string;
  names?: string[];
  /** Personal trails (backstory): the PHB backgrounds this is for ("*" = any). */
  personal?: string[];
  /** What happens if the trail is ignored for deadlineDays in-game days (a DMG-style doom clock). */
  consequence?: string;
  deadlineDays?: number;
}

export const THREAD_TEMPLATES: ThreadTemplate[] = [
  {
    id: "goblin_raiders",
    name: "Goblin raiders",
    biomes: ["forest", "grass", "mountain"],
    markerType: "trace",
    trackSkill: "survival",
    names: ["Bonegnaw", "Rotfang", "Mudskull", "Gristlemaw"],
    sign: {
      title: "Small Boots, Many of Them",
      reveal: "The grass is trampled flat in a wide path. A broken arrow lies in the mud, fletched with crow feathers and bound with sinew. Goblin work. The trail runs {bearing}.",
      detail: "Eight or nine of them, moving fast and carrying something heavy between them. The prints are a day old at most. Their camp can't be more than {dist} hexes {bearing}.",
    },
    trace: {
      title: "A Plundered Wagon",
      reveal: "A merchant's wagon lies on its side, crates smashed, the mule gone. Crude marks are daubed on the canvas in red. The raiders went {bearing}.",
      detail: "The daubed sign is a fanged skull: the mark of the {name} clan. Whatever they took, they dragged it {bearing}, about {dist} hexes off.",
    },
    approach: {
      title: "Drums at Dusk",
      reveal: "A low, uneven drumming carries on the wind, and there is smoke rising {bearing}. You are close.",
      detail: "You count the beats: a war drum, not a feast. Sentries, then. The smoke is {dist} hex{plural} {bearing}.",
    },
    climax: {
      title: "The {name} Warren",
      reveal: "A cave mouth gapes in a bank of earth, ringed with stakes and bones. Two goblin sentries squat by a smoky fire, arguing over a stolen ham.",
      options: [
        { id: "sneak", label: "Creep past the sentries into the warren", skill: "stealth", dc: 13, success: "You slip between the shadows while the sentries bicker. The tunnel mouth swallows you. The warren lies open below.", failure: "A loose stone skitters under your boot. A sentry yelps and blows a horn. You fall back before the warren empties out." },
        { id: "fight", label: "Rush the sentries", fight: true, success: "It is short and ugly. The sentries go down, but not before one opens a gash along your arm. The way into the warren is clear." },
        { id: "bluff", label: "Bellow that the chief sent you for the ham", skill: "deception", dc: 15, success: "The sentries exchange a look, hand over the ham, and wave you in. Goblins.", failure: "One sentry squints. 'Chief's dead,' it says, and reaches for its spear. You back off fast." },
      ],
    },
    combatSeed: { encounterType: "lair_scout", enemyTheme: "goblin", difficulty: "medium", battlefieldTag: "cave_mouth", stakes: "the way into the warren", fleeAllowed: true },
    payoff: { kind: "delve", dungeonName: "The {name} Warren", themeTags: ["goblin", "wander-found"], text: "The {name} Warren is open to you. You can delve it from the Delve page whenever you are ready." },
    rumor: { source: "A teamster with a bandaged hand", text: "Goblins hit my wagon on the road out of town. Took the lot and went off {bearing}. Can't be more than a day or two's walk." },
    debunk: { title: "Not Goblins After All", reveal: "The 'raiders' were a family of badgers and a very large, very angry goose. There is nothing here but a torn sack of oats." },
    completionRumor: "They say someone found the {name} goblin warren {bearing} of town, and the roads have been quieter since.",
    consequence: "The {name} goblins raided the farms {bearing} of town while no one stopped them. Two families lost everything.",
    deadlineDays: 6,
  },
  {
    id: "lost_caravan",
    name: "The lost caravan",
    biomes: ["desert", "grass"],
    markerType: "npc_echo",
    trackSkill: "survival",
    sign: {
      title: "Wheel Ruts in the Dust",
      reveal: "Deep ruts cut across the ground, heavy wagons, several of them, and they wander as if the drivers had lost the road. They lead {bearing}.",
      detail: "The ruts zigzag: the caravan was lost, not travelling. A dropped water cask, empty. They were running dry, about {dist} hexes {bearing}.",
    },
    trace: {
      title: "An Abandoned Wagon",
      reveal: "A wagon stands alone, a wheel cracked. The team was cut loose. Footprints head {bearing}, dragging.",
      detail: "Under the seat, a ledger: the Hessa Company, six wagons, out of Westmarch. The last entry reads 'water for two days'. That was a week ago. They went {bearing}.",
    },
    approach: {
      title: "A Signal Mirror",
      reveal: "A flash of light, then another, from {bearing}. Someone is signalling with a mirror.",
      detail: "Three short, three long, three short. A distress call. {dist} hex{plural} {bearing}.",
    },
    climax: {
      title: "The Hessa Company",
      reveal: "Five wagons drawn into a circle. Thin faces peer out at you. A woman with a scarred chin steps forward, a crossbow held low. 'If you're here to rob us, there's nothing left to take.'",
      options: [
        { id: "parley", label: "Show empty hands and offer help", skill: "persuasion", dc: 12, success: "Hessa lowers the crossbow. You share what you know of the land and point them toward water. She presses a token into your hand: 'The Company remembers its friends.'", failure: "She doesn't trust you, and you can't blame her. 'Walk on,' she says. Maybe if you come back with something to show good faith." },
        { id: "lead", label: "Read the land and lead them to water", skill: "survival", dc: 14, success: "You find a dry wash that leads to a seep. The caravan drinks. Hessa clasps your arm: 'Westmarch will hear of this.'", failure: "You lead them in a wide circle. Tempers fray. Hessa calls a halt and sends you off." },
      ],
    },
    combatSeed: { encounterType: "ambush", enemyTheme: "bandit", difficulty: "easy", battlefieldTag: "wagon_circle", stakes: "the caravan's trust", fleeAllowed: true },
    payoff: { kind: "npc", npc: { name: "Hessa", role: "caravan master of the Hessa Company", want: "to get her people home to Westmarch" }, rewards: [{ kind: "faction_token", name: "Hessa Company Token", quantity: 1 }], food: 3, text: "Hessa will remember this. The Company shares its food with you before you part." },
    rumor: { source: "A worried clerk from the trading house", text: "The Hessa caravan never arrived. Six wagons. Last seen heading out {bearing}. The house will pay to know what happened." },
    debunk: { title: "The Caravan Came Through", reveal: "Fresh ruts, a campfire, a note pinned to a post: 'Hessa Co. passed safe, all accounted for.' The rumor was stale." },
    completionRumor: "Hessa's caravan made it home. She tells anyone who'll listen about the stranger who found them {bearing} of town.",
    consequence: "The Hessa caravan never made it home. Their wagons were found picked clean {bearing} of town.",
    deadlineDays: 5,
  },
  {
    id: "drowned_shrine",
    name: "The drowned shrine",
    biomes: ["swamp", "coast"],
    markerType: "landmark",
    trackSkill: "religion",
    sign: {
      title: "A Bell Under the Water",
      reveal: "A low, slow chime, coming from the water itself. It seems to come from {bearing}.",
      detail: "The note is a funeral bell, the kind the old river temples rang. A shrine sank here generations ago, somewhere {bearing}, about {dist} hexes off.",
    },
    trace: {
      title: "Offerings on the Bank",
      reveal: "Someone has left fresh offerings on a flat stone: river pearls, a candle stub, a doll of woven reeds. Wet footprints lead {bearing}.",
      detail: "These are offerings to a drowned saint. Someone still tends the shrine. The prints head {bearing}, {dist} hexes.",
    },
    approach: {
      title: "Lights on the Water",
      reveal: "Pale lights hang over the water {bearing}, unmoving despite the wind.",
      detail: "Not marsh gas: they are too steady. Wards. Something holy, or something bound. {dist} hex{plural} {bearing}.",
    },
    climax: {
      title: "The Shrine of the Drowned Saint",
      reveal: "A stone roof breaks the surface of a black pool. Steps lead down into the water, and the bell tolls beneath your feet.",
      options: [
        { id: "rite", label: "Speak the old funeral rite", skill: "religion", dc: 13, success: "Your voice carries over the water and the bell falls silent. In the hush, something surfaces: a silver reliquary, offered up.", failure: "You stumble over the words. The lights flicker angrily and the water churns. You retreat to the bank." },
        { id: "dive", label: "Dive for whatever lies below", skill: "athletics", dc: 14, success: "Cold, dark, and then your hand closes on metal. You surface with a silver reliquary, gasping.", failure: "The cold drives the air from your lungs. You claw back to the surface empty-handed." },
        { id: "wards", label: "Study the warding lights", skill: "arcana", dc: 15, success: "The wards are a lock, not a curse. You trace the pattern and the water parts around the stair. The reliquary waits on the altar.", failure: "The pattern makes no sense, and staring at it makes your eyes ache." },
      ],
    },
    combatSeed: { encounterType: "lair_scout", enemyTheme: "undead", difficulty: "medium", battlefieldTag: "flooded_shrine", stakes: "the reliquary", fleeAllowed: true },
    payoff: { kind: "cache", rewards: [{ kind: "trinket", name: "Silver Reliquary of the Drowned Saint", quantity: 1 }, { kind: "knowledge", name: "The Drowned Saint's Rite", quantity: 1 }], text: "The reliquary is cold to the touch and hums faintly. A temple would pay well for it, or keep it for yourself." },
    rumor: { source: "A fisherman mending nets", text: "My nets keep coming up with candle wax in them. There's a bell out there in the water, {bearing}. My grandmother said it rang for the drowned saint." },
    debunk: { title: "Just a Bell Buoy", reveal: "A rusted bell on a rotting float, knocking in the current. No shrine, no saint." },
    completionRumor: "Someone brought up the drowned saint's reliquary from the water {bearing} of town. The fishermen say the bell has stopped.",
    consequence: "The drowned bell {bearing} of town has fallen silent. The fishermen say something took the reliquary from below.",
    deadlineDays: 8,
  },
  {
    id: "wolf_pack",
    name: "The grey pack",
    biomes: ["forest", "mountain", "grass"],
    markerType: "trace",
    trackSkill: "nature",
    sign: {
      title: "A Kill in the Snowmelt",
      reveal: "A deer carcass, torn and half eaten. Big paw prints circle it. They lead {bearing}.",
      detail: "Wolves, five at least, and one much larger than the rest. They hunt from a den {bearing}, maybe {dist} hexes off.",
    },
    trace: {
      title: "Scratched Bark",
      reveal: "Deep claw marks score a tree trunk at head height. Fur is caught in the bark: grey, coarse, a hand long. The trail goes {bearing}.",
      detail: "That height means the big one is no ordinary wolf. A dire wolf leads this pack. The den is {dist} hexes {bearing}.",
    },
    approach: {
      title: "Howling",
      reveal: "A long howl rises {bearing}, answered by others. They know you are here.",
      detail: "The howls are spaced to herd, not to warn. They are testing you. {dist} hex{plural} {bearing}.",
    },
    climax: {
      title: "The Dire Wolf's Den",
      reveal: "A tumble of boulders, and in their shadow, yellow eyes. The dire wolf rises, hackles up. Behind it, pups tumble in the dirt.",
      options: [
        { id: "calm", label: "Hold still, avert your eyes, and back away from the pups", skill: "animal_handling", dc: 13, success: "The great wolf watches you for a long moment, then lies down. It is protecting its young, not hunting you. On your way out you find what the pack left of an earlier traveller: a pack, still full.", failure: "The wolf lunges. You scramble back over the rocks, heart pounding, and leave the den behind." },
        { id: "fight", label: "Stand your ground and fight", fight: true, success: "A brutal, close fight in the rocks. When it is over the pack has scattered, and you are bleeding, but alive. Among the bones you find a lost traveller's pack." },
      ],
    },
    combatSeed: { encounterType: "lair_scout", enemyTheme: "beast", difficulty: "hard", battlefieldTag: "rocky_den", stakes: "the den", fleeAllowed: true },
    payoff: { kind: "cache", rewards: [{ kind: "consumable", name: "Potion of Healing", quantity: 1 }, { kind: "trinket", name: "Traveller's Silver Compass", quantity: 1 }], food: 2, water: 1, text: "The lost traveller's pack holds rations, a full waterskin, a healing potion, and a fine silver compass." },
    rumor: { source: "A shepherd counting his flock twice", text: "Something's taking my sheep. Not a common wolf. Prints as big as my hand, coming from the hills {bearing}." },
    debunk: { title: "An Old Den", reveal: "The den is long abandoned: old bones, cold scat. Whatever lived here moved on seasons ago." },
    completionRumor: "The shepherds say the grey pack {bearing} of town has stopped taking sheep. Someone went to the den and came back.",
    consequence: "The grey pack took a shepherd's whole flock {bearing} of town, and the shepherd with it.",
    deadlineDays: 6,
  },
  {
    id: "hermits_lantern",
    name: "The hermit's lantern",
    biomes: ["mountain", "forest"],
    markerType: "npc_echo",
    trackSkill: "perception",
    sign: {
      title: "A Light on the Heights",
      reveal: "At dusk, a single lantern glows high on the slopes {bearing}. It goes out as you watch.",
      detail: "Someone lives up there, and doesn't want to be found. A narrow goat path climbs {bearing}, about {dist} hexes.",
    },
    trace: {
      title: "Cairns and Charms",
      reveal: "Small stone cairns mark the path, each topped with a twist of dried herbs. They lead {bearing}.",
      detail: "Sage, rue, and juniper: warding herbs. Whoever lives here fears something. {dist} hexes {bearing}.",
    },
    approach: {
      title: "The Smell of Woodsmoke",
      reveal: "Woodsmoke and boiling herbs on the wind. A goat bleats somewhere {bearing}.",
      detail: "A hut, close. You hear an old man talking to his goat, about the weather and about you. {dist} hex{plural} {bearing}.",
    },
    climax: {
      title: "Old Brannoc's Hut",
      reveal: "A crooked hut clings to the rock. An old man in a patched robe blocks the doorway with a staff. 'I don't take visitors. Last one tried to steal my goat.'",
      options: [
        { id: "talk", label: "Talk him round", skill: "persuasion", dc: 13, success: "Brannoc grumbles, then lets you in for tea that tastes of pine. He talks for an hour about the land, the weather, and the things that walk the high passes. You leave knowing far more than you came with.", failure: "'No,' says Brannoc, and shuts the door. The goat looks at you with something like pity." },
        { id: "goat", label: "Notice the goat is limping and offer to help", skill: "medicine", dc: 11, success: "A thorn deep in the hoof. You ease it out and Brannoc watches, suspicious, then softens. 'Well. Come in, then.'", failure: "The goat kicks you squarely in the shin. Brannoc laughs so hard he has to sit down, but he doesn't invite you in." },
      ],
    },
    combatSeed: { encounterType: "ambush", enemyTheme: "beast", difficulty: "easy", battlefieldTag: "mountain_hut", stakes: "the hermit's trust", fleeAllowed: true },
    payoff: { kind: "npc", npc: { name: "Old Brannoc", role: "hermit of the high slopes", want: "to be left alone, mostly" }, rewards: [{ kind: "knowledge", name: "Brannoc's Map of the High Passes", quantity: 1 }], water: 2, text: "Brannoc fills your waterskins from his spring and sketches you a map of the passes. He'll be there if you come back." },
    rumor: { source: "A goatherd with a wild beard", text: "There's an old hermit up the slopes {bearing}. Knows every path in the hills, they say, if you can get him to talk." },
    debunk: { title: "An Empty Hut", reveal: "A collapsed hut, long empty, a goat skull nailed over the door. Whoever lived here is gone." },
    completionRumor: "Old Brannoc the hermit, {bearing} of town, has been seen talking to a traveller. Wonders never cease.",
    consequence: "Old Brannoc's lantern {bearing} of town has gone dark. No one knows if he moved on or worse.",
    deadlineDays: 10,
  },
  {
    id: "ruined_watchtower",
    name: "The watchtower crypt",
    biomes: ["grass", "mountain", "forest"],
    markerType: "landmark",
    trackSkill: "history",
    names: ["Greyward", "Ashhold", "Cinder Keep", "Raven's Rest"],
    sign: {
      title: "A Broken Boundary Stone",
      reveal: "A carved stone lies cracked in the grass, an old kingdom's crest worn almost smooth. An arrow is cut into it, pointing {bearing}.",
      detail: "The crest is that of the old border wardens. They built a watchtower, {name}, and buried their dead beneath it. {dist} hexes {bearing}.",
    },
    trace: {
      title: "Bones in the Road",
      reveal: "Bones scattered across the old road, too neat to be a kill. They lie in a line, pointing {bearing}.",
      detail: "Laid out deliberately. Someone, or something, wants travellers to follow. {dist} hexes {bearing}.",
    },
    approach: {
      title: "The Tower on the Skyline",
      reveal: "A broken tower stands against the sky {bearing}. Crows circle it but do not land.",
      detail: "Crows won't land on hallowed ground gone bad. The tower is {dist} hex{plural} {bearing}.",
    },
    climax: {
      title: "{name} Tower",
      reveal: "The tower's door hangs off one hinge. Inside, stairs lead down into cold dark, and the air smells of old stone and older death.",
      options: [
        { id: "history", label: "Read the wardens' inscriptions before entering", skill: "history", dc: 13, success: "The inscriptions name the dead and warn of what they guard. Forewarned, you find the crypt stair and mark the safe path down.", failure: "The script is too worn. You go in blind, and something below stirs at your footsteps. You retreat for now." },
        { id: "search", label: "Search the tower for the crypt stair", skill: "investigation", dc: 12, success: "Behind a fallen tapestry, a stair spirals down. Cold air breathes up from below. The crypt is open to you.", failure: "You search the tower top to bottom and find nothing but rubble and crow feathers." },
        { id: "fight", label: "Kick in the inner door", fight: true, success: "The door gives, and so does the thing behind it: a skeletal warden that takes a piece out of you before it falls. Below, the crypt waits." },
      ],
    },
    combatSeed: { encounterType: "lair_scout", enemyTheme: "undead", difficulty: "medium", battlefieldTag: "ruined_tower", stakes: "the crypt beneath", fleeAllowed: true },
    payoff: { kind: "delve", dungeonName: "The Crypt Beneath {name}", themeTags: ["undead", "wander-found"], text: "The Crypt Beneath {name} is open. You can delve it from the Delve page whenever you are ready." },
    rumor: { source: "An old soldier nursing an ale", text: "My grandfather served at the old watchtower {bearing} of here. Said the wardens never really left it." },
    debunk: { title: "A Shepherd's Folly", reveal: "The 'tower' is a stack of stones a bored shepherd built to see his flock. There is no crypt, only sheep." },
    completionRumor: "Someone has opened the crypt under the old watchtower {bearing} of town. The crows are back on the roof.",
    consequence: "Something climbed out of the crypt under the old watchtower {bearing} of town. Crows circle the road now.",
    deadlineDays: 7,
  },
  {
    id: "bandit_toll",
    name: "The bandit toll",
    biomes: ["grass", "forest", "coast"],
    markerType: "trace",
    trackSkill: "investigation",
    sign: {
      title: "A Toll Notice",
      reveal: "A board nailed to a post: 'ROAD TOLL. PAY CAPTAIN VASK.' Someone has scrawled 'THIEF' under it. Hoofprints lead {bearing}.",
      detail: "No lord's seal on it. A bandit's toll, collected by riders. Their camp is {dist} hexes {bearing}.",
    },
    trace: {
      title: "A Robbed Peddler",
      reveal: "A peddler sits by the road, purse slashed, counting what little the bandits left. 'Vask's riders,' he spits. 'They went {bearing}.'",
      detail: "He describes Vask: a former soldier, missing two fingers, who never harms those who pay. Just everyone who doesn't. {dist} hexes {bearing}.",
    },
    approach: {
      title: "A Lookout",
      reveal: "A glint of metal on a rise {bearing}. A lookout, watching the road.",
      detail: "One lookout, half asleep. The camp must be just beyond. {dist} hex{plural} {bearing}.",
    },
    climax: {
      title: "Captain Vask's Camp",
      reveal: "A dozen tents around a fire. A lean man with a mangled hand looks up from a ledger. 'Toll's five silver,' says Captain Vask. 'Or you can try your luck.'",
      options: [
        { id: "cow", label: "Tell him the warden's riders are coming", skill: "intimidation", dc: 14, success: "Vask studies you, then snaps the ledger shut. By nightfall the camp is struck and the road is free. He leaves you a nod, and the strongbox they couldn't carry.", failure: "Vask laughs. 'The warden hasn't left his hall in a year.' His riders close in and you back away." },
        { id: "steal", label: "Slip into camp after dark and take the strongbox", skill: "stealth", dc: 14, success: "Past the drunken guards, under the captain's own cot, and out with the strongbox before dawn.", failure: "A dog barks. Torches flare. You run, empty-handed." },
        { id: "fight", label: "Call him out", fight: true, success: "Vask fights like the soldier he was, and you come away bruised and bloody. His riders scatter, leaving the strongbox behind." },
      ],
    },
    combatSeed: { encounterType: "ambush", enemyTheme: "bandit", difficulty: "medium", battlefieldTag: "bandit_camp", stakes: "the road and the strongbox", fleeAllowed: true },
    payoff: { kind: "npc", npc: { name: "Captain Vask", role: "bandit captain who ran the road toll", want: "an easy living and no trouble from wardens" }, rewards: [{ kind: "consumable", name: "Bandit Strongbox (gold)", quantity: 1 }], text: "The toll is broken. Vask is gone, but you have the feeling you'll cross paths again." },
    rumor: { source: "A merchant counting coins twice", text: "Captain Vask's riders are taxing the road {bearing} of town. Five silver a head, or worse." },
    debunk: { title: "A Real Toll Gate", reveal: "A proper toll house with the baron's banner and a bored clerk. Legitimate, if annoying." },
    completionRumor: "The road {bearing} of town is toll-free again. They say Captain Vask was run off by a lone traveller.",
    consequence: "Captain Vask's riders robbed the mail coach {bearing} of town. The road toll has doubled.",
    deadlineDays: 5,
  },
  {
    id: "fallen_star",
    name: "The fallen star",
    biomes: ["desert", "mountain", "grass"],
    markerType: "opportunity",
    trackSkill: "arcana",
    sign: {
      title: "Glass in the Grass",
      reveal: "A patch of ground fused to green glass, and a scorched furrow running {bearing}.",
      detail: "Heat like this comes from the sky. Something fell, burning, and skidded {bearing}. About {dist} hexes.",
    },
    trace: {
      title: "Dead Birds",
      reveal: "A circle of dead birds, unmarked, around a blackened rock. The air tastes of metal. The furrow continues {bearing}.",
      detail: "Raw magic, leaking. The fallen thing is still potent, {dist} hexes {bearing}. Best not to linger near it too long.",
    },
    approach: {
      title: "A Glow Beneath the Horizon",
      reveal: "A faint violet glow rises {bearing}, visible even in daylight.",
      detail: "The glow pulses like a slow heartbeat. {dist} hex{plural} {bearing}.",
    },
    climax: {
      title: "The Star-Stone",
      reveal: "At the end of the furrow, in a smoking crater, lies a stone the size of a fist, glowing violet and humming.",
      options: [
        { id: "arcana", label: "Work out how to handle it safely", skill: "arcana", dc: 14, success: "It is skyiron, shedding raw arcane energy. You wrap it in leather and earth to ground it, and it quiets in your hands.", failure: "You reach for it and a jolt throws you back. Your fingers go numb. Better not try again until you understand it." },
        { id: "grab", label: "Wrap your hand and grab it", skill: "constitution", dc: 13, success: "It burns, even through the leather, but you hold on until it cools. The star-stone is yours.", failure: "The heat is too much. You drop it, swearing, and nurse your hand." },
      ],
    },
    combatSeed: { encounterType: "lair_scout", enemyTheme: "elemental", difficulty: "medium", battlefieldTag: "impact_crater", stakes: "the star-stone", fleeAllowed: true },
    payoff: { kind: "cache", rewards: [{ kind: "trinket", name: "Star-Stone (skyiron)", quantity: 1 }, { kind: "knowledge", name: "Notes on Raw Arcana", quantity: 1 }], text: "A smith or a wizard would give a great deal for skyiron. Or you could keep it." },
    rumor: { source: "A stargazing apprentice", text: "Three nights ago a star fell, {bearing} of here. My master says skyiron is worth more than gold." },
    debunk: { title: "A Lightning Strike", reveal: "A tree split by lightning, still smouldering. No star, no skyiron." },
    completionRumor: "Somebody found the fallen star {bearing} of town. The apprentices at the tower are furious they weren't first.",
    consequence: "Apprentices from the tower found the fallen star {bearing} of town first. The skyiron is theirs now.",
    deadlineDays: 5,
  },
];

export function getTemplate(id: string): ThreadTemplate | undefined {
  return THREAD_TEMPLATES.find((t) => t.id === id) ?? PERSONAL_TEMPLATES.find((t) => t.id === id);
}

// ── Personal trails (engagement 2: backstory) ────────────────────────────────
//
// One per character per campaign, chosen by PHB background, started on their
// first real wander. They pay off with Inspiration (PHB: the DM awards it for
// playing your character's bonds and history) as well as the usual reward.

const ALL_BIOMES: WanderBiome[] = ["grass", "forest", "mountain", "swamp", "desert", "coast"];

export const PERSONAL_TEMPLATES: ThreadTemplate[] = [
  {
    id: "personal_soldier", name: "Your old company", biomes: ALL_BIOMES, markerType: "trace", trackSkill: "history",
    personal: ["soldier", "mercenary veteran"],
    sign: { title: "A Familiar Badge", reveal: "Half-buried in the mud, a tin badge stamped with your old company's crest. Your company. It points the way the dead were dragged: {bearing}.", detail: "You know this stamp. Only your old company wore it. There was a battle near here, {dist} hexes {bearing}, and nobody told you." },
    trace: { title: "Graves Without Names", reveal: "A row of shallow graves, marked with spears. Someone buried soldiers here in a hurry. Bootprints lead {bearing}.", detail: "One spear has a notch you'd recognise anywhere: your sergeant's. Someone survived to bury the others. {dist} hexes {bearing}." },
    approach: { title: "A Campfire and a Song", reveal: "A marching song you haven't heard in years, sung badly, drifts on the wind from {bearing}.", detail: "Only your company sang it with that wrong last verse. {dist} hex{plural} {bearing}." },
    climax: { title: "The Last of the Company", reveal: "A grey-bearded veteran with one arm sits by a fire, guarding a battered regimental banner. He looks up, and his face changes. 'They said you were dead too.'",
      options: [
        { id: "remember", label: "Tell him what happened to you after the battle", skill: "persuasion", dc: 10, success: "You talk until the fire burns low, of names and of the day it all went wrong. He presses the banner into your hands. 'Somebody should carry it who remembers.'", failure: "The words won't come. He nods anyway, but the moment passes." },
        { id: "drill", label: "Call the old drill, the way the sergeant did", skill: "intimidation", dc: 12, success: "He's on his feet before he knows it, saluting, laughing and crying at once. Then he hands you the banner.", failure: "Your voice cracks halfway. He looks away, embarrassed for you both." },
      ] },
    combatSeed: { encounterType: "ambush", enemyTheme: "bandit", difficulty: "easy", battlefieldTag: "old_battlefield", stakes: "the banner", fleeAllowed: true },
    payoff: { kind: "npc", npc: { name: "Old Corporal Hennick", role: "last survivor of your old company", want: "to see the company's banner carried with honour" }, rewards: [{ kind: "trinket", name: "Your Company's Banner", quantity: 1 }], text: "Hennick will remember you. You carry the banner now, and with it, something you'd lost." },
    rumor: { source: "", text: "" }, debunk: { title: "", reveal: "" },
    completionRumor: "They say a veteran of a lost company was found {bearing} of town, and the banner has a new bearer.",
  },
  {
    id: "personal_acolyte", name: "The lost reliquary", biomes: ALL_BIOMES, markerType: "landmark", trackSkill: "religion",
    personal: ["acolyte"],
    sign: { title: "Your Temple's Sign", reveal: "Scratched on a waystone, the sigil of your own temple, and an arrow: {bearing}. Pilgrims' marks, but old.", detail: "This is the pilgrim route the elders spoke of, to the shrine where the reliquary was lost. {dist} hexes {bearing}." },
    trace: { title: "A Pilgrim's Prayer Beads", reveal: "A broken string of prayer beads, the kind your temple gives at ordination. They lead {bearing}.", detail: "The last bead is carved with a name from the temple's book of the missing. {dist} hexes {bearing}." },
    approach: { title: "A Bell You Know", reveal: "The temple's call to prayer, rung on a cracked bell, somewhere {bearing}.", detail: "No one should be ringing that call out here. {dist} hex{plural} {bearing}." },
    climax: { title: "The Forgotten Shrine", reveal: "A tiny shrine in a hollow, tended by a gaunt hermit-priest who has kept the reliquary safe for twenty years, waiting for someone from the temple.",
      options: [
        { id: "rite", label: "Speak the temple's rite of greeting", skill: "religion", dc: 11, success: "He weeps, and completes the rite with you. The reliquary is yours to bring home.", failure: "You stumble over a line. He is patient, but you can see the doubt in his eyes." },
        { id: "insight", label: "Read what he needs to hear", skill: "insight", dc: 12, success: "He doesn't need proof; he needs to be released from his vigil. You give him that, and he gives you the reliquary.", failure: "You misjudge him, and he closes up." },
      ] },
    combatSeed: { encounterType: "lair_scout", enemyTheme: "undead", difficulty: "easy", battlefieldTag: "shrine", stakes: "the reliquary", fleeAllowed: true },
    payoff: { kind: "npc", npc: { name: "Brother Anselm", role: "hermit-priest who kept your temple's reliquary", want: "to know his vigil meant something" }, rewards: [{ kind: "trinket", name: "Your Temple's Reliquary", quantity: 1 }], text: "Your temple will sing about this. Brother Anselm blesses you as you go." },
    rumor: { source: "", text: "" }, debunk: { title: "", reveal: "" },
    completionRumor: "Word is a lost reliquary was found at a hidden shrine {bearing} of town.",
  },
  {
    id: "personal_criminal", name: "The one who sold you out", biomes: ALL_BIOMES, markerType: "trace", trackSkill: "investigation",
    personal: ["criminal", "spy", "charlatan"],
    sign: { title: "Your Old Mark", reveal: "Chalked on a milestone: the thieves' cant sign your old crew used. Fresh. It points {bearing}.", detail: "Only one other person still knows that sign: the partner who sold you to the watch. They're out here, {dist} hexes {bearing}." },
    trace: { title: "A Fence's Ledger Page", reveal: "A torn page of a fence's ledger, blowing in the grass. Your old partner's handwriting. The tracks go {bearing}.", detail: "They're running too. Someone is after them now. {dist} hexes {bearing}." },
    approach: { title: "A Familiar Whistle", reveal: "Your crew's old signal whistle, two notes, from {bearing}.", detail: "They think you're one of the people hunting them. {dist} hex{plural} {bearing}." },
    climax: { title: "Face to Face", reveal: "Your old partner, thinner and scared, a knife held low. 'I had no choice. They had my sister.' Behind them, the stolen take they never got to spend.",
      options: [
        { id: "truth", label: "Find out if it's true", skill: "insight", dc: 12, success: "It's true. You split the take, and they owe you a favour now, the kind that matters.", failure: "You can't tell. They bolt while you hesitate, leaving half the take behind." },
        { id: "lean", label: "Lean on them until they pay what they owe", skill: "intimidation", dc: 13, success: "They hand over everything and swear to set it right with the old crew.", failure: "They see through you; they always could. They run." },
      ] },
    combatSeed: { encounterType: "ambush", enemyTheme: "bandit", difficulty: "easy", battlefieldTag: "hideout", stakes: "the take", fleeAllowed: true },
    payoff: { kind: "npc", npc: { name: "Your old partner", role: "the partner who sold you out, years ago", want: "to make things right, or at least survive" }, rewards: [{ kind: "consumable", name: "Old Crew's Take (gold)", quantity: 1 }], text: "An old debt is settled, one way or another. Your past is a little lighter." },
    rumor: { source: "", text: "" }, debunk: { title: "", reveal: "" },
    completionRumor: "Someone settled an old score with a runaway thief {bearing} of town.",
  },
  {
    id: "personal_folk_hero", name: "The tyrant's collectors", biomes: ["grass", "forest", "coast", "swamp"], markerType: "trace", trackSkill: "survival",
    personal: ["folk hero", "farmer"],
    sign: { title: "Trampled Crops", reveal: "A field ridden flat, a farmer's cart overturned. The same thing that happened to your village. Hoofprints lead {bearing}.", detail: "Tax collectors with too many swords, the kind you stood up to once before. {dist} hexes {bearing}." },
    trace: { title: "A Village Holding Its Breath", reveal: "The villagers hide when they see you coming, then recognise something in how you carry yourself. 'They took the seed grain. They went {bearing}.'", detail: "Without the seed grain, there's no harvest next year. {dist} hexes {bearing}." },
    approach: { title: "Wagons in a Row", reveal: "Loaded wagons drawn up {bearing}, guarded by bored men in borrowed livery.", detail: "A dozen of them. {dist} hex{plural} {bearing}." },
    climax: { title: "The Collectors' Camp", reveal: "The seed grain is stacked in sacks by the wagons. The collectors are drinking. Their captain has a bad leg and a worse temper.",
      options: [
        { id: "rally", label: "Bring the villagers, and stand in the road together", skill: "persuasion", dc: 13, success: "Forty farmers with pitchforks and you at the front. The collectors decide the grain isn't worth it.", failure: "The villagers are too afraid to come. Not yet." },
        { id: "steal", label: "Slip in at night and drive off the grain wagon", skill: "stealth", dc: 13, success: "By dawn the wagon is back in the village square, and nobody can say how it got there.", failure: "A guard wakes. You get out, but not with the grain." },
      ] },
    combatSeed: { encounterType: "ambush", enemyTheme: "bandit", difficulty: "medium", battlefieldTag: "camp", stakes: "the seed grain", fleeAllowed: true },
    payoff: { kind: "npc", npc: { name: "Marta Greenhill", role: "headwoman of the village you saved", want: "a harvest, and to never see those collectors again" }, rewards: [{ kind: "faction_token", name: "Greenhill's Thanks", quantity: 1 }], food: 4, text: "The village feeds you like family. Folk heroes are made this way, one village at a time." },
    rumor: { source: "", text: "" }, debunk: { title: "", reveal: "" },
    completionRumor: "A village {bearing} of town kept its seed grain, thanks to a stranger who stood in the road.",
  },
  {
    id: "personal_sage", name: "The missing scholar", biomes: ALL_BIOMES, markerType: "landmark", trackSkill: "investigation",
    personal: ["sage", "cloistered scholar"],
    sign: { title: "Your Teacher's Handwriting", reveal: "A page of field notes pinned under a stone, in the cramped hand of the teacher who vanished. An arrow, {bearing}.", detail: "Your teacher was close to something. The notes give a measured distance: {dist} hexes {bearing}." },
    trace: { title: "A Cipher in Chalk", reveal: "A cipher chalked on a rock, the one your teacher used for private notes. It reads: 'follow the stars {bearing}'.", detail: "Decoded, it's a warning: the thing they found is dangerous. {dist} hexes {bearing}." },
    approach: { title: "Lamplight in the Ruins", reveal: "A lamp burning in a ruin {bearing}. Someone is reading by it.", detail: "{dist} hex{plural} {bearing}." },
    climax: { title: "Your Teacher's Last Camp", reveal: "Your teacher, older and half-mad with excitement, surrounded by rubbings of an ancient inscription. 'You came! Help me with the last line.'",
      options: [
        { id: "translate", label: "Work through the inscription together", skill: "history", dc: 13, success: "The last line falls into place. It names a place no map has shown in a thousand years. Your teacher gives you the notes: 'Finish it.'", failure: "The line won't come. You'll need more time, and more light." },
        { id: "arcana", label: "Recognise what the inscription is warning about", skill: "arcana", dc: 14, success: "It's a ward, not a map, and your teacher was about to break it. You stop them in time. They hand you the notes, shaking.", failure: "You can tell it matters, but not why." },
      ] },
    combatSeed: { encounterType: "lair_scout", enemyTheme: "elemental", difficulty: "easy", battlefieldTag: "ruin", stakes: "the inscription", fleeAllowed: true },
    payoff: { kind: "npc", npc: { name: "Master Orlin", role: "your old teacher, found in the wilds", want: "to finish the work of a lifetime" }, rewards: [{ kind: "knowledge", name: "Master Orlin's Notes", quantity: 1 }], text: "You have your teacher back, and a life's work to help finish." },
    rumor: { source: "", text: "" }, debunk: { title: "", reveal: "" },
    completionRumor: "A lost scholar was found in the ruins {bearing} of town, raving about an inscription.",
  },
  {
    id: "personal_noble", name: "The family signet", biomes: ALL_BIOMES, markerType: "trace", trackSkill: "investigation",
    personal: ["noble", "knight", "courtier"],
    sign: { title: "Your Family's Crest", reveal: "A wax seal on a torn letter, pressed with your family's signet. The signet stolen years ago. The letter is fresh. It came from {bearing}.", detail: "Someone is using your family's name to sign letters, {dist} hexes {bearing}." },
    trace: { title: "A Forged Promissory Note", reveal: "A merchant waves a note at you: debts signed in your family's name. 'The fellow went {bearing}.'", detail: "The forger is running up debts your family will be asked to honour. {dist} hexes {bearing}." },
    approach: { title: "A Fine Tent Where None Should Be", reveal: "A silk pavilion pitched in the wilds {bearing}, flying a banner that is almost your family's.", detail: "{dist} hex{plural} {bearing}." },
    climax: { title: "The Pretender", reveal: "A smooth young man in borrowed finery, wearing your family's signet ring. He has the nerve to bow. 'Cousin! I don't believe we've met.'",
      options: [
        { id: "expose", label: "Expose him in front of his servants", skill: "history", dc: 12, success: "You know the family tree better than he ever could. His own servants walk out. He hands over the ring.", failure: "He has an answer for everything, and the servants believe him for now." },
        { id: "bargain", label: "Offer him a way out if he returns the ring", skill: "persuasion", dc: 13, success: "He's a chancer, not a villain. The ring for a head start. Done.", failure: "He laughs at you." },
      ] },
    combatSeed: { encounterType: "ambush", enemyTheme: "bandit", difficulty: "easy", battlefieldTag: "pavilion", stakes: "the signet", fleeAllowed: true },
    payoff: { kind: "cache", rewards: [{ kind: "trinket", name: "Your Family's Signet Ring", quantity: 1 }], text: "The signet is back where it belongs. Your family's name is yours again." },
    rumor: { source: "", text: "" }, debunk: { title: "", reveal: "" },
    completionRumor: "A pretender to a noble name was unmasked in a silk tent {bearing} of town.",
  },
  {
    id: "personal_outlander", name: "The old migration path", biomes: ["forest", "mountain", "grass", "desert"], markerType: "landmark", trackSkill: "survival",
    personal: ["outlander", "hermit", "sailor", "pirate"],
    sign: { title: "A Sign From Home", reveal: "A cairn built the way your people build them, three flat stones and a white one. It points {bearing}.", detail: "Someone from home passed this way, and wanted to be found. {dist} hexes {bearing}." },
    trace: { title: "A Carved Totem", reveal: "Your people's totem, freshly carved into a tree. Below it, a word in your own tongue: 'Wait.' The path continues {bearing}.", detail: "They're waiting for someone. Maybe you. {dist} hexes {bearing}." },
    approach: { title: "Smoke in Your People's Pattern", reveal: "Three smokes rising together from {bearing}: the old signal for 'kin, come in'.", detail: "{dist} hex{plural} {bearing}." },
    climax: { title: "Kin in a Strange Land", reveal: "A small camp of your own people, far from home, lost and short of food. Their elder looks at you a long time. 'You left us. Will you help us now?'",
      options: [
        { id: "guide", label: "Lead them to good land you've found", skill: "survival", dc: 12, success: "You lead them to a valley with water and game. That night they sing your name in the old songs.", failure: "The land you remembered is dry now. They'll wait for a better guide." },
        { id: "speak", label: "Speak to the elder in the old way", skill: "persuasion", dc: 12, success: "The elder forgives you. You are kin again, and you leave with a gift from home.", failure: "The elder is not ready to forgive." },
      ] },
    combatSeed: { encounterType: "ambush", enemyTheme: "beast", difficulty: "easy", battlefieldTag: "camp", stakes: "your kin", fleeAllowed: true },
    payoff: { kind: "npc", npc: { name: "Elder Ysra", role: "elder of your own people, met far from home", want: "to bring her people somewhere safe" }, rewards: [{ kind: "trinket", name: "Gift From Home", quantity: 1 }], water: 2, text: "You have kin in this land now." },
    rumor: { source: "", text: "" }, debunk: { title: "", reveal: "" },
    completionRumor: "Strangers from far away have settled a valley {bearing} of town, guided by one of their own.",
  },
  {
    id: "personal_any", name: "Someone from your past", biomes: ALL_BIOMES, markerType: "npc_echo", trackSkill: "insight",
    personal: ["*"],
    sign: { title: "A Name You Know", reveal: "Your name, carved into a tree, old and weathered. Under it, a mark only you would understand. It points {bearing}.", detail: "Someone from before you took to the road left this for you. {dist} hexes {bearing}." },
    trace: { title: "A Keepsake", reveal: "A keepsake you gave someone long ago, hung on a branch where you'd see it. The trail goes on {bearing}.", detail: "They've been waiting a long time. {dist} hexes {bearing}." },
    approach: { title: "A Familiar Voice", reveal: "A voice you haven't heard in years, calling your name from {bearing}.", detail: "{dist} hex{plural} {bearing}." },
    climax: { title: "An Old Friend", reveal: "Someone you left behind when you became an adventurer. They're in trouble, and you're the only one they thought to call.",
      options: [
        { id: "listen", label: "Listen to what they need", skill: "insight", dc: 11, success: "You hear what they're really asking for, and you give it. Whatever was broken between you is mended.", failure: "You say the wrong thing. They forgive you, but it costs them." },
        { id: "help", label: "Roll up your sleeves and help", skill: "athletics", dc: 12, success: "It's hard, honest work, and when it's done you sit together like old times.", failure: "It doesn't go well, but they're glad you came." },
      ] },
    combatSeed: { encounterType: "ambush", enemyTheme: "bandit", difficulty: "easy", battlefieldTag: "homestead", stakes: "an old friend", fleeAllowed: true },
    payoff: { kind: "cache", rewards: [{ kind: "trinket", name: "Keepsake From the Past", quantity: 1 }], text: "Some of what you left behind was waiting for you." },
    rumor: { source: "", text: "" }, debunk: { title: "", reveal: "" },
    completionRumor: "Two old friends met again in the wilds {bearing} of town.",
  },
];

/** The personal trail for a background (PHB names; anything unknown gets the general one). */
export function personalTemplateFor(background: string | null | undefined): ThreadTemplate {
  const b = (background ?? "").trim().toLowerCase();
  return PERSONAL_TEMPLATES.find((t) => t.personal?.some((p) => p !== "*" && b.includes(p)))
    ?? PERSONAL_TEMPLATES[PERSONAL_TEMPLATES.length - 1];
}
