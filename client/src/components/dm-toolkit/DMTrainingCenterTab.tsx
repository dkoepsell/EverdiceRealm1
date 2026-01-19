import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BookOpen,
  CheckCircle,
  Users,
  Shield,
  Swords,
  Map,
  Star,
  Lightbulb,
  AlertTriangle,
  Target,
  Clock,
  Brain,
  Heart,
  Zap,
  Globe,
  ChevronRight,
  Sparkles,
  Dice5,
  MessageSquare,
  Scroll,
  Crown,
  Compass,
  Drama,
  Layers,
} from "lucide-react";

interface TrainingModule {
  id: string;
  title: string;
  description: string;
  duration: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  icon: any;
  lessons: TrainingLesson[];
}

interface TrainingLesson {
  id: string;
  title: string;
  content: string;
  keyPoints: string[];
  tips: string[];
  commonMistakes: string[];
  practiceExercises: string[];
  platformTips?: string[];
}

const trainingModules: TrainingModule[] = [
  {
    id: "basics",
    title: "DM Fundamentals",
    description: "Essential skills and mindset every new DM needs",
    duration: "60 min",
    difficulty: "beginner",
    icon: BookOpen,
    lessons: [
      {
        id: "role",
        title: "Understanding Your Role as DM",
        content: "As a Dungeon Master, you wear many hats: storyteller, referee, world-builder, and facilitator. Your primary job isn't to 'beat' the players or force them down a specific path. Instead, you're creating a collaborative story where everyone—including you—has fun. Think of yourself as the director of an improvisational play where the actors (your players) have complete freedom to do anything they can imagine.",
        keyPoints: [
          "You're a facilitator, not an adversary—root for your players to succeed",
          "Your role is to present interesting challenges and react to player choices",
          "The rules are guidelines; fun always comes first",
          "You control the world, but players control their characters",
          "Mistakes are part of learning—every DM makes them"
        ],
        tips: [
          "Focus on player enjoyment over strict rule adherence",
          "Say 'yes, and...' or 'yes, but...' more often than 'no'",
          "Let players be creative with solutions you didn't anticipate",
          "Remember that you're all telling a story together",
          "It's okay to not know every rule—look things up or make a ruling"
        ],
        commonMistakes: [
          "Being too rigid with rules at the expense of fun",
          "Creating an adversarial 'DM vs Players' dynamic",
          "Over-planning every detail and railroading players",
          "Not letting player choices meaningfully affect the story",
          "Trying to be perfect instead of having fun"
        ],
        practiceExercises: [
          "Read through the basic rules once (don't memorize, just familiarize)",
          "Watch 2-3 episodes of actual play shows like Critical Role or Dimension 20",
          "Practice describing a room out loud in 30 seconds",
          "Write down 5 things that would make YOUR ideal D&D session"
        ],
        platformTips: [
          "Use the Campaign Builder to set up your first campaign with AI-generated hooks",
          "The AI Story Tools can help you improvise when players surprise you",
          "Keep the dice roller handy—players love seeing their results in real-time"
        ]
      },
      {
        id: "preparation",
        title: "Session Preparation Essentials",
        content: "The secret to great DMing isn't memorizing rules or planning every detail—it's preparing flexible elements that can adapt to any situation. Think of preparation like packing a toolkit: you bring the right tools, not a finished product. Prepare NPCs, locations, and encounters that you can deploy whenever needed, regardless of which direction players go.",
        keyPoints: [
          "Prepare situations and NPCs, not scripts or specific outcomes",
          "Know your main NPCs' motivations—what do they want?",
          "Have 2-3 'pocket encounters' ready to drop in anywhere",
          "Create a list of 20+ random names for improvised NPCs",
          "Review player backstories before each session for hooks"
        ],
        tips: [
          "Spend 30-60 minutes prepping per 3-4 hours of play",
          "Prep in bullet points, not full paragraphs",
          "Keep notes on what players said they want to do next",
          "Have a 'random NPC' table with personality traits",
          "End sessions on cliffhangers to make next session prep easier"
        ],
        commonMistakes: [
          "Over-preparing rigid storylines that break when players deviate",
          "Not having any backup content when plans go sideways",
          "Forgetting to incorporate player backstories",
          "Spending hours on content players may never see",
          "Not taking notes during sessions"
        ],
        practiceExercises: [
          "Create a simple tavern with 3 NPCs (name, personality, secret)",
          "Design one quick combat encounter with 2-3 enemies",
          "Write a list of 20 fantasy names you can pronounce",
          "Prep a one-page outline for a short adventure"
        ],
        platformTips: [
          "Use the NPC Generator in DM Toolkit to create backup characters",
          "The Quest Generator can give you side content when players wander",
          "Save your NPCs to your campaign so you can reference them quickly",
          "Use Campaign Notes to track what happened and what players want to do"
        ]
      },
      {
        id: "rules-basics",
        title: "Core Rules You Actually Need",
        content: "You don't need to memorize the entire rulebook. For your first sessions, focus on the core loop: players describe actions, you set a Difficulty Class (DC), they roll a d20 and add modifiers, and you narrate the result. Combat follows initiative order, and each creature gets movement + action + bonus action. Everything else you can look up or make a ruling.",
        keyPoints: [
          "The core mechanic: d20 + modifier vs Difficulty Class (DC)",
          "Easy tasks = DC 10, Medium = DC 15, Hard = DC 20, Nearly impossible = DC 25",
          "Advantage = roll 2d20, take higher; Disadvantage = roll 2d20, take lower",
          "Combat order: Roll initiative, take turns, each turn = move + action + bonus action",
          "When in doubt, make a ruling that seems fair and look it up later"
        ],
        tips: [
          "Keep a rules cheat sheet handy (search 'D&D 5e DM screen' online)",
          "Write down rulings you made to stay consistent",
          "If a rule lookup takes more than 30 seconds, make a ruling and move on",
          "Let players help look up rules for their own abilities",
          "Focus on learning combat rules first—they come up most often"
        ],
        commonMistakes: [
          "Stopping the game for long rule lookups",
          "Not being consistent with your rulings",
          "Over-complicating simple situations",
          "Forgetting that ability checks aren't just for skills",
          "Not asking 'what do you want to accomplish?' before setting DCs"
        ],
        practiceExercises: [
          "Practice setting DCs: What's the DC to climb a wet stone wall? Pick up on a lie?",
          "Run a mock combat with yourself controlling both sides",
          "Read through the Actions in Combat section of the basic rules",
          "Create a personal cheat sheet with rules you want to remember"
        ],
        platformTips: [
          "Everdice handles dice math automatically—just click and roll",
          "Use the integrated dice roller during combat to keep things moving",
          "The platform tracks character stats so you can reference AC and HP quickly"
        ]
      }
    ]
  },
  {
    id: "combat",
    title: "Running Combat Encounters",
    description: "Create exciting, balanced, and memorable battles",
    duration: "75 min",
    difficulty: "beginner",
    icon: Swords,
    lessons: [
      {
        id: "initiative",
        title: "Initiative and Turn Order",
        content: "Combat begins when someone takes a hostile action. At that moment, everyone rolls initiative (d20 + Dexterity modifier). This determines the order of turns for the entire combat. Combat flows in 6-second 'rounds' where each creature acts once. Keep combat moving briskly—aim for 1-2 minutes per turn maximum.",
        keyPoints: [
          "Initiative = d20 + Dexterity modifier (higher goes first)",
          "Roll once for groups of identical monsters to speed things up",
          "Each round represents 6 seconds of in-game time",
          "Ties: Players win ties against monsters; player with higher DEX goes first",
          "Everyone knows the turn order—no secrets here"
        ],
        tips: [
          "Use a visible initiative tracker so everyone knows who's next",
          "Announce 'You're up, and [name] is on deck'",
          "If a player isn't ready, give them 10 seconds, then skip to next",
          "Let players plan their turn while others act",
          "Group initiative for multiple identical enemies"
        ],
        commonMistakes: [
          "Letting turns drag on with decision paralysis",
          "Forgetting whose turn it is",
          "Not reminding players of their available actions",
          "Rolling initiative separately for every goblin in a group of 6",
          "Making initiative secret or complicated"
        ],
        practiceExercises: [
          "Practice tracking initiative for 4 players and 5 monsters",
          "Run a mock 3-round combat tracking everyone's turns",
          "Create index cards for each combatant to shuffle for initiative",
          "Time yourself running a single enemy's turn (aim for 30 seconds)"
        ],
        platformTips: [
          "Use the Live Manager's initiative tracker to manage turn order",
          "The combat tracker shows everyone's HP so you know who's hurt",
          "Click on creatures to see their available actions"
        ]
      },
      {
        id: "balancing",
        title: "Balancing Encounters",
        content: "The goal isn't to kill characters—it's to create tension and challenge. Use Challenge Rating (CR) as a starting point: a monster with CR equal to the party's level is a 'medium' challenge for 4 players. But CR is just a guideline. Watch your players: are they breezing through? Add reinforcements. Struggling badly? The enemies retreat or help arrives.",
        keyPoints: [
          "CR = a rough guide for encounter difficulty, not an exact science",
          "1 monster of party level CR = medium challenge for 4 players",
          "More monsters = exponentially harder (action economy matters)",
          "Include easy fights, hard fights, and deadly fights—variety is key",
          "Always have an escape plan for players if things go south"
        ],
        tips: [
          "Start with easier encounters to gauge party strength",
          "Use 'waves' of enemies rather than throwing everything at once",
          "Add terrain features: cover, elevation, hazards, choke points",
          "Give smart enemies tactical awareness—they'll retreat or call for help",
          "End fights before the last HP—enemies can surrender or flee"
        ],
        commonMistakes: [
          "Making every encounter deadly—players will be paranoid and exhausted",
          "Using only 'stand and fight' battles with no environmental factors",
          "Ignoring party composition (all melee party vs flying enemies = frustrating)",
          "Not adjusting mid-fight when it's clearly too easy or too hard",
          "Killing characters 'because the dice said so' in the first session"
        ],
        practiceExercises: [
          "Design 3 encounters: one easy, one medium, one hard for a level 3 party",
          "Create an encounter with interesting terrain (bridge over lava, thick fog)",
          "Plan how an intelligent enemy would react if losing",
          "Calculate roughly how long your party can survive without healing"
        ],
        platformTips: [
          "Use the Monster section to browse pre-made creatures with balanced stats",
          "The Threat Archetypes help you understand how different monster types behave",
          "Import creatures to your campaign's encounter tracker for easy reference"
        ]
      },
      {
        id: "describing-combat",
        title: "Making Combat Cinematic",
        content: "Combat can feel like a math exercise: 'I attack, I roll 18, I deal 7 damage.' Your job is to make it feel like an action movie. Describe the clash of steel, the spray of blood, the monster's roar of pain. Ask players to describe their attacks. Make critical hits memorable and near-misses tense. The dice provide the mechanics; you provide the drama.",
        keyPoints: [
          "Describe what HAPPENS, not just the numbers",
          "Use all five senses: sounds, smells, the feel of heat from fire",
          "Ask players 'How do you want to do this?' on killing blows",
          "Make critical hits spectacular and critical misses embarrassing (but not punishing)",
          "Vary your descriptions—don't say 'you hit' the same way every time"
        ],
        tips: [
          "Build a vocabulary of combat words: slash, cleave, pierce, blast, shatter",
          "Describe monster reactions to being hit—pain, anger, fear",
          "Use the environment: 'You slam the orc into the wall, cracking the stone'",
          "For misses, describe NEAR misses: 'The arrow whistles past your ear'",
          "Keep a list of dramatic phrases for inspiration"
        ],
        commonMistakes: [
          "Just announcing numbers without narration",
          "Using the same descriptions repeatedly",
          "Not letting players describe their cool moments",
          "Making every attack equally dramatic (save the big descriptions for key moments)",
          "Forgetting that enemies have personalities too"
        ],
        practiceExercises: [
          "Describe the same sword attack 5 different ways",
          "Practice narrating a fight scene from a book or movie as if it were D&D",
          "Write 10 phrases for 'you miss' that still feel exciting",
          "Describe a killing blow for a fighter, a wizard, and a rogue"
        ],
        platformTips: [
          "Use the AI Story Tools for inspiration on dramatic descriptions",
          "The dice roller shows critical hits and misses—perfect moments for big narration"
        ]
      },
      {
        id: "running-monsters",
        title: "Playing Monsters Effectively",
        content: "Monsters aren't video game AI. Intelligent creatures fight smart: they take cover, focus fire on threats, retreat when losing. Animals act on instinct: they flee when hurt, protect their young, don't fight to the death. Undead and constructs follow orders literally. Playing monsters with personality makes combat memorable and tactical.",
        keyPoints: [
          "Intelligent monsters use tactics: flanking, cover, targeting weak foes",
          "Beasts flee at half health or less unless cornered or protecting young",
          "Undead and constructs follow orders until destroyed",
          "Monsters have motivations too—why are they fighting?",
          "Use the monster's abilities! If it can fly, it should fly."
        ],
        tips: [
          "Give each monster type a 'combat personality' before the fight",
          "Have at least one monster try to escape to warn others",
          "Use legendary actions and lair actions—they exist to challenge parties",
          "Monsters can grapple, shove, and use terrain too",
          "Group monsters might have a leader whose death changes their behavior"
        ],
        commonMistakes: [
          "Running all monsters as mindless damage-dealers",
          "Forgetting about monster abilities listed in the stat block",
          "Never having monsters retreat or surrender",
          "Making every monster fight to the death regardless of intelligence",
          "Not using special abilities because 'it's too complicated'"
        ],
        practiceExercises: [
          "Pick 3 monsters and write a 'combat style' for each in 2 sentences",
          "Run a practice fight where the monsters use actual tactics",
          "Decide what would make an intelligent monster surrender or flee",
          "Practice using one monster with a complex ability (like a dragon's breath)"
        ],
        platformTips: [
          "Check the Threat Archetypes for behavioral guidance on running different monster types",
          "Monster stat blocks in the platform include abilities and tactics suggestions"
        ]
      }
    ]
  },
  {
    id: "storytelling",
    title: "Storytelling & Improvisation",
    description: "Bring your world to life with compelling narratives",
    duration: "60 min",
    difficulty: "intermediate",
    icon: Drama,
    lessons: [
      {
        id: "worldbuilding",
        title: "Building Your World",
        content: "You don't need to create an entire world before session one. Start with a single town, a local problem, and a few interesting NPCs. Let your world grow organically based on where players go and what they're interested in. The best worldbuilding happens in collaboration with your players—their backstories can create entire regions of your world.",
        keyPoints: [
          "Start small: one town, one problem, three NPCs",
          "Expand the world based on where players want to go",
          "Create factions with conflicting goals for dynamic storytelling",
          "Let player backstories create parts of your world",
          "Leave blank spaces on your mental map to fill in later"
        ],
        tips: [
          "Name things consistently (culture-based naming conventions help)",
          "Create 'truth about the world' statements: 'Magic is rare and feared'",
          "Give every location at least one interesting feature or secret",
          "Make history matter only when it affects the present",
          "Steal from real history, mythology, and fiction freely"
        ],
        commonMistakes: [
          "Creating thousands of years of history no one will ever learn",
          "Making the world static—things should change whether players act or not",
          "Ignoring player input and interest when building",
          "Over-complicating politics before players are invested",
          "Making every NPC 'just a shopkeeper' with no personality"
        ],
        practiceExercises: [
          "Create a starting town with 3 important NPCs and 1 local problem",
          "Write 5 'truths about the world' for your campaign",
          "Design a simple faction with goals, resources, and enemies",
          "Use a player backstory to create a location in your world"
        ],
        platformTips: [
          "Use the Location Generator to quickly create interesting places",
          "The Quest Generator creates story hooks connected to locations",
          "Save NPCs and locations to your campaign for easy reference"
        ]
      },
      {
        id: "npcs",
        title: "Creating Memorable NPCs",
        content: "Great NPCs don't need elaborate backstories—they need clear motivations, a distinctive trait, and a voice. Every NPC wants something, even if it's just to be left alone. Give each NPC one memorable characteristic: a speech pattern, a physical quirk, or an unusual habit. Players will remember 'the nervous guard who stutters' better than 'Guard Captain Aldric of the Third Watch.'",
        keyPoints: [
          "Every NPC wants something—write it down",
          "One distinctive trait beats ten pages of backstory",
          "Develop voices/mannerisms only for NPCs players will see repeatedly",
          "NPCs have opinions about current events and other NPCs",
          "Let NPCs react differently based on how players treat them"
        ],
        tips: [
          "Keep an index card per important NPC: name, want, trait, secret",
          "Prepare 5-10 throwaway NPCs with just name + trait for improvisation",
          "Change your posture, tone, or pace of speech to differentiate NPCs",
          "Give NPCs relationships with each other, not just with players",
          "Let players' favorite minor NPCs become major characters"
        ],
        commonMistakes: [
          "Giving every NPC a tragic backstory",
          "Making NPCs only exist to give quests or sell items",
          "Using the same voice/mannerism for every NPC",
          "Creating 'DMPC' characters who overshadow players",
          "Forgetting NPC names between sessions"
        ],
        practiceExercises: [
          "Create 10 NPCs with just: name, one-word personality, one want",
          "Practice 3 different NPC voices in front of a mirror",
          "Write how two NPCs would describe each other",
          "Create a 'rival adventuring party' with distinct personalities"
        ],
        platformTips: [
          "The NPC Generator creates characters with motivations and traits",
          "Save important NPCs as Companions to track across sessions",
          "Use Campaign Notes to record how NPCs feel about the party"
        ]
      },
      {
        id: "improvisation",
        title: "Improvisation Techniques",
        content: "Players WILL do things you didn't expect. Improvisation isn't about being clever on the spot—it's about having tools ready. Keep lists of names, locations, and encounters you can drop in anywhere. When surprised, say 'yes, and...' to build on player ideas. Stall for time by asking 'What exactly do you want to accomplish?' while you think.",
        keyPoints: [
          "'Yes, and...' builds on ideas; 'Yes, but...' adds complications",
          "Keep random tables handy: names, traits, complications",
          "When stuck, turn the question back: 'What do you think you find?'",
          "Steal from everything—books, movies, games, history",
          "It's okay to say 'Let me think about that for a second'"
        ],
        tips: [
          "Prepare 20 random names you can assign to any NPC",
          "Have a list of 10 'complications' to make any scene more interesting",
          "Reuse and reskin content—players won't know",
          "Take player ideas and twist them slightly: 'Yes, but there's a catch'",
          "End sessions asking 'What do you plan to do next?' to prep"
        ],
        commonMistakes: [
          "Saying 'no' to creative solutions because you didn't plan for them",
          "Panicking visibly when players go off-script",
          "Trying to force players back to your planned content",
          "Making up random consequences that feel unfair",
          "Never taking breaks when you need to think"
        ],
        practiceExercises: [
          "Practice responding 'Yes, and...' to 10 random player statements",
          "Create a random encounter table for your campaign setting",
          "Take a scene from a movie and improvise D&D stats for it",
          "Practice describing a random room with only 5 seconds of thought"
        ],
        platformTips: [
          "The AI Story Tools can generate content on the fly when you're stuck",
          "Use the Quest Generator for instant side content",
          "The NPC Generator creates full characters in seconds for improvised encounters"
        ]
      },
      {
        id: "pacing",
        title: "Session Pacing and Flow",
        content: "Great sessions have rhythm: tension and release, action and roleplay, challenge and triumph. Watch your players' energy—if they're tired, give them a victory. If they're bored, introduce conflict. End sessions on cliffhangers to build excitement for next time. A well-paced session feels shorter than it is.",
        keyPoints: [
          "Alternate between high-tension and low-tension scenes",
          "Watch player energy and adapt accordingly",
          "Use 'spotlights' to give each player a moment to shine",
          "Time combat encounters—don't let them drag",
          "End on a cliffhanger or dramatic revelation"
        ],
        tips: [
          "If energy drops, introduce something unexpected",
          "Give players downtime between major events to roleplay",
          "Call for breaks every 90 minutes or so",
          "Use 'meanwhile' cuts to keep all players engaged",
          "Don't force every session to have combat—variety matters"
        ],
        commonMistakes: [
          "Every session being non-stop action (exhausting)",
          "Letting combat drag for hours without resolution",
          "Not ending sessions at natural stopping points",
          "Ignoring quiet players while focusing on vocal ones",
          "Rushing players through roleplay to 'get to the good stuff'"
        ],
        practiceExercises: [
          "Plan a session with intentional high/low tension beats",
          "Practice 3 different cliffhanger endings",
          "Time a practice combat and see how to speed it up",
          "Write 'spotlight moments' for each character class"
        ],
        platformTips: [
          "The Live Manager helps you track combat time and keep things moving",
          "Use session notes to track what story beats you want to hit"
        ]
      }
    ]
  },
  {
    id: "first-campaign",
    title: "Building Your First Campaign",
    description: "Create and structure your first adventure arc",
    duration: "90 min",
    difficulty: "beginner",
    icon: Map,
    lessons: [
      {
        id: "campaign-structure",
        title: "Campaign Structure Basics",
        content: "A campaign is a series of connected adventures with an overarching story. For your first campaign, keep it simple: a beginning (the hook), a middle (escalating challenges), and an end (the climax). Don't plan more than 5-10 sessions ahead—campaigns evolve based on player actions. Think of it like a TV season, not a novel.",
        keyPoints: [
          "Start with a clear, simple goal: stop the villain, find the artifact, save the town",
          "Plan in 'arcs' of 3-5 sessions, not entire campaigns",
          "Leave room for player agency to change the story",
          "Create escalating stakes—each adventure should raise the tension",
          "Have a clear 'win condition' so players know what success looks like"
        ],
        tips: [
          "Start at level 1-3 so you and players can learn together",
          "Make the first adventure self-contained but hint at larger threats",
          "Create a 'villain' whose plans happen with or without player intervention",
          "Let the campaign theme emerge from play, don't force it",
          "Keep a 'living document' of campaign notes that evolves"
        ],
        commonMistakes: [
          "Planning 100 sessions before session 1",
          "Making the plot immune to player actions",
          "Starting with world-ending stakes (leave room to escalate)",
          "Not having clear session/arc endings",
          "Changing core story elements without player buy-in"
        ],
        practiceExercises: [
          "Write a one-paragraph campaign pitch (the 'elevator pitch')",
          "Create a villain with clear goals and a timeline",
          "Design the first adventure arc (3-5 sessions)",
          "Write 3 possible endings based on different player choices"
        ],
        platformTips: [
          "Use the Campaign Builder to set up your campaign structure",
          "AI-generated campaign hooks can inspire your starting scenario",
          "Track campaign progress through the Chapter system"
        ]
      },
      {
        id: "session-zero",
        title: "Running Session Zero",
        content: "Session Zero is the most important session of your campaign. It's where you establish expectations, create characters together, and ensure everyone's on the same page. Discuss content boundaries, playstyle preferences, and scheduling. A good Session Zero prevents problems before they start and gets players invested in the story.",
        keyPoints: [
          "Discuss tone and content expectations openly",
          "Create characters together so the party makes sense",
          "Establish 'lines and veils'—content that's off-limits",
          "Set expectations for attendance, scheduling, and player behavior",
          "Create connections between characters for natural party cohesion"
        ],
        tips: [
          "Use a Session Zero checklist to cover all important topics",
          "Let players help define parts of the world through backstories",
          "Discuss what players want from the campaign: roleplay? Combat? Exploration?",
          "Create 2-3 questions for each player about their character's connections",
          "Take notes on player preferences to incorporate later"
        ],
        commonMistakes: [
          "Skipping Session Zero entirely",
          "Not discussing potentially sensitive content",
          "Having players create characters in isolation",
          "Not setting clear expectations about tone and rules",
          "Making Session Zero all business—it should be fun too!"
        ],
        practiceExercises: [
          "Create a Session Zero agenda/checklist",
          "Write a campaign pitch to present to players",
          "Prepare questions to help players connect their characters",
          "Design a short 30-minute 'intro scene' to play after character creation"
        ],
        platformTips: [
          "Create character templates players can use in the Quick Start",
          "Use Campaign Notes to document Session Zero decisions",
          "The character creation system helps players build consistent characters"
        ]
      },
      {
        id: "first-adventure",
        title: "Designing Your First Adventure",
        content: "Your first adventure should be simple: a clear goal, a few challenges, and a satisfying conclusion in 1-3 sessions. Classic structures work: something threatens the town, players investigate, face challenges, and confront the source. Include combat, roleplay, and exploration in roughly equal measure. End with a hook for the next adventure.",
        keyPoints: [
          "One clear goal players can articulate: 'Stop the goblin raids'",
          "3-5 scenes or encounters, not more",
          "Include at least one combat, one roleplay challenge, one puzzle/exploration",
          "A clear villain or threat with understandable motivation",
          "A satisfying resolution that sets up future adventures"
        ],
        tips: [
          "Use the 5-room dungeon structure: Entrance, Puzzle, Trick, Climax, Reward",
          "Make the first quest personal—tie it to player backgrounds",
          "Include multiple ways to 'win' (fight, negotiate, sneak, etc.)",
          "Start with action to hook players immediately",
          "Plant seeds for future adventures in your first session"
        ],
        commonMistakes: [
          "Making the first adventure too long or complicated",
          "Not having a clear objective players can understand",
          "Railroading players into one solution",
          "Starting with boring setup instead of exciting action",
          "Not ending with a hook for the next adventure"
        ],
        practiceExercises: [
          "Design a 5-room dungeon adventure",
          "Write the 'inciting incident' that starts the adventure",
          "Create 3 ways players could solve the main problem",
          "Write the adventure as bullet points, not paragraphs"
        ],
        platformTips: [
          "Use the Quest Generator for adventure ideas",
          "The Campaign Builder can create adventure hooks tied to locations",
          "AI Story Tools can flesh out your adventure outline"
        ]
      },
      {
        id: "player-backstories",
        title: "Incorporating Player Backstories",
        content: "Player backstories are goldmines for campaign content. When players create families, rivals, or unfinished business, they're telling you what they want the campaign to be about. Use these elements! A character's missing sibling can become a plot point. Their hometown can be threatened. Their rival can work for the villain. Players are more invested when the story is personal.",
        keyPoints: [
          "Ask players to leave some backstory details vague for you to fill in",
          "Create campaign connections to at least one element of each backstory",
          "Introduce backstory NPCs gradually—not all at once",
          "Let backstory elements have consequences (good and bad)",
          "Use backstories for character-specific side quests"
        ],
        tips: [
          "Give players a backstory questionnaire before Session Zero",
          "Ask: 'What's unfinished in your character's past?'",
          "Plan at least one 'backstory spotlight' per character per arc",
          "Let backstory NPCs react to the character's growth",
          "Connect different player backstories to create party bonds"
        ],
        commonMistakes: [
          "Ignoring backstories completely after character creation",
          "Using backstory elements without player consultation",
          "Killing off backstory NPCs for 'drama' without consent",
          "Making one player's backstory dominate the campaign",
          "Revealing all backstory secrets immediately"
        ],
        practiceExercises: [
          "Create 5 questions to ask players about their character's past",
          "Take a sample backstory and create 3 adventure hooks from it",
          "Design how two different backstories could connect",
          "Plan a 'backstory revelation' scene for a character"
        ],
        platformTips: [
          "The Character system stores backstory information for reference",
          "Use the Reputation system to track how backstory NPCs view the character",
          "Campaign Notes can organize backstory elements by player"
        ]
      }
    ]
  },
  {
    id: "first-session",
    title: "Running Your First Session",
    description: "Practical guide to your inaugural game night",
    duration: "45 min",
    difficulty: "beginner",
    icon: Crown,
    lessons: [
      {
        id: "day-of-prep",
        title: "Day-of Preparation",
        content: "The day of your first session, do a final review but don't over-prepare. Gather your materials, review key NPCs and encounters, and take a deep breath. Set up early so you're not stressed when players arrive. Remember: your first session doesn't have to be perfect. It just needs to be fun enough that everyone wants to come back.",
        keyPoints: [
          "Review (don't rewrite) your prep 1-2 hours before",
          "Gather all materials: dice, notes, pencils, snacks",
          "Set up the play space 30 minutes early",
          "Have the first scene crystal clear in your mind",
          "Prepare a 'how to play' summary for new players"
        ],
        tips: [
          "Eat before the session—hangry DMs are bad DMs",
          "Have water nearby for your voice",
          "Put your phone on silent (or use it only for rules lookups)",
          "Prepare ambient music if you use it",
          "Have a backup plan if one player can't make it"
        ],
        commonMistakes: [
          "Cramming new prep day-of and stressing yourself out",
          "Not testing your setup (digital tools, microphones, etc.)",
          "Forgetting essential supplies",
          "Not communicating start time clearly to players",
          "Overthinking and psyching yourself out"
        ],
        practiceExercises: [
          "Create a 'day-of checklist' for session prep",
          "Practice your session opening out loud",
          "Set up your DM space and see if everything is accessible",
          "Run through the first encounter in your head once"
        ],
        platformTips: [
          "Log into Everdice and test that your campaign loads",
          "Check that player characters are created and ready",
          "Have the dice roller open and tested before players join"
        ]
      },
      {
        id: "opening-scene",
        title: "The Perfect Opening Scene",
        content: "Start with action, not exposition. Your opening scene should immediately involve the players: they're in the middle of a chase, they witness a crime, the tavern door bursts open. Hook them in the first five minutes. Save the lore and worldbuilding for later—right now, you want players leaning forward, asking 'What do we do?'",
        keyPoints: [
          "Start in the action—in medias res",
          "Give players an immediate choice or problem",
          "Establish the tone quickly through your opening scene",
          "Introduce one memorable NPC or location in the first 10 minutes",
          "End the opening with a clear 'what next?' moment"
        ],
        tips: [
          "Classic openings that work: heist gone wrong, escaping danger, mysterious arrival",
          "Don't start with 'You're all in a tavern...' (unless something exciting happens immediately)",
          "Ask players to introduce themselves through action, not monologue",
          "Use the opening to establish one campaign 'rule' or theme",
          "Have your first line memorized and practiced"
        ],
        commonMistakes: [
          "Starting with 20 minutes of worldbuilding exposition",
          "Making players sit through NPC monologues",
          "Not giving players agency in the opening scene",
          "Starting too slow and losing player attention",
          "Not establishing tone clearly (is this serious? Funny? Dark?)"
        ],
        practiceExercises: [
          "Write 3 different opening scenes for your adventure",
          "Practice delivering your opening scene in under 2 minutes",
          "Create an opening that immediately presents a choice",
          "Write the first line you'll say to start the game"
        ],
        platformTips: [
          "Use the AI narrative tools to help craft compelling opening descriptions",
          "The Live Manager can set the scene with location and NPC details ready"
        ]
      },
      {
        id: "managing-players",
        title: "Managing Players at the Table",
        content: "Your job includes being a traffic cop for attention. Make sure everyone gets 'spotlight time.' Gently redirect off-topic conversations. Handle rule disputes quickly: make a ruling, move on, look it up between sessions. Keep the energy up by reading the room—if players seem bored, something exciting needs to happen.",
        keyPoints: [
          "Everyone should have at least one meaningful moment per session",
          "It's okay to say 'Let's pause that discussion and look it up later'",
          "Address rule disputes with 'Here's my ruling for now, we'll research after'",
          "Read body language—bored players need attention",
          "Handle player conflicts privately, not at the table"
        ],
        tips: [
          "Use a 'spotlight' tracker to ensure equal attention",
          "Ask quiet players directly: 'Elara, what is your character doing?'",
          "Set a 3-minute rule for rule discussions—then ruling, then research",
          "Call short breaks if energy or focus is dropping",
          "Praise good roleplay and teamwork publicly"
        ],
        commonMistakes: [
          "Letting one player dominate all conversations",
          "Getting into 30-minute rule arguments during play",
          "Not noticing when players are checked out",
          "Taking sides in player conflicts",
          "Forgetting to let players shine in their specialty"
        ],
        practiceExercises: [
          "Plan one spotlight moment for each player character",
          "Practice politely redirecting an off-topic conversation",
          "Create a 'rules dispute' response you're comfortable with",
          "Write down each player's character strength to highlight"
        ],
        platformTips: [
          "The player list helps you track who hasn't had a spotlight moment",
          "Use the dice roller publicly so everyone sees fair results"
        ]
      },
      {
        id: "ending-session",
        title: "Ending Sessions Strong",
        content: "How you end a session determines how excited players are for the next one. End on a cliffhanger, a revelation, or after a major victory—never in the middle of combat or when energy is low. In the last 10 minutes, recap what happened, ask what players plan to do next, and thank everyone for playing. A strong ending creates anticipation.",
        keyPoints: [
          "Never end mid-combat—finish the fight or call a break beforehand",
          "Cliffhangers work: 'The door opens, and you see... we'll find out next time!'",
          "Recap major events in the last 5 minutes",
          "Ask 'What do you plan to do next?' for your prep",
          "Thank players for their time and participation"
        ],
        tips: [
          "Watch the clock and start wrapping up 15 minutes before end time",
          "Have 2-3 possible 'end points' in mind during play",
          "End on an emotional high if possible—victory, revelation, dramatic moment",
          "Request feedback: 'What was your favorite moment?'",
          "Tease next session: 'Next time, you'll finally meet the duke...'"
        ],
        commonMistakes: [
          "Playing until people are exhausted and have to leave",
          "Ending sessions at random points without closure",
          "Not leaving time for wrap-up and questions",
          "Forgetting to ask what players want to do next",
          "Ending on a low-energy moment"
        ],
        practiceExercises: [
          "Identify 3 potential 'end points' in your adventure",
          "Write a cliffhanger for your first session",
          "Create end-of-session questions to ask players",
          "Practice a 1-minute session recap"
        ],
        platformTips: [
          "Use Campaign Notes to record session highlights for recap",
          "The Story Threads tracker helps you remember cliffhangers to resolve"
        ]
      }
    ]
  },
  {
    id: "platform-tools",
    title: "Using Everdice Tools",
    description: "Master the platform to enhance your games",
    duration: "45 min",
    difficulty: "beginner",
    icon: Sparkles,
    lessons: [
      {
        id: "campaign-management",
        title: "Campaign Management Basics",
        content: "Everdice is designed to reduce your prep time and enhance your sessions. The Campaign Builder helps you structure your adventure with AI-generated hooks and story elements. Create campaigns, invite players, and let the platform handle the bookkeeping while you focus on the fun parts: storytelling and running encounters.",
        keyPoints: [
          "Campaigns are your central hub—all content lives within them",
          "AI-generated hooks can inspire or fully build adventure structure",
          "Invite players with shareable links or codes",
          "The platform tracks character progress automatically",
          "All dice rolls are logged for reference"
        ],
        tips: [
          "Start a campaign before your first session to explore features",
          "Use AI generation as a starting point, then customize",
          "Keep Campaign Notes updated after each session",
          "Export CAML files for backup or use with other tools",
          "Review the Campaign Dashboard before each session for insights"
        ],
        commonMistakes: [
          "Not exploring platform features before game day",
          "Forgetting to invite players to the campaign",
          "Not using Campaign Notes to track important details",
          "Ignoring AI suggestions that could help",
          "Trying to use every feature at once—start simple"
        ],
        practiceExercises: [
          "Create a test campaign and explore all the menu options",
          "Generate an AI adventure hook and modify it",
          "Invite a friend to test player joining",
          "Practice using the dice roller in different scenarios"
        ],
        platformTips: [
          "The Campaign Builder wizard walks you through setup step by step",
          "AI-generated content is always editable—make it yours",
          "Use chapter markers to organize your campaign timeline"
        ]
      },
      {
        id: "live-session-tools",
        title: "Running Live Sessions with Everdice",
        content: "During live play, Everdice becomes your command center. The Live Manager tracks initiative, HP, and turn order. Dice rolls broadcast to all players automatically. The AI can help you improvise NPC dialogue or generate quick descriptions when you're stuck. Use these tools to keep sessions flowing smoothly.",
        keyPoints: [
          "Live Manager is your combat command center",
          "Initiative tracker keeps combat organized",
          "HP tracking for party and enemies in one view",
          "Real-time dice rolls visible to everyone",
          "AI Story Tools for on-the-fly inspiration"
        ],
        tips: [
          "Open Live Manager at session start, even for roleplay-heavy sessions",
          "Use the AI for quick NPC responses when improvising",
          "Keep the party stats visible for quick reference",
          "Let players roll their own dice for engagement",
          "Use the notes section for real-time session logging"
        ],
        commonMistakes: [
          "Trying to learn the tools during your session",
          "Not having the Live Manager open during combat",
          "Forgetting that AI is available for inspiration",
          "Over-relying on tools instead of engaging players directly",
          "Not practicing with the interface beforehand"
        ],
        practiceExercises: [
          "Run a mock combat using the Live Manager",
          "Practice generating AI NPC dialogue",
          "Test the initiative tracker with sample combatants",
          "Use the dice roller for various skill checks"
        ],
        platformTips: [
          "The Live Manager's 'Control Panel' is your primary session tool",
          "Story Tools generate content without interrupting session flow",
          "World Events can be triggered during play for dynamic storytelling"
        ]
      },
      {
        id: "content-creation",
        title: "Creating Content with AI Assistance",
        content: "The DM Toolkit provides generators for NPCs, locations, quests, items, and monsters. Use these to quickly populate your world or spark ideas. The AI understands D&D conventions and creates balanced, interesting content. You can generate, edit, and save content to your campaign for later use.",
        keyPoints: [
          "NPC Generator creates characters with motivations and personalities",
          "Location Generator builds places with interesting features",
          "Quest Generator creates hooks tied to your campaign",
          "Monster Generator produces balanced stat blocks",
          "All generated content is editable and saveable"
        ],
        tips: [
          "Generate 5-10 backup NPCs before sessions for improvisation",
          "Use location descriptions as inspiration, not scripts",
          "Generate quest hooks for player backstory connections",
          "Save frequently used content to your campaign",
          "Combine generated elements for unique creations"
        ],
        commonMistakes: [
          "Using generated content without customization",
          "Generating during sessions instead of before",
          "Not saving useful generated content",
          "Over-generating and not using what you create",
          "Forgetting that all content is fully editable"
        ],
        practiceExercises: [
          "Generate 5 NPCs and give each one a unique twist",
          "Create a location and add 2 secrets of your own",
          "Generate a quest and connect it to a player backstory",
          "Build a custom monster using the generator"
        ],
        platformTips: [
          "The Threat Archetypes help you understand how to run generated monsters",
          "Generated Companions can be added directly to campaigns",
          "Use the Notes system to organize your generated content"
        ]
      },
      {
        id: "between-sessions",
        title: "Between Session Workflow",
        content: "Everdice helps you prep efficiently between sessions. Review the Campaign Dashboard for story insights. Check character progression and player notes. Use generators to create content for next session. Update your campaign notes with what happened and what's coming. A good between-session workflow makes running sessions easier.",
        keyPoints: [
          "Campaign Dashboard shows AI analysis of your story",
          "Review player character sheets for story hooks",
          "Generate and save content for upcoming sessions",
          "Update notes with session summary and plans",
          "Check Story Threads for unresolved plot points"
        ],
        tips: [
          "Spend 15 minutes reviewing the Dashboard before prepping",
          "Use AI story insights to spot opportunities you might miss",
          "Generate backup content for likely player directions",
          "Update character notes with new developments",
          "Plan next session's key moments based on Dashboard suggestions"
        ],
        commonMistakes: [
          "Not using the Dashboard's AI insights",
          "Forgetting to update notes after sessions",
          "Not preparing content for likely player choices",
          "Ignoring unresolved Story Threads",
          "Over-prepping instead of using platform assistance"
        ],
        practiceExercises: [
          "Review your Campaign Dashboard after your first session",
          "Write a session summary and update campaign notes",
          "Generate 3 pieces of content for your next session",
          "Identify 2 unresolved threads to address next time"
        ],
        platformTips: [
          "The Campaign Dashboard's AI analysis improves with each session",
          "Story Threads help you track promises you've made to players",
          "Use the CAML export for detailed campaign backups"
        ]
      }
    ]
  },
  {
    id: "advanced",
    title: "Advanced DM Techniques",
    description: "Level up your DMing skills",
    duration: "60 min",
    difficulty: "advanced",
    icon: Brain,
    lessons: [
      {
        id: "player-types",
        title: "Understanding Player Motivations",
        content: "Different players want different things from D&D. Some live for combat tactics; others want deep roleplay. Some explore every nook; others want clear direction. Understanding what motivates each player helps you create sessions everyone enjoys. The best sessions include something for everyone.",
        keyPoints: [
          "Common player types: Power Gamer, Actor, Explorer, Socializer, Storyteller",
          "Most players are a mix of types in different proportions",
          "Watch what makes each player lean forward or check out",
          "Design sessions with at least one element for each player type",
          "Ask players directly what they enjoy most"
        ],
        tips: [
          "Include tactical combat for your Power Gamers",
          "Create roleplay opportunities for Actors",
          "Hide secrets and lore for Explorers",
          "Add NPC relationships for Socializers",
          "Weave character arcs for Storytellers"
        ],
        commonMistakes: [
          "Designing sessions only for your preferred play style",
          "Ignoring player feedback about what they enjoy",
          "Assuming all players want the same thing",
          "Not adapting when players aren't engaged",
          "Labeling players and never reassessing"
        ],
        practiceExercises: [
          "Identify what type each of your players leans toward",
          "Design a session with at least one hook for each player",
          "Ask players 'What's your favorite D&D moment ever?'",
          "Create a survey for player preferences"
        ],
        platformTips: [
          "Player profiles help you track individual preferences",
          "Campaign Notes can include player motivation reminders"
        ]
      },
      {
        id: "tension-stakes",
        title: "Building Tension and Stakes",
        content: "Tension comes from uncertainty with consequences. Stakes are what players stand to lose. Real tension requires that failure is possible and meaningful. Raise stakes gradually through your campaign—start with personal danger, escalate to loved ones, then communities, then the world. Let players feel the weight of their choices.",
        keyPoints: [
          "Tension = Uncertainty + Consequences",
          "Stakes should escalate as the campaign progresses",
          "Personal stakes (character loss) often hit hardest",
          "Success should feel earned, not guaranteed",
          "Some failures should be allowed to stand"
        ],
        tips: [
          "Use time pressure—countdowns create tension",
          "Threaten what players care about (their base, allies, reputation)",
          "Show consequences of inaction through NPC suffering",
          "Let villains win sometimes—it makes victory sweeter",
          "Balance tension with release—constant high stakes exhausts"
        ],
        commonMistakes: [
          "Always saving players from consequences",
          "Never letting villains succeed",
          "Making every encounter world-ending",
          "Not establishing what players care about before threatening it",
          "Removing all uncertainty for player comfort"
        ],
        practiceExercises: [
          "Design 3 escalating stakes for a villain's plan",
          "Create a countdown clock for player pressure",
          "Plan consequences for if players fail a major quest",
          "Identify what each character cares about to threaten"
        ],
        platformTips: [
          "World Events create ongoing threats players must respond to",
          "The Story Threads system helps track escalating plot lines"
        ]
      },
      {
        id: "challenging-scenarios",
        title: "Handling Difficult Scenarios",
        content: "Some situations challenge even experienced DMs: player conflict, character death, sensitive topics, rules lawyers, and problem players. Have plans for these before they happen. Communicate openly, set boundaries clearly, and don't be afraid to pause the game to address issues. A good DM protects the table's fun.",
        keyPoints: [
          "Prevention is better than cure—set expectations in Session Zero",
          "Address problems early before they escalate",
          "Pause the game if something feels wrong",
          "Handle player conflicts privately when possible",
          "Character death should be meaningful, not random"
        ],
        tips: [
          "Establish 'Lines and Veils' for sensitive content",
          "Create a safe word/gesture to pause if someone is uncomfortable",
          "Discuss character death expectations before it can happen",
          "Talk to problem players privately first, kindly but clearly",
          "Know when to end a session early if things go sideways"
        ],
        commonMistakes: [
          "Ignoring problems hoping they'll resolve themselves",
          "Publicly calling out players for behavior issues",
          "Not having safety tools in place",
          "Surprising players with death without warning",
          "Taking sides in player conflicts"
        ],
        practiceExercises: [
          "Create a personal 'how to handle conflict' script",
          "Decide your stance on character death for your campaign",
          "Prepare language for pausing the game when needed",
          "Identify potential sensitive topics in your campaign to address"
        ],
        platformTips: [
          "Campaign Notes can document agreed-upon content boundaries",
          "Use private messaging for sensitive DM-player conversations"
        ]
      },
      {
        id: "long-campaigns",
        title: "Sustaining Long Campaigns",
        content: "Multi-year campaigns require different skills than one-shots. You need to track continuity, keep players engaged over time, and evolve the world meaningfully. Plan in seasons with natural break points. Let the campaign grow with your players. The goal is that the ending feels earned because of the journey.",
        keyPoints: [
          "Plan campaigns in 'seasons' of 10-15 sessions with natural endings",
          "Document everything—you WILL forget details",
          "Let the world change in response to player actions",
          "Build toward character arcs and story payoffs",
          "Allow for character retirement and new character introduction"
        ],
        tips: [
          "Create 'season recaps' to remind everyone of key events",
          "Establish recurring NPCs who grow and change",
          "Plant seeds early that pay off later (foreshadowing)",
          "Build in 'downtime' periods for character development",
          "Be willing to evolve the campaign's direction based on player interest"
        ],
        commonMistakes: [
          "Not taking notes and losing continuity",
          "Keeping the status quo despite player actions",
          "Never paying off foreshadowing",
          "Rushing to the 'ending' you planned",
          "Burning out from constant high-intensity sessions"
        ],
        practiceExercises: [
          "Design a 3-season arc with escalating stakes",
          "Create a 'campaign bible' document for tracking lore",
          "Plan 5 foreshadowing moments for future payoffs",
          "Design a 'downtime session' between major arcs"
        ],
        platformTips: [
          "The Chapter system helps organize long campaigns",
          "CAML export preserves your campaign data for long-term storage",
          "World Memory system tracks player discoveries across sessions",
          "Story Threads help you remember what needs resolution"
        ]
      }
    ]
  }
];

export default function DMTrainingCenterTab() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [activeLesson, setActiveLesson] = useState<string | null>(null);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());

  const totalLessons = trainingModules.reduce((sum, m) => sum + m.lessons.length, 0);
  const completedCount = completedLessons.size;
  const overallProgress = (completedCount / totalLessons) * 100;

  const markLessonComplete = (lessonId: string) => {
    setCompletedLessons(prev => new Set([...prev, lessonId]));
  };

  const currentModule = trainingModules.find(m => m.id === activeModule);
  const currentLesson = currentModule?.lessons.find(l => l.id === activeLesson);

  if (activeModule && currentLesson) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button 
              variant="ghost" 
              onClick={() => setActiveLesson(null)}
              className="mb-2"
            >
              ← Back to {currentModule.title}
            </Button>
            <h2 className="text-2xl font-fantasy font-semibold">{currentLesson.title}</h2>
            <p className="text-muted-foreground">{currentModule.title}</p>
          </div>
          <Badge variant={completedLessons.has(currentLesson.id) ? "default" : "outline"}>
            {completedLessons.has(currentLesson.id) ? "Completed" : "In Progress"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BookOpen className="h-5 w-5" />
                  <span>Lesson Content</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm leading-relaxed">
                  {currentLesson.content}
                </p>
                
                <div>
                  <h4 className="font-medium mb-3 flex items-center">
                    <Target className="h-4 w-4 mr-2 text-primary" />
                    Key Points
                  </h4>
                  <ul className="space-y-2">
                    {currentLesson.keyPoints.map((point, index) => (
                      <li key={index} className="text-sm flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3 flex items-center">
                    <Lightbulb className="h-4 w-4 mr-2 text-yellow-600" />
                    Pro Tips
                  </h4>
                  <ul className="space-y-2">
                    {currentLesson.tips.map((tip, index) => (
                      <li key={index} className="text-sm flex items-start space-x-2">
                        <Star className="h-3 w-3 mt-1 text-yellow-600 flex-shrink-0" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-2 text-red-600" />
                    Common Mistakes to Avoid
                  </h4>
                  <ul className="space-y-2">
                    {currentLesson.commonMistakes.map((mistake, index) => (
                      <li key={index} className="text-sm flex items-start space-x-2">
                        <AlertTriangle className="h-3 w-3 mt-1 text-red-600 flex-shrink-0" />
                        <span>{mistake}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5" />
                  <span>Practice Exercises</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {currentLesson.practiceExercises.map((exercise, index) => (
                    <li key={index} className="text-sm flex items-start space-x-2">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-medium text-primary">{index + 1}</span>
                      </div>
                      <span>{exercise}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {currentLesson.platformTips && currentLesson.platformTips.length > 0 && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-base">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <span>Everdice Tips</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {currentLesson.platformTips.map((tip, index) => (
                      <li key={index} className="text-sm flex items-start space-x-2">
                        <ChevronRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="space-y-3">
              {!completedLessons.has(currentLesson.id) && (
                <Button 
                  className="w-full"
                  onClick={() => markLessonComplete(currentLesson.id)}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Complete
                </Button>
              )}
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  const currentLessonIndex = currentModule.lessons.findIndex(l => l.id === activeLesson);
                  const nextLesson = currentModule.lessons[currentLessonIndex + 1];
                  if (nextLesson) {
                    setActiveLesson(nextLesson.id);
                  } else {
                    setActiveLesson(null);
                  }
                }}
              >
                {currentModule.lessons.findIndex(l => l.id === activeLesson) < currentModule.lessons.length - 1 
                  ? "Next Lesson →" 
                  : "Return to Module"
                }
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeModule) {
    const module = trainingModules.find(m => m.id === activeModule)!;
    const moduleCompletedLessons = module.lessons.filter(l => completedLessons.has(l.id)).length;
    const moduleProgress = (moduleCompletedLessons / module.lessons.length) * 100;
    const ModuleIcon = module.icon;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button 
              variant="ghost" 
              onClick={() => setActiveModule(null)}
              className="mb-2"
            >
              ← Back to Training Center
            </Button>
            <h2 className="text-2xl font-fantasy font-semibold flex items-center gap-3">
              <ModuleIcon className="h-6 w-6 text-primary" />
              {module.title}
            </h2>
            <p className="text-muted-foreground">{module.description}</p>
          </div>
          <div className="text-right">
            <Badge variant={module.difficulty === "beginner" ? "default" : module.difficulty === "intermediate" ? "secondary" : "destructive"}>
              {module.difficulty}
            </Badge>
            <p className="text-sm text-muted-foreground mt-1 flex items-center justify-end">
              <Clock className="h-3 w-3 mr-1" />
              {module.duration}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Module Progress</span>
              <span className="text-sm font-normal">{moduleCompletedLessons}/{module.lessons.length} lessons</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={moduleProgress} className="w-full" />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4">
          {module.lessons.map((lesson, index) => (
            <Card 
              key={lesson.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                completedLessons.has(lesson.id) ? "border-green-200 bg-green-50/50" : "hover:border-primary"
              }`}
              onClick={() => setActiveLesson(lesson.id)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      completedLessons.has(lesson.id) 
                        ? "bg-green-600 text-white" 
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {completedLessons.has(lesson.id) ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <span className="text-sm font-semibold">{index + 1}</span>
                      )}
                    </div>
                    <span>{lesson.title}</span>
                  </CardTitle>
                  <Button variant="outline" size="sm">
                    {completedLessons.has(lesson.id) ? "Review" : "Start"} →
                  </Button>
                </div>
                <CardDescription className="ml-11">
                  {lesson.keyPoints[0]}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center gap-2 px-4 py-1 bg-primary/10 rounded-full text-sm text-primary font-medium">
          <BookOpen className="h-4 w-4" />
          Complete DM Training Program
        </div>
        <h2 className="text-3xl font-fantasy font-semibold bg-gradient-to-r from-amber-600 via-orange-500 to-red-500 bg-clip-text text-transparent">
          DM Training Center
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Master the art of Dungeon Mastering from your first session to running epic campaigns. 
          These lessons cover everything you need—whether you're running a tabletop game or using Everdice online.
        </p>
        
        <Card className="max-w-md mx-auto">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span>Your Progress</span>
              <span className="text-sm font-normal">{completedCount}/{totalLessons} lessons</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={overallProgress} className="w-full" />
            <p className="text-xs text-muted-foreground mt-2">
              {overallProgress === 0 ? "Start your journey to becoming a great DM!" : 
               overallProgress < 50 ? "You're making progress! Keep learning." :
               overallProgress < 100 ? "Almost there! You're becoming a confident DM." :
               "Congratulations! You've completed all training modules!"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {trainingModules.map((module) => {
          const moduleCompletedLessons = module.lessons.filter(l => completedLessons.has(l.id)).length;
          const moduleProgress = (moduleCompletedLessons / module.lessons.length) * 100;
          const ModuleIcon = module.icon;
          
          return (
            <Card 
              key={module.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                moduleProgress === 100 ? "border-green-200 bg-green-50/50" : "hover:border-primary"
              }`}
              onClick={() => setActiveModule(module.id)}
            >
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <ModuleIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={module.difficulty === "beginner" ? "default" : module.difficulty === "intermediate" ? "secondary" : "destructive"}>
                      {module.difficulty}
                    </Badge>
                  </div>
                </div>
                <CardTitle className="text-lg">{module.title}</CardTitle>
                <CardDescription>{module.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {module.duration}
                    </span>
                    <span>{moduleCompletedLessons}/{module.lessons.length} lessons</span>
                  </div>
                  <Progress value={moduleProgress} className="w-full" />
                  <Button className="w-full" variant={moduleProgress === 100 ? "outline" : "default"}>
                    {moduleProgress === 100 ? "Review Module" : moduleProgress > 0 ? "Continue" : "Start Module"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-amber-500" />
            <span>Quick Reference Guides</span>
          </CardTitle>
          <CardDescription>
            Fast answers to common first-time DM questions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="checklist">
              <AccordionTrigger>First Session Checklist</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <p className="text-sm font-medium">Before the Session:</p>
                <ul className="text-sm space-y-1 ml-4">
                  <li>☐ Review your adventure outline (don't memorize—familiarize)</li>
                  <li>☐ Know your starting NPCs' names and motivations</li>
                  <li>☐ Prepare the opening scene and first line</li>
                  <li>☐ Have dice, pencils, and notes ready</li>
                  <li>☐ Test any digital tools (Everdice, dice roller, etc.)</li>
                  <li>☐ Eat and hydrate before starting</li>
                </ul>
                <p className="text-sm font-medium mt-4">During the Session:</p>
                <ul className="text-sm space-y-1 ml-4">
                  <li>☐ Start with action, not exposition</li>
                  <li>☐ Give every player at least one spotlight moment</li>
                  <li>☐ When you don't know a rule, make a ruling and move on</li>
                  <li>☐ Take breaks every 90 minutes</li>
                  <li>☐ End on a cliffhanger or exciting moment</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="rules-cheat">
              <AccordionTrigger>Essential Rules Reference</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="text-sm">
                  <p className="font-medium">Core Mechanic:</p>
                  <p className="ml-4 text-muted-foreground">d20 + modifier ≥ DC = success</p>
                </div>
                <div className="text-sm">
                  <p className="font-medium">Difficulty Classes:</p>
                  <ul className="ml-4 text-muted-foreground">
                    <li>Easy: DC 10 | Medium: DC 15 | Hard: DC 20 | Very Hard: DC 25</li>
                  </ul>
                </div>
                <div className="text-sm">
                  <p className="font-medium">Combat Turn:</p>
                  <ul className="ml-4 text-muted-foreground">
                    <li>Move (up to speed) + Action + Bonus Action + Free Object Interaction</li>
                  </ul>
                </div>
                <div className="text-sm">
                  <p className="font-medium">Common Actions:</p>
                  <ul className="ml-4 text-muted-foreground">
                    <li>Attack, Cast Spell, Dash, Disengage, Dodge, Help, Hide, Ready, Search, Use Object</li>
                  </ul>
                </div>
                <div className="text-sm">
                  <p className="font-medium">Advantage/Disadvantage:</p>
                  <ul className="ml-4 text-muted-foreground">
                    <li>Roll 2d20, take higher (advantage) or lower (disadvantage). They cancel out.</li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="improv-help">
              <AccordionTrigger>Improvisation Lifelines</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="text-sm">
                  <p className="font-medium">When players do something unexpected:</p>
                  <ul className="ml-4 text-muted-foreground space-y-1">
                    <li>• "That's interesting—what exactly are you trying to accomplish?"</li>
                    <li>• "Yes, and..." or "Yes, but there's a complication..."</li>
                    <li>• Take a 30-second pause: "Let me think about how that would work."</li>
                  </ul>
                </div>
                <div className="text-sm mt-3">
                  <p className="font-medium">When you need to stall:</p>
                  <ul className="ml-4 text-muted-foreground space-y-1">
                    <li>• Ask players to describe their actions in more detail</li>
                    <li>• Have an NPC ask a clarifying question</li>
                    <li>• Call for a skill check while you think</li>
                    <li>• "Before you do that, you notice..." (describe the environment)</li>
                  </ul>
                </div>
                <div className="text-sm mt-3">
                  <p className="font-medium">When you're truly stuck:</p>
                  <ul className="ml-4 text-muted-foreground space-y-1">
                    <li>• Call a 5-minute break</li>
                    <li>• Use Everdice's AI Story Tools for inspiration</li>
                    <li>• It's okay to say "Let's pause here and pick up next time"</li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="platform-quick">
              <AccordionTrigger>Everdice Quick Tips</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="text-sm">
                  <p className="font-medium">For Session Prep:</p>
                  <ul className="ml-4 text-muted-foreground space-y-1">
                    <li>• Use Campaign Builder to set up structure with AI assistance</li>
                    <li>• Generate backup NPCs with the NPC Generator before each session</li>
                    <li>• Check Campaign Dashboard for AI story insights</li>
                  </ul>
                </div>
                <div className="text-sm mt-3">
                  <p className="font-medium">During Play:</p>
                  <ul className="ml-4 text-muted-foreground space-y-1">
                    <li>• Live Manager tracks initiative and HP in one view</li>
                    <li>• Dice roller broadcasts results to all players</li>
                    <li>• AI Story Tools can generate descriptions when you're stuck</li>
                  </ul>
                </div>
                <div className="text-sm mt-3">
                  <p className="font-medium">Between Sessions:</p>
                  <ul className="ml-4 text-muted-foreground space-y-1">
                    <li>• Update Campaign Notes with session summary</li>
                    <li>• Check Story Threads for unresolved plot points</li>
                    <li>• Use generators to prep content for likely player choices</li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
