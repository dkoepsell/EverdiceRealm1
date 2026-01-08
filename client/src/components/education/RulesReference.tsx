import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { 
  Search, Dice6, Shield, Sword, Heart, Eye, MessageCircle, Zap,
  Brain, Footprints, Hand, Music, Stethoscope, Compass, Flame,
  Users, Mountain, BookOpen, Sparkles, Timer, Moon, Activity
} from "lucide-react";

interface RuleItem {
  name: string;
  description: string;
  mechanics: string;
  examples?: string[];
  category: string;
  icon?: any;
  ability?: string;
}

// All 18 D&D 5e Skills from the SRD 5.1
const SKILLS: RuleItem[] = [
  // Strength Skills
  {
    name: "Athletics",
    description: "Covers difficult situations you encounter while climbing, jumping, or swimming.",
    mechanics: "Strength (Athletics) check. Used for climbing, jumping, swimming, and grappling.",
    examples: [
      "Climbing a sheer cliff or slippery slope",
      "Swimming against a strong current",
      "Escaping from a grapple",
      "Jumping an unusually long distance"
    ],
    category: "skills",
    icon: Mountain,
    ability: "Strength"
  },
  // Dexterity Skills
  {
    name: "Acrobatics",
    description: "Your attempt to stay on your feet in tricky situations, perform acrobatic stunts.",
    mechanics: "Dexterity (Acrobatics) check. Used for balance, tumbling, and acrobatic feats.",
    examples: [
      "Keeping your balance on a narrow ledge",
      "Tumbling past enemies without getting hit",
      "Performing a flip or dive",
      "Landing safely after a fall"
    ],
    category: "skills",
    icon: Sparkles,
    ability: "Dexterity"
  },
  {
    name: "Sleight of Hand",
    description: "Manual trickery such as pickpocketing, planting something, or concealing an object.",
    mechanics: "Dexterity (Sleight of Hand) check. Often opposed by Perception.",
    examples: [
      "Picking someone's pocket",
      "Concealing a small object on your person",
      "Slipping a potion into someone's drink",
      "Performing a magic trick"
    ],
    category: "skills",
    icon: Hand,
    ability: "Dexterity"
  },
  {
    name: "Stealth",
    description: "Conceal yourself from enemies, slink past guards, slip away without being noticed.",
    mechanics: "Dexterity (Stealth) check. Opposed by Perception. Disadvantage in heavy armor.",
    examples: [
      "Sneaking past a sleeping guard",
      "Hiding in shadows during combat",
      "Following someone without being noticed",
      "Moving silently through a dungeon"
    ],
    category: "skills",
    icon: Eye,
    ability: "Dexterity"
  },
  // Intelligence Skills
  {
    name: "Arcana",
    description: "Your ability to recall lore about spells, magic items, eldritch symbols, and magical traditions.",
    mechanics: "Intelligence (Arcana) check. Used for identifying magical effects and items.",
    examples: [
      "Identifying a spell as it's being cast",
      "Recognizing magical writing or symbols",
      "Knowing the properties of a magic item",
      "Understanding planar lore"
    ],
    category: "skills",
    icon: Sparkles,
    ability: "Intelligence"
  },
  {
    name: "History",
    description: "Your ability to recall lore about historical events, legendary people, ancient kingdoms.",
    mechanics: "Intelligence (History) check. Used for recalling past events and figures.",
    examples: [
      "Knowing the history of an ancient ruin",
      "Recognizing a famous historical figure",
      "Understanding the significance of a crown",
      "Recalling details about past wars"
    ],
    category: "skills",
    icon: BookOpen,
    ability: "Intelligence"
  },
  {
    name: "Investigation",
    description: "Looking around for clues and making deductions based on those clues.",
    mechanics: "Intelligence (Investigation) check. Active searching and reasoning, different from Perception.",
    examples: [
      "Searching a room for hidden compartments",
      "Deducing what happened at a crime scene",
      "Finding the weak point in a wall",
      "Researching information in a library"
    ],
    category: "skills",
    icon: Search,
    ability: "Intelligence"
  },
  {
    name: "Nature",
    description: "Your ability to recall lore about terrain, plants and animals, the weather, and natural cycles.",
    mechanics: "Intelligence (Nature) check. Used for identifying natural phenomena.",
    examples: [
      "Identifying a plant or animal",
      "Predicting weather patterns",
      "Knowing which berries are safe to eat",
      "Understanding animal behavior"
    ],
    category: "skills",
    icon: Compass,
    ability: "Intelligence"
  },
  {
    name: "Religion",
    description: "Your ability to recall lore about deities, rites and prayers, religious hierarchies.",
    mechanics: "Intelligence (Religion) check. Used for understanding divine matters.",
    examples: [
      "Recognizing a holy symbol",
      "Knowing the rituals of a deity",
      "Understanding the significance of a temple",
      "Recalling lore about celestials or fiends"
    ],
    category: "skills",
    icon: Flame,
    ability: "Intelligence"
  },
  // Wisdom Skills
  {
    name: "Animal Handling",
    description: "Calm down a domesticated animal, keep a mount from getting spooked, or intuit an animal's intentions.",
    mechanics: "Wisdom (Animal Handling) check. Used for interacting with beasts.",
    examples: [
      "Calming a frightened horse",
      "Training a dog to perform a trick",
      "Sensing if an animal is hostile",
      "Controlling your mount in battle"
    ],
    category: "skills",
    icon: Footprints,
    ability: "Wisdom"
  },
  {
    name: "Insight",
    description: "Determine the true intentions of a creature, detect lies, or predict someone's next move.",
    mechanics: "Wisdom (Insight) check. Often opposed by Deception. Reads body language and speech.",
    examples: [
      "Determining if someone is lying",
      "Reading a person's mood",
      "Sensing hidden motivations",
      "Predicting what someone might do"
    ],
    category: "skills",
    icon: Brain,
    ability: "Wisdom"
  },
  {
    name: "Medicine",
    description: "Diagnose an illness, stabilize a dying companion, or determine the cause of death.",
    mechanics: "Wisdom (Medicine) check. DC 10 to stabilize a dying creature.",
    examples: [
      "Stabilizing a dying ally",
      "Diagnosing an illness or poison",
      "Determining cause of death",
      "Treating wounds without magic"
    ],
    category: "skills",
    icon: Stethoscope,
    ability: "Wisdom"
  },
  {
    name: "Perception",
    description: "Your general awareness of your surroundings and the keenness of your senses.",
    mechanics: "Wisdom (Perception) check. Passive Perception = 10 + Wisdom modifier + proficiency (if proficient).",
    examples: [
      "Spotting a hidden door or secret compartment",
      "Hearing approaching enemies through a door",
      "Noticing someone following you in a crowd",
      "Detecting a trap before triggering it"
    ],
    category: "skills",
    icon: Eye,
    ability: "Wisdom"
  },
  {
    name: "Survival",
    description: "Follow tracks, hunt wild game, guide your group through frozen wastelands, navigate terrain.",
    mechanics: "Wisdom (Survival) check. Used for tracking, foraging, and navigation.",
    examples: [
      "Following creature tracks through a forest",
      "Foraging for food and water",
      "Navigating without a map",
      "Predicting weather or natural hazards"
    ],
    category: "skills",
    icon: Compass,
    ability: "Wisdom"
  },
  // Charisma Skills
  {
    name: "Deception",
    description: "Convincingly hide the truth, through words or actions, including misleading others.",
    mechanics: "Charisma (Deception) check. Often opposed by Insight.",
    examples: [
      "Lying convincingly to a guard",
      "Disguising yourself as someone else",
      "Passing off a forgery as genuine",
      "Creating a distraction with false claims"
    ],
    category: "skills",
    icon: MessageCircle,
    ability: "Charisma"
  },
  {
    name: "Intimidation",
    description: "Influence someone through overt threats, hostile actions, or physical violence.",
    mechanics: "Charisma (Intimidation) check. Can use Strength instead at DM's discretion.",
    examples: [
      "Threatening a prisoner for information",
      "Scaring off bandits without fighting",
      "Dominating a negotiation",
      "Intimidating someone into backing down"
    ],
    category: "skills",
    icon: Zap,
    ability: "Charisma"
  },
  {
    name: "Performance",
    description: "Determine how well you can delight an audience with music, dance, acting, or storytelling.",
    mechanics: "Charisma (Performance) check. Used for entertaining and artistic expression.",
    examples: [
      "Playing an instrument at a tavern",
      "Acting in a theatrical production",
      "Telling a captivating story",
      "Dancing to impress nobility"
    ],
    category: "skills",
    icon: Music,
    ability: "Charisma"
  },
  {
    name: "Persuasion",
    description: "Influence someone through tact, social graces, or good nature.",
    mechanics: "Charisma (Persuasion) check. Often contested against target's Insight or set DC.",
    examples: [
      "Convincing a guard to let you pass",
      "Negotiating better prices with merchants",
      "Rallying allies before a difficult battle",
      "Talking your way out of trouble"
    ],
    category: "skills",
    icon: MessageCircle,
    ability: "Charisma"
  }
];

// All standard D&D 5e Conditions from the SRD 5.1
const CONDITIONS: RuleItem[] = [
  {
    name: "Blinded",
    description: "A blinded creature can't see and automatically fails any ability check that requires sight.",
    mechanics: "Attack rolls against the creature have advantage. The creature's attack rolls have disadvantage.",
    examples: [
      "Affected by the Blindness spell",
      "In complete magical darkness",
      "Eyes covered or destroyed"
    ],
    category: "conditions",
    icon: Eye
  },
  {
    name: "Charmed",
    description: "A charmed creature can't attack the charmer or target them with harmful abilities.",
    mechanics: "Cannot attack or harm the charmer. The charmer has advantage on social interaction checks.",
    examples: [
      "Under the Charm Person spell",
      "Enchanted by a vampire's charm",
      "Affected by a nymph's beauty"
    ],
    category: "conditions",
    icon: Heart
  },
  {
    name: "Deafened",
    description: "A deafened creature can't hear and automatically fails any ability check that requires hearing.",
    mechanics: "Automatically fails checks requiring hearing. May have difficulty with verbal spell components.",
    examples: [
      "Caught in a thunderous explosion",
      "Affected by magical silence",
      "Ears damaged or blocked"
    ],
    category: "conditions",
    icon: Zap
  },
  {
    name: "Frightened",
    description: "A frightened creature has disadvantage on ability checks and attack rolls while the source of fear is in sight.",
    mechanics: "Disadvantage on ability checks and attacks while source visible. Can't willingly move closer to the source.",
    examples: [
      "Affected by a dragon's Frightful Presence",
      "Under the Fear spell",
      "Confronted by a terrifying monster"
    ],
    category: "conditions",
    icon: Zap
  },
  {
    name: "Grappled",
    description: "A grappled creature's speed becomes 0, and it can't benefit from any bonus to its speed.",
    mechanics: "Speed becomes 0. Ends if grappler is incapacitated or moved out of reach.",
    examples: [
      "Grabbed by a giant",
      "Wrapped in a constrictor snake",
      "Held by another creature"
    ],
    category: "conditions",
    icon: Hand
  },
  {
    name: "Incapacitated",
    description: "An incapacitated creature can't take actions or reactions.",
    mechanics: "Cannot take actions or reactions. May still move (unless also restrained or paralyzed).",
    examples: [
      "Overwhelmed by psychic energy",
      "In a trance or sleep-like state",
      "Stunned but not paralyzed"
    ],
    category: "conditions",
    icon: Brain
  },
  {
    name: "Invisible",
    description: "An invisible creature is impossible to see without the aid of magic or a special sense.",
    mechanics: "Attack rolls against have disadvantage. Creature's attacks have advantage. Still detected by noise/tracks.",
    examples: [
      "Under the Invisibility spell",
      "Using a Ring of Invisibility",
      "Affected by Greater Invisibility"
    ],
    category: "conditions",
    icon: Eye
  },
  {
    name: "Paralyzed",
    description: "A paralyzed creature is incapacitated and can't move or speak.",
    mechanics: "Incapacitated, can't move or speak. Auto-fails Str/Dex saves. Attacks have advantage; hits from within 5 feet are critical.",
    examples: [
      "Under the Hold Person spell",
      "Affected by a ghoul's claws",
      "Struck by a paralyzing poison"
    ],
    category: "conditions",
    icon: Zap
  },
  {
    name: "Petrified",
    description: "A petrified creature is transformed into a solid inanimate substance (usually stone).",
    mechanics: "Incapacitated, can't move or speak. Resistance to all damage. Immune to poison and disease. Aging suspended.",
    examples: [
      "Turned to stone by a medusa",
      "Affected by the Flesh to Stone spell",
      "Victim of a basilisk's gaze"
    ],
    category: "conditions",
    icon: Mountain
  },
  {
    name: "Poisoned",
    description: "A poisoned creature has disadvantage on attack rolls and ability checks.",
    mechanics: "Disadvantage on all attack rolls and ability checks until the condition ends.",
    examples: [
      "Drinking contaminated water",
      "Bitten by a venomous snake",
      "Inhaling toxic gas"
    ],
    category: "conditions",
    icon: Heart
  },
  {
    name: "Prone",
    description: "A prone creature is lying on the ground. Can only crawl or stand up.",
    mechanics: "Disadvantage on attack rolls. Attacks from within 5 feet have advantage; ranged attacks have disadvantage. Standing costs half movement.",
    examples: [
      "Knocked down in combat",
      "Tripped by a spell",
      "Falling from a height"
    ],
    category: "conditions",
    icon: Footprints
  },
  {
    name: "Restrained",
    description: "A restrained creature's speed becomes 0 and it can't benefit from any bonus to speed.",
    mechanics: "Speed 0. Attack rolls against have advantage. Creature's attacks and Dex saves have disadvantage.",
    examples: [
      "Caught in a web",
      "Entangled by vines",
      "Bound by chains or ropes"
    ],
    category: "conditions",
    icon: Hand
  },
  {
    name: "Stunned",
    description: "A stunned creature is incapacitated, can't move, and can speak only falteringly.",
    mechanics: "Incapacitated, can't move. Auto-fails Str/Dex saves. Attacks against have advantage.",
    examples: [
      "Struck by a Stunning Strike",
      "Overwhelmed by psychic damage",
      "Hit by a powerful blow"
    ],
    category: "conditions",
    icon: Zap
  },
  {
    name: "Unconscious",
    description: "An unconscious creature is incapacitated, can't move or speak, and is unaware of its surroundings.",
    mechanics: "Drops held items, falls prone. Auto-fails Str/Dex saves. Attacks have advantage; hits from within 5 feet are critical.",
    examples: [
      "Reduced to 0 hit points",
      "Under the Sleep spell",
      "Knocked out by a blow"
    ],
    category: "conditions",
    icon: Moon
  },
  {
    name: "Exhaustion",
    description: "Exhaustion is measured in six levels. Effects are cumulative.",
    mechanics: "Level 1: Disadvantage on ability checks. Level 2: Speed halved. Level 3: Disadvantage on attacks/saves. Level 4: HP max halved. Level 5: Speed 0. Level 6: Death.",
    examples: [
      "Traveling without food or water",
      "Going too long without rest",
      "Environmental hazards"
    ],
    category: "conditions",
    icon: Activity
  }
];

// All standard Combat Actions from the SRD 5.1
const COMBAT_ACTIONS: RuleItem[] = [
  {
    name: "Attack",
    description: "Make one melee or ranged attack.",
    mechanics: "Roll d20 + ability modifier + proficiency bonus (if proficient) vs target's AC. On hit, roll weapon damage + ability modifier.",
    examples: [
      "Swing a sword at an enemy",
      "Fire an arrow from a bow",
      "Cast a spell that requires an attack roll",
      "Throw a javelin at a distant foe"
    ],
    category: "combat",
    icon: Sword
  },
  {
    name: "Cast a Spell",
    description: "Cast a spell with a casting time of 1 action.",
    mechanics: "Follow the spell's description. May require attack roll or saving throw. Uses your spell save DC.",
    examples: [
      "Casting Fireball at a group of enemies",
      "Healing an ally with Cure Wounds",
      "Using Magic Missile against a foe",
      "Casting Shield as a reaction (1 reaction)"
    ],
    category: "combat",
    icon: Sparkles
  },
  {
    name: "Dash",
    description: "Gain extra movement for the current turn.",
    mechanics: "Your movement for this turn increases by an amount equal to your speed (effectively doubling it).",
    examples: [
      "Sprinting across the battlefield",
      "Chasing a fleeing enemy",
      "Running to reach an ally in danger",
      "Escaping from combat quickly"
    ],
    category: "combat",
    icon: Footprints
  },
  {
    name: "Disengage",
    description: "Your movement doesn't provoke opportunity attacks for the rest of the turn.",
    mechanics: "No enemy can make an opportunity attack against you when you leave their reach this turn.",
    examples: [
      "Safely retreating from a dangerous enemy",
      "Repositioning without getting hit",
      "Allowing a ranged character to escape melee",
      "Tactical withdrawal to heal"
    ],
    category: "combat",
    icon: Footprints
  },
  {
    name: "Dodge",
    description: "Focus entirely on avoiding attacks.",
    mechanics: "Until start of next turn, attack rolls against you have disadvantage (if you can see the attacker), and you make Dexterity saves with advantage. Lost if incapacitated or speed drops to 0.",
    examples: [
      "Avoiding dragon breath while allies attack",
      "Dancing around multiple enemies",
      "Buying time while retreating",
      "Waiting for reinforcements to arrive"
    ],
    category: "combat",
    icon: Shield
  },
  {
    name: "Help",
    description: "Aid a friendly creature in completing a task or attacking a target.",
    mechanics: "The helped creature gains advantage on its next ability check or attack roll (if attacking same target within 5 feet).",
    examples: [
      "Distracting an enemy so ally can attack",
      "Helping stabilize a dying companion",
      "Assisting with a difficult skill check",
      "Creating an opening for a rogue's sneak attack"
    ],
    category: "combat",
    icon: Users
  },
  {
    name: "Hide",
    description: "Make a Dexterity (Stealth) check to hide from enemies.",
    mechanics: "Stealth check vs passive Perception of enemies. Can't hide if clearly visible. If successful, you're unseen until detected or you give yourself away.",
    examples: [
      "Ducking behind cover mid-combat",
      "Blending into shadows to gain advantage",
      "Setting up an ambush",
      "Escaping pursuit"
    ],
    category: "combat",
    icon: Eye
  },
  {
    name: "Ready",
    description: "Prepare to take an action later using your reaction.",
    mechanics: "Describe the trigger and action. When trigger occurs, use reaction to perform the action. Readied spells require concentration and use the slot even if not cast.",
    examples: [
      "Ready an attack for when an enemy emerges",
      "Prepare to cast a spell when allies are clear",
      "Wait to shoot until the door opens",
      "Ready to grab an ally and pull them to safety"
    ],
    category: "combat",
    icon: Timer
  },
  {
    name: "Search",
    description: "Devote your attention to finding something.",
    mechanics: "Make a Wisdom (Perception) check or Intelligence (Investigation) check to find hidden creatures or objects.",
    examples: [
      "Looking for a hidden enemy",
      "Searching for a secret door",
      "Finding a trap mechanism",
      "Locating a hidden object"
    ],
    category: "combat",
    icon: Search
  },
  {
    name: "Use an Object",
    description: "Interact with an object that requires your action.",
    mechanics: "Use an object like a potion, activate a magic item, or perform other object interactions requiring an action.",
    examples: [
      "Drinking a healing potion",
      "Activating a magic wand",
      "Lighting a torch in combat",
      "Using a complex mechanical device"
    ],
    category: "combat",
    icon: Hand
  },
  {
    name: "Opportunity Attack",
    description: "A reaction you can take when a hostile creature moves out of your reach.",
    mechanics: "Use your reaction to make one melee attack against the creature. Occurs just before the creature leaves your reach.",
    examples: [
      "Striking an enemy who runs past you",
      "Hitting a retreating foe",
      "Punishing an enemy for disengaging carelessly"
    ],
    category: "combat",
    icon: Sword
  },
  {
    name: "Grapple (Special Attack)",
    description: "Grab a creature and reduce its speed to 0.",
    mechanics: "Replace one attack. Athletics check vs target's Athletics or Acrobatics. Target must be no more than one size larger. Success reduces target's speed to 0.",
    examples: [
      "Grabbing a fleeing enemy",
      "Wrestling a foe to the ground",
      "Holding an enemy for an ally's attack"
    ],
    category: "combat",
    icon: Hand
  },
  {
    name: "Shove (Special Attack)",
    description: "Push a creature away or knock it prone.",
    mechanics: "Replace one attack. Athletics check vs target's Athletics or Acrobatics. Target must be no more than one size larger. Success knocks prone or pushes 5 feet.",
    examples: [
      "Pushing an enemy off a cliff",
      "Knocking a foe prone for advantage",
      "Creating distance from a dangerous enemy"
    ],
    category: "combat",
    icon: Hand
  }
];

// Additional Rules Categories
const SAVING_THROWS: RuleItem[] = [
  {
    name: "Strength Saving Throw",
    description: "Resist being physically moved, pushed, knocked down, or restrained.",
    mechanics: "d20 + Strength modifier + proficiency (if proficient). Typically resists physical force.",
    examples: [
      "Resisting being pushed off a cliff",
      "Fighting against a grapple",
      "Avoiding being knocked prone"
    ],
    category: "saves",
    icon: Mountain
  },
  {
    name: "Dexterity Saving Throw",
    description: "Dodge out of the way of area effects, traps, and explosions.",
    mechanics: "d20 + Dexterity modifier + proficiency (if proficient). Usually for half damage on success.",
    examples: [
      "Dodging a Fireball explosion",
      "Evading a trap's darts",
      "Jumping away from falling debris"
    ],
    category: "saves",
    icon: Footprints
  },
  {
    name: "Constitution Saving Throw",
    description: "Endure poison, disease, exhaustion, or other physical hardship.",
    mechanics: "d20 + Constitution modifier + proficiency (if proficient). Also used for concentration checks.",
    examples: [
      "Resisting poison effects",
      "Maintaining concentration on a spell",
      "Enduring extreme cold or heat"
    ],
    category: "saves",
    icon: Heart
  },
  {
    name: "Intelligence Saving Throw",
    description: "Resist mental effects that attack your reasoning or memory.",
    mechanics: "d20 + Intelligence modifier + proficiency (if proficient). Used against psychic attacks.",
    examples: [
      "Resisting illusions",
      "Fighting against memory alteration",
      "Shaking off confusion effects"
    ],
    category: "saves",
    icon: Brain
  },
  {
    name: "Wisdom Saving Throw",
    description: "Resist effects that charm, frighten, or mentally dominate you.",
    mechanics: "d20 + Wisdom modifier + proficiency (if proficient). Most common mental save.",
    examples: [
      "Resisting the Charm Person spell",
      "Overcoming fear effects",
      "Seeing through illusions"
    ],
    category: "saves",
    icon: Eye
  },
  {
    name: "Charisma Saving Throw",
    description: "Resist effects that would banish you or bind your soul.",
    mechanics: "d20 + Charisma modifier + proficiency (if proficient). Used against possession and banishment.",
    examples: [
      "Resisting the Banishment spell",
      "Fighting against possession",
      "Maintaining your identity"
    ],
    category: "saves",
    icon: Sparkles
  }
];

const REST_RECOVERY: RuleItem[] = [
  {
    name: "Short Rest",
    description: "A period of at least 1 hour of light activity: eating, drinking, reading, tending wounds.",
    mechanics: "Spend Hit Dice to recover HP. Roll Hit Die + Constitution modifier per die spent. Some abilities recharge on short rest.",
    examples: [
      "Resting after a tough fight",
      "Taking a break to tend wounds",
      "Recovering class features like Action Surge"
    ],
    category: "rest",
    icon: Timer
  },
  {
    name: "Long Rest",
    description: "A period of at least 8 hours of sleep or light activity (no more than 2 hours of light activity).",
    mechanics: "Regain all lost HP. Regain spent Hit Dice (up to half your total). Most abilities and spell slots recharge.",
    examples: [
      "Sleeping through the night",
      "Camping in a safe location",
      "Recovering from a long day of adventuring"
    ],
    category: "rest",
    icon: Moon
  },
  {
    name: "Hit Dice",
    description: "A resource used during short rests to heal. Determined by your class.",
    mechanics: "Each class has a specific Hit Die (d6 to d12). Spend during short rest to heal: roll die + Constitution modifier. Regain half on long rest.",
    examples: [
      "Fighter rolling d10s to heal",
      "Wizard spending d6s for recovery",
      "Managing Hit Dice over multiple encounters"
    ],
    category: "rest",
    icon: Dice6
  },
  {
    name: "Death Saving Throws",
    description: "When you start your turn at 0 HP, you must make a death saving throw.",
    mechanics: "Roll d20. 10+ = success, 9 or lower = failure. 3 successes = stable. 3 failures = death. Natural 20 = regain 1 HP. Natural 1 = 2 failures.",
    examples: [
      "Rolling to stay alive while unconscious",
      "Hoping for a natural 20 to get back up",
      "Allies racing to heal you before 3 failures"
    ],
    category: "rest",
    icon: Heart
  },
  {
    name: "Stabilizing a Creature",
    description: "Use an action to make a DC 10 Medicine check to stabilize a dying creature.",
    mechanics: "Success means the creature is stable but remains unconscious at 0 HP. Regains 1 HP after 1d4 hours if not healed.",
    examples: [
      "Non-magical healing to save a friend",
      "Using a healer's kit for automatic success",
      "Keeping an ally alive until the cleric arrives"
    ],
    category: "rest",
    icon: Stethoscope
  }
];

const MOVEMENT_TERRAIN: RuleItem[] = [
  {
    name: "Difficult Terrain",
    description: "Terrain that is hard to move through, such as thick underbrush, deep water, or rubble.",
    mechanics: "Every foot of movement costs 1 extra foot. Effectively halves your movement speed through the area.",
    examples: [
      "Moving through dense forest",
      "Wading through knee-deep water",
      "Climbing rubble-filled ruins"
    ],
    category: "movement",
    icon: Mountain
  },
  {
    name: "Climbing",
    description: "Scaling a vertical surface without equipment or special abilities.",
    mechanics: "Each foot of movement costs 1 extra foot (2 extra in difficult conditions). May require Athletics check for difficult surfaces.",
    examples: [
      "Scaling a castle wall",
      "Climbing a cliff face",
      "Ascending a rope or ladder"
    ],
    category: "movement",
    icon: Mountain
  },
  {
    name: "Swimming",
    description: "Moving through water without the ability to breathe underwater.",
    mechanics: "Each foot of movement costs 1 extra foot (2 extra in rough water). May require Athletics checks.",
    examples: [
      "Swimming across a river",
      "Diving underwater to search",
      "Fighting while in water"
    ],
    category: "movement",
    icon: Compass
  },
  {
    name: "Jumping",
    description: "Long jumps and high jumps, with or without a running start.",
    mechanics: "Long jump: Strength score in feet (half without running start). High jump: 3 + Str modifier feet (half without running start).",
    examples: [
      "Leaping across a chasm",
      "Jumping to grab a ledge",
      "Vaulting over obstacles"
    ],
    category: "movement",
    icon: Footprints
  },
  {
    name: "Falling",
    description: "Taking damage from a fall.",
    mechanics: "1d6 bludgeoning damage per 10 feet fallen, to a maximum of 20d6. Land prone unless you avoid the damage.",
    examples: [
      "Falling off a cliff",
      "Being pushed from a height",
      "Dropping through a trapdoor"
    ],
    category: "movement",
    icon: Footprints
  },
  {
    name: "Suffocating",
    description: "Running out of air to breathe.",
    mechanics: "Can hold breath for 1 + Con modifier minutes (minimum 30 seconds). After that, survive for Con modifier rounds (minimum 1). Then drop to 0 HP.",
    examples: [
      "Trapped underwater",
      "In a room with no air",
      "Affected by Stinking Cloud"
    ],
    category: "movement",
    icon: Activity
  }
];

export function RulesReference() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("skills");

  const allRules = [...SKILLS, ...CONDITIONS, ...COMBAT_ACTIONS, ...SAVING_THROWS, ...REST_RECOVERY, ...MOVEMENT_TERRAIN];
  const filteredRules = allRules.filter(rule => 
    rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRulesForCategory = (category: string) => {
    return filteredRules.filter(rule => rule.category === category);
  };

  const RuleCard = ({ rule }: { rule: RuleItem }) => {
    const IconComponent = rule.icon;
    return (
      <Card className="mb-4" data-testid={`rule-card-${rule.name.toLowerCase().replace(/\s+/g, '-')}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {IconComponent && <IconComponent className="h-5 w-5 text-primary" />}
            <CardTitle className="text-lg">{rule.name}</CardTitle>
            {rule.ability && (
              <Badge variant="secondary" className="text-xs">
                {rule.ability}
              </Badge>
            )}
            <Badge variant="outline" className="ml-auto text-xs">
              {rule.category}
            </Badge>
          </div>
          <CardDescription>{rule.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm mb-1 text-primary">Game Mechanics:</h4>
            <p className="text-sm bg-muted p-2 rounded">{rule.mechanics}</p>
          </div>
          {rule.examples && rule.examples.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2 text-primary">Common Examples:</h4>
              <ul className="text-sm space-y-1">
                {rule.examples.map((example, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>{example}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-fantasy text-primary mb-2">D&D Rules Reference</h1>
        <p className="text-muted-foreground">
          Complete reference for D&D 5e SRD mechanics, skills, conditions, and combat actions. Learn the rules as you play!
        </p>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search rules, skills, conditions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-rules"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 h-auto">
          <TabsTrigger value="skills" className="flex flex-col items-center gap-1 text-xs py-2" data-testid="tab-skills">
            <Dice6 className="h-4 w-4" />
            Skills
            <Badge variant="secondary" className="text-xs">{SKILLS.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="conditions" className="flex flex-col items-center gap-1 text-xs py-2" data-testid="tab-conditions">
            <Zap className="h-4 w-4" />
            Conditions
            <Badge variant="secondary" className="text-xs">{CONDITIONS.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="combat" className="flex flex-col items-center gap-1 text-xs py-2" data-testid="tab-combat">
            <Sword className="h-4 w-4" />
            Combat
            <Badge variant="secondary" className="text-xs">{COMBAT_ACTIONS.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="saves" className="flex flex-col items-center gap-1 text-xs py-2" data-testid="tab-saves">
            <Shield className="h-4 w-4" />
            Saves
            <Badge variant="secondary" className="text-xs">{SAVING_THROWS.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="rest" className="flex flex-col items-center gap-1 text-xs py-2" data-testid="tab-rest">
            <Moon className="h-4 w-4" />
            Rest
            <Badge variant="secondary" className="text-xs">{REST_RECOVERY.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="movement" className="flex flex-col items-center gap-1 text-xs py-2" data-testid="tab-movement">
            <Footprints className="h-4 w-4" />
            Movement
            <Badge variant="secondary" className="text-xs">{MOVEMENT_TERRAIN.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="skills">
            <div className="mb-4 p-4 bg-muted rounded-lg">
              <h3 className="font-bold mb-2">About Skills</h3>
              <p className="text-sm text-muted-foreground">
                Skills represent specific aspects of an ability score that a character can be proficient in. 
                When you make an ability check, you can add your proficiency bonus if you're proficient in the relevant skill.
                Each skill is tied to an ability: Strength, Dexterity, Constitution, Intelligence, Wisdom, or Charisma.
              </p>
            </div>
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {getRulesForCategory("skills").map((rule, index) => (
                  <RuleCard key={index} rule={rule} />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="conditions">
            <div className="mb-4 p-4 bg-muted rounded-lg">
              <h3 className="font-bold mb-2">About Conditions</h3>
              <p className="text-sm text-muted-foreground">
                Conditions alter a creature's capabilities and are usually imposed by spells, class features, monster attacks, or environmental effects.
                Most conditions are negatives, but some (like invisible) can be beneficial. Multiple conditions can affect a creature simultaneously.
              </p>
            </div>
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {getRulesForCategory("conditions").map((rule, index) => (
                  <RuleCard key={index} rule={rule} />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="combat">
            <div className="mb-4 p-4 bg-muted rounded-lg">
              <h3 className="font-bold mb-2">About Combat Actions</h3>
              <p className="text-sm text-muted-foreground">
                On your turn in combat, you can move up to your speed and take one action. You also have one bonus action and one reaction per round.
                The actions listed here are available to all characters. Some classes and features grant additional action options.
              </p>
            </div>
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {getRulesForCategory("combat").map((rule, index) => (
                  <RuleCard key={index} rule={rule} />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="saves">
            <div className="mb-4 p-4 bg-muted rounded-lg">
              <h3 className="font-bold mb-2">About Saving Throws</h3>
              <p className="text-sm text-muted-foreground">
                A saving throw represents an attempt to resist a spell, trap, poison, disease, or similar threat.
                You roll d20 + the relevant ability modifier + proficiency bonus (if proficient). Each class is proficient in two saving throws.
              </p>
            </div>
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {getRulesForCategory("saves").map((rule, index) => (
                  <RuleCard key={index} rule={rule} />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="rest">
            <div className="mb-4 p-4 bg-muted rounded-lg">
              <h3 className="font-bold mb-2">About Rest & Recovery</h3>
              <p className="text-sm text-muted-foreground">
                Adventurers need rest to recover from their exertions. Short rests allow limited recovery during the day, 
                while long rests fully restore your capabilities. Managing rest is crucial for survival in dangerous situations.
              </p>
            </div>
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {getRulesForCategory("rest").map((rule, index) => (
                  <RuleCard key={index} rule={rule} />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="movement">
            <div className="mb-4 p-4 bg-muted rounded-lg">
              <h3 className="font-bold mb-2">About Movement & Terrain</h3>
              <p className="text-sm text-muted-foreground">
                Movement in D&D includes walking, running, climbing, swimming, and jumping. Different terrain types affect how quickly you can move.
                Understanding movement rules helps you position strategically in combat and navigate challenging environments.
              </p>
            </div>
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {getRulesForCategory("movement").map((rule, index) => (
                  <RuleCard key={index} rule={rule} />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>

      <Card className="mt-6 bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Dice6 className="h-5 w-5" />
            Quick Tips for New Players
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>When in doubt, ask!</strong> Your DM is there to help explain rules and situations.</p>
          <p><strong>Describe your intent:</strong> Instead of just saying "I attack," describe what you're trying to achieve.</p>
          <p><strong>Use your skills:</strong> Remember you have proficiencies - use them to solve problems creatively!</p>
          <p><strong>Teamwork matters:</strong> The Help action can give allies advantage on their rolls.</p>
          <p><strong>Know your conditions:</strong> Understanding conditions helps you play smarter in combat.</p>
        </CardContent>
      </Card>
    </div>
  );
}
