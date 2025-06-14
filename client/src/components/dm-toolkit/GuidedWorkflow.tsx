import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle, 
  Circle, 
  Play, 
  Users, 
  Map, 
  Scroll, 
  Target,
  Volume2,
  BookOpen,
  ArrowRight,
  ArrowDown,
  Lightbulb,
  Star,
  Clock,
  Zap
} from "lucide-react";

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
  optional: boolean;
  estimatedTime: string;
  tips: string[];
  dependencies: string[];
  action?: () => void;
}

interface GuidedWorkflowProps {
  selectedCampaignId: number | null;
  onTabChange: (tab: string) => void;
  currentTab: string;
}

export default function GuidedWorkflow({ selectedCampaignId, onTabChange, currentTab }: GuidedWorkflowProps) {
  const [currentPhase, setCurrentPhase] = useState<'setup' | 'preparation' | 'live' | 'post'>('setup');
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [showTutorial, setShowTutorial] = useState(true);
  const [activeStep, setActiveStep] = useState<string | null>(null);

  // Workflow phases and steps
  const workflowPhases = {
    setup: {
      title: "Campaign Setup",
      description: "Create and configure your campaign",
      color: "bg-blue-500",
      steps: [
        {
          id: "create-campaign",
          title: "Create Campaign",
          description: "Set up basic campaign information and settings",
          icon: <Scroll className="h-4 w-4" />,
          completed: !!selectedCampaignId,
          optional: false,
          estimatedTime: "5 min",
          tips: [
            "Choose a compelling campaign title",
            "Set appropriate difficulty level",
            "Consider your target session length"
          ],
          dependencies: [],
          action: () => onTabChange('live-manager')
        },
        {
          id: "invite-players",
          title: "Invite Players",
          description: "Send invitations to your players",
          icon: <Users className="h-4 w-4" />,
          completed: false,
          optional: false,
          estimatedTime: "3 min",
          tips: [
            "Send invites early to give players time to prepare",
            "Include session expectations in the invitation",
            "Consider player experience levels"
          ],
          dependencies: ["create-campaign"],
          action: () => onTabChange('invitations')
        },
        {
          id: "world-building",
          title: "World Building",
          description: "Create locations, NPCs, and story arcs",
          icon: <Map className="h-4 w-4" />,
          completed: false,
          optional: true,
          estimatedTime: "15 min",
          tips: [
            "Start with 3-5 key locations",
            "Create memorable NPCs with clear motivations",
            "Plan story hooks that connect to player backgrounds"
          ],
          dependencies: ["create-campaign"],
          action: () => onTabChange('location-manager')
        }
      ]
    },
    preparation: {
      title: "Session Preparation",
      description: "Prepare for your next session",
      color: "bg-green-500",
      steps: [
        {
          id: "review-story",
          title: "Review Story Arcs",
          description: "Check current story progress and plan next developments",
          icon: <BookOpen className="h-4 w-4" />,
          completed: false,
          optional: false,
          estimatedTime: "10 min",
          tips: [
            "Review what happened last session",
            "Identify unresolved plot threads",
            "Plan 2-3 potential story directions"
          ],
          dependencies: ["create-campaign"],
          action: () => onTabChange('story-arcs')
        },
        {
          id: "prepare-encounters",
          title: "Prepare Encounters",
          description: "Set up combat encounters and challenges",
          icon: <Target className="h-4 w-4" />,
          completed: false,
          optional: true,
          estimatedTime: "15 min",
          tips: [
            "Balance encounters for your party level",
            "Prepare backup encounters if needed",
            "Consider environmental hazards"
          ],
          dependencies: ["create-campaign"],
          action: () => onTabChange('battle-map')
        },
        {
          id: "audio-setup",
          title: "Audio & Atmosphere",
          description: "Prepare music and sound effects",
          icon: <Volume2 className="h-4 w-4" />,
          completed: false,
          optional: true,
          estimatedTime: "5 min",
          tips: [
            "Test audio levels before the session",
            "Prepare playlists for different moods",
            "Have sound effects ready for key moments"
          ],
          dependencies: ["create-campaign"],
          action: () => onTabChange('audio-visual')
        }
      ]
    },
    live: {
      title: "Live Session",
      description: "Conduct your live D&D session",
      color: "bg-red-500",
      steps: [
        {
          id: "session-start",
          title: "Start Session",
          description: "Begin recording and set up player dashboard",
          icon: <Play className="h-4 w-4" />,
          completed: false,
          optional: false,
          estimatedTime: "2 min",
          tips: [
            "Start session recording for later review",
            "Ensure all players can see their character sheets",
            "Do a quick audio/video check"
          ],
          dependencies: ["review-story"],
          action: () => onTabChange('session-recording')
        },
        {
          id: "track-initiative",
          title: "Combat Management",
          description: "Use initiative tracker during combat",
          icon: <Zap className="h-4 w-4" />,
          completed: false,
          optional: true,
          estimatedTime: "Ongoing",
          tips: [
            "Roll initiative for all participants",
            "Track HP and conditions in real-time",
            "Use the battle map for positioning"
          ],
          dependencies: ["session-start"],
          action: () => onTabChange('initiative')
        },
        {
          id: "player-sync",
          title: "Character Tracking",
          description: "Monitor player character status in real-time",
          icon: <Users className="h-4 w-4" />,
          completed: false,
          optional: false,
          estimatedTime: "Ongoing",
          tips: [
            "Keep an eye on player HP and resources",
            "Update character conditions as needed",
            "Note important character moments"
          ],
          dependencies: ["session-start"],
          action: () => onTabChange('character-sync')
        }
      ]
    },
    post: {
      title: "Post-Session",
      description: "Wrap up and prepare for next time",
      color: "bg-purple-500",
      steps: [
        {
          id: "session-notes",
          title: "Session Summary",
          description: "Record what happened and plan follow-ups",
          icon: <Scroll className="h-4 w-4" />,
          completed: false,
          optional: false,
          estimatedTime: "10 min",
          tips: [
            "Note key story developments",
            "Record player achievements",
            "Plan hooks for next session"
          ],
          dependencies: ["session-start"],
          action: () => onTabChange('notes')
        },
        {
          id: "update-story",
          title: "Update Story Arcs",
          description: "Advance story progress based on session events",
          icon: <ArrowRight className="h-4 w-4" />,
          completed: false,
          optional: true,
          estimatedTime: "5 min",
          tips: [
            "Mark completed story milestones",
            "Update NPC relationships",
            "Plan consequences for player actions"
          ],
          dependencies: ["session-notes"],
          action: () => onTabChange('story-arcs')
        }
      ]
    }
  };

  const getCurrentPhaseSteps = () => workflowPhases[currentPhase].steps;
  const getCurrentPhaseProgress = () => {
    const steps = getCurrentPhaseSteps();
    const completed = steps.filter(step => completedSteps.has(step.id)).length;
    return (completed / steps.length) * 100;
  };

  const canAccessStep = (step: WorkflowStep) => {
    return step.dependencies.every(dep => completedSteps.has(dep));
  };

  const markStepCompleted = (stepId: string) => {
    setCompletedSteps(prev => new Set([...prev, stepId]));
  };

  const getNextRecommendedStep = () => {
    const currentSteps = getCurrentPhaseSteps();
    return currentSteps.find(step => !completedSteps.has(step.id) && canAccessStep(step));
  };

  // Auto-detect completed steps based on current state
  useEffect(() => {
    if (selectedCampaignId && !completedSteps.has('create-campaign')) {
      markStepCompleted('create-campaign');
    }
  }, [selectedCampaignId]);

  // Auto-advance phases
  useEffect(() => {
    const currentSteps = getCurrentPhaseSteps();
    const requiredSteps = currentSteps.filter(step => !step.optional);
    const completedRequired = requiredSteps.filter(step => completedSteps.has(step.id));
    
    if (completedRequired.length === requiredSteps.length) {
      // All required steps completed, can advance to next phase
      const phases = Object.keys(workflowPhases);
      const currentIndex = phases.indexOf(currentPhase);
      if (currentIndex < phases.length - 1) {
        // Auto-advance or suggest next phase
      }
    }
  }, [completedSteps, currentPhase]);

  return (
    <div className="space-y-6">
      {/* Tutorial Banner */}
      {showTutorial && (
        <Alert className="border-blue-200 bg-blue-50">
          <Lightbulb className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Welcome to the DM Toolkit! This guided workflow will help you create and run amazing D&D sessions.
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTutorial(false)}
            >
              Got it
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Phase Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Star className="h-5 w-5" />
            <span>Campaign Workflow</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={currentPhase} onValueChange={(value) => setCurrentPhase(value as any)}>
            <TabsList className="grid w-full grid-cols-4">
              {Object.entries(workflowPhases).map(([key, phase]) => (
                <TabsTrigger key={key} value={key} className="text-xs">
                  {phase.title}
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.entries(workflowPhases).map(([phaseKey, phase]) => (
              <TabsContent key={phaseKey} value={phaseKey} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{phase.title}</h3>
                    <p className="text-sm text-muted-foreground">{phase.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {phase.steps.filter(s => completedSteps.has(s.id)).length} / {phase.steps.length} Complete
                    </div>
                    <Progress value={getCurrentPhaseProgress()} className="w-32 mt-1" />
                  </div>
                </div>

                {/* Step List */}
                <div className="space-y-3">
                  {phase.steps.map((step, index) => {
                    const isCompleted = completedSteps.has(step.id);
                    const canAccess = canAccessStep(step);
                    const isActive = activeStep === step.id;

                    return (
                      <Card
                        key={step.id}
                        className={`transition-all cursor-pointer ${
                          isCompleted ? 'border-green-200 bg-green-50' :
                          canAccess ? 'border-blue-200 hover:border-blue-300' :
                          'border-gray-200 opacity-60'
                        } ${isActive ? 'ring-2 ring-blue-500' : ''}`}
                        onClick={() => setActiveStep(isActive ? null : step.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 mt-1">
                              {isCompleted ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <Circle className="h-5 w-5 text-gray-400" />
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  {step.icon}
                                  <h4 className="font-medium">{step.title}</h4>
                                  {step.optional && (
                                    <Badge variant="secondary" className="text-xs">Optional</Badge>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span>{step.estimatedTime}</span>
                                </div>
                              </div>
                              
                              <p className="text-sm text-muted-foreground mt-1">
                                {step.description}
                              </p>

                              {/* Expanded Step Details */}
                              {isActive && (
                                <div className="mt-4 space-y-3">
                                  <div>
                                    <h5 className="text-sm font-medium mb-2">Quick Tips:</h5>
                                    <ul className="text-sm text-muted-foreground space-y-1">
                                      {step.tips.map((tip, i) => (
                                        <li key={i} className="flex items-start space-x-2">
                                          <span className="text-blue-500 mt-1">•</span>
                                          <span>{tip}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>

                                  <div className="flex items-center space-x-2">
                                    {step.action && canAccess && (
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          step.action?.();
                                          if (!isCompleted) {
                                            markStepCompleted(step.id);
                                          }
                                        }}
                                        className="text-xs"
                                      >
                                        {isCompleted ? 'Review' : 'Start Task'}
                                        <ArrowRight className="h-3 w-3 ml-1" />
                                      </Button>
                                    )}
                                    
                                    {!isCompleted && canAccess && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => markStepCompleted(step.id)}
                                        className="text-xs"
                                      >
                                        Mark Complete
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Next Recommended Action */}
      {(() => {
        const nextStep = getNextRecommendedStep();
        if (nextStep) {
          return (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <ArrowDown className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-blue-900">Next Recommended Step</h4>
                    <p className="text-sm text-blue-700">{nextStep.title}: {nextStep.description}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      nextStep.action?.();
                      setActiveStep(nextStep.id);
                    }}
                  >
                    Start Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        }
        return null;
      })()}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(workflowPhases).map(([key, phase]) => {
          const completed = phase.steps.filter(s => completedSteps.has(s.id)).length;
          const total = phase.steps.length;
          const progress = (completed / total) * 100;
          
          return (
            <Card key={key}>
              <CardContent className="p-3 text-center">
                <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${phase.color}`} />
                <div className="text-sm font-medium">{phase.title}</div>
                <div className="text-xs text-muted-foreground">{completed}/{total} steps</div>
                <Progress value={progress} className="h-1 mt-1" />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}