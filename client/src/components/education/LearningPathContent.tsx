import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  BookOpen, 
  CheckCircle2, 
  Circle, 
  ChevronRight, 
  ChevronLeft,
  GraduationCap,
  TrendingUp,
  Crown,
  Dice6,
  Sword,
  Shield,
  Heart,
  Users,
  Sparkles,
  Target,
  Scroll,
  Map
} from "lucide-react";

interface Lesson {
  id: string;
  title: string;
  duration: string;
  content: LessonSection[];
}

interface LessonSection {
  type: "text" | "example" | "tip" | "table" | "practice";
  title?: string;
  content: string;
  items?: string[];
  tableData?: { headers: string[]; rows: string[][] };
}

interface LearningPath {
  id: string;
  title: string;
  description: string;
  icon: any;
  lessons: Lesson[];
}

const NEW_PLAYER_LESSONS: Lesson[] = [
  {
    id: "np-1",
    title: "Understanding Dice and Ability Scores",
    duration: "20 min",
    content: [
      {
        type: "text",
        title: "The Heart of D&D: Rolling Dice",
        content: "Dungeons & Dragons uses polyhedral dice to determine outcomes. The most important die is the d20 (twenty-sided die), which you'll roll for almost every action that has a chance of failure."
      },
      {
        type: "table",
        title: "Common Dice Types",
        content: "",
        tableData: {
          headers: ["Die", "Sides", "Common Uses"],
          rows: [
            ["d4", "4", "Small weapon damage, minor healing"],
            ["d6", "6", "Shortsword damage, sneak attack"],
            ["d8", "8", "Longsword damage, medium healing"],
            ["d10", "10", "Heavy weapon damage, some spells"],
            ["d12", "12", "Greataxe damage, barbarian hit dice"],
            ["d20", "20", "Attack rolls, ability checks, saving throws"],
            ["d100", "100", "Percentile rolls, wild magic"]
          ]
        }
      },
      {
        type: "text",
        title: "The Six Ability Scores",
        content: "Every character has six ability scores that define their capabilities. Each score ranges from 1-20 for most characters, with 10-11 being average for a commoner."
      },
      {
        type: "table",
        title: "Ability Score Overview",
        content: "",
        tableData: {
          headers: ["Ability", "Governs", "Used For"],
          rows: [
            ["Strength (STR)", "Physical power", "Melee attacks, lifting, athletics"],
            ["Dexterity (DEX)", "Agility & reflexes", "Ranged attacks, AC, stealth, acrobatics"],
            ["Constitution (CON)", "Health & stamina", "Hit points, concentration, endurance"],
            ["Intelligence (INT)", "Reasoning & memory", "Investigation, arcana, history"],
            ["Wisdom (WIS)", "Perception & insight", "Perception, survival, medicine, insight"],
            ["Charisma (CHA)", "Force of personality", "Persuasion, deception, intimidation"]
          ]
        }
      },
      {
        type: "example",
        title: "Ability Modifiers",
        content: "Your ability modifier is calculated as: (Score - 10) ÷ 2, rounded down. A score of 14 gives you a +2 modifier, while a score of 8 gives you a -1 modifier. This modifier is added to d20 rolls using that ability."
      },
      {
        type: "tip",
        content: "A good character has high scores in abilities that match their class. Fighters need Strength, Rogues need Dexterity, Wizards need Intelligence, and so on."
      }
    ]
  },
  {
    id: "np-2",
    title: "Skills and When to Use Them",
    duration: "25 min",
    content: [
      {
        type: "text",
        title: "What Are Skills?",
        content: "Skills represent specific training in various tasks. Each skill is tied to an ability score. When you make a skill check, you roll a d20 and add your ability modifier plus your proficiency bonus (if proficient in that skill)."
      },
      {
        type: "table",
        title: "Complete Skill List",
        content: "",
        tableData: {
          headers: ["Skill", "Ability", "When to Use"],
          rows: [
            ["Acrobatics", "DEX", "Balancing, tumbling, fancy maneuvers"],
            ["Animal Handling", "WIS", "Calming animals, riding, training"],
            ["Arcana", "INT", "Knowledge of magic, spells, magical items"],
            ["Athletics", "STR", "Climbing, jumping, swimming, grappling"],
            ["Deception", "CHA", "Lying, disguising intentions, bluffing"],
            ["History", "INT", "Knowledge of past events, civilizations"],
            ["Insight", "WIS", "Reading people's true intentions"],
            ["Intimidation", "CHA", "Threatening, coercing through fear"],
            ["Investigation", "INT", "Searching for clues, deducing"],
            ["Medicine", "WIS", "Stabilizing the dying, diagnosing illness"],
            ["Nature", "INT", "Knowledge of terrain, plants, weather"],
            ["Perception", "WIS", "Noticing things, spotting hidden objects"],
            ["Performance", "CHA", "Acting, singing, entertaining"],
            ["Persuasion", "CHA", "Convincing through reason and charm"],
            ["Religion", "INT", "Knowledge of deities, rituals, undead"],
            ["Sleight of Hand", "DEX", "Pickpocketing, concealing objects"],
            ["Stealth", "DEX", "Moving silently, hiding"],
            ["Survival", "WIS", "Tracking, foraging, navigating wilderness"]
          ]
        }
      },
      {
        type: "text",
        title: "Difficulty Class (DC)",
        content: "When you make a skill check, the DM sets a Difficulty Class (DC) - a number you must meet or exceed to succeed."
      },
      {
        type: "table",
        title: "Difficulty Classes",
        content: "",
        tableData: {
          headers: ["DC", "Difficulty", "Example"],
          rows: [
            ["5", "Very Easy", "Climbing a rope with knots"],
            ["10", "Easy", "Hearing a conversation through a door"],
            ["15", "Medium", "Picking a standard lock"],
            ["20", "Hard", "Tracking through heavy rain"],
            ["25", "Very Hard", "Convincing a hostile guard"],
            ["30", "Nearly Impossible", "Leaping a 30-foot chasm"]
          ]
        }
      },
      {
        type: "tip",
        content: "Don't be afraid to ask your DM which skill applies to a situation. Sometimes multiple skills could work - Intimidation OR Persuasion to get information, for example."
      }
    ]
  },
  {
    id: "np-3",
    title: "Character Creation Basics",
    duration: "30 min",
    content: [
      {
        type: "text",
        title: "Building Your Hero",
        content: "Creating a character involves choosing a race, class, and background. Each choice shapes who your character is and what they can do."
      },
      {
        type: "text",
        title: "Step 1: Choose a Race",
        content: "Your race determines physical characteristics and grants special abilities. Each race has unique features that complement certain playstyles."
      },
      {
        type: "table",
        title: "Popular Races",
        content: "",
        tableData: {
          headers: ["Race", "Key Features", "Good For"],
          rows: [
            ["Human", "+1 to all abilities, extra skill/feat", "Any class, versatile"],
            ["Elf", "+2 DEX, darkvision, trance", "Rangers, rogues, wizards"],
            ["Dwarf", "+2 CON, darkvision, poison resistance", "Fighters, clerics, paladins"],
            ["Halfling", "+2 DEX, lucky, brave", "Rogues, bards, monks"],
            ["Half-Orc", "+2 STR, +1 CON, savage attacks", "Barbarians, fighters"],
            ["Tiefling", "+2 CHA, fire resistance, spells", "Warlocks, sorcerers, paladins"]
          ]
        }
      },
      {
        type: "text",
        title: "Step 2: Choose a Class",
        content: "Your class is your profession and determines your abilities, hit points, and combat style. It's the most important choice you'll make."
      },
      {
        type: "table",
        title: "Core Classes",
        content: "",
        tableData: {
          headers: ["Class", "Role", "Key Ability", "Complexity"],
          rows: [
            ["Fighter", "Frontline combatant", "STR or DEX", "Beginner-friendly"],
            ["Rogue", "Stealthy striker", "DEX", "Beginner-friendly"],
            ["Cleric", "Healer and support", "WIS", "Moderate"],
            ["Wizard", "Arcane spellcaster", "INT", "Complex"],
            ["Barbarian", "Tough damage dealer", "STR, CON", "Beginner-friendly"],
            ["Ranger", "Wilderness expert", "DEX, WIS", "Moderate"],
            ["Paladin", "Holy warrior", "STR, CHA", "Moderate"],
            ["Bard", "Jack of all trades", "CHA", "Moderate"],
            ["Warlock", "Pact magic user", "CHA", "Moderate"],
            ["Sorcerer", "Innate magic user", "CHA", "Moderate"],
            ["Druid", "Nature magic user", "WIS", "Complex"],
            ["Monk", "Martial artist", "DEX, WIS", "Moderate"]
          ]
        }
      },
      {
        type: "tip",
        content: "For your first character, consider Fighter, Rogue, or Barbarian. They're straightforward and let you learn the game without managing complex spell lists."
      },
      {
        type: "text",
        title: "Step 3: Choose a Background",
        content: "Your background represents your life before adventuring. It provides skill proficiencies, equipment, and roleplay hooks."
      },
      {
        type: "example",
        title: "Popular Backgrounds",
        content: "Soldier (athletics, intimidation), Criminal (deception, stealth), Sage (arcana, history), Noble (history, persuasion), Folk Hero (animal handling, survival), Acolyte (insight, religion)."
      }
    ]
  },
  {
    id: "np-4",
    title: "Combat Fundamentals",
    duration: "35 min",
    content: [
      {
        type: "text",
        title: "How Combat Works",
        content: "Combat in D&D is turn-based. Each round represents 6 seconds of in-game time. On your turn, you can move and take actions."
      },
      {
        type: "text",
        title: "Initiative",
        content: "When combat begins, everyone rolls initiative (d20 + DEX modifier) to determine turn order. Higher results go first. The DM tracks this order throughout the fight."
      },
      {
        type: "text",
        title: "Your Turn Structure",
        content: "On your turn, you can: Move up to your speed (usually 30 feet), Take one Action, Take one Bonus Action (if you have one), Take one Reaction (triggered by others' actions), Free interactions (drop item, speak briefly)."
      },
      {
        type: "table",
        title: "Common Actions in Combat",
        content: "",
        tableData: {
          headers: ["Action", "Description"],
          rows: [
            ["Attack", "Make one melee or ranged weapon attack"],
            ["Cast a Spell", "Cast a spell with casting time of 1 action"],
            ["Dash", "Double your movement for this turn"],
            ["Disengage", "Your movement doesn't provoke opportunity attacks"],
            ["Dodge", "Attacks against you have disadvantage until your next turn"],
            ["Help", "Give an ally advantage on their next check/attack"],
            ["Hide", "Make a Stealth check to become hidden"],
            ["Ready", "Prepare an action to trigger later"],
            ["Use an Object", "Interact with something requiring your action"]
          ]
        }
      },
      {
        type: "text",
        title: "Making an Attack",
        content: "To attack: Roll d20 + ability modifier + proficiency bonus (if proficient). If the result equals or exceeds the target's Armor Class (AC), you hit! Then roll damage dice + ability modifier."
      },
      {
        type: "example",
        title: "Attack Example",
        content: "A fighter with 16 STR (+3) and proficiency (+2) attacks with a longsword. They roll d20+5 to hit. If they roll 13 for a total of 18, and the goblin's AC is 15, they hit! They then roll 1d8+3 for damage."
      },
      {
        type: "tip",
        content: "A natural 20 on an attack roll is a critical hit - you automatically hit and roll double damage dice! A natural 1 is an automatic miss, regardless of bonuses."
      }
    ]
  },
  {
    id: "np-5",
    title: "Your First Session: What to Expect",
    duration: "20 min",
    content: [
      {
        type: "text",
        title: "Before the Session",
        content: "Read your character sheet and understand your abilities. Know what your character is good at and what they struggle with. Bring dice, pencils, and your character sheet (or have them digitally ready)."
      },
      {
        type: "text",
        title: "The Three Pillars of Play",
        content: "D&D involves three main activities: Exploration (discovering locations, solving puzzles, finding treasure), Social Interaction (talking to NPCs, negotiating, gathering information), Combat (fighting monsters and enemies)."
      },
      {
        type: "text",
        title: "Roleplay Tips",
        content: "You don't need to be an actor! You can describe what your character does in third person ('My character tries to intimidate the guard') or speak as your character ('I'm warning you - let us pass or face the consequences'). Both are valid!"
      },
      {
        type: "table",
        title: "Session Etiquette",
        content: "",
        tableData: {
          headers: ["Do", "Don't"],
          rows: [
            ["Pay attention when others are acting", "Look at your phone constantly"],
            ["Support other players' ideas", "Hog the spotlight"],
            ["Ask questions if confused", "Argue rules during combat"],
            ["Stay in character when appropriate", "Make decisions that harm the party"],
            ["Have fun and be creative!", "Take the game too seriously"]
          ]
        }
      },
      {
        type: "tip",
        content: "It's okay to make mistakes! Everyone was new once. The DM and other players will help you learn. Focus on having fun and telling a great story together."
      },
      {
        type: "practice",
        title: "Pre-Session Checklist",
        content: "Before your first session, make sure you can answer: What is my character's goal or motivation? What are my highest skills? What attacks can I make? How many hit points do I have? What's my Armor Class?"
      }
    ]
  }
];

const EXPERIENCED_PLAYER_LESSONS: Lesson[] = [
  {
    id: "ep-1",
    title: "Advanced Combat Tactics",
    duration: "30 min",
    content: [
      {
        type: "text",
        title: "Positioning and Terrain",
        content: "Smart positioning can turn a deadly encounter into a manageable one. Consider cover (half cover gives +2 AC, three-quarters cover gives +5 AC), difficult terrain (costs double movement), and elevation advantages."
      },
      {
        type: "table",
        title: "Tactical Considerations",
        content: "",
        tableData: {
          headers: ["Situation", "Tactical Response"],
          rows: [
            ["Outnumbered", "Use chokepoints, area spells, or retreat to defensible position"],
            ["Facing spellcaster", "Close distance quickly, break concentration, use counterspell"],
            ["Many weak enemies", "Use area damage, focus fire to reduce enemy actions"],
            ["One powerful enemy", "Debuff with conditions, focus damage, protect healer"],
            ["Ranged enemies", "Close distance or find cover, use dash if needed"],
            ["Ambushed", "Protect squishies, establish defensive line, ready actions"]
          ]
        }
      },
      {
        type: "text",
        title: "Action Economy",
        content: "The side with more actions per round has a significant advantage. Reducing enemy actions (through incapacitation, killing, or crowd control) is often more valuable than dealing damage."
      },
      {
        type: "example",
        title: "Focus Fire",
        content: "Four enemies with 20 HP each deal 4 attacks per round. If you spread 60 damage across all of them, they still deal 4 attacks. If you kill three (60 damage focused), they only deal 1 attack. Same damage, vastly different outcome."
      },
      {
        type: "tip",
        content: "Ready actions are underutilized. 'I ready an attack for when an enemy comes around that corner' or 'I ready a spell for when the boss becomes visible' can be game-changing."
      }
    ]
  },
  {
    id: "ep-2",
    title: "Spell Interactions and Optimization",
    duration: "35 min",
    content: [
      {
        type: "text",
        title: "Concentration Mechanics",
        content: "Many powerful spells require concentration. You can only concentrate on one spell at a time. Taking damage forces a Constitution save (DC 10 or half damage, whichever is higher) to maintain concentration."
      },
      {
        type: "table",
        title: "High-Value Concentration Spells",
        content: "",
        tableData: {
          headers: ["Spell", "Level", "Why It's Strong"],
          rows: [
            ["Bless", "1st", "+1d4 to attacks and saves for 3 allies"],
            ["Faerie Fire", "1st", "Advantage on attacks, negates invisibility"],
            ["Hold Person", "2nd", "Incapacitates humanoid, auto-crits in melee"],
            ["Hypnotic Pattern", "3rd", "Incapacitates multiple enemies"],
            ["Polymorph", "4th", "Transforms ally into beast with new HP pool"],
            ["Wall of Force", "5th", "Impenetrable barrier, splits encounters"]
          ]
        }
      },
      {
        type: "text",
        title: "Spell Slot Management",
        content: "Don't blow all your high-level slots in the first encounter. A good rule: save at least one slot of your highest level for emergencies. Short rest classes (Warlock) can be more aggressive."
      },
      {
        type: "example",
        title: "Upcasting Value",
        content: "Some spells scale exceptionally well: Cure Wounds (+1d8 per level), Fireball (+1d6 per level), Hold Person (additional target per level). Others barely scale - check before upcasting!"
      },
      {
        type: "tip",
        content: "Ritual spells don't consume spell slots when cast as rituals (10 minutes extra). Detect Magic, Identify, Find Familiar - always ritual cast these when possible."
      }
    ]
  },
  {
    id: "ep-3",
    title: "Party Synergy and Teamwork",
    duration: "25 min",
    content: [
      {
        type: "text",
        title: "Role Coverage",
        content: "A well-rounded party covers: Damage dealing, Tanking/protection, Healing/support, Utility/problem-solving, Social skills. One character can cover multiple roles!"
      },
      {
        type: "table",
        title: "Powerful Combinations",
        content: "",
        tableData: {
          headers: ["Combo", "How It Works"],
          rows: [
            ["Rogue + Anyone with Help", "Grants Sneak Attack via advantage"],
            ["Cleric + Paladin", "Double healing, aura stacking, front line power"],
            ["Wizard + Fighter", "Wizard buffs, Fighter executes, protection both ways"],
            ["Bard + Rogue", "Skill monkey supreme, infiltration specialists"],
            ["Druid + Ranger", "Wilderness dominance, animal companions"],
            ["Warlock + Sorcerer", "Short rest + sorcery point synergy"]
          ]
        }
      },
      {
        type: "text",
        title: "Communication in Combat",
        content: "Discuss tactics before combat when possible. Call targets ('I'm focusing the mage'), request specific actions ('Can someone Help me?'), and coordinate abilities ('Wait for my Faerie Fire before attacking')."
      },
      {
        type: "tip",
        content: "The Help action is incredibly powerful and often forgotten. Any character can give advantage to an ally's attack or ability check. It's especially valuable for rogues who need advantage for Sneak Attack."
      }
    ]
  },
  {
    id: "ep-4",
    title: "Creative Problem Solving",
    duration: "25 min",
    content: [
      {
        type: "text",
        title: "Think Beyond Combat",
        content: "D&D is not just about fighting. Many encounters can be bypassed, negotiated, or solved creatively. A guarded door might be unlocked, climbed over, tunneled under, or the guards might be bribed, distracted, or convinced you belong there."
      },
      {
        type: "example",
        title: "The Versatile Spell",
        content: "Prestidigitation can clean clothes, create minor illusions, light candles, flavor food, and more. These 'utility' cantrips can solve social encounters, create distractions, or provide creative solutions the DM didn't anticipate."
      },
      {
        type: "text",
        title: "Using the Environment",
        content: "Look for: Chandeliers to swing on or drop, oil barrels to ignite, bridges to collapse, cages to trap enemies in, water to conduct lightning, narrow passages to bottleneck enemies."
      },
      {
        type: "table",
        title: "Alternative Approaches",
        content: "",
        tableData: {
          headers: ["Problem", "Combat Solution", "Creative Solution"],
          rows: [
            ["Guarded fortress", "Storm the gates", "Disguise as servants, sneak through sewers"],
            ["Dragon's lair", "Fight the dragon", "Negotiate, steal while it sleeps, hire dragon slayers"],
            ["Locked chest", "Smash it", "Find the key, pick the lock, hire a thief"],
            ["Hostile tribe", "Kill them all", "Find common enemy, offer trade, marry into tribe"],
            ["Magical barrier", "Dispel it", "Find power source, go around, trick creator"]
          ]
        }
      },
      {
        type: "tip",
        content: "Always ask 'What would my character try?' rather than 'What does the game expect me to do?' The best D&D moments come from unexpected solutions."
      }
    ]
  },
  {
    id: "ep-5",
    title: "Multiclassing and Character Builds",
    duration: "30 min",
    content: [
      {
        type: "text",
        title: "When to Multiclass",
        content: "Multiclassing delays your main class features but can create powerful combinations. Consider: Do you gain something important? Does it fit your character's story? Are you willing to delay high-level features?"
      },
      {
        type: "table",
        title: "Popular Multiclass Dips",
        content: "",
        tableData: {
          headers: ["Dip", "Levels", "What You Get"],
          rows: [
            ["Fighter 1-2", "1-2", "Fighting style, Second Wind, Action Surge"],
            ["Rogue 1", "1", "Sneak Attack, Expertise, thieves' tools"],
            ["Cleric 1", "1", "Armor proficiencies, healing, domain features"],
            ["Warlock 2", "2", "Eldritch Blast, Invocations, short rest slots"],
            ["Paladin 2", "2", "Divine Smite, Fighting Style, spellcasting"],
            ["Hexblade 1", "1", "Medium armor, shields, CHA attacks, Hexblade's Curse"]
          ]
        }
      },
      {
        type: "example",
        title: "Classic Builds",
        content: "Sorcadin (Paladin/Sorcerer): Smites + metamagic for burst damage. Hexblade Warlock/Any CHA class: Single ability dependency. Fighter/Wizard: Armored spellcaster with Action Surge spells."
      },
      {
        type: "tip",
        content: "For most players, staying single-classed to level 5+ is recommended. You get Extra Attack, 3rd-level spells, or other major features that define your class."
      }
    ]
  }
];

const ASPIRING_DM_LESSONS: Lesson[] = [
  {
    id: "dm-1",
    title: "Session Preparation Essentials",
    duration: "40 min",
    content: [
      {
        type: "text",
        title: "The Prep Spectrum",
        content: "Preparation exists on a spectrum from fully improvised to meticulously planned. Most successful DMs prepare key elements while leaving room for player agency."
      },
      {
        type: "table",
        title: "What to Prepare",
        content: "",
        tableData: {
          headers: ["Element", "Detail Level", "Notes"],
          rows: [
            ["Session goal", "Clear objective", "What should happen this session?"],
            ["Key NPCs", "Name, motivation, voice", "2-3 important characters"],
            ["Locations", "Brief description", "What do players see, hear, smell?"],
            ["Encounters", "Monster stats, tactics", "Combat and non-combat challenges"],
            ["Secrets", "Clues and revelations", "What can players discover?"],
            ["Contingencies", "If/then scenarios", "What if players go left instead of right?"]
          ]
        }
      },
      {
        type: "text",
        title: "The Rule of Three",
        content: "Prepare three options for most situations: three leads for the mystery, three paths through the dungeon, three ways to approach the villain. Players will surprise you, and having options prevents dead ends."
      },
      {
        type: "example",
        title: "Session Outline Example",
        content: "Opening: Party arrives at village hearing rumors of missing children. Middle: Investigation reveals cult activity in abandoned mine. End: Confrontation with cult leader, children rescued or cliffhanger. Time: Plan for 3-4 hours, have extra content if fast."
      },
      {
        type: "tip",
        content: "Over-preparation often goes unused. Focus on elements that MUST be ready (monster stats, key revelations) and improvise the rest. A good 30-minute prep can run a 4-hour session."
      }
    ]
  },
  {
    id: "dm-2",
    title: "Encounter Design and Balance",
    duration: "45 min",
    content: [
      {
        type: "text",
        title: "Understanding Challenge Rating",
        content: "Challenge Rating (CR) indicates a monster appropriate for a party of 4 characters of that level. A CR 5 monster is a medium challenge for 4 level-5 characters. But CR is a rough guide - many factors affect difficulty."
      },
      {
        type: "table",
        title: "Encounter Difficulty Thresholds",
        content: "",
        tableData: {
          headers: ["Difficulty", "Description", "Guideline"],
          rows: [
            ["Easy", "Minor resource drain", "Few abilities used, no threat of death"],
            ["Medium", "Moderate challenge", "Resources used, occasional danger"],
            ["Hard", "Serious threat", "Real chance of death, significant resources"],
            ["Deadly", "Could kill PCs", "One or more characters might die"]
          ]
        }
      },
      {
        type: "text",
        title: "Action Economy Is Key",
        content: "The side with more actions usually wins. One CR 5 monster vs. 4 level 5 characters often feels easy because the party gets 4 actions to the monster's 1. Add minions or legendary actions to balance."
      },
      {
        type: "example",
        title: "Boss Fight Formula",
        content: "Boss creature (CR = party level + 2-3) plus minions (4-6 creatures at CR 1/4 to 1/2). The boss poses the main threat while minions absorb actions and create chaos. Legendary actions let bosses act between player turns."
      },
      {
        type: "table",
        title: "Environmental Modifiers",
        content: "",
        tableData: {
          headers: ["Factor", "Makes Fight Easier", "Makes Fight Harder"],
          rows: [
            ["Terrain", "Open field, room to maneuver", "Hazards, difficult terrain, chokepoints"],
            ["Surprise", "Party surprises enemies", "Enemies surprise party"],
            ["Resources", "Full rest before fight", "No rest, depleted spells"],
            ["Information", "Know enemy weaknesses", "No idea what they're facing"],
            ["Allies", "NPCs helping party", "Reinforcements for enemies"]
          ]
        }
      },
      {
        type: "tip",
        content: "It's okay to adjust encounters on the fly. If a fight is too easy, reinforcements arrive. If it's too hard, an ally appears or the enemy makes a tactical mistake."
      }
    ]
  },
  {
    id: "dm-3",
    title: "Improvisation and Player Engagement",
    duration: "35 min",
    content: [
      {
        type: "text",
        title: "The Art of 'Yes, And'",
        content: "Borrowed from improv comedy, 'Yes, and...' means accepting player ideas and building on them. When a player asks 'Is there a chandelier I can swing from?', the answer should usually be 'Yes, and here's what happens...' rather than shutting down creative play."
      },
      {
        type: "table",
        title: "Improv Techniques",
        content: "",
        tableData: {
          headers: ["Technique", "How to Use"],
          rows: [
            ["Yes, and", "Accept the idea and add a complication or opportunity"],
            ["Yes, but", "Allow it with a cost or consequence"],
            ["No, but", "Block the action but offer an alternative"],
            ["Random tables", "Roll for unexpected results to spark ideas"],
            ["Ask players", "'What do you think is in this room?' Use their ideas"],
            ["Pause and think", "Take a moment; 'Let me think about that' is valid"]
          ]
        }
      },
      {
        type: "text",
        title: "Reading the Table",
        content: "Watch for: Disengaged players (check in, give them spotlight), Frustrated players (adjust difficulty or clarify), Excited players (lean into what they're enjoying), Confused players (explain or simplify)."
      },
      {
        type: "example",
        title: "Engaging Quiet Players",
        content: "'Thoren, as the party's ranger, you notice something the others missed...' or 'What does your character think about this plan?' Direct questions bring players into scenes naturally."
      },
      {
        type: "tip",
        content: "Keep a list of random names, tavern descriptions, and NPC quirks. When players go somewhere unexpected, these lists save you from pausing to invent details on the spot."
      }
    ]
  },
  {
    id: "dm-4",
    title: "NPC Creation and World-Building",
    duration: "40 min",
    content: [
      {
        type: "text",
        title: "Memorable NPCs in Minutes",
        content: "You don't need pages of backstory. A memorable NPC needs: A distinctive trait (accent, catchphrase, mannerism), A clear motivation (what they want), A secret (something they're hiding or know)."
      },
      {
        type: "table",
        title: "Quick NPC Generator",
        content: "",
        tableData: {
          headers: ["Element", "Examples"],
          rows: [
            ["Appearance", "Tall, scarred, always smiling, elaborate hat"],
            ["Voice", "Whispers, booming, stutters, rhymes"],
            ["Quirk", "Collects teeth, never sits, obsessed with birds"],
            ["Want", "Money, revenge, love, power, safety"],
            ["Secret", "Is a werewolf, owes the mob, former noble"]
          ]
        }
      },
      {
        type: "text",
        title: "World-Building Principles",
        content: "Start small - one town, one dungeon. Expand only as players explore. Ask: What makes this place unique? What conflicts exist? What secrets are hidden? Build out from player interests."
      },
      {
        type: "example",
        title: "Town in Five Minutes",
        content: "Millbrook: Small village, known for exceptional cheese. Problem: Wolves have been attacking farms, but they're actually werewolves and the mayor's son is one of them. NPCs: Suspicious mayor, brave young hunter, mysterious cheese merchant."
      },
      {
        type: "tip",
        content: "Let players fill in details. 'You've been to this city before - what's your favorite tavern here?' Players become invested in worlds they help create."
      }
    ]
  },
  {
    id: "dm-5",
    title: "Running Your First Session",
    duration: "30 min",
    content: [
      {
        type: "text",
        title: "Before the Session",
        content: "Confirm time and place with all players. Have character sheets ready or reviewed. Prepare snacks/drinks. Have dice, minis/tokens (optional), and notes organized. Review the adventure one more time."
      },
      {
        type: "text",
        title: "Opening the Session",
        content: "Start with a strong hook that immediately engages players. 'You're in a tavern' is weak. 'The tavern door bursts open and a wounded guard collapses at your feet, gasping about dragons' is strong."
      },
      {
        type: "table",
        title: "Session Flow Checklist",
        content: "",
        tableData: {
          headers: ["Phase", "What to Do"],
          rows: [
            ["Opening (10 min)", "Recap last session, set the scene, establish the hook"],
            ["Rising Action (60-90 min)", "Present challenges, roleplay, exploration"],
            ["Climax (30-45 min)", "Major encounter or revelation"],
            ["Resolution (15-20 min)", "Wrap up loose ends, set up next session"],
            ["Closing (5 min)", "Ask for feedback, confirm next session date"]
          ]
        }
      },
      {
        type: "text",
        title: "Common First-Session Mistakes",
        content: "Over-planning and railroading: Let players make choices. Rules lawyering: Make a ruling and look it up later. Spotlight hogging: Give everyone moments to shine. Running too long: End on time, leave them wanting more."
      },
      {
        type: "tip",
        content: "The most important rule: Everyone should have fun, including you. If something isn't working, it's okay to pause, discuss, and adjust. D&D is collaborative storytelling, not a competition."
      },
      {
        type: "practice",
        title: "DM Prep Checklist",
        content: "Before you run, confirm you have: Session outline with flexible structure, Key NPC names and motivations, Monster stat blocks ready, Maps or theater of mind descriptions, Backup plan if players go off-script, Snacks and enthusiasm!"
      }
    ]
  }
];

const LEARNING_PATHS_DATA: LearningPath[] = [
  {
    id: "new-player",
    title: "New Player",
    description: "Start your D&D journey with the fundamentals",
    icon: GraduationCap,
    lessons: NEW_PLAYER_LESSONS
  },
  {
    id: "experienced-player",
    title: "Experienced Player",
    description: "Deepen your mastery and tactical prowess",
    icon: TrendingUp,
    lessons: EXPERIENCED_PLAYER_LESSONS
  },
  {
    id: "aspiring-dm",
    title: "Aspiring DM",
    description: "Learn to run your own games",
    icon: Crown,
    lessons: ASPIRING_DM_LESSONS
  }
];

interface LearningPathContentProps {
  pathId?: string;
}

export function LearningPathContent({ pathId }: LearningPathContentProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(pathId || null);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());

  const currentPath = LEARNING_PATHS_DATA.find(p => p.id === selectedPath);
  const currentLesson = currentPath?.lessons[currentLessonIndex];

  const handleCompleteLesson = () => {
    if (currentLesson) {
      setCompletedLessons(prev => {
        const newSet = new Set(Array.from(prev));
        newSet.add(currentLesson.id);
        return newSet;
      });
      if (currentPath && currentLessonIndex < currentPath.lessons.length - 1) {
        setCurrentLessonIndex(prev => prev + 1);
      }
    }
  };

  const progressPercentage = currentPath 
    ? (completedLessons.size / currentPath.lessons.length) * 100
    : 0;

  if (!selectedPath) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold font-fantasy">Choose Your Learning Path</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {LEARNING_PATHS_DATA.map(path => {
            const IconComponent = path.icon;
            return (
              <Card 
                key={path.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => {
                  setSelectedPath(path.id);
                  setCurrentLessonIndex(0);
                }}
                data-testid={`path-${path.id}`}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconComponent className="h-5 w-5 text-primary" />
                    {path.title}
                  </CardTitle>
                  <CardDescription>{path.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {path.lessons.length} lessons
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  if (!currentPath || !currentLesson) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          onClick={() => setSelectedPath(null)}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Paths
        </Button>
        <Badge variant="outline">
          {completedLessons.size} / {currentPath.lessons.length} Complete
        </Badge>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold font-fantasy flex items-center gap-2">
          {(() => {
            const IconComponent = currentPath.icon;
            return <IconComponent className="h-6 w-6 text-primary" />;
          })()}
          {currentPath.title} Path
        </h2>
        <Progress value={progressPercentage} className="h-2" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Lessons</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {currentPath.lessons.map((lesson, index) => (
              <Button
                key={lesson.id}
                variant={index === currentLessonIndex ? "default" : "ghost"}
                className="w-full justify-start gap-2 h-auto py-2"
                onClick={() => setCurrentLessonIndex(index)}
                data-testid={`lesson-${lesson.id}`}
              >
                {completedLessons.has(lesson.id) ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 flex-shrink-0" />
                )}
                <span className="text-left text-sm">{lesson.title}</span>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">{currentLesson.title}</CardTitle>
              <Badge variant="secondary">{currentLesson.duration}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentLesson.content.map((section, index) => (
              <div key={index} className="space-y-2">
                {section.type === "text" && (
                  <div>
                    {section.title && (
                      <h3 className="font-semibold text-lg mb-2">{section.title}</h3>
                    )}
                    <p className="text-muted-foreground leading-relaxed">{section.content}</p>
                  </div>
                )}

                {section.type === "example" && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    {section.title && (
                      <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        {section.title}
                      </h4>
                    )}
                    <p className="text-blue-900 dark:text-blue-100">{section.content}</p>
                  </div>
                )}

                {section.type === "tip" && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                    <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                      💡 Pro Tip
                    </h4>
                    <p className="text-amber-900 dark:text-amber-100">{section.content}</p>
                  </div>
                )}

                {section.type === "practice" && (
                  <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    {section.title && (
                      <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2 flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        {section.title}
                      </h4>
                    )}
                    <p className="text-green-900 dark:text-green-100">{section.content}</p>
                  </div>
                )}

                {section.type === "table" && section.tableData && (
                  <div>
                    {section.title && (
                      <h3 className="font-semibold text-lg mb-2">{section.title}</h3>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-muted">
                            {section.tableData.headers.map((header, i) => (
                              <th key={i} className="border p-2 text-left font-semibold">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {section.tableData.rows.map((row, i) => (
                            <tr key={i} className={i % 2 === 0 ? "" : "bg-muted/50"}>
                              {row.map((cell, j) => (
                                <td key={j} className="border p-2">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="outline"
                disabled={currentLessonIndex === 0}
                onClick={() => setCurrentLessonIndex(prev => prev - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              
              {currentLessonIndex < currentPath.lessons.length - 1 ? (
                <Button onClick={handleCompleteLesson}>
                  Complete & Continue
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button 
                  onClick={handleCompleteLesson}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Complete Path
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
