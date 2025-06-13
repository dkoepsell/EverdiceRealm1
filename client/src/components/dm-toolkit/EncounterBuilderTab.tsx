import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Swords, Plus, X, Sparkles, Users, Target, Shield, Zap } from "lucide-react";

const encounterTypes = [
  { value: "combat", label: "Combat", icon: Swords },
  { value: "social", label: "Social", icon: Users },
  { value: "exploration", label: "Exploration", icon: Target },
  { value: "puzzle", label: "Puzzle", icon: Zap },
  { value: "trap", label: "Trap", icon: Shield }
];

const difficultyLevels = [
  { value: "trivial", label: "Trivial", color: "bg-green-500" },
  { value: "easy", label: "Easy", color: "bg-blue-500" },
  { value: "medium", label: "Medium", color: "bg-yellow-500" },
  { value: "hard", label: "Hard", color: "bg-orange-500" },
  { value: "deadly", label: "Deadly", color: "bg-red-500" }
];

interface MonsterEntry {
  name: string;
  cr: string;
  count: number;
}

interface EncounterForm {
  name: string;
  description: string;
  encounterType: string;
  difficulty: string;
  partyLevel: number;
  partySize: number;
  environment: string;
  monsters: MonsterEntry[];
  rewards: string;
  tactics: string;
  triggers: string;
}

export default function EncounterBuilderTab() {
  const { toast } = useToast();
  const [encounterForm, setEncounterForm] = useState<EncounterForm>({
    name: "",
    description: "",
    encounterType: "combat",
    difficulty: "medium",
    partyLevel: 3,
    partySize: 4,
    environment: "",
    monsters: [{ name: "", cr: "1", count: 1 }],
    rewards: "",
    tactics: "",
    triggers: ""
  });

  // Fetch user's encounters
  const { data: userEncounters = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/encounters/user"],
    refetchOnWindowFocus: false
  });

  // Create encounter mutation
  const createEncounterMutation = useMutation({
    mutationFn: async (encounterData: any) => {
      const response = await apiRequest('POST', '/api/encounters', encounterData);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Encounter Created",
        description: "Your encounter has been created successfully."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/encounters/user"] });
      setEncounterForm({
        name: "",
        description: "",
        encounterType: "combat",
        difficulty: "medium",
        partyLevel: 3,
        partySize: 4,
        environment: "",
        monsters: [{ name: "", cr: "1", count: 1 }],
        rewards: "",
        tactics: "",
        triggers: ""
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create Encounter",
        description: error.message || "An error occurred while creating the encounter.",
        variant: "destructive"
      });
    }
  });

  // AI Generate Encounter mutation
  const generateEncounterMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const response = await apiRequest('POST', '/api/encounters/generate', { prompt });
      return await response.json();
    },
    onSuccess: (data) => {
      setEncounterForm({
        ...encounterForm,
        ...data,
        monsters: data.monsters || [{ name: "", cr: "1", count: 1 }]
      });
      toast({
        title: "Encounter Generated",
        description: "AI has generated encounter details. Review and create when ready."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate encounter with AI.",
        variant: "destructive"
      });
    }
  });

  const handleGenerateEncounter = () => {
    const prompt = `Create a ${encounterForm.difficulty} ${encounterForm.encounterType} encounter for a party of ${encounterForm.partySize} level ${encounterForm.partyLevel} characters${encounterForm.environment ? ` in a ${encounterForm.environment}` : ''}. ${encounterForm.description || ''}`;
    generateEncounterMutation.mutate(prompt);
  };

  const handleCreateEncounter = () => {
    if (!encounterForm.name || !encounterForm.description) {
      toast({
        title: "Missing Information",
        description: "Please provide at least a name and description.",
        variant: "destructive"
      });
      return;
    }

    createEncounterMutation.mutate(encounterForm);
  };

  const addMonster = () => {
    setEncounterForm({
      ...encounterForm,
      monsters: [...encounterForm.monsters, { name: "", cr: "1", count: 1 }]
    });
  };

  const removeMonster = (index: number) => {
    setEncounterForm({
      ...encounterForm,
      monsters: encounterForm.monsters.filter((_, i) => i !== index)
    });
  };

  const updateMonster = (index: number, field: keyof MonsterEntry, value: string | number) => {
    const updatedMonsters = [...encounterForm.monsters];
    updatedMonsters[index] = { ...updatedMonsters[index], [field]: value };
    setEncounterForm({ ...encounterForm, monsters: updatedMonsters });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Encounter Creation Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5" />
              Build Encounter
            </CardTitle>
            <CardDescription>
              Create balanced encounters for your party with AI assistance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Encounter Name</Label>
                <Input
                  id="name"
                  value={encounterForm.name}
                  onChange={(e) => setEncounterForm({ ...encounterForm, name: e.target.value })}
                  placeholder="Goblin Ambush"
                />
              </div>
              <div>
                <Label htmlFor="encounterType">Type</Label>
                <Select value={encounterForm.encounterType} onValueChange={(value) => setEncounterForm({ ...encounterForm, encounterType: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {encounterTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={encounterForm.description}
                onChange={(e) => setEncounterForm({ ...encounterForm, description: e.target.value })}
                placeholder="A group of goblins attacks from the shadows..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="difficulty">Difficulty</Label>
                <Select value={encounterForm.difficulty} onValueChange={(value) => setEncounterForm({ ...encounterForm, difficulty: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {difficultyLevels.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${level.color}`} />
                          {level.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="partyLevel">Party Level</Label>
                <Input
                  id="partyLevel"
                  type="number"
                  value={encounterForm.partyLevel}
                  onChange={(e) => setEncounterForm({ ...encounterForm, partyLevel: parseInt(e.target.value) || 1 })}
                  min="1"
                  max="20"
                />
              </div>
              <div>
                <Label htmlFor="partySize">Party Size</Label>
                <Input
                  id="partySize"
                  type="number"
                  value={encounterForm.partySize}
                  onChange={(e) => setEncounterForm({ ...encounterForm, partySize: parseInt(e.target.value) || 1 })}
                  min="1"
                  max="10"
                />
              </div>
              <div>
                <Label htmlFor="environment">Environment</Label>
                <Input
                  id="environment"
                  value={encounterForm.environment}
                  onChange={(e) => setEncounterForm({ ...encounterForm, environment: e.target.value })}
                  placeholder="Forest"
                />
              </div>
            </div>

            {/* Monsters Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Monsters/NPCs</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMonster}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              {encounterForm.monsters.map((monster, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <Input
                    placeholder="Monster name"
                    value={monster.name}
                    onChange={(e) => updateMonster(index, 'name', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="CR"
                    value={monster.cr}
                    onChange={(e) => updateMonster(index, 'cr', e.target.value)}
                    className="w-20"
                  />
                  <Input
                    type="number"
                    placeholder="Count"
                    value={monster.count}
                    onChange={(e) => updateMonster(index, 'count', parseInt(e.target.value) || 1)}
                    className="w-20"
                  />
                  {encounterForm.monsters.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeMonster(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tactics">Tactics</Label>
                <Textarea
                  id="tactics"
                  value={encounterForm.tactics}
                  onChange={(e) => setEncounterForm({ ...encounterForm, tactics: e.target.value })}
                  placeholder="How enemies behave in combat..."
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="triggers">Triggers</Label>
                <Textarea
                  id="triggers"
                  value={encounterForm.triggers}
                  onChange={(e) => setEncounterForm({ ...encounterForm, triggers: e.target.value })}
                  placeholder="What starts this encounter..."
                  rows={2}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="rewards">Rewards</Label>
              <Textarea
                id="rewards"
                value={encounterForm.rewards}
                onChange={(e) => setEncounterForm({ ...encounterForm, rewards: e.target.value })}
                placeholder="XP, gold, items, or story rewards..."
                rows={2}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleGenerateEncounter}
                disabled={generateEncounterMutation.isPending}
                variant="outline"
                className="flex-1"
              >
                {generateEncounterMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Generate with AI
              </Button>
              <Button 
                onClick={handleCreateEncounter}
                disabled={createEncounterMutation.isPending}
                className="flex-1"
              >
                {createEncounterMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Swords className="mr-2 h-4 w-4" />
                )}
                Create Encounter
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* User's Encounters */}
        <Card>
          <CardHeader>
            <CardTitle>Your Encounters</CardTitle>
            <CardDescription>
              Encounters you've built for your campaigns
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : userEncounters.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No encounters created yet
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {userEncounters.map((encounter: any) => (
                  <div key={encounter.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{encounter.name}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {encounter.encounterType}
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${difficultyLevels.find(d => d.value === encounter.difficulty)?.color} text-white`}
                          >
                            {encounter.difficulty}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {encounter.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Level {encounter.partyLevel}</span>
                          <span>{encounter.partySize} players</span>
                          {encounter.environment && <span>{encounter.environment}</span>}
                        </div>
                        {encounter.monsters && encounter.monsters.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium">Monsters:</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {encounter.monsters.map((monster: any, index: number) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {monster.count}x {monster.name} (CR {monster.cr})
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}