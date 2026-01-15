import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Sparkles, 
  Users, 
  MapPin, 
  Zap, 
  Play, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  Plus,
  X,
  BookOpen
} from "lucide-react";

interface NPC {
  name: string;
  role: string;
  trait: string;
}

interface QuickStartData {
  adventureTitle: string;
  settingDescription: string;
  npcs: NPC[];
  locationName: string;
  locationAtmosphere: string;
  tension: string;
}

const STEP_TITLES = [
  "Name Your Adventure",
  "Meet the Cast",
  "Set the Scene", 
  "The Hook",
  "Ready to Play!"
];

const STEP_DESCRIPTIONS = [
  "Every great story needs a title. What's yours?",
  "Who will your players meet? Add a few memorable characters.",
  "Where does the adventure begin? Paint the scene.",
  "What's the mystery, the conflict, the thing that demands action?",
  "Your adventure is ready. Let's begin!"
];

const NPC_SUGGESTIONS = [
  { name: "Mira Thornwood", role: "Tavern Owner", trait: "Knows everyone's secrets" },
  { name: "Captain Vex", role: "Guard Captain", trait: "Haunted by a past failure" },
  { name: "Old Bramble", role: "Hermit Sage", trait: "Speaks only in riddles" },
];

const TENSION_SUGGESTIONS = [
  "Villagers are disappearing at night, and the guards won't investigate",
  "A dying stranger arrives with a map and a warning",
  "The local lord has banned all magic, but dark rituals continue in secret",
  "An ancient prophecy is coming true, and the heroes are named in it",
];

export default function DMQuickStart({ onComplete, onCancel }: { 
  onComplete: (campaignId: number) => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<QuickStartData>({
    adventureTitle: "",
    settingDescription: "",
    npcs: [{ name: "", role: "", trait: "" }],
    locationName: "",
    locationAtmosphere: "",
    tension: ""
  });

  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      const campaignData = {
        title: data.adventureTitle,
        description: `${data.settingDescription}\n\nStarting Location: ${data.locationName} - ${data.locationAtmosphere}\n\nThe Hook: ${data.tension}`,
        setting: data.settingDescription,
        theme: "fantasy",
        status: "active"
      };
      
      const campaign = await apiRequest("POST", "/api/campaigns", campaignData);
      const campaignResult = await campaign.json();
      
      for (const npc of data.npcs.filter(n => n.name.trim())) {
        const npcData = {
          name: npc.name,
          race: "Human",
          occupation: npc.role || "Villager",
          personality: npc.trait || "Friendly and helpful",
          appearance: "Average build, common attire",
          motivation: "Pursuing their own goals",
          hitPoints: 10,
          maxHitPoints: 10,
          armorClass: 10,
          level: 1,
          isCompanion: true,
          companionType: "social"
        };
        
        const npcResponse = await apiRequest("POST", "/api/npcs", npcData);
        const npcResult = await npcResponse.json();
        
        await apiRequest("POST", `/api/campaigns/${campaignResult.id}/npcs`, {
          npcId: npcResult.id,
          role: "ally"
        });
      }
      
      const locationData = {
        name: data.locationName,
        description: data.locationAtmosphere,
        locationType: "settlement",
        atmosphere: data.locationAtmosphere
      };
      await apiRequest("POST", `/api/campaigns/${campaignResult.id}/locations`, locationData);
      
      return campaignResult;
    },
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: "Adventure Created!",
        description: `"${data.adventureTitle}" is ready. Time to tell your story!`,
      });
      onComplete(campaign.id);
    },
    onError: (error: any) => {
      toast({
        title: "Oops!",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    }
  });

  const progress = ((currentStep + 1) / STEP_TITLES.length) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case 0: return data.adventureTitle.trim().length > 0;
      case 1: return data.npcs.some(n => n.name.trim().length > 0);
      case 2: return data.locationName.trim().length > 0;
      case 3: return data.tension.trim().length > 0;
      case 4: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (currentStep < STEP_TITLES.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      createCampaignMutation.mutate();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const addNPC = () => {
    if (data.npcs.length < 5) {
      setData({ ...data, npcs: [...data.npcs, { name: "", role: "", trait: "" }] });
    }
  };

  const removeNPC = (index: number) => {
    if (data.npcs.length > 1) {
      const newNpcs = data.npcs.filter((_, i) => i !== index);
      setData({ ...data, npcs: newNpcs });
    }
  };

  const updateNPC = (index: number, field: keyof NPC, value: string) => {
    const newNpcs = [...data.npcs];
    newNpcs[index] = { ...newNpcs[index], [field]: value };
    setData({ ...data, npcs: newNpcs });
  };

  const useSuggestion = (index: number) => {
    const suggestion = NPC_SUGGESTIONS[index % NPC_SUGGESTIONS.length];
    const npcIndex = data.npcs.findIndex(n => !n.name.trim());
    if (npcIndex !== -1) {
      updateNPC(npcIndex, "name", suggestion.name);
      updateNPC(npcIndex, "role", suggestion.role);
      updateNPC(npcIndex, "trait", suggestion.trait);
    }
  };

  return (
    <div className="min-h-[500px] flex flex-col">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Step {currentStep + 1} of {STEP_TITLES.length}</span>
          <span className="text-sm font-medium text-amber-500">{Math.round(progress)}% Complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent mb-2">
          {STEP_TITLES[currentStep]}
        </h2>
        <p className="text-muted-foreground">{STEP_DESCRIPTIONS[currentStep]}</p>
      </div>

      <div className="flex-1 mb-8">
        {currentStep === 0 && (
          <div className="space-y-6 max-w-md mx-auto">
            <div>
              <label className="block text-sm font-medium mb-2">Adventure Title</label>
              <Input
                placeholder="The Lost Temple of Shadows"
                value={data.adventureTitle}
                onChange={(e) => setData({ ...data, adventureTitle: e.target.value })}
                className="text-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Setting (one sentence)</label>
              <Textarea
                placeholder="A frontier town at the edge of a cursed forest, where the old gods still whisper..."
                value={data.settingDescription}
                onChange={(e) => setData({ ...data, settingDescription: e.target.value })}
                rows={3}
              />
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-4 max-w-lg mx-auto">
            {data.npcs.map((npc, index) => (
              <Card key={index} className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <Input
                        placeholder="Name"
                        value={npc.name}
                        onChange={(e) => updateNPC(index, "name", e.target.value)}
                      />
                      <Input
                        placeholder="Role (e.g., Blacksmith)"
                        value={npc.role}
                        onChange={(e) => updateNPC(index, "role", e.target.value)}
                      />
                      <Input
                        placeholder="One defining trait"
                        value={npc.trait}
                        onChange={(e) => updateNPC(index, "trait", e.target.value)}
                      />
                    </div>
                    {data.npcs.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeNPC(index)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            
            <div className="flex gap-2">
              {data.npcs.length < 5 && (
                <Button variant="outline" onClick={addNPC} className="flex-1">
                  <Plus className="h-4 w-4 mr-2" /> Add Another Character
                </Button>
              )}
            </div>

            <div className="pt-4">
              <p className="text-sm text-muted-foreground mb-2">Need inspiration? Try one of these:</p>
              <div className="flex flex-wrap gap-2">
                {NPC_SUGGESTIONS.map((s, i) => (
                  <Button 
                    key={i} 
                    variant="secondary" 
                    size="sm"
                    onClick={() => useSuggestion(i)}
                    className="text-xs"
                  >
                    <Sparkles className="h-3 w-3 mr-1" /> {s.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6 max-w-md mx-auto">
            <div>
              <label className="block text-sm font-medium mb-2">Starting Location</label>
              <Input
                placeholder="The Weary Traveler Inn"
                value={data.locationName}
                onChange={(e) => setData({ ...data, locationName: e.target.value })}
                className="text-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Describe the atmosphere</label>
              <Textarea
                placeholder="Warm firelight flickers across weathered faces. The smell of pipe smoke and roasted meat fills the air. In the corner, a hooded figure watches the door..."
                value={data.locationAtmosphere}
                onChange={(e) => setData({ ...data, locationAtmosphere: e.target.value })}
                rows={4}
              />
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6 max-w-md mx-auto">
            <div>
              <label className="block text-sm font-medium mb-2">What's the unresolved tension?</label>
              <Textarea
                placeholder="What problem demands the heroes' attention? What mystery begs to be solved?"
                value={data.tension}
                onChange={(e) => setData({ ...data, tension: e.target.value })}
                rows={4}
              />
            </div>
            
            <div className="pt-2">
              <p className="text-sm text-muted-foreground mb-2">Story hooks to inspire you:</p>
              <div className="space-y-2">
                {TENSION_SUGGESTIONS.map((suggestion, i) => (
                  <Button
                    key={i}
                    variant="ghost"
                    className="w-full text-left justify-start h-auto py-2 px-3 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50"
                    onClick={() => setData({ ...data, tension: suggestion })}
                  >
                    <Zap className="h-4 w-4 mr-2 text-amber-400 flex-shrink-0" />
                    <span>{suggestion}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="text-center max-w-md mx-auto">
            <div className="bg-gradient-to-br from-amber-500/20 to-orange-600/20 rounded-lg p-8 border border-amber-500/30">
              <BookOpen className="h-16 w-16 mx-auto text-amber-400 mb-4" />
              <h3 className="text-xl font-bold mb-4">{data.adventureTitle || "Your Adventure"}</h3>
              
              <div className="text-left space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <span><strong>Starting at:</strong> {data.locationName || "Your location"}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <span><strong>Key characters:</strong> {data.npcs.filter(n => n.name).map(n => n.name).join(", ") || "Your NPCs"}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Zap className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <span><strong>The hook:</strong> {data.tension?.substring(0, 80) || "Your story hook"}...</span>
                </div>
              </div>
            </div>
            
            <p className="text-muted-foreground mt-6 text-sm">
              Click "Start Session" to begin your adventure. You can always add more details later!
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-between pt-4 border-t border-slate-700">
        <Button
          variant="ghost"
          onClick={currentStep === 0 ? onCancel : handleBack}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          {currentStep === 0 ? "Cancel" : "Back"}
        </Button>

        <Button
          onClick={handleNext}
          disabled={!canProceed() || createCampaignMutation.isPending}
          className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
        >
          {createCampaignMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : currentStep === STEP_TITLES.length - 1 ? (
            <>
              <Play className="h-4 w-4 mr-2" />
              Start Session
            </>
          ) : (
            <>
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
