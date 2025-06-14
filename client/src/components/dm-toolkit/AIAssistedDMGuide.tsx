import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  AlertCircle,
  Lightbulb,
  Shield,
  Swords,
  Users,
  Map,
  BookOpen,
  X,
  Send,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Star,
  Target,
  Brain,
  Zap,
} from "lucide-react";

interface AIAssistedDMGuideProps {
  campaignId: number;
  onClose: () => void;
}

interface GuidanceStep {
  id: number;
  title: string;
  description: string;
  tips: string[];
  commonMistakes: string[];
  suggestions: string[];
}

interface GuidanceSession {
  encounterType: string;
  currentStep: number;
  totalSteps: number;
  steps: GuidanceStep[];
  sessionNotes: string;
}

const encounterTypes = [
  { value: "combat", label: "Combat Encounter", icon: Swords },
  { value: "social", label: "Social Encounter", icon: Users },
  { value: "exploration", label: "Exploration", icon: Map },
  { value: "puzzle", label: "Puzzle/Mystery", icon: Brain },
];

export default function AIAssistedDMGuide({ campaignId, onClose }: AIAssistedDMGuideProps) {
  const [selectedEncounterType, setSelectedEncounterType] = useState<string>("");
  const [currentSession, setCurrentSession] = useState<GuidanceSession | null>(null);
  const [situationDescription, setSituationDescription] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [isGeneratingGuidance, setIsGeneratingGuidance] = useState(false);
  const { toast } = useToast();

  // Fetch campaign data
  const { data: campaign } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}`],
    enabled: !!campaignId,
  });

  // Generate AI guidance mutation
  const generateGuidanceMutation = useMutation({
    mutationFn: async (data: {
      campaignId: number;
      encounterType: string;
      situation: string;
      currentStep?: number;
    }) => {
      return await apiRequest("POST", "/api/dm-assistance/generate-guidance", data);
    },
    onSuccess: (response: any) => {
      setCurrentSession({
        encounterType: selectedEncounterType,
        currentStep: 0,
        totalSteps: response.steps.length,
        steps: response.steps,
        sessionNotes: "",
      });
      setIsGeneratingGuidance(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate guidance",
        variant: "destructive",
      });
      setIsGeneratingGuidance(false);
    },
  });

  const handleStartGuidance = () => {
    if (!selectedEncounterType || !situationDescription.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select an encounter type and describe the situation",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingGuidance(true);
    generateGuidanceMutation.mutate({
      campaignId,
      encounterType: selectedEncounterType,
      situation: situationDescription,
    });
  };

  const handleNextStep = () => {
    if (currentSession && currentSession.currentStep < currentSession.totalSteps - 1) {
      setCurrentSession({
        ...currentSession,
        currentStep: currentSession.currentStep + 1,
      });
    }
  };

  const handlePreviousStep = () => {
    if (currentSession && currentSession.currentStep > 0) {
      setCurrentSession({
        ...currentSession,
        currentStep: currentSession.currentStep - 1,
      });
    }
  };

  const handleGetMoreGuidance = () => {
    if (currentSession && situationDescription.trim()) {
      setIsGeneratingGuidance(true);
      generateGuidanceMutation.mutate({
        campaignId,
        encounterType: currentSession.encounterType,
        situation: situationDescription,
        currentStep: currentSession.currentStep,
      });
    }
  };

  const currentStep = currentSession?.steps[currentSession.currentStep];
  const selectedEncounter = encounterTypes.find(type => type.value === selectedEncounterType);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <span>AI DM Assistant</span>
            {campaign && (
              <Badge variant="outline" className="ml-2">
                {(campaign as any).title}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Get step-by-step guidance for running encounters and managing your campaign
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!currentSession ? (
            // Setup Phase
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {encounterTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <Card
                      key={type.value}
                      className={`cursor-pointer transition-all ${
                        selectedEncounterType === type.value
                          ? "border-purple-500 bg-purple-50 dark:bg-purple-950"
                          : "hover:border-purple-300"
                      }`}
                      onClick={() => setSelectedEncounterType(type.value)}
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center space-x-2 text-lg">
                          <Icon className="h-5 w-5" />
                          <span>{type.label}</span>
                        </CardTitle>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>

              <div className="space-y-3">
                <Label htmlFor="situation">Describe the Current Situation</Label>
                <Textarea
                  id="situation"
                  placeholder="Describe what's happening in your campaign right now. Include details about the players, NPCs, location, and any challenges they're facing..."
                  value={situationDescription}
                  onChange={(e) => setSituationDescription(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={onClose}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleStartGuidance}
                  disabled={isGeneratingGuidance || !selectedEncounterType || !situationDescription.trim()}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {isGeneratingGuidance ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Guidance...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Start AI Guidance
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            // Guidance Phase
            <div className="space-y-6">
              {/* Progress Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {selectedEncounter && (
                    <selectedEncounter.icon className="h-5 w-5 text-purple-600" />
                  )}
                  <div>
                    <h3 className="font-semibold text-lg">
                      {selectedEncounter?.label} - Step {currentSession.currentStep + 1} of {currentSession.totalSteps}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {currentStep?.title}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousStep}
                    disabled={currentSession.currentStep === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextStep}
                    disabled={currentSession.currentStep === currentSession.totalSteps - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${((currentSession.currentStep + 1) / currentSession.totalSteps) * 100}%`,
                  }}
                />
              </div>

              {/* Current Step Content */}
              {currentStep && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <BookOpen className="h-5 w-5" />
                          <span>Step Guidance</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm leading-relaxed mb-4">
                          {currentStep.description}
                        </p>
                        {currentStep.suggestions.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm">Suggested Actions:</h4>
                            <ul className="space-y-1">
                              {currentStep.suggestions.map((suggestion, index) => (
                                <li key={index} className="text-sm flex items-start space-x-2">
                                  <ChevronRight className="h-3 w-3 mt-0.5 text-green-600 flex-shrink-0" />
                                  <span>{suggestion}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <Lightbulb className="h-5 w-5 text-yellow-600" />
                          <span>Pro Tips</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {currentStep.tips.map((tip, index) => (
                            <li key={index} className="text-sm flex items-start space-x-2">
                              <Star className="h-3 w-3 mt-0.5 text-yellow-600 flex-shrink-0" />
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <AlertCircle className="h-5 w-5 text-red-600" />
                          <span>Common Mistakes</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {currentStep.commonMistakes.map((mistake, index) => (
                            <li key={index} className="text-sm flex items-start space-x-2">
                              <X className="h-3 w-3 mt-0.5 text-red-600 flex-shrink-0" />
                              <span>{mistake}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Session Notes</CardTitle>
                        <CardDescription>
                          Keep track of what happens during this encounter
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Textarea
                          placeholder="Write notes about player actions, dice rolls, story developments..."
                          value={sessionNotes}
                          onChange={(e) => setSessionNotes(e.target.value)}
                          rows={6}
                        />
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={handleGetMoreGuidance}
                    disabled={isGeneratingGuidance}
                  >
                    {isGeneratingGuidance ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    Get More Guidance
                  </Button>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentSession(null)}
                  >
                    New Session
                  </Button>
                  <Button variant="outline" onClick={onClose}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}