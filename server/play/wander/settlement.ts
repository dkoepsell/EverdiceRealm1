/**
 * Settlement scenes for Wander: what happens in each district of a village,
 * town or city (shared/wander/sites.ts lays the districts out).
 *
 * Services use Player's Handbook prices (modest lodging 5 sp a night, a day's
 * rations 5 sp, a mug of ale 4 cp) and Xanathar's spellcasting-service price
 * for a cure wounds (10 gp). Encounters call for ordinary ability checks at the
 * DMG's easy (10), moderate (13 to 15) and hard (18+) difficulties.
 *
 * Each choice carries its effect in mechanicalEffects.s; the server applies it
 * from its own stored copy of the outcome, never the client's.
 */
import type { WanderTerrain } from "@shared/wander/terrain";
import type { District, DistrictKind, SettlementKind, Site } from "@shared/wander/sites";

export interface Coin { gp?: number; sp?: number; cp?: number }

export interface SResult {
  text: string;
  /** Coin gained (positive) or lost (negative). Losses never go below zero. */
  coin?: Coin;
  /** Damage taken (positive number of hit points). */
  damage?: number;
  reward?: { kind: "knowledge" | "consumable" | "trinket" | "key_fragment" | "faction_token"; name: string; quantity: number };
  /** Hear a road rumor (a rumored thread). */
  rumor?: boolean;
  /** Take on a job (an active thread toward the wilds). */
  job?: boolean;
  /** Learn where the nearest dungeon entrance is. */
  revealDungeon?: boolean;
  fight?: { enemyTheme: string; difficulty: "easy" | "medium" | "hard"; battlefieldTag: string; stakes: string; fleeAllowed: boolean };
  inspiration?: boolean;
}

export type SEffect =
  | { do: "none"; text: string }
  | { do: "pay"; cost: Coin; result: SResult; service?: "lodging" | "rations" | "healing" }
  | { do: "check"; skill: string; dc: number; success: SResult; fail: SResult }
  | { do: "result"; result: SResult }
  | { do: "water"; text: string }
  | { do: "leave" };

export interface SChoice {
  id: string;
  label: string;
  intentTag: "investigate" | "avoid" | "engage" | "retreat" | "camp" | "solve";
  effect: SEffect;
}

export interface Scene {
  id: string;
  where: DistrictKind[];
  sizes?: SettlementKind[];
  flavors?: WanderTerrain[];
  /** A district's standing service: shown on most visits. */
  service?: boolean;
  type: "discovery" | "quiet" | "risk";
  title: string;
  reveal: string;
  choices: SChoice[];
}

const moveOn = (text = "You leave them to it and walk on."): SChoice => ({ id: "move_on", label: "Move on", intentTag: "avoid", effect: { do: "none", text } });

// ── services ──────────────────────────────────────────────────────────────────

const SERVICES: Scene[] = [
  {
    id: "inn_room", where: ["inn"], service: true, type: "quiet",
    title: "A Room for the Night",
    reveal: "The innkeeper wipes the counter. \"Modest room, hot supper and breakfast: five silver. Bolt on the door, and the fire's kept in.\"",
    choices: [
      { id: "lodging", label: "Take a room (5 sp): long rest", intentTag: "camp", effect: { do: "pay", cost: { sp: 5 }, service: "lodging", result: { text: "You eat well and sleep behind a locked door. A long rest in safety." } } },
      { id: "rations", label: "Buy five days of rations (2 gp 5 sp)", intentTag: "engage", effect: { do: "pay", cost: { sp: 25 }, service: "rations", result: { text: "The cook wraps hard bread, cheese and dried meat for the road." } } },
      moveOn("You thank the innkeeper and head back out."),
    ],
  },
  {
    id: "tavern_round", where: ["tavern"], service: true, type: "discovery",
    title: "The Common Room",
    reveal: "Low beams, a crackling fire and a dozen locals nursing their ale. Travelers' news is worth a round here.",
    choices: [
      { id: "round", label: "Buy a round and listen (1 sp)", intentTag: "investigate", effect: { do: "pay", cost: { sp: 1 }, result: { text: "Tongues loosen.", rumor: true } } },
      { id: "ale", label: "A mug of ale by the fire (4 cp)", intentTag: "camp", effect: { do: "pay", cost: { cp: 4 }, result: { text: "The ale is brown and honest, and for a while your feet stop aching." } } },
      { id: "ask_ruins", label: "Ask about old ruins nearby (Persuasion DC 12)", intentTag: "investigate", effect: { do: "check", skill: "persuasion", dc: 12, success: { text: "An old trapper leans in and tells you where a dark entrance lies.", revealDungeon: true }, fail: { text: "Shrugs all round. Nobody here goes looking for holes in the ground." } } },
    ],
  },
  {
    id: "temple_care", where: ["temple"], service: true, type: "quiet",
    title: "Healers at the Temple",
    reveal: "Candles burn before the altar. An acolyte in grey robes tends the sick in a side chapel.",
    choices: [
      { id: "heal", label: "Ask for a cure wounds (10 gp donation)", intentTag: "camp", effect: { do: "pay", cost: { gp: 10 }, service: "healing", result: { text: "The acolyte lays a warm hand on your wounds and speaks a prayer." } } },
      { id: "bless", label: "Light a candle and pray (1 sp)", intentTag: "camp", effect: { do: "pay", cost: { sp: 1 }, result: { text: "In the quiet you feel steadier, as if someone is watching over you.", inspiration: true } } },
      moveOn("You bow your head to the altar and leave quietly."),
    ],
  },
  {
    id: "market_stalls", where: ["market", "fishmarket", "caravanserai"], service: true, type: "quiet",
    title: "Market Stalls",
    reveal: "Hawkers shout their prices over the din: bread, salt fish, rope, lamp oil and trinkets of doubtful origin.",
    choices: [
      { id: "rations", label: "Buy five days of rations (2 gp 5 sp)", intentTag: "engage", effect: { do: "pay", cost: { sp: 25 }, service: "rations", result: { text: "You stock up on food that will keep." } } },
      { id: "haggle", label: "Haggle over a curio (Persuasion DC 13)", intentTag: "engage", effect: { do: "check", skill: "persuasion", dc: 13, success: { text: "You talk the seller down to a song and walk away with something interesting.", coin: { sp: -2 }, reward: { kind: "trinket", name: "Curio from the market", quantity: 1 } }, fail: { text: "The seller won't budge, and you won't pay that much for a painted pebble." } } },
      moveOn(),
    ],
  },
  {
    id: "well_water", where: ["well", "cistern"], service: true, type: "quiet",
    title: "Fresh Water",
    reveal: "Cool water and a few neighbors trading gossip while they wait their turn.",
    choices: [
      { id: "fill", label: "Fill your waterskins", intentTag: "camp", effect: { do: "water", text: "You drink deep and fill every skin." } },
      { id: "gossip", label: "Listen to the gossip (Insight DC 10)", intentTag: "investigate", effect: { do: "check", skill: "insight", dc: 10, success: { text: "Under the chatter is real news from the road.", rumor: true }, fail: { text: "Mostly talk of whose goat ate whose washing." } } },
    ],
  },
  {
    id: "notice_jobs", where: ["notice"], service: true, type: "discovery",
    title: "The Notice Board",
    reveal: "Papers flutter on the board: lost livestock, a reward for a missing caravan, a plea from a farmstead out in the wilds.",
    choices: [
      { id: "job", label: "Take down a plea for help", intentTag: "engage", effect: { do: "result", result: { text: "You fold the paper into your pack. Someone out there is waiting.", job: true } } },
      { id: "read", label: "Read the rest (Investigation DC 10)", intentTag: "investigate", effect: { do: "check", skill: "investigation", dc: 10, success: { text: "Between the lost goats is a warning about travelers going missing, and where.", revealDungeon: true }, fail: { text: "Nothing else catches your eye." } } },
      moveOn(),
    ],
  },
  {
    id: "smithy_work", where: ["smithy", "forge"], service: true, type: "quiet",
    title: "The Forge",
    reveal: "Heat rolls out of the open door. The smith works the bellows with one arm and a hammer with the other.",
    choices: [
      { id: "work", label: "Offer to work the bellows (Athletics DC 12)", intentTag: "engage", effect: { do: "check", skill: "athletics", dc: 12, success: { text: "An hour's sweat and the smith pays you fairly.", coin: { sp: 3 } }, fail: { text: "The bellows win. The smith laughs and gives you a cup of water for trying." } } },
      { id: "talk", label: "Ask what's been coming in for repair (Insight DC 12)", intentTag: "investigate", effect: { do: "check", skill: "insight", dc: 12, success: { text: "\"Arrow-bitten shields, mostly. Folk getting jumped on the road.\" The smith tells you where.", revealDungeon: true }, fail: { text: "\"Pots and plough-shares,\" says the smith, and goes back to work." } } },
      moveOn(),
    ],
  },
];

// ── encounters and scenes ─────────────────────────────────────────────────────

const SCENES: Scene[] = [
  // square / homes / streets
  {
    id: "crier", where: ["square"], type: "discovery",
    title: "The Town Crier",
    reveal: "A crier in a feathered hat rings a handbell and reads the day's news to a small crowd.",
    choices: [
      { id: "listen", label: "Listen", intentTag: "investigate", effect: { do: "result", result: { text: "Among the market prices and a lost-dog notice is real news from the road.", rumor: true } } },
      moveOn(),
    ],
  },
  {
    id: "performer", where: ["square", "market"], type: "quiet",
    title: "Street Performers",
    reveal: "A juggler and a fiddler are working the crowd, and there is space on the cobbles for another act.",
    choices: [
      { id: "perform", label: "Join in (Performance DC 12)", intentTag: "engage", effect: { do: "check", skill: "performance", dc: 12, success: { text: "The crowd loves you. Coins rattle into the hat, and the fiddler splits them fairly.", coin: { sp: 4 } }, fail: { text: "A few polite claps. The juggler kindly pretends not to have noticed." } } },
      moveOn("You toss a copper in the hat and move on."),
    ],
  },
  {
    id: "lost_dog", where: ["homes", "square", "fields"], type: "quiet",
    title: "A Child's Lost Dog",
    reveal: "A small girl tugs your sleeve. Her dog ran off chasing a cat and hasn't come back.",
    choices: [
      { id: "track", label: "Help look (Survival DC 10)", intentTag: "engage", effect: { do: "check", skill: "survival", dc: 10, success: { text: "Paw prints lead to a woodpile, and a very muddy dog. The girl's father presses a coin on you and won't take it back.", coin: { sp: 1 }, inspiration: true }, fail: { text: "No luck, but as you give up the dog trots home on its own, very pleased with itself." } } },
      moveOn("You promise to keep an eye out."),
    ],
  },
  {
    id: "widow", where: ["homes"], type: "discovery",
    title: "A Widow's Request",
    reveal: "An old woman on her doorstep asks if you are going out into the wilds. Her son went to check the family's far pasture and hasn't come back.",
    choices: [
      { id: "help", label: "Promise to look for him", intentTag: "engage", effect: { do: "result", result: { text: "She tells you which way he went and thanks you twice.", job: true } } },
      moveOn("You tell her you hope he comes home soon."),
    ],
  },
  {
    id: "preacher", where: ["square", "temple"], type: "risk",
    title: "A Wild-Eyed Preacher",
    reveal: "A man in a stained robe preaches doom from a barrel, about a voice under the earth that will wake. The crowd is getting uneasy.",
    choices: [
      { id: "read", label: "Read him (Insight DC 13)", intentTag: "investigate", effect: { do: "check", skill: "insight", dc: 13, success: { text: "He isn't mad, just terrified. He tells you, haltingly, where he heard the voice.", revealDungeon: true }, fail: { text: "Before you can make sense of him, the watch hustles him off." } } },
      moveOn(),
    ],
  },
  // market crime
  {
    id: "pickpocket", where: ["market", "square", "docks", "fishmarket", "caravanserai"], type: "risk",
    title: "A Brush in the Crowd",
    reveal: "Someone bumps you hard in the press of bodies. Your hand goes to your purse.",
    choices: [
      { id: "catch", label: "Grab the thief (Perception DC 13)", intentTag: "engage", effect: { do: "check", skill: "perception", dc: 13, success: { text: "You catch a wrist with your purse in it. The boy drops it and bolts. A stallholder nods his thanks: that one's been robbing him for weeks.", reward: { kind: "faction_token", name: "Stallholder's goodwill", quantity: 1 } }, fail: { text: "By the time you look round, the thief is gone, and so are some of your coins.", coin: { sp: -5 } } } },
    ],
  },
  {
    id: "con_artist", where: ["market", "tavern", "square"], type: "risk",
    title: "The Shell Game",
    reveal: "A smiling man runs a three-shells game on an upturned crate. A farmer has just won twice in a row.",
    choices: [
      { id: "spot", label: "Watch his hands (Insight DC 14)", intentTag: "investigate", effect: { do: "check", skill: "insight", dc: 14, success: { text: "The farmer is his partner, and the pea is never under any shell. You quietly tell the next mark, who buys you an ale for it.", reward: { kind: "knowledge", name: "How the shell game works", quantity: 1 } }, fail: { text: "You put down two silver and lose them both. Then two more. The man is very sympathetic.", coin: { sp: -4 } } } },
      moveOn(),
    ],
  },
  // tavern trouble
  {
    id: "brawl", where: ["tavern"], type: "risk",
    title: "A Brawl Breaks Out",
    reveal: "A chair flies past your head. Two caravan guards and a table of miners are settling something with their fists.",
    choices: [
      { id: "calm", label: "Calm them down (Persuasion DC 13)", intentTag: "engage", effect: { do: "check", skill: "persuasion", dc: 13, success: { text: "You get between them and talk fast. They end up drinking together, and the owner pours yours free.", rumor: true }, fail: { text: "A stray elbow catches your jaw before you can back off.", damage: 2 } } },
      { id: "join", label: "Wade in (Athletics DC 12)", intentTag: "engage", effect: { do: "check", skill: "athletics", dc: 12, success: { text: "You toss two miners over a table, and the room cheers. Someone had money on you, and shares it.", coin: { sp: 3 } }, fail: { text: "You end up on the floor with a ringing head and a split lip.", damage: 3 } } },
      moveOn("You take your drink outside until it blows over."),
    ],
  },
  {
    id: "card_game", where: ["tavern", "docks", "caravanserai"], type: "quiet",
    title: "Cards by Candlelight",
    reveal: "Three players at a corner table wave you over. \"Two silver to sit in.\"",
    choices: [
      { id: "play", label: "Play a hand (Insight DC 13)", intentTag: "engage", effect: { do: "check", skill: "insight", dc: 13, success: { text: "You read their tells and take the pot.", coin: { sp: 6 } }, fail: { text: "Lady Luck looks the other way.", coin: { sp: -2 } } } },
      moveOn(),
    ],
  },
  // gates
  {
    id: "gate_guards", where: ["gate"], sizes: ["town", "city"], type: "quiet",
    title: "Guards at the Gate",
    reveal: "Two guards in the town's colors lean on their spears and watch who comes and goes.",
    choices: [
      { id: "ask", label: "Ask what trouble they've seen (Persuasion DC 10)", intentTag: "investigate", effect: { do: "check", skill: "persuasion", dc: 10, success: { text: "\"Folk going missing on the road. Here's where.\"", revealDungeon: true }, fail: { text: "\"Move along.\"" } } },
    ],
  },
  {
    id: "gate_lane", where: ["gate"], sizes: ["village"], type: "quiet",
    title: "The Village Lane",
    reveal: "The lane runs out between the last cottages into open country.",
    choices: [],
  },
  // slums and noble quarter (cities)
  {
    id: "alley_thugs", where: ["slums"], type: "risk",
    title: "Toll in the Alley",
    reveal: "Three toughs step out of a doorway and block the alley. \"Toll's five silver. For your safety.\"",
    choices: [
      { id: "pay", label: "Pay the toll (5 sp)", intentTag: "avoid", effect: { do: "pay", cost: { sp: 5 }, result: { text: "They step aside with mocking bows." } } },
      { id: "intimidate", label: "Stare them down (Intimidation DC 14)", intentTag: "engage", effect: { do: "check", skill: "intimidation", dc: 14, success: { text: "Something in your face makes them think again. They melt back into the doorway." }, fail: { text: "They laugh, and reach for their clubs.", fight: { enemyTheme: "bandit", difficulty: "easy", battlefieldTag: "narrow_alley", stakes: "your purse", fleeAllowed: true } } } },
      { id: "fight", label: "Fight", intentTag: "engage", effect: { do: "result", result: { text: "You draw steel.", fight: { enemyTheme: "bandit", difficulty: "easy", battlefieldTag: "narrow_alley", stakes: "your purse", fleeAllowed: true } } } },
    ],
  },
  {
    id: "fence", where: ["slums", "docks"], type: "discovery",
    title: "A Fence with a Secret",
    reveal: "A one-eyed woman selling \"found\" goods mutters that she bought a strange map from a dying man.",
    choices: [
      { id: "buy", label: "Buy the map (2 gp)", intentTag: "engage", effect: { do: "pay", cost: { gp: 2 }, result: { text: "It's real. The map marks a hidden entrance out in the wilds.", revealDungeon: true, reward: { kind: "key_fragment", name: "A dead man's map", quantity: 1 } } } },
      { id: "talk", label: "Talk her down (Persuasion DC 15)", intentTag: "investigate", effect: { do: "check", skill: "persuasion", dc: 15, success: { text: "She lets you look for a few coppers, and you memorize it.", revealDungeon: true }, fail: { text: "\"Two gold, or you can stop looking at it.\"" } } },
      moveOn(),
    ],
  },
  {
    id: "noble_escort", where: ["noble", "keep", "guild"], type: "discovery",
    title: "A Noble's Errand",
    reveal: "A steward in livery looks you over. \"Her ladyship pays well for discreet work outside the walls. Interested?\"",
    choices: [
      { id: "accept", label: "Accept the work", intentTag: "engage", effect: { do: "result", result: { text: "The steward hands you a sealed letter of instruction and a purse for expenses.", job: true, coin: { gp: 2 } } } },
      { id: "etiquette", label: "Ask for better terms (Persuasion DC 15)", intentTag: "engage", effect: { do: "check", skill: "persuasion", dc: 15, success: { text: "Your courtly manner impresses. The purse is heavier.", job: true, coin: { gp: 5 } }, fail: { text: "The steward's smile cools. \"The terms are the terms.\" You take the work anyway.", job: true, coin: { gp: 1 } } } },
      moveOn("You decline politely."),
    ],
  },
  {
    id: "library_lore", where: ["library", "temple"], sizes: ["town", "city"], type: "discovery",
    title: "Old Chronicles",
    reveal: "Dusty shelves of local histories, tax rolls and travelers' accounts, some of them very old.",
    choices: [
      { id: "research", label: "Research the region (Investigation DC 12)", intentTag: "investigate", effect: { do: "check", skill: "investigation", dc: 12, success: { text: "A traveler's account describes an entrance in the wilds, with directions.", revealDungeon: true, reward: { kind: "knowledge", name: "Regional chronicle notes", quantity: 1 } }, fail: { text: "Hours pass in tax rolls and genealogies." } } },
      { id: "history", label: "Read up on the old wars (History DC 13)", intentTag: "investigate", effect: { do: "check", skill: "history", dc: 13, success: { text: "You learn which ruins were fortresses, and which were tombs.", reward: { kind: "knowledge", name: "Lore of the old wars", quantity: 1 } }, fail: { text: "The handwriting defeats you." } } },
    ],
  },
  {
    id: "guild_contract", where: ["guild", "stables", "caravanserai"], type: "discovery",
    title: "Caravan Master Hiring",
    reveal: "A caravan master is short a guard. \"There's a stretch of road where we keep losing wagons. Find out why, and the guild will pay.\"",
    choices: [
      { id: "take", label: "Take the contract", intentTag: "engage", effect: { do: "result", result: { text: "You shake on it. The master marks the bad stretch on your map.", job: true } } },
      moveOn(),
    ],
  },
  // terrain flavor
  {
    id: "dock_smugglers", where: ["docks"], type: "risk",
    title: "Quiet Work at the Docks",
    reveal: "A sailor offers you a gold piece to help shift some unmarked crates after dark. No questions.",
    choices: [
      { id: "read", label: "Size him up (Insight DC 12)", intentTag: "investigate", effect: { do: "check", skill: "insight", dc: 12, success: { text: "Smugglers, and nervous ones. You let slip you know, and he pays you to forget it.", coin: { gp: 1 } }, fail: { text: "You agree. The crates are heavy, the pay is real, and the harbor watch is closer than he thought.", coin: { gp: 1 }, fight: { enemyTheme: "bandit", difficulty: "easy", battlefieldTag: "docks", stakes: "your neck", fleeAllowed: true } } } },
      moveOn("You say no thank you."),
    ],
  },
  {
    id: "fishermen", where: ["docks", "fishmarket", "ferry"], type: "quiet",
    title: "Nets and Tall Tales",
    reveal: "Fishermen mend their nets and argue about what they saw out past the point.",
    choices: [
      { id: "help", label: "Help haul a net (Athletics DC 10)", intentTag: "engage", effect: { do: "check", skill: "athletics", dc: 10, success: { text: "A good catch. They send you off with smoked fish for the road and a story about a sea cave.", revealDungeon: true }, fail: { text: "The net slips, and you get very wet." } } },
      moveOn(),
    ],
  },
  {
    id: "trapped_miners", where: ["mine", "forge"], type: "risk",
    title: "Rockfall in the Mine",
    reveal: "A bell clangs from the mine head. A gallery has collapsed with two miners behind it.",
    choices: [
      { id: "dig", label: "Help dig them out (Athletics DC 13)", intentTag: "engage", effect: { do: "check", skill: "athletics", dc: 13, success: { text: "Your back aches, but both miners walk out. The foreman insists you take a miner's share.", coin: { gp: 1 }, inspiration: true }, fail: { text: "A loose rock catches your shoulder before the others get them out.", damage: 3 } } },
      { id: "listen", label: "Listen for the right spot (Perception DC 12)", intentTag: "investigate", effect: { do: "check", skill: "perception", dc: 12, success: { text: "You hear tapping and point the diggers to it. They're out within the hour. The foreman mentions the miners heard something else down there too.", revealDungeon: true }, fail: { text: "The tapping echoes everywhere. Others dig them out by nightfall." } } },
    ],
  },
  {
    id: "boardwalk", where: ["boardwalk", "ferry"], type: "risk",
    title: "Rotten Boards",
    reveal: "The boardwalk groans under your boots. Black water gleams through the gaps.",
    choices: [
      { id: "careful", label: "Pick your way across (Acrobatics DC 12)", intentTag: "engage", effect: { do: "check", skill: "acrobatics", dc: 12, success: { text: "You step lightly from beam to beam and reach solid planks." }, fail: { text: "A board snaps and you plunge to the waist in cold muck, scraping a shin on the way.", damage: 2 } } },
      moveOn("You go the long way round."),
    ],
  },
  {
    id: "ferryman", where: ["ferry"], type: "quiet",
    title: "The Ferryman",
    reveal: "An old ferryman poles a flat boat between the stilts. He knows every channel in the fen.",
    choices: [
      { id: "ask", label: "Ask about the fen (Persuasion DC 10)", intentTag: "investigate", effect: { do: "check", skill: "persuasion", dc: 10, success: { text: "\"There's a place nobody poles near,\" he says, and tells you where.", revealDungeon: true }, fail: { text: "\"Keep to the channels and you'll keep your boots.\"" } } },
      moveOn(),
    ],
  },
  {
    id: "hunters", where: ["lodge", "lumberyard", "stables"], type: "discovery",
    title: "Hunters' Tales",
    reveal: "Hunters and woodcutters swap stories over a haunch of venison. One of them shows a nasty set of claw scars.",
    choices: [
      { id: "listen", label: "Ask about the scars (Persuasion DC 10)", intentTag: "investigate", effect: { do: "check", skill: "persuasion", dc: 10, success: { text: "\"Big den, out that way. Don't go alone.\"", revealDungeon: true }, fail: { text: "\"Bear,\" he says, and won't say more." } } },
      { id: "help", label: "Help with the day's work (Athletics DC 12)", intentTag: "engage", effect: { do: "check", skill: "athletics", dc: 12, success: { text: "You earn your supper and a few coins.", coin: { sp: 2 } }, fail: { text: "You mostly get in the way, but they feed you anyway." } } },
    ],
  },
  {
    id: "harvest", where: ["fields"], type: "quiet",
    title: "Harvest Hands Wanted",
    reveal: "A farmer is racing the weather to get his crop in, and short of hands.",
    choices: [
      { id: "work", label: "Lend a hand (Athletics DC 10)", intentTag: "engage", effect: { do: "check", skill: "athletics", dc: 10, success: { text: "By sundown the crop is in. He pays you in coin and a sack of food.", coin: { sp: 2 } }, fail: { text: "Your blisters have blisters, but the crop gets in." } } },
      moveOn(),
    ],
  },
  {
    id: "water_seller", where: ["caravanserai", "cistern"], type: "quiet",
    title: "Travelers from the Deep Desert",
    reveal: "A caravan has just come in from the deep sands, and its drivers trade news with the water-sellers.",
    choices: [
      { id: "listen", label: "Trade news with them", intentTag: "investigate", effect: { do: "result", result: { text: "They have stories from places you've never heard of, and one from much closer to home.", rumor: true } } },
      moveOn(),
    ],
  },
  {
    id: "temple_relic", where: ["temple"], type: "discovery",
    title: "A Desecrated Shrine",
    reveal: "The priest is distraught. Someone stole a relic from the shrine and fled into the wilds.",
    choices: [
      { id: "help", label: "Offer to bring it back", intentTag: "engage", effect: { do: "result", result: { text: "The priest blesses your journey and tells you which way the thief ran.", job: true, inspiration: true } } },
      moveOn(),
    ],
  },
  {
    id: "keep_captain", where: ["keep"], type: "discovery",
    title: "The Captain of the Watch",
    reveal: "The captain is drawing up a patrol, and short of capable swords.",
    choices: [
      { id: "join", label: "Volunteer", intentTag: "engage", effect: { do: "result", result: { text: "\"Good. There's a problem out on the road.\" The captain marks it on your map.", job: true } } },
      moveOn(),
    ],
  },
  {
    id: "quiet_street", where: ["homes", "square", "stables", "fields", "well", "lumberyard", "boardwalk", "cistern"], type: "quiet",
    title: "Ordinary Life",
    reveal: "Washing on the lines, children chasing chickens, someone singing badly in a back yard. Nothing here needs you.",
    choices: [moveOn("You enjoy the peace for a moment.")],
  },
];

const ALL = [...SERVICES, ...SCENES];

function fits(s: Scene, site: Site, d: District) {
  return s.where.includes(d.kind)
    && (!s.sizes || s.sizes.includes(site.kind as SettlementKind))
    && (!s.flavors || s.flavors.includes(site.flavor));
}

/** The leave-by-the-gate choice, added to every gate scene. */
export const LEAVE_CHOICE: SChoice = { id: "leave", label: "Leave and head back into the wilds", intentTag: "retreat", effect: { do: "leave" } };

/**
 * Pick the scene for a district visit. Service districts show their service most
 * of the time; otherwise a fitting scene, preferring ones not seen this visit.
 */
export function pickScene(site: Site, d: District, recent: string[], rng: () => number): Scene {
  const service = SERVICES.find((s) => fits(s, site, d));
  if (service && (rng() < 0.65 || !recent.includes(service.id))) return withGate(service, d);
  let pool = SCENES.filter((s) => fits(s, site, d));
  const fresh = pool.filter((s) => !recent.includes(s.id));
  if (fresh.length) pool = fresh;
  if (!pool.length) pool = service ? [service] : SCENES.filter((s) => s.id === "quiet_street");
  return withGate(pool[Math.floor(rng() * pool.length)], d);
}

function withGate(s: Scene, d: District): Scene {
  if (d.kind !== "gate") return s;
  return { ...s, choices: [...s.choices.filter((c) => c.id !== "move_on"), LEAVE_CHOICE, moveOn("You stay in town a while longer.")] };
}

export function sceneById(id: string) {
  return ALL.find((s) => s.id === id);
}

export const ALL_SCENES = ALL;

// ── coin ──────────────────────────────────────────────────────────────────────

export const toCp = (c: Coin) => (c.gp ?? 0) * 100 + (c.sp ?? 0) * 10 + (c.cp ?? 0);

export function fromCp(cp: number) {
  const v = Math.max(0, Math.round(cp));
  return { gold: Math.floor(v / 100), silver: Math.floor((v % 100) / 10), copper: v % 10 };
}

export function coinText(c: Coin) {
  const cp = Math.abs(toCp(c));
  const gp = Math.floor(cp / 100), sp = Math.floor((cp % 100) / 10), rem = cp % 10;
  const parts = [gp && `${gp} gp`, sp && `${sp} sp`, rem && `${rem} cp`].filter(Boolean);
  return parts.length ? parts.join(" ") : "nothing";
}
