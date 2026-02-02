import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Sparkles, 
  ChevronLeft, 
  ChevronRight,
  X,
  Sword,
  Wand2,
  Shield,
  Moon,
  Dices,
  Heart,
  Zap,
  MapPin,
  Clock,
  Users,
  ArrowRight,
  BookOpen,
  Flame,
  Eye,
  MessageSquare,
  Footprints,
  Skull,
  Crown,
  ScrollText
} from "lucide-react";

interface CharacterTemplate {
  id: string;
  name: string;
  class: string;
  race: string;
  icon: any;
  color: string;
  bgColor: string;
  description: string;
  hitPoints: number;
  armorClass: number;
  level: number;
  abilities: { name: string; bonus: number }[];
  traits: string[];
}

interface AdventureTheme {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: any;
  color: string;
  atmosphere: string;
  difficulty: string;
}

interface StoryScene {
  id: number;
  title: string;
  location: string;
  narrative: string;
  atmosphere: string;
  sceneType: "exploration" | "social" | "discovery" | "combat";
  choices?: { id: string; text: string; icon: any }[];
  requiresRoll?: { type: string; dc: number; skill: string };
  outcomeSuccess?: string;
  outcomeFailure?: string;
}

const CHARACTER_TEMPLATES: CharacterTemplate[] = [
  {
    id: "warrior",
    name: "Theron Blackblade",
    class: "Fighter",
    race: "Human",
    icon: Sword,
    color: "from-red-500 to-orange-500",
    bgColor: "bg-red-950/40",
    description: "A battle-hardened veteran with unmatched combat prowess",
    hitPoints: 12,
    armorClass: 16,
    level: 1,
    abilities: [
      { name: "Strength", bonus: 3 },
      { name: "Constitution", bonus: 2 }
    ],
    traits: ["Second Wind", "Fighting Style: Defense"]
  },
  {
    id: "wizard",
    name: "Elara Moonwhisper",
    class: "Wizard",
    race: "High Elf",
    icon: Wand2,
    color: "from-purple-500 to-indigo-500",
    bgColor: "bg-purple-950/40",
    description: "A scholarly mage who bends reality with arcane mastery",
    hitPoints: 8,
    armorClass: 12,
    level: 1,
    abilities: [
      { name: "Intelligence", bonus: 3 },
      { name: "Wisdom", bonus: 2 }
    ],
    traits: ["Arcane Recovery", "Spellcasting"]
  },
  {
    id: "paladin",
    name: "Ser Roland Dawnkeeper",
    class: "Paladin",
    race: "Human",
    icon: Shield,
    color: "from-yellow-500 to-amber-500",
    bgColor: "bg-yellow-950/40",
    description: "A holy warrior sworn to protect the innocent",
    hitPoints: 11,
    armorClass: 18,
    level: 1,
    abilities: [
      { name: "Charisma", bonus: 3 },
      { name: "Strength", bonus: 2 }
    ],
    traits: ["Divine Sense", "Lay on Hands"]
  },
  {
    id: "rogue",
    name: "Vex Shadowmere",
    class: "Rogue",
    race: "Halfling",
    icon: Moon,
    color: "from-slate-400 to-zinc-500",
    bgColor: "bg-slate-900/60",
    description: "A cunning operative who thrives in the shadows",
    hitPoints: 9,
    armorClass: 14,
    level: 1,
    abilities: [
      { name: "Dexterity", bonus: 3 },
      { name: "Intelligence", bonus: 2 }
    ],
    traits: ["Sneak Attack", "Thieves' Cant"]
  }
];

const ADVENTURE_THEMES: AdventureTheme[] = [
  {
    id: "dungeon",
    name: "The Forgotten Crypts",
    tagline: "Ancient secrets await in darkness",
    description: "Beneath the ruined temple lies a crypt untouched for centuries. Strange lights have been seen flickering in the depths, and treasure hunters who entered never returned.",
    icon: Skull,
    color: "from-stone-500 to-slate-600",
    atmosphere: "Dark stone corridors echo with whispers of the past",
    difficulty: "Challenging"
  },
  {
    id: "mystery",
    name: "The Merchant's Secret",
    tagline: "Not all treasures are what they seem",
    description: "The wealthiest merchant in Millbrook has been found dead in a locked room. The town guard suspects foul play, but dark magic may be involved. Can you uncover the truth?",
    icon: Eye,
    color: "from-emerald-500 to-teal-500",
    atmosphere: "Cobblestone streets wet with rain, suspicious glances everywhere",
    difficulty: "Moderate"
  }
];

function generateStoryScenes(characterClass: string, theme: string): StoryScene[] {
  const stories: Record<string, Record<string, StoryScene[]>> = {
    dungeon: {
      Fighter: [
        {
          id: 1,
          title: "The Descent Begins",
          location: "Temple Ruins - Crypt Entrance",
          narrative: "The iron gates groan as you push them aside, rust flaking onto your gauntlets. Cold air rushes past — the breath of the crypt itself. Your torchlight reveals worn stone steps descending into absolute darkness. On the walls, faded murals depict warriors in ancient armor, their painted eyes seeming to follow your every move.\n\nYour sword hand instinctively moves to your blade. Something about this place feels wrong. Alive.",
          atmosphere: "Torchlight flickers against ancient stone. Distant water drips echo from below.",
          sceneType: "exploration",
          choices: [
            { id: "careful", text: "Proceed carefully, checking for traps", icon: Eye },
            { id: "bold", text: "March forward with torch held high", icon: Flame }
          ]
        },
        {
          id: 2,
          title: "The Guardian's Warning",
          location: "Hall of Forgotten Kings",
          narrative: "The stairway opens into a vast chamber. Towering stone statues of armored warriors line both walls, their empty helm-slits watching you pass. At the far end, a massive door bears an inscription in an ancient tongue — but the symbols seem to shift as you stare at them.\n\nSuddenly, one statue's head turns with a grinding of stone. \"PROVE YOUR WORTH,\" it booms, \"OR JOIN THE ETERNAL GUARD.\"",
          atmosphere: "Stone grinding echoes through the chamber. Dust falls from above.",
          sceneType: "social",
          choices: [
            { id: "challenge", text: "Accept the challenge proudly", icon: Sword },
            { id: "negotiate", text: "Ask what proof is required", icon: MessageSquare }
          ]
        },
        {
          id: 3,
          title: "Trial by Combat",
          location: "The Proving Grounds",
          narrative: "The statue gestures, and the floor splits open to reveal a sunken arena. From the shadows emerges a spectral knight — a ghostly warrior wielding a blade of cold blue fire. It salutes you with its sword, a gesture of respect between warriors.\n\n\"Defeat me,\" the spirit speaks, its voice echoing from everywhere and nowhere, \"and the crypt's secrets are yours. Fail... and serve eternally.\"",
          atmosphere: "Ethereal blue light pulses through the arena. Ancient magic crackles in the air.",
          sceneType: "combat",
          requiresRoll: { type: "Attack", dc: 12, skill: "Strength" },
          outcomeSuccess: "Your blade finds its mark! The spectral knight staggers back, then bows deeply. \"Well struck, warrior. You have earned passage.\" The spirit fades, leaving behind a glowing key.",
          outcomeFailure: "The spirit's blade catches your shield, nearly knocking you down — but you hold your ground! \"Impressive resilience,\" it admits. \"Perhaps you deserve passage after all.\" It grants you the key."
        },
        {
          id: 4,
          title: "The Treasure Vault",
          location: "Chamber of the First King",
          narrative: "Beyond the great door lies the true heart of the crypt. Gold coins carpet the floor. Jeweled weapons hang on the walls. And upon a throne of carved obsidian sits a skeleton in royal armor, a crown still resting on its skull.\n\nIn its bony hands: a sword that glows with inner fire. The legendary Dawnblade — lost for a thousand years.\n\nAs you approach, the skeleton's jaw opens. \"Take it,\" a whisper echoes. \"Take it... and carry my legacy...\"",
          atmosphere: "Golden light fills the chamber. The air itself feels ancient and powerful.",
          sceneType: "discovery"
        }
      ],
      Wizard: [
        {
          id: 1,
          title: "Arcane Resonance",
          location: "Temple Ruins - Crypt Entrance",
          narrative: "Your staff pulses with recognition as you approach the crypt entrance. These ruins are saturated with old magic — protective wards that have decayed over centuries, leaving traces of power that tingle against your skin.\n\nArcane symbols carved into the doorframe catch your eye. You recognize the script: an ancient form of Elvish, warning of \"The Sleeping Ward\" below. But warnings often guard the greatest discoveries.",
          atmosphere: "Magical energy crackles faintly. Your staff's crystal glows in response.",
          sceneType: "exploration",
          choices: [
            { id: "analyze", text: "Study the magical wards first", icon: BookOpen },
            { id: "enter", text: "The magic is faded — enter carefully", icon: Footprints }
          ]
        },
        {
          id: 2,
          title: "The Puzzle Chamber",
          location: "Sanctum of Binding",
          narrative: "The passage opens into a circular chamber covered floor-to-ceiling with glowing runes. They pulse in sequence — a magical lock of extraordinary complexity. At the center, suspended by threads of light, floats an ancient grimoire.\n\nAs you watch, you realize the runes form a pattern. A spell sequence. If you can complete it correctly, the book — and its secrets — will be yours.",
          atmosphere: "Runes pulse with soft blue light. The floating book rotates slowly.",
          sceneType: "discovery",
          choices: [
            { id: "solve", text: "Attempt to solve the arcane puzzle", icon: Sparkles },
            { id: "dispel", text: "Try to dispel the protective magic", icon: Zap }
          ]
        },
        {
          id: 3,
          title: "The Test of Knowledge",
          location: "Sanctum of Binding",
          narrative: "You trace the rune pattern with your staff, channeling power through each symbol in sequence. The magic responds — but demands more. The room itself seems to question you, testing whether you truly understand the arcane arts.\n\nEnergy builds around you. One wrong move could trigger ancient defenses. But you didn't spend years studying for nothing.",
          atmosphere: "Power crackles through the air. The grimoire's pages flutter expectantly.",
          sceneType: "discovery",
          requiresRoll: { type: "Arcana Check", dc: 13, skill: "Intelligence" },
          outcomeSuccess: "The final rune blazes gold, and the protective threads dissolve! The grimoire floats gently into your hands. Inside: spells lost for millennia, including the legendary Chrono Stasis.",
          outcomeFailure: "A rune flashes red — but your quick reflexes let you stabilize the sequence! The magic accepts your determination, and the grimoire descends into your waiting hands."
        },
        {
          id: 4,
          title: "Legacy of the Archmage",
          location: "The Hidden Study",
          narrative: "Behind where the grimoire floated, a section of wall shimmers and fades — an illusion hiding a private study. Scrolls, potions, and enchanted artifacts line shelves that haven't been touched in centuries.\n\nA skeleton in mage's robes sits at a desk, a quill still in its hand. Before it: a half-finished letter. \"To whoever finds this... the knowledge here is dangerous. Use it wisely, and perhaps you can prevent what I could not...\"\n\nWhat could the Archmage have been trying to stop?",
          atmosphere: "Dust motes drift through preserved magic. Secrets await discovery.",
          sceneType: "discovery"
        }
      ],
      Paladin: [
        {
          id: 1,
          title: "Sacred Duty Calls",
          location: "Temple Ruins - Crypt Entrance",
          narrative: "Your holy symbol warms against your chest as you approach. This place was once consecrated ground — a temple to the Dawn Father, your own deity. But something has corrupted it. You can feel the taint of undeath seeping from below.\n\nThe temple's remaining carvings tell of heroes who gave their lives defending this place. Their sacrifice deserves to be honored. Their rest deserves to be protected.",
          atmosphere: "Your holy symbol glows softly. Shadows seem to recoil from your presence.",
          sceneType: "exploration",
          choices: [
            { id: "pray", text: "Offer a prayer before entering", icon: Sparkles },
            { id: "cleanse", text: "Begin purifying as you descend", icon: Flame }
          ]
        },
        {
          id: 2,
          title: "The Restless Dead",
          location: "Catacombs of the Faithful",
          narrative: "Your light reveals rows of burial alcoves — priests and paladins who served here long ago. Most rest peacefully. But at the far end of the corridor, skeletal figures shuffle aimlessly, their movement wrong, tortured.\n\nThese were once holy warriors like yourself. Something has bound them here against their will. They turn toward you — not with aggression, but with pleading in their hollow eye sockets. They want release.",
          atmosphere: "Mournful whispers echo. Your divine sense tingles with corrupted energy.",
          sceneType: "social",
          choices: [
            { id: "turn", text: "Channel divine energy to free them", icon: Sparkles },
            { id: "speak", text: "Try to communicate first", icon: MessageSquare }
          ]
        },
        {
          id: 3,
          title: "Breaking the Curse",
          location: "The Defiled Altar",
          narrative: "The source of corruption becomes clear: a dark altar built atop the original sacred site. Black candles burn with cold flame, and profane symbols mar the once-holy stone. A spectral figure in corrupted armor guards it — a fallen paladin, bound by the same curse.\n\n\"Free me,\" it rasps, blade trembling in its grip. \"I cannot stop myself. Destroy the altar... please...\"",
          atmosphere: "Unholy energy radiates from the altar. The fallen paladin weeps ethereal tears.",
          sceneType: "combat",
          requiresRoll: { type: "Divine Strike", dc: 11, skill: "Charisma" },
          outcomeSuccess: "Holy light erupts from your blade as you strike the altar! The dark stone cracks, then shatters. Throughout the catacombs, the bound spirits finally find peace, their grateful whispers filling the air.",
          outcomeFailure: "The altar resists your first strike — but your faith is stronger! With a prayer on your lips, you bring your blade down again. The corruption shatters, and blessed peace returns."
        },
        {
          id: 4,
          title: "Redemption's Reward",
          location: "The Restored Sanctuary",
          narrative: "As the dark magic fades, the catacombs transform. Warm light fills the corridors. The burial alcoves glow with peaceful radiance. The fallen paladin's spirit, now at peace, bows before you.\n\n\"You have done what I could not,\" it says, removing its spectral gauntlet. Where it falls, a real gauntlet materializes — still shimmering with divine power. \"Wear this. Carry on where I failed. The Dawn Father smiles upon you this day.\"",
          atmosphere: "Warm golden light fills the chamber. Peace has been restored.",
          sceneType: "discovery"
        }
      ],
      Rogue: [
        {
          id: 1,
          title: "Professional Interest",
          location: "Temple Ruins - Crypt Entrance",
          narrative: "The job seemed simple enough: get in, get the artifact, get out. But standing at the crypt entrance, your experienced eyes catch what others would miss. Fresh scratches on the lock. Boot prints in the dust, partially obscured. Someone else has been here recently — and tried to cover their tracks.\n\nCompetition. Or perhaps something worse. Either way, you'll need to be careful.",
          atmosphere: "Shadows welcome you like old friends. Every sound is information.",
          sceneType: "exploration",
          choices: [
            { id: "follow", text: "Follow the other intruder's trail", icon: Footprints },
            { id: "alternate", text: "Find a different way in", icon: Eye }
          ]
        },
        {
          id: 2,
          title: "Trap Gallery",
          location: "The Gauntlet Hall",
          narrative: "The corridor ahead is a masterwork of paranoid engineering. Pressure plates, tripwires, poison dart holes, and what looks like a pit trap disguised as solid floor. Whoever built this really didn't want visitors.\n\nBut you've cracked better security. Your fingers itch with anticipation. This is what you live for.",
          atmosphere: "Dust particles reveal hair-thin tripwires. Mechanisms click softly in the walls.",
          sceneType: "exploration",
          choices: [
            { id: "disarm", text: "Carefully disarm the traps", icon: Eye },
            { id: "dance", text: "Navigate through without triggering them", icon: Footprints }
          ]
        },
        {
          id: 3,
          title: "The Rival",
          location: "The Inner Vault",
          narrative: "You emerge from the trapped corridor to find the vault already open — and occupied. A figure in dark leather stands before the treasure, holding the artifact you were sent for: a golden scarab with ruby eyes.\n\n\"Well, well,\" they say without turning. \"I was wondering when you'd catch up. Shall we discuss terms? Or do we do this the hard way?\"",
          atmosphere: "Tension crackles between two professionals. The artifact gleams between you.",
          sceneType: "social",
          requiresRoll: { type: "Deception Check", dc: 12, skill: "Dexterity" },
          outcomeSuccess: "Your hand moves faster than thought — a thrown dagger pins their sleeve to the wall! Before they can react, you've snatched the scarab and vanished into the shadows. \"Better luck next time,\" you call back.",
          outcomeFailure: "They're quick — but you're quicker to the backup plan. Smoke bomb! In the confusion, you grab the scarab and disappear. Not elegant, but effective."
        },
        {
          id: 4,
          title: "Clean Getaway",
          location: "Temple Ruins - Exit",
          narrative: "Fresh night air fills your lungs as you emerge from the crypt, the golden scarab tucked safely in your pack. Behind you, you can hear your rival's frustrated curses echoing up from below.\n\nBut wait — among the rubies in the scarab's eyes, you notice something else. A hidden compartment. Inside: a map, leading to something called 'The Dragon's Hoard.' \n\nTonight was profitable. But the real score? That's still waiting.",
          atmosphere: "Stars glitter above. The night belongs to those who dare.",
          sceneType: "discovery"
        }
      ]
    },
    mystery: {
      Fighter: [
        {
          id: 1,
          title: "A Soldier's Instinct",
          location: "Millbrook - Town Square",
          narrative: "The merchant's manor looms ahead, its windows dark. Town guards mill about nervously — they're used to drunken brawls, not locked-room murders. The captain spots you and relief crosses his weathered face.\n\n\"Thank the gods. Someone who's seen real trouble. The merchant's body is upstairs. Door was locked from inside, windows sealed. No weapon found. And his face...\" He shudders. \"Never seen fear like that on a dead man.\"",
          atmosphere: "Rain patters on cobblestones. Townsfolk whisper behind shuttered windows.",
          sceneType: "discovery",
          choices: [
            { id: "scene", text: "Examine the body and room first", icon: Eye },
            { id: "guards", text: "Question the guards and servants", icon: MessageSquare }
          ]
        },
        {
          id: 2,
          title: "The Hidden Ledger",
          location: "Merchant's Study",
          narrative: "The study is immaculate — too immaculate. A soldier learns to spot when a scene has been staged. You notice the bookshelf is slightly crooked. Behind it: a hidden safe, already cracked open, and a leather-bound ledger.\n\nThe entries are coded, but one name appears repeatedly: 'NIGHTSHADE.' Below it, a list of dates — shipments? meetings? — and substantial gold amounts. The last entry is dated three days ago.",
          atmosphere: "Paper rustles in the draft. The dead merchant's portrait watches silently.",
          sceneType: "discovery",
          choices: [
            { id: "ledger", text: "Study the coded ledger more closely", icon: BookOpen },
            { id: "nightshade", text: "Ask around about 'Nightshade'", icon: Users }
          ]
        },
        {
          id: 3,
          title: "Confrontation at the Docks",
          location: "Millbrook Harbor",
          narrative: "Your investigation leads to the docks at midnight. 'Nightshade' turns out to be a smuggling operation — and the merchant was laundering their gold. But he got greedy, demanded more.\n\nA cloaked figure emerges from the fog. \"You've been asking dangerous questions, soldier. The merchant learned what happens to those who cross us.\" More shapes materialize from the mist. \"Time for another lesson.\"",
          atmosphere: "Fog rolls off black water. Torches flicker in the wet wind.",
          sceneType: "combat",
          requiresRoll: { type: "Intimidation", dc: 12, skill: "Strength" },
          outcomeSuccess: "You draw your blade, its steel singing in the night air. \"I've faced orc war bands,\" you growl. \"You think a few thugs scare me?\" Your reputation precedes you. The assassins exchange glances — then scatter into the fog.",
          outcomeFailure: "They rush you — but you've fought worse odds. Steel clashes in the fog! When it clears, you stand among groaning bodies. One whispers a name before losing consciousness: \"The Countess...\""
        },
        {
          id: 4,
          title: "Justice Served",
          location: "Town Hall - Dawn",
          narrative: "By morning, the truth is laid bare before the town council. The Countess — Millbrook's seemingly benevolent noble patron — secretly controlled Nightshade. The merchant's murder was her order when he threatened to expose her.\n\nGuards lead her away in chains as the sun rises over Millbrook. The captain clasps your shoulder. \"Couldn't have done it without you. The town owes you a debt. If you ever need work...\" He grins. \"We could use someone who gets results.\"",
          atmosphere: "Golden sunrise breaks through storm clouds. Justice dawns over Millbrook.",
          sceneType: "social"
        }
      ],
      Wizard: [
        {
          id: 1,
          title: "Magical Forensics",
          location: "Millbrook - Merchant's Manor",
          narrative: "The town's hedge witch tried and failed to explain the death. That's when they sent for you. One look at the merchant's twisted face tells you what mundane investigators missed: this was no ordinary murder.\n\nFaint traces of necrotic energy linger in the room. Dark magic — specifically, the touch of something summoned from beyond. Someone in this quaint little town has been dabbling in forbidden arts.",
          atmosphere: "Residual magic crackles at the edge of perception. Something lingers here.",
          sceneType: "discovery",
          choices: [
            { id: "trace", text: "Trace the magical signature", icon: Sparkles },
            { id: "library", text: "Research this type of magic", icon: BookOpen }
          ]
        },
        {
          id: 2,
          title: "The Summoner's Trail",
          location: "Millbrook - Old Mill",
          narrative: "The magical traces lead outside town to an abandoned mill. Inside, hidden beneath rotting floorboards, you find a ritual circle drawn in salt and ash. Candle stubs. Bloodstains. And a journal written in cramped, desperate handwriting.\n\nThe writer practiced summoning, calling forth 'shadow servants' to do their bidding. But the last entries grow frantic: 'It won't obey anymore. It demands more. What have I done?'",
          atmosphere: "Dark energy seeps from the ritual site. Pages flutter without wind.",
          sceneType: "discovery",
          choices: [
            { id: "dispel", text: "Attempt to close the planar breach", icon: Sparkles },
            { id: "summon", text: "Carefully summon and question the entity", icon: Eye }
          ]
        },
        {
          id: 3,
          title: "Shadow Confrontation",
          location: "The Space Between",
          narrative: "Your spell tears open reality's fabric, revealing the entity lurking between worlds. It's a shadow demon, small but hungry, grown fat on the fear of its victims. And behind it, glimpsed through the rift: a terrified face you recognize from the town — the apothecary's apprentice.\n\n\"MAKE IT STOP,\" the boy wails. \"I just wanted power. I didn't know—\"\n\nThe demon turns its attention to you. Fresh prey.",
          atmosphere: "Reality twists. Shadows move with hungry intent. The veil is thin here.",
          sceneType: "combat",
          requiresRoll: { type: "Arcana Check", dc: 13, skill: "Intelligence" },
          outcomeSuccess: "Your binding spell catches the demon mid-lunge! Arcane chains wrap around it, dragging it back through the rift. With a final word of power, you seal the breach permanently. The shadow realm recedes.",
          outcomeFailure: "The demon slips your first binding — but you've prepared contingencies! Your backup enchantment activates, and the creature shrieks as it's pulled back into darkness."
        },
        {
          id: 4,
          title: "Knowledge and Mercy",
          location: "Millbrook - Town Square",
          narrative: "The apothecary's apprentice kneels before the town council, confessing everything. He'd found an old spellbook, thought he could use its power to escape his dreary life. He never meant to kill anyone.\n\nThe council looks to you. \"Mage, what say you? Is this boy a danger?\"\n\nThe choice weighs heavy. The boy shows genuine remorse. With proper training, his raw talent could serve good rather than evil. But magic misused demands consequences...\n\nYou choose mercy with conditions: he will train under your supervision, learning to use his gift responsibly.",
          atmosphere: "Sunlight streams through clouds. A second chance offered. A lesson learned.",
          sceneType: "social"
        }
      ],
      Paladin: [
        {
          id: 1,
          title: "Divine Suspicion",
          location: "Millbrook - Temple of Light",
          narrative: "The local priest requested your aid personally. \"There is evil at work here,\" he whispers, glancing nervously at the shadows. \"The merchant's death was no natural thing. Dark powers move in Millbrook, and I fear they have touched even those we trust.\"\n\nYour divine sense confirms his fears. The taint of corruption lingers throughout the town, strongest near the temple itself. Someone close to the faith has fallen from grace.",
          atmosphere: "Incense fails to mask an underlying wrongness. Holy symbols seem to dim.",
          sceneType: "discovery",
          choices: [
            { id: "sense", text: "Use Divine Sense to locate the corruption", icon: Sparkles },
            { id: "investigate", text: "Investigate the temple's inhabitants", icon: Users }
          ]
        },
        {
          id: 2,
          title: "The Fallen Acolyte",
          location: "Temple Crypts",
          narrative: "Your divine senses lead you beneath the temple to forgotten crypts. There, amid defaced holy symbols and guttering black candles, you find the source: Brother Aldric, once a devoted acolyte, now marked with profane tattoos.\n\n\"You don't understand,\" he hisses. \"The light abandoned me! When my sister lay dying, no healing came. But the darkness... the darkness answered.\"",
          atmosphere: "Corruption bleeds from the walls. Holy ground has been desecrated.",
          sceneType: "social",
          choices: [
            { id: "redeem", text: "Try to reach the good still within him", icon: Heart },
            { id: "confront", text: "Demand he face justice for the merchant's death", icon: Sword }
          ]
        },
        {
          id: 3,
          title: "Battle for a Soul",
          location: "Temple Crypts - Inner Sanctum",
          narrative: "Before you can act, Aldric completes a summoning circle. Dark energy pours into him, twisting his features into something inhuman. \"You'll die here, paladin,\" a voice not his own speaks through his lips. \"And I'll walk free in this flesh.\"\n\nBut you see it — in his eyes, the real Aldric, trapped, screaming silently for help. There may still be time to save him.",
          atmosphere: "Holy light clashes with shadow. Two powers war for one man's soul.",
          sceneType: "combat",
          requiresRoll: { type: "Sacred Flame", dc: 11, skill: "Charisma" },
          outcomeSuccess: "Holy light blazes from your outstretched hand! Not to destroy, but to purify. The darkness recoils, shrieking, as Aldric collapses — alive, freed, and weeping with relief.",
          outcomeFailure: "The demon is strong — but your faith is stronger! Your holy symbol blazes like the sun itself, and the possessing spirit flees screaming into the void."
        },
        {
          id: 4,
          title: "Healing and Hope",
          location: "Temple of Light - Dawn",
          narrative: "Aldric kneels before the altar, tears streaming down his face. The corruption fades from his skin as he renews his vows, this time with true understanding. His sister — whom you located at a healer's in the next town — will recover.\n\nThe priest places a hand on your shoulder. \"You could have struck him down. Instead, you saved two souls today. This is what it truly means to serve the light.\"\n\nAldric rises, a changed man. The temple feels brighter somehow. Sometimes the greatest victory is the one no blade can win.",
          atmosphere: "Morning light streams through stained glass. Grace has found this place again.",
          sceneType: "social"
        }
      ],
      Rogue: [
        {
          id: 1,
          title: "Professional Courtesy",
          location: "Millbrook - The Crooked Tankard",
          narrative: "The merchant's death disrupted certain... business arrangements. Your guild master wants answers. Someone killed the man who laundered half the syndicate's gold, and whoever did it either wants war or didn't know who they were crossing.\n\nYou slip into the tavern where information flows as freely as ale. A few coins, a few whispers, and soon you have a direction: the merchant was seen arguing with his wife the night before his death.",
          atmosphere: "Smoke curls through candlelight. Every shadow might hold answers — or enemies.",
          sceneType: "social",
          choices: [
            { id: "wife", text: "Investigate the widow discreetly", icon: Eye },
            { id: "rivals", text: "Look into the merchant's business rivals", icon: Users }
          ]
        },
        {
          id: 2,
          title: "The Widow's Secret",
          location: "Merchant's Manor - Servants' Quarters",
          narrative: "Breaking into the manor after dark reveals more than expected. The widow isn't grieving — she's packing. Hurriedly. Gold, jewels, traveling clothes. And in her hand, a vial of viscous black liquid — poison, unmistakably.\n\nShe sees you in the window's reflection and freezes. \"Who sent you? Was it the Countess? I'll pay double whatever she offered!\"",
          atmosphere: "Moonlight catches the sheen of poison. Desperation fills the room.",
          sceneType: "discovery",
          choices: [
            { id: "deal", text: "Listen to her offer", icon: MessageSquare },
            { id: "truth", text: "Demand the whole truth first", icon: Eye }
          ]
        },
        {
          id: 3,
          title: "Shifting Allegiances",
          location: "Merchant's Manor - Master Bedroom",
          narrative: "The truth spills out: the Countess controls Millbrook's criminal underworld. The merchant found out and threatened to expose her. The widow was ordered to poison him — with her own children held hostage.\n\nShe offers you everything: the Countess's secrets, access to her hidden vault, even evidence that could bring down the whole operation. \"Help me save my children. Please.\"\n\nA job just became complicated. But sometimes the best scores aren't about gold.",
          atmosphere: "Trust tentatively offered. A mother's desperation rings true.",
          sceneType: "social",
          requiresRoll: { type: "Insight Check", dc: 12, skill: "Dexterity" },
          outcomeSuccess: "Your instincts say she's telling the truth. One silent nod, and you have a new partner — and a new target. The Countess won't know what hit her.",
          outcomeFailure: "Her story checks out when you verify it. You extend a hand. \"We'll get your children back. And then the Countess pays for everything.\""
        },
        {
          id: 4,
          title: "The Bigger Score",
          location: "Countess's Estate - One Week Later",
          narrative: "The Countess's estate burns behind you as you slip into the night. Her crimes exposed, her guards scattered, her vault emptied. The widow reunites with her children at the town's edge, tears of relief on her face.\n\nYour guild master will be pleased — you've inherited an entire smuggling operation. But more importantly, you've gained something rarer in this business: allies you can trust.\n\nMillbrook is yours now. And this is just the beginning.",
          atmosphere: "Flames dance against the night sky. Power shifts to those who dare take it.",
          sceneType: "discovery"
        }
      ]
    }
  };
  
  return stories[theme]?.[characterClass] || stories.dungeon.Fighter;
}

export default function GuestQuickPlay({ 
  onComplete, 
  onCancel 
}: { 
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0); // 0: character, 1: adventure, 2: playing, 3: complete
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [currentScene, setCurrentScene] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [diceResult, setDiceResult] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [showOutcome, setShowOutcome] = useState(false);
  const [narrativeRevealed, setNarrativeRevealed] = useState(false);

  const selectedChar = CHARACTER_TEMPLATES.find(c => c.id === selectedCharacter);
  const selectedAdventure = ADVENTURE_THEMES.find(t => t.id === selectedTheme);
  
  const scenes = selectedChar && selectedAdventure 
    ? generateStoryScenes(selectedChar.class, selectedAdventure.id)
    : [];
  
  const scene = scenes[currentScene];

  // Reset narrative reveal when scene changes
  useEffect(() => {
    setNarrativeRevealed(false);
    const timer = setTimeout(() => setNarrativeRevealed(true), 100);
    return () => clearTimeout(timer);
  }, [currentScene]);

  const handleRollDice = () => {
    setIsRolling(true);
    let rolls = 0;
    const interval = setInterval(() => {
      setDiceResult(Math.floor(Math.random() * 20) + 1);
      rolls++;
      if (rolls > 15) {
        clearInterval(interval);
        setIsRolling(false);
        const finalRoll = Math.floor(Math.random() * 20) + 1;
        setDiceResult(finalRoll);
        setTimeout(() => setShowOutcome(true), 500);
      }
    }, 80);
  };

  const handleContinue = () => {
    if (currentScene < scenes.length - 1) {
      setCurrentScene(currentScene + 1);
      setSelectedChoice(null);
      setDiceResult(null);
      setShowOutcome(false);
    } else {
      setStep(3);
    }
  };

  const handleNextStep = () => {
    if (step === 0 && selectedCharacter) {
      setStep(1);
    } else if (step === 1 && selectedTheme) {
      setStep(2);
    }
  };

  const sceneTypeIcons = {
    exploration: Footprints,
    social: MessageSquare,
    discovery: Sparkles,
    combat: Sword
  };

  const sceneTypeLabels = {
    exploration: "Exploration",
    social: "Social Encounter",
    discovery: "Discovery",
    combat: "Combat"
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {/* Character Selection */}
      {step === 0 && (
        <div className="w-full max-w-4xl p-4 max-h-screen overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Choose Your Hero</h1>
              <p className="text-slate-400">Select a character to begin your adventure</p>
            </div>
            <Button variant="ghost" onClick={onCancel} className="text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {CHARACTER_TEMPLATES.map((char) => {
              const Icon = char.icon;
              const isSelected = selectedCharacter === char.id;
              
              return (
                <button
                  key={char.id}
                  onClick={() => setSelectedCharacter(char.id)}
                  className={`relative p-5 rounded-xl border-2 text-left transition-all ${char.bgColor} ${
                    isSelected
                      ? 'border-amber-500 ring-2 ring-amber-500/30'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="flex gap-4">
                    <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${char.color} flex items-center justify-center shrink-0`}>
                      <Icon className="h-8 w-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white">{char.name}</h3>
                      <p className="text-sm text-slate-400 mb-2">Level {char.level} {char.race} {char.class}</p>
                      <p className="text-sm text-slate-300">{char.description}</p>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-red-800 text-red-300">
                      <Heart className="h-3 w-3 mr-1" /> HP {char.hitPoints}
                    </Badge>
                    <Badge variant="outline" className="border-blue-800 text-blue-300">
                      <Shield className="h-3 w-3 mr-1" /> AC {char.armorClass}
                    </Badge>
                    {char.abilities.map((ability) => (
                      <Badge key={ability.name} variant="outline" className="border-slate-600 text-slate-300">
                        {ability.name} +{ability.bonus}
                      </Badge>
                    ))}
                  </div>
                  
                  {isSelected && (
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          
          <Button
            onClick={handleNextStep}
            disabled={!selectedCharacter}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 py-6 text-lg"
          >
            Continue with {selectedChar?.name || "Selected Hero"}
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Adventure Selection */}
      {step === 1 && (
        <div className="w-full max-w-3xl p-4 max-h-screen overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Choose Your Adventure</h1>
              <p className="text-slate-400">Select a story crafted for {selectedChar?.name}</p>
            </div>
            <Button variant="ghost" onClick={() => setStep(0)} className="text-slate-400 hover:text-white">
              <ChevronLeft className="h-5 w-5 mr-1" /> Back
            </Button>
          </div>
          
          <div className="space-y-4 mb-6">
            {ADVENTURE_THEMES.map((adventure) => {
              const Icon = adventure.icon;
              const isSelected = selectedTheme === adventure.id;
              
              return (
                <button
                  key={adventure.id}
                  onClick={() => setSelectedTheme(adventure.id)}
                  className={`w-full p-6 rounded-xl border-2 text-left transition-all bg-slate-900/80 ${
                    isSelected
                      ? 'border-amber-500 ring-2 ring-amber-500/30'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="flex gap-4">
                    <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${adventure.color} flex items-center justify-center shrink-0`}>
                      <Icon className="h-8 w-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold text-white">{adventure.name}</h3>
                        <Badge className="bg-slate-700 text-slate-300">{adventure.difficulty}</Badge>
                      </div>
                      <p className="text-amber-400 text-sm mb-2 italic">{adventure.tagline}</p>
                      <p className="text-slate-300">{adventure.description}</p>
                      <p className="text-slate-500 text-sm mt-2 italic">{adventure.atmosphere}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          
          <Button
            onClick={handleNextStep}
            disabled={!selectedTheme}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 py-6 text-lg"
          >
            Begin Adventure
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Game Session */}
      {step === 2 && scene && selectedChar && (
        <div className="w-full h-full flex flex-col lg:flex-row">
          {/* Character Panel - Left Sidebar */}
          <div className="lg:w-72 bg-slate-900/95 border-r border-slate-700 p-4 shrink-0">
            <div className="flex lg:flex-col gap-4 items-center lg:items-stretch">
              <div className={`w-16 h-16 lg:w-full lg:h-32 rounded-xl bg-gradient-to-br ${selectedChar.color} flex items-center justify-center shrink-0`}>
                {(() => { const Icon = selectedChar.icon; return <Icon className="h-10 w-10 lg:h-16 lg:w-16 text-white" />; })()}
              </div>
              
              <div className="flex-1 lg:flex-initial">
                <h2 className="text-lg font-bold text-white">{selectedChar.name}</h2>
                <p className="text-sm text-slate-400">Level {selectedChar.level} {selectedChar.class}</p>
                
                {/* Stats */}
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-red-400" />
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-red-500 to-red-400 w-full" />
                    </div>
                    <span className="text-xs text-red-300">{selectedChar.hitPoints}/{selectedChar.hitPoints}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-blue-400" />
                    <span className="text-blue-300">AC {selectedChar.armorClass}</span>
                  </div>
                </div>
                
                {/* Traits - Hidden on mobile */}
                <div className="hidden lg:block mt-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Abilities</p>
                  <div className="space-y-1">
                    {selectedChar.traits.map((trait) => (
                      <Badge key={trait} variant="outline" className="border-slate-600 text-slate-300 text-xs mr-1">
                        {trait}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Scene Progress - Desktop */}
            <div className="hidden lg:block mt-6 pt-4 border-t border-slate-700">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Progress</p>
              <div className="flex gap-1">
                {scenes.map((_, i) => (
                  <div 
                    key={i}
                    className={`h-1 flex-1 rounded-full ${
                      i < currentScene ? 'bg-emerald-500' :
                      i === currentScene ? 'bg-amber-500' :
                      'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1">Scene {currentScene + 1} of {scenes.length}</p>
            </div>
          </div>
          
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Scene Header */}
            <div className="bg-slate-900/80 border-b border-slate-700 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge className={`${
                    scene.sceneType === 'combat' ? 'bg-red-900/50 text-red-300' :
                    scene.sceneType === 'social' ? 'bg-blue-900/50 text-blue-300' :
                    scene.sceneType === 'discovery' ? 'bg-purple-900/50 text-purple-300' :
                    'bg-emerald-900/50 text-emerald-300'
                  }`}>
                    {(() => { const Icon = sceneTypeIcons[scene.sceneType]; return <Icon className="h-3 w-3 mr-1" />; })()}
                    {sceneTypeLabels[scene.sceneType]}
                  </Badge>
                  <div className="flex items-center gap-1 text-slate-400 text-sm">
                    <MapPin className="h-3 w-3" />
                    {scene.location}
                  </div>
                </div>
                
                {/* Mobile Progress */}
                <div className="flex lg:hidden items-center gap-2">
                  <span className="text-xs text-slate-400">{currentScene + 1}/{scenes.length}</span>
                  <Button variant="ghost" size="icon" onClick={onCancel} className="text-slate-400">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Desktop Close */}
                <Button variant="ghost" size="icon" onClick={onCancel} className="hidden lg:flex text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            
            {/* Scene Content */}
            <ScrollArea className="flex-1 p-4 lg:p-6">
              <div className="max-w-2xl mx-auto space-y-6">
                {/* Scene Title */}
                <div className="text-center">
                  <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">{scene.title}</h1>
                  <p className="text-amber-400/80 italic text-sm">{scene.atmosphere}</p>
                </div>
                
                {/* Narrative */}
                <Card className="bg-slate-900/60 border-slate-700">
                  <CardContent className="p-5">
                    <div className={`prose prose-invert prose-amber max-w-none transition-opacity duration-500 ${narrativeRevealed ? 'opacity-100' : 'opacity-0'}`}>
                      {scene.narrative.split('\n\n').map((paragraph, i) => (
                        <p key={i} className="text-slate-200 leading-relaxed mb-3 last:mb-0">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                
                {/* Choices */}
                {scene.choices && !scene.requiresRoll && (
                  <div className="space-y-3">
                    <p className="text-center text-slate-400 text-sm">What do you do?</p>
                    <div className="grid gap-2">
                      {scene.choices.map((choice) => {
                        const Icon = choice.icon;
                        return (
                          <Button
                            key={choice.id}
                            onClick={() => setSelectedChoice(choice.id)}
                            variant={selectedChoice === choice.id ? "default" : "outline"}
                            className={`justify-start py-4 text-left ${
                              selectedChoice === choice.id
                                ? 'bg-amber-600 border-amber-500 text-white'
                                : 'border-slate-600 text-slate-200 hover:bg-slate-800'
                            }`}
                          >
                            <Icon className="h-4 w-4 mr-2 shrink-0" />
                            {choice.text}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Dice Roll Section */}
                {scene.requiresRoll && (
                  <Card className="bg-slate-800/80 border-amber-900/50">
                    <CardContent className="py-6 text-center">
                      <p className="text-amber-400 font-medium mb-4">
                        <Dices className="inline h-4 w-4 mr-1" />
                        {scene.requiresRoll.type} — DC {scene.requiresRoll.dc}
                      </p>
                      
                      {!diceResult && !isRolling && (
                        <Button
                          onClick={handleRollDice}
                          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 px-8 py-6 text-lg"
                        >
                          <Dices className="mr-2 h-6 w-6" />
                          Roll d20
                        </Button>
                      )}
                      
                      {(isRolling || diceResult) && (
                        <div className="space-y-4">
                          <div className={`inline-flex items-center justify-center w-24 h-24 rounded-2xl text-4xl font-bold transition-all ${
                            isRolling ? 'bg-slate-700 animate-pulse' :
                            diceResult! >= scene.requiresRoll.dc ? 'bg-gradient-to-br from-emerald-500 to-green-600' :
                            'bg-gradient-to-br from-orange-500 to-amber-600'
                          } text-white shadow-lg`}>
                            {diceResult || '?'}
                          </div>
                          
                          {!isRolling && diceResult && (
                            <div>
                              {diceResult >= 20 && (
                                <p className="text-emerald-400 font-bold text-lg">
                                  <Crown className="inline h-5 w-5 mr-1" />
                                  NATURAL 20! Critical Success!
                                </p>
                              )}
                              {diceResult === 1 && (
                                <p className="text-red-400 font-bold text-lg">
                                  <Skull className="inline h-5 w-5 mr-1" />
                                  Natural 1... Critical Fumble!
                                </p>
                              )}
                              {diceResult > 1 && diceResult < 20 && (
                                <p className={`font-medium ${diceResult >= scene.requiresRoll.dc ? 'text-emerald-400' : 'text-orange-400'}`}>
                                  {diceResult >= scene.requiresRoll.dc ? '✓ Success!' : '— Close, but...'}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Outcome */}
                      {showOutcome && diceResult && (
                        <Card className={`mt-4 ${
                          diceResult >= scene.requiresRoll.dc 
                            ? 'bg-emerald-950/40 border-emerald-800' 
                            : 'bg-amber-950/40 border-amber-800'
                        }`}>
                          <CardContent className="py-4 text-left">
                            <p className="text-slate-200">
                              {diceResult >= scene.requiresRoll.dc 
                                ? scene.outcomeSuccess 
                                : scene.outcomeFailure}
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
            
            {/* Action Bar */}
            <div className="bg-slate-900/90 border-t border-slate-700 p-4">
              <div className="max-w-2xl mx-auto flex justify-between items-center">
                <div className="text-sm text-slate-400">
                  {selectedAdventure?.name}
                </div>
                
                <Button
                  onClick={handleContinue}
                  disabled={
                    (scene.choices && !selectedChoice && !scene.requiresRoll) ||
                    (scene.requiresRoll && !showOutcome)
                  }
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                >
                  {currentScene < scenes.length - 1 ? 'Continue' : 'Complete Adventure'}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Completion */}
      {step === 3 && selectedChar && (
        <div className="w-full max-w-2xl p-4 text-center">
          <div className="mb-8">
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-6">
              <Crown className="h-12 w-12 text-white" />
            </div>
            
            <h1 className="text-4xl font-bold text-white mb-3">Adventure Complete!</h1>
            <p className="text-xl text-amber-400 mb-2">{selectedChar.name} has proven their worth</p>
            <p className="text-slate-400">
              You've experienced a taste of tabletop roleplaying — unique stories that unfold 
              differently each time based on your choices and the roll of the dice.
            </p>
          </div>
          
          <Card className="bg-slate-900/80 border-slate-700 mb-6">
            <CardHeader className="pb-2">
              <h3 className="text-lg font-bold text-amber-400 flex items-center justify-center gap-2">
                <ScrollText className="h-5 w-5" />
                What Awaits in the Full Experience
              </h3>
            </CardHeader>
            <CardContent className="text-left">
              <ul className="space-y-3 text-slate-300">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-900/50 flex items-center justify-center shrink-0 mt-0.5">
                    <Users className="h-3 w-3 text-purple-300" />
                  </div>
                  <span>Create custom characters with full D&D 5e stats, backgrounds, and progression</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-900/50 flex items-center justify-center shrink-0 mt-0.5">
                    <BookOpen className="h-3 w-3 text-emerald-300" />
                  </div>
                  <span>Play through complete campaigns with dynamically generated narratives that adapt to your choices</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-900/50 flex items-center justify-center shrink-0 mt-0.5">
                    <Users className="h-3 w-3 text-blue-300" />
                  </div>
                  <span>Invite friends to join multiplayer adventures with real-time collaboration</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-900/50 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="h-3 w-3 text-amber-300" />
                  </div>
                  <span>Access the full SRD 5.1 spell library, monster compendium, and DM tools</span>
                </li>
              </ul>
            </CardContent>
          </Card>
          
          <Button
            onClick={onComplete}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 py-6 text-lg"
          >
            Visit the Hearth — Meet the Community
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          
          <Button
            variant="ghost"
            onClick={onCancel}
            className="mt-3 text-slate-400 hover:text-white"
          >
            Return to Homepage
          </Button>
        </div>
      )}
    </div>
  );
}
