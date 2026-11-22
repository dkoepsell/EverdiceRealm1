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
  },
];

export function getTemplate(id: string): ThreadTemplate | undefined {
  return THREAD_TEMPLATES.find((t) => t.id === id);
}
