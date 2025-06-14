import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Play, 
  Pause, 
  SkipForward, 
  RotateCcw, 
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Target,
  Users,
  Map,
  Volume2,
  Scroll,
  BookOpen,
  Lightbulb,
  Star,
  X,
  Eye,
  Hand
} from "lucide-react";

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  action: string;
  targetElement?: string;
  highlight?: string[];
  expectedOutcome: string;
  tips: string[];
  duration: number;
  canSkip: boolean;
}

interface InteractiveTutorialProps {
  isActive: boolean;
  onComplete: () => void;
  onClose: () => void;
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export default function InteractiveTutorial({ 
  isActive, 
  onComplete, 
  onClose, 
  currentTab, 
  onTabChange 
}: InteractiveTutorialProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [stepStartTime, setStepStartTime] = useState<Date | null>(null);

  // Tutorial scenarios
  const tutorialScenarios = {
    "campaign-creation": {
      title: "Creating Your First Campaign",
      description: "Learn how to set up a new D&D campaign from scratch",
      estimatedTime: "10 minutes",
      steps: [
        {
          id: "welcome",
          title: "Welcome to DM Toolkit",
          description: "This tutorial will guide you through creating and running your first D&D campaign.",
          action: "Click 'Start Tutorial' to begin your journey as a digital Dungeon Master.",
          expectedOutcome: "Understanding of the toolkit's purpose and capabilities",
          tips: [
            "Take your time - there's no rush",
            "You can pause or skip steps at any time",
            "Each step builds on the previous one"
          ],
          duration: 30,
          canSkip: false
        },
        {
          id: "navigate-to-live",
          title: "Navigate to Live Manager",
          description: "The Live Manager is your command center for running campaigns.",
          action: "Click on the 'Live' tab to access the Live Campaign Manager.",
          targetElement: "live-manager",
          expectedOutcome: "Live Manager tab is now active",
          tips: [
            "This is where you'll spend most of your time during sessions",
            "All campaign management starts here",
            "You can always return to this tab as your home base"
          ],
          duration: 45,
          canSkip: true
        },
        {
          id: "create-campaign",
          title: "Create New Campaign",
          description: "Every great adventure starts with a campaign.",
          action: "Click 'Create New Campaign' and fill in the basic details.",
          highlight: ["create-campaign-button"],
          expectedOutcome: "A new campaign is created and selected",
          tips: [
            "Choose a memorable name that inspires your players",
            "Set the difficulty based on your group's experience",
            "You can always edit these details later"
          ],
          duration: 120,
          canSkip: false
        },
        {
          id: "invite-players",
          title: "Invite Your Players",
          description: "A campaign needs heroes! Let's invite your players.",
          action: "Navigate to the 'Invites' tab and send invitations to your players.",
          targetElement: "invitations",
          expectedOutcome: "Player invitations are sent",
          tips: [
            "Include session expectations in your invitation",
            "Give players time to create their characters",
            "Consider scheduling a Session 0 for character creation"
          ],
          duration: 90,
          canSkip: true
        },
        {
          id: "setup-world",
          title: "Build Your World",
          description: "Create the locations and NPCs that will bring your world to life.",
          action: "Visit the 'Locations' tab and create your first location.",
          targetElement: "location-manager",
          expectedOutcome: "At least one location is created",
          tips: [
            "Start with a tavern or town square - classic but effective",
            "Give locations personality with unique features",
            "Think about how locations connect to your story"
          ],
          duration: 180,
          canSkip: true
        },
        {
          id: "plan-story",
          title: "Plan Your Story Arcs",
          description: "Create the narrative threads that will drive your campaign forward.",
          action: "Go to the 'Story' tab and outline your main story arc.",
          targetElement: "story-arcs",
          expectedOutcome: "Initial story arc is planned",
          tips: [
            "Start simple - one main quest is enough",
            "Leave room for player choices to shape the story",
            "Plan hooks that connect to character backgrounds"
          ],
          duration: 240,
          canSkip: true
        },
        {
          id: "tutorial-complete",
          title: "Campaign Setup Complete!",
          description: "Congratulations! Your campaign is ready for its first session.",
          action: "You're now ready to run your first session. Click 'Complete Tutorial' to finish.",
          expectedOutcome: "Campaign is fully set up and ready for play",
          tips: [
            "Remember to start session recording during play",
            "Use the guided workflow for your first session",
            "Don't worry about being perfect - every DM improves with practice"
          ],
          duration: 60,
          canSkip: false
        }
      ]
    },
    "live-session": {
      title: "Running Your First Live Session",
      description: "Master the tools for conducting live D&D sessions",
      estimatedTime: "15 minutes",
      steps: [
        {
          id: "session-prep",
          title: "Pre-Session Preparation",
          description: "Before your players arrive, let's set up for a smooth session.",
          action: "Start by enabling session recording to capture all the memorable moments.",
          targetElement: "session-recording",
          expectedOutcome: "Session recording is active",
          tips: [
            "Always test your audio/video setup before players arrive",
            "Have backup plans for technical difficulties",
            "Review your notes from the last session"
          ],
          duration: 90,
          canSkip: false
        },
        {
          id: "player-dashboard",
          title: "Monitor Player Characters",
          description: "Keep track of your players' character status in real-time.",
          action: "Navigate to the 'Players' tab to see live character information.",
          targetElement: "player-dashboard",
          expectedOutcome: "Player dashboard is visible and updating",
          tips: [
            "Watch for low HP to offer healing opportunities",
            "Track spell slots to balance encounter difficulty",
            "Note inspiration usage and opportunities to award more"
          ],
          duration: 60,
          canSkip: true
        },
        {
          id: "combat-setup",
          title: "Managing Combat",
          description: "Combat is where the toolkit really shines. Let's practice.",
          action: "Go to the 'Initiative' tab and add some test combatants.",
          targetElement: "initiative",
          expectedOutcome: "Initiative tracker has combatants and is ready",
          tips: [
            "Roll initiative for all participants before starting",
            "Use the 'Next Turn' button to keep combat flowing",
            "Track conditions and effects automatically"
          ],
          duration: 120,
          canSkip: true
        },
        {
          id: "battle-map",
          title: "Using Battle Maps",
          description: "Visual positioning helps players understand tactical situations.",
          action: "Switch to the 'Map' tab and place some character tokens.",
          targetElement: "battle-map",
          expectedOutcome: "Battle map is set up with positioned tokens",
          tips: [
            "Use different colored tokens for different creature types",
            "Update positions as creatures move during combat",
            "Reveal map areas as players explore"
          ],
          duration: 90,
          canSkip: true
        },
        {
          id: "atmosphere",
          title: "Setting the Mood",
          description: "Audio and visual effects enhance immersion dramatically.",
          action: "Visit the 'A/V' tab and select appropriate background music.",
          targetElement: "audio-visual",
          expectedOutcome: "Background music is playing",
          tips: [
            "Match music to the current scene mood",
            "Have sound effects ready for dramatic moments",
            "Adjust volume so players can still communicate clearly"
          ],
          duration: 60,
          canSkip: true
        },
        {
          id: "session-management",
          title: "Live Session Flow",
          description: "Putting it all together for smooth session management.",
          action: "Practice switching between tabs based on what's happening in game.",
          expectedOutcome: "Comfortable with the workflow and tab switching",
          tips: [
            "Keep the player dashboard open in a second window if possible",
            "Use voice commands when your hands are busy",
            "Take notes throughout the session for next time"
          ],
          duration: 120,
          canSkip: false
        }
      ]
    }
  };

  const currentScenario = tutorialScenarios["campaign-creation"]; // Default scenario
  const currentStep = currentScenario.steps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / currentScenario.steps.length) * 100;

  const nextStep = () => {
    if (currentStepIndex < currentScenario.steps.length - 1) {
      setCompletedSteps(prev => new Set([...prev, currentStep.id]));
      setCurrentStepIndex(prev => prev + 1);
      setStepStartTime(new Date());
      
      // Auto-navigate to required tab
      if (currentScenario.steps[currentStepIndex + 1].targetElement) {
        onTabChange(currentScenario.steps[currentStepIndex + 1].targetElement);
      }
    } else {
      completeTutorial();
    }
  };

  const previousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
      setStepStartTime(new Date());
    }
  };

  const skipStep = () => {
    if (currentStep.canSkip) {
      nextStep();
    }
  };

  const completeTutorial = () => {
    setCompletedSteps(prev => new Set([...prev, currentStep.id]));
    onComplete();
  };

  const resetTutorial = () => {
    setCurrentStepIndex(0);
    setCompletedSteps(new Set());
    setIsPlaying(false);
    setStepStartTime(null);
  };

  // Auto-play functionality
  useEffect(() => {
    if (isPlaying && stepStartTime) {
      const timer = setTimeout(() => {
        nextStep();
      }, currentStep.duration * 1000);

      return () => clearTimeout(timer);
    }
  }, [isPlaying, stepStartTime, currentStep.duration]);

  // Initialize step timer
  useEffect(() => {
    if (isActive) {
      setStepStartTime(new Date());
    }
  }, [isActive, currentStepIndex]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Star className="h-5 w-5 text-yellow-500" />
                <span>{currentScenario.title}</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {currentScenario.description}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center justify-between mt-4">
            <Badge variant="outline" className="text-xs">
              Step {currentStepIndex + 1} of {currentScenario.steps.length}
            </Badge>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-muted-foreground">
                Estimated time: {currentScenario.estimatedTime}
              </span>
            </div>
          </div>
          
          <Progress value={progress} className="mt-2" />
        </CardHeader>

        <CardContent className="p-6">
          {/* Current Step */}
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-1">
                {completedSteps.has(currentStep.id) ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <div className="h-6 w-6 rounded-full border-2 border-blue-600 flex items-center justify-center">
                    <span className="text-xs font-bold text-blue-600">
                      {currentStepIndex + 1}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">{currentStep.title}</h3>
                <p className="text-muted-foreground mb-4">{currentStep.description}</p>
                
                {/* Action Required */}
                <Alert className="border-blue-200 bg-blue-50 mb-4">
                  <Hand className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Your Action:</strong> {currentStep.action}
                  </AlertDescription>
                </Alert>

                {/* Expected Outcome */}
                <div className="bg-green-50 border border-green-200 rounded p-3 mb-4">
                  <div className="flex items-center space-x-2 mb-1">
                    <Target className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">Expected Outcome</span>
                  </div>
                  <p className="text-sm text-green-700">{currentStep.expectedOutcome}</p>
                </div>

                {/* Tips */}
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-800">Pro Tips</span>
                  </div>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {currentStep.tips.map((tip, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <span className="text-yellow-500 mt-1">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={previousStep}
                disabled={currentStepIndex === 0}
              >
                <ArrowLeft className="h-3 w-3 mr-1" />
                Previous
              </Button>
              
              {currentStep.canSkip && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={skipStep}
                >
                  <SkipForward className="h-3 w-3 mr-1" />
                  Skip
                </Button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? (
                  <><Pause className="h-3 w-3 mr-1" /> Pause</>
                ) : (
                  <><Play className="h-3 w-3 mr-1" /> Auto-Play</>
                )}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={resetTutorial}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Restart
              </Button>
              
              <Button onClick={nextStep}>
                {currentStepIndex === currentScenario.steps.length - 1 ? (
                  <>Complete Tutorial <CheckCircle className="h-3 w-3 ml-1" /></>
                ) : (
                  <>Continue <ArrowRight className="h-3 w-3 ml-1" /></>
                )}
              </Button>
            </div>
          </div>

          {/* Progress Summary */}
          <div className="mt-4 p-3 bg-muted rounded">
            <div className="flex items-center justify-between text-sm">
              <span>Progress: {Math.round(progress)}% complete</span>
              <span>
                {Array.from(completedSteps).length} of {currentScenario.steps.length} steps completed
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Highlight overlay for target elements */}
      {currentStep.targetElement && (
        <div className="fixed inset-0 pointer-events-none z-40">
          <div className="absolute inset-0 bg-black bg-opacity-30" />
          {/* Spotlight effect would be positioned based on target element */}
          <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-white bg-opacity-20 rounded-full animate-pulse" />
        </div>
      )}
    </div>
  );
}