import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  PlayCircle,
  Users,
  BookOpen,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  Calendar,
  MapPin,
  Target,
  Lightbulb,
  Shield,
  Zap,
  Globe,
  Loader2,
  Settings,
  UserPlus,
  Edit,
  Eye,
  Activity,
  Sparkles,
  Coins,
  Package,
  Star,
  TrendingUp,
  Gift,
  Sword,
  Crown,
  Dice6,
} from "lucide-react";

interface LiveCampaignManagerTabProps {
  selectedCampaignId: number | null;
  onCampaignSelect: (campaignId: number) => void;
}

export default function LiveCampaignManagerTab({ 
  selectedCampaignId, 
  onCampaignSelect 
}: LiveCampaignManagerTabProps) {
  const [activeManagerTab, setActiveManagerTab] = useState("overview");
  const [showCreateSessionDialog, setShowCreateSessionDialog] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [sessionDescription, setSessionDescription] = useState("");
  const [sessionType, setSessionType] = useState("");
  
  // Content creation and editing states
  const [showContentDialog, setShowContentDialog] = useState(false);
  const [contentType, setContentType] = useState("");
  const [editingContent, setEditingContent] = useState<any>(null);
  
  // XP and rewards states
  const [showRewardDialog, setShowRewardDialog] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<any>(null);
  const [rewardType, setRewardType] = useState("");
  const [xpAmount, setXpAmount] = useState("");
  const [rewardReason, setRewardReason] = useState("");
  
  // Inventory management states
  const [showInventoryDialog, setShowInventoryDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [itemQuantity, setItemQuantity] = useState(1);

  // Quick Actions states
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [playerEmail, setPlayerEmail] = useState("");
  const [isLiveSession, setIsLiveSession] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch campaigns
  const { data: campaigns = [] } = useQuery<any[]>({
    queryKey: ["/api/campaigns"],
  });

  // Fetch selected campaign details
  const { data: selectedCampaign } = useQuery({
    queryKey: [`/api/campaigns/${selectedCampaignId}`],
    enabled: !!selectedCampaignId,
  });

  // Fetch campaign sessions
  const { data: sessions = [] } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${selectedCampaignId}/sessions`],
    enabled: !!selectedCampaignId,
  });

  // Fetch campaign participants
  const { data: participants = [] } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${selectedCampaignId}/participants`],
    enabled: !!selectedCampaignId,
  });

  // Fetch all content for quick access during live sessions
  const { data: quests = [] } = useQuery<any[]>({
    queryKey: ["/api/quests"],
  });
  
  const { data: locations = [] } = useQuery<any[]>({
    queryKey: ["/api/locations"],
  });
  
  const { data: monsters = [] } = useQuery<any[]>({
    queryKey: ["/api/monsters"],
  });
  
  const { data: magicItems = [] } = useQuery<any[]>({
    queryKey: ["/api/magic-items"],
  });

  const { data: characters = [] } = useQuery<any[]>({
    queryKey: ["/api/characters"],
  });

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: async (data: {
      campaignId: number;
      name: string;
      description: string;
      sessionType: string;
    }) => {
      return await apiRequest("POST", `/api/campaigns/${data.campaignId}/sessions`, {
        name: data.name,
        description: data.description,
        sessionType: data.sessionType,
        status: "planned",
      });
    },
    onSuccess: () => {
      toast({
        title: "Session Created",
        description: "Your campaign session has been created successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${selectedCampaignId}/sessions`] });
      setShowCreateSessionDialog(false);
      setSessionName("");
      setSessionDescription("");
      setSessionType("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // XP and Reward Management Mutations
  const awardXPMutation = useMutation({
    mutationFn: async (data: { characterId: number; xp: number; reason: string }) => {
      return await apiRequest("POST", "/api/characters/award-xp", data);
    },
    onSuccess: () => {
      toast({
        title: "XP Awarded",
        description: `${xpAmount} XP awarded to ${selectedParticipant?.character?.name}`,
      });
      setShowRewardDialog(false);
      setXpAmount("");
      setRewardReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${selectedCampaignId}/participants`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addItemToInventoryMutation = useMutation({
    mutationFn: async (data: { characterId: number; itemId: number; quantity: number }) => {
      return await apiRequest("POST", "/api/characters/add-item", data);
    },
    onSuccess: () => {
      toast({
        title: "Item Added",
        description: `${selectedItem?.name} added to ${selectedParticipant?.character?.name}'s inventory`,
      });
      setShowInventoryDialog(false);
      setSelectedItem(null);
      setItemQuantity(1);
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Content Creation/Editing Mutations (for quick access during live sessions)
  const createContentMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = `/api/${contentType}s`;
      return await apiRequest("POST", endpoint, data);
    },
    onSuccess: () => {
      toast({
        title: "Content Created",
        description: `${contentType} created successfully`,
      });
      setShowContentDialog(false);
      setEditingContent(null);
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: [`/api/${contentType}s`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateContentMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = `/api/${contentType}s/${data.id}`;
      return await apiRequest("PUT", endpoint, data);
    },
    onSuccess: () => {
      toast({
        title: "Content Updated",
        description: `${contentType} updated successfully`,
      });
      setShowContentDialog(false);
      setEditingContent(null);
      queryClient.invalidateQueries({ queryKey: [`/api/${contentType}s`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateSession = () => {
    if (!selectedCampaignId || !sessionName.trim() || !sessionType) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    createSessionMutation.mutate({
      campaignId: selectedCampaignId,
      name: sessionName,
      description: sessionDescription,
      sessionType,
    });
  };

  const handleAwardXP = () => {
    if (!selectedParticipant || !xpAmount || !rewardReason.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select a participant, enter XP amount, and provide a reason",
        variant: "destructive",
      });
      return;
    }

    awardXPMutation.mutate({
      characterId: selectedParticipant.characterId,
      xp: parseInt(xpAmount),
      reason: rewardReason,
    });
  };

  const handleAddItemToInventory = () => {
    if (!selectedParticipant || !selectedItem) {
      toast({
        title: "Missing Information",
        description: "Please select a participant and an item",
        variant: "destructive",
      });
      return;
    }

    addItemToInventoryMutation.mutate({
      characterId: selectedParticipant.characterId,
      itemId: selectedItem.id,
      quantity: itemQuantity,
    });
  };

  const handleQuickContentCreation = (type: string) => {
    setContentType(type);
    setEditingContent(null);
    setShowContentDialog(true);
  };

  const handleQuickContentEdit = (type: string, content: any) => {
    setContentType(type);
    setEditingContent(content);
    setShowContentDialog(true);
  };

  // Live Session Management
  const startLiveSessionMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/campaigns/${selectedCampaignId}/start-live-session`, {});
    },
    onSuccess: () => {
      setIsLiveSession(true);
      toast({
        title: "Live Session Started",
        description: "Your campaign is now live! Players can join and participate in real-time.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const endLiveSessionMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/campaigns/${selectedCampaignId}/end-live-session`, {});
    },
    onSuccess: () => {
      setIsLiveSession(false);
      toast({
        title: "Live Session Ended",
        description: "The live session has been ended. You can start a new session anytime.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Player Invitation
  const generateInviteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/campaigns/${selectedCampaignId}/generate-invite`, {});
    },
    onSuccess: (data: any) => {
      setInviteCode(data.inviteCode);
      toast({
        title: "Invite Code Generated",
        description: "Share this code with your players to join the campaign.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const invitePlayerMutation = useMutation({
    mutationFn: async (email: string) => {
      return await apiRequest("POST", `/api/campaigns/${selectedCampaignId}/invite-player`, { email });
    },
    onSuccess: () => {
      toast({
        title: "Invitation Sent",
        description: `Invitation sent to ${playerEmail}`,
      });
      setPlayerEmail("");
      setShowInviteDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Campaign Settings
  const updateCampaignMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PUT", `/api/campaigns/${selectedCampaignId}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Campaign Updated",
        description: "Campaign settings have been saved successfully.",
      });
      setShowSettingsDialog(false);
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${selectedCampaignId}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStartLiveSession = () => {
    if (isLiveSession) {
      endLiveSessionMutation.mutate();
    } else {
      startLiveSessionMutation.mutate();
    }
  };

  const handleInvitePlayers = () => {
    setShowInviteDialog(true);
    if (!inviteCode) {
      generateInviteMutation.mutate();
    }
  };

  const handleCampaignSettings = () => {
    setShowSettingsDialog(true);
  };

  const handleSendInvite = () => {
    if (!playerEmail.trim()) {
      toast({
        title: "Missing Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }
    invitePlayerMutation.mutate(playerEmail);
  };

  if (!selectedCampaignId) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Select a Campaign</h3>
          <p className="text-muted-foreground mb-6">Choose a campaign to manage and run live sessions</p>
          
          {campaigns.length === 0 ? (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">You haven't created any campaigns yet</p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Campaign
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {campaigns.map((campaign) => (
                <Card 
                  key={campaign.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => onCampaignSelect(campaign.id)}
                >
                  <CardHeader>
                    <CardTitle className="text-base">{campaign.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {campaign.description || "No description"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" size="sm">
                      Select Campaign
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Campaign Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-fantasy font-semibold">Live Campaign Manager</h2>
          {selectedCampaign && (
            <p className="text-muted-foreground">Managing: {(selectedCampaign as any).title}</p>
          )}
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => onCampaignSelect(0)}>
            Change Campaign
          </Button>
          <Dialog open={showCreateSessionDialog} onOpenChange={setShowCreateSessionDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Session
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Session</DialogTitle>
                <DialogDescription>
                  Plan a new session for your campaign
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="session-name">Session Name</Label>
                  <Input
                    id="session-name"
                    placeholder="e.g. The Dragon's Lair"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="session-type">Session Type</Label>
                  <Select value={sessionType} onValueChange={setSessionType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select session type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="story">Story Session</SelectItem>
                      <SelectItem value="combat">Combat Encounter</SelectItem>
                      <SelectItem value="exploration">Exploration</SelectItem>
                      <SelectItem value="roleplay">Roleplay & Social</SelectItem>
                      <SelectItem value="puzzle">Puzzle & Mystery</SelectItem>
                      <SelectItem value="finale">Campaign Finale</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="session-description">Description</Label>
                  <Textarea
                    id="session-description"
                    placeholder="Describe what will happen in this session..."
                    value={sessionDescription}
                    onChange={(e) => setSessionDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowCreateSessionDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateSession}
                    disabled={createSessionMutation.isPending}
                  >
                    {createSessionMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Create Session
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Management Tabs */}
      <Tabs value={activeManagerTab} onValueChange={setActiveManagerTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="party">Party Manager</TabsTrigger>
          <TabsTrigger value="content">Quick Content</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="guidance">Live Guidance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Campaign Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Total Sessions</span>
                    <Badge variant="outline">{sessions.length}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Active Players</span>
                    <Badge variant="outline">{participants.length}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Campaign Status</span>
                    <Badge className="bg-green-600">Active</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Quick Actions</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  className="w-full" 
                  size="sm"
                  onClick={handleStartLiveSession}
                  disabled={startLiveSessionMutation.isPending || endLiveSessionMutation.isPending}
                  variant={isLiveSession ? "destructive" : "default"}
                >
                  {(startLiveSessionMutation.isPending || endLiveSessionMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {!startLiveSessionMutation.isPending && !endLiveSessionMutation.isPending && (
                    <PlayCircle className="h-4 w-4 mr-2" />
                  )}
                  {isLiveSession ? "End Live Session" : "Start Live Session"}
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  size="sm"
                  onClick={handleInvitePlayers}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Players
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  size="sm"
                  onClick={handleCampaignSettings}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Campaign Settings
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Lightbulb className="h-5 w-5 text-yellow-600" />
                  <span>DM Tips</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• Prepare 2-3 backup encounters</p>
                  <p>• Keep player backstories handy</p>
                  <p>• Use the AI assistant for guidance</p>
                  <p>• Take notes during sessions</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="party" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Party Members */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5" />
                    <span>Party Members</span>
                  </div>
                  <Badge variant="outline">{participants.length} Active</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {participants.map((participant: any) => (
                    <div key={participant.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Crown className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium">{participant.character?.name || 'Unknown Character'}</h4>
                          <p className="text-sm text-muted-foreground">
                            Level {participant.character?.level || 1} • {participant.character?.xp || 0} XP
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setSelectedParticipant(participant);
                            setRewardType("xp");
                            setShowRewardDialog(true);
                          }}
                        >
                          <Star className="h-4 w-4 mr-1" />
                          Award XP
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setSelectedParticipant(participant);
                            setShowInventoryDialog(true);
                          }}
                        >
                          <Package className="h-4 w-4 mr-1" />
                          Add Item
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {participants.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2" />
                      <p>No party members yet</p>
                      <p className="text-sm">Invite players to join your campaign</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Rewards Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Gift className="h-5 w-5 text-green-600" />
                  <span>Quick Rewards</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    className="h-20 flex-col"
                    onClick={() => {
                      if (participants.length > 0) {
                        setRewardType("xp");
                        setXpAmount("100");
                        setRewardReason("Combat encounter");
                        setShowRewardDialog(true);
                      }
                    }}
                  >
                    <Sword className="h-6 w-6 mb-1" />
                    <span className="text-xs">Combat XP</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-20 flex-col"
                    onClick={() => {
                      if (participants.length > 0) {
                        setRewardType("xp");
                        setXpAmount("50");
                        setRewardReason("Role-playing excellence");
                        setShowRewardDialog(true);
                      }
                    }}
                  >
                    <TrendingUp className="h-6 w-6 mb-1" />
                    <span className="text-xs">RP Bonus</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-20 flex-col"
                    onClick={() => {
                      if (participants.length > 0) {
                        setRewardType("xp");
                        setXpAmount("75");
                        setRewardReason("Quest milestone");
                        setShowRewardDialog(true);
                      }
                    }}
                  >
                    <Target className="h-6 w-6 mb-1" />
                    <span className="text-xs">Quest XP</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-20 flex-col"
                    onClick={() => {
                      if (participants.length > 0) {
                        setShowInventoryDialog(true);
                      }
                    }}
                  >
                    <Coins className="h-6 w-6 mb-1" />
                    <span className="text-xs">Loot Item</span>
                  </Button>
                </div>
                
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-2">Party Statistics</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Average Level:</span>
                      <span>{participants.length > 0 ? Math.round(participants.reduce((sum: number, p: any) => sum + (p.character?.level || 1), 0) / participants.length) : 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total XP Earned:</span>
                      <span>{participants.reduce((sum: number, p: any) => sum + (p.character?.xp || 0), 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Active Session:</span>
                      <Badge variant="outline" className="text-xs">Live</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="content" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Content Creation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  <span>Quick Content Creation</span>
                </CardTitle>
                <CardDescription>
                  Create content on-the-fly during your live session
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    className="h-20 flex-col"
                    onClick={() => handleQuickContentCreation("quest")}
                  >
                    <Target className="h-6 w-6 mb-1" />
                    <span className="text-xs">New Quest</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-20 flex-col"
                    onClick={() => handleQuickContentCreation("location")}
                  >
                    <MapPin className="h-6 w-6 mb-1" />
                    <span className="text-xs">New Location</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-20 flex-col"
                    onClick={() => handleQuickContentCreation("monster")}
                  >
                    <Shield className="h-6 w-6 mb-1" />
                    <span className="text-xs">New Monster</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-20 flex-col"
                    onClick={() => handleQuickContentCreation("magic-item")}
                  >
                    <Sparkles className="h-6 w-6 mb-1" />
                    <span className="text-xs">Magic Item</span>
                  </Button>
                </div>
                
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-2">AI Quick Generate</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="ghost" className="justify-start">
                      <Dice6 className="h-4 w-4 mr-2" />
                      Random Encounter
                    </Button>
                    <Button size="sm" variant="ghost" className="justify-start">
                      <Globe className="h-4 w-4 mr-2" />
                      Random Location
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Live Content Browser */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                  <span>Available Content</span>
                </CardTitle>
                <CardDescription>
                  Quick access to your created content
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs defaultValue="quests" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="quests">Quests</TabsTrigger>
                    <TabsTrigger value="locations">Locations</TabsTrigger>
                    <TabsTrigger value="monsters">Monsters</TabsTrigger>
                    <TabsTrigger value="items">Items</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="quests" className="space-y-2 max-h-60 overflow-y-auto">
                    {quests.slice(0, 5).map((quest: any) => (
                      <div key={quest.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <p className="font-medium text-sm">{quest.title}</p>
                          <p className="text-xs text-muted-foreground">{quest.difficulty}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => handleQuickContentEdit("quest", quest)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </TabsContent>
                  
                  <TabsContent value="locations" className="space-y-2 max-h-60 overflow-y-auto">
                    {locations.slice(0, 5).map((location: any) => (
                      <div key={location.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <p className="font-medium text-sm">{location.name}</p>
                          <p className="text-xs text-muted-foreground">{location.environment}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => handleQuickContentEdit("location", location)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </TabsContent>
                  
                  <TabsContent value="monsters" className="space-y-2 max-h-60 overflow-y-auto">
                    {monsters.slice(0, 5).map((monster: any) => (
                      <div key={monster.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <p className="font-medium text-sm">{monster.name}</p>
                          <p className="text-xs text-muted-foreground">CR {monster.cr}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => handleQuickContentEdit("monster", monster)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </TabsContent>
                  
                  <TabsContent value="items" className="space-y-2 max-h-60 overflow-y-auto">
                    {magicItems.slice(0, 5).map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.rarity}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => handleQuickContentEdit("magic-item", item)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-6">
          <div className="space-y-4">
            {sessions.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Sessions Yet</h3>
                <p className="text-muted-foreground mb-4">Create your first session to get started</p>
                <Button onClick={() => setShowCreateSessionDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Session
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {sessions.map((session: any) => (
                  <Card key={session.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{session.name}</CardTitle>
                        <Badge variant={session.status === 'completed' ? 'default' : 'outline'}>
                          {session.status || 'planned'}
                        </Badge>
                      </div>
                      <CardDescription>{session.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center">
                        <div className="text-sm text-muted-foreground">
                          Type: {session.sessionType || 'General'}
                        </div>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button size="sm">
                            <PlayCircle className="h-4 w-4 mr-1" />
                            Start
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="players" className="space-y-6">
          <div className="space-y-4">
            {participants.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Players Yet</h3>
                <p className="text-muted-foreground mb-4">Invite players to join your campaign</p>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Players
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {participants.map((participant: any) => (
                  <Card key={participant.id}>
                    <CardHeader>
                      <CardTitle className="text-base">Player {participant.id}</CardTitle>
                      <CardDescription>
                        Role: {participant.role || 'Player'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center">
                        <Badge variant={participant.isActive ? 'default' : 'outline'}>
                          {participant.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="guidance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BookOpen className="h-5 w-5" />
                  <span>Running Your First Session</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <h4 className="font-medium">Before the Session:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Review player character sheets</li>
                    <li>• Prepare 3-4 encounters</li>
                    <li>• Set up your physical/digital space</li>
                    <li>• Have dice and reference materials ready</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">During the Session:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Start with a recap</li>
                    <li>• Use the AI assistant for guidance</li>
                    <li>• Take notes on player actions</li>
                    <li>• Keep combat moving quickly</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Common DM Challenges</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <h4 className="font-medium">Players Go Off-Script:</h4>
                  <p className="text-sm text-muted-foreground">
                    Embrace it! Use the AI assistant to generate new content on the fly.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Combat Feels Slow:</h4>
                  <p className="text-sm text-muted-foreground">
                    Set time limits for decisions and use initiative trackers.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Player Disagreements:</h4>
                  <p className="text-sm text-muted-foreground">
                    Stay neutral, refer to rules, and keep the game moving.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* XP Reward Dialog */}
      <Dialog open={showRewardDialog} onOpenChange={setShowRewardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Award Experience Points</DialogTitle>
            <DialogDescription>
              Award XP to {selectedParticipant?.character?.name || 'selected character'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="xp-amount">XP Amount</Label>
              <Input
                id="xp-amount"
                type="number"
                placeholder="Enter XP amount"
                value={xpAmount}
                onChange={(e) => setXpAmount(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reward-reason">Reason</Label>
              <Textarea
                id="reward-reason"
                placeholder="Why are you awarding this XP?"
                value={rewardReason}
                onChange={(e) => setRewardReason(e.target.value)}
                rows={3}
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowRewardDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAwardXP}
                disabled={awardXPMutation.isPending}
              >
                {awardXPMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Award XP
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inventory Management Dialog */}
      <Dialog open={showInventoryDialog} onOpenChange={setShowInventoryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Item to Inventory</DialogTitle>
            <DialogDescription>
              Add an item to {selectedParticipant?.character?.name || 'selected character'}'s inventory
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Item</Label>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {magicItems.map((item: any) => (
                  <Button
                    key={item.id}
                    variant={selectedItem?.id === item.id ? "default" : "outline"}
                    className="justify-start p-3 h-auto"
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="text-left">
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.type} • {item.rarity}</p>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="item-quantity">Quantity</Label>
              <Input
                id="item-quantity"
                type="number"
                min="1"
                value={itemQuantity}
                onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowInventoryDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddItemToInventory}
                disabled={addItemToInventoryMutation.isPending || !selectedItem}
              >
                {addItemToInventoryMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Add to Inventory
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Content Creation Dialog */}
      <Dialog open={showContentDialog} onOpenChange={setShowContentDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingContent ? `Edit ${contentType}` : `Create New ${contentType}`}
            </DialogTitle>
            <DialogDescription>
              {editingContent ? 'Modify existing content' : 'Create content quickly during your live session'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {contentType === "quest" && (
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quest Title</Label>
                    <Input 
                      placeholder="Enter quest title"
                      defaultValue={editingContent?.title || ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Difficulty</Label>
                    <Select defaultValue={editingContent?.difficulty || ""}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select difficulty" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                        <SelectItem value="deadly">Deadly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    placeholder="Describe the quest..."
                    defaultValue={editingContent?.description || ""}
                    rows={4}
                  />
                </div>
              </div>
            )}
            
            {contentType === "location" && (
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Location Name</Label>
                    <Input 
                      placeholder="Enter location name"
                      defaultValue={editingContent?.name || ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Environment</Label>
                    <Select defaultValue={editingContent?.environment || ""}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select environment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="city">City</SelectItem>
                        <SelectItem value="dungeon">Dungeon</SelectItem>
                        <SelectItem value="forest">Forest</SelectItem>
                        <SelectItem value="mountain">Mountain</SelectItem>
                        <SelectItem value="desert">Desert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    placeholder="Describe the location..."
                    defaultValue={editingContent?.description || ""}
                    rows={4}
                  />
                </div>
              </div>
            )}
            
            {contentType === "monster" && (
              <div className="grid gap-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Monster Name</Label>
                    <Input 
                      placeholder="Enter monster name"
                      defaultValue={editingContent?.name || ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Challenge Rating</Label>
                    <Input 
                      placeholder="e.g. 1/4, 1, 5"
                      defaultValue={editingContent?.cr || ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Input 
                      placeholder="e.g. humanoid, beast"
                      defaultValue={editingContent?.type || ""}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    placeholder="Describe the monster..."
                    defaultValue={editingContent?.description || ""}
                    rows={4}
                  />
                </div>
              </div>
            )}
            
            {contentType === "magic-item" && (
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Item Name</Label>
                    <Input 
                      placeholder="Enter item name"
                      defaultValue={editingContent?.name || ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rarity</Label>
                    <Select defaultValue={editingContent?.rarity || ""}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select rarity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="common">Common</SelectItem>
                        <SelectItem value="uncommon">Uncommon</SelectItem>
                        <SelectItem value="rare">Rare</SelectItem>
                        <SelectItem value="very rare">Very Rare</SelectItem>
                        <SelectItem value="legendary">Legendary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    placeholder="Describe the magical properties..."
                    defaultValue={editingContent?.description || ""}
                    rows={4}
                  />
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowContentDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (editingContent) {
                    updateContentMutation.mutate(editingContent);
                  } else {
                    createContentMutation.mutate({});
                  }
                }}
                disabled={createContentMutation.isPending || updateContentMutation.isPending}
              >
                {(createContentMutation.isPending || updateContentMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingContent ? "Update" : "Create"} {contentType}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Player Invitation Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Players</DialogTitle>
            <DialogDescription>
              Invite players to join your campaign
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Campaign Invite Code</Label>
              <div className="flex space-x-2">
                <Input 
                  value={inviteCode} 
                  readOnly 
                  placeholder="Generating invite code..."
                />
                <Button 
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(inviteCode);
                    toast({
                      title: "Copied",
                      description: "Invite code copied to clipboard",
                    });
                  }}
                  disabled={!inviteCode}
                >
                  Copy
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Share this code with your players so they can join the campaign
              </p>
            </div>
            
            <div className="border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="player-email">Send Direct Invitation</Label>
                <Input
                  id="player-email"
                  type="email"
                  placeholder="Enter player's email address"
                  value={playerEmail}
                  onChange={(e) => setPlayerEmail(e.target.value)}
                />
              </div>
              
              <div className="flex justify-end space-x-2 mt-4">
                <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                  Close
                </Button>
                <Button 
                  onClick={handleSendInvite}
                  disabled={invitePlayerMutation.isPending || !playerEmail.trim()}
                >
                  {invitePlayerMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Send Invitation
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaign Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Campaign Settings</DialogTitle>
            <DialogDescription>
              Configure your campaign preferences and rules
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="rules">Game Rules</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>
              
              <TabsContent value="general" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Campaign Name</Label>
                    <Input 
                      placeholder="Enter campaign name"
                      defaultValue={selectedCampaign?.title || ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Players</Label>
                    <Select defaultValue="6">
                      <SelectTrigger>
                        <SelectValue placeholder="Select max players" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 Players</SelectItem>
                        <SelectItem value="4">4 Players</SelectItem>
                        <SelectItem value="5">5 Players</SelectItem>
                        <SelectItem value="6">6 Players</SelectItem>
                        <SelectItem value="8">8 Players</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Campaign Description</Label>
                  <Textarea 
                    placeholder="Describe your campaign..."
                    defaultValue={selectedCampaign?.description || ""}
                    rows={3}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="rules" className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Allow Critical Hits</h4>
                      <p className="text-sm text-muted-foreground">Enable critical hit mechanics</p>
                    </div>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Death Saving Throws</h4>
                      <p className="text-sm text-muted-foreground">Use standard death saving throw rules</p>
                    </div>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Milestone Leveling</h4>
                      <p className="text-sm text-muted-foreground">Level up based on story milestones instead of XP</p>
                    </div>
                    <input type="checkbox" className="rounded" />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="advanced" className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Session Recording</Label>
                    <Select defaultValue="manual">
                      <SelectTrigger>
                        <SelectValue placeholder="Select recording option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Recording</SelectItem>
                        <SelectItem value="manual">Manual Recording</SelectItem>
                        <SelectItem value="automatic">Automatic Recording</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">AI Assistance</h4>
                      <p className="text-sm text-muted-foreground">Enable AI-powered DM assistance during sessions</p>
                    </div>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Real-time Dice Rolling</h4>
                      <p className="text-sm text-muted-foreground">Allow players to roll dice through the platform</p>
                    </div>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => updateCampaignMutation.mutate({})}
                disabled={updateCampaignMutation.isPending}
              >
                {updateCampaignMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Save Settings
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}