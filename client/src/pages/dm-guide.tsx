import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  BookOpen, 
  Users, 
  Play,
  Settings,
  Wand2,
  Crown,
  Target,
  Clock,
  CheckCircle,
  Lightbulb,
  MessageSquare,
  Dice6,
  Map,
  Plus,
  ArrowRight,
  ChevronRight,
  Sparkles,
  Bot,
  User,
  Shield,
  Swords,
  AlertCircle,
  Vote,
  Timer,
  RefreshCw,
  GripVertical,
  Upload,
  List,
  Hash,
  Eye,
  EyeOff,
  Pause,
  Zap,
  History,
  Pencil,
  Save,
  Undo2,
  ExternalLink,
  HelpCircle,
} from "lucide-react";
import { SiDiscord } from "react-icons/si";

const QUICK_START_STEPS = [
  {
    step: 1,
    title: "Create or Select a Campaign",
    description: "Go to the DM Toolkit and either create a new campaign using AI generation or select an existing one.",
    details: [
      "Click 'New Campaign' to create from scratch or use AI generation",
      "AI-generated campaigns include story arcs, NPCs, and locations",
      "Set the number of chapters to define your story length"
    ],
    icon: Plus,
    link: "/dm-toolkit"
  },
  {
    step: 2,
    title: "Invite Your Players",
    description: "Share invite links or use Discord integration to bring players into your campaign.",
    details: [
      "Find the invite link in Campaign Settings",
      "Players can join with their own characters",
      "Discord integration allows playing directly in your server"
    ],
    icon: Users
  },
  {
    step: 3,
    title: "Launch the Live Manager",
    description: "Open your campaign in the Live Manager to start running your session.",
    details: [
      "The Live Manager is your DM command center",
      "All session controls are available from the control bar",
      "Drag NPCs, items, and locations onto your scene"
    ],
    icon: Play
  },
  {
    step: 4,
    title: "Run Your Session",
    description: "Use AI narration, dice rolls, and player choices to guide your adventure.",
    details: [
      "Switch between DM narration and AI autopilot",
      "Request dice rolls from players for ability checks",
      "Create choices for players to vote on"
    ],
    icon: Crown
  }
];

const LIVE_MANAGER_SECTIONS = [
  {
    id: "control-bar",
    title: "The Control Bar",
    subtitle: "Your session command center at the top of the screen",
    icon: Settings,
    content: {
      description: "The control bar gives you instant access to all session controls. It stays visible as you scroll so you always have control.",
      features: [
        {
          name: "Pause/Resume",
          description: "Pause the session when you need to look something up or take a break. Players will see a 'Session Paused' indicator.",
          icon: Pause
        },
        {
          name: "Session Mode",
          description: "Set the current mode (Exploration, Social, Combat, Puzzle, Downtime, Travel) to help the AI understand the scene context.",
          icon: Target
        },
        {
          name: "Narrative Control",
          description: "Switch between 'DM' (you write narration) and 'AI' (AI generates narrative based on player actions).",
          icon: Bot
        },
        {
          name: "Checkpoint",
          description: "Save the current game state. You can restore to any checkpoint if things go wrong.",
          icon: Save
        },
        {
          name: "History",
          description: "View and restore previous checkpoints. Great for 'what if' scenarios or correcting mistakes.",
          icon: History
        },
        {
          name: "Inject",
          description: "Insert custom narration into the current scene without advancing the story.",
          icon: Pencil
        },
        {
          name: "Override",
          description: "Manually change game state like HP, conditions, or inventory when needed.",
          icon: Zap
        }
      ]
    }
  },
  {
    id: "sidebar",
    title: "The Sidebar Tabs",
    subtitle: "Queue, Dice, AI, and Say panels for managing your session",
    icon: List,
    content: {
      description: "The right sidebar contains four essential tabs for running your game:",
      tabs: [
        {
          name: "Queue",
          badge: "Events",
          description: "Shows pending events like player actions, AI suggestions, and story beats. Accept, modify, or reject each event.",
          tips: ["Events stack up while paused", "Process them in order for smooth flow", "AI events can be edited before accepting"]
        },
        {
          name: "Dice",
          badge: "Rolls",
          description: "Your complete dice rolling toolkit with public and hidden rolls.",
          tips: [
            "Roll any die from d4 to d100",
            "Add modifiers and purpose labels",
            "Toggle public/hidden for secret DM rolls",
            "Request rolls from specific players",
            "Track initiative with the built-in tracker"
          ]
        },
        {
          name: "AI",
          badge: "Whispers",
          description: "Private AI suggestions and insights only the DM can see.",
          tips: [
            "Get narrative suggestions based on context",
            "Receive NPC motivation hints",
            "See arc opportunities for characters",
            "AI adapts to your session mode"
          ]
        },
        {
          name: "Say",
          badge: "Chat",
          description: "Send messages to the table or whisper to specific players.",
          tips: [
            "Speak as yourself or as NPCs",
            "Private whispers for secret info",
            "Great for dramatic reveals"
          ]
        }
      ]
    }
  },
  {
    id: "scene-area",
    title: "The Scene Area",
    subtitle: "Your virtual tabletop where the action happens",
    icon: Map,
    content: {
      description: "The central scene area is where you build and manage your current encounter.",
      sections: [
        {
          name: "Current Scene",
          description: "Displays the active scene with all participants, description, and current state."
        },
        {
          name: "Drag & Drop",
          description: "Drag NPCs, monsters, items, and locations from the left sidebar onto the scene to add them to play."
        },
        {
          name: "Initiative Order",
          description: "During combat, the initiative tracker shows turn order with HP and conditions."
        },
        {
          name: "Player Choices",
          description: "When you create a group choice, it appears prominently for all players to see and vote on."
        }
      ]
    }
  },
  {
    id: "entity-drawer",
    title: "The Entity Drawer",
    subtitle: "Your collection of NPCs, items, monsters, and locations",
    icon: GripVertical,
    content: {
      description: "The left drawer contains all your campaign assets ready to drag onto the scene.",
      entityTypes: [
        { name: "NPCs", icon: Users, description: "Characters you've created or AI-generated allies and enemies" },
        { name: "Items", icon: Target, description: "Weapons, armor, treasures, and magical items" },
        { name: "Monsters", icon: Swords, description: "Creatures from your encounters or the SRD library" },
        { name: "Locations", icon: Map, description: "Places in your campaign world" },
        { name: "Quests", icon: Target, description: "Active quests and objectives" }
      ],
      tips: [
        "Drag any entity onto the scene to add it to play",
        "Entities remember their state between sessions",
        "Generate new entities on the fly with AI assistance"
      ]
    }
  }
];

const RUNNING_SESSION_TOPICS = [
  {
    id: "starting",
    title: "Starting Your Session",
    icon: Play,
    steps: [
      {
        title: "Set the Scene",
        description: "Begin with a brief recap of where players left off. Use 'Inject' to add opening narration that sets the mood.",
        tip: "AI can generate a recap automatically based on previous session notes."
      },
      {
        title: "Check Player Status",
        description: "Verify all players are connected and their characters are ready. The presence indicator shows who's online.",
        tip: "Players who haven't connected will show as offline with their last seen time."
      },
      {
        title: "Choose Your Mode",
        description: "Set the Session Mode to match your opening (usually Exploration or Social). This helps AI suggestions stay relevant.",
        tip: "You can change modes anytime - combat mode activates initiative tracking."
      }
    ]
  },
  {
    id: "narration",
    title: "Managing Narration",
    icon: BookOpen,
    modes: [
      {
        name: "DM Mode",
        description: "You write all narration manually. AI only provides whispered suggestions.",
        best_for: "Important dramatic moments, precise descriptions, or when you have a specific vision",
        how: "Click 'Inject' to add narration, or type in the scene description area"
      },
      {
        name: "AI Mode",
        description: "AI generates narrative based on player actions and campaign context.",
        best_for: "Faster-paced sessions, exploration sequences, or when you want inspiration",
        how: "The AI will propose narration in the Queue tab - review and accept or edit"
      },
      {
        name: "Hybrid Approach",
        description: "Switch between modes as needed. Let AI handle routine moments, take over for key scenes.",
        best_for: "Most sessions - gives you flexibility while reducing workload",
        how: "Toggle between DM and AI using the Narrative control in the control bar"
      }
    ]
  },
  {
    id: "dice",
    title: "Dice Rolling",
    icon: Dice6,
    sections: [
      {
        title: "DM Rolls",
        description: "As DM, you can roll any die instantly from the Dice tab.",
        features: [
          "Select die type (d4-d100) and quantity",
          "Add modifiers for NPC attacks or saves",
          "Add purpose labels like 'Goblin Attack' for the log",
          "Toggle public/hidden - hidden rolls only you can see"
        ]
      },
      {
        title: "Requesting Player Rolls",
        description: "Send roll requests to players for ability checks, saves, or attacks.",
        features: [
          "Click 'Request Roll' and select the roll type",
          "Choose which players should roll",
          "Player sees the request in their campaign panel",
          "Results appear in the Roll Queue for everyone"
        ]
      },
      {
        title: "Initiative",
        description: "Track combat order with the built-in initiative tracker.",
        features: [
          "Click 'Roll All' to roll initiative for the party",
          "Add monsters manually or from your entities",
          "Track HP, AC, and conditions for each combatant",
          "Current turn is highlighted with action buttons"
        ]
      }
    ]
  },
  {
    id: "choices",
    title: "Player Choices & Voting",
    icon: Vote,
    description: "Create meaningful decisions for your players with the group choice system.",
    workflow: [
      {
        step: 1,
        title: "Create a Choice",
        description: "In the Queue tab, click 'Create Group Choice'. Write a prompt describing the decision point.",
        example: "The party reaches a fork in the road. The left path leads to the mountains, the right to the forest."
      },
      {
        step: 2,
        title: "Add Options",
        description: "Add 2-4 choice options. You can write them yourself or click 'Generate with AI' for suggestions.",
        example: "Option 1: Take the mountain path (harder but shorter). Option 2: Take the forest path (easier but longer)."
      },
      {
        step: 3,
        title: "Set Timeout (Optional)",
        description: "Configure auto-resolution timeout (1-72 hours) to prevent campaign stalling. Default is 12 hours.",
        tip: "Great for async play - the choice resolves automatically if players don't vote in time."
      },
      {
        step: 4,
        title: "Players Vote",
        description: "Players see the choice in their campaign panel and vote. They can change their vote until resolved.",
        tip: "You can see current votes in real-time and resolve manually whenever ready."
      },
      {
        step: 5,
        title: "Resolution",
        description: "Resolve the choice to continue the story. Majority wins, with initiative breaking ties.",
        options: ["Resolve with majority vote", "DM override to pick any option", "Auto-resolve when timeout expires"]
      }
    ]
  },
  {
    id: "combat",
    title: "Running Combat",
    icon: Swords,
    phases: [
      {
        name: "Setup",
        steps: [
          "Switch to Combat mode in the control bar",
          "Drag monsters onto the scene from your entities",
          "Click 'Roll All' for party initiative, add monsters manually",
          "Set starting HP for all combatants"
        ]
      },
      {
        name: "Combat Rounds",
        steps: [
          "Initiative tracker shows current turn",
          "Request attack/save rolls from the current player",
          "Apply damage using the Override feature",
          "Track conditions (poisoned, prone, etc.)",
          "Advance to next turn when ready"
        ]
      },
      {
        name: "Resolution",
        steps: [
          "When combat ends, switch back to Exploration or Social mode",
          "Award XP if using experience tracking",
          "Distribute loot using the item system",
          "Use AI to narrate the aftermath"
        ]
      }
    ],
    tips: [
      "Create checkpoints before major battles",
      "Use hidden rolls for monster actions",
      "AI whispers can suggest tactical moves for smarter monsters"
    ]
  }
];

const ADVANCED_FEATURES = [
  {
    id: "discord",
    title: "Discord Integration",
    icon: SiDiscord,
    description: "Run campaigns directly in your Discord server with slash commands.",
    setup: [
      "Enable Discord integration in Campaign Settings",
      "Add the Everdice bot to your Discord server",
      "Link your Discord channel to the campaign"
    ],
    commands: [
      { command: "/roll", description: "Roll dice with modifiers (e.g., /roll 2d6+3)" },
      { command: "/recap", description: "Get a summary of recent story events" },
      { command: "/status", description: "Check your character's current status" },
      { command: "/vote", description: "Vote on active group choices" }
    ],
    tips: [
      "Players can participate via Discord without opening Everdice",
      "All rolls and story updates sync in real-time",
      "Great for async play with busy groups"
    ]
  },
  {
    id: "caml",
    title: "CAML Adventures",
    icon: BookOpen,
    description: "Import or create structured adventures using CAML (Canonical Adventure Markup Language).",
    features: [
      "Pre-built adventure modules with scenes and encounters",
      "Export your campaigns as shareable CAML files",
      "Import community adventures",
      "Structured entity definitions for NPCs and items"
    ],
    tips: [
      "CAML adventures provide consistent structure",
      "Great for published modules or sharing with other DMs",
      "AI can generate CAML-compatible content"
    ]
  },
  {
    id: "npc-companions",
    title: "NPC Companions",
    icon: Users,
    description: "Add AI-controlled companions that travel with the party.",
    features: [
      "Create unique companion instances per campaign",
      "Track companion inventory and equipment",
      "Generate AI portraits for companions",
      "Companions have their own personality and motivations"
    ],
    tips: [
      "Companions can provide hints when players are stuck",
      "Give companions flaws to make them interesting",
      "Use companions to deliver exposition naturally"
    ]
  },
  {
    id: "chapter-structure",
    title: "Chapter Structure",
    icon: BookOpen,
    description: "Campaigns have clear chapter progression to prevent endless stories.",
    features: [
      "Define total chapters when creating campaigns",
      "Track current chapter in story progression",
      "AI recognizes final chapters and drives toward conclusion",
      "Satisfying endings with epilogues and XP rewards"
    ],
    tips: [
      "3-5 chapters works well for most campaigns",
      "Final chapters trigger special AI instructions",
      "Players receive completion rewards and records"
    ]
  }
];

const FAQ_ITEMS = [
  {
    question: "How do I switch between DM and AI narration?",
    answer: "Use the Narrative toggle in the control bar at the top. 'DM' means you write everything, 'AI' means the AI generates narrative and you approve it."
  },
  {
    question: "Can players join mid-session?",
    answer: "Yes! Players can join anytime using the invite link. They'll see the current scene and can start participating immediately."
  },
  {
    question: "What happens if no one votes on a group choice?",
    answer: "If you set a timeout, the choice auto-resolves using majority vote, initiative tiebreaker, or defaults to the first option. This prevents campaigns from stalling."
  },
  {
    question: "How do I roll dice secretly?",
    answer: "In the Dice tab, toggle the eye icon to 'Hidden'. Your roll won't be shown to players - great for perception checks or monster attacks."
  },
  {
    question: "Can I undo an action?",
    answer: "Yes! Use the Checkpoint feature to save game state, then restore to any checkpoint. You can also use 'Undo' for recent changes."
  },
  {
    question: "How does the AI know what to narrate?",
    answer: "The AI uses your session mode, current scene, player actions, and campaign history to generate relevant narration. It respects your chapter structure and story arcs."
  },
  {
    question: "What's the difference between Inject and Override?",
    answer: "Inject adds narration text to the scene. Override changes game mechanics like HP, conditions, or inventory."
  },
  {
    question: "How do I end a campaign properly?",
    answer: "When you reach the final chapter, the AI will drive toward conclusion. Complete the chapter normally and the system will generate an epilogue, XP rewards, and completion record."
  }
];

export default function DMGuidePage() {
  const [activeTab, setActiveTab] = useState("quickstart");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 text-amber-400 text-sm mb-4">
            <Crown className="h-4 w-4" />
            Dungeon Master's Guide
          </div>
          <h1 className="text-4xl md:text-5xl font-bold font-fantasy mb-4 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
            Running Sessions on Everdice
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Your complete guide to mastering the Live Manager and running unforgettable 
            tabletop RPG sessions - whether you're a newcomer or an experienced DM.
          </p>
        </div>

        <div className="flex justify-center gap-3 mb-8 flex-wrap">
          <Button asChild variant="default" className="bg-amber-500 hover:bg-amber-600">
            <Link href="/dm-toolkit">
              Open DM Toolkit <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
            <Link href="/learn">
              Learn D&D Basics <BookOpen className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 bg-slate-800/50">
            <TabsTrigger value="quickstart" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">
              Quick Start
            </TabsTrigger>
            <TabsTrigger value="interface" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">
              Interface
            </TabsTrigger>
            <TabsTrigger value="sessions" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">
              Running Sessions
            </TabsTrigger>
            <TabsTrigger value="advanced" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">
              Advanced
            </TabsTrigger>
            <TabsTrigger value="faq" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">
              FAQ
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quickstart" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-400">
                  <Sparkles className="h-5 w-5" />
                  Get Running in 4 Steps
                </CardTitle>
                <CardDescription className="text-slate-400">
                  From zero to running your first session in minutes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {QUICK_START_STEPS.map((step, index) => {
                    const IconComponent = step.icon;
                    return (
                      <div key={step.step} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-lg">
                            {step.step}
                          </div>
                          {index < QUICK_START_STEPS.length - 1 && (
                            <div className="w-0.5 h-full bg-slate-700 mt-2" />
                          )}
                        </div>
                        <div className="flex-1 pb-6">
                          <div className="flex items-center gap-2 mb-1">
                            <IconComponent className="h-5 w-5 text-amber-400" />
                            <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                          </div>
                          <p className="text-slate-300 mb-3">{step.description}</p>
                          <ul className="space-y-1.5">
                            {step.details.map((detail, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                {detail}
                              </li>
                            ))}
                          </ul>
                          {step.link && (
                            <Button asChild variant="link" className="text-amber-400 p-0 mt-2">
                              <Link href={step.link}>
                                Go to DM Toolkit <ChevronRight className="h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-400">
                  <Lightbulb className="h-5 w-5" />
                  Pro Tip for New DMs
                </CardTitle>
              </CardHeader>
              <CardContent className="text-slate-300">
                <p className="mb-4">
                  Start with AI-generated campaigns to get a feel for the system. They come pre-loaded with 
                  NPCs, story arcs, and encounters. Once comfortable, create your own custom adventures!
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/50">
                    AI Generation Available
                  </Badge>
                  <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/50">
                    Pre-made Templates
                  </Badge>
                  <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/50">
                    SRD Content Included
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="interface" className="space-y-6">
            <div className="grid gap-6">
              {LIVE_MANAGER_SECTIONS.map((section) => {
                const IconComponent = section.icon;
                return (
                  <Card key={section.id} className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3 text-white">
                        <div className="p-2 rounded-lg bg-amber-500/20">
                          <IconComponent className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                          <div className="text-lg">{section.title}</div>
                          <div className="text-sm font-normal text-slate-400">{section.subtitle}</div>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-slate-300">
                      <p className="mb-4">{section.content.description}</p>
                      
                      {'features' in section.content && section.content.features && (
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                          {section.content.features.map((feature, i) => {
                            const FeatureIcon = feature.icon;
                            return (
                              <div key={i} className="p-3 rounded-lg bg-slate-700/50 border border-slate-600">
                                <div className="flex items-center gap-2 mb-1">
                                  <FeatureIcon className="h-4 w-4 text-amber-400" />
                                  <span className="font-medium text-white text-sm">{feature.name}</span>
                                </div>
                                <p className="text-xs text-slate-400">{feature.description}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {'tabs' in section.content && section.content.tabs && (
                        <div className="grid gap-4 md:grid-cols-2">
                          {section.content.tabs.map((tab, i) => (
                            <div key={i} className="p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-semibold text-white">{tab.name}</span>
                                <Badge variant="secondary" className="text-xs">{tab.badge}</Badge>
                              </div>
                              <p className="text-sm text-slate-400 mb-3">{tab.description}</p>
                              <ul className="space-y-1">
                                {tab.tips.map((tip, j) => (
                                  <li key={j} className="flex items-start gap-2 text-xs text-slate-400">
                                    <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                                    {tip}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}

                      {'sections' in section.content && section.content.sections && (
                        <div className="space-y-3">
                          {section.content.sections.map((s, i) => (
                            <div key={i} className="p-3 rounded-lg bg-slate-700/50 border border-slate-600">
                              <span className="font-medium text-white">{s.name}:</span>
                              <span className="text-slate-400 ml-2">{s.description}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {'entityTypes' in section.content && section.content.entityTypes && (
                        <>
                          <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-5 mb-4">
                            {section.content.entityTypes.map((entity, i) => {
                              const EntityIcon = entity.icon;
                              return (
                                <div key={i} className="p-3 rounded-lg bg-slate-700/50 border border-slate-600 text-center">
                                  <EntityIcon className="h-6 w-6 text-amber-400 mx-auto mb-1" />
                                  <div className="font-medium text-white text-sm">{entity.name}</div>
                                  <div className="text-xs text-slate-400">{entity.description}</div>
                                </div>
                              );
                            })}
                          </div>
                          {'tips' in section.content && section.content.tips && (
                            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                              <h4 className="font-medium text-amber-400 mb-2">Tips:</h4>
                              <ul className="space-y-1">
                                {section.content.tips.map((tip, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                                    <Lightbulb className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                                    {tip}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-6">
            <Accordion type="single" collapsible className="space-y-4">
              {RUNNING_SESSION_TOPICS.map((topic) => {
                const TopicIcon = topic.icon;
                return (
                  <AccordionItem 
                    key={topic.id} 
                    value={topic.id}
                    className="bg-slate-800/50 border-slate-700 rounded-lg px-4"
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/20">
                          <TopicIcon className="h-5 w-5 text-amber-400" />
                        </div>
                        <span className="text-white font-semibold">{topic.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-300 pt-4">
                      {'steps' in topic && topic.steps && (
                        <div className="space-y-4">
                          {topic.steps.map((step, i) => (
                            <div key={i} className="p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                              <h4 className="font-semibold text-white mb-2">{step.title}</h4>
                              <p className="text-sm text-slate-400 mb-2">{step.description}</p>
                              {step.tip && (
                                <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 p-2 rounded">
                                  <Lightbulb className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                  {step.tip}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {'modes' in topic && topic.modes && (
                        <div className="grid gap-4 md:grid-cols-3">
                          {topic.modes.map((mode, i) => (
                            <div key={i} className="p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                              <h4 className="font-semibold text-white mb-2">{mode.name}</h4>
                              <p className="text-sm text-slate-400 mb-3">{mode.description}</p>
                              <div className="text-xs text-slate-500 mb-2">
                                <strong className="text-slate-300">Best for:</strong> {mode.best_for}
                              </div>
                              <div className="text-xs text-amber-400">
                                <strong>How:</strong> {mode.how}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {'sections' in topic && topic.sections && (
                        <div className="space-y-4">
                          {topic.sections.map((topicSection, i) => (
                            <div key={i} className="p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                              <h4 className="font-semibold text-white mb-2">{topicSection.title}</h4>
                              <p className="text-sm text-slate-400 mb-3">{topicSection.description}</p>
                              <ul className="space-y-1">
                                {topicSection.features.map((feature, j) => (
                                  <li key={j} className="flex items-start gap-2 text-sm text-slate-300">
                                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                    {feature}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}

                      {'workflow' in topic && topic.workflow && (
                        <div className="space-y-4">
                          <p className="text-slate-400 mb-4">{topic.description}</p>
                          {topic.workflow.map((step, i) => (
                            <div key={i} className="flex gap-4">
                              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm flex-shrink-0">
                                {step.step}
                              </div>
                              <div className="flex-1">
                                <h4 className="font-semibold text-white mb-1">{step.title}</h4>
                                <p className="text-sm text-slate-400 mb-2">{step.description}</p>
                                {step.example && (
                                  <div className="text-xs text-slate-500 bg-slate-700/50 p-2 rounded italic">
                                    Example: {step.example}
                                  </div>
                                )}
                                {step.tip && (
                                  <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 p-2 rounded mt-2">
                                    <Lightbulb className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                    {step.tip}
                                  </div>
                                )}
                                {step.options && (
                                  <div className="mt-2 space-y-1">
                                    {step.options.map((opt, j) => (
                                      <Badge key={j} variant="outline" className="mr-2 text-xs">
                                        {opt}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {'phases' in topic && topic.phases && (
                        <div className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-3">
                            {topic.phases.map((phase, i) => (
                              <div key={i} className="p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                                <h4 className="font-semibold text-white mb-3">{phase.name}</h4>
                                <ol className="space-y-2">
                                  {phase.steps.map((step, j) => (
                                    <li key={j} className="flex items-start gap-2 text-sm text-slate-400">
                                      <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-xs flex-shrink-0">
                                        {j + 1}
                                      </span>
                                      {step}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            ))}
                          </div>
                          {'tips' in topic && topic.tips && (
                            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                              <h4 className="font-medium text-amber-400 mb-2">Combat Tips:</h4>
                              <ul className="space-y-1">
                                {topic.tips.map((tip, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                                    <Lightbulb className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                                    {tip}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {ADVANCED_FEATURES.map((feature) => {
                const FeatureIcon = feature.icon;
                return (
                  <Card key={feature.id} className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3 text-white">
                        <div className="p-2 rounded-lg bg-amber-500/20">
                          <FeatureIcon className="h-5 w-5 text-amber-400" />
                        </div>
                        {feature.title}
                      </CardTitle>
                      <CardDescription className="text-slate-400">
                        {feature.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {'setup' in feature && feature.setup && (
                        <div>
                          <h4 className="text-sm font-semibold text-white mb-2">Setup:</h4>
                          <ol className="space-y-1">
                            {feature.setup.map((step, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                                <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-xs flex-shrink-0">
                                  {i + 1}
                                </span>
                                {step}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {'commands' in feature && feature.commands && (
                        <div>
                          <h4 className="text-sm font-semibold text-white mb-2">Commands:</h4>
                          <div className="space-y-2">
                            {feature.commands.map((cmd, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm">
                                <code className="px-2 py-1 rounded bg-slate-700 text-amber-400 font-mono text-xs">
                                  {cmd.command}
                                </code>
                                <span className="text-slate-400">{cmd.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {'features' in feature && feature.features && (
                        <ul className="space-y-1">
                          {feature.features.map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                        <h4 className="font-medium text-amber-400 text-sm mb-2">Tips:</h4>
                        <ul className="space-y-1">
                          {feature.tips.map((tip, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                              <Lightbulb className="h-3 w-3 text-amber-400 mt-0.5 flex-shrink-0" />
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="faq" className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-400">
                  <HelpCircle className="h-5 w-5" />
                  Frequently Asked Questions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="space-y-2">
                  {FAQ_ITEMS.map((item, i) => (
                    <AccordionItem 
                      key={i} 
                      value={`faq-${i}`}
                      className="border-slate-600 rounded-lg px-4"
                    >
                      <AccordionTrigger className="hover:no-underline text-left">
                        <span className="text-white">{item.question}</span>
                      </AccordionTrigger>
                      <AccordionContent className="text-slate-400">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-400">
                  <MessageSquare className="h-5 w-5" />
                  Still Have Questions?
                </CardTitle>
              </CardHeader>
              <CardContent className="text-slate-300">
                <p className="mb-4">
                  Join our Discord community to get help from other DMs, share your campaigns, 
                  and stay updated on new features.
                </p>
                <Button variant="outline" className="border-blue-500/50 text-blue-400 hover:bg-blue-500/20">
                  <SiDiscord className="mr-2 h-4 w-4" />
                  Join Discord Community
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Separator className="my-10 bg-slate-700" />

        <div className="text-center">
          <p className="text-slate-500 text-sm mb-4">
            Ready to start your adventure?
          </p>
          <Button asChild size="lg" className="bg-amber-500 hover:bg-amber-600">
            <Link href="/dm-toolkit">
              <Crown className="mr-2 h-5 w-5" />
              Open DM Toolkit
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
