import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Campaign, CampaignSession, Character, Npc, WorldRegion, WorldLocation } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { generateStory, StoryRequest } from "@/lib/openai";
import { DiceType, DiceRoll, DiceRollResult, rollDice, clientRollDice } from "@/lib/dice";
import { getSkillModifier, parseDCFromText, calculateSuccessProbability, getLikelihoodDescription } from "@/lib/skills";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Search, Sparkle, ArrowRight, Settings, Save, Map, MapPin, Clock, ChevronDown, ChevronUp, Dices, Users, Share2, Loader2, Scroll, Moon, Sun, Backpack, Sword, Shield, Heart, Plus, Trash2, Target, Coins, FlaskConical, Sparkles, User } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import CampaignParticipants from "./CampaignParticipants";
import TurnManager from "./TurnManager";
import CampaignDeploymentTab from "./CampaignDeploymentTab";
import { DungeonMapModal } from "../dungeon/DungeonMapModal";
import type { DungeonMapData, MapEntity } from "../dungeon/DungeonMap";

interface CampaignPanelProps {
  campaign: Campaign;
}

function CampaignPanel({ campaign }: CampaignPanelProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const isDM = campaign.userId === user?.id;
  
  // Campaign sessions
  const { data: sessions = [], isLoading: sessionsLoading, isError: sessionsError } = useQuery<CampaignSession[]>({
    queryKey: [`/api/campaigns/${campaign.id}/sessions`],
    staleTime: 30000,
  });
  
  // User characters
  const { data: userCharacters = [], isLoading: charactersLoading } = useQuery<Character[]>({
    queryKey: ['/api/characters'],
    enabled: !!user,
  });
  
  // Campaign participants
  const { data: participants = [], isLoading: participantsLoading } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${campaign.id}/participants`],
    enabled: !!campaign.id,
  });
  
  // Campaign NPCs
  const { data: campaignNpcs = [], isLoading: npcsLoading } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${campaign.id}/npcs`],
    enabled: !!campaign.id,
  });
  
  // Campaign dungeon map (persistent)
  const { data: persistedDungeonMap, isLoading: dungeonMapLoading } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaign.id}/dungeon-map`],
    enabled: !!campaign.id,
    retry: false,
  });
  
  // Campaign quests (from database)
  const { data: campaignQuests = [], isLoading: questsLoading } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${campaign.id}/quests`],
    enabled: !!campaign.id,
  });

  // World regions and locations for linking campaign to world map
  const { data: worldRegions = [] } = useQuery<WorldRegion[]>({
    queryKey: ['/api/world/regions'],
  });

  const { data: worldLocations = [] } = useQuery<WorldLocation[]>({
    queryKey: ['/api/world/locations'],
  });
  
  // Mutation to save dungeon map
  const saveDungeonMapMutation = useMutation({
    mutationFn: async (mapData: { mapId?: number; mapName: string; mapData: any; playerPosition: any; exploredTiles: any[]; entityPositions: any[] }) => {
      let response: Response;
      if (mapData.mapId) {
        response = await apiRequest('PATCH', `/api/campaigns/${campaign.id}/dungeon-map/${mapData.mapId}`, mapData);
      } else {
        response = await apiRequest('POST', `/api/campaigns/${campaign.id}/dungeon-map`, mapData);
      }
      // Parse and return the JSON response
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/dungeon-map`] });
    },
  });
  
  // Mutation to complete a quest
  const completeQuestMutation = useMutation({
    mutationFn: async ({ questId, characterId }: { questId: number; characterId?: number }) => {
      const response = await apiRequest('POST', `/api/campaigns/${campaign.id}/quests/${questId}/complete`, { characterId });
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/quests`] });
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      
      if (data.rewards) {
        toast({
          title: "Quest Completed!",
          description: `Earned ${data.rewards.xp} XP, ${data.rewards.gold} gold${data.rewards.items?.length ? `, and ${data.rewards.items.length} item(s)` : ''}!`,
        });
      }
    },
  });
  
  // Local state
  const [showChoiceDialog, setShowChoiceDialog] = useState(false);
  const [showDiceRollDialog, setShowDiceRollDialog] = useState(false);
  const [showCharacterSelectionDialog, setShowCharacterSelectionDialog] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<number[]>([]);
  const [selectedAction, setSelectedAction] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRolling, setIsRolling] = useState(false);
  const [dice1Result, setDice1Result] = useState<number | null>(null);
  const [dice2Result, setDice2Result] = useState<number | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  const [diceRollResult, setDiceRollResult] = useState<DiceRollResult | null>(null);
  const [isAdvancingStory, setIsAdvancingStory] = useState(false);
  const [progressionRewards, setProgressionRewards] = useState<{
    xpAwarded: number;
    newLevel: number;
    leveledUp: boolean;
    itemsFound: any[];
    skillImproved?: { skill: string; newBonus: number } | null;
  } | null>(null);
  const [narrativeStyle, setNarrativeStyle] = useState(campaign.narrativeStyle);
  const [difficulty, setDifficulty] = useState(campaign.difficulty);
  const [worldRegionId, setWorldRegionId] = useState<number | null>(campaign.worldRegionId || null);
  const [worldLocationId, setWorldLocationId] = useState<number | null>(campaign.worldLocationId || null);
  const [settingsChanged, setSettingsChanged] = useState(false);
  const [currentSession, setCurrentSession] = useState<CampaignSession | null>(null);
  const [isTurnBased, setIsTurnBased] = useState(campaign.isTurnBased || false);
  const [currentDiceRoll, setCurrentDiceRoll] = useState<{
    action: string;
    diceType: DiceType;
    rollDC: number;
    rollModifier: number;
    rollPurpose: string;
    successText: string;
    failureText: string;
  } | null>(null);
  const [customAction, setCustomAction] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [selectedPartyMemberType, setSelectedPartyMemberType] = useState<"character" | "npc">("character");
  const [selectedNpcId, setSelectedNpcId] = useState<number | null>(null);
  const [dungeonMapData, setDungeonMapData] = useState<DungeonMapData | null>(null);
  const [dungeonMapId, setDungeonMapId] = useState<number | null>(null);
  const [monsterImages, setMonsterImages] = useState<Record<string, string>>({});
  const [generatingMonsterImage, setGeneratingMonsterImage] = useState<string | null>(null);
  
  // Function to generate monster image on demand
  const generateMonsterImage = async (monsterName: string, description?: string, type?: string) => {
    if (monsterImages[monsterName] || generatingMonsterImage === monsterName) return;
    
    setGeneratingMonsterImage(monsterName);
    try {
      const response = await apiRequest('POST', '/api/generate-monster-image', {
        monsterName,
        description,
        type
      });
      const data = await response.json();
      if (data.success && data.imageUrl) {
        setMonsterImages(prev => ({ ...prev, [monsterName]: data.imageUrl }));
      }
    } catch (error) {
      console.error('Failed to generate monster image:', error);
    } finally {
      setGeneratingMonsterImage(null);
    }
  };
  
  // Find the user's participant record in this campaign
  const userParticipant = useMemo(() => {
    if (!participants || !user) return null;
    return participants.find((p: any) => p.userId === user.id);
  }, [participants, user]);

  // Get the active character for the current user (from participant or user's first character)
  const activeCharacter = useMemo(() => {
    // First try to get character from participant record
    if (userParticipant?.character) {
      return userParticipant.character;
    }
    // Fallback to user's first character (for DMs who may not be participants)
    if (userCharacters && userCharacters.length > 0) {
      return userCharacters[0];
    }
    return null;
  }, [userParticipant, userCharacters]);
  
  // Get the selected NPC for management
  const selectedNpc = useMemo(() => {
    if (!selectedNpcId || !campaignNpcs) return null;
    const campaignNpc = campaignNpcs.find((cn: any) => cn.npcId === selectedNpcId);
    return campaignNpc?.npc || null;
  }, [selectedNpcId, campaignNpcs]);
  
  // Get all party NPCs for the dropdown
  const partyNpcs = useMemo(() => {
    if (!campaignNpcs) return [];
    return campaignNpcs.filter((cn: any) => cn.role === 'companion' || cn.role === 'ally').map((cn: any) => cn.npc);
  }, [campaignNpcs]);
  
  // Parse storyState - it may be stored as JSON string or already parsed
  const parsedStoryState = useMemo(() => {
    if (!currentSession?.storyState) return null;
    try {
      if (typeof currentSession.storyState === 'string') {
        return JSON.parse(currentSession.storyState);
      }
      return currentSession.storyState;
    } catch (e) {
      console.error('Failed to parse storyState:', e);
      return null;
    }
  }, [currentSession?.storyState]);
  
  // Filter world locations by selected region
  const filteredWorldLocations = useMemo(() => {
    if (!worldRegionId) return worldLocations;
    return worldLocations.filter(loc => loc.regionId === worldRegionId);
  }, [worldRegionId, worldLocations]);

  // Check if settings are changed
  useEffect(() => {
    setSettingsChanged(
      narrativeStyle !== campaign.narrativeStyle ||
      difficulty !== campaign.difficulty ||
      worldRegionId !== (campaign.worldRegionId || null) ||
      worldLocationId !== (campaign.worldLocationId || null)
    );
  }, [narrativeStyle, difficulty, worldRegionId, worldLocationId, campaign]);
  
  // Set the current session
  useEffect(() => {
    if (sessions && sessions.length > 0 && campaign) {
      const currentSessionNumber = campaign.currentSession || 1;
      const foundSession = sessions.find(session => session.sessionNumber === currentSessionNumber);
      if (foundSession) {
        setCurrentSession(foundSession);
      }
    }
  }, [sessions, campaign]);
  
  // Load persisted dungeon map from database
  useEffect(() => {
    if (persistedDungeonMap && persistedDungeonMap.mapData) {
      // Store the map ID for later PATCH requests
      if (persistedDungeonMap.id && persistedDungeonMap.id !== dungeonMapId) {
        setDungeonMapId(persistedDungeonMap.id);
      }
      // Only set map data if we don't have it yet
      if (!dungeonMapData) {
        setDungeonMapData({
          ...persistedDungeonMap.mapData,
          playerPosition: persistedDungeonMap.playerPosition || { x: 0, y: 0 },
        });
      }
    }
  }, [persistedDungeonMap, dungeonMapData, dungeonMapId]);
  
  // Sync combat entities (enemies and party) to dungeon map
  useEffect(() => {
    if (!dungeonMapData || !parsedStoryState) return;
    
    const combatEntities: MapEntity[] = [];
    
    // Add enemies from combat
    if (parsedStoryState.combatants && Array.isArray(parsedStoryState.combatants)) {
      (parsedStoryState.combatants as any[]).forEach((enemy: any, index: number) => {
        if (enemy.status !== 'defeated') {
          combatEntities.push({
            id: `enemy-${index}`,
            type: enemy.type === 'boss' ? 'boss' : 'enemy',
            name: enemy.name,
            x: dungeonMapData.playerPosition.x + (index % 3) - 1,
            y: dungeonMapData.playerPosition.y + Math.floor(index / 3) + 2,
            hp: enemy.currentHp,
            maxHp: enemy.maxHp,
          });
        }
      });
    }
    
    // Add party members (allies/companions) from combat
    if (parsedStoryState.partyMembers && Array.isArray(parsedStoryState.partyMembers)) {
      (parsedStoryState.partyMembers as any[]).forEach((member: any, index: number) => {
        if (member.type !== 'player') {
          combatEntities.push({
            id: `ally-${index}`,
            type: 'ally',
            name: member.name,
            x: dungeonMapData.playerPosition.x + (index % 2) - 1,
            y: dungeonMapData.playerPosition.y - 1,
            hp: member.currentHp,
            maxHp: member.maxHp,
          });
        }
      });
    }
    
    // Update map data with combat entities if they've changed
    const existingEntityIds = dungeonMapData.entities.map(e => e.id).sort().join(',');
    const newEntityIds = combatEntities.map(e => e.id).sort().join(',');
    
    if (existingEntityIds !== newEntityIds && combatEntities.length > 0) {
      setDungeonMapData({
        ...dungeonMapData,
        entities: combatEntities,
      });
    }
  }, [parsedStoryState?.combatants, parsedStoryState?.partyMembers, dungeonMapData?.playerPosition]);
  
  // Handler to save dungeon map changes with debounce
  const handleDungeonMapChange = (newMapData: DungeonMapData | null) => {
    setDungeonMapData(newMapData);
    
    if (newMapData) {
      saveDungeonMapMutation.mutate({
        mapId: dungeonMapId ?? undefined,
        mapName: newMapData.name || "Dungeon",
        mapData: newMapData,
        playerPosition: newMapData.playerPosition || { x: 0, y: 0 },
        exploredTiles: [],
        entityPositions: newMapData.entities || [],
      }, {
        onSuccess: (result: any) => {
          // After creating a new map, store its ID for future updates
          // apiRequest returns already-parsed JSON, so result is the data directly
          if (!dungeonMapId && result?.id) {
            setDungeonMapId(result.id);
          }
        }
      });
    }
  };
  
  // Save settings mutation
  const handleSaveSettings = () => {
    updateCampaignMutation.mutate({
      narrativeStyle,
      difficulty,
      worldRegionId,
      worldLocationId
    });
  };
  
  // Toggle journey log entry expansion
  const toggleSessionExpanded = (sessionId: number) => {
    if (expandedSessions.includes(sessionId)) {
      setExpandedSessions(expandedSessions.filter(id => id !== sessionId));
    } else {
      setExpandedSessions([...expandedSessions, sessionId]);
    }
  };
  
  // Toggle turn-based mode
  const handleToggleTurnBased = (enabled: boolean) => {
    setIsTurnBased(enabled);
    updateCampaignMutation.mutate({
      isTurnBased: enabled
    });
  };
  
  // Update campaign mutation
  const updateCampaignMutation = useMutation({
    mutationFn: async (updates: Partial<Campaign>) => {
      const res = await apiRequest('PATCH', `/api/campaigns/${campaign.id}`, updates);
      return await res.json();
    },
    onSuccess: (updatedCampaign) => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}`] });
      toast({
        title: "Campaign updated",
        description: "The campaign settings have been updated."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Join campaign mutation
  const joinCampaignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCharacterId || !user) return null;
      
      const participantData = {
        userId: user.id,
        characterId: selectedCharacterId,
        role: campaign.userId === user.id ? 'dm' : 'player'
      };
      
      const res = await apiRequest('POST', `/api/campaigns/${campaign.id}/participants`, participantData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/participants`] });
      setShowCharacterSelectionDialog(false);
      toast({
        title: "Joined campaign",
        description: "You have successfully joined this campaign."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to join",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Advance story mutation with enhanced skill check integration
  const advanceStory = useMutation({
    mutationFn: async ({ choice, rollResult }: { choice: string; rollResult?: any }) => {
      const response = await apiRequest('POST', `/api/campaigns/${campaign.id}/advance-story`, {
        choice,
        rollResult
      });
      return await response.json();
    },
    onSuccess: (data) => {
      // Invalidate sessions data to refresh
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/sessions`] });
      
      // If the user is the campaign owner, also update the campaign data
      if (campaign.userId === user?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      }
      
      // Check if data contains progression data
      if (data && data.progression) {
        setProgressionRewards(data.progression);
        
        // Show quest completion toast first (more exciting!)
        if (data.progression.completedQuests?.length > 0) {
          const questNames = data.progression.completedQuests.map((q: any) => q.title).join(', ');
          toast({
            title: `🏆 Quest Complete!`,
            description: `${questNames} - Earned bonus XP!`,
          });
        }
        
        // Show combat effects toast if damage occurred
        if (data.progression.combatEffects) {
          const combat = data.progression.combatEffects;
          if (combat.damageTaken > 0) {
            toast({
              title: `⚔️ Combat! You took ${combat.damageTaken} damage!`,
              description: `HP: ${combat.newHitPoints}/${combat.maxHitPoints}` + 
                (combat.damageDealt > 0 ? ` - You dealt ${combat.damageDealt} damage!` : ""),
              variant: combat.newHitPoints <= 0 ? "destructive" : undefined,
            });
          } else if (combat.damageDealt > 0) {
            toast({
              title: `⚔️ Hit! You dealt ${combat.damageDealt} damage!`,
              description: combat.combatDescription || "Your attack connected!",
            });
          }
          
          // Show companion actions
          if (combat.companionActions && combat.companionActions.length > 0) {
            for (const companion of combat.companionActions) {
              toast({
                title: `🤝 ${companion.name}`,
                description: `${companion.action}${companion.damageDealt ? ` (${companion.damageDealt} damage!)` : ''}`,
              });
            }
          }
        }
        
        // Show progression toast
        if (data.progression.leveledUp) {
          toast({
            title: `🎉 Level Up! You're now level ${data.progression.newLevel}!`,
            description: `Gained ${data.progression.xpAwarded} XP` + 
              (data.progression.itemsFound?.length > 0 ? ` and found ${data.progression.itemsFound.length} item(s)!` : ""),
          });
        } else if (data.progression.xpAwarded > 0) {
          toast({
            title: `Gained ${data.progression.xpAwarded} XP!`,
            description: "Experience gained from your actions" + 
              (data.progression.itemsFound?.length > 0 ? ` and found ${data.progression.itemsFound.length} item(s)!` : ""),
          });
        }
        
        // Show skill improvement toast
        if (data.progression.skillImproved) {
          toast({
            title: `📈 Skill Improved: ${data.progression.skillImproved.skill}`,
            description: `Your ${data.progression.skillImproved.skill} skill has improved to +${data.progression.skillImproved.newBonus}!`,
          });
        }
        
        // Show status change notifications (unconscious/dead)
        if (data.progression.statusChange) {
          if (data.progression.statusChange === "unconscious") {
            toast({
              title: "⚠️ You have fallen unconscious!",
              description: "You are at 0 HP and must make death saving throws.",
              variant: "destructive"
            });
          } else if (data.progression.statusChange === "dead") {
            toast({
              title: "💀 You have died!",
              description: "Your character has perished. Resurrection magic may be required.",
              variant: "destructive"
            });
          }
        }
      } else {
        toast({
          title: "Story advanced",
          description: "The adventure continues..."
        });
      }
      
      // Update dungeon map if movement occurred from narrative
      if (data.dungeonMapData) {
        setDungeonMapData(data.dungeonMapData);
        queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/dungeon-map`] });
        
        // Show movement notification if there was movement
        if (data.movement?.occurred) {
          toast({
            title: "Party moved",
            description: data.movement.description || `You moved ${data.movement.direction}.`,
          });
        }
      }
      
      // Close dialogs
      setShowChoiceDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to advance story",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Create dice roll mutation
  const createDiceRollMutation = useMutation({
    mutationFn: async (diceRoll: DiceRoll) => {
      const response = await apiRequest('POST', `/api/dice/roll`, diceRoll);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: `${data.diceType} Roll Result: ${data.result}`,
        description: `Your dice roll for ${data.purpose} is recorded.`
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to record dice roll",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Rest mutations for HP recovery
  const shortRestMutation = useMutation({
    mutationFn: async (characterId: number) => {
      const response = await apiRequest('POST', `/api/characters/${characterId}/short-rest`);
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/participants`] });
      toast({
        title: "Short Rest Complete",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Rest Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const longRestMutation = useMutation({
    mutationFn: async (characterId: number) => {
      const response = await apiRequest('POST', `/api/characters/${characterId}/long-rest`);
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/participants`] });
      toast({
        title: "Long Rest Complete",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Rest Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Death saving throw mutation
  const deathSaveMutation = useMutation({
    mutationFn: async (characterId: number) => {
      const response = await apiRequest('POST', `/api/characters/${characterId}/death-save`);
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/participants`] });
      toast({
        title: `Death Save: Rolled ${data.roll}`,
        description: data.message,
        variant: data.status === "dead" ? "destructive" : data.status === "conscious" ? "default" : undefined
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Death Save Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Stabilize mutation
  const stabilizeMutation = useMutation({
    mutationFn: async (characterId: number) => {
      const response = await apiRequest('POST', `/api/characters/${characterId}/stabilize`);
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/participants`] });
      toast({
        title: "Character Stabilized",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Stabilization Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Inventory management mutations
  const addItemMutation = useMutation({
    mutationFn: async ({ characterId, item }: { characterId: number; item: string }) => {
      const response = await apiRequest('POST', `/api/characters/${characterId}/inventory/add`, { item });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/participants`] });
      toast({
        title: "Item Added",
        description: data.message,
      });
      setNewItemName("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Item",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const removeItemMutation = useMutation({
    mutationFn: async ({ characterId, item }: { characterId: number; item: string }) => {
      const response = await apiRequest('POST', `/api/characters/${characterId}/inventory/remove`, { item });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/participants`] });
      toast({
        title: "Item Removed",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Remove Item",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Currency management mutations
  const addCurrencyMutation = useMutation({
    mutationFn: async ({ characterId, gold = 0, silver = 0, copper = 0, platinum = 0 }: { characterId: number; gold?: number; silver?: number; copper?: number; platinum?: number }) => {
      const response = await apiRequest('POST', `/api/characters/${characterId}/currency/add`, { gold, silver, copper, platinum });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/participants`] });
      toast({
        title: "Currency Added",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Currency",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const spendCurrencyMutation = useMutation({
    mutationFn: async ({ characterId, gold = 0, silver = 0, copper = 0, platinum = 0 }: { characterId: number; gold?: number; silver?: number; copper?: number; platinum?: number }) => {
      const response = await apiRequest('POST', `/api/characters/${characterId}/currency/spend`, { gold, silver, copper, platinum });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/participants`] });
      toast({
        title: "Currency Spent",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Not Enough Currency",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Consumables management mutations
  const addConsumableMutation = useMutation({
    mutationFn: async ({ characterId, name, quantity = 1 }: { characterId: number; name: string; quantity?: number }) => {
      const response = await apiRequest('POST', `/api/characters/${characterId}/consumables/add`, { name, quantity });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/participants`] });
      toast({
        title: "Consumable Added",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Consumable",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const useConsumableMutation = useMutation({
    mutationFn: async ({ characterId, name }: { characterId: number; name: string }) => {
      const response = await apiRequest('POST', `/api/characters/${characterId}/consumables/use`, { name });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/participants`] });
      toast({
        title: data.healedAmount > 0 ? `Healed ${data.healedAmount} HP!` : "Item Used",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Use Item",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Equipment management mutations
  const equipItemMutation = useMutation({
    mutationFn: async ({ characterId, item, slot }: { characterId: number; item: string; slot: string }) => {
      const response = await apiRequest('POST', `/api/characters/${characterId}/equipment/equip`, { item, slot });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/participants`] });
      toast({
        title: "Item Equipped",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Equip Item",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const unequipItemMutation = useMutation({
    mutationFn: async ({ characterId, slot }: { characterId: number; slot: string }) => {
      const response = await apiRequest('POST', `/api/characters/${characterId}/equipment/unequip`, { slot });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/participants`] });
      toast({
        title: "Item Unequipped",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Unequip Item",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const resurrectMutation = useMutation({
    mutationFn: async ({ characterId, method }: { characterId: number; method: string }) => {
      const response = await apiRequest('POST', `/api/characters/${characterId}/resurrect`, { method });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/participants`] });
      toast({
        title: "Character Resurrected!",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Resurrection Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const transferItemMutation = useMutation({
    mutationFn: async ({ fromCharacterId, toCharacterId, item }: { fromCharacterId: number; toCharacterId: number; item: string }) => {
      const response = await apiRequest('POST', `/api/campaigns/${campaign.id}/items/transfer`, { fromCharacterId, toCharacterId, item });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/participants`] });
      toast({
        title: "Item Transferred",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Transfer Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // NPC Inventory Management Mutations
  const addNpcItemMutation = useMutation({
    mutationFn: async ({ npcId, item }: { npcId: number; item: string }) => {
      const response = await apiRequest('POST', `/api/npcs/${npcId}/inventory/add`, { item });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/npcs`] });
      toast({
        title: "Item Added",
        description: data.message,
      });
      setNewItemName("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Item",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const removeNpcItemMutation = useMutation({
    mutationFn: async ({ npcId, item }: { npcId: number; item: string }) => {
      const response = await apiRequest('POST', `/api/npcs/${npcId}/inventory/remove`, { item });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/npcs`] });
      toast({
        title: "Item Removed",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Remove Item",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const equipNpcItemMutation = useMutation({
    mutationFn: async ({ npcId, item, slot }: { npcId: number; item: string; slot: string }) => {
      const response = await apiRequest('POST', `/api/npcs/${npcId}/equip`, { item, slot });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/npcs`] });
      toast({
        title: "Item Equipped",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Equip Item",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const unequipNpcItemMutation = useMutation({
    mutationFn: async ({ npcId, slot }: { npcId: number; slot: string }) => {
      const response = await apiRequest('POST', `/api/npcs/${npcId}/unequip`, { slot });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/npcs`] });
      toast({
        title: "Item Unequipped",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Unequip Item",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateNpcGoldMutation = useMutation({
    mutationFn: async ({ npcId, amount, operation }: { npcId: number; amount: number; operation: 'add' | 'subtract' }) => {
      const response = await apiRequest('POST', `/api/npcs/${npcId}/gold`, { amount, operation });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/npcs`] });
      toast({
        title: "Gold Updated",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update Gold",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Filter sessions by search query
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim() || !sessions) return sessions;
    
    const query = searchQuery.toLowerCase();
    return sessions.filter(session => 
      session.title.toLowerCase().includes(query) || 
      session.narrative.toLowerCase().includes(query)
    );
  }, [sessions, searchQuery]);
  
  // Handle choice selection
  const handleChoiceSelection = (choice: any) => {
    setSelectedAction(choice.action);
    
    // Check if the choice requires a dice roll (handle both property naming conventions)
    if (choice.requiresRoll || choice.requiresDiceRoll) {
      // Set up the dice roll
      let diceType = choice.diceType as DiceType;
      console.log("Original dice type:", diceType);
      
      if (!diceType || !["d4", "d6", "d8", "d10", "d12", "d20", "d100"].includes(diceType)) {
        diceType = "d20"; // Default to d20 if invalid dice type
        console.warn("Invalid dice type provided, defaulting to d20");
      }
      
      console.log("Final dice type being used:", diceType);
      
      // Set up the dice roll with defaults for any missing values
      setCurrentDiceRoll({
        action: choice.action,
        diceType: diceType,
        rollDC: choice.rollDC || 10, // Default DC if none provided
        rollModifier: choice.rollModifier || 0,
        rollPurpose: choice.rollPurpose || "Skill Check",
        successText: choice.successText || "Success!",
        failureText: choice.failureText || "Failure!"
      });
      
      // Log for debugging
      console.log("Setting up dice roll:", {
        action: choice.action,
        diceType: diceType,
        rollDC: choice.rollDC || 10,
        rollModifier: choice.rollModifier || 0,
      });
      
      setShowDiceRollDialog(true);
    } else {
      // Just advance the story with this action
      setIsAdvancingStory(true);
      advanceStory.mutate({ choice: choice.action }, {
        onSettled: () => {
          setIsAdvancingStory(false);
        }
      });
    }
  };

  const handleCustomAction = () => {
    if (!customAction.trim()) return;
    
    // Treat custom action as a choice that doesn't require dice roll initially
    // The AI will determine if it needs a roll and respond accordingly
    const customChoice = {
      action: customAction.trim(),
      requiresDiceRoll: false
    };
    
    setIsAdvancingStory(true);
    advanceStory.mutate({ choice: customChoice.action }, {
      onSettled: () => {
        setIsAdvancingStory(false);
        setCustomAction(""); // Clear the input after submission
      }
    });
  };
  
  const handleDiceRoll = async () => {
    if (!currentDiceRoll) return;
    
    try {
      setIsRolling(true);
      
      // Create the dice roll request
      const diceRoll: DiceRoll = {
        diceType: currentDiceRoll.diceType,
        count: 1, // Usually 1 for skill checks
        modifier: currentDiceRoll.rollModifier || 0,
        purpose: `${currentDiceRoll.rollPurpose || 'Skill Check'} for "${currentDiceRoll.action}"`,
        characterId: userParticipant?.characterId || null // Use character ID from campaign participant
      };
      
      console.log("Dice roll request:", diceRoll);
      
      // Show animation while we wait for server response
      setDiceRollResult({
        diceType: diceRoll.diceType,
        rolls: [0], // Placeholder 
        total: 0,
        modifier: diceRoll.modifier || 0,
        purpose: diceRoll.purpose || '',
        isCritical: false,
        isFumble: false
      });
      
      // Roll the dice on the server
      let result;
      try {
        console.log("Sending dice roll to server:", diceRoll);
        result = await rollDice(diceRoll);
        console.log("Server dice roll result:", result);
        
        if (!result || !result.rolls || !result.total) {
          throw new Error("Invalid dice roll result");
        }
        
        // Update the display with the actual result
        setDiceRollResult(result);
      } catch (error) {
        console.error("Error with server dice roll:", error);
        
        // If server roll fails, do a client-side fallback
        result = clientRollDice(diceRoll);
        setDiceRollResult(result);
        console.log("Using client fallback roll:", result);
      }
      
      // Wait for animation to play
      setTimeout(() => {
        setIsRolling(false);
        
        if (!currentDiceRoll) {
          console.error("Current dice roll is null");
          return;
        }
        
        // Check if the roll was successful
        const rollDC = currentDiceRoll.rollDC || 10;
        const success = result.total >= rollDC;
        
        console.log(`Roll total: ${result.total}, DC: ${rollDC}, Success: ${success}`);
        
        // Show loading state first
        setIsAdvancingStory(true);
        
        // Set a small delay to show the roll result before advancing
        setTimeout(() => {
          // Advance the story with the roll result using enhanced format
          const rollResultData = {
            diceType: currentDiceRoll.diceType,
            result: result.rolls[0], // Get the actual dice roll result
            modifier: currentDiceRoll.rollModifier,
            total: result.total,
            dc: rollDC,
            purpose: currentDiceRoll.action
          };
          
          advanceStory.mutate({
            choice: currentDiceRoll.action,
            rollResult: rollResultData
          }, {
            onSettled: () => {
              // When the story advancement is complete (success or error)
              setIsAdvancingStory(false);
              // Close the dialog and reset all dice roll state
              setShowDiceRollDialog(false);
              setCurrentDiceRoll(null);
              setDiceRollResult(null);
              setIsRolling(false);
            }
          });
        }, 1000);
      }, 1500);
      
    } catch (error) {
      console.error("Error with dice roll:", error);
      // Reset all dice roll state on error
      setIsRolling(false);
      setDiceRollResult(null);
      setShowDiceRollDialog(false);
      setCurrentDiceRoll(null);
      toast({
        title: "Dice Roll Error",
        description: "There was a problem with your dice roll",
        variant: "destructive"
      });
    }
  };
  
  // Show join dialog if not already a participant
  const handleJoinCampaign = () => {
    if (!userParticipant && user) {
      setShowCharacterSelectionDialog(true);
    }
  };
  
  // If user is not yet a participant, show a join button
  const showJoinButton = !userParticipant && !participantsLoading && user && user.id !== campaign.userId;
  
  return (
    <div className="w-full">
      {/* Dice Roll Dialog */}
      <Dialog open={showDiceRollDialog} onOpenChange={(open) => {
        if (!open) {
          // Reset all dice roll state when dialog is closed
          setShowDiceRollDialog(false);
          setCurrentDiceRoll(null);
          setDiceRollResult(null);
          setIsRolling(false);
        } else {
          setShowDiceRollDialog(true);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Roll the Dice</DialogTitle>
            <DialogDescription>
              {currentDiceRoll?.rollPurpose} - DC {currentDiceRoll?.rollDC}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {diceRollResult ? (
              <div className="text-center space-y-4">
                <div className="text-4xl font-bold font-fantasy">
                  {diceRollResult.total >= (currentDiceRoll?.rollDC || 0) ? (
                    <span className="text-emerald-600">Success!</span>
                  ) : (
                    <span className="text-rose-600">Failure!</span>
                  )}
                </div>
                
                {/* Visual dice display */}
                <div className="flex items-center justify-center space-x-2">
                  <div className="text-3xl font-bold bg-primary/20 p-3 rounded-lg w-16 h-16 flex items-center justify-center">
                    {diceRollResult.rolls[0]}
                  </div>
                  
                  {diceRollResult.rolls.length > 1 && (
                    <div className="text-3xl font-bold bg-primary/20 p-3 rounded-lg w-16 h-16 flex items-center justify-center">
                      {diceRollResult.rolls[1]}
                    </div>
                  )}
                  
                  {currentDiceRoll?.rollModifier !== 0 && (
                    <>
                      <span className="text-2xl">+</span>
                      <div className="text-xl font-bold bg-secondary/20 p-2 rounded-lg w-10 h-10 flex items-center justify-center">
                        {currentDiceRoll?.rollModifier}
                      </div>
                    </>
                  )}
                  
                  <span className="text-2xl">=</span>
                  <div className="text-3xl font-bold bg-accent/20 p-3 rounded-lg w-16 h-16 flex items-center justify-center">
                    {diceRollResult.total}
                  </div>
                </div>
                
                {/* Detailed roll breakdown for learning */}
                <div className="mt-4 p-4 bg-stone-100 dark:bg-stone-800 rounded-lg text-left">
                  <h4 className="font-semibold text-sm mb-2 text-primary">Roll Breakdown (D&D 5e):</h4>
                  <div className="space-y-1 text-sm font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">{currentDiceRoll?.diceType} roll:</span>
                      <span className="font-bold">{diceRollResult.rolls[0]}</span>
                    </div>
                    {diceRollResult.rolls.length > 1 && (
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>(Advantage/Disadvantage roll: {diceRollResult.rolls[1]})</span>
                      </div>
                    )}
                    {currentDiceRoll?.rollModifier !== 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">
                          {currentDiceRoll?.rollPurpose?.toLowerCase().includes('attack') 
                            ? 'Attack Bonus (Ability + Proficiency):' 
                            : currentDiceRoll?.rollPurpose?.toLowerCase().includes('save')
                            ? 'Saving Throw Modifier:'
                            : 'Skill Modifier (Ability + Proficiency + Skill):'}
                        </span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {currentDiceRoll?.rollModifier >= 0 ? '+' : ''}{currentDiceRoll?.rollModifier}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-stone-300 dark:border-stone-600 pt-1 mt-1 flex justify-between">
                      <span className="font-semibold">Total:</span>
                      <span className="font-bold text-lg">{diceRollResult.total}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>vs. Difficulty Class (DC):</span>
                      <span className="font-bold">{currentDiceRoll?.rollDC}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 italic">
                    {diceRollResult.total >= (currentDiceRoll?.rollDC || 0) 
                      ? `Your roll of ${diceRollResult.total} meets or exceeds the DC of ${currentDiceRoll?.rollDC}, so you succeed!`
                      : `Your roll of ${diceRollResult.total} is below the DC of ${currentDiceRoll?.rollDC}, so you fail.`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6">
                <div className="text-center mb-4">
                  <p className="font-medium">Rolling {currentDiceRoll?.diceType}{currentDiceRoll?.rollModifier ? ` with a ${currentDiceRoll.rollModifier >= 0 ? '+' : ''}${currentDiceRoll.rollModifier} modifier` : ''}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">For: {currentDiceRoll?.action}</p>
                </div>
                
                <Button 
                  className="mt-4 w-40 h-12 text-lg"
                  onClick={handleDiceRoll}
                >
                  {isRolling ? (
                    <span className="flex items-center">
                      <Dices className="mr-2 h-6 w-6 animate-spin" />
                      Rolling...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <Dices className="mr-2 h-6 w-6" />
                      Roll the Dice!
                    </span>
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Character Selection Dialog */}
      <Dialog open={showCharacterSelectionDialog} onOpenChange={setShowCharacterSelectionDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Select a Character</DialogTitle>
            <DialogDescription className="text-slate-900 dark:text-slate-100/80">
              Choose a character to join this campaign
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Debug information */}
            {process.env.NODE_ENV === 'development' && (
              <div className="bg-muted p-2 rounded text-xs font-mono mb-4">
                <div>User ID: {user?.id}</div>
                <div>Characters found: {Array.isArray(userCharacters) ? userCharacters.length : 'not an array'}</div>
                <div>Selected Character: {selectedCharacterId}</div>
              </div>
            )}
            
            {userCharacters && Array.isArray(userCharacters) && userCharacters.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {userCharacters.map((character) => (
                  <div 
                    key={character.id}
                    className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-primary ${
                      selectedCharacterId === character.id ? 'border-primary bg-primary/10' : 'border-border'
                    }`}
                    onClick={() => setSelectedCharacterId(character.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-medium">{character.name}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Level {character.level} {character.race} {character.class}
                        </p>
                      </div>
                      {selectedCharacterId === character.id && (
                        <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center">
                          ✓
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-600 dark:text-slate-400 mb-4">You need to create a character first</p>
                <Button asChild>
                  <a href="/characters">Create a Character</a>
                </Button>
              </div>
            )}
          </div>
          
          <DialogFooter className="gap-2 mt-2">
            <Button
              onClick={() => setShowCharacterSelectionDialog(false)}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => joinCampaignMutation.mutate()}
              disabled={!selectedCharacterId || joinCampaignMutation.isPending}
              className="flex-1"
            >
              {joinCampaignMutation.isPending ? "Joining..." : "Join Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Card className="border-2 border-accent-light bg-parchment drop-shadow-lg">
        <CardContent className="p-0">
          <Tabs defaultValue="narrative" className="w-full">
            <TabsList className="grid w-full grid-cols-5 bg-secondary-light rounded-none">
              <TabsTrigger value="narrative" className="text-xs sm:text-sm md:text-base">Narrative</TabsTrigger>
              <TabsTrigger value="journey-log" className="text-xs sm:text-sm md:text-base">Journey Log</TabsTrigger>
              <TabsTrigger value="party" className="text-xs sm:text-sm md:text-base">Party</TabsTrigger>
              <TabsTrigger value="settings" className="text-xs sm:text-sm md:text-base">Settings</TabsTrigger>
              <TabsTrigger value="deploy" className="text-xs sm:text-sm md:text-base">
                <span className="flex items-center">
                  <Share2 className="h-3.5 w-3.5 mr-1 md:mr-2 hidden sm:inline-block" />
                  <span>Deploy</span>
                </span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="narrative" className="p-4 sm:p-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold font-fantasy" style={{ color: '#0f172a' }}>
                    {campaign.title}
                  </h2>
                  <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md border">
                    <p className="text-gray-900 dark:text-gray-50 font-semibold text-base leading-relaxed">
                      {campaign.description}
                    </p>
                  </div>
                </div>
                
                {/* Adventure Ended - Game Over Display */}
                {parsedStoryState?.adventureEnded && parsedStoryState?.endReason === 'player_death' && (
                  <div className="mt-6 p-6 bg-gradient-to-b from-gray-900 to-black rounded-lg border-2 border-red-800 text-center">
                    <div className="text-6xl mb-4">💀</div>
                    <h2 className="text-3xl font-bold text-red-500 mb-4">GAME OVER</h2>
                    <p className="text-gray-300 mb-6 text-lg">
                      Your hero has fallen. The adventure has come to a tragic end.
                    </p>
                    <div className="space-y-3">
                      <p className="text-gray-400 text-sm">
                        You may create a new character or start a new adventure to continue playing.
                      </p>
                      <Button 
                        variant="outline" 
                        className="border-red-600 text-red-400 hover:bg-red-900/30"
                        onClick={() => window.location.href = '/characters'}
                        data-testid="button-create-new-character"
                      >
                        Create New Character
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Current Session */}
                {currentSession && !parsedStoryState?.adventureEnded ? (
                  <div className="mt-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <h3 className="text-xl font-bold flex items-center" style={{ color: '#0f172a' }}>
                        <Scroll className="h-5 w-5 mr-2 text-indigo-600 dark:text-indigo-400" />
                        Session {currentSession.sessionNumber}: {currentSession.title}
                      </h3>
                      
                      {/* Map and location controls */}
                      <div className="flex items-center gap-2">
                        <DungeonMapModal
                          campaignId={campaign.id}
                          campaignName={campaign.title}
                          dungeonLevel={currentSession.sessionNumber}
                          mapId={dungeonMapId}
                          initialMapData={dungeonMapData}
                          onMapDataChange={handleDungeonMapChange}
                          pendingEncounter={parsedStoryState?.pendingEncounter}
                          readOnly={true}
                          onTileInteraction={(x, y, tileType) => {
                            if (tileType === "treasure") {
                              toast({
                                title: "Treasure!",
                                description: "You found treasure! Roll Investigation to search.",
                              });
                            } else if (tileType === "trap") {
                              toast({
                                title: "Trap triggered!",
                                description: "Make a Dexterity save to avoid damage.",
                                variant: "destructive",
                              });
                            }
                          }}
                          onEntityInteraction={(entity) => {
                            if (entity.type === "enemy" || entity.type === "boss") {
                              toast({
                                title: `${entity.name} encountered!`,
                                description: `HP: ${entity.hp}/${entity.maxHp}`,
                                variant: "destructive",
                              });
                            }
                          }}
                        />
                        {currentSession.location && (
                          <Button variant="outline" size="sm" className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            <span className="hidden sm:inline">{currentSession.location}</span>
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Adventure Progress Display */}
                    {parsedStoryState?.adventureProgress && parsedStoryState?.adventureRequirements && (() => {
                      // Calculate progress percentage locally for reliability
                      const progress = parsedStoryState.adventureProgress as any;
                      const requirements = parsedStoryState.adventureRequirements as any;
                      
                      const combatDone = Math.min(progress.encounters?.combat || 0, requirements.encounters?.combat || 1);
                      const trapDone = Math.min(progress.encounters?.trap || 0, requirements.encounters?.trap || 1);
                      const treasureDone = Math.min(progress.encounters?.treasure || 0, requirements.encounters?.treasure || 1);
                      const puzzlesDone = Math.min(progress.puzzles || 0, requirements.puzzles || 1);
                      const discoveriesDone = Math.min(progress.discoveries || 0, requirements.discoveries || 1);
                      const subquestsDone = Math.min(progress.subquestsCompleted || 0, requirements.subquests || 1);
                      
                      const totalDone = combatDone + trapDone + treasureDone + puzzlesDone + discoveriesDone + subquestsDone;
                      const totalRequired = (requirements.encounters?.combat || 0) + (requirements.encounters?.trap || 0) + 
                                           (requirements.encounters?.treasure || 0) + (requirements.puzzles || 0) + 
                                           (requirements.discoveries || 0) + (requirements.subquests || 0);
                      
                      const percentComplete = totalRequired > 0 ? Math.floor((totalDone / totalRequired) * 100) : 0;
                      const isComplete = percentComplete >= 100;
                      
                      return (
                        <div className="bg-slate-100 dark:bg-slate-900/50 p-4 rounded-md border-2 border-slate-300 dark:border-slate-700 mb-4 shadow-sm">
                          <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center mb-3 text-base">
                            <Target className="h-5 w-5 mr-2 text-indigo-600 dark:text-indigo-400" />
                            Adventure Progress
                            {isComplete && (
                              <Badge className="ml-2 bg-green-600 text-white">Complete!</Badge>
                            )}
                          </h4>
                          
                          <div className="mb-4">
                            <div className="flex justify-between text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                              <span>Overall Progress</span>
                              <span>{percentComplete}%</span>
                            </div>
                            <div className="h-3 bg-slate-300 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                                style={{ width: `${percentComplete}%` }}
                              />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                            <div className="bg-red-600 dark:bg-red-700 p-2 rounded text-center shadow">
                              <div className="font-bold text-white text-lg">
                                {progress.encounters?.combat || 0}/{requirements.encounters?.combat || 0}
                              </div>
                              <div className="text-red-100 font-medium">Combat</div>
                            </div>
                            <div className="bg-orange-600 dark:bg-orange-700 p-2 rounded text-center shadow">
                              <div className="font-bold text-white text-lg">
                                {progress.encounters?.trap || 0}/{requirements.encounters?.trap || 0}
                              </div>
                              <div className="text-orange-100 font-medium">Traps</div>
                            </div>
                            <div className="bg-amber-500 dark:bg-amber-600 p-2 rounded text-center shadow">
                              <div className="font-bold text-white text-lg">
                                {progress.encounters?.treasure || 0}/{requirements.encounters?.treasure || 0}
                              </div>
                              <div className="text-amber-100 font-medium">Treasure</div>
                            </div>
                            <div className="bg-sky-600 dark:bg-sky-700 p-2 rounded text-center shadow">
                              <div className="font-bold text-white text-lg">
                                {progress.discoveries || 0}/{requirements.discoveries || 0}
                              </div>
                              <div className="text-sky-100 font-medium">Discoveries</div>
                            </div>
                          </div>
                          
                          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                            <div className="bg-violet-600 dark:bg-violet-700 p-2 rounded text-center shadow">
                              <div className="font-bold text-white text-lg">
                                {progress.puzzles || 0}/{requirements.puzzles || 0}
                              </div>
                              <div className="text-violet-100 font-medium">Puzzles</div>
                            </div>
                            <div className="bg-emerald-600 dark:bg-emerald-700 p-2 rounded text-center shadow">
                              <div className="font-bold text-white text-lg">
                                {progress.subquestsCompleted || 0}/{requirements.subquests || 0}
                              </div>
                              <div className="text-emerald-100 font-medium">Subquests</div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* Adventure Objectives - Story-driven quests that auto-complete */}
                    {parsedStoryState?.activeQuests && 
                     (parsedStoryState.activeQuests as any[]).length > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-md border border-amber-200 dark:border-amber-800 mb-4">
                        <h4 className="font-semibold text-amber-800 dark:text-amber-200 flex items-center mb-3">
                          <Target className="h-4 w-4 mr-2" />
                          Adventure Objectives
                        </h4>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mb-3 opacity-80">
                          Complete these objectives through your actions to progress the story
                        </p>
                        <div className="space-y-2">
                          {(parsedStoryState.activeQuests as any[]).map((quest: any, index: number) => (
                            <div 
                              key={quest.id || index}
                              className={`flex items-start gap-2 p-2 rounded ${
                                quest.status === 'completed' 
                                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200' 
                                  : quest.status === 'in_progress'
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                                  : 'bg-amber-100/50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-100'
                              }`}
                              data-testid={`objective-${index}`}
                            >
                              <span className="text-lg">
                                {quest.status === 'completed' ? '✓' : quest.status === 'in_progress' ? '→' : '○'}
                              </span>
                              <div className="flex-1">
                                <p className="font-medium text-sm">{quest.title}</p>
                                <p className="text-xs opacity-80">{quest.description}</p>
                                {quest.xpReward && quest.status !== 'completed' && (
                                  <div className="flex items-center gap-2 mt-1 text-xs font-medium text-purple-600 dark:text-purple-400">
                                    <Sparkles className="h-3 w-3" />
                                    {quest.xpReward} XP on completion
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Combat Status Display */}
                    {parsedStoryState?.inCombat && (
                      <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-md border-2 border-red-400 dark:border-red-700 mb-4">
                        <h4 className="font-bold text-red-700 dark:text-red-300 flex items-center mb-3 text-lg">
                          ⚔️ COMBAT!
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Party Members Column */}
                          <div>
                            <h5 className="font-semibold text-green-700 dark:text-green-300 mb-2 flex items-center">
                              🛡️ Your Party
                            </h5>
                            <div className="space-y-2">
                              {(parsedStoryState.partyMembers as any[] || []).filter((m: any) => m.status !== 'unconscious').map((member: any, index: number) => (
                                <div 
                                  key={member.name || index}
                                  className={`p-2 rounded border ${
                                    member.type === 'player' 
                                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700' 
                                      : 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700'
                                  }`}
                                >
                                  <div className="flex justify-between items-center mb-1">
                                    <span className={`font-bold text-sm ${
                                      member.type === 'player' ? 'text-blue-800 dark:text-blue-200' : 'text-green-800 dark:text-green-200'
                                    }`}>
                                      {member.type === 'player' ? '👤 ' : '🤝 '}{member.name}
                                      {member.class && <span className="text-xs ml-1 opacity-70">({member.class})</span>}
                                    </span>
                                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                      member.status === 'bloodied' 
                                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' 
                                        : member.status === 'wounded'
                                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    }`}>
                                      {member.status || 'healthy'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-600 dark:text-gray-400">HP:</span>
                                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full transition-all ${
                                          (member.currentHp / member.maxHp) <= 0.25 
                                            ? 'bg-red-500' 
                                            : (member.currentHp / member.maxHp) <= 0.5 
                                            ? 'bg-orange-500' 
                                            : 'bg-green-500'
                                        }`}
                                        style={{ width: `${Math.max(0, (member.currentHp / member.maxHp) * 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-mono text-gray-700 dark:text-gray-300 min-w-[45px] text-right">
                                      {member.currentHp}/{member.maxHp}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Enemies Column */}
                          <div>
                            <h5 className="font-semibold text-red-700 dark:text-red-300 mb-2 flex items-center">
                              👹 Enemies
                            </h5>
                            <div className="space-y-3">
                              {(parsedStoryState.combatants as any[] || []).filter((c: any) => c.status !== 'defeated').map((enemy: any, index: number) => (
                                <div 
                                  key={enemy.name || index}
                                  className="bg-red-100 dark:bg-red-900/30 p-3 rounded-lg border border-red-300 dark:border-red-700"
                                  data-testid={`enemy-card-${index}`}
                                >
                                  <div className="flex gap-3">
                                    {/* Monster Portrait */}
                                    <div 
                                      className="w-20 h-20 rounded-lg bg-red-200 dark:bg-red-800/50 flex items-center justify-center overflow-hidden border-2 border-red-400 dark:border-red-600 shrink-0 cursor-pointer relative group"
                                      onClick={() => !monsterImages[enemy.name] && !generatingMonsterImage && generateMonsterImage(enemy.name, enemy.description, enemy.type)}
                                      title={monsterImages[enemy.name] ? enemy.name : "Click to generate monster illustration"}
                                    >
                                      {monsterImages[enemy.name] || enemy.imageUrl ? (
                                        <img 
                                          src={monsterImages[enemy.name] || enemy.imageUrl} 
                                          alt={enemy.name} 
                                          className="w-full h-full object-cover"
                                        />
                                      ) : generatingMonsterImage === enemy.name ? (
                                        <div className="animate-pulse text-red-600 dark:text-red-400 text-xs text-center">
                                          <div className="animate-spin text-2xl">⏳</div>
                                          <span>Creating...</span>
                                        </div>
                                      ) : (
                                        <div className="flex flex-col items-center">
                                          <div className="text-3xl">
                                            {enemy.type === 'boss' ? '👹' : 
                                             enemy.name?.toLowerCase().includes('dragon') ? '🐉' :
                                             enemy.name?.toLowerCase().includes('skeleton') ? '💀' :
                                             enemy.name?.toLowerCase().includes('zombie') ? '🧟' :
                                             enemy.name?.toLowerCase().includes('goblin') ? '👺' :
                                             enemy.name?.toLowerCase().includes('orc') ? '👹' :
                                             enemy.name?.toLowerCase().includes('wolf') ? '🐺' :
                                             enemy.name?.toLowerCase().includes('spider') ? '🕷️' :
                                             enemy.name?.toLowerCase().includes('rat') ? '🐀' :
                                             enemy.name?.toLowerCase().includes('snake') ? '🐍' :
                                             enemy.name?.toLowerCase().includes('troll') ? '🧌' :
                                             enemy.name?.toLowerCase().includes('ghost') || enemy.name?.toLowerCase().includes('specter') ? '👻' :
                                             enemy.name?.toLowerCase().includes('demon') || enemy.name?.toLowerCase().includes('devil') ? '😈' :
                                             '⚔️'}
                                          </div>
                                          <span className="text-[8px] text-red-600 dark:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            Click for art
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Monster Stats */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-sm text-red-800 dark:text-red-200 truncate">{enemy.name}</span>
                                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${
                                          enemy.status === 'bloodied' 
                                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' 
                                            : enemy.status === 'wounded'
                                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                        }`}>
                                          {enemy.status || 'healthy'}
                                        </span>
                                      </div>
                                      
                                      {/* HP Bar */}
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs text-gray-600 dark:text-gray-400">HP:</span>
                                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                          <div 
                                            className={`h-full rounded-full transition-all ${
                                              (enemy.currentHp / enemy.maxHp) <= 0.25 
                                                ? 'bg-red-500' 
                                                : (enemy.currentHp / enemy.maxHp) <= 0.5 
                                                ? 'bg-orange-500' 
                                                : 'bg-green-500'
                                            }`}
                                            style={{ width: `${Math.max(0, (enemy.currentHp / enemy.maxHp) * 100)}%` }}
                                          />
                                        </div>
                                        <span className="text-xs font-mono text-gray-700 dark:text-gray-300 min-w-[45px] text-right">
                                          {enemy.currentHp}/{enemy.maxHp}
                                        </span>
                                      </div>
                                      
                                      {/* D&D Stats */}
                                      <div className="flex flex-wrap gap-2 text-xs">
                                        {enemy.ac && (
                                          <span className="bg-stone-200 dark:bg-stone-700 px-1.5 py-0.5 rounded" title="Armor Class - higher means harder to hit">
                                            AC: {enemy.ac}
                                          </span>
                                        )}
                                        {enemy.cr && (
                                          <span className="bg-purple-200 dark:bg-purple-800 px-1.5 py-0.5 rounded" title="Challenge Rating - indicates difficulty">
                                            CR: {enemy.cr}
                                          </span>
                                        )}
                                        {enemy.attackBonus && (
                                          <span className="bg-red-200 dark:bg-red-800 px-1.5 py-0.5 rounded" title="Attack Bonus - added to d20 attack rolls">
                                            ATK: +{enemy.attackBonus}
                                          </span>
                                        )}
                                        {enemy.damage && (
                                          <span className="bg-orange-200 dark:bg-orange-800 px-1.5 py-0.5 rounded" title="Damage dice rolled on hit">
                                            DMG: {enemy.damage}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-md border border-border shadow-inner">
                      {isAdvancingStory ? (
                        <div className="flex flex-col items-center justify-center py-10">
                          <div className="animate-spin h-12 w-12 rounded-full border-4 border-primary border-t-transparent"></div>
                          <p className="mt-4 text-center font-medium text-primary">
                            Adventure continues...
                          </p>
                        </div>
                      ) : (
                        <p className="whitespace-pre-line text-sm sm:text-base leading-relaxed text-card-foreground font-medium">
                          {currentSession.narrative}
                        </p>
                      )}
                    </div>
                    
                    {/* Action choices */}
                    {!isAdvancingStory && currentSession.choices && Array.isArray(currentSession.choices) && currentSession.choices.length > 0 ? (
                      <div className="mt-6 space-y-4">
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100">What will you do?</h4>
                        
                        {/* Suggested Actions */}
                        <div className="grid grid-cols-1 gap-2">
                          {currentSession.choices.map((choice: any, index: number) => {
                            // Parse DC and calculate success probability
                            const choiceText = choice.action || choice.text || '';
                            const dc = choice.rollDC || parseDCFromText(choiceText);
                            const skillName = choice.skillType || choice.rollPurpose?.toLowerCase().replace(/\s+check/i, '') || 'strength';
                            const hasRoll = choice.requiresRoll || choice.requiresDiceRoll || dc;
                            
                            // Get modifier and probability if we have a character and a roll is required
                            let tooltipContent = null;
                            if (hasRoll && activeCharacter && dc) {
                              const { modifier, breakdown } = getSkillModifier(activeCharacter, skillName);
                              const probability = calculateSuccessProbability(dc, modifier);
                              const likelihood = getLikelihoodDescription(probability);
                              
                              tooltipContent = (
                                <div className="text-sm space-y-1 p-1">
                                  <div className="font-bold text-white">DC {dc} {skillName.charAt(0).toUpperCase() + skillName.slice(1)} Check</div>
                                  <div className="text-gray-300">Your modifier: {breakdown}</div>
                                  <div className={`font-semibold ${likelihood.color}`}>
                                    Success chance: {Math.round(probability)}% ({likelihood.text})
                                  </div>
                                  <div className="text-xs text-gray-400 mt-1">
                                    Need to roll {Math.max(1, dc - getSkillModifier(activeCharacter, skillName).modifier)}+ on d20
                                  </div>
                                </div>
                              );
                            }
                            
                            const button = (
                              <Button 
                                key={index}
                                variant="outline"
                                className="justify-start h-auto py-3 px-4 bg-background hover:bg-accent border-2 border-border hover:border-primary text-left w-full"
                                onClick={() => handleChoiceSelection(choice)}
                                data-testid={`choice-button-${index}`}
                              >
                                <div className="flex items-start w-full min-w-0">
                                  <ArrowRight className="h-5 w-5 mr-2 mt-0.5 shrink-0 text-primary" />
                                  <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-2 min-w-0 flex-1">
                                    <span className="text-slate-900 dark:text-slate-100 font-medium break-words">
                                      {choiceText}
                                    </span>
                                    {hasRoll && (
                                      <div className="flex items-center gap-1 shrink-0">
                                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded font-bold whitespace-nowrap">
                                          {choice.rollPurpose || "Skill Check"} ({choice.diceType || "d20"})
                                        </span>
                                        {tooltipContent && activeCharacter && (
                                          <span className={`text-xs px-1.5 py-0.5 rounded font-bold whitespace-nowrap ${getLikelihoodDescription(calculateSuccessProbability(dc, getSkillModifier(activeCharacter, skillName).modifier)).color} bg-black/20`}>
                                            {Math.round(calculateSuccessProbability(dc, getSkillModifier(activeCharacter, skillName).modifier))}%
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </Button>
                            );
                            
                            // Wrap with tooltip if we have content
                            if (tooltipContent) {
                              return (
                                <Tooltip key={index}>
                                  <TooltipTrigger asChild>
                                    {button}
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="bg-gray-900 border-gray-700 max-w-xs" data-testid={`tooltip-choice-${index}`}>
                                    {tooltipContent}
                                  </TooltipContent>
                                </Tooltip>
                              );
                            }
                            
                            return button;
                          })}
                        </div>
                        
                        {/* Custom Action Input */}
                        <div className="mt-4 p-4 bg-white dark:bg-slate-800/50 rounded-lg border border-border">
                          <div className="space-y-3">
                            <h5 className="font-medium text-sm text-slate-900 dark:text-slate-100">Or describe your own action:</h5>
                            <div className="flex gap-2">
                              <Input
                                placeholder="e.g., 'Search the chapel thoroughly for hidden symbols' or 'Approach the children and ask what they saw'"
                                value={customAction}
                                onChange={(e) => setCustomAction(e.target.value)}
                                className="flex-1"
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter' && customAction.trim()) {
                                    handleCustomAction();
                                  }
                                }}
                              />
                              <Button 
                                onClick={handleCustomAction}
                                disabled={!customAction.trim() || isAdvancingStory}
                                className="shrink-0"
                              >
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </div>
                            <p className="text-xs text-slate-900 dark:text-slate-100/70">
                              The AI will determine if your action needs a dice roll and what type.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : sessionsLoading ? (
                  <div className="mt-6">
                    <Skeleton className="h-12 w-3/4 mb-4" />
                    <Skeleton className="h-40 w-full mb-4" />
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    <h3 className="text-lg font-semibold">No Sessions Available</h3>
                    <p className="text-slate-600 dark:text-slate-400">
                      This campaign has no sessions yet. 
                      {isDM ? " Start your adventure by creating the first session." : " Wait for the DM to begin the campaign."}
                    </p>
                    
                    {/* Show create session button for DM */}
                    {isDM && (
                      <Button className="mt-4">
                        <Sparkle className="h-4 w-4 mr-2" />
                        Create First Session
                      </Button>
                    )}
                  </div>
                )}
                
                {/* Join button (if not already a participant) */}
                {showJoinButton && (
                  <div className="mt-8">
                    <Button 
                      className="w-full sm:w-auto" 
                      size="lg"
                      onClick={handleJoinCampaign}
                    >
                      Join This Campaign
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="journey-log" className="p-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold font-fantasy text-slate-900 dark:text-slate-100">Journey Log</h2>
                  
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-600 dark:text-slate-400" />
                    <Input
                      type="search"
                      placeholder="Search journey log..."
                      className="pl-8 w-[200px] sm:w-[300px]"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                
                {/* Live Exploration Events from storyState */}
                {parsedStoryState?.journeyLog && (parsedStoryState.journeyLog as any[]).length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Recent Exploration
                    </h3>
                    <div className="max-h-64 overflow-y-auto space-y-2 border rounded-md p-3 bg-white dark:bg-slate-800">
                      {[...(parsedStoryState.journeyLog as any[])].reverse().map((entry: any) => (
                        <div 
                          key={entry.id} 
                          className={`p-3 rounded-lg text-sm border-l-4 shadow-sm ${
                            entry.type === 'combat' || entry.type === 'combat_resolved' 
                              ? 'border-l-red-500 bg-red-50 dark:bg-red-950/30' 
                              : entry.type === 'trap' || entry.type === 'trap_resolved'
                              ? 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/30'
                              : entry.type === 'treasure' || entry.type === 'treasure_resolved'
                              ? 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/30'
                              : entry.type === 'discovery'
                              ? 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/30'
                              : entry.type === 'story' || entry.type === 'narrative'
                              ? 'border-l-purple-500 bg-purple-50 dark:bg-purple-950/30'
                              : 'border-l-stone-400 bg-stone-100 dark:bg-stone-800/50'
                          }`}
                          data-testid={`journey-entry-${entry.id}`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <p className="text-stone-800 dark:text-stone-100 leading-relaxed">{entry.description}</p>
                            <span className="text-xs text-stone-500 dark:text-stone-400 ml-2 whitespace-nowrap flex-shrink-0">
                              {new Date(entry.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          {entry.position && (
                            <span className="text-xs text-stone-500 dark:text-stone-400 mt-1 block">
                              Position: ({entry.position.x}, {entry.position.y})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Sessions list */}
                <div className="space-y-3 mt-6">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Session History</h3>
                  {sessionsLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : filteredSessions && filteredSessions.length > 0 ? (
                    filteredSessions.map((session) => (
                      <Collapsible
                        key={session.id}
                        open={expandedSessions.includes(session.id)}
                        onOpenChange={() => toggleSessionExpanded(session.id)}
                        className="border rounded-md"
                      >
                        <CollapsibleTrigger className="flex justify-between items-center w-full p-3 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors bg-white dark:bg-slate-800">
                          <div className="flex items-center">
                            <Scroll className="h-5 w-5 mr-2 text-indigo-600 dark:text-indigo-400" />
                            <div className="text-left">
                              <div className="font-bold text-slate-900 dark:text-slate-100">Session {session.sessionNumber}: {session.title}</div>
                              {session.location && (
                                <div className="text-sm text-slate-600 dark:text-slate-400 flex items-center">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  {session.location}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {expandedSessions.includes(session.id) ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>
                          <div className="p-3 pt-0 border-t bg-white dark:bg-slate-800">
                            <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded-md text-sm whitespace-pre-line">
                              <p className="text-slate-800 dark:text-slate-200">{session.narrative}</p>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-slate-600 dark:text-slate-400">No session history available</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="party" className="p-4">
              <div className="space-y-4">
                <h2 className="text-xl font-bold font-fantasy text-slate-900 dark:text-slate-100">Campaign Party</h2>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Party Management</h3>
                      <p className="text-slate-600 dark:text-slate-400 text-sm">Manage the players in this campaign</p>
                    </div>
                    
                    {/* DM only settings */}
                    {isDM && (
                      <div className="flex items-center space-x-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Switch
                                checked={isTurnBased}
                                onCheckedChange={handleToggleTurnBased}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Enable turn-based gameplay for this campaign</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </div>
                </div>
                
                <CampaignParticipants campaignId={campaign.id} isDM={isDM} />

                {/* Party Member Selection */}
                <div className="mt-6 p-4 border rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <Users className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                    Manage Party Member
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {/* Character button */}
                    {activeCharacter && (
                      <Button
                        variant={selectedPartyMemberType === "character" ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setSelectedPartyMemberType("character");
                          setSelectedNpcId(null);
                        }}
                        className="flex items-center gap-2"
                        data-testid="button-select-character"
                      >
                        <User className="h-4 w-4" />
                        {activeCharacter.name} (You)
                      </Button>
                    )}
                    {/* NPC buttons */}
                    {partyNpcs.map((npc: any) => (
                      <Button
                        key={`npc-select-${npc.id}`}
                        variant={selectedPartyMemberType === "npc" && selectedNpcId === npc.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setSelectedPartyMemberType("npc");
                          setSelectedNpcId(npc.id);
                        }}
                        className="flex items-center gap-2"
                        data-testid={`button-select-npc-${npc.id}`}
                      >
                        <Users className="h-4 w-4" />
                        {npc.name} (Companion)
                      </Button>
                    ))}
                    {!activeCharacter && partyNpcs.length === 0 && (
                      <p className="text-sm text-slate-600 dark:text-slate-400">No party members to manage</p>
                    )}
                  </div>
                </div>

                {/* Rest & Recovery Section - Character Only */}
                {selectedPartyMemberType === "character" && activeCharacter && (
                  <div className="mt-6 p-4 border rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <Heart className="h-5 w-5 text-red-500" />
                      Rest & Recovery - {activeCharacter.name}
                    </h3>
                    
                    {/* Status Display */}
                    {activeCharacter.status && activeCharacter.status !== "conscious" && (
                      <div className={`mb-4 p-3 rounded-lg border-2 ${
                        activeCharacter.status === "dead" ? "bg-gray-900 border-gray-700 text-gray-300" :
                        activeCharacter.status === "unconscious" ? "bg-red-900/50 border-red-700 text-red-200" :
                        "bg-yellow-900/50 border-yellow-700 text-yellow-200"
                      }`}>
                        <div className="font-bold text-lg uppercase">
                          {activeCharacter.status === "dead" ? "💀 DEAD" :
                           activeCharacter.status === "unconscious" ? "⚠️ UNCONSCIOUS - DYING" :
                           "🩹 STABILIZED"}
                        </div>
                        {activeCharacter.status === "unconscious" && (
                          <div className="mt-2">
                            <div className="text-sm">Death Saves: {activeCharacter.deathSaveSuccesses || 0}/3 successes, {activeCharacter.deathSaveFailures || 0}/3 failures</div>
                            <div className="flex gap-2 mt-2">
                              <Button
                                onClick={() => deathSaveMutation.mutate(activeCharacter.id)}
                                disabled={deathSaveMutation.isPending}
                                variant="destructive"
                                size="sm"
                                className="flex items-center gap-2"
                                data-testid="button-death-save"
                              >
                                {deathSaveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dices className="h-4 w-4" />}
                                Roll Death Save
                              </Button>
                              <Button
                                onClick={() => stabilizeMutation.mutate(activeCharacter.id)}
                                disabled={stabilizeMutation.isPending}
                                variant="secondary"
                                size="sm"
                                className="flex items-center gap-2"
                                data-testid="button-stabilize"
                              >
                                {stabilizeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />}
                                Stabilize (Medicine)
                              </Button>
                            </div>
                          </div>
                        )}
                        {activeCharacter.status === "stabilized" && (
                          <div className="text-sm mt-1">Character is stable but unconscious at 0 HP. Healing will restore consciousness.</div>
                        )}
                        {activeCharacter.status === "dead" && (
                          <div className="mt-3 p-3 bg-gray-800 rounded-lg border border-gray-600">
                            <div className="text-sm text-gray-300 mb-3">💀 This character has died and needs resurrection to rejoin adventures.</div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                onClick={() => resurrectMutation.mutate({ characterId: activeCharacter.id, method: "consumable" })}
                                disabled={resurrectMutation.isPending}
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-2 border-purple-500 text-purple-400 hover:bg-purple-900/30"
                                data-testid="button-resurrect-consumable"
                              >
                                {resurrectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scroll className="h-4 w-4" />}
                                Use Scroll of Revivify
                              </Button>
                              <Button
                                onClick={() => resurrectMutation.mutate({ characterId: activeCharacter.id, method: "temple" })}
                                disabled={resurrectMutation.isPending || ((activeCharacter as any).gold || 0) < 500}
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-2 border-yellow-500 text-yellow-400 hover:bg-yellow-900/30"
                                data-testid="button-resurrect-temple"
                              >
                                {resurrectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
                                Temple Service (500 gp)
                              </Button>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                              Temple resurrection costs 500 gold. Current gold: {(activeCharacter as any).gold || 0}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1 p-3 border rounded bg-slate-100 dark:bg-slate-700">
                        <div className="text-sm font-medium mb-1">Current HP</div>
                        <div className="text-2xl font-bold">
                          <span className={
                            activeCharacter.hitPoints <= 0 ? "text-red-500" :
                            activeCharacter.hitPoints < activeCharacter.maxHitPoints / 2 ? "text-orange-500" : 
                            "text-green-500"
                          }>
                            {activeCharacter.hitPoints}
                          </span>
                          <span className="text-slate-600 dark:text-slate-400">/{activeCharacter.maxHitPoints}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          onClick={() => shortRestMutation.mutate(activeCharacter.id)}
                          disabled={shortRestMutation.isPending || activeCharacter.hitPoints >= activeCharacter.maxHitPoints || activeCharacter.status === "unconscious" || activeCharacter.status === "dead" || parsedStoryState?.inCombat}
                          variant="outline"
                          className="flex items-center gap-2"
                          data-testid="button-short-rest"
                          title={parsedStoryState?.inCombat ? "Cannot rest during combat" : ""}
                        >
                          {shortRestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sun className="h-4 w-4" />}
                          Short Rest (+25% HP)
                        </Button>
                        <Button
                          onClick={() => longRestMutation.mutate(activeCharacter.id)}
                          disabled={longRestMutation.isPending || activeCharacter.hitPoints >= activeCharacter.maxHitPoints || activeCharacter.status === "dead" || parsedStoryState?.inCombat}
                          variant="outline"
                          className="flex items-center gap-2"
                          data-testid="button-long-rest"
                          title={parsedStoryState?.inCombat ? "Cannot rest during combat" : ""}
                        >
                          {longRestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Moon className="h-4 w-4" />}
                          Long Rest (Full HP)
                        </Button>
                        {parsedStoryState?.inCombat && (
                          <p className="text-xs text-red-400 mt-1">Cannot rest during combat!</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Inventory Management Section - Character */}
                {selectedPartyMemberType === "character" && activeCharacter && (
                  <div className="mt-6 p-4 border rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <Backpack className="h-5 w-5 text-amber-600" />
                      Inventory & Equipment - {activeCharacter.name}
                    </h3>
                    
                    {/* Equipment Slots */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {/* Weapon Slot */}
                      <div className="p-3 border rounded bg-slate-100 dark:bg-slate-700">
                        <div className="text-xs text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                          <Sword className="h-3 w-3" /> Weapon
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {(activeCharacter as any).equippedWeapon || "None"}
                          </span>
                          {(activeCharacter as any).equippedWeapon && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={() => unequipItemMutation.mutate({ characterId: activeCharacter.id, slot: "weapon" })}
                              disabled={unequipItemMutation.isPending}
                              data-testid="button-unequip-weapon"
                            >
                              Unequip
                            </Button>
                          )}
                        </div>
                      </div>
                      {/* Armor Slot */}
                      <div className="p-3 border rounded bg-slate-100 dark:bg-slate-700">
                        <div className="text-xs text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                          <Shield className="h-3 w-3" /> Armor
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {(activeCharacter as any).equippedArmor || "None"}
                          </span>
                          {(activeCharacter as any).equippedArmor && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={() => unequipItemMutation.mutate({ characterId: activeCharacter.id, slot: "armor" })}
                              disabled={unequipItemMutation.isPending}
                              data-testid="button-unequip-armor"
                            >
                              Unequip
                            </Button>
                          )}
                        </div>
                      </div>
                      {/* Shield Slot */}
                      <div className="p-3 border rounded bg-slate-100 dark:bg-slate-700">
                        <div className="text-xs text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                          <Shield className="h-3 w-3" /> Shield
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {(activeCharacter as any).equippedShield || "None"}
                          </span>
                          {(activeCharacter as any).equippedShield && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={() => unequipItemMutation.mutate({ characterId: activeCharacter.id, slot: "shield" })}
                              disabled={unequipItemMutation.isPending}
                              data-testid="button-unequip-shield"
                            >
                              Unequip
                            </Button>
                          )}
                        </div>
                      </div>
                      {/* Accessory Slot */}
                      <div className="p-3 border rounded bg-slate-100 dark:bg-slate-700">
                        <div className="text-xs text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> Accessory
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {(activeCharacter as any).equippedAccessory || "None"}
                          </span>
                          {(activeCharacter as any).equippedAccessory && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={() => unequipItemMutation.mutate({ characterId: activeCharacter.id, slot: "accessory" })}
                              disabled={unequipItemMutation.isPending}
                              data-testid="button-unequip-accessory"
                            >
                              Unequip
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* AC Display */}
                    <div className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                      Armor Class: <span className="font-bold text-slate-900 dark:text-slate-100">{activeCharacter.armorClass || 10}</span>
                    </div>

                    {/* Inventory Items */}
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Items ({activeCharacter.equipment?.length || 0})</div>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {activeCharacter.equipment && activeCharacter.equipment.length > 0 ? (
                          activeCharacter.equipment.map((item: string, index: number) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700 rounded text-sm" data-testid={`item-${index}`}>
                              <span className="flex-1 truncate" title={item}>{item}</span>
                              <div className="flex items-center gap-1">
                                <Select 
                                  value=""
                                  onValueChange={(slot) => {
                                    if (slot) {
                                      equipItemMutation.mutate({ characterId: activeCharacter.id, item, slot });
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-6 w-16 text-xs" data-testid={`select-equip-${index}`}>
                                    <SelectValue placeholder="Equip" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="weapon">Weapon</SelectItem>
                                    <SelectItem value="armor">Armor</SelectItem>
                                    <SelectItem value="shield">Shield</SelectItem>
                                    <SelectItem value="accessory">Accessory</SelectItem>
                                  </SelectContent>
                                </Select>
                                {participants && participants.length > 1 && (
                                  <Select 
                                    value=""
                                    onValueChange={(targetId) => {
                                      if (targetId) {
                                        transferItemMutation.mutate({ 
                                          fromCharacterId: activeCharacter.id, 
                                          toCharacterId: parseInt(targetId), 
                                          item 
                                        });
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="h-6 w-14 text-xs" data-testid={`select-transfer-${index}`}>
                                      <SelectValue placeholder="Give" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {participants
                                        .filter((p: any) => p.characterId !== activeCharacter.id)
                                        .map((p: any) => (
                                          <SelectItem key={p.characterId} value={p.characterId.toString()}>
                                            {p.character?.name || `Character ${p.characterId}`}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                  onClick={() => removeItemMutation.mutate({ 
                                    characterId: activeCharacter.id, 
                                    item 
                                  })}
                                  disabled={removeItemMutation.isPending}
                                  data-testid={`button-remove-item-${index}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-600 dark:text-slate-400 py-2">No items in inventory</p>
                        )}
                      </div>

                      {/* Add Item */}
                      <div className="flex gap-2 mt-3">
                        <Input
                          placeholder="Add new item..."
                          value={newItemName}
                          onChange={(e) => setNewItemName(e.target.value)}
                          className="flex-1"
                          data-testid="input-new-item"
                        />
                        <Button
                          onClick={() => {
                            if (newItemName.trim()) {
                              addItemMutation.mutate({ 
                                characterId: activeCharacter.id, 
                                item: newItemName.trim() 
                              });
                            }
                          }}
                          disabled={!newItemName.trim() || addItemMutation.isPending}
                          size="sm"
                          data-testid="button-add-item"
                        >
                          {addItemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Currency Section - Character */}
                {selectedPartyMemberType === "character" && activeCharacter && (
                  <div className="mt-6 p-4 border rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <Coins className="h-5 w-5 text-yellow-500" />
                      Currency - {activeCharacter.name}
                    </h3>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      <div className="p-2 border rounded bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 text-center">
                        <div className="text-xs text-slate-600 dark:text-slate-400">Platinum</div>
                        <div className="text-lg font-bold text-gray-400">{(activeCharacter as any).platinum || 0}</div>
                      </div>
                      <div className="p-2 border rounded bg-gradient-to-b from-yellow-100 to-yellow-200 dark:from-yellow-900/50 dark:to-yellow-800/50 text-center">
                        <div className="text-xs text-slate-600 dark:text-slate-400">Gold</div>
                        <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{(activeCharacter as any).gold || 0}</div>
                      </div>
                      <div className="p-2 border rounded bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 text-center">
                        <div className="text-xs text-slate-600 dark:text-slate-400">Silver</div>
                        <div className="text-lg font-bold text-slate-500">{(activeCharacter as any).silver || 0}</div>
                      </div>
                      <div className="p-2 border rounded bg-gradient-to-b from-orange-100 to-orange-200 dark:from-orange-900/50 dark:to-orange-800/50 text-center">
                        <div className="text-xs text-slate-600 dark:text-slate-400">Copper</div>
                        <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{(activeCharacter as any).copper || 0}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => addCurrencyMutation.mutate({ characterId: activeCharacter.id, gold: 10 })}
                        disabled={addCurrencyMutation.isPending}
                        data-testid="button-add-gold"
                      >
                        {addCurrencyMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "+10 GP"}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => spendCurrencyMutation.mutate({ characterId: activeCharacter.id, gold: 5 })}
                        disabled={spendCurrencyMutation.isPending || ((activeCharacter as any).gold || 0) < 5}
                        data-testid="button-spend-gold"
                      >
                        {spendCurrencyMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "-5 GP"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Consumables Section - Character */}
                {selectedPartyMemberType === "character" && activeCharacter && (
                  <div className="mt-6 p-4 border rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <FlaskConical className="h-5 w-5 text-purple-500" />
                      Consumables - {activeCharacter.name}
                    </h3>
                    
                    {/* Current Consumables */}
                    <div className="space-y-2 mb-4">
                      {(activeCharacter as any).consumables && (activeCharacter as any).consumables.length > 0 ? (
                        ((activeCharacter as any).consumables as any[]).map((item: any, index: number) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700 rounded border" data-testid={`consumable-${index}`}>
                            <div className="flex-1">
                              <div className="font-medium text-sm flex items-center gap-2">
                                {item.type === "healing" ? <Heart className="h-3 w-3 text-red-500" /> : <Sparkles className="h-3 w-3 text-blue-500" />}
                                {item.name}
                                <span className="text-xs text-slate-600 dark:text-slate-400">x{item.quantity}</span>
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-400">{item.effect}</div>
                            </div>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => useConsumableMutation.mutate({ characterId: activeCharacter.id, name: item.name })}
                              disabled={useConsumableMutation.isPending || activeCharacter.status === "dead"}
                              data-testid={`button-use-consumable-${index}`}
                            >
                              {useConsumableMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Use"}
                            </Button>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-600 dark:text-slate-400 py-2">No consumables. Add potions or scrolls!</p>
                      )}
                    </div>
                    
                    {/* Add Consumable */}
                    <div className="flex gap-2">
                      <Select onValueChange={(value) => addConsumableMutation.mutate({ characterId: activeCharacter.id, name: value })}>
                        <SelectTrigger className="flex-1" data-testid="select-add-consumable">
                          <SelectValue placeholder="Add a consumable..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Healing Potion">Healing Potion (2d4+2 HP)</SelectItem>
                          <SelectItem value="Greater Healing Potion">Greater Healing Potion (4d4+4 HP)</SelectItem>
                          <SelectItem value="Superior Healing Potion">Superior Healing Potion (8d4+8 HP)</SelectItem>
                          <SelectItem value="Antitoxin">Antitoxin</SelectItem>
                          <SelectItem value="Scroll of Cure Wounds">Scroll of Cure Wounds (1d8+3 HP)</SelectItem>
                          <SelectItem value="Scroll of Lesser Restoration">Scroll of Lesser Restoration</SelectItem>
                          <SelectItem value="Scroll of Revivify">Scroll of Revivify (Resurrects)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Skill Progress Section - Character */}
                {selectedPartyMemberType === "character" && activeCharacter && activeCharacter.skillProgress && Object.keys(activeCharacter.skillProgress as Record<string, any>).length > 0 && (
                  <div className="mt-6 p-4 border rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <Target className="h-5 w-5 text-blue-500" />
                      Skill Progress - {activeCharacter.name}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                      Skills improve through use. Every 5 successful checks = +1 bonus (max +5).
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(activeCharacter.skillProgress as Record<string, { uses: number; bonus: number }>).map(([skill, progress]) => (
                        <div key={skill} className="p-2 border rounded bg-slate-50 dark:bg-slate-700 flex justify-between items-center">
                          <span className="font-medium text-sm">{skill}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-600 dark:text-slate-400">{progress.uses} uses</span>
                            {progress.bonus > 0 && (
                              <span className="text-xs font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                                +{progress.bonus}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* NPC Inventory Management Section */}
                {selectedPartyMemberType === "npc" && selectedNpc && (
                  <div className="mt-6 p-4 border rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <Backpack className="h-5 w-5 text-amber-600" />
                      Inventory & Equipment - {selectedNpc.name}
                    </h3>
                    
                    {/* NPC Stats Display */}
                    <div className="flex gap-4 mb-4">
                      <div className="p-2 border rounded bg-slate-100 dark:bg-slate-700">
                        <div className="text-xs text-slate-600 dark:text-slate-400">HP</div>
                        <div className="text-lg font-bold">
                          <span className={
                            (selectedNpc.hitPoints || 0) <= 0 ? "text-red-500" :
                            (selectedNpc.hitPoints || 0) < (selectedNpc.maxHitPoints || 10) / 2 ? "text-orange-500" : 
                            "text-green-500"
                          }>
                            {selectedNpc.hitPoints || 0}
                          </span>
                          <span className="text-slate-600 dark:text-slate-400">/{selectedNpc.maxHitPoints || 10}</span>
                        </div>
                      </div>
                      <div className="p-2 border rounded bg-slate-100 dark:bg-slate-700">
                        <div className="text-xs text-slate-600 dark:text-slate-400">AC</div>
                        <div className="text-lg font-bold">{selectedNpc.armorClass || 10}</div>
                      </div>
                      <div className="p-2 border rounded bg-slate-100 dark:bg-slate-700">
                        <div className="text-xs text-slate-600 dark:text-slate-400">Level</div>
                        <div className="text-lg font-bold">{selectedNpc.level || 1}</div>
                      </div>
                    </div>
                    
                    {/* NPC Equipment Slots */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-3 border rounded bg-slate-100 dark:bg-slate-700">
                        <div className="text-xs text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                          <Sword className="h-3 w-3" /> Weapon
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {selectedNpc.equippedWeapon || "None"}
                          </span>
                          {selectedNpc.equippedWeapon && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={() => unequipNpcItemMutation.mutate({ npcId: selectedNpc.id, slot: "weapon" })}
                              disabled={unequipNpcItemMutation.isPending}
                              data-testid="button-npc-unequip-weapon"
                            >
                              Unequip
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="p-3 border rounded bg-slate-100 dark:bg-slate-700">
                        <div className="text-xs text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                          <Shield className="h-3 w-3" /> Armor
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {selectedNpc.equippedArmor || "None"}
                          </span>
                          {selectedNpc.equippedArmor && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={() => unequipNpcItemMutation.mutate({ npcId: selectedNpc.id, slot: "armor" })}
                              disabled={unequipNpcItemMutation.isPending}
                              data-testid="button-npc-unequip-armor"
                            >
                              Unequip
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="p-3 border rounded bg-slate-100 dark:bg-slate-700">
                        <div className="text-xs text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                          <Shield className="h-3 w-3" /> Shield
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {selectedNpc.equippedShield || "None"}
                          </span>
                          {selectedNpc.equippedShield && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={() => unequipNpcItemMutation.mutate({ npcId: selectedNpc.id, slot: "shield" })}
                              disabled={unequipNpcItemMutation.isPending}
                              data-testid="button-npc-unequip-shield"
                            >
                              Unequip
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="p-3 border rounded bg-slate-100 dark:bg-slate-700">
                        <div className="text-xs text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> Accessory
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {selectedNpc.equippedAccessory || "None"}
                          </span>
                          {selectedNpc.equippedAccessory && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={() => unequipNpcItemMutation.mutate({ npcId: selectedNpc.id, slot: "accessory" })}
                              disabled={unequipNpcItemMutation.isPending}
                              data-testid="button-npc-unequip-accessory"
                            >
                              Unequip
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* NPC Inventory Items */}
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Items ({selectedNpc.equipment?.length || 0})</div>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {selectedNpc.equipment && selectedNpc.equipment.length > 0 ? (
                          selectedNpc.equipment.map((item: string, index: number) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700 rounded text-sm" data-testid={`npc-item-${index}`}>
                              <span className="flex-1">{item}</span>
                              <div className="flex items-center gap-1">
                                <Select 
                                  value=""
                                  onValueChange={(slot) => {
                                    if (slot) {
                                      equipNpcItemMutation.mutate({ npcId: selectedNpc.id, item, slot });
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-6 w-16 text-xs" data-testid={`npc-select-equip-${index}`}>
                                    <SelectValue placeholder="Equip" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="weapon">Weapon</SelectItem>
                                    <SelectItem value="armor">Armor</SelectItem>
                                    <SelectItem value="shield">Shield</SelectItem>
                                    <SelectItem value="accessory">Accessory</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                  onClick={() => removeNpcItemMutation.mutate({ npcId: selectedNpc.id, item })}
                                  disabled={removeNpcItemMutation.isPending}
                                  data-testid={`button-npc-remove-item-${index}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-600 dark:text-slate-400 py-2">No items in inventory</p>
                        )}
                      </div>

                      {/* Add Item to NPC */}
                      <div className="flex gap-2 mt-3">
                        <Input
                          placeholder="Add new item..."
                          value={newItemName}
                          onChange={(e) => setNewItemName(e.target.value)}
                          className="flex-1"
                          data-testid="input-npc-new-item"
                        />
                        <Button
                          onClick={() => {
                            if (newItemName.trim()) {
                              addNpcItemMutation.mutate({ 
                                npcId: selectedNpc.id, 
                                item: newItemName.trim() 
                              });
                            }
                          }}
                          disabled={!newItemName.trim() || addNpcItemMutation.isPending}
                          size="sm"
                          data-testid="button-npc-add-item"
                        >
                          {addNpcItemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* NPC Gold Management */}
                {selectedPartyMemberType === "npc" && selectedNpc && (
                  <div className="mt-6 p-4 border rounded-lg bg-white dark:bg-slate-800">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Coins className="h-5 w-5 text-yellow-500" />
                      Gold - {selectedNpc.name}
                    </h3>
                    <div className="p-2 border rounded bg-gradient-to-b from-yellow-100 to-yellow-200 dark:from-yellow-900/50 dark:to-yellow-800/50 text-center mb-3">
                      <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{selectedNpc.gold || 0} GP</div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => updateNpcGoldMutation.mutate({ npcId: selectedNpc.id, amount: 10, operation: 'add' })}
                        disabled={updateNpcGoldMutation.isPending}
                        data-testid="button-npc-add-gold"
                      >
                        {updateNpcGoldMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "+10 GP"}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => updateNpcGoldMutation.mutate({ npcId: selectedNpc.id, amount: 5, operation: 'subtract' })}
                        disabled={updateNpcGoldMutation.isPending || (selectedNpc.gold || 0) < 5}
                        data-testid="button-npc-spend-gold"
                      >
                        {updateNpcGoldMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "-5 GP"}
                      </Button>
                    </div>
                  </div>
                )}
                
                {isTurnBased && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-2">Turn Management</h3>
                    <TurnManager 
                      campaignId={campaign.id}
                      isTurnBased={campaign.isTurnBased || false}
                      isDM={isDM}
                      onToggleTurnBased={(enabled) => {
                        updateCampaignMutation.mutate({ isTurnBased: enabled });
                      }}
                    />
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="settings" className="p-4">
              <div className="space-y-4">
                <h2 className="text-xl font-bold font-fantasy text-slate-900 dark:text-slate-100">Campaign Settings</h2>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Narrative Style</label>
                    <Select value={narrativeStyle} onValueChange={setNarrativeStyle}>
                      <SelectTrigger className="w-[220px] bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600">
                        <SelectValue placeholder="Narrative style" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800">
                        <SelectItem value="Descriptive">Descriptive</SelectItem>
                        <SelectItem value="Dramatic">Dramatic</SelectItem>
                        <SelectItem value="Conversational">Conversational</SelectItem>
                        <SelectItem value="Humorous">Humorous</SelectItem>
                        <SelectItem value="Dark">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Difficulty</label>
                    <Select value={difficulty} onValueChange={setDifficulty}>
                      <SelectTrigger className="w-[260px] bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600">
                        <SelectValue placeholder="Difficulty" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800">
                        <SelectItem value="Easy - Beginner Friendly">Easy - Beginner Friendly</SelectItem>
                        <SelectItem value="Normal - Balanced Challenge">Normal - Balanced Challenge</SelectItem>
                        <SelectItem value="Hard - Deadly Encounters">Hard - Deadly Encounters</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* World Map Location */}
                  <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border-2 border-slate-300 dark:border-slate-600 mt-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      <h3 className="font-bold text-slate-900 dark:text-slate-100">World Map Location</h3>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                      Link this adventure to a location on the world map so other players can see it.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Region</label>
                        <Select 
                          value={worldRegionId?.toString() || "none"} 
                          onValueChange={(value) => {
                            const numValue = value && value !== "none" ? parseInt(value) : null;
                            setWorldRegionId(numValue);
                            // Clear location when region changes
                            if (!numValue) setWorldLocationId(null);
                          }}
                        >
                          <SelectTrigger className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600">
                            <SelectValue placeholder="Select a region" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-800">
                            <SelectItem value="none">No specific region</SelectItem>
                            {worldRegions.map(region => (
                              <SelectItem key={region.id} value={region.id.toString()}>
                                {region.name} (Lvl {region.levelRange})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Location</label>
                        <Select 
                          value={worldLocationId?.toString() || "none"} 
                          onValueChange={(value) => {
                            setWorldLocationId(value && value !== "none" ? parseInt(value) : null);
                          }}
                          disabled={filteredWorldLocations.length === 0}
                        >
                          <SelectTrigger className="bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600">
                            <SelectValue placeholder="Select a location" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-800">
                            <SelectItem value="none">No specific location</SelectItem>
                            {filteredWorldLocations.map(location => (
                              <SelectItem key={location.id} value={location.id.toString()}>
                                {location.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {(worldRegionId || worldLocationId) && (
                      <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                        This adventure will appear on the world map!
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-end mt-4">
                    <Button 
                      onClick={handleSaveSettings}
                      disabled={!settingsChanged || updateCampaignMutation.isPending}
                    >
                      {updateCampaignMutation.isPending ? (
                        <span className="flex items-center">
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <Save className="h-4 w-4 mr-2" />
                          Save Settings
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="deploy" className="p-4">
              <CampaignDeploymentTab campaign={campaign} isCreator={isDM} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Progression Rewards Dialog */}
      {progressionRewards && progressionRewards.itemsFound && progressionRewards.itemsFound.length > 0 && (
        <Dialog open={true} onOpenChange={() => setProgressionRewards(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Items Found!</DialogTitle>
              <DialogDescription>
                You discovered some items during your adventure!
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3">
              {progressionRewards.itemsFound.map((item: any, index: number) => (
                <div key={index} className="p-3 border rounded-lg bg-slate-100 dark:bg-slate-700">
                  <div className="font-semibold text-primary">{item.name}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                    {item.type} • {item.rarity}
                  </div>
                  <div className="text-sm">{item.description}</div>
                  {item.properties && (
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {item.properties}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setProgressionRewards(null)}>
                Continue Adventure
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default CampaignPanel;