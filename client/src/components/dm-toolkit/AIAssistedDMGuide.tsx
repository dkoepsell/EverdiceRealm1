import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bot,
  Brain,
  Users,
  Swords,
  MessageSquare,
  Lightbulb,
  CheckCircle,
  Clock,
  Target,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Book,
  Wand2
} from "lucide-react";

interface DMGuidanceStep {
  id: string;
  title: string;
  description: string;
  type: 'preparation' | 'execution' | 'resolution' | 'followup';
  isCompleted: boolean;
  aiSuggestion?: string;
  tips: string[];
  commonMistakes: string[];
}

interface EncounterContext {
  type: 'combat' | 'social' | 'exploration' | 'puzzle';
  difficulty: 'easy' | 'medium' | 'hard' | 'deadly';
  playerCount: number;
  averageLevel: number;
  setting: string;
  objectives: string[];
  npcs: string[];
  environment: string;
}

interface AIAssistedDMGuideProps {
  campaignId: number;
  isActive: boolean;
  onClose: () => void;
}

export default function AIAssistedDMGuide({ campaignId, isActive, onClose }: AIAssistedDMGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [encounterType, setEncounterType] = useState<EncounterContext['type']>('combat');
  const [context, setContext] = useState<EncounterContext | null>(null);
  const [steps, setSteps] = useState<DMGuidanceStep[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [userInput, setUserInput] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const { toast } = useToast();

  // Generate AI guidance for encounter
  const generateGuidanceMutation = useMutation({
    mutationFn: async (encounterData: EncounterContext) => {
      const response = await apiRequest('POST', '/api/dm-assistance/generate-guidance', {
        campaignId,
        encounterType: encounterData.type,
        context: encounterData
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      setSteps(data.steps || []);
      setAiSuggestions(data.suggestions || []);
      setContext(data.context || null);
      toast({
        title: "AI Guidance Generated",
        description: "Step-by-step guidance is ready"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to generate AI guidance. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Get real-time AI assistance
  const getAIAssistanceMutation = useMutation({
    mutationFn: async (request: string) => {
      const response = await apiRequest('POST', '/api/dm-assistance/real-time', {
        campaignId,
        request,
        context: context,
        currentStep: steps[currentStep]?.id,
        sessionNotes
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "AI Assistance",
        description: data.advice || "New suggestions generated"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to get AI assistance. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Combat guidance steps
  const combatSteps: DMGuidanceStep[] = [
    {
      id: "combat-prep",
      title: "Combat Preparation",
      description: "Set up the encounter and prepare all necessary materials",
      type: "preparation",
      isCompleted: false,
      tips: [
        "Roll initiative for all NPCs ahead of time",
        "Have stat blocks ready and bookmarked",
        "Prepare the battle map or theater of the mind description",
        "Note any special abilities or spells enemies will use"
      ],
      commonMistakes: [
        "Not having initiative ready",
        "Forgetting special abilities",
        "Poor positioning setup"
      ]
    },
    {
      id: "combat-start",
      title: "Initiative & Opening",
      description: "Roll initiative and set the scene dramatically",
      type: "execution",
      isCompleted: false,
      tips: [
        "Describe the threat clearly and dramatically",
        "Ask for initiative rolls from players",
        "Set clear positioning and distances",
        "Build tension with environmental details"
      ],
      commonMistakes: [
        "Rushing into combat without description",
        "Unclear positioning",
        "Forgetting to establish stakes"
      ]
    },
    {
      id: "combat-flow",
      title: "Managing Combat Flow",
      description: "Keep combat engaging and dynamic throughout",
      type: "execution",
      isCompleted: false,
      tips: [
        "Describe each attack vividly",
        "Use environment for tactical options",
        "Keep turns moving quickly",
        "Adjust difficulty on the fly if needed"
      ],
      commonMistakes: [
        "Repetitive descriptions",
        "Slow turn resolution",
        "Ignoring environment",
        "Not adapting to player strategy"
      ]
    },
    {
      id: "combat-climax",
      title: "Building to Climax",
      description: "Create dramatic moments and handle the resolution",
      type: "resolution",
      isCompleted: false,
      tips: [
        "Describe near-death moments dramatically",
        "Allow creative solutions to shine",
        "Use cinematic descriptions for killing blows",
        "Handle unexpected outcomes gracefully"
      ],
      commonMistakes: [
        "Anticlimactic endings",
        "Shutting down creativity",
        "Poor pacing in final moments"
      ]
    },
    {
      id: "combat-aftermath",
      title: "Post-Combat Resolution",
      description: "Handle aftermath, rewards, and story continuation",
      type: "followup",
      isCompleted: false,
      tips: [
        "Describe the aftermath vividly",
        "Award experience and treasure appropriately",
        "Address injuries and resource depletion",
        "Connect to overarching story"
      ],
      commonMistakes: [
        "Forgetting rewards",
        "Not addressing consequences",
        "Missing story connections"
      ]
    }
  ];

  // Initialize with combat steps
  useEffect(() => {
    if (isActive && steps.length === 0) {
      setSteps(combatSteps);
    }
  }, [isActive]);

  // Progress calculation
  const completedSteps = steps.filter(step => step.isCompleted).length;
  const progress = steps.length > 0 ? (completedSteps / steps.length) * 100 : 0;

  const handleStepComplete = (stepIndex: number) => {
    const updatedSteps = [...steps];
    updatedSteps[stepIndex].isCompleted = true;
    setSteps(updatedSteps);
    
    if (stepIndex < steps.length - 1) {
      setCurrentStep(stepIndex + 1);
    }
  };

  const getCurrentStepSuggestions = () => {
    const step = steps[currentStep];
    if (!step) return [];
    
    return [
      `Focus on: ${step.description}`,
      ...step.tips,
      `Avoid: ${step.commonMistakes.join(', ')}`
    ];
  };

  const handleGenerateGuidance = () => {
    const contextData: EncounterContext = {
      type: encounterType,
      difficulty: 'medium',
      playerCount: 4,
      averageLevel: 5,
      setting: 'Fantasy Adventure',
      objectives: ['Defeat enemies', 'Advance story'],
      npcs: [],
      environment: 'Standard dungeon room'
    };
    
    generateGuidanceMutation.mutate(contextData);
  };

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Bot className="h-6 w-6 text-primary" />
              <div>
                <h2 className="text-xl font-bold">AI-Assisted DM Guide</h2>
                <p className="text-sm text-muted-foreground">
                  Step-by-step guidance for conducting encounters
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
          
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Progress: {completedSteps}/{steps.length} steps</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <Tabs defaultValue="guidance" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="guidance">Step-by-Step</TabsTrigger>
              <TabsTrigger value="ai-assist">AI Assistant</TabsTrigger>
              <TabsTrigger value="quick-ref">Quick Reference</TabsTrigger>
            </TabsList>

            <TabsContent value="guidance" className="space-y-4">
              {/* Encounter Type Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Encounter Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {(['combat', 'social', 'exploration', 'puzzle'] as const).map((type) => (
                      <Button
                        key={type}
                        variant={encounterType === type ? "default" : "outline"}
                        onClick={() => setEncounterType(type)}
                        className="capitalize"
                      >
                        {type === 'combat' && <Swords className="h-4 w-4 mr-2" />}
                        {type === 'social' && <Users className="h-4 w-4 mr-2" />}
                        {type === 'exploration' && <Target className="h-4 w-4 mr-2" />}
                        {type === 'puzzle' && <Brain className="h-4 w-4 mr-2" />}
                        {type}
                      </Button>
                    ))}
                  </div>
                  <Button 
                    onClick={handleGenerateGuidance}
                    disabled={generateGuidanceMutation.isPending}
                    className="w-full"
                  >
                    {generateGuidanceMutation.isPending ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Generating Guidance...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate AI Guidance
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Current Step */}
              {steps[currentStep] && (
                <Card className="border-primary">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-2">
                        <Badge variant="outline">Step {currentStep + 1}</Badge>
                        <span>{steps[currentStep].title}</span>
                      </CardTitle>
                      <Button
                        onClick={() => handleStepComplete(currentStep)}
                        disabled={steps[currentStep].isCompleted}
                      >
                        {steps[currentStep].isCompleted ? (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        ) : (
                          <ArrowRight className="h-4 w-4 mr-2" />
                        )}
                        {steps[currentStep].isCompleted ? "Completed" : "Mark Complete"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      {steps[currentStep].description}
                    </p>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold text-green-600 mb-2 flex items-center">
                          <Lightbulb className="h-4 w-4 mr-2" />
                          Key Tips
                        </h4>
                        <ul className="space-y-1 text-sm">
                          {steps[currentStep].tips.map((tip, index) => (
                            <li key={index} className="flex items-start space-x-2">
                              <CheckCircle className="h-3 w-3 mt-1 text-green-500 flex-shrink-0" />
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold text-red-600 mb-2 flex items-center">
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          Common Mistakes
                        </h4>
                        <ul className="space-y-1 text-sm">
                          {steps[currentStep].commonMistakes.map((mistake, index) => (
                            <li key={index} className="flex items-start space-x-2">
                              <AlertTriangle className="h-3 w-3 mt-1 text-red-500 flex-shrink-0" />
                              <span>{mistake}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Step Overview */}
              <Card>
                <CardHeader>
                  <CardTitle>All Steps</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {steps.map((step, index) => (
                      <div
                        key={step.id}
                        className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          index === currentStep 
                            ? "border-primary bg-primary/5" 
                            : step.isCompleted 
                              ? "border-green-200 bg-green-50" 
                              : "border-muted"
                        }`}
                        onClick={() => setCurrentStep(index)}
                      >
                        <div className="flex-shrink-0">
                          {step.isCompleted ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : index === currentStep ? (
                            <Clock className="h-5 w-5 text-primary" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">{step.title}</h4>
                          <p className="text-sm text-muted-foreground">{step.description}</p>
                        </div>
                        <Badge variant={step.type === 'preparation' ? 'secondary' : 'outline'}>
                          {step.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ai-assist" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Sparkles className="h-5 w-5" />
                    <span>AI Assistant</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Ask the AI for help with your current situation..."
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    rows={3}
                  />
                  <Button
                    onClick={() => getAIAssistanceMutation.mutate(userInput)}
                    disabled={getAIAssistanceMutation.isPending || !userInput.trim()}
                    className="w-full"
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    Get AI Guidance
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Current Step Suggestions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {getCurrentStepSuggestions().map((suggestion, index) => (
                      <div key={index} className="p-3 bg-muted rounded-lg">
                        <p className="text-sm">{suggestion}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="quick-ref" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Book className="h-5 w-5" />
                    <span>Quick Reference</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2">Combat Actions</h4>
                      <ul className="text-sm space-y-1">
                        <li>• Attack: 1 action</li>
                        <li>• Cast a Spell: Varies</li>
                        <li>• Dash: 1 action (double speed)</li>
                        <li>• Dodge: 1 action (attackers have disadvantage)</li>
                        <li>• Help: 1 action (give ally advantage)</li>
                        <li>• Hide: 1 action (requires cover)</li>
                        <li>• Ready: 1 action (trigger reaction)</li>
                        <li>• Search: 1 action (investigate)</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Difficulty Guidelines</h4>
                      <ul className="text-sm space-y-1">
                        <li>• Easy: 50% daily XP budget</li>
                        <li>• Medium: 100% daily XP budget</li>
                        <li>• Hard: 150% daily XP budget</li>
                        <li>• Deadly: 200%+ daily XP budget</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}