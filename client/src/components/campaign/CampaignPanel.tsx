import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Campaign, CampaignSession, Character, Npc, WorldRegion, WorldLocation } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { generateStory, StoryRequest } from "@/lib/openai";
import { DiceType, DiceRoll, DiceRollResult, rollDice, clientRollDice, parseAndRollDice, rollSpellAttack, SpellDamageResult, SpellAttackResult } from "@/lib/dice";
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
import { Search, Sparkle, ArrowRight, Settings, Save, Map, MapPin, Clock, ChevronDown, ChevronUp, Dices, Users, Share2, Loader2, Scroll, Moon, Sun, Backpack, Sword, Shield, Heart, Plus, Trash2, Target, Coins, FlaskConical, Sparkles, User, MessageCircle, Send, Download, FileText, FileJson, BookOpen, LayoutDashboard, Coffee, Star, Camera, Check } from "lucide-react";
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
import { SiDiscord } from "react-icons/si";
import CampaignParticipants from "./CampaignParticipants";
import TurnManager from "./TurnManager";
import CampaignDeploymentTab from "./CampaignDeploymentTab";
import CampaignDashboard from "./CampaignDashboard";
import TableChat from "@/components/dm-toolkit/TableChat";
import CombatSpellPanel from "@/components/combat/CombatSpellPanel";
import { LearningTip, useLearningTips } from "@/components/learning/LearningTip";
import type { DungeonMapData, MapEntity } from "../dungeon/DungeonMap";
import { generateDungeon } from "../dungeon/DungeonGenerator";

interface CampaignPanelProps {
  campaign: Campaign;
}

function CampaignPanel({ campaign }: CampaignPanelProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentTip, showTip, hideTip } = useLearningTips();
  
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
  
  // Stock companions available to add - fetch on demand when dialog is opened
  const [stockCompanionsEnabled, setStockCompanionsEnabled] = useState(false);
  const { data: stockCompanions = [], isLoading: stockCompanionsLoading } = useQuery<any[]>({
    queryKey: ['/api/npcs/stock-companions'],
    enabled: stockCompanionsEnabled,
  });
  
  // We use a ref to track previous location to detect changes
  const prevLocationRef = useRef<string | null>(null);
  
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

  // DM Session state for group voting
  const { data: dmSessionState } = useQuery<{
    activeGroupChoices?: any[];
    groupChoiceVotes?: any[];
    groupChoiceStatus?: string;
    groupChoiceResolution?: any;
  }>({
    queryKey: [`/api/campaigns/${campaign.id}/dm-session-state`],
    refetchInterval: 3000,
  });

  // Mutation for voting on group choices
  const voteGroupChoiceMutation = useMutation({
    mutationFn: async ({ choiceId, characterId, characterName }: { choiceId: string; characterId?: number; characterName?: string }) => {
      const response = await apiRequest('POST', `/api/campaigns/${campaign.id}/group-choices/vote`, {
        choiceId,
        characterId,
        characterName
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/dm-session-state`] });
      toast({
        title: "Vote Cast",
        description: "Your choice has been recorded"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Vote",
        description: error.message,
        variant: "destructive"
      });
    }
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
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/dungeon-map`, { location: dungeonMapLocation || '' }] });
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
  
  // Campaign completion state
  const [campaignComplete, setCampaignComplete] = useState(false);
  const [completionRewards, setCompletionRewards] = useState<{
    xp: number;
    gold: number;
    items: { name: string; type: string; description: string; rarity: string; properties: string }[];
  } | null>(null);
  
  // Combat log state for D&D mechanics transparency
  const [detailedCombatLogs, setDetailedCombatLogs] = useState<{
    attacker: string;
    attackerType: string;
    target: string;
    targetType: string;
    attackRoll: { roll: number; modifier: number; total: number; isCritical: boolean; isCriticalMiss: boolean };
    targetAC: number;
    isHit: boolean;
    damage?: { diceRolls: number[]; diceType: string; modifier: number; total: number; isCritical: boolean } | null;
    targetNewHp?: number;
    targetMaxHp?: number;
    targetStatus?: string;
    description: string;
    mechanicsBreakdown: string;
  }[]>([]);
  const [showCombatLogDialog, setShowCombatLogDialog] = useState(false);
  const [selectedTargetIndex, setSelectedTargetIndex] = useState(0); // Combat target selection
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
  const [tableChatCollapsed, setTableChatCollapsed] = useState(true);
  const [isMyTurn, setIsMyTurn] = useState(true);
  const [currentTurnName, setCurrentTurnName] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [selectedPartyMemberType, setSelectedPartyMemberType] = useState<"character" | "npc">("character");
  const [selectedNpcId, setSelectedNpcId] = useState<number | null>(null);
  const [giveGoldAmount, setGiveGoldAmount] = useState<string>("");
  const [managedCharacterId, setManagedCharacterId] = useState<number | null>(null);
  const [dungeonMapData, setDungeonMapData] = useState<DungeonMapData | null>(null);
  const [dungeonMapId, setDungeonMapId] = useState<number | null>(null);
  const [dungeonMapLocation, setDungeonMapLocation] = useState<string | null>(null);
  const [isGeneratingMap, setIsGeneratingMap] = useState(false);
  const [isMapCollapsed, setIsMapCollapsed] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [chapterProgress, setChapterProgress] = useState<{
    combat: { done: number; required: number; complete: boolean };
    traps: { done: number; required: number; complete: boolean };
    treasure: { done: number; required: number; complete: boolean };
    puzzles: { done: number; required: number; complete: boolean };
    discoveries: { done: number; required: number; complete: boolean };
    totalPercent: number;
    totalDone: number;
    totalRequired: number;
  } | null>(null);
  const [monsterImages, setMonsterImages] = useState<Record<string, string>>({});
  const [generatingMonsterImage, setGeneratingMonsterImage] = useState<string | null>(null);
  const [isDownloadingTrace, setIsDownloadingTrace] = useState(false);
  const [activeTab, setActiveTab] = useState("narrative");
  
  // Chat state for cooperative play
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showAddCompanionDialog, setShowAddCompanionDialog] = useState(false);
  const [selectedStockCompanionId, setSelectedStockCompanionId] = useState<number | null>(null);
  
  // Fetch chat messages for this campaign
  const { data: fetchedChatMessages = [], refetch: refetchChat } = useQuery<any[]>({
    queryKey: [`/api/chat/messages/campaign-${campaign.id}`],
    enabled: !!campaign.id,
    refetchInterval: 10000, // Refresh every 10 seconds as fallback
  });
  
  // Sync fetched messages to state
  useEffect(() => {
    if (fetchedChatMessages.length > 0) {
      setChatMessages(fetchedChatMessages);
    }
  }, [fetchedChatMessages]);
  
  // Subscribe to campaign-specific events via shared WebSocket connection
  useEffect(() => {
    // Handle chat message events
    const handleChatMessage = (event: CustomEvent) => {
      const data = event.detail;
      if (data.campaignId === campaign.id) {
        setChatMessages(prev => {
          if (prev.some(m => m.id === data.id)) return prev;
          return [...prev, data];
        });
      }
    };
    
    // Handle typing indicator events
    const handleTypingIndicator = (event: CustomEvent) => {
      const data = event.detail;
      if (data.campaignId === campaign.id) {
        if (data.isTyping) {
          setTypingUsers(prev => prev.includes(data.username) ? prev : [...prev, data.username]);
        } else {
          setTypingUsers(prev => prev.filter(u => u !== data.username));
        }
      }
    };
    
    // Handle player action events
    const handlePlayerAction = (event: CustomEvent) => {
      const data = event.detail;
      if (data.campaignId === campaign.id && data.userId !== user?.id) {
        toast({
          title: `${data.username} made a choice`,
          description: data.action,
          duration: 3000,
        });
      }
    };
    
    // Handle story advanced events
    const handleStoryAdvanced = (event: CustomEvent) => {
      const data = event.detail;
      if (data.campaignId === campaign.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/sessions`] });
      }
    };
    
    // Add event listeners
    window.addEventListener('chat_message' as any, handleChatMessage);
    window.addEventListener('typing_indicator' as any, handleTypingIndicator);
    window.addEventListener('player_action' as any, handlePlayerAction);
    window.addEventListener('story_advanced' as any, handleStoryAdvanced);
    
    return () => {
      window.removeEventListener('chat_message' as any, handleChatMessage);
      window.removeEventListener('typing_indicator' as any, handleTypingIndicator);
      window.removeEventListener('player_action' as any, handlePlayerAction);
      window.removeEventListener('story_advanced' as any, handleStoryAdvanced);
    };
  }, [campaign.id, user?.id, toast]);
  
  // Send chat message - accepts optional message parameter for quick actions
  const sendChatMessage = async (directMessage?: string) => {
    const messageToSend = directMessage || chatInput.trim();
    if (!messageToSend || !user) return;
    
    setIsSendingChat(true);
    try {
      await apiRequest('POST', '/api/chat/messages', {
        userId: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        message: messageToSend,
        messageType: 'text',
        channelType: 'campaign',
        campaignId: campaign.id,
      });
      if (!directMessage) {
        setChatInput("");
      }
      refetchChat();
    } catch (error) {
      console.error('Failed to send chat message:', error);
      toast({
        title: "Failed to send message",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSendingChat(false);
    }
  };
  
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
  
  // Find ALL of the user's participant records in this campaign (may have multiple characters)
  const myParticipants = useMemo(() => {
    if (!participants || !user) return [];
    return participants.filter((p: any) => p.userId === user.id);
  }, [participants, user]);
  
  // Legacy single participant for backward compatibility
  const userParticipant = useMemo(() => {
    return myParticipants.length > 0 ? myParticipants[0] : null;
  }, [myParticipants]);
  
  // Initialize managedCharacterId when participants load
  useEffect(() => {
    if (myParticipants.length > 0 && !managedCharacterId) {
      setManagedCharacterId(myParticipants[0].characterId);
    }
  }, [myParticipants, managedCharacterId]);

  // Get the active character for the current user (from selected managed character)
  const activeCharacter = useMemo(() => {
    // If user has multiple characters, use the selected one
    if (myParticipants.length > 0) {
      const selectedParticipant = myParticipants.find((p: any) => p.characterId === managedCharacterId);
      if (selectedParticipant?.character) {
        return selectedParticipant.character;
      }
      // Default to first participant's character
      if (myParticipants[0]?.character) {
        return myParticipants[0].character;
      }
    }
    // Fallback to user's first character (for DMs who may not be participants)
    if (userCharacters && userCharacters.length > 0) {
      return userCharacters[0];
    }
    return null;
  }, [myParticipants, managedCharacterId, userCharacters]);
  
  // Get the selected NPC for management
  // Merge base NPC data with campaign-specific data (consumables, inventory, status, HP)
  const selectedNpc = useMemo(() => {
    if (!selectedNpcId || !campaignNpcs) return null;
    const campaignNpc = campaignNpcs.find((cn: any) => cn.npcId === selectedNpcId);
    if (!campaignNpc?.npc) return null;
    // Return merged object: base NPC + campaign-specific overrides (consumables, HP, status, inventory, gold)
    return {
      ...campaignNpc.npc,
      consumables: campaignNpc.consumables || [],
      inventory: campaignNpc.inventory || [],
      hitPoints: campaignNpc.currentHp ?? campaignNpc.npc.hitPoints,
      maxHitPoints: campaignNpc.maxHp ?? campaignNpc.npc.maxHitPoints,
      status: campaignNpc.status ?? campaignNpc.npc.status,
      gold: campaignNpc.gold ?? 0,
    };
  }, [selectedNpcId, campaignNpcs]);
  
  // Fetch magical inventory from character_inventory table
  const { data: magicalInventory = [] } = useQuery<any[]>({
    queryKey: ['/api/characters', activeCharacter?.id, 'magical-inventory'],
    queryFn: async () => {
      if (!activeCharacter?.id) return [];
      const response = await fetch(`/api/characters/${activeCharacter.id}/magical-inventory`, { credentials: 'include' });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!activeCharacter?.id
  });
  
  // Helper to parse equipment item from string (may be JSON or plain string)
  const parseEquipmentItem = (item: string): { name: string; type?: string; damage?: string; armor?: number; rarity?: string; description?: string } => {
    if (!item) return { name: 'Unknown' };
    try {
      const parsed = JSON.parse(item);
      return parsed;
    } catch {
      return { name: item };
    }
  };
  
  // Helper to get equipment name (handles both JSON and plain string)
  const getEquipmentName = (item: string | null | undefined): string => {
    if (!item) return 'None';
    try {
      const parsed = JSON.parse(item);
      return parsed.name || item;
    } catch {
      return item;
    }
  };
  
  // Collect all item names from active character's inventory and equipped slots
  const allItemNames = useMemo(() => {
    if (!activeCharacter) return [];
    const items: string[] = [];
    if (activeCharacter.equipment) {
      // Parse each item to get its name
      activeCharacter.equipment.forEach((item: string) => {
        const parsed = parseEquipmentItem(item);
        items.push(parsed.name);
      });
    }
    if ((activeCharacter as any).equippedWeapon) items.push((activeCharacter as any).equippedWeapon);
    if ((activeCharacter as any).equippedArmor) items.push((activeCharacter as any).equippedArmor);
    if ((activeCharacter as any).equippedShield) items.push((activeCharacter as any).equippedShield);
    if ((activeCharacter as any).equippedAccessory) items.push((activeCharacter as any).equippedAccessory);
    return Array.from(new Set(items.filter(Boolean)));
  }, [activeCharacter]);
  
  // Fetch item stats for display
  const { data: itemStatsMap = {} } = useQuery<Record<string, any>>({
    queryKey: ['/api/items/lookup', allItemNames],
    queryFn: async () => {
      if (allItemNames.length === 0) return {};
      const response = await apiRequest('POST', '/api/items/lookup', { names: allItemNames });
      return response.json();
    },
    enabled: allItemNames.length > 0,
    staleTime: 60000, // Cache for 1 minute
  });
  
  // Helper function to format item stats for display
  const formatItemStats = (itemName: string) => {
    const stats = itemStatsMap[itemName];
    if (!stats) return null;
    
    const parts: string[] = [];
    
    // Weapon stats
    if (stats.damageDice) {
      const damage = stats.magicBonus ? `${stats.damageDice}+${stats.magicBonus}` : stats.damageDice;
      parts.push(`${damage} ${stats.damageType || ''}`);
    }
    if (stats.attackBonus) parts.push(`+${stats.attackBonus} attack`);
    
    // Armor stats
    if (stats.baseAC) {
      const ac = stats.magicBonus ? `AC ${stats.baseAC}+${stats.magicBonus}` : `AC ${stats.baseAC}`;
      parts.push(ac);
    }
    
    // Magic bonus for non-weapons/armor
    if (stats.magicBonus && !stats.damageDice && !stats.baseAC) {
      parts.push(`+${stats.magicBonus}`);
    }
    
    return parts.length > 0 ? parts.join(' • ') : null;
  };
  
  // Helper to get rarity color
  const getRarityColor = (rarity: string | null) => {
    switch (rarity?.toLowerCase()) {
      case 'common': return 'text-slate-500';
      case 'uncommon': return 'text-green-500';
      case 'rare': return 'text-blue-500';
      case 'very_rare': return 'text-purple-500';
      case 'legendary': return 'text-orange-500';
      default: return 'text-slate-400';
    }
  };
  
  // Get all party NPCs for the dropdown - merge campaign-specific HP/status with base NPC data
  const partyNpcs = useMemo(() => {
    if (!campaignNpcs) return [];
    return campaignNpcs
      .filter((cn: any) => cn.role === 'companion' || cn.role === 'ally')
      .map((cn: any) => ({
        ...cn.npc,
        // Use campaign-specific HP/status if available, fallback to base NPC values
        hitPoints: cn.currentHp ?? cn.npc?.hitPoints ?? cn.npc?.hit_points,
        maxHitPoints: cn.maxHp ?? cn.npc?.maxHitPoints ?? cn.npc?.max_hit_points,
        status: cn.status || 'conscious',
        gold: cn.gold || 0,
        inventory: cn.inventory || [],
        consumables: cn.consumables || [],
        // Keep campaign NPC id for updates
        campaignNpcId: cn.id
      }));
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
  
  // Track combat state changes and show learning tip when combat starts
  const prevInCombat = useRef(false);
  useEffect(() => {
    const inCombat = parsedStoryState?.inCombat || false;
    if (inCombat && !prevInCombat.current) {
      // Combat just started - show combat learning tip (40% chance)
      if (Math.random() < 0.4) {
        setTimeout(() => showTip('combat'), 2000);
      }
    }
    prevInCombat.current = inCombat;
  }, [parsedStoryState?.inCombat, showTip]);
  
  // Reset target selection when enemies change (defeated, new combat, etc.)
  const prevEnemyCount = useRef(0);
  useEffect(() => {
    const enemies = ((parsedStoryState?.combatants as any[]) || []).filter(
      (c: any) => (c.type === 'enemy' || c.type === 'boss') && c.status !== 'defeated' && (c.currentHp > 0 || c.currentHp === undefined)
    );
    const enemyCount = enemies.length;
    
    // Reset to first enemy if count decreased (enemy was defeated) or combat reset
    if (enemyCount < prevEnemyCount.current || enemyCount === 0) {
      setSelectedTargetIndex(0);
    }
    // Also reset if selected index is now out of bounds
    if (selectedTargetIndex >= enemyCount && enemyCount > 0) {
      setSelectedTargetIndex(0);
    }
    prevEnemyCount.current = enemyCount;
  }, [parsedStoryState?.combatants, selectedTargetIndex]);
  
  // Get current location from story state
  const currentLocation = useMemo(() => {
    if (parsedStoryState?.currentLocation) {
      const loc = parsedStoryState.currentLocation;
      return typeof loc === 'string' ? loc : (loc as any)?.name || 'Unknown Location';
    }
    if (currentSession?.location) {
      return currentSession.location;
    }
    return campaign.title || 'Adventure';
  }, [parsedStoryState?.currentLocation, currentSession?.location, campaign.title]);
  
  // Detect environment type from location name for map theming
  const mapEnvironment = useMemo(() => {
    const locationLower = (currentLocation || '').toLowerCase();
    const narrativeLower = (parsedStoryState?.currentNarrative || '').toLowerCase();
    const combined = locationLower + ' ' + narrativeLower;
    
    if (/forest|wood|grove|glade|thicket|jungle|wilder/.test(combined)) {
      return { 
        type: 'Forest', floor: '#2d5016', corridor: '#3d6b1e', wall: '#1a3409', door: '#8b6914', stairs: '#4a7c23', accent: 'emerald',
        labels: { floor: 'Clearing', corridor: 'Path', door: 'Passage', stairs: 'Trail' }
      };
    }
    if (/cave|cavern|underground|depth|grotto|mine|tunnel/.test(combined)) {
      return { 
        type: 'Cave', floor: '#4a4a4a', corridor: '#5a5a5a', wall: '#1f1f1f', door: '#6b5b3b', stairs: '#7c6aed', accent: 'slate',
        labels: { floor: 'Cavern', corridor: 'Tunnel', door: 'Opening', stairs: 'Descent' }
      };
    }
    if (/castle|fortress|citadel|keep|tower|palace|manor/.test(combined)) {
      return { 
        type: 'Castle', floor: '#4a4a5a', corridor: '#5a5a6a', wall: '#2a2a3a', door: '#8b7355', stairs: '#9c8afd', accent: 'violet',
        labels: { floor: 'Stone', corridor: 'Hall', door: 'Door', stairs: 'Stairs' }
      };
    }
    if (/crypt|tomb|necro|undead|grave|catacomb|mausoleum/.test(combined)) {
      return { 
        type: 'Crypt', floor: '#3a3a4a', corridor: '#4a4a5a', wall: '#1a1a2a', door: '#5b5b6b', stairs: '#8c7acd', accent: 'purple',
        labels: { floor: 'Tomb', corridor: 'Passage', door: 'Archway', stairs: 'Descent' }
      };
    }
    if (/temple|shrine|sanctuary|chapel|altar|holy/.test(combined)) {
      return { 
        type: 'Temple', floor: '#5a5a6a', corridor: '#6a6a7a', wall: '#3a3a4a', door: '#c4a84b', stairs: '#9c9afd', accent: 'amber',
        labels: { floor: 'Chamber', corridor: 'Aisle', door: 'Portal', stairs: 'Ascent' }
      };
    }
    if (/swamp|marsh|bog|fen|mire|wetland/.test(combined)) {
      return { 
        type: 'Swamp', floor: '#3d4a2d', corridor: '#4a5a3a', wall: '#1a2a1a', door: '#6b6b4b', stairs: '#5c8a5d', accent: 'lime',
        labels: { floor: 'Dry Land', corridor: 'Path', door: 'Crossing', stairs: 'Rise' }
      };
    }
    if (/desert|sand|dune|oasis|arid|wasteland/.test(combined)) {
      return { 
        type: 'Desert', floor: '#8b7355', corridor: '#9c8466', wall: '#5a4a3a', door: '#c4a84b', stairs: '#d4b85b', accent: 'orange',
        labels: { floor: 'Sand', corridor: 'Trail', door: 'Oasis', stairs: 'Dune' }
      };
    }
    if (/ice|frost|frozen|glacier|snow|arctic|tundra/.test(combined)) {
      return { 
        type: 'Ice', floor: '#6a8a9a', corridor: '#7a9aaa', wall: '#3a5a6a', door: '#8a9aaa', stairs: '#9abacc', accent: 'cyan',
        labels: { floor: 'Ice', corridor: 'Path', door: 'Gap', stairs: 'Slope' }
      };
    }
    if (/volcano|lava|fire|inferno|magma|burn/.test(combined)) {
      return { 
        type: 'Volcano', floor: '#5a2a1a', corridor: '#6a3a2a', wall: '#2a1a0a', door: '#8b3b1b', stairs: '#cc4a2a', accent: 'red',
        labels: { floor: 'Rock', corridor: 'Path', door: 'Vent', stairs: 'Ledge' }
      };
    }
    if (/sewer|drain|undercity|beneath|pipe/.test(combined)) {
      return { 
        type: 'Sewer', floor: '#3a4a3a', corridor: '#4a5a4a', wall: '#1a2a1a', door: '#5b6b5b', stairs: '#6c7c6c', accent: 'stone',
        labels: { floor: 'Ground', corridor: 'Tunnel', door: 'Grate', stairs: 'Ladder' }
      };
    }
    // Default dungeon theme
    return { 
      type: 'Dungeon', floor: '#78350f', corridor: '#92400e', wall: '#0f172a', door: '#d97706', stairs: '#7c3aed', accent: 'amber',
      labels: { floor: 'Floor', corridor: 'Corridor', door: 'Door', stairs: 'Stairs' }
    };
  }, [currentLocation, parsedStoryState?.currentNarrative]);
  
  // Map location key includes session number so each chapter/level gets its own map
  const mapLocationKey = useMemo(() => {
    const sessionNum = currentSession?.sessionNumber || campaign.currentSession || 1;
    return `${currentLocation} - Level ${sessionNum}`;
  }, [currentLocation, currentSession?.sessionNumber, campaign.currentSession]);
  
  // Campaign dungeon map (persistent) - fetched by location AND level
  // Track if map definitely doesn't exist (404) vs just not loaded yet
  const [mapNotFound, setMapNotFound] = useState(false);
  
  const { data: persistedDungeonMap, isLoading: dungeonMapLoading, isError: dungeonMapError } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaign.id}/dungeon-map`, { location: mapLocationKey }],
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaign.id}/dungeon-map?location=${encodeURIComponent(mapLocationKey)}`, {
        credentials: 'include',
      });
      if (response.status === 404) {
        setMapNotFound(true);
        return null; // No map for this location/level
      }
      if (!response.ok) {
        throw new Error('Failed to fetch dungeon map');
      }
      setMapNotFound(false);
      return response.json();
    },
    enabled: !!campaign.id && !!mapLocationKey,
    retry: false,
  });
  
  // Reset mapNotFound when location/level changes
  useEffect(() => {
    setMapNotFound(false);
  }, [mapLocationKey]);
  
  // Load persisted dungeon map from database
  useEffect(() => {
    if (persistedDungeonMap && persistedDungeonMap.mapData) {
      // Store the map ID for later PATCH requests
      if (persistedDungeonMap.id && persistedDungeonMap.id !== dungeonMapId) {
        setDungeonMapId(persistedDungeonMap.id);
      }
      // Track the location this map was generated for
      if (persistedDungeonMap.mapName && persistedDungeonMap.mapName !== dungeonMapLocation) {
        setDungeonMapLocation(persistedDungeonMap.mapName);
      }
      // Set map data
      setDungeonMapData({
        ...persistedDungeonMap.mapData,
        playerPosition: persistedDungeonMap.playerPosition || { x: 0, y: 0 },
      });
    }
  }, [persistedDungeonMap, dungeonMapId, dungeonMapLocation]);
  
  // Check if map matches current location/level
  const mapMatchesLocation = useMemo(() => {
    if (!dungeonMapLocation || !mapLocationKey) return true;
    return dungeonMapLocation.toLowerCase() === mapLocationKey.toLowerCase();
  }, [dungeonMapLocation, mapLocationKey]);
  
  // Clear map state when location/level changes
  useEffect(() => {
    if (prevLocationRef.current && prevLocationRef.current !== mapLocationKey) {
      // Location or level changed - clear current map data
      setDungeonMapData(null);
      setDungeonMapId(null);
      setDungeonMapLocation(null);
    }
    prevLocationRef.current = mapLocationKey;
  }, [mapLocationKey]);
  
  // Function to generate a new map for the current location/level
  const handleGenerateMap = async () => {
    setIsGeneratingMap(true);
    try {
      const newMap = generateDungeon({
        width: 25,
        height: 18,
        maxRooms: 7,
        dungeonName: currentLocation,
        dungeonLevel: currentSession?.sessionNumber || 1,
      });
      
      // Save the new map to the database using mapLocationKey (includes level)
      const response = await apiRequest('POST', `/api/campaigns/${campaign.id}/dungeon-map`, {
        mapName: mapLocationKey,
        mapData: newMap,
        playerPosition: newMap.playerPosition || { x: 0, y: 0 },
        exploredTiles: [],
        entityPositions: [],
      });
      
      const savedMap = await response.json();
      
      setDungeonMapData(newMap);
      setDungeonMapId(savedMap.id);
      setDungeonMapLocation(mapLocationKey);
      
      toast({
        title: "Map Generated",
        description: `Created map for ${mapLocationKey}`,
      });
      
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/dungeon-map`, { location: mapLocationKey }] });
    } catch (error) {
      console.error('Failed to generate map:', error);
      toast({
        title: "Failed to generate map",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingMap(false);
    }
  };
  
  // Auto-generate map when entering a new level with no existing map
  useEffect(() => {
    if (mapNotFound && !dungeonMapLoading && !isGeneratingMap && !dungeonMapData && mapLocationKey) {
      // No map found for this level - auto-generate one
      handleGenerateMap();
    }
  }, [mapNotFound, dungeonMapLoading, isGeneratingMap, dungeonMapData, mapLocationKey]);
  
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
  
  // Download trace log handler
  const handleDownloadTrace = async (format: 'json' | 'yaml') => {
    try {
      setIsDownloadingTrace(true);
      const response = await fetch(`/api/campaigns/${campaign.id}/export/trace?format=${format}`);
      if (!response.ok) {
        throw new Error('Failed to download trace');
      }
      
      const data = await response.text();
      const blob = new Blob([data], { type: format === 'yaml' ? 'text/yaml' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${campaign.title.replace(/\s+/g, '_')}_trace.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Trace Downloaded",
        description: `Your adventure log has been downloaded as ${format.toUpperCase()}.`
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Could not download the trace log. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsDownloadingTrace(false);
    }
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
        rollResult,
        currentLocation
      });
      return await response.json();
    },
    onSuccess: (data) => {
      // Invalidate sessions data to refresh
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/sessions`] });
      
      // Invalidate characters and participants to reflect HP/status changes from combat
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/participants`] });
      
      // If the user is the campaign owner, also update the campaign data
      if (campaign.userId === user?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      }
      
      // Check if data contains progression data
      if (data && data.progression) {
        setProgressionRewards(data.progression);
        
        // === CHECK FOR CAMPAIGN COMPLETION ===
        if (data.progression.campaignComplete && data.progression.completionRewards) {
          setCampaignComplete(true);
          setCompletionRewards(data.progression.completionRewards);
          toast({
            title: "🏆 Campaign Complete!",
            description: "Congratulations! You have completed this adventure!",
          });
        }
        
        // Show quest completion toast first (more exciting!)
        if (data.progression.completedQuests?.length > 0) {
          const questNames = data.progression.completedQuests.map((q: any) => q.title).join(', ');
          toast({
            title: `🏆 Quest Complete!`,
            description: `${questNames} - Earned bonus XP!`,
          });
        }
        
        // Show combat effects with D&D mechanics transparency
        if (data.progression.combatEffects) {
          const combat = data.progression.combatEffects;
          
          // Store detailed combat logs for display (with defensive checks)
          if (combat.detailedCombatLogs && Array.isArray(combat.detailedCombatLogs) && combat.detailedCombatLogs.length > 0) {
            // Filter and validate logs to ensure they have required fields
            const validLogs = combat.detailedCombatLogs.filter((log: any) => 
              log && log.attacker && log.target && log.attackRoll
            );
            if (validLogs.length > 0) {
              setDetailedCombatLogs(validLogs);
              setShowCombatLogDialog(true);
            }
          }
          
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
          
          // Show party damage with D&D mechanics (including companions)
          if (combat.partyDamage && combat.partyDamage.length > 0) {
            for (const damage of combat.partyDamage) {
              // Safely check for mechanicsBreakdown (may not exist)
              const mechanicsText = damage.mechanicsBreakdown 
                ? ` (${damage.mechanicsBreakdown.split('\n')[0]})` 
                : damage.attackRoll 
                ? ` (d20: ${damage.attackRoll.roll} + ${damage.attackRoll.modifier} = ${damage.attackRoll.total} vs AC ${damage.targetAC || '?'})`
                : '';
              toast({
                title: damage.defeated 
                  ? `💀 ${damage.name} was knocked unconscious!`
                  : `⚔️ ${damage.name} took ${damage.damageTaken} damage!`,
                description: `HP: ${damage.newHp}/${damage.maxHp}${mechanicsText}`,
                variant: damage.defeated ? "destructive" : undefined,
              });
            }
          }
          
          // Show companion actions prominently - they fight alongside you!
          if (combat.companionActions && combat.companionActions.length > 0) {
            for (const companion of combat.companionActions) {
              toast({
                title: `⚔️ Companion Attack: ${companion.name}`,
                description: companion.damageDealt 
                  ? `${companion.action} - Dealt ${companion.damageDealt} damage to the enemy!`
                  : companion.action,
              });
            }
          }
          
          // Check if companions were attacked and notify
          if (combat.partyDamage && combat.partyDamage.length > 0) {
            const companionDamage = combat.partyDamage.filter((d: any) => d.isCompanion);
            if (companionDamage.length > 0) {
              for (const damage of companionDamage) {
                toast({
                  title: `🛡️ ${damage.name} was attacked!`,
                  description: `Your companion took ${damage.damageTaken} damage (HP: ${damage.newHp}/${damage.maxHp})`,
                  variant: damage.defeated ? "destructive" : undefined,
                });
              }
            }
          }
          
          // Degrade equipment after combat
          if (userParticipant?.characterId) {
            apiRequest('POST', `/api/characters/${userParticipant.characterId}/degrade-equipment`, {
              actionType: 'combat'
            }).then((res) => res.json()).then((degradeResult) => {
              if (degradeResult.criticalItems?.length > 0) {
                toast({
                  title: "⚠️ Equipment Wear",
                  description: `${degradeResult.criticalItems.join(', ')} need repair soon!`,
                  variant: "destructive"
                });
              }
              if (degradeResult.brokenItems?.length > 0) {
                toast({
                  title: "💔 Equipment Broken!",
                  description: `${degradeResult.brokenItems.join(', ')} need repair at the tavern blacksmith!`,
                  variant: "destructive"
                });
              }
              // Refresh character data to show updated durability
              queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
            }).catch(console.error);
          }
        }
        
        // Refresh companion NPCs after any combat to update HP/status display
        // Check multiple sources of combat activity
        const hasPartyDamage = data.progression.combatEffects?.partyDamage?.length > 0;
        const hasEnemyDamage = data.progression.combatEffects?.enemyDamage?.length > 0;
        const isInCombat = data.storyState?.inCombat;
        if (hasPartyDamage || hasEnemyDamage || isInCombat) {
          queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/npcs`] });
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
        if (data.dungeonMapId) {
          setDungeonMapId(data.dungeonMapId);
        }
        setDungeonMapLocation(mapLocationKey);
        queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/dungeon-map`, { location: mapLocationKey }] });
        
        // Show movement notification if there was movement
        if (data.movement?.occurred) {
          toast({
            title: "Party moved",
            description: data.movement.description || `You moved ${data.movement.direction}.`,
          });
        }
        
        // Show tile narrative info if available (narrative-map integration)
        if (data.tileNarrative) {
          const tn = data.tileNarrative;
          // Show contextual info about what's in this tile
          const contextParts: string[] = [];
          if (tn.npcs?.length) contextParts.push(`NPCs: ${tn.npcs.join(', ')}`);
          if (tn.items?.length) contextParts.push(`Items: ${tn.items.join(', ')}`);
          if (tn.enemies?.length) contextParts.push(`Threats: ${tn.enemies.join(', ')}`);
          
          if (contextParts.length > 0) {
            toast({
              title: tn.shortDescription || "Location Details",
              description: contextParts.join(' | '),
            });
          }
        }
      }
      
      // Handle automatic session advancement with detailed summary
      if (data.sessionAdvanced && data.newSessionNumber) {
        const summary = data.chapterSummary;
        const summaryText = summary 
          ? `Encounters: ${summary.encountersDefeated}, Puzzles: ${summary.puzzlesSolved}, Treasures: ${summary.treasuresFound}, Discoveries: ${summary.discoveriesMade}`
          : "New challenges await!";
        
        toast({
          title: `🎉 Chapter ${data.newSessionNumber - 1} Complete!`,
          description: `${summaryText}. Beginning Chapter ${data.newSessionNumber}...`,
        });
        // Refresh the current session to show the new chapter
        queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/sessions`] });
      }
      
      // Update chapter progress state if available
      if (data.chapterProgress) {
        setChapterProgress(data.chapterProgress);
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

  // Rest mutations for HP recovery (heals entire party including NPC companions)
  const shortRestMutation = useMutation({
    mutationFn: async (characterId: number) => {
      const response = await apiRequest('POST', `/api/characters/${characterId}/short-rest`, { campaignId: campaign.id });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/participants`] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/npcs`] });
      toast({
        title: "Party Short Rest Complete",
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
      const response = await apiRequest('POST', `/api/characters/${characterId}/long-rest`, { campaignId: campaign.id });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/participants`] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/npcs`] });
      toast({
        title: "Party Long Rest Complete",
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

  // Quick-Buy AND Use mutation for healing items - buys and immediately uses
  const quickBuyAndUseMutation = useMutation({
    mutationFn: async ({ characterId, name }: { characterId: number; name: string }) => {
      // First add the consumable
      const addResponse = await apiRequest('POST', `/api/characters/${characterId}/consumables/add`, { name, quantity: 1 });
      const addData = await addResponse.json();
      if (!addResponse.ok) throw new Error(addData.message || "Failed to purchase");
      
      // Then immediately use it
      const useResponse = await apiRequest('POST', `/api/characters/${characterId}/consumables/use`, { name });
      const useData = await useResponse.json();
      if (!useResponse.ok) throw new Error(useData.message || "Failed to use");
      
      return useData;
    },
    onSuccess: (data) => {
      // Update character cache directly with new HP
      if (data.character) {
        queryClient.setQueryData(['/api/characters'], (old: any[] | undefined) => {
          if (!old) return old;
          return old.map(c => c.id === data.character.id ? { ...c, ...data.character } : c);
        });
        // Also update participants cache directly
        queryClient.setQueryData([`/api/campaigns/${campaign.id}/participants`], (old: any[] | undefined) => {
          if (!old) return old;
          return old.map((p: any) => {
            if (p.characterId === data.character.id && p.character) {
              return { ...p, character: { ...p.character, hitPoints: data.character.hitPoints, status: data.character.status, consumables: data.character.consumables, gold: data.character.gold } };
            }
            return p;
          });
        });
      }
      toast({
        title: data.healedAmount > 0 ? `Healed ${data.healedAmount} HP!` : "Item Used",
        description: `Purchased and used immediately. ${data.message}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Quick-Buy Failed",
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
      // Update character cache directly with new HP
      if (data.character) {
        queryClient.setQueryData(['/api/characters'], (old: any[] | undefined) => {
          if (!old) return old;
          return old.map(c => c.id === data.character.id ? { ...c, ...data.character } : c);
        });
        // Also update participants cache directly
        queryClient.setQueryData([`/api/campaigns/${campaign.id}/participants`], (old: any[] | undefined) => {
          if (!old) return old;
          return old.map((p: any) => {
            if (p.characterId === data.character.id && p.character) {
              return { ...p, character: { ...p.character, hitPoints: data.character.hitPoints, status: data.character.status, consumables: data.character.consumables } };
            }
            return p;
          });
        });
      }
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

  // Generate portrait for NPC companion
  const generateNpcPortraitMutation = useMutation({
    mutationFn: async (npcId: number) => {
      const response = await apiRequest('POST', `/api/npcs/${npcId}/generate-portrait`, {});
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/npcs`] });
      toast({
        title: "Portrait Generated",
        description: `Portrait has been generated for ${data.name || 'the companion'}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Generate Portrait",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const useNpcConsumableMutation = useMutation({
    mutationFn: async ({ npcId, name }: { npcId: number; name: string }) => {
      // Use campaign-specific route to access campaign_npcs consumables (not base NPC)
      const response = await apiRequest('POST', `/api/campaigns/${campaign.id}/npcs/${npcId}/consumables/use`, { name });
      return await response.json();
    },
    onSuccess: (data) => {
      // Update campaign NPC cache with updated consumables and HP
      queryClient.setQueryData([`/api/campaigns/${campaign.id}/npcs`], (old: any[] | undefined) => {
        if (!old) return old;
        return old.map((cn: any) => {
          if (cn.npcId === data.npcId) {
            return { 
              ...cn, 
              consumables: data.consumables,
              currentHp: data.currentHp,
              status: data.status,
              npc: { ...cn.npc, hitPoints: data.currentHp, status: data.status }
            };
          }
          return cn;
        });
      });
      // Also update participants cache
      queryClient.setQueryData([`/api/campaigns/${campaign.id}/participants`], (old: any[] | undefined) => {
        if (!old) return old;
        return old.map((p: any) => {
          if (p.isNpc && p.npcId === data.npcId) {
            return { 
              ...p, 
              consumables: data.consumables,
              currentHp: data.currentHp,
              status: data.status,
              npc: { ...p.npc, hitPoints: data.currentHp, status: data.status },
              character: { ...p.character, hitPoints: data.currentHp, status: data.status }
            };
          }
          return p;
        });
      });
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

  // Transfer consumable from character to NPC companion
  const transferConsumableMutation = useMutation({
    mutationFn: async ({ fromCharacterId, toNpcId, consumableName }: { fromCharacterId: number; toNpcId: number; consumableName: string }) => {
      const response = await apiRequest('POST', `/api/campaigns/${campaign.id}/transfer-consumable`, { fromCharacterId, toNpcId, consumableName });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/npcs`] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/participants`] });
      toast({
        title: "Item Given",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Give Item",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Transfer gold from character to NPC companion
  const transferGoldMutation = useMutation({
    mutationFn: async ({ fromCharacterId, toNpcId, amount }: { fromCharacterId: number; toNpcId: number; amount: number }) => {
      const response = await apiRequest('POST', `/api/campaigns/${campaign.id}/transfer-gold`, { fromCharacterId, toNpcId, amount });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/npcs`] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/participants`] });
      toast({
        title: "Gold Transferred",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Transfer Gold",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // NPC Quick-Buy consumable mutation
  const addNpcConsumableMutation = useMutation({
    mutationFn: async ({ npcId, name }: { npcId: number; name: string }) => {
      const response = await apiRequest('POST', `/api/campaigns/${campaign.id}/npcs/${npcId}/consumables/add`, { name, quantity: 1 });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData([`/api/campaigns/${campaign.id}/npcs`], (old: any[] | undefined) => {
        if (!old) return old;
        return old.map((cn: any) => {
          if (cn.npcId === data.npcId) {
            return { 
              ...cn, 
              consumables: data.consumables,
              gold: data.goldRemaining
            };
          }
          return cn;
        });
      });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/participants`] });
      toast({
        title: "Purchased!",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Purchase Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // NPC Quick-Buy AND Use mutation - buys and immediately uses healing items
  const npcQuickBuyAndUseMutation = useMutation({
    mutationFn: async ({ npcId, name }: { npcId: number; name: string }) => {
      // First add the consumable
      const addResponse = await apiRequest('POST', `/api/campaigns/${campaign.id}/npcs/${npcId}/consumables/add`, { name, quantity: 1 });
      const addData = await addResponse.json();
      if (!addResponse.ok) throw new Error(addData.message || "Failed to purchase");
      
      // Then immediately use it
      const useResponse = await apiRequest('POST', `/api/campaigns/${campaign.id}/npcs/${npcId}/consumables/use`, { name });
      const useData = await useResponse.json();
      if (!useResponse.ok) throw new Error(useData.message || "Failed to use");
      
      return { ...useData, goldRemaining: addData.goldRemaining, goldSpent: addData.goldSpent };
    },
    onSuccess: (data) => {
      queryClient.setQueryData([`/api/campaigns/${campaign.id}/npcs`], (old: any[] | undefined) => {
        if (!old) return old;
        return old.map((cn: any) => {
          if (cn.npcId === data.npcId) {
            return { 
              ...cn, 
              consumables: data.consumables,
              currentHp: data.currentHp,
              status: data.status,
              gold: data.goldRemaining
            };
          }
          return cn;
        });
      });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/participants`] });
      toast({
        title: "Quick Heal!",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Quick Heal Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // NPC Rest mutations
  const npcShortRestMutation = useMutation({
    mutationFn: async ({ npcId }: { npcId: number }) => {
      const response = await apiRequest('POST', `/api/campaigns/${campaign.id}/npcs/${npcId}/short-rest`, {});
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/npcs`] });
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

  const npcLongRestMutation = useMutation({
    mutationFn: async ({ npcId }: { npcId: number }) => {
      const response = await apiRequest('POST', `/api/campaigns/${campaign.id}/npcs/${npcId}/long-rest`, {});
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/npcs`] });
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
    mutationFn: async ({ fromCharacterId, toCharacterId, toNpcId, item }: { fromCharacterId: number; toCharacterId?: number; toNpcId?: number; item: string }) => {
      const response = await apiRequest('POST', `/api/campaigns/${campaign.id}/items/transfer`, { fromCharacterId, toCharacterId, toNpcId, item });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/participants`] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/npcs`] });
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
  
  // Add stock companion to campaign
  const addCompanionToCampaignMutation = useMutation({
    mutationFn: async (npcId: number) => {
      const response = await apiRequest('POST', `/api/campaigns/${campaign.id}/npcs`, {
        npcId,
        role: 'companion'
      });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaign.id}/npcs`] });
      toast({
        title: "Companion Added",
        description: `${data.npc?.name || 'Companion'} has joined your party!`,
      });
      setShowAddCompanionDialog(false);
      setSelectedStockCompanionId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Companion",
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
      
      // Calculate the actual modifier from character's stats based on the skill/check type
      // Extract skill name from choice.skillType, choice.rollPurpose, or parse from action text
      const skillName = choice.skillType || 
                       choice.rollPurpose?.toLowerCase().replace(/\s+check/i, '').replace(/\s+save/i, '').trim() || 
                       'strength';
      
      // Use character's actual ability modifier instead of AI-provided rollModifier
      let calculatedModifier = choice.rollModifier || 0;
      if (activeCharacter) {
        const { modifier, breakdown } = getSkillModifier(activeCharacter, skillName);
        calculatedModifier = modifier;
        console.log(`Calculated ${skillName} modifier for ${activeCharacter.name}: ${breakdown}`);
      }
      
      // Set up the dice roll with defaults for any missing values
      setCurrentDiceRoll({
        action: choice.action,
        diceType: diceType,
        rollDC: choice.rollDC || 10, // Default DC if none provided
        rollModifier: calculatedModifier,
        rollPurpose: choice.rollPurpose || "Skill Check",
        successText: choice.successText || "Success!",
        failureText: choice.failureText || "Failure!"
      });
      
      // Log for debugging
      console.log("Setting up dice roll:", {
        action: choice.action,
        diceType: diceType,
        rollDC: choice.rollDC || 10,
        rollModifier: calculatedModifier,
        skillName: skillName,
      });
      
      setShowDiceRollDialog(true);
    } else {
      // Just advance the story with this action - use fallback if action is undefined
      setIsAdvancingStory(true);
      advanceStory.mutate({ choice: choice.action || choice.text || String(choice) }, {
        onSettled: () => {
          setIsAdvancingStory(false);
          // Show learning tip after making a choice (20% chance)
          if (Math.random() < 0.2) {
            setTimeout(() => showTip('choice'), 1000);
          }
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
    advanceStory.mutate({ choice: customChoice.action || customAction.trim() }, {
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
      
      // Clear previous result while rolling (don't set a placeholder with zeros)
      setDiceRollResult(null);
      
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
        
        // HexMetaV2: Mutate hex state on failed checks
        if (!success && dungeonMapData) {
          const updatedMap = (() => {
            const newTiles = [...dungeonMapData.tiles.map(row => [...row.map(tile => ({ ...tile, narrative: tile.narrative ? { ...tile.narrative } : undefined }))])];
            const playerTile = newTiles[dungeonMapData.playerPosition.y]?.[dungeonMapData.playerPosition.x];
            
            if (playerTile?.narrative) {
              // Increase tension on failure (use new tension for state calculation)
              const currentTension = playerTile.narrative.tension || 20;
              const newTension = Math.min(100, currentTension + 15);
              playerTile.narrative = {
                ...playerTile.narrative,
                tension: newTension,
                hexState: newTension >= 70 ? "Active" : newTension >= 40 ? "Stirring" : playerTile.narrative.hexState,
              };
              
              // If new tension is very high, increase adjacent hex tension
              if (newTension >= 80) {
                const adjacentOffsets = [
                  { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
                  { dx: 0, dy: -1 }, { dx: 0, dy: 1 }
                ];
                for (const { dx, dy } of adjacentOffsets) {
                  const ax = dungeonMapData.playerPosition.x + dx;
                  const ay = dungeonMapData.playerPosition.y + dy;
                  const adjTile = newTiles[ay]?.[ax];
                  if (adjTile?.narrative) {
                    const adjTension = adjTile.narrative.tension || 20;
                    if (adjTension < 60) {
                      adjTile.narrative = {
                        ...adjTile.narrative,
                        tension: Math.min(100, adjTension + 10),
                      };
                    }
                  }
                }
              }
            }
            return { ...dungeonMapData, tiles: newTiles };
          })();
          
          setDungeonMapData(updatedMap);
          
          // Persist hex state changes to backend
          if (dungeonMapId && campaign?.id) {
            fetch(`/api/campaigns/${campaign.id}/dungeon-map/${dungeonMapId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ 
                mapData: updatedMap,
                playerPosition: updatedMap.playerPosition 
              }),
            }).catch(err => console.warn('Failed to persist hex tension change:', err));
          }
        }
        
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
            choice: currentDiceRoll.action || 'Take action',
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
              // Show learning tip after dice roll (30% chance to avoid overwhelming)
              if (Math.random() < 0.3) {
                setTimeout(() => showTip('dice_roll'), 1500);
              }
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
                          {(currentDiceRoll?.rollModifier ?? 0) >= 0 ? '+' : ''}{currentDiceRoll?.rollModifier}
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className={`grid w-full ${isDM ? 'grid-cols-7' : 'grid-cols-6'} bg-slate-900 rounded-none border-b-2 border-amber-500 h-12`}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="narrative" className="text-xs sm:text-sm md:text-base text-slate-200 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 data-[state=active]:font-bold data-[state=active]:shadow-lg hover:bg-slate-700 hover:text-white transition-all rounded-none border-r border-slate-700">
                    <span className="flex items-center">
                      <BookOpen className="h-3.5 w-3.5 mr-1 hidden sm:inline-block" />
                      <span>Narrative</span>
                    </span>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium">Your Adventure Story</p>
                  <p className="text-xs text-muted-foreground">Read the unfolding narrative, take actions, and see the story progress. This is where the adventure happens!</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="journey-log" className="text-xs sm:text-sm md:text-base text-slate-200 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 data-[state=active]:font-bold data-[state=active]:shadow-lg hover:bg-slate-700 hover:text-white transition-all rounded-none border-r border-slate-700">
                    <span className="flex items-center">
                      <Scroll className="h-3.5 w-3.5 mr-1 hidden sm:inline-block" />
                      <span>Log</span>
                    </span>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium">Journey Log & History</p>
                  <p className="text-xs text-muted-foreground">Review past events, completed quests, dice rolls, and key moments. Never forget what happened in previous sessions.</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="party" className="text-xs sm:text-sm md:text-base text-slate-200 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 data-[state=active]:font-bold data-[state=active]:shadow-lg hover:bg-slate-700 hover:text-white transition-all rounded-none border-r border-slate-700">
                    <span className="flex items-center">
                      <Users className="h-3.5 w-3.5 mr-1 hidden sm:inline-block" />
                      <span>Party</span>
                    </span>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium">Your Adventuring Party</p>
                  <p className="text-xs text-muted-foreground">View all party members, their stats, HP, and inventory. Manage your group and see who's joined the campaign.</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="chat" className="text-xs sm:text-sm md:text-base text-slate-200 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 data-[state=active]:font-bold data-[state=active]:shadow-lg hover:bg-slate-700 hover:text-white transition-all rounded-none border-r border-slate-700" data-testid="tab-chat">
                    <span className="flex items-center">
                      <MessageCircle className="h-3.5 w-3.5 mr-1 hidden sm:inline-block" />
                      <span>Chat</span>
                    </span>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium">Party Chat</p>
                  <p className="text-xs text-muted-foreground">Talk with other players in real-time. Coordinate tactics, roleplay in character, or just hang out between turns.</p>
                </TooltipContent>
              </Tooltip>
              
              {isDM && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger value="dashboard" className="text-xs sm:text-sm md:text-base text-slate-200 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 data-[state=active]:font-bold data-[state=active]:shadow-lg hover:bg-slate-700 hover:text-white transition-all rounded-none border-r border-slate-700">
                      <span className="flex items-center">
                        <LayoutDashboard className="h-3.5 w-3.5 mr-1 hidden sm:inline-block" />
                        <span>Dashboard</span>
                      </span>
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-medium">DM Command Center</p>
                    <p className="text-xs text-muted-foreground">Campaign insights: story analysis, quest tracking, party status, and suggestions for what to do next.</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="settings" className="text-xs sm:text-sm md:text-base text-slate-200 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 data-[state=active]:font-bold data-[state=active]:shadow-lg hover:bg-slate-700 hover:text-white transition-all rounded-none border-r border-slate-700">
                    <span className="flex items-center">
                      <Settings className="h-3.5 w-3.5 mr-1 hidden sm:inline-block" />
                      <span>Settings</span>
                    </span>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium">Campaign Settings</p>
                  <p className="text-xs text-muted-foreground">Adjust campaign options, theme preferences, difficulty settings, and manage campaign-wide configurations.</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="deploy" className="text-xs sm:text-sm md:text-base text-slate-200 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900 data-[state=active]:font-bold data-[state=active]:shadow-lg hover:bg-slate-700 hover:text-white transition-all rounded-none">
                    <span className="flex items-center">
                      <Share2 className="h-3.5 w-3.5 mr-1 md:mr-2 hidden sm:inline-block" />
                      <span>Deploy</span>
                    </span>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium">Share & Invite Players</p>
                  <p className="text-xs text-muted-foreground">Get invite links to share with friends, manage who can join, and deploy your campaign for others to play.</p>
                </TooltipContent>
              </Tooltip>
            </TabsList>
            
            <TabsContent value="narrative" className="p-4 sm:p-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold font-fantasy" style={{ color: '#0f172a' }}>
                        {campaign.title}
                      </h2>
                    </div>
                    {campaign.discordChannelId ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0 border-[#5865F2] text-[#5865F2] hover:bg-[#5865F2]/10"
                            onClick={() => {
                              const discordUrl = `https://discord.com/channels/${campaign.discordGuildId}/${campaign.discordChannelId}`;
                              window.open(discordUrl, '_blank');
                            }}
                          >
                            <SiDiscord className="h-4 w-4 mr-1.5" />
                            <span className="hidden sm:inline">Join Discord</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Open campaign's Discord channel</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : isDM && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0 text-muted-foreground hover:text-[#5865F2]"
                            onClick={() => {
                              const tabsList = document.querySelector('[data-state="active"][value="deploy"]') || 
                                              document.querySelector('button[value="deploy"]');
                              if (tabsList) (tabsList as HTMLButtonElement).click();
                            }}
                          >
                            <SiDiscord className="h-4 w-4 mr-1.5" />
                            <span className="hidden sm:inline">Add Discord</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Connect this campaign to Discord</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
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
                    {/* Campaign Chapter Progress Bar */}
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800 mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 flex items-center">
                          <BookOpen className="h-4 w-4 mr-2" />
                          Campaign Progress
                        </span>
                        <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                          Chapter {currentSession.sessionNumber} of {campaign.totalChapters || 5}
                        </span>
                      </div>
                      <Progress 
                        value={(currentSession.sessionNumber / (campaign.totalChapters || 5)) * 100} 
                        className="h-3 bg-indigo-200 dark:bg-indigo-900"
                        data-testid="progress-campaign-chapters"
                      />
                      <div className="flex justify-between text-xs mt-1 text-indigo-600 dark:text-indigo-400">
                        <span>Start</span>
                        <span>{currentSession.sessionNumber === (campaign.totalChapters || 5) ? '🏆 Final Chapter!' : `${(campaign.totalChapters || 5) - currentSession.sessionNumber} chapters remaining`}</span>
                        <span>End</span>
                      </div>
                    </div>
                    
                    {/* Quick Reference Panel - Full Width Map + Party Stats Row */}
                    <div className="space-y-3 mb-4">
                      {/* Dungeon Map Widget - Collapsible, environment-aware */}
                      <div className="bg-slate-800 dark:bg-slate-900 rounded-lg border-2 border-amber-600/50 shadow-lg overflow-hidden">
                        <div className="flex items-center justify-between p-3 hover:bg-slate-700/50 transition-colors">
                          <button
                            onClick={() => setIsMapCollapsed(!isMapCollapsed)}
                            className="flex-1 flex items-center text-left"
                          >
                            <h5 className="text-sm font-bold text-amber-400 flex items-center">
                              <Map className="h-4 w-4 mr-2" />
                              {currentLocation || 'Unknown'}
                              <span className="ml-2 text-xs font-normal text-slate-400 capitalize">
                                ({mapEnvironment.type})
                              </span>
                            </h5>
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setIsMapCollapsed(!isMapCollapsed)}
                              className="p-1 hover:bg-slate-600/50 rounded"
                            >
                              {isMapCollapsed ? (
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                              ) : (
                                <ChevronUp className="h-4 w-4 text-slate-400" />
                              )}
                            </button>
                          </div>
                        </div>
                        
                        {!isMapCollapsed && (
                          <div className="p-3 pt-0">
                            {/* Hex Map Preview Grid - D&D Authentic Style */}
                            {dungeonMapData && dungeonMapData.tiles ? (() => {
                              // Hex grid calculations for preview
                              const hexSize = 14;
                              const hexWidth = hexSize;
                              const hexHeight = Math.floor(hexSize * 1.15);
                              const hexHorizontalSpacing = Math.floor(hexWidth * 0.78);
                              const hexVerticalSpacing = Math.floor(hexHeight * 0.5);
                              const hexOffset = Math.floor(hexHorizontalSpacing * 0.5);
                              const mapWidth = (dungeonMapData.tiles[0]?.length || 20);
                              const mapHeight = dungeonMapData.tiles.length;
                              const containerWidth = mapWidth * hexHorizontalSpacing + hexOffset + hexWidth;
                              const containerHeight = mapHeight * hexVerticalSpacing + hexHeight;
                              
                              return (
                                <div 
                                  className="relative rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-amber-500/50 transition-all"
                                  style={{ 
                                    background: 'linear-gradient(135deg, #8B4513 0%, #A0522D 25%, #8B4513 50%, #6B3E0C 75%, #8B4513 100%)',
                                    padding: '3px',
                                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3), 0 4px 8px rgba(0,0,0,0.4)'
                                  }}
                                  onClick={() => setIsMapExpanded(true)}
                                >
                                  {/* Parchment-style inner container */}
                                  <div 
                                    className="rounded relative overflow-hidden"
                                    style={{
                                      background: 'linear-gradient(to bottom right, #e8dcc4 0%, #d4c4a8 50%, #c9b896 100%)',
                                      padding: '8px',
                                    }}
                                  >
                                    {/* Hex grid container */}
                                    <div 
                                      className="relative mx-auto"
                                      style={{
                                        width: containerWidth,
                                        height: containerHeight,
                                        minHeight: '120px',
                                      }}
                                    >
                                      {dungeonMapData.tiles.map((row: any[], y: number) => 
                                        row.map((tile: any, x: number) => {
                                          const isPlayer = dungeonMapData.playerPosition?.x === x && dungeonMapData.playerPosition?.y === y;
                                          const isOddRow = y % 2 === 1;
                                          const hexX = x * hexHorizontalSpacing + (isOddRow ? hexOffset : 0);
                                          const hexY = y * hexVerticalSpacing;
                                          
                                          let bgColor = mapEnvironment.wall;
                                          if (tile?.type === 'floor') {
                                            bgColor = mapEnvironment.floor;
                                          } else if (tile?.type === 'corridor') {
                                            bgColor = mapEnvironment.corridor;
                                          } else if (tile?.type === 'door') {
                                            bgColor = mapEnvironment.door;
                                          } else if (tile?.type === 'stairs') {
                                            bgColor = mapEnvironment.stairs;
                                          } else if (tile?.type === 'chest' || tile?.type === 'treasure') {
                                            bgColor = '#eab308';
                                          }
                                          
                                          // HexMetaV2: Narrative tone icons
                                          const toneIcons: Record<string, { icon: string; color: string }> = {
                                            "Whispering": { icon: "👁", color: "#c084fc" },
                                            "Sacred": { icon: "✧", color: "#fbbf24" },
                                            "Watched": { icon: "◉", color: "#f87171" },
                                            "Unstable": { icon: "⚠", color: "#fb923c" },
                                            "Forgotten": { icon: "◇", color: "#94a3b8" },
                                            "Hostile": { icon: "☠", color: "#ef4444" },
                                            "Benevolent": { icon: "♥", color: "#4ade80" },
                                            "Sealed": { icon: "🔒", color: "#60a5fa" },
                                            "Cursed": { icon: "☽", color: "#a78bfa" },
                                            "Ancient": { icon: "⌘", color: "#d97706" },
                                          };
                                          const narrativeTone = tile?.narrative?.narrativeTone;
                                          const toneData = narrativeTone ? toneIcons[narrativeTone] : null;
                                          // Only show markers within 4 tiles of the player
                                          const playerX = dungeonMapData.playerPosition?.x || 0;
                                          const playerY = dungeonMapData.playerPosition?.y || 0;
                                          const distance = Math.abs(x - playerX) + Math.abs(y - playerY);
                                          const isNearPlayer = distance <= 4;
                                          const hasNarrative = toneData && (tile?.type === 'floor' || tile?.type === 'corridor') && isNearPlayer;
                                          
                                          return (
                                            <div 
                                              key={`${x}-${y}`} 
                                              className="absolute group"
                                              style={{ 
                                                width: hexWidth,
                                                height: hexHeight,
                                                left: hexX,
                                                top: hexY,
                                              }}
                                            >
                                              {/* Narrative marker - only visible on hover */}
                                              {hasNarrative && toneData && (
                                                <div 
                                                  className="absolute z-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                                  style={{ 
                                                    top: -3, left: -3, width: '12px', height: '12px',
                                                    backgroundColor: 'rgba(0,0,0,0.85)',
                                                    color: toneData.color,
                                                    fontSize: '8px',
                                                    border: `1px solid ${toneData.color}`,
                                                  }}
                                                  title={tile?.narrative?.tooltipNote || narrativeTone}
                                                >
                                                  {toneData.icon}
                                                </div>
                                              )}
                                              {/* Main hex tile */}
                                              <div
                                                className="absolute inset-0"
                                                style={{ 
                                                  backgroundColor: isPlayer ? '#22c55e' : bgColor,
                                                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                                                  boxShadow: isPlayer 
                                                    ? '0 0 8px 2px rgba(34,197,94,0.6)' 
                                                    : 'inset 0 0 0 1px rgba(0,0,0,0.15)',
                                                }} 
                                              />
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
                                  </div>
                                  {/* Legend - Hex style */}
                                  <div className="flex items-center justify-center gap-3 py-1.5 px-2 text-[9px] text-amber-900" style={{ background: 'linear-gradient(to bottom, #e8d4b8, #d4c4a8)' }}>
                                    <span className="flex items-center gap-1">
                                      <span className="w-2.5 h-3" style={{ backgroundColor: '#22c55e', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}></span> You
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span className="w-2.5 h-3" style={{ backgroundColor: mapEnvironment.floor, clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}></span> {mapEnvironment.labels.floor}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span className="w-2.5 h-3" style={{ backgroundColor: mapEnvironment.door, clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}></span> {mapEnvironment.labels.door}
                                    </span>
                                    <span className="text-amber-600 font-medium">⬡ Click to expand</span>
                                  </div>
                                </div>
                              );
                            })() : dungeonMapLoading || isGeneratingMap ? (
                              <div className="h-[150px] flex items-center justify-center bg-slate-900/50 rounded">
                                <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                                <span className="ml-2 text-amber-400 text-sm">Generating map...</span>
                              </div>
                            ) : (
                              <div className="h-[150px] flex items-center justify-center bg-slate-900/50 rounded text-slate-500 text-sm">
                                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                Preparing dungeon...
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Party Stats Widget - Below map */}
                      <div className="bg-gradient-to-br from-emerald-900/80 to-green-900/80 dark:from-emerald-950 dark:to-green-950 p-3 rounded-lg border-2 border-emerald-600/50 shadow-lg">
                        <h5 className="text-sm font-bold text-emerald-300 flex items-center mb-2">
                          <Users className="h-4 w-4 mr-1" />
                          Party Status ({participants.length})
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {participants.map((p: any, idx: number) => {
                            const char = p.character;
                            if (!char) return null;
                            const maxHp = char.maxHitPoints || char.hitPoints || 10;
                            const hpPercent = maxHp > 0 ? Math.max(0, (char.hitPoints ?? 0) / maxHp * 100) : 0;
                            const hpColor = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
                            const isDead = char.status === 'dead' && (char.hitPoints ?? 0) <= 0;
                            const isNpc = p.isNpc;
                            const roleLabel = isNpc ? (char.companionType || char.occupation || 'Companion') : (char.class || 'Adventurer');
                            return (
                              <div key={char.id || idx} className={`flex items-center gap-2 p-1.5 rounded ${isDead ? 'opacity-50 bg-red-900/30' : 'bg-slate-800/50'}`}>
                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden shrink-0 border border-slate-600">
                                  {char.portraitUrl ? (
                                    <img src={char.portraitUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <User className="h-4 w-4 text-slate-400" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-1">
                                      <span className={`font-medium truncate ${isDead ? 'text-red-400 line-through' : 'text-white'}`}>
                                        {char.name}
                                      </span>
                                      <span className="text-slate-400 text-[10px]">Lv{char.level || 1}</span>
                                    </div>
                                    <span className={`font-bold ${isDead ? 'text-red-400' : 'text-emerald-300'}`}>
                                      {isDead ? 'DEAD' : `${char.hitPoints ?? 0}/${char.maxHitPoints ?? char.hitPoints ?? 10}`}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                                    <span className="truncate capitalize">{roleLabel}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="flex items-center gap-0.5">
                                        <Shield className="h-2.5 w-2.5" /> {char.armorClass || 10}
                                      </span>
                                      {char.gold > 0 && (
                                        <span className="flex items-center gap-0.5 text-yellow-400">
                                          <Coins className="h-2.5 w-2.5" /> {char.gold}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {!isDead && (
                                    <div className="h-1 bg-slate-700 rounded-full overflow-hidden mt-0.5">
                                      <div className={`h-full ${hpColor} transition-all`} style={{ width: `${hpPercent}%` }} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {participants.length === 0 && (
                            <p className="text-xs text-emerald-400/70 italic">No party members</p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Contextual Party Tab Reminder - shows when low HP or no potions */}
                    {activeCharacter && (
                      activeCharacter.hitPoints < activeCharacter.maxHitPoints / 2 || 
                      !((activeCharacter as any).consumables?.length > 0)
                    ) && !parsedStoryState?.inCombat && (
                      <div className="bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border-2 border-amber-400 dark:border-amber-600 rounded-lg p-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FlaskConical className="h-4 w-4" style={{ color: '#92400e' }} />
                          <span className="text-sm font-medium" style={{ color: '#78350f' }}>
                            {activeCharacter.hitPoints < activeCharacter.maxHitPoints / 2 
                              ? "Your hero is wounded! Consider stocking up on healing potions." 
                              : "You have no consumables. Potions can save your life!"}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-amber-500 hover:bg-amber-200 dark:hover:bg-amber-900/50"
                          style={{ color: '#78350f' }}
                          onClick={() => setActiveTab("party")}
                        >
                          <Backpack className="h-4 w-4 mr-1" />
                          Party Tab
                        </Button>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-start">
                      <h3 className="text-xl font-bold flex items-center" style={{ color: '#0f172a' }}>
                        <Scroll className="h-5 w-5 mr-2 text-indigo-600 dark:text-indigo-400" />
                        Chapter {currentSession.sessionNumber}: {currentSession.title.replace(/^(Session|Chapter)\s*\d+:\s*/i, '')}
                      </h3>
                      
                      {/* Current location display */}
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          <span className="hidden sm:inline">{currentLocation}</span>
                        </Button>
                      </div>
                    </div>
                    
                    {/* Adventure Progress Display */}
                    {parsedStoryState?.adventureProgress && (() => {
                      // Calculate progress percentage locally for reliability
                      const progress = parsedStoryState.adventureProgress as any;
                      // Use default requirements if not set
                      const requirements = parsedStoryState.adventureRequirements as any || {
                        encounters: { combat: 3, trap: 2, treasure: 2 },
                        puzzles: 2,
                        discoveries: 3,
                        subquests: 1
                      };
                      
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
                        <h4 className="font-semibold flex items-center mb-3" style={{ color: '#92400e' }}>
                          <Target className="h-4 w-4 mr-2" />
                          Adventure Objectives
                        </h4>
                        <p className="text-xs mb-3" style={{ color: '#92400e' }}>
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
                                  <div className="flex items-center gap-2 mt-1 text-xs font-bold" style={{ color: '#7c2d12' }}>
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
                        <h4 className="font-bold flex items-center mb-3 text-lg" style={{ color: '#b91c1c' }}>
                          ⚔️ COMBAT!
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Party Members Column */}
                          <div>
                            <h5 className="font-semibold mb-2 flex items-center" style={{ color: '#15803d' }}>
                              🛡️ Your Party
                            </h5>
                            <div className="space-y-2">
                              {(parsedStoryState.partyMembers as any[] || []).map((member: any, index: number) => {
                                // Look up actual character HP from participants if this is a player character
                                const participantChar = participants.find((p: any) => 
                                  p.character?.name === member.name || p.character?.id === member.characterId
                                )?.character;
                                // For companions, look up actual HP from partyNpcs (database values)
                                // Note: partyNpcs uses hitPoints/maxHitPoints, not currentHp/maxHp
                                const companionNpc = member.type !== 'player' ? partyNpcs?.find((npc: any) => npc.name === member.name) : null;
                                const actualHp = participantChar?.hitPoints ?? companionNpc?.hitPoints ?? member.currentHp;
                                const actualMaxHp = participantChar?.maxHitPoints ?? companionNpc?.maxHitPoints ?? member.maxHp;
                                const actualStatus = participantChar?.status ?? companionNpc?.status ?? member.status;
                                
                                const isUnconscious = actualStatus === 'unconscious' || actualStatus === 'dead' || actualHp <= 0;
                                const hpRatio = actualMaxHp > 0 ? Math.max(0, actualHp / actualMaxHp) : 0;
                                
                                return (
                                <div 
                                  key={member.name || index}
                                  className={`p-2 rounded border ${
                                    isUnconscious
                                      ? 'bg-gray-100 dark:bg-gray-800/50 border-gray-400 dark:border-gray-600 opacity-75'
                                      : member.type === 'player' 
                                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700' 
                                      : 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700'
                                  }`}
                                >
                                  <div className="flex justify-between items-center mb-1">
                                    <span className={`font-bold text-sm ${
                                      isUnconscious ? 'text-gray-500 dark:text-gray-400 line-through' :
                                      member.type === 'player' ? 'text-blue-800 dark:text-blue-200' : 'text-green-800 dark:text-green-200'
                                    }`}>
                                      {isUnconscious ? '💀 ' : member.type === 'player' ? '👤 ' : '🤝 '}{member.name}
                                      {member.class && <span className="text-xs ml-1 opacity-70">({member.class})</span>}
                                    </span>
                                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                      isUnconscious
                                        ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                        : actualStatus === 'bloodied' 
                                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' 
                                        : actualStatus === 'wounded'
                                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    }`}>
                                      {isUnconscious ? '💀 unconscious' : actualStatus || 'healthy'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs text-gray-600 dark:text-gray-400">HP:</span>
                                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full transition-all ${
                                          isUnconscious || hpRatio <= 0
                                            ? 'bg-gray-500'
                                            : hpRatio <= 0.25 
                                            ? 'bg-red-500' 
                                            : hpRatio <= 0.5 
                                            ? 'bg-orange-500' 
                                            : 'bg-green-500'
                                        }`}
                                        style={{ width: isUnconscious ? '0%' : `${hpRatio * 100}%` }}
                                      />
                                    </div>
                                    <span className={`text-xs font-mono min-w-[45px] text-right ${
                                      isUnconscious ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-700 dark:text-gray-300'
                                    }`}>
                                      {Math.max(0, actualHp)}/{actualMaxHp}
                                    </span>
                                  </div>
                                  
                                  {/* D&D Combat Stats for party members */}
                                  {(() => {
                                    // Get stats for companions from partyNpcs or from member data
                                    const companionNpc = member.type !== 'player' ? partyNpcs?.find((npc: any) => npc.name === member.name) : null;
                                    const memberAC = companionNpc?.armorClass || member.ac || participantChar?.armorClass;
                                    
                                    // For player characters, calculate ATK from ability scores
                                    // ATK = proficiency bonus + ability modifier (STR or DEX based on class)
                                    let memberATK = companionNpc?.attackBonus || member.attackBonus;
                                    let memberDMG = companionNpc?.damageRoll || member.damage;
                                    
                                    if (!memberATK && participantChar) {
                                      const char = participantChar;
                                      const level = char.level || 1;
                                      const profBonus = Math.floor((level - 1) / 4) + 2; // D&D 5e proficiency bonus
                                      const strMod = Math.floor(((char.strength || 10) - 10) / 2);
                                      const dexMod = Math.floor(((char.dexterity || 10) - 10) / 2);
                                      // Use DEX for finesse/ranged classes, STR otherwise
                                      const isFinesse = ['Rogue', 'Ranger', 'Monk'].includes(char.class);
                                      const abilityMod = isFinesse ? Math.max(strMod, dexMod) : strMod;
                                      memberATK = profBonus + abilityMod;
                                    }
                                    
                                    if (!memberDMG && participantChar) {
                                      const char = participantChar;
                                      const strMod = Math.floor(((char.strength || 10) - 10) / 2);
                                      const dexMod = Math.floor(((char.dexterity || 10) - 10) / 2);
                                      const isFinesse = ['Rogue', 'Ranger', 'Monk'].includes(char.class);
                                      const abilityMod = isFinesse ? Math.max(strMod, dexMod) : strMod;
                                      // Base weapon damage by class
                                      const baseDie = ['Wizard', 'Sorcerer', 'Warlock'].includes(char.class) ? '1d6' : '1d8';
                                      const modStr = abilityMod >= 0 ? `+${abilityMod}` : `${abilityMod}`;
                                      memberDMG = `${baseDie}${modStr}`;
                                    }
                                    
                                    return (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {memberAC && (
                                          <span className="bg-stone-200 dark:bg-stone-600 text-stone-800 dark:text-stone-100 px-1.5 py-0.5 rounded text-xs" title="Armor Class - enemies need to roll this or higher to hit">
                                            AC: {memberAC}
                                          </span>
                                        )}
                                        {memberATK !== undefined && memberATK !== null && (
                                          <span className="bg-blue-200 dark:bg-blue-700 text-blue-800 dark:text-blue-100 px-1.5 py-0.5 rounded text-xs" title="Attack Bonus - added to d20 attack rolls">
                                            ATK: +{memberATK}
                                          </span>
                                        )}
                                        {memberDMG && (
                                          <span className="bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-100 px-1.5 py-0.5 rounded text-xs" title="Damage dice rolled on hit">
                                            DMG: {memberDMG}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              );})}
                            </div>
                          </div>
                          
                          {/* Enemies Column */}
                          <div>
                            <h5 className="font-semibold mb-2 flex items-center" style={{ color: '#b91c1c' }}>
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
                        
                        {/* Target Selection for multi-enemy combat */}
                        {(() => {
                          const enemies = (parsedStoryState?.combatants as any[] || []).filter(
                            (c: any) => (c.type === 'enemy' || c.type === 'boss') && c.status !== 'defeated' && (c.currentHp > 0 || c.currentHp === undefined)
                          );
                          if (enemies.length > 1) {
                            return (
                              <div className="mb-3 p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                  <Target className="h-4 w-4 text-red-600" />
                                  <span className="text-sm font-medium text-red-800 dark:text-red-200">Select Target</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {enemies.map((enemy: any, idx: number) => (
                                    <button
                                      key={idx}
                                      onClick={() => setSelectedTargetIndex(idx)}
                                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                        selectedTargetIndex === idx
                                          ? 'bg-red-600 text-white ring-2 ring-red-400'
                                          : 'bg-white dark:bg-gray-800 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50'
                                      }`}
                                    >
                                      {enemy.name}
                                      <span className="ml-1 text-xs opacity-75">
                                        ({enemy.currentHp ?? enemy.maxHp ?? '?'}/{enemy.maxHp ?? '?'} HP)
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                        
                        {/* Combat Spells & Magic Items for active character */}
                        {activeCharacter && (
                          <div className="mt-3">
                            <CombatSpellPanel
                              characterId={activeCharacter.id}
                              characterClass={activeCharacter.class || ''}
                              characterLevel={activeCharacter.level || 1}
                              onUseMagicItem={(item) => {
                                // Handle using a magic item in combat
                                const inCombat = parsedStoryState?.inCombat;
                                const enemies = (parsedStoryState?.combatants as any[] || []).filter(
                                  (c: any) => (c.type === 'enemy' || c.type === 'boss') && c.status !== 'defeated' && (c.currentHp > 0 || c.currentHp === undefined)
                                );
                                // Use selected target or fall back to first enemy
                                const validIndex = selectedTargetIndex < enemies.length ? selectedTargetIndex : 0;
                                const targetEnemy = enemies.length > 0 ? enemies[validIndex] : null;
                                
                                // Parse damage dice from item if available
                                const damageDice = item.damageDice || (item.specialEffect?.match(/(\d+d\d+(?:\s*\+\s*\d+)?)/i)?.[1]) || '3d4+3'; // Default to Magic Missile
                                const damageType = item.damageType || 'force';
                                
                                if (inCombat && targetEnemy) {
                                  // Magic items like wands typically auto-hit (Magic Missile) or require spell attack
                                  const isMagicMissile = item.name.toLowerCase().includes('magic missile');
                                  
                                  if (isMagicMissile) {
                                    // Magic Missile auto-hits
                                    const damageResult = parseAndRollDice(damageDice, false, damageType);
                                    
                                    const combatLog = {
                                      attacker: activeCharacter.name || 'Hero',
                                      attackerType: 'player',
                                      target: targetEnemy.name,
                                      targetType: 'enemy',
                                      attackRoll: { roll: 0, modifier: 0, total: 0, isCritical: false, isCriticalMiss: false }, // Magic Missile auto-hits, no roll needed
                                      targetAC: targetEnemy.ac || 12,
                                      isHit: true,
                                      damage: {
                                        diceRolls: damageResult.diceRolls,
                                        diceType: damageResult.diceType,
                                        modifier: damageResult.modifier,
                                        total: damageResult.total,
                                        isCritical: false
                                      },
                                      targetNewHp: Math.max(0, targetEnemy.currentHp - damageResult.total),
                                      targetMaxHp: targetEnemy.maxHp,
                                      targetStatus: (targetEnemy.currentHp - damageResult.total) <= 0 ? 'defeated' : targetEnemy.status,
                                      description: `${activeCharacter.name} waves the ${item.name}! Glowing darts of magical force streak toward ${targetEnemy.name}, dealing ${damageResult.total} force damage!`,
                                      mechanicsBreakdown: `Magic Missile (auto-hit - no attack roll needed)\nDamage: ${damageResult.diceRolls.join('+')} = ${damageResult.total} force`
                                    };
                                    
                                    setDetailedCombatLogs([combatLog]);
                                    setShowCombatLogDialog(true);
                                    
                                    toast({
                                      title: `✨ ${item.name}!`,
                                      description: `Dealt ${damageResult.total} force damage to ${targetEnemy.name}!`,
                                    });
                                    
                                    advanceStory.mutate({
                                      choice: `Use ${item.name} on ${targetEnemy.name}, dealing ${damageResult.total} force damage`,
                                      rollResult: {
                                        type: 'magic_item',
                                        itemName: item.name,
                                        damage: damageResult,
                                        target: targetEnemy.name,
                                        isHit: true
                                      }
                                    });
                                  } else {
                                    // Other magic items may require attack roll
                                    const profBonus = Math.floor(((activeCharacter.level || 1) - 1) / 4) + 2;
                                    const intMod = Math.floor(((activeCharacter as any).intelligence || 10 - 10) / 2);
                                    const attackResult = rollSpellAttack(profBonus + intMod);
                                    const targetAC = targetEnemy.ac || 12;
                                    const isHit = attackResult.isCritical || (!attackResult.isCriticalMiss && attackResult.total >= targetAC);
                                    
                                    let damageResult = null;
                                    if (isHit) {
                                      damageResult = parseAndRollDice(damageDice, attackResult.isCritical, damageType);
                                    }
                                    
                                    const combatLog = {
                                      attacker: activeCharacter.name || 'Hero',
                                      attackerType: 'player',
                                      target: targetEnemy.name,
                                      targetType: 'enemy',
                                      attackRoll: attackResult,
                                      targetAC,
                                      isHit,
                                      damage: damageResult ? {
                                        diceRolls: damageResult.diceRolls,
                                        diceType: damageResult.diceType,
                                        modifier: damageResult.modifier,
                                        total: damageResult.total,
                                        isCritical: damageResult.isCritical
                                      } : null,
                                      targetNewHp: isHit && damageResult ? Math.max(0, targetEnemy.currentHp - damageResult.total) : targetEnemy.currentHp,
                                      targetMaxHp: targetEnemy.maxHp,
                                      targetStatus: isHit && damageResult && (targetEnemy.currentHp - damageResult.total) <= 0 ? 'defeated' : targetEnemy.status,
                                      description: isHit 
                                        ? `${activeCharacter.name} activates the ${item.name}! ${targetEnemy.name} takes ${damageResult?.total} ${damageType} damage!`
                                        : `${activeCharacter.name} uses the ${item.name} but ${targetEnemy.name} evades!`,
                                      mechanicsBreakdown: `Attack: d20(${attackResult.roll}) + ${attackResult.modifier} = ${attackResult.total} vs AC ${targetAC}`
                                        + (damageResult ? `\nDamage: ${damageResult.diceRolls.join('+')} = ${damageResult.total} ${damageType}` : '')
                                    };
                                    
                                    setDetailedCombatLogs([combatLog]);
                                    setShowCombatLogDialog(true);
                                    
                                    toast({
                                      title: isHit ? `✨ ${item.name} hits!` : `❌ ${item.name} missed!`,
                                      description: isHit && damageResult
                                        ? `Dealt ${damageResult.total} ${damageType} damage to ${targetEnemy.name}!`
                                        : `Attack roll ${attackResult.total} vs AC ${targetAC}`,
                                      variant: isHit ? undefined : "destructive",
                                    });
                                    
                                    advanceStory.mutate({
                                      choice: `Use ${item.name} on ${targetEnemy.name}${isHit ? `, dealing ${damageResult?.total} ${damageType} damage` : ' but missed'}`,
                                      rollResult: {
                                        type: 'magic_item',
                                        itemName: item.name,
                                        attackRoll: attackResult,
                                        damage: damageResult,
                                        target: targetEnemy.name,
                                        isHit
                                      }
                                    });
                                  }
                                } else {
                                  // Outside combat - just describe using the item
                                  toast({
                                    title: `✨ Used ${item.name}!`,
                                    description: item.specialEffect || `You activate the magical item.`,
                                  });
                                  
                                  advanceStory.mutate({
                                    choice: `Use ${item.name}`,
                                    rollResult: {
                                      type: 'magic_item',
                                      itemName: item.name
                                    }
                                  });
                                }
                              }}
                              onCastSpell={(spell, slotLevel) => {
                                // Calculate spellcasting modifier based on class
                                const getSpellcastingAbility = (charClass: string): 'intelligence' | 'wisdom' | 'charisma' => {
                                  const lowerClass = charClass.toLowerCase();
                                  if (['wizard'].includes(lowerClass)) return 'intelligence';
                                  if (['cleric', 'druid', 'ranger'].includes(lowerClass)) return 'wisdom';
                                  return 'charisma'; // sorcerer, bard, warlock, paladin
                                };
                                
                                const ability = getSpellcastingAbility(activeCharacter.class || '');
                                const abilityScore = (activeCharacter as any)[ability] || 10;
                                const abilityMod = Math.floor((abilityScore - 10) / 2);
                                // D&D 5e proficiency bonus: 2 at levels 1-4, 3 at 5-8, 4 at 9-12, etc.
                                const profBonus = Math.floor(((activeCharacter.level || 1) - 1) / 4) + 2;
                                const spellMod = abilityMod + profBonus;
                                
                                // Check if we're in combat and have valid enemies
                                const inCombat = parsedStoryState?.inCombat;
                                const enemies = (parsedStoryState?.combatants as any[] || []).filter(
                                  (c: any) => (c.type === 'enemy' || c.type === 'boss') && c.status !== 'defeated' && (c.currentHp > 0 || c.currentHp === undefined)
                                );
                                // Use selected target or fall back to first enemy
                                const validIndex = selectedTargetIndex < enemies.length ? selectedTargetIndex : 0;
                                const targetEnemy = enemies.length > 0 ? enemies[validIndex] : null;
                                
                                // If spell has damage dice and we're in combat with enemies, handle combat spell
                                if (spell.damageDice && inCombat && targetEnemy) {
                                  // Roll spell attack
                                  const attackResult = rollSpellAttack(spellMod);
                                  const targetAC = targetEnemy.ac || 12;
                                  const isHit = attackResult.isCritical || (!attackResult.isCriticalMiss && attackResult.total >= targetAC);
                                  
                                  let damageResult: SpellDamageResult | null = null;
                                  
                                  if (isHit) {
                                    damageResult = parseAndRollDice(spell.damageDice, attackResult.isCritical, spell.damageType);
                                  }
                                  
                                  // Create combat log entry
                                  const combatLog = {
                                    attacker: activeCharacter.name || 'Hero',
                                    attackerType: 'player',
                                    target: targetEnemy.name,
                                    targetType: 'enemy',
                                    attackRoll: attackResult,
                                    targetAC,
                                    isHit,
                                    damage: damageResult ? {
                                      diceRolls: damageResult.diceRolls,
                                      diceType: damageResult.diceType,
                                      modifier: damageResult.modifier,
                                      total: damageResult.total,
                                      isCritical: damageResult.isCritical
                                    } : null,
                                    targetNewHp: isHit && damageResult ? Math.max(0, targetEnemy.currentHp - damageResult.total) : targetEnemy.currentHp,
                                    targetMaxHp: targetEnemy.maxHp,
                                    targetStatus: isHit && damageResult && (targetEnemy.currentHp - damageResult.total) <= 0 ? 'defeated' : targetEnemy.status,
                                    description: isHit 
                                      ? `${activeCharacter.name} casts ${spell.name}${attackResult.isCritical ? ' with devastating effect' : ''}! The spell strikes ${targetEnemy.name} for ${damageResult?.total} ${spell.damageType || ''} damage!`
                                      : `${activeCharacter.name} casts ${spell.name} but ${targetEnemy.name} evades the spell!`,
                                    mechanicsBreakdown: `Spell Attack: d20(${attackResult.roll}) + ${attackResult.modifier} = ${attackResult.total} vs AC ${targetAC}`
                                      + (damageResult ? `\nDamage: ${damageResult.diceRolls.join('+')}${damageResult.modifier !== 0 ? (damageResult.modifier > 0 ? '+' : '') + damageResult.modifier : ''} = ${damageResult.total} ${spell.damageType || ''}${damageResult.isCritical ? ' (CRITICAL!)' : ''}` : '')
                                  };
                                  
                                  // Show the combat log dialog
                                  setDetailedCombatLogs([combatLog]);
                                  setShowCombatLogDialog(true);
                                  
                                  // Toast notification
                                  toast({
                                    title: attackResult.isCritical 
                                      ? `🎯 Critical ${spell.name}!` 
                                      : isHit 
                                        ? `✨ ${spell.name} hits!`
                                        : `❌ ${spell.name} missed!`,
                                    description: isHit && damageResult
                                      ? `Dealt ${damageResult.total} ${spell.damageType || ''} damage to ${targetEnemy.name}!`
                                      : attackResult.isCriticalMiss 
                                        ? 'Natural 1! The spell fizzles...'
                                        : `Attack roll ${attackResult.total} vs AC ${targetAC}`,
                                    variant: isHit ? undefined : "destructive",
                                  });
                                  
                                  // Send spell action to server to update game state
                                  advanceStory.mutate({
                                    choice: `Cast ${spell.name} on ${targetEnemy.name}${isHit ? ` dealing ${damageResult?.total} ${spell.damageType || ''} damage` : ' but missed'}`,
                                    rollResult: {
                                      type: 'spell_attack',
                                      spellName: spell.name,
                                      slotLevel,
                                      attackRoll: attackResult,
                                      damage: damageResult,
                                      target: targetEnemy.name,
                                      isHit
                                    }
                                  });
                                  
                                } else if (spell.healingDice) {
                                  // Handle healing spell
                                  const healResult = parseAndRollDice(spell.healingDice, false);
                                  
                                  toast({
                                    title: `💚 ${spell.name}!`,
                                    description: `Healed for ${healResult.total} HP!`,
                                  });
                                  
                                  // Send healing action to server
                                  advanceStory.mutate({
                                    choice: `Cast ${spell.name} to heal for ${healResult.total} HP`,
                                    rollResult: {
                                      type: 'spell_heal',
                                      spellName: spell.name,
                                      slotLevel,
                                      healing: healResult.total
                                    }
                                  });
                                  
                                } else if (spell.damageDice && !inCombat) {
                                  // Damage spell cast outside combat - roll damage and let server handle narrative
                                  const damageResult = parseAndRollDice(spell.damageDice, false, spell.damageType);
                                  
                                  toast({
                                    title: `✨ ${activeCharacter.name} casts ${spell.name}!`,
                                    description: `${damageResult.diceRolls.join(' + ')} = ${damageResult.total} ${spell.damageType || ''} damage${!inCombat ? ' (not in combat)' : ''}`,
                                  });
                                  
                                  advanceStory.mutate({
                                    choice: `Cast ${spell.name} dealing ${damageResult.total} ${spell.damageType || ''} damage`,
                                    rollResult: {
                                      type: 'spell_attack',
                                      spellName: spell.name,
                                      slotLevel,
                                      damage: damageResult
                                    }
                                  });
                                  
                                } else {
                                  // Utility spell - just send action to server
                                  toast({
                                    title: `✨ ${activeCharacter.name} casts ${spell.name}!`,
                                    description: slotLevel > 0 ? `Used a level ${slotLevel} spell slot` : "Cantrip",
                                  });
                                  
                                  advanceStory.mutate({
                                    choice: `Cast ${spell.name}`,
                                    rollResult: {
                                      type: 'spell_utility',
                                      spellName: spell.name,
                                      slotLevel
                                    }
                                  });
                                }
                              }}
                            />
                          </div>
                        )}
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
                    
                    {/* Group Vote Section - Multiplayer choice voting */}
                    {dmSessionState?.groupChoiceStatus === 'pending' && dmSessionState?.activeGroupChoices?.length > 0 && (() => {
                      // Calculate time remaining
                      const expiresAt = dmSessionState.groupChoiceResolution?.voteExpiresAt;
                      let timeRemaining: string | null = null;
                      if (expiresAt) {
                        const diffMs = new Date(expiresAt).getTime() - Date.now();
                        if (diffMs <= 0) {
                          timeRemaining = "Expired";
                        } else {
                          const hours = Math.floor(diffMs / (1000 * 60 * 60));
                          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                          timeRemaining = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                        }
                      }
                      
                      return (
                      <div className="mt-6 space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <h4 className="font-semibold flex items-center gap-2 text-amber-600">
                            <Users className="h-4 w-4" />
                            Party Vote Active
                          </h4>
                          <div className="flex items-center gap-2">
                            {timeRemaining && (
                              <Badge variant="outline" className={`${timeRemaining === 'Expired' ? 'bg-red-50 border-red-300 text-red-700' : 'bg-slate-50 border-slate-300 text-slate-600'}`}>
                                {timeRemaining === 'Expired' ? 'Expired' : `${timeRemaining} left`}
                              </Badge>
                            )}
                            <Badge variant="outline" className="bg-amber-50 border-amber-300 text-amber-700">
                              {dmSessionState.groupChoiceVotes?.length || 0} voted
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {(dmSessionState.activeGroupChoices || []).map((choice: any) => {
                            const voteCount = dmSessionState.groupChoiceVotes?.filter((v: any) => v.choiceId === choice.id).length || 0;
                            const myVote = dmSessionState.groupChoiceVotes?.find((v: any) => 
                              v.characterId === activeCharacter?.id || v.characterName === activeCharacter?.name
                            );
                            const isMyChoice = myVote?.choiceId === choice.id;
                            
                            return (
                              <Button
                                key={choice.id}
                                variant="outline"
                                className={`justify-start h-auto py-3 px-4 text-left w-full ${isMyChoice ? 'border-2 border-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'border-border hover:border-amber-400'}`}
                                onClick={() => voteGroupChoiceMutation.mutate({
                                  choiceId: choice.id,
                                  characterId: activeCharacter?.id,
                                  characterName: activeCharacter?.name
                                })}
                                disabled={voteGroupChoiceMutation.isPending}
                              >
                                <div className="flex items-start justify-between w-full gap-3">
                                  <div className="flex items-start gap-2 flex-1 min-w-0">
                                    <ArrowRight className={`h-5 w-5 mt-0.5 shrink-0 ${isMyChoice ? 'text-amber-600' : 'text-primary'}`} />
                                    <div className="flex flex-col gap-1 min-w-0">
                                      <span className="font-medium text-slate-900 dark:text-slate-100">{choice.text}</span>
                                      {choice.description && (
                                        <span className="text-xs text-muted-foreground">{choice.description}</span>
                                      )}
                                      {choice.dc && (
                                        <span className="text-xs text-amber-600">
                                          DC {choice.dc} {choice.skillCheck}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <Badge variant={voteCount > 0 ? "default" : "outline"} className={`shrink-0 ${voteCount > 0 ? 'bg-amber-500' : ''}`}>
                                    {voteCount} vote{voteCount !== 1 ? 's' : ''}
                                  </Badge>
                                </div>
                              </Button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground text-center">
                          {timeRemaining === 'Expired' ? 'Vote has expired - waiting for auto-resolution...' : 'Click a choice to vote. The DM will resolve when ready.'}
                        </p>
                      </div>
                      );
                    })()}

                    {/* Show resolved vote result */}
                    {dmSessionState?.groupChoiceStatus === 'resolved' && dmSessionState?.groupChoiceResolution && (
                      <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Check className="h-4 w-4 text-green-600" />
                          <span className="font-semibold text-green-700 dark:text-green-300">Vote Resolved</span>
                          {dmSessionState.groupChoiceResolution.autoResolved && (
                            <Badge variant="outline" className="text-xs bg-orange-50 border-orange-300 text-orange-600">
                              Auto
                            </Badge>
                          )}
                        </div>
                        <p className="text-green-800 dark:text-green-200">
                          The party chose: <strong>{dmSessionState.groupChoiceResolution.winningChoice?.text}</strong>
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          Won by {dmSessionState.groupChoiceResolution.method?.replace('timeout_', '')} ({dmSessionState.groupChoiceResolution.totalVotes} total votes)
                          {dmSessionState.groupChoiceResolution.autoResolved && ' - auto-resolved after timeout'}
                        </p>
                      </div>
                    )}

                    {/* Action choices */}
                    {!isAdvancingStory && currentSession.choices && Array.isArray(currentSession.choices) && currentSession.choices.length > 0 && dmSessionState?.groupChoiceStatus !== 'pending' ? (
                      <div className="mt-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold" style={{ color: '#1e293b' }}>What will you do?</h4>
                          {currentTurnName && !isMyTurn && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                              <Clock className="h-3 w-3 mr-1" />
                              {currentTurnName}'s turn
                            </Badge>
                          )}
                        </div>
                        
                        {/* Turn restriction notice */}
                        {currentTurnName && !isMyTurn && !isDM && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                            <p className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              Waiting for {currentTurnName}'s turn to end. You can still use the table chat!
                            </p>
                          </div>
                        )}
                        
                        {/* Suggested Actions */}
                        <div className="grid grid-cols-1 gap-2 max-w-full overflow-hidden">
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
                            
                            const actionDisabled = !isDM && !!currentTurnName && !isMyTurn;
                            
                            const button = (
                              <Button 
                                key={index}
                                variant="outline"
                                className={`justify-start h-auto py-3 px-3 sm:px-4 bg-background border-2 text-left w-full max-w-full overflow-hidden ${actionDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent border-border hover:border-primary'}`}
                                onClick={() => !actionDisabled && handleChoiceSelection(choice)}
                                disabled={actionDisabled}
                                data-testid={`choice-button-${index}`}
                              >
                                <div className="flex items-start w-full min-w-0 overflow-hidden">
                                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 mr-2 mt-0.5 shrink-0 text-primary" />
                                  <div className="flex flex-col gap-1 min-w-0 flex-1 overflow-hidden">
                                    <span className="text-slate-900 dark:text-slate-100 font-medium text-sm sm:text-base break-words whitespace-normal overflow-wrap-anywhere">
                                      {choiceText}
                                    </span>
                                    {hasRoll && dc && (
                                      <div className="flex flex-wrap items-center gap-1">
                                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded font-bold">
                                          {choice.rollPurpose && choice.rollPurpose !== "null" ? choice.rollPurpose : "Skill Check"} ({choice.diceType && choice.diceType !== "null" ? choice.diceType : "d20"})
                                        </span>
                                        {tooltipContent && activeCharacter && dc > 0 && (
                                          <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${getLikelihoodDescription(calculateSuccessProbability(dc, getSkillModifier(activeCharacter, skillName).modifier)).color} bg-black/20`}>
                                            {(() => {
                                              const prob = calculateSuccessProbability(dc, getSkillModifier(activeCharacter, skillName).modifier);
                                              return isNaN(prob) ? "~50" : Math.round(prob);
                                            })()}%
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
                                  <TooltipContent side="top" align="center" sideOffset={5} className="bg-gray-900 border-gray-700 max-w-xs z-50" data-testid={`tooltip-choice-${index}`}>
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
                                disabled={!customAction.trim() || isAdvancingStory || (!isDM && !!currentTurnName && !isMyTurn)}
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
                    
                    {/* Table Chat - Available to all participants during live sessions */}
                    {currentSession && (
                      <div className="mt-6">
                        {tableChatCollapsed ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full border-dashed"
                            onClick={() => setTableChatCollapsed(false)}
                          >
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Open Table Chat
                          </Button>
                        ) : (
                          <div className="h-80 border rounded-lg overflow-hidden">
                            <TableChat
                              campaignId={campaign.id}
                              characterName={activeCharacter?.name}
                              characterId={activeCharacter?.id}
                              isCollapsed={false}
                              onToggle={() => setTableChatCollapsed(true)}
                              onInitiativeUpdate={(myTurn, combatantName) => {
                                setIsMyTurn(myTurn);
                                setCurrentTurnName(combatantName);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}
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
                  <h2 className="text-xl font-bold font-fantasy" style={{ color: '#0f172a' }}>Journey Log</h2>
                  
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
                    <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#1e293b' }}>
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
                <h2 className="text-xl font-bold font-fantasy" style={{ color: '#0f172a' }}>Campaign Party</h2>
                
                {/* Helpful intro hint */}
                <div className="bg-white/80 border-2 border-amber-300 rounded-lg p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg shadow-sm">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">Prepare for Adventure!</p>
                      <p className="text-sm text-slate-600 mt-1">
                        Manage your equipment, buy potions with your gold, and check your inventory before heading out. 
                        Well-prepared adventurers survive longer!
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-bold" style={{ color: '#0f172a' }}>Party Management</h3>
                      <p className="text-sm" style={{ color: '#475569' }}>Manage the players in this campaign</p>
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
                <div className="mt-6 p-4 border-2 border-amber-200 rounded-lg bg-white/80 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Users className="h-5 w-5 text-amber-600" />
                      Manage Party Member
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStockCompanionsEnabled(true);
                        setShowAddCompanionDialog(true);
                      }}
                      className="flex items-center gap-2"
                      data-testid="button-add-companion"
                    >
                      <Plus className="h-4 w-4" />
                      Add Companion
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {/* Character buttons - show ALL user's characters in the party */}
                    {myParticipants.map((participant: any) => (
                      <Button
                        key={`char-${participant.characterId}`}
                        variant={selectedPartyMemberType === "character" && managedCharacterId === participant.characterId ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setSelectedPartyMemberType("character");
                          setManagedCharacterId(participant.characterId);
                          setSelectedNpcId(null);
                        }}
                        className="flex items-center gap-2"
                        data-testid={`button-select-character-${participant.characterId}`}
                      >
                        <User className="h-4 w-4" />
                        {participant.character?.name || 'Unknown'} (You)
                      </Button>
                    ))}
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
                    {myParticipants.length === 0 && partyNpcs.length === 0 && (
                      <p className="text-sm text-slate-500">No party members to manage</p>
                    )}
                  </div>
                </div>
                
                {/* Add Stock Companion Dialog */}
                <Dialog open={showAddCompanionDialog} onOpenChange={setShowAddCompanionDialog}>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add Companion to Party</DialogTitle>
                      <DialogDescription>
                        Choose a ready-made companion to join your adventure. These companions have unique abilities and personalities.
                      </DialogDescription>
                    </DialogHeader>
                    
                    {stockCompanionsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : stockCompanions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No companions available
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {stockCompanions
                          .filter((companion: any) => !partyNpcs.some((pn: any) => pn.id === companion.id))
                          .map((companion: any) => (
                          <div
                            key={companion.id}
                            className={`p-4 border rounded-lg cursor-pointer transition-all ${
                              selectedStockCompanionId === companion.id
                                ? 'border-primary bg-primary/10'
                                : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'
                            }`}
                            onClick={() => setSelectedStockCompanionId(companion.id)}
                            data-testid={`companion-card-${companion.id}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
                                {companion.name?.charAt(0) || '?'}
                              </div>
                              <div className="flex-1">
                                <h4 className="font-bold text-slate-900 dark:text-slate-100">{companion.name}</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                  {companion.race} - {companion.occupation || companion.companionType}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 line-clamp-2">
                                  {companion.personality}
                                </p>
                                <div className="flex gap-2 mt-2">
                                  <Badge variant="secondary" className="text-xs">Lvl {companion.level}</Badge>
                                  <Badge variant="outline" className="text-xs">HP {companion.hitPoints}</Badge>
                                  <Badge variant="outline" className="text-xs">AC {companion.armorClass}</Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowAddCompanionDialog(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => selectedStockCompanionId && addCompanionToCampaignMutation.mutate(selectedStockCompanionId)}
                        disabled={!selectedStockCompanionId || addCompanionToCampaignMutation.isPending}
                        data-testid="button-confirm-add-companion"
                      >
                        {addCompanionToCampaignMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Add to Party
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

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
                          <div className="flex-1 min-w-0">
                            <span className={`font-medium text-sm block truncate ${itemStatsMap[getEquipmentName((activeCharacter as any).equippedWeapon)]?.rarity ? getRarityColor(itemStatsMap[getEquipmentName((activeCharacter as any).equippedWeapon)]?.rarity) : ''}`}>
                              {getEquipmentName((activeCharacter as any).equippedWeapon)}
                            </span>
                            {(activeCharacter as any).equippedWeapon && itemStatsMap[getEquipmentName((activeCharacter as any).equippedWeapon)] && (
                              <span className="text-xs text-amber-600 dark:text-amber-400 block">
                                {itemStatsMap[getEquipmentName((activeCharacter as any).equippedWeapon)]?.damageDice} {itemStatsMap[getEquipmentName((activeCharacter as any).equippedWeapon)]?.damageType}
                                {itemStatsMap[getEquipmentName((activeCharacter as any).equippedWeapon)]?.attackBonus ? ` (+${itemStatsMap[getEquipmentName((activeCharacter as any).equippedWeapon)]?.attackBonus} atk)` : ''}
                              </span>
                            )}
                          </div>
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
                          <div className="flex-1 min-w-0">
                            <span className={`font-medium text-sm block truncate ${itemStatsMap[getEquipmentName((activeCharacter as any).equippedArmor)]?.rarity ? getRarityColor(itemStatsMap[getEquipmentName((activeCharacter as any).equippedArmor)]?.rarity) : ''}`}>
                              {getEquipmentName((activeCharacter as any).equippedArmor)}
                            </span>
                            {(activeCharacter as any).equippedArmor && itemStatsMap[getEquipmentName((activeCharacter as any).equippedArmor)] && (
                              <span className="text-xs text-blue-600 dark:text-blue-400 block">
                                AC {itemStatsMap[getEquipmentName((activeCharacter as any).equippedArmor)]?.baseAC}
                                {itemStatsMap[getEquipmentName((activeCharacter as any).equippedArmor)]?.magicBonus ? `+${itemStatsMap[getEquipmentName((activeCharacter as any).equippedArmor)]?.magicBonus}` : ''}
                                {itemStatsMap[getEquipmentName((activeCharacter as any).equippedArmor)]?.armorType ? ` (${itemStatsMap[getEquipmentName((activeCharacter as any).equippedArmor)]?.armorType})` : ''}
                              </span>
                            )}
                          </div>
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
                          <div className="flex-1 min-w-0">
                            <span className={`font-medium text-sm block truncate ${itemStatsMap[getEquipmentName((activeCharacter as any).equippedShield)]?.rarity ? getRarityColor(itemStatsMap[getEquipmentName((activeCharacter as any).equippedShield)]?.rarity) : ''}`}>
                              {getEquipmentName((activeCharacter as any).equippedShield)}
                            </span>
                            {(activeCharacter as any).equippedShield && itemStatsMap[getEquipmentName((activeCharacter as any).equippedShield)] && (
                              <span className="text-xs text-blue-600 dark:text-blue-400 block">
                                +{itemStatsMap[getEquipmentName((activeCharacter as any).equippedShield)]?.baseAC || 2} AC
                                {itemStatsMap[getEquipmentName((activeCharacter as any).equippedShield)]?.magicBonus ? ` (+${itemStatsMap[getEquipmentName((activeCharacter as any).equippedShield)]?.magicBonus} magic)` : ''}
                              </span>
                            )}
                          </div>
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
                          <div className="flex-1 min-w-0">
                            <span className={`font-medium text-sm block truncate ${itemStatsMap[getEquipmentName((activeCharacter as any).equippedAccessory)]?.rarity ? getRarityColor(itemStatsMap[getEquipmentName((activeCharacter as any).equippedAccessory)]?.rarity) : ''}`}>
                              {getEquipmentName((activeCharacter as any).equippedAccessory)}
                            </span>
                            {(activeCharacter as any).equippedAccessory && itemStatsMap[(activeCharacter as any).equippedAccessory] && (
                              <span className="text-xs text-purple-600 dark:text-purple-400 block truncate">
                                {itemStatsMap[(activeCharacter as any).equippedAccessory]?.specialEffect || 
                                 (itemStatsMap[(activeCharacter as any).equippedAccessory]?.magicBonus ? `+${itemStatsMap[(activeCharacter as any).equippedAccessory]?.magicBonus} magic bonus` : 'Magical')}
                              </span>
                            )}
                          </div>
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
                      <div className="text-sm font-medium">Items ({(activeCharacter.equipment?.length || 0) + (magicalInventory?.length || 0)})</div>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {/* Magical Items from character_inventory table */}
                        {magicalInventory && magicalInventory.length > 0 && magicalInventory.map((magicItem: any) => (
                          <div key={`magic-${magicItem.id}`} className={`flex flex-col p-2 rounded text-sm ${magicItem.is_equipped ? 'bg-purple-100 dark:bg-purple-900/30 border border-purple-400' : 'bg-purple-50 dark:bg-purple-900/20'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className={`font-medium truncate block cursor-help ${getRarityColor(magicItem.rarity)}`}>
                                      <Sparkles className="h-3 w-3 inline mr-1 text-purple-500" />
                                      {magicItem.name}
                                      {magicItem.magic_bonus > 0 && ` +${magicItem.magic_bonus}`}
                                      {magicItem.is_equipped && <Star className="h-3 w-3 inline ml-1 text-amber-500" />}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-xs">
                                    <div className="space-y-1">
                                      <div className="font-bold">{magicItem.name}</div>
                                      <div className={`text-xs ${getRarityColor(magicItem.rarity)}`}>{magicItem.rarity} {magicItem.type}</div>
                                      {magicItem.damage_dice && <div className="text-xs">Damage: {magicItem.damage_dice} {magicItem.damage_type}</div>}
                                      {magicItem.base_ac && <div className="text-xs">Base AC: {magicItem.base_ac}</div>}
                                      {magicItem.special_effect && <div className="text-xs italic text-purple-400">✨ {magicItem.special_effect}</div>}
                                      {magicItem.requires_attunement && <div className="text-xs text-orange-500">{magicItem.is_attuned ? '🔮 Attuned' : '⚠️ Requires attunement'}</div>}
                                      {magicItem.description && <div className="text-xs text-slate-400 mt-1">{magicItem.description}</div>}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                                {magicItem.damage_dice && (
                                  <span className="text-xs text-red-600 dark:text-red-400 block">
                                    <Sword className="h-3 w-3 inline mr-1" />
                                    {magicItem.damage_dice} {magicItem.damage_type}
                                  </span>
                                )}
                                {magicItem.base_ac && (
                                  <span className="text-xs text-blue-600 dark:text-blue-400 block">
                                    <Shield className="h-3 w-3 inline mr-1" />
                                    AC +{magicItem.base_ac}
                                  </span>
                                )}
                                {magicItem.special_effect && (
                                  <span className="text-xs text-purple-600 dark:text-purple-400 block truncate italic">
                                    ✨ {magicItem.special_effect}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                <Button
                                  size="sm"
                                  variant={magicItem.is_equipped ? "secondary" : "default"}
                                  className="h-6 text-xs px-2"
                                  onClick={async () => {
                                    try {
                                      await apiRequest('POST', `/api/characters/${activeCharacter.id}/inventory/${magicItem.id}/equip`, {
                                        slot: magicItem.is_equipped ? undefined : (magicItem.equip_slot || magicItem.type || 'accessory')
                                      });
                                      queryClient.invalidateQueries({ queryKey: ['/api/characters', activeCharacter.id, 'magical-inventory'] });
                                    } catch (err) {
                                      console.error('Failed to equip/unequip:', err);
                                    }
                                  }}
                                >
                                  {magicItem.is_equipped ? 'Unequip' : 'Equip'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {/* Regular equipment items */}
                        {activeCharacter.equipment && activeCharacter.equipment.length > 0 ? (
                          activeCharacter.equipment.map((itemRaw: string, index: number) => {
                            const parsedItem = parseEquipmentItem(itemRaw);
                            const itemName = parsedItem.name;
                            const stats = itemStatsMap[itemName] || parsedItem;
                            const statsText = formatItemStats(itemName);
                            return (
                            <div key={index} className="flex flex-col p-2 bg-slate-50 dark:bg-slate-700 rounded text-sm" data-testid={`item-${index}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className={`font-medium truncate block cursor-help ${stats?.rarity ? getRarityColor(stats.rarity) : ''}`} title={itemName}>
                                        {itemName}
                                        {stats?.magicBonus ? ` +${stats.magicBonus}` : ''}
                                      </span>
                                    </TooltipTrigger>
                                    {stats && (
                                      <TooltipContent side="left" className="max-w-xs">
                                        <div className="space-y-1">
                                          <div className="font-bold">{stats.name}</div>
                                          {stats.rarity && <div className={`text-xs ${getRarityColor(stats.rarity)}`}>{stats.rarity}</div>}
                                          {stats.damageDice && <div className="text-xs">Damage: {stats.damageDice} {stats.damageType}</div>}
                                          {stats.attackBonus ? <div className="text-xs">Attack Bonus: +{stats.attackBonus}</div> : null}
                                          {stats.baseAC && <div className="text-xs">Base AC: {stats.baseAC}</div>}
                                          {stats.magicBonus ? <div className="text-xs">Magic Bonus: +{stats.magicBonus}</div> : null}
                                          {stats.properties && <div className="text-xs">Properties: {Array.isArray(stats.properties) ? stats.properties.join(', ') : stats.properties}</div>}
                                          {stats.specialEffect && <div className="text-xs italic text-purple-400">{stats.specialEffect}</div>}
                                          {stats.description && <div className="text-xs text-slate-400 mt-1">{stats.description}</div>}
                                        </div>
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                  {/* Show damage for weapons */}
                                  {(stats?.damage || stats?.damageDice) && (
                                    <span className="text-xs text-red-600 dark:text-red-400 block">
                                      <Sword className="h-3 w-3 inline mr-1" />
                                      {stats.damage || `${stats.damageDice}${stats.damageType ? ` ${stats.damageType}` : ''}`}
                                    </span>
                                  )}
                                  {/* Show AC for armor/shields */}
                                  {(stats?.armor || stats?.baseAC) && (
                                    <span className="text-xs text-blue-600 dark:text-blue-400 block">
                                      <Shield className="h-3 w-3 inline mr-1" />
                                      AC +{stats.armor || stats.baseAC}
                                    </span>
                                  )}
                                  {/* Show properties if available */}
                                  {stats?.properties && typeof stats.properties === 'string' && (
                                    <span className="text-xs text-slate-500 dark:text-slate-400 block truncate italic">
                                      {stats.properties}
                                    </span>
                                  )}
                                  {statsText && !stats?.damage && !stats?.damageDice && !stats?.armor && !stats?.baseAC && (
                                    <span className="text-xs text-slate-500 dark:text-slate-400 block truncate">
                                      {statsText}
                                    </span>
                                  )}
                                </div>
                              <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                <Select 
                                  value=""
                                  onValueChange={(slot) => {
                                    if (slot) {
                                      equipItemMutation.mutate({ characterId: activeCharacter.id, item: itemName, slot });
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-6 w-16 text-xs" data-testid={`select-equip-${index}`}>
                                    <SelectValue placeholder="Equip" />
                                  </SelectTrigger>
                                  <SelectContent 
                                    position="item-aligned"
                                    className="z-[9999] bg-white dark:bg-slate-800 border shadow-lg"
                                  >
                                    <SelectItem value="weapon">Weapon</SelectItem>
                                    <SelectItem value="armor">Armor</SelectItem>
                                    <SelectItem value="shield">Shield</SelectItem>
                                    <SelectItem value="accessory">Accessory</SelectItem>
                                  </SelectContent>
                                </Select>
                                {(participants?.length > 1 || partyNpcs?.length > 0) && (
                                  <Select 
                                    value=""
                                    onValueChange={(targetId) => {
                                      if (targetId) {
                                        if (targetId.startsWith('npc:')) {
                                          transferItemMutation.mutate({ 
                                            fromCharacterId: activeCharacter.id, 
                                            toNpcId: parseInt(targetId.replace('npc:', '')), 
                                            item: itemRaw 
                                          });
                                        } else {
                                          transferItemMutation.mutate({ 
                                            fromCharacterId: activeCharacter.id, 
                                            toCharacterId: parseInt(targetId), 
                                            item: itemRaw 
                                          });
                                        }
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="h-6 w-14 text-xs" data-testid={`select-transfer-${index}`}>
                                      <SelectValue placeholder="Give" />
                                    </SelectTrigger>
                                    <SelectContent 
                                      position="item-aligned"
                                      className="z-[9999] bg-white dark:bg-slate-800 border shadow-lg min-w-[150px]"
                                    >
                                      {participants
                                        .filter((p: any) => p.characterId && p.characterId !== activeCharacter.id)
                                        .map((p: any) => (
                                          <SelectItem key={p.characterId} value={p.characterId.toString()}>
                                            {p.character?.name || `Character ${p.characterId}`}
                                          </SelectItem>
                                        ))}
                                      {partyNpcs?.map((npc: any) => (
                                        <SelectItem key={`npc-${npc.id}`} value={`npc:${npc.id}`}>
                                          {npc.name} (Companion)
                                        </SelectItem>
                                      ))}
                                      {participants.filter((p: any) => p.characterId && p.characterId !== activeCharacter.id).length === 0 && 
                                       (!partyNpcs || partyNpcs.length === 0) && (
                                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                          No party members or companions
                                        </div>
                                      )}
                                    </SelectContent>
                                  </Select>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                  onClick={() => removeItemMutation.mutate({ 
                                    characterId: activeCharacter.id, 
                                    item: itemRaw 
                                  })}
                                  disabled={removeItemMutation.isPending}
                                  data-testid={`button-remove-item-${index}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              </div>
                            </div>
                          );
                          })
                        ) : (!magicalInventory || magicalInventory.length === 0) && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 py-2">No items in inventory</p>
                        )}
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
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => useConsumableMutation.mutate({ characterId: activeCharacter.id, name: item.name })}
                                disabled={useConsumableMutation.isPending || activeCharacter.status === "dead"}
                                data-testid={`button-use-consumable-${index}`}
                              >
                                {useConsumableMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Use"}
                              </Button>
                              {partyNpcs.length > 0 && (
                                <Select onValueChange={(npcId) => {
                                  transferConsumableMutation.mutate({
                                    fromCharacterId: activeCharacter.id,
                                    toNpcId: parseInt(npcId),
                                    consumableName: item.name
                                  });
                                }}>
                                  <SelectTrigger className="w-20 h-8 text-xs" data-testid={`give-consumable-${index}`}>
                                    <SelectValue placeholder="Give" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {partyNpcs.map((npc: any) => (
                                      <SelectItem key={npc.id} value={npc.id.toString()}>
                                        {npc.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-600 dark:text-slate-400 py-2">No consumables. Add potions or scrolls!</p>
                      )}
                    </div>
                    
                    {/* Quick-Buy Consumables */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Quick-Buy</span>
                        <span className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Coins className="h-3 w-3" />
                          {(activeCharacter as any).gold || 0} gp
                        </span>
                      </div>
                      <Select onValueChange={(value) => {
                          // Healing items are bought AND used immediately
                          const healingItems = ['Healing Potion', 'Greater Healing Potion', 'Superior Healing Potion', 'Scroll of Cure Wounds'];
                          if (healingItems.includes(value)) {
                            quickBuyAndUseMutation.mutate({ characterId: activeCharacter.id, name: value });
                          } else {
                            // Non-healing items just get added to inventory
                            addConsumableMutation.mutate({ characterId: activeCharacter.id, name: value });
                          }
                        }}>
                        <SelectTrigger className="flex-1" data-testid="select-add-consumable">
                          <SelectValue placeholder="Quick-heal (buy & use)..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Healing Potion" disabled={((activeCharacter as any).gold || 0) < 10}>
                            Healing Potion (2d4+2 HP) - 10 gp
                          </SelectItem>
                          <SelectItem value="Antitoxin" disabled={((activeCharacter as any).gold || 0) < 8}>
                            Antitoxin - 8 gp
                          </SelectItem>
                          <SelectItem value="Scroll of Cure Wounds" disabled={((activeCharacter as any).gold || 0) < 12}>
                            Scroll of Cure Wounds (1d8+3 HP) - 12 gp
                          </SelectItem>
                          <SelectItem value="Scroll of Lesser Restoration" disabled={((activeCharacter as any).gold || 0) < 20}>
                            Scroll of Lesser Restoration - 20 gp
                          </SelectItem>
                          <SelectItem value="Greater Healing Potion" disabled={((activeCharacter as any).gold || 0) < 25}>
                            Greater Healing Potion (4d4+4 HP) - 25 gp
                          </SelectItem>
                          <SelectItem value="Potion of Resistance" disabled={((activeCharacter as any).gold || 0) < 35}>
                            Potion of Resistance - 35 gp
                          </SelectItem>
                          <SelectItem value="Superior Healing Potion" disabled={((activeCharacter as any).gold || 0) < 50}>
                            Superior Healing Potion (8d4+8 HP) - 50 gp
                          </SelectItem>
                          <SelectItem value="Scroll of Revivify" disabled={((activeCharacter as any).gold || 0) < 75}>
                            Scroll of Revivify (Resurrects) - 75 gp
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Visit the Tavern for better deals and more options!
                      </p>
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
                    {/* NPC Header with Portrait */}
                    <div className="flex items-start gap-4 mb-4">
                      <div className="relative w-20 h-20 flex-shrink-0">
                        {selectedNpc.portraitUrl ? (
                          <img 
                            src={selectedNpc.portraitUrl} 
                            alt={`${selectedNpc.name} portrait`}
                            className="w-full h-full rounded-lg object-cover border-2 border-amber-400"
                          />
                        ) : (
                          <div className="w-full h-full rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-dashed border-slate-500 flex items-center justify-center">
                            <User className="h-8 w-8 text-slate-400" />
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute -bottom-1 -right-1 h-6 w-6 p-0 rounded-full bg-amber-500 hover:bg-amber-600 text-white"
                          onClick={() => generateNpcPortraitMutation.mutate(selectedNpc.id)}
                          disabled={generateNpcPortraitMutation.isPending}
                          title="Generate Portrait"
                        >
                          {generateNpcPortraitMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Camera className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <Backpack className="h-5 w-5 text-amber-600" />
                          {selectedNpc.name}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {selectedNpc.class || 'Companion'} {selectedNpc.race ? `• ${selectedNpc.race}` : ''}
                        </p>
                        <p className="text-xs text-slate-500 capitalize">{selectedNpc.status || 'conscious'}</p>
                      </div>
                    </div>
                    
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
                            {getEquipmentName(selectedNpc.equippedWeapon)}
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
                            {getEquipmentName(selectedNpc.equippedArmor)}
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
                            {getEquipmentName(selectedNpc.equippedShield)}
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
                            {getEquipmentName(selectedNpc.equippedAccessory)}
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
                      <div className="text-sm font-medium">Items ({selectedNpc.inventory?.length || 0})</div>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {selectedNpc.inventory && selectedNpc.inventory.length > 0 ? (
                          selectedNpc.inventory.map((itemRaw: string, index: number) => {
                            const itemDetails = parseEquipmentItem(itemRaw);
                            return (
                              <div key={index} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700 rounded text-sm" data-testid={`npc-item-${index}`}>
                                <div className="flex-1 min-w-0">
                                  <span className={`font-medium block truncate ${itemDetails.rarity ? getRarityColor(itemDetails.rarity) : ''}`}>
                                    {itemDetails.name}
                                  </span>
                                  {itemDetails.type && (
                                    <span className="text-xs text-slate-500 block">
                                      {itemDetails.type}
                                      {itemDetails.damage && ` • ${itemDetails.damage}`}
                                      {itemDetails.armor && ` • AC ${itemDetails.armor}`}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Select 
                                    value=""
                                    onValueChange={(slot) => {
                                      if (slot) {
                                        equipNpcItemMutation.mutate({ npcId: selectedNpc.id, item: itemRaw, slot });
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
                                    onClick={() => removeNpcItemMutation.mutate({ npcId: selectedNpc.id, item: itemRaw })}
                                    disabled={removeNpcItemMutation.isPending}
                                    data-testid={`button-npc-remove-item-${index}`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-sm text-slate-600 dark:text-slate-400 py-2">No items in inventory</p>
                        )}
                      </div>
                    </div>
                    
                    {/* NPC Consumables Section */}
                    <div className="mt-4 space-y-2">
                      <div className="text-sm font-medium flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 text-green-500" />
                        Consumables
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {(() => {
                          const npcConsumables = Array.isArray(selectedNpc.consumables) 
                            ? selectedNpc.consumables 
                            : (typeof selectedNpc.consumables === 'string' 
                              ? JSON.parse(selectedNpc.consumables) 
                              : []);
                          return npcConsumables.length > 0 ? (
                            npcConsumables.map((item: any, index: number) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded text-sm border border-green-200 dark:border-green-800" data-testid={`npc-consumable-${index}`}>
                                <div className="flex-1">
                                  <span className="font-medium">{item.name}</span>
                                  <span className="text-xs text-slate-500 ml-2">x{item.quantity}</span>
                                  <div className="text-xs text-slate-600 dark:text-slate-400">{item.effect}</div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs bg-green-100 hover:bg-green-200 dark:bg-green-800 dark:hover:bg-green-700 border-green-300 dark:border-green-600"
                                  onClick={() => useNpcConsumableMutation.mutate({ npcId: selectedNpc.id, name: item.name })}
                                  disabled={useNpcConsumableMutation.isPending || selectedNpc.status === "dead"}
                                  data-testid={`button-npc-use-consumable-${index}`}
                                >
                                  {useNpcConsumableMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Use"}
                                </Button>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-slate-600 dark:text-slate-400 py-2">No consumables. Add healing potions!</p>
                          );
                        })()}
                      </div>
                      
                      {/* NPC Quick-Buy Consumables */}
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Quick-Buy</span>
                          <span className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <Coins className="h-3 w-3" />
                            {selectedNpc.gold || 0} gp
                          </span>
                        </div>
                        <Select onValueChange={(value) => {
                          if (!value || !selectedNpc) return;
                          const isHealingItem = value.includes("Healing") || value.includes("Cure Wounds");
                          if (isHealingItem) {
                            npcQuickBuyAndUseMutation.mutate({ npcId: selectedNpc.id, name: value });
                          } else {
                            addNpcConsumableMutation.mutate({ npcId: selectedNpc.id, name: value });
                          }
                        }}>
                          <SelectTrigger className="w-full" data-testid="select-npc-quick-buy">
                            <SelectValue placeholder="Buy consumable..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Healing Potion">Healing Potion (10 gp) - 2d4+2 HP</SelectItem>
                            <SelectItem value="Greater Healing Potion">Greater Healing Potion (25 gp) - 4d4+4 HP</SelectItem>
                            <SelectItem value="Superior Healing Potion">Superior Healing Potion (50 gp) - 8d4+8 HP</SelectItem>
                            <SelectItem value="Supreme Healing Potion">Supreme Healing Potion (100 gp) - 10d4+20 HP</SelectItem>
                            <SelectItem value="Scroll of Cure Wounds">Scroll of Cure Wounds (12 gp) - 1d8+3 HP</SelectItem>
                            <SelectItem value="Potion of Resistance">Potion of Resistance (35 gp) - Damage resist 1hr</SelectItem>
                            <SelectItem value="Antitoxin">Antitoxin (8 gp) - Poison Advantage</SelectItem>
                            <SelectItem value="Scroll of Lesser Restoration">Lesser Restoration (20 gp) - End condition</SelectItem>
                            <SelectItem value="Scroll of Revivify">Scroll of Revivify (75 gp) - Resurrect</SelectItem>
                          </SelectContent>
                        </Select>
                        {(npcQuickBuyAndUseMutation.isPending || addNpcConsumableMutation.isPending) && (
                          <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Purchasing...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* NPC Gold Display */}
                {selectedPartyMemberType === "npc" && selectedNpc && (
                  <div className="mt-6 p-4 border rounded-lg bg-white dark:bg-slate-800">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Coins className="h-5 w-5 text-yellow-500" />
                      Gold - {selectedNpc.name}
                    </h3>
                    <div className="p-2 border rounded bg-gradient-to-b from-yellow-100 to-yellow-200 dark:from-yellow-900/50 dark:to-yellow-800/50 text-center mb-3">
                      <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{selectedNpc.gold || 0} GP</div>
                    </div>
                    {activeCharacter && (
                      <div className="space-y-2">
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          Give gold to {selectedNpc.name} (You have {activeCharacter.gold || 0} GP)
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="1"
                            max={activeCharacter.gold || 0}
                            value={giveGoldAmount}
                            onChange={(e) => setGiveGoldAmount(e.target.value)}
                            placeholder="Amount"
                            className="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const amount = parseInt(giveGoldAmount);
                              if (amount > 0 && activeCharacter.id && selectedNpc.id) {
                                transferGoldMutation.mutate({
                                  fromCharacterId: activeCharacter.id,
                                  toNpcId: selectedNpc.id,
                                  amount
                                });
                                setGiveGoldAmount("");
                              }
                            }}
                            disabled={!giveGoldAmount || parseInt(giveGoldAmount) <= 0 || parseInt(giveGoldAmount) > (activeCharacter.gold || 0) || transferGoldMutation.isPending}
                          >
                            {transferGoldMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Coins className="h-4 w-4 mr-1" />
                                Give
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* NPC Rest Section */}
                {selectedPartyMemberType === "npc" && selectedNpc && !parsedStoryState?.inCombat && (
                  <div className="mt-6 p-4 border rounded-lg bg-white dark:bg-slate-800">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Moon className="h-5 w-5 text-indigo-500" />
                      Rest - {selectedNpc.name}
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => npcShortRestMutation.mutate({ npcId: selectedNpc.id })}
                        disabled={npcShortRestMutation.isPending || npcLongRestMutation.isPending || selectedNpc.status === "dead" || selectedNpc.status === "unconscious"}
                        data-testid="button-npc-short-rest"
                      >
                        {npcShortRestMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Coffee className="h-4 w-4 mr-2" />
                        )}
                        Short Rest (25% HP)
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => npcLongRestMutation.mutate({ npcId: selectedNpc.id })}
                        disabled={npcShortRestMutation.isPending || npcLongRestMutation.isPending || selectedNpc.status === "dead"}
                        data-testid="button-npc-long-rest"
                      >
                        {npcLongRestMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Moon className="h-4 w-4 mr-2" />
                        )}
                        Long Rest (Full HP)
                      </Button>
                    </div>
                    {selectedNpc.status === "dead" && (
                      <p className="text-sm text-red-500 mt-2">Dead companions cannot rest.</p>
                    )}
                    {selectedNpc.status === "unconscious" && (
                      <p className="text-sm text-orange-500 mt-2">Unconscious companions must be stabilized or healed first.</p>
                    )}
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
            
            <TabsContent value="chat" className="p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold font-fantasy flex items-center" style={{ color: '#0f172a' }}>
                    <MessageCircle className="h-5 w-5 mr-2 text-indigo-600" />
                    Party Chat
                  </h2>
                  <Badge variant="outline" className="text-slate-700 dark:text-slate-300">
                    <Users className="h-3 w-3 mr-1" />
                    {participants.length} party members
                  </Badge>
                </div>
                
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Coordinate with your party members in real-time. Messages are visible to all players in this campaign.
                </p>
                
                {/* Chat messages container */}
                <div 
                  className="h-[400px] overflow-y-auto border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 p-4 space-y-3"
                  data-testid="chat-messages-container"
                >
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                      <MessageCircle className="h-12 w-12 mb-2 opacity-50" />
                      <p className="text-center">No messages yet. Start a conversation with your party!</p>
                    </div>
                  ) : (
                    chatMessages.map((msg, index) => (
                      <div 
                        key={msg.id || index}
                        className={`flex flex-col ${msg.userId === user?.id ? 'items-end' : 'items-start'}`}
                        data-testid={`chat-message-${msg.id || index}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {msg.displayName || msg.username}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div 
                          className={`max-w-[80%] px-4 py-2 rounded-lg ${
                            msg.userId === user?.id 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          <p className="text-sm">{msg.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                  
                  {/* Typing indicator */}
                  {typingUsers.length > 0 && (
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <div className="flex gap-1">
                        <span className="animate-bounce">.</span>
                        <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>.</span>
                        <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
                      </div>
                      <span>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...</span>
                    </div>
                  )}
                </div>
                
                {/* Chat input */}
                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                    placeholder="Type a message to your party..."
                    className="flex-1 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                    disabled={isSendingChat}
                    data-testid="input-chat-message"
                  />
                  <Button
                    onClick={() => sendChatMessage()}
                    disabled={!chatInput.trim() || isSendingChat}
                    className="bg-indigo-600 hover:bg-indigo-700"
                    data-testid="button-send-chat"
                  >
                    {isSendingChat ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                
                {/* Quick action buttons for coordination */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Quick Actions</h4>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => sendChatMessage("Ready to continue!")}
                      disabled={isSendingChat}
                      className="text-xs"
                      data-testid="button-quick-ready"
                    >
                      Ready!
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => sendChatMessage("Need a short break")}
                      disabled={isSendingChat}
                      className="text-xs"
                      data-testid="button-quick-break"
                    >
                      Need Break
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => sendChatMessage("Let's discuss this choice")}
                      disabled={isSendingChat}
                      className="text-xs"
                      data-testid="button-quick-discuss"
                    >
                      Discuss
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => sendChatMessage("I vote we go with that option!")}
                      disabled={isSendingChat}
                      className="text-xs"
                      data-testid="button-quick-vote"
                    >
                      Vote Yes
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="settings" className="p-4">
              <div className="space-y-4">
                <h2 className="text-xl font-bold font-fantasy" style={{ color: '#0f172a' }}>Campaign Settings</h2>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold" style={{ color: '#0f172a' }}>Narrative Style</label>
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
                    <label className="text-sm font-semibold" style={{ color: '#0f172a' }}>Difficulty</label>
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
                  
                  {/* Adventure Log Export */}
                  <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border-2 border-slate-300 dark:border-slate-600 mt-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Download className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <h3 className="font-bold text-slate-900 dark:text-slate-100">Download Adventure Log</h3>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                      Export a complete record of everything that happened in this adventure - all movement, combat, items, and story events in CAML-trace format.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadTrace('yaml')}
                        disabled={isDownloadingTrace}
                        className="flex items-center gap-2"
                        data-testid="button-download-trace-yaml"
                        aria-label="Download adventure log in YAML format"
                      >
                        {isDownloadingTrace ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <FileText className="h-4 w-4" aria-hidden="true" />
                        )}
                        Download YAML
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadTrace('json')}
                        disabled={isDownloadingTrace}
                        className="flex items-center gap-2"
                        data-testid="button-download-trace-json"
                        aria-label="Download adventure log in JSON format"
                      >
                        {isDownloadingTrace ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <FileJson className="h-4 w-4" aria-hidden="true" />
                        )}
                        Download JSON
                      </Button>
                    </div>
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
            
            {isDM && (
              <TabsContent value="dashboard" className="p-0">
                <CampaignDashboard 
                  campaign={campaign}
                  currentSession={currentSession || null}
                  participants={participants}
                  campaignNpcs={campaignNpcs}
                  campaignQuests={campaignQuests}
                />
              </TabsContent>
            )}
            
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
                  <div className="font-semibold text-amber-600 dark:text-amber-400">{item.name}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300 mb-1">
                    {item.type} • {item.rarity}
                  </div>
                  <div className="text-sm text-slate-800 dark:text-slate-200">{item.description}</div>
                  {item.properties && (
                    <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 italic">
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
      
      {/* Detailed Combat Log Dialog - D&D Mechanics Transparency */}
      <Dialog open={showCombatLogDialog} onOpenChange={setShowCombatLogDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              ⚔️ Combat Report - D&D Mechanics
            </DialogTitle>
            <DialogDescription>
              See exactly how combat was resolved using authentic D&D 5e rules. This helps you learn the mechanics!
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {detailedCombatLogs.map((log, index) => (
              <div 
                key={index} 
                className={`p-4 rounded-lg border-2 ${
                  log.attackerType === 'enemy' 
                    ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700' 
                    : 'bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700'
                }`}
              >
                {/* Attack Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">
                      {log.attackerType === 'enemy' ? '👹' : log.attackerType === 'companion' ? '🗡️' : '🛡️'} {log.attacker} → {log.target}
                    </span>
                    {log.attackerType === 'companion' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        NPC Companion
                      </span>
                    )}
                    {log.targetType === 'companion' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                        Companion Targeted
                      </span>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded text-sm font-bold ${
                    log.attackRoll.isCritical 
                      ? 'bg-yellow-400 text-yellow-900' 
                      : log.attackRoll.isCriticalMiss 
                      ? 'bg-gray-400 text-gray-900'
                      : log.isHit 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-300 text-gray-700'
                  }`}>
                    {log.attackRoll.isCritical ? '🎯 CRITICAL!' : log.attackRoll.isCriticalMiss ? '❌ FUMBLE!' : log.isHit ? '✓ HIT' : '✗ MISS'}
                  </span>
                </div>
                
                {/* Attack Roll Breakdown */}
                <div className="bg-white dark:bg-gray-800 p-3 rounded-md mb-2 font-mono text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-gray-500">Attack Roll:</span>
                    <span className={`px-2 py-0.5 rounded font-bold ${
                      log.attackRoll.roll === 20 ? 'bg-yellow-200 text-yellow-800' : 
                      log.attackRoll.roll === 1 ? 'bg-red-200 text-red-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      d20({log.attackRoll.roll})
                    </span>
                    <span>+</span>
                    <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                      {log.attackRoll.modifier} modifier
                    </span>
                    <span>=</span>
                    <span className="font-bold text-lg">{log.attackRoll.total}</span>
                    <span className="text-gray-500">vs</span>
                    <span className="bg-gray-200 text-gray-800 px-2 py-0.5 rounded font-bold">
                      AC {log.targetAC}
                    </span>
                  </div>
                  
                  {/* D&D Rule Explanation */}
                  <div className="text-xs text-gray-500 mt-1 italic">
                    {log.attackRoll.isCritical 
                      ? "Natural 20! Critical hit automatically succeeds and doubles damage dice."
                      : log.attackRoll.isCriticalMiss 
                      ? "Natural 1! Critical miss automatically fails regardless of bonuses."
                      : log.isHit 
                      ? `Total (${log.attackRoll.total}) ≥ Target AC (${log.targetAC}) = Hit!`
                      : `Total (${log.attackRoll.total}) < Target AC (${log.targetAC}) = Miss`
                    }
                  </div>
                </div>
                
                {/* Damage Breakdown (if hit) */}
                {log.isHit && log.damage && (
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-md mb-2 font-mono text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gray-500">Damage:</span>
                      {log.damage.diceRolls.map((roll, i) => (
                        <span key={i} className="bg-red-100 text-red-800 px-2 py-0.5 rounded">
                          {log.damage?.diceType}({roll})
                        </span>
                      ))}
                      {log.damage.modifier > 0 && (
                        <>
                          <span>+</span>
                          <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                            {log.damage.modifier}
                          </span>
                        </>
                      )}
                      <span>=</span>
                      <span className={`font-bold text-lg ${log.damage.isCritical ? 'text-yellow-600' : 'text-red-600'}`}>
                        {log.damage.total} damage
                      </span>
                      {log.damage.isCritical && (
                        <span className="text-yellow-600 text-xs">⚡ Critical (2x dice!)</span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Result */}
                <div className="text-sm mt-2">
                  <p className="font-medium">{log.description}</p>
                  {log.isHit && log.targetNewHp !== undefined && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-gray-500">{log.target} HP:</span>
                      <div className="flex-1 max-w-[150px] bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            (log.targetNewHp / (log.targetMaxHp || 1)) <= 0.25 ? 'bg-red-500' : 
                            (log.targetNewHp / (log.targetMaxHp || 1)) <= 0.5 ? 'bg-orange-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.max(0, ((log.targetNewHp || 0) / (log.targetMaxHp || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="font-mono text-sm">{log.targetNewHp}/{log.targetMaxHp}</span>
                      {log.targetNewHp <= 0 && (
                        <span className="text-red-600 font-bold">💀 DOWN!</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Educational Footer */}
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-bold text-blue-800 dark:text-blue-200 text-sm mb-1">📚 D&D 5e Combat Rules</h4>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <li>• <b>Attack Roll:</b> Roll d20 + attack modifier vs target's Armor Class (AC)</li>
              <li>• <b>Natural 20:</b> Critical hit! Automatically hits and doubles damage dice</li>
              <li>• <b>Natural 1:</b> Critical miss! Always fails regardless of modifiers</li>
              <li>• <b>Damage:</b> On hit, roll damage dice + modifier to determine damage dealt</li>
            </ul>
          </div>

          <div className="flex justify-end mt-4">
            <Button onClick={() => setShowCombatLogDialog(false)}>
              Continue Adventure
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Campaign Completion Dialog - Victory! */}
      <Dialog open={campaignComplete} onOpenChange={setCampaignComplete}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              🏆 Victory! Campaign Complete!
            </DialogTitle>
            <DialogDescription>
              Congratulations, brave adventurer! You have completed "{campaign.title}" and emerged victorious!
            </DialogDescription>
          </DialogHeader>
          
          {completionRewards && (
            <div className="space-y-4">
              {/* XP and Gold Summary */}
              <div className="flex gap-4 justify-center p-4 bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30 rounded-lg">
                <div className="text-center">
                  <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                    +{completionRewards.xp}
                  </div>
                  <div className="text-sm text-amber-700 dark:text-amber-300">Experience Points</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                    +{completionRewards.gold}
                  </div>
                  <div className="text-sm text-yellow-700 dark:text-yellow-300">Gold Pieces</div>
                </div>
              </div>
              
              {/* Loot Chest */}
              <div className="p-4 bg-gradient-to-b from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg border-2 border-amber-300 dark:border-amber-700">
                <h4 className="font-bold text-lg text-amber-800 dark:text-amber-200 mb-3 flex items-center gap-2">
                  🎁 Treasure Chest Loot
                </h4>
                <div className="space-y-2">
                  {completionRewards.items.map((item, index) => (
                    <div 
                      key={index} 
                      className={`p-3 rounded-lg border ${
                        item.rarity === 'rare' 
                          ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600' 
                          : item.rarity === 'uncommon'
                          ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-600'
                          : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-semibold">{item.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          item.rarity === 'rare' 
                            ? 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200' 
                            : item.rarity === 'uncommon'
                            ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200'
                            : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}>
                          {item.rarity}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{item.description}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">{item.type} • {item.properties}</div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Completion Message */}
              <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800 text-center">
                <p className="text-purple-800 dark:text-purple-200 text-sm">
                  Your heroic deeds will be remembered throughout the realm! 
                  The items have been added to your character's inventory.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-center mt-4">
            <Button 
              onClick={() => {
                setCampaignComplete(false);
                setCompletionRewards(null);
              }}
              className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-bold px-8"
            >
              🎉 Celebrate Victory!
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expanded Hex Map Dialog */}
      <Dialog open={isMapExpanded} onOpenChange={setIsMapExpanded}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Map className="h-5 w-5" />
              {currentLocation || 'Dungeon Map'} 
              <span className="text-sm font-normal text-muted-foreground ml-2">⬡ Hex Grid</span>
            </DialogTitle>
            <DialogDescription>
              Explore the terrain - each hex represents your movement options
            </DialogDescription>
          </DialogHeader>
          
          {dungeonMapData && dungeonMapData.tiles ? (() => {
            // Larger hex size for expanded view
            const hexSize = 32;
            const hexWidth = hexSize;
            const hexHeight = Math.floor(hexSize * 1.15);
            const hexHorizontalSpacing = Math.floor(hexWidth * 0.78);
            const hexVerticalSpacing = Math.floor(hexHeight * 0.5);
            const hexOffset = Math.floor(hexHorizontalSpacing * 0.5);
            const mapWidth = (dungeonMapData.tiles[0]?.length || 20);
            const mapHeight = dungeonMapData.tiles.length;
            const containerWidth = mapWidth * hexHorizontalSpacing + hexOffset + hexWidth;
            const containerHeight = mapHeight * hexVerticalSpacing + hexHeight;
            
            return (
              <div 
                className="rounded-xl overflow-hidden mx-auto"
                style={{ 
                  background: 'linear-gradient(135deg, #8B4513 0%, #A0522D 25%, #8B4513 50%, #6B3E0C 75%, #8B4513 100%)',
                  padding: '6px',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.5)'
                }}
              >
                {/* Parchment inner container */}
                <div 
                  className="rounded-lg relative overflow-auto p-4"
                  style={{
                    background: 'linear-gradient(to bottom right, #e8dcc4 0%, #d4c4a8 50%, #c9b896 100%)',
                    maxHeight: '60vh',
                  }}
                >
                  {/* Decorative dice corners */}
                  <div className="absolute top-2 left-2 z-30 opacity-50">
                    <div className="w-6 h-6 bg-gradient-to-br from-red-600 to-red-800 rounded-sm rotate-12 flex items-center justify-center text-white text-xs font-bold shadow-md">20</div>
                  </div>
                  <div className="absolute top-2 right-2 z-30 opacity-50">
                    <div className="w-5 h-5 bg-gradient-to-br from-blue-600 to-blue-800 rounded-sm -rotate-6 flex items-center justify-center text-white text-[10px] font-bold shadow-md">12</div>
                  </div>
                  
                  {/* Hex grid */}
                  <div 
                    className="relative mx-auto"
                    style={{
                      width: containerWidth,
                      height: containerHeight,
                      minHeight: '200px',
                    }}
                  >
                    {dungeonMapData.tiles.map((row: any[], y: number) => 
                      row.map((tile: any, x: number) => {
                        const isPlayer = dungeonMapData.playerPosition?.x === x && dungeonMapData.playerPosition?.y === y;
                        const isOddRow = y % 2 === 1;
                        const hexX = x * hexHorizontalSpacing + (isOddRow ? hexOffset : 0);
                        const hexY = y * hexVerticalSpacing;
                        
                        let bgColor = mapEnvironment.wall;
                        if (tile?.type === 'floor') {
                          bgColor = mapEnvironment.floor;
                        } else if (tile?.type === 'corridor') {
                          bgColor = mapEnvironment.corridor;
                        } else if (tile?.type === 'door') {
                          bgColor = mapEnvironment.door;
                        } else if (tile?.type === 'stairs') {
                          bgColor = mapEnvironment.stairs;
                        } else if (tile?.type === 'chest' || tile?.type === 'treasure') {
                          bgColor = '#eab308';
                        }
                        
                        // HexMetaV2: Narrative tone icons for expanded map
                        const toneIcons: Record<string, { icon: string; color: string }> = {
                          "Whispering": { icon: "👁", color: "#c084fc" },
                          "Sacred": { icon: "✧", color: "#fbbf24" },
                          "Watched": { icon: "◉", color: "#f87171" },
                          "Unstable": { icon: "⚠", color: "#fb923c" },
                          "Forgotten": { icon: "◇", color: "#94a3b8" },
                          "Hostile": { icon: "☠", color: "#ef4444" },
                          "Benevolent": { icon: "♥", color: "#4ade80" },
                          "Sealed": { icon: "🔒", color: "#60a5fa" },
                          "Cursed": { icon: "☽", color: "#a78bfa" },
                          "Ancient": { icon: "⌘", color: "#d97706" },
                        };
                        const narrativeTone = tile?.narrative?.narrativeTone;
                        const toneData = narrativeTone ? toneIcons[narrativeTone] : null;
                        // Only show markers within 3 tiles of the player
                        const playerX = dungeonMapData.playerPosition?.x || 0;
                        const playerY = dungeonMapData.playerPosition?.y || 0;
                        const distance = Math.abs(x - playerX) + Math.abs(y - playerY);
                        const isNearPlayer = distance <= 4;
                        const hasNarrative = toneData && (tile?.type === 'floor' || tile?.type === 'corridor') && isNearPlayer;
                        
                        return (
                          <div 
                            key={`expanded-${x}-${y}`} 
                            className="absolute group"
                            style={{ 
                              width: hexWidth,
                              height: hexHeight,
                              left: hexX,
                              top: hexY,
                            }}
                          >
                            {/* Narrative marker - only visible on hover */}
                            {hasNarrative && toneData && (
                              <div 
                                className="absolute z-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                style={{ 
                                  top: -4, left: -4, width: '16px', height: '16px',
                                  backgroundColor: 'rgba(0,0,0,0.85)',
                                  color: toneData.color,
                                  fontSize: '10px',
                                  border: `1px solid ${toneData.color}`,
                                }}
                                title={tile?.narrative?.tooltipNote || narrativeTone}
                              >
                                {toneData.icon}
                              </div>
                            )}
                            {/* Main hex tile */}
                            <div 
                              className="absolute inset-0 transition-all hover:brightness-110"
                              style={{ 
                                backgroundColor: isPlayer ? '#22c55e' : bgColor,
                                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                                boxShadow: isPlayer 
                                  ? '0 0 12px 4px rgba(34,197,94,0.7)' 
                                  : 'inset 0 0 0 2px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.2)',
                              }} 
                            >
                              {isPlayer && (
                                <div className="w-full h-full flex items-center justify-center">
                                  <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center animate-pulse">
                                    <User className="w-3 h-3 text-green-600" />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
                
                {/* Legend */}
                <div className="flex items-center justify-center gap-4 py-2 px-3 text-xs" style={{ background: 'linear-gradient(to bottom, #e8d4b8, #d4c4a8)', color: '#5c3d1e' }}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-4" style={{ backgroundColor: '#22c55e', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}></span> 
                    <span className="font-medium">You</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-4" style={{ backgroundColor: mapEnvironment.floor, clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}></span> 
                    <span className="font-medium">{mapEnvironment.labels.floor}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-4" style={{ backgroundColor: mapEnvironment.door, clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}></span> 
                    <span className="font-medium">{mapEnvironment.labels.door}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-4" style={{ backgroundColor: mapEnvironment.wall, clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}></span> 
                    <span className="font-medium">Wall</span>
                  </span>
                  {/* Regenerate Map Button */}
                  <button
                    onClick={() => {
                      setIsMapExpanded(false);
                      handleGenerateMap();
                    }}
                    disabled={isGeneratingMap}
                    className="ml-4 px-3 py-1 text-xs font-medium rounded-md transition-colors"
                    style={{
                      background: 'linear-gradient(to bottom, #8B4513, #6B3E0C)',
                      color: '#f5deb3',
                      border: '1px solid #5c3d1e',
                    }}
                  >
                    {isGeneratingMap ? 'Generating...' : '↻ Regenerate Map'}
                  </button>
                </div>
              </div>
            );
          })() : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              No map data available
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Learning Tips - micro-learning after D&D mechanics */}
      <LearningTip 
        type={currentTip.type}
        show={currentTip.show}
        tipId={currentTip.tipId}
        onClose={hideTip}
        onLearnMore={() => {
          window.open('/learn', '_blank');
        }}
      />
    </div>
  );
}

export default CampaignPanel;