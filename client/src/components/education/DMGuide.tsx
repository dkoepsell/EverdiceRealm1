import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BookOpen, 
  Users, 
  Sword, 
  Map, 
  Crown, 
  Target, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  MessageSquare
} from "lucide-react";

const SESSION_PREP_CHECKLIST = [
  {
    category: "Story & Setting",
    items: [
      "Review last session's events and player choices",
      "Prepare 3-5 key NPCs with motivations and voices",
      "Design 2-3 potential scenes or encounters",
      "Think of 2-3 ways players might solve problems",
      "Prepare some random names for unexpected NPCs"
    ]
  },
  {
    category: "Mechanics",
    items: [
      "Review any new spells or abilities players gained",
      "Prepare initiative cards or digital tracker",
      "Check monster stats you might need",
      "Prepare skill check DCs for likely situations",
      "Have dice ready (or digital alternatives)"
    ]
  },
  {
    category: "Flexibility",
    items: [
      "Prepare modular encounters that work anywhere",
      "Think of ways to adjust difficulty on the fly",
      "Have backup plans if players go off-track",
      "Prepare transition phrases for scene changes",
      "Keep notes minimal - focus on key points only"
    ]
  }
];

const ENCOUNTER_GUIDELINES = [
  {
    title: "Easy Encounter",
    description: "Should use about 1/4 of party's resources",
    cr: "CR = Party Level ÷ 4",
    examples: ["Single weak monster", "Couple of minions", "Environmental hazard"],
    tips: ["Good for showing off abilities", "Use early in adventuring day", "Can be solved creatively"]
  },
  {
    title: "Medium Encounter", 
    description: "Should use about 1/2 of party's resources",
    cr: "CR = Party Level ÷ 2",
    examples: ["Single challenging foe", "Group of moderate enemies", "Complex skill challenge"],
    tips: ["Most common encounter type", "Balance offense and defense", "Include tactical options"]
  },
  {
    title: "Hard Encounter",
    description: "Should use about 3/4 of party's resources", 
    cr: "CR = Party Level × 0.75",
    examples: ["Powerful single enemy", "Large group of enemies", "Multi-stage encounter"],
    tips: ["Save for dramatic moments", "Ensure escape routes exist", "Monitor party resources"]
  },
  {
    title: "Deadly Encounter",
    description: "Could kill characters if played poorly",
    cr: "CR = Party Level or higher",
    examples: ["Boss fights", "Ambushes", "Desperate situations"],
    tips: ["Use sparingly", "Telegraph danger clearly", "Have contingency plans ready"]
  }
];

const DM_TIPS = [
  {
    category: "Player Engagement",
    icon: Users,
    tips: [
      "Ask each player 'What does [character name] do?' to keep everyone involved",
      "Build on player ideas - 'Yes, and...' instead of 'No, but...'",
      "Give spotlight time to quieter players by asking for their character's thoughts",
      "Use player backstories to create personal stakes in the story",
      "Celebrate creative solutions even if they're not what you planned"
    ]
  },
  {
    category: "Pacing & Flow",
    icon: Clock,
    tips: [
      "Start sessions with a quick recap of last time",
      "Use 'Meanwhile...' to switch focus when scenes drag",
      "End scenes on interesting questions or cliffhangers",
      "Take 5-minute breaks every 90 minutes to keep energy up",
      "Have a 'parking lot' for great ideas that don't fit right now"
    ]
  },
  {
    category: "Problem Solving",
    icon: Lightbulb,
    tips: [
      "If you don't know a rule, make a fair ruling and look it up later",
      "When players get stuck, give them three options to consider",
      "Use passive skills (Perception, Insight) to provide helpful information",
      "Let consequences happen, but give players chances to react",
      "Remember: You're a fan of the characters, not their opponent"
    ]
  },
  {
    category: "Improvisation",
    icon: MessageSquare,
    tips: [
      "Keep lists of random names, taverns, and NPCs for unexpected moments",
      "When players go off-script, ask 'What are you hoping to accomplish?'",
      "Recycle unused material - that dungeon can appear anywhere",
      "If players have a better idea than yours, steal it!",
      "Trust your instincts - if something feels right, it probably is"
    ]
  }
];

const COMMON_SITUATIONS = [
  {
    situation: "Player wants to do something not covered by rules",
    approach: "Collaborative Ruling",
    steps: [
      "Ask the player to describe exactly what they want to achieve",
      "Determine what ability score makes most sense",
      "Set a DC based on difficulty (Easy 10, Medium 15, Hard 20)",
      "Explain your reasoning to the table",
      "Make a note to research the official rule later"
    ]
  },
  {
    situation: "Players are stuck and don't know what to do next",
    approach: "Gentle Guidance",
    steps: [
      "Ask 'What is your character thinking right now?'",
      "Offer three possible approaches they could consider",
      "Use an NPC to provide hints or ask for help",
      "Allow a relevant skill check to reveal new information", 
      "Take a 5-minute break to let players discuss"
    ]
  },
  {
    situation: "Combat is taking too long or getting boring",
    approach: "Dynamic Adjustments",
    steps: [
      "Add environmental elements (falling rocks, fire, etc.)",
      "Have enemies focus on objectives beyond just fighting",
      "Reduce enemy HP or increase player damage slightly",
      "Introduce complications that change the tactical situation",
      "Use the 'Rule of Three' - encounters should escalate every 3 rounds"
    ]
  }
];

export function DMGuide() {
  const [activeTab, setActiveTab] = useState("prep");

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-fantasy text-primary mb-2">Dungeon Master's Guide</h1>
        <p className="text-muted-foreground">
          Essential tips, tools, and techniques for running great D&D sessions
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="prep" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Session Prep
          </TabsTrigger>
          <TabsTrigger value="encounters" className="flex items-center gap-2">
            <Sword className="h-4 w-4" />
            Encounters
          </TabsTrigger>
          <TabsTrigger value="tips" className="flex items-center gap-2">
            <Crown className="h-4 w-4" />
            DM Tips
          </TabsTrigger>
          <TabsTrigger value="situations" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Common Issues
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="prep">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Session Preparation Checklist
                  </CardTitle>
                  <CardDescription>
                    A systematic approach to preparing for your D&D sessions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {SESSION_PREP_CHECKLIST.map((section, index) => (
                      <div key={index}>
                        <h3 className="font-semibold text-lg mb-3 text-primary">{section.category}</h3>
                        <div className="grid gap-2">
                          {section.items.map((item, itemIndex) => (
                            <div key={itemIndex} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                              <div className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                              <span className="text-sm">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <CardHeader>
                  <CardTitle className="text-blue-900 dark:text-blue-100">Time Management</CardTitle>
                </CardHeader>
                <CardContent className="text-blue-800 dark:text-blue-200 text-sm space-y-2">
                  <p><strong>15 minutes before session:</strong> Quick review of notes and key NPCs</p>
                  <p><strong>30 minutes prep time:</strong> Enough for most sessions if you focus on key elements</p>
                  <p><strong>Don't over-prepare:</strong> Players will surprise you - prepare situations, not solutions</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="encounters">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Encounter Difficulty Guidelines
                  </CardTitle>
                  <CardDescription>
                    Balancing encounters for your party's level and resources
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {ENCOUNTER_GUIDELINES.map((encounter, index) => (
                      <Card key={index} className="border-l-4 border-l-primary">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">{encounter.title}</CardTitle>
                          <CardDescription>{encounter.description}</CardDescription>
                          <Badge variant="outline" className="w-fit">{encounter.cr}</Badge>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <h4 className="font-semibold text-sm mb-1">Examples:</h4>
                            <ul className="text-sm space-y-1">
                              {encounter.examples.map((example, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-muted-foreground">•</span>
                                  <span>{example}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm mb-1">Tips:</h4>
                            <ul className="text-sm space-y-1">
                              {encounter.tips.map((tip, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-muted-foreground">💡</span>
                                  <span>{tip}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tips">
            <ScrollArea className="h-[600px]">
              <div className="space-y-6">
                {DM_TIPS.map((category, index) => {
                  const IconComponent = category.icon;
                  return (
                    <Card key={index}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <IconComponent className="h-5 w-5" />
                          {category.category}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {category.tips.map((tip, tipIndex) => (
                            <div key={tipIndex} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                              <div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                              <span className="text-sm leading-relaxed">{tip}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="situations">
            <ScrollArea className="h-[600px]">
              <div className="space-y-6">
                {COMMON_SITUATIONS.map((scenario, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="text-lg">{scenario.situation}</CardTitle>
                      <Badge variant="secondary" className="w-fit">{scenario.approach}</Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm text-primary">Step-by-step approach:</h4>
                        <ol className="space-y-2">
                          {scenario.steps.map((step, stepIndex) => (
                            <li key={stepIndex} className="flex items-start gap-3">
                              <Badge variant="outline" className="flex-shrink-0 text-xs">
                                {stepIndex + 1}
                              </Badge>
                              <span className="text-sm">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>

      <Card className="mt-6 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
        <CardHeader>
          <CardTitle className="text-amber-900 dark:text-amber-100 flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Remember: The Golden Rule of DMing
          </CardTitle>
        </CardHeader>
        <CardContent className="text-amber-800 dark:text-amber-200">
          <p className="text-sm leading-relaxed">
            <strong>Your job isn't to tell a story - it's to help everyone at the table tell a story together.</strong>
            {" "}Be a fan of the player characters, say "yes" when you can, and remember that the best 
            moments often come from player creativity, not your careful planning. Focus on making sure 
            everyone has fun, including yourself!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}