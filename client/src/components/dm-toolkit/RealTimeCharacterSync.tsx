import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { 
  User, 
  Heart, 
  Shield, 
  Zap, 
  Sword, 
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
  RotateCw,
  Eye,
  Edit3,
  Plus,
  Minus
} from "lucide-react";

interface CharacterSheet {
  id: number;
  name: string;
  level: number;
  class: string;
  race: string;
  hp: number;
  maxHp: number;
  ac: number;
  proficiencyBonus: number;
  abilities: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  skills: { [skill: string]: number };
  spellSlots: { [level: string]: { current: number; max: number } };
  equipment: EquipmentItem[];
  conditions: string[];
  inspiration: boolean;
  lastUpdated: string;
}

interface EquipmentItem {
  id: number;
  name: string;
  type: string;
  equipped: boolean;
  quantity: number;
  properties?: any;
}

interface SpellSlotUpdate {
  level: number;
  change: number;
}

interface RealTimeCharacterSyncProps {
  campaignId: number;
}

export default function RealTimeCharacterSync({ campaignId }: RealTimeCharacterSyncProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<{ [characterId: number]: string[] }>({});
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all campaign characters with real-time updates
  const { data: characters = [], isLoading } = useQuery<CharacterSheet[]>({
    queryKey: [`/api/campaigns/${campaignId}/characters/sheets`],
    refetchInterval: 3000, // Update every 3 seconds
    enabled: !!campaignId
  });

  // Update HP mutation
  const updateHPMutation = useMutation({
    mutationFn: async ({ characterId, change, type }: { characterId: number; change: number; type: 'damage' | 'heal' }) => {
      return apiRequest(`/api/campaigns/${campaignId}/characters/${characterId}/hp`, {
        method: 'PATCH',
        body: JSON.stringify({ change, type })
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/characters/sheets`] });
      toast({
        title: variables.type === 'damage' ? "Damage Applied" : "Healing Applied",
        description: `${Math.abs(variables.change)} HP ${variables.type === 'damage' ? 'damage' : 'healing'} applied`
      });
    }
  });

  // Update spell slots mutation
  const updateSpellSlotsMutation = useMutation({
    mutationFn: async ({ characterId, updates }: { characterId: number; updates: SpellSlotUpdate[] }) => {
      return apiRequest(`/api/campaigns/${campaignId}/characters/${characterId}/spell-slots`, {
        method: 'PATCH',
        body: JSON.stringify({ updates })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/characters/sheets`] });
      toast({
        title: "Spell Slots Updated",
        description: "Character spell slots have been modified"
      });
    }
  });

  // Add condition mutation
  const addConditionMutation = useMutation({
    mutationFn: async ({ characterId, condition }: { characterId: number; condition: string }) => {
      return apiRequest(`/api/campaigns/${campaignId}/characters/${characterId}/conditions`, {
        method: 'POST',
        body: JSON.stringify({ condition })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/characters/sheets`] });
      toast({
        title: "Condition Added",
        description: "Status condition applied to character"
      });
    }
  });

  // Remove condition mutation
  const removeConditionMutation = useMutation({
    mutationFn: async ({ characterId, condition }: { characterId: number; condition: string }) => {
      return apiRequest(`/api/campaigns/${campaignId}/characters/${characterId}/conditions/${condition}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/characters/sheets`] });
      toast({
        title: "Condition Removed",
        description: "Status condition removed from character"
      });
    }
  });

  // Equipment update mutation
  const updateEquipmentMutation = useMutation({
    mutationFn: async ({ characterId, itemId, equipped }: { characterId: number; itemId: number; equipped: boolean }) => {
      return apiRequest(`/api/campaigns/${campaignId}/characters/${characterId}/equipment/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ equipped })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/characters/sheets`] });
      toast({
        title: "Equipment Updated",
        description: "Character equipment status changed"
      });
    }
  });

  const selectedCharacterData = characters.find(char => char.id === selectedCharacter);

  const getAbilityModifier = (score: number) => {
    return Math.floor((score - 10) / 2);
  };

  const formatModifier = (modifier: number) => {
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
  };

  const handleHPChange = (characterId: number, change: number, type: 'damage' | 'heal') => {
    updateHPMutation.mutate({ characterId, change: Math.abs(change), type });
  };

  const handleSpellSlotChange = (characterId: number, level: number, change: number) => {
    updateSpellSlotsMutation.mutate({
      characterId,
      updates: [{ level, change }]
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading character sheets...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Real-Time Character Sheets</h3>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary">
            <RotateCw className="h-3 w-3 mr-1" />
            Live Sync
          </Badge>
          <Badge variant="outline">{characters.length} Characters</Badge>
        </div>
      </div>

      {/* Character Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {characters.map((character) => (
          <Card 
            key={character.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedCharacter === character.id ? 'border-primary bg-primary/5' : ''
            }`}
            onClick={() => setSelectedCharacter(character.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{character.name}</CardTitle>
                <Badge variant="outline" className="text-xs">
                  Level {character.level}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {character.race} {character.class}
              </p>
            </CardHeader>
            
            <CardContent className="space-y-2">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center space-x-1">
                  <Heart className="h-3 w-3 text-red-500" />
                  <span>{character.hp}/{character.maxHp}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Shield className="h-3 w-3 text-blue-500" />
                  <span>AC {character.ac}</span>
                </div>
              </div>

              {/* HP Bar */}
              <Progress 
                value={(character.hp / character.maxHp) * 100}
                className="h-2"
              />

              {/* Conditions */}
              {character.conditions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {character.conditions.slice(0, 3).map((condition, index) => (
                    <Badge key={index} variant="destructive" className="text-xs">
                      {condition}
                    </Badge>
                  ))}
                  {character.conditions.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{character.conditions.length - 3}
                    </Badge>
                  )}
                </div>
              )}

              {/* Last Updated */}
              <p className="text-xs text-muted-foreground">
                Updated {new Date(character.lastUpdated).toLocaleTimeString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Character View */}
      {selectedCharacterData && (
        <Card className="border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>{selectedCharacterData.name}</span>
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">
                  Level {selectedCharacterData.level} {selectedCharacterData.race} {selectedCharacterData.class}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditMode(!editMode)}
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="combat" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="combat">Combat</TabsTrigger>
                <TabsTrigger value="abilities">Abilities</TabsTrigger>
                <TabsTrigger value="spells">Spells</TabsTrigger>
                <TabsTrigger value="equipment">Equipment</TabsTrigger>
              </TabsList>

              {/* Combat Stats */}
              <TabsContent value="combat" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Health Management */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center">
                        <Heart className="h-4 w-4 mr-2 text-red-500" />
                        Health Points
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-lg">
                          {selectedCharacterData.hp} / {selectedCharacterData.maxHp}
                        </span>
                        <Progress 
                          value={(selectedCharacterData.hp / selectedCharacterData.maxHp) * 100}
                          className="w-24 h-3"
                        />
                      </div>
                      
                      {editMode && (
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleHPChange(selectedCharacterData.id, 5, 'damage')}
                          >
                            <Minus className="h-3 w-3" />
                            5
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleHPChange(selectedCharacterData.id, 10, 'damage')}
                          >
                            <Minus className="h-3 w-3" />
                            10
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleHPChange(selectedCharacterData.id, 5, 'heal')}
                          >
                            <Plus className="h-3 w-3" />
                            5
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleHPChange(selectedCharacterData.id, 10, 'heal')}
                          >
                            <Plus className="h-3 w-3" />
                            10
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Defense & Other Stats */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center">
                        <Shield className="h-4 w-4 mr-2 text-blue-500" />
                        Defense & Stats
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Armor Class</span>
                          <p className="font-mono">{selectedCharacterData.ac}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Proficiency</span>
                          <p className="font-mono">+{selectedCharacterData.proficiencyBonus}</p>
                        </div>
                      </div>
                      
                      {selectedCharacterData.inspiration && (
                        <Badge variant="secondary" className="text-xs">
                          <Eye className="h-3 w-3 mr-1" />
                          Inspiration
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Conditions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Active Conditions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedCharacterData.conditions.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedCharacterData.conditions.map((condition, index) => (
                          <div key={index} className="flex items-center space-x-1">
                            <Badge variant="destructive" className="text-xs">
                              {condition}
                            </Badge>
                            {editMode && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeConditionMutation.mutate({
                                  characterId: selectedCharacterData.id,
                                  condition
                                })}
                                className="h-5 w-5 p-0"
                              >
                                ×
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No active conditions</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Abilities */}
              <TabsContent value="abilities" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(selectedCharacterData.abilities).map(([ability, score]) => (
                    <Card key={ability}>
                      <CardContent className="p-3 text-center">
                        <h4 className="text-sm font-medium capitalize mb-1">{ability}</h4>
                        <p className="text-lg font-mono">{score}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatModifier(getAbilityModifier(score))}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* Spells */}
              <TabsContent value="spells" className="space-y-4">
                {Object.keys(selectedCharacterData.spellSlots).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(selectedCharacterData.spellSlots).map(([level, slots]) => (
                      <Card key={level}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-medium">Level {level} Spell Slots</h4>
                              <div className="flex space-x-1 mt-1">
                                {Array.from({ length: slots.max }, (_, i) => (
                                  <div
                                    key={i}
                                    className={`w-3 h-3 rounded-full border ${
                                      i < slots.current ? 'bg-purple-500 border-purple-500' : 'border-gray-300'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                            
                            {editMode && (
                              <div className="flex space-x-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSpellSlotChange(selectedCharacterData.id, Number(level), -1)}
                                  disabled={slots.current <= 0}
                                  className="h-6 w-6 p-0"
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSpellSlotChange(selectedCharacterData.id, Number(level), 1)}
                                  disabled={slots.current >= slots.max}
                                  className="h-6 w-6 p-0"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Zap className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No spell slots available</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Equipment */}
              <TabsContent value="equipment" className="space-y-4">
                <div className="space-y-2">
                  {selectedCharacterData.equipment.map((item) => (
                    <Card key={item.id} className={item.equipped ? 'border-green-300' : ''}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${item.equipped ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <div>
                              <h4 className="text-sm font-medium">{item.name}</h4>
                              <p className="text-xs text-muted-foreground">
                                {item.type} {item.quantity > 1 && `× ${item.quantity}`}
                              </p>
                            </div>
                          </div>
                          
                          {editMode && item.type !== 'consumable' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateEquipmentMutation.mutate({
                                characterId: selectedCharacterData.id,
                                itemId: item.id,
                                equipped: !item.equipped
                              })}
                            >
                              {item.equipped ? 'Unequip' : 'Equip'}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}