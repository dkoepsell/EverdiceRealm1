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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="players">Players</TabsTrigger>
          <TabsTrigger value="guidance">DM Guidance</TabsTrigger>
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
                <Button className="w-full" size="sm">
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Start Live Session
                </Button>
                <Button variant="outline" className="w-full" size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Players
                </Button>
                <Button variant="outline" className="w-full" size="sm">
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
    </div>
  );
}