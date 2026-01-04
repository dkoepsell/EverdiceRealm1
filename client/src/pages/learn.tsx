import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { RulesReference } from "@/components/education/RulesReference";
import { DMGuide } from "@/components/education/DMGuide";
import { LearningPathContent } from "@/components/education/LearningPathContent";
import { 
  BookOpen, 
  Users, 
  Crown, 
  Target,
  Dice6,
  Sword,
  Shield,
  GraduationCap,
  TrendingUp,
  Star
} from "lucide-react";

const LEARNING_PATHS = [
  {
    title: "New Player",
    description: "Just starting your D&D journey? Start here!",
    icon: GraduationCap,
    color: "bg-green-100 text-green-800 border-green-200",
    darkColor: "dark:bg-green-900 dark:text-green-200 dark:border-green-800",
    steps: [
      "Learn basic dice mechanics and ability scores",
      "Understand the core skills and when to use them",
      "Practice character creation and roleplay",
      "Learn combat basics and action economy",
      "Experience your first campaign session"
    ],
    timeEstimate: "2-3 hours",
    completionReward: "Basic Player Badge"
  },
  {
    title: "Experienced Player",
    description: "Ready to deepen your understanding?",
    icon: TrendingUp,
    color: "bg-blue-100 text-blue-800 border-blue-200",
    darkColor: "dark:bg-blue-900 dark:text-blue-200 dark:border-blue-800",
    steps: [
      "Master advanced combat tactics and positioning",
      "Learn spell interactions and optimization",
      "Understand party dynamics and teamwork",
      "Practice creative problem-solving approaches",
      "Explore multiclassing and character builds"
    ],
    timeEstimate: "4-5 hours",
    completionReward: "Advanced Player Badge"
  },
  {
    title: "Aspiring DM",
    description: "Want to run your own games?",
    icon: Crown,
    color: "bg-purple-100 text-purple-800 border-purple-200",
    darkColor: "dark:bg-purple-900 dark:text-purple-200 dark:border-purple-800",
    steps: [
      "Learn session preparation and planning",
      "Understand encounter design and balance",
      "Practice improvisation and player engagement",
      "Master NPC creation and world-building",
      "Run your first campaign session"
    ],
    timeEstimate: "6-8 hours",
    completionReward: "Dungeon Master Badge"
  }
];

const QUICK_REFERENCES = [
  {
    title: "Ability Scores",
    icon: Target,
    items: [
      "Strength: Physical power, athletics, melee attacks",
      "Dexterity: Agility, stealth, ranged attacks, AC",
      "Constitution: Health, stamina, concentration",
      "Intelligence: Reasoning, memory, investigation",
      "Wisdom: Awareness, insight, perception",
      "Charisma: Force of personality, social skills"
    ]
  },
  {
    title: "Action Types",
    icon: Sword,
    items: [
      "Action: Attack, cast spell, dash, dodge, help, hide",
      "Bonus Action: Special abilities, some spells",
      "Movement: Up to your speed, can be split",
      "Reaction: Opportunity attacks, some spells",
      "Free: Drop item, speak, draw weapon"
    ]
  },
  {
    title: "Advantage/Disadvantage",
    icon: Dice6,
    items: [
      "Advantage: Roll 2d20, use higher result",
      "Disadvantage: Roll 2d20, use lower result",
      "Sources: Positioning, spells, conditions, help",
      "They cancel out: Never stack multiples",
      "Affects: Attack rolls, ability checks, saves"
    ]
  }
];

export default function LearnPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold font-fantasy text-primary mb-3">
            D&D Learning Center
          </h1>
          <p className="text-lg text-muted-foreground">
            Master the art of D&D through guided learning paths, comprehensive references, and practical tools
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="paths" className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Lessons
            </TabsTrigger>
            <TabsTrigger value="rules" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Rules
            </TabsTrigger>
            <TabsTrigger value="dm-guide" className="flex items-center gap-2">
              <Crown className="h-4 w-4" />
              DM Guide
            </TabsTrigger>
            <TabsTrigger value="practice" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Practice
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-8">
              {/* Learning Paths */}
              <section>
                <h2 className="text-2xl font-bold font-fantasy mb-4">Choose Your Learning Path</h2>
                <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
                  {LEARNING_PATHS.map((path, index) => {
                    const IconComponent = path.icon;
                    return (
                      <Card 
                        key={index} 
                        className={`${path.color} ${path.darkColor} border-2 hover:shadow-lg transition-shadow cursor-pointer`}
                        onClick={() => setActiveTab("paths")}
                        data-testid={`overview-path-${index}`}
                      >
                        <CardHeader>
                          <div className="flex items-center gap-3 mb-2">
                            <IconComponent className="h-6 w-6" />
                            <CardTitle className="text-xl">{path.title}</CardTitle>
                          </div>
                          <CardDescription className="text-current/80">
                            {path.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm">Learning Steps:</h4>
                            <ol className="space-y-1 text-sm">
                              {path.steps.map((step, stepIndex) => (
                                <li key={stepIndex} className="flex items-start gap-2">
                                  <Badge variant="outline" className="flex-shrink-0 text-xs bg-current/10">
                                    {stepIndex + 1}
                                  </Badge>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-current/20">
                            <span className="text-xs">Est. {path.timeEstimate}</span>
                            <Badge variant="secondary" className="text-xs">
                              🏆 {path.completionReward}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>

              {/* Quick References */}
              <section>
                <h2 className="text-2xl font-bold font-fantasy mb-4">Quick Reference Cards</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  {QUICK_REFERENCES.map((ref, index) => {
                    const IconComponent = ref.icon;
                    return (
                      <Card key={index}>
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <IconComponent className="h-5 w-5 text-primary" />
                            {ref.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2 text-sm">
                            {ref.items.map((item, itemIndex) => (
                              <li key={itemIndex} className="flex items-start gap-2">
                                <span className="text-primary">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>

              {/* Getting Started */}
              <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <GraduationCap className="h-6 w-6" />
                    Ready to Start Learning?
                  </CardTitle>
                  <CardDescription>
                    Jump into our interactive tools and guided experiences
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="font-semibold">For Players:</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Explore the Rules Reference for instant lookup</li>
                      <li>• Create characters with guided explanations</li>
                      <li>• Practice with skill check scenarios</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">For DMs:</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Use the DM Guide for session prep</li>
                      <li>• Practice with encounter design tools</li>
                      <li>• Learn improvisation techniques</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="paths">
            <LearningPathContent />
          </TabsContent>

          <TabsContent value="rules">
            <RulesReference />
          </TabsContent>

          <TabsContent value="dm-guide">
            <DMGuide />
          </TabsContent>

          <TabsContent value="practice">
            <div className="text-center py-12">
              <Crown className="h-16 w-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold font-fantasy mb-2">Practice Mode Coming Soon!</h2>
              <p className="text-muted-foreground mb-6">
                Interactive scenarios, skill check simulators, and encounter builders are in development.
              </p>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 max-w-3xl mx-auto">
                <Card className="p-4 text-center">
                  <Dice6 className="h-8 w-8 text-primary mx-auto mb-2" />
                  <h3 className="font-semibold mb-1">Skill Check Trainer</h3>
                  <p className="text-sm text-muted-foreground">Practice different scenarios and learn when to use each skill</p>
                </Card>
                <Card className="p-4 text-center">
                  <Sword className="h-8 w-8 text-primary mx-auto mb-2" />
                  <h3 className="font-semibold mb-1">Combat Simulator</h3>
                  <p className="text-sm text-muted-foreground">Learn tactical combat with guided examples</p>
                </Card>
                <Card className="p-4 text-center">
                  <Users className="h-8 w-8 text-primary mx-auto mb-2" />
                  <h3 className="font-semibold mb-1">Roleplay Scenarios</h3>
                  <p className="text-sm text-muted-foreground">Practice social encounters and character interaction</p>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}