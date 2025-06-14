import React, { useState } from "react";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BookOpen,
  CheckCircle,
  PlayCircle,
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
  Award,
  ChevronRight,
} from "lucide-react";

interface TrainingModule {
  id: string;
  title: string;
  description: string;
  duration: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  completed: boolean;
  lessons: TrainingLesson[];
}

interface TrainingLesson {
  id: string;
  title: string;
  content: string;
  tips: string[];
  commonMistakes: string[];
  practiceExercises: string[];
}

const trainingModules: TrainingModule[] = [
  {
    id: "basics",
    title: "DM Fundamentals",
    description: "Essential skills every new DM needs to know",
    duration: "45 min",
    difficulty: "beginner",
    completed: false,
    lessons: [
      {
        id: "role",
        title: "Understanding Your Role as DM",
        content: "As a Dungeon Master, you're the storyteller, referee, and world-builder. Your job is to create engaging experiences while ensuring everyone has fun. You're not the enemy of the players - you're their guide through an adventure.",
        tips: [
          "Focus on player enjoyment over strict rule adherence",
          "Say 'yes, and...' more often than 'no'",
          "Let players be creative with solutions",
          "Remember that you're all telling a story together"
        ],
        commonMistakes: [
          "Being too rigid with rules",
          "Creating adversarial relationships with players",
          "Over-planning every detail",
          "Not letting players affect the story"
        ],
        practiceExercises: [
          "Read through the basic rules once",
          "Watch experienced DMs run sessions online",
          "Practice describing scenes out loud"
        ]
      },
      {
        id: "preparation",
        title: "Session Preparation Essentials",
        content: "Good preparation doesn't mean planning every detail. Instead, prepare flexible elements: key NPCs, potential encounters, interesting locations, and plot hooks. Always have backup plans when players go off-script.",
        tips: [
          "Prepare situations, not scripts",
          "Create 3-4 backup encounters",
          "Know your NPCs' motivations",
          "Have a list of random names ready"
        ],
        commonMistakes: [
          "Over-preparing rigid storylines",
          "Not having backup content",
          "Forgetting to review player backstories",
          "Ignoring character motivations"
        ],
        practiceExercises: [
          "Create a simple tavern with 3 NPCs",
          "Design a quick combat encounter",
          "Practice improvising NPC voices"
        ]
      }
    ]
  },
  {
    id: "combat",
    title: "Running Combat Encounters",
    description: "Master the art of exciting, balanced combat",
    duration: "60 min",
    difficulty: "beginner",
    completed: false,
    lessons: [
      {
        id: "initiative",
        title: "Initiative and Turn Order",
        content: "Combat flows smoothly when everyone knows when to act. Use initiative to create tension and tactical decisions. Keep turns moving quickly - set a timer if needed.",
        tips: [
          "Roll initiative for groups of similar monsters",
          "Use a visible initiative tracker",
          "Set a 30-second decision timer for complex turns",
          "Let players declare actions while others are finishing"
        ],
        commonMistakes: [
          "Letting turns drag on too long",
          "Forgetting about environmental factors",
          "Not describing attacks cinematically",
          "Making combat feel like a math exercise"
        ],
        practiceExercises: [
          "Run a practice combat with imaginary players",
          "Time yourself describing attack results",
          "Practice managing initiative order"
        ]
      },
      {
        id: "balancing",
        title: "Balancing Encounters",
        content: "Good encounters challenge players without overwhelming them. Use the encounter building guidelines as a starting point, but adjust based on your group's capabilities and play style.",
        tips: [
          "Start with easier encounters and scale up",
          "Give players multiple victory conditions",
          "Use terrain and environment creatively",
          "Have escape routes available"
        ],
        commonMistakes: [
          "Making encounters too deadly early on",
          "Using only stand-and-fight combat",
          "Ignoring party composition",
          "Not adapting during the fight"
        ],
        practiceExercises: [
          "Design encounters for different party levels",
          "Create environmental hazards",
          "Practice adjusting difficulty mid-combat"
        ]
      }
    ]
  },
  {
    id: "storytelling",
    title: "Storytelling & Improvisation",
    description: "Bring your world to life with compelling narratives",
    duration: "50 min",
    difficulty: "intermediate",
    completed: false,
    lessons: [
      {
        id: "worldbuilding",
        title: "Building Your World",
        content: "Start small and expand outward. Begin with a town, add surrounding areas as needed. Focus on creating memorable NPCs and interesting conflicts rather than mapping every corner of your world.",
        tips: [
          "Start with a single town or district",
          "Create conflicts between factions",
          "Give NPCs clear motivations",
          "Let player backstories influence the world"
        ],
        commonMistakes: [
          "Creating too much world detail upfront",
          "Making the world static",
          "Ignoring player input",
          "Over-complicating politics"
        ],
        practiceExercises: [
          "Design a town with 3 important NPCs",
          "Create a local conflict with multiple sides",
          "Practice describing locations in 2-3 sentences"
        ]
      },
      {
        id: "improvisation",
        title: "Improvisation Techniques",
        content: "Players will always surprise you. Learn to say 'yes, and...' to build on their ideas. When you need to improvise, steal from movies, books, and other games. Keep lists of names, personality traits, and plot hooks handy.",
        tips: [
          "Keep lists of random names and traits",
          "Use the 'yes, and...' principle",
          "Steal ideas from media you love",
          "Ask players questions to buy thinking time"
        ],
        commonMistakes: [
          "Saying 'no' too quickly",
          "Panicking when plans go wrong",
          "Not building on player ideas",
          "Trying to force the original plan"
        ],
        practiceExercises: [
          "Practice creating NPCs on the spot",
          "Improvise responses to unusual player actions",
          "Create random encounter tables"
        ]
      }
    ]
  }
];

export default function DMTrainingCenterTab() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [activeLesson, setActiveLesson] = useState<string | null>(null);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());

  const completedModules = trainingModules.filter(m => m.completed).length;
  const totalModules = trainingModules.length;
  const overallProgress = (completedModules / totalModules) * 100;

  const markLessonComplete = (lessonId: string) => {
    setCompletedLessons(prev => new Set([...prev, lessonId]));
  };

  const currentModule = trainingModules.find(m => m.id === activeModule);
  const currentLesson = currentModule?.lessons.find(l => l.id === activeLesson);

  if (activeModule && currentLesson) {
    return (
      <div className="space-y-6">
        {/* Lesson Header */}
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

        {/* Lesson Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BookOpen className="h-5 w-5" />
                  <span>Lesson Content</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed mb-6">
                  {currentLesson.content}
                </p>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm mb-2 flex items-center">
                      <Lightbulb className="h-4 w-4 mr-2 text-yellow-600" />
                      Pro Tips
                    </h4>
                    <ul className="space-y-1">
                      {currentLesson.tips.map((tip, index) => (
                        <li key={index} className="text-sm flex items-start space-x-2">
                          <Star className="h-3 w-3 mt-0.5 text-yellow-600 flex-shrink-0" />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-sm mb-2 flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2 text-red-600" />
                      Common Mistakes to Avoid
                    </h4>
                    <ul className="space-y-1">
                      {currentLesson.commonMistakes.map((mistake, index) => (
                        <li key={index} className="text-sm flex items-start space-x-2">
                          <AlertTriangle className="h-3 w-3 mt-0.5 text-red-600 flex-shrink-0" />
                          <span>{mistake}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
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
                <ul className="space-y-2">
                  {currentLesson.practiceExercises.map((exercise, index) => (
                    <li key={index} className="text-sm flex items-start space-x-2">
                      <ChevronRight className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
                      <span>{exercise}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

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
                  ? "Next Lesson" 
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
    const moduleProgress = (completedLessons.size / module.lessons.length) * 100;

    return (
      <div className="space-y-6">
        {/* Module Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button 
              variant="ghost" 
              onClick={() => setActiveModule(null)}
              className="mb-2"
            >
              ← Back to Training Center
            </Button>
            <h2 className="text-2xl font-fantasy font-semibold">{module.title}</h2>
            <p className="text-muted-foreground">{module.description}</p>
          </div>
          <div className="text-right">
            <Badge variant={module.difficulty === "beginner" ? "default" : module.difficulty === "intermediate" ? "secondary" : "destructive"}>
              {module.difficulty}
            </Badge>
            <p className="text-sm text-muted-foreground mt-1">{module.duration}</p>
          </div>
        </div>

        {/* Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Module Progress</span>
              <span className="text-sm font-normal">{Math.round(moduleProgress)}% Complete</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={moduleProgress} className="w-full" />
          </CardContent>
        </Card>

        {/* Lessons */}
        <div className="grid grid-cols-1 gap-4">
          {module.lessons.map((lesson, index) => (
            <Card 
              key={lesson.id}
              className={`cursor-pointer transition-colors ${
                completedLessons.has(lesson.id) ? "border-green-200 bg-green-50" : "hover:border-primary"
              }`}
              onClick={() => setActiveLesson(lesson.id)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      completedLessons.has(lesson.id) 
                        ? "bg-green-600 text-white" 
                        : "bg-gray-200 text-gray-600"
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
                    {completedLessons.has(lesson.id) ? "Review" : "Start"}
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-fantasy font-semibold">DM Training Center</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Master the art of Dungeon Mastering with our comprehensive training modules. 
          Learn essential skills, best practices, and advanced techniques to create amazing experiences for your players.
        </p>
        
        {/* Overall Progress */}
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>Overall Progress</span>
              <span className="text-sm font-normal">{completedModules}/{totalModules} Modules</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={overallProgress} className="w-full" />
          </CardContent>
        </Card>
      </div>

      {/* Training Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {trainingModules.map((module) => {
          const moduleCompletedLessons = module.lessons.filter(l => completedLessons.has(l.id)).length;
          const moduleProgress = (moduleCompletedLessons / module.lessons.length) * 100;
          
          return (
            <Card 
              key={module.id}
              className={`cursor-pointer transition-colors ${
                module.completed ? "border-green-200 bg-green-50" : "hover:border-primary"
              }`}
              onClick={() => setActiveModule(module.id)}
            >
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={module.difficulty === "beginner" ? "default" : module.difficulty === "intermediate" ? "secondary" : "destructive"}>
                    {module.difficulty}
                  </Badge>
                  <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{module.duration}</span>
                  </div>
                </div>
                <CardTitle className="text-lg">{module.title}</CardTitle>
                <CardDescription>{module.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{moduleCompletedLessons}/{module.lessons.length} lessons</span>
                  </div>
                  <Progress value={moduleProgress} className="w-full" />
                  <Button className="w-full" variant={module.completed ? "outline" : "default"}>
                    {module.completed ? "Review Module" : "Start Module"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Start Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>Quick Start Guide</span>
          </CardTitle>
          <CardDescription>
            New to DMing? Start here for the essential knowledge you need for your first session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            <AccordionItem value="first-session">
              <AccordionTrigger>Preparing for Your First Session</AccordionTrigger>
              <AccordionContent className="space-y-2">
                <p className="text-sm">Here's what you need for your very first session:</p>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• Basic rules knowledge (Player's Handbook Chapter 7-10)</li>
                  <li>• A simple starting adventure (Lost Mine of Phandelver recommended)</li>
                  <li>• Character sheets for pre-generated characters</li>
                  <li>• Dice set and pencils</li>
                  <li>• Battle map or theater of the mind</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="session-zero">
              <AccordionTrigger>Running Session Zero</AccordionTrigger>
              <AccordionContent className="space-y-2">
                <p className="text-sm">Session Zero sets expectations and builds characters:</p>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• Discuss game tone and content boundaries</li>
                  <li>• Create characters together or review pre-made ones</li>
                  <li>• Establish party connections and shared goals</li>
                  <li>• Explain house rules and table etiquette</li>
                  <li>• Schedule regular game sessions</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="first-combat">
              <AccordionTrigger>Your First Combat Encounter</AccordionTrigger>
              <AccordionContent className="space-y-2">
                <p className="text-sm">Make combat exciting and manageable:</p>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• Start with simple enemies (1-2 goblins or wolves)</li>
                  <li>• Use initiative tracker visible to everyone</li>
                  <li>• Describe attacks cinematically, not just numbers</li>
                  <li>• Keep turns under 1 minute each</li>
                  <li>• Have fun with it - celebrate critical hits!</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}